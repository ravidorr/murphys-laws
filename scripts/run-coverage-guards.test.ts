import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  coverageTargetsFor,
  decodeJavaPropertyValue,
  hasAndroidSdk,
} from './run-coverage-guards.js';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const workflows = [
  ['.github/workflows/android-ci.yml', 'android-ci-gate'],
  ['.github/workflows/backend-ci.yml', 'backend-ci-gate'],
  ['.github/workflows/cli-ci.yml', 'cli-ci-gate'],
  ['.github/workflows/ios-ci.yml', 'ios-ci-gate'],
  ['.github/workflows/mcp-ci.yml', 'mcp-ci-gate'],
  ['.github/workflows/sdk-ci.yml', 'sdk-ci-gate'],
  ['.github/workflows/web-ci.yml', 'web-ci-gate'],
];

test('CI gates have unique names and fail closed', () => {
  for (const [workflowFile, gateName] of workflows) {
    const workflow = readFileSync(path.join(rootDirectory, workflowFile), 'utf8');

    assert.match(
      workflow,
      new RegExp(`ci-gate:\\n\\s+name: ${gateName}`),
      `${workflowFile} must give its gate a unique check-run name.`,
    );
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

test('maps shared data to every consumer coverage target', () => {
  assert.deepEqual(
    coverageTargetsFor(['shared/data/murphys-laws/laws.json']),
    ['backend', 'web', 'ios', 'android'],
  );
});

test('maps an SDK change to SDK, CLI, and MCP', () => {
  assert.deepEqual(
    coverageTargetsFor(['sdk/src/client.ts']),
    ['sdk', 'cli', 'mcp'],
  );
});

test('maps a mobile workflow change to its mobile coverage target', () => {
  assert.deepEqual(
    coverageTargetsFor(['.github/workflows/android-ci.yml']),
    ['android'],
  );
});

test('does not run coverage for documentation-only changes', () => {
  assert.deepEqual(coverageTargetsFor(['README.md']), []);
});

test('requires a usable Android SDK path', () => {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'coverage-guards-'));
  const androidDirectory = path.join(temporaryDirectory, 'android');
  const sdkDirectory = path.join(temporaryDirectory, 'sdk');

  try {
    mkdirSync(androidDirectory);
    assert.equal(
      hasAndroidSdk(androidDirectory, {
        ANDROID_HOME: path.join(temporaryDirectory, 'missing-sdk'),
      }),
      false,
    );

    mkdirSync(sdkDirectory);
    writeFileSync(
      path.join(androidDirectory, 'local.properties'),
      `sdk.dir=${sdkDirectory}\n`,
    );
    assert.equal(hasAndroidSdk(androidDirectory, {}), true);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('decodes Java properties path escapes', () => {
  assert.equal(
    decodeJavaPropertyValue('C\\:\\\\Users\\\\name\\\\AppData\\\\Local\\\\Android\\\\Sdk'),
    'C:\\Users\\name\\AppData\\Local\\Android\\Sdk',
  );
});
