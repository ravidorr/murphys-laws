import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminController } from '../../src/controllers/admin.controller.ts';

vi.mock('../../src/middleware/rate-limit.ts', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 9, resetTime: 0 })),
}));
vi.mock('../../src/utils/http-helpers.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, readBody: vi.fn(), getVoterIdentifier: vi.fn(() => '127.0.0.1') };
});

import { readBody, PayloadTooLargeError } from '../../src/utils/http-helpers.ts';

const TOKEN = 'k'.repeat(40);
const PARENT = 'A red light turns green right after you stop watching it.';
const ONE = 'The engine restarts slowly behind a horn.';
const TWO = 'The green lasts just long enough to miss.';

describe('AdminController split and corollary rules', () => {
  let service: {
    listLaws: ReturnType<typeof vi.fn>;
    updateLaw: ReturnType<typeof vi.fn>;
    splitLaw: ReturnType<typeof vi.fn>;
    markApprovalEmailSent: ReturnType<typeof vi.fn>;
  };
  let emailService: { isConfigured: ReturnType<typeof vi.fn>; sendLawApprovedEmail: ReturnType<typeof vi.fn> };
  let controller: AdminController;
  let req: { headers: Record<string, string> };
  let res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  const status = () => res.writeHead.mock.calls[0][0];
  const headers = () => res.writeHead.mock.calls[0][1];
  const payload = () => JSON.parse(res.end.mock.calls[0][0]);
  const reset = () => {
    res.writeHead.mockClear();
    res.end.mockClear();
  };
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const ann = { name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' };
  const body = (over: Record<string, unknown> = {}) => ({
    updated_at: 'v1',
    parent_text: PARENT,
    corollaries: [{ title: 'The Ignition Corollary', text: ONE }, { title: null, text: TWO }],
    ...over,
  });
  const split = async (value: unknown, id = '5') => {
    vi.mocked(readBody).mockResolvedValue(value as Record<string, unknown>);
    await controller.split(req, res, id);
  };
  const splitResult = (over: Record<string, unknown> = {}) => ({
    outcome: 'split',
    previousStatus: 'in_review',
    previousCategoryIds: [2],
    law: { id: 5, title: 'T', text: PARENT, status: 'published', approval_email_sent_at: null, attributions: [ann] },
    children: [{ id: 11, title: 'The Ignition Corollary', text: ONE }, { id: 12, title: null, text: TWO }],
    ...over,
  });

  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    service = {
      listLaws: vi.fn(),
      updateLaw: vi.fn(),
      splitLaw: vi.fn(() => splitResult()),
      markApprovalEmailSent: vi.fn(),
    };
    emailService = { isConfigured: vi.fn(() => true), sendLawApprovedEmail: vi.fn(() => Promise.resolve({ status: 'sent' })) };
    controller = new AdminController(service, emailService);
    req = { headers: { authorization: `Bearer ${TOKEN}` } };
    res = { writeHead: vi.fn(), end: vi.fn() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
    vi.restoreAllMocks();
  });

  describe('split', () => {
    it('requires authorization before reading the body', async () => {
      req.headers.authorization = 'Bearer nope';
      await split(body());
      expect(status()).toBe(401);
      expect(service.splitLaw).not.toHaveBeenCalled();
      expect(readBody).not.toHaveBeenCalled();
    });

    it('splits with the explicit body, answers with the parent and the new children, and caps the body at 64 KB', async () => {
      await split(body({ title: ' New title ', admin_notes: ' note ', category_id: 3 }));

      expect(service.splitLaw).toHaveBeenCalledWith(5, {
        expectedUpdatedAt: 'v1',
        parentText: PARENT,
        title: 'New title',
        adminNotes: 'note',
        categoryId: 3,
        corollaries: [{ title: 'The Ignition Corollary', text: ONE }, { title: null, text: TWO }],
      });
      expect(vi.mocked(readBody).mock.calls[0][1]).toBe(64 * 1024);
      expect(status()).toBe(200);
      expect(headers()['Cache-Control']).toBe('no-store');
      expect(payload()).toMatchObject({
        data: { id: 5, status: 'published' },
        corollaries: [{ id: 11 }, { id: 12 }],
        thank_you: { status: 'queued' },
      });
    });

    it('sends only the fields that were given, trimming texts and titles and treating blank titles as none', async () => {
      await split(body({ parent_text: `  ${PARENT}  `, corollaries: [{ title: '   ', text: `  ${ONE}  ` }, { text: TWO }] }));
      expect(service.splitLaw).toHaveBeenCalledWith(5, {
        expectedUpdatedAt: 'v1',
        parentText: PARENT,
        corollaries: [{ title: null, text: ONE }, { title: null, text: TWO }],
      });
    });

    it('clears the title and notes with null', async () => {
      await split(body({ title: null, admin_notes: '  ' }));
      expect(service.splitLaw).toHaveBeenCalledWith(5, expect.objectContaining({ title: null, adminNotes: null }));
    });

    it('accepts the limits: five corollaries, texts of 10 and 1000 characters, a 200 character title', async () => {
      const five = [1, 2, 3, 4, 5].map((n) => ({ title: 'x'.repeat(200), text: `${'c'.repeat(9)}${n}` }));
      await split(body({ corollaries: five, parent_text: 'p'.repeat(1000) }));
      expect(status()).toBe(200);
      reset();
      await split(body({ corollaries: [{ title: null, text: 'c'.repeat(1000) }], parent_text: 'p'.repeat(10) }));
      expect(status()).toBe(200);
    });

    it('logs admin_law_split with ids, counts and the thank-you outcome, but no law text or notes', async () => {
      await split(body({ category_id: 3, admin_notes: 'secret reasoning' }));
      const line = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(line).not.toContain('secret reasoning');
      expect(line).not.toContain(ONE);
      expect(JSON.parse(line)).toEqual({
        event: 'admin_law_split',
        lawId: 5,
        actor: '127.0.0.1',
        corollaryIds: [11, 12],
        corollaryCount: 2,
        fields: ['text', 'adminNotes', 'categoryId'],
        categoryFrom: [2],
        categoryTo: 3,
        thankYou: 'queued',
      });
    });

    it('lists the title among the logged fields when it was given, and ignores unknown extra fields', async () => {
      await split(body({ title: 'T', status: 'rejected', corollary_of: 3 }));
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string).fields).toEqual(['text', 'title']);
      expect(service.splitLaw.mock.calls[0][1]).not.toHaveProperty('status');
      expect(service.splitLaw.mock.calls[0][1]).not.toHaveProperty('corollary_of');
    });

    it.each([
      [{ updated_at: undefined }, 'updated_at is required'],
      [{ parent_text: 'x'.repeat(9) }, 'Law text must be between 10 and 1000 characters'],
      [{ corollaries: [] }, 'Provide between 1 and 5 corollaries'],
      [{ corollaries: [1, 2, 3, 4, 5, 6].map((n) => ({ title: null, text: `Corollary text number ${n}` })) }, 'Provide between 1 and 5 corollaries'],
      [{ corollaries: [{ title: 'x'.repeat(201), text: ONE }] }, 'Corollary 1 title must be at most 200 characters'],
      [{ corollaries: [{ title: 'A', text: ONE }, { title: 'B', text: ONE }] }, 'Corollary 2 repeats another corollary or the law text'],
      [{ category_id: 0 }, 'category_id must be a positive integer'],
      [{ category_id: -1 }, 'category_id must be a positive integer'],
      [{ category_id: 1.5 }, 'category_id must be a positive integer'],
      [{ category_id: null }, 'category_id must be a positive integer'],
      [{ admin_notes: 'x'.repeat(2001) }, 'admin_notes must be at most 2000 characters'],
    ])('answers 400 with the exact message for %j', async (over, message) => {
      await split(body(over));
      expect(status()).toBe(400);
      expect(payload()).toEqual({ error: message });
    });

    it('logs without category fields when the category was not changed', async () => {
      await split(body());
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).toMatchObject({ fields: ['text'], thankYou: 'queued' });
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).not.toHaveProperty('categoryTo');
    });

    it.each([
      ['an invalid id', body(), 'abc'],
      ['a zero id', body(), '0'],
      ['a null body', null, '5'],
      ['an array body', [], '5'],
      ['a string body', 'x', '5'],
      ['no updated_at', body({ updated_at: undefined }), '5'],
      ['a null updated_at', body({ updated_at: null }), '5'],
      ['a blank updated_at', body({ updated_at: '' }), '5'],
      ['a non-string updated_at', body({ updated_at: 5 }), '5'],
      ['no parent_text', body({ parent_text: undefined }), '5'],
      ['a non-string parent_text', body({ parent_text: 5 }), '5'],
      ['a short parent_text', body({ parent_text: 'x'.repeat(9) }), '5'],
      ['a blank parent_text', body({ parent_text: ' '.repeat(20) }), '5'],
      ['a long parent_text', body({ parent_text: 'x'.repeat(1001) }), '5'],
      ['a non-string title', body({ title: 5 }), '5'],
      ['a long title', body({ title: 'x'.repeat(201) }), '5'],
      ['non-string notes', body({ admin_notes: 5 }), '5'],
      ['long notes', body({ admin_notes: 'x'.repeat(2001) }), '5'],
      ['a bad category', body({ category_id: '7' }), '5'],
      ['no corollaries', body({ corollaries: undefined }), '5'],
      ['corollaries that are not a list', body({ corollaries: 'x' }), '5'],
      ['an empty corollary list', body({ corollaries: [] }), '5'],
      ['six corollaries', body({ corollaries: [1, 2, 3, 4, 5, 6].map((n) => ({ title: null, text: `Corollary text number ${n}` })) }), '5'],
      ['a corollary that is not an object', body({ corollaries: ['text of a corollary'] }), '5'],
      ['a null corollary', body({ corollaries: [null] }), '5'],
      ['a corollary without text', body({ corollaries: [{ title: 'T' }] }), '5'],
      ['a non-string corollary text', body({ corollaries: [{ title: 'T', text: 5 }] }), '5'],
      ['a short corollary text', body({ corollaries: [{ title: 'T', text: 'x'.repeat(9) }] }), '5'],
      ['a long corollary text', body({ corollaries: [{ title: 'T', text: 'x'.repeat(1001) }] }), '5'],
      ['a non-string corollary title', body({ corollaries: [{ title: 5, text: ONE }] }), '5'],
      ['a long corollary title', body({ corollaries: [{ title: 'x'.repeat(201), text: ONE }] }), '5'],
      ['duplicate corollary texts', body({ corollaries: [{ title: 'A', text: ONE }, { title: 'B', text: `  ${ONE.toUpperCase()}  ` }] }), '5'],
      ['a corollary equal to the parent text', body({ corollaries: [{ title: 'A', text: ` ${PARENT} ` }] }), '5'],
    ])('rejects %s with 400 before touching the database', async (_name, value, id) => {
      await split(value, id);
      expect(status()).toBe(400);
      expect(payload().error).toEqual(expect.any(String));
      expect(service.splitLaw).not.toHaveBeenCalled();
    });

    it('does not swallow an unexpected error while reading the body', async () => {
      const hostile = Object.defineProperty({ updated_at: 'v1' }, 'parent_text', {
        get() {
          throw new TypeError('unexpected');
        },
      });
      await expect(split(hostile)).rejects.toThrow('unexpected');
    });

    it('names the offending corollary in its validation message', async () => {
      await split(body({ corollaries: [{ title: null, text: ONE }, { title: null, text: 'short' }] }));
      expect(payload().error).toBe('Corollary 2 must be between 10 and 1000 characters');
    });

    it('rejects invalid JSON with 400, a large body with 413 and rethrows other read errors', async () => {
      vi.mocked(readBody).mockRejectedValue(new SyntaxError('bad'));
      await controller.split(req, res, '5');
      expect(status()).toBe(400);

      reset();
      vi.mocked(readBody).mockRejectedValue(new PayloadTooLargeError());
      await controller.split(req, res, '5');
      expect(status()).toBe(413);

      vi.mocked(readBody).mockRejectedValue(new Error('socket closed'));
      await expect(controller.split(req, res, '5')).rejects.toThrow('socket closed');
    });

    it.each([
      [{ outcome: 'not_found' }, 404, 'Law not found'],
      [{ outcome: 'invalid_category' }, 400, 'Unknown category'],
      [{ outcome: 'conflict' }, 409, 'This law changed since you loaded it. Reload the list and try again.'],
      [{ outcome: 'invalid', status: 400, message: 'Only a law in review can be split' }, 400, 'Only a law in review can be split'],
      [{ outcome: 'invalid', status: 404, message: 'Parent law 5 not found' }, 404, 'Parent law 5 not found'],
    ])('maps %j to %i without a thank-you', async (result, code, message) => {
      service.splitLaw.mockReturnValue(result);
      await split(body());
      expect(status()).toBe(code);
      expect(payload()).toEqual({ error: message });
      expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
      expect(vi.mocked(console.log)).not.toHaveBeenCalled();
      expect(vi.mocked(console.warn).mock.calls.at(-1)?.[0]).toContain('law 5');
    });

    it('thanks the submitter once, for the parent only, and records it', async () => {
      await split(body());
      await flush();
      expect(emailService.sendLawApprovedEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendLawApprovedEmail).toHaveBeenCalledWith('ann@example.com', { id: 5, title: 'T', text: PARENT, name: 'Ann' });
      expect(service.markApprovalEmailSent).toHaveBeenCalledWith(5);
      expect(service.markApprovalEmailSent).toHaveBeenCalledTimes(1);
    });

    it('reports why no thank-you was sent', async () => {
      service.splitLaw.mockReturnValue(splitResult({ law: { id: 5, status: 'published', approval_email_sent_at: null, attributions: [] } }));
      await split(body());
      expect(payload().thank_you).toEqual({ status: 'skipped', reason: 'no_email' });
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string).thankYou).toBe('skipped:no_email');
    });
  });

  describe('update with corollaries', () => {
    const update = async (value: unknown, id = '5') => {
      vi.mocked(readBody).mockResolvedValue(value as Record<string, unknown>);
      await controller.update(req, res, id);
    };

    it('answers 400 and names the parent when a corollary is published before its law', async () => {
      service.updateLaw.mockReturnValue({ outcome: 'parent_not_published', parentId: 9 });
      await update({ status: 'published' });
      expect(status()).toBe(400);
      expect(payload().error).toBe('This corollary cannot be published while its law (#9) is not. Approve the law instead.');
      expect(vi.mocked(console.warn).mock.calls.at(-1)?.[0]).toContain('parent 9');
    });

    it('reports how many corollaries moved with the law, and logs it', async () => {
      service.updateLaw.mockReturnValue({ outcome: 'updated', law: { id: 5 }, previousStatus: 'published', cascaded: 2, isCorollary: false });
      await update({ status: 'rejected' });
      expect(payload().cascaded).toBe(2);
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string).cascaded).toBe(2);
    });

    it('logs no cascade when no corollary moved', async () => {
      service.updateLaw.mockReturnValue({ outcome: 'updated', law: { id: 5 }, previousStatus: 'published', cascaded: 0, isCorollary: false });
      await update({ admin_notes: 'x' });
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).not.toHaveProperty('cascaded');
    });

    it('never thanks the submitter when the approved law is a corollary', async () => {
      service.updateLaw.mockReturnValue({
        outcome: 'updated',
        previousStatus: 'in_review',
        isCorollary: true,
        cascaded: 0,
        law: { id: 5, status: 'published', approval_email_sent_at: null, attributions: [ann] },
      });
      await update({ status: 'published' });
      await flush();
      expect(emailService.sendLawApprovedEmail).not.toHaveBeenCalled();
      expect(payload().thank_you).toEqual({ status: 'skipped', reason: 'corollary' });
    });
  });
});
