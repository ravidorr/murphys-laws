#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

function runSql(sql) {
  try {
    execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' });
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

function getSql(sql) {
  try {
    return execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

// Create migrations table if it doesn't exist
function initMigrationsTable() {
  runSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Get list of applied migrations
function getAppliedMigrations() {
  const result = getSql('SELECT filename FROM schema_migrations ORDER BY filename;');
  return result ? result.split('\n').filter(Boolean) : [];
}

// Apply a migration file
function applyMigration(filename) {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filepath, 'utf8');

  console.log(`Applying migration: ${filename}`);

  // Run the migration SQL
  try {
    execFileSync('sqlite3', [DB_PATH], { input: sql, encoding: 'utf8' });
  } catch (err) {
    throw new Error(`Failed to apply ${filename}: ${err.message}`);
  }

  // Record that this migration was applied
  runSql(`INSERT INTO schema_migrations (filename) VALUES ('${filename}');`);

  console.log(`✓ Applied: ${filename}`);
}

// Main migration runner
function migrate() {
  console.log('Running database migrations...\n');

  // Initialize migrations tracking table
  initMigrationsTable();

  // Get already applied migrations
  const applied = getAppliedMigrations();
  console.log(`Applied migrations: ${applied.length}`);

  // Get all migration files
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Total migration files: ${files.length}\n`);

  // Apply pending migrations
  let appliedCount = 0;
  for (const file of files) {
    if (!applied.includes(file)) {
      applyMigration(file);
      appliedCount++;
    }
  }

  if (appliedCount === 0) {
    console.log('\n✓ Database is up to date. No migrations to apply.');
  } else {
    console.log(`\n✓ Applied ${appliedCount} migration(s).`);
  }
}

migrate();
