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
  let service: { listLaws: ReturnType<typeof vi.fn>; updateLaw: ReturnType<typeof vi.fn>; markApprovalEmailSent: ReturnType<typeof vi.fn> };
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
      markApprovalEmailSent: vi.fn(),
      listLaws: vi.fn(() => ({ data: [], total: 0, counts: {} })),
      updateLaw: vi.fn(() => ({ outcome: 'updated', law: { id: 5 }, previousStatus: 'in_review' })),
    };
    emailService = { isConfigured: vi.fn(() => true), sendLawApprovedEmail: vi.fn(() => Promise.resolve({ status: 'sent' })) };
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
      const approved = (attributions: unknown[], over: Record<string, unknown> = {}, lawOver: Record<string, unknown> = {}) => ({
        outcome: 'updated',
        previousStatus: 'in_review',
        law: { id: 5, title: 'T', text: 'Law text of enough length', status: 'published', approval_email_sent_at: null, attributions, ...lawOver },
        ...over,
      });
      const ann = { name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' };
      const thankYou = () => payload().thank_you;
      const flush = () => new Promise((resolve) => setImmediate(resolve));

      it('queues a thank-you when a pending law with an email address is approved, and records it once sent', async () => {
        service.updateLaw.mockReturnValue(approved([{ name: 'Bob', contact_type: 'text', contact_value: null }, ann]));
        await update({ status: 'published' });
        await flush();

        expect(emailService.sendLawApprovedEmail).toHaveBeenCalledWith('ann@example.com', {
          id: 5,
          title: 'T',
          text: 'Law text of enough length',
          name: 'Ann',
        });
        expect(thankYou()).toEqual({ status: 'queued' });
        expect(service.markApprovalEmailSent).toHaveBeenCalledWith(5);
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string).thankYou).toBe('queued');
      });

      it('uses the first valid email contact and ignores invalid ones before it', async () => {
        const bad = { name: 'Bad', contact_type: 'email', contact_value: 'nope' };
        const second = { name: 'Zed', contact_type: 'email', contact_value: 'zed@example.com' };
        const third = { name: 'Third', contact_type: 'email', contact_value: 'third@example.com' };
        service.updateLaw.mockReturnValue(approved([bad, second, third, { name: 'N', contact_type: 'email', contact_value: 42 }]));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).toHaveBeenCalledTimes(1);
        expect(emailService.sendLawApprovedEmail.mock.calls[0][0]).toBe('zed@example.com');
      });

      it.each([
        ['no attribution', [], 'no_email'],
        ['no email contact', [{ name: 'Ann', contact_type: 'text', contact_value: 'x' }], 'no_email'],
        ['null contact value', [{ name: 'Ann', contact_type: 'email', contact_value: null }], 'no_email'],
        ['numeric contact value', [{ name: 'Ann', contact_type: 'email', contact_value: 7 }], 'no_email'],
        ['malformed address', [{ name: 'Ann', contact_type: 'email', contact_value: 'not an email' }], 'invalid_email'],
        ['overlong address', [{ name: 'Ann', contact_type: 'email', contact_value: `${'a'.repeat(250)}@b.co` }], 'invalid_email'],
      ])('skips with %s', async (_name, attributions, reason) => {
        service.updateLaw.mockReturnValue(approved(attributions));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
        expect(thankYou()).toEqual({ status: 'skipped', reason });
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string).thankYou).toBe(`skipped:${reason}`);
      });

      it.each([
        'a@b.co,c@d.co',
        'a@b.co;c@d.co',
        'a@b.co\r\nBcc: x@y.co',
        'a@b.co\nBcc: x@y.co',
        'Ann <a@b.co>',
        '"Ann" <a@b.co>',
        '<a@b.co>',
        'a@b.co>',
        'g:a@b.co;',
        'a@@b.co',
        '@b.co',
        'a@b.',
        'a b@c.co',
        '"a,b"@c.co',
        'a@[127.0.0.1]',
        'a(comment)@b.co',
      ])('refuses the injection or multi-recipient form %j', async (address) => {
        service.updateLaw.mockReturnValue(approved([{ name: 'Ann', contact_type: 'email', contact_value: address }]));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
        expect(thankYou().reason).toBe('invalid_email');
      });

      it.each(['a@b.co', 'a+tag@b.co', 'first.last@sub.example.org', 'ann@exämple.com', 'ännä@example.com'])('accepts %s', async (address) => {
        service.updateLaw.mockReturnValue(approved([{ name: 'Ann', contact_type: 'email', contact_value: address }]));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail.mock.calls[0][0]).toBe(address);
      });

      it.each([
        ['rejecting', { law: { id: 5, status: 'rejected', attributions: [ann] } }],
        ['editing an already published law', { previousStatus: 'published' }],
        ['editing a law that is still in review', { law: { id: 5, status: 'in_review', attributions: [ann] } }],
        ['re-approving a rejected law', { previousStatus: 'rejected' }],
      ])('does not send and reports nothing when %s', async (_name, over) => {
        service.updateLaw.mockReturnValue(approved([ann], over as Record<string, unknown>));
        await update({ status: 'published' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
        expect(thankYou()).toBeNull();
      });

      it('does not email after a conflict or a missing law', async () => {
        for (const outcome of ['conflict', 'not_found']) {
          res.writeHead.mockClear();
          res.end.mockClear();
          service.updateLaw.mockReturnValue({ outcome, previousStatus: 'in_review', law: approved([ann]).law });
          await update({ status: 'published', updated_at: 'old' });
          expect(payload()).not.toHaveProperty('thank_you');
        }
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
      });

      it('skips when SMTP is not configured or a thank-you was already sent', async () => {
        emailService.isConfigured.mockReturnValue(false);
        service.updateLaw.mockReturnValue(approved([ann]));
        await update({ status: 'published' });
        expect(thankYou()).toEqual({ status: 'skipped', reason: 'not_configured' });

        emailService.isConfigured.mockReturnValue(true);
        res.writeHead.mockClear();
        res.end.mockClear();
        service.updateLaw.mockReturnValue(approved([ann], {}, { approval_email_sent_at: '2030-01-01T00:00:00.000Z' }));
        await update({ status: 'published' });
        expect(thankYou()).toEqual({ status: 'skipped', reason: 'already_sent' });
        expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
      });

      it('answers before the email send finishes', async () => {
        emailService.sendLawApprovedEmail.mockReturnValue(new Promise(() => {}));
        service.updateLaw.mockReturnValue(approved([ann]));
        await update({ status: 'published' });
        expect(status()).toBe(200);
        expect(thankYou()).toEqual({ status: 'queued' });
        expect(service.markApprovalEmailSent).not.toHaveBeenCalled();
      });

      it('does not record a thank-you that failed or was skipped', async () => {
        service.updateLaw.mockReturnValue(approved([ann]));
        for (const outcome of [{ status: 'failed' }, { status: 'skipped', reason: 'not_configured' }]) {
          emailService.sendLawApprovedEmail.mockResolvedValue(outcome);
          await update({ status: 'published' });
          await flush();
        }
        expect(service.markApprovalEmailSent).not.toHaveBeenCalled();
      });

      it('logs a rejected send or a failing flag write without the address or error details', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        service.updateLaw.mockReturnValue(approved([ann]));
        const smtp = Object.assign(new Error('550 5.1.1 <ann@example.com> unknown'), { rejected: ['ann@example.com'] });

        emailService.sendLawApprovedEmail.mockImplementation(() => Promise.reject(smtp));
        await update({ status: 'published' });
        await flush();

        emailService.sendLawApprovedEmail.mockResolvedValue({ status: 'sent' });
        service.markApprovalEmailSent.mockImplementation(() => {
          throw 'disk full';
        });
        await update({ status: 'published' });
        await flush();

        expect(status()).toBe(200);
        expect(errorSpy).toHaveBeenCalledTimes(2);
        expect(errorSpy.mock.calls.join('\n')).toContain('law ID 5');
        expect(errorSpy.mock.calls.join('\n')).toContain('unknown error');
        expect(errorSpy.mock.calls.join('\n')).not.toContain('ann@example.com');
      });

      it.each([
        ['isConfigured throws', () => emailService.isConfigured.mockImplementation(() => { throw new TypeError('boom ann@example.com'); }), approved([ann])],
        ['the email service throws synchronously', () => emailService.sendLawApprovedEmail.mockImplementation(() => { throw new Error('boom'); }), approved([ann])],
        ['the send returns a non-promise', () => emailService.sendLawApprovedEmail.mockReturnValue(undefined), approved([ann])],
        ['attributions is null', () => {}, approved(null as never)],
        ['something that is not an Error is thrown', () => emailService.isConfigured.mockImplementation(() => { throw 'weird'; }), approved([ann])],
        ['the updated law is missing from the result', () => {}, { outcome: 'updated', previousStatus: 'in_review' } as never],
      ])('still answers 200 when %s', async (_name, arrange, result) => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        arrange();
        service.updateLaw.mockReturnValue(result);
        await update({ status: 'published' });
        await flush();

        expect(status()).toBe(200);
        expect(payload().data?.id).toBe((result as { law?: { id: number } }).law?.id);
        expect(errorSpy.mock.calls.join('\n')).not.toContain('ann@example.com');
        if (_name !== 'the send returns a non-promise') {
          expect(thankYou()).toEqual({ status: 'skipped', reason: 'error' });
        }
      });
    });

    describe('category_id', () => {
      it('passes a valid category through and audits the before and after', async () => {
        service.updateLaw.mockReturnValue({ outcome: 'updated', law: { id: 5 }, previousStatus: 'published', previousCategoryIds: [2, 3] });
        await update({ category_id: 7 });
        expect(service.updateLaw).toHaveBeenCalledWith(5, { categoryId: 7 });
        expect(status()).toBe(200);
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).toMatchObject({
          event: 'admin_law_update',
          fields: ['categoryId'],
          categoryFrom: [2, 3],
          categoryTo: 7,
        });
      });

      it.each([['7'], [0], [-1], [1.5], [null], [true], [[1]]])('rejects category_id %j with 400 before touching the database', async (value) => {
        await update({ category_id: value });
        expect(status()).toBe(400);
        expect(payload()).toEqual({ error: 'category_id must be a positive integer' });
        expect(service.updateLaw).not.toHaveBeenCalled();
      });

      it('answers 400 with a clear error when the category does not exist', async () => {
        service.updateLaw.mockReturnValue({ outcome: 'invalid_category' });
        await update({ category_id: 999 });
        expect(status()).toBe(400);
        expect(payload()).toEqual({ error: 'Unknown category' });
        expect(vi.mocked(console.warn).mock.calls.at(-1)?.[0]).toContain('unknown category 999');
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
