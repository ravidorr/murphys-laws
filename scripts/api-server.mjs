#!/usr/bin/env node
import 'dotenv/config';
import http from 'node:http';
import url from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import validator from 'validator';
import {
  createSodsEmailHtml,
  createSodsEmailSubject,
  createSodsEmailText,
} from '../src/modules/sods-email-template.js';
import {
  createLawSubmissionEmailSubject,
  createLawSubmissionEmailText,
  createLawSubmissionEmailHtml,
} from '../src/modules/law-submission-email-template.js';
import { MAX_LAWS_PER_REQUEST, DEFAULT_LAWS_PER_REQUEST } from '../src/utils/constants.js';
import { parseSignedRequest, generateConfirmationCode } from '../src/utils/facebook-signed-request.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

// Email configuration - Fixed: Use environment variable instead of hardcoded email
const EMAIL_TO = process.env.EMAIL_TO || 'admin@murphys-laws.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@murphys-laws.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// CORS configuration - Restrict origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*']; // Allow all in development, restrict in production

// Facebook configuration - Required for data deletion callback
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;

// Initialize database with better-sqlite3 (fixes SQL injection vulnerability)
const db = new Database(DB_PATH, {
  timeout: 5000,
  readonly: false
});
db.pragma('journal_mode = WAL');
console.log('Database connected with better-sqlite3');

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  vote: { max: 30, window: RATE_LIMIT_WINDOW_MS }, // 30 votes per minute
  submit: { max: 3, window: RATE_LIMIT_WINDOW_MS }, // 3 submissions per minute
  email: { max: 5, window: RATE_LIMIT_WINDOW_MS }, // 5 emails per minute
};

// In-memory rate limit tracking (for production, use Redis)
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 * @param {string} identifier - IP address or identifier
 * @param {string} type - Type of action (vote, submit, email)
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkRateLimit(identifier, type) {
  const limit = RATE_LIMITS[type];
  if (!limit) return { allowed: true, remaining: Infinity, resetTime: 0 };

  const key = `${type}:${identifier}`;
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 0, resetTime: now + limit.window });
  }

  const record = rateLimitStore.get(key);

  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + limit.window;
  }

  if (record.count >= limit.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limit.max - record.count,
    resetTime: record.resetTime,
  };
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 60000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
    const mailOptions = {
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: createLawSubmissionEmailSubject(lawData.id),
      text: createLawSubmissionEmailText(lawData),
      html: createLawSubmissionEmailHtml(lawData),
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`Email notification sent for law ID ${lawData.id}`);
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
      bcc: EMAIL_TO, // Fixed: Use environment variable
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

/**
 * Get the appropriate CORS origin header value based on request and allowed origins
 * @param {http.IncomingMessage} req - HTTP request
 * @returns {string} Origin to allow
 */
function getCorsOrigin(req) {
  // If wildcard is allowed, return it
  if (ALLOWED_ORIGINS.includes('*')) {
    return '*';
  }

  // Get the origin from the request
  const requestOrigin = req.headers.origin;

  // If no origin in request or origin not in allowed list, use first allowed origin as fallback
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return ALLOWED_ORIGINS[0] || '*';
  }

  // Return the matching allowed origin
  return requestOrigin;
}

function sendJson(res, status, obj, req = null) {
  const body = JSON.stringify(obj);
  const origin = req ? getCorsOrigin(req) : '*';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Only add credentials header if not using wildcard
  if (origin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  res.writeHead(status, headers);
  res.end(body);
}

function notFound(res, req = null) { sendJson(res, 404, { error: 'Not Found' }, req); }
function badRequest(res, msg, req = null) { sendJson(res, 400, { error: msg || 'Bad Request' }, req); }
function rateLimitExceeded(res, resetTime, req = null) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  const origin = req ? getCorsOrigin(req) : '*';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': retryAfter,
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Only add credentials header if not using wildcard
  if (origin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  res.writeHead(429, headers);
  res.end(JSON.stringify({
    error: 'Rate limit exceeded. Please try again later.',
    retryAfter
  }));
}

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

function safeParseJsonArray(s) {
  try {
    const v = typeof s === 'string' ? JSON.parse(s) : s;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Normalize API pathname to handle both /api/... and /api/v1/... routes
 * Returns the normalized pathname (without version) and whether it's a v1 request
 * @param {string} pathname - Original pathname
 * @returns {Object} { normalized: string, isV1: boolean }
 */
function normalizeApiPath(pathname) {
  // Handle /api/v1/... routes
  if (pathname.startsWith('/api/v1/')) {
    return {
      normalized: pathname.replace('/api/v1/', '/api/'),
      isV1: true
    };
  }
  // Handle /api/... routes (backward compatibility)
  if (pathname.startsWith('/api/')) {
    return {
      normalized: pathname,
      isV1: false
    };
  }
  // Return as-is for non-API routes
  return {
    normalized: pathname,
    isV1: false
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(req);
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Only add credentials header if not using wildcard
    if (origin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    res.writeHead(204, headers);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';
  const { normalized: normalizedPath } = normalizeApiPath(pathname);

  try {
    // Health check endpoint (no versioning)
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api/v1/health')) {
      // Test database query and measure performance
      const dbStartTime = Date.now();
      try {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM laws LIMIT 1');
        stmt.get();
        const dbQueryTime = Date.now() - dbStartTime;
        return sendJson(res, 200, { ok: true, dbQueryTime }, req);
      } catch (dbError) {
        console.error('Health check database error:', dbError);
        return sendJson(res, 503, { ok: false, error: 'Database unavailable', dbError: dbError.message }, req);
      }
    }

    // GET /api/laws or /api/v1/laws - List laws with pagination and filtering
    if (req.method === 'GET' && normalizedPath === '/api/laws') {
      const limit = Math.max(1, Math.min(MAX_LAWS_PER_REQUEST, Number(parsed.query.limit || DEFAULT_LAWS_PER_REQUEST)));
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

      // Total count - Using prepared statements (SQL injection safe)
      const countStmt = db.prepare(countSql(hasQ, hasCategory, hasAttribution));
      const countResult = countStmt.get(...countParams);
      const total = countResult ? countResult.total : 0;

      // Page rows - Using prepared statements (SQL injection safe)
      listParams.push(limit, offset);
      const listStmt = db.prepare(buildListSql(hasQ, hasCategory, hasAttribution));
      const rows = listStmt.all(...listParams);

      const data = rows.map(r => ({
        ...r,
        attributions: safeParseJsonArray(r.attributions),
      }));
      return sendJson(res, 200, { data, limit, offset, total, q, category_id: categoryId, attribution }, req);
    }

    // GET /api/law-of-day or /api/v1/law-of-day - Get the Law of the Day
    if (req.method === 'GET' && normalizedPath === '/api/law-of-day') {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Check if we already have a law of the day for today
      const existingStmt = db.prepare(`
        SELECT law_id
        FROM law_of_the_day_history
        WHERE featured_date = ?
        LIMIT 1
      `);
      const existingLaw = existingStmt.get(today);

      let lawId;

      if (existingLaw) {
        // Use the already selected law for today
        lawId = existingLaw.law_id;
      } else {
        // Select a new law of the day
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
          // Fallback: if all laws have been featured in last 365 days, reset and pick any
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
            return sendJson(res, 404, { error: 'No published laws available' }, req);
          }

          lawId = fallbackCandidates[0].id;
        } else {
          lawId = candidates[0].id;
        }

        // Store this as today's law of the day
        const insertStmt = db.prepare(`
          INSERT INTO law_of_the_day_history (law_id, featured_date)
          VALUES (?, ?)
        `);
        insertStmt.run(lawId, today);
      }

      // Fetch the full law details
      const lawStmt = db.prepare(baseSelect + ' AND l.id = ?');
      const laws = lawStmt.all(lawId);

      if (laws.length === 0) {
        return sendJson(res, 404, { error: 'Law not found' }, req);
      }

      const law = {
        ...laws[0],
        attributions: safeParseJsonArray(laws[0].attributions),
      };

      return sendJson(res, 200, { law, featured_date: today }, req);
    }

    // POST /api/laws or /api/v1/laws - Submit a new law for review
    if (req.method === 'POST' && normalizedPath === '/api/laws') {
      const identifier = getVoterIdentifier(req);
      const rateLimit = checkRateLimit(identifier, 'submit');

      if (!rateLimit.allowed) {
        return rateLimitExceeded(res, rateLimit.resetTime, req);
      }

      const body = await readBody(req);

      // Validate required fields
      if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
        return badRequest(res, 'Law text is required', req);
      }

      const text = body.text.trim();
      const title = body.title && typeof body.title === 'string' ? body.title.trim() : null;
      const author = body.author && typeof body.author === 'string' ? body.author.trim() : null;
      const email = body.email && typeof body.email === 'string' ? body.email.trim() : null;
      const categoryId = body.category_id && typeof body.category_id === 'string' ? parseInt(body.category_id) : null;

      // Validate text length
      if (text.length < 10) {
        return badRequest(res, 'Law text must be at least 10 characters', req);
      }

      if (text.length > 1000) {
        return badRequest(res, 'Law text must be less than 1000 characters', req);
      }

      // Validate category_id if provided
      if (categoryId && (!Number.isInteger(categoryId) || categoryId <= 0)) {
        return badRequest(res, 'Invalid category ID', req);
      }

      // Check if category exists if categoryId is provided
      if (categoryId) {
        const categoryStmt = db.prepare('SELECT id FROM categories WHERE id = ?');
        const categoryCheck = categoryStmt.get(categoryId);
        if (!categoryCheck) {
          return badRequest(res, 'Category not found', req);
        }
      }

      // Insert law with status 'in_review' - Using prepared statements (SQL injection safe)
      const insertLawStmt = db.prepare(insertLawSql);
      const lawResult = insertLawStmt.get(title, text);

      if (!lawResult) {
        throw new Error('Failed to insert law');
      }

      const lawId = lawResult.id;

      // Insert attribution if author or email provided
      if (author || email) {
        const contactType = email ? 'email' : 'text';
        const contactValue = email || null;
        const name = author || 'Anonymous';
        const insertAttrStmt = db.prepare(insertAttributionSql);
        insertAttrStmt.run(lawId, name, contactType, contactValue);
      }

      // Insert law_categories relationship if category provided
      if (categoryId) {
        const insertCatStmt = db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)');
        insertCatStmt.run(lawId, categoryId);
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
      }, req);
    }

    // POST /api/laws/:id/vote or /api/v1/laws/:id/vote - Vote on a law
    const voteMatch = /^\/api\/laws\/(\d+)\/vote$/.exec(normalizedPath);
    if (req.method === 'POST' && voteMatch) {
      const identifier = getVoterIdentifier(req);
      const rateLimit = checkRateLimit(identifier, 'vote');

      if (!rateLimit.allowed) {
        return rateLimitExceeded(res, rateLimit.resetTime, req);
      }

      const lawId = Number(voteMatch[1]);
      const body = await readBody(req);
      const voteType = body.vote_type;

      // Validate vote_type
      if (!voteType || !['up', 'down'].includes(voteType)) {
        return badRequest(res, 'vote_type must be "up" or "down"', req);
      }

      // Check if law exists and is published - Using prepared statements (SQL injection safe)
      const oneStmt = db.prepare(oneSql);
      const lawRows = oneStmt.all(lawId);
      if (!lawRows || lawRows.length === 0) {
        return notFound(res, req);
      }

      const voterIdentifier = getVoterIdentifier(req);

      // Insert or update vote (ON CONFLICT will handle duplicate votes) - Using prepared statements
      const insertVoteStmt = db.prepare(insertVoteSql);
      insertVoteStmt.run(lawId, voteType, voterIdentifier);

      // Get updated vote counts
      const updatedLaw = oneStmt.get(lawId);

      return sendJson(res, 200, {
        law_id: lawId,
        vote_type: voteType,
        upvotes: updatedLaw.upvotes,
        downvotes: updatedLaw.downvotes
      }, req);
    }

    // DELETE /api/laws/:id/vote - Remove vote on a law
    if (req.method === 'DELETE' && voteMatch) {
      const identifier = getVoterIdentifier(req);
      const rateLimit = checkRateLimit(identifier, 'vote');

      if (!rateLimit.allowed) {
        return rateLimitExceeded(res, rateLimit.resetTime, req);
      }

      const lawId = Number(voteMatch[1]);

      // Check if law exists and is published - Using prepared statements (SQL injection safe)
      const oneStmt = db.prepare(oneSql);
      const lawRows = oneStmt.all(lawId);
      if (!lawRows || lawRows.length === 0) {
        return notFound(res, req);
      }

      const voterIdentifier = getVoterIdentifier(req);

      // Delete the vote - Using prepared statements
      const deleteVoteStmt = db.prepare(deleteVoteSql);
      deleteVoteStmt.run(lawId, voterIdentifier);

      // Get updated vote counts
      const updatedLaw = oneStmt.get(lawId);

      return sendJson(res, 200, {
        law_id: lawId,
        upvotes: updatedLaw.upvotes,
        downvotes: updatedLaw.downvotes
      }, req);
    }

    // GET /api/categories or /api/v1/categories - Get all categories
    if (req.method === 'GET' && normalizedPath === '/api/categories') {
      const stmt = db.prepare(`
        SELECT id, slug, title, description
        FROM categories
        ORDER BY title;
      `);
      const categories = stmt.all();
      return sendJson(res, 200, { data: categories }, req);
    }

    // GET /api/categories/:id or /api/v1/categories/:id - Get a single category by ID
    const categoryIdMatch = normalizedPath.match(/^\/api\/categories\/(\d+)$/);
    if (req.method === 'GET' && categoryIdMatch) {
      const categoryId = parseInt(categoryIdMatch[1], 10);
      const stmt = db.prepare(`
        SELECT id, slug, title, description
        FROM categories
        WHERE id = ?;
      `);
      const category = stmt.get(categoryId);

      if (!category) {
        return sendJson(res, 404, { error: 'Category not found' }, req);
      }

      return sendJson(res, 200, category, req);
    }

    // GET /api/attributions or /api/v1/attributions - Get unique attribution names
    if (req.method === 'GET' && normalizedPath === '/api/attributions') {
      const stmt = db.prepare(`
        SELECT DISTINCT name
        FROM attributions
        WHERE name IS NOT NULL AND name != ''
        ORDER BY name;
      `);
      const attributions = stmt.all();
      return sendJson(res, 200, { data: attributions }, req);
    }

    // POST /api/share-calculation or /api/v1/share-calculation - Share calculation result via email
    if (req.method === 'POST' && normalizedPath === '/api/share-calculation') {
      const identifier = getVoterIdentifier(req);
      const rateLimit = checkRateLimit(identifier, 'email');

      if (!rateLimit.allowed) {
        return rateLimitExceeded(res, rateLimit.resetTime, req);
      }

      const body = await readBody(req);

      // Validate required fields
      if (!body.taskDescription || typeof body.taskDescription !== 'string' || !body.taskDescription.trim()) {
        return badRequest(res, 'Task description is required', req);
      }

      if (!body.senderName || typeof body.senderName !== 'string' || !body.senderName.trim()) {
        return badRequest(res, 'Sender name is required', req);
      }

      if (!body.senderEmail || typeof body.senderEmail !== 'string' || !body.senderEmail.trim()) {
        return badRequest(res, 'Sender email is required', req);
      }

      if (!body.recipientName || typeof body.recipientName !== 'string' || !body.recipientName.trim()) {
        return badRequest(res, 'Recipient name is required', req);
      }

      if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
        return badRequest(res, 'Recipient email address is required', req);
      }

      // Robust email validation using validator library
      if (!validator.isEmail(body.senderEmail.trim())) {
        return badRequest(res, 'Invalid sender email address', req);
      }

      if (!validator.isEmail(body.email.trim())) {
        return badRequest(res, 'Invalid recipient email address', req);
      }

      // Validate numeric inputs
      const requiredNumbers = ['urgency', 'complexity', 'importance', 'skill', 'frequency'];
      for (const field of requiredNumbers) {
        if (typeof body[field] !== 'number' || body[field] < 1 || body[field] > 9) {
          return badRequest(res, `${field} must be a number between 1 and 9`, req);
        }
      }

      if (!body.probability || typeof body.probability !== 'string') {
        return badRequest(res, 'Probability is required', req);
      }

      if (!body.interpretation || typeof body.interpretation !== 'string') {
        return badRequest(res, 'Interpretation is required', req);
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

        return sendJson(res, 200, { success: true, message: 'Calculation sent successfully' }, req);
      } catch (error) {
        return sendJson(res, 500, { error: error.message }, req);
      }
    }

    // GET /api/laws/:id or /api/v1/laws/:id - Get a single law
    const lawIdMatch = /^\/api\/laws\/(\d+)$/.exec(normalizedPath);
    if (req.method === 'GET' && lawIdMatch) {
      const id = Number(lawIdMatch[1]);
      const stmt = db.prepare(oneSql);
      const rows = stmt.all(id);
      if (!rows || rows.length === 0) return notFound(res, req);
      const r = rows[0];
      const data = { ...r, attributions: safeParseJsonArray(r.attributions) };
      return sendJson(res, 200, data, req);
    }

    // POST /api/facebook/data-deletion - Facebook data deletion callback (no versioning)
    // Required by Facebook when users delete their account or remove the app
    // https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
    if (req.method === 'POST' && pathname === '/api/facebook/data-deletion') {
      try {
        // Check if Facebook app secret is configured
        if (!FACEBOOK_APP_SECRET) {
          console.error('Facebook data deletion request received but FACEBOOK_APP_SECRET is not configured');
          return sendJson(res, 500, {
            error: 'Server configuration error: Facebook app secret not configured'
          }, req);
        }

        const body = await readBody(req);

        // Facebook sends a signed_request parameter
        if (!body.signed_request) {
          return badRequest(res, 'Missing signed_request parameter', req);
        }

        // Verify and parse the signed request
        const payload = parseSignedRequest(body.signed_request, FACEBOOK_APP_SECRET);

        if (!payload) {
          console.error('Failed to verify Facebook signed request');
          return sendJson(res, 400, {
            error: 'Invalid signed request'
          }, req);
        }

        // Extract Facebook user ID from the payload
        const facebookUserId = payload.user_id;

        if (!facebookUserId) {
          return badRequest(res, 'Missing user_id in signed request', req);
        }

        // Generate unique confirmation code
        const confirmationCode = generateConfirmationCode(facebookUserId);

        // Get requester IP for audit trail
        const ipAddress = getVoterIdentifier(req);

        // Store the deletion request in database for audit/compliance
        const stmt = db.prepare(`
          INSERT INTO facebook_data_deletion_requests
            (facebook_user_id, confirmation_code, status, request_payload, ip_address)
          VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
          facebookUserId,
          confirmationCode,
          'completed', // Mark as completed since we don't store Facebook user data
          JSON.stringify(payload),
          ipAddress
        );

        console.log(`Facebook data deletion request processed: user_id=${facebookUserId}, confirmation_code=${confirmationCode}`);

        // Return the required response format per Facebook documentation
        // url: Where users can check deletion status
        // confirmation_code: Unique identifier for this deletion request
        return sendJson(res, 200, {
          url: `${BASE_URL}/data-deletion/status?code=${confirmationCode}`,
          confirmation_code: confirmationCode
        }, req);

      } catch (error) {
        console.error('Error processing Facebook data deletion request:', error);
        return sendJson(res, 500, {
          error: 'Failed to process data deletion request'
        }, req);
      }
    }

    return notFound(res, req);
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: String(err && err.message || err) }, req);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nGracefully shutting down...');
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
  console.log(`Rate limiting enabled: ${JSON.stringify(RATE_LIMITS)}`);
});
