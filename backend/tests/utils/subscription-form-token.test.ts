import { describe, it, expect } from 'vitest';
import { FORM_TOKEN_MAX_AGE_MS, FORM_TOKEN_MIN_AGE_MS, FormTokenService } from '../../src/utils/subscription-form-token.ts';

const T0 = 1_800_000_000_000;

describe('FormTokenService', () => {
  it('accepts a token once it is old enough', () => {
    const service = new FormTokenService('secret');
    const token = service.issue(T0);
    expect(token).toMatch(/^\d+\.[a-f0-9]{16}\.[a-f0-9]{64}$/);
    expect(service.verify(token, T0 + FORM_TOKEN_MIN_AGE_MS)).toBe('ok');
  });

  it('refuses a token that is too fresh, but accepts it later', () => {
    const service = new FormTokenService('secret');
    const token = service.issue(T0);
    expect(service.verify(token, T0 + FORM_TOKEN_MIN_AGE_MS - 1)).toBe('too_fast');
    expect(service.verify(token, T0 + FORM_TOKEN_MIN_AGE_MS)).toBe('ok');
  });

  it('refuses a token from the future', () => {
    const service = new FormTokenService('secret');
    expect(service.verify(service.issue(T0 + 60_000), T0)).toBe('too_fast');
  });

  it('refuses an expired token', () => {
    const service = new FormTokenService('secret');
    const token = service.issue(T0);
    expect(service.verify(token, T0 + FORM_TOKEN_MAX_AGE_MS)).toBe('ok');
    expect(service.verify(service.issue(T0), T0 + FORM_TOKEN_MAX_AGE_MS + 1)).toBe('expired');
  });

  it('works once', () => {
    const service = new FormTokenService('secret');
    const token = service.issue(T0);
    expect(service.verify(token, T0 + 5000)).toBe('ok');
    expect(service.verify(token, T0 + 6000)).toBe('reused');
  });

  it('forgets spent tokens once they would have expired anyway', () => {
    const service = new FormTokenService('secret');
    const first = service.issue(T0);
    expect(service.verify(first, T0 + 5000)).toBe('ok');
    const later = T0 + FORM_TOKEN_MAX_AGE_MS + 10_000;
    expect(service.verify(service.issue(later - 5000), later)).toBe('ok');
    // the spent nonce was dropped, and the token is expired by now, so it fails for that reason instead
    expect(service.verify(first, later)).toBe('expired');
    // only the spent nonce that is still unexpired remains remembered
    expect((service as unknown as { used: Map<string, number> }).used.size).toBe(1);
  });

  it('refuses malformed values', () => {
    const service = new FormTokenService('secret');
    for (const value of [undefined, null, 5, '', 'abc', '1.2.3', `${T0}.${'a'.repeat(16)}.${'b'.repeat(63)}`]) {
      expect(service.verify(value, T0 + 5000), String(value)).toBe('malformed');
    }
  });

  it('refuses a forged or altered token', () => {
    const service = new FormTokenService('secret');
    const [issuedAt, nonce, signature] = service.issue(T0).split('.');
    expect(service.verify(`${Number(issuedAt) - 100000}.${nonce}.${signature}`, T0 + 5000)).toBe('forged');
    expect(service.verify(`${issuedAt}.${nonce}.${'0'.repeat(64)}`, T0 + 5000)).toBe('forged');
  });

  it('refuses a token signed with another secret', () => {
    const token = new FormTokenService('one').issue(T0);
    expect(new FormTokenService('two').verify(token, T0 + 5000)).toBe('forged');
  });

  it('accepts its own tokens across instances that share a secret, and not with random ones', () => {
    const token = new FormTokenService('shared').issue(T0);
    expect(new FormTokenService('shared').verify(token, T0 + 5000)).toBe('ok');
    expect(new FormTokenService().verify(token, T0 + 5000)).toBe('forged');
    const random = new FormTokenService();
    expect(random.verify(random.issue(T0), T0 + 5000)).toBe('ok');
  });
});
