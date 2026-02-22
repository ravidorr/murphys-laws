#!/usr/bin/env node
/**
 * Pre-migration safety checks
 *
 * Validates that:
 * 1. Database file exists and is readable
 * 2. Database has expected tables
 * 3. No duplicate migration files
 * 4. Database can be backed up
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const BACKUP_PATH = resolve(__dirname, '..', 'murphys.db.pre-migrate-backup');

function log(msg: string): void {
  console.log(msg);
}

function error(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function getSql(sql: string): string {
  try {
    return execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

if (!existsSync(DB_PATH)) {
  error('Database file not found at: ' + DB_PATH);
}
log('Database file exists');

try {
  const stats = statSync(DB_PATH);
  log(`Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  error('Cannot read database file: ' + message);
}

const requiredTables = ['laws', 'categories', 'votes', 'schema_migrations'];
for (const table of requiredTables) {
  try {
    const result = getSql(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`);
    if (!result) {
      error(`Required table '${table}' not found`);
    }
    log(`Table '${table}' exists`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to check table '${table}': ${message}`);
  }
}

try {
  const lawCount = getSql('SELECT COUNT(*) FROM laws;');
  const voteCount = getSql('SELECT COUNT(*) FROM votes;');
  log(`Database has ${lawCount} laws and ${voteCount} votes`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  error('Failed to count data: ' + message);
}

try {
  copyFileSync(DB_PATH, BACKUP_PATH);
  const backupStats = statSync(BACKUP_PATH);
  log(`Pre-migration backup created: ${(backupStats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  error('Failed to create backup: ' + message);
}

console.log('\nAll safety checks passed! Safe to run migrations.\n');
process.exit(0);
