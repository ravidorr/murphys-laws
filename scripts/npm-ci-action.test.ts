import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const workflowsDirectory = path.join(rootDirectory, '.github/workflows');
const actionsDirectory = path.join(rootDirectory, '.github/actions');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};
type Document = {
  inputs?: Record<string, unknown>;
  jobs?: Record<string, { steps?: Step[] }>;
  runs?: { using?: string; steps?: Step[] };
};

function readYaml(file: string): Document {
  return load(readFileSync(file, 'utf8')) as Document;
}

function workflowFiles(): string[] {
  return readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => path.join(workflowsDirectory, name));
}

function actionFiles(): string[] {
  return readdirSync(actionsDirectory).map((name) => path.join(actionsDirectory, name, 'action.yml'));
}

function stepsOf(document: Document): Step[] {
  return [
    ...Object.values(document.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ...(document.runs?.steps ?? []),
  ];
}

// Everything a step can execute: its run script, or the script an SSH step sends to the server.
function scriptsOf(step: Step): string[] {
  return [step.run, step.with?.script].filter((value): value is string => typeof value === 'string');
}

function actionScript(actionName: string): string {
  const script = stepsOf(readYaml(path.join(actionsDirectory, actionName, 'action.yml')))[0]?.run;
  assert.ok(script, `${actionName} has no run script`);
  return script;
}

type Run = { status: number | null; calls: string[]; sleeps: string[] };

// Runs a script the way GitHub runs `shell: bash`, with a fake command that succeeds on its Nth call and a fake
// sleep that only records how long it was asked to wait.
function runWithFakes(script: string, options: { command: string; succeedOn: number; env?: Record<string, string> }): Run {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'retry-contract-'));
  const bin = path.join(directory, 'bin');
  const calls = path.join(directory, 'calls');
  const sleeps = path.join(directory, 'sleeps');
  mkdirSync(bin);
  writeFileSync(calls, '');
  writeFileSync(sleeps, '');
  const fakeCommand = '#!/bin/sh\necho "$@" >> "$CALLS"\n[ "$(wc -l < "$CALLS")" -ge "$SUCCEED_ON" ]\n';
  const fakeSleep = '#!/bin/sh\necho "$1" >> "$SLEEPS"\n';
  if (options.command === 'npm') {
    writeFileSync(path.join(bin, 'npm'), fakeCommand, { mode: 0o755 });
  } else {
    mkdirSync(path.join(directory, 'android'));
    writeFileSync(path.join(directory, 'android', 'gradlew'), fakeCommand, { mode: 0o644 });
  }
  writeFileSync(path.join(bin, 'sleep'), fakeSleep, { mode: 0o755 });
  chmodSync(path.join(bin, 'sleep'), 0o755);

  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      CALLS: calls,
      SLEEPS: sleeps,
      SUCCEED_ON: String(options.succeedOn),
      ...options.env,
    },
  });
  const lines = (file: string) => readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return { status: result.status, calls: lines(calls), sleeps: lines(sleeps) };
}

const scenarios: Array<[string, string, Record<string, string>?]> = [
  ['the npm ci action', 'npm-ci', { NPM_CI_ARGS: '' }],
  ['the Gradle distribution action', 'gradle-distribution'],
];

for (const [label, actionName, env] of scenarios) {
  const command = actionName === 'npm-ci' ? 'npm' : 'gradlew';

  test(`${label} gives up after three failed tries, waits between them but not after the last, and fails`, () => {
    const run = runWithFakes(actionScript(actionName), { command, succeedOn: 99, env });

    assert.equal(run.calls.length, 3);
    assert.deepEqual(run.sleeps, ['20', '40']);
    assert.notEqual(run.status, 0);
  });

  test(`${label} succeeds when a later try passes, without further tries`, () => {
    const run = runWithFakes(actionScript(actionName), { command, succeedOn: 2, env });

    assert.equal(run.status, 0);
    assert.equal(run.calls.length, 2);
    assert.deepEqual(run.sleeps, ['20']);
  });

  test(`${label} runs once and does not wait when the first try passes`, () => {
    const run = runWithFakes(actionScript(actionName), { command, succeedOn: 1, env });

    assert.equal(run.status, 0);
    assert.equal(run.calls.length, 1);
    assert.deepEqual(run.sleeps, []);
  });
}

test('the npm ci action passes its arguments to npm ci as separate words', () => {
  const withArgs = runWithFakes(actionScript('npm-ci'), { command: 'npm', succeedOn: 1, env: { NPM_CI_ARGS: '--prefix backend' } });
  const withoutArgs = runWithFakes(actionScript('npm-ci'), { command: 'npm', succeedOn: 1, env: { NPM_CI_ARGS: '' } });

  assert.deepEqual(withArgs.calls, ['ci --prefix backend']);
  assert.deepEqual(withoutArgs.calls, ['ci']);
});

test('the Gradle distribution action runs the wrapper from the android folder', () => {
  const run = runWithFakes(actionScript('gradle-distribution'), { command: 'gradlew', succeedOn: 1 });

  assert.deepEqual(run.calls, ['--version --no-daemon']);
});

test('the actions are composite actions that read their input from the environment', () => {
  for (const file of actionFiles()) {
    assert.equal(readYaml(file).runs?.using, 'composite', file);
  }
  assert.match(readFileSync(path.join(actionsDirectory, 'npm-ci/action.yml'), 'utf8'), /NPM_CI_ARGS: \$\{\{ inputs\.args \}\}/);
});

test('every npm ci that can download a native binary is retried', () => {
  // `npm ci --ignore-scripts` (lockfile-sync) runs no install scripts, so it downloads no binary. A script that runs
  // npm ci for real must contain the three-try loop (the action itself does, and so does the deploy's SSH script).
  const files = [...workflowFiles(), ...actionFiles()];
  let checked = 0;

  for (const file of files) {
    for (const step of stepsOf(readYaml(file))) {
      for (const script of scriptsOf(step)) {
        if (!/\bnpm\s+ci\b/.test(script) || /--ignore-scripts/.test(script)) {
          continue;
        }
        checked += 1;
        assert.match(
          script,
          /for attempt in 1 2 3; do/,
          `${path.relative(rootDirectory, file)}: step "${step.name ?? step.uses ?? '?'}" runs npm ci without the retries; use ./.github/actions/npm-ci`,
        );
      }
    }
  }

  assert.ok(checked >= 2, 'expected to find the action script and the deploy script');
});

test('every local action a workflow uses exists, and every input it passes is declared', () => {
  let used = 0;

  for (const file of workflowFiles()) {
    for (const step of stepsOf(readYaml(file))) {
      if (!step.uses?.startsWith('./')) {
        continue;
      }
      used += 1;
      const actionFile = path.join(rootDirectory, step.uses, 'action.yml');
      assert.ok(existsSync(actionFile), `${path.basename(file)}: ${step.uses} does not exist`);
      const declared = Object.keys(readYaml(actionFile).inputs ?? {});
      for (const key of Object.keys(step.with ?? {})) {
        assert.ok(declared.includes(key), `${path.basename(file)}: ${step.uses} has no input "${key}"`);
      }
    }
  }

  assert.ok(used > 0);
});

test('the Android builds fetch the Gradle distribution in a retried step before they build', () => {
  for (const workflowName of ['android-ci.yml', 'codeql.yml']) {
    const steps = stepsOf(readYaml(path.join(workflowsDirectory, workflowName)));
    const download = steps.findIndex((step) => step.uses === './.github/actions/gradle-distribution');
    const build = steps.findIndex((step) => /\.\/gradlew (clean )?assembleDebug/.test(step.run ?? ''));

    assert.ok(download !== -1 && build !== -1 && download < build, `${workflowName}: the Gradle download step must precede the build`);
    assert.ok(
      steps.every((step) => !/\.\/gradlew\s+--version/.test(step.run ?? '')),
      `${workflowName}: fetch the distribution through the action, not a bare gradlew --version`,
    );
  }
});

test('the workflow contract tests run in a workflow that every pull request triggers', () => {
  const workflow = readFileSync(path.join(workflowsDirectory, 'lockfile-sync.yml'), 'utf8');

  assert.match(workflow, /scripts\/npm-ci-action\.test\.ts/);
  assert.match(workflow, /scripts\/codeql-workflow\.test\.ts/);
});
