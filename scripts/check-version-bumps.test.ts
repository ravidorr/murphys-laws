import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
  findLockfileProblems,
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

describe('findLockfileProblems', () => {
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
  const workspaceVersions = { backend: '3.0.0', web: '4.0.0', mcp: '1.0.0', sdk: '0.2.0', cli: '0.1.0' };

  /** A tree where every package.json matches every lockfile entry. */
  const rootPackageJson = (workspaces: unknown = Object.keys(workspaceVersions)) =>
    JSON.stringify({ version: '2.0.0', workspaces });
  const inSync = (): Record<string, string | null> => ({
    'package.json': rootPackageJson(),
    'package-lock.json': rootLockfile(workspaceVersions),
    'backend/package.json': packageJson('3.0.0'),
    'backend/package-lock.json': ownLockfile('3.0.0'),
    'web/package.json': packageJson('4.0.0'),
    'mcp/package.json': packageJson('1.0.0'),
    'sdk/package.json': packageJson('0.2.0'),
    'cli/package.json': packageJson('0.1.0'),
  });

  const problemsFor = (overrides: Record<string, string | null> = {}) => {
    const files = { ...inSync(), ...overrides };
    return findLockfileProblems((filePath) => files[filePath] ?? null);
  };

  it('passes when every package.json matches its lockfiles', () => {
    assert.deepEqual(problemsFor(), []);
  });

  it('flags a workspace version the root lockfile still records at the old number', () => {
    const lock = rootLockfile({ ...workspaceVersions, backend: '2.9.9' });

    assert.deepEqual(problemsFor({ 'package-lock.json': lock }), [
      'backend/package.json is 3.0.0 but package-lock.json packages["backend"].version is 2.9.9',
    ]);
  });

  it('names each workspace the root lockfile records wrongly', () => {
    const lock = rootLockfile({ backend: '3.0.0', web: '4.0.1', mcp: '1.0.1', sdk: '0.2.1', cli: '0.1.1' });

    assert.deepEqual(problemsFor({ 'package-lock.json': lock }), [
      'web/package.json is 4.0.0 but package-lock.json packages["web"].version is 4.0.1',
      'mcp/package.json is 1.0.0 but package-lock.json packages["mcp"].version is 1.0.1',
      'sdk/package.json is 0.2.0 but package-lock.json packages["sdk"].version is 0.2.1',
      'cli/package.json is 0.1.0 but package-lock.json packages["cli"].version is 0.1.1',
    ]);
  });

  it("flags the root lockfile's own top-level version and packages entry", () => {
    const lock = rootLockfile(workspaceVersions, '1.9.9');

    assert.deepEqual(problemsFor({ 'package-lock.json': lock }), [
      'package.json is 2.0.0 but package-lock.json version is 1.9.9',
      'package.json is 2.0.0 but package-lock.json packages[""].version is 1.9.9',
    ]);
  });

  it("flags the root lockfile's packages entry when only that one is stale", () => {
    const lock = JSON.stringify({
      version: '2.0.0',
      packages: { '': { version: '1.9.9' }, ...Object.fromEntries(Object.entries(workspaceVersions).map(([k, v]) => [k, { version: v }])) },
    });

    assert.deepEqual(problemsFor({ 'package-lock.json': lock }), [
      'package.json is 2.0.0 but package-lock.json packages[""].version is 1.9.9',
    ]);
  });

  it("flags backend's own lockfile", () => {
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': ownLockfile('2.9.9', '2.9.8') }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json version is 2.9.9',
      'backend/package.json is 3.0.0 but backend/package-lock.json packages[""].version is 2.9.8',
    ]);
  });

  it('flags a package.json bumped without regenerating either lockfile', () => {
    assert.deepEqual(problemsFor({ 'backend/package.json': packageJson('3.0.1') }), [
      'backend/package.json is 3.0.1 but backend/package-lock.json version is 3.0.0',
      'backend/package.json is 3.0.1 but backend/package-lock.json packages[""].version is 3.0.0',
      'backend/package.json is 3.0.1 but package-lock.json packages["backend"].version is 3.0.0',
    ]);
  });

  it('fails when a required file is missing, and reports it once', () => {
    assert.deepEqual(problemsFor({ 'package-lock.json': null }), ['package-lock.json is missing']);
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': null }), ['backend/package-lock.json is missing']);
    assert.deepEqual(problemsFor({ 'web/package.json': null }), ['web/package.json is missing']);
  });

  it('keeps checking the other pairs when one file is missing', () => {
    // Problems come out in table order: the root pair, backend's own pair, then each workspace.
    assert.deepEqual(problemsFor({ 'web/package.json': null, 'backend/package.json': packageJson('3.0.1') }), [
      'backend/package.json is 3.0.1 but backend/package-lock.json version is 3.0.0',
      'backend/package.json is 3.0.1 but backend/package-lock.json packages[""].version is 3.0.0',
      'backend/package.json is 3.0.1 but package-lock.json packages["backend"].version is 3.0.0',
      'web/package.json is missing',
    ]);
  });

  it('fails on a lockfile that is not a JSON object, such as one with merge conflict markers', () => {
    for (const content of ['{ invalid json', '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> branch', 'null', '[]', '"1.0.0"', '2', '']) {
      assert.deepEqual(problemsFor({ 'package-lock.json': content }), ['package-lock.json is not a valid JSON object'], content);
    }
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': '{ invalid' }), ['backend/package-lock.json is not a valid JSON object']);
  });

  it('fails on a package.json that is not a JSON object', () => {
    assert.deepEqual(problemsFor({ 'web/package.json': '{ invalid' }), ['web/package.json is not a valid JSON object']);
  });

  it('fails on a package.json whose version is missing or not a string, instead of skipping it', () => {
    for (const content of ['{ "name": "web" }', '{ "version": 4 }', '{ "version": null }', '{ "version": ["4.0.0"] }']) {
      assert.deepEqual(problemsFor({ 'web/package.json': content }), ['web/package.json has no string version'], content);
    }
  });

  it('fails when the root package.json loses its version, even though the lockfile still records one', () => {
    assert.deepEqual(problemsFor({ 'package.json': JSON.stringify({ workspaces: Object.keys(workspaceVersions) }) }), [
      'package.json has no string version',
    ]);
  });

  it('fails when the lockfile lacks an entry or has a non-string version for it', () => {
    const noWorkspaces = JSON.stringify({ version: '2.0.0', packages: { '': { version: '2.0.0' } } });
    assert.deepEqual(problemsFor({ 'package-lock.json': noWorkspaces }), [
      'backend/package.json is 3.0.0 but package-lock.json has no packages["backend"].version',
      'web/package.json is 4.0.0 but package-lock.json has no packages["web"].version',
      'mcp/package.json is 1.0.0 but package-lock.json has no packages["mcp"].version',
      'sdk/package.json is 0.2.0 but package-lock.json has no packages["sdk"].version',
      'cli/package.json is 0.1.0 but package-lock.json has no packages["cli"].version',
    ]);

    const noPackages = JSON.stringify({ version: '3.0.0' });
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': noPackages }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json has no packages[""].version',
    ]);

    const oddTypes = JSON.stringify({ version: 2, packages: { '': { version: null } } });
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': oddTypes }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json has no version',
      'backend/package.json is 3.0.0 but backend/package-lock.json has no packages[""].version',
    ]);

    const oddPackages = JSON.stringify({ version: '3.0.0', packages: 'nope' });
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': oddPackages }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json has no packages[""].version',
    ]);

    const oddEntry = JSON.stringify({ version: '3.0.0', packages: { '': 'nope' } });
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': oddEntry }), [
      'backend/package.json is 3.0.0 but backend/package-lock.json has no packages[""].version',
    ]);
  });

  it('takes the workspaces to compare from the root package.json, so removing one is not an error', () => {
    // cli is no longer a workspace: its package.json is gone and the root lockfile still lists a stale version.
    const lock = rootLockfile({ ...workspaceVersions, cli: '9.9.9' });

    assert.deepEqual(
      problemsFor({
        'package.json': rootPackageJson(['backend', 'web', 'mcp', 'sdk']),
        'package-lock.json': lock,
        'cli/package.json': null,
      }),
      [],
    );
  });

  it('checks a workspace that is added to the root package.json', () => {
    assert.deepEqual(problemsFor({ 'package.json': rootPackageJson([...Object.keys(workspaceVersions), 'extra']) }), [
      'extra/package.json is missing',
    ]);
  });

  it('fails when the root package.json has no workspaces array of names', () => {
    for (const workspaces of [null, 'backend', ['backend', 7], { backend: true }]) {
      assert.deepEqual(
        problemsFor({ 'package.json': rootPackageJson(workspaces) }).filter((problem) => problem.startsWith('package.json has')),
        ['package.json has no workspaces array of names'],
        JSON.stringify(workspaces),
      );
    }
  });

  it('still compares the root and backend pairs when the workspaces are unusable', () => {
    assert.deepEqual(
      problemsFor({ 'package.json': rootPackageJson(null), 'backend/package-lock.json': ownLockfile('2.9.9', '3.0.0') }),
      [
        'package.json has no workspaces array of names',
        'backend/package.json is 3.0.0 but backend/package-lock.json version is 2.9.9',
      ],
    );
  });
});

describe('check-version-bumps command', () => {
  const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx');
  const script = path.resolve(__dirname, 'check-version-bumps.ts');
  const scratch: string[] = [];

  after(() => {
    for (const dir of scratch) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const write = (repo: string, file: string, content: unknown) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  };

  const git = (repo: string, ...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  };

  /** A real git repository with every package and lockfile committed in sync. */
  const repoInSync = () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'check-versions-'));
    scratch.push(repo);
    const versions = { backend: '3.0.0', web: '4.0.0', mcp: '1.0.0', sdk: '0.2.0', cli: '0.1.0' };
    write(repo, 'package.json', { name: 'root', version: '2.0.0', workspaces: Object.keys(versions) });
    write(repo, 'package-lock.json', {
      version: '2.0.0',
      packages: { '': { version: '2.0.0' }, ...Object.fromEntries(Object.entries(versions).map(([k, v]) => [k, { version: v }])) },
    });
    for (const [name, version] of Object.entries(versions)) {
      write(repo, `${name}/package.json`, { name, version });
    }
    write(repo, 'backend/package-lock.json', { version: '3.0.0', packages: { '': { version: '3.0.0' } } });
    git(repo, 'init', '-q');
    git(repo, 'add', '-A');
    // Ignore the developer's global git config (commit signing, a global hooks path) in these throwaway repos.
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'init');
    return repo;
  };

  const run = (repo: string, ...args: string[]) => spawnSync(tsx, [script, ...args], { cwd: repo, encoding: 'utf8' });

  it('passes and prints nothing when the staged tree is in sync', () => {
    const result = run(repoInSync());

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
  });

  it('blocks a version bump that leaves the lockfiles behind, and names the right fix for each', () => {
    const repo = repoInSync();
    write(repo, 'backend/package.json', { name: 'backend', version: '3.0.1' });
    git(repo, 'add', 'backend/package.json');

    const result = run(repo);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /package\.json versions and lockfiles are out of sync/);
    assert.match(result.stderr, /backend\/package\.json is 3\.0\.1 but backend\/package-lock\.json version is 3\.0\.0/);
    assert.match(result.stderr, /backend\/package\.json is 3\.0\.1 but package-lock\.json packages\["backend"\]\.version is 3\.0\.0/);
    assert.match(result.stderr, /npm install --package-lock-only {10}\(run at the repository root\)/);
    assert.match(result.stderr, /cd backend && npm install --package-lock-only --no-workspaces/);
    assert.doesNotMatch(result.stderr, /require version bumps/);
  });

  it('passes once the lockfiles are updated with the bump', () => {
    const repo = repoInSync();
    // A backend change needs a backend bump and a root bump, each recorded in every lockfile entry.
    write(repo, 'backend/package.json', { name: 'backend', version: '3.0.1' });
    write(repo, 'backend/package-lock.json', { version: '3.0.1', packages: { '': { version: '3.0.1' } } });
    write(repo, 'package.json', { name: 'root', version: '2.0.1', workspaces: ['backend', 'web', 'mcp', 'sdk', 'cli'] });
    write(repo, 'package-lock.json', {
      version: '2.0.1',
      packages: { '': { version: '2.0.1' }, backend: { version: '3.0.1' }, web: { version: '4.0.0' }, mcp: { version: '1.0.0' }, sdk: { version: '0.2.0' }, cli: { version: '0.1.0' } },
    });
    git(repo, 'add', '-A');

    const result = run(repo);

    assert.equal(result.status, 0, result.stderr);
  });

  it('blocks a staged lockfile with merge conflict markers', () => {
    const repo = repoInSync();
    write(repo, 'package-lock.json', '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> branch\n');
    git(repo, 'add', 'package-lock.json');

    const result = run(repo);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /package-lock\.json is not a valid JSON object/);
  });

  it('reports a missing version bump and a lockfile mismatch together', () => {
    const repo = repoInSync();
    write(repo, 'cli/index.ts', 'export const cli = 1;\n');
    write(repo, 'web/package.json', { name: 'web', version: '4.0.1' });
    git(repo, 'add', '-A');

    const result = run(repo);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Staged changes require version bumps/);
    assert.match(result.stderr, /cli package: cli\/package\.json version/);
    assert.match(result.stderr, /web\/package\.json is 4\.0\.1 but package-lock\.json packages\["web"\]\.version is 4\.0\.0/);
  });

  it('with --lockfiles blocks only on lockfile drift and ignores missing version bumps', () => {
    const repo = repoInSync();
    write(repo, 'cli/index.ts', 'export const cli = 1;\n');
    git(repo, 'add', '-A');

    assert.equal(run(repo).status, 1, 'the full check wants a cli version bump');

    const lockfilesOnly = run(repo, '--lockfiles');
    assert.equal(lockfilesOnly.status, 0, lockfilesOnly.stderr);
    assert.equal(lockfilesOnly.stderr, '');

    write(repo, 'web/package.json', { name: 'web', version: '4.0.1' });
    git(repo, 'add', '-A');
    const drifted = run(repo, '--lockfiles');
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /web\/package\.json is 4\.0\.1 but package-lock\.json packages\["web"\]\.version is 4\.0\.0/);
    assert.doesNotMatch(drifted.stderr, /require version bumps/);
  });

  it('lets a workspace be removed in the same commit as its lockfile entry', () => {
    const repo = repoInSync();
    git(repo, 'rm', '-rq', 'cli');
    write(repo, 'package.json', { name: 'root', version: '2.0.0', workspaces: ['backend', 'web', 'mcp', 'sdk'] });
    write(repo, 'package-lock.json', {
      version: '2.0.0',
      packages: { '': { version: '2.0.0' }, backend: { version: '3.0.0' }, web: { version: '4.0.0' }, mcp: { version: '1.0.0' }, sdk: { version: '0.2.0' } },
    });
    git(repo, 'add', '-A');

    const result = run(repo, '--lockfiles');

    assert.equal(result.status, 0, result.stderr);
  });

  it('with --ref reads that commit instead of the index', () => {
    const repo = repoInSync();
    write(repo, 'web/package.json', { name: 'web', version: '4.0.1' });
    git(repo, 'add', '-A');

    assert.equal(run(repo, '--lockfiles').status, 1, 'the staged drift is seen through the index');

    const committed = run(repo, '--lockfiles', '--ref=HEAD');
    assert.equal(committed.status, 0, committed.stderr);

    const unknown = run(repo, '--lockfiles', '--ref=no-such-commit');
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /package\.json is missing/);
  });
});

describe('hook and CI wiring', () => {
  const root = path.resolve(__dirname, '..');
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
  const lines = (file: string) => read(file).split('\n').map((line) => line.trim());

  // git can run .husky/pre-commit directly (core.hooksPath, no shebang), so without `sh -e` a bare failing
  // command lets the commit through. The check therefore has to exit explicitly.
  it('has the pre-commit hook stop the commit when the version or lockfile check fails', () => {
    assert.ok(lines('.husky/pre-commit').includes('npm run check:versions || exit 1'));
  });

  it('has the pre-push hook stop the push when a lockfile is out of sync', () => {
    assert.ok(read('.husky/pre-push').includes('npm run check:lockfiles -- --ref=HEAD'));
    assert.ok(lines('.husky/pre-push').includes('exit 1'));
  });

  it('has an npm script that runs the lockfile-only check', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

    assert.equal(scripts['check:lockfiles'], 'tsx scripts/check-version-bumps.ts --lockfiles');
  });

  it('runs the lockfile check in CI on every pull request, so it can be a required status check', () => {
    const workflow = read('.github/workflows/lockfile-sync.yml');

    assert.match(workflow, /^on:\n(?:.*\n)*?\s+pull_request:/m);
    assert.doesNotMatch(workflow, /^\s+paths:/m, 'a path filter would leave the check missing on some pull requests');
    assert.ok(lines('.github/workflows/lockfile-sync.yml').includes('run: npm run check:lockfiles'));
    assert.match(workflow, /git diff --exit-code -- package-lock\.json/);
  });
});
