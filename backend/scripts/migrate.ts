#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

function runSql(sql: string): void {
  try {
    execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

function getSql(sql: string): string {
  try {
    return execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

function initMigrationsTable(): void {
  runSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getAppliedMigrations(): string[] {
  const result = getSql('SELECT filename FROM schema_migrations ORDER BY filename;');
  return result ? result.split('\n').filter(Boolean) : [];
}

function applyMigration(filename: string): void {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filepath, 'utf8');

  console.log(`Applying migration: ${filename}`);

  try {
    execFileSync('sqlite3', [DB_PATH], { input: sql, encoding: 'utf8' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to apply ${filename}: ${message}`, { cause: err });
  }

  runSql(`INSERT INTO schema_migrations (filename) VALUES ('${filename}');`);

  console.log(`Applied: ${filename}`);
}

function migrate(): void {
  console.log('Running database migrations...\n');

  initMigrationsTable();

  const applied = getAppliedMigrations();
  console.log(`Applied migrations: ${applied.length}`);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Total migration files: ${files.length}\n`);

  let appliedCount = 0;
  for (const file of files) {
    if (!applied.includes(file)) {
      applyMigration(file);
      appliedCount++;
    }
  }

  if (appliedCount === 0) {
    console.log('\nDatabase is up to date. No migrations to apply.');
  } else {
    console.log(`\nApplied ${appliedCount} migration(s).`);
  }
}

migrate();
