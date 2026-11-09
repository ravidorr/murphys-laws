import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_PATH_ENV, resolveDatabasePath } from '../../src/utils/database-path.ts';

describe('resolveDatabasePath', () => {
  const fallback = '/srv/murphys/backend/murphys.db';
  let directory: string;
  let database: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'database-path-'));
    database = join(directory, 'copy.db');
    writeFileSync(database, 'not empty');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('names the environment variable the deploy and the build script set', () => {
    expect(DATABASE_PATH_ENV).toBe('MURPHYS_DB_PATH');
  });

  it('keeps the default file when the variable is unset', () => {
    expect(resolveDatabasePath(fallback, {})).toBe(fallback);
  });

  it('keeps the default file when the variable is empty or only whitespace', () => {
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: '' })).toBe(fallback);
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: '  \n' })).toBe(fallback);
  });

  it('uses the file the variable names', () => {
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: database })).toBe(database);
  });

  it('resolves a relative path against the working directory and ignores surrounding whitespace', () => {
    const relativePath = relative(process.cwd(), database);
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: ` ${relativePath} ` })).toBe(resolve(relativePath));
  });

  it('refuses a missing file, an empty file and a directory instead of letting SQLite create a database', () => {
    const empty = join(directory, 'empty.db');
    writeFileSync(empty, '');
    const folder = join(directory, 'folder');
    mkdirSync(folder);
    for (const path of [join(directory, 'missing.db'), empty, folder]) {
      expect(() => resolveDatabasePath(fallback, { MURPHYS_DB_PATH: path })).toThrow(/existing, non-empty database file/);
    }
  });

  it('reads process.env by default', () => {
    const saved = process.env.MURPHYS_DB_PATH;
    try {
      delete process.env.MURPHYS_DB_PATH;
      expect(resolveDatabasePath(fallback)).toBe(fallback);
      process.env.MURPHYS_DB_PATH = database;
      expect(resolveDatabasePath(fallback)).toBe(database);
    } finally {
      if (saved === undefined) delete process.env.MURPHYS_DB_PATH;
      else process.env.MURPHYS_DB_PATH = saved;
    }
  });
});
