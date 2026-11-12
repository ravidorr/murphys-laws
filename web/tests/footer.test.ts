import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import rootPackage from '../../package.json';
import { Footer } from '../src/components/footer.js';

type IdleWindow = { requestIdleCallback?: typeof window.requestIdleCallback };

let idleQueue: Array<() => void> = [];
const mountedFooters: HTMLElement[] = [];

/** Runs everything queued with requestIdleCallback, as the browser would once idle. */
function flushIdle(): void {
  const queued = idleQueue;
  idleQueue = [];
  queued.forEach((callback) => callback());
}

/** Attaches a footer to the document, as the router does, so its idle ad load is not skipped as detached. */
function mount(el: HTMLElement): HTMLElement {
  document.body.appendChild(el);
  mountedFooters.push(el);
  return el;
}

interface FooterLocalThis {
  originalReadyState: string;
  mainElement: HTMLElement;
  navigated: string;
  el: ReturnType<typeof Footer> | null;
}

describe('Footer component', () => {
  const localThis: FooterLocalThis = {
    originalReadyState: '',
    mainElement: document.createElement('main'),
    navigated: '',
    el: null
  };
  let originalReadyState: string;
  let mainElement: HTMLElement;

  beforeEach(() => {
    idleQueue = [];
    (window as unknown as IdleWindow).requestIdleCallback = ((callback: IdleRequestCallback) => {
      idleQueue.push(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
      return idleQueue.length;
    }) as typeof window.requestIdleCallback;
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
    (window as unknown as IdleWindow).requestIdleCallback = undefined;
    mountedFooters.splice(0).forEach((footer) => footer.remove());
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

  it('labels the footer nav landmark distinctly from the other navigation landmarks', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Footer navigation');
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

    const aboutLink = el.querySelector('[data-nav="about"]') as HTMLElement | null;
    expect(aboutLink).toBeTruthy();
    aboutLink!.click();
    expect(navigated).toBe('about');
  });

  it('L132 B1: click on nav link with data-nav calls onNavigate', () => {
    let navigated = '';
    const el = Footer({ onNavigate: (target) => { navigated = target; } });
    const privacyLink = el.querySelector('[data-nav="privacy"]') as HTMLElement | null;
    privacyLink!.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate for privacy link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]') as HTMLElement | null;
    expect(privacyLink).toBeTruthy();
    privacyLink!.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate for terms link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const termsLink = el.querySelector('[data-nav="terms"]') as HTMLElement | null;
    expect(termsLink).toBeTruthy();
    termsLink!.click();
    expect(navigated).toBe('terms');
  });

  it('triggers onNavigate for contact link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]') as HTMLElement | null;
    expect(contactLink).toBeTruthy();
    contactLink!.click();
    expect(navigated).toBe('contact');
  });

  it('does not call onNavigate when clicking element without data-nav', () => {
    const onNavigateMock = vi.fn();
    const el = Footer({ onNavigate: onNavigateMock });

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    adSlot!.click();

    expect(onNavigateMock).not.toHaveBeenCalled();
  });

  it('L126 B0: does not call onNavigate when nav element has empty data-nav', () => {
    const onNavigateMock = vi.fn();
    const el = Footer({ onNavigate: onNavigateMock });
    const navBtn = el.querySelector('[data-nav="about"]') as HTMLElement;
    expect(navBtn).toBeTruthy();
    navBtn.setAttribute('data-nav', '');
    navBtn.click();
    expect(onNavigateMock).not.toHaveBeenCalled();
  });

  it('contains ad slot placeholder', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    expect(adSlot!.dataset.loaded).not.toBe('true');
  });

  it('loads AdSense ad when triggered', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { }
    });

    el.dispatchEvent(new Event('adslot:init'));

    const adsenseEl = el.querySelector('.adsbygoogle');
    expect(adsenseEl).toBeTruthy();
    expect(adsenseEl!.getAttribute('data-ad-client')).toBe('ca-pub-3615614508734124');
    expect(window.adsbygoogle.length).toBe(1);
  });

  it('L50 B1: loadAd uses empty array when adsbygoogle is falsy', () => {
    (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = undefined;
    const el = Footer({ onNavigate: () => {} });
    el.dispatchEvent(new Event('adslot:init'));
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect(window.adsbygoogle!.length).toBe(1);
  });

  it('does not load ad when main is missing', () => {
    if (mainElement.parentNode) mainElement.parentNode.removeChild(mainElement);
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const origIO = g.IntersectionObserver;
    g.IntersectionObserver = class MockIO {
      observe = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;

    const el = Footer({ onNavigate: () => {} });
    document.body.appendChild(el);

    const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]');
    expect(adSlot?.dataset.loaded).not.toBe('true');

    g.IntersectionObserver = origIO;
    document.body.appendChild(mainElement);
  });

  it('loads the ad after the idle timeout when requestIdleCallback is undefined', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const win = window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback };
    const origIO = g.IntersectionObserver;
    const origRIC = win.requestIdleCallback;
    g.IntersectionObserver = undefined;
    win.requestIdleCallback = undefined;
    vi.useFakeTimers();
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      vi.advanceTimersByTime(3000);
      const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]');
      expect(adSlot?.dataset.loaded).toBe('true');
    } finally {
      vi.useRealTimers();
      g.IntersectionObserver = origIO;
      if (origRIC !== undefined) win.requestIdleCallback = origRIC;
    }
  });

  it('schedules the ad with requestIdleCallback when IntersectionObserver is not available', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const win = window as unknown as { requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number };
    const origIO = g.IntersectionObserver;
    const origRIC = win.requestIdleCallback;
    const idleCallback = vi.fn((cb: IdleRequestCallback) => setTimeout(cb as () => void, 0) as unknown as number);
    win.requestIdleCallback = idleCallback;
    g.IntersectionObserver = undefined;
    vi.useFakeTimers();
    try {
      Footer({ onNavigate: () => {} });
      expect(idleCallback).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      g.IntersectionObserver = origIO;
      if (origRIC !== undefined) win.requestIdleCallback = origRIC;
    }
  });

  it('handles AdSense errors gracefully when push throws', () => {
    const throwingPush = vi.fn(() => {
      throw new Error('AdSense error');
    });
    window.adsbygoogle = { push: throwingPush } as unknown as typeof window.adsbygoogle;

    localThis.el = Footer({ onNavigate: () => { } });

    expect(() => {
      localThis.el!.dispatchEvent(new Event('adslot:init'));
    }).not.toThrow();
    expect(throwingPush).toHaveBeenCalled();
  });

  it('loads the ad after the idle timeout when requestIdleCallback is not available', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const win = window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback };
    const origIO = g.IntersectionObserver;
    const origRIC = win.requestIdleCallback;
    g.IntersectionObserver = undefined;
    win.requestIdleCallback = undefined;
    vi.useFakeTimers();
    try {
      localThis.el = mount(Footer({ onNavigate: () => {} }));
      vi.advanceTimersByTime(3000);
      const adSlot = localThis.el!.querySelector<HTMLElement>('[data-ad-slot]');
      expect(adSlot?.dataset.loaded).toBe('true');
    } finally {
      vi.useRealTimers();
      g.IntersectionObserver = origIO;
      if (origRIC !== undefined) win.requestIdleCallback = origRIC;
    }
  });

  it('schedules the ad on the idle timeout when IntersectionObserver is not available', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const origIO = g.IntersectionObserver;
    g.IntersectionObserver = undefined;
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    (window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback = undefined;
    try {
      Footer({ onNavigate: () => {} });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    } finally {
      g.IntersectionObserver = origIO;
      setTimeoutSpy.mockRestore();
    }
  });

  it('schedules the ad with setTimeout when requestIdleCallback is not available', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const origIO = g.IntersectionObserver;
    g.IntersectionObserver = undefined;
    const win = window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback };
    const origRIC = win.requestIdleCallback;
    win.requestIdleCallback = undefined;
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    try {
      Footer({ onNavigate: () => {} });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    } finally {
      g.IntersectionObserver = origIO;
      if (origRIC !== undefined) win.requestIdleCallback = origRIC;
      setTimeoutSpy.mockRestore();
    }
  });

  it('schedules the idle ad load even when IntersectionObserver is not available', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const origIO = g.IntersectionObserver;
    g.IntersectionObserver = undefined;
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]');
      expect(idleQueue).toHaveLength(1);
      expect(adSlot?.dataset.loaded).not.toBe('true');

      flushIdle();

      expect(adSlot?.dataset.loaded).toBe('true');
    } finally {
      g.IntersectionObserver = origIO;
    }
  });

  it('does not wait for a user interaction to schedule the ad', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;

      // The load is scheduled for idle instead of listening for the visitor
      expect(idleQueue).toHaveLength(1);
      const eventTypes = addEventListenerSpy.mock.calls.map((call) => call[0]);
      expect(eventTypes).not.toContain('pointerdown');
      expect(eventTypes).not.toContain('keydown');
      expect(eventTypes).not.toContain('scroll');

      // Events bubbling to document (or window) do not load the ad before idle
      document.body.dispatchEvent(new Event('keydown', { bubbles: true }));
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      document.body.dispatchEvent(new Event('scroll', { bubbles: true }));
      window.dispatchEvent(new Event('keydown'));
      expect(adSlot.dataset.loaded).not.toBe('true');
      expect(window.adsbygoogle).toHaveLength(0);

      flushIdle();
      expect(adSlot.dataset.loaded).toBe('true');
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it('skips the idle ad load when the footer was replaced before the browser went idle', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const el = mount(Footer({ onNavigate: () => {} }));
    el.remove();

    flushIdle();

    expect((el.querySelector('[data-ad-slot]') as HTMLElement).dataset.loaded).not.toBe('true');
    expect(window.adsbygoogle).toHaveLength(0);
  });

  it('leaves an already loaded ad visible when the page lost its content before the browser went idle', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const el = mount(Footer({ onNavigate: () => {} }));
    el.dispatchEvent(new Event('adslot:init'));
    mainElement.textContent = 'Too short';

    flushIdle();

    // The loaded guard returns before the content check, which would have hidden the slot
    const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;
    expect(adSlot.dataset.loaded).toBe('true');
    expect(adSlot.classList.contains('hidden')).toBe(false);
  });

  it('loads the ad through the observer and the idle callback together with one ad and one push', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const origIO = g.IntersectionObserver;
    let fire: IntersectionObserverCallback | undefined;
    g.IntersectionObserver = class StubObserver {
      constructor(callback: IntersectionObserverCallback) {
        fire = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      fire!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

      flushIdle();

      expect(el.querySelectorAll('ins.adsbygoogle')).toHaveLength(1);
      expect(window.adsbygoogle).toHaveLength(1);
    } finally {
      g.IntersectionObserver = origIO;
    }
  });

  it('keeps the ad unloaded when the idle callback fires before the footer is mounted, then loads it once mounted', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const el = Footer({ onNavigate: () => {} });

    flushIdle();

    const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;
    expect(adSlot.dataset.loaded).not.toBe('true');

    // The observer and adslot:init paths still work for a footer that is mounted later
    mount(el);
    el.dispatchEvent(new Event('adslot:init'));

    expect(adSlot.dataset.loaded).toBe('true');
    expect(el.querySelectorAll('ins.adsbygoogle')).toHaveLength(1);
  });

  it('loads the ad at exactly 3000 ms without requestIdleCallback and not a millisecond earlier', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    (window as unknown as IdleWindow).requestIdleCallback = undefined;
    vi.useFakeTimers();
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;

      vi.advanceTimersByTime(2999);
      expect(adSlot.dataset.loaded).not.toBe('true');
      vi.advanceTimersByTime(1);

      expect(adSlot.dataset.loaded).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the shell instead of loading when the page lost its content before the browser went idle', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const el = mount(Footer({ onNavigate: () => {} }));
    mainElement.textContent = 'Too short';

    flushIdle();

    const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;
    expect(adSlot.dataset.loaded).not.toBe('true');
    expect(adSlot.classList.contains('hidden')).toBe(true);
  });

  it('registers a load listener when readyState is not complete', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    });
    try {
      Footer({ onNavigate: () => {} });
      expect(addEventListenerSpy).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it('adds a one-shot load listener when readyState is not complete', () => {
    window.adsbygoogle = [];
    localThis.originalReadyState = document.readyState;
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    });

    Footer({ onNavigate: () => { } });

    expect(addEventListenerSpy).toHaveBeenCalledWith('load', expect.any(Function), { once: true });

    addEventListenerSpy.mockRestore();
    Object.defineProperty(document, 'readyState', {
      value: localThis.originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('calls onNavigate with navTarget when clicking nav button (L132)', () => {
    localThis.navigated = '';
    localThis.el = Footer({
      onNavigate: (page) => { localThis.navigated = page; }
    });

    const aboutLink = localThis.el!.querySelector('[data-nav="about"]') as HTMLElement | null;
    expect(aboutLink).toBeTruthy();
    aboutLink!.click();
    expect(localThis.navigated).toBe('about');
  });

  it('shows CC0 license information', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    expect(el.textContent).toMatch(/CC0 1.0 Universal/);
  });

  it('shows the root application version after the CC0 license sentence', () => {
    const el = Footer({ onNavigate: () => {} });

    expect(el.textContent).toContain(
      `and is free for all uses. Version: ${rootPackage.version}`,
    );
  });

  it('has external link to Creative Commons', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink!.getAttribute('target')).toBe('_blank');
    expect(ccLink!.getAttribute('rel')).toBe('noopener');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Footer({
      onNavigate: () => { }
    });

    const aboutLink = el.querySelector('[data-nav="about"]') as HTMLElement | null;
    expect(aboutLink).toBeTruthy();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = { called: false };

    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultSpy.called = true; }
    });

    aboutLink!.dispatchEvent(event);
    expect(preventDefaultSpy.called).toBe(true);
  });

  it('does not trigger onNavigate for non-nav elements', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const container = el.querySelector('.container') as HTMLElement | null;
    expect(container).toBeTruthy();
    container!.click();
    expect(navigated).toBe('');
  });

  it('ignores clicks whose target is not an HTMLElement', () => {
    const onNavigate = vi.fn();
    const el = Footer({ onNavigate });
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: document.createTextNode('footer') });

    el.dispatchEvent(event);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not prime ad if already loaded', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { }
    });

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    adSlot!.dataset.loaded = 'true';

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

  it('runs primeAd when load event fires after document was not complete', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;
    const observeMock = vi.fn();
    globalThis.IntersectionObserver = vi.fn(function () {
      return { observe: observeMock, disconnect: vi.fn() };
    }) as unknown as typeof IntersectionObserver;

    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    });

    const el = Footer({ onNavigate: () => { } });

    expect(observeMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    expect(observeMock).toHaveBeenCalled();

    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('uses IntersectionObserver when available to load ads', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    // Ensure IntersectionObserver is available
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const mockIntersectionObserver = vi.fn(function (_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      return {
        observe: observeMock,
        disconnect: disconnectMock
      };
    });
    globalThis.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

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

    let intersectionCallback: IntersectionObserverCallback | undefined;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const mockIntersectionObserver = vi.fn(function (callback: IntersectionObserverCallback) {
      intersectionCallback = callback;
      return {
        observe: observeMock,
        disconnect: disconnectMock
      };
    });
    globalThis.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

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
      const mockObserver = { observe: observeMock, disconnect: disconnectMock } as unknown as IntersectionObserver;
      intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], mockObserver);
    }

    // Ad should be loaded
    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot?.dataset.loaded).toBe('true');
    expect(disconnectMock).toHaveBeenCalled();

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
  });

  it('ignores a repeated observer callback after the ad has loaded', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    let callback: IntersectionObserverCallback | undefined;
    const observer = { observe: vi.fn(), disconnect: vi.fn() } as unknown as IntersectionObserver;
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = vi.fn(function (nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
      return observer;
    }) as unknown as typeof IntersectionObserver;
    try {
      const el = Footer({ onNavigate: () => {} });
      const entry = { isIntersecting: true } as IntersectionObserverEntry;

      callback!([entry], observer);
      const initialAdCount = window.adsbygoogle!.length;
      callback!([entry], observer);

      expect(window.adsbygoogle!.length).toBe(initialAdCount);
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    }
  });

  it('uses setTimeout fallback when requestIdleCallback is not available', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;
    const originalRequestIdleCallback = window.requestIdleCallback;

    // Remove IntersectionObserver to trigger the else branch
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const originalIntersectionObserver = g.IntersectionObserver;
    g.IntersectionObserver = undefined;

    // Remove requestIdleCallback to trigger setTimeout branch
    (window as unknown as { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback = undefined;

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
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

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
      g.IntersectionObserver = originalIntersectionObserver;
    }
    setTimeoutSpy.mockRestore();
  });

  it('uses requestIdleCallback when available', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    // Remove IntersectionObserver to trigger the else branch
    const g = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const originalIntersectionObserver = g.IntersectionObserver;
    g.IntersectionObserver = undefined;

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
    expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });

    // Restore
    Object.defineProperty(document, 'readyState', {
      value: originalReadyState,
      writable: true,
      configurable: true
    });
    if (originalIntersectionObserver) {
      g.IntersectionObserver = originalIntersectionObserver;
    }
  });

  it('loads the ad once the browser is idle, not on a user interaction', () => {
    window.adsbygoogle = [];
    const originalReadyState = document.readyState;

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const el = mount(Footer({
      onNavigate: () => { }
    }));

    // A user interaction must not load the ad on its own
    window.dispatchEvent(new Event('pointerdown'));
    expect((el.querySelector('[data-ad-slot]') as HTMLElement).dataset.loaded).not.toBe('true');

    // It loads once the page has loaded and the browser is idle
    flushIdle();

    // Ad should be loaded
    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
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

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;

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

  it('does not reload an ad when the idle callback runs later', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const el = mount(Footer({ onNavigate: () => {} }));
    el.dispatchEvent(new Event('adslot:init'));
    const initialAdCount = window.adsbygoogle!.length;

    flushIdle();

    expect(window.adsbygoogle!.length).toBe(initialAdCount);
  });

  it('loads an ad before an observer has been created', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    });
    const global = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const originalIntersectionObserver = global.IntersectionObserver;
    global.IntersectionObserver = undefined;
    const el = Footer({ onNavigate: () => {} });

    el.dispatchEvent(new Event('adslot:init'));

    expect((el.querySelector('[data-ad-slot]') as HTMLElement).dataset.loaded).toBe('true');
    global.IntersectionObserver = originalIntersectionObserver;
  });

  it('does not load again when the 3000 ms fallback timer runs after the ad is loaded', () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });
    const global = globalThis as unknown as { IntersectionObserver?: typeof globalThis.IntersectionObserver };
    const originalIntersectionObserver = global.IntersectionObserver;
    global.IntersectionObserver = undefined;
    (window as unknown as IdleWindow).requestIdleCallback = undefined;
    try {
      const el = mount(Footer({ onNavigate: () => {} }));
      el.dispatchEvent(new Event('adslot:init'));
      const adSlot = el.querySelector<HTMLElement>('[data-ad-slot]')!;
      expect(adSlot.dataset.loaded).toBe('true');
      expect(window.adsbygoogle).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(1);

      vi.advanceTimersByTime(2999);
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(1);

      // The timer ran and found the ad already loaded
      expect(vi.getTimerCount()).toBe(0);
      expect(window.adsbygoogle).toHaveLength(1);
      expect(el.querySelectorAll('ins.adsbygoogle')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      global.IntersectionObserver = originalIntersectionObserver;
    }
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
    vi.doMock('../src/utils/third-party.ts', () => ({
      ensureAdsense: vi.fn().mockRejectedValue(new Error('Failed to load AdSense')),
      scheduleWhenIdle: vi.fn()
    }));

    // Now import Footer which will use the mocked module
    const { Footer: MockedFooter } = await import('../src/components/footer.ts');

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

    const el = mount(Footer({
      onNavigate: () => { }
    }));

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    // Pre-set the loaded flag before primeAd would run
    adSlot!.dataset.loaded = 'true';

    // Run the idle callback
    flushIdle();

    // Ad should remain marked as loaded but no new ad created
    expect(adSlot!.dataset.loaded).toBe('true');
  });

  it('does not load ads when hideAds prop is true and hides footer-ad-shell', () => {
    window.adsbygoogle = [];

    const el = Footer({
      onNavigate: () => { },
      hideAds: true
    });

    // The ad slot should exist in template but be hidden
    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    expect(adSlot!.classList.contains('hidden')).toBe(true);

    // Trigger event that would normally load ad
    el.dispatchEvent(new Event('adslot:init'));

    // Ad should not be loaded since hideAds is true
    expect(adSlot!.dataset.loaded).not.toBe('true');
  });

  it('hides the ad shell and never loads an ad on Kindle', () => {
    window.adsbygoogle = [];
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android) Kindle/3.0');

    try {
      const el = Footer({ onNavigate: () => { } });
      const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
      expect(adSlot!.classList.contains('hidden')).toBe(true);

      el.dispatchEvent(new Event('adslot:init'));
      expect(adSlot!.dataset.loaded).not.toBe('true');
      expect(el.querySelector('ins.adsbygoogle')).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('hides footer-ad-shell until ad load is triggered (sufficient content, ads enabled)', () => {
    window.adsbygoogle = [];
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    const observeMock = vi.fn();
    globalThis.IntersectionObserver = vi.fn(function () {
      return { observe: observeMock, disconnect: vi.fn() };
    }) as unknown as typeof IntersectionObserver;

    const el = Footer({ onNavigate: () => {} });
    document.body.appendChild(el);

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    expect(adSlot).toBeTruthy();
    // Shell is hidden until we trigger load (no empty "Advertisement" placeholder)
    expect(adSlot!.classList.contains('hidden')).toBe(true);
    expect(adSlot!.dataset.loaded).not.toBe('true');

    // Trigger load (e.g. user scroll or adslot:init)
    el.dispatchEvent(new Event('adslot:init'));

    // Shell is shown and ad is loaded
    expect(adSlot!.classList.contains('hidden')).toBe(false);
    expect(adSlot!.dataset.loaded).toBe('true');

    el.remove();
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

    const el = mount(Footer({
      onNavigate: () => { }
    }));

    // primeAd should check content and skip loading
    flushIdle();

    const adSlot = el.querySelector('[data-ad-slot]') as HTMLElement | null;
    // Ad should not be loaded due to insufficient content
    expect(adSlot!.dataset.loaded).not.toBe('true');
    // Shell should be hidden when content is insufficient
    expect(adSlot!.classList.contains('hidden')).toBe(true);

    // Cleanup
    emptyMain.remove();
  });

  it('does not throw when adsbygoogle.push throws on the idle load', () => {
    window.adsbygoogle = [];
    const badPush = vi.fn().mockImplementation(() => {
      throw new Error('Ad blocked');
    });
    Object.defineProperty(window, 'adsbygoogle', {
      value: { push: badPush },
      writable: true,
      configurable: true
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true
    });

    mount(Footer({ onNavigate: () => { } }));
    flushIdle();

    expect(badPush).toHaveBeenCalled();
    window.adsbygoogle = [];
  });
});
