import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE, parseCookies, readSessionToken, safeEqual, type AdminSession } from '../utils/admin-session.ts';

export type AdminAuthResult = 'ok' | 'disabled' | 'unauthorized';
export type AdminApiState = 'enabled' | 'disabled' | 'token_too_short';
export type AdminOAuthState = 'enabled' | 'disabled' | 'incomplete' | 'session_secret_too_short' | 'invalid_base_url';

export type AdminAccess =
  | { status: 'ok'; method: 'bearer' | 'session'; login?: string }
  | { status: 'disabled' | 'unauthorized' | 'forbidden' };

/** Tokens and session secrets shorter than this are refused so a weak secret never protects moderation. */
export const MIN_ADMIN_TOKEN_LENGTH = 32;
export const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;
export const DEFAULT_BASE_URL = 'https://murphys-laws.com';
/** Header that cookie-authenticated writes must carry; a cross-site form or image request cannot add it. */
export const CSRF_HEADER = 'x-admin-request';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export interface AdminOAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedUsers: ReadonlySet<string>;
  sessionSecret: string;
  /** Origin the browser uses to reach the site; the OAuth callback and the CSRF Origin check are built from it. */
  baseUrl: string;
  secureCookies: boolean;
}

export function getAdminApiState(): AdminApiState {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return 'disabled';
  }
  return token.length < MIN_ADMIN_TOKEN_LENGTH ? 'token_too_short' : 'enabled';
}

function parseAllowedUsers(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((login) => login.trim().toLowerCase())
      .filter(Boolean),
  );
}

function resolveBaseUrl(): string | null {
  const configured = process.env.BASE_URL?.trim();
  if (!configured) {
    return DEFAULT_BASE_URL;
  }
  try {
    const url = new URL(configured);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * GitHub sign-in is enabled only when every setting is present and valid. A partly configured
 * sign-in stays off (reported as `incomplete` or the specific problem) rather than half working.
 */
export function getAdminOAuthState(): AdminOAuthState {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const users = process.env.ADMIN_GITHUB_USERS;

  if (!clientId && !clientSecret && !sessionSecret && !users) {
    return 'disabled';
  }
  if (!clientId || !clientSecret || !sessionSecret || parseAllowedUsers(users).size === 0) {
    return 'incomplete';
  }
  if (sessionSecret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) {
    return 'session_secret_too_short';
  }
  return resolveBaseUrl() === null ? 'invalid_base_url' : 'enabled';
}

export function getAdminOAuthConfig(): AdminOAuthConfig | null {
  if (getAdminOAuthState() !== 'enabled') {
    return null;
  }
  const baseUrl = resolveBaseUrl() as string;
  return {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
    allowedUsers: parseAllowedUsers(process.env.ADMIN_GITHUB_USERS),
    sessionSecret: process.env.ADMIN_SESSION_SECRET as string,
    baseUrl,
    secureCookies: baseUrl.startsWith('https:'),
  };
}

/** The admin is on when either a valid API token or the GitHub sign-in is configured. */
export function isAdminEnabled(): boolean {
  return getAdminApiState() === 'enabled' || getAdminOAuthState() === 'enabled';
}

/**
 * Cookie-authenticated writes must come from the admin page itself: the custom header cannot be
 * sent cross-site without a CORS preflight, and the Origin must be this site's own origin.
 */
export function passesCsrfCheck(req: IncomingMessage, config: AdminOAuthConfig): boolean {
  return req.headers[CSRF_HEADER] === '1' && req.headers.origin === config.baseUrl;
}

/** The signed-in GitHub user of a request, if it carries a valid, unexpired session for a user still on the allowlist. */
export function getAdminSession(req: IncomingMessage): AdminSession | null {
  const config = getAdminOAuthConfig();
  if (!config) {
    return null;
  }
  const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE);
  const session = readSessionToken(config.sessionSecret, token);
  return session && config.allowedUsers.has(session.login.toLowerCase()) ? session : null;
}

/**
 * Decides whether a request may use the admin API. A matching `Authorization: Bearer <token>` is
 * accepted as before (for the CLI, MCP and as a fallback). Otherwise a valid session cookie is
 * accepted, and for anything other than GET or HEAD it must also pass the CSRF check.
 */
export function getAdminAccess(req: IncomingMessage): AdminAccess {
  if (!isAdminEnabled()) {
    return { status: 'disabled' };
  }

  if (getAdminApiState() === 'enabled') {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? header.match(/^Bearer (.+)$/) : null;
    if (match && safeEqual(match[1], process.env.ADMIN_API_TOKEN as string)) {
      return { status: 'ok', method: 'bearer' };
    }
  }

  const session = getAdminSession(req);
  if (!session) {
    return { status: 'unauthorized' };
  }
  if (!SAFE_METHODS.has(req.method ?? '') && !passesCsrfCheck(req, getAdminOAuthConfig() as AdminOAuthConfig)) {
    return { status: 'forbidden' };
  }
  return { status: 'ok', method: 'session', login: session.login };
}

/**
 * Coarse check for callers that only need to know whether the admin is enabled or a request is
 * authenticated. Admin endpoints are disabled entirely when neither an API token nor the GitHub
 * sign-in is configured (an empty or too-short token counts as unset).
 */
export function checkAdminAuth(req: IncomingMessage): AdminAuthResult {
  const access = getAdminAccess(req);
  if (access.status === 'ok') {
    return 'ok';
  }
  return access.status === 'disabled' ? 'disabled' : 'unauthorized';
}
