import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
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
