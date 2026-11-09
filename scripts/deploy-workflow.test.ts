import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDirectory = path.join(rootDirectory, '.github/workflows');

type Step = {
  name?: string;
  run?: string;
  env?: Record<string, unknown>;
  if?: unknown;
  'continue-on-error'?: unknown;
};
type Workflow = {
  on?: { workflow_dispatch?: { inputs?: Record<string, { type?: string; default?: unknown }> } };
  jobs?: Record<string, { steps?: Step[]; 'continue-on-error'?: unknown }>;
};

function readWorkflow(name: string): Workflow {
  return load(readFileSync(path.join(workflowsDirectory, name), 'utf8')) as Workflow;
}

const deploySteps = readWorkflow('deploy.yml').jobs?.deploy?.steps ?? [];
const buildIndex = deploySteps.findIndex((step) => step.name === 'Build project');
const buildStep = deploySteps[buildIndex];
const buildLines = (buildStep?.run ?? '').split('\n').map((line) => line.trim());

test('the production deploy prerenders the site from the production API', () => {
  assert.ok(buildStep, 'deploy.yml has a "Build project" step');
  assert.equal(buildStep.env?.API_BASE_URL, 'https://murphys-laws.com');
  assert.ok(buildLines.includes('npm run build:openapi'), 'the OpenAPI document is still built');
  assert.ok(buildLines.includes('npm --prefix web run build'), 'the web build runs against API_BASE_URL');
  const { env: jobEnv } = (readWorkflow('deploy.yml').jobs?.deploy ?? {}) as { env?: Record<string, unknown> };
  assert.equal(jobEnv?.API_BASE_URL, undefined, 'the step is where the production URL is set');
});

// Runs the Build step's script with a stand-in for npm and reports which npm commands it ran
function runBuildStep(seededBuild: string, npmExitCode = 0): { status: number | null; commands: string[] } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-build-'));
  const log = path.join(directory, 'npm.log');
  const npm = path.join(directory, 'npm');
  writeFileSync(npm, `#!/bin/sh\necho "$*" >> "${log}"\nexit ${npmExitCode}\n`);
  chmodSync(npm, 0o755);
  const result = spawnSync('bash', ['-e', '-c', buildStep?.run ?? ''], {
    env: { PATH: `${directory}:${process.env.PATH}`, SEEDED_BUILD: seededBuild },
    encoding: 'utf8',
  });
  let commands: string[] = [];
  try {
    commands = readFileSync(log, 'utf8').trim().split('\n');
  } catch {
    // npm never ran
  }
  return { status: result.status, commands };
}

test('a push, or a manual run without the option, builds from production', () => {
  const input = readWorkflow('deploy.yml').on?.workflow_dispatch?.inputs?.seeded_build;
  assert.equal(input?.type, 'boolean');
  assert.equal(input?.default, false, 'a plain manual run must never use the archive');
  assert.match(String(buildStep?.env?.SEEDED_BUILD), /^\$\{\{ *inputs\.seeded_build *\}\}$/);

  // A push leaves the input empty; a manual run passes the strings "false" and "true"
  for (const value of ['', 'false']) {
    assert.deepEqual(runBuildStep(value), {
      status: 0,
      commands: ['run build:openapi', '--prefix web run build'],
    }, `SEEDED_BUILD="${value}"`);
  }
});

test('only the emergency option builds from the archive', () => {
  assert.deepEqual(runBuildStep('true'), {
    status: 0,
    commands: ['run build:openapi', 'run build:web'],
  });
});

test('a failing build command fails the step', () => {
  for (const value of ['', 'true']) {
    const { status, commands } = runBuildStep(value, 1);
    assert.notEqual(status, 0, `SEEDED_BUILD="${value}"`);
    assert.equal(commands.length, 1, 'nothing runs after the first failure');
  }
});

test('a failed build stops the deploy before anything is uploaded', () => {
  const uploadIndex = deploySteps.findIndex((step) => step.name === 'Upload build artifacts');
  assert.ok(uploadIndex > buildIndex, 'the build comes before the upload');
  assert.doesNotMatch(String(deploySteps[uploadIndex]?.if ?? ''), /always|failure|cancelled/, 'the upload must not run after a failed build');
  for (const step of deploySteps.slice(buildIndex, uploadIndex + 1)) {
    assert.equal(step['continue-on-error'], undefined, `${step.name} must not continue on error`);
  }
  assert.equal(readWorkflow('deploy.yml').jobs?.deploy?.['continue-on-error'], undefined);
});

test('pull-request CI keeps its seeded local API build and never reads production', () => {
  const steps = Object.values(readWorkflow('web-ci.yml').jobs ?? {}).flatMap((job) => job.steps ?? []);
  assert.ok(steps.some((step) => step.run?.trim() === 'npm run build:web'));
  for (const step of steps) {
    const text = JSON.stringify(step);
    assert.ok(!/murphys-laws\.com/.test(text), `${step.name} must not read production`);
    for (const [, url] of text.matchAll(/API_BASE_URL[=:]\s*\\?"?([^\s"\\]+)/g)) {
      assert.match(url ?? '', /^http:\/\/(127\.0\.0\.1|localhost)[:/]/, `${step.name} sets API_BASE_URL to ${url}`);
    }
  }
});
