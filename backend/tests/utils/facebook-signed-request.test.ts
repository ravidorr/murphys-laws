import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  parseSignedRequest,
  generateConfirmationCode,
} from '../../src/utils/facebook-signed-request.ts';

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createValidSignedRequest(payload: object, appSecret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${expectedSignature}.${encodedPayload}`;
}

describe('facebook-signed-request', () => {
  describe('parseSignedRequest', () => {
    it('should return null for null signedRequest', () => {
      expect(parseSignedRequest(null, 'secret')).toBeNull();
    });

    it('should return null for undefined signedRequest', () => {
      expect(parseSignedRequest(undefined, 'secret')).toBeNull();
    });

    it('should return null for empty string signedRequest', () => {
      expect(parseSignedRequest('', 'secret')).toBeNull();
    });

    it('should throw when appSecret is null', () => {
      expect(() => parseSignedRequest('a.b', null)).toThrow('Facebook app secret is required');
    });

    it('should throw when appSecret is undefined', () => {
      expect(() => parseSignedRequest('a.b', undefined)).toThrow('Facebook app secret is required');
    });

    it('should return null when signedRequest has no dot', () => {
      expect(parseSignedRequest('onlyone', 'secret')).toBeNull();
    });

    it('should return null for malformed payload (invalid base64)', () => {
      expect(parseSignedRequest('sig.!!!invalid!!!', 'secret')).toBeNull();
    });

    it('should return null for invalid algorithm', () => {
      const payload = { algorithm: 'HS256', user_id: '1' };
      const signed = createValidSignedRequest(payload, 'secret');
      expect(parseSignedRequest(signed, 'secret')).toBeNull();
    });

    it('should return null when algorithm is missing', () => {
      const payload = { user_id: '1' };
      const signed = createValidSignedRequest(payload, 'secret');
      expect(parseSignedRequest(signed, 'secret')).toBeNull();
    });

    it('should return null when signature does not match', () => {
      const payload = { algorithm: 'HMAC-SHA256', user_id: '1' };
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const wrongSig = base64UrlEncode('wrong');
      expect(parseSignedRequest(`${wrongSig}.${encodedPayload}`, 'secret')).toBeNull();
    });

    it('should return payload for valid signed request', () => {
      const payload = { algorithm: 'HMAC-SHA256', user_id: '123', extra: 'data' };
      const signed = createValidSignedRequest(payload, 'my-app-secret');
      const result = parseSignedRequest(signed, 'my-app-secret');
      expect(result).toEqual(payload);
    });

    it('should return null when payload is invalid JSON', () => {
      const encodedPayload = base64UrlEncode('not valid json');
      const sig = crypto
        .createHmac('sha256', 'secret')
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      expect(parseSignedRequest(`${sig}.${encodedPayload}`, 'secret')).toBeNull();
    });
  });

  describe('generateConfirmationCode', () => {
    it('should return string starting with DEL_ and containing user id (string)', () => {
      const code = generateConfirmationCode('fb123');
      expect(code).toMatch(/^DEL_fb123_\d+_[a-f0-9]{16}$/);
    });

    it('should return string starting with DEL_ and containing user id (number)', () => {
      const code = generateConfirmationCode(456);
      expect(code).toMatch(/^DEL_456_\d+_[a-f0-9]{16}$/);
    });

    it('should produce different codes on successive calls', () => {
      const code1 = generateConfirmationCode('u1');
      const code2 = generateConfirmationCode('u1');
      expect(code1).not.toBe(code2);
    });
  });
});
