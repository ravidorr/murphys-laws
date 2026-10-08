import assert from 'node:assert/strict';
import test from 'node:test';

import { coverageTargetsFor } from './run-coverage-guards.js';

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
