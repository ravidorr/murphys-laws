// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from '../src/utils/debounce.ts';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 100);

    localThis.debounced();
    expect(localThis.func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });

  it('should use default delay of 240ms when not specified', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func);

    localThis.debounced();
    expect(localThis.func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(239);
    expect(localThis.func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls when called again before delay', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 100);

    localThis.debounced();
    vi.advanceTimersByTime(50);
    localThis.debounced(); // Call again before delay completes
    vi.advanceTimersByTime(50);

    // Function should not have been called yet (only 50ms passed since last call)
    expect(localThis.func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    // Now it should be called (100ms since last call)
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to debounced function', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 100);

    localThis.debounced('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(localThis.func).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should preserve function context (this)', () => {
    const localThis: Record<string, any> = {};
    localThis.value = 'test';
    localThis.func = function() {
      return this.value;
    };
    localThis.debounced = debounce(localThis.func, 100);

    const promise = new Promise((resolve) => {
      const result = localThis.debounced();
      if (result) resolve(result);
      setTimeout(() => resolve(localThis.func.call(localThis)), 100);
    });

    vi.advanceTimersByTime(100);

    return promise.then((result) => {
      expect(result).toBe('test');
    });
  });

  it('should handle multiple rapid calls correctly', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 100);

    // Call 5 times rapidly
    localThis.debounced();
    vi.advanceTimersByTime(20);
    localThis.debounced();
    vi.advanceTimersByTime(20);
    localThis.debounced();
    vi.advanceTimersByTime(20);
    localThis.debounced();
    vi.advanceTimersByTime(20);
    localThis.debounced();

    // Function should not have been called yet
    expect(localThis.func).not.toHaveBeenCalled();

    // Wait for delay after last call
    vi.advanceTimersByTime(100);
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });

  it('should handle custom delay values', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 500);

    localThis.debounced();
    vi.advanceTimersByTime(499);
    expect(localThis.func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });

  it('should handle zero delay', () => {
    const localThis: Record<string, any> = {};
    localThis.func = vi.fn();
    localThis.debounced = debounce(localThis.func, 0);

    localThis.debounced();
    vi.advanceTimersByTime(0);
    expect(localThis.func).toHaveBeenCalledTimes(1);
  });
});
