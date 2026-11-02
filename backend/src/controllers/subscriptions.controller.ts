import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import type { EmailService } from '../services/email.service.ts';
import type { SubscriptionService } from '../services/subscriptions.service.ts';
import { SITE_URL } from '../utils/constants.ts';
import { confirmUrl } from '../utils/subscription-links.ts';
import {
  PayloadTooLargeError,
  badRequest,
  getVoterIdentifier,
  rateLimitExceeded,
  readBody,
  sendJson,
} from '../utils/http-helpers.ts';

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const MAX_BODY_BYTES = 2048;

interface ParsedQuery {
  query?: Record<string, string | string[] | undefined>;
}

function messagePage(heading: string, message: string, extra = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading} | Murphy's Law Archive</title>
</head>
<body>
<main>
<h1>${heading}</h1>
<p>${message}</p>
${extra}<p><a href="${SITE_URL}/">Back to Murphy's Law Archive</a></p>
</main>
</body>
</html>`;
}

function readToken(parsed: ParsedQuery): string | null {
  const value = parsed.query?.token;
  const token = Array.isArray(value) ? value[0] : value;
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export class SubscriptionController {
  private subscriptions: SubscriptionService;
  private emailService: EmailService;

  constructor(subscriptions: SubscriptionService, emailService: EmailService) {
    this.subscriptions = subscriptions;
    this.emailService = emailService;
  }

  /** POST /api/v1/subscriptions with { email }. Answers the same for new and known addresses. */
  async subscribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rateLimit = checkRateLimit(getVoterIdentifier(req), 'subscribe');
    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit, req);
    }

    let body: { email?: unknown };
    try {
      body = await readBody(req, MAX_BODY_BYTES);
    } catch (error) {
      return badRequest(res, error instanceof PayloadTooLargeError ? 'Request body too large' : 'Invalid JSON body', req);
    }

    if (!this.emailService.isConfigured()) {
      return sendJson(res, 503, { error: 'Email is not available right now' }, req, rateLimit);
    }

    const result = this.subscriptions.subscribe(body.email);
    if (result.status === 'invalid') {
      return badRequest(res, 'A valid email address is required', req);
    }

    if (result.status === 'confirmation_needed') {
      const sent = await this.emailService.sendSubscriptionConfirmationEmail(result.email, confirmUrl(result.token));
      if (!sent) {
        this.subscriptions.releaseCooldown(result.token);
        return sendJson(res, 502, { error: 'Could not send the confirmation email. Please try again later.' }, req, rateLimit);
      }
    }

    return sendJson(res, 202, { status: 'check_your_email' }, req, rateLimit);
  }

  /**
   * GET /subscription/confirm?token=... only shows a button. Confirming needs a POST, because mail
   * scanners fetch every link in a message and must not be able to opt an address in.
   */
  confirmForm(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (!token) {
      this.sendPage(res, 404, messagePage('Link not recognized', 'This confirmation link is not valid. Subscribe again from the home page to get a new one.'));
      return;
    }
    const form = `<form method="post" action="/subscription/confirm?token=${token}"><button type="submit">Confirm subscription</button></form>\n`;
    this.sendPage(res, 200, messagePage('Confirm your subscription', 'Press the button to start the daily Murphy\'s Law email.', form));
  }

  /** POST /subscription/confirm?token=... */
  confirm(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (token && this.subscriptions.confirm(token)) {
      this.sendPage(res, 200, messagePage('You are subscribed', 'The Law of the Day will arrive in your inbox every morning. Every email has an unsubscribe link.'));
      return;
    }
    this.sendPage(res, 404, messagePage('Link not recognized', 'This confirmation link is not valid. Subscribe again from the home page to get a new one.'));
  }

  /** GET or POST /subscription/unsubscribe?token=... (POST is the one-click request mail clients send). */
  unsubscribe(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (token && this.subscriptions.unsubscribe(token)) {
      this.sendPage(res, 200, messagePage('You are unsubscribed', 'The daily email has stopped. You can subscribe again from the home page.'));
      return;
    }
    this.sendPage(res, 404, messagePage('Link not recognized', 'This unsubscribe link is not valid.'));
  }

  private sendPage(res: ServerResponse, status: number, html: string): void {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    });
    res.end(html);
  }
}
