#!/usr/bin/env node
/**
 * Show recently updated laws
 *
 * Usage:
 *   tsx scripts/show-recent-updates.ts [limit]
 *   npm run db:show-updates [limit]
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.cwd(), 'murphys.db');
const limit = parseInt(process.argv[2] ?? '10', 10);

function getSql(sql: string): string {
  try {
    return execFileSync('sqlite3', [DB_PATH, '-json', sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL Error: ${message}`, { cause: err });
  }
}

console.log(`\nRecently Updated Laws (last ${limit}):\n`);

const result = getSql(`
  SELECT
    id,
    title,
    SUBSTR(text, 1, 80) || CASE WHEN LENGTH(text) > 80 THEN '...' ELSE '' END as preview,
    updated_at,
    created_at
  FROM laws
  WHERE status = 'published'
  ORDER BY updated_at DESC
  LIMIT ${limit};
`);

if (!result) {
  console.log('No laws found.');
  process.exit(0);
}

interface LawRow {
  id: number;
  title: string | null;
  preview: string;
  updated_at: string;
  created_at: string;
}

const laws = JSON.parse(result) as LawRow[];

if (laws.length === 0) {
  console.log('No laws found.');
  process.exit(0);
}

laws.forEach((law) => {
  const wasEdited = law.updated_at > law.created_at;
  const marker = wasEdited ? 'EDITED' : '   new';

  console.log(`${marker} | ID: ${String(law.id).padStart(4, ' ')} | Updated: ${law.updated_at}`);
  console.log(`       | Title: ${law.title ?? '(no title)'}`);
  console.log(`       | Text: ${law.preview}`);
  console.log('');
});

console.log(`\nTo export these updates as a migration, run:`);
console.log(`npm run db:export-updates <id1> <id2> <id3> ...`);
console.log('');
