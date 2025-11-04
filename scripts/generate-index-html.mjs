#!/usr/bin/env node

/**
 * Generate index.html with inlined law-of-day data for performance optimization
 *
 * This script reads the built index.html and injects the law-of-day JSON data
 * inline to eliminate the API round-trip on initial page load, significantly
 * improving LCP (Largest Contentful Paint) performance.
 *
 * Usage:
 *   node scripts/generate-index-html.mjs > dist/index-dynamic.html
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function main() {
  // Read the built index.html
  const indexPath = join(ROOT, 'dist', 'index.html');
  let html;

  try {
    html = readFileSync(indexPath, 'utf8');
  } catch (error) {
    console.error('Error: dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }

  // Get law-of-day data from database (matching API logic exactly)
  const db = new Database(join(ROOT, 'murphys.db'), { readonly: false });

  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have a law selected for today
    const existingStmt = db.prepare(`
      SELECT law_id
      FROM law_of_the_day_history
      WHERE featured_date = ?
      LIMIT 1
    `);
    const existingLaw = existingStmt.get(today);

    let lawId;

    if (existingLaw) {
      lawId = existingLaw.law_id;
    } else {
      // Select a new law (matching API logic)
      const candidatesStmt = db.prepare(`
        SELECT l.id,
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
      const candidates = candidatesStmt.all();

      if (candidates.length === 0) {
        // Fallback: pick any published law
        const fallbackStmt = db.prepare(`
          SELECT l.id,
                 COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
          FROM laws l
          WHERE l.status = 'published'
          ORDER BY upvotes DESC, l.text ASC
          LIMIT 1
        `);
        const fallbackCandidates = fallbackStmt.all();

        if (fallbackCandidates.length === 0) {
          console.error('Error: No published laws available');
          process.exit(1);
        }

        lawId = fallbackCandidates[0].id;
      } else {
        lawId = candidates[0].id;
      }

      // Store this as today's law
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO law_of_the_day_history (law_id, featured_date)
        VALUES (?, ?)
      `);
      insertStmt.run(lawId, today);
    }

    // Fetch full law details (matching API SQL exactly)
    const lawStmt = db.prepare(`
      SELECT
        l.id,
        l.title,
        l.text,
        l.first_seen_file_path AS file_path,
        l.first_seen_line_number AS line_number,
        COALESCE((
          SELECT json_group_array(json_object(
            'name', a.name,
            'contact_type', a.contact_type,
            'contact_value', a.contact_value,
            'note', a.note
          )) FROM attributions a WHERE a.law_id = l.id
        ), '[]') AS attributions,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
      FROM laws l
      WHERE l.id = ?
    `);
    const law = lawStmt.get(lawId);

    if (!law) {
      console.error('Error: No law found in database');
      process.exit(1);
    }

    // Parse attributions JSON (already formatted by SQLite)
    let attributions = [];
    if (law.attributions) {
      try {
        attributions = JSON.parse(law.attributions);
      } catch (e) {
        console.error('Warning: Failed to parse attributions:', e.message);
      }
    }

    const lawData = {
      id: law.id,
      title: law.title,
      text: law.text,
      file_path: law.file_path,
      line_number: law.line_number,
      upvotes: law.upvotes || 0,
      downvotes: law.downvotes || 0,
      attributions
    };

    // Create the JSON response matching the API format
    const jsonData = {
      law: lawData,
      featured_date: today
    };

    // Inline the JSON data into the HTML
    const jsonString = JSON.stringify(jsonData);
    html = html.replace(
      '<!-- LAW_OF_DAY_DATA -->',
      jsonString
    );

    // Output the modified HTML
    console.log(html);

  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
