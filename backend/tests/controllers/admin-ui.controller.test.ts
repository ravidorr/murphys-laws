import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AdminUiController } from '../../src/controllers/admin-ui.controller.ts';

describe('AdminUiController', () => {
  const controller = new AdminUiController();
  const req = { headers: {} } as unknown as IncomingMessage;
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  const serve = (file?: string) => controller.serve(req, res as unknown as ServerResponse, file);

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = 'tok';
    res = { writeHead: vi.fn(), end: vi.fn() };
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
  });

  it.each([
    [undefined, 'text/html; charset=utf-8'],
    ['admin.css', 'text/css; charset=utf-8'],
    ['admin.js', 'text/javascript; charset=utf-8'],
    ['admin-logic.js', 'text/javascript; charset=utf-8'],
  ])('serves %s with security headers', async (file, type) => {
    await serve(file);
    const [status, headers] = res.writeHead.mock.calls[0];
    expect(status).toBe(200);
    expect(headers['Content-Type']).toBe(type);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(Buffer.isBuffer(res.end.mock.calls[0][0])).toBe(true);
  });

  it('returns 404 for unknown or prototype-style file names', async () => {
    await serve('secrets.txt');
    await serve('constructor');
    expect(res.writeHead.mock.calls.map((c) => c[0])).toEqual([404, 404]);
  });

  it('returns 404 when the admin API is disabled', async () => {
    delete process.env.ADMIN_API_TOKEN;
    await serve();
    expect(res.writeHead.mock.calls[0][0]).toBe(404);
  });
});
