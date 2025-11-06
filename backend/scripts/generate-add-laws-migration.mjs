#!/usr/bin/env node
/**
 * Generate a migration SQL file to add new laws from laws_to_add.md
 *
 * This script parses laws_to_add.md and generates a safe migration that:
 * - Inserts new laws with conflict handling (won't duplicate existing laws)
 * - Uses first_seen_file_path and first_seen_line_number as unique identifiers
 * - Preserves all existing data in the database
 * - Sets status to 'published'
 *
 * Usage:
 *   node scripts/generate-add-laws-migration.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const LAWS_FILE = resolve(process.cwd(), 'laws_to_add.md');
const MIGRATIONS_DIR = resolve(process.cwd(), 'db', 'migrations');

function slugify(s) {
  if (!s) return null;
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseLawsFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const laws = [];
  
  let currentTitle = null;
  let currentText = null;
  let lineNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const actualLineNumber = i + 1;
    
    // Skip empty lines
    if (!line) {
      // If we have a title and text, save the law
      if (currentTitle && currentText) {
        laws.push({
          title: currentTitle,
          text: currentText,
          lineNumber: lineNumber
        });
        currentTitle = null;
        currentText = null;
      }
      continue;
    }
    
    // If we don't have a title yet, this line is the title
    if (!currentTitle) {
      currentTitle = line;
      lineNumber = actualLineNumber;
    } else if (!currentText) {
      // This line is the text/description
      currentText = line;
    } else {
      // We already have both, this might be continuation text
      currentText += ' ' + line;
    }
  }
  
  // Don't forget the last law if file doesn't end with empty line
  if (currentTitle && currentText) {
    laws.push({
      title: currentTitle,
      text: currentText,
      lineNumber: lineNumber
    });
  }
  
  return laws;
}

function getNextMigrationNumber() {
  try {
    const files = execFileSync('ls', [MIGRATIONS_DIR], { encoding: 'utf8' })
      .split('\n')
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) return '007';
    
    const lastFile = files[files.length - 1];
    const match = /^(\d+)_/.exec(lastFile);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return String(num).padStart(3, '0');
    }
  } catch {
    // Directory doesn't exist or error reading
  }
  return '007'; // Default
}

function generateMigration(laws) {
  if (laws.length === 0) {
    console.error('Error: No laws found in laws_to_add.md');
    process.exit(1);
  }
  
  const sourceFilePath = 'laws_to_add.md';
  const statements = [];
  
  statements.push('-- Data migration: Add new laws from laws_to_add.md');
  statements.push('-- Generated: ' + new Date().toISOString());
  statements.push(`-- Laws to add: ${laws.length}`);
  statements.push('');
  statements.push('BEGIN TRANSACTION;');
  statements.push('');
  
  for (const law of laws) {
    const slug = slugify(law.title);
    const title = law.title || null;
    const text = law.text;
    const lineNumber = law.lineNumber;
    
    statements.push(`-- Add law: ${title || '(no title)'}`);
    // Use INSERT OR IGNORE to handle both slug conflicts and file/line conflicts
    // If slug exists, set it to NULL; if file/line exists, skip entirely
    statements.push(
      `INSERT INTO laws (` +
      `slug, title, text, status, first_seen_file_path, first_seen_line_number, ` +
      `created_at, updated_at` +
      `) ` +
      `SELECT ` +
      `CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = ${escapeSql(slug)}) THEN NULL ELSE ${escapeSql(slug)} END, ` +
      `${escapeSql(title)}, ` +
      `${escapeSql(text)}, ` +
      `'published', ` +
      `${escapeSql(sourceFilePath)}, ` +
      `${lineNumber}, ` +
      `strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ` +
      `strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ` +
      `WHERE NOT EXISTS (` +
      `  SELECT 1 FROM laws ` +
      `  WHERE first_seen_file_path = ${escapeSql(sourceFilePath)} ` +
      `    AND first_seen_line_number = ${lineNumber}` +
      `);`
    );
    statements.push('');
  }
  
  statements.push('COMMIT;');
  return statements.join('\n');
}

// Main
console.log('Parsing laws_to_add.md...');
const laws = parseLawsFile(LAWS_FILE);
console.log(`Found ${laws.length} laws to add`);

const migrationSql = generateMigration(laws);
const migrationNumber = getNextMigrationNumber();
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const filename = `${migrationNumber}_add_laws_from_file_${timestamp}.sql`;
const filepath = resolve(MIGRATIONS_DIR, filename);

writeFileSync(filepath, migrationSql);

console.log('\n✓ Migration file created:');
console.log(`  ${filepath}`);
console.log(`\nThis migration will add ${laws.length} new laws.`);
console.log('\nSafety features:');
console.log('  - Uses ON CONFLICT DO NOTHING to prevent duplicates');
console.log('  - Uses first_seen_file_path and first_seen_line_number as unique identifiers');
console.log('  - Wrapped in a transaction (all or nothing)');
console.log('  - Will not modify existing laws');
console.log('\nTo apply this migration:');
console.log('  1. Review the migration file: ' + filename);
console.log('  2. Test locally: npm run migrate');
console.log('  3. Deploy to production: git add, commit, push (auto-applies via GitHub Actions)');

