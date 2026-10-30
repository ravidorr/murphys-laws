import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTimeoutSignal } from '../src/utils/timeout-signal.ts';

describe('createTimeoutSignal', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses AbortSignal.timeout when available', () => {
    const native = { aborted: false } as AbortSignal;
    const timeout = vi.fn(() => native);
    vi.stubGlobal('AbortSignal', { timeout });

    expect(createTimeoutSignal(500)).toBe(native);
    expect(timeout).toHaveBeenCalledWith(500);
  });

  it('falls back to AbortController and aborts with a TimeoutError', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AbortSignal', {});

    const signal = createTimeoutSignal(1000)!;
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });

  it('falls back to AbortController when AbortSignal is not defined', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AbortSignal', undefined);

    const signal = createTimeoutSignal(10)!;
    vi.advanceTimersByTime(10);
    expect(signal.aborted).toBe(true);
  });

  it('returns undefined when the browser has no AbortController', () => {
    vi.stubGlobal('AbortSignal', undefined);
    vi.stubGlobal('AbortController', undefined);

    expect(createTimeoutSignal(10)).toBeUndefined();
  });
});
