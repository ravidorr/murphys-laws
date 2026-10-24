import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiServer } from '../../src/server/api-server.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const TOKEN = 'k'.repeat(40);

interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: () => any;
}

describe('admin API through the real server and migrated database', () => {
  let db: ReturnType<typeof createMigratedDb>;
  let server: ReturnType<typeof createApiServer>['server'];
  let lawId: number;

  const request = (method: string, url: string, { token, body }: { token?: string; body?: unknown } = {}): Promise<Reply> =>
    new Promise((resolve) => {
      const stream = new Readable({ read() {} });
      if (body !== undefined) stream.push(JSON.stringify(body));
      stream.push(null);
      const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' };
      if (token) headers.authorization = `Bearer ${token}`;
      const req = Object.assign(stream, { method, url, headers, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage;

      let status = 0;
      let responseHeaders: Record<string, string> = {};
      const res = {
        writeHead: (code: number, h: Record<string, string>) => {
          status = code;
          responseHeaders = h;
        },
        setHeader: vi.fn(),
        end: (chunk?: Buffer | string) => {
          const text = chunk ? chunk.toString() : '';
          resolve({ status, headers: responseHeaders, body: text, json: () => JSON.parse(text) });
        },
      } as unknown as ServerResponse;
      server.emit('request', req, res);
    });

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    db = createMigratedDb();
    lawId = Number(
      db.prepare("INSERT INTO laws (title, text, status, first_seen_file_path) VALUES ('Fish', 'Zebrafish always escape the net you bought', 'in_review', 'web-submission')").run().lastInsertRowid,
    );
    ({ server } = createApiServer({ db: db as any }));
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
    vi.restoreAllMocks();
  });

  it('rejects missing and wrong tokens', async () => {
    expect((await request('GET', '/api/v1/admin/laws')).status).toBe(401);
    expect((await request('GET', '/api/v1/admin/laws', { token: 'wrong' })).status).toBe(401);
    expect((await request('POST', `/api/v1/admin/laws/${lawId}`, { body: { status: 'published' } })).status).toBe(401);
  });

  it('lists pending laws and round-trips an approval into the public API', async () => {
    expect((await request('GET', `/api/v1/laws/${lawId}`)).status).toBe(404);

    const list = await request('GET', '/api/v1/admin/laws?status=in_review', { token: TOKEN });
    expect(list.status).toBe(200);
    expect(list.headers['Cache-Control']).toBe('no-store');
    const { data, counts } = list.json();
    expect(data.map((l: { id: number }) => l.id)).toEqual([lawId]);
    expect(counts.in_review).toBe(1);

    const approved = await request('POST', `/api/v1/admin/laws/${lawId}`, {
      token: TOKEN,
      body: { status: 'published', updated_at: data[0].updated_at },
    });
    expect(approved.status).toBe(200);
    expect(approved.json().data.status).toBe('published');
    expect((await request('GET', `/api/v1/laws/${lawId}`)).status).toBe(200);

    const stale = await request('POST', `/api/v1/admin/laws/${lawId}`, {
      token: TOKEN,
      body: { status: 'rejected', updated_at: 'stale' },
    });
    expect(stale.status).toBe(409);
  });

  it('answers 404 for an unknown law', async () => {
    const reply = await request('POST', '/api/v1/admin/laws/999999', { token: TOKEN, body: { status: 'rejected' } });
    expect(reply.status).toBe(404);
    expect(reply.json().error).toBe('Law not found');
  });

  it('serves the page and assets, and 404s unknown files and traversal attempts', async () => {
    const page = await request('GET', '/api/v1/admin/ui');
    expect(page.status).toBe(200);
    expect(page.headers['Content-Security-Policy']).toContain("script-src 'self'");
    expect((await request('GET', '/api/v1/admin/ui/admin.js')).status).toBe(200);
    expect((await request('GET', '/api/v1/admin/ui/missing.js')).status).toBe(404);
    expect((await request('GET', '/api/v1/admin/ui/..%2Fadmin.controller.ts')).status).toBe(404);
  });

  it('does not shadow the public law routes', async () => {
    expect((await request('GET', '/api/v1/laws')).status).toBe(200);
    expect((await request('GET', '/api/v1/laws/random')).status).toBeLessThan(500);
  });

  it('answers CORS preflight allowing the Authorization header', async () => {
    const reply = await request('OPTIONS', '/api/v1/admin/laws');
    expect(reply.status).toBe(204);
    expect(reply.headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('is invisible when disabled and logs why at startup', async () => {
    delete process.env.ADMIN_API_TOKEN;
    ({ server } = createApiServer({ db: db as any }));
    expect(console.log).toHaveBeenCalledWith('Admin API disabled (ADMIN_API_TOKEN unset)');
    expect((await request('GET', '/api/v1/admin/laws', { token: TOKEN })).status).toBe(404);
    expect((await request('GET', '/api/v1/admin/ui')).status).toBe(404);

    process.env.ADMIN_API_TOKEN = 'too-short';
    createApiServer({ db: db as any });
    expect(console.log).toHaveBeenCalledWith('Admin API disabled (ADMIN_API_TOKEN is shorter than 32 characters)');

    process.env.ADMIN_API_TOKEN = TOKEN;
    createApiServer({ db: db as any });
    expect(console.log).toHaveBeenCalledWith('Admin API enabled');
  });
});
