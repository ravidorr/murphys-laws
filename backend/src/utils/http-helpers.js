import { getCorsOrigin } from '../middleware/cors.mjs';

// Helper to read POST body
export function readBody(req) {
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
export function getVoterIdentifier(req) {
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

export function sendJson(res, status, obj, req = null) {
  const body = JSON.stringify(obj);
  // We need access to allowed origins here, but for now let's assume we pass it or handle it globally
  // For simplicity in this refactor, we'll assume a global or passed config.
  // Actually, let's use a default or environment variable if available, but since this is a helper,
  // we might need to pass the allowed origins.
  // However, to keep signature simple, let's rely on process.env for now as it was in the original code.
  
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['*'];

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

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

export function notFound(res, req = null) { sendJson(res, 404, { error: 'Not Found' }, req); }
export function badRequest(res, msg, req = null) { sendJson(res, 400, { error: msg || 'Bad Request' }, req); }

export function rateLimitExceeded(res, resetTime, req = null) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['*'];

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

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
