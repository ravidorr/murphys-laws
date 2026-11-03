import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import { isAllowedPushEndpoint, parsePushSubscription, type PushSubscriptionService } from '../services/push-subscriptions.service.ts';
import {
  PayloadTooLargeError,
  badRequest,
  getVoterIdentifier,
  rateLimitExceeded,
  readBody,
  sendJson,
} from '../utils/http-helpers.ts';

const MAX_BODY_BYTES = 4096;

export class PushController {
  private subscriptions: PushSubscriptionService;
  private publicKey: string | undefined;

  /** `publicKey` is the VAPID public key; without it push is off and every endpoint answers 503. */
  constructor(subscriptions: PushSubscriptionService, publicKey: string | undefined) {
    this.subscriptions = subscriptions;
    this.publicKey = publicKey;
  }

  /** GET /api/v1/push/public-key */
  getPublicKey(req: IncomingMessage, res: ServerResponse): void {
    if (!this.publicKey) {
      return sendJson(res, 503, { error: 'Push notifications are not available right now' }, req);
    }
    return sendJson(res, 200, { publicKey: this.publicKey }, req, null, { 'Cache-Control': 'public, max-age=3600' });
  }

  /** POST /api/v1/push/subscriptions with a PushSubscription (endpoint and keys). */
  async subscribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rateLimit = checkRateLimit(getVoterIdentifier(req), 'subscribe');
    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit, req);
    }
    const body = await this.readJson(req, res);
    if (body === undefined) {
      return;
    }
    if (!this.publicKey) {
      return sendJson(res, 503, { error: 'Push notifications are not available right now' }, req, rateLimit);
    }
    const subscription = parsePushSubscription(body);
    if (!subscription) {
      return badRequest(res, 'A valid push subscription is required', req);
    }
    this.subscriptions.add(subscription);
    return sendJson(res, 201, { status: 'subscribed' }, req, rateLimit);
  }

  /** DELETE /api/v1/push/subscriptions with { endpoint }. */
  async unsubscribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rateLimit = checkRateLimit(getVoterIdentifier(req), 'subscribe');
    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit, req);
    }
    const body = await this.readJson(req, res);
    if (body === undefined) {
      return;
    }
    const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
    if (!isAllowedPushEndpoint(endpoint)) {
      return badRequest(res, 'A valid push endpoint is required', req);
    }
    this.subscriptions.remove(endpoint);
    return sendJson(res, 200, { status: 'unsubscribed' }, req, rateLimit);
  }

  /** The parsed JSON body, or undefined after answering 400. */
  private async readJson(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
    try {
      return await readBody(req, MAX_BODY_BYTES);
    } catch (error) {
      badRequest(res, error instanceof PayloadTooLargeError ? 'Request body too large' : 'Invalid JSON body', req);
      return undefined;
    }
  }
}
