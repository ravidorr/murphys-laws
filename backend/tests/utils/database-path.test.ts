import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATABASE_PATH_ENV, resolveDatabasePath } from '../../src/utils/database-path.ts';

describe('resolveDatabasePath', () => {
  const fallback = '/srv/murphys/backend/murphys.db';

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
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: '/tmp/copy/murphys.db' })).toBe('/tmp/copy/murphys.db');
  });

  it('resolves a relative path against the working directory and ignores surrounding whitespace', () => {
    expect(resolveDatabasePath(fallback, { MURPHYS_DB_PATH: ' copy/murphys.db ' })).toBe(resolve('copy/murphys.db'));
  });

  it('reads process.env by default', () => {
    const saved = process.env.MURPHYS_DB_PATH;
    try {
      delete process.env.MURPHYS_DB_PATH;
      expect(resolveDatabasePath(fallback)).toBe(fallback);
      process.env.MURPHYS_DB_PATH = '/tmp/from-env.db';
      expect(resolveDatabasePath(fallback)).toBe('/tmp/from-env.db');
    } finally {
      if (saved === undefined) delete process.env.MURPHYS_DB_PATH;
      else process.env.MURPHYS_DB_PATH = saved;
    }
  });
});
