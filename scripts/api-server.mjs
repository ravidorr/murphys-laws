#!/usr/bin/env node
import 'dotenv/config';
import http from 'node:http';
import url from 'node:url';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import {
  createSodsEmailHtml,
  createSodsEmailSubject,
  createSodsEmailText,
} from '../src/modules/sods-email-template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

// Email configuration
const EMAIL_TO = 'ravidor@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@murphys-laws.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Create email transporter if SMTP is configured
let emailTransporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log('Email notifications enabled');
} else {
  console.log('Email notifications disabled (SMTP not configured)');
}

// Send email notification for new law submission
async function sendNewLawEmail(lawData) {
  if (!emailTransporter) {
    console.log('Email not configured, skipping notification');
    return;
  }

  try {
    const { id, title, text, author, email } = lawData;

    const mailOptions = {
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: 'New Murphy Law Submitted!',
      text: `A new Murphy's Law has been submitted for review.

Law ID: ${id}
Title: ${title || '(no title)'}
Text: ${text}
Author: ${author || 'Anonymous'}
Email: ${email || 'Not provided'}

Review at: http://murphys-laws.com/admin (or use npm run review locally)
`,
      html: `
        <h2>New Murphy's Law Submitted!</h2>
        <p>A new law has been submitted for review.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Law ID:</td><td style="padding: 8px;">${id}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">${title || '<em>(no title)</em>'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Text:</td><td style="padding: 8px;">${text}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Author:</td><td style="padding: 8px;">${author || 'Anonymous'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email || 'Not provided'}</td></tr>
        </table>
        <p><a href="http://murphys-laws.com/admin">Review submissions</a> (or use <code>npm run review</code> locally)</p>
      `,
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`Email notification sent for law ID ${id}`);
  } catch (error) {
    console.error('Failed to send email notification:', error);
    // Don't fail the submission if email fails
  }
}

// Send Sod's Law calculation result email
async function sendCalculationEmail(calculationData) {
  if (!emailTransporter) {
    throw new Error('Email service not configured');
  }

  try {
    const {
      to,
      taskDescription,
      senderName,
      senderEmail,
      recipientName,
      urgency,
      complexity,
      importance,
      skill,
      frequency,
      probability,
      interpretation
    } = calculationData;

    const mailOptions = {
      from: EMAIL_FROM,
      to,
      bcc: 'ravidor@gmail.com',
      subject: createSodsEmailSubject(probability, senderName),
      text: createSodsEmailText({
        taskDescription,
        senderName,
        senderEmail,
        recipientName,
        urgency,
        complexity,
        importance,
        skill,
        frequency,
        probability,
        interpretation,
      }),
      html: createSodsEmailHtml({
        taskDescription,
        senderName,
        senderEmail,
        recipientName,
        urgency,
        complexity,
        importance,
        skill,
        frequency,
        probability,
        interpretation,
      }),
    };

    await emailTransporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to send calculation email: ${error.message}`);
  }
}

function runSqlJson(sql, params = []) {
  return new Promise((resolvePromise, reject) => {
    const finalSql = bindParams(sql, params);
    const args = ['-json', '-cmd', '.timeout 5000', DB_PATH, finalSql];
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
  ), '[]') AS attributions,
  COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
  COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
FROM laws l
WHERE l.status = 'published'`;

function buildListSql(hasQ, hasCategory, hasAttribution) {
  let where = '';

  if (hasQ) {
    where += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
  }

  if (hasCategory) {
    where += " AND EXISTS (SELECT 1 FROM law_categories lc WHERE lc.law_id = l.id AND lc.category_id = ?)";
  }

  if (hasAttribution) {
    where += " AND EXISTS (SELECT 1 FROM attributions a WHERE a.law_id = l.id AND a.name LIKE ?)";
  }

  return `${baseSelect}${where}\nORDER BY l.id\nLIMIT ? OFFSET ?;`;
}

function countSql(hasQ, hasCategory, hasAttribution) {
  let where = 'WHERE l.status = \'published\'';

  if (hasQ) {
    where += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
  }

  if (hasCategory) {
    where += " AND EXISTS (SELECT 1 FROM law_categories lc WHERE lc.law_id = l.id AND lc.category_id = ?)";
  }

  if (hasAttribution) {
    where += " AND EXISTS (SELECT 1 FROM attributions a WHERE a.law_id = l.id AND a.name LIKE ?)";
  }

  return `SELECT COUNT(1) AS total FROM laws l ${where};`;
}

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
  ), '[]') AS attributions,
  COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
  COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
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

const insertVoteSql = `
INSERT INTO votes (law_id, vote_type, voter_identifier)
VALUES (?, ?, ?)
ON CONFLICT(law_id, voter_identifier)
DO UPDATE SET vote_type = excluded.vote_type, created_at = CURRENT_TIMESTAMP;
`;

const deleteVoteSql = `
DELETE FROM votes WHERE law_id = ? AND voter_identifier = ?;
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

// Helper to get voter identifier (IP address for now, can be extended with session/user ID)
function getVoterIdentifier(req) {
  // Try to get real IP from proxy headers first
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  // Fall back to socket address
  return req.socket.remoteAddress || 'unknown';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
      const categoryId = parsed.query.category_id ? Number(parsed.query.category_id) : null;
      const attribution = (parsed.query.attribution || '').toString().trim();

      const hasQ = q.length > 0;
      const hasCategory = categoryId !== null && !isNaN(categoryId);
      const hasAttribution = attribution.length > 0;

      const like = `%${q}%`;
      const attributionLike = `%${attribution}%`;

      // Build parameter arrays
      const countParams = [];
      const listParams = [];

      if (hasQ) {
        countParams.push(like, like);
        listParams.push(like, like);
      }

      if (hasCategory) {
        countParams.push(categoryId);
        listParams.push(categoryId);
      }

      if (hasAttribution) {
        countParams.push(attributionLike);
        listParams.push(attributionLike);
      }

      // total count (only published)
      const [{ total } = { total: 0 }] = await runSqlJson(countSql(hasQ, hasCategory, hasAttribution), countParams);

      // page rows (only published)
      listParams.push(limit, offset);
      const rows = await runSqlJson(buildListSql(hasQ, hasCategory, hasAttribution), listParams);

      const data = rows.map(r => ({
        ...r,
        attributions: safeParseJsonArray(r.attributions),
      }));
      return sendJson(res, 200, { data, limit, offset, total, q, category_id: categoryId, attribution });
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
      const categoryId = body.category_id && typeof body.category_id === 'string' ? parseInt(body.category_id) : null;

      // Validate text length
      if (text.length < 10) {
        return badRequest(res, 'Law text must be at least 10 characters');
      }

      if (text.length > 1000) {
        return badRequest(res, 'Law text must be less than 1000 characters');
      }

      // Validate category_id if provided
      if (categoryId && (!Number.isInteger(categoryId) || categoryId <= 0)) {
        return badRequest(res, 'Invalid category ID');
      }

      // Check if category exists if categoryId is provided
      if (categoryId) {
        const categoryCheck = await runSqlJson('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (!categoryCheck || categoryCheck.length === 0) {
          return badRequest(res, 'Category not found');
        }
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

      // Insert law_categories relationship if category provided
      if (categoryId) {
        await runSqlJson('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)', [lawId, categoryId]);
      }

      // Send email notification (async, don't wait for it)
      sendNewLawEmail({
        id: lawId,
        title,
        text,
        author,
        email
      }).catch(err => console.error('Email notification failed:', err));

      return sendJson(res, 201, {
        id: lawId,
        title,
        text,
        status: 'in_review',
        message: 'Law submitted successfully and is pending review'
      });
    }

    // POST /api/laws/:id/vote - Vote on a law
    const voteMatch = /^\/api\/laws\/(\d+)\/vote$/.exec(pathname);
    if (req.method === 'POST' && voteMatch) {
      const lawId = Number(voteMatch[1]);
      const body = await readBody(req);
      const voteType = body.vote_type;

      // Validate vote_type
      if (!voteType || !['up', 'down'].includes(voteType)) {
        return badRequest(res, 'vote_type must be "up" or "down"');
      }

      // Check if law exists and is published
      const lawRows = await runSqlJson(oneSql, [lawId]);
      if (!lawRows || lawRows.length === 0) {
        return notFound(res);
      }

      const voterIdentifier = getVoterIdentifier(req);

      // Insert or update vote (ON CONFLICT will handle duplicate votes)
      await runSqlJson(insertVoteSql, [lawId, voteType, voterIdentifier]);

      // Get updated vote counts
      const updatedLaw = await runSqlJson(oneSql, [lawId]);
      const law = updatedLaw[0];

      return sendJson(res, 200, {
        law_id: lawId,
        vote_type: voteType,
        upvotes: law.upvotes,
        downvotes: law.downvotes
      });
    }

    // DELETE /api/laws/:id/vote - Remove vote on a law
    if (req.method === 'DELETE' && voteMatch) {
      const lawId = Number(voteMatch[1]);

      // Check if law exists and is published
      const lawRows = await runSqlJson(oneSql, [lawId]);
      if (!lawRows || lawRows.length === 0) {
        return notFound(res);
      }

      const voterIdentifier = getVoterIdentifier(req);

      // Delete the vote
      await runSqlJson(deleteVoteSql, [lawId, voterIdentifier]);

      // Get updated vote counts
      const updatedLaw = await runSqlJson(oneSql, [lawId]);
      const law = updatedLaw[0];

      return sendJson(res, 200, {
        law_id: lawId,
        upvotes: law.upvotes,
        downvotes: law.downvotes
      });
    }

    // GET /api/categories - Get all categories
    if (req.method === 'GET' && pathname === '/api/categories') {
      const categories = await runSqlJson(`
        SELECT id, slug, title, description
        FROM categories
        ORDER BY title;
      `);
      return sendJson(res, 200, { data: categories });
    }

    // GET /api/attributions - Get unique attribution names
    if (req.method === 'GET' && pathname === '/api/attributions') {
      const attributions = await runSqlJson(`
        SELECT DISTINCT name
        FROM attributions
        WHERE name IS NOT NULL AND name != ''
        ORDER BY name;
      `);
      return sendJson(res, 200, { data: attributions });
    }

    // POST /api/share-calculation - Share calculation result via email
    if (req.method === 'POST' && pathname === '/api/share-calculation') {
      const body = await readBody(req);

      // Validate required fields
      if (!body.taskDescription || typeof body.taskDescription !== 'string' || !body.taskDescription.trim()) {
        return badRequest(res, 'Task description is required');
      }

      if (!body.senderName || typeof body.senderName !== 'string' || !body.senderName.trim()) {
        return badRequest(res, 'Sender name is required');
      }

      if (!body.senderEmail || typeof body.senderEmail !== 'string' || !body.senderEmail.trim()) {
        return badRequest(res, 'Sender email is required');
      }

      if (!body.recipientName || typeof body.recipientName !== 'string' || !body.recipientName.trim()) {
        return badRequest(res, 'Recipient name is required');
      }

      if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
        return badRequest(res, 'Recipient email address is required');
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.senderEmail.trim())) {
        return badRequest(res, 'Invalid sender email address');
      }

      if (!emailRegex.test(body.email.trim())) {
        return badRequest(res, 'Invalid recipient email address');
      }

      // Validate numeric inputs
      const requiredNumbers = ['urgency', 'complexity', 'importance', 'skill', 'frequency'];
      for (const field of requiredNumbers) {
        if (typeof body[field] !== 'number' || body[field] < 1 || body[field] > 9) {
          return badRequest(res, `${field} must be a number between 1 and 9`);
        }
      }

      if (!body.probability || typeof body.probability !== 'string') {
        return badRequest(res, 'Probability is required');
      }

      if (!body.interpretation || typeof body.interpretation !== 'string') {
        return badRequest(res, 'Interpretation is required');
      }

      try {
        await sendCalculationEmail({
          to: body.email.trim(),
          taskDescription: body.taskDescription.trim(),
          senderName: body.senderName.trim(),
          senderEmail: body.senderEmail.trim(),
          recipientName: body.recipientName.trim(),
          urgency: body.urgency,
          complexity: body.complexity,
          importance: body.importance,
          skill: body.skill,
          frequency: body.frequency,
          probability: body.probability,
          interpretation: body.interpretation
        });

        return sendJson(res, 200, { success: true, message: 'Calculation sent successfully' });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
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
