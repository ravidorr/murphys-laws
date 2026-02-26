import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleServiceWorkerUpdateCheck } from '../src/utils/service-worker-update.js';

describe('scheduleServiceWorkerUpdateCheck', () => {
  const INTERVAL_MS = 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles registration.update() rejecting (e.g. InvalidStateError in Firefox)', async () => {
    const updateMock = vi.fn().mockRejectedValue(new DOMException('An attempt was made to use an object that is not, or is no longer, usable', 'InvalidStateError'));
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    scheduleServiceWorkerUpdateCheck(registration);
    vi.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();

    expect(updateMock).toHaveBeenCalledTimes(1);
    // Test passes without unhandled rejection because .catch() swallows the rejection
  });

  it('handles registration.update() throwing synchronously', () => {
    const updateMock = vi.fn().mockImplementation(() => {
      throw new Error('sync throw');
    });
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    scheduleServiceWorkerUpdateCheck(registration);
    vi.advanceTimersByTime(INTERVAL_MS);

    expect(updateMock).toHaveBeenCalledTimes(1);
    // No throw escaped; try-catch swallowed it
  });

  it('calls registration.update() periodically', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    scheduleServiceWorkerUpdateCheck(registration);

    expect(updateMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(updateMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
