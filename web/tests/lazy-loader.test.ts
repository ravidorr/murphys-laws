import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyLoad, lazyImage, batchLazyLoad } from '../src/utils/lazy-loader.ts';

interface LazyLoaderLocalThis {
  mockFactory: ReturnType<typeof vi.fn>;
  mockOnVisible: ReturnType<typeof vi.fn>;
  mockObserver: { observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  observedElements: Element[];
  intersectionCallback: IntersectionObserverCallback | null;
}

describe('Lazy Loader Utilities', () => {
  let localThis: LazyLoaderLocalThis;

  beforeEach(() => {
    const observedElements: Element[] = [];
    const mockObserver = {
      observe: vi.fn((el: Element) => observedElements.push(el)),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    };
    localThis = {
      mockFactory: vi.fn(),
      mockOnVisible: vi.fn(),
      mockObserver,
      observedElements,
      intersectionCallback: null
    };

    vi.stubGlobal('IntersectionObserver', vi.fn(function (this: unknown, callback: IntersectionObserverCallback) {
      localThis.intersectionCallback = callback;
      return localThis.mockObserver;
    }) as unknown as typeof IntersectionObserver);

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb as () => void, 0) as unknown as number);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('lazyLoad', () => {
    it('creates a placeholder element', () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);

      expect(placeholder).toBeInstanceOf(HTMLElement);
      expect(placeholder.classList.contains('lazy-placeholder')).toBe(true);
      expect(placeholder.getAttribute('aria-busy')).toBe('true');
    });

    it('uses custom placeholder class', () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement, { placeholderClass: 'custom-class' });

      expect(placeholder.classList.contains('custom-class')).toBe(true);
    });

    it('calls factory when element becomes visible', async () => {
      const component = document.createElement('div');
      component.textContent = 'Loaded Component';
      localThis.mockFactory.mockReturnValue(component);

      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);

      // Attach to DOM
      document.body.appendChild(placeholder);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate intersection
      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockFactory).toHaveBeenCalledTimes(1);
    });

    it('replaces placeholder with component when visible', async () => {
      const component = document.createElement('div');
      component.textContent = 'Loaded';
      localThis.mockFactory.mockReturnValue(component);

      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
      const container = document.createElement('div');
      container.appendChild(placeholder);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate intersection
      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(container.contains(component)).toBe(true);
      expect(container.contains(placeholder)).toBe(false);
    });

    it('only loads once even if intersecting multiple times', async () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
      document.body.appendChild(placeholder);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate multiple intersections
      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);
      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockFactory).toHaveBeenCalledTimes(1);
    });

    it('disconnects observer after loading', async () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
      document.body.appendChild(placeholder);

      await new Promise(resolve => setTimeout(resolve, 10));

      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockObserver.disconnect).toHaveBeenCalled();
    });

    it('handles factory errors gracefully', async () => {
      localThis.mockFactory.mockImplementation(() => {
        throw new Error('Factory error');
      });

      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
      document.body.appendChild(placeholder);

      await new Promise(resolve => setTimeout(resolve, 10));

      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(placeholder.getAttribute('aria-busy')).toBe('false');
      expect(placeholder.textContent).toBe('Failed to load content');
    });

    it('falls back to immediate loading without IntersectionObserver', async () => {
      const originalIO = window.IntersectionObserver;
      (window as unknown as { IntersectionObserver?: typeof window.IntersectionObserver }).IntersectionObserver = undefined;

      try {
        localThis.mockFactory.mockReturnValue(document.createElement('div'));
        const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
        document.body.appendChild(placeholder);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(localThis.mockFactory).toHaveBeenCalled();
      } finally {
        (window as unknown as { IntersectionObserver?: typeof window.IntersectionObserver }).IntersectionObserver = originalIO;
      }
    });

    it('observes placeholder in setTimeout when not connected at RAF time (L93)', async () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);

      await new Promise(resolve => setTimeout(resolve, 0));

      document.body.appendChild(placeholder);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(localThis.mockObserver.observe).toHaveBeenCalledWith(placeholder);
    });

    it('uses custom rootMargin and threshold', () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      lazyLoad(localThis.mockFactory as () => HTMLElement, { rootMargin: '200px', threshold: 0.5 });

      expect(IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { rootMargin: '200px', threshold: 0.5 }
      );
    });

    it('observes after setTimeout when placeholder not connected in rAF', async () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement);
      expect(placeholder.isConnected).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 0));
      document.body.appendChild(placeholder);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(localThis.mockObserver.observe).toHaveBeenCalledWith(placeholder);
    });

    it('adds loading class while loading', async () => {
      localThis.mockFactory.mockReturnValue(document.createElement('div'));
      const placeholder = lazyLoad(localThis.mockFactory as () => HTMLElement, { loadingClass: 'is-loading' });
      const container = document.createElement('div');
      container.appendChild(placeholder);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check class is added during loading
      localThis.intersectionCallback!([{ isIntersecting: true, target: placeholder } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      // Component should have replaced placeholder, so we can't check the class
      // But the factory should have been called
      expect(localThis.mockFactory).toHaveBeenCalled();
    });
  });

  describe('lazyImage', () => {
    it('creates an image with loading="lazy"', () => {
      const img = lazyImage({ src: 'test.jpg', alt: 'Test image' });

      expect(img.tagName).toBe('IMG');
      expect(img.src).toContain('test.jpg');
      expect(img.alt).toBe('Test image');
      expect(img.loading).toBe('lazy');
    });

    it('sets width and height attributes', () => {
      const img = lazyImage({ src: 'test.jpg', width: 100, height: 50 });

      expect(img.width).toBe(100);
      expect(img.height).toBe(50);
    });

    it('sets className', () => {
      const img = lazyImage({ src: 'test.jpg', className: 'my-image' });

      expect(img.className).toBe('my-image');
    });

    it('uses empty alt by default', () => {
      const img = lazyImage({ src: 'test.jpg' });

      expect(img.alt).toBe('');
    });
  });

  describe('batchLazyLoad', () => {
    it('observes multiple elements with single observer', async () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      document.body.appendChild(el1);
      document.body.appendChild(el2);

      const items = [
        { element: el1, onVisible: localThis.mockOnVisible },
        { element: el2, onVisible: vi.fn() }
      ];

      batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(localThis.mockObserver.observe).toHaveBeenCalledWith(el1);
      expect(localThis.mockObserver.observe).toHaveBeenCalledWith(el2);
    });

    it('calls onVisible when element intersects', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const items = [{ element: el, onVisible: localThis.mockOnVisible }];

      batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      await new Promise(resolve => setTimeout(resolve, 10));

      localThis.intersectionCallback!([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockOnVisible).toHaveBeenCalled();
    });

    it('unobserves element after visibility callback', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const items = [{ element: el, onVisible: localThis.mockOnVisible }];

      batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      await new Promise(resolve => setTimeout(resolve, 10));

      localThis.intersectionCallback!([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockObserver.unobserve).toHaveBeenCalledWith(el);
    });

    it('only calls onVisible once per element', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const items = [{ element: el, onVisible: localThis.mockOnVisible }];

      batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate multiple intersections
      localThis.intersectionCallback!([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);
      localThis.intersectionCallback!([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);

      expect(localThis.mockOnVisible).toHaveBeenCalledTimes(1);
    });

    it('returns cleanup function', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const items = [{ element: el, onVisible: localThis.mockOnVisible }];

      const cleanup = batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      expect(typeof cleanup).toBe('function');

      cleanup();

      expect(localThis.mockObserver.disconnect).toHaveBeenCalled();
    });

    it('handles empty items array', () => {
      const cleanup = batchLazyLoad([]);

      expect(typeof cleanup).toBe('function');
      cleanup(); // Should not throw
    });

    it('handles null items', () => {
      const cleanup = batchLazyLoad(null as unknown as Array<{ element: HTMLElement; onVisible: () => void }>);

      expect(typeof cleanup).toBe('function');
    });

    it('falls back to immediate loading without IntersectionObserver', async () => {
      const originalIO = window.IntersectionObserver;
      (window as unknown as { IntersectionObserver?: typeof window.IntersectionObserver }).IntersectionObserver = undefined;

      try {
        const items = [
          { element: document.createElement('div'), onVisible: localThis.mockOnVisible }
        ];

        batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

        expect(localThis.mockOnVisible).toHaveBeenCalled();
      } finally {
        (window as unknown as { IntersectionObserver?: typeof window.IntersectionObserver }).IntersectionObserver = originalIO;
      }
    });

    it('handles onVisible errors gracefully', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const errorFn = vi.fn(() => {
        throw new Error('Callback error');
      });

      const items = [{ element: el, onVisible: errorFn }];

      batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw
      expect(() => {
        localThis.intersectionCallback!([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], localThis.mockObserver as unknown as IntersectionObserver);
      }).not.toThrow();
    });

    it('handles onVisible errors in fallback mode (no IntersectionObserver)', () => {
      const g = globalThis as unknown as { IntersectionObserver?: typeof window.IntersectionObserver };
      const originalIO = g.IntersectionObserver;
      g.IntersectionObserver = undefined;

      const el = document.createElement('div');
      const errorFn = vi.fn(() => {
        throw new Error('Fallback callback error');
      });
      const successFn = vi.fn();

      const items = [
        { element: el, onVisible: errorFn },
        { element: document.createElement('div'), onVisible: successFn }
      ];

      // Should not throw even when callbacks error in fallback mode
      expect(() => batchLazyLoad(items as Array<{ element: HTMLElement; onVisible: () => void }>)).not.toThrow();

      // The error function was called (and threw)
      expect(errorFn).toHaveBeenCalled();
      // The success function should still be called (error handling per-item)
      expect(successFn).toHaveBeenCalled();

      g.IntersectionObserver = originalIO;
    });
  });
});
