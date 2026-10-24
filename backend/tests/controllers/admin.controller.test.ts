import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminController } from '../../src/controllers/admin.controller.ts';

vi.mock('../../src/middleware/rate-limit.ts', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 9, resetTime: 0 })),
}));
vi.mock('../../src/utils/http-helpers.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, readBody: vi.fn(), getVoterIdentifier: vi.fn(() => '127.0.0.1') };
});

import { checkRateLimit } from '../../src/middleware/rate-limit.ts';
import { readBody, PayloadTooLargeError } from '../../src/utils/http-helpers.ts';

const TOKEN = 't'.repeat(40);

describe('AdminController', () => {
  let service: { listLaws: ReturnType<typeof vi.fn>; updateLaw: ReturnType<typeof vi.fn> };
  let controller: AdminController;
  let emailService: { isConfigured: ReturnType<typeof vi.fn>; sendLawApprovedEmail: ReturnType<typeof vi.fn> };
  let req: { headers: Record<string, string> };
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  const status = () => res.writeHead.mock.calls[0][0];
  const headers = () => res.writeHead.mock.calls[0][1];
  const payload = () => JSON.parse(res.end.mock.calls[0][0]);
  const update = async (body: unknown, id = '5') => {
    vi.mocked(readBody).mockResolvedValue(body as Record<string, unknown>);
    await controller.update(req, res, id);
  };

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    service = {
      listLaws: vi.fn(() => ({ data: [], total: 0, counts: {} })),
      updateLaw: vi.fn(() => ({ outcome: 'updated', law: { id: 5 }, previousStatus: 'in_review' })),
    };
    emailService = { isConfigured: vi.fn(() => true), sendLawApprovedEmail: vi.fn(() => Promise.resolve(true)) };
    controller = new AdminController(service, emailService);
    req = { headers: { authorization: `Bearer ${TOKEN}` } };
    res = { writeHead: vi.fn(), end: vi.fn() };
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, limit: 10, remaining: 9, resetTime: 0 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
    vi.restoreAllMocks();
  });

  describe('authorization', () => {
    it('returns 404 when the admin API is disabled, without touching the rate limiter', async () => {
      delete process.env.ADMIN_API_TOKEN;
      await controller.list(req, res, { query: {} });
      expect(status()).toBe(404);
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('returns 401 for a wrong token and counts it as a failed login', async () => {
      req.headers.authorization = 'Bearer nope';
      await controller.list(req, res, { query: {} });
      expect(status()).toBe(401);
      expect(checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'admin-fail');
      expect(service.listLaws).not.toHaveBeenCalled();
    });

    it('returns 429 when failed logins exceed the limit, without logging every throttled attempt', async () => {
      req.headers.authorization = 'Bearer nope';
      vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, limit: 10, remaining: 0, resetTime: Date.now() + 1000 });
      await controller.list(req, res, { query: {} });
      expect(status()).toBe(429);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('does not rate limit valid requests', async () => {
      await controller.list(req, res, { query: {} });
      expect(status()).toBe(200);
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('requires auth on update', async () => {
      req.headers.authorization = '';
      await update({ status: 'rejected' });
      expect(status()).toBe(401);
      expect(service.updateLaw).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('lists in_review laws by default with bounded paging and no-store caching', async () => {
      await controller.list(req, res, { query: { limit: '500', offset: 'x', q: ' toast ' } });
      expect(service.listLaws).toHaveBeenCalledWith({ status: 'in_review', q: 'toast', limit: 100, offset: 0 });
      expect(status()).toBe(200);
      expect(headers()['Cache-Control']).toBe('no-store');
      expect(payload()).toMatchObject({ status: 'in_review', limit: 100, offset: 0, q: 'toast' });
    });

    it('treats blank paging values as unset and rejects an overlong search', async () => {
      await controller.list(req, res, { query: { limit: '', offset: '' } });
      expect(service.listLaws).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, offset: 0 }));

      res.writeHead.mockClear();
      await controller.list(req, res, { query: { q: 'x'.repeat(201) } });
      expect(status()).toBe(400);
    });

    it.each([
      [{ limit: '0' }, 1],
      [{ limit: '-5' }, 1],
      [{ limit: '12.9' }, 12],
    ])('bounds limit %j to %i', async (query, expected) => {
      await controller.list(req, res, { query });
      expect(service.listLaws).toHaveBeenCalledWith(expect.objectContaining({ limit: expected }));
    });

    it('clamps a negative offset to 0', async () => {
      await controller.list(req, res, { query: { offset: '-3' } });
      expect(service.listLaws).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
    });

    it('accepts status=all', async () => {
      await controller.list(req, res, { query: { status: 'all' } });
      expect(service.listLaws).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }));
    });

    it.each(['bogus', ['a', 'b']])('rejects invalid status %j', async (value) => {
      await controller.list(req, res, { query: { status: value } });
      expect(status()).toBe(400);
    });
  });

  describe('update', () => {
    it('updates all fields and logs the change', async () => {
      await update({ status: 'published', text: '  A valid law text  ', title: ' T ', admin_notes: ' n ', updated_at: 'v1' });
      expect(service.updateLaw).toHaveBeenCalledWith(5, {
        status: 'published',
        text: 'A valid law text',
        title: 'T',
        adminNotes: 'n',
        expectedUpdatedAt: 'v1',
      });
      expect(status()).toBe(200);
      expect(headers()['Cache-Control']).toBe('no-store');
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).toEqual({
        event: 'admin_law_update',
        lawId: 5,
        actor: '127.0.0.1',
        fields: ['status', 'text', 'title', 'adminNotes'],
        statusFrom: 'in_review',
        statusTo: 'published',
        guarded: true,
      });
    });

    it('logs without status text or notes and reports unguarded updates', async () => {
      await update({ admin_notes: 'secret reasoning', updated_at: null });
      const line = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(line).not.toContain('secret reasoning');
      expect(JSON.parse(line)).toMatchObject({ statusFrom: 'in_review', statusTo: 'in_review', guarded: false, fields: ['adminNotes'] });
      expect(service.updateLaw).toHaveBeenCalledWith(5, { adminNotes: 'secret reasoning' });
    });

    it('accepts text at exactly the minimum and maximum length', async () => {
      await update({ text: 'x'.repeat(10) });
      await update({ text: 'x'.repeat(1000) });
      expect(service.updateLaw).toHaveBeenCalledTimes(2);
    });

    it('clears title and notes with null or blank values', async () => {
      await update({ title: '  ', admin_notes: null });
      expect(service.updateLaw).toHaveBeenLastCalledWith(5, { title: null, adminNotes: null });
      await update({ title: null, admin_notes: '  ' });
      expect(service.updateLaw).toHaveBeenLastCalledWith(5, { title: null, adminNotes: null });
    });

    it.each([
      ['invalid id', {}, 'abc'],
      ['invalid status', { status: 'x' }, '5'],
      ['non-string text', { text: 5 }, '5'],
      ['non-string text with other fields', { status: 'published', text: null }, '5'],
      ['text too short', { text: 'x'.repeat(9) }, '5'],
      ['text too long', { text: 'x'.repeat(1001) }, '5'],
      ['non-string title', { title: 5 }, '5'],
      ['title too long', { title: 'x'.repeat(201) }, '5'],
      ['non-string notes', { admin_notes: 5 }, '5'],
      ['notes too long', { admin_notes: 'x'.repeat(2001) }, '5'],
      ['non-string updated_at', { status: 'published', updated_at: 5 }, '5'],
      ['empty update', {}, '5'],
      ['null body', null, '5'],
      ['array body', [], '5'],
      ['string body', 'x', '5'],
    ])('rejects %s with 400', async (_name, body, id) => {
      await update(body, id);
      expect(status()).toBe(400);
      expect(service.updateLaw).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON with 400 but rethrows other read errors', async () => {
      vi.mocked(readBody).mockRejectedValue(new SyntaxError('bad'));
      await controller.update(req, res, '5');
      expect(status()).toBe(400);

      vi.mocked(readBody).mockRejectedValue(new Error('socket closed'));
      await expect(controller.update(req, res, '5')).rejects.toThrow('socket closed');
    });

    it('answers 413 for oversized bodies and passes a size cap to readBody', async () => {
      vi.mocked(readBody).mockRejectedValue(new PayloadTooLargeError());
      await controller.update(req, res, '5');
      expect(status()).toBe(413);
      expect(vi.mocked(readBody).mock.calls[0][1]).toBe(16 * 1024);
    });

    it('logs conflicts and missing laws as warnings', async () => {
      service.updateLaw.mockReturnValue({ outcome: 'conflict' });
      await update({ status: 'rejected', updated_at: 'old' });
      service.updateLaw.mockReturnValue({ outcome: 'not_found' });
      await update({ status: 'rejected' });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('rejected: law changed'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missing law 5'));
    });

    describe('thank-you email', () => {
      const approved = (attributions: unknown[], over: Record<string, unknown> = {}) => ({
        outcome: 'updated',
        previousStatus: 'in_review',
        law: { id: 5, title: 'T', text: 'Law text of enough length', status: 'published', attributions, ...over },
      });
      const ann = { name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' };

      it('queues a thank-you when a pending law with an email address is approved', async () => {
        service.updateLaw.mockReturnValue(approved([{ name: 'Bob', contact_type: 'text', contact_value: null }, ann]));
        await update({ status: 'published' });

        expect(emailService.sendLawApprovedEmail).toHaveBeenCalledWith('ann@example.com', {
          id: 5,
          title: 'T',
          text: 'Law text of enough length',
          name: 'Ann',
        });
        expect(payload().thank_you_queued).toBe(true);
      });

      it.each([
        ['no attribution', []],
        ['no email contact', [{ name: 'Ann', contact_type: 'text', contact_value: 'x' }]],
        ['null contact value', [{ name: 'Ann', contact_type: 'email', contact_value: null }]],
        ['malformed address', [{ name: 'Ann', contact_type: 'email', contact_value: 'not an email' }]],
        ['overlong address', [{ name: 'Ann', contact_type: 'email', contact_value: `${'a'.repeat(250)}@b.co` }]],
      ])('does not send with %s', async (_name, attributions) => {
        service.updateLaw.mockReturnValue(approved(attributions));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
        expect(payload().thank_you_queued).toBe(false);
      });

      it.each([
        ['rejecting', { law: { status: 'rejected' } }],
        ['editing an already published law', { previousStatus: 'published' }],
        ['re-approving a rejected law', { previousStatus: 'rejected' }],
      ])('does not send when %s', async (_name, over) => {
        const result = approved([ann]);
        service.updateLaw.mockReturnValue({ ...result, ...over, law: { ...result.law, ...(over as any).law } });
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
      });

      it('skips sending when SMTP is not configured', async () => {
        emailService.isConfigured.mockReturnValue(false);
        service.updateLaw.mockReturnValue(approved([ann]));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
        expect(payload().thank_you_queued).toBe(false);
      });

      it('still answers 200 and logs when sending rejects', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        emailService.sendLawApprovedEmail.mockReturnValue(Promise.reject(new Error('smtp down')));
        service.updateLaw.mockReturnValue(approved([ann]));
        await update({ status: 'published' });
        await Promise.resolve();

        expect(status()).toBe(200);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('law ID 5'), expect.any(Error));
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('ann@example.com');
      });
    });

    it('returns 404 for unknown laws and 409 for conflicts', async () => {
      service.updateLaw.mockReturnValue({ outcome: 'not_found' });
      await update({ status: 'rejected' });
      expect(status()).toBe(404);
      expect(payload()).toEqual({ error: 'Law not found' });

      res.writeHead.mockClear();
      res.end.mockClear();
      service.updateLaw.mockReturnValue({ outcome: 'conflict' });
      await update({ status: 'rejected', updated_at: 'old' });
      expect(status()).toBe(409);
      expect(payload().error).toContain('changed since you loaded it');
    });
  });
});
