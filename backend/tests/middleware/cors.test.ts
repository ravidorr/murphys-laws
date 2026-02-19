import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { getCorsOrigin } from '../../src/middleware/cors.ts';

describe('CORS Middleware', () => {
    it('should allow wildcard', () => {
        const req = { headers: {} } as IncomingMessage;
        const origin = getCorsOrigin(req, ['*']);
        expect(origin).toBe('*');
    });

    it('should allow exact match', () => {
        const req = { headers: { origin: 'http://example.com' } } as IncomingMessage;
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should fallback to first allowed origin if no match', () => {
        const req = { headers: { origin: 'http://evil.com' } } as IncomingMessage;
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should handle missing origin header', () => {
        const req = { headers: {} } as IncomingMessage;
        const origin = getCorsOrigin(req, ['http://example.com']);
        expect(origin).toBe('http://example.com');
    });

    it('should fallback to wildcard if no allowed origins', () => {
        const req = { headers: { origin: 'http://example.com' } } as IncomingMessage;
        const origin = getCorsOrigin(req, []);
        expect(origin).toBe('*');
    });
});
