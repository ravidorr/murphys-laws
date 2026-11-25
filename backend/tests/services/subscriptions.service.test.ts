import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { createMigratedDb } from '../helpers/migrated-db.ts';
import {
  CONFIRMATION_COOLDOWN_MS,
  CONFIRMATION_LIMIT,
  CONFIRMATION_LIMIT_WINDOW_MS,
  CONFIRMATION_SEND_RETENTION_MS,
  STALE_PENDING_MS,
  SubscriptionService,
  normalizeEmail,
  type SubscribeResult,
} from '../../src/services/subscriptions.service.ts';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ann@Example.COM ')).toBe('ann@example.com');
  });

  it.each([undefined, null, 42, '', '   ', 'no-at-sign', 'a@b', 'a b@c.d', `${'a'.repeat(250)}@x.io`, 'x,victim@example.com', 'evil<victim@example.com>', '"x"@example.com'])('rejects %s', (value) => {
    expect(normalizeEmail(value)).toBeNull();
  });
});

describe('SubscriptionService', () => {
  let db: InstanceType<typeof Database>;
  let service: SubscriptionService;
  const t0 = Date.parse('2026-11-02T08:00:00Z');

  function tokenOf(result: SubscribeResult): string {
    if (result.status !== 'confirmation_needed') {
      throw new Error(`unexpected ${result.status}`);
    }
    return result.token;
  }

  beforeEach(() => {
    db = createMigratedDb();
    service = new SubscriptionService(db);
  });

  it('rejects an invalid address without storing anything', () => {
    expect(service.subscribe('nope')).toEqual({ status: 'invalid' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM email_subscriptions').get()).toEqual({ n: 0 });
  });

  it('stores a new address as pending with a random token', () => {
    const first = tokenOf(service.subscribe('Ann@Example.com', t0));
    const second = tokenOf(service.subscribe('bob@example.com', t0));
    expect(first).toMatch(/^[a-f0-9]{48}$/);
    expect(first).not.toBe(second);
    expect(db.prepare('SELECT email, status FROM email_subscriptions WHERE token = ?').get(first)).toEqual({ email: 'ann@example.com', status: 'pending' });
  });

  it('does not repeat a confirmation inside the cooldown but does after it', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    expect(service.subscribe('ANN@example.com', t0 + CONFIRMATION_COOLDOWN_MS - 1)).toEqual({ status: 'cooldown' });
    expect(service.subscribe('ann@example.com', t0 + CONFIRMATION_COOLDOWN_MS)).toEqual({ status: 'confirmation_needed', token, email: 'ann@example.com' });
  });

  it('allows an immediate retry once the cooldown is released', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    service.releaseCooldown(token, t0);
    expect(service.subscribe('ann@example.com', t0 + 1)).toEqual({ status: 'confirmation_needed', token, email: 'ann@example.com' });
  });

  it('treats a pending row with no recorded send time as due', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    db.prepare('UPDATE email_subscriptions SET confirmation_sent_at = NULL').run();
    expect(service.subscribe('ann@example.com', t0 + 1)).toEqual({ status: 'confirmation_needed', token, email: 'ann@example.com' });
  });

  it('confirms by token, repeatably, and reports unknown tokens', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    expect(service.confirm('f'.repeat(48))).toBe(false);
    expect(service.confirm(token)).toBe(true);
    expect(service.confirm(token)).toBe(true);
    expect(db.prepare('SELECT status FROM email_subscriptions').get()).toEqual({ status: 'confirmed' });
    expect(service.subscribe('ann@example.com', t0 + 5 * CONFIRMATION_COOLDOWN_MS)).toEqual({ status: 'already_confirmed' });
  });

  it('does not let an old confirmation email undo an unsubscribe', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    service.confirm(token);
    service.unsubscribe(token);
    expect(service.confirm(token)).toBe(false);
    expect(db.prepare('SELECT status FROM email_subscriptions').get()).toEqual({ status: 'unsubscribed' });
    expect(service.listDue('2026-11-02')).toEqual([]);
  });

  it('unsubscribes by token, repeatably, and lets the address subscribe again', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    service.confirm(token);
    expect(service.unsubscribe('f'.repeat(48))).toBe(false);
    expect(service.unsubscribe(token)).toBe(true);
    expect(service.unsubscribe(token)).toBe(true);
    expect(service.listDue('2026-11-02')).toEqual([]);
    expect(service.subscribe('ann@example.com', t0)).toEqual({ status: 'confirmation_needed', token, email: 'ann@example.com' });
    expect(db.prepare('SELECT status, unsubscribed_at FROM email_subscriptions').get()).toEqual({ status: 'pending', unsubscribed_at: null });
  });

  it('keeps apostrophes and plus tags in valid addresses', () => {
    expect(normalizeEmail("O'Brien+news@Example.com")).toBe("o'brien+news@example.com");
  });

  it('returns the normalized address with the token', () => {
    expect(service.subscribe(' Ann@Example.com ', t0)).toMatchObject({ status: 'confirmation_needed', email: 'ann@example.com' });
  });

  it('treats a parallel insert of the same address as already in progress', () => {
    const real = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (sql.startsWith('INSERT')) {
        throw Object.assign(new Error('unique'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
      }
      return real(sql);
    }) as never);
    expect(service.subscribe('ann@example.com', t0)).toEqual({ status: 'cooldown' });
  });

  it('rethrows any other insert failure', () => {
    const real = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (sql.startsWith('INSERT')) {
        throw new Error('disk full');
      }
      return real(sql);
    }) as never);
    expect(() => service.subscribe('ann@example.com', t0)).toThrow('disk full');
  });

  it('lists only confirmed subscribers not yet sent the day, and records sends', () => {
    const a = tokenOf(service.subscribe('a@example.com', t0));
    tokenOf(service.subscribe('pending@example.com', t0));
    const c = tokenOf(service.subscribe('c@example.com', t0));
    service.confirm(a);
    service.confirm(c);
    const due = service.listDue('2026-11-02');
    expect(due.map((row) => row.email)).toEqual(['a@example.com', 'c@example.com']);
    service.markSent(due[0].id, '2026-11-02');
    expect(service.listDue('2026-11-02').map((row) => row.email)).toEqual(['c@example.com']);
    expect(service.listDue('2026-11-03').map((row) => row.email)).toEqual(['a@example.com', 'c@example.com']);
  });

  describe('confirmation limit', () => {
    it('sends an unconfirmed address at most CONFIRMATION_LIMIT confirmations per window, however far apart', () => {
      const token = tokenOf(service.subscribe('ann@example.com', t0));
      let sent = 1;
      for (let i = 1; i <= 20; i += 1) {
        const result = service.subscribe('ann@example.com', t0 + i * CONFIRMATION_COOLDOWN_MS);
        if (result.status === 'confirmation_needed') {
          expect(result.token).toBe(token);
          sent += 1;
        } else {
          expect(result).toEqual({ status: 'cooldown' });
        }
      }
      expect(sent).toBe(CONFIRMATION_LIMIT);
      expect(db.prepare('SELECT confirmation_count FROM email_subscriptions').get()).toEqual({ confirmation_count: CONFIRMATION_LIMIT });
    });

    it('starts again once the last confirmation is older than the window', () => {
      const token = tokenOf(service.subscribe('ann@example.com', t0));
      service.subscribe('ann@example.com', t0 + CONFIRMATION_COOLDOWN_MS);
      const lastSend = t0 + CONFIRMATION_COOLDOWN_MS;
      expect(service.subscribe('ann@example.com', lastSend + CONFIRMATION_LIMIT_WINDOW_MS - 1)).toEqual({ status: 'cooldown' });
      expect(service.subscribe('ann@example.com', lastSend + CONFIRMATION_LIMIT_WINDOW_MS)).toEqual({ status: 'confirmation_needed', token, email: 'ann@example.com' });
      expect(db.prepare('SELECT confirmation_count FROM email_subscriptions').get()).toEqual({ confirmation_count: 1 });
    });

    it('limits an unsubscribed address the same way, and resets the count on confirmation', () => {
      const token = tokenOf(service.subscribe('ann@example.com', t0));
      service.confirm(token);
      expect(db.prepare('SELECT confirmation_count FROM email_subscriptions').get()).toEqual({ confirmation_count: 0 });
      service.unsubscribe(token);
      expect(service.subscribe('ann@example.com', t0 + CONFIRMATION_COOLDOWN_MS).status).toBe('confirmation_needed');
      service.unsubscribe(token);
      expect(service.subscribe('ann@example.com', t0 + 2 * CONFIRMATION_COOLDOWN_MS).status).toBe('confirmation_needed');
      service.unsubscribe(token);
      expect(service.subscribe('ann@example.com', t0 + 3 * CONFIRMATION_COOLDOWN_MS)).toEqual({ status: 'cooldown' });
    });
  });

  it('does not count a confirmation that could not be sent, and a failed send cannot be used to get more than the limit', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    // day 1: a second confirmation is sent and fails
    const day1 = t0 + 24 * 60 * 60 * 1000;
    expect(service.subscribe('ann@example.com', day1).status).toBe('confirmation_needed');
    service.releaseCooldown(token, day1);
    expect(db.prepare('SELECT confirmation_count FROM email_subscriptions').get()).toEqual({ confirmation_count: 1 });
    // the failed one did not count, so exactly one more is allowed, then the limit holds
    expect(service.subscribe('ann@example.com', day1 + 1000).status).toBe('confirmation_needed');
    expect(service.subscribe('ann@example.com', day1 + 2 * CONFIRMATION_COOLDOWN_MS)).toEqual({ status: 'cooldown' });
    // the count never goes below zero
    service.releaseCooldown(token, day1);
    service.releaseCooldown(token, day1);
    service.releaseCooldown(token, day1);
    expect(db.prepare('SELECT confirmation_count FROM email_subscriptions').get()).toEqual({ confirmation_count: 0 });
  });

  it('keeps a recently mailed address out of the purge even after a failed send was released', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    db.prepare("UPDATE email_subscriptions SET created_at = '2026-01-01 00:00:00'").run();
    service.releaseCooldown(token, t0);
    expect(service.purgeStalePending(t0 + 1000)).toBe(0);
  });

  it('defaults a release to the current time', () => {
    const token = tokenOf(service.subscribe('ann@example.com', t0));
    service.releaseCooldown(token);
    const row = db.prepare('SELECT confirmation_sent_at FROM email_subscriptions').get() as { confirmation_sent_at: string };
    expect(Date.parse(`${row.confirmation_sent_at.replace(' ', 'T')}Z`)).toBeGreaterThan(Date.now() - CONFIRMATION_COOLDOWN_MS - 60_000);
  });

  describe('suppression', () => {
    it('never mails a suppressed address, with or without a subscription row, in any case', () => {
      const token = tokenOf(service.subscribe('ann@example.com', t0));
      service.confirm(token);
      expect(service.suppress(' Ann@Example.com ', 'spam report')).toBe(true);
      expect(service.suppress('ann@example.com', 'again')).toBe(true);
      expect(service.suppress('bob@example.com', 'spam report')).toBe(true);
      expect(service.suppress('nope', 'spam report')).toBe(false);

      expect(db.prepare('SELECT email, reason FROM email_suppressions ORDER BY email').all()).toEqual([
        { email: 'ann@example.com', reason: 'spam report' },
        { email: 'bob@example.com', reason: 'spam report' },
      ]);
      expect(db.prepare('SELECT status FROM email_subscriptions').get()).toEqual({ status: 'unsubscribed' });
      expect(service.isSuppressed('ANN@example.com')).toBe(true);
      expect(service.isSuppressed('carol@example.com')).toBe(false);
      expect(service.subscribe('ann@example.com', t0 + CONFIRMATION_LIMIT_WINDOW_MS * 2)).toEqual({ status: 'suppressed' });
      expect(service.subscribe('BOB@example.com', t0)).toEqual({ status: 'suppressed' });
      expect(db.prepare('SELECT COUNT(*) AS n FROM email_subscriptions').get()).toEqual({ n: 1 });
    });

    it('survives deleting the subscription row', () => {
      tokenOf(service.subscribe('ann@example.com', t0));
      service.suppress('ann@example.com', 'spam report');
      db.prepare('DELETE FROM email_subscriptions').run();
      expect(service.subscribe('ann@example.com', t0)).toEqual({ status: 'suppressed' });
    });

    it('refuses an empty suppression, so one bad row cannot empty the daily list', () => {
      expect(() => db.prepare('INSERT INTO email_suppressions (email, reason) VALUES (NULL, ?)').run('typo')).toThrow(/NOT NULL/);
    });

    it('keeps a suppressed address out of the daily list even when it is still marked confirmed', () => {
      const token = tokenOf(service.subscribe('ann@example.com', t0));
      service.confirm(token);
      db.prepare('INSERT INTO email_suppressions (email, reason) VALUES (?, ?)').run('ANN@example.com', 'spam report');
      expect(service.listDue('2026-11-02')).toEqual([]);
    });
  });

  describe('migration 025 on a database that already has subscriptions', () => {
    it('counts the confirmation each existing row already got, so none gets a fresh allowance', () => {
      const old = createMigratedDb({ before: '025' });
      const insert = old.prepare('INSERT INTO email_subscriptions (email, token, status, confirmation_sent_at) VALUES (?, ?, ?, ?)');
      insert.run('sent@example.com', 'a'.repeat(48), 'pending', '2026-11-02 08:00:00');
      insert.run('unsent@example.com', 'b'.repeat(48), 'pending', null);
      const migration = readFileSync(resolve(import.meta.dirname, '../../db/migrations/025_email_confirmation_limits.sql'), 'utf8');
      old.exec(migration);
      expect(old.prepare('SELECT email, confirmation_count FROM email_subscriptions ORDER BY email').all()).toEqual([
        { email: 'sent@example.com', confirmation_count: 1 },
        { email: 'unsent@example.com', confirmation_count: 0 },
      ]);

      // Mailed an hour ago: a second one is allowed, a third is not
      const upgraded = new SubscriptionService(old);
      const hourLater = Date.parse('2026-11-02T09:00:00Z');
      expect(upgraded.subscribe('sent@example.com', hourLater).status).toBe('confirmation_needed');
      expect(upgraded.subscribe('sent@example.com', hourLater + CONFIRMATION_COOLDOWN_MS)).toEqual({ status: 'cooldown' });
    });
  });

  describe('confirmation send record', () => {
    it('records each attempt with its time and outcome, and no address', () => {
      service.recordConfirmationSend(true, t0);
      service.recordConfirmationSend(false, t0 + 1000);
      expect(db.prepare('SELECT sent_at, ok FROM confirmation_sends ORDER BY id').all()).toEqual([
        { sent_at: '2026-11-02 08:00:00', ok: 1 },
        { sent_at: '2026-11-02 08:00:01', ok: 0 },
      ]);
      expect(db.prepare("SELECT name FROM pragma_table_info('confirmation_sends') ORDER BY cid").all()).toEqual([{ name: 'id' }, { name: 'sent_at' }, { name: 'ok' }]);
    });

    it('defaults to the current time', () => {
      service.recordConfirmationSend(true);
      const row = db.prepare('SELECT sent_at FROM confirmation_sends').get() as { sent_at: string };
      expect(Date.parse(`${row.sent_at.replace(' ', 'T')}Z`)).toBeGreaterThan(Date.now() - 60_000);
    });

    it('refuses an outcome that is not 0 or 1', () => {
      expect(() => db.prepare('INSERT INTO confirmation_sends (ok) VALUES (2)').run()).toThrow(/CHECK/);
    });

    it('is pruned with the stale pending addresses, keeping what is inside the retention window', () => {
      service.recordConfirmationSend(true, t0);
      service.recordConfirmationSend(true, t0 + CONFIRMATION_SEND_RETENTION_MS);
      service.purgeStalePending(t0 + CONFIRMATION_SEND_RETENTION_MS + 1000);
      expect(db.prepare('SELECT sent_at FROM confirmation_sends').all()).toEqual([{ sent_at: '2027-01-31 08:00:00' }]);
    });
  });

  describe('purgeStalePending', () => {
    it('keeps an address mailed exactly at the cutoff and deletes one mailed a second before it', () => {
      tokenOf(service.subscribe('edge@example.com', t0));
      expect(service.purgeStalePending(t0 + STALE_PENDING_MS)).toBe(0);
      expect(service.purgeStalePending(t0 + STALE_PENDING_MS + 1000)).toBe(1);
    });

    it('deletes only unconfirmed addresses last mailed long ago', () => {
      tokenOf(service.subscribe('old@example.com', t0));
      tokenOf(service.subscribe('recent@example.com', t0 + STALE_PENDING_MS));
      const confirmed = tokenOf(service.subscribe('confirmed@example.com', t0));
      service.confirm(confirmed);
      const unsubscribed = tokenOf(service.subscribe('gone@example.com', t0));
      service.unsubscribe(unsubscribed);
      tokenOf(service.subscribe('never-sent@example.com', t0));
      db.prepare("UPDATE email_subscriptions SET confirmation_sent_at = NULL, created_at = '2026-10-01 00:00:00' WHERE email = 'never-sent@example.com'").run();

      expect(service.purgeStalePending(t0 + STALE_PENDING_MS + 1000)).toBe(2);
      expect(db.prepare('SELECT email FROM email_subscriptions ORDER BY email').all()).toEqual([
        { email: 'confirmed@example.com' },
        { email: 'gone@example.com' },
        { email: 'recent@example.com' },
      ]);
      expect(service.purgeStalePending(t0 + STALE_PENDING_MS + 1000)).toBe(0);
    });

    it('defaults to the current time', () => {
      tokenOf(service.subscribe('old@example.com', t0));
      expect(service.purgeStalePending()).toBe(1);
    });
  });
});
