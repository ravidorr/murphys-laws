import { createECDH } from 'node:crypto';
import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

const MAX_ENDPOINT_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
// An uncompressed P-256 public key (0x04 + X + Y) and a 16-byte auth secret. A key of any other size makes
// web-push throw when it encrypts, which is not a status code the daily job can clean up, so it is refused here.
const P256DH_BYTES = 65;
const AUTH_BYTES = 16;

/**
 * Browsers hand out the push endpoint, and the server later POSTs to it, so only the real push services
 * are accepted. Anything else would let a caller aim the daily job at an arbitrary URL.
 */
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_sent_date: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Plain https on the default port, and no user:pass@ section in front of the host.
  if (url.protocol !== 'https:' || url.port || !value.startsWith(`https://${url.host}`)) {
    return false;
  }
  return PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}

/** True when the bytes are an actual point on the P-256 curve (web-push throws on anything else). */
function isP256Point(key: Buffer): boolean {
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    ecdh.computeSecret(key);
    return true;
  } catch {
    return false;
  }
}

function isKey(value: unknown, bytes: number): value is string {
  if (typeof value !== 'string' || !BASE64URL.test(value)) {
    return false;
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== bytes) {
    return false;
  }
  return bytes !== P256DH_BYTES || (decoded[0] === 0x04 && isP256Point(decoded));
}

/** Validated subscription from a request body, or null when anything is missing or malformed. */
export function parsePushSubscription(body: unknown): PushSubscriptionInput | null {
  const { endpoint, keys } = (body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  if (!isAllowedPushEndpoint(endpoint) || !keys || !isKey(keys.p256dh, P256DH_BYTES) || !isKey(keys.auth, AUTH_BYTES)) {
    return null;
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export class PushSubscriptionService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Stores a subscription, or refreshes the keys of a known endpoint. Safe to repeat. */
  add(subscription: PushSubscriptionInput): void {
    this.db.prepare(
      'INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth'
    ).run(subscription.endpoint, subscription.p256dh, subscription.auth);
  }

  /** Removes a subscription by endpoint. Safe to repeat. */
  remove(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  removeById(id: number): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id);
  }

  /** Subscriptions not yet sent the given UTC day's notification. */
  listDue(day: string): PushSubscriptionRow[] {
    return this.db.prepare(
      'SELECT * FROM push_subscriptions WHERE last_sent_date IS NULL OR last_sent_date < ? ORDER BY id'
    ).all(day) as PushSubscriptionRow[];
  }

  markSent(id: number, day: string): void {
    this.db.prepare('UPDATE push_subscriptions SET last_sent_date = ? WHERE id = ?').run(day, id);
  }
}
