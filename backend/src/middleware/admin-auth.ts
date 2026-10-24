import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export type AdminAuthResult = 'ok' | 'disabled' | 'unauthorized';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Checks the `Authorization: Bearer <token>` header against ADMIN_API_TOKEN.
 * Admin endpoints are disabled entirely when the env var is unset.
 */
export function checkAdminAuth(req: IncomingMessage): AdminAuthResult {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return 'disabled';
  }

  const header = req.headers.authorization;
  const match = typeof header === 'string' ? header.match(/^Bearer (.+)$/) : null;
  return match && safeEqual(match[1], expected) ? 'ok' : 'unauthorized';
}
