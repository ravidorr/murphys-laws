import { describe, it, expect, afterEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { checkAdminAuth, getAdminApiState } from '../../src/middleware/admin-auth.ts';

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
