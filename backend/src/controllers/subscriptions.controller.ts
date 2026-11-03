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

type PageTone = 'neutral' | 'success' | 'error';

const STATUS_MARKS: Record<Exclude<PageTone, 'neutral'>, string> = { success: '&#10003;', error: '!' };

const FOOTER_LINKS: ReadonlyArray<[string, string]> = [
  ['/about', 'About'],
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
  ['/contact', 'Contact'],
];

interface PageOptions {
  tone?: PageTone;
  /** Form markup shown under the message; its button is the only way to act without JavaScript. */
  form?: string;
}

/**
 * The page a mail link lands on. The backend renders it, so it links the token file and
 * /styles/subscription-pages.css from the web build instead of using the app bundle. It works with no
 * JavaScript: the confirm and unsubscribe buttons are plain form posts.
 */
function messagePage(heading: string, message: string, { tone = 'neutral', form = '' }: PageOptions = {}): string {
  const statusBadge = tone === 'neutral' ? '' : `<span class="subscription-page__status subscription-page__status--${tone}" aria-hidden="true">${STATUS_MARKS[tone]}</span>\n`;
  const footerLinks = FOOTER_LINKS.map(([path, label]) => `<li><a href="${SITE_URL}${path}">${label}</a></li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${heading} | Murphy's Law Archive</title>
<link rel="stylesheet" href="/styles/partials/variables.css">
<link rel="stylesheet" href="/styles/subscription-pages.css">
</head>
<body class="subscription-page">
<header class="subscription-page__header">
<div class="subscription-page__header-inner">
<a class="subscription-page__brand" href="${SITE_URL}/" aria-label="Murphy's Law Archive Home">
<span class="subscription-page__badge" aria-hidden="true">M</span>
<span class="subscription-page__brand-text">
<span class="subscription-page__brand-name"><span class="subscription-page__accent">Murphy's</span> Law</span>
<span class="subscription-page__tagline">If it can go wrong, it will.</span>
</span>
</a>
</div>
</header>
<main class="subscription-page__main">
<section class="subscription-page__card">
${statusBadge}<h1 class="subscription-page__title">${heading}</h1>
<p class="subscription-page__message">${message}</p>
${form}<a class="subscription-page__home" href="${SITE_URL}/">Back to Murphy's Law Archive</a>
</section>
</main>
<footer class="subscription-page__footer">
<nav aria-label="Utility">
<ul class="subscription-page__footer-nav">${footerLinks}</ul>
</nav>
</footer>
</body>
</html>`;
}

function actionForm(action: string, token: string, label: string): string {
  return `<form class="subscription-page__form" method="post" action="/subscription/${action}?token=${token}"><button class="subscription-page__button" type="submit">${label}</button></form>\n`;
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
      this.sendPage(res, 404, messagePage('Link not recognized', 'This confirmation link is not valid. Subscribe again from the home page to get a new one.', { tone: 'error' }));
      return;
    }
    this.sendPage(res, 200, messagePage('Confirm your subscription', 'Press the button to start the daily Murphy\'s Law email.', { form: actionForm('confirm', token, 'Confirm subscription') }));
  }

  /** POST /subscription/confirm?token=... */
  confirm(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (token && this.subscriptions.confirm(token)) {
      this.sendPage(res, 200, messagePage('You are subscribed', 'The Law of the Day will arrive in your inbox every morning. Every email has an unsubscribe link.', { tone: 'success' }));
      return;
    }
    this.sendPage(res, 404, messagePage('Link not recognized', 'This confirmation link is not valid. Subscribe again from the home page to get a new one.', { tone: 'error' }));
  }

  /** GET /subscription/unsubscribe?token=... only shows a button; scanners and previews must not unsubscribe anyone. */
  unsubscribeForm(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (!token) {
      this.sendPage(res, 404, messagePage('Link not recognized', 'This unsubscribe link is not valid.', { tone: 'error' }));
      return;
    }
    this.sendPage(res, 200, messagePage('Unsubscribe', 'Press the button to stop the daily Murphy\'s Law email.', { form: actionForm('unsubscribe', token, 'Unsubscribe') }));
  }

  /** POST /subscription/unsubscribe?token=... (the button above, and the one-click request mail clients send). */
  unsubscribe(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): void {
    const token = readToken(parsed);
    if (token && this.subscriptions.unsubscribe(token)) {
      this.sendPage(res, 200, messagePage('You are unsubscribed', 'The daily email has stopped. You can subscribe again from the home page.', { tone: 'success' }));
      return;
    }
    this.sendPage(res, 404, messagePage('Link not recognized', 'This unsubscribe link is not valid.', { tone: 'error' }));
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
