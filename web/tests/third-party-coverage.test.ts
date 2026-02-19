import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('third-party utils coverage', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    // JSDOM persistence workaround
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    
    vi.resetModules();
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('handles loadScript when document is undefined (SSR)', async () => {
    // Simulate SSR by temporarily hiding document/window
    const originalDoc = global.document;
    const originalWin = global.window;
    
    delete global.document;
    delete global.window;
    
    try {
      const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
      expect(() => initAnalyticsBootstrap()).not.toThrow();
    } finally {
      global.document = originalDoc;
      global.window = originalWin;
    }
  });

  it('handles loadScript when script already exists in DOM but not loaded', async () => {
    // Setup DOM with existing script
    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-XG7G6KRP0E';
    document.head.appendChild(script);

    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
    
    // Trigger load
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    // Verify script didn't duplicate
    const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
    expect(scripts.length).toBe(1);
  });

  it('toAbsoluteUrl returns src if URL construction fails', async () => {
    const originalURL = global.URL;
    global.URL = (function() {
      throw new Error('URL constructor failed');
    }) as unknown as typeof URL;
    
    try {
      const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
      
      initAnalyticsBootstrap();
      window.dispatchEvent(new Event('scroll'));
      
      // Should still proceed and try to load script with original src
      const script = document.querySelector('script[src*="googletagmanager"]');
      expect(script).toBeTruthy();
    } finally {
      global.URL = originalURL;
    }
  });

  it('loadScript accepts props and sets attributes', async () => {
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    const script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script!.async).toBe(true);
  });

  it('initAnalyticsBootstrap returns early if already started', async () => {
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
    
    const spy = vi.spyOn(window, 'addEventListener');
    
    // First call
    initAnalyticsBootstrap();
    const count = spy.mock.calls.length;
    
    // Second call
    initAnalyticsBootstrap();
    
    // Should not have added more listeners
    expect(spy.mock.calls.length).toBe(count);
  });

  it('triggerThirdPartyLoads returns early if already triggered', async () => {
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
    
    // First trigger via scroll
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    const scriptsCount = document.querySelectorAll('script').length;
    
    // Try to trigger again via another event
    window.dispatchEvent(new Event('keydown'));
    
    // Should not have added more scripts
    expect(document.querySelectorAll('script').length).toBe(scriptsCount);
  });

  it('uses requestIdleCallback when available', async () => {
    // Mock requestIdleCallback
    const idleMock = vi.fn((cb) => cb());
    global.window.requestIdleCallback = idleMock;

    try {
      // Re-import to bind to new global
      vi.resetModules();
      const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
      
      initAnalyticsBootstrap();
      
      expect(idleMock).toHaveBeenCalled();
      const script = document.querySelector('script[src*="googletagmanager"]');
      expect(script).toBeTruthy();
    } finally {
      delete global.window.requestIdleCallback;
    }
  });

  it('ensureAdsense handles existing adsbygoogle', async () => {
    global.window.adsbygoogle = [];
    const { ensureAdsense } = await import('../src/utils/third-party.ts');
    
    const promise = ensureAdsense();
    await expect(promise).resolves.toBeUndefined();
    
    delete global.window.adsbygoogle;
  });

  it('ensureAdsense resolves after timeout if script does not load', async () => {
    vi.useFakeTimers();
    const { ensureAdsense } = await import('../src/utils/third-party.ts');
    
    const promise = ensureAdsense();
    
    // Fast forward past timeout
    vi.advanceTimersByTime(5100);
    
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('ensureAdsense resolves when adsbygoogle becomes available', async () => {
    vi.useFakeTimers();
    const { ensureAdsense } = await import('../src/utils/third-party.ts');
    
    const promise = ensureAdsense();
    
    // Simulate script load
    global.window.adsbygoogle = [];
    
    // Advance timer slightly to trigger interval
    vi.advanceTimersByTime(100);
    
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
    delete global.window.adsbygoogle;
  });

  // Direct tests for exported utilities
  it('toAbsoluteUrl handles invalid URLs gracefully', async () => {
    const { toAbsoluteUrl } = await import('../src/utils/third-party.ts');
    
    const originalURL = global.URL;
    global.URL = (function() {
      throw new Error('Invalid URL');
    }) as unknown as typeof URL;
    
    try {
      expect(toAbsoluteUrl('invalid')).toBe('invalid');
    } finally {
      global.URL = originalURL;
    }
  });

  it('toAbsoluteUrl returns src when document is undefined', async () => {
    const originalDoc = global.document;
    delete global.document;
    
    try {
      const { toAbsoluteUrl } = await import('../src/utils/third-party.ts');
      expect(toAbsoluteUrl('/script.js')).toBe('/script.js');
    } finally {
      global.document = originalDoc;
    }
  });

  it('loadScript returns resolved promise when document is undefined', async () => {
    const originalDoc = global.document;
    delete global.document;
    
    try {
      const { loadScript } = await import('../src/utils/third-party.ts');
      await expect(loadScript('src')).resolves.toBeUndefined();
    } finally {
      global.document = originalDoc;
    }
  });

  it('loadScript handles null/undefined props', async () => {
    const { loadScript } = await import('../src/utils/third-party.ts');
    
    // Should skip null/undefined props
    const promise = loadScript('https://example.com/script.js', {
      'data-test': 'value',
      'data-null': null,
      'data-undefined': undefined
    });
    
    // Simulate load
    const script = document.head.querySelector('script[src="https://example.com/script.js"]');
    expect(script).toBeTruthy();
    expect(script.getAttribute('data-test')).toBe('value');
    expect(script.hasAttribute('data-null')).toBe(false);
    expect(script.hasAttribute('data-undefined')).toBe(false);
    
    script.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('loadScript returns early if script is already loaded', async () => {
    const { loadScript } = await import('../src/utils/third-party.ts');
    const src = 'https://example.com/cached.js';
    
    // First load
    const p1 = loadScript(src);
    document.head.querySelector(`script[src="${src}"]`).dispatchEvent(new Event('load'));
    await p1;
    
    // Second load - should be immediate
    const p2 = loadScript(src);
    await expect(p2).resolves.toBeUndefined();
    
    // Should have only one script tag
    expect(document.head.querySelectorAll(`script[src="${src}"]`).length).toBe(1);
  });

  it('loadScript handles existing DOM script not yet loaded', async () => {
    const { loadScript } = await import('../src/utils/third-party.ts');
    const src = 'https://example.com/existing.js';
    
    // Manually add script to DOM
    const script = document.createElement('script');
    script.src = src;
    document.head.appendChild(script);
    
    // Call loadScript
    const promise = loadScript(src);
    
    // Should attach listener to EXISTING script, not create new one
    expect(document.head.querySelectorAll(`script[src="${src}"]`).length).toBe(1);
    
    // Simulate load on existing script
    script.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('loadScript handles error event', async () => {
    const { loadScript } = await import('../src/utils/third-party.ts');
    const src = 'https://example.com/error.js';
    
    const promise = loadScript(src);
    const script = document.head.querySelector(`script[src="${src}"]`);
    
    script.dispatchEvent(new Event('error'));
    
    await expect(promise).rejects.toThrow('Failed to load script');
  });
  
  it('loadScript handles error on existing DOM script', async () => {
    const { loadScript } = await import('../src/utils/third-party.ts');
    const src = 'https://example.com/existing-error.js';
    
    const script = document.createElement('script');
    script.src = src;
    document.head.appendChild(script);
    
    const promise = loadScript(src);
    script.dispatchEvent(new Event('error'));
    
    await expect(promise).rejects.toThrow('Failed to load script');
  });

  it('triggerThirdPartyLoads silently catches gtag script load errors', async () => {
    vi.resetModules();
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.ts');
    
    initAnalyticsBootstrap();
    
    // Trigger third-party loads
    window.dispatchEvent(new Event('scroll'));
    
    // Find the gtag script and simulate error (ad blocker scenario)
    const script = document.querySelector('script[src*="googletagmanager"]');
    expect(script).toBeTruthy();
    
    // Simulate script error - should not throw unhandled rejection
    script.dispatchEvent(new Event('error'));
    
    // Give promise time to settle
    await new Promise(r => setTimeout(r, 10));
    
    // Test passes if no unhandled rejection occurred
    expect(true).toBe(true);
  });
});