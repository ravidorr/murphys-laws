import { describe, it, expect, vi } from 'vitest';
import { readBody, getVoterIdentifier, sendJson, notFound, badRequest, rateLimitExceeded } from '../../src/utils/http-helpers.js';

describe('http-helpers', () => {
    describe('readBody', () => {
        it('should parse JSON body', async () => {
            const req = {
                on: vi.fn((event, cb) => {
                    if (event === 'data') cb(Buffer.from(JSON.stringify({ key: 'value' })));
                    if (event === 'end') cb();
                }),
            };

            const body = await readBody(req);
            expect(body).toEqual({ key: 'value' });
        });

        it('should return empty object for empty body', async () => {
            const req = {
                on: vi.fn((event, cb) => {
                    if (event === 'end') cb();
                }),
            };

            const body = await readBody(req);
            expect(body).toEqual({});
        });

        it('should reject on invalid JSON', async () => {
            const req = {
                on: vi.fn((event, cb) => {
                    if (event === 'data') cb(Buffer.from('invalid json'));
                    if (event === 'end') cb();
                }),
            };

            await expect(readBody(req)).rejects.toThrow();
        });

        it('should reject on error event', async () => {
            const req = {
                on: vi.fn((event, cb) => {
                    if (event === 'error') cb(new Error('Network error'));
                }),
            };

            await expect(readBody(req)).rejects.toThrow('Network error');
        });
    });

    describe('getVoterIdentifier', () => {
        it('should get IP from x-forwarded-for header', () => {
            const req = {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
                socket: { remoteAddress: '127.0.0.1' },
            };

            expect(getVoterIdentifier(req)).toBe('192.168.1.1');
        });

        it('should get IP from x-real-ip header', () => {
            const req = {
                headers: { 'x-real-ip': '192.168.1.2' },
                socket: { remoteAddress: '127.0.0.1' },
            };

            expect(getVoterIdentifier(req)).toBe('192.168.1.2');
        });

        it('should fallback to socket remoteAddress', () => {
            const req = {
                headers: {},
                socket: { remoteAddress: '127.0.0.1' },
            };

            expect(getVoterIdentifier(req)).toBe('127.0.0.1');
        });

        it('should return "unknown" if no address available', () => {
            const req = {
                headers: {},
                socket: {},
            };

            expect(getVoterIdentifier(req)).toBe('unknown');
        });
    });

    describe('sendJson', () => {
        it('should send JSON response', () => {
            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            };

            sendJson(res, 200, { success: true });

            expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
                'Content-Type': 'application/json; charset=utf-8',
            }));
            expect(res.end).toHaveBeenCalledWith('{"success":true}');
        });
    });

    describe('notFound', () => {
        it('should send 404 response', () => {
            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            };

            notFound(res);

            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Not Found'));
        });
    });

    describe('badRequest', () => {
        it('should send 400 response with custom message', () => {
            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            };

            badRequest(res, 'Invalid input');

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
        });
    });

    describe('rateLimitExceeded', () => {
        it('should send 429 response with retry-after header', () => {
            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            };

            const resetTime = Date.now() + 60000;
            rateLimitExceeded(res, resetTime);

            expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
                'Retry-After': expect.any(Number),
            }));
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded'));
        });
    });
});
