import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
  findLockfileProblems,
  findMissingVersionBumps,
  lockfileChecks,
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
  const inSync = (): Record<string, string | null> => ({
    'package.json': packageJson('2.0.0'),
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

  it('fails when a required file is missing from the index, and reports it once', () => {
    assert.deepEqual(problemsFor({ 'package-lock.json': null }), ['package-lock.json is missing from the index']);
    assert.deepEqual(problemsFor({ 'backend/package-lock.json': null }), ['backend/package-lock.json is missing from the index']);
    assert.deepEqual(problemsFor({ 'web/package.json': null }), ['web/package.json is missing from the index']);
  });

  it('keeps checking the other pairs when one file is missing', () => {
    // Problems come out in table order: the root pair, backend's own pair, then each workspace.
    assert.deepEqual(problemsFor({ 'web/package.json': null, 'backend/package.json': packageJson('3.0.1') }), [
      'backend/package.json is 3.0.1 but backend/package-lock.json version is 3.0.0',
      'backend/package.json is 3.0.1 but backend/package-lock.json packages[""].version is 3.0.0',
      'backend/package.json is 3.0.1 but package-lock.json packages["backend"].version is 3.0.0',
      'web/package.json is missing from the index',
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

  it('skips a package.json that parses but has no string version', () => {
    assert.deepEqual(problemsFor({ 'web/package.json': '{ "name": "web" }' }), []);
    assert.deepEqual(problemsFor({ 'web/package.json': '{ "version": 4 }' }), []);
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

  it('has a row for every workspace in the root package.json, so a new workspace is not skipped', () => {
    const root = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as { workspaces: string[] };

    for (const workspace of root.workspaces) {
      assert.ok(
        lockfileChecks.some((check) => check.packageJson === `${workspace}/package.json` && check.lockfile === 'package-lock.json'),
        `${workspace} has no lockfile check`,
      );
    }
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
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init');
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
});

describe('pre-commit hook wiring', () => {
  const root = path.resolve(__dirname, '..');
  const hook = readFileSync(path.join(root, '.husky/pre-commit'), 'utf8');

  // git runs .husky/pre-commit directly (core.hooksPath, no shebang), so without `sh -e` a bare failing
  // command lets the commit through. The lockfile check therefore has to exit explicitly.
  it('blocks the commit when the lockfile check fails', () => {
    assert.ok(
      hook.split('\n').some((line) => line.trim() === 'npm run check:lockfiles || exit 1'),
      'the hook must run `npm run check:lockfiles || exit 1`',
    );
  });

  it('has an npm script that runs the lockfile-only check', () => {
    const scripts = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;

    assert.equal(scripts['check:lockfiles'], 'tsx scripts/check-version-bumps.ts --lockfiles');
  });
});
