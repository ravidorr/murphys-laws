import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
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
// The nginx part of the "Deploy and restart services" step, run with stand-ins for sudo, nginx and systemctl

const deployScript = String(deploySteps[indexOfStep('Deploy and restart services')]?.with?.script ?? '');
const nginxBlockStart = deployScript.indexOf('echo "==> Deploy: testing nginx and reloading"');
const nginxBlockEnd = deployScript.indexOf('sudo --preserve-env=GITHUB_SHA');
const nginxBlock = deployScript.slice(nginxBlockStart, nginxBlockEnd);
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
  mkdirSync(path.join(directory, 'target'));
  writeFileSync(path.join(directory, 'target', 'nginx.conf'), 'new config\n');
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
    `#!/bin/sh\ncase "$STUB_CP_FAIL:$1" in\n  backup:-p) [ "$STUB_CP_COUNT" = 1 ] && exit 1 ;;\n  install:*nginx.conf) exit 1 ;;\nesac\nexec /bin/cp "$@"\n`,
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
      TARGET_DIR: path.join(sandbox.directory, 'target'),
      STUB_NGINX_TEST: nginxTest,
      STUB_CP_FAIL: cpFails,
      STUB_CP_COUNT: '1',
    },
    encoding: 'utf8',
  });
}

const callsOf = (sandbox: NginxSandbox): string[] =>
  existsSync(sandbox.calls) ? readFileSync(sandbox.calls, 'utf8').trim().split('\n') : [];

test('the nginx part of the deploy step is found where the tests expect it', () => {
  assert.ok(nginxBlockStart > -1 && nginxBlockEnd > nginxBlockStart, 'the block sits before the sudo bash <<INNER section');
  assert.ok(nginxBlock.includes(liveSite), 'it installs the live site file');
  assert.ok(nginxBlock.includes('sudo nginx -t'), 'it tests the configuration');
  assert.ok(nginxBlock.includes('sudo systemctl reload nginx'), 'it reloads, never restarts, nginx');
  assert.doesNotMatch(nginxBlock, /systemctl restart/);
});

test('a configuration that nginx accepts is installed, tested and then reloaded', () => {
  const sandbox = createNginxSandbox('old config\n');
  const result = runNginxBlock(sandbox, 'pass');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(sandbox.site, 'utf8'), 'new config\n');
  assert.deepEqual(callsOf(sandbox), ['nginx -t [site: new config]', 'systemctl reload nginx']);
  assert.deepEqual(readdirSync(sandbox.temp), [], 'the backup of the previous file is removed');
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

// ---------------------------------------------------------------------------------------------------------------
// The stale-asset pruning part of the same step, run with a stand-in for sudo against throwaway directories

const pruneBlockStart = deployScript.indexOf('echo "==> Deploy: pruning stale build assets"');
const pruneBlock = deployScript.slice(pruneBlockStart, nginxBlockStart);
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
  const scriptsRsync = deployScript.indexOf('sudo rsync -a --delete "$STAGING_DIR/backend/scripts/" "$TARGET_DIR/backend/scripts/"');
  assert.ok(rsync > -1 && scriptsRsync > -1, 'the web root and the scripts are synced');
  assert.ok(pruneBlockStart > rsync && pruneBlockStart > scriptsRsync, 'pruning runs after both rsyncs, so the script and the new build are in place');
  assert.ok(pruneBlockStart > -1 && pruneBlockStart < nginxBlockStart, 'pruning runs before nginx is tested and reloaded');
  assert.match(pruneBlock, /"\$STAGING_DIR\/web\/dist" "\$TARGET_DIR\/web\/dist" 2>&1'/, 'it covers the staging copy and the web root, both quoted');
  assert.doesNotMatch(pruneBlock, /--dry-run|rm -r/);
  assert.match(pruneBlock, /timeout 90 node /, 'a hang is cut off well before the ssh action gives up');
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
