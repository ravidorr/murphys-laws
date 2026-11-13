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
const cronBlockEnd = deployScript.indexOf('echo "==> Restarting PM2"');
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
