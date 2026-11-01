import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { syncLockfileVersions } from './sync-lockfile-versions';

const workspaces = { backend: '3.0.0', web: '4.0.0', mcp: '1.0.0' };

const json = (value: unknown, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;
const rootLock = (own: string, entries: Record<string, string>) =>
  json({
    name: 'root',
    version: own,
    lockfileVersion: 3,
    packages: { '': { name: 'root', version: own }, ...Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, { version: v }])) },
  });
const ownLock = (version: string) => json({ name: 'backend', version, lockfileVersion: 3, packages: { '': { version } } });

/** A tree where every lockfile agrees with its package.json. */
const inSync = (): Record<string, string | null> => ({
  'package.json': json({ name: 'root', version: '2.0.0', workspaces: Object.keys(workspaces) }),
  'package-lock.json': rootLock('2.0.0', workspaces),
  'backend/package.json': json({ version: '3.0.0' }),
  'backend/package-lock.json': ownLock('3.0.0'),
  'web/package.json': json({ version: '4.0.0' }),
  'mcp/package.json': json({ version: '1.0.0' }),
});

const syncFor = (overrides: Record<string, string | null> = {}) => {
  const files = { ...inSync(), ...overrides };
  return syncLockfileVersions((filePath) => files[filePath] ?? null);
};

describe('syncLockfileVersions', () => {
  it('changes nothing when every lockfile already agrees', () => {
    assert.deepEqual(syncFor(), {});
  });

  it('copies a bumped root version into both places the root lockfile records it', () => {
    const updates = syncFor({ 'package.json': json({ version: '2.0.1', workspaces: Object.keys(workspaces) }) });

    assert.deepEqual(Object.keys(updates), ['package-lock.json']);
    assert.equal(updates['package-lock.json'], rootLock('2.0.1', workspaces));
  });

  it("copies a bumped workspace version into the root lockfile and the workspace's own lockfile", () => {
    const updates = syncFor({ 'backend/package.json': json({ version: '3.0.1' }) });

    assert.deepEqual(Object.keys(updates).sort(), ['backend/package-lock.json', 'package-lock.json']);
    assert.equal(updates['package-lock.json'], rootLock('2.0.0', { ...workspaces, backend: '3.0.1' }));
    assert.equal(updates['backend/package-lock.json'], ownLock('3.0.1'));
  });

  it('copies a bumped workspace without its own lockfile into the root lockfile only', () => {
    const updates = syncFor({ 'web/package.json': json({ version: '4.1.0' }) });

    assert.deepEqual(Object.keys(updates), ['package-lock.json']);
    assert.equal(updates['package-lock.json'], rootLock('2.0.0', { ...workspaces, web: '4.1.0' }));
  });

  it('fixes every lockfile that is out of date in one pass, and a second pass changes nothing', () => {
    const files = {
      ...inSync(),
      'package.json': json({ version: '2.0.1', workspaces: Object.keys(workspaces) }),
      'backend/package.json': json({ version: '3.0.1' }),
      'web/package.json': json({ version: '4.0.1' }),
      'mcp/package.json': json({ version: '1.0.1' }),
    };
    const first = syncLockfileVersions((filePath) => files[filePath] ?? null);

    assert.deepEqual(Object.keys(first).sort(), ['backend/package-lock.json', 'package-lock.json']);
    assert.equal(first['package-lock.json'], rootLock('2.0.1', { backend: '3.0.1', web: '4.0.1', mcp: '1.0.1' }));

    const after = { ...files, ...first };
    assert.deepEqual(syncLockfileVersions((filePath) => after[filePath] ?? null), {});
  });

  it('touches only version fields and keeps every other field and the key order', () => {
    const lock = json({
      name: 'root',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': { name: 'root', version: '1.0.0', workspaces: ['backend'] },
        backend: { name: 'b', version: '3.0.0', license: 'MIT' },
        'node_modules/left-pad': { version: '9.9.9', resolved: 'https://example.test/left-pad.tgz' },
      },
    });
    const updates = syncFor({
      'package.json': json({ version: '2.0.0', workspaces: ['backend'] }),
      'package-lock.json': lock,
    });

    assert.equal(
      updates['package-lock.json'],
      lock.replace('"version": "1.0.0"', '"version": "2.0.0"').replace('"version": "1.0.0"', '"version": "2.0.0"'),
    );
    assert.match(updates['package-lock.json'] ?? '', /"node_modules\/left-pad": \{\n\s+"version": "9\.9\.9"/);
  });

  it('does not reformat a lockfile that already agrees', () => {
    assert.deepEqual(syncFor({ 'package-lock.json': json(JSON.parse(rootLock('2.0.0', workspaces)), 4) }), {});
  });

  it('skips a lockfile that does not exist', () => {
    assert.deepEqual(syncFor({ 'backend/package-lock.json': null, 'package-lock.json': null }), {});
  });

  it('leaves a workspace the lockfile does not list, and a package.json without a version, alone', () => {
    assert.deepEqual(syncFor({ 'package-lock.json': rootLock('2.0.0', { backend: '3.0.0', web: '4.0.0' }) }), {});
    assert.deepEqual(syncFor({ 'web/package.json': json({ name: 'web' }), 'mcp/package.json': json({ version: 1 }) }), {});
    assert.deepEqual(syncFor({ 'package.json': json({ workspaces: Object.keys(workspaces) }) }), {});
  });

  it('copes with a root package.json that declares no usable workspaces', () => {
    for (const declared of [undefined, 'backend', ['backend', 7], null]) {
      const updates = syncFor({ 'package.json': json({ version: '2.0.1', workspaces: declared }) });

      assert.deepEqual(Object.keys(updates), ['package-lock.json'], JSON.stringify(declared));
    }
    assert.deepEqual(syncFor({ 'package.json': null }), {});
  });

  it('stops on a file that is not JSON instead of guessing', () => {
    assert.throws(() => syncFor({ 'package-lock.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> branch' }), SyntaxError);
    assert.throws(() => syncFor({ 'web/package.json': '{ invalid' }), SyntaxError);
  });
});

describe('sync-lockfile-versions command', () => {
  const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx');
  const script = path.resolve(__dirname, 'sync-lockfile-versions.ts');
  const scratch: string[] = [];

  after(() => {
    for (const dir of scratch) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const run = (cwd: string, command: string, args: string[]) => spawnSync(command, args, { cwd, encoding: 'utf8' });
  const git = (cwd: string, ...args: string[]) => {
    const result = run(cwd, 'git', args);
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  const write = (repo: string, files: Record<string, string | null>) => {
    for (const [file, content] of Object.entries(files)) {
      if (content !== null) {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        writeFileSync(path.join(repo, file), content);
      }
    }
  };
  const sync = (repo: string, ...args: string[]) => run(repo, tsx, [script, ...args]);

  /** A real git repository with everything committed in sync. */
  const repoInSync = () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'sync-lockfiles-'));
    scratch.push(repo);
    write(repo, inSync());
    git(repo, 'init', '-q');
    git(repo, 'add', '-A');
    // Ignore the developer's global git config (commit signing, a global hooks path) in this throwaway repo.
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'init');
    return repo;
  };

  it('does nothing and prints nothing when the lockfiles agree', () => {
    const repo = repoInSync();

    for (const args of [[], ['--check'], ['--stage']]) {
      const result = sync(repo, ...args);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout + result.stderr, '', args.join(' '));
    }
  });

  it('--check reports the out-of-sync lockfiles and exits 1 without changing anything', () => {
    const repo = repoInSync();
    write(repo, { 'backend/package.json': json({ version: '3.0.1' }) });

    const result = sync(repo, '--check');

    assert.equal(result.status, 1);
    assert.match(result.stderr, /out of sync with package\.json: package-lock\.json, backend\/package-lock\.json/);
    assert.match(result.stderr, /npm run lockfiles:sync/);
    assert.equal(git(repo, 'status', '--porcelain', '--', 'package-lock.json', 'backend/package-lock.json'), '');
  });

  it('rewrites the lockfiles, and --check then passes', () => {
    const repo = repoInSync();
    write(repo, { 'package.json': json({ name: 'root', version: '2.0.1', workspaces: Object.keys(workspaces) }) });

    const result = sync(repo);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Synced lockfile versions with package\.json: package-lock\.json/);
    assert.equal(readFileSync(path.join(repo, 'package-lock.json'), 'utf8'), rootLock('2.0.1', workspaces));
    assert.equal(git(repo, 'diff', '--cached', '--name-only'), '', 'nothing is staged without --stage');
    assert.equal(sync(repo, '--check').status, 0);
  });

  it('--stage stages the lockfiles it changed and nothing else', () => {
    const repo = repoInSync();
    write(repo, {
      'web/package.json': json({ version: '4.1.0' }),
      'mcp/notes.txt': 'unrelated local edit\n',
    });
    git(repo, 'add', 'web/package.json');

    const result = sync(repo, '--stage');

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(git(repo, 'diff', '--cached', '--name-only').trim().split('\n').sort(), ['package-lock.json', 'web/package.json']);
  });

  it('fails loudly on a lockfile it cannot parse', () => {
    const repo = repoInSync();
    write(repo, { 'package-lock.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> branch\n', 'package.json': json({ version: '2.0.1', workspaces: [] }) });

    const result = sync(repo);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SyntaxError/);
  });
});

describe('hook and CI wiring', () => {
  const root = path.resolve(__dirname, '..');
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
  const lines = (file: string) => read(file).split('\n').map((line) => line.trim());

  it('has npm run lockfiles:sync run the script', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

    assert.equal(scripts['lockfiles:sync'], 'tsx scripts/sync-lockfile-versions.ts');
  });

  it('syncs and stages the lockfiles in the pre-commit hook when a package.json is staged, without blocking', () => {
    const hook = lines('.husky/pre-commit');
    const step = hook.findIndex((line) => line.startsWith('npm run lockfiles:sync -- --stage'));

    assert.ok(step > 0, 'the hook runs the sync step');
    assert.match(hook[step] ?? '', /\|\| echo /, 'a failing sync warns and does not stop the commit');
    assert.match(hook[step - 1] ?? '', /package\\\.json\$/, 'only when a package.json is staged');
  });

  it('checks the lockfiles in CI on every pull request, so it can be a required status check', () => {
    const workflow = read('.github/workflows/lockfile-sync.yml');

    assert.match(workflow, /^on:\n(?:.*\n)*?\s+pull_request:/m);
    assert.doesNotMatch(workflow, /^\s+paths:/m, 'a path filter would leave the check missing on some pull requests');
    assert.ok(lines('.github/workflows/lockfile-sync.yml').includes('run: npm run lockfiles:sync -- --check'));
  });
});
