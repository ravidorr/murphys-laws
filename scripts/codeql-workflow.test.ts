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
  assert.match(workflow, /\.\/gradlew assembleDebug/);
  assert.match(workflow, /xcodebuild build/);
});
