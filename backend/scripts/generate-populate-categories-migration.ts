#!/usr/bin/env node
/**
 * Generate a migration SQL file to populate categories from markdown files
 *
 * This script reads all markdown files in shared/data/murphys-laws/
 * and generates a safe migration that:
 * - Inserts categories with conflict handling (won't duplicate existing categories)
 * - Uses slug as unique identifier
 * - Preserves all existing data in the database
 *
 * Usage:
 *   tsx scripts/generate-populate-categories-migration.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, '../shared/data/murphys-laws');
const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeSql(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && p.endsWith('.md')) out.push(p);
    }
  }
  await walk(dir);
  return out.sort();
}

function getNextMigrationNumber(): string {
  try {
    const files = execFileSync('ls', [MIGRATIONS_DIR], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) return '009';

    const lastFile = files[files.length - 1];
    const match = /^(\d+)_/.exec(lastFile);

    if (match) {
      const num = parseInt(match[1], 10);
      return String(num + 1).padStart(3, '0');
    }

    return '009';
  } catch {
    return '009';
  }
}

interface CategoryRow {
  slug: string;
  title: string;
  source_file_path: string;
}

function generateMigration(categories: CategoryRow[]): string {
  const timestamp = new Date().toISOString();
  const lines = [
    '-- Populate categories table from markdown files',
    `-- Generated: ${timestamp}`,
    `-- Categories to add: ${categories.length}`,
    '',
    'BEGIN TRANSACTION;',
    ''
  ];

  for (const cat of categories) {
    lines.push(`-- Add category: ${cat.title}`);
    lines.push(`INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)`);
    lines.push(`VALUES (${escapeSql(cat.slug)}, ${escapeSql(cat.title)}, ${escapeSql(cat.source_file_path)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
    lines.push(`ON CONFLICT(slug) DO UPDATE SET`);
    lines.push(`  title = excluded.title,`);
    lines.push(`  source_file_path = excluded.source_file_path,`);
    lines.push(`  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`);
    lines.push('');
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log(`Reading markdown files from: ${SOURCE_DIR}`);
  const files = await listMarkdownFiles(SOURCE_DIR);
  console.log(`Found ${files.length} markdown files`);

  const categories = await Promise.all(
    files.map(async (file) => {
      const basename = path.basename(file, '.md');
      const rel = path.relative(ROOT, file);
      const slug = slugify(basename);

      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      const titleLine = lines.find((l) => l.trim().startsWith('#'));
      const title = titleLine
        ? titleLine.replace(/^#\s+/, '').trim()
        : basename;

      return { slug, title, source_file_path: rel };
    })
  );

  const migrationSql = generateMigration(categories);

  const migrationNumber = getNextMigrationNumber();
  const filename = `${migrationNumber}_populate_categories.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  await fs.writeFile(filepath, migrationSql, 'utf8');

  console.log(`\nMigration file generated: ${filename}`);
  console.log(`   Location: ${filepath}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`\nTo apply this migration, run:`);
  console.log(`   npm run migrate`);
  console.log(`\nOr it will run automatically when you push to main via GitHub Actions.`);
}

main().catch((err) => {
  console.error('Error generating migration:', err);
  process.exit(1);
});
