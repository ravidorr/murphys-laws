import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const workflowFiles = [
  '.github/workflows/android-ci.yml',
  '.github/workflows/backend-ci.yml',
  '.github/workflows/cli-ci.yml',
  '.github/workflows/ios-ci.yml',
  '.github/workflows/mcp-ci.yml',
  '.github/workflows/sdk-ci.yml',
  '.github/workflows/web-ci.yml',
];

test('CI gates fail when changed-path detection fails', () => {
  for (const workflowFile of workflowFiles) {
    const workflow = readFileSync(path.join(rootDirectory, workflowFile), 'utf8');

    assert.match(
      workflow,
      /CHANGES_RESULT: \$\{\{ needs\.changes\.result \}\}/,
      `${workflowFile} must expose the changed-path job result to its gate.`,
    );
    assert.match(
      workflow,
      /if \[ "\$CHANGES_RESULT" = "success" \] && \[ "\$RELEVANT" = "false" \]; then/,
      `${workflowFile} must skip only after successful changed-path detection.`,
    );
  }
});
