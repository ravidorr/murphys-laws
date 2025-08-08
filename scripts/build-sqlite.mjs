#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

// Config
const ROOT = path.resolve(process.cwd());
const SOURCE_DIR = path.join(ROOT, 'murphys-laws');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function listMarkdownFiles(dir) {
  const out = [];
  async function walk(d) {
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

function splitLines(content) {
  return content.split(/\r?\n/);
}

// Extract H1 title from file
function extractTitle(lines) {
  for (const line of lines) {
    const m = /^#\s+(.+)/.exec(line.trim());
    if (m) return m[1].trim();
  }
  // Fallback: basename
  return null;
}

function stripMarkdownLinks(text) {
  // Replace [text](url) with text; keep mailto and http separately where needed
  // Allow URL to span whitespace/newlines if the source was wrapped
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/gs, '$1');
}

function parseAttributions(text) {
  // Collect multiple "Sent by ..." phrases; return {cleanText, attributions[]}
  const atts = [];
  let clean = text;

  const trimNote = (s) => (s ? s.replace(/^[-–—:,;\s()]+/, '').trim() : '');

  function removeOnce(from, fragment) {
    const idx = from.indexOf(fragment);
    return idx === -1 ? from : (from.slice(0, idx) + from.slice(idx + fragment.length)).replace(/\s{2,}/g, ' ').trim();
  }

  let i = 0;
  const lower = text.toLowerCase();
  while (true) {
    const found = lower.indexOf('sent by', i);
    if (found === -1) break;
    let cursor = found + 'sent by'.length;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;

    // Determine end of sentence carefully:
    // If a Markdown link exists, extend end past the closing ')' then the next '.'
    let end = text.length;
    let linkStart = text.indexOf('[', cursor);
    let tempEndDot = text.indexOf('.', cursor);

    if (linkStart !== -1) {
      const rb = text.indexOf(']', linkStart + 1);
      const lp = rb !== -1 ? text.indexOf('(', rb + 1) : -1;
      if (rb !== -1 && lp !== -1 && lp - rb <= 3) {
        let rp = text.indexOf(')', lp + 1);
        if (rp !== -1) {
          const afterRpDot = text.indexOf('.', rp + 1);
          end = afterRpDot === -1 ? text.length : afterRpDot + 1;
        } else {
          end = tempEndDot === -1 ? text.length : tempEndDot + 1;
        }
      } else {
        end = tempEndDot === -1 ? text.length : tempEndDot + 1;
      }
    } else {
      end = tempEndDot === -1 ? text.length : tempEndDot + 1;
    }

    const sentence = text.slice(cursor, end);

    let raw = text.slice(found, end);
    let name = null;
    let contact_type = 'text';
    let contact_value = null;
    let note = null;

    // Look for a Markdown link anywhere in the sentence
    const linkM = /\[([^\]]+)\]\(([^)]+)\)/s.exec(sentence);
    if (linkM) {
      name = linkM[1].trim();
      let url = (linkM[2] || '').replace(/\s+/g, '');
      if (url.startsWith('mailto:')) {
        contact_type = 'email';
        contact_value = url.replace(/^mailto:/, '');
      } else if (/^https?:\/\//i.test(url)) {
        contact_type = 'url';
        contact_value = url;
      } else {
        contact_type = 'text';
        contact_value = url;
      }
      note = trimNote(sentence.slice(linkM.index + linkM[0].length).replace(/[.]+$/, '')) || null;
      atts.push({ name, contact_type, contact_value, note, source_fragment: raw });
      clean = removeOnce(clean, raw);
      i = end;
      continue;
    }

    // Plain text variant: take the sentence body as name + optional metadata
    const body = sentence.replace(/^\s+|[.]+$/g, '');

    // Fallback: if body contains a Markdown link, extract from it
    const bodyLink = /\[([^\]]+)\]\(([^)]+)\)/s.exec(body);
    if (bodyLink) {
      name = bodyLink[1].trim();
      let url = (bodyLink[2] || '').replace(/\s+/g, '');
      if (url.startsWith('mailto:')) {
        contact_type = 'email';
        contact_value = url.replace(/^mailto:/, '');
      } else if (/^https?:\/\//i.test(url)) {
        contact_type = 'url';
        contact_value = url;
      } else {
        contact_type = 'text';
        contact_value = url;
      }
      note = trimNote(body.slice(bodyLink.index + bodyLink[0].length)) || null;
    } else {
      const splitM = /^(.*?)(?:\s*[-–—:,;()]+\s*|\s{2,})(.+)$/.exec(body);
      if (splitM) {
        name = splitM[1].trim().replace(/,$/, '');
        note = trimNote(splitM[2]) || null;
      } else {
        const [nm, ...rest] = body.split(',');
        name = (nm || '').trim();
        note = trimNote(rest.join(',')).trim() || null;
      }
      contact_value = name;
    }

    atts.push({ name, contact_type, contact_value, note, source_fragment: raw });
    clean = removeOnce(clean, raw);
    i = end;
  }

  return { cleanText: clean.trim().replace(/\s{2,}/g, ' '), attributions: atts };
}

function extractTitlePrefix(text) {
  // Patterns like "X's Law: ...", "Something Principle: ..."
  const m = /^([^:]{3,}?)\s*:\s*(.+)$/.exec(text);
  if (!m) return { title: null, remainder: text };
  const title = m[1].trim();
  const remainder = m[2].trim();
  return { title, remainder };
}

function isTopBullet(line) {
  return /^\*\s+/.test(line);
}

function isSubBullet(line) {
  return /^\s{2,}\*\s+/.test(line);
}

function normalizeText(t) {
  return stripMarkdownLinks(t).replace(/\s+/g, ' ').trim();
}

function splitInlineCorollaries(text) {
  // Split on occurrences of "Corollary:" (case-insensitive)
  const parts = text.split(/\b[Cc]orollary:\s*/);
  if (parts.length === 1) return { base: text, corollaries: [] };
  const base = parts.shift().trim().replace(/[;,.]+$/, '');
  const corollaries = parts.map((p) => p.trim().replace(/[;]+$/, '')).filter(Boolean);
  return { base, corollaries };
}

async function buildSQL() {
  const files = await listMarkdownFiles(SOURCE_DIR);

  const statements = [];
  statements.push('BEGIN TRANSACTION;');

  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = splitLines(content);
    const fileTitle = extractTitle(lines) || path.basename(filePath, '.md');
    const catSlug = slugify(fileTitle);

    // Upsert category
    statements.push(
      `INSERT INTO categories (slug, title, source_file_path) VALUES (${q(catSlug)}, ${q(fileTitle)}, ${q(rel)})\n` +
      `ON CONFLICT(slug) DO UPDATE SET title=excluded.title;`
    );

    // Iterate lines to capture top bullets and their sub-bullets
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!isTopBullet(line.trim())) continue;
      const position = i + 1; // 1-indexed line number

      // gather contiguous continuation lines that belong to this bullet (not sub-bullets)
      let k = i + 1;
      const cont = [];
      while (k < lines.length && !isTopBullet(lines[k].trim()) && !isSubBullet(lines[k]) && lines[k].trim() !== '') {
        cont.push(lines[k].trim());
        k++;
      }

      const parentRaw = [line.replace(/^\*\s+/, '').trim(), ...cont].join(' ');
      let { cleanText: cleanedParent, attributions: parentAtts } = parseAttributions(parentRaw);
      const { title: maybeTitle, remainder } = extractTitlePrefix(cleanedParent);
      const { base, corollaries: inlineCors } = splitInlineCorollaries(remainder || cleanedParent);
      const parentText = normalizeText(base || cleanedParent);

      // Insert parent law
      const lawSlug = null; // we can generate later based on text if needed
      statements.push(
        `INSERT INTO laws (slug, title, text, raw_markdown, origin_note, language, first_seen_file_path, first_seen_line_number)\n` +
        `VALUES (${q(lawSlug)}, ${q(maybeTitle)}, ${q(parentText)}, ${q(parentRaw)}, NULL, 'en', ${q(rel)}, ${position})\n` +
        `ON CONFLICT(first_seen_file_path, first_seen_line_number) DO NOTHING;`
      );

      // Category link
      statements.push(
        `INSERT OR IGNORE INTO law_categories (law_id, category_id, position)\n` +
        `SELECT laws.id, categories.id, ${position} FROM laws, categories\n` +
        `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${position} AND categories.slug=${q(catSlug)};`
      );

      // Parent attributions
      for (const att of parentAtts) {
        statements.push(
          `INSERT INTO attributions (law_id, name, contact_type, contact_value, note, source_fragment)\n` +
          `SELECT laws.id, ${q(att.name)}, ${q(att.contact_type)}, ${q(att.contact_value)}, ${q(att.note || null)}, ${q(att.source_fragment)} FROM laws\n` +
          `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${position};`
        );
      }

      // Inline corollaries as separate laws + relation
      for (const cor of inlineCors) {
        const corText = normalizeText(cor.replace(/^[-–—\s]*/, ''));
        if (!corText) continue;
        statements.push(
          `INSERT INTO laws (slug, title, text, raw_markdown, origin_note, language, first_seen_file_path, first_seen_line_number)\n` +
          `VALUES (NULL, NULL, ${q(corText)}, ${q('Corollary: ' + cor)}, NULL, 'en', ${q(rel)}, ${position} /* inline corollary */)\n` +
          `ON CONFLICT(first_seen_file_path, first_seen_line_number) DO NOTHING;`
        );
        // relation (from corollary to parent)
        statements.push(
          `INSERT INTO law_relations (from_law_id, to_law_id, relation_type, note)\n` +
          `SELECT child.id, parent.id, 'COROLLARY_OF', NULL\n` +
          `FROM laws AS parent, laws AS child\n` +
          `WHERE parent.first_seen_file_path=${q(rel)} AND parent.first_seen_line_number=${position}\n` +
          `  AND child.first_seen_file_path=${q(rel)} AND child.first_seen_line_number=${position};`
        );
      }

      // Lookahead sub-bullets
      let j = Math.max(i + 1, k);
      while (j < lines.length && isSubBullet(lines[j])) {
        const subLine = lines[j];
        const subPos = j + 1;

        // collect continuation lines for sub-bullet (indented more, not starting with "*")
        let t = j + 1;
        const subCont = [];
        while (t < lines.length && !isTopBullet(lines[t].trim()) && !isSubBullet(lines[t]) && lines[t].trim() !== '') {
          subCont.push(lines[t].trim());
          t++;
        }

        const subRaw = [subLine.replace(/^\s+\*\s+/, '').trim(), ...subCont].join(' ');
        const { cleanText: subCleaned, attributions: subAtts } = parseAttributions(subRaw);
        const isCor = /^([A-Za-z][^:]{0,60})?\s*Corollary\s*:\s*/i.test(subCleaned) || /^Corollary\s*:\s*/i.test(subCleaned);
        const labelM = /^([^:]{3,}?)\s*:\s*(.+)$/.exec(subCleaned);
        let subTitle = null;
        let subText = subCleaned;
        if (labelM) {
          subTitle = labelM[1].trim();
          subText = labelM[2].trim();
        }
        subText = normalizeText(subText);

        // Insert sub-law
        statements.push(
          `INSERT INTO laws (slug, title, text, raw_markdown, origin_note, language, first_seen_file_path, first_seen_line_number)\n` +
          `VALUES (NULL, ${q(subTitle)}, ${q(subText)}, ${q(subRaw)}, NULL, 'en', ${q(rel)}, ${subPos})\n` +
          `ON CONFLICT(first_seen_file_path, first_seen_line_number) DO NOTHING;`
        );

        // Link attribution(s)
        for (const att of subAtts) {
          statements.push(
            `INSERT INTO attributions (law_id, name, contact_type, contact_value, note, source_fragment)\n` +
            `SELECT laws.id, ${q(att.name)}, ${q(att.contact_type)}, ${q(att.contact_value)}, ${q(att.note || null)}, ${q(att.source_fragment)} FROM laws\n` +
            `WHERE laws.first_seen_file_path=${q(rel)} AND laws.first_seen_line_number=${subPos};`
          );
        }

        // Relation to parent
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

      // advance i to last processed sub-bullet or continuation
      i = Math.max(i, (j - 1));
    }
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

function q(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

// Run
buildSQL()
  .then(sql => {
    process.stdout.write(sql + '\n');
  })
  .catch(err => {
    console.error('Error building SQL:', err);
    process.exit(1);
  });

// Export for tests
export { parseAttributions };
