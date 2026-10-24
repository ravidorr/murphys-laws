import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export type AdminAuthResult = 'ok' | 'disabled' | 'unauthorized';
export type AdminApiState = 'enabled' | 'disabled' | 'token_too_short';

/** Tokens shorter than this are refused so a weak secret never protects moderation. */
export const MIN_ADMIN_TOKEN_LENGTH = 32;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function getAdminApiState(): AdminApiState {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return 'disabled';
  }
  return token.length < MIN_ADMIN_TOKEN_LENGTH ? 'token_too_short' : 'enabled';
}

/**
 * Checks the `Authorization: Bearer <token>` header against ADMIN_API_TOKEN.
 * Admin endpoints are disabled entirely (an empty or too-short token counts as unset).
 */
export function checkAdminAuth(req: IncomingMessage): AdminAuthResult {
  if (getAdminApiState() !== 'enabled') {
    return 'disabled';
  }

  const header = req.headers.authorization;
  const match = typeof header === 'string' ? header.match(/^Bearer (.+)$/) : null;
  return match && safeEqual(match[1], process.env.ADMIN_API_TOKEN as string) ? 'ok' : 'unauthorized';
}
