import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findIosVersionDrift,
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

const iosFiles = {
  yml: 'ios/project.yml',
  plist: 'ios/MurphysLaws/Info.plist',
  pbxproj: 'ios/MurphysLaws.xcodeproj/project.pbxproj',
};

function iosYml(marketing = '1.2.14', build = '30'): string {
  return `name: MurphysLaws\nsettings:\n  MARKETING_VERSION: "${marketing}"\n  CURRENT_PROJECT_VERSION: "${build}"\n`;
}

function iosPlist(marketing = '1.2.14', build = '30'): string {
  return `<dict>\n\t<key>CFBundleShortVersionString</key>\n\t<string>${marketing}</string>\n` +
    `\t<key>CFBundleVersion</key>\n\t<string>${build}</string>\n</dict>\n`;
}

function iosPbxproj(
  debug: { marketing?: string; build?: string } = {},
  release: { marketing?: string; build?: string } = {},
): string {
  const configuration = (name: string, marketing: string, build: string) =>
    `\t\t/* ${name} */ = {\n\t\t\tbuildSettings = {\n\t\t\t\tCURRENT_PROJECT_VERSION = ${build};\n` +
    `\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;\n\t\t\t\tMARKETING_VERSION = ${marketing};\n` +
    `\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n\t\t\t};\n\t\t\tname = ${name};\n\t\t};\n`;

  return configuration('Debug', debug.marketing ?? '1.2.14', debug.build ?? '30') +
    configuration('Release', release.marketing ?? '1.2.14', release.build ?? '30');
}

function iosDrift(files: Record<string, string | null>): string[] {
  const defaults: Record<string, string | null> = {
    [iosFiles.yml]: iosYml(),
    [iosFiles.plist]: iosPlist(),
    [iosFiles.pbxproj]: iosPbxproj(),
  };
  const merged = { ...defaults, ...files };

  return findIosVersionDrift((filePath) => merged[filePath] ?? null);
}

describe('iOS version drift', () => {
  it('passes when project.yml, Info.plist and every project.pbxproj configuration agree', () => {
    assert.deepEqual(iosDrift({}), []);
  });

  it('accepts quoted and unquoted values for the same version', () => {
    assert.deepEqual(
      iosDrift({
        [iosFiles.yml]: 'MARKETING_VERSION: 1.2.14\nCURRENT_PROJECT_VERSION: 30\n',
        [iosFiles.pbxproj]: iosPbxproj({ marketing: '"1.2.14"', build: '"30"' }),
      }),
      [],
    );
  });

  it('fails when project.pbxproj still has the old marketing version and build number in both configurations', () => {
    assert.deepEqual(
      iosDrift({
        [iosFiles.pbxproj]: iosPbxproj(
          { marketing: '1.2.4', build: '20' },
          { marketing: '1.2.4', build: '20' },
        ),
      }),
      [
        'iOS versions: the marketing version differs between files (ios/project.yml has 1.2.14; ' +
          'ios/MurphysLaws/Info.plist has 1.2.14; ios/MurphysLaws.xcodeproj/project.pbxproj has 1.2.4)',
        'iOS versions: the build number differs between files (ios/project.yml has 30; ' +
          'ios/MurphysLaws/Info.plist has 30; ios/MurphysLaws.xcodeproj/project.pbxproj has 20)',
      ],
    );
  });

  it('fails when only one project.pbxproj configuration drifts', () => {
    const drift = iosDrift({ [iosFiles.pbxproj]: iosPbxproj({}, { marketing: '1.2.13' }) });

    assert.equal(drift.length, 1);
    assert.match(drift[0], /marketing version differs between files/);
    assert.match(drift[0], /project\.pbxproj has 1\.2\.14, 1\.2\.13/);
  });

  it('fails when only the project.pbxproj build number drifts', () => {
    const drift = iosDrift({ [iosFiles.pbxproj]: iosPbxproj({ build: '29' }) });

    assert.equal(drift.length, 1);
    assert.match(drift[0], /build number differs between files/);
  });

  it('fails when project.yml moves ahead of Info.plist', () => {
    const drift = iosDrift({ [iosFiles.yml]: iosYml('1.2.15', '31') });

    assert.equal(drift.length, 2);
    assert.match(drift[0], /marketing version differs/);
    assert.match(drift[1], /build number differs/);
  });

  it('fails when Info.plist drifts from the other two files', () => {
    const drift = iosDrift({ [iosFiles.plist]: iosPlist('1.2.13', '29') });

    assert.equal(drift.length, 2);
    assert.match(drift[0], /ios\/MurphysLaws\/Info\.plist has 1\.2\.13/);
    assert.match(drift[1], /ios\/MurphysLaws\/Info\.plist has 29/);
  });

  for (const [name, path] of Object.entries(iosFiles)) {
    it(`fails clearly when ${name} cannot be read`, () => {
      assert.deepEqual(iosDrift({ [path]: null }), [`iOS versions: ${path} cannot be read`]);
    });
  }

  it('fails clearly, naming every file, when several files cannot be read', () => {
    assert.deepEqual(iosDrift({ [iosFiles.yml]: null, [iosFiles.pbxproj]: null }), [
      'iOS versions: ios/project.yml cannot be read',
      'iOS versions: ios/MurphysLaws.xcodeproj/project.pbxproj cannot be read',
    ]);
  });

  it('fails clearly when a file has no marketing version', () => {
    assert.deepEqual(iosDrift({ [iosFiles.yml]: 'CURRENT_PROJECT_VERSION: "30"\n' }), [
      `iOS versions: ${iosFiles.yml} has no marketing version that can be read`,
    ]);
  });

  it('fails clearly when a file has no build version', () => {
    assert.deepEqual(iosDrift({ [iosFiles.yml]: 'MARKETING_VERSION: "1.2.14"\n' }), [
      `iOS versions: ${iosFiles.yml} has no build number that can be read`,
    ]);
  });

  it('fails clearly, naming both versions, when a file is empty or in another format', () => {
    assert.deepEqual(iosDrift({ [iosFiles.plist]: '' }), [
      `iOS versions: ${iosFiles.plist} has no marketing version that can be read`,
      `iOS versions: ${iosFiles.plist} has no build number that can be read`,
    ]);
    assert.deepEqual(iosDrift({ [iosFiles.yml]: '{}' }), [
      `iOS versions: ${iosFiles.yml} has no marketing version that can be read`,
      `iOS versions: ${iosFiles.yml} has no build number that can be read`,
    ]);
  });

  it('fails when a project.pbxproj configuration lacks the versions, even if the others agree', () => {
    const oneConfiguration = iosPbxproj().split('\t\t/* Release */')[0];

    assert.deepEqual(iosDrift({ [iosFiles.pbxproj]: oneConfiguration }), [
      `iOS versions: ${iosFiles.pbxproj} has the marketing version 1 time(s), expected at least 2`,
      `iOS versions: ${iosFiles.pbxproj} has the build number 1 time(s), expected at least 2`,
    ]);
  });

  it('fails when a version line cannot be read instead of dropping it, and names a parameterised value', () => {
    const annotated = iosPbxproj().replace('MARKETING_VERSION = 1.2.14;', 'MARKETING_VERSION = 1.2.14; /* bumped */');
    const parameterised = iosPbxproj().replace('CURRENT_PROJECT_VERSION = 30;', 'CURRENT_PROJECT_VERSION = "$(BUILD)";');

    assert.deepEqual(iosDrift({ [iosFiles.pbxproj]: annotated }), [
      `iOS versions: ${iosFiles.pbxproj} has a marketing version line that cannot be read`,
    ]);
    assert.deepEqual(iosDrift({ [iosFiles.pbxproj]: parameterised }), [
      'iOS versions: the build number differs between files (ios/project.yml has 30; ' +
        'ios/MurphysLaws/Info.plist has 30; ios/MurphysLaws.xcodeproj/project.pbxproj has $(BUILD), 30)',
    ]);
  });

  it('fails when project.yml gains a version line that cannot be read next to the readable one', () => {
    const yml = 'MARKETING_VERSION: "1.2.14"\nCURRENT_PROJECT_VERSION: "30"\ntargets:\n  App:\n    settings:\n      MARKETING_VERSION: $(X) y\n';

    assert.deepEqual(iosDrift({ [iosFiles.yml]: yml }), [
      `iOS versions: ${iosFiles.yml} has a marketing version line that cannot be read`,
    ]);
  });

  it('reads project.yml values followed by a comment and ignores commented-out lines', () => {
    const yml = '# MARKETING_VERSION: "9.9.9"\nMARKETING_VERSION: "1.2.14" # current\nCURRENT_PROJECT_VERSION: 30 # build\n';

    assert.deepEqual(iosDrift({ [iosFiles.yml]: yml }), []);
  });

  it('reports an Info.plist that refers to a build setting as a difference, naming the value it has', () => {
    const drift = iosDrift({ [iosFiles.plist]: iosPlist('$(MARKETING_VERSION)', '$(CURRENT_PROJECT_VERSION)') });

    assert.equal(drift.length, 2);
    assert.match(drift[0], /Info\.plist has \$\(MARKETING_VERSION\)/);
  });

  it('holds for the files in this repository', () => {
    const readRepositoryFile = (filePath: string): string | null => {
      try {
        return readFileSync(new URL(`../${filePath}`, import.meta.url), 'utf8');
      } catch {
        return null;
      }
    };

    assert.deepEqual(findIosVersionDrift(readRepositoryFile), []);
  });
});

describe('check-version-bumps command', () => {
  const script = fileURLToPath(new URL('./check-version-bumps.ts', import.meta.url));
  const repositoryRoot = dirname(dirname(script));

  // Runs the script the way the pre-commit hook does, against a scratch repository whose index holds the given
  // files. The repository is selected through the environment (and the script runs from this repository, where tsx
  // is installed), with the variables a surrounding commit may have set overridden.
  function runInScratchRepository(stagedFiles: Record<string, string>) {
    const directory = mkdtempSync(join(tmpdir(), 'check-version-bumps-'));
    const env = {
      ...process.env,
      GIT_DIR: join(directory, '.git'),
      GIT_WORK_TREE: directory,
      GIT_INDEX_FILE: join(directory, '.git', 'index'),
    };

    try {
      execFileSync('git', ['init', '-q'], { cwd: directory, env });
      for (const [filePath, content] of Object.entries(stagedFiles)) {
        mkdirSync(dirname(join(directory, filePath)), { recursive: true });
        writeFileSync(join(directory, filePath), content);
        execFileSync('git', ['add', filePath], { cwd: directory, env });
      }

      return spawnSync(process.execPath, ['--import', 'tsx', script], { cwd: repositoryRoot, env, encoding: 'utf8', timeout: 60_000 });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  const agreeing = {
    [iosFiles.yml]: iosYml(),
    [iosFiles.plist]: iosPlist(),
    [iosFiles.pbxproj]: iosPbxproj(),
  };

  it('exits 0 when the staged iOS version files agree', () => {
    const result = runInScratchRepository(agreeing);

    assert.equal(result.status, 0, result.stderr);
  });

  it('exits 1 and names the drift when a staged iOS version file disagrees', () => {
    const result = runInScratchRepository({ ...agreeing, [iosFiles.pbxproj]: iosPbxproj({ marketing: '1.2.4' }) });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /The iOS app version is not the same in every file that records it/);
    assert.match(result.stderr, /project\.pbxproj has 1\.2\.4, 1\.2\.14/);
  });

  it('exits 1 when the iOS version files are not in the index at all', () => {
    const result = runInScratchRepository({ 'README.md': '# scratch\n' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ios\/project\.yml cannot be read/);
  });
});
