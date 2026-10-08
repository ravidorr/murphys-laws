import { describe, expect, it, vi } from 'vitest';
import { waitForHealthyEndpoint } from '../../scripts/wait-for-health-check.ts';

describe('waitForHealthyEndpoint', () => {
  it('retries a non-success response before accepting a healthy endpoint', async () => {
    const localThis = {
      fetchFn: vi.fn()
        .mockResolvedValueOnce(new Response('Starting', { status: 503 }))
        .mockResolvedValueOnce(new Response('Ready', { status: 200 })),
      sleep: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    };

    await waitForHealthyEndpoint({
      name: 'Law of the day',
      url: 'http://127.0.0.1:8787/api/v1/law-of-day',
      attempts: 2,
      delayMs: 0,
      fetchFn: localThis.fetchFn,
      sleep: localThis.sleep,
      log: localThis.log,
    });

    expect(localThis.fetchFn).toHaveBeenCalledTimes(2);
    expect(localThis.sleep).toHaveBeenCalledWith(0);
    expect(localThis.log).toHaveBeenCalledWith('Law of the day is healthy on attempt 2.');
  });

  it('includes the final HTTP status and response body when an endpoint remains unhealthy', async () => {
    const localThis = {
      fetchFn: vi.fn().mockResolvedValue(new Response('Database warming up', { status: 503 })),
      sleep: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    };

    await expect(waitForHealthyEndpoint({
      name: 'Law of the day',
      url: 'http://127.0.0.1:8787/api/v1/law-of-day',
      attempts: 1,
      delayMs: 0,
      fetchFn: localThis.fetchFn,
      sleep: localThis.sleep,
      log: localThis.log,
    })).rejects.toThrow('Law of the day did not become healthy after 1 attempt. Last response: HTTP 503: Database warming up');
  });
});
