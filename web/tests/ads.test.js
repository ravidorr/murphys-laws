import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupAdSense, triggerAdSense, resetAdSenseForTesting, hasMinimumContent } from '../src/utils/ads.js';

describe('AdSense Integration', () => {
  beforeEach(() => {
    // Clear head before each test
    document.head.innerHTML = '';
    resetAdSenseForTesting();
    // Mock console.warn to keep output clean
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.adsbygoogle;
  });

  it('should inject the AdSense script into the head when triggered', () => {
    setupAdSense();
    triggerAdSense();

    // Run timers to bypass requestIdleCallback/setTimeout
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeTruthy();
    expect(script.src).toContain('client=ca-pub-3615614508734124');
    expect(script.async).toBe(true);
    expect(script.crossOrigin).toBe('anonymous');
  });

  it('should not inject the script if triggered but not set up', () => {
    // Don't call setupAdSense();
    triggerAdSense();
    vi.runAllTimers();

    expect(document.head.querySelectorAll('script').length).toBe(0);
  });

  it('should not inject the script if set up but not triggered', () => {
    setupAdSense();
    // Don't call triggerAdSense();
    vi.runAllTimers();

    expect(document.head.querySelectorAll('script').length).toBe(0);
  });

  it('should not inject the script if it already exists', () => {
    setupAdSense();
    triggerAdSense();
    vi.runAllTimers();
    
    expect(document.head.querySelectorAll('script').length).toBe(1);

    // Trigger again
    triggerAdSense();
    vi.runAllTimers();
    expect(document.head.querySelectorAll('script').length).toBe(1);
  });

  it('should not inject if window.adsbygoogle is already defined', () => {
    window.adsbygoogle = {};
    setupAdSense();
    triggerAdSense();
    vi.runAllTimers();

    expect(document.head.querySelectorAll('script').length).toBe(0);
  });

  it('handles script load error gracefully', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    
    setupAdSense();
    triggerAdSense();
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeTruthy();

    // Simulate script load error
    script.dispatchEvent(new Event('error'));

    expect(consoleWarnSpy).toHaveBeenCalledWith('AdSense failed to load');
  });

  it('uses requestIdleCallback when available', () => {
    const originalRequestIdleCallback = window.requestIdleCallback;
    const mockIdleCallback = vi.fn((callback) => {
      callback();
      return 1;
    });
    window.requestIdleCallback = mockIdleCallback;

    setupAdSense();
    triggerAdSense();

    expect(mockIdleCallback).toHaveBeenCalled();

    // Restore
    window.requestIdleCallback = originalRequestIdleCallback;
  });

  it('uses setTimeout fallback when requestIdleCallback is not available', () => {
    const originalRequestIdleCallback = window.requestIdleCallback;
    delete window.requestIdleCallback;

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    setupAdSense();
    triggerAdSense();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);

    // Restore
    if (originalRequestIdleCallback) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
  });
});

describe('hasMinimumContent', () => {
  it('returns true when element has sufficient content (500+ characters)', () => {
    const el = document.createElement('div');
    // 560 characters (500+ required)
    el.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

    expect(hasMinimumContent(el)).toBe(true);
  });

  it('returns false when element has insufficient content (< 500 characters)', () => {
    const el = document.createElement('div');
    el.textContent = 'Short content';

    expect(hasMinimumContent(el)).toBe(false);
  });

  it('returns false when element is null or undefined', () => {
    expect(hasMinimumContent(null)).toBe(false);
    expect(hasMinimumContent(undefined)).toBe(false);
  });

  it('returns false when element is empty', () => {
    const el = document.createElement('div');
    expect(hasMinimumContent(el)).toBe(false);
  });

  it('trims excessive whitespace before counting characters', () => {
    const el = document.createElement('div');
    // Multiple spaces should be counted as one
    el.textContent = 'Word   '.repeat(200); // Would be 1200 chars, but spaces collapsed

    // After trimming and collapsing whitespace, this should be ~800 characters
    expect(hasMinimumContent(el)).toBe(true);
  });

  it('respects custom minimum character count', () => {
    const el = document.createElement('div');
    el.textContent = 'This is exactly 100 characters long. '.repeat(3); // ~114 chars

    expect(hasMinimumContent(el, 100)).toBe(true);
    expect(hasMinimumContent(el, 500)).toBe(false);
  });

  it('counts only text content, ignoring HTML tags', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>Text</p><div><span>More text</span></div>'.repeat(50);

    // Should count only "Text" and "More text" repeated, not the HTML tags
    const textLength = el.textContent.replace(/\s+/g, ' ').trim().length;
    expect(hasMinimumContent(el)).toBe(textLength >= 500);
  });
});

describe('triggerAdSense with content validation', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    resetAdSenseForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.adsbygoogle;
  });

  it('triggers AdSense when no element is provided (backward compatibility)', () => {
    setupAdSense();
    triggerAdSense(); // No element argument
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeTruthy();
  });

  it('triggers AdSense when element has sufficient content', () => {
    const el = document.createElement('div');
    el.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

    setupAdSense();
    triggerAdSense(el);
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeTruthy();
  });

  it('does not trigger AdSense when element has insufficient content', () => {
    const el = document.createElement('div');
    el.textContent = 'Not enough content';

    setupAdSense();
    triggerAdSense(el);
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeFalsy();
  });

  it('does not trigger AdSense when element is empty', () => {
    const el = document.createElement('div');

    setupAdSense();
    triggerAdSense(el);
    vi.runAllTimers();

    const script = document.head.querySelector('script[src*="adsbygoogle"]');
    expect(script).toBeFalsy();
  });
});
