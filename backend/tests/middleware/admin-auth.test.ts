import { describe, it, expect, afterEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { checkAdminAuth } from '../../src/middleware/admin-auth.ts';

const reqWith = (authorization?: string) => ({ headers: { authorization } }) as unknown as IncomingMessage;

describe('checkAdminAuth', () => {
  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
  });

  it('is disabled when no token is configured', () => {
    expect(checkAdminAuth(reqWith('Bearer anything'))).toBe('disabled');
  });

  it('accepts the matching bearer token', () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    expect(checkAdminAuth(reqWith('Bearer secret-token'))).toBe('ok');
  });

  it('rejects missing, malformed, wrong and different-length tokens', () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    expect(checkAdminAuth(reqWith())).toBe('unauthorized');
    expect(checkAdminAuth(reqWith('secret-token'))).toBe('unauthorized');
    expect(checkAdminAuth(reqWith('Bearer secret-tokeX'))).toBe('unauthorized');
    expect(checkAdminAuth(reqWith('Bearer short'))).toBe('unauthorized');
  });
});
