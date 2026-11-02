import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { createMigratedDb } from '../helpers/migrated-db.ts';
import {
  CONFIRMATION_COOLDOWN_MS,
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
    service.releaseCooldown(token);
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
});
