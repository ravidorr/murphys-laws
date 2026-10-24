import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AdminUiController } from '../../src/controllers/admin-ui.controller.ts';

const failRead = vi.hoisted(() => ({ enabled: false }));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('node:fs/promises');
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) =>
      failRead.enabled ? Promise.reject(new Error('ENOENT: missing asset')) : actual.readFile(...args),
  };
});

describe('AdminUiController', () => {
  const controller = new AdminUiController();
  const req = { headers: {} } as unknown as IncomingMessage;
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  const serve = (file?: string) => controller.serve(req, res as unknown as ServerResponse, file);

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = 'u'.repeat(40);
    res = { writeHead: vi.fn(), end: vi.fn() };
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
    failRead.enabled = false;
    vi.restoreAllMocks();
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

  it('serves the page shell without a token when enabled', async () => {
    await serve();
    expect(res.writeHead.mock.calls[0][0]).toBe(200);
  });

  it('serves every file the page loads', () => {
    const html = readFileSync(resolve(__dirname, '../../src/admin-ui/index.html'), 'utf8');
    const js = readFileSync(resolve(__dirname, '../../src/admin-ui/admin.js'), 'utf8');
    const referenced = [
      ...[...html.matchAll(/(?:src|href)="\/api\/v1\/admin\/ui\/([\w.-]+)"/g)].map((m) => m[1]),
      ...[...js.matchAll(/from '\.\/([\w.-]+)'/g)].map((m) => m[1]),
    ];
    expect(referenced.sort()).toEqual(['admin-logic.js', 'admin.css', 'admin.js']);
    return Promise.all(referenced.map(async (file) => {
      res.writeHead.mockClear();
      await serve(file);
      expect(res.writeHead.mock.calls[0][0]).toBe(200);
    }));
  });

  it('answers 500 with a plain-text body and logs when an asset cannot be read', async () => {
    failRead.enabled = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await serve('admin.js');
    const [status, headers] = res.writeHead.mock.calls[0];
    expect(status).toBe(500);
    expect(headers['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.end).toHaveBeenCalledWith('Admin UI asset unavailable.');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('admin.js'), expect.any(Error));
  });
});
