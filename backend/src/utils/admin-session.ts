import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * Stateless signed tokens for the admin GitHub sign-in. Nothing is stored server side: a token is
 * `base64url(json).hmac` and is only valid with the ADMIN_SESSION_SECRET that signed it, so rotating
 * the secret signs everyone out. The purpose is part of the signed text, so a sign-in state token
 * can never be replayed as a session.
 */

export const SESSION_COOKIE = 'admin_session';
export const STATE_COOKIE = 'admin_oauth_state';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const STATE_TTL_MS = 10 * 60 * 1000;

type Purpose = 'session' | 'state';

export interface AdminSession {
  login: string;
  id: number;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function mac(secret: string, purpose: Purpose, body: string): string {
  return createHmac('sha256', secret).update(`${purpose}.${body}`).digest('base64url');
}

function sign(secret: string, purpose: Purpose, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(secret, purpose, body)}`;
}

/** Returns the payload of a token that carries a valid signature and has not expired, otherwise null. */
function verify(secret: string, purpose: Purpose, token: string | undefined, now: number): Record<string, unknown> | null {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 2 || !safeEqual(parts[1], mac(secret, purpose, parts[0]))) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.exp === 'number' && record.exp > now ? record : null;
}

export function createSessionToken(secret: string, session: AdminSession, now = Date.now()): string {
  return sign(secret, 'session', { login: session.login, id: session.id, exp: now + SESSION_TTL_MS });
}

export function readSessionToken(secret: string, token: string | undefined, now = Date.now()): AdminSession | null {
  const payload = verify(secret, 'session', token, now);
  if (!payload || typeof payload.login !== 'string' || typeof payload.id !== 'number') {
    return null;
  }
  return { login: payload.login, id: payload.id };
}

/** A random OAuth `state` value plus the signed cookie value that lets the callback check it came back unchanged. */
export function createStateToken(secret: string, now = Date.now()): { state: string; token: string } {
  const state = randomBytes(16).toString('hex');
  return { state, token: sign(secret, 'state', { state, exp: now + STATE_TTL_MS }) };
}

export function readStateToken(secret: string, token: string | undefined, now = Date.now()): string | null {
  const payload = verify(secret, 'state', token, now);
  return payload && typeof payload.state === 'string' ? payload.state : null;
}

export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    const name = part.slice(0, Math.max(separator, 0)).trim();
    if (name) {
      cookies.set(name, part.slice(separator + 1).trim());
    }
  }
  return cookies;
}

export interface CookieOptions {
  path: string;
  maxAgeSeconds: number;
  sameSite: 'Strict' | 'Lax';
  secure: boolean;
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const attributes = [`${name}=${value}`, `Path=${options.path}`, 'HttpOnly', `SameSite=${options.sameSite}`, `Max-Age=${options.maxAgeSeconds}`];
  if (options.secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}
