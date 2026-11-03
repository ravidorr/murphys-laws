import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPushService, buildPushPayload } from '../../src/services/daily-push.service.ts';

describe('buildPushPayload', () => {
  it('uses the law title, a cut body and a link to the law', () => {
    const payload = JSON.parse(buildPushPayload({ id: 7, title: 'Sod\'s Law', text: 'word '.repeat(60) }));
    expect(payload.title).toBe('Sod\'s Law');
    expect(payload.body.length).toBeLessThanOrEqual(141);
    expect(payload.url).toBe('https://murphys-laws.com/law/7');
  });

  it('falls back to a plain title when the law has none', () => {
    expect(JSON.parse(buildPushPayload({ id: 1, text: 'x' })).title).toBe('Murphy\'s Law of the Day');
    expect(JSON.parse(buildPushPayload({ id: 1, title: '   ', text: 'x' })).title).toBe('Murphy\'s Law of the Day');
    expect(JSON.parse(buildPushPayload({ id: 1, title: null, text: 'x' })).title).toBe('Murphy\'s Law of the Day');
  });
});

describe('DailyPushService', () => {
  const law = { id: 9, title: 'T', text: 'Law text' };
  const rows = [
    { id: 1, endpoint: 'https://fcm.googleapis.com/a', p256dh: 'p1', auth: 'a1' },
    { id: 2, endpoint: 'https://fcm.googleapis.com/b', p256dh: 'p2', auth: 'a2' },
    { id: 3, endpoint: 'https://fcm.googleapis.com/c', p256dh: 'p3', auth: 'a3' },
  ];
  const subscriptions = { listDue: vi.fn(), markSent: vi.fn(), removeById: vi.fn() };
  const laws = { getLawOfTheDay: vi.fn() };
  const sender = { sendNotification: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    laws.getLawOfTheDay.mockResolvedValue({ law, featured_date: '2026-11-02' });
    subscriptions.listDue.mockReturnValue(rows);
    sender.sendNotification.mockResolvedValue({});
  });

  it('does nothing without a sender (push not configured)', async () => {
    const service = new DailyPushService(subscriptions as never, laws, null);
    expect(await service.sendToSubscribers()).toEqual({ sent: 0, failed: 0, removed: 0, skipped: 'push_not_configured' });
    expect(laws.getLawOfTheDay).not.toHaveBeenCalled();
  });

  it('does nothing when there is no law of the day', async () => {
    laws.getLawOfTheDay.mockResolvedValue(null);
    const service = new DailyPushService(subscriptions as never, laws, sender);
    expect(await service.sendToSubscribers()).toEqual({ sent: 0, failed: 0, removed: 0, skipped: 'no_law' });
  });

  it('sends the payload to every due subscription and records each send', async () => {
    const service = new DailyPushService(subscriptions as never, laws, sender);
    expect(await service.sendToSubscribers()).toEqual({ sent: 3, failed: 0, removed: 0 });
    expect(subscriptions.listDue).toHaveBeenCalledWith('2026-11-02');
    expect(sender.sendNotification).toHaveBeenCalledWith(
      { endpoint: rows[0].endpoint, keys: { p256dh: 'p1', auth: 'a1' } },
      buildPushPayload(law),
      { TTL: 43200, urgency: 'low' },
    );
    expect(subscriptions.markSent).toHaveBeenCalledTimes(3);
  });

  it('deletes subscriptions the push service reports gone, counts other failures and keeps going', async () => {
    sender.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { statusCode: 503 }));
    const service = new DailyPushService(subscriptions as never, laws, sender);
    expect(await service.sendToSubscribers()).toEqual({ sent: 0, failed: 1, removed: 2 });
    expect(subscriptions.removeById).toHaveBeenCalledWith(1);
    expect(subscriptions.removeById).toHaveBeenCalledWith(2);
    expect(subscriptions.markSent).not.toHaveBeenCalled();
  });

  it('counts a failure that carries no status code', async () => {
    sender.sendNotification.mockRejectedValue(undefined);
    const service = new DailyPushService(subscriptions as never, laws, sender);
    expect(await service.sendToSubscribers()).toEqual({ sent: 0, failed: 3, removed: 0 });
  });
});
