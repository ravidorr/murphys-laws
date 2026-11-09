import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  for (const name of ['SERVER_HOST', 'SERVER_USER', 'SSH_PRIVATE_KEY']) {
    assert.match(String(fetchStep?.env?.[name]), new RegExp(`^\\$\\{\\{ secrets\\['${name}'\\] \\}\\}$`));
  }
  assert.match(script, /^set -euo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(script, /chmod 600 "\$ssh_dir\/key"/);
  assert.match(script, /rm -f "\$ssh_dir\/key"/);
  assert.doesNotMatch(script, /\becho\b[^\n]*(SSH_PRIVATE_KEY|SERVER_HOST|SERVER_USER)/);
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
});

test('an unreachable server fails the fetch and leaves no usable copy', () => {
  const sandbox = createSandbox();
  const result = runFetchStep(sandbox, 'down');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Connection timed out/);
  assert.doesNotMatch(result.stdout, /Fetched a sanitized copy/);
});

test('an empty answer, or a copy that still holds personal data, fails the fetch', () => {
  for (const server of ['empty', 'raw']) {
    const sandbox = createSandbox();
    const result = runFetchStep(sandbox, server);
    assert.notEqual(result.status, 0, server);
    for (const secret of fixtureSecrets) assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret), `${server}: ${secret} is in the log`);
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
