import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findLockfileVersionMismatches,
  findMissingVersionBumps,
  isMcpManifestSynchronizationRepair,
  parseStagedFiles,
} from './check-version-bumps';

const versions = {
  rootBefore: '{ "version": "1.0.0" }',
  rootAfter: '{ "version": "1.0.1" }',
  cliBefore: '{ "version": "0.1.0" }',
  cliAfter: '{ "version": "0.1.1" }',
  mcpBefore: '{ "version": "1.2.1" }',
  mcpAfter: '{ "version": "1.2.2" }',
  sdkBefore: '{ "version": "0.1.0" }',
  sdkAfter: '{ "version": "0.1.1" }',
  mcpManifestBefore: JSON.stringify({
    version: '1.2.2',
    packages: [{ version: '1.2.2' }],
  }),
  mcpManifestAfter: JSON.stringify({
    version: '1.2.5',
    packages: [{ version: '1.2.5' }],
  }),
  iosProjectBefore: 'MARKETING_VERSION: "1.1.3"\nCURRENT_PROJECT_VERSION: "7"\n',
  iosProjectAfter: 'MARKETING_VERSION: "1.1.4"\nCURRENT_PROJECT_VERSION: "8"\n',
  iosPlistBefore: '<key>CFBundleShortVersionString</key><string>1.1.3</string><key>CFBundleVersion</key><string>7</string>',
  iosPlistAfter: '<key>CFBundleShortVersionString</key><string>1.1.4</string><key>CFBundleVersion</key><string>8</string>',
};

function missingFor(
  stagedOutput: string,
  afterOverrides: Record<string, string | null> = {},
  beforeOverrides: Record<string, string | null> = {},
): string[] {
  const beforeByPath: Record<string, string | null> = {
    'package.json': versions.rootBefore,
    'cli/package.json': versions.cliBefore,
    'mcp/package.json': versions.mcpBefore,
    'sdk/package.json': versions.sdkBefore,
    'ios/project.yml': versions.iosProjectBefore,
    'ios/MurphysLaws/Info.plist': versions.iosPlistBefore,
    ...beforeOverrides,
  };
  const afterByPath: Record<string, string | null> = {
    'package.json': versions.rootBefore,
    'cli/package.json': versions.cliBefore,
    'mcp/package.json': versions.mcpBefore,
    'sdk/package.json': versions.sdkBefore,
    'ios/project.yml': versions.iosProjectBefore,
    'ios/MurphysLaws/Info.plist': versions.iosPlistBefore,
    ...afterOverrides,
  };

  return findMissingVersionBumps(
    parseStagedFiles(stagedOutput),
    (filePath) => beforeByPath[filePath] ?? null,
    (filePath) => afterByPath[filePath] ?? null,
  );
}

describe('check-version-bumps', () => {
  it('does not require a root version bump for documentation-only changes', () => {
    const missing = missingFor(
      [
        'A\tAGENTS.md',
        'M\tREADME.md',
        'A\tllms.txt',
      ].join('\n'),
    );

    assert.deepEqual(missing, []);
  });

  it('requires CLI, MCP, and SDK package bumps when their package files change', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tcli/src/index.ts',
        'M\tmcp/src/server.ts',
        'M\tsdk/src/index.ts',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
      },
    );

    assert.deepEqual(missing, [
      'cli package: cli/package.json version',
      'mcp package: mcp/package.json version',
      'sdk package: sdk/package.json version',
    ]);
  });

  it('passes package checks once the touched package versions are bumped', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tcli/src/index.ts',
        'M\tcli/package.json',
        'M\tmcp/src/server.ts',
        'M\tmcp/package.json',
        'M\tsdk/src/index.ts',
        'M\tsdk/package.json',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
        'cli/package.json': versions.cliAfter,
        'mcp/package.json': versions.mcpAfter,
        'sdk/package.json': versions.sdkAfter,
      },
    );

    assert.deepEqual(missing, []);
  });

  it('requires both iOS version files when iOS app source changes', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tios/MurphysLaws/Views/More/MoreView.swift',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
      },
    );

    assert.deepEqual(missing, [
      'iOS app: ios/project.yml marketing and build versions',
      'iOS app: ios/MurphysLaws/Info.plist marketing and build versions',
    ]);
  });

  it('passes iOS checks when project.yml and Info.plist both bump marketing and build versions', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tios/MurphysLaws/Views/More/MoreView.swift',
        'M\tios/project.yml',
        'M\tios/MurphysLaws/Info.plist',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
        'ios/project.yml': versions.iosProjectAfter,
        'ios/MurphysLaws/Info.plist': versions.iosPlistAfter,
      },
    );

    assert.deepEqual(missing, []);
  });

  it('allows a manifest-only repair to the existing MCP package version', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tmcp/README.md',
        'M\tmcp/server.json',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
        'mcp/package.json': '{ "version": "1.2.5" }',
        'mcp/server.json': versions.mcpManifestAfter,
      },
      {
        'mcp/package.json': '{ "version": "1.2.5" }',
        'mcp/server.json': versions.mcpManifestBefore,
      },
    );

    assert.deepEqual(missing, []);
  });

  it('requires an MCP version bump when source and manifest change together', () => {
    const missing = missingFor(
      [
        'M\tpackage.json',
        'M\tmcp/server.json',
        'M\tmcp/src/server.ts',
      ].join('\n'),
      {
        'package.json': versions.rootAfter,
        'mcp/package.json': '{ "version": "1.2.5" }',
        'mcp/server.json': versions.mcpManifestAfter,
      },
      {
        'mcp/package.json': '{ "version": "1.2.5" }',
        'mcp/server.json': versions.mcpManifestBefore,
      },
    );

    assert.deepEqual(missing, ['mcp package: mcp/package.json version']);
  });

  it('does not treat invalid MCP manifest JSON as a synchronization repair', () => {
    assert.equal(
      isMcpManifestSynchronizationRepair(
        ['mcp/server.json'],
        (filePath) => {
          if (filePath === 'mcp/package.json') {
            return '{ "version": "1.2.5" }';
          }

          return '{ invalid json';
        },
        (filePath) => {
          if (filePath === 'mcp/package.json') {
            return '{ "version": "1.2.5" }';
          }

          return versions.mcpManifestAfter;
        },
      ),
      false,
    );
  });
});

describe('findLockfileVersionMismatches', () => {
  const packageJson = (version: string) => JSON.stringify({ version });
  const ownLockfile = (version: string, packagesVersion = version) =>
    JSON.stringify({ version, packages: { '': { version: packagesVersion } } });
  const rootLockfile = (workspaces: Record<string, string>, version = '2.0.0') =>
    JSON.stringify({
      version,
      packages: {
        '': { version },
        ...Object.fromEntries(Object.entries(workspaces).map(([name, v]) => [name, { version: v }])),
      },
    });

  /** A tree where every package.json matches every lockfile entry. */
  const inSync = (): Record<string, string | null> => ({
    'package.json': packageJson('2.0.0'),
    'package-lock.json': rootLockfile({ backend: '3.0.0', web: '4.0.0', mcp: '1.0.0', sdk: '0.2.0', cli: '0.1.0' }),
    'backend/package.json': packageJson('3.0.0'),
    'backend/package-lock.json': ownLockfile('3.0.0'),
    'web/package.json': packageJson('4.0.0'),
    'mcp/package.json': packageJson('1.0.0'),
    'sdk/package.json': packageJson('0.2.0'),
    'cli/package.json': packageJson('0.1.0'),
  });

  const mismatchesFor = (overrides: Record<string, string | null> = {}) => {
    const files = { ...inSync(), ...overrides };
    return findLockfileVersionMismatches((filePath) => files[filePath] ?? null);
  };

  it('passes when every package.json matches its lockfiles', () => {
    assert.deepEqual(mismatchesFor(), []);
  });

  it('flags a workspace version the root lockfile still records at the old number', () => {
    const lock = rootLockfile({ backend: '2.9.9', web: '4.0.0', mcp: '1.0.0', sdk: '0.2.0', cli: '0.1.0' });

    assert.deepEqual(mismatchesFor({ 'package-lock.json': lock }), [
      'backend/package.json is 3.0.0 but package-lock.json packages["backend"].version is 2.9.9',
    ]);
  });

  it('flags every workspace the root lockfile records wrongly', () => {
    const lock = rootLockfile({ backend: '3.0.0', web: '4.0.1', mcp: '1.0.1', sdk: '0.2.1', cli: '0.1.1' });

    assert.equal(mismatchesFor({ 'package-lock.json': lock }).length, 4);
  });

  it("flags the root lockfile's own top-level version", () => {
    const lock = rootLockfile({ backend: '3.0.0', web: '4.0.0', mcp: '1.0.0', sdk: '0.2.0', cli: '0.1.0' }, '1.9.9');

    assert.deepEqual(mismatchesFor({ 'package-lock.json': lock }), [
      'package.json is 2.0.0 but package-lock.json version is 1.9.9',
      'package.json is 2.0.0 but package-lock.json packages[""].version is 1.9.9',
    ]);
  });

  it("flags the root lockfile's own packages entry when only that one is stale", () => {
    const lock = JSON.stringify({
      version: '2.0.0',
      packages: { '': { version: '1.9.9' }, backend: { version: '3.0.0' } },
    });

    assert.deepEqual(mismatchesFor({ 'package-lock.json': lock }), [
      'package.json is 2.0.0 but package-lock.json packages[""].version is 1.9.9',
    ]);
  });

  it("flags backend's own lockfile", () => {
    assert.deepEqual(mismatchesFor({ 'backend/package-lock.json': ownLockfile('2.9.9', '2.9.8') }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json version is 2.9.9',
      'backend/package.json is 3.0.0 but backend/package-lock.json packages[""].version is 2.9.8',
    ]);
  });

  it('flags a package.json bumped without regenerating the lockfile', () => {
    assert.deepEqual(mismatchesFor({ 'backend/package.json': packageJson('3.0.1') }), [
      'backend/package.json is 3.0.1 but backend/package-lock.json version is 3.0.0',
      'backend/package.json is 3.0.1 but backend/package-lock.json packages[""].version is 3.0.0',
      'backend/package.json is 3.0.1 but package-lock.json packages["backend"].version is 3.0.0',
    ]);
  });

  it('skips a package or lockfile that is missing', () => {
    assert.deepEqual(mismatchesFor({ 'backend/package-lock.json': null, 'web/package.json': null }), []);
    assert.deepEqual(mismatchesFor({ 'package-lock.json': null }), []);
  });

  it('skips a lockfile that is not valid JSON or not an object', () => {
    assert.deepEqual(mismatchesFor({ 'package-lock.json': '{ invalid json' }), []);
    assert.deepEqual(mismatchesFor({ 'package-lock.json': 'null' }), []);
  });

  it('skips a package.json with no version and a lockfile entry that does not exist', () => {
    assert.deepEqual(mismatchesFor({ 'web/package.json': '{ "name": "web" }' }), []);
    assert.deepEqual(mismatchesFor({ 'package-lock.json': JSON.stringify({ version: '2.0.0' }) }), []);
  });
});
