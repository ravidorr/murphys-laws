import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDirectory = path.join(rootDirectory, '.github/workflows');

type Step = {
  name?: string;
  id?: string;
  uses?: string;
  with?: Record<string, string>;
  run?: string;
  shell?: string;
  if?: string;
  env?: Record<string, string>;
  'continue-on-error'?: unknown;
};
type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  'continue-on-error'?: unknown;
  defaults?: unknown;
  'timeout-minutes'?: number;
  steps?: Step[];
};
type Workflow = {
  on?: { push?: Record<string, unknown> | null; pull_request?: Record<string, unknown> | null };
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
  permissions?: Record<string, string>;
  defaults?: unknown;
  jobs?: Record<string, Job>;
};

const workflow = load(readFileSync(path.join(workflowsDirectory, 'lockfile-sync.yml'), 'utf8')) as Workflow;
const jobs = workflow.jobs ?? {};

// The repository ruleset requires a status check with this name. It is a job's name, so it has to stay on the gate.
const requiredCheckName = 'lockfile-sync';
// Intentionally a hard-coded list: adding a job to the workflow means adding it here and to the gate's needs list, which
// is exactly the review step this test exists to force (a job outside the gate can fail without blocking a merge).
const checkJobIds = ['lockfile-versions', 'scripts-tests'];
const gateId = 'ci-gate';

function jobNamed(id: string): Job {
  const job = jobs[id];
  assert.ok(job, `the workflow has a job "${id}"`);
  return job;
}

function stepsOf(id: string): Step[] {
  return jobNamed(id).steps ?? [];
}

// The step that runs a command, found by what it runs rather than by its label.
function stepRunning(id: string, command: RegExp): { step: Step; index: number } {
  const index = stepsOf(id).findIndex((step) => command.test((step.run ?? '').trim()));
  assert.ok(index !== -1, `job ${id} has a step that runs ${command}`);
  return { step: stepsOf(id)[index] as Step, index };
}

function reportedName(id: string, job: Job): string {
  return job.name ?? id;
}

// Runs a step's script the way GitHub runs an unlabelled `run:` step on Linux (bash -eo pipefail).
function runScript(script: string, env: Record<string, string>) {
  return spawnSync('/bin/bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { encoding: 'utf8', env });
}

test('the root checks run on every pull request and every push to main, with nothing that can skip a pull request', () => {
  assert.ok(workflow.on && 'pull_request' in workflow.on, 'pull_request is a trigger');
  // `pull_request:` with no filters parses to null; any paths, paths-ignore, branches or types key would narrow it.
  assert.deepEqual(Object.keys(workflow.on?.pull_request ?? {}), []);
  assert.deepEqual(workflow.on?.push, { branches: ['main'] });
  assert.deepEqual(Object.keys(workflow.on ?? {}).sort(), ['pull_request', 'push']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
});

test('a newer push to a pull request cancels the older run, and no run on main shares a group or is cancelled', () => {
  // Each push to main has its own group (its sha): a group holds one running and one pending run, and a third arrival
  // would cancel the pending one, leaving its commit without a result.
  assert.equal(workflow.concurrency?.group, 'lockfile-sync-${{ github.event.pull_request.number || github.sha }}');
  assert.equal(workflow.concurrency?.['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
});

test('the jobs are exactly the checks plus the gate, and nothing in them can swallow or skip a failure', () => {
  assert.deepEqual(Object.keys(jobs).filter((id) => id !== gateId).sort(), checkJobIds);
  assert.equal(workflow.defaults, undefined, 'a workflow-level default shell could drop bash -e');

  for (const id of [...checkJobIds, gateId]) {
    const job = jobNamed(id);
    // The gate runs on always() by design (tested below); a condition on any other job could leave it skipped.
    if (id !== gateId) {
      assert.equal(job.if, undefined, `${id}: a job condition could leave the job skipped`);
    }
    assert.equal(job['continue-on-error'], undefined, `${id}: continue-on-error would hide a failure`);
    assert.equal(job.defaults, undefined, `${id}: a job-level default shell could drop bash -e`);
    assert.equal(typeof job['timeout-minutes'], 'number', `${id}: without a timeout a hung job holds a runner for 6 hours`);
    for (const step of job.steps ?? []) {
      const label = `${id}: step "${step.name ?? step.uses ?? step.run}"`;
      assert.equal(step.if, undefined, `${label} has a condition`);
      assert.equal(step['continue-on-error'], undefined, `${label} has continue-on-error`);
      assert.equal(step.shell, undefined, `${label} overrides the shell, which is bash -e by default`);
      // The only `||` allowed records a failing command's status (`|| status=$?`, in the bc step, which then reports it).
      const isBcStep = id === 'scripts-tests' && step.name === 'Install bc';
      const run = isBcStep ? (step.run ?? '').replaceAll('|| status=$?', '') : (step.run ?? '');
      assert.ok(!/\|\||;\s*(true|:)(\s|;|$)|set \+[eo]/.test(run), `${label} could swallow a failing command`);
    }
  }
});

// Node comes from setup-node, pinned by .nvmrc, and is set up before anything runs npm.
function assertNodeIsSetUpFirst(id: string, installIndex: number) {
  const index = stepsOf(id).findIndex((step) => step.uses?.startsWith('actions/setup-node@'));
  assert.ok(index !== -1, `${id}: Node comes from setup-node`);
  assert.ok(index < installIndex, `${id}: setup-node runs before the install`);
  assert.equal(stepsOf(id)[index]?.with?.['node-version-file'], '.nvmrc', `${id}: the Node version is the one in .nvmrc`);
}

test('the lockfile job installs and then checks that the lockfile versions match', () => {
  const install = stepRunning('lockfile-versions', /^npm ci\b/);
  const check = stepRunning('lockfile-versions', /^npm run lockfiles:sync -- --check$/);

  assert.ok(install.index < check.index, 'the check runs after the install');
  assertNodeIsSetUpFirst('lockfile-versions', install.index);
});

test('the scripts job installs what the suite needs, runs the whole suite last, and cannot hold a runner for hours', () => {
  const steps = stepsOf('scripts-tests');
  const install = stepRunning('scripts-tests', /^npm ci\b/);
  const bc = stepRunning('scripts-tests', /apt-get install[^\n]* bc\b/);
  const suite = stepRunning('scripts-tests', /^npm run test:scripts$/);

  assert.ok(install.index < suite.index && bc.index < suite.index, 'everything the suite needs is installed before it runs');
  assert.equal(stepsOf('scripts-tests')[0]?.uses?.split('@')[0], 'actions/checkout', 'the repository is checked out first');
  assert.equal(install.step.run?.trim(), 'npm ci --ignore-scripts', 'the install runs no install script');
  assert.equal(suite.index, steps.length - 1, 'the suite is the last step, so nothing after it can mask its result');
  assertNodeIsSetUpFirst('scripts-tests', install.index);
  const minutes = jobNamed('scripts-tests')['timeout-minutes'];
  assert.equal(typeof minutes, 'number');
  assert.ok((minutes as number) <= 15, `the timeout is a few minutes, not the 6-hour default (${minutes})`);
});

test('the gate is the required check: one job with that name, behind every check job, run even after a failure', () => {
  const gate = jobNamed(gateId);

  assert.equal(reportedName(gateId, gate), requiredCheckName);
  assert.deepEqual([...(gate.needs as string[])].sort(), checkJobIds);
  assert.equal(gate.if, 'always()', 'a failed or cancelled job must still reach the gate, which fails it');
  assert.deepEqual(
    Object.entries(jobs).filter(([id, job]) => reportedName(id, job) === requiredCheckName).map(([id]) => id),
    [gateId],
    'exactly one job reports the required check name',
  );
});

test('no other workflow reports a check with the required name', () => {
  const files = readdirSync(workflowsDirectory).filter((name) => /\.ya?ml$/.test(name) && name !== 'lockfile-sync.yml');
  assert.ok(files.length > 0, 'found the other workflows');

  for (const file of files) {
    const other = load(readFileSync(path.join(workflowsDirectory, file), 'utf8')) as Workflow;
    for (const [id, job] of Object.entries(other.jobs ?? {})) {
      assert.notEqual(reportedName(id, job), requiredCheckName, `${file}: job ${id}`);
    }
  }
});

test('the gate script passes only when every job it needs succeeded', () => {
  const gate = jobNamed(gateId);
  const [step] = gate.steps ?? [];
  assert.equal(gate.steps?.length, 1, 'the gate is one script step');
  assert.ok(step?.run && step.env, 'the gate has one script step with the results in its environment');

  // Each environment variable carries one needed job's result: ${{ needs.<job>.result }}.
  const variables = Object.entries(step.env).map(([name, expression]) => {
    const job = /^\$\{\{ needs\.([\w-]+)\.result \}\}$/.exec(expression)?.[1];
    assert.ok(job, `${name} is exactly a needed job's result, with no fallback (${expression})`);
    return { name, job };
  });
  assert.deepEqual(variables.map(({ job }) => job).sort(), checkJobIds, 'the gate reads the result of every check job');

  const outcomes = ['success', 'failure', 'cancelled', 'skipped', ''];
  let combinations = 0;
  const run = (results: string[]) => {
    const env: Record<string, string> = { PATH: '/usr/bin:/bin' };
    variables.forEach(({ name }, index) => {
      env[name] = results[index] as string;
    });
    return runScript(step.run as string, env);
  };

  const walk = (prefix: string[]) => {
    if (prefix.length === variables.length) {
      combinations += 1;
      const result = run(prefix);
      const allPassed = prefix.every((outcome) => outcome === 'success');
      assert.equal(result.status === 0, allPassed, `results ${JSON.stringify(prefix)}: exit ${result.status}`);
      return;
    }
    for (const outcome of outcomes) {
      walk([...prefix, outcome]);
    }
  };
  walk([]);

  assert.equal(combinations, outcomes.length ** variables.length);
});

// Runs the "Install bc" step with fake timeout, sudo, apt-get and sleep and a PATH that holds nothing else, so the real
// package manager is never touched. apt-get fails its first `updateFailures` update calls and, when `installFails`, every
// install call.
function runInstallBc(options: { updateFailures: number; installFails?: boolean; bcPresent?: boolean }) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'install-bc-'));
  try {
    const bin = path.join(directory, 'bin');
    const log = path.join(directory, 'log');
    mkdirSync(bin);
    writeFileSync(log, '');
    const fake = (name: string, body: string) => {
      writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
      chmodSync(path.join(bin, name), 0o755);
    };
    fake('timeout', 'echo "timeout $1" >> "$LOG"\nshift\nexec "$@"');
    fake('sudo', 'echo "sudo $1" >> "$LOG"\nexec "$@"');
    fake('sleep', 'echo "sleep $1" >> "$LOG"');
    fake(
      'apt-get',
      [
        'echo "apt-get $*" >> "$LOG"',
        'if [ "$1" = update ]; then',
        '  n=0',
        '  [ -f "$COUNT" ] && read -r n < "$COUNT"',
        '  n=$((n + 1))',
        '  echo "$n" > "$COUNT"',
        '  [ "$n" -gt "$UPDATE_FAILURES" ]',
        'else',
        '  [ -z "$INSTALL_FAILS" ]',
        'fi',
      ].join('\n'),
    );
    if (options.bcPresent) {
      fake('bc', 'exit 0');
    }

    const script = stepRunning('scripts-tests', /apt-get install[^\n]* bc\b/).step.run ?? '';
    const result = runScript(script, {
      PATH: bin,
      LOG: log,
      COUNT: path.join(directory, 'count'),
      UPDATE_FAILURES: String(options.updateFailures),
      INSTALL_FAILS: options.installFails ? '1' : '',
    });
    const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    const count = (prefix: string) => lines.filter((line) => line.startsWith(prefix)).length;
    const arguments_ = (prefix: string) => lines.filter((line) => line.startsWith(`${prefix} `)).map((line) => line.slice(prefix.length + 1));
    return {
      status: result.status,
      updates: count('apt-get update'),
      installs: count('apt-get install'),
      sleeps: count('sleep'),
      timeouts: count('timeout'),
      sleepSeconds: arguments_('sleep').map(Number),
      timeoutSeconds: arguments_('timeout').map(Number),
      sudos: count('sudo'),
      commands: arguments_('apt-get'),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('the bc step does nothing when bc is already installed', () => {
  const run = runInstallBc({ updateFailures: 0, bcPresent: true });

  assert.equal(run.status, 0);
  assert.deepEqual([run.updates, run.installs, run.sleeps, run.timeouts, run.sudos], [0, 0, 0, 0, 0]);
});

test('the bc step installs bc, and retries the apt mirror with a wait between tries', () => {
  const first = runInstallBc({ updateFailures: 0 });
  assert.equal(first.status, 0);
  assert.deepEqual(first.commands, ['update -qq', 'install -y -qq bc'], 'a non-interactive install of bc, after an update');
  assert.equal(first.sudos, 2, 'both apt calls run as root');
  assert.deepEqual([first.sleeps, first.timeouts], [0, 2]);

  const retried = runInstallBc({ updateFailures: 2 });
  assert.equal(retried.status, 0);
  assert.deepEqual([retried.updates, retried.installs, retried.timeouts], [3, 1, 4]);
  assert.deepEqual(retried.sleepSeconds, [20, 40], 'each try waits longer than the one before');
});

test('every apt call in the bc step runs under a timeout, so a hung mirror cannot hold the job', () => {
  const run = runInstallBc({ updateFailures: 1 });

  assert.equal(run.timeouts, run.updates + run.installs);
});

test('the bc step cannot outlast the scripts job: three tries, each apt call bounded, fit inside the job timeout', () => {
  const run = runInstallBc({ updateFailures: 0, installFails: true });
  const minutes = jobNamed('scripts-tests')['timeout-minutes'] as number;

  assert.equal(run.updates, 3, 'three tries, no more');
  assert.ok(run.timeoutSeconds.length > 0 && run.timeoutSeconds.every((seconds) => Number.isInteger(seconds) && seconds > 0), 'every bound is a positive number of seconds (0 would disable it)');
  const worstCase = run.timeoutSeconds.reduce((sum, seconds) => sum + seconds, 0) + run.sleepSeconds.reduce((sum, seconds) => sum + seconds, 0);
  assert.ok(worstCase <= (minutes * 60) / 2, `the retries (${worstCase} s) leave half of the ${minutes} minute job timeout for everything else`);
});

test('the bc step fails the job when the package never installs, and does not wait after the last try', () => {
  for (const options of [{ updateFailures: 99 }, { updateFailures: 0, installFails: true }]) {
    const run = runInstallBc(options);

    assert.equal(run.status, 1, JSON.stringify(options));
    assert.ok(run.updates > 1, 'it retried');
    assert.equal(run.sleeps, run.updates - 1, 'no wait after the last try');
  }
});

test('npm run test:scripts runs every scripts/*.test.ts file, among them the workflow contract tests', () => {
  const manifest = JSON.parse(readFileSync(path.join(rootDirectory, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const command = manifest.scripts['test:scripts'] ?? '';
  // The test files the glob in the command expands to (a single `dir/*suffix` pattern, which is what the command uses).
  const [, directory, suffix] = /(?:^| )--test (\S+)\/\*(\S+)(?: |$)/.exec(command) ?? [];

  assert.ok(directory && suffix, `the command passes one dir/*suffix glob to --test (${command})`);
  const matched = readdirSync(path.join(rootDirectory, directory)).filter((name) => name.endsWith(suffix));
  for (const contract of ['npm-ci-action', 'codeql-workflow', 'deploy-workflow', 'lockfile-sync-workflow']) {
    assert.ok(matched.includes(`${contract}${suffix}`), `${contract}${suffix} is run by ${directory}/*${suffix}`);
  }
  assert.match(manifest.scripts.ci ?? '', /(^|&& )npm run test:scripts( &&|$)/);
  assert.match(manifest.scripts.test ?? '', /(^|&& )npm run test:scripts( &&|$)/);
});
