#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, '../shared/data/murphys-laws');
const DB_PATH = path.join(ROOT, 'murphys.db');

export interface Attribution {
  name: string;
  contact_type: string;
  contact_value: string;
  source_fragment: string;
  note?: string;
}

export interface ParseAttributionsResult {
  cleanText: string;
  attributions: Attribution[];
}

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

export function parseAttributions(text: string): ParseAttributionsResult {
  const attrs: Attribution[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/gs;
  const matches = [...text.matchAll(linkRegex)];

  for (const m of matches) {
    const name = m[1].trim();
    const contactValue = m[2].trim();
    if (!name || !contactValue) continue;

    let contactType = 'url';
    if (contactValue.startsWith('mailto:')) {
      contactType = 'email';
    } else if (!/^https?:\/\//i.test(contactValue)) {
      contactType = 'text';
    }

    const actualContact = contactType === 'email'
      ? contactValue.replace(/^mailto:\s*/i, '').trim()
      : contactValue;

    attrs.push({
      name,
      contact_type: contactType,
      contact_value: actualContact,
      source_fragment: m[0],
    });
  }

  const cleanText = text.replace(linkRegex, (_match, linkText: string) => linkText).trim();
  return { cleanText, attributions: attrs };
}

function normalizeText(txt: string): string {
  let result = txt
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    .trim();

  result = result.replace(/^["']|["']$/g, '');
  return result.trim();
}

function q(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

async function buildSQL(): Promise<string> {
  const files = await listMarkdownFiles(SOURCE_DIR);
  const statements: string[] = ['BEGIN TRANSACTION;'];

  for (const file of files) {
    const basename = path.basename(file, '.md');
    const rel = path.relative(ROOT, file);
    const slug = slugify(basename);
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split('\n');

    const titleLine = lines.find((l) => l.trim().startsWith('#'));
    const categoryTitle = titleLine ? titleLine.replace(/^#\s+/, '').trim() : basename;

    statements.push(
      `INSERT INTO categories (slug, title, source_file_path) VALUES (${q(slug)}, ${q(categoryTitle)}, ${q(rel)})\n` +
      `ON CONFLICT(slug) DO UPDATE SET title=excluded.title;`
    );

    function isTopBullet(line: string): boolean {
      return /^\*\s+/.test(line);
    }
    function isSubBullet(line: string): boolean {
      return /^\s+\*\s+/.test(line);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!isTopBullet(line)) continue;

      const position = i + 1;
      let stripped = line.replace(/^\*\s+/, '').trim();

      const continuation: string[] = [];
      let j = i + 1;
      while (j < lines.length && !isTopBullet(lines[j].trim()) && !isSubBullet(lines[j]) && lines[j].trim() !== '') {
        continuation.push(lines[j].trim());
        j++;
      }

      let rawMd = [stripped, ...continuation].join(' ');
      const { cleanText, attributions } = parseAttributions(rawMd);

      let lawTitle: string | null = null;
      let body = cleanText;

      const colonM = /^([^:]{3,}?)\s*:\s*(.+)$/.exec(cleanText);
      if (colonM) {
        const possibleTitle = colonM[1].trim();
        body = colonM[2].trim();

        if (
          /corollary/i.test(possibleTitle) ||
          /(murphy|cole|law|rule|principle|theory|paradox)\b/i.test(possibleTitle) ||
          possibleTitle.length > 12
        ) {
          lawTitle = possibleTitle;
        } else {
          body = cleanText;
        }
      }

      const linkM = /\[([^\]]+)\]\(([^)]+)\)/s.exec(body);
      if (linkM && body.indexOf(linkM[0]) < body.length * 0.7) {
        const splitter = /^(.*?)(?:\s*[-–—:,;()]+\s*|\s{2,})(.+)$/.exec(body);
        if (splitter && splitter[1].length > 3 && splitter[2].length > 3) {
          const partA = splitter[1].trim();
          const partB = splitter[2].trim();
          if (partB.includes(linkM[0])) {
            lawTitle = partA;
            body = partB;
          }
        }
      }

      body = normalizeText(body);

      statements.push(
        `INSERT INTO laws (slug, title, text, raw_markdown, origin_note, first_seen_file_path, first_seen_line_number)\n` +
        `VALUES (NULL, ${q(lawTitle)}, ${q(body)}, ${q(rawMd)}, NULL, ${q(rel)}, ${position})\n` +
        `ON CONFLICT(first_seen_file_path, first_seen_line_number) DO NOTHING;`
      );

      statements.push(
        `INSERT OR IGNORE INTO law_categories (law_id, category_id, position)\n` +
        `SELECT laws.id, categories.id, ${position} FROM laws, categories\n` +
        `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${position} AND categories.slug=${q(slug)};`
      );

      for (const att of attributions) {
        statements.push(
          `INSERT INTO attributions (law_id, name, contact_type, contact_value, note, source_fragment)\n` +
          `SELECT laws.id, ${q(att.name)}, ${q(att.contact_type)}, ${q(att.contact_value)}, ${q(att.note ?? null)}, ${q(att.source_fragment)} FROM laws\n` +
          `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${position};`
        );
      }

      while (j < lines.length && isSubBullet(lines[j])) {
        const subLine = lines[j];
        const subPos = j + 1;

        let t = j + 1;
        const subCont: string[] = [];
        while (t < lines.length && !isTopBullet(lines[t].trim()) && !isSubBullet(lines[t]) && lines[t].trim() !== '') {
          subCont.push(lines[t].trim());
          t++;
        }

        const subRaw = [subLine.replace(/^\s+\*\s+/, '').trim(), ...subCont].join(' ');
        const { cleanText: subCleaned, attributions: subAtts } = parseAttributions(subRaw);
        const isCor = /^([A-Za-z][^:]{0,60})?\s*Corollary\s*:\s*/i.test(subCleaned) || /^Corollary\s*:\s*/i.test(subCleaned);
        const labelM = /^([^:]{3,}?)\s*:\s*(.+)$/.exec(subCleaned);
        let subTitle: string | null = null;
        let subText = subCleaned;
        if (labelM) {
          subTitle = labelM[1].trim();
          subText = labelM[2].trim();
        }
        subText = normalizeText(subText);

        statements.push(
          `INSERT INTO laws (slug, title, text, raw_markdown, origin_note, first_seen_file_path, first_seen_line_number)\n` +
          `VALUES (NULL, ${q(subTitle)}, ${q(subText)}, ${q(subRaw)}, NULL, ${q(rel)}, ${subPos})\n` +
          `ON CONFLICT(first_seen_file_path, first_seen_line_number) DO NOTHING;`
        );

        for (const att of subAtts) {
          statements.push(
            `INSERT INTO attributions (law_id, name, contact_type, contact_value, note, source_fragment)\n` +
            `SELECT laws.id, ${q(att.name)}, ${q(att.contact_type)}, ${q(att.contact_value)}, ${q(att.note ?? null)}, ${q(att.source_fragment)} FROM laws\n` +
            `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${subPos};`
          );
        }

        const relationType = isCor ? 'COROLLARY_OF' : 'COMMENT_ON';
        statements.push(
          `INSERT INTO law_relations (from_law_id, to_law_id, relation_type, note)\n` +
          `SELECT child.id, parent.id, ${q(relationType)}, ${q(subTitle && /corollary/i.test(subTitle) ? subTitle : null)}\n` +
          `FROM laws AS parent, laws AS child\n` +
          `WHERE parent.first_seen_file_path=${q(rel)} AND parent.first_seen_line_number=${position}\n` +
          `  AND child.first_seen_file_path=${q(rel)} AND child.first_seen_line_number=${subPos};`
        );

        j = t;
      }

      i = Math.max(i, j - 1);
    }
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

buildSQL()
  .then(async (sql) => {
    console.log(`Creating database at: ${DB_PATH}`);
    const db = new Database(DB_PATH);

    const migrationsDir = path.join(ROOT, 'db', 'migrations');
    const migrationFiles = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Running ${migrationFiles.length} migrations...`);
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migration = await fs.readFile(migrationPath, 'utf8');
      console.log(`  - ${file}`);
      db.exec(migration);
    }

    console.log('Inserting data...');
    db.exec(sql);

    db.close();
    console.log('Database created successfully with all migrations');
  })
  .catch((err) => {
    console.error('Error building SQL:', err);
    process.exit(1);
  });
