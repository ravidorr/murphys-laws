import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, '../..');
const docsDirectory = path.join(repositoryRoot, 'shared/docs');
const dropletCheckout = '/root/murphys-laws/';

// Files the repository tracks. The check uses this list, not the disk, so a build artifact that
// happens to exist locally (such as backend/murphys.db) cannot hide a missing file, and CI sees
// the same answer as a laptop.
const trackedFiles = new Set(
  execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' }).split('\n').filter(Boolean),
);

// Directories that hold tracked files, so `cp -r backend/config /etc/x` is accepted.
const trackedDirectories = new Set(
  [...trackedFiles].flatMap((file) => {
    const parts = file.split('/').slice(0, -1);
    return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
  }),
);

// The database is created on the server, so the repository does not track it. A bare `murphys.db` is
// the same file copied from inside `backend/` (DATABASE.md only).
const runtimeFiles = new Set(['backend/murphys.db', 'murphys.db']);

// The source of a `cp` or `scp` line in a runbook, when it names a file inside this repository:
// under the droplet's checkout, or a plain relative path. Anything else (/root/backups, /tmp, ~/...,
// a $VARIABLE, a user@host path, a glob, a placeholder, a dot-folder) is not a repository file.
// Known gaps: only a line that starts with `cp`, `scp` or `sudo cp` is read, so `install`, `rsync`,
// `cp -t DIR`, a copy after `&&`, and a source on a continuation line are not checked.
const repositorySource = (line: string): string | null => {
  const source = /^\s*(?:sudo\s+)?s?cp\s+(?:-\S+\s+)*(\S+)\s+\S+/.exec(line)?.[1];
  if (source === undefined) {
    return null;
  }
  if (source.startsWith(dropletCheckout)) {
    return source.slice(dropletCheckout.length);
  }
  const relative = source.replace(/^\.\//, '');
  return /^[A-Za-z0-9]/.test(relative) && !/[@:*<$"]/.test(relative) ? relative : null;
};

const copiedSources = (runbook: string): string[] =>
  fs
    .readFileSync(path.join(docsDirectory, runbook), 'utf8')
    .split('\n')
    .map(repositorySource)
    .filter((source): source is string => source !== null);

const runbooks = fs.readdirSync(docsDirectory).filter((name) => name.endsWith('.md'));

describe('runbook copy commands', () => {
  it('reads the source of a copy command and ignores paths outside the repository', () => {
    expect(repositorySource(' cp config/a.conf /etc/a.conf')).toBe('config/a.conf');
    expect(repositorySource(' sudo cp backend/a.conf /etc/a.conf')).toBe('backend/a.conf');
    expect(repositorySource(' scp ecosystem.config.cjs me@host:/tmp/')).toBe('ecosystem.config.cjs');
    expect(repositorySource(' scp backend/scripts/a.sh me@host:/tmp/')).toBe('backend/scripts/a.sh');
    expect(repositorySource(' cp -a /root/murphys-laws/nginx.conf /etc/nginx/x')).toBe('nginx.conf');
    expect(repositorySource(' cp /root/backups/murphys.db /root/murphys-laws/backend/murphys.db')).toBeNull();
    expect(repositorySource(' scp me@host:/root/backups/x.db /tmp/')).toBeNull();
    expect(repositorySource(' cp /root/.ssh/authorized_keys /home/me/.ssh/')).toBeNull();
    expect(repositorySource(' cp "$LATEST_BACKUP" /tmp/x')).toBeNull();
    expect(repositorySource(' cp ~/local-backups/x.db /tmp/x')).toBeNull();
    expect(repositorySource(' cp ./backend/a.sh /etc/a.sh')).toBe('backend/a.sh');
    expect(repositorySource(' cp .migration-backup-1/* ./')).toBeNull();
    expect(repositorySource('Copy the nginx config')).toBeNull();
  });

  it('still finds the copy commands the recovery guides are written around', () => {
    expect(copiedSources('DISASTER-RECOVERY.md').length, 'the runbook format changed: no copy commands found').toBeGreaterThan(8);
    expect(copiedSources('DISASTER-RECOVERY.md')).toEqual(
      expect.arrayContaining(['nginx.conf', 'config/fail2ban/filter.d-nginx-scanner.conf', 'backend/scripts/daily-report.sh']),
    );
    expect(copiedSources('DEPLOY-MONITORING.md')).toEqual(
      expect.arrayContaining(['nginx.conf', 'backend/ecosystem.config.cjs']),
    );
  });

  for (const runbook of runbooks) {
    it(`${runbook} copies only files that exist in the repository`, () => {
      const missing = copiedSources(runbook).filter(
        (source) =>
          !trackedFiles.has(source) && !trackedDirectories.has(source.replace(/\/$/, '')) && !runtimeFiles.has(source),
      );

      expect(missing, 'the check uses `git ls-files`: `git add` a new file the runbook copies').toEqual([]);
    });
  }
});
