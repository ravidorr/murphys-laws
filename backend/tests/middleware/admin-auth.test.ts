import { describe, it, expect, afterEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  DEFAULT_BASE_URL,
  checkAdminAuth,
  getAdminAccess,
  getAdminApiState,
  getAdminOAuthConfig,
  getAdminOAuthState,
  getAdminSession,
  isAdminEnabled,
  passesCsrfCheck,
} from '../../src/middleware/admin-auth.ts';
import { SESSION_TTL_MS, createSessionToken } from '../../src/utils/admin-session.ts';

const TOKEN = 'a'.repeat(40);
const reqWith = (authorization?: string) => ({ headers: { authorization } }) as unknown as IncomingMessage;

describe('admin auth', () => {
  const original = process.env.ADMIN_API_TOKEN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = original;
    }
  });

  it('is disabled when the token is unset, empty or shorter than 32 characters', () => {
    delete process.env.ADMIN_API_TOKEN;
    expect(getAdminApiState()).toBe('disabled');
    expect(checkAdminAuth(reqWith(`Bearer ${TOKEN}`))).toBe('disabled');

    process.env.ADMIN_API_TOKEN = '';
    expect(getAdminApiState()).toBe('disabled');

    process.env.ADMIN_API_TOKEN = 'short';
    expect(getAdminApiState()).toBe('token_too_short');
    expect(checkAdminAuth(reqWith('Bearer short'))).toBe('disabled');
  });

  it('accepts the matching bearer token', () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    expect(getAdminApiState()).toBe('enabled');
    expect(checkAdminAuth(reqWith(`Bearer ${TOKEN}`))).toBe('ok');
  });

  it.each([
    ['missing header', undefined],
    ['no scheme', TOKEN],
    ['lowercase scheme', `bearer ${TOKEN}`],
    ['empty token', 'Bearer '],
    ['double space', `Bearer  ${TOKEN}`],
    ['wrong token', `Bearer ${'b'.repeat(40)}`],
    ['different length', `Bearer ${TOKEN}x`],
    ['multi-byte token of equal string length', `Bearer ${'é'.repeat(40)}`],
  ])('rejects %s', (_name, header) => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    expect(checkAdminAuth(reqWith(header))).toBe('unauthorized');
  });
});

const OAUTH_ENV = {
  GITHUB_OAUTH_CLIENT_ID: 'client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
  ADMIN_GITHUB_USERS: 'RaviDorr, someone-else',
  ADMIN_SESSION_SECRET: 's'.repeat(40),
  BASE_URL: 'https://murphys-laws.com',
};
const ENV_KEYS = ['ADMIN_API_TOKEN', ...Object.keys(OAUTH_ENV)];
const SECRET = OAUTH_ENV.ADMIN_SESSION_SECRET;

const requestWith = (headers: Record<string, string | undefined>, method = 'GET') =>
  ({ method, headers }) as unknown as IncomingMessage;
const cookieFor = (login: string, secret = SECRET) => `admin_session=${createSessionToken(secret, { login, id: 1 })}`;

describe('admin GitHub sign-in', () => {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  const configure = (over: Record<string, string | undefined> = {}) => {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries({ ...OAUTH_ENV, ...over })) {
      if (value !== undefined) process.env[key] = value;
    }
  };

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  describe('configuration', () => {
    it('is disabled when no sign-in setting is present', () => {
      configure({ GITHUB_OAUTH_CLIENT_ID: undefined, GITHUB_OAUTH_CLIENT_SECRET: undefined, ADMIN_GITHUB_USERS: undefined, ADMIN_SESSION_SECRET: undefined });
      expect(getAdminOAuthState()).toBe('disabled');
      expect(getAdminOAuthConfig()).toBeNull();
      expect(isAdminEnabled()).toBe(false);
    });

    it.each([
      ['client id', { GITHUB_OAUTH_CLIENT_ID: undefined }],
      ['client secret', { GITHUB_OAUTH_CLIENT_SECRET: undefined }],
      ['session secret', { ADMIN_SESSION_SECRET: undefined }],
      ['allowlist', { ADMIN_GITHUB_USERS: undefined }],
      ['allowlist that only holds separators', { ADMIN_GITHUB_USERS: ' , ,' }],
    ])('stays off when the %s is missing', (_name, over) => {
      configure(over);
      expect(getAdminOAuthState()).toBe('incomplete');
      expect(getAdminOAuthConfig()).toBeNull();
    });

    it('refuses a session secret shorter than 32 characters', () => {
      configure({ ADMIN_SESSION_SECRET: 'short' });
      expect(getAdminOAuthState()).toBe('session_secret_too_short');
      expect(getAdminOAuthConfig()).toBeNull();
    });

    it.each(['not a url', 'ftp://murphys-laws.com'])('refuses a BASE_URL that is not an http(s) URL (%s)', (BASE_URL) => {
      configure({ BASE_URL });
      expect(getAdminOAuthState()).toBe('invalid_base_url');
    });

    it('builds the config from the environment, lower-casing the allowlist and keeping only the origin of BASE_URL', () => {
      configure({ BASE_URL: ' https://staging.example.com/some/path ' });
      expect(getAdminOAuthState()).toBe('enabled');
      expect(getAdminOAuthConfig()).toEqual({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        allowedUsers: new Set(['ravidorr', 'someone-else']),
        sessionSecret: SECRET,
        baseUrl: 'https://staging.example.com',
        secureCookies: true,
      });
    });

    it('defaults BASE_URL to the production site and only drops the Secure flag for http', () => {
      configure({ BASE_URL: undefined });
      expect(getAdminOAuthConfig()?.baseUrl).toBe(DEFAULT_BASE_URL);
      configure({ BASE_URL: 'http://localhost:5175' });
      expect(getAdminOAuthConfig()).toMatchObject({ baseUrl: 'http://localhost:5175', secureCookies: false });
    });

    it('turns the admin on with only the sign-in configured, or only the token', () => {
      configure();
      expect(isAdminEnabled()).toBe(true);
      configure({ GITHUB_OAUTH_CLIENT_ID: undefined, ADMIN_API_TOKEN: TOKEN });
      expect(isAdminEnabled()).toBe(true);
    });
  });

  describe('request access', () => {
    const csrf = { 'x-admin-request': '1', origin: 'https://murphys-laws.com' };

    it('is disabled when neither the token nor the sign-in is configured', () => {
      configure({ ADMIN_SESSION_SECRET: undefined });
      expect(getAdminAccess(requestWith({ cookie: cookieFor('ravidorr') }))).toEqual({ status: 'disabled' });
      expect(checkAdminAuth(requestWith({}))).toBe('disabled');
    });

    it('accepts a session cookie for an allowlisted user without the token, ignoring the login case', () => {
      configure();
      expect(getAdminAccess(requestWith({ cookie: cookieFor('RAVIDORR') }))).toEqual({ status: 'ok', method: 'session', login: 'RAVIDORR' });
      expect(checkAdminAuth(requestWith({ cookie: `other=1; ${cookieFor('ravidorr')}` }))).toBe('ok');
    });

    it.each([
      ['no cookie', {}],
      ['another cookie', { cookie: 'theme=dark' }],
      ['a cookie signed with a different secret', { cookie: cookieFor('ravidorr', 'x'.repeat(40)) }],
      ['a user who is no longer on the allowlist', { cookie: cookieFor('removed-user') }],
    ])('rejects %s', (_name, headers) => {
      configure();
      expect(getAdminAccess(requestWith(headers))).toEqual({ status: 'unauthorized' });
      expect(checkAdminAuth(requestWith(headers))).toBe('unauthorized');
    });

    it('rejects an expired session', () => {
      configure();
      const expired = createSessionToken(SECRET, { login: 'ravidorr', id: 1 }, Date.now() - SESSION_TTL_MS - 1000);
      expect(getAdminAccess(requestWith({ cookie: `admin_session=${expired}` }))).toEqual({ status: 'unauthorized' });
    });

    it.each(['POST', 'DELETE'])('refuses a cookie-authenticated %s without the CSRF header and matching origin', (method) => {
      configure();
      const cookie = cookieFor('ravidorr');
      expect(getAdminAccess(requestWith({ cookie }, method))).toEqual({ status: 'forbidden' });
      expect(getAdminAccess(requestWith({ cookie, origin: 'https://murphys-laws.com' }, method))).toEqual({ status: 'forbidden' });
      expect(getAdminAccess(requestWith({ cookie, 'x-admin-request': '1' }, method))).toEqual({ status: 'forbidden' });
      expect(getAdminAccess(requestWith({ cookie, 'x-admin-request': '1', origin: 'https://evil.example.com' }, method))).toEqual({ status: 'forbidden' });
      expect(getAdminAccess(requestWith({ cookie, 'x-admin-request': 'yes', origin: 'https://murphys-laws.com' }, method))).toEqual({ status: 'forbidden' });
      expect(checkAdminAuth(requestWith({ cookie }, method))).toBe('unauthorized');
    });

    it('lets a cookie-authenticated write through with the CSRF header and matching origin', () => {
      configure();
      expect(getAdminAccess(requestWith({ cookie: cookieFor('ravidorr'), ...csrf }, 'POST'))).toMatchObject({ status: 'ok', method: 'session' });
    });

    it('does not require the CSRF header for reads', () => {
      configure();
      expect(getAdminAccess(requestWith({ cookie: cookieFor('ravidorr') }, 'GET')).status).toBe('ok');
      expect(getAdminAccess(requestWith({ cookie: cookieFor('ravidorr') }, 'HEAD')).status).toBe('ok');
    });

    it('treats a request with no method as a write', () => {
      configure();
      const req = { headers: { cookie: cookieFor('ravidorr') } } as unknown as IncomingMessage;
      expect(getAdminAccess(req)).toEqual({ status: 'forbidden' });
    });

    it('still accepts the bearer token, with no CSRF requirement, when the sign-in is also configured', () => {
      configure({ ADMIN_API_TOKEN: TOKEN });
      expect(getAdminAccess(requestWith({ authorization: `Bearer ${TOKEN}` }, 'POST'))).toEqual({ status: 'ok', method: 'bearer' });
    });

    it('falls back to the session when the bearer token is wrong, and ignores a bearer token that is too short to be enabled', () => {
      configure({ ADMIN_API_TOKEN: TOKEN });
      expect(getAdminAccess(requestWith({ authorization: 'Bearer wrong', cookie: cookieFor('ravidorr') })).status).toBe('ok');
      expect(getAdminAccess(requestWith({ authorization: 'Bearer wrong' }))).toEqual({ status: 'unauthorized' });

      configure({ ADMIN_API_TOKEN: 'short' });
      expect(getAdminAccess(requestWith({ authorization: 'Bearer short' }))).toEqual({ status: 'unauthorized' });
    });

    it('does not accept a cookie when only the token is configured', () => {
      configure({ ADMIN_API_TOKEN: TOKEN, GITHUB_OAUTH_CLIENT_ID: undefined });
      expect(getAdminAccess(requestWith({ cookie: cookieFor('ravidorr') }))).toEqual({ status: 'unauthorized' });
      expect(getAdminSession(requestWith({ cookie: cookieFor('ravidorr') }))).toBeNull();
    });
  });

  it('passesCsrfCheck compares against the configured origin', () => {
    configure({ BASE_URL: 'http://localhost:5175' });
    const config = getAdminOAuthConfig() as NonNullable<ReturnType<typeof getAdminOAuthConfig>>;
    expect(passesCsrfCheck(requestWith({ 'x-admin-request': '1', origin: 'http://localhost:5175' }), config)).toBe(true);
    expect(passesCsrfCheck(requestWith({ 'x-admin-request': '1', origin: 'https://murphys-laws.com' }), config)).toBe(false);
  });
});
