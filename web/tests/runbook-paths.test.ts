import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, '../..');
const docsDirectory = path.join(repositoryRoot, 'shared/docs');
const dropletCheckout = '/root/murphys-laws/';
const topLevelEntries = new Set(fs.readdirSync(repositoryRoot));

// The source of a `cp` or `scp` line in a runbook, when it names a file inside this repository:
// either relative to the repository root or under the droplet's checkout. Anything else
// (/root/backups, /tmp, ~/..., a $VARIABLE, a user@host path, a backup folder) is not a repository
// file. A relative path counts only when it starts at a real top-level entry of the repository, so a
// mistyped `config/...` is caught while a scratch name such as `.migration-backup-1/*` is not.
const repositorySource = (line: string): string | null => {
  const source = /^\s*s?cp\s+(?:-\S+\s+)*(\S+)\s+\S+/.exec(line)?.[1];
  if (source === undefined) {
    return null;
  }
  if (source.startsWith(dropletCheckout)) {
    return source.slice(dropletCheckout.length);
  }
  const firstSegment = source.split('/')[0] ?? '';
  return topLevelEntries.has(firstSegment) ? source : null;
};

const runbooks = fs.readdirSync(docsDirectory).filter((name) => name.endsWith('.md'));

describe('runbook copy commands', () => {
  it('finds runbooks to check', () => {
    expect(runbooks).toContain('DISASTER-RECOVERY.md');
  });

  it('reads the source of a copy command and ignores paths outside the repository', () => {
    expect(repositorySource(' cp config/a.conf /etc/a.conf')).toBe('config/a.conf');
    expect(repositorySource(' scp backend/scripts/a.sh me@host:/tmp/')).toBe('backend/scripts/a.sh');
    expect(repositorySource(' cp -a /root/murphys-laws/nginx.conf /etc/nginx/x')).toBe('nginx.conf');
    expect(repositorySource(' cp /root/backups/murphys.db /root/murphys-laws/backend/murphys.db')).toBeNull();
    expect(repositorySource(' scp me@host:/root/backups/x.db /tmp/')).toBeNull();
    expect(repositorySource(' cp /root/.ssh/authorized_keys /home/me/.ssh/')).toBeNull();
    expect(repositorySource('Copy the nginx config')).toBeNull();
  });

  for (const runbook of runbooks) {
    it(`${runbook} copies only files that exist in the repository`, () => {
      const lines = fs.readFileSync(path.join(docsDirectory, runbook), 'utf8').split('\n');
      const missing = lines
        .map(repositorySource)
        .filter((source): source is string => source !== null)
        .filter((source) => !fs.existsSync(path.join(repositoryRoot, source)));

      expect(missing).toEqual([]);
    });
  }
});
