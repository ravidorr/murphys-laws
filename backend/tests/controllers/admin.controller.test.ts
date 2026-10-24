import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminController } from '../../src/controllers/admin.controller.ts';

vi.mock('../../src/middleware/rate-limit.ts', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, limit: 120, remaining: 10, resetTime: 0 })),
}));
vi.mock('../../src/utils/http-helpers.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, readBody: vi.fn(), getVoterIdentifier: vi.fn(() => '127.0.0.1') };
});

import { checkRateLimit } from '../../src/middleware/rate-limit.ts';
import { readBody } from '../../src/utils/http-helpers.ts';

describe('AdminController', () => {
  let service: { listLaws: ReturnType<typeof vi.fn>; updateLaw: ReturnType<typeof vi.fn> };
  let controller: AdminController;
  let req: { headers: Record<string, string> };
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  const status = () => res.writeHead.mock.calls[0][0];
  const payload = () => JSON.parse(res.end.mock.calls[0][0]);
  const update = async (body: unknown, id = '5') => {
    vi.mocked(readBody).mockResolvedValue(body as Record<string, unknown>);
    await controller.update(req, res, id);
  };

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = 'tok';
    service = { listLaws: vi.fn(() => ({ data: [], total: 0, counts: {} })), updateLaw: vi.fn(() => ({ id: 5 })) };
    controller = new AdminController(service);
    req = { headers: { authorization: 'Bearer tok' } };
    res = { writeHead: vi.fn(), end: vi.fn() };
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, limit: 120, remaining: 10, resetTime: 0 });
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
  });

  it('returns 404 when disabled, 401 when unauthorized, 429 when rate limited', async () => {
    delete process.env.ADMIN_API_TOKEN;
    await controller.list(req, res, { query: {} });
    expect(status()).toBe(404);

    process.env.ADMIN_API_TOKEN = 'tok';
    res.writeHead.mockClear();
    req.headers.authorization = 'Bearer nope';
    await controller.list(req, res, { query: {} });
    expect(status()).toBe(401);

    res.writeHead.mockClear();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, limit: 120, remaining: 0, resetTime: Date.now() + 1000 });
    await controller.list(req, res, { query: {} });
    expect(status()).toBe(429);
    expect(service.listLaws).not.toHaveBeenCalled();
  });

  it('lists in_review laws by default with bounded paging', async () => {
    await controller.list(req, res, { query: { limit: '500', offset: 'x', q: ' toast ' } });
    expect(service.listLaws).toHaveBeenCalledWith({ status: 'in_review', q: 'toast', limit: 100, offset: 0 });
    expect(status()).toBe(200);
    expect(payload()).toMatchObject({ status: 'in_review', limit: 100, offset: 0, q: 'toast' });
  });

  it('accepts status=all and rejects invalid status', async () => {
    await controller.list(req, res, { query: { status: 'all' } });
    expect(service.listLaws).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }));

    res.writeHead.mockClear();
    await controller.list(req, res, { query: { status: 'bogus' } });
    expect(status()).toBe(400);
  });

  it('updates all fields', async () => {
    await update({ status: 'published', text: '  A valid law text  ', title: ' T ', admin_notes: ' n ' });
    expect(service.updateLaw).toHaveBeenCalledWith(5, { status: 'published', text: 'A valid law text', title: 'T', adminNotes: 'n' });
    expect(status()).toBe(200);
  });

  it('clears title and notes with null or blank values', async () => {
    await update({ title: '  ', admin_notes: null });
    expect(service.updateLaw).toHaveBeenCalledWith(5, { title: null, adminNotes: null });

    service.updateLaw.mockClear();
    await update({ title: null, admin_notes: '  ' });
    expect(service.updateLaw).toHaveBeenCalledWith(5, { title: null, adminNotes: null });
  });

  it.each([
    ['invalid id', {}, 'abc'],
    ['invalid status', { status: 'x' }, '5'],
    ['non-string text', { text: 5 }, '5'],
    ['short text', { text: 'short' }, '5'],
    ['non-string title', { title: 5 }, '5'],
    ['non-string notes', { admin_notes: 5 }, '5'],
    ['empty update', {}, '5'],
  ])('rejects %s', async (_name, body, id) => {
    await update(body, id);
    expect(status()).toBe(400);
    expect(service.updateLaw).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON and unknown laws', async () => {
    vi.mocked(readBody).mockRejectedValue(new Error('bad'));
    await controller.update(req, res, '5');
    expect(status()).toBe(400);

    res.writeHead.mockClear();
    service.updateLaw.mockReturnValue(null);
    await update({ status: 'rejected' });
    expect(status()).toBe(404);
  });

  it('requires auth on update', async () => {
    req.headers.authorization = '';
    await update({ status: 'rejected' });
    expect(status()).toBe(401);
  });
});
