import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiServer } from '../../src/server/api-server.ts';
import { EmailService } from '../../src/services/email.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const { mockSendMail } = vi.hoisted(() => ({ mockSendMail: vi.fn() }));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: mockSendMail }) },
}));

const TOKEN = 'k'.repeat(40);
let ipCounter = 0;

interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: () => any;
}

const smtp = () => new EmailService({ host: 'smtp.example.com', user: 'u', pass: 'p', from: 'noreply@murphys-laws.com', to: 'admin@murphys-laws.com' });

describe('admin API through the real server and migrated database', () => {
  let db: ReturnType<typeof createMigratedDb>;
  let server: ReturnType<typeof createApiServer>['server'];
  let lawId: number;

  let ip = '';

  const request = (method: string, url: string, { token, body, raw, from }: { token?: string; body?: unknown; raw?: string; from?: string } = {}): Promise<Reply> =>
    new Promise((resolve) => {
      const stream = new Readable({ read() {} });
      if (raw !== undefined) stream.push(raw);
      else if (body !== undefined) stream.push(JSON.stringify(body));
      stream.push(null);
      const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': from ?? ip };
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
    ip = `203.0.113.${(ipCounter += 1)}`;
    process.env.ADMIN_API_TOKEN = TOKEN;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = createMigratedDb();
    lawId = Number(
      db.prepare("INSERT INTO laws (title, text, status, first_seen_file_path) VALUES ('Fish', 'Zebrafish always escape the net you bought', 'in_review', 'web-submission')").run().lastInsertRowid,
    );
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue(undefined);
    ({ server } = createApiServer({ db: db as any, emailService: smtp() }));
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
    const alias = await request('GET', '/admin');
    expect(alias.status).toBe(200);
    expect(alias.headers['Content-Security-Policy']).toBe(page.headers['Content-Security-Policy']);
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
    expect((await request('GET', '/admin')).status).toBe(404);

    process.env.ADMIN_API_TOKEN = 'too-short';
    ({ server } = createApiServer({ db: db as any }));
    expect((await request('GET', '/admin')).status).toBe(404);
    expect(console.warn).toHaveBeenCalledWith('Admin API disabled (ADMIN_API_TOKEN is shorter than 32 characters)');

    process.env.ADMIN_API_TOKEN = TOKEN;
    createApiServer({ db: db as any });
    expect(console.log).toHaveBeenCalledWith('Admin API enabled');
  });

  it('rejects malformed, empty and oversized request bodies', async () => {
    const post = (extra: { raw?: string; body?: unknown }) => request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, ...extra });
    expect((await post({ raw: '{not json' })).status).toBe(400);
    expect((await post({ raw: '' })).json().error).toBe('No updatable fields provided');
    expect((await post({ raw: 'null' })).json().error).toBe('Body must be a JSON object');
    expect((await post({ raw: JSON.stringify({ admin_notes: 'x'.repeat(20 * 1024) }) })).status).toBe(413);
  });

  it('keeps pending and rejected laws off every public surface', async () => {
    const publicTotal = async () => (await request('GET', '/api/v1/laws?limit=1')).json().total;
    const publicSearchHits = async () => (await request('GET', '/api/v1/laws?q=zebrafish')).json().data.map((l: { id: number }) => l.id);
    const before = await publicTotal();

    expect(await publicSearchHits()).not.toContain(lawId);
    expect((await request('GET', `/api/v1/laws/${lawId}/related`)).status).toBe(404);

    await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { status: 'published' } });
    expect(await publicTotal()).toBe(before + 1);
    expect(await publicSearchHits()).toContain(lawId);

    await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { status: 'rejected' } });
    expect(await publicTotal()).toBe(before);
    expect(await publicSearchHits()).not.toContain(lawId);
    expect((await request('GET', `/api/v1/laws/${lawId}`)).status).toBe(404);
  });

  it('keeps law of the day working after the featured law is rejected', async () => {
    await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { status: 'published' } });
    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(lawId, new Date().toISOString().split('T')[0]);
    expect((await request('GET', '/api/v1/law-of-day')).json().law.id).toBe(lawId);

    await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { status: 'rejected' } });
    const reply = await request('GET', '/api/v1/law-of-day');
    expect(reply.status).toBe(200);
    expect(reply.json().law.id).not.toBe(lawId);
  });

  it('throttles repeated wrong tokens per IP without blocking the real admin or other IPs', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request('GET', '/api/v1/admin/laws', { token: 'wrong' })).status).toBe(401);
    }
    const blocked = await request('GET', '/api/v1/admin/laws', { token: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['Retry-After']).toBeGreaterThan(0);

    expect((await request('GET', '/api/v1/admin/laws', { token: 'wrong', from: '198.51.100.9' })).status).toBe(401);
    expect((await request('GET', '/api/v1/admin/laws', { token: TOKEN })).status).toBe(200);
  });

  it('keeps admin routes out of the public OpenAPI spec', async () => {
    const spec = (await request('GET', '/api/v1/openapi.json')).json();
    expect(Object.keys(spec.paths).filter((path) => path.includes('/admin'))).toEqual([]);
  });

  describe('thank-you email', () => {
    const post = (id: number, body: unknown) => request('POST', `/api/v1/admin/laws/${id}`, { token: TOKEN, body });
    const addContact = (id: number, type: string, value: string | null, name = 'Ann') =>
      db.prepare('INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, ?, ?, ?)').run(id, name, type, value);
    const sentAt = (id: number) => (db.prepare('SELECT approval_email_sent_at AS at FROM laws WHERE id = ?').get(id) as { at: string | null }).at;
    const newPendingLaw = () =>
      Number(db.prepare("INSERT INTO laws (title, text, status, first_seen_file_path) VALUES (NULL, 'Another submitted law about socks', 'in_review', 'web-submission')").run().lastInsertRowid);

    it('sends one thank-you through the real mail service and remembers it', async () => {
      addContact(lawId, 'email', 'ann@example.com');

      const approved = await post(lawId, { status: 'published' });
      expect(approved.json().thank_you).toEqual({ status: 'queued' });
      await vi.waitFor(() => expect(sentAt(lawId)).not.toBeNull());

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const [mail] = mockSendMail.mock.calls[0];
      expect(mail).toMatchObject({ from: 'noreply@murphys-laws.com', to: { name: '', address: 'ann@example.com' }, subject: 'Your Murphy\'s Law is now published' });
      expect(mail.bcc).toBeUndefined();
      expect(mail.text).toContain('Hi Ann,');
      expect(mail.text).toContain(`https://murphys-laws.com/law/${lawId}`);

      // Review and approve again: the submitter is not emailed twice.
      await post(lawId, { status: 'in_review' });
      const again = await post(lawId, { status: 'published' });
      expect(again.json().thank_you).toEqual({ status: 'skipped', reason: 'already_sent' });
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('retries on the next approval when the send failed', async () => {
      addContact(lawId, 'email', 'ann@example.com');
      mockSendMail.mockRejectedValueOnce(Object.assign(new Error('550 <ann@example.com> rejected'), { code: 'EENVELOPE', responseCode: 550 }));

      expect((await post(lawId, { status: 'published' })).json().thank_you).toEqual({ status: 'queued' });
      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setImmediate(resolve));
      expect(sentAt(lawId)).toBeNull();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('(code: EENVELOPE, response: 550)'));
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('ann@example.com');

      await post(lawId, { status: 'in_review' });
      expect((await post(lawId, { status: 'published' })).json().thank_you).toEqual({ status: 'queued' });
      await vi.waitFor(() => expect(sentAt(lawId)).not.toBeNull());
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it('answers before the mail server responds', async () => {
      addContact(lawId, 'email', 'ann@example.com');
      mockSendMail.mockReturnValue(new Promise(() => {}));
      const reply = await post(lawId, { status: 'published' });
      expect(reply.status).toBe(200);
      expect(reply.json().thank_you).toEqual({ status: 'queued' });
      expect(sentAt(lawId)).toBeNull();
    });

    it('says why nothing was sent', async () => {
      const noEmail = newPendingLaw();
      addContact(noEmail, 'text', 'Bob');
      expect((await post(noEmail, { status: 'published' })).json().thank_you).toEqual({ status: 'skipped', reason: 'no_email' });

      const badEmail = newPendingLaw();
      addContact(badEmail, 'email', 'a@b.co,c@d.co');
      expect((await post(badEmail, { status: 'published' })).json().thank_you).toEqual({ status: 'skipped', reason: 'invalid_email' });

      ({ server } = createApiServer({ db: db as any, emailService: new EmailService({}) }));
      const unconfigured = newPendingLaw();
      addContact(unconfigured, 'email', 'ann@example.com');
      expect((await post(unconfigured, { status: 'published' })).json().thank_you).toEqual({ status: 'skipped', reason: 'not_configured' });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('sends nothing for rejections, edits of pending laws, edits of published laws or stale requests', async () => {
      addContact(lawId, 'email', 'ann@example.com');

      expect((await post(lawId, { admin_notes: 'checking' })).json().thank_you).toBeNull();
      expect((await post(lawId, { status: 'published', updated_at: 'stale' })).status).toBe(409);
      expect((await post(lawId, { status: 'rejected' })).json().thank_you).toBeNull();

      await post(lawId, { status: 'published' });
      await post(lawId, { status: 'in_review' });
      await post(lawId, { status: 'rejected' });
      expect((await post(lawId, { status: 'published' })).json().thank_you).toBeNull();
      expect((await post(lawId, { admin_notes: 'edit after publishing' })).json().thank_you).toBeNull();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('uses the first valid email when a law lists several', async () => {
      addContact(lawId, 'email', 'broken address');
      addContact(lawId, 'email', 'zed@example.com', 'Zed');
      addContact(lawId, 'email', 'later@example.com', 'Later');
      await post(lawId, { status: 'published' });
      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalledTimes(1));
      expect(mockSendMail.mock.calls[0][0].to.address).toBe('zed@example.com');
      expect(mockSendMail.mock.calls[0][0].text).toContain('Hi Zed,');
    });
  });
});
