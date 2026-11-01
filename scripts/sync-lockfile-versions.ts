import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

type Lockfile = {
  version?: string;
  packages?: Record<string, { version?: string } | undefined>;
};

/**
 * Copies each package.json version into the lockfile fields that record it, and returns the lockfiles that
 * changed with their new contents. package.json is the source of truth, so a lockfile that disagrees is
 * rewritten, never reported as an error. Only the version fields are touched: a lockfile that already agrees is
 * not re-serialized, so formatting never changes.
 *
 * The root `package-lock.json` records the root version twice (`version` and `packages[""]`) and each workspace
 * once (`packages["<workspace>"]`). A workspace with a lockfile of its own, such as `backend/`, records its own
 * version twice there. Workspaces are taken from the root package.json as literal paths.
 */
export function syncLockfileVersions(read: (filePath: string) => string | null): Record<string, string> {
  const versionOf = (dir: string): string | undefined => {
    const text = read(dir === '.' ? 'package.json' : `${dir}/package.json`);
    const version = text === null ? undefined : (JSON.parse(text) as { version?: unknown }).version;
    return typeof version === 'string' ? version : undefined;
  };
  const rootText = read('package.json');
  const declared = rootText === null ? undefined : (JSON.parse(rootText) as { workspaces?: unknown }).workspaces;
  const workspaces = Array.isArray(declared) ? declared.filter((name): name is string => typeof name === 'string') : [];

  const updates: Record<string, string> = {};

  const sync = (lockfile: string, own: string | undefined, entries: Record<string, string | undefined>) => {
    const text = read(lockfile);
    if (text === null) {
      return;
    }

    const lock = JSON.parse(text) as Lockfile;
    let changed = false;
    const set = (target: { version?: string } | undefined, version: string | undefined) => {
      if (target !== undefined && version !== undefined && target.version !== version) {
        target.version = version;
        changed = true;
      }
    };

    set(lock, own);
    set(lock.packages?.[''], own);
    for (const [workspace, version] of Object.entries(entries)) {
      set(lock.packages?.[workspace], version);
    }

    if (changed) {
      updates[lockfile] = `${JSON.stringify(lock, null, 2)}\n`;
    }
  };

  sync('package-lock.json', versionOf('.'), Object.fromEntries(workspaces.map((name) => [name, versionOf(name)])));
  for (const name of workspaces) {
    sync(`${name}/package-lock.json`, versionOf(name), {});
  }

  return updates;
}

function readIfPresent(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
}

/**
 * `--check` reports the lockfiles that are out of sync and exits 1 without changing anything (for CI).
 * Otherwise the lockfiles are rewritten, and `--stage` also runs `git add` on the ones that changed (for the
 * pre-commit hook).
 */
function main(args: string[]): void {
  const updates = syncLockfileVersions(readIfPresent);
  const changed = Object.keys(updates);

  if (changed.length === 0) {
    return;
  }

  if (args.includes('--check')) {
    console.error(`Lockfile versions are out of sync with package.json: ${changed.join(', ')}`);
    console.error('Run `npm run lockfiles:sync`, then commit the result.');
    process.exit(1);
  }

  for (const [lockfile, content] of Object.entries(updates)) {
    writeFileSync(lockfile, content);
  }
  if (args.includes('--stage')) {
    execFileSync('git', ['add', '--', ...changed]);
  }
  console.log(`Synced lockfile versions with package.json: ${changed.join(', ')}`);
}

if (process.argv[1]?.endsWith('sync-lockfile-versions.ts')) {
  main(process.argv.slice(2));
}
