import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

/** Most lines of the failing statement quoted in an error message. */
const MAX_STATEMENT_LINES = 12;

interface SqliteResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  spawnError?: Error;
}

/**
 * Run the sqlite3 CLI against `dbPath` with `-bail`, so the first failing statement stops the run (without it the
 * CLI reports the error and carries on, through a closing COMMIT). The SQL goes in on stdin, or as one argument.
 * The exit status and stderr are captured: sqlite3 can exit early, and a large input then fails to write with
 * EPIPE, which says nothing about the real error.
 */
function runSqlite(dbPath: string, { input, sql }: { input?: string; sql?: string }): SqliteResult {
  const args = ['-bail', dbPath, ...(sql === undefined ? [] : [sql])];
  const result = spawnSync('sqlite3', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return { status: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', spawnError: result.error };
}

function succeeded(result: SqliteResult): boolean {
  return result.status === 0;
}

/** Why a run failed: sqlite3's own stderr when it printed one, otherwise what the operating system reported. */
function failureReason(result: SqliteResult): string {
  const stderr = result.stderr.trim();
  if (stderr) return stderr;
  if (result.spawnError) return result.spawnError.message;
  if (result.signal) return `sqlite3 was stopped by ${result.signal}`;
  return `sqlite3 exited with status ${String(result.status)}`;
}

function runSql(dbPath: string, sql: string): string {
  const result = runSqlite(dbPath, { sql });
  if (!succeeded(result)) {
    throw new Error(`SQL Error: ${failureReason(result)}`, { cause: result.spawnError });
  }
  return result.stdout.trim();
}

function initMigrationsTable(dbPath: string): void {
  runSql(dbPath, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getAppliedMigrations(dbPath: string): string[] {
  const result = runSql(dbPath, 'SELECT filename FROM schema_migrations ORDER BY filename;');
  return result ? result.split('\n').filter(Boolean) : [];
}

const isBlankOrComment = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('--');
};

function recordStatement(filename: string): string {
  return `INSERT INTO schema_migrations (filename) VALUES ('${filename.replaceAll("'", "''")}');`;
}

/**
 * The text piped into sqlite3 for one migration. The migration and its row in `schema_migrations` are committed
 * together, so a run cannot leave one without the other. Everything before the closing statements keeps its line
 * number, so sqlite3's "near line N" points at the migration file.
 *
 * - A file that starts with its own BEGIN owns its transaction: the record goes in just before its final COMMIT.
 *   It must have exactly one COMMIT, as its last statement. Otherwise sqlite3 could end the session with the
 *   transaction still open, roll it back and exit 0 (the run would report success for a migration that did
 *   nothing, and retry it on every run), or commit part of the file and carry on outside a transaction.
 * - Any other file is wrapped in a transaction here, so a failure cannot leave its earlier statements applied.
 *   It must not COMMIT or ROLLBACK itself, which would end that transaction early. (A BEGIN further down fails
 *   loudly with "cannot start a transaction within a transaction".)
 *
 * Statements are recognised by line, which is how the migrations in this repo are written: a COMMIT or ROLLBACK that shares a
 * line with another statement is not seen here, and still fails the run at the closing COMMIT. A line of quoted
 * text that merely starts with the word "commit" is not mistaken for one, because it must end in a semicolon.
 */
function buildMigrationInput(filename: string, sql: string): string {
  const lines = sql.split('\n');
  const first = lines.find((line) => !isBlankOrComment(line));
  const record = recordStatement(filename);
  const refuse = (why: string): Error => new Error(`Cannot apply ${filename}: ${why} Nothing was run and nothing was recorded.`);
  const endsTransaction = lines.filter((line) => /^\s*(COMMIT|ROLLBACK)(\s+TRANSACTION)?\s*;/i.test(line));

  if (first !== undefined && /^\s*BEGIN\b/i.test(first)) {
    let last = lines.length - 1;
    while (isBlankOrComment(lines[last]!)) last--; // stops at the BEGIN at the latest
    if (endsTransaction.length !== 1 || !/^\s*COMMIT(\s+TRANSACTION)?\s*;\s*(--.*)?$/i.test(lines[last]!)) {
      throw refuse('it starts its own transaction, so it must have one COMMIT, as its last statement, and no ROLLBACK.');
    }
    lines.splice(last, 0, record);
    return lines.join('\n');
  }

  if (endsTransaction.length > 0) {
    throw refuse('it has no BEGIN, so the runner wraps it in a transaction, and its COMMIT or ROLLBACK would end that early.');
  }
  return `BEGIN; ${sql}\n${record}\nCOMMIT;\n`;
}

/** The statement that starts on 1-based `line` of `sql`, up to its terminating semicolon (long ones are cut). */
function statementAt(sql: string, line: number): string {
  const lines = sql.split('\n').slice(line - 1);
  const shown: string[] = [];
  for (const text of lines) {
    shown.push(text);
    if (text.trimEnd().endsWith(';') || shown.length >= MAX_STATEMENT_LINES) break;
  }
  return shown.join('\n').trim();
}

function describeFailure(filename: string, sql: string, result: SqliteResult): string {
  const reason = failureReason(result);
  const line = /near line (\d+)/i.exec(reason);
  const where = line ? ` near line ${line[1]}` : '';
  const statement = line ? `\nFailing statement:\n${statementAt(sql, Number(line[1]))}\n` : '\n';
  // Only claim what is known: when sqlite3 exited by itself, -bail stopped it at the failure and it rolled the
  // open transaction back; when it was killed or never started, nothing is known to have run.
  const outcome =
    result.status === null
      ? 'sqlite3 did not finish, so the migration is not recorded in schema_migrations; an unfinished transaction is rolled back the next time the database is opened.'
      : 'sqlite3 stopped there: nothing after it ran and its transaction was rolled back, so the migration is not recorded in schema_migrations.';
  return `Migration ${filename} failed${where}: ${reason}${statement}${outcome}`;
}

function applyMigration(dbPath: string, migrationsDir: string, filename: string): void {
  const sql = readFileSync(join(migrationsDir, filename), 'utf8');
  const input = buildMigrationInput(filename, sql);

  console.log(`Applying migration: ${filename}`);

  const result = runSqlite(dbPath, { input });
  if (!succeeded(result)) {
    throw new Error(describeFailure(filename, sql, result), { cause: result.spawnError });
  }

  console.log(`Applied: ${filename}`);
}

/**
 * Apply every migration in `migrationsDir` (db/migrations by default) that `dbPath` has not recorded yet, oldest
 * first, and stop at the first one that fails: it is rolled back, not recorded, and nothing after it is attempted,
 * so running again retries it. Importing this file does nothing; scripts/migrate.ts is the entry point that always
 * calls it.
 */
export function migrate(dbPath: string, migrationsDir: string = MIGRATIONS_DIR): void {
  console.log('Running database migrations...\n');

  initMigrationsTable(dbPath);

  const applied = getAppliedMigrations(dbPath);
  console.log(`Applied migrations: ${applied.length}`);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Total migration files: ${files.length}\n`);

  let appliedCount = 0;
  for (const file of files) {
    if (!applied.includes(file)) {
      applyMigration(dbPath, migrationsDir, file);
      appliedCount++;
    }
  }

  if (appliedCount === 0) {
    console.log('\nDatabase is up to date. No migrations to apply.');
  } else {
    console.log(`\nApplied ${appliedCount} migration(s).`);
  }
}
