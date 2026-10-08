import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { coverageTargetsFor, hasAndroidSdk } from './run-coverage-guards.js';

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
