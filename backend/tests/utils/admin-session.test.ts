import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  SESSION_TTL_MS,
  STATE_TTL_MS,
  createSessionToken,
  createStateToken,
  parseCookies,
  readSessionToken,
  readStateToken,
  safeEqual,
  serializeCookie,
} from '../../src/utils/admin-session.ts';

const SECRET = 's'.repeat(40);
const OTHER_SECRET = 'o'.repeat(40);
const NOW = 1_800_000_000_000;
const user = { login: 'ravidorr', id: 42 };

/** A token with a correct signature for an arbitrary body, so tests can feed in payloads the module would never create. */
const signed = (body: string, purpose = 'session') => `${body}.${createHmac('sha256', SECRET).update(`${purpose}.${body}`).digest('base64url')}`;
const encode = (payload: unknown) => Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)).toString('base64url');

describe('safeEqual', () => {
  it('compares strings without throwing on different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a session and lasts eight hours', () => {
    expect(SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000);
    const token = createSessionToken(SECRET, user, NOW);
    expect(readSessionToken(SECRET, token, NOW + SESSION_TTL_MS - 1)).toEqual(user);
  });

  it('uses the current time by default', () => {
    expect(readSessionToken(SECRET, createSessionToken(SECRET, user))).toEqual(user);
  });

  it('expires', () => {
    const token = createSessionToken(SECRET, user, NOW);
    expect(readSessionToken(SECRET, token, NOW + SESSION_TTL_MS)).toBeNull();
    expect(readSessionToken(SECRET, token, NOW + SESSION_TTL_MS + 1)).toBeNull();
  });

  it('is signed with the secret, so rotating the secret signs everyone out', () => {
    const token = createSessionToken(SECRET, user, NOW);
    expect(readSessionToken(OTHER_SECRET, token, NOW)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const [, signature] = createSessionToken(SECRET, user, NOW).split('.');
    const forged = `${encode({ login: 'attacker', id: 1, exp: NOW + 1e9 })}.${signature}`;
    expect(readSessionToken(SECRET, forged, NOW)).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['no signature', 'abc'],
    ['too many parts', 'a.b.c'],
    ['wrong signature', 'e30.AAAA'],
  ])('rejects a %s token', (_name, token) => {
    expect(readSessionToken(SECRET, token as string | undefined, NOW)).toBeNull();
  });

  it('rejects a validly signed payload that is not usable', () => {
    const read = (payload: unknown) => readSessionToken(SECRET, signed(encode(payload)), NOW);

    expect(read({ login: 'a', id: 1, exp: NOW + 1000 })).toEqual({ login: 'a', id: 1 });
    expect(read({ login: 'a', id: 1 })).toBeNull();
    expect(read({ login: 'a', id: 1, exp: 'soon' })).toBeNull();
    expect(read({ login: 7, id: 1, exp: NOW + 1000 })).toBeNull();
    expect(read({ login: 'a', id: '1', exp: NOW + 1000 })).toBeNull();
    expect(read(null)).toBeNull();
    expect(read('text')).toBeNull();
    expect(readSessionToken(SECRET, signed(Buffer.from('not json').toString('base64url')), NOW)).toBeNull();
  });
});

describe('state tokens', () => {
  it('round-trips a random state and lasts ten minutes', () => {
    expect(STATE_TTL_MS).toBe(10 * 60 * 1000);
    const { state, token } = createStateToken(SECRET, NOW);
    expect(state).toMatch(/^[0-9a-f]{32}$/);
    expect(readStateToken(SECRET, token, NOW + STATE_TTL_MS - 1)).toBe(state);
    expect(readStateToken(SECRET, token, NOW + STATE_TTL_MS)).toBeNull();
  });

  it('uses the current time by default and gives each sign-in a new state', () => {
    const first = createStateToken(SECRET);
    expect(readStateToken(SECRET, first.token)).toBe(first.state);
    expect(createStateToken(SECRET).state).not.toBe(first.state);
  });

  it('is signed with the secret', () => {
    expect(readStateToken(OTHER_SECRET, createStateToken(SECRET, NOW).token, NOW)).toBeNull();
  });

  it('cannot be used as a session, and a session cannot be used as a state', () => {
    expect(readSessionToken(SECRET, createStateToken(SECRET, NOW).token, NOW)).toBeNull();
    expect(readStateToken(SECRET, createSessionToken(SECRET, user, NOW), NOW)).toBeNull();
  });
});

describe('cookies', () => {
  it('parses a Cookie header, ignoring malformed parts', () => {
    const cookies = parseCookies('a=1; b = two ;novalue; =orphan; c=x=y');
    expect(cookies.get('a')).toBe('1');
    expect(cookies.get('b')).toBe('two');
    expect(cookies.get('c')).toBe('x=y');
    expect(cookies.has('novalue')).toBe(false);
    expect(cookies.size).toBe(3);
  });

  it('parses a missing header as no cookies', () => {
    expect(parseCookies(undefined).size).toBe(0);
  });

  it('cannot be polluted through a cookie named like an object property', () => {
    const cookies = parseCookies('__proto__=x; constructor=y');
    expect(cookies.get('__proto__')).toBe('x');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('serializes HttpOnly cookies with the given scope and lifetime', () => {
    expect(serializeCookie('n', 'v', { path: '/', maxAgeSeconds: 60, sameSite: 'Strict', secure: true })).toBe(
      'n=v; Path=/; HttpOnly; SameSite=Strict; Max-Age=60; Secure',
    );
    expect(serializeCookie('n', '', { path: '/x', maxAgeSeconds: 0, sameSite: 'Lax', secure: false })).toBe(
      'n=; Path=/x; HttpOnly; SameSite=Lax; Max-Age=0',
    );
  });
});
