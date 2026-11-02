import type { LawRow } from './laws.service.ts';
import type { PushSubscriptionService } from './push-subscriptions.service.ts';
import { SITE_URL } from '../utils/constants.ts';
import { cutAtWord } from '../../../shared/modules/law-seo.ts';

interface LawOfTheDaySource {
  getLawOfTheDay(): Promise<{ law: LawRow; featured_date: string } | null>;
}

/** The part of the web-push module this service uses, so tests can stand in for it. */
export interface WebPushSender {
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; urgency: 'low' | 'normal' | 'high' | 'very-low' },
  ): Promise<unknown>;
}

export interface DailyPushResult {
  sent: number;
  failed: number;
  removed: number;
  skipped?: 'push_not_configured' | 'no_law';
}

/** Notification text shown by the service worker. */
export function buildPushPayload(law: LawRow): string {
  const title = typeof law.title === 'string' && law.title.trim() ? law.title.trim() : 'Murphy\'s Law of the Day';
  return JSON.stringify({
    title: cutAtWord(title, 80),
    body: cutAtWord(law.text, 140),
    url: `${SITE_URL}/law/${law.id}`,
  });
}

/** Sends today's Law of the Day as a push notification to every subscription that has not had it yet. */
export class DailyPushService {
  private subscriptions: PushSubscriptionService;
  private laws: LawOfTheDaySource;
  private sender: WebPushSender | null;

  /** `sender` is null when VAPID keys are not configured. */
  constructor(subscriptions: PushSubscriptionService, laws: LawOfTheDaySource, sender: WebPushSender | null) {
    this.subscriptions = subscriptions;
    this.laws = laws;
    this.sender = sender;
  }

  async sendToSubscribers(): Promise<DailyPushResult> {
    if (!this.sender) {
      return { sent: 0, failed: 0, removed: 0, skipped: 'push_not_configured' };
    }
    const featured = await this.laws.getLawOfTheDay();
    if (!featured) {
      return { sent: 0, failed: 0, removed: 0, skipped: 'no_law' };
    }

    const payload = buildPushPayload(featured.law);
    let sent = 0;
    let failed = 0;
    let removed = 0;
    for (const row of this.subscriptions.listDue(featured.featured_date)) {
      try {
        await this.sender.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 12 * 60 * 60, urgency: 'low' },
        );
        this.subscriptions.markSent(row.id, featured.featured_date);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          this.subscriptions.removeById(row.id);
          removed += 1;
        } else {
          failed += 1;
        }
      }
    }
    return { sent, failed, removed };
  }
}
