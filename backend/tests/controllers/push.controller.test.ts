import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PushController } from '../../src/controllers/push.controller.ts';

const FCM = 'https://fcm.googleapis.com/fcm/send/abc';
import { createECDH, randomBytes } from 'node:crypto';

// Generated per run: a real-looking P-256 public key and auth secret, with no literals in the source.
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const keys = { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };

let ipCounter = 100;
function request(body: string, ip = `192.0.2.${++ipCounter}`): IncomingMessage {
  const req = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
  req.headers = { 'x-real-ip': ip };
  return req;
}

describe('PushController', () => {
  const subscriptions = { add: vi.fn(), remove: vi.fn() };
  let controller: PushController;
  let res: ServerResponse;
  const status = () => (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
  const headers = () => (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, string>;
  const json = () => JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0] as string) as Record<string, unknown>;
  const fresh = () => { res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse; };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PushController(subscriptions as never, 'PUBLIC_KEY');
    fresh();
  });

  describe('getPublicKey', () => {
    it('serves the VAPID public key with a cache header', () => {
      controller.getPublicKey({ headers: {} } as IncomingMessage, res);
      expect(status()).toBe(200);
      expect(json()).toEqual({ publicKey: 'PUBLIC_KEY' });
      expect(headers()['Cache-Control']).toBe('public, max-age=3600');
    });

    it('answers 503 when push is not configured', () => {
      new PushController(subscriptions as never, undefined).getPublicKey({ headers: {} } as IncomingMessage, res);
      expect(status()).toBe(503);
    });
  });

  describe('subscribe', () => {
    it('stores a valid subscription', async () => {
      await controller.subscribe(request(JSON.stringify({ endpoint: FCM, expirationTime: null, keys })), res);
      expect(subscriptions.add).toHaveBeenCalledWith({ endpoint: FCM, ...keys });
      expect(status()).toBe(201);
      expect(json()).toEqual({ status: 'subscribed' });
    });

    it('answers 400 for an invalid subscription, bad JSON and an oversized body', async () => {
      await controller.subscribe(request(JSON.stringify({ endpoint: 'https://evil.example.com/x', keys })), res);
      expect(status()).toBe(400);
      expect(subscriptions.add).not.toHaveBeenCalled();

      fresh();
      await controller.subscribe(request('{nope'), res);
      expect(json().error).toBe('Invalid JSON body');

      fresh();
      await controller.subscribe(request(JSON.stringify({ endpoint: FCM, pad: 'a'.repeat(5000) })), res);
      expect(json().error).toBe('Request body too large');
    });

    it('answers 503 and stores nothing when push is not configured', async () => {
      await new PushController(subscriptions as never, undefined).subscribe(request(JSON.stringify({ endpoint: FCM, keys })), res);
      expect(status()).toBe(503);
      expect(subscriptions.add).not.toHaveBeenCalled();
    });

    it('rate limits one client', async () => {
      const ip = '192.0.2.250';
      for (let i = 0; i < 5; i += 1) {
        fresh();
        await controller.subscribe(request(JSON.stringify({ endpoint: FCM, keys }), ip), res);
        expect(status()).toBe(201);
      }
      fresh();
      await controller.subscribe(request(JSON.stringify({ endpoint: FCM, keys }), ip), res);
      expect(status()).toBe(429);
    });
  });

  describe('unsubscribe', () => {
    it('removes a subscription by endpoint', async () => {
      await controller.unsubscribe(request(JSON.stringify({ endpoint: FCM })), res);
      expect(subscriptions.remove).toHaveBeenCalledWith(FCM);
      expect(status()).toBe(200);
    });

    it('answers 400 for a missing or disallowed endpoint and for bad JSON', async () => {
      await controller.unsubscribe(request(JSON.stringify({})), res);
      expect(status()).toBe(400);
      fresh();
      await controller.unsubscribe(request('null'), res);
      expect(status()).toBe(400);
      fresh();
      await controller.unsubscribe(request('{nope'), res);
      expect(status()).toBe(400);
      expect(subscriptions.remove).not.toHaveBeenCalled();
    });

    it('rate limits one client', async () => {
      const ip = '192.0.2.251';
      for (let i = 0; i < 5; i += 1) {
        fresh();
        await controller.unsubscribe(request(JSON.stringify({ endpoint: FCM }), ip), res);
      }
      fresh();
      await controller.unsubscribe(request(JSON.stringify({ endpoint: FCM }), ip), res);
      expect(status()).toBe(429);
    });
  });
});
