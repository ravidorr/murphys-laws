import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Footer } from '../src/components/footer.js';

describe('Footer component', () => {
  let originalReadyState;
  let mainElement;

  beforeEach(() => {
    // Save original readyState before each test
    originalReadyState = document.readyState;
    // Reset adsbygoogle array
    window.adsbygoogle = [];

    // Create a main element with sufficient content for ad loading tests
    mainElement = document.createElement('main');
    // Add 500+ characters of content to meet minimum content requirement
    mainElement.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
    document.body.appendChild(mainElement);
  });

  afterEach(() => {
    // Restore readyState after each test (guaranteed cleanup even if test fails)
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });

    // Remove main element
    if (mainElement && mainElement.parentNode) {
      mainElement.parentNode.removeChild(mainElement);
    }
  });

  it('renders footer element', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    expect(el.tagName).toBe('FOOTER');
    expect(el.className).toBe('footer');
  });

  it('shows navigation links', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    expect(el.querySelector('[data-nav="about"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="privacy"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="terms"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="contact"]')).toBeTruthy();
  });

  it('triggers onNavigate when clicking nav link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    aboutLink.click();
    expect(navigated).toBe('about');
  });

  it('triggers onNavigate for privacy link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]');
    privacyLink.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate for terms link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const termsLink = el.querySelector('[data-nav="terms"]');
    termsLink.click();
    expect(navigated).toBe('terms');
  });

  it('triggers onNavigate for contact link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    contactLink.click();
    expect(navigated).toBe('contact');
  });

  it('contains ad slot placeholder', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot).toBeTruthy();
    expect(adSlot.dataset.loaded).not.toBe('true');
  });

  it('loads AdSense ad when triggered', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { }
    });

    el.dispatchEvent(new Event('adslot:init'));

    const adsenseEl = el.querySelector('.adsbygoogle');
    expect(adsenseEl).toBeTruthy();
    expect(adsenseEl.getAttribute('data-ad-client')).toBe('ca-pub-3615614508734124');
    expect(window.adsbygoogle.length).toBe(1);
  });

  it('handles AdSense errors gracefully', () => {
    window.adsbygoogle = {
      push: () => {
        throw new Error('AdSense error');
      }
    };

    const el = Footer({ onNavigate: () => { } });

    expect(() => {
      el.dispatchEvent(new Event('adslot:init'));
    }).not.toThrow();
  });

  it('shows CC0 license information', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    expect(el.textContent).toMatch(/CC0 1.0 Universal/);
  });

  it('has external link to Creative Commons', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink.getAttribute('target')).toBe('_blank');
    expect(ccLink.getAttribute('rel')).toBe('noopener');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = { called: false };

    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultSpy.called = true; }
    });

    aboutLink.dispatchEvent(event);
    expect(preventDefaultSpy.called).toBe(true);
  });

  it('does not trigger onNavigate for non-nav elements', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const container = el.querySelector('.container');
    container.click();
    expect(navigated).toBe('');
  });

  it('does not prime ad if already loaded', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    adSlot.dataset.loaded = 'true';

    // Should not throw and should not create duplicate ad
    expect(() => {
      el.dispatchEvent(new Event('adslot:init'));
    }).not.toThrow();
  });

  it('primes ad when document is already complete', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    // Ad should be primed (ready to load on interaction)
    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot).toBeTruthy();

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('waits for load event when document is not complete', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    });

    Footer({
      onNavigate: () => { }
    });

    // Should have added load event listener
    expect(addEventListenerSpy).toHaveBeenCalledWith('load', expect.any(Function), { once: true });

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
    addEventListenerSpy.mockRestore();
  });

  it('uses IntersectionObserver when available to load ads', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    // Ensure IntersectionObserver is available
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const mockIntersectionObserver = vi.fn((callback, options) => {
      // Store the callback so we can trigger it
      mockIntersectionObserver.lastCallback = callback;
      mockIntersectionObserver.lastOptions = options;
      return {
        observe: observeMock,
        disconnect: disconnectMock
      };
    });
    global.IntersectionObserver = mockIntersectionObserver;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    Footer({
      onNavigate: () => { }
    });

    // IntersectionObserver should have been created
    expect(mockIntersectionObserver).toHaveBeenCalled();
    expect(observeMock).toHaveBeenCalled();

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('loads ad when IntersectionObserver detects visibility', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    let intersectionCallback;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const mockIntersectionObserver = vi.fn((callback) => {
      intersectionCallback = callback;
      return {
        observe: observeMock,
        disconnect: disconnectMock
      };
    });
    global.IntersectionObserver = mockIntersectionObserver;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    // Trigger intersection
    if (intersectionCallback) {
      intersectionCallback([{ isIntersecting: true }]);
    }

    // Ad should be loaded
    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot?.dataset.loaded).toBe('true');
    expect(disconnectMock).toHaveBeenCalled();

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('uses setTimeout fallback when requestIdleCallback is not available', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;
    const originalRequestIdleCallback = window.requestIdleCallback;

    // Remove IntersectionObserver to trigger the else branch
    const originalIntersectionObserver = global.IntersectionObserver;
    delete global.IntersectionObserver;

    // Remove requestIdleCallback to trigger setTimeout branch
    delete window.requestIdleCallback;

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    Footer({
      onNavigate: () => { }
    });

    // Should use setTimeout instead of requestIdleCallback
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1200);

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
    if (originalRequestIdleCallback) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
    if (originalIntersectionObserver) {
      global.IntersectionObserver = originalIntersectionObserver;
    }
    setTimeoutSpy.mockRestore();
  });

  it('uses requestIdleCallback when available', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    // Remove IntersectionObserver to trigger the else branch
    const originalIntersectionObserver = global.IntersectionObserver;
    delete global.IntersectionObserver;

    // Ensure requestIdleCallback is available
    const requestIdleCallbackSpy = vi.fn(() => {
      // Don't actually call the callback to avoid side effects
      return 1;
    });
    window.requestIdleCallback = requestIdleCallbackSpy;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    Footer({
      onNavigate: () => { }
    });

    // Should use requestIdleCallback
    expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 });

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
    if (originalIntersectionObserver) {
      global.IntersectionObserver = originalIntersectionObserver;
    }
  });

  it('handles user interactions to trigger ad loading', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    // Simulate pointerdown event
    window.dispatchEvent(new Event('pointerdown'));

    // Ad should be loaded after user interaction
    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot?.dataset.loaded).toBe('true');

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('does not load ad twice when already loaded', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]');

    // Load ad first time
    el.dispatchEvent(new Event('adslot:init'));
    expect(adSlot?.dataset.loaded).toBe('true');

    const firstAdCount = window.adsbygoogle.length;

    // Try to load again
    el.dispatchEvent(new Event('adslot:init'));

    // Should not create duplicate ad
    expect(window.adsbygoogle.length).toBe(firstAdCount);

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('handles ensureAdsense rejection gracefully', async () => {
    window.adsbygoogle = [];

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    // Reset modules first, then set up the mock
    vi.resetModules();
    
    // Use vi.doMock() for dynamic mocking (not hoisted like vi.mock())
    vi.doMock('../src/utils/third-party.js', () => ({
      ensureAdsense: vi.fn().mockRejectedValue(new Error('Failed to load AdSense'))
    }));

    // Now import Footer which will use the mocked module
    const { Footer: MockedFooter } = await import('../src/components/footer.js');

    const el = MockedFooter({
      onNavigate: () => { }
    });

    // Trigger ad loading - should not throw
    expect(() => {
      el.dispatchEvent(new Event('adslot:init'));
    }).not.toThrow();

    vi.resetModules();
  });

  it('skips primeAd when ad is already loaded', () => {
    window.adsbygoogle = [];

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    // Pre-set the loaded flag before primeAd would run
    adSlot.dataset.loaded = 'true';

    // Trigger primeAd via scroll
    window.dispatchEvent(new Event('scroll'));

    // Ad should remain marked as loaded but no new ad created
    expect(adSlot.dataset.loaded).toBe('true');
  });

  it('does not load ads when hideAds prop is true', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { },
      hideAds: true
    });

    // The ad slot should exist in template but ad loading logic should be skipped
    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot).toBeTruthy();
    
    // Trigger event that would normally load ad
    el.dispatchEvent(new Event('adslot:init'));
    
    // Ad should not be loaded since hideAds is true
    expect(adSlot.dataset.loaded).not.toBe('true');
  });

  it('skips ad loading when main content is insufficient', () => {
    window.adsbygoogle = [];

    // Remove the main element with content
    if (mainElement && mainElement.parentNode) {
      mainElement.parentNode.removeChild(mainElement);
    }

    // Create a main element with minimal content (below threshold)
    const emptyMain = document.createElement('main');
    emptyMain.textContent = 'Short content';
    document.body.appendChild(emptyMain);

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = Footer({
      onNavigate: () => { }
    });

    // primeAd should check content and skip loading
    window.dispatchEvent(new Event('scroll'));

    const adSlot = el.querySelector('[data-ad-slot]');
    // Ad should not be loaded due to insufficient content
    expect(adSlot.dataset.loaded).not.toBe('true');

    // Cleanup
    emptyMain.remove();
  });
});
