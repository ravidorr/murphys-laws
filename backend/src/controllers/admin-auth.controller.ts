import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import {
  getAdminOAuthConfig,
  getAdminSession,
  isAdminEnabled,
  passesCsrfCheck,
  type AdminOAuthConfig,
} from '../middleware/admin-auth.ts';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  STATE_COOKIE,
  STATE_TTL_MS,
  createSessionToken,
  createStateToken,
  parseCookies,
  readStateToken,
  safeEqual,
  serializeCookie,
} from '../utils/admin-session.ts';
import { getVoterIdentifier, notFound, rateLimitExceeded, sendJson } from '../utils/http-helpers.ts';

const AUTH_PATH = '/api/v1/admin/auth';
const ADMIN_PAGE = '/admin';
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_TIMEOUT_MS = 10_000;
const MAX_CODE_LENGTH = 512;
// GitHub logins are 1-39 letters, digits or single hyphens; anything else is not a login and is never logged.
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NO_STORE = { 'Cache-Control': 'no-store' };
const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

type FetchLike = typeof fetch;

class GitHubSignInError extends Error {}

interface GitHubUser {
  login: string;
  id: number;
}

function stateCookie(config: AdminOAuthConfig, value: string, maxAgeSeconds: number): string {
  return serializeCookie(STATE_COOKIE, value, { path: AUTH_PATH, maxAgeSeconds, sameSite: 'Lax', secure: config.secureCookies });
}

function sessionCookie(config: AdminOAuthConfig, value: string, maxAgeSeconds: number): string {
  return serializeCookie(SESSION_COOKIE, value, { path: '/', maxAgeSeconds, sameSite: 'Strict', secure: config.secureCookies });
}

/**
 * Handles "Sign in with GitHub" for the admin page: send the browser to GitHub, check the answer
 * comes back with the same `state`, and turn an allowlisted GitHub login into a signed session cookie.
 * The existing ADMIN_API_TOKEN keeps working alongside it (see middleware/admin-auth.ts).
 */
export class AdminAuthController {
  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl: FetchLike = fetch) {
    this.fetchImpl = fetchImpl;
  }

  /** GET /api/v1/admin/auth/github: remember a random state in a cookie and redirect to GitHub. */
  login(req: IncomingMessage, res: ServerResponse): void {
    const config = getAdminOAuthConfig();
    if (!config) {
      return notFound(res, req);
    }

    const { state, token } = createStateToken(config.sessionSecret);
    const location = new URL(GITHUB_AUTHORIZE_URL);
    location.searchParams.set('client_id', config.clientId);
    location.searchParams.set('redirect_uri', `${config.baseUrl}${AUTH_PATH}/github/callback`);
    location.searchParams.set('state', state);
    location.searchParams.set('allow_signup', 'false');

    res.writeHead(302, {
      Location: location.toString(),
      'Set-Cookie': stateCookie(config, token, STATE_TTL_MS / 1000),
      ...NO_STORE,
    });
    res.end();
  }

  /** GET /api/v1/admin/auth/github/callback: verify state, exchange the code, check the allowlist, start the session. */
  async callback(req: IncomingMessage, res: ServerResponse, parsed: { query: ParsedUrlQuery }): Promise<void> {
    const config = getAdminOAuthConfig();
    if (!config) {
      return notFound(res, req);
    }

    const reject = (status: number, message: string) => this.reject(req, res, config, status, message);
    const { code, state, error } = parsed.query;
    if (error) {
      return reject(400, 'GitHub sign-in was cancelled.');
    }
    if (typeof code !== 'string' || !code || code.length > MAX_CODE_LENGTH || typeof state !== 'string' || !state) {
      return reject(400, 'The sign-in response was not valid. Please try again.');
    }

    const expectedState = readStateToken(config.sessionSecret, parseCookies(req.headers.cookie).get(STATE_COOKIE));
    if (!expectedState || !safeEqual(expectedState, state)) {
      return reject(400, 'The sign-in expired or did not start here. Please try again.');
    }

    let user: GitHubUser;
    try {
      user = await this.fetchGitHubUser(config, code);
    } catch (failure) {
      console.error(`Admin GitHub sign-in failed: ${failure instanceof GitHubSignInError ? failure.message : 'unexpected error'}`);
      return reject(502, 'GitHub sign-in failed. Please try again.');
    }

    if (!config.allowedUsers.has(user.login.toLowerCase())) {
      console.warn(`Admin sign-in rejected for GitHub user ${user.login}`);
      return reject(403, 'This GitHub account is not allowed to use the admin.');
    }

    res.writeHead(302, {
      Location: ADMIN_PAGE,
      'Set-Cookie': [
        sessionCookie(config, createSessionToken(config.sessionSecret, user), SESSION_TTL_MS / 1000),
        stateCookie(config, '', 0),
      ],
      ...NO_STORE,
    });
    res.end();
  }

  /** GET /api/v1/admin/auth/session: who is signed in (if anyone), and whether the page should offer GitHub sign-in. */
  session(req: IncomingMessage, res: ServerResponse): void {
    if (!isAdminEnabled()) {
      return notFound(res, req);
    }

    // Always 200: "nobody is signed in" is an answer, not a failed login, and a 401 would show as a console error.
    const session = getAdminSession(req);
    const body = session
      ? { authenticated: true, login: session.login, oauth: true }
      : { authenticated: false, oauth: getAdminOAuthConfig() !== null };
    sendJson(res, 200, body, req, null, NO_STORE);
  }

  /** POST /api/v1/admin/auth/logout: clear the session cookie. Needs the same CSRF header and origin as other writes. */
  logout(req: IncomingMessage, res: ServerResponse): void {
    if (!isAdminEnabled()) {
      return notFound(res, req);
    }

    const config = getAdminOAuthConfig();
    if (!config) {
      return sendJson(res, 200, { ok: true }, req, null, NO_STORE);
    }
    if (!passesCsrfCheck(req, config)) {
      return sendJson(res, 403, { error: 'Forbidden' }, req, null, NO_STORE);
    }
    sendJson(res, 200, { ok: true }, req, null, { ...NO_STORE, 'Set-Cookie': sessionCookie(config, '', 0) });
  }

  private async fetchGitHubUser(config: AdminOAuthConfig, code: string): Promise<GitHubUser> {
    const accessToken = await this.exchangeCode(config, code);
    const response = await this.callGitHub(GITHUB_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    const user = (await response.json()) as { login?: unknown; id?: unknown };
    if (typeof user.login !== 'string' || !GITHUB_LOGIN_PATTERN.test(user.login) || typeof user.id !== 'number') {
      throw new GitHubSignInError('GitHub returned an unexpected user');
    }
    return { login: user.login, id: user.id };
  }

  private async exchangeCode(config: AdminOAuthConfig, code: string): Promise<string> {
    const response = await this.callGitHub(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${config.baseUrl}${AUTH_PATH}/github/callback`,
      }),
    });
    const body = (await response.json()) as { access_token?: unknown; error?: unknown };
    if (typeof body.access_token !== 'string' || !body.access_token) {
      throw new GitHubSignInError(`GitHub did not return an access token (${typeof body.error === 'string' ? body.error : 'no error given'})`);
    }
    return body.access_token;
  }

  private async callGitHub(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: { 'User-Agent': 'murphys-laws-admin', ...init.headers },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
    } catch {
      throw new GitHubSignInError('GitHub could not be reached');
    }
    if (!response.ok) {
      throw new GitHubSignInError(`GitHub answered ${response.status}`);
    }
    return response;
  }

  /** Failed sign-ins count toward the same limit as wrong API tokens; the sign-in state is cleared either way. */
  private reject(req: IncomingMessage, res: ServerResponse, config: AdminOAuthConfig, status: number, message: string): void {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'admin-fail');
    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit, req);
    }

    console.warn(`Admin GitHub sign-in refused (${status}) from ${identifier}`);
    res.writeHead(status, { ...PAGE_HEADERS, 'Set-Cookie': stateCookie(config, '', 0) });
    res.end(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Admin sign-in</title>` +
        `<body style="font-family:sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem"><p>${message}</p><p><a href="${ADMIN_PAGE}">Back to the admin page</a></p></body></html>`,
    );
  }
}
