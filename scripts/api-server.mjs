#!/usr/bin/env node
import http from 'node:http';
import url from 'node:url';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

function runSqlJson(sql, params = []) {
  return new Promise((resolvePromise, reject) => {
    const finalSql = bindParams(sql, params);
    const args = ['-json', DB_PATH, finalSql];
    execFile('sqlite3', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        const data = stdout.trim() ? JSON.parse(stdout) : [];
        resolvePromise(data);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Simple positional parameter binding (replaces ? with properly quoted values)
// For read-only purposes with trusted params (numbers only in this server), it's safe.
function bindParams(sql, params) {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (typeof v === 'number') return String(v);
    if (v === null || v === undefined) return 'NULL';
    // Escape single quotes
    const s = String(v).replace(/'/g, "''");
    return `'${s}'`;
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function notFound(res) { sendJson(res, 404, { error: 'Not Found' }); }
function badRequest(res, msg) { sendJson(res, 400, { error: msg || 'Bad Request' }); }

// Only return published laws
const baseSelect = `
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
  ), '[]') AS attributions
FROM laws l
WHERE l.status = 'published'`;

function buildListSql(hasQ) {
  const where = hasQ ? " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)" : '';
  return `${baseSelect}${where}\nORDER BY l.id\nLIMIT ? OFFSET ?;`;
}

const countSql = (hasQ) => `SELECT COUNT(1) AS total FROM laws l WHERE l.status = 'published'${hasQ ? " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)" : ''};`;

const oneSql = `
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
  ), '[]') AS attributions
FROM laws l
WHERE l.id = ? AND l.status = 'published'
LIMIT 1;
`;

const insertLawSql = `
INSERT INTO laws (title, text, status, first_seen_file_path)
VALUES (?, ?, 'in_review', 'web-submission')
RETURNING id;
`;

const insertAttributionSql = `
INSERT INTO attributions (law_id, name, contact_type, contact_value)
VALUES (?, ?, ?, ?);
`;

// Helper to read POST body
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/laws') {
      const limit = Math.max(1, Math.min(200, Number(parsed.query.limit || 50)));
      const offset = Math.max(0, Number(parsed.query.offset || 0));
      const q = (parsed.query.q || '').toString().trim();
      const hasQ = q.length > 0;
      const like = `%${q}%`;

      // total count (only published)
      const countParams = hasQ ? [like, like] : [];
      const [{ total } = { total: 0 }] = await runSqlJson(countSql(hasQ), countParams);

      // page rows (only published)
      const listParams = hasQ ? [like, like, limit, offset] : [limit, offset];
      const rows = await runSqlJson(buildListSql(hasQ), listParams);

      const data = rows.map(r => ({
        ...r,
        attributions: safeParseJsonArray(r.attributions),
      }));
      return sendJson(res, 200, { data, limit, offset, total, q });
    }

    // POST /api/laws - Submit a new law for review
    if (req.method === 'POST' && pathname === '/api/laws') {
      const body = await readBody(req);

      // Validate required fields
      if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
        return badRequest(res, 'Law text is required');
      }

      const text = body.text.trim();
      const title = body.title && typeof body.title === 'string' ? body.title.trim() : null;
      const author = body.author && typeof body.author === 'string' ? body.author.trim() : null;
      const email = body.email && typeof body.email === 'string' ? body.email.trim() : null;

      // Validate text length
      if (text.length < 10) {
        return badRequest(res, 'Law text must be at least 10 characters');
      }

      if (text.length > 1000) {
        return badRequest(res, 'Law text must be less than 1000 characters');
      }

      // Insert law with status 'in_review'
      const lawResult = await runSqlJson(insertLawSql, [title, text]);

      if (!lawResult || lawResult.length === 0) {
        throw new Error('Failed to insert law');
      }

      const lawId = lawResult[0].id;

      // Insert attribution if author or email provided
      if (author || email) {
        const contactType = email ? 'email' : 'text';
        const contactValue = email || null;
        const name = author || 'Anonymous';
        await runSqlJson(insertAttributionSql, [lawId, name, contactType, contactValue]);
      }

      return sendJson(res, 201, {
        id: lawId,
        title,
        text,
        status: 'in_review',
        message: 'Law submitted successfully and is pending review'
      });
    }

    // Stories endpoints are postponed for a later milestone. Intentionally omitted.

    const lawIdMatch = /^\/api\/laws\/(\d+)$/.exec(pathname);
    if (req.method === 'GET' && lawIdMatch) {
      const id = Number(lawIdMatch[1]);
      const rows = await runSqlJson(oneSql, [id]);
      if (!rows || rows.length === 0) return notFound(res);
      const r = rows[0];
      const data = { ...r, attributions: safeParseJsonArray(r.attributions) };
      return sendJson(res, 200, data);
    }

    // Stories endpoints are postponed for a later milestone. Intentionally omitted.

    return notFound(res);
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: String(err && err.message || err) });
  }
});

function safeParseJsonArray(s) {
  try {
    const v = typeof s === 'string' ? JSON.parse(s) : s;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

server.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});
