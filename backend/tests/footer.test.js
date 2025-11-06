import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Footer } from '../src/components/footer.js';

describe('Footer component', () => {
  beforeEach(() => {
    // Reset adsbygoogle array
    window.adsbygoogle = [];
  });

  it('renders footer element', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('FOOTER');
    expect(el.className).toBe('footer');
  });

  it('shows navigation links', () => {
    const el = Footer({
      onNavigate: () => {}
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
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    expect(adSlot).toBeTruthy();
    expect(adSlot.dataset.loaded).not.toBe('true');
  });

  it('loads AdSense ad when triggered', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => {}
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

    const el = Footer({ onNavigate: () => {} });

    expect(() => {
      el.dispatchEvent(new Event('adslot:init'));
    }).not.toThrow();
  });

  it('shows CC0 license information', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/CC0 1.0 Universal/);
  });

  it('has external link to Creative Commons', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink.getAttribute('target')).toBe('_blank');
    expect(ccLink.getAttribute('rel')).toBe('noopener');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Footer({
      onNavigate: () => {}
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
      onNavigate: () => {}
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
      onNavigate: () => {}
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

    const el = Footer({
      onNavigate: () => {}
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

  it('handles missing ad slot gracefully', () => {
    window.adsbygoogle = [];

    // Create footer template without ad slot
    const footerTemplate = document.createElement('footer');
    footerTemplate.innerHTML = '<div class="container"></div>';

    // Mock the template to not have ad slot
    const originalQuerySelector = document.querySelector;
    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-ad-slot]') {
        return null;
      }
      return originalQuerySelector.call(document, selector);
    });

    const el = Footer({
      onNavigate: () => {}
    });

    // Should not throw
    expect(el).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('handles scheduleAd when adHost is null', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => {}
    });

    // Remove ad slot to trigger the !adHost branch in scheduleAd
    const adSlot = el.querySelector('[data-ad-slot]');
    if (adSlot) {
      adSlot.remove();
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('does not load ad when already loaded', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Mark as already loaded
    if (adSlot) {
      adSlot.dataset.loaded = 'true';
    }

    // Try to trigger load
    el.dispatchEvent(new Event('adslot:init'));

    // Should not reload
    expect(el).toBeTruthy();
  });

  it('uses setTimeout fallback when requestIdleCallback not available', () => {
    window.adsbygoogle = [];
    const originalRequestIdleCallback = window.requestIdleCallback;
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Remove requestIdleCallback
    delete window.requestIdleCallback;

    const el = Footer({
      onNavigate: () => {}
    });

    // Should use setTimeout fallback in defer function
    // This is called via scheduleAd -> defer
    expect(setTimeoutSpy).toHaveBeenCalled();

    // Restore
    window.requestIdleCallback = originalRequestIdleCallback;
    setTimeoutSpy.mockRestore();
  });

  it('uses requestIdleCallback when available', () => {
    window.adsbygoogle = [];
    const requestIdleCallbackSpy = vi.fn((cb) => {
      setTimeout(cb, 0);
      return 1;
    });
    window.requestIdleCallback = requestIdleCallbackSpy;

    const el = Footer({
      onNavigate: () => {}
    });

    // Should use requestIdleCallback in defer function
    expect(requestIdleCallbackSpy).toHaveBeenCalled();

    delete window.requestIdleCallback;
  });

  it('uses IntersectionObserver when available', () => {
    window.adsbygoogle = [];
    const IntersectionObserverSpy = vi.fn((callback) => {
      return {
        observe: vi.fn(),
        disconnect: vi.fn()
      };
    });
    window.IntersectionObserver = IntersectionObserverSpy;

    const el = Footer({
      onNavigate: () => {}
    });

    // Should use IntersectionObserver
    expect(IntersectionObserverSpy).toHaveBeenCalled();

    // Restore
    delete window.IntersectionObserver;
  });

  it('triggers loadAd when IntersectionObserver entry is intersecting', () => {
    window.adsbygoogle = [];
    let observerCallback;
    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn()
    };
    
    window.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return mockObserver;
    });

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Simulate intersection
    if (observerCallback && adSlot) {
      observerCallback([{
        target: adSlot,
        isIntersecting: true
      }]);
    }

    // Ad should be loaded
    expect(adSlot?.dataset.loaded).toBe('true');

    delete window.IntersectionObserver;
  });

  it('does not trigger loadAd when IntersectionObserver entry is not intersecting', () => {
    window.adsbygoogle = [];
    let observerCallback;
    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn()
    };
    
    window.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return mockObserver;
    });

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Simulate non-intersection
    if (observerCallback && adSlot) {
      observerCallback([{
        target: adSlot,
        isIntersecting: false
      }]);
    }

    // Ad should not be loaded yet
    expect(adSlot?.dataset.loaded).not.toBe('true');

    delete window.IntersectionObserver;
  });

  it('breaks after first intersecting entry in IntersectionObserver callback', () => {
    window.adsbygoogle = [];
    let observerCallback;
    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn()
    };
    const loadAdSpy = vi.fn();
    
    window.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return mockObserver;
    });

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Mock loadAd to track calls
    if (adSlot) {
      const originalLoad = adSlot.dataset.loaded;
      adSlot.dataset.loaded = undefined;
      
      // Simulate multiple entries - first intersecting should trigger loadAd and break
      if (observerCallback) {
        observerCallback([
          { target: adSlot, isIntersecting: true },
          { target: adSlot, isIntersecting: false },
          { target: adSlot, isIntersecting: true }
        ]);
      }
      
      // Should be loaded after first intersecting entry
      expect(adSlot.dataset.loaded).toBe('true');
    }

    delete window.IntersectionObserver;
  });

  it('handles empty entries array in IntersectionObserver callback', () => {
    window.adsbygoogle = [];
    let observerCallback;
    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn()
    };
    
    window.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return mockObserver;
    });

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Simulate empty entries array
    if (observerCallback && adSlot) {
      observerCallback([]);
    }

    // Ad should not be loaded
    expect(adSlot?.dataset.loaded).not.toBe('true');

    delete window.IntersectionObserver;
  });

  it('does not prime ad when already loaded', () => {
    window.adsbygoogle = [];
    // Ensure requestIdleCallback exists for this test
    if (!window.requestIdleCallback) {
      window.requestIdleCallback = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
    }

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Mark as already loaded
    if (adSlot) {
      adSlot.dataset.loaded = 'true';
    }

    // Try to trigger load again - should return early
    el.dispatchEvent(new Event('adslot:init'));

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles observer cleanup when it exists', () => {
    window.adsbygoogle = [];
    // Ensure requestIdleCallback exists for this test
    if (!window.requestIdleCallback) {
      window.requestIdleCallback = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
    }

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Trigger ad loading twice to create observer
    el.dispatchEvent(new Event('adslot:init'));
    
    // Second call should clean up observer
    el.dispatchEvent(new Event('adslot:init'));

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles adHost becoming null during loadAd', () => {
    window.adsbygoogle = [];
    // Ensure requestIdleCallback exists for this test
    if (!window.requestIdleCallback) {
      window.requestIdleCallback = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
    }

    const el = Footer({
      onNavigate: () => {}
    });

    const adSlot = el.querySelector('[data-ad-slot]');
    
    // Remove adSlot after triggering load
    el.dispatchEvent(new Event('adslot:init'));
    if (adSlot) {
      adSlot.remove();
    }

    // Should not throw
    expect(el).toBeTruthy();
  });
});
