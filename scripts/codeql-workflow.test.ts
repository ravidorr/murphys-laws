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
  assert.match(workflow, /uses: \.\/\.github\/actions\/npm-ci/);
  assert.match(workflow, /design:export:android/);
  assert.match(workflow, /\.\/gradlew clean assembleDebug/);
  assert.match(workflow, /xcodebuild build/);
});

test('pull requests that only change shared/docs skip the Kotlin and Swift analyses', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const filterStep = /uses: dorny\/paths-filter@(\S+)\n\s+with:\n([\s\S]*?)\n\n/.exec(workflow);

  // A negated rule only excludes files with the 'some-with-excludes' quantifier, which paths-filter v3 lacks. With
  // the default quantifier a '!' rule matches every file outside the excluded folder instead.
  assert.equal(filterStep?.[1], 'v4');
  assert.match(filterStep?.[2] ?? '', /predicate-quantifier: some-with-excludes/);
  // The exclusion sits in the shared rules that both the android and ios filters include.
  assert.match(workflow, /common: &common\n\s+- 'shared\/\*\*'\n\s+- '!shared\/docs\/\*\*'/);
  assert.match(workflow, /android:\n\s+- 'android\/\*\*'\n\s+- \*common/);
  assert.match(workflow, /ios:\n\s+- 'ios\/\*\*'\n\s+- \*common/);
  // Nothing else in the filter step may bring shared/docs back.
  assert.equal((workflow.match(/- 'shared\/\*\*'/g) ?? []).length, 1);
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
