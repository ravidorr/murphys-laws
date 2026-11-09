import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../scripts/migrate.ts';

const backendDir = resolve(import.meta.dirname, '..', '..');
const migrationCount = readdirSync(join(backendDir, 'db', 'migrations')).filter((f) => f.endsWith('.sql')).length;

describe('scripts/migrate.ts', () => {
  let directory: string;
  let dbFile: string;

  const appliedCount = (): number => {
    const db = new Database(dbFile, { readonly: true });
    try {
      return (db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n;
    } finally {
      db.close();
    }
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'migrate-test-'));
    dbFile = join(directory, 'copy.db');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('migrates the file it is given, and a second run finds nothing to do', () => {
    migrate(dbFile);
    expect(appliedCount()).toBe(migrationCount);

    migrate(dbFile);
    expect(appliedCount()).toBe(migrationCount);
    expect(console.log).toHaveBeenCalledWith('\nDatabase is up to date. No migrations to apply.');
  });

  it('migrates the file named by MURPHYS_DB_PATH when it runs as a script, and leaves backend/murphys.db alone', () => {
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
      cwd: backendDir,
      env: { ...process.env, MURPHYS_DB_PATH: dbFile },
      encoding: 'utf8',
    });
    expect(output).toContain(`Applied ${migrationCount} migration(s).`);
    expect(appliedCount()).toBe(migrationCount);
  });

  it('does not touch any database when the file is only imported', () => {
    execFileSync(process.execPath, ['--import', 'tsx', '--eval', "await import('./scripts/migrate.ts')"], {
      cwd: backendDir,
      env: { ...process.env, MURPHYS_DB_PATH: dbFile },
      encoding: 'utf8',
    });
    expect(existsSync(dbFile)).toBe(false);
  });
});
