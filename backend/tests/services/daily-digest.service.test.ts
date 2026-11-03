import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyDigestService } from '../../src/services/daily-digest.service.ts';

describe('DailyDigestService', () => {
  const law = { id: 9, title: 'T', text: 'Law text' };
  const subscribers = [
    { id: 1, email: 'a@example.com', token: 'a'.repeat(48) },
    { id: 2, email: 'b@example.com', token: 'b'.repeat(48) },
  ];
  const subscriptions = { listDue: vi.fn(), markSent: vi.fn() };
  const laws = { getLawOfTheDay: vi.fn() };
  const emailService = { isConfigured: vi.fn(), sendDailyLawEmail: vi.fn() };
  let digest: DailyDigestService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService.isConfigured.mockReturnValue(true);
    laws.getLawOfTheDay.mockResolvedValue({ law, featured_date: '2026-11-02' });
    subscriptions.listDue.mockReturnValue(subscribers);
    emailService.sendDailyLawEmail.mockResolvedValue(true);
    digest = new DailyDigestService(subscriptions as never, laws, emailService as never);
  });

  it('does nothing when email is not configured', async () => {
    emailService.isConfigured.mockReturnValue(false);
    expect(await digest.sendToSubscribers()).toEqual({ sent: 0, failed: 0, skipped: 'email_not_configured' });
    expect(laws.getLawOfTheDay).not.toHaveBeenCalled();
  });

  it('does nothing when there is no law of the day', async () => {
    laws.getLawOfTheDay.mockResolvedValue(null);
    expect(await digest.sendToSubscribers()).toEqual({ sent: 0, failed: 0, skipped: 'no_law' });
    expect(subscriptions.listDue).not.toHaveBeenCalled();
  });

  it('sends to every due subscriber with their own unsubscribe link and records each send', async () => {
    expect(await digest.sendToSubscribers()).toEqual({ sent: 2, failed: 0 });
    expect(subscriptions.listDue).toHaveBeenCalledWith('2026-11-02');
    expect(emailService.sendDailyLawEmail).toHaveBeenCalledWith('a@example.com', law, `https://murphys-laws.com/subscription/unsubscribe?token=${'a'.repeat(48)}`);
    expect(subscriptions.markSent).toHaveBeenCalledWith(1, '2026-11-02');
    expect(subscriptions.markSent).toHaveBeenCalledWith(2, '2026-11-02');
  });

  it('counts a failed send and leaves that subscriber unrecorded so a re-run retries it', async () => {
    emailService.sendDailyLawEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await digest.sendToSubscribers()).toEqual({ sent: 1, failed: 1 });
    expect(subscriptions.markSent).toHaveBeenCalledTimes(1);
    expect(subscriptions.markSent).toHaveBeenCalledWith(2, '2026-11-02');
  });
});
