import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

function runSql(dbPath: string, sql: string): void {
  try {
    execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

function getSql(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
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
  const result = getSql(dbPath, 'SELECT filename FROM schema_migrations ORDER BY filename;');
  return result ? result.split('\n').filter(Boolean) : [];
}

function applyMigration(dbPath: string, filename: string): void {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filepath, 'utf8');

  console.log(`Applying migration: ${filename}`);

  try {
    execFileSync('sqlite3', [dbPath], { input: sql, encoding: 'utf8' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to apply ${filename}: ${message}`, { cause: err });
  }

  runSql(dbPath, `INSERT INTO schema_migrations (filename) VALUES ('${filename}');`);

  console.log(`Applied: ${filename}`);
}

/**
 * Apply every migration in db/migrations that `dbPath` has not recorded yet. Importing this file does nothing;
 * scripts/migrate.ts is the entry point that always calls it.
 */
export function migrate(dbPath: string): void {
  console.log('Running database migrations...\n');

  initMigrationsTable(dbPath);

  const applied = getAppliedMigrations(dbPath);
  console.log(`Applied migrations: ${applied.length}`);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Total migration files: ${files.length}\n`);

  let appliedCount = 0;
  for (const file of files) {
    if (!applied.includes(file)) {
      applyMigration(dbPath, file);
      appliedCount++;
    }
  }

  if (appliedCount === 0) {
    console.log('\nDatabase is up to date. No migrations to apply.');
  } else {
    console.log(`\nApplied ${appliedCount} migration(s).`);
  }
}
