#!/usr/bin/env node
/**
 * Sends today's Law of the Day as a Web Push notification to every subscribed browser.
 * Run once a day from cron, after select-law-of-day (see shared/docs/DEPLOYMENT.md). Safe to re-run:
 * subscriptions that already received today's law are skipped, and subscriptions the push service
 * reports as gone are deleted.
 *
 * Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or https: URL) in the backend .env.
 * Generate the key pair once with: npx web-push generate-vapid-keys
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { DailyPushService } from '../src/services/daily-push.service.ts';
import { DatabaseService } from '../src/services/database.service.ts';
import { LawService } from '../src/services/laws.service.ts';
import { PushSubscriptionService } from '../src/services/push-subscriptions.service.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

const db = (new DatabaseService(resolve(__dirname, '..', 'murphys.db')) as unknown as { db: ConstructorParameters<typeof LawService>[0] }).db;
const push = new DailyPushService(new PushSubscriptionService(db), new LawService(db), configured ? webpush : null);
const result = await push.sendToSubscribers();
console.log(`Daily law push: ${result.sent} sent, ${result.failed} failed, ${result.removed} removed${result.skipped ? ` (skipped: ${result.skipped})` : ''}`);
process.exit(result.failed > 0 ? 1 : 0);
