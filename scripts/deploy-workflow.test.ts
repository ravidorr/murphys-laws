import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDirectory = path.join(rootDirectory, '.github/workflows');
const sanitizer = path.join(rootDirectory, 'backend/scripts/sanitize-db-copy.sh');
const migrationsDirectory = path.join(rootDirectory, 'backend/db/migrations');

type Step = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  if?: unknown;
  'continue-on-error'?: unknown;
};
type Workflow = {
  on?: { workflow_dispatch?: { inputs?: Record<string, unknown> | null } | null };
  jobs?: Record<string, { steps?: Step[]; 'continue-on-error'?: unknown; env?: Record<string, unknown> }>;
};

function readWorkflow(name: string): Workflow {
  return load(readFileSync(path.join(workflowsDirectory, name), 'utf8')) as Workflow;
}

const deployWorkflow = readWorkflow('deploy.yml');
const deploySteps = deployWorkflow.jobs?.deploy?.steps ?? [];
const indexOfStep = (name: string): number => deploySteps.findIndex((step) => step.name === name);
const fetchIndex = indexOfStep('Fetch a sanitized copy of the production database');
const buildIndex = indexOfStep('Build project');
const cleanupIndex = indexOfStep('Delete the database copy and the SSH key');
const uploadIndex = indexOfStep('Upload build artifacts');
const fetchStep = deploySteps[fetchIndex];
const buildStep = deploySteps[buildIndex];
const cleanupStep = deploySteps[cleanupIndex];

test('the steps exist and run in the order fetch, build, cleanup, upload', () => {
  for (const [name, index] of Object.entries({ fetchIndex, buildIndex, cleanupIndex, uploadIndex })) {
    assert.ok(index >= 0, `${name} is a step of deploy.yml`);
  }
  assert.ok(fetchIndex < buildIndex && buildIndex < cleanupIndex && cleanupIndex < uploadIndex);
});

test('the deploy has no archive or live-API build left', () => {
  // The emergency option built from the archive, whose law IDs differ from production's (wrong law on every
  // page). If the server cannot be reached the deploy cannot upload or migrate either, so it would never help.
  assert.equal(deployWorkflow.on?.workflow_dispatch?.inputs ?? undefined, undefined, 'workflow_dispatch has no inputs');
  const text = readFileSync(path.join(workflowsDirectory, 'deploy.yml'), 'utf8');
  assert.doesNotMatch(text, /seeded_build|SEEDED_BUILD/);
  for (const step of [fetchStep, buildStep]) {
    assert.doesNotMatch(JSON.stringify(step), /API_BASE_URL|murphys-laws\.com/, `${step?.name} does not read the production API`);
  }
});

test('the build prerenders from the fetched copy through the local API', () => {
  assert.equal(buildStep?.env?.MURPHYS_DB_PATH, '${{ runner.temp }}/prod-db-copy/murphys.db');
  const lines = (buildStep?.run ?? '').split('\n').map((line) => line.trim());
  assert.deepEqual(lines.filter(Boolean), ['npm run build:openapi', 'npm run build:web']);
  const { env: jobEnv } = deployWorkflow.jobs?.deploy ?? {};
  assert.equal(jobEnv?.MURPHYS_DB_PATH, undefined, 'only the build step sees the copy');
});

test('only the cleanup step may run after a failure, and no other job can follow', () => {
  const after = deploySteps.slice(fetchIndex + 1);
  const runsAfterFailure = after.filter((step) => /always|failure|cancelled/.test(String(step.if ?? '')));
  assert.deepEqual(runsAfterFailure.map((step) => step.name), ['Delete the database copy and the SSH key']);
  assert.equal(indexOfStep('Deploy and restart services') >= 0, true);
  assert.equal(deploySteps[indexOfStep('Deploy and restart services')]?.if, undefined, 'the production migration only runs after every step before it passed');
  assert.deepEqual(Object.keys(deployWorkflow.jobs ?? {}), ['deploy'], 'no downstream job can run after a failed deploy');
});

test('nothing between the fetch and the upload may continue after a failure', () => {
  assert.doesNotMatch(String(deploySteps[uploadIndex]?.if ?? ''), /always|failure|cancelled/, 'the upload must not run after a failed build');
  for (const step of deploySteps.slice(fetchIndex, uploadIndex + 1)) {
    assert.equal(step['continue-on-error'], undefined, `${step.name} must not continue on error`);
  }
  assert.equal(deployWorkflow.jobs?.deploy?.['continue-on-error'], undefined);
  for (const step of [fetchStep, buildStep]) assert.equal(step?.if, undefined, `${step?.name} always runs`);
});

test('the copy and the key are deleted even when the fetch or the build fails, and are never uploaded', () => {
  assert.equal(cleanupStep?.if, 'always()');
  assert.match(cleanupStep?.run ?? '', /rm -rf "\$RUNNER_TEMP\/prod-db-copy" "\$RUNNER_TEMP\/deploy-ssh"/);
  const upload = deploySteps[uploadIndex];
  for (const source of String(upload?.with?.source).split(',')) {
    assert.doesNotMatch(source, /\.db$|prod-db-copy|deploy-ssh/, `${source} is uploaded`);
  }
  const everyStep = JSON.stringify(deploySteps);
  assert.doesNotMatch(everyStep, /upload-artifact/, 'no artifact upload anywhere in the deploy');
});

test('the key never appears in a command line or the log: it comes from env, in a private file that is removed', () => {
  const script = fetchStep?.run ?? '';
  assert.doesNotMatch(script, /\$\{\{/, 'no secret is interpolated into the script text');
  for (const name of ['SERVER_HOST', 'SERVER_USER', 'SSH_PRIVATE_KEY', 'SERVER_HOST_KEY']) {
    assert.match(String(fetchStep?.env?.[name]), new RegExp(`^\\$\\{\\{ secrets\\['${name}'\\] \\}\\}$`));
  }
  assert.match(script, /^set -euo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(script, /chmod 600 "\$ssh_dir\/key"/);
  assert.match(script, /rm -f "\$ssh_dir\/key"/);
  assert.doesNotMatch(script, /\becho\b[^\n]*\$\{?(SSH_PRIVATE_KEY|SERVER_HOST|SERVER_USER)/);
  assert.doesNotMatch(script, /\bset -x\b/);
});

test('pull-request CI keeps its seeded local API build and never reads production', () => {
  const steps = Object.values(readWorkflow('web-ci.yml').jobs ?? {}).flatMap((job) => job.steps ?? []);
  assert.ok(steps.some((step) => step.run?.trim() === 'npm run build:web'));
  for (const step of steps) {
    const text = JSON.stringify(step);
    assert.ok(!/murphys-laws\.com/.test(text), `${step.name} must not read production`);
    assert.ok(!/MURPHYS_DB_PATH/.test(text), `${step.name} must not point the build at another database`);
    for (const [, url] of text.matchAll(/API_BASE_URL[=:]\s*\\?"?([^\s"\\]+)/g)) {
      assert.match(url ?? '', /^http:\/\/(127\.0\.0\.1|localhost)[:/]/, `${step.name} sets API_BASE_URL to ${url}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Running the steps' scripts with stand-ins for ssh and npm

type Sandbox = { directory: string; runnerTemp: string; bin: string; fixture: string; log: string };

/** A database in the production shape, with personal data in it, and a PATH whose `ssh` plays the server. */
function createSandbox(): Sandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-fetch-'));
  const runnerTemp = path.join(directory, 'runner-temp');
  const bin = path.join(directory, 'bin');
  mkdirSync(runnerTemp);
  mkdirSync(bin);
  const fixture = path.join(directory, 'live.db');
  for (const file of readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql') && name < '022').sort()) {
    const result = spawnSync('sqlite3', [fixture], { input: readFileSync(path.join(migrationsDirectory, file)), encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
  const seed = `
    CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO laws (title, text, status, first_seen_file_path, first_seen_line_number) VALUES ('Fixture', 'A fixture law.', 'published', 'f.md', 900001);
    INSERT INTO attributions (law_id, name, contact_type, contact_value) SELECT id, 'Ann', 'email', 'ann.secret@example.org' FROM laws WHERE first_seen_line_number = 900001;
    INSERT INTO votes (law_id, vote_type, voter_identifier) SELECT id, 'up', 'fingerprint-abc123' FROM laws WHERE first_seen_line_number = 900001;
    INSERT INTO email_subscriptions (email, token) VALUES ('sub.secret@example.org', 'tok');
  `;
  assert.equal(spawnSync('sqlite3', [fixture], { input: seed, encoding: 'utf8' }).status, 0);
  // The same database with every law removed, as the sanitizer would send it
  spawnSync('sqlite3', [fixture, `.backup '${fixture}.nolaws'`]);
  spawnSync('sqlite3', [`${fixture}.nolaws`, 'PRAGMA foreign_keys = ON; DELETE FROM laws;']);
  const log = path.join(directory, 'ssh');
  // `ssh` records how it was called, then plays the server according to STUB_SERVER: it runs the script it is
  // given on stdin against the fixture ("sanitized"), sends the fixture as it is ("raw"), or fails ("down").
  writeFileSync(path.join(bin, 'ssh'), `#!/bin/bash
key=""
while [ $# -gt 0 ]; do
  case "$1" in
    -i) key="$2"; shift 2 ;;
    -o) echo "$2" >> "${log}.options"; shift 2 ;;
    *) break ;;
  esac
done
echo "$1" > "${log}.target"
echo "$2" > "${log}.command"
ls -l "$key" | cut -c1-10 > "${log}.keymode"
cat "$key" > "${log}.keycontent"
case "$STUB_SERVER" in
  sanitized) exec bash -s -- export "${fixture}" ;;
  raw) cat "${fixture}" ;;
  empty) : ;;
  truncated) bash -s -- export "${fixture}" | head -c 20000 ;;
  partial) head -c 4096 "${fixture}"; exit 7 ;;
  nolaws) bash -s -- export "${fixture}.nolaws" ;;
  chatter) echo "Welcome to the server"; exec bash -s -- export "${fixture}" ;;
  *) echo "ssh: connect to host: Connection timed out" >&2; exit 255 ;;
esac
`);
  chmodSync(path.join(bin, 'ssh'), 0o755);
  return { directory, runnerTemp, bin, fixture, log };
}

function runFetchStep(sandbox: Sandbox, server: string, secrets: Record<string, string> = {}) {
  return spawnSync('bash', ['-e', '-c', fetchStep?.run ?? ''], {
    cwd: rootDirectory,
    env: {
      PATH: `${sandbox.bin}:${process.env.PATH}`,
      RUNNER_TEMP: sandbox.runnerTemp,
      STUB_SERVER: server,
      SERVER_HOST: 'server.invalid',
      SERVER_USER: 'deployer',
      SSH_PRIVATE_KEY: '-----BEGIN FAKE KEY-----\nabc\n-----END FAKE KEY-----',
      ...secrets,
    },
    encoding: 'utf8',
  });
}

const copyPath = (sandbox: Sandbox): string => path.join(sandbox.runnerTemp, 'prod-db-copy', 'murphys.db');
const fixtureSecrets = ['ann.secret@example.org', 'sub.secret@example.org', 'fingerprint-abc123'];

test('the fetch runs the sanitizer on the server and brings back only the sanitized copy', () => {
  const sandbox = createSandbox();
  const result = runFetchStep(sandbox, 'sanitized');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Fetched a sanitized copy: [1-9][0-9]* published laws, [0-9]+ bytes/);

  const bytes = readFileSync(copyPath(sandbox)).toString('latin1');
  for (const secret of fixtureSecrets) assert.ok(!bytes.includes(secret), `${secret} is in the fetched copy`);
  for (const text of [result.stdout, result.stderr]) {
    for (const secret of [...fixtureSecrets, 'server.invalid', 'deployer', 'FAKE KEY']) assert.ok(!text.includes(secret), `${secret} is in the log`);
  }

  assert.equal(readFileSync(`${sandbox.log}.command`, 'utf8').trim(), 'sudo bash -s -- export /root/murphys-laws/backend/murphys.db');
  assert.equal(readFileSync(`${sandbox.log}.target`, 'utf8').trim(), 'deployer@server.invalid');
  assert.equal(readFileSync(`${sandbox.log}.keymode`, 'utf8').trim(), '-rw-------', 'the key file is private');
  assert.match(readFileSync(`${sandbox.log}.keycontent`, 'utf8'), /BEGIN FAKE KEY-----\nabc\n-----END FAKE KEY-----\n$/, 'the key ends in a newline');
  assert.ok(!existsSync(path.join(sandbox.runnerTemp, 'deploy-ssh', 'key')), 'the key file is removed once the copy is fetched');
  const options = readFileSync(`${sandbox.log}.options`, 'utf8');
  assert.match(options, /BatchMode=yes/);
  assert.match(options, /StrictHostKeyChecking=accept-new/);
  assert.match(result.stdout, /::warning::The SERVER_HOST_KEY secret is not set/);
});

test('a pinned host key is written to known_hosts and enforced', () => {
  const sandbox = createSandbox();
  const result = runFetchStep(sandbox, 'sanitized', { SERVER_HOST_KEY: 'server.invalid ssh-ed25519 AAAAFAKEKEY' });
  assert.equal(result.status, 0, result.stderr);
  const options = readFileSync(`${sandbox.log}.options`, 'utf8');
  assert.match(options, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(options, /accept-new/);
  assert.equal(readFileSync(path.join(sandbox.runnerTemp, 'deploy-ssh', 'known_hosts'), 'utf8'), 'server.invalid ssh-ed25519 AAAAFAKEKEY\n');
  assert.doesNotMatch(result.stdout, /SERVER_HOST_KEY secret is not set/);
});

test('an unreachable server fails the fetch and leaves no usable copy', () => {
  const sandbox = createSandbox();
  const result = runFetchStep(sandbox, 'down');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Connection timed out/);
  assert.doesNotMatch(result.stdout, /Fetched a sanitized copy/);
  const copy = copyPath(sandbox);
  assert.ok(!existsSync(copy) || readFileSync(copy).length === 0, 'at most an empty file is left, which the build refuses');
});

test('an empty answer, a shell that prints first, or a copy that still holds personal data, fails the fetch', () => {
  for (const server of ['empty', 'chatter', 'raw']) {
    const sandbox = createSandbox();
    const result = runFetchStep(sandbox, server);
    assert.notEqual(result.status, 0, server);
    if (server !== 'raw') assert.match(result.stdout, /did not send a SQLite database/, server);
    for (const secret of fixtureSecrets) assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret), `${server}: ${secret} is in the log`);
  }
});

test('a corrupt or truncated copy, a stream that dies half way, and a copy with no laws all fail the fetch', () => {
  const messages: Record<string, RegExp> = {
    truncated: /integrity check|malformed|not a database|did not send/i,
    partial: /^$/,
    nolaws: /holds no published law/,
  };
  for (const [server, message] of Object.entries(messages)) {
    const sandbox = createSandbox();
    const result = runFetchStep(sandbox, server);
    assert.notEqual(result.status, 0, server);
    assert.doesNotMatch(result.stdout, /Fetched a sanitized copy/, server);
    if (server !== 'partial') assert.match(`${result.stdout}${result.stderr}`, message, server);
  }
});

test('a missing secret fails the fetch before it connects', () => {
  for (const name of ['SERVER_HOST', 'SERVER_USER', 'SSH_PRIVATE_KEY']) {
    const sandbox = createSandbox();
    const result = runFetchStep(sandbox, 'sanitized', { [name]: '' });
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, new RegExp(`${name} secret is not set`));
    assert.ok(!existsSync(`${sandbox.log}.command`), `${name}: ssh must not run`);
  }
});

test('the cleanup step removes the copy and the key', () => {
  const sandbox = createSandbox();
  assert.equal(runFetchStep(sandbox, 'sanitized').status, 0);
  mkdirSync(path.join(sandbox.runnerTemp, 'deploy-ssh'), { recursive: true });
  writeFileSync(path.join(sandbox.runnerTemp, 'deploy-ssh', 'key'), 'left behind');
  const result = spawnSync('bash', ['-e', '-c', cleanupStep?.run ?? ''], { env: { PATH: process.env.PATH, RUNNER_TEMP: sandbox.runnerTemp }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(readdirSync(sandbox.runnerTemp), []);
});

test('the build step runs the OpenAPI export and the web build, and a failure fails the step', () => {
  const run = (npmExitCode: number): { status: number | null; commands: string[] } => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-build-'));
    const log = path.join(directory, 'npm.log');
    const npm = path.join(directory, 'npm');
    writeFileSync(npm, `#!/bin/sh\necho "$*" >> "${log}"\nexit ${npmExitCode}\n`);
    chmodSync(npm, 0o755);
    const result = spawnSync('bash', ['-e', '-c', buildStep?.run ?? ''], { env: { PATH: `${directory}:${process.env.PATH}` }, encoding: 'utf8' });
    return { status: result.status, commands: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] };
  };
  assert.deepEqual(run(0), { status: 0, commands: ['run build:openapi', 'run build:web'] });
  const failed = run(1);
  assert.notEqual(failed.status, 0);
  assert.equal(failed.commands.length, 1, 'nothing runs after the first failure');
});

// ---------------------------------------------------------------------------------------------------------------
// The nginx part of the "Deploy and restart services" step, run with stand-ins for sudo and nginx. The step installs
// the new site file and tests it before anything on the live tree is replaced (the guard), and reloads nginx once the
// new files are in place (the reload).

const deployScript = String(deploySteps[indexOfStep('Deploy and restart services')]?.with?.script ?? '');
const firstRsync = deployScript.indexOf('sudo rsync -a --delete "$STAGING_DIR/web/dist/" "$TARGET_DIR/web/dist/"');
const rootPartStart = deployScript.indexOf('sudo --preserve-env=GITHUB_SHA');
const nginxBlockStart = deployScript.indexOf('echo "==> Deploy: testing nginx.conf before the release replaces anything"');
const nginxBlockEnd = firstRsync;
const nginxBlock = deployScript.slice(nginxBlockStart, nginxBlockEnd);
const reloadBlockStart = deployScript.indexOf('echo "==> Deploy: reloading nginx"');
const reloadBlock = deployScript.slice(reloadBlockStart, rootPartStart);
const liveSite = '/etc/nginx/sites-available/murphys-laws';
// Without the live path the sandbox would not redirect the block, and it would run against the real /etc/nginx.
assert.ok(nginxBlock.includes(liveSite), 'the nginx block of the deploy step names the live site file');

type NginxSandbox = { directory: string; site: string; temp: string; calls: string };

function createNginxSandbox(previous: string | null): NginxSandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-nginx-'));
  const bin = path.join(directory, 'bin');
  const temp = path.join(directory, 'tmp');
  const site = path.join(directory, 'murphys-laws');
  const calls = path.join(directory, 'calls.log');
  mkdirSync(bin);
  mkdirSync(temp);
  mkdirSync(path.join(directory, 'staging'));
  writeFileSync(path.join(directory, 'staging', 'nginx.conf'), 'new config\n');
  if (previous !== null) writeFileSync(site, previous);
  // sudo just runs the command; nginx -t answers according to STUB_NGINX_TEST and records which file it read.
  writeFileSync(path.join(bin, 'sudo'), '#!/bin/sh\nexec "$@"\n');
  writeFileSync(
    path.join(bin, 'nginx'),
    `#!/bin/sh\necho "nginx $* [site: $(cat "${site}")]" >> "${calls}"\n` +
      `[ "$STUB_NGINX_TEST" = fail ] && echo 'nginx: [emerg] unknown directive "module_directive"' >&2\n` +
      `[ "$STUB_NGINX_TEST" = fail ] && exit 1\nexit 0\n`,
  );
  writeFileSync(path.join(bin, 'systemctl'), `#!/bin/sh\necho "systemctl $*" >> "${calls}"\n`);
  // macOS mktemp ignores TMPDIR when it has no template, GNU mktemp honors it: always create under TMPDIR.
  writeFileSync(path.join(bin, 'mktemp'), '#!/bin/sh\nexec /usr/bin/mktemp "$TMPDIR/nginx-site.XXXXXX"\n');
  // cp fails for the backup (cp -p) when STUB_CP_FAIL=backup, and for the copy of the new file when it is "install".
  writeFileSync(
    path.join(bin, 'cp'),
    `#!/bin/sh\ncase "$STUB_CP_FAIL:$1" in\n  backup:-p) [ "$STUB_CP_COUNT" = 1 ] && exit 1 ;;\n  restore:-p) case "$3" in *murphys-laws) exit 1 ;; esac ;;\n  install:*nginx.conf) exit 1 ;;\nesac\nexec /bin/cp "$@"\n`,
  );
  for (const name of ['sudo', 'nginx', 'systemctl', 'mktemp', 'cp']) chmodSync(path.join(bin, name), 0o755);
  return { directory, site, temp, calls };
}

function runNginxBlock(sandbox: NginxSandbox, nginxTest: 'pass' | 'fail', after = '', cpFails = '') {
  const script = `${nginxBlock.replaceAll(liveSite, sandbox.site)}\n${after}`;
  return spawnSync('bash', ['-e', '-c', script], {
    env: {
      PATH: `${path.join(sandbox.directory, 'bin')}:${process.env.PATH}`,
      TMPDIR: sandbox.temp,
      STAGING_DIR: path.join(sandbox.directory, 'staging'),
      STUB_NGINX_TEST: nginxTest,
      STUB_CP_FAIL: cpFails,
      STUB_CP_COUNT: '1',
    },
    encoding: 'utf8',
  });
}

const callsOf = (sandbox: NginxSandbox): string[] =>
  existsSync(sandbox.calls) ? readFileSync(sandbox.calls, 'utf8').trim().split('\n') : [];

test('the nginx parts of the deploy step are found where the tests expect them', () => {
  assert.ok(nginxBlockStart > -1 && firstRsync > nginxBlockStart, 'the guard sits before the first rsync');
  assert.ok(reloadBlockStart > firstRsync && rootPartStart > reloadBlockStart, 'the reload sits after the rsyncs and before the sudo bash <<INNER section');
  assert.ok(nginxBlock.includes(liveSite), 'the guard installs the live site file');
  assert.ok(nginxBlock.includes('sudo nginx -t'), 'it tests the configuration');
  assert.ok(nginxBlock.includes('sudo cp "$STAGING_DIR/nginx.conf" "$NGINX_SITE"'), 'it installs the uploaded copy, which is there before any rsync');
  assert.ok(!nginxBlock.includes('TARGET_DIR'), 'it reads nothing from the live tree, which the rsyncs replace');
  assert.doesNotMatch(nginxBlock, /systemctl/, 'the guard never reloads or restarts nginx');
  assert.ok(reloadBlock.includes('sudo systemctl reload nginx'), 'the reload reloads, never restarts, nginx');
  assert.doesNotMatch(reloadBlock, /systemctl restart/);
  assert.doesNotMatch(reloadBlock, /nginx -t|NGINX_SITE/, 'the reload tests and installs nothing: that was done before the release');
});

test('a configuration that nginx accepts is installed and tested, the backup of the previous file is kept until the reload, and nothing is reloaded yet', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'pass', 'echo AFTER_NGINX');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AFTER_NGINX/);
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'new config\n');
  assert.deepEqual(callsOf(sandbox), ['nginx -t [site: new config]'], 'tested once, and not reloaded: that waits for the new files');
  const backups = readdirSync(sandbox.temp);
  assert.equal(backups.length, 1, 'the backup stays, for the exit trap to put back if the release fails before the reload');
  assert.equal(readFileSync(path.join(sandbox.temp, backups[0] as string), 'utf8'), 'old config\n');
});

test('when the exit trap cannot put the previous site file back, it says where the copy is and keeps it', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'pass', 'false', 'restore');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERROR: could not restore .*murphys-laws; the previous copy is in /);
  const backups = readdirSync(sandbox.temp);
  assert.equal(backups.length, 1, 'the backup is kept');
  assert.equal(readFileSync(path.join(sandbox.temp, backups[0] as string), 'utf8'), 'old config\n');
});

test('after an accepted configuration, a later failure puts the previous site file back; success disarms the trap', () => {
  const failed = createNginxSandbox('old config\n');
  const failure = runNginxBlock(failed, 'pass', 'false\necho NOT_REACHED');
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(failure.stdout, /NOT_REACHED/);
  assert.match(failure.stderr, /ERROR: the deploy failed after nginx accepted nginx\.conf and before nginx was reloaded; restoring the previous site file/);
  assert.equal(readFileSync(failed.site, 'utf8'), 'old config\n', 'the new file does not stay armed on disk');
  assert.deepEqual(readdirSync(failed.temp), [], 'the backup is removed once it is back');

  const first = createNginxSandbox(null);
  const firstFailure = runNginxBlock(first, 'pass', 'false');
  assert.notEqual(firstFailure.status, 0);
  assert.ok(!existsSync(first.site), 'a server that had no site file keeps none');

  const done = createNginxSandbox('old config\n');
  const success = runNginxBlock(done, 'pass', `${reloadBlock.replace('sudo systemctl reload nginx', 'sudo true')}\nfalse`);
  assert.notEqual(success.status, 0, 'the script still fails on its own failure');
  assert.equal(readFileSync(done.site, 'utf8'), 'new config\n', 'after the reload the trap no longer restores anything');
  assert.deepEqual(readdirSync(done.temp), [], 'and the backup is removed');
  assert.doesNotMatch(success.stderr, /restoring the previous site file/);
});

test('a configuration that nginx rejects (a module is missing) restores the previous file, fails the deploy and reloads nothing', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'fail', 'echo AFTER_NGINX');
  assert.notEqual(result.status, 0, 'set -e alone does not stop on a failed "nginx -t &&" list');
  assert.doesNotMatch(result.stdout, /AFTER_NGINX/, 'nothing after the block runs');
  assert.match(result.stderr, /unknown directive "module_directive"/);
  assert.match(result.stderr, /nginx\.conf could not be installed or nginx rejected it; restoring the previous site file/);
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'old config\n', 'sites-available never keeps the rejected file');
  assert.deepEqual(callsOf(sandbox), ['nginx -t [site: new config]'], 'nginx was not reloaded');
  assert.deepEqual(readdirSync(sandbox.temp), [], 'the backup of the previous file is removed');
});

test('a rejected configuration on a server with no site file yet leaves none behind', () => {
  const sandbox = createNginxSandbox(null);
  const result = runNginxBlock(sandbox, 'fail');
  assert.notEqual(result.status, 0);
  assert.ok(!existsSync(sandbox.site), 'the rejected file is removed');
  assert.deepEqual(callsOf(sandbox), ['nginx -t [site: new config]']);
  assert.deepEqual(readdirSync(sandbox.temp), []);
});

test('a site file that cannot be backed up fails the deploy before it is touched and is never deleted', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'fail', 'echo AFTER_NGINX', 'backup');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /AFTER_NGINX/);
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'old config\n', 'the live file is neither replaced nor removed');
  assert.deepEqual(callsOf(sandbox), [], 'nginx was neither tested nor reloaded');
});

test('a new file that cannot be installed restores the previous one and fails the deploy', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'pass', 'echo AFTER_NGINX', 'install');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /AFTER_NGINX/);
  assert.match(result.stderr, /could not be installed or nginx rejected it/);
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'old config\n');
  assert.deepEqual(callsOf(sandbox), [], 'nginx was not reloaded');
  assert.deepEqual(readdirSync(sandbox.temp), []);
});

// The script without its comment lines, so that a check for a command is not satisfied or broken by a comment about it.
const commandsOf = (script: string): string =>
  script
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

test('the guard runs before anything on the live tree is replaced: no rsync, install of a file, chown or prune comes before it', () => {
  const before = commandsOf(deployScript.slice(0, nginxBlockStart));
  assert.ok(nginxBlockStart > -1);
  // Only empty directories are created (sudo install -d) and the uploaded scripts are checked before the guard.
  assert.doesNotMatch(before, /\brsync\b/);
  assert.doesNotMatch(before, /sudo install -m/);
  assert.doesNotMatch(before, /chown/);
  assert.doesNotMatch(before, /prune-stale-assets/);
  assert.doesNotMatch(before, /systemctl/);
  assert.match(before, /sudo install -d -m 755 "\$TARGET_DIR\/web\/dist"/, 'the directories are still created first');
  // The old copy of nginx.conf in the live tree is installed by the release, after the guard.
  assert.ok(at(deployScript, 'sudo install -m 644 "$STAGING_DIR/nginx.conf" "$TARGET_DIR/nginx.conf"') > nginxBlockStart);
  // The previous site file exists in /etc/nginx only: nothing of it is in the tree that the rsyncs replace.
  assert.ok(nginxBlockStart < at(deployScript, 'sudo rsync -a --delete "$STAGING_DIR/backend/src/"'));
});

test('the reload waits for the release: it comes after every rsync, the install of the files, the chown and the pruning, and before the root section', () => {
  for (const needle of [
    'sudo rsync -a --delete "$STAGING_DIR/web/dist/" "$TARGET_DIR/web/dist/"',
    'sudo rsync -a --delete "$STAGING_DIR/shared/modules/" "$TARGET_DIR/shared/modules/"',
    'sudo install -m 644 "$STAGING_DIR/web/vite.config.js" "$TARGET_DIR/web/vite.config.js"',
    'sudo chown -R root:root "$TARGET_DIR"',
    'echo "==> Deploy: pruning stale build assets"',
  ]) {
    assert.ok(at(deployScript, needle) < reloadBlockStart, `${needle} comes before the reload`);
  }
  assert.ok(reloadBlockStart < at(deployScript, "<<'INNER'"));
  assert.equal(commandsOf(deployScript).split('systemctl reload nginx').length - 1, 1, 'nginx is reloaded once');
});

// The whole part of the step that runs before the root section, with sudo replaced by a function that records each
// command and runs only the file copies and removals inside the sandbox (the site file and its backup); every other command,
// the rsyncs and installs of the release among them, is only recorded. This is what shows the order of the whole step.
type OrderSandbox = { directory: string; site: string; trace: string };

function runBeforeRoot(nginxTest: 'pass' | 'fail', previous: string | null, script = deployScript.slice(0, rootPartStart), extraEnv: Record<string, string> = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-order-'));
  const home = path.join(directory, 'home');
  const staging = path.join(home, 'deploy/murphys-laws');
  const temp = path.join(directory, 'tmp');
  const site = path.join(directory, 'murphys-laws');
  const trace = path.join(directory, 'trace.log');
  mkdirSync(path.join(staging, 'backend/scripts'), { recursive: true });
  mkdirSync(temp);
  for (const name of ['alert-email', 'backup-murphys', 'backup-offsite', 'health-monitor', 'ssl-monitor', 'cost-optimization-report', 'test-backup-restore']) {
    writeFileSync(path.join(staging, 'backend/scripts', `${name}.sh`), '#!/bin/sh\n');
  }
  writeFileSync(path.join(staging, 'nginx.conf'), 'new config\n');
  if (previous !== null) writeFileSync(site, previous);
  const sudo = [
    'sudo() {',
    '  echo "sudo $*" >> "$TRACE"',
    '  case "$1" in',
    '    nginx) [ "$STUB_NGINX_TEST" != fail ] ;;',
    '    rsync) [ -z "$STUB_RSYNC_FAIL" ] ;;',
    '    systemctl) [ -z "$STUB_RELOAD_FAIL" ] ;;',
    '    mktemp) command mktemp "$TMPDIR/nginx-site.XXXXXX" ;;',
    '    cp|rm) case "${!#}" in "$SANDBOX"/*) command "$@" ;; esac ;;',
    '  esac',
    '}',
  ].join('\n');
  const result = spawnSync('bash', ['-e', '-c', `${sudo}\n${script.replaceAll(liveSite, site)}`], {
    env: { PATH: process.env.PATH, HOME: home, TMPDIR: temp, SANDBOX: directory, TRACE: trace, STUB_NGINX_TEST: nginxTest, ...extraEnv },
    encoding: 'utf8',
  });
  const commands = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [];
  return { result, commands, sandbox: { directory, site, trace } as OrderSandbox };
}

const touchesTheLiveTree = /^sudo (rsync|install -m|chown|env )/;

test('an accepted configuration is tested first, then the release replaces the live tree, and only then is nginx reloaded', () => {
  const { result, commands, sandbox } = runBeforeRoot('pass', 'old config\n');
  assert.equal(result.status, 0, result.stderr);
  const tested = commands.findIndex((command) => command === 'sudo nginx -t');
  const mutations = commands.flatMap((command, index) => (touchesTheLiveTree.test(command) ? [index] : []));
  const reload = commands.findIndex((command) => command === 'sudo systemctl reload nginx');
  assert.ok(tested > -1 && mutations.length >= 10 && reload > -1, commands.join('\n'));
  assert.ok(mutations.every((index) => index > tested), 'every replacement of the live tree comes after nginx -t');
  assert.ok(mutations.every((index) => index < reload), 'every replacement of the live tree comes before the reload');
  assert.deepEqual(commands.slice(reload + 1).filter((command) => !command.startsWith('sudo rm -f ')), [], 'after the reload the step only removes the backup of the previous site file');
  assert.deepEqual(
    commands.slice(0, tested).filter((command) => !/^sudo (install -d|mktemp|cp)/.test(command)),
    [],
    'before nginx -t the step only creates directories, backs up and installs the site file (sudo install -d, mktemp, cp)',
  );
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'new config\n');
  assert.deepEqual(readdirSync(path.join(sandbox.directory, 'tmp')), [], 'the backup of the previous site file is removed once nginx is reloaded');
});

for (const [label, env] of [
  ['an rsync of the release fails', { STUB_RSYNC_FAIL: '1' }],
  ['the reload fails', { STUB_RELOAD_FAIL: '1' }],
] as const) {
  for (const previous of ['old config\n', null]) {
    test(`when ${label} after nginx accepted the configuration${previous === null ? ' (a server with no site file)' : ''}, the previous site file is back and the deploy fails`, () => {
      const { result, commands, sandbox } = runBeforeRoot('pass', previous, undefined, env);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /restoring the previous site file/);
      if (previous === null) assert.ok(!existsSync(sandbox.site), 'no site file is left armed');
      else assert.equal(readFileSync(sandbox.site, 'utf8'), previous, 'the new file does not wait on disk for an unrelated reload');
      assert.deepEqual(readdirSync(path.join(sandbox.directory, 'tmp')), [], 'no backup is left');
      if ('STUB_RSYNC_FAIL' in env) assert.ok(!commands.some((command) => command.includes('systemctl')), 'nothing is reloaded after the failed rsync');
    });
  }
}

test('a rejected configuration stops the step before anything is replaced or reloaded, and the previous site file is back', () => {
  for (const previous of ['old config\n', null]) {
    const { result, commands, sandbox } = runBeforeRoot('fail', previous);
    assert.notEqual(result.status, 0, 'the deploy fails');
    assert.match(result.stderr, /ERROR: nginx\.conf could not be installed or nginx rejected it; restoring the previous site file; nginx is not reloaded and nothing on the live tree was replaced/);
    assert.ok(commands.includes('sudo nginx -t'), 'nginx tested it');
    assert.deepEqual(commands.filter((command) => touchesTheLiveTree.test(command)), [], 'nothing of the release was installed');
    assert.deepEqual(commands.filter((command) => /systemctl|--delete/.test(command)), [], 'no reload and no rsync --delete');
    if (previous === null) {
      assert.ok(!existsSync(sandbox.site), 'a server that had no site file keeps none');
    } else {
      assert.equal(readFileSync(sandbox.site, 'utf8'), previous);
    }
  }
});

test('the harness would catch the old order: with the nginx test moved behind the release, a rejected file is seen after the live tree changed', () => {
  // The same step with the guard moved to where it used to be (just before the reload, after the prune): the checks
  // above must then fail, or they would pass for any order.
  const guard = deployScript.slice(nginxBlockStart, nginxBlockEnd);
  const withoutGuard = deployScript.slice(0, nginxBlockStart) + deployScript.slice(nginxBlockEnd, rootPartStart);
  const old = `${withoutGuard.slice(0, withoutGuard.indexOf('echo "==> Deploy: reloading nginx"'))}${guard}${withoutGuard.slice(withoutGuard.indexOf('echo "==> Deploy: reloading nginx"'))}`;
  const { result, commands } = runBeforeRoot('fail', 'old config\n', old);
  assert.notEqual(result.status, 0);
  assert.ok(commands.some((command) => touchesTheLiveTree.test(command)), 'in the old order the release was already installed when nginx said no');
});

// ---------------------------------------------------------------------------------------------------------------
// The stale-asset pruning part of the same step, run with a stand-in for sudo against throwaway directories

const pruneBlockStart = deployScript.indexOf('echo "==> Deploy: pruning stale build assets"');
const pruneBlock = deployScript.slice(pruneBlockStart, reloadBlockStart);
const liveLogs = '/var/log/nginx/access.log*';
const rootNvm = '/root/.nvm';
const pruneScript = path.join(rootDirectory, 'backend/scripts/prune-stale-assets.mjs');
// Without the live paths the sandbox would not redirect the block, and it would read the real nginx logs.
assert.ok(pruneBlock.includes(liveLogs) && pruneBlock.includes(rootNvm), 'the pruning block of the deploy step names the live logs and nvm');

type PruneSandbox = { directory: string; staging: string; target: string; logs: string; bin: string };

const longAgo = new Date('2020-01-01T00:00:00Z');

function writeDist(dist: string): void {
  const assets = path.join(dist, 'assets');
  mkdirSync(assets, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<script type="module" src="/assets/index-NEW.js"></script>');
  writeFileSync(path.join(dist, 'sw.js'), 'precache("/assets/referenced-OLD.js")');
  // Five recent files are kept by age, referenced-OLD.js by sw.js and requested-OLD.js by the access log; the three
  // old ones that nothing names are the stale ones.
  for (const name of ['index-NEW.js', 'a-NEW.js', 'b-NEW.js', 'c-NEW.js', 'd-NEW.js']) writeFileSync(path.join(assets, name), '// new');
  for (const name of ['referenced-OLD.js', 'requested-OLD.js', 'stale-1-OLD.js', 'stale-2-OLD.js', 'stale-3-OLD.css']) {
    writeFileSync(path.join(assets, name), '// old');
    utimesSync(path.join(assets, name), longAgo, longAgo);
  }
}

function createPruneSandbox({ withLog = true }: { withLog?: boolean } = {}): PruneSandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-prune-'));
  const staging = path.join(directory, 'staging');
  const target = path.join(directory, 'target');
  const logs = path.join(directory, 'logs');
  const bin = path.join(directory, 'bin');
  for (const folder of [logs, bin, path.join(target, 'backend/scripts')]) mkdirSync(folder, { recursive: true });
  writeDist(path.join(staging, 'web/dist'));
  writeDist(path.join(target, 'web/dist'));
  copyFileSync(pruneScript, path.join(target, 'backend/scripts/prune-stale-assets.mjs'));
  if (withLog) {
    writeFileSync(path.join(logs, 'access.log'), '1.2.3.4 - - [01/Nov/2026:10:00:00 +0000] "GET /assets/requested-OLD.js HTTP/2.0" 200 5 "-" "ua"\n');
  }
  writeFileSync(path.join(bin, 'sudo'), '#!/bin/sh\nexec "$@"\n');
  // macOS has no timeout(1): run the command without a limit, as GNU timeout does when it is not reached.
  writeFileSync(path.join(bin, 'timeout'), '#!/bin/sh\nshift\nexec "$@"\n');
  for (const name of ['sudo', 'timeout']) chmodSync(path.join(bin, name), 0o755);
  return { directory, staging, target, logs, bin };
}

function runPruneBlock(sandbox: PruneSandbox) {
  const block = pruneBlock.replaceAll(liveLogs, `${sandbox.logs}/access.log*`).replaceAll(rootNvm, path.join(sandbox.directory, 'no-nvm'));
  return spawnSync('bash', ['-e', '-c', `${block}\necho AFTER_PRUNE`], {
    env: { PATH: `${sandbox.bin}:${process.env.PATH}`, STAGING_DIR: sandbox.staging, TARGET_DIR: sandbox.target },
    encoding: 'utf8',
  });
}

const staleFiles = ['stale-1-OLD.js', 'stale-2-OLD.js', 'stale-3-OLD.css'];
const keptFiles = ['index-NEW.js', 'a-NEW.js', 'b-NEW.js', 'c-NEW.js', 'd-NEW.js', 'referenced-OLD.js', 'requested-OLD.js'];
const presentIn = (sandbox: PruneSandbox, root: 'staging' | 'target', files: string[]): boolean[] =>
  files.map((name) => existsSync(path.join(sandbox[root], 'web/dist/assets', name)));
const assertNothingDeleted = (sandbox: PruneSandbox) => {
  for (const root of ['staging', 'target'] as const) {
    assert.deepEqual(presentIn(sandbox, root, [...staleFiles, ...keptFiles]), Array(10).fill(true), `${root} keeps every file`);
  }
};

test('the pruning part of the deploy step is found where the tests expect it', () => {
  const rsync = deployScript.indexOf('sudo rsync -a --delete "$STAGING_DIR/web/dist/" "$TARGET_DIR/web/dist/"');
  const scriptsRsync = deployScript.indexOf(`sudo rsync -a --delete --exclude='select-law-of-day.mjs' "$STAGING_DIR/backend/scripts/" "$TARGET_DIR/backend/scripts/"`);
  assert.ok(rsync > -1 && scriptsRsync > -1, 'the web root and the scripts are synced');
  assert.ok(pruneBlockStart > rsync && pruneBlockStart > scriptsRsync, 'pruning runs after both rsyncs, so the script and the new build are in place');
  assert.ok(pruneBlockStart > nginxBlockStart && pruneBlockStart < reloadBlockStart, 'pruning runs after nginx accepted the configuration and before it is reloaded');
  assert.match(pruneBlock, /"\$STAGING_DIR\/web\/dist" "\$TARGET_DIR\/web\/dist" 2>&1'/, 'it covers the staging copy and the web root, both quoted');
  assert.doesNotMatch(pruneBlock, /--dry-run|rm -r/);
  assert.match(pruneBlock, /timeout 180 node /, 'a hang is cut off well before the ssh action gives up');
});

test('the pruning deletes the stale files of the staging copy and the web root, keeps the rest and the deploy goes on', () => {
  const sandbox = createPruneSandbox();
  const result = runPruneBlock(sandbox);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AFTER_PRUNE/);
  assert.doesNotMatch(result.stdout + result.stderr, /WARNING/);
  assert.match(result.stdout, /Deleted 6 stale asset files/);
  for (const root of ['staging', 'target'] as const) {
    assert.deepEqual(presentIn(sandbox, root, staleFiles), [false, false, false], `${root} lost its stale files`);
    assert.deepEqual(presentIn(sandbox, root, keptFiles), Array(7).fill(true), `${root} keeps what is named, requested or recent`);
    assert.ok(existsSync(path.join(sandbox[root], 'web/dist/index.html')) && existsSync(path.join(sandbox[root], 'web/dist/sw.js')));
  }
});

test('without any existing access log nothing is deleted, the exit code is reported and the deploy goes on', () => {
  const sandbox = createPruneSandbox({ withLog: false });
  const result = runPruneBlock(sandbox);
  assert.equal(result.status, 0, 'a failing prune never fails the step');
  assert.match(result.stdout, /AFTER_PRUNE/);
  assert.match(result.stdout, /Asset retention aborted, nothing deleted: none of the 1 access log files exists/, 'the reason is in the same stream as the warning');
  assert.match(result.stdout, /WARNING: stale asset pruning did not complete \(exit 1:/);
  assertNothingDeleted(sandbox);
});

test('a web root that fails a safety check stops the pruning of the staging copy too', () => {
  const sandbox = createPruneSandbox();
  writeFileSync(path.join(sandbox.target, 'web/dist/index.html'), '<html>no entry script</html>');
  const result = runPruneBlock(sandbox);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /AFTER_PRUNE/);
  assert.match(result.stdout, /exit 1:/);
  assertNothingDeleted(sandbox);
});

for (const [label, nodeExit] of [
  ['node exits 127, as it does when it is missing', 127],
  ['the script reports failed deletions (exit 3)', 3],
] as const) {
  test(`when ${label}, the deploy only warns with the exit code`, () => {
    const sandbox = createPruneSandbox();
    writeFileSync(path.join(sandbox.bin, 'node'), `#!/bin/sh\n[ "$1" = --version ] && echo v0.0.0 && exit 0\nexit ${nodeExit}\n`);
    chmodSync(path.join(sandbox.bin, 'node'), 0o755);
    const result = runPruneBlock(sandbox);
    assert.equal(result.status, 0, 'the step goes on under set -e');
    assert.match(result.stdout, /AFTER_PRUNE/);
    assert.ok(result.stdout.includes(`WARNING: stale asset pruning did not complete (exit ${nodeExit}:`), result.stdout);
    assertNothingDeleted(sandbox);
  });
}

test('a script that crashes on the server only warns', () => {
  const sandbox = createPruneSandbox();
  writeFileSync(path.join(sandbox.target, 'backend/scripts/prune-stale-assets.mjs'), 'throw new Error("broken");\n');
  const result = runPruneBlock(sandbox);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /AFTER_PRUNE/);
  assert.match(result.stdout, /WARNING: stale asset pruning did not complete \(exit 1:/);
  assertNothingDeleted(sandbox);
});

// ---------------------------------------------------------------------------------------------------------------
// The crontab part of the same step, run with stand-ins for sudo and crontab (and sometimes grep)

const cronBlockStart = deployScript.indexOf('echo "==> Removing the standalone vulnerability scanner cron job');
// The block ends where the comment of the next step, the install of the Law of the Day schedule, begins
const cronBlockEnd = deployScript.indexOf('# The Law of the Day schedule (/etc/cron.d, from backend/config/cron.d).');
const cronBlock = deployScript.slice(cronBlockStart, cronBlockEnd);
const realGrep = spawnSync('sh', ['-c', 'command -v grep'], { encoding: 'utf8' }).stdout.trim();
const realMktemp = spawnSync('sh', ['-c', 'command -v mktemp'], { encoding: 'utf8' }).stdout.trim();
const realRm = spawnSync('sh', ['-c', 'command -v rm'], { encoding: 'utf8' }).stdout.trim();
assert.ok([realGrep, realMktemp, realRm].every((command) => command.startsWith('/')), 'the stand-ins can reach the real grep, mktemp and rm');

type CronSandbox = { directory: string; state: string; writes: string };

/** `crontab` keeps root's crontab in a file and answers `-l` according to STUB_CRONTAB; `crontab -` replaces it. */
function createCronSandbox(initial: string | null): CronSandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-cron-'));
  const bin = path.join(directory, 'bin');
  const state = path.join(directory, 'root-crontab');
  const writes = `${state}.writes`;
  mkdirSync(bin);
  if (initial !== null) writeFileSync(state, initial);
  // sudo just runs the command, after the line it prints on a host whose name does not resolve (STUB_SUDO_NOISE)
  writeFileSync(path.join(bin, 'sudo'), '#!/bin/sh\n[ -z "$STUB_SUDO_NOISE" ] || echo "$STUB_SUDO_NOISE" >&2\nexec "$@"\n');
  // Without LC_ALL=C the "no crontab" answer comes in another language, which the step could not recognize.
  // With STUB_CRONTAB=reads-stdin, `crontab -l` drains its standard input, as a careless command would.
  writeFileSync(
    path.join(bin, 'crontab'),
    `#!/bin/sh
case "$1" in
  -l)
    case "$STUB_CRONTAB" in
      none) [ "$LC_ALL" = C ] || { echo "pas de crontab pour root" >&2; exit 1; }; echo "no crontab for root" >&2; exit 1 ;;
      fail) echo "crontab: cannot read the spool directory: Permission denied" >&2; exit 1 ;;
      fail-silent) exit 1 ;;
      fail-two-lines) echo "no crontab for root (so it seems)" >&2; echo "crontab: the spool directory is gone" >&2; exit 1 ;;
      noisy) echo "crontab: warning: something on stderr" >&2 ;;
      reads-stdin) cat > /dev/null ;;
    esac
    cat "${state}" ;;
  -)
    cat > "${state}.new"
    [ "$STUB_CRONTAB" = write-fails ] && { echo "crontab: errors in crontab file, can't install" >&2; exit 1; }
    echo write >> "${writes}"
    mv "${state}.new" "${state}" ;;
esac
`,
  );
  // macOS mktemp ignores TMPDIR when it has no template, GNU mktemp honors it: always create under TMPDIR, so a file
  // that the step leaves behind shows in the sandbox.
  writeFileSync(path.join(bin, 'mktemp'), `#!/bin/sh\n[ -z "$STUB_MKTEMP_FAIL" ] || { echo "mktemp: cannot create temp file" >&2; exit 1; }\nexec ${realMktemp} "$TMPDIR/crontab-error.XXXXXX"\n`);
  // rm fails when STUB_RM_FAIL is set, as it would on a file that cannot be unlinked.
  writeFileSync(path.join(bin, 'rm'), `#!/bin/sh\n[ -z "$STUB_RM_FAIL" ] || { echo "rm: cannot remove: Operation not permitted" >&2; exit 1; }\nexec ${realRm} "$@"\n`);
  for (const name of ['sudo', 'crontab', 'mktemp', 'rm']) chmodSync(path.join(bin, name), 0o755);
  return { directory, state, writes };
}

function cronEnv(sandbox: CronSandbox, mode: string, extraEnv: Record<string, string> = {}): Record<string, string> {
  return { PATH: `${path.join(sandbox.directory, 'bin')}:${process.env.PATH}`, TMPDIR: sandbox.directory, STUB_CRONTAB: mode, ...extraEnv };
}

function runCronBlock(sandbox: CronSandbox, mode: string, extraEnv: Record<string, string> = {}) {
  return spawnSync('bash', ['-e', '-c', `${cronBlock}\necho AFTER_CRONTAB`], { env: cronEnv(sandbox, mode, extraEnv), encoding: 'utf8' });
}

const writeCountOf = (sandbox: CronSandbox): number => (existsSync(sandbox.writes) ? readFileSync(sandbox.writes, 'utf8').trim().split('\n').length : 0);

/** The step only warns: the block ends with status 0 and the lines after it run, so the deploy script goes on. */
function assertWarnedAndWentOn(result: ReturnType<typeof runCronBlock>, warning: RegExp, label = ''): void {
  assert.equal(result.status, 0, `${label} ${result.stderr}`);
  assert.match(result.stdout, /AFTER_CRONTAB/, `${label}: the deploy script goes on`);
  assert.match(result.stderr, warning, label);
  assert.match(result.stderr, /WARNING: /, label);
}

const rootCrontab = [
  '# Backup',
  '0 4 * * * /usr/local/bin/backup-murphys.sh >> /var/log/backup-murphys.log 2>&1',
  '',
  '0 5 * * * /usr/local/bin/daily-report.sh >> /var/log/daily-report.log 2>&1',
  '*/5 * * * * /usr/local/bin/health-monitor.sh > /dev/null 2>&1',
  '',
].join('\n');
const scannerLine = '0 3 * * 0 /usr/local/bin/vulnerability-scanner.sh >> /var/log/vulnerability-scanner.log 2>&1\n';

test('the crontab part of the deploy step is found where the tests expect it, never pipes a read into a write and never ends the script', () => {
  assert.ok(cronBlockStart > -1 && cronBlockEnd > cronBlockStart, 'the block sits before the PM2 restart');
  assert.ok(cronBlock.includes('vulnerability-scanner.sh'));
  assert.doesNotMatch(cronBlock, /crontab -l[^\n]*[^|]\|(?!\|)/, 'crontab -l is read into a variable, not piped');
  assert.doesNotMatch(cronBlock, /crontab -r/, 'the crontab is never removed');
  assert.doesNotMatch(cronBlock, /\|\|\s*(true|:)\b/, 'no failure of this step is swallowed without a message');
  const commands = cronBlock.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(commands, /(^|[;&|{)]|\$\(|\bthen|\belse|\bdo)\s*(exit|return)\b/m, 'housekeeping never ends the deploy script, it only warns');
  assert.equal((cronBlock.match(/WARNING: /g) ?? []).length, 7, 'each problem has its own plain-text warning');
  assert.doesNotMatch(cronBlock, /::warning::/, 'annotations are not parsed in the remote script');
  assert.doesNotMatch(deployScript, /crontab -l[^\n]*\|[^\n]*crontab -/, 'nowhere in the script is a read piped into a write');
});

test('a crontab that cannot be read is left untouched, not emptied, and the deploy goes on with a warning', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'fail');
  assertWarnedAndWentOn(result, /WARNING: could not read root's crontab \(exit 1: crontab: cannot read the spool directory: Permission denied\); it was left unchanged and the deploy continues/);
  assert.equal(writeCountOf(sandbox), 0, 'crontab - was never run');
  assert.equal(readFileSync(sandbox.state, 'utf8'), `${rootCrontab}${scannerLine}`);
  assert.deepEqual(readdirSync(sandbox.directory).sort(), ['bin', 'root-crontab'], 'the temporary error file is removed');
});

test('a read that fails without a word, or whose last line is not "no crontab", only warns, and the crontab is untouched', () => {
  for (const mode of ['fail-silent', 'fail-two-lines']) {
    const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
    const result = runCronBlock(sandbox, mode);
    assertWarnedAndWentOn(result, /WARNING: could not read root's crontab \(exit 1: /, mode);
    assert.equal(writeCountOf(sandbox), 0, mode);
    assert.equal(readFileSync(sandbox.state, 'utf8'), `${rootCrontab}${scannerLine}`, mode);
  }
});

test('a temporary file that cannot be created only warns and leaves the crontab alone', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'ok', { STUB_MKTEMP_FAIL: '1' });
  assertWarnedAndWentOn(result, /WARNING: could not create a temporary file to read root's crontab; it was left unchanged and the deploy continues/);
  assert.equal(writeCountOf(sandbox), 0);
  assert.equal(readFileSync(sandbox.state, 'utf8'), `${rootCrontab}${scannerLine}`);
});

test('a temporary file that cannot be removed only warns, and the crontab is still rewritten', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'ok', { STUB_RM_FAIL: '1' });
  assertWarnedAndWentOn(result, /WARNING: could not remove the temporary file .*crontab-error\.[^;]*; the deploy continues/);
  assert.equal(readFileSync(sandbox.state, 'utf8'), rootCrontab);
});

test('a server with no crontab for root is left alone and the deploy goes on', () => {
  const sandbox = createCronSandbox(null);
  const result = runCronBlock(sandbox, 'none');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Root has no crontab; nothing to remove\nAFTER_CRONTAB/);
  assert.equal(writeCountOf(sandbox), 0, 'no crontab was created');
  assert.ok(!existsSync(sandbox.state));
});

test('a crontab with the scanner entry loses only that line, written once', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Standalone vulnerability scanner cron job removed\nAFTER_CRONTAB/);
  assert.equal(writeCountOf(sandbox), 1);
  assert.equal(readFileSync(sandbox.state, 'utf8'), rootCrontab, 'every other line is kept, including the comment and the interior blank line');
  assert.deepEqual(readdirSync(sandbox.directory).sort(), ['bin', 'root-crontab', 'root-crontab.writes'], 'the temporary error file is removed');
});

test('every scanner line goes, wherever it sits, and the other lines keep their order', () => {
  const sandbox = createCronSandbox(`# Weekly scan\n${scannerLine}${rootCrontab}${scannerLine}0 6 * * * /usr/local/bin/other.sh\n`);
  const result = runCronBlock(sandbox, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writeCountOf(sandbox), 1);
  assert.equal(readFileSync(sandbox.state, 'utf8'), `# Weekly scan\n${rootCrontab.replace(/\n$/, '')}\n0 6 * * * /usr/local/bin/other.sh\n`);
});

test('a crontab with Windows line endings and no final newline is written back with the other lines intact', () => {
  const sandbox = createCronSandbox('0 4 * * * /usr/local/bin/backup-murphys.sh\r\n0 3 * * 0 /usr/local/bin/vulnerability-scanner.sh\r\n0 5 * * * /usr/local/bin/daily-report.sh');
  const result = runCronBlock(sandbox, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(sandbox.state, 'utf8'), '0 4 * * * /usr/local/bin/backup-murphys.sh\r\n0 5 * * * /usr/local/bin/daily-report.sh\n');
});

test('a very large crontab is rewritten without losing a line', () => {
  const lines = Array.from({ length: 20000 }, (_, index) => `${index % 60} 4 * * * /usr/local/bin/job-${index}.sh`);
  const sandbox = createCronSandbox(`${lines.join('\n')}\n${scannerLine}`);
  const result = runCronBlock(sandbox, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writeCountOf(sandbox), 1);
  assert.equal(readFileSync(sandbox.state, 'utf8'), `${lines.join('\n')}\n`);
});

test('a crontab without the scanner entry is not written at all', () => {
  const sandbox = createCronSandbox(rootCrontab);
  const result = runCronBlock(sandbox, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No standalone vulnerability scanner cron job; the crontab was left unchanged\nAFTER_CRONTAB/);
  assert.equal(writeCountOf(sandbox), 0);
  assert.equal(readFileSync(sandbox.state, 'utf8'), rootCrontab);
});

test('an empty result is never written: a crontab that holds only the scanner entry keeps it and the deploy goes on', () => {
  for (const initial of [scannerLine, `${scannerLine}${scannerLine}`, `\n${scannerLine}  \n\t\n`]) {
    const sandbox = createCronSandbox(initial);
    const result = runCronBlock(sandbox, 'ok');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /WARNING: the vulnerability scanner entry is the only entry in root's crontab; it was left in place/);
    assert.match(result.stdout, /AFTER_CRONTAB/);
    assert.equal(writeCountOf(sandbox), 0);
    assert.equal(readFileSync(sandbox.state, 'utf8'), initial);
  }
});

test('an empty or blank crontab is not written either', () => {
  for (const initial of ['', '\n\n', '  \n']) {
    const sandbox = createCronSandbox(initial);
    const result = runCronBlock(sandbox, 'ok');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(writeCountOf(sandbox), 0);
    assert.equal(readFileSync(sandbox.state, 'utf8'), initial);
  }
});

test('text that crontab -l prints to stderr on success never ends up in the crontab', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'noisy');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /WARNING: crontab -l printed: crontab: warning: something on stderr/, 'the deploy log shows it');
  assert.equal(readFileSync(sandbox.state, 'utf8'), rootCrontab);
});

test('a line that sudo prints first does not hide "no crontab for root", and does not excuse a real failure', () => {
  const noise = { STUB_SUDO_NOISE: 'sudo: unable to resolve host web1: Name or service not known' };
  const none = createCronSandbox(null);
  const noCrontab = runCronBlock(none, 'none', noise);
  assert.equal(noCrontab.status, 0, noCrontab.stderr);
  assert.match(noCrontab.stdout, /Root has no crontab; nothing to remove\nAFTER_CRONTAB/);
  assert.equal(writeCountOf(none), 0);

  const failing = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const failed = runCronBlock(failing, 'fail', noise);
  assertWarnedAndWentOn(failed, /WARNING: could not read root's crontab/);
  assert.equal(writeCountOf(failing), 0);
  assert.equal(readFileSync(failing.state, 'utf8'), `${rootCrontab}${scannerLine}`);
});

test('a grep that errors is neither "no scanner line" nor "nothing left": the crontab is untouched and the deploy goes on with a warning', () => {
  // The first stand-in fails every search; each other one fails only one of the three: the search for the line,
  // the one that drops it, the one that looks for what is left.
  for (const script of [
    'exit 2',
    `case "$*" in *-aF*) exit 2 ;; *) exec ${realGrep} "$@" ;; esac`,
    `case "$*" in *-avF*) exit 2 ;; *) exec ${realGrep} "$@" ;; esac`,
    `case "$*" in *'[^[:space:]]'*) exit 2 ;; *) exec ${realGrep} "$@" ;; esac`,
  ]) {
    const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
    writeFileSync(path.join(sandbox.directory, 'bin', 'grep'), `#!/bin/sh\n${script}\n`);
    chmodSync(path.join(sandbox.directory, 'bin', 'grep'), 0o755);
    const result = runCronBlock(sandbox, 'ok');
    assertWarnedAndWentOn(result, /WARNING: could not search root's crontab for vulnerability-scanner\.sh; it was left unchanged and the deploy continues/, script);
    assert.equal(writeCountOf(sandbox), 0, script);
    assert.equal(readFileSync(sandbox.state, 'utf8'), `${rootCrontab}${scannerLine}`, script);
  }
});

test('a crontab that cannot be written keeps the previous one and the deploy goes on with a warning', () => {
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = runCronBlock(sandbox, 'write-fails');
  assertWarnedAndWentOn(result, /WARNING: could not write root's crontab; it was left as it was and the deploy continues/);
  assert.match(result.stderr, /errors in crontab file/);
  assert.equal(readFileSync(sandbox.state, 'utf8'), `${rootCrontab}${scannerLine}`);
});

test('the step still works when the deploy script is read from standard input, as `sudo bash <<INNER` does', () => {
  // A command that reads standard input would swallow the lines of the script that follow it.
  const sandbox = createCronSandbox(`${rootCrontab}${scannerLine}`);
  const result = spawnSync('bash', ['-e'], { env: cronEnv(sandbox, 'reads-stdin'), input: `${cronBlock}\necho AFTER_CRONTAB\n`, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Standalone vulnerability scanner cron job removed\nAFTER_CRONTAB/);
  assert.equal(readFileSync(sandbox.state, 'utf8'), rootCrontab);
});

test('under the shell options of the deploy script (set -e and an ERR trap), with or without pipefail, every outcome, failures included, is handled by the step itself: the trap stays silent and the script goes on', () => {
  const header = "set -e\ntrap 'echo \"==> Script failed at line $LINENO\"' ERR\n";
  for (const options of ['', 'set -o pipefail\n']) {
    for (const [mode, initial, status] of [
      ['ok', `${rootCrontab}${scannerLine}`, 0],
      ['ok', rootCrontab, 0],
      ['ok', scannerLine, 0],
      ['none', null, 0],
      ['fail', `${rootCrontab}${scannerLine}`, 0],
      ['write-fails', `${rootCrontab}${scannerLine}`, 0],
    ] as const) {
      const sandbox = createCronSandbox(initial);
      const result = spawnSync('bash', ['-c', `${header}${options}${cronBlock}\necho AFTER_CRONTAB`], { env: cronEnv(sandbox, mode), encoding: 'utf8' });
      const label = `${mode} ${options.trim()}`;
      assert.equal(result.status, status, `${label}: ${result.stderr}`);
      assert.match(result.stdout, /AFTER_CRONTAB/, label);
      const trapped = (result.stdout + result.stderr).includes('Script failed at line');
      assert.equal(trapped, false, `${label}: every failure is handled by the step itself, so the ERR trap stays silent`);
    }
  }
});

test('the pruning timeout is longer than the last measured run and shorter than the ssh action allows', () => {
  const measuredSeconds = 69;
  const [, seconds] = /timeout (\d+) node /.exec(pruneBlock) ?? [];
  assert.ok(Number(seconds) >= 2 * measuredSeconds, `a timeout of ${seconds} s leaves room above the 69 s the first run took`);
  const sshStep = deploySteps[indexOfStep('Deploy and restart services')];
  const commandTimeout = String(sshStep?.with?.command_timeout ?? '10m'); // appleboy/ssh-action's default is ten minutes
  const [, amount, unit] = /^(\d+)(s|m|h)$/.exec(commandTimeout) ?? [];
  assert.ok(amount, `command_timeout ${commandTimeout} is a number of seconds, minutes or hours`);
  const limitSeconds = Number(amount) * { s: 1, m: 60, h: 3600 }[unit as 's' | 'm' | 'h'];
  assert.ok(limitSeconds >= 3 * Number(seconds), `the ssh action's ${limitSeconds} s limit leaves room for the rest of the deploy next to ${seconds} s of pruning`);
});

// ---------------------------------------------------------------------------------------------------------------
// The Law of the Day schedule: installed by the deploy step, and by `npm run deploy`

const deployTsSource = readFileSync(path.join(rootDirectory, 'backend/scripts/deploy.ts'), 'utf8');
const installer = 'install-law-of-day-cron.sh';
const lawOfDayMarker = 'echo "==> Installing the Law of the Day schedule"';
const restartMarker = 'echo "==> Restarting PM2"';

/** The position of a needle that must be in the text, so an order check cannot pass because an anchor was renamed. */
const at = (text: string, needle: string): number => {
  const index = text.indexOf(needle);
  assert.ok(index >= 0, `${needle} is in the text`);
  return index;
};

const realRsync = spawnSync('sh', ['-c', 'command -v rsync'], { encoding: 'utf8' }).stdout.trim();
const scriptsSyncLine = deployScript.split('\n').find((line) => line.includes('"$STAGING_DIR/backend/scripts/"')) ?? '';

test('the old select-law-of-day.mjs is neither copied back from staging nor deleted from the server by the scripts sync', () => {
  assert.match(scriptsSyncLine, /rsync -a --delete --exclude='select-law-of-day\.mjs' "\$STAGING_DIR\/backend\/scripts\/" "\$TARGET_DIR\/backend\/scripts\/"/);
  // Nothing before the installer removes the old script or its crontab line, so a refused install leaves the old job as it was
  const beforeInstaller = deployScript.slice(0, at(deployScript, lawOfDayMarker));
  assert.doesNotMatch(beforeInstaller, /rm\b[^\n]*select-law-of-day\.mjs/);
});

test('the scripts sync keeps the old .mjs on the server and does not bring the stale staging copy', { skip: realRsync ? false : 'rsync is not installed' }, () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-rsync-'));
  const staging = path.join(directory, 'staging');
  const target = path.join(directory, 'target');
  for (const dir of [staging, target]) mkdirSync(path.join(dir, 'backend/scripts'), { recursive: true });
  writeFileSync(path.join(staging, 'backend/scripts/select-law-of-day.mjs'), 'stale staging copy\n');
  writeFileSync(path.join(staging, 'backend/scripts/select-law-of-day.ts'), 'new\n');
  writeFileSync(path.join(target, 'backend/scripts/select-law-of-day.mjs'), 'server copy\n');
  writeFileSync(path.join(target, 'backend/scripts/gone.sh'), 'left the repository\n');

  const result = spawnSync('bash', ['-e', '-c', `STAGING_DIR="${staging}"\nTARGET_DIR="${target}"\n${scriptsSyncLine.trim().replace(/^sudo /, '')}`], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(target, 'backend/scripts/select-law-of-day.mjs'), 'utf8'), 'server copy\n');
  assert.equal(readFileSync(path.join(target, 'backend/scripts/select-law-of-day.ts'), 'utf8'), 'new\n');
  assert.equal(existsSync(path.join(target, 'backend/scripts/gone.sh')), false, 'other scripts that left the repository are still deleted');
});

test('the deploy installs the Law of the Day schedule once the files and the dependencies are in place', () => {
  const install = at(deployScript, installer);
  const nginxStart = at(deployScript, 'echo "==> Deploy: testing nginx.conf before the release replaces anything"');
  const rootPart = at(deployScript, "<<'INNER'");
  assert.ok(install > rootPart, 'it runs in the part of the script that runs as root');
  assert.ok(install > at(deployScript, 'npm run migrate'), 'after the dependencies are installed and the migrations ran');
  assert.ok(install > at(deployScript, 'echo "✓ Standalone vulnerability scanner cron job removed"'), 'after the crontab cleanup');
  assert.ok(install < at(deployScript, restartMarker), 'before the restart, where a failure would only be a warning');
  assert.ok(!deployScript.slice(nginxStart, rootPart).includes(installer), 'the nginx guard and reload do not run it');
});

/** The install step of the deploy script, run with a stand-in for the installer that exits with the given status. */
function runInstallStep(installerStatus: number) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-law-of-day-'));
  const scripts = path.join(directory, 'backend/scripts');
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, installer), `echo "installer ran with: $*"\necho "node: $LAW_OF_DAY_NODE_BIN"\necho "stdin: [$(cat)]"\n[ "${installerStatus}" -eq 0 ] || echo "installer says no" >&2\nexit ${installerStatus}\n`);
  const step = deployScript.slice(at(deployScript, lawOfDayMarker), at(deployScript, restartMarker));
  // The rest of the real script is on stdin of the step; the installer must not be able to read it
  return spawnSync('bash', ['-e', '-c', `TARGET_DIR="${directory}"\n${step}\necho AFTER_INSTALL`], { encoding: 'utf8', input: 'REST OF THE DEPLOY SCRIPT' });
}

test('the install step passes the release directory to the installer and prints no warning when it succeeds', () => {
  const result = runInstallStep(0);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /installer ran with: \/[^\n]*deploy-law-of-day-[^\n]*\n/);
  assert.match(result.stdout, /stdin: \[\]\nAFTER_INSTALL/, 'the installer reads nothing from the rest of the deploy script');
  assert.match(result.stdout, /AFTER_INSTALL/);
  // The job runs the node the deploy runs with, as an absolute path with symlinks resolved
  const nodePath = /node: (.*)\n/.exec(result.stdout)?.[1] ?? '';
  assert.equal(nodePath, realpathSync(String(spawnSync('sh', ['-c', 'command -v node'], { encoding: 'utf8' }).stdout.trim())));
  assert.ok(path.isAbsolute(nodePath));
  assert.doesNotMatch(result.stderr, /WARNING/);
});

test('a failed install of the schedule only warns, and the deploy goes on to restart the API', () => {
  const result = runInstallStep(3);
  assert.equal(result.status, 0, 'the step never ends the script under set -e');
  assert.match(result.stdout, /AFTER_INSTALL/);
  assert.match(result.stderr, /installer says no/);
  assert.match(result.stderr, /^WARNING: the Law of the Day schedule was not installed \(exit 3, see the message above\); nothing picks the law at midnight until a deploy installs it, so the first request of each day does, and the deploy continues$/m);
  const step = deployScript.slice(at(deployScript, lawOfDayMarker), at(deployScript, restartMarker));
  const commands = step.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(commands, /(^|[;&|{)]|\bthen|\belse)\s*(exit|return)\b/m, 'the step has no exit of its own');
});

test('the old law-of-day crontab line is left to the installer: the scanner cleanup does not touch it or call the installer', () => {
  const cleanup = deployScript.slice(cronBlockStart, cronBlockEnd);
  assert.doesNotMatch(cleanup, /select-law-of-day/);
  assert.ok(!cleanup.includes(installer));
});

test('npm run deploy installs the schedule too, as root, before it restarts PM2, and only warns when that fails', () => {
  const install = at(deployTsSource, installer);
  assert.ok(install > at(deployTsSource, "'Applying database migrations'"), 'after the dependencies and the migrations');
  assert.ok(install < at(deployTsSource, 'pm2 restart ecosystem.config.cjs'), 'and a failure is handled before the restart');
  // The node of the server (root's nvm node, which npm ci used), resolved there; not the node of the machine that runs the deploy
  assert.ok(deployTsSource.includes("source ~/.nvm/nvm.sh && cd ${DROPLET_PATH}/backend && LAW_OF_DAY_NODE_BIN=\\$(readlink -f \\$(command -v node)) bash scripts/install-law-of-day-cron.sh ${DROPLET_PATH} </dev/null'"), 'the installer gets the server node and no stdin');
  assert.match(deployTsSource, /rsync -avz --delete --exclude='select-law-of-day\.mjs' backend\/scripts\//, 'the old script stays on the server until the installer replaces its job');
  const handler = deployTsSource.slice(install, at(deployTsSource, "log('\\nRestarting PM2 services...'"));
  assert.match(handler, /catch \(error\) \{[\s\S]*?WARNING: the Law of the Day schedule was not installed[\s\S]*?the deployment continues`,\s*'yellow'/, 'the failure is logged as a warning, not rethrown');
  assert.doesNotMatch(handler, /\bthrow\b/);
});

test('the log directory of the job is created by the deploy and is not the one its cleanup removes', () => {
  // The job writes to backend/logs; the cleanup of old root-level files only removes /root/murphys-laws/logs
  assert.match(deployScript, /sudo install -d -m 755 "\$TARGET_DIR\/backend\/logs"/);
  assert.match(deployScript, /rm -rf config modules scripts utils logs/);
  assert.ok(at(deployScript, 'rm -rf config modules scripts utils logs') < at(deployScript, 'cd "$TARGET_DIR/backend"'), 'the cleanup runs in the release root, before it moves into backend');
  assert.match(readFileSync(path.join(rootDirectory, 'backend/config/cron.d/murphys-laws-law-of-day'), 'utf8'), /\/backend\/logs\/law-of-day\.log/);
});
