import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  'continue-on-error'?: unknown;
};
type Workflow = {
  on?: { workflow_dispatch?: { inputs?: Record<string, { type?: string; default?: unknown }> } };
  jobs?: Record<string, { steps?: Step[] }>;
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
});

test('only the emergency path builds from the archive', () => {
  const seededLines = buildLines.filter((line) => line.includes('build:web'));
  assert.deepEqual(seededLines, ['npm run build:web']);

  const input = readWorkflow('deploy.yml').on?.workflow_dispatch?.inputs?.seeded_build;
  assert.equal(input?.type, 'boolean');
  assert.equal(input?.default, false, 'a push or a plain manual run must never use the archive');
  assert.match(String(buildStep?.env?.SEEDED_BUILD), /inputs\.seeded_build/);

  const seededAt = buildLines.indexOf('npm run build:web');
  const productionAt = buildLines.indexOf('npm --prefix web run build');
  const conditionAt = buildLines.findIndex((line) => line.startsWith('if [ "$SEEDED_BUILD" = "true" ]'));
  assert.ok(conditionAt >= 0 && conditionAt < seededAt && seededAt < productionAt,
    'the seeded build sits inside the SEEDED_BUILD branch and production is the else branch');
  assert.equal(buildLines[productionAt - 1], 'else');
});

test('a failed build stops the deploy before anything is uploaded', () => {
  assert.equal(buildStep?.['continue-on-error'], undefined);
  assert.ok(buildLines.includes('npm --prefix web run build'));
  assert.ok(!buildStep?.run?.includes('||'), 'a failing build command must not be swallowed');
  const uploadIndex = deploySteps.findIndex((step) => step.name === 'Upload build artifacts');
  assert.ok(uploadIndex > buildIndex, 'the build comes before the upload');
  for (const step of deploySteps.slice(buildIndex, uploadIndex)) {
    assert.equal(step['continue-on-error'], undefined, `${step.name} must not continue on error`);
  }
});

test('pull-request CI keeps its seeded local API build and never reads production', () => {
  const steps = Object.values(readWorkflow('web-ci.yml').jobs ?? {}).flatMap((job) => job.steps ?? []);
  assert.ok(steps.some((step) => step.run?.trim() === 'npm run build:web'));
  for (const step of steps) {
    assert.ok(!JSON.stringify(step).includes('https://murphys-laws.com'), `${step.name} must not read production`);
  }
});
