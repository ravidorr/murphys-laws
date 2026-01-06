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
      const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
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

    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
    
    // Trigger load
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    // Verify script didn't duplicate
    const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
    expect(scripts.length).toBe(1);
  });

  it('toAbsoluteUrl returns src if URL construction fails', async () => {
    const originalURL = global.URL;
    global.URL = function() { throw new Error('URL constructor failed'); };
    
    try {
      const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
      
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
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    const script = document.querySelector('script[src*="googletagmanager"]');
    // Check property as it's set directly on the object
    expect(script.async).toBe(true);
  });

  it('initAnalyticsBootstrap returns early if already started', async () => {
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
    
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
    const { initAnalyticsBootstrap } = await import('../src/utils/third-party.js');
    
    // First trigger via scroll
    initAnalyticsBootstrap();
    window.dispatchEvent(new Event('scroll'));
    
    const scriptsCount = document.querySelectorAll('script').length;
    
    // Try to trigger again via another event
    window.dispatchEvent(new Event('keydown'));
    
    // Should not have added more scripts
    expect(document.querySelectorAll('script').length).toBe(scriptsCount);
  });
});
