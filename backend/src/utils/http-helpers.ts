import type {
  IncomingHttpHeaders,
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from 'node:http';
import { getCorsOrigin } from '../middleware/cors.ts';

function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['*'];
}

function getForwardedFor(headers: IncomingHttpHeaders): string | null {
  const forwardedFor = headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }
  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].split(',')[0]?.trim() ?? null;
  }
  return null;
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
  // Try to get real IP from proxy headers first
  const forwardedFor = getForwardedFor(req.headers);
  if (forwardedFor) {
    return forwardedFor;
  }

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
  req: IncomingMessage | null = null
): void {
  const body = JSON.stringify(obj);
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

  const headers: OutgoingHttpHeaders = {
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

export function notFound(res: ServerResponse, req: IncomingMessage | null = null): void {
  sendJson(res, 404, { error: 'Not Found' }, req);
}

export function badRequest(res: ServerResponse, msg?: string, req: IncomingMessage | null = null): void {
  sendJson(res, 400, { error: msg || 'Bad Request' }, req);
}

export function rateLimitExceeded(
  res: ServerResponse,
  resetTime: number,
  req: IncomingMessage | null = null
): void {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const origin = req ? getCorsOrigin(req, ALLOWED_ORIGINS) : '*';

  const headers: OutgoingHttpHeaders = {
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
