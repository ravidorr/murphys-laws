import type { EmailService } from './email.service.ts';
import type { LawRow } from './laws.service.ts';
import type { SubscriptionService } from './subscriptions.service.ts';
import { unsubscribeUrl } from '../utils/subscription-links.ts';

interface LawOfTheDaySource {
  getLawOfTheDay(): Promise<{ law: LawRow; featured_date: string } | null>;
}

export interface DailyDigestResult {
  sent: number;
  failed: number;
  skipped?: 'email_not_configured' | 'no_law';
}

/** Mails today's Law of the Day to every confirmed subscriber who has not had it yet. */
export class DailyDigestService {
  private subscriptions: SubscriptionService;
  private laws: LawOfTheDaySource;
  private emailService: EmailService;

  constructor(subscriptions: SubscriptionService, laws: LawOfTheDaySource, emailService: EmailService) {
    this.subscriptions = subscriptions;
    this.laws = laws;
    this.emailService = emailService;
  }

  /**
   * Safe to run more than once a day: each send is recorded per address, so a re-run (or a run that
   * stopped half way) only mails the subscribers still waiting.
   */
  async sendToSubscribers(): Promise<DailyDigestResult> {
    if (!this.emailService.isConfigured()) {
      return { sent: 0, failed: 0, skipped: 'email_not_configured' };
    }

    const featured = await this.laws.getLawOfTheDay();
    if (!featured) {
      return { sent: 0, failed: 0, skipped: 'no_law' };
    }

    let sent = 0;
    let failed = 0;
    for (const subscriber of this.subscriptions.listDue(featured.featured_date)) {
      const ok = await this.emailService.sendDailyLawEmail(subscriber.email, featured.law, unsubscribeUrl(subscriber.token));
      if (ok) {
        this.subscriptions.markSent(subscriber.id, featured.featured_date);
        sent += 1;
      } else {
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
