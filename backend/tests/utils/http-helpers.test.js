import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as httpHelpers from '../../src/utils/http-helpers.js';

describe('HTTP Helpers', () => {
  let req;
  let res;

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

      const body = await httpHelpers.readBody(req);
      expect(body).toEqual({ foo: 'bar' });
    });

    it('should return empty object for empty body', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'end') cb();
      });

      const body = await httpHelpers.readBody(req);
      expect(body).toEqual({});
    });

    it('should reject on invalid JSON', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'data') cb(Buffer.from('invalid json'));
        if (event === 'end') cb();
      });

      await expect(httpHelpers.readBody(req)).rejects.toThrow();
    });

    it('should reject on stream error', async () => {
      req.on.mockImplementation((event, cb) => {
        if (event === 'error') cb(new Error('Stream error'));
      });

      await expect(httpHelpers.readBody(req)).rejects.toThrow('Stream error');
    });
  });

  describe('getVoterIdentifier', () => {
    it('should use x-forwarded-for if present', () => {
      req.headers['x-forwarded-for'] = '10.0.0.1, 10.0.0.2';
      expect(httpHelpers.getVoterIdentifier(req)).toBe('10.0.0.1');
    });

    it('should use x-real-ip if present', () => {
      req.headers['x-real-ip'] = '10.0.0.2';
      expect(httpHelpers.getVoterIdentifier(req)).toBe('10.0.0.2');
    });

    it('should fallback to socket remoteAddress', () => {
      expect(httpHelpers.getVoterIdentifier(req)).toBe('127.0.0.1');
    });
    
    it('should return unknown if no IP found', () => {
      req.socket.remoteAddress = undefined;
      expect(httpHelpers.getVoterIdentifier(req)).toBe('unknown');
    });
  });

  describe('sendJson', () => {
    it('should send JSON response with default CORS', () => {
      httpHelpers.sendJson(res, 200, { data: 'ok' });
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }));
      expect(res.end).toHaveBeenCalledWith('{"data":"ok"}');
    });

    it('should send JSON response with specific CORS and Credentials', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      
      httpHelpers.sendJson(res, 200, { data: 'ok' }, req);
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true'
      }));
    });
  });

  describe('rateLimitExceeded', () => {
    it('should send 429 response', () => {
      const resetTime = Date.now() + 60000;
      httpHelpers.rateLimitExceeded(res, resetTime);
      
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
        'Retry-After': expect.any(Number)
      }));
    });

    it('should send 429 with Credentials if specific origin', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      req.headers.origin = 'http://example.com';
      const resetTime = Date.now() + 60000;
      
      httpHelpers.rateLimitExceeded(res, resetTime, req);
      
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://example.com',
        'Access-Control-Allow-Credentials': 'true'
      }));
    });
  });
});