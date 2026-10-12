import assert from 'node:assert/strict';
import test from 'node:test';

import { validateMcpReleaseVersions } from './mcp-release-contract.ts';

const packageJson = { name: 'murphys-laws-mcp', version: '1.2.5' };

test('accepts matching package and registry manifest versions', () => {
  assert.deepEqual(
    validateMcpReleaseVersions(packageJson, {
      version: '1.2.5',
      packages: [{ identifier: 'murphys-laws-mcp', version: '1.2.5' }],
    }),
    [],
  );
});

test('reports each version that differs from the package version', () => {
  assert.deepEqual(
    validateMcpReleaseVersions(packageJson, {
      version: '1.2.4',
      packages: [{ identifier: 'murphys-laws-mcp', version: '1.2.3' }],
    }),
    [
      'mcp/server.json version must match mcp/package.json version 1.2.5',
      'mcp/server.json packages[0].version must match mcp/package.json version 1.2.5',
    ],
  );
});

test('reports a registry package identifier that differs from the package name', () => {
  assert.deepEqual(
    validateMcpReleaseVersions(packageJson, {
      version: '1.2.5',
      packages: [{ identifier: 'other-package', version: '1.2.5' }],
    }),
    ['mcp/server.json packages[0].identifier must match mcp/package.json name'],
  );
});
