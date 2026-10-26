#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { fillEnvFromFiles, parseRecipientList, resolveAlertRecipient } from './alert-recipient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');
const ALERT_RECIPIENT_KEYS = ['HEALTH_CHECK_EMAIL_TO', 'ALERT_EMAIL', 'EMAIL_TO'] as const;
// Cron gives this script no environment, so look for the recipient in the same files, in the same order,
// as health-check.sh does. This runs before config() so that order is respected.
fillEnvFromFiles(process.env.REPO_ROOT?.trim() || join(backendDir, '..'), process.env, ALERT_RECIPIENT_KEYS);
config({ path: join(backendDir, '.env') });

/**
 * `--no-email` makes this report by exit code and output only. health-monitor.sh runs it that way and does
 * the emailing itself, once and with cooldowns, so a missing SMTP setting cannot stop the checks.
 */
const NO_EMAIL = process.argv.includes('--no-email');

/**
 * Exit codes: 0 healthy; 1 a check failed (the output then contains the line "Health check FAILED", which
 * health-monitor.sh looks for, because a crash that exits 1 before any check ran must not look like an
 * outage); 2 the alert recipient is invalid (nothing was checked); 3 passed with warnings that were not
 * emailed (--no-email, or the email could not be sent); 4 the script itself failed unexpectedly.
 */
const EXIT_CONFIG_ERROR = 2;
const EXIT_WARNINGS_NOT_EMAILED = 3;
const EXIT_INTERNAL_ERROR = 4;

/** How long each check may take, body included (a response that sends its headers and then stalls counts). */
const TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS) || 10000;

const FRONTEND_URL = process.env.HEALTH_CHECK_FRONTEND_URL ?? 'https://murphys-laws.com';
const API_URL = process.env.HEALTH_CHECK_API_URL ?? 'https://murphys-laws.com/api/health';
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@murphys-laws.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Email is optional for the checks: without SMTP or a recipient they still run, and only the email is skipped.
let emailTransporter: Transporter | null = null;
let EMAIL_TO: string[] = [];
if (!NO_EMAIL) {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  } else {
    console.error('WARNING: SMTP not configured (set SMTP_HOST, SMTP_USER and SMTP_PASS); alert emails are off, the checks still run.');
  }

  const alertRecipient = resolveAlertRecipient(process.env, ALERT_RECIPIENT_KEYS);
  if (!alertRecipient) {
    console.error('WARNING: no alert recipient (set HEALTH_CHECK_EMAIL_TO, ALERT_EMAIL or EMAIL_TO); alert emails are off, the checks still run.');
  } else {
    try {
      EMAIL_TO = parseRecipientList(alertRecipient);
    } catch (error) {
      console.error(`Invalid alert recipient: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(EXIT_CONFIG_ERROR);
    }
  }
}

interface CheckResult {
  success: boolean;
  error?: string;
  url: string;
  responseTime: number | null;
  dbQueryTime?: number;
}

type Delivery = 'sent' | 'not-sent' | 'skipped';

/**
 * 'sent': the SMTP server accepted the email. 'not-sent': it was attempted and failed, or email is not
 * configured. 'skipped': not attempted because of `--no-email`.
 */
async function sendAlert(subject: string, message: string): Promise<Delivery> {
  if (NO_EMAIL) {
    return 'skipped';
  }
  if (!emailTransporter || EMAIL_TO.length === 0) {
    console.error(`Alert email not sent (email is not configured): ${subject}`);
    return 'not-sent';
  }
  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `[Murphy's Laws] ${subject}`,
      text: message,
      html: `
        <!DOCTYPE html>
        <html>
        <body>
          <main>
            <header>
              <h1>Health Check Alert</h1>
            </header>
            <section>
              <h2>${subject}</h2>
              <p>${message.replace(/\n/g, '<br>')}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </section>
            <footer>
              <p>This is an automated health check notification from Murphy's Laws monitoring system.</p>
            </footer>
          </main>
        </body>
        </html>
      `,
    });
    console.log(`Alert email sent: ${subject}`);
    return 'sent';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to send alert email:', message);
    return 'not-sent';
  }
}

async function checkFrontend(): Promise<CheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const startTime = Date.now();
    const response = await fetch(FRONTEND_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MurphysLaws-HealthCheck/1.0' }
    });
    const responseTime = Date.now() - startTime;

    if (response.status !== 200) {
      return {
        success: false,
        error: `Frontend returned status ${response.status}`,
        url: FRONTEND_URL,
        responseTime
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return {
        success: false,
        error: `Frontend returned unexpected content-type: ${contentType}`,
        url: FRONTEND_URL,
        responseTime
      };
    }

    return { success: true, url: FRONTEND_URL, responseTime };
  } catch (error) {
    const err = error as Error & { name?: string };
    return {
      success: false,
      error: err.name === 'AbortError' ? `Request timeout (${TIMEOUT_MS / 1000}s)` : err.message,
      url: FRONTEND_URL,
      responseTime: err.name === 'AbortError' ? TIMEOUT_MS : null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkAPI(): Promise<CheckResult> {
  const controller = new AbortController();
  // Kept running until the body has been read: an API that sends its headers and then stalls must time out too.
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const startTime = Date.now();
    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MurphysLaws-HealthCheck/1.0' }
    });
    const responseTime = Date.now() - startTime;

    if (response.status !== 200) {
      return {
        success: false,
        error: `API returned status ${response.status}`,
        url: API_URL,
        responseTime
      };
    }

    const data = (await response.json()) as { ok?: boolean; dbQueryTime?: number };
    if (!data.ok) {
      return {
        success: false,
        error: 'API health check returned ok: false',
        url: API_URL,
        responseTime
      };
    }

    return { success: true, url: API_URL, responseTime, dbQueryTime: data.dbQueryTime };
  } catch (error) {
    const err = error as Error & { name?: string };
    return {
      success: false,
      error: err.name === 'AbortError' ? `Request timeout (${TIMEOUT_MS / 1000}s)` : err.message,
      url: API_URL,
      responseTime: err.name === 'AbortError' ? TIMEOUT_MS : null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

const SLOW_THRESHOLD_MS = 5000;

async function runHealthCheck(): Promise<void> {
  console.log('Running health check...');
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`API URL: ${API_URL}`);
  console.log('---');

  const [frontendResult, apiResult] = await Promise.all([
    checkFrontend(),
    checkAPI()
  ]);

  const failures: string[] = [];
  const warnings: string[] = [];

  if (!frontendResult.success) {
    console.error(`Frontend check failed: ${frontendResult.error}`);
    if (frontendResult.responseTime) {
      console.error(`   Response time: ${frontendResult.responseTime}ms`);
    }
    failures.push(`Frontend (${frontendResult.url}): ${frontendResult.error}${frontendResult.responseTime ? ` (${frontendResult.responseTime}ms)` : ''}`);
  } else {
    console.log(`Frontend is healthy: ${frontendResult.url}`);
    console.log(`   Response time: ${frontendResult.responseTime}ms`);
    if (frontendResult.responseTime !== null && frontendResult.responseTime > SLOW_THRESHOLD_MS) {
      console.warn(`Frontend response time is slow (${frontendResult.responseTime}ms > ${SLOW_THRESHOLD_MS}ms)`);
      warnings.push(`Frontend is responding slowly: ${frontendResult.responseTime}ms`);
    }
  }

  if (!apiResult.success) {
    console.error(`API check failed: ${apiResult.error}`);
    if (apiResult.responseTime) {
      console.error(`   Response time: ${apiResult.responseTime}ms`);
    }
    failures.push(`API (${apiResult.url}): ${apiResult.error}${apiResult.responseTime ? ` (${apiResult.responseTime}ms)` : ''}`);
  } else {
    console.log(`API is healthy: ${apiResult.url}`);
    console.log(`   Response time: ${apiResult.responseTime}ms`);
    if (apiResult.dbQueryTime) {
      console.log(`   Database query time: ${apiResult.dbQueryTime}ms`);
      if (apiResult.dbQueryTime > 1000) {
        console.warn(`Database query time is slow (${apiResult.dbQueryTime}ms > 1000ms)`);
        warnings.push(`Database queries are slow: ${apiResult.dbQueryTime}ms`);
      }
    }
    if (apiResult.responseTime !== null && apiResult.responseTime > SLOW_THRESHOLD_MS) {
      console.warn(`API response time is slow (${apiResult.responseTime}ms > ${SLOW_THRESHOLD_MS}ms)`);
      warnings.push(`API is responding slowly: ${apiResult.responseTime}ms`);
    }
  }

  if (failures.length > 0) {
    const subject = 'Health Check Failed';
    const message = `The following health checks failed:\n\n${failures.map((f) => `• ${f}`).join('\n')}\n\nPlease investigate immediately.`;
    const delivery = await sendAlert(subject, message);
    console.log('---');
    console.error(`Health check FAILED.${delivery === 'sent' ? ' Alert email sent.' : delivery === 'not-sent' ? ' ALERT EMAIL NOT SENT.' : ''}`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    const subject = 'Health Check Warning - Performance Degraded';
    const message = `The health checks passed but performance issues were detected:\n\n${warnings.map((w) => `• ${w}`).join('\n')}\n\nConsider investigating to prevent future issues.`;
    const delivery = await sendAlert(subject, message);
    console.log('---');
    if (delivery === 'sent') {
      console.warn('Health check passed with WARNINGS. Alert email sent.');
      process.exit(0);
    }
    console.error(`Health check passed with WARNINGS.${delivery === 'not-sent' ? ' ALERT EMAIL NOT SENT.' : ' Not emailed (--no-email).'}`);
    process.exit(EXIT_WARNINGS_NOT_EMAILED);
  }

  console.log('---');
  console.log('All health checks passed');
  process.exit(0);
}

runHealthCheck().catch((error) => {
  console.error('Health check script error:', error);
  process.exit(EXIT_INTERNAL_ERROR);
});
