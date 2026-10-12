import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const workflowPath = path.join(rootDirectory, '.github/workflows/codeql.yml');
const workflowsUsingPathsFilter = [
  'android-ci.yml',
  'backend-ci.yml',
  'cli-ci.yml',
  'ios-ci.yml',
  'mcp-ci.yml',
  'sdk-ci.yml',
  'web-ci.yml',
];
const readOnlyWorkflows = [
  'dependency-audit.yml',
  'deploy.yml',
];
const oidcPublishingWorkflows = [
  'mcp-registry-publish.yml',
];

test('CodeQL workflow contract', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /cron: '17 4 \* \* 1'/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /security-events: write/);
  assert.match(workflow, /actions/);
  assert.match(workflow, /javascript-typescript/);
  assert.match(workflow, /python/);
  assert.match(workflow, /ruby/);
  assert.match(workflow, /languages: java-kotlin/);
  assert.match(workflow, /languages: swift/);
  assert.match(workflow, /build-mode: manual/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /design:export:android/);
  assert.match(workflow, /\.\/gradlew clean assembleDebug/);
  assert.match(workflow, /xcodebuild build/);
});

test('workflows use only the GITHUB_TOKEN permissions they need', () => {
  for (const workflowName of workflowsUsingPathsFilter) {
    const workflow = readFileSync(path.join(rootDirectory, '.github/workflows', workflowName), 'utf8');
    assert.match(workflow, /^permissions:\n  contents: read\n  pull-requests: read\n\n/m);
  }

  for (const workflowName of readOnlyWorkflows) {
    const workflow = readFileSync(path.join(rootDirectory, '.github/workflows', workflowName), 'utf8');
    assert.match(workflow, /^permissions:\n  contents: read\n\njobs:/m);
  }

  for (const workflowName of oidcPublishingWorkflows) {
    const workflow = readFileSync(path.join(rootDirectory, '.github/workflows', workflowName), 'utf8');
    assert.match(
      workflow,
      /^permissions:\n  contents: read\n  id-token: write\n\njobs:/m,
    );
  }
});
