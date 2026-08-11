import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from 'node:http';
import { getCorsOrigin } from '../middleware/cors.ts';
import type { RateLimitResult } from '../middleware/rate-limit.ts';

function rateLimitHeaders(rateLimit: RateLimitResult | null): OutgoingHttpHeaders {
  if (!rateLimit || !Number.isFinite(rateLimit.limit)) {
    return {};
  }
  return {
    'X-RateLimit-Limit': String(rateLimit.limit),
    'X-RateLimit-Remaining': String(Math.max(0, rateLimit.remaining)),
    'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
  };
}

function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['*'];
}

// Helper to read POST body
export function readBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve((body ? JSON.parse(body) : {}) as T);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', (error) => reject(error));
  });
}

// Helper to get voter identifier (IP address for now, can be extended with session/user ID)
export function getVoterIdentifier(req: IncomingMessage): string {
  // Nginx overwrites this header with the connected client's address. Do not
  // trust X-Forwarded-For: callers can supply its leading values themselves.
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp;
  }
  if (Array.isArray(realIp) && realIp[0]) {
    return realIp[0];
  }

  // Fall back to socket address
  return req.socket.remoteAddress || 'unknown';
}

export function sendJson(
  res: ServerResponse,
  status: number,
  obj: unknown,
  req: IncomingMessage | null = null,
  rateLimit: RateLimitResult | null = null
): void {
  const body = JSON.stringify(obj);
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

  const headers: OutgoingHttpHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Link': '<https://murphys-laws.com/openapi.json>; rel="describedby"',
    ...rateLimitHeaders(rateLimit),
  };

  // Only add credentials header if not using wildcard
  if (origin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  res.writeHead(status, headers);
  res.end(body);
}

export function notFound(res: ServerResponse, req: IncomingMessage | null = null): void {
  sendJson(res, 404, { error: 'Not Found' }, req);
}

export function badRequest(res: ServerResponse, msg?: string, req: IncomingMessage | null = null): void {
  sendJson(res, 400, { error: msg || 'Bad Request' }, req);
}

export function rateLimitExceeded(
  res: ServerResponse,
  rateLimitOrResetTime: RateLimitResult | number,
  req: IncomingMessage | null = null
): void {
  const rateLimit: RateLimitResult =
    typeof rateLimitOrResetTime === 'number'
      ? { allowed: false, limit: Infinity, remaining: 0, resetTime: rateLimitOrResetTime }
      : rateLimitOrResetTime;

  const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

  const headers: OutgoingHttpHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': retryAfter,
    'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...(Number.isFinite(rateLimit.limit) ? { 'X-RateLimit-Limit': String(rateLimit.limit) } : {}),
    'X-RateLimit-Remaining': '0',
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
