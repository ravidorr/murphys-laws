import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readGitSha, resolveAppRelease } from '../scripts/app-release.ts';

const SHA = 'a'.repeat(40);

describe('resolveAppRelease', () => {
  it('uses VITE_APP_VERSION (the commit SHA in CI) when it is set', () => {
    const release = resolveAppRelease({
      env: { VITE_APP_VERSION: SHA },
      packageVersion: '1.2.3',
      readGitSha: () => {
        throw new Error('the checkout must not be consulted when VITE_APP_VERSION is set');
      },
    });

    expect(release).toBe(SHA);
  });

  it('trims the configured value', () => {
    expect(resolveAppRelease({ env: { VITE_APP_VERSION: ` ${SHA}\n` }, packageVersion: '1.2.3' })).toBe(SHA);
  });

  it('falls back to the commit of the checkout when the variable is unset or blank', () => {
    const readSha = () => 'b'.repeat(40);

    expect(resolveAppRelease({ env: {}, packageVersion: '1.2.3', readGitSha: readSha })).toBe('b'.repeat(40));
    expect(resolveAppRelease({ env: { VITE_APP_VERSION: '  ' }, packageVersion: '1.2.3', readGitSha: readSha })).toBe(
      'b'.repeat(40),
    );
  });

  it('falls back to the package version marked as a dev build, and says so, when the commit is unknown', () => {
    const warn = vi.fn();

    expect(resolveAppRelease({ env: {}, packageVersion: '1.2.3', readGitSha: () => undefined, warn })).toBe('1.2.3-dev');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/VITE_APP_VERSION is not set and git could not report the commit.*"1\.2\.3-dev"/);
  });

  it('warns on the console by default when it falls back', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(resolveAppRelease({ env: {}, packageVersion: '1.2.3', readGitSha: () => undefined })).toBe('1.2.3-dev');
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses the dev fallback when the build needs a commit (it uploads source maps)', () => {
    const warn = vi.fn();

    expect(() =>
      resolveAppRelease({ env: {}, packageVersion: '1.2.3', readGitSha: () => undefined, requireCommit: true, warn }),
    ).toThrow(/set VITE_APP_VERSION to the commit SHA/);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when the commit is known', () => {
    const warn = vi.fn();

    resolveAppRelease({ env: {}, packageVersion: '1.2.3', readGitSha: () => SHA, requireCommit: true, warn });

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not read the clock: the same input gives the same release as time passes', () => {
    vi.useFakeTimers();
    try {
      const input = { env: {}, packageVersion: '1.2.3', readGitSha: () => undefined, warn: () => undefined };
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const first = resolveAppRelease(input);
      vi.setSystemTime(new Date('2030-06-15T12:34:56Z'));

      expect(resolveAppRelease(input)).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([SHA, 'a'.repeat(200), 'murphys-laws-web@1.2.3+build.5', 'v1_2-3.4', '1', 'latest-1'])(
    'accepts %s',
    (value) => {
      expect(resolveAppRelease({ env: { VITE_APP_VERSION: value }, packageVersion: '1.2.3' })).toBe(value);
    },
  );

  it.each(['has space', 'a/b', '..', '.', '.hidden', '-x', '_x', 'new\nline', 'tab\tx', 'latest', 'x'.repeat(201)])(
    'refuses %j as a release name',
    (value) => {
      expect(() => resolveAppRelease({ env: { VITE_APP_VERSION: value }, packageVersion: '1.2.3' })).toThrow(
        /not a valid release name/,
      );
    },
  );
});

describe('readGitSha', () => {
  const directories: string[] = [];
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      ...args,
    ], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const makeDirectory = (): string => {
    const directory = mkdtempSync(join(tmpdir(), 'app-release-'));
    directories.push(directory);
    return directory;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  // A commit hook runs with variables that point git at the repository being committed to, and these tests make
  // their own repositories (or none) in a temporary directory.
  const isolateGit = (ceiling?: string): void => {
    vi.stubEnv('GIT_DIR', undefined);
    vi.stubEnv('GIT_WORK_TREE', undefined);
    vi.stubEnv('GIT_INDEX_FILE', undefined);
    vi.stubEnv('GIT_CEILING_DIRECTORIES', ceiling);
  };

  it('returns the commit SHA of the repository at the given directory', () => {
    isolateGit();
    const directory = makeDirectory();
    git(directory, 'init', '-q');
    git(directory, 'commit', '-q', '--allow-empty', '-m', 'first');

    expect(readGitSha(directory)).toBe(git(directory, 'rev-parse', 'HEAD'));
    expect(readGitSha(directory)).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns undefined for a repository without a commit', () => {
    isolateGit();
    const directory = makeDirectory();
    git(directory, 'init', '-q');

    expect(readGitSha(directory)).toBeUndefined();
  });

  it('returns undefined outside a repository', () => {
    const directory = makeDirectory();
    // A temporary directory may itself sit inside a checkout: stop git from looking above it
    isolateGit(dirname(directory));

    expect(readGitSha(directory)).toBeUndefined();
  });
});
