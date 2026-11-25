import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiServer } from '../../src/server/api-server.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const TOKEN = 'k'.repeat(40);
let ipCounter = 0;

interface Reply {
  status: number;
  json: () => any;
}

describe('cached Law of the Day through the real server and migrated database', () => {
  let db: ReturnType<typeof createMigratedDb>;
  let server: ReturnType<typeof createApiServer>['server'];
  let ip = '';
  let featured: number;

  const request = (method: string, url: string, body?: unknown, token?: string): Promise<Reply> =>
    new Promise((resolve) => {
      const stream = new Readable({ read() {} });
      if (body !== undefined) stream.push(JSON.stringify(body));
      stream.push(null);
      const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': ip };
      if (token) headers.authorization = `Bearer ${token}`;
      const req = Object.assign(stream, { method, url, headers, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage;
      let status = 0;
      const res = {
        writeHead: (code: number) => {
          status = code;
        },
        setHeader: vi.fn(),
        end: (chunk?: Buffer | string) => {
          const text = chunk ? chunk.toString() : '';
          resolve({ status, json: () => JSON.parse(text) });
        },
      } as unknown as ServerResponse;
      server.emit('request', req, res);
    });

  const lawOfDay = async () => (await request('GET', '/api/v1/law-of-day')).json();

  beforeEach(() => {
    ip = `198.51.100.${(ipCounter += 1)}`;
    process.env.ADMIN_API_TOKEN = TOKEN;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db = createMigratedDb();
    db.exec("DELETE FROM laws WHERE status = 'published'");
    featured = Number(db.prepare("INSERT INTO laws (title, text, status) VALUES ('Fish', 'Zebrafish law that is featured today', 'published')").run().lastInsertRowid);
    ({ server } = createApiServer({ db: db as any }));
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
    vi.restoreAllMocks();
  });

  it('shows a vote, a changed vote and a removed vote in the very next response', async () => {
    expect((await lawOfDay()).law).toMatchObject({ id: featured, upvotes: 0, downvotes: 0 });

    expect((await request('POST', `/api/v1/laws/${featured}/vote`, { vote_type: 'up' })).status).toBe(200);
    expect((await lawOfDay()).law).toMatchObject({ upvotes: 1, downvotes: 0 });

    expect((await request('POST', `/api/v1/laws/${featured}/vote`, { vote_type: 'down' })).status).toBe(200);
    expect((await lawOfDay()).law).toMatchObject({ upvotes: 0, downvotes: 1 });

    expect((await request('DELETE', `/api/v1/laws/${featured}/vote`)).status).toBe(200);
    expect((await lawOfDay()).law).toMatchObject({ upvotes: 0, downvotes: 0 });
  });

  it('shows a moderator edit and rejection in the very next response', async () => {
    expect((await lawOfDay()).law.text).toBe('Zebrafish law that is featured today');
    const other = Number(db.prepare("INSERT INTO laws (title, text, status) VALUES ('Other', 'Narwhal law as a replacement', 'published')").run().lastInsertRowid);

    const edited = await request('POST', `/api/v1/admin/laws/${featured}`, { text: 'Zebrafish law, edited' }, TOKEN);
    expect(edited.status).toBe(200);
    expect((await lawOfDay()).law.text).toBe('Zebrafish law, edited');

    const rejected = await request('POST', `/api/v1/admin/laws/${featured}`, { status: 'rejected' }, TOKEN);
    expect(rejected.status).toBe(200);
    expect((await lawOfDay()).law.id).toBe(other);
  });
});
