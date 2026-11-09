import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../scripts/migration-runner.ts';

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

  const runScript = (command: string, args: string[], cwd: string): string =>
    execFileSync(command, args, { cwd, env: { ...process.env, MURPHYS_DB_PATH: dbFile }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const existingDatabase = (): void => {
    const db = new Database(dbFile);
    db.exec('CREATE TABLE placeholder (id INTEGER)');
    db.close();
  };

  it('migrates the file named by MURPHYS_DB_PATH when run the way the deploy runs it (npm run migrate)', () => {
    existingDatabase();
    const output = runScript('npm', ['--prefix', backendDir, 'run', 'migrate'], resolve(backendDir, '..'));
    expect(output).toContain(`Applied ${migrationCount} migration(s).`);
    expect(appliedCount()).toBe(migrationCount);
  });

  it('always migrates, however the script is spelled (no extension, an absolute path)', () => {
    existingDatabase();
    expect(runScript(process.execPath, ['--import', 'tsx', 'scripts/migrate'], backendDir)).toContain(`Applied ${migrationCount} migration(s).`);
    expect(runScript(process.execPath, ['--import', 'tsx', join(backendDir, 'scripts', 'migrate.ts')], backendDir)).toContain('Database is up to date');
  });

  it('refuses a MURPHYS_DB_PATH that names no database, and creates nothing', () => {
    expect(() => runScript('npm', ['--prefix', backendDir, 'run', 'migrate'], resolve(backendDir, '..'))).toThrow(/existing, non-empty database file/);
    expect(existsSync(dbFile)).toBe(false);
  });

  it('does not touch any database when the runner is only imported', () => {
    runScript(process.execPath, ['--import', 'tsx', '--eval', "await import('./scripts/migration-runner.ts')"], backendDir);
    expect(existsSync(dbFile)).toBe(false);
  });
});
