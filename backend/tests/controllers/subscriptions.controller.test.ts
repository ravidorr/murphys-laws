import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SubscriptionController } from '../../src/controllers/subscriptions.controller.ts';
import { confirmUrl, unsubscribeUrl } from '../../src/utils/subscription-links.ts';

const TOKEN = 'c'.repeat(48);

function request(body: string, ip = '203.0.113.1'): IncomingMessage {
  const req = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
  req.headers = { 'x-real-ip': ip };
  return req;
}

describe('SubscriptionController', () => {
  const subscriptions = { subscribe: vi.fn(), releaseCooldown: vi.fn(), confirm: vi.fn(), unsubscribe: vi.fn() };
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
    emailService.isConfigured.mockReturnValue(true);
    emailService.sendSubscriptionConfirmationEmail.mockResolvedValue(true);
    subscriptions.subscribe.mockReturnValue({ status: 'confirmation_needed', token: TOKEN, email: 'ann@example.com' });
    controller = new SubscriptionController(subscriptions as never, emailService as never);
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
      expect(status()).toBe(202);
      expect(json()).toEqual({ status: 'check_your_email' });
    });

    it('answers the same 202 for a known address without sending anything', async () => {
      subscriptions.subscribe.mockReturnValue({ status: 'already_confirmed' });
      await controller.subscribe(request(JSON.stringify({ email: 'ann@example.com' }), nextIp()), res);
      expect(status()).toBe(202);
      expect(emailService.sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
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

  describe('confirmForm', () => {
    it('shows a POST button and does not confirm', () => {
      controller.confirmForm({} as IncomingMessage, res, { query: { token: TOKEN } });
      expect(status()).toBe(200);
      const html = (res.end as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(html).toContain(`<form method="post" action="/subscription/confirm?token=${TOKEN}">`);
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
      expect((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(`<form method="post" action="/subscription/unsubscribe?token=${TOKEN}">`);
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
});
