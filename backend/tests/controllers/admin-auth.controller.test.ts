import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AdminAuthController } from '../../src/controllers/admin-auth.controller.ts';
import { STATE_TTL_MS, createSessionToken, createStateToken } from '../../src/utils/admin-session.ts';

vi.mock('../../src/middleware/rate-limit.ts', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 9, resetTime: 0 })),
  peekRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 10, resetTime: 0 })),
}));
vi.mock('../../src/utils/http-helpers.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getVoterIdentifier: vi.fn(() => '127.0.0.1') };
});

import { checkRateLimit, peekRateLimit } from '../../src/middleware/rate-limit.ts';

const SECRET = 's'.repeat(40);
const ENV: Record<string, string> = {
  GITHUB_OAUTH_CLIENT_ID: 'client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
  ADMIN_GITHUB_USERS: 'ravidorr',
  ADMIN_SESSION_SECRET: SECRET,
  BASE_URL: 'https://murphys-laws.com',
};
const ENV_KEYS = [...Object.keys(ENV), 'ADMIN_API_TOKEN'];
const CALLBACK_URL = 'https://murphys-laws.com/api/v1/admin/auth/github/callback';

type FetchStub = ReturnType<typeof vi.fn>;
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

describe('AdminAuthController', () => {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  let fetchStub: FetchStub;
  let controller: AdminAuthController;
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  const req = (headers: Record<string, string> = {}, method = 'GET') => ({ method, headers }) as unknown as IncomingMessage;
  const asRes = () => res as unknown as ServerResponse;
  const status = () => res.writeHead.mock.calls[0][0];
  const headers = () => res.writeHead.mock.calls[0][1] as Record<string, string | string[]>;
  const body = () => String(res.end.mock.calls[0][0]);
  const json = () => JSON.parse(body());
  const stateCookie = () => {
    const { state, token } = createStateToken(SECRET);
    return { state, cookie: `admin_oauth_state=${token}` };
  };

  /** GitHub stub: the token endpoint and the user endpoint answer with the given bodies. */
  const github = (token: unknown = { access_token: 'gho_abc' }, user: unknown = { login: 'RaviDorr', id: 42 }) => {
    fetchStub.mockImplementation(async (url: string) => (url.includes('login/oauth/access_token') ? reply(token) : reply(user)));
  };
  const callback = (query: Record<string, string>, cookie?: string) =>
    controller.callback(req(cookie ? { cookie } : {}), asRes(), { query });

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, ENV);
    fetchStub = vi.fn();
    controller = new AdminAuthController(fetchStub as unknown as typeof fetch);
    res = { writeHead: vi.fn(), end: vi.fn() };
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, limit: 10, remaining: 9, resetTime: 0 });
    vi.mocked(peekRateLimit).mockClear();
    vi.mocked(peekRateLimit).mockReturnValue({ allowed: true, limit: 10, remaining: 10, resetTime: 0 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  it('uses the global fetch unless one is injected', () => {
    expect(new AdminAuthController()).toBeInstanceOf(AdminAuthController);
  });

  describe('login', () => {
    it('returns 404 when GitHub sign-in is not configured', () => {
      delete process.env.GITHUB_OAUTH_CLIENT_ID;
      controller.login(req(), asRes());
      expect(status()).toBe(404);
    });

    it('redirects to GitHub with the callback URL and a random state, and remembers the state in a short-lived cookie', () => {
      controller.login(req(), asRes());

      expect(status()).toBe(302);
      const location = new URL(headers().Location as string);
      expect(`${location.origin}${location.pathname}`).toBe('https://github.com/login/oauth/authorize');
      expect(location.searchParams.get('client_id')).toBe('client-id');
      expect(location.searchParams.get('redirect_uri')).toBe(CALLBACK_URL);
      expect(location.searchParams.get('allow_signup')).toBe('false');
      expect(location.searchParams.get('scope')).toBeNull();
      expect(location.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);

      const cookie = headers()['Set-Cookie'] as string;
      expect(cookie).toContain('admin_oauth_state=');
      expect(cookie).toContain('Path=/api/v1/admin/auth');
      expect(cookie).toContain(`Max-Age=${STATE_TTL_MS / 1000}`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
      expect(headers()['Cache-Control']).toBe('no-store');
    });

    it('builds the callback URL from BASE_URL and sends no Secure cookie over plain http', () => {
      process.env.BASE_URL = 'http://localhost:5175';
      controller.login(req(), asRes());
      expect(new URL(headers().Location as string).searchParams.get('redirect_uri')).toBe('http://localhost:5175/api/v1/admin/auth/github/callback');
      expect(headers()['Set-Cookie']).not.toContain('Secure');
    });

    it('uses a different state each time', () => {
      controller.login(req(), asRes());
      const first = new URL(headers().Location as string).searchParams.get('state');
      res.writeHead.mockClear();
      controller.login(req(), asRes());
      expect(new URL(headers().Location as string).searchParams.get('state')).not.toBe(first);
    });
  });

  describe('callback', () => {
    it('returns 404 when GitHub sign-in is not configured', async () => {
      delete process.env.ADMIN_SESSION_SECRET;
      await callback({ code: 'c', state: 's' });
      expect(status()).toBe(404);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('signs in an allowlisted user: session cookie for eight hours, state cookie cleared, redirect to the admin page', async () => {
      github();
      const { state, cookie } = stateCookie();
      await callback({ code: 'the-code', state }, cookie);

      expect(status()).toBe(302);
      expect(headers().Location).toBe('/admin');
      expect(headers()['Cache-Control']).toBe('no-store');
      const [session, clearedState] = headers()['Set-Cookie'] as string[];
      expect(session).toMatch(/^admin_session=[\w-]+\.[\w-]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/);
      expect(clearedState).toBe('admin_oauth_state=; Path=/api/v1/admin/auth; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('exchanges the code with the client credentials and then reads the user with the access token', async () => {
      github();
      const { state, cookie } = stateCookie();
      await callback({ code: 'the-code', state }, cookie);

      const [tokenUrl, tokenInit] = fetchStub.mock.calls[0];
      expect(tokenUrl).toBe('https://github.com/login/oauth/access_token');
      expect(tokenInit.method).toBe('POST');
      expect(JSON.parse(tokenInit.body)).toEqual({
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'the-code',
        redirect_uri: CALLBACK_URL,
      });
      expect(tokenInit.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'murphys-laws-admin' });
      expect(tokenInit.signal).toBeInstanceOf(AbortSignal);

      const [userUrl, userInit] = fetchStub.mock.calls[1];
      expect(userUrl).toBe('https://api.github.com/user');
      expect(userInit.headers).toMatchObject({ Authorization: 'Bearer gho_abc', 'User-Agent': 'murphys-laws-admin' });
    });

    it('rejects a login that is not on the allowlist with 403 and counts it as a failed login', async () => {
      github(undefined, { login: 'stranger', id: 7 });
      const { state, cookie } = stateCookie();
      await callback({ code: 'c', state }, cookie);

      expect(status()).toBe(403);
      expect(headers()['Set-Cookie']).toContain('admin_oauth_state=; ');
      expect(headers()['Set-Cookie']).not.toContain('admin_session');
      expect(body()).toContain('not allowed to use the admin');
      expect(headers()['Content-Type']).toBe('text/html; charset=utf-8');
      expect(checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'admin-fail');
      expect(console.warn).toHaveBeenCalledWith('Admin sign-in rejected for GitHub user stranger');
    });

    it('answers 429 instead of the sign-in error when failed logins exceed the limit', async () => {
      vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, limit: 10, remaining: 0, resetTime: Date.now() + 1000 });
      await callback({ code: 'c', state: 'wrong' }, stateCookie().cookie);
      expect(status()).toBe(429);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('refuses with 429 before contacting GitHub when the client is already over the failed-login limit', async () => {
      github();
      vi.mocked(peekRateLimit).mockReturnValue({ allowed: false, limit: 10, remaining: 0, resetTime: Date.now() + 1000 });
      const { state, cookie } = stateCookie();
      await callback({ code: 'c', state }, cookie);

      expect(status()).toBe(429);
      expect(peekRateLimit).toHaveBeenCalledWith('127.0.0.1', 'admin-fail');
      expect(fetchStub).not.toHaveBeenCalled();
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('still checks the state before looking at the quota, so a bad state never reaches GitHub either way', async () => {
      await callback({ code: 'c', state: 'a'.repeat(32) }, stateCookie().cookie);
      expect(status()).toBe(400);
      expect(peekRateLimit).not.toHaveBeenCalled();
    });

    it.each([
      ['GitHub reports an error', { error: 'access_denied' }, 'cancelled'],
      ['the code is missing', { state: 'x' }, 'not valid'],
      ['the state is missing', { code: 'x' }, 'not valid'],
      ['the code is empty', { code: '', state: 'x' }, 'not valid'],
      ['the code is far too long', { code: 'x'.repeat(513), state: 'x' }, 'not valid'],
    ])('rejects with 400 when %s, before talking to GitHub', async (_name, query, message) => {
      await callback(query as Record<string, string>, stateCookie().cookie);
      expect(status()).toBe(400);
      expect(body()).toContain(message);
      expect(checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'admin-fail');
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('rejects a state that does not match the cookie', async () => {
      const { cookie } = stateCookie();
      await callback({ code: 'c', state: 'a'.repeat(32) }, cookie);
      expect(status()).toBe(400);
      expect(body()).toContain('expired or did not start here');
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('rejects a callback that has no state cookie, a state cookie signed by someone else, or an expired one', async () => {
      await callback({ code: 'c', state: 'a'.repeat(32) });
      expect(status()).toBe(400);

      res.writeHead.mockClear();
      res.end.mockClear();
      const forged = createStateToken('x'.repeat(40));
      await callback({ code: 'c', state: forged.state }, `admin_oauth_state=${forged.token}`);
      expect(status()).toBe(400);

      res.writeHead.mockClear();
      res.end.mockClear();
      const expired = createStateToken(SECRET, Date.now() - STATE_TTL_MS - 1000);
      await callback({ code: 'c', state: expired.state }, `admin_oauth_state=${expired.token}`);
      expect(status()).toBe(400);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('rejects a session token presented as the state cookie', async () => {
      const session = createSessionToken(SECRET, { login: 'ravidorr', id: 1 });
      await callback({ code: 'c', state: 'x' }, `admin_oauth_state=${session}`);
      expect(status()).toBe(400);
    });

    describe('when GitHub misbehaves', () => {
      const fail = async () => {
        const { state, cookie } = stateCookie();
        await callback({ code: 'c', state }, cookie);
        expect(status()).toBe(502);
        expect(body()).toContain('GitHub sign-in failed');
        expect(headers()['Set-Cookie']).toContain('admin_oauth_state=; ');
        expect(checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'admin-fail');
      };

      it('answers 502 when GitHub cannot be reached', async () => {
        fetchStub.mockRejectedValue(new TypeError('network down'));
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: GitHub could not be reached');
      });

      it('answers 502 when GitHub answers with an error status', async () => {
        fetchStub.mockResolvedValue(reply({}, 500));
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: GitHub answered 500');
      });

      it('answers 502 and logs the reason when GitHub refuses the code, without leaking the code or secret', async () => {
        github({ error: 'bad_verification_code' });
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: GitHub did not return an access token (bad_verification_code)');
        expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('client-secret');
      });

      it('answers 502 when GitHub returns no access token and no error', async () => {
        github({});
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: GitHub did not return an access token (no error given)');
      });

      it.each([
        ['has no login', { id: 1 }],
        ['has a non-string login', { login: 5, id: 1 }],
        ['has a login with characters GitHub does not allow', { login: 'bad login\n', id: 1 }],
        ['has a login that is too long', { login: 'a'.repeat(40), id: 1 }],
        ['has a login starting with a hyphen', { login: '-bad', id: 1 }],
        ['has no numeric id', { login: 'ravidorr', id: '1' }],
      ])('answers 502 when the user %s', async (_name, user) => {
        github(undefined, user);
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: GitHub returned an unexpected user');
      });

      it('answers 502 when the reply is not JSON, and logs only that it was unexpected', async () => {
        fetchStub.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
        await fail();
        expect(console.error).toHaveBeenCalledWith('Admin GitHub sign-in failed: unexpected error');
      });
    });
  });

  describe('session', () => {
    it('returns 404 when the admin is not enabled at all', () => {
      for (const key of ENV_KEYS) delete process.env[key];
      controller.session(req(), asRes());
      expect(status()).toBe(404);
    });

    it('reports the signed-in user', () => {
      const cookie = `admin_session=${createSessionToken(SECRET, { login: 'RaviDorr', id: 1 })}`;
      controller.session(req({ cookie }), asRes());
      expect(status()).toBe(200);
      expect(json()).toEqual({ authenticated: true, login: 'RaviDorr', oauth: true });
      expect(headers()['Cache-Control']).toBe('no-store');
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('answers 200 without counting a failed login when nobody is signed in, and says sign-in is offered', () => {
      controller.session(req(), asRes());
      expect(status()).toBe(200);
      expect(json()).toEqual({ authenticated: false, oauth: true });
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('says sign-in is not offered when only the API token is configured', () => {
      for (const key of ENV_KEYS) delete process.env[key];
      process.env.ADMIN_API_TOKEN = 't'.repeat(40);
      controller.session(req(), asRes());
      expect(status()).toBe(200);
      expect(json()).toEqual({ authenticated: false, oauth: false });
    });
  });

  describe('logout', () => {
    const csrf = { 'x-admin-request': '1', origin: 'https://murphys-laws.com' };

    it('returns 404 when the admin is not enabled at all', () => {
      for (const key of ENV_KEYS) delete process.env[key];
      controller.logout(req({}, 'POST'), asRes());
      expect(status()).toBe(404);
    });

    it('clears the session cookie', () => {
      controller.logout(req(csrf, 'POST'), asRes());
      expect(status()).toBe(200);
      expect(json()).toEqual({ ok: true });
      expect(headers()['Set-Cookie']).toBe('admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure');
    });

    it('refuses without the CSRF header or from another origin, and leaves the cookie alone', () => {
      controller.logout(req({ origin: 'https://murphys-laws.com' }, 'POST'), asRes());
      expect(status()).toBe(403);
      expect(headers()['Set-Cookie']).toBeUndefined();

      res.writeHead.mockClear();
      res.end.mockClear();
      controller.logout(req({ ...csrf, origin: 'https://evil.example.com' }, 'POST'), asRes());
      expect(status()).toBe(403);
    });

    it('succeeds without a cookie to clear when only the API token is configured', () => {
      for (const key of ENV_KEYS) delete process.env[key];
      process.env.ADMIN_API_TOKEN = 't'.repeat(40);
      controller.logout(req({}, 'POST'), asRes());
      expect(status()).toBe(200);
      expect(headers()['Set-Cookie']).toBeUndefined();
    });
  });
});
