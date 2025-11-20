import { describe, it, expect } from 'vitest';
import { getCorsOrigin } from '../../src/middleware/cors.mjs';

describe('CORS Middleware', () => {
    it('should allow wildcard', () => {
        const origin = getCorsOrigin({}, ['*']);
        expect(origin).toBe('*');
    });

    it('should allow exact match', () => {
        const req = { headers: { origin: 'http://example.com' } };
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should fallback to first allowed origin if no match', () => {
        const req = { headers: { origin: 'http://evil.com' } };
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should handle missing origin header', () => {
        const req = { headers: {} };
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should fallback to wildcard if no allowed origins', () => {
        const req = { headers: { origin: 'http://example.com' } };
        const origin = getCorsOrigin(req, []);
        expect(origin).toBe('*');
    });
});
