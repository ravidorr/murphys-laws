#!/usr/bin/env node
/**
 * Records an address that must never be mailed again (a spam report, a hard bounce) and stops its subscription.
 *
 *   npm run email:suppress -- someone@example.com "SMTP2GO spam report 2026-11-25"
 *
 * The address is kept in email_suppressions, which outlives the subscription row: the signup form answers its
 * usual 202 for it without sending, and the daily email skips it. Safe to repeat.
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from '../src/services/database.service.ts';
import { SubscriptionService } from '../src/services/subscriptions.service.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const [address, ...reasonWords] = process.argv.slice(2);
const reason = reasonWords.join(' ').trim();
if (!address || !reason) {
  console.error('Usage: npm run email:suppress -- <address> "<reason>"');
  process.exit(2);
}

const db = (new DatabaseService(resolve(__dirname, '..', 'murphys.db')) as unknown as { db: ConstructorParameters<typeof SubscriptionService>[0] }).db;
if (!new SubscriptionService(db).suppress(address, reason)) {
  console.error('That is not a plausible email address.');
  process.exit(1);
}
console.log(`Suppressed: ${address.trim().toLowerCase()} (${reason})`);
