#!/usr/bin/env node
/**
 * Pre-select tomorrow's Law of the Day
 * This script should be run daily at midnight UTC via cron
 * It pre-calculates the law of the day so it's ready when users visit
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');

function runSqlJson(sql, params = []) {
  // Build the complete SQL with parameter binding
  let completeSql = sql;
  params.forEach((param) => {
    const value = typeof param === 'number' ? String(param) :
      param === null ? 'NULL' :
        `'${String(param).replace(/'/g, "''")}'`;
    completeSql = completeSql.replace('?', value);
  });

  try {
    const stdout = execFileSync('sqlite3', [DB_PATH, '-json', completeSql], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(stdout.trim() || '[]');
  } catch (error) {
    console.error('SQL Error:', error.message);
    throw error;
  }
}

function runSql(sql, params = []) {
  let completeSql = sql;
  params.forEach((param) => {
    const value = typeof param === 'number' ? String(param) :
      param === null ? 'NULL' :
        `'${String(param).replace(/'/g, "''")}'`;
    completeSql = completeSql.replace('?', value);
  });

  try {
    execFileSync('sqlite3', [DB_PATH, completeSql], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    console.error('SQL Error:', error.message);
    throw error;
  }
}

async function selectLawOfDay() {
  console.log('[Law of the Day] Starting selection process...');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  console.log(`[Law of the Day] Date: ${today}`);

  // Check if we already have a law of the day for today
  const existingLaw = runSqlJson(`
    SELECT law_id
    FROM law_of_the_day_history
    WHERE featured_date = ?
    LIMIT 1
  `, [today]);

  if (existingLaw.length > 0) {
    console.log(`[Law of the Day] Already selected: Law ID ${existingLaw[0].law_id}`);
    return;
  }

  // Select a new law of the day
  // 1. Get laws not featured in last 365 days
  // 2. Order by upvotes DESC, then text ASC (alphabetically)
  // 3. Take the first one
  const candidates = runSqlJson(`
    SELECT l.id,
           l.text,
           COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
    FROM laws l
    WHERE l.status = 'published'
      AND l.id NOT IN (
        SELECT law_id
        FROM law_of_the_day_history
        WHERE featured_date > date('now', '-365 days')
      )
    ORDER BY upvotes DESC, l.text ASC
    LIMIT 1
  `);

  let lawId;
  let lawText;

  if (candidates.length === 0) {
    console.log('[Law of the Day] All laws featured in last 365 days, using fallback...');

    // Fallback: if all laws have been featured in last 365 days, pick any
    const fallbackCandidates = runSqlJson(`
      SELECT l.id,
             l.text,
             COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
      FROM laws l
      WHERE l.status = 'published'
      ORDER BY upvotes DESC, l.text ASC
      LIMIT 1
    `);

    if (fallbackCandidates.length === 0) {
      console.error('[Law of the Day] ERROR: No published laws available!');
      process.exit(1);
    }

    lawId = fallbackCandidates[0].id;
    lawText = fallbackCandidates[0].text;
  } else {
    lawId = candidates[0].id;
    lawText = candidates[0].text;
  }

  // Store this as today's law of the day
  runSql(`
    INSERT INTO law_of_the_day_history (law_id, featured_date)
    VALUES (?, ?)
  `, [lawId, today]);

  console.log(`[Law of the Day] Selected Law ID ${lawId} for ${today}`);
  console.log(`[Law of the Day] Text: "${lawText.substring(0, 80)}..."`);
}

// Run the selection
selectLawOfDay().catch((error) => {
  console.error('[Law of the Day] ERROR:', error);
  process.exit(1);
});
