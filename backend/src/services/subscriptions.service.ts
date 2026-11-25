import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

/** A confirmation email is not re-sent to the same address more often than this. */
export const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * An unconfirmed address gets at most this many confirmation emails, however the requests arrive; after that it
 * waits CONFIRMATION_LIMIT_WINDOW_MS from the last one. The cooldown alone still allowed about 144 a day,
 * which is how a bot can bury a stranger's inbox.
 */
export const CONFIRMATION_LIMIT = 2;
export const CONFIRMATION_LIMIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** An address that never confirmed is dropped this long after its last confirmation email. */
export const STALE_PENDING_MS = 14 * 24 * 60 * 60 * 1000;

const MAX_EMAIL_LENGTH = 254;
// No whitespace, quotes, brackets, commas or semicolons: those are address-list and display-name syntax.
const EMAIL_PATTERN = /^[^\s@,;<>()[\]\\":]+@[^\s@,;<>()[\]\\":]+\.[^\s@,;<>()[\]\\":]+$/;

export interface SubscriptionRow {
  id: number;
  email: string;
  token: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirmation_sent_at: string | null;
  confirmation_count: number;
  last_sent_date: string | null;
}

export type SubscribeResult =
  | { status: 'invalid' }
  | { status: 'already_confirmed' }
  | { status: 'cooldown' }
  | { status: 'suppressed' }
  | { status: 'confirmation_needed'; token: string; email: string };

/** Lowercased, trimmed address, or null when it is not a plausible email. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

function sqliteTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

export class SubscriptionService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Starts (or restarts) a subscription. Nothing is mailed until the address is confirmed, a confirmation is
   * not repeated within the cooldown, an address gets at most CONFIRMATION_LIMIT of them per window, and a
   * suppressed address gets none, so the form cannot be used to spam an inbox.
   */
  subscribe(rawEmail: unknown, now: number = Date.now()): SubscribeResult {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { status: 'invalid' };
    }

    if (this.isSuppressed(email)) {
      return { status: 'suppressed' };
    }

    const existing = this.db.prepare('SELECT * FROM email_subscriptions WHERE email = ?').get(email) as SubscriptionRow | undefined;

    if (!existing) {
      const token = randomBytes(24).toString('hex');
      try {
        this.db.prepare(
          'INSERT INTO email_subscriptions (email, token, status, confirmation_sent_at, confirmation_count) VALUES (?, ?, \'pending\', ?, 1)'
        ).run(email, token, sqliteTimestamp(now));
      } catch (error) {
        // A parallel request for the same address won the insert; it is the one sending the confirmation.
        if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return { status: 'cooldown' };
        }
        throw error;
      }
      return { status: 'confirmation_needed', token, email };
    }

    if (existing.status === 'confirmed') {
      return { status: 'already_confirmed' };
    }

    const sentAt = existing.confirmation_sent_at ? Date.parse(`${existing.confirmation_sent_at.replace(' ', 'T')}Z`) : 0;
    if (existing.status === 'pending' && now - sentAt < CONFIRMATION_COOLDOWN_MS) {
      return { status: 'cooldown' };
    }

    // Only sends inside the window count; an address that was last mailed long ago starts again
    const sentInWindow = sentAt > 0 && now - sentAt < CONFIRMATION_LIMIT_WINDOW_MS ? existing.confirmation_count : 0;
    if (sentInWindow >= CONFIRMATION_LIMIT) {
      return { status: 'cooldown' };
    }

    this.db.prepare(
      'UPDATE email_subscriptions SET status = \'pending\', confirmation_sent_at = ?, confirmation_count = ?, unsubscribed_at = NULL WHERE id = ?'
    ).run(sqliteTimestamp(now), sentInWindow + 1, existing.id);
    return { status: 'confirmation_needed', token: existing.token, email };
  }

  /**
   * Lets the address try again at once after its confirmation email could not be sent: the failed send does not
   * count towards the limit, and the send time moves back just past the cooldown. It is not cleared, so the
   * address stays inside its window and cannot use a failed send to get more than the limit.
   */
  releaseCooldown(token: string, now: number = Date.now()): void {
    this.db.prepare(
      'UPDATE email_subscriptions SET confirmation_sent_at = ?, confirmation_count = MAX(confirmation_count - 1, 0) WHERE token = ?'
    ).run(sqliteTimestamp(now - CONFIRMATION_COOLDOWN_MS), token);
  }

  /**
   * Confirms a pending address by token. Repeating it on a confirmed address succeeds. False for an
   * unknown token and for an unsubscribed address: an old confirmation email must not undo an unsubscribe,
   * so that address has to subscribe again.
   */
  confirm(token: string): boolean {
    const row = this.db.prepare('SELECT id, status FROM email_subscriptions WHERE token = ?').get(token) as Pick<SubscriptionRow, 'id' | 'status'> | undefined;
    if (!row || row.status === 'unsubscribed') {
      return false;
    }
    if (row.status === 'pending') {
      this.db.prepare(
        'UPDATE email_subscriptions SET status = \'confirmed\', confirmed_at = CURRENT_TIMESTAMP, confirmation_count = 0 WHERE id = ?'
      ).run(row.id);
    }
    return true;
  }

  /** Stops the daily email for the address behind a token. False for an unknown token. Safe to repeat. */
  unsubscribe(token: string): boolean {
    const result = this.db.prepare(
      'UPDATE email_subscriptions SET status = \'unsubscribed\', unsubscribed_at = COALESCE(unsubscribed_at, CURRENT_TIMESTAMP) WHERE token = ?'
    ).run(token);
    return result.changes > 0;
  }

  /** Confirmed subscribers who have not yet been sent the given UTC day's email. */
  listDue(day: string): SubscriptionRow[] {
    return this.db.prepare(
      'SELECT * FROM email_subscriptions WHERE status = \'confirmed\' AND (last_sent_date IS NULL OR last_sent_date < ?)'
      + ' AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.email = email_subscriptions.email) ORDER BY id'
    ).all(day) as SubscriptionRow[];
  }

  markSent(id: number, day: string): void {
    this.db.prepare('UPDATE email_subscriptions SET last_sent_date = ? WHERE id = ?').run(day, id);
  }

  /** True for an address that must never be mailed again. */
  isSuppressed(email: string): boolean {
    return this.db.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').get(email) !== undefined;
  }

  /**
   * Records an address that must never be mailed again (a spam report, say) and stops any subscription it
   * has. Lasts when the subscription row is purged or deleted. False when the address is not a plausible email.
   */
  suppress(rawEmail: unknown, reason: string): boolean {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return false;
    }
    this.db.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').run(email, reason);
    this.db.prepare(
      'UPDATE email_subscriptions SET status = \'unsubscribed\', unsubscribed_at = COALESCE(unsubscribed_at, CURRENT_TIMESTAMP) WHERE email = ?'
    ).run(email);
    return true;
  }

  /** Deletes addresses that never confirmed and were last mailed more than STALE_PENDING_MS ago. Returns how many. */
  purgeStalePending(now: number = Date.now()): number {
    const cutoff = sqliteTimestamp(now - STALE_PENDING_MS);
    return this.db.prepare(
      'DELETE FROM email_subscriptions WHERE status = \'pending\' AND COALESCE(confirmation_sent_at, created_at) < ?'
    ).run(cutoff).changes;
  }
}
