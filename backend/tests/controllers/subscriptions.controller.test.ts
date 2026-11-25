import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SubscriptionController } from '../../src/controllers/subscriptions.controller.ts';
import { confirmUrl, unsubscribeUrl } from '../../src/utils/subscription-links.ts';
import { FORM_EXPIRED_MESSAGE } from '../../src/controllers/subscriptions.controller.ts';
import { FormTokenService } from '../../src/utils/subscription-form-token.ts';
import { SubscriptionService } from '../../src/services/subscriptions.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const TOKEN = 'c'.repeat(48);

function request(body: string, ip = '203.0.113.1'): IncomingMessage {
  const req = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
  req.headers = { 'x-real-ip': ip };
  return req;
}

describe('SubscriptionController', () => {
  const subscriptions = { subscribe: vi.fn(), recordConfirmationSend: vi.fn(), releaseCooldown: vi.fn(), confirm: vi.fn(), unsubscribe: vi.fn() };
  const formTokens = { issue: vi.fn(), verify: vi.fn() };
  const emailService = { isConfigured: vi.fn(), sendSubscriptionConfirmationEmail: vi.fn() };
  let controller: SubscriptionController;
  let res: ServerResponse;
  let ipCounter = 0;
  const nextIp = () => `198.51.100.${++ipCounter}`;

  const writeHead = () => (res.writeHead as ReturnType<typeof vi.fn>);
  const status = () => writeHead().mock.calls[0][0] as number;
  const json = () => JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0] as string) as Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    emailService.isConfigured.mockReturnValue(true);
    emailService.sendSubscriptionConfirmationEmail.mockResolvedValue(true);
    subscriptions.subscribe.mockReturnValue({ status: 'confirmation_needed', token: TOKEN, email: 'ann@example.com' });
    formTokens.issue.mockReturnValue('1.a.b');
    formTokens.verify.mockReturnValue('ok');
    controller = new SubscriptionController(subscriptions as never, emailService as never, formTokens as never);
    res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
  });

  it('builds the links the emails carry', () => {
    expect(confirmUrl(TOKEN)).toBe(`https://murphys-laws.com/subscription/confirm?token=${TOKEN}`);
    expect(unsubscribeUrl(TOKEN)).toBe(`https://murphys-laws.com/subscription/unsubscribe?token=${TOKEN}`);
  });

  describe('subscribe', () => {
    it('sends a confirmation and answers 202', async () => {
      await controller.subscribe(request(JSON.stringify({ email: ' Ann@Example.com ' }), nextIp()), res);
      expect(emailService.sendSubscriptionConfirmationEmail).toHaveBeenCalledWith('ann@example.com', confirmUrl(TOKEN));
      expect(subscriptions.recordConfirmationSend).toHaveBeenCalledWith(true);
      expect(status()).toBe(202);
      expect(json()).toEqual({ status: 'check_your_email' });
    });

    it('answers the same 202 for a known address without sending anything', async () => {
      subscriptions.subscribe.mockReturnValue({ status: 'already_confirmed' });
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com' }), nextIp()), res);
      expect(status()).toBe(202);
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    });

    it('answers the same 202 for a limited or suppressed address without sending anything', async () => {
      for (const outcome of ['cooldown', 'suppressed']) {
        res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
        subscriptions.subscribe.mockReturnValue({ status: outcome });
        await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com' }), nextIp()), res);
        expect(status()).toBe(202);
        expect(json()).toEqual({ status: 'check_your_email' });
      }
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
      expect(subscriptions.recordConfirmationSend).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('[subscribe] no email sent: cooldown');
      expect(console.warn).toHaveBeenCalledWith('[subscribe] no email sent: suppressed');
      expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).not.toContain('ann@example.com');
    });

    it('checks the form token and rejects a missing, spent or too fresh one before touching the database', async () => {
      formTokens.verify.mockReturnValue('too_fast');
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com', token: 'x' }), nextIp()), res);
      expect(formTokens.verify).toHaveBeenCalledWith('x');
      expect(status()).toBe(400);
      expect(json().error).toBe(FORM_EXPIRED_MESSAGE);
      expect(subscriptions.subscribe).not.toHaveBeenCalled();
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    });

    it('answers 503 before it looks at the token when email is not configured', async () => {
      emailService.isConfigured.mockReturnValue(false);
      await controller.subscribe(request(JSON.stringify({ email: 'a@example.com', token: 'bad' }), nextIp()), res);
      expect(status()).toBe(503);
      expect(formTokens.verify).not.toHaveBeenCalled();
    });

    it('answers a filled trap field with the usual 202 and does nothing', async () => {
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com', token: 't', website: 'http://spam.example' }), nextIp()), res);
      expect(status()).toBe(202);
      expect(json()).toEqual({ status: 'check_your_email' });
      expect(formTokens.verify).not.toHaveBeenCalled();
      expect(subscriptions.subscribe).not.toHaveBeenCalled();
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('[subscribe] ignored: the hidden trap field was filled');
    });

    it('treats an empty or non-string trap field as not filled', async () => {
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com', website: '' }), nextIp()), res);
      expect(status()).toBe(202);
      expect(subscriptions.subscribe).toHaveBeenCalledTimes(1);
      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com', website: 5 }), nextIp()), res);
      expect(subscriptions.subscribe).toHaveBeenCalledTimes(2);
    });

    it('answers 400 for an invalid address', async () => {
      subscriptions.subscribe.mockReturnValue({ status: 'invalid' });
      await controller.subscribe(request(JSON.stringify({ email: 'x' }), nextIp()), res);
      expect(status()).toBe(400);
    });

    it('answers 400 for invalid JSON and for an oversized body', async () => {
      await controller.subscribe(request('{nope', nextIp()), res);
      expect(status()).toBe(400);
      expect(json().error).toBe('Invalid JSON body');

      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      await controller.subscribe(request(JSON.stringify({ email: 'a'.repeat(5000) }), nextIp()), res);
      expect(status()).toBe(400);
      expect(json().error).toBe('Request body too large');
    });

    it('answers 503 when email is not configured', async () => {
      emailService.isConfigured.mockReturnValue(false);
      await controller.subscribe(request(JSON.stringify({ email: 'a@example.com' }), nextIp()), res);
      expect(status()).toBe(503);
      expect(subscriptions.subscribe).not.toHaveBeenCalled();
    });

    it('releases the cooldown and answers 502 when the email cannot be sent', async () => {
      emailService.sendSubscriptionConfirmationEmail.mockResolvedValue(false);
      await controller.subscribe(request(JSON.stringify({ email: 'a@example.com' }), nextIp()), res);
      expect(subscriptions.releaseCooldown).toHaveBeenCalledWith(TOKEN);
      expect(subscriptions.recordConfirmationSend).toHaveBeenCalledWith(false);
      expect(status()).toBe(502);
    });

    it('rate limits one client', async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) {
        res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
        await controller.subscribe(request(JSON.stringify({ email: 'a@example.com' }), ip), res);
        expect(status()).toBe(202);
      }
      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      await controller.subscribe(request(JSON.stringify({ email: 'a@example.com' }), ip), res);
      expect(status()).toBe(429);
    });
  });

  describe('with the real token and subscription services', () => {
    const T0 = Date.parse('2026-11-25T10:00:00Z');
    let real: SubscriptionController;
    let db: ReturnType<typeof createMigratedDb>;

    const post = async (body: Record<string, unknown>): Promise<{ code: number; body: Record<string, unknown> }> => {
      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      await real.subscribe(request(JSON.stringify(body), nextIp()), res);
      return { code: status(), body: json() };
    };
    const issue = (): string => {
      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      real.issueToken(request('', nextIp()), res);
      return json().token as string;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      db = createMigratedDb();
      real = new SubscriptionController(new SubscriptionService(db), emailService as never, new FormTokenService('test-secret'));
    });
    afterEach(() => vi.useRealTimers());

    it('refuses a fresh token without spending it or writing anything, then accepts it once, then refuses it again', async () => {
      const token = issue();
      const tooSoon = await post({ email: 'ann@example.com', token });
      expect(tooSoon).toEqual({ code: 400, body: { error: FORM_EXPIRED_MESSAGE } });
      expect(db.prepare('SELECT COUNT(*) AS n FROM email_subscriptions').get()).toEqual({ n: 0 });

      vi.setSystemTime(T0 + 3000);
      expect((await post({ email: 'ann@example.com', token })).code).toBe(202);
      expect(emailService.sendSubscriptionConfirmationEmail).toHaveBeenCalledTimes(1);
      expect(db.prepare('SELECT sent_at, ok FROM confirmation_sends').all()).toEqual([{ sent_at: '2026-11-25 10:00:03', ok: 1 }]);

      vi.setSystemTime(T0 + 4000);
      expect((await post({ email: 'bob@example.com', token })).code).toBe(400);
      expect(emailService.sendSubscriptionConfirmationEmail).toHaveBeenCalledTimes(1);
    });

    it('refuses a missing, forged and expired token', async () => {
      const token = issue();
      vi.setSystemTime(T0 + 3 * 60 * 60 * 1000);
      for (const sent of [undefined, 'abc', token]) {
        expect((await post({ email: 'ann@example.com', token: sent })).code, String(sent)).toBe(400);
      }
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    });

    it('does not send to a suppressed address and does not reveal it', async () => {
      new SubscriptionService(db).suppress('ann@example.com', 'spam report');
      const token = issue();
      vi.setSystemTime(T0 + 3000);
      expect(await post({ email: 'ann@example.com', token })).toEqual({ code: 202, body: { status: 'check_your_email' } });
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  describe('issueToken', () => {
    it('hands out an uncached token', () => {
      controller.issueToken(request('', nextIp()), res);
      expect(status()).toBe(200);
      expect(json()).toEqual({ token: '1.a.b' });
      expect(writeHead().mock.calls[0][1]).toMatchObject({ 'Cache-Control': 'no-store' });
    });

    it('rate limits one client', () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i += 1) {
        res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
        controller.issueToken(request('', ip), res);
        expect(status()).toBe(200);
      }
      res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
      controller.issueToken(request('', ip), res);
      expect(status()).toBe(429);
    });

    it('builds its own token service when none is given', () => {
      const plain = new SubscriptionController(subscriptions as never, emailService as never);
      plain.issueToken(request('', nextIp()), res);
      expect(json().token).toMatch(/^\d+\.[a-f0-9]{16}\.[a-f0-9]{64}$/);
    });
  });

  describe('confirmForm', () => {
    it('shows a POST button and does not confirm', () => {
      controller.confirmForm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(status()).toBe(200);
      const html = (res.end as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(html).toContain(`<form class="subscription-page__form" method="post" action="/subscription/confirm?token=${TOKEN}">`);
      expect(subscriptions.confirm).not.toHaveBeenCalled();
    });

    it('answers 404 for a missing or malformed token', () => {
      controller.confirmForm({} as IncomingMessage, res, { query: { token: 'abc' } });
      expect(status()).toBe(404);
    });
  });

  describe('confirm', () => {
    it('confirms a valid token', () => {
      subscriptions.confirm.mockReturnValue(true);
      controller.confirm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(subscriptions.confirm).toHaveBeenCalledWith(TOKEN);
      expect(status()).toBe(200);
      expect(writeHead().mock.calls[0][1]).toMatchObject({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
      expect((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('You are subscribed');
    });

    it('answers 404 for an unknown token', () => {
      subscriptions.confirm.mockReturnValue(false);
      controller.confirm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(status()).toBe(404);
    });

    it('answers 404 without touching the database for a missing or malformed token', () => {
      controller.confirm({} as IncomingMessage, res, { query: { token: 'abc' } });
      controller.confirm({} as IncomingMessage, res, {});
      expect(subscriptions.confirm).not.toHaveBeenCalled();
      expect(status()).toBe(404);
    });

    it('uses the first of repeated token parameters', () => {
      subscriptions.confirm.mockReturnValue(true);
      controller.confirm({} as IncomingMessage, res, { query: { token: [TOKEN, 'x'] } });
      expect(subscriptions.confirm).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('unsubscribeForm', () => {
    it('shows a POST button and does not unsubscribe', () => {
      controller.unsubscribeForm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(status()).toBe(200);
      expect((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(`<form class="subscription-page__form" method="post" action="/subscription/unsubscribe?token=${TOKEN}">`);
      expect(subscriptions.unsubscribe).not.toHaveBeenCalled();
    });

    it('answers 404 for a missing or malformed token', () => {
      controller.unsubscribeForm({} as IncomingMessage, res, {});
      expect(status()).toBe(404);
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes a valid token', () => {
      subscriptions.unsubscribe.mockReturnValue(true);
      controller.unsubscribe({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(subscriptions.unsubscribe).toHaveBeenCalledWith(TOKEN);
      expect((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('You are unsubscribed');
    });

    it('answers 404 for an unknown or malformed token', () => {
      subscriptions.unsubscribe.mockReturnValue(false);
      controller.unsubscribe({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(status()).toBe(404);
      controller.unsubscribe({} as IncomingMessage, res, { query: {} });
      expect(subscriptions.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('page styling', () => {
    const html = () => (res.end as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const freshResponse = () => ({ writeHead: vi.fn(), end: vi.fn() }) as unknown as ServerResponse;

    it('links stylesheets that the web build serves', () => {
      controller.confirmForm({} as IncomingMessage, res, { query: { token: TOKEN } });
      const hrefs = [...html().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
      expect(hrefs).toHaveLength(2);
      const web = resolve(import.meta.dirname, '../../../web');
      for (const href of hrefs) {
        // variables.css is copied from styles/ into the build; the rest ships from public/
        const source = href === '/styles/partials/variables.css' ? `styles/partials/variables.css` : `public${href}`;
        expect(existsSync(resolve(web, source)), href).toBe(true);
      }
    });

    it('gives every state the site header, stylesheets, footer and a noindex marker, with no inline styles', () => {
      subscriptions.confirm.mockReturnValue(true);
      subscriptions.unsubscribe.mockReturnValue(true);
      const renders: Array<() => void> = [
        () => controller.confirmForm({} as IncomingMessage, res, { query: { token: TOKEN } }),
        () => controller.confirm({} as IncomingMessage, res, { query: { token: TOKEN } }),
        () => controller.confirm({} as IncomingMessage, res, {}),
        () => controller.unsubscribeForm({} as IncomingMessage, res, { query: { token: TOKEN } }),
        () => controller.unsubscribe({} as IncomingMessage, res, { query: { token: TOKEN } }),
        () => controller.unsubscribe({} as IncomingMessage, res, {}),
      ];
      for (const render of renders) {
        res = freshResponse();
        render();
        expect(html()).toContain('<link rel="stylesheet" href="/styles/partials/variables.css">');
        expect(html()).toContain('<link rel="stylesheet" href="/styles/subscription-pages.css">');
        expect(html()).toContain('<meta name="robots" content="noindex">');
        expect(html()).toContain('class="subscription-page__brand"');
        expect(html()).toContain('href="https://murphys-laws.com/privacy"');
        expect(html()).not.toContain('style=');
        expect(writeHead().mock.calls[0][1]).toMatchObject({ 'Cache-Control': 'no-store' });
      }
    });

    it('marks success and error states', () => {
      subscriptions.confirm.mockReturnValue(true);
      controller.confirm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(html()).toContain('subscription-page__status--success');
      res = freshResponse();
      controller.confirm({} as IncomingMessage, res, {});
      expect(html()).toContain('subscription-page__status--error');
      res = freshResponse();
      controller.confirmForm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(html()).not.toContain('subscription-page__status');
    });
  });
});
