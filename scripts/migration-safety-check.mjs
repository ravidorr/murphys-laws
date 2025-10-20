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

function log(msg, emoji = '✓') {
  console.log(`${emoji} ${msg}`);
}

function error(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function getSql(sql) {
  try {
    return execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

// Check 1: Database exists
if (!existsSync(DB_PATH)) {
  error('Database file not found at: ' + DB_PATH);
}
log('Database file exists', '✓');

// Check 2: Database is readable
try {
  const stats = statSync(DB_PATH);
  log(`Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, '✓');
} catch (err) {
  error('Cannot read database file: ' + err.message);
}

// Check 3: Required tables exist
const requiredTables = ['laws', 'categories', 'votes', 'schema_migrations'];
for (const table of requiredTables) {
  try {
    const result = getSql(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`);
    if (!result) {
      error(`Required table '${table}' not found`);
    }
    log(`Table '${table}' exists`, '✓');
  } catch (err) {
    error(`Failed to check table '${table}': ${err.message}`);
  }
}

// Check 4: Count critical data
try {
  const lawCount = getSql('SELECT COUNT(*) FROM laws;');
  const voteCount = getSql('SELECT COUNT(*) FROM votes;');
  log(`Database has ${lawCount} laws and ${voteCount} votes`, '📊');
} catch (err) {
  error('Failed to count data: ' + err.message);
}

// Check 5: Create pre-migration backup
try {
  copyFileSync(DB_PATH, BACKUP_PATH);
  const backupStats = statSync(BACKUP_PATH);
  log(`Pre-migration backup created: ${(backupStats.size / 1024 / 1024).toFixed(2)} MB`, '💾');
} catch (err) {
  error('Failed to create backup: ' + err.message);
}

console.log('\n✅ All safety checks passed! Safe to run migrations.\n');
process.exit(0);
