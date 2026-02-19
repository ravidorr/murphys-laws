import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../src/routes/router.ts';

describe('Router', () => {
  it('should match routes with literal dot segments', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = {
      method: 'GET',
      url: '/api/v1/og/law/123.png',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    router.get('/api/v1/og/law/:id.png', handler);
    await router.handle(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      '123',
      expect.objectContaining({ pathname: '/api/v1/og/law/123.png' })
    );
    expect(res.writeHead).not.toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('should not match when the literal dot is missing', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = {
      method: 'GET',
      url: '/api/v1/og/law/123Apng',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    router.get('/api/v1/og/law/:id.png', handler);
    await router.handle(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
      'Content-Type': 'application/json; charset=utf-8',
    }));
  });
});
