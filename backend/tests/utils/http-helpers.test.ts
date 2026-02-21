import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as httpHelpers from '../../src/utils/http-helpers.ts';

interface MockReq {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  on: ReturnType<typeof vi.fn>;
}

interface MockRes {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

const asReq = (r: MockReq): IncomingMessage => r as unknown as IncomingMessage;
const asRes = (r: MockRes): ServerResponse => r as unknown as ServerResponse;

describe('HTTP Helpers', () => {
  let req: MockReq;
  let res: MockRes;

  beforeEach(() => {
    req = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      on: vi.fn(),
    };
    res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    process.env.ALLOWED_ORIGINS = ''; // Default
  });

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('readBody', () => {
    it('should read valid JSON body', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'data') cb(Buffer.from(JSON.stringify({ foo: 'bar' })));
        if (event === 'end') cb();
      });

      const body = await httpHelpers.readBody(asReq(req));
      expect(body).toEqual({ foo: 'bar' });
    });

    it('should return empty object for empty body', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'end') cb();
      });

      const body = await httpHelpers.readBody(asReq(req));
      expect(body).toEqual({});
    });

    it('should reject on invalid JSON', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'data') cb(Buffer.from('invalid json'));
        if (event === 'end') cb();
      });

      await expect(httpHelpers.readBody(asReq(req))).rejects.toThrow();
    });

    it('should reject on stream error', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'error') cb(new Error('Stream error'));
      });

      await expect(httpHelpers.readBody(asReq(req))).rejects.toThrow('Stream error');
    });
  });

  describe('getVoterIdentifier', () => {
    it('should use x-forwarded-for if present', () => {
      req.headers['x-forwarded-for'] = '10.0.0.1, 10.0.0.2';
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('10.0.0.1');
    });

    it('should use x-real-ip if present', () => {
      req.headers['x-real-ip'] = '10.0.0.2';
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('10.0.0.2');
    });

    it('should fallback to socket remoteAddress', () => {
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('127.0.0.1');
    });
    
    it('should return unknown if no IP found', () => {
      req.socket.remoteAddress = undefined;
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('unknown');
    });

    it('should use first element when x-forwarded-for is array', () => {
      req.headers['x-forwarded-for'] = ['10.0.0.1, 10.0.0.2'];
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('10.0.0.1');
    });

    it('should use first element when x-real-ip is array', () => {
      req.headers['x-real-ip'] = ['10.0.0.3'];
      expect(httpHelpers.getVoterIdentifier(asReq(req))).toBe('10.0.0.3');
    });
  });

  describe('sendJson', () => {
    it('should send JSON response with default CORS', () => {
      httpHelpers.sendJson(asRes(res), 200, { data: 'ok' });
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }));
      expect(res.end).toHaveBeenCalledWith('{"data":"ok"}');
    });

    it('should send JSON response with specific CORS and Credentials', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      
      httpHelpers.sendJson(asRes(res), 200, { data: 'ok' }, asReq(req));
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true'
      }));
    });
  });

  describe('rateLimitExceeded', () => {
    it('should send 429 response', () => {
      const resetTime = Date.now() + 60000;
      httpHelpers.rateLimitExceeded(asRes(res), resetTime);
      
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
        'Retry-After': expect.any(Number)
      }));
    });

    it('should send 429 with Credentials if specific origin', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      const resetTime = Date.now() + 60000;
      
      httpHelpers.rateLimitExceeded(asRes(res), resetTime, asReq(req));
      
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true'
      }));
    });
  });

  describe('notFound', () => {
    it('should send 404 with error Not Found without req', () => {
      httpHelpers.notFound(asRes(res));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }));
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Not Found' }));
    });

    it('should send 404 with CORS when req provided and origin matches', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      httpHelpers.notFound(asRes(res), asReq(req));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true',
      }));
    });
  });

  describe('badRequest', () => {
    it('should send 400 with error Bad Request when msg omitted', () => {
      httpHelpers.badRequest(asRes(res));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Bad Request' }));
    });

    it('should send 400 with custom message', () => {
      httpHelpers.badRequest(asRes(res), 'Custom message');
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Custom message' }));
    });

    it('should send 400 with CORS credentials when req and origin set', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      httpHelpers.badRequest(asRes(res), 'Invalid input', asReq(req));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true',
      }));
    });
  });
});
