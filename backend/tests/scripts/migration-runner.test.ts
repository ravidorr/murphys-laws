import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../scripts/migration-runner.ts';

// Runs the real sqlite3 CLI against a temporary database and temporary migration folders.
describe('scripts/migration-runner.ts', () => {
  let directory: string;
  let migrationsDir: string;
  let dbFile: string;
  const originalPath = process.env.PATH;

  const SETUP = '001_setup.sql';
  const SECOND = '002_second.sql';
  const THIRD = '003_third.sql';

  const write = (name: string, sql: string): void => writeFileSync(join(migrationsDir, name), sql);

  const query = <T>(sql: string): T[] => {
    const db = new Database(dbFile, { readonly: true });
    try {
      return db.prepare(sql).all() as T[];
    } finally {
      db.close();
    }
  };
  const recorded = (): string[] => query<{ filename: string }>('SELECT filename FROM schema_migrations ORDER BY filename').map((r) => r.filename);
  const tables = (): string[] => query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name);
  const values = (): number[] => query<{ a: number }>('SELECT a FROM t ORDER BY a').map((r) => r.a);

  /** Runs migrate() and returns the error it throws; fails the test if it does not throw. */
  const failure = (): Error => {
    try {
      migrate(dbFile, migrationsDir);
    } catch (err) {
      return err as Error;
    }
    throw new Error('migrate() did not throw');
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'migration-runner-test-'));
    migrationsDir = join(directory, 'migrations');
    mkdirSync(migrationsDir);
    dbFile = join(directory, 'test.db');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    write(SETUP, 'CREATE TABLE t (a INTEGER UNIQUE);\n');
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  describe('success', () => {
    it('applies every migration in order, with or without its own transaction, and records each', () => {
      write(SECOND, '-- own transaction\n\nBEGIN TRANSACTION;\nINSERT INTO t VALUES (1);\nINSERT INTO t VALUES (2);\nCOMMIT;\n\n-- end\n');
      write(THIRD, 'INSERT INTO t VALUES (3);\nINSERT INTO t VALUES (4);\n');

      migrate(dbFile, migrationsDir);

      expect(values()).toEqual([1, 2, 3, 4]);
      expect(recorded()).toEqual([SETUP, SECOND, THIRD]);
      expect(console.log).toHaveBeenCalledWith('\nApplied 3 migration(s).');
    });

    it('handles a trigger body, a semicolon in a comment and a file name with an apostrophe', () => {
      write(
        "002_it's_a_trigger.sql",
        'CREATE TABLE log (a INTEGER);\nCREATE TRIGGER t_log AFTER INSERT ON t BEGIN INSERT INTO log VALUES (NEW.a); END;\nINSERT INTO t VALUES (5);\nINSERT INTO t VALUES (6); -- a; b\n',
      );

      migrate(dbFile, migrationsDir);

      expect(query('SELECT a FROM log ORDER BY a')).toEqual([{ a: 5 }, { a: 6 }]);
      expect(recorded()).toEqual([SETUP, "002_it's_a_trigger.sql"]);
    });

    it('does not mistake a line of quoted text that starts with the word commit for a COMMIT', () => {
      write(SECOND, "INSERT INTO t VALUES (1);\nCREATE TABLE notes (body TEXT);\nINSERT INTO notes VALUES ('first line\ncommit this to memory\nrollback is not a statement here');\n");

      migrate(dbFile, migrationsDir);

      expect(query('SELECT body FROM notes')).toEqual([{ body: 'first line\ncommit this to memory\nrollback is not a statement here' }]);
      expect(recorded()).toEqual([SETUP, SECOND]);
    });

    it('does nothing the second time', () => {
      migrate(dbFile, migrationsDir);
      migrate(dbFile, migrationsDir);

      expect(recorded()).toEqual([SETUP]);
      expect(console.log).toHaveBeenCalledWith('\nDatabase is up to date. No migrations to apply.');
    });
  });

  describe('a failing statement in the middle of a migration', () => {
    it('with its own transaction: nothing after it runs, no COMMIT, not recorded, later migrations not tried', () => {
      write(SECOND, 'BEGIN;\nINSERT INTO t VALUES (10);\nINSERT INTO t VALUES (10);\nCREATE TABLE after_failure (x);\nCOMMIT;\n');
      write(THIRD, 'CREATE TABLE never_attempted (x);\n');

      const error = failure();

      // Names the migration, the line and the statement that failed, and says what became of the migration.
      expect(error.message).toContain(`Migration ${SECOND} failed near line 3`);
      expect(error.message).toContain('UNIQUE constraint failed: t.a');
      expect(error.message).toContain('Failing statement:\nINSERT INTO t VALUES (10);');
      expect(error.message).toContain('rolled back');
      expect(error.message).toContain('not recorded');
      // The statement before the failure was rolled back (no COMMIT ran), and the one after it never ran.
      expect(values()).toEqual([]);
      expect(tables()).not.toContain('after_failure');
      expect(tables()).not.toContain('never_attempted');
      // Only the migration that succeeded is recorded.
      expect(recorded()).toEqual([SETUP]);
    });

    it('without a transaction of its own: the statements before it are rolled back too', () => {
      write(SECOND, 'INSERT INTO t VALUES (20);\nINSERT INTO t VALUES (20);\nINSERT INTO t VALUES (21);\n');

      const error = failure();

      expect(error.message).toContain(`Migration ${SECOND} failed near line 2`);
      expect(values()).toEqual([]);
      expect(recorded()).toEqual([SETUP]);
    });

    it('quotes a statement that spans several lines from its first line', () => {
      write(SECOND, 'INSERT INTO t VALUES (30);\nINSERT INTO t\n  VALUES\n  (30);\n');

      expect(failure().message).toContain('Failing statement:\nINSERT INTO t\n  VALUES\n  (30);');
    });

    it('cuts the quoted statement when it never ends', () => {
      const rows = Array.from({ length: 20 }, (_, i) => `  (${i + 100}),`).join('\n');
      write(SECOND, `INSERT INTO t VALUES (1);\nINSERT INTO nowhere VALUES\n${rows}\n  (1);\n`);

      const message = failure().message;

      expect(message).toContain('no such table: nowhere');
      expect(message).toContain('  (109),');
      expect(message).not.toContain('  (115),');
    });

    it('reports a failure on a very large migration, where sqlite3 stops reading early', () => {
      const padding = Array.from({ length: 4000 }, (_, i) => `INSERT INTO t VALUES (${i + 1000}); -- padding padding padding padding padding`);
      write(SECOND, ['BEGIN;', 'INSERT INTO t VALUES (1);', 'INSERT INTO t VALUES (1);', ...padding, 'COMMIT;', ''].join('\n'));

      expect(failure().message).toContain(`Migration ${SECOND} failed near line 3`);
      expect(values()).toEqual([]);
      expect(recorded()).toEqual([SETUP]);
    });

    it('is retried by the next run, which applies it once and records it once', () => {
      write(SECOND, 'BEGIN;\nINSERT INTO t VALUES (10);\nINSERT INTO t VALUES (10);\nCOMMIT;\n');
      write(THIRD, 'INSERT INTO t VALUES (3);\n');
      failure();
      expect(recorded()).toEqual([SETUP]);

      // The first migration is not run again (CREATE TABLE t has no IF NOT EXISTS), and the fixed one is.
      write(SECOND, 'BEGIN;\nINSERT INTO t VALUES (10);\nINSERT INTO t VALUES (11);\nCOMMIT;\n');
      migrate(dbFile, migrationsDir);

      expect(values()).toEqual([3, 10, 11]);
      expect(recorded()).toEqual([SETUP, SECOND, THIRD]);
      expect(console.log).toHaveBeenCalledWith('\nApplied 2 migration(s).');
    });

    it('fails again, the same way, when nothing was fixed', () => {
      write(SECOND, 'INSERT INTO t VALUES (1);\nINSERT INTO t VALUES (1);\n');

      const first = failure().message;
      const second = failure().message;

      expect(second).toBe(first);
      expect(values()).toEqual([]);
      expect(recorded()).toEqual([SETUP]);
    });
  });

  describe('a migration that cannot be run safely', () => {
    const refused = (sql: string, why: RegExp): void => {
      write(SECOND, sql);

      expect(() => migrate(dbFile, migrationsDir)).toThrow(why);

      // Nothing ran, and the migration is not recorded as applied.
      expect(values()).toEqual([]);
      expect(recorded()).toEqual([SETUP]);
    };

    it('is refused when it starts a transaction and never commits it, instead of being recorded as applied', () => {
      refused('BEGIN;\nINSERT INTO t VALUES (1);\n-- no COMMIT\n', /002_second\.sql: it starts its own transaction, so it must have one COMMIT/);
    });

    it('is refused when it commits in the middle of its own transaction', () => {
      refused('BEGIN;\nINSERT INTO t VALUES (1);\nCOMMIT;\nINSERT INTO t VALUES (2);\nCOMMIT;\n', /must have one COMMIT/);
    });

    it('is refused when it rolls back inside its own transaction', () => {
      refused('BEGIN;\nINSERT INTO t VALUES (1);\nROLLBACK;\nCOMMIT;\n', /must have one COMMIT/);
    });

    it('is refused when it has no BEGIN but commits, which would end the transaction the runner wraps it in', () => {
      refused('INSERT INTO t VALUES (1);\nCOMMIT;\nINSERT INTO t VALUES (2);\n', /it has no BEGIN, so the runner wraps it/);
    });
  });

  describe('when sqlite3 itself cannot be used', () => {
    it('names the operating system error when sqlite3 is not installed', () => {
      process.env.PATH = directory; // holds no sqlite3

      expect(failure().message).toMatch(/^SQL Error: .*ENOENT/);
    });

    describe('with a stand-in sqlite3', () => {
      const realSqlite3 = execFileSync('which', ['sqlite3'], { encoding: 'utf8' }).trim();

      const standIn = (script: string): void => {
        const bin = join(directory, 'bin');
        mkdirSync(bin);
        writeFileSync(join(bin, 'sqlite3'), `#!/bin/sh\n${script}\n`);
        chmodSync(join(bin, 'sqlite3'), 0o755);
        process.env.PATH = `${bin}:${originalPath}`;
      };

      it('reports a failing migration run that names no line', () => {
        // Passes the setup queries through and fails the migration run (two arguments: -bail and the file).
        standIn(`if [ $# -eq 2 ]; then echo 'disk I/O error' >&2; exit 5; fi\nexec ${realSqlite3} "$@"`);

        const message = failure().message;

        expect(message).toContain(`Migration ${SETUP} failed: disk I/O error\n`);
        expect(message).not.toContain('Failing statement');
        expect(recorded()).toEqual([]);
      });

      it('reports the signal when sqlite3 is killed, and records nothing', () => {
        standIn(`if [ $# -eq 2 ]; then kill -9 $$; fi\nexec ${realSqlite3} "$@"`);

        const message = failure().message;

        expect(message).toContain(`Migration ${SETUP} failed: sqlite3 was stopped by SIGKILL`);
        expect(message).toContain('sqlite3 did not finish');
        expect(message).not.toContain('nothing after it ran');
        expect(recorded()).toEqual([]);
      });

      it('reports the exit status when sqlite3 fails without a message', () => {
        standIn('exit 7');

        expect(failure().message).toBe('SQL Error: sqlite3 exited with status 7');
      });

      // A migration far larger than the pipe buffer, so writing it to a sqlite3 that never reads it always fails
      // with EPIPE. What happened to sqlite3 (the signal, the exit status) must still be what is reported: with a
      // small migration whether the write fails depends on whether sqlite3 died before or after it, a race.
      describe('when the write to sqlite3 fails with EPIPE', () => {
        const hugeMigration = (): void => write(SETUP, `CREATE TABLE t (a INTEGER UNIQUE);\n${Array.from({ length: 20000 }, (_, i) => `INSERT INTO t VALUES (${i + 1000});`).join('\n')}\n`);
        /** Fails the migration run (two arguments) the way `behaviour` says, and passes the setup queries through. */
        const unreadingSqlite3 = (behaviour: string): void => {
          hugeMigration();
          standIn(`if [ $# -eq 2 ]; then ${behaviour}; fi\nexec ${realSqlite3} "$@"`);
        };
        const causeCode = (error: Error): unknown => (error.cause as NodeJS.ErrnoException | undefined)?.code;

        it('reports the signal that stopped sqlite3, not the EPIPE', () => {
          unreadingSqlite3('kill -9 $$');

          const error = failure();

          expect(causeCode(error)).toBe('EPIPE'); // the write did fail; it is kept as the cause, not the message
          expect(error.message).toContain(`Migration ${SETUP} failed: sqlite3 was stopped by SIGKILL`);
          expect(error.message).not.toContain('EPIPE');
          expect(recorded()).toEqual([]);
        });

        it('reports the exit status of sqlite3, not the EPIPE', () => {
          unreadingSqlite3('exit 7');

          const error = failure();

          expect(causeCode(error)).toBe('EPIPE');
          expect(error.message).toContain(`Migration ${SETUP} failed: sqlite3 exited with status 7`);
          expect(error.message).not.toContain('EPIPE');
          expect(recorded()).toEqual([]);
        });

        it('says sqlite3 left before reading it all, and does not claim a rollback, when it exits 0', () => {
          unreadingSqlite3('exit 0');

          const error = failure();

          expect(causeCode(error)).toBe('EPIPE');
          expect(error.message).toContain(`Migration ${SETUP} failed: sqlite3 exited before it had read the whole migration`);
          expect(error.message).toContain('sqlite3 did not finish');
          expect(error.message).not.toContain('its transaction was rolled back');
          expect(recorded()).toEqual([]);
        });
      });

      it('names the output limit, not the SIGTERM that Node kills sqlite3 with, when it prints too much', () => {
        standIn(`if [ $# -eq 2 ]; then head -c 2000000 /dev/zero | tr '\\0' x; sleep 5; fi\nexec ${realSqlite3} "$@"`);

        const message = failure().message;

        expect(message).toContain(`Migration ${SETUP} failed: spawnSync sqlite3 ENOBUFS`);
        expect(message).not.toContain('SIGTERM');
        expect(recorded()).toEqual([]);
      });
    });
  });
});
