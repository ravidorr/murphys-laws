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

  const request = (method: string, url: string, { token, body, raw, from, extra }: { token?: string; body?: unknown; raw?: string; from?: string; extra?: Record<string, string> } = {}): Promise<Reply> =>
    new Promise((resolve) => {
      const stream = new Readable({ read() {} });
      if (raw !== undefined) stream.push(raw);
      else if (body !== undefined) stream.push(JSON.stringify(body));
      stream.push(null);
      const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': from ?? ip };
      if (token) headers.authorization = `Bearer ${token}`;
      Object.assign(headers, extra);
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

  it('changes the category of a law and rejects unknown categories', async () => {
    const list = (await request('GET', '/api/v1/admin/laws?status=in_review', { token: TOKEN })).json();
    expect(list.categories.length).toBeGreaterThan(1);
    const target = list.categories[1];

    const bad = await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { category_id: 999999 } });
    expect(bad.status).toBe(400);
    expect(bad.json().error).toBe('Unknown category');
    expect((await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { category_id: 'x' } })).status).toBe(400);

    const changed = await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { category_id: target.id, status: 'published' } });
    expect(changed.status).toBe(200);
    expect(changed.json().data.categories).toEqual([{ id: target.id, name: target.name }]);
    const inCategory = (await request('GET', `/api/v1/laws?category_id=${target.id}&limit=100`)).json();
    expect(inCategory.data.map((l: { id: number }) => l.id)).toContain(lawId);
  });

  describe('splitting corollaries out of a submitted law', () => {
    const bulleted = 'A red light turns green right after you stop watching it.\n\n• The Ignition Corollary: The engine restarts slowly behind a horn.\n• The Green-Light Corollary: The green lasts just long enough to miss.';
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    let submitted: number;

    beforeEach(() => {
      submitted = Number(
        db.prepare("INSERT INTO laws (title, text, status, first_seen_file_path) VALUES ('Lights', ?, 'in_review', 'web-submission')").run(bulleted).lastInsertRowid,
      );
      db.prepare("INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, 'Ringo', 'email', 'ringo@example.com')").run(submitted);
    });

    const candidates = async () => {
      const { data } = (await request('GET', '/api/v1/admin/laws?status=in_review', { token: TOKEN })).json();
      return data.find((l: { id: number }) => l.id === submitted);
    };

    it('offers the candidates, splits on the explicit body, publishes everything and thanks only the parent', async () => {
      const law = await candidates();
      expect(law.corollary_candidates.items.map((i: { title: string }) => i.title)).toEqual(['The Ignition Corollary', 'The Green-Light Corollary']);

      const reply = await request('POST', `/api/v1/admin/laws/${submitted}/split`, {
        token: TOKEN,
        body: {
          updated_at: law.updated_at,
          parent_text: law.corollary_candidates.parent_text,
          corollaries: law.corollary_candidates.items.map((i: { title: string; text: string }) => ({ title: i.title, text: i.text })),
        },
      });
      await flush();
      expect(reply.status).toBe(200);
      expect(reply.headers['Cache-Control']).toBe('no-store');
      const { data, corollaries, thank_you: thankYou } = reply.json();
      expect(data).toMatchObject({ id: submitted, status: 'published', text: law.corollary_candidates.parent_text });
      expect(corollaries).toHaveLength(2);
      expect(thankYou).toEqual({ status: 'queued' });
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toEqual({ name: '', address: 'ringo@example.com' });

      for (const child of corollaries) {
        expect((await request('GET', `/api/v1/laws/${child.id}`)).status).toBe(200);
      }
      expect(db.prepare('SELECT contact_type, contact_value FROM attributions WHERE law_id = ?').all(corollaries[0].id)).toEqual([{ contact_type: 'text', contact_value: null }]);
      expect((await request('GET', `/api/v1/laws/${submitted}`)).status).toBe(200);
      expect(await candidates()).toBeUndefined();
    });

    it('accepts a large valid split under the 64 KB cap while a plain update stays under 16 KB', async () => {
      const law = await candidates();
      const long = (n: number) => `${'中'.repeat(990)} ${n}`;
      const body = {
        updated_at: law.updated_at,
        parent_text: law.corollary_candidates.parent_text,
        corollaries: [1, 2, 3, 4, 5].map((n) => ({ title: '题'.repeat(200), text: long(n) })),
      };
      expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(16 * 1024);
      expect((await request('POST', `/api/v1/admin/laws/${submitted}`, { token: TOKEN, raw: JSON.stringify({ admin_notes: 'x'.repeat(17 * 1024) }) })).status).toBe(413);
      expect((await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, body })).status).toBe(200);
    });

    it('answers 409 for a stale page, 400 for a rule violation, 404 for a missing law and 413 for a huge body', async () => {
      const law = await candidates();
      const body = { updated_at: law.updated_at, parent_text: law.corollary_candidates.parent_text, corollaries: [{ title: null, text: 'A single corollary of enough length.' }] };

      expect((await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, body: { ...body, updated_at: 'stale' } })).status).toBe(409);
      expect((await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, body: { ...body, corollaries: [] } })).status).toBe(400);
      expect((await request('POST', '/api/v1/admin/laws/999999/split', { token: TOKEN, body })).status).toBe(404);
      expect((await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, raw: JSON.stringify({ ...body, pad: 'x'.repeat(70 * 1024) }) })).status).toBe(413);
      expect((await request('POST', `/api/v1/admin/laws/${submitted}/split`, { body })).status).toBe(401);
      expect(db.prepare('SELECT status FROM laws WHERE id = ?').get(submitted)).toEqual({ status: 'in_review' });

      const ok = await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, body });
      expect(ok.status).toBe(200);
      const again = await request('POST', `/api/v1/admin/laws/${submitted}/split`, { token: TOKEN, body: { ...body, updated_at: ok.json().data.updated_at } });
      expect(again.status).toBe(400);
      expect(again.json().error).toBe('Only a law in review can be split');
    });

    it('moves the corollaries with their law on a plain reject, and refuses to publish a corollary before its law', async () => {
      const law = await candidates();
      const split = await request('POST', `/api/v1/admin/laws/${submitted}/split`, {
        token: TOKEN,
        body: { updated_at: law.updated_at, parent_text: law.corollary_candidates.parent_text, corollaries: [{ title: 'One', text: 'The engine restarts slowly behind a horn.' }] },
      });
      await flush();
      const [child] = split.json().corollaries;

      const rejected = await request('POST', `/api/v1/admin/laws/${submitted}`, { token: TOKEN, body: { status: 'rejected' } });
      expect(rejected.json().cascaded).toBe(1);
      expect(db.prepare('SELECT status FROM laws WHERE id = ?').get(child.id)).toEqual({ status: 'rejected' });
      expect((await request('GET', `/api/v1/laws/${child.id}`)).status).toBe(404);

      const orphan = await request('POST', `/api/v1/admin/laws/${child.id}`, { token: TOKEN, body: { status: 'published' } });
      expect(orphan.status).toBe(400);
      expect(orphan.json().error).toContain(`#${submitted}`);

      await request('POST', `/api/v1/admin/laws/${submitted}`, { token: TOKEN, body: { status: 'published' } });
      expect((await request('POST', `/api/v1/admin/laws/${child.id}`, { token: TOKEN, body: { status: 'published' } })).status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitting corollaries with a law and reviewing them as one submission', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const ONE = 'The engine restarts slowly when someone behind you is honking.';
    const TWO = 'The green lasts just long enough for you to miss it.';
    let submitted: { id: number; corollaries: { id: number }[] };

    const queue = async (extra = '') => (await request('GET', `/api/v1/admin/laws?status=in_review${extra}`, { token: TOKEN })).json();
    const statuses = () => [submitted.id, ...submitted.corollaries.map((c) => c.id)].map((id) => (db.prepare('SELECT status FROM laws WHERE id = ?').get(id) as { status: string }).status);

    beforeEach(async () => {
      db.prepare('DELETE FROM laws WHERE id = ?').run(lawId);
      const reply = await request('POST', '/api/v1/laws', {
        body: { title: 'Start-Stop', text: 'A red light turns green right after you stop watching it.', author: 'Ringo', email: 'ringo@example.com', corollaries: [{ title: 'The Ignition Corollary', text: ONE }, { text: TWO }] },
      });
      expect(reply.status).toBe(201);
      submitted = reply.json();
      await flush();
    });

    it('answers with the created corollaries and emails the moderator one message that lists them', () => {
      expect(submitted.corollaries).toHaveLength(2);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.to).toBe('admin@murphys-laws.com');
      expect(mail.text).toContain(`Corollary 1: The Ignition Corollary - ${ONE}`);
      expect(mail.html).toContain(TWO);
    });

    it('shows one card with nested corollaries and a badge that counts the submission once', async () => {
      const body = await queue();
      expect(body.data.map((l: { id: number }) => l.id)).toEqual([submitted.id]);
      expect(body.total).toBe(1);
      expect(body.counts.in_review).toBe(1);
      expect(body.data[0].children.map((c: { text: string }) => c.text)).toEqual([ONE, TWO]);
      expect((await queue('&q=honking')).data.map((l: { id: number }) => l.id)).toEqual([submitted.id]);
    });

    it('approves the law and publishes every corollary in one step, thanking the submitter once and listing them', async () => {
      mockSendMail.mockClear();
      const approved = await request('POST', `/api/v1/admin/laws/${submitted.id}`, { token: TOKEN, body: { status: 'published' } });
      await flush();

      expect(approved.status).toBe(200);
      expect(approved.json().cascaded).toBe(2);
      expect(statuses()).toEqual(['published', 'published', 'published']);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.to).toEqual({ name: '', address: 'ringo@example.com' });
      expect(mail.text).toContain(ONE);
      expect(mail.text).toContain(`/law/${submitted.corollaries[1].id}`);

      const page = (await request('GET', `/api/v1/laws/${submitted.id}`)).json();
      expect(page.corollaries.map((c: { id: number }) => c.id)).toEqual(submitted.corollaries.map((c) => c.id));
      expect((await queue()).counts.in_review).toBe(0);
    });

    it('rejects one corollary on its own, then approves the rest, and leaves the rejected one out of the thank-you', async () => {
      mockSendMail.mockClear();
      const [first, second] = submitted.corollaries;
      expect((await request('POST', `/api/v1/admin/laws/${first.id}`, { token: TOKEN, body: { status: 'rejected' } })).status).toBe(200);
      const card = (await queue()).data[0];
      expect(card.children.map((c: { status: string }) => c.status)).toEqual(['rejected', 'in_review']);
      expect((await queue()).counts.in_review).toBe(1);

      const edit = await request('POST', `/api/v1/admin/laws/${second.id}`, { token: TOKEN, body: { text: `${TWO} Edited.`, updated_at: card.children[1].updated_at } });
      expect(edit.status).toBe(200);
      await request('POST', `/api/v1/admin/laws/${submitted.id}`, { token: TOKEN, body: { status: 'published' } });
      await flush();

      expect(statuses()).toEqual(['published', 'rejected', 'published']);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.text).toContain(`${TWO} Edited.`);
      expect(mail.text).not.toContain(ONE);
    });

    it('rejects the whole submission with its corollaries', async () => {
      const rejected = await request('POST', `/api/v1/admin/laws/${submitted.id}`, { token: TOKEN, body: { status: 'rejected' } });
      expect(rejected.json().cascaded).toBe(2);
      expect(statuses()).toEqual(['rejected', 'rejected', 'rejected']);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('refuses an oversized or malformed submission body', async () => {
      expect((await request('POST', '/api/v1/laws', { raw: JSON.stringify({ text: 'A perfectly fine law text.', pad: 'x'.repeat(33 * 1024) }) })).status).toBe(413);
      expect((await request('POST', '/api/v1/laws', { body: { text: 'A perfectly fine law text.', corollaries: [{ text: 'short' }] } })).status).toBe(400);
    });
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

  it('logs whether GitHub sign-in is enabled, partly configured or off at startup', () => {
    const oauth = {
      GITHUB_OAUTH_CLIENT_ID: 'id',
      GITHUB_OAUTH_CLIENT_SECRET: 'secret',
      ADMIN_GITHUB_USERS: 'ravidorr',
      ADMIN_SESSION_SECRET: 'z'.repeat(40),
      BASE_URL: 'https://murphys-laws.com', // Vitest itself sets BASE_URL to '/'
    };
    // createApiServer loads a developer's local .env, which dotenv only applies to variables that are
    // not already defined, so blank them (empty counts as unset) instead of deleting them.
    const saved = Object.fromEntries(Object.keys(oauth).map((key) => [key, process.env[key]]));
    for (const key of Object.keys(oauth)) process.env[key] = '';
    // The server built in beforeEach already logged using those local values.
    vi.mocked(console.log).mockClear();
    vi.mocked(console.warn).mockClear();
    try {
      createApiServer({ db: db as any });
      expect(console.log).not.toHaveBeenCalledWith('Admin GitHub sign-in enabled');
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('Admin GitHub sign-in disabled'));

      Object.assign(process.env, oauth);
      createApiServer({ db: db as any });
      expect(console.log).toHaveBeenCalledWith('Admin GitHub sign-in enabled');

      process.env.ADMIN_GITHUB_USERS = '';
      createApiServer({ db: db as any });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Admin GitHub sign-in disabled (incomplete)'));

      process.env.ADMIN_GITHUB_USERS = 'ravidorr';
      process.env.ADMIN_SESSION_SECRET = 'short';
      createApiServer({ db: db as any });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Admin GitHub sign-in disabled (session secret too short)'));
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
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
  describe('GitHub sign-in', () => {
    const OAUTH = {
      GITHUB_OAUTH_CLIENT_ID: 'client-id',
      GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
      ADMIN_GITHUB_USERS: 'ravidorr',
      ADMIN_SESSION_SECRET: 'z'.repeat(40),
      BASE_URL: 'https://murphys-laws.com',
    };
    const csrf = { 'x-admin-request': '1', origin: 'https://murphys-laws.com' };
    const githubReply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    const cookieOf = (reply: Reply, name: string) => {
      const setCookie = ([] as string[]).concat(reply.headers['Set-Cookie'] as unknown as string[]);
      const found = setCookie.find((cookie) => cookie.startsWith(`${name}=`));
      return found ? found.split(';')[0] : undefined;
    };

    /** Runs the whole browser flow against the real server with GitHub stubbed, and returns the session cookie. */
    const signIn = async (login = 'ravidorr') => {
      const fetchStub = vi.fn(async (url: string) =>
        githubReply(url.includes('access_token') ? { access_token: 'gho_abc' } : { login, id: 42 }));
      vi.stubGlobal('fetch', fetchStub);
      ({ server } = createApiServer({ db: db as any, emailService: smtp() }));

      const start = await request('GET', '/api/v1/admin/auth/github');
      expect(start.status).toBe(302);
      const state = new URL(start.headers.Location).searchParams.get('state') as string;
      const callback = await request('GET', `/api/v1/admin/auth/github/callback?code=abc&state=${state}`, {
        extra: { cookie: cookieOf(start, 'admin_oauth_state') as string },
      });
      return { start, callback, state, fetchStub };
    };

    beforeEach(() => {
      delete process.env.ADMIN_API_TOKEN;
      Object.assign(process.env, OAUTH);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const key of Object.keys(OAUTH)) delete process.env[key];
    });

    it('lets an allowlisted GitHub user moderate with the session cookie and no token', async () => {
      const { callback } = await signIn();
      expect(callback.status).toBe(302);
      expect(callback.headers.Location).toBe('/admin');
      const session = cookieOf(callback, 'admin_session') as string;
      expect(session).toBeTruthy();

      expect((await request('GET', '/api/v1/admin/auth/session', { extra: { cookie: session } })).json()).toEqual({
        authenticated: true,
        login: 'ravidorr',
        oauth: true,
      });

      const list = await request('GET', '/api/v1/admin/laws?status=in_review', { extra: { cookie: session } });
      expect(list.status).toBe(200);
      const [{ updated_at }] = list.json().data;

      const approved = await request('POST', `/api/v1/admin/laws/${lawId}`, {
        body: { status: 'published', updated_at },
        extra: { cookie: session, ...csrf },
      });
      expect(approved.status).toBe(200);
      expect((await request('GET', `/api/v1/laws/${lawId}`)).status).toBe(200);
    });

    it('rejects a cookie-authenticated write that lacks the CSRF header or comes from another origin', async () => {
      const session = cookieOf((await signIn()).callback, 'admin_session') as string;
      const write = (extra: Record<string, string>) =>
        request('POST', `/api/v1/admin/laws/${lawId}`, { body: { status: 'published' }, extra: { cookie: session, ...extra } });

      expect((await write({})).status).toBe(403);
      expect((await write({ origin: 'https://murphys-laws.com' })).status).toBe(403);
      expect((await write({ 'x-admin-request': '1', origin: 'https://evil.example.com' })).status).toBe(403);
      expect((await request('GET', `/api/v1/laws/${lawId}`)).status).toBe(404);
    });

    it('signs out: logout needs the CSRF header and clears the cookie', async () => {
      const session = cookieOf((await signIn()).callback, 'admin_session') as string;
      expect((await request('POST', '/api/v1/admin/auth/logout', { extra: { cookie: session } })).status).toBe(403);

      const out = await request('POST', '/api/v1/admin/auth/logout', { extra: { cookie: session, ...csrf } });
      expect(out.status).toBe(200);
      expect(out.headers['Set-Cookie']).toContain('admin_session=; ');
      expect(out.headers['Set-Cookie']).toContain('Max-Age=0');
    });

    it('rejects a GitHub user who is not on the allowlist', async () => {
      const { callback } = await signIn('stranger');
      expect(callback.status).toBe(403);
      expect(cookieOf(callback, 'admin_session')).toBeUndefined();
    });

    it('rejects a callback whose state does not match, or that has no state cookie, without calling GitHub', async () => {
      const { start, fetchStub } = await signIn();
      fetchStub.mockClear();

      const wrongState = await request('GET', `/api/v1/admin/auth/github/callback?code=abc&state=${'0'.repeat(32)}`, {
        extra: { cookie: cookieOf(start, 'admin_oauth_state') as string },
      });
      const noCookie = await request('GET', `/api/v1/admin/auth/github/callback?code=abc&state=${'0'.repeat(32)}`);
      expect(wrongState.status).toBe(400);
      expect(noCookie.status).toBe(400);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('rate limits repeated failed sign-ins', async () => {
      await signIn();
      const attempt = () => request('GET', '/api/v1/admin/auth/github/callback?code=abc&state=bad');
      const statuses: number[] = [];
      for (let i = 0; i < 12; i += 1) statuses.push((await attempt()).status);
      expect(statuses.slice(0, 10).every((code) => code === 400)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    });

    it('keeps the API token working, with no CSRF header, alongside the sign-in', async () => {
      process.env.ADMIN_API_TOKEN = TOKEN;
      const list = await request('GET', '/api/v1/admin/laws', { token: TOKEN });
      expect(list.status).toBe(200);
      const approved = await request('POST', `/api/v1/admin/laws/${lawId}`, { token: TOKEN, body: { status: 'published' } });
      expect(approved.status).toBe(200);
    });

    it('serves the admin page when only the sign-in is configured, and offers the sign-in on the session check', async () => {
      expect((await request('GET', '/admin')).status).toBe(200);
      const check = await request('GET', '/api/v1/admin/auth/session');
      expect(check.status).toBe(200);
      expect(check.json()).toEqual({ authenticated: false, oauth: true });
    });

    it('hides the sign-in routes when it is not configured', async () => {
      delete process.env.GITHUB_OAUTH_CLIENT_ID;
      process.env.ADMIN_API_TOKEN = TOKEN;
      expect((await request('GET', '/api/v1/admin/auth/github')).status).toBe(404);
      expect((await request('GET', '/api/v1/admin/auth/github/callback?code=a&state=b')).status).toBe(404);
      expect((await request('GET', '/api/v1/admin/auth/session')).json()).toEqual({ authenticated: false, oauth: false });
    });
  });
});
