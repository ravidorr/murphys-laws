import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupAdSense, triggerAdSense, resetAdSenseForTesting } from '../src/utils/ads.js';

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
});
