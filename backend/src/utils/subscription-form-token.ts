import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A token is refused when it is younger than this: a person cannot type an address and press Subscribe that fast. */
export const FORM_TOKEN_MIN_AGE_MS = 3000;
/** A token is refused when it is older than this; the page fetches a new one and tries once more. */
export const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type FormTokenCheck = 'ok' | 'malformed' | 'forged' | 'too_fast' | 'expired' | 'reused';

const TOKEN_PATTERN = /^(\d{1,15})\.([a-f0-9]{16})\.([a-f0-9]{64})$/;

/**
 * Issues and checks the one-time tokens the home page signup form must send with its email address.
 *
 * A token is `issuedAtMs.nonce.hmac`, signed with a secret, so nothing is stored when it is issued. It works
 * once (it is used up when verified, even if the signup then fails, and the nonce is remembered until it would have expired) and only after FORM_TOKEN_MIN_AGE_MS. A bot that
 * posts addresses straight to the API has to fetch a token, wait, and fetch another for every address, which
 * stops the cheap mass submissions that mail strangers a confirmation. It is not a CAPTCHA: a bot written
 * for this site can still do it, which is why the per-address limit in SubscriptionService exists too.
 *
 * The secret defaults to a random one per process, so a restart invalidates tokens already handed out; the
 * form then fetches a new one. Setting SUBSCRIPTION_FORM_SECRET keeps them valid across restarts. The
 * remembered nonces live in memory too, which is right for the single PM2 instance this runs as (`instances: 1` in backend/ecosystem.config.cjs); cluster mode would need a shared store.
 */
export class FormTokenService {
  private secret: Buffer;
  private used = new Map<string, number>();

  constructor(secret?: string) {
    this.secret = secret ? Buffer.from(secret) : randomBytes(32);
  }

  issue(now: number = Date.now()): string {
    const payload = `${now}.${randomBytes(8).toString('hex')}`;
    return `${payload}.${this.sign(payload)}`;
  }

  /** Checks a token and, when it is good, uses it up. */
  verify(token: unknown, now: number = Date.now()): FormTokenCheck {
    const match = typeof token === 'string' ? TOKEN_PATTERN.exec(token) : null;
    if (!match) {
      return 'malformed';
    }
    const [, issuedAt, nonce, signature] = match;
    const expected = this.sign(`${issuedAt}.${nonce}`);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return 'forged';
    }

    const age = now - Number(issuedAt);
    if (age < FORM_TOKEN_MIN_AGE_MS) {
      return 'too_fast';
    }
    if (age > FORM_TOKEN_MAX_AGE_MS) {
      return 'expired';
    }

    this.forgetExpired(now);
    if (this.used.has(nonce)) {
      return 'reused';
    }
    this.used.set(nonce, Number(issuedAt) + FORM_TOKEN_MAX_AGE_MS);
    return 'ok';
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  private forgetExpired(now: number): void {
    for (const [nonce, expiresAt] of this.used) {
      if (expiresAt < now) {
        this.used.delete(nonce);
      }
    }
  }
}
