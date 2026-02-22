#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');
config({ path: join(backendDir, '.env') });

const FRONTEND_URL = process.env.HEALTH_CHECK_FRONTEND_URL ?? 'https://murphys-laws.com';
const API_URL = process.env.HEALTH_CHECK_API_URL ?? 'https://murphys-laws.com/api/health';
const EMAIL_TO = process.env.HEALTH_CHECK_EMAIL_TO ?? 'ravidor@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@murphys-laws.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let emailTransporter: nodemailer.Transporter;
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
  console.error('SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  process.exit(1);
}

interface CheckResult {
  success: boolean;
  error?: string;
  url: string;
  responseTime: number | null;
  dbQueryTime?: number;
}

async function sendAlert(subject: string, message: string): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `[Murphy's Laws] ${subject}`,
      text: message,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; border-radius: 5px; }
            .footer { margin-top: 20px; font-size: 0.9em; color: #666; }
            code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Health Check Alert</h1>
            </div>
            <div class="content">
              <h2>${subject}</h2>
              <p>${message.replace(/\n/g, '<br>')}</p>
              <p style="margin-top: 20px;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>
            <div class="footer">
              <p>This is an automated health check notification from Murphy's Laws monitoring system.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`Alert email sent: ${subject}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to send alert email:', message);
  }
}

async function checkFrontend(): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch(FRONTEND_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MurphysLaws-HealthCheck/1.0' }
    });
    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

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
      error: err.name === 'AbortError' ? 'Request timeout (10s)' : err.message,
      url: FRONTEND_URL,
      responseTime: err.name === 'AbortError' ? 10000 : null
    };
  }
}

async function checkAPI(): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MurphysLaws-HealthCheck/1.0' }
    });
    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

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
      error: err.name === 'AbortError' ? 'Request timeout (10s)' : err.message,
      url: API_URL,
      responseTime: err.name === 'AbortError' ? 10000 : null
    };
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
    await sendAlert(subject, message);
    console.log('---');
    console.error('Health check FAILED. Alert email sent.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    const subject = 'Health Check Warning - Performance Degraded';
    const message = `The health checks passed but performance issues were detected:\n\n${warnings.map((w) => `• ${w}`).join('\n')}\n\nConsider investigating to prevent future issues.`;
    await sendAlert(subject, message);
    console.log('---');
    console.warn('Health check passed with WARNINGS. Alert email sent.');
    process.exit(0);
  }

  console.log('---');
  console.log('All health checks passed');
  process.exit(0);
}

runHealthCheck().catch((error) => {
  console.error('Health check script error:', error);
  process.exit(1);
});
