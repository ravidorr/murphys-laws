import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

/** A confirmation email is not re-sent to the same address more often than this. */
export const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;

const MAX_EMAIL_LENGTH = 254;
// No whitespace, quotes, brackets, commas or semicolons: those are address-list and display-name syntax.
const EMAIL_PATTERN = /^[^\s@,;<>()[\]\\":]+@[^\s@,;<>()[\]\\":]+\.[^\s@,;<>()[\]\\":]+$/;

export interface SubscriptionRow {
  id: number;
  email: string;
  token: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirmation_sent_at: string | null;
  last_sent_date: string | null;
}

export type SubscribeResult =
  | { status: 'invalid' }
  | { status: 'already_confirmed' }
  | { status: 'cooldown' }
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
   * Starts (or restarts) a subscription. Nothing is mailed until the address is confirmed, and a
   * confirmation is not repeated within the cooldown, so the form cannot be used to spam an inbox.
   */
  subscribe(rawEmail: unknown, now: number = Date.now()): SubscribeResult {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { status: 'invalid' };
    }

    const existing = this.db.prepare('SELECT * FROM email_subscriptions WHERE email = ?').get(email) as SubscriptionRow | undefined;

    if (!existing) {
      const token = randomBytes(24).toString('hex');
      try {
        this.db.prepare(
          'INSERT INTO email_subscriptions (email, token, status, confirmation_sent_at) VALUES (?, ?, \'pending\', ?)'
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

    this.db.prepare(
      'UPDATE email_subscriptions SET status = \'pending\', confirmation_sent_at = ?, unsubscribed_at = NULL WHERE id = ?'
    ).run(sqliteTimestamp(now), existing.id);
    return { status: 'confirmation_needed', token: existing.token, email };
  }

  /** Lets the address try again at once after its confirmation email could not be sent. */
  releaseCooldown(token: string): void {
    this.db.prepare('UPDATE email_subscriptions SET confirmation_sent_at = NULL WHERE token = ?').run(token);
  }

  /** Confirms the address behind a token. False for an unknown token. Safe to repeat. */
  confirm(token: string): boolean {
    const row = this.db.prepare('SELECT id, status FROM email_subscriptions WHERE token = ?').get(token) as Pick<SubscriptionRow, 'id' | 'status'> | undefined;
    if (!row) {
      return false;
    }
    if (row.status !== 'confirmed') {
      this.db.prepare(
        'UPDATE email_subscriptions SET status = \'confirmed\', confirmed_at = CURRENT_TIMESTAMP, unsubscribed_at = NULL WHERE id = ?'
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
      'SELECT * FROM email_subscriptions WHERE status = \'confirmed\' AND (last_sent_date IS NULL OR last_sent_date < ?) ORDER BY id'
    ).all(day) as SubscriptionRow[];
  }

  markSent(id: number, day: string): void {
    this.db.prepare('UPDATE email_subscriptions SET last_sent_date = ? WHERE id = ?').run(day, id);
  }
}
