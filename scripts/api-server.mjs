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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function notFound(res) { sendJson(res, 404, { error: 'Not Found' }); }
function badRequest(res, msg) { sendJson(res, 400, { error: msg || 'Bad Request' }); }

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
FROM laws l`;

function buildListSql(hasQ) {
  const where = hasQ ? "\nWHERE (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)" : '';
  return `${baseSelect}${where}\nORDER BY l.id\nLIMIT ? OFFSET ?;`;
}

const countSql = (hasQ) => `SELECT COUNT(1) AS total FROM laws l${hasQ ? "\nWHERE (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)" : ''};`;

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
WHERE l.id = ?
LIMIT 1;
`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

      // total count
      const countParams = hasQ ? [like, like] : [];
      const [{ total } = { total: 0 }] = await runSqlJson(countSql(hasQ), countParams);

      // page rows
      const listParams = hasQ ? [like, like, limit, offset] : [limit, offset];
      const rows = await runSqlJson(buildListSql(hasQ), listParams);

      const data = rows.map(r => ({
        ...r,
        attributions: safeParseJsonArray(r.attributions),
      }));
      return sendJson(res, 200, { data, limit, offset, total, q });
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
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${HOST}:${PORT}`);
});

