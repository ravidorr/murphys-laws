#!/usr/bin/env node
/**
 * Emails today's Law of the Day to confirmed subscribers.
 * Run once a day from cron, after select-law-of-day (see shared/docs/DEPLOYMENT.md). Safe to re-run:
 * subscribers who already received today's law are skipped.
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from '../src/services/database.service.ts';
import { DailyDigestService } from '../src/services/daily-digest.service.ts';
import { EmailService } from '../src/services/email.service.ts';
import { LawService } from '../src/services/laws.service.ts';
import { SubscriptionService } from '../src/services/subscriptions.service.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const db = (new DatabaseService(resolve(__dirname, '..', 'murphys.db')) as unknown as { db: ConstructorParameters<typeof LawService>[0] }).db;
const emailService = new EmailService({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.EMAIL_FROM || 'noreply@murphys-laws.com',
  to: process.env.EMAIL_TO || 'admin@murphys-laws.com',
});

const digest = new DailyDigestService(new SubscriptionService(db), new LawService(db), emailService);
const result = await digest.sendToSubscribers();
console.log(`Daily law email: ${result.sent} sent, ${result.failed} failed${result.skipped ? ` (skipped: ${result.skipped})` : ''}`);
process.exit(result.failed > 0 ? 1 : 0);
