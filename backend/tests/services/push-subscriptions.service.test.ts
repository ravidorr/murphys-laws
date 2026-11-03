import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createMigratedDb } from '../helpers/migrated-db.ts';
import {
  PushSubscriptionService,
  isAllowedPushEndpoint,
  parsePushSubscription,
} from '../../src/services/push-subscriptions.service.ts';

const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';
import { createECDH, randomBytes } from 'node:crypto';

// Generated per run: a real-looking P-256 public key and auth secret, with no literals in the source.
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const keys = { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };

describe('isAllowedPushEndpoint', () => {
  it.each([
    FCM,
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])('accepts %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    42,
    undefined,
    'not a url',
    'http://fcm.googleapis.com/x',
    'https://evil.example.com/x',
    'https://fcm.googleapis.com.evil.example.com/x',
    'https://notfcm.googleapis.com.evil.io/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://127.0.0.1/x',
    `https://fcm.googleapis.com/${'a'.repeat(2100)}`,
  ])('rejects %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it('does not accept a host that merely ends with the suffix text', () => {
    expect(isAllowedPushEndpoint('https://evilfcm.googleapis.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://evilpush.apple.com.example.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://xpush.apple.com/x')).toBe(false);
  });
});

describe('parsePushSubscription', () => {
  it('returns the endpoint and keys of a valid subscription', () => {
    expect(parsePushSubscription({ endpoint: FCM, expirationTime: null, keys })).toEqual({ endpoint: FCM, ...keys });
  });

  it.each([
    null,
    undefined,
    {},
    { endpoint: FCM },
    { endpoint: FCM, keys: null },
    { endpoint: FCM, keys: { p256dh: keys.p256dh } },
    { endpoint: FCM, keys: { p256dh: keys.p256dh, auth: '' } },
    { endpoint: FCM, keys: { p256dh: keys.p256dh, auth: 'not base64url!' } },
    { endpoint: FCM, keys: { p256dh: 'a'.repeat(300), auth: keys.auth } },
    { endpoint: FCM, keys: { p256dh: 'AQID', auth: keys.auth } },
    { endpoint: FCM, keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: keys.auth } },
    { endpoint: FCM, keys: { p256dh: `A${keys.p256dh.slice(1)}`, auth: keys.auth } },
    { endpoint: FCM, keys: { p256dh: keys.p256dh, auth: 'AQID' } },
    { endpoint: 'https://evil.example.com/x', keys },
  ])('rejects %j', (body) => {
    expect(parsePushSubscription(body)).toBeNull();
  });
});

describe('PushSubscriptionService', () => {
  let db: InstanceType<typeof Database>;
  let service: PushSubscriptionService;
  const count = () => (db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get() as { n: number }).n;

  beforeEach(() => {
    db = createMigratedDb();
    service = new PushSubscriptionService(db);
  });

  it('adds a subscription once and refreshes the keys of a known endpoint', () => {
    service.add({ endpoint: FCM, ...keys });
    service.add({ endpoint: FCM, p256dh: 'new', auth: 'newauth' });
    expect(count()).toBe(1);
    expect(db.prepare('SELECT p256dh, auth FROM push_subscriptions').get()).toEqual({ p256dh: 'new', auth: 'newauth' });
  });

  it('removes by endpoint and by id, repeatably', () => {
    service.add({ endpoint: FCM, ...keys });
    service.add({ endpoint: `${FCM}2`, ...keys });
    service.remove(FCM);
    service.remove(FCM);
    expect(count()).toBe(1);
    const [row] = service.listDue('2026-11-02');
    service.removeById(row.id);
    expect(count()).toBe(0);
  });

  it('lists subscriptions not yet sent the day and records sends', () => {
    service.add({ endpoint: FCM, ...keys });
    service.add({ endpoint: `${FCM}2`, ...keys });
    const due = service.listDue('2026-11-02');
    expect(due).toHaveLength(2);
    service.markSent(due[0].id, '2026-11-02');
    expect(service.listDue('2026-11-02').map((row) => row.endpoint)).toEqual([`${FCM}2`]);
    expect(service.listDue('2026-11-03')).toHaveLength(2);
  });
});
