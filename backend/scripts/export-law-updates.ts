#!/usr/bin/env node
/**
 * Export law content updates as a migration SQL file
 *
 * This script compares specific laws between local and production databases
 * and generates a migration file that updates only title and text fields,
 * preserving all voting data, timestamps, and other metadata.
 *
 * Usage:
 *   tsx scripts/export-law-updates.ts <law_id1> <law_id2> ...
 *
 * Example:
 *   tsx scripts/export-law-updates.ts 7 42 123
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.cwd(), 'murphys.db');

function getSql(sql: string): string {
  try {
    return execFileSync('sqlite3', [DB_PATH, '-json', sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

function escapeSql(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function generateMigration(lawIds: string[]): string {
  if (!lawIds || lawIds.length === 0) {
    console.error('Error: Please provide at least one law ID');
    console.error('Usage: tsx scripts/export-law-updates.ts <law_id1> <law_id2> ...');
    process.exit(1);
  }

  const statements: string[] = [];
  statements.push('-- Data migration: Update law content');
  statements.push('-- Generated: ' + new Date().toISOString());
  statements.push('-- Laws updated: ' + lawIds.join(', '));
  statements.push('');
  statements.push('BEGIN TRANSACTION;');
  statements.push('');

  for (const lawId of lawIds) {
    const result = getSql(`SELECT id, title, text FROM laws WHERE id = ${parseInt(lawId, 10)};`);

    if (!result) {
      console.warn(`Warning: Law ID ${lawId} not found in database`);
      continue;
    }

    const laws = JSON.parse(result) as Array<{ id: number; title: string | null; text: string }>;
    if (laws.length === 0) {
      console.warn(`Warning: Law ID ${lawId} not found in database`);
      continue;
    }

    const law = laws[0];

    statements.push(`-- Update law #${law.id}`);
    statements.push(
      `UPDATE laws SET ` +
      `title = ${escapeSql(law.title)}, ` +
      `text = ${escapeSql(law.text)}, ` +
      `updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ` +
      `WHERE id = ${law.id};`
    );
    statements.push('');

    console.log(`Added law #${law.id}: ${law.title ?? '(no title)'}`);
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

function getNextMigrationNumber(): string {
  const migrationsDir = resolve(process.cwd(), 'db', 'migrations');
  try {
    const files = execFileSync('ls', [migrationsDir], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) return '001';

    const lastFile = files[files.length - 1];
    const match = /^(\d+)_/.exec(lastFile);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return String(num).padStart(3, '0');
    }
  } catch {
    // Directory doesn't exist or error reading
  }
  return '002';
}

const lawIds = process.argv.slice(2);
const migrationSql = generateMigration(lawIds);
const migrationNumber = getNextMigrationNumber();
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const filename = `${migrationNumber}_update_law_content_${timestamp}.sql`;
const filepath = resolve(process.cwd(), 'db', 'migrations', filename);

writeFileSync(filepath, migrationSql);

console.log('\nMigration file created:');
console.log(`  ${filepath}`);
console.log('\nTo apply this migration in production:');
console.log('  npm run migrate');
