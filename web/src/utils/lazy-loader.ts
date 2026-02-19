// Lazy loading utility using IntersectionObserver
// Defers component initialization and data fetching until elements are near viewport

/**
 * Default options for the IntersectionObserver
 */
const DEFAULT_OPTIONS = {
  rootMargin: '100px 0px', // Start loading 100px before element enters viewport
  threshold: 0
};

/**
 * Create a lazy-loaded wrapper for a component
 * The component factory is only called when the placeholder becomes visible
 * 
 * @param {Function} componentFactory - Function that creates and returns the component element
 * @param {Object} options - Configuration options
 * @param {string} options.placeholderClass - CSS class for the placeholder (default: 'lazy-placeholder')
 * @param {string} options.loadingClass - CSS class while loading (default: 'lazy-loading')
 * @param {string} options.rootMargin - IntersectionObserver rootMargin (default: '100px 0px')
 * @param {number} options.threshold - IntersectionObserver threshold (default: 0)
 * @returns {HTMLElement} Placeholder element that will be replaced with the component
 */
interface LazyLoadOptions {
  placeholderClass?: string;
  loadingClass?: string;
  rootMargin?: string;
  threshold?: number;
}

export function lazyLoad(componentFactory: () => HTMLElement, options: LazyLoadOptions = {}) {
  const {
    placeholderClass = 'lazy-placeholder',
    loadingClass = 'lazy-loading',
    rootMargin = DEFAULT_OPTIONS.rootMargin,
    threshold = DEFAULT_OPTIONS.threshold
  } = options;

  // Create placeholder element
  const placeholder = document.createElement('div');
  placeholder.className = placeholderClass;
  placeholder.setAttribute('aria-busy', 'true');
  placeholder.setAttribute('aria-label', 'Loading content');

  let isLoaded = false;
  let observer = null;

  const loadComponent = () => {
    if (isLoaded) return;
    isLoaded = true;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Add loading class
    placeholder.classList.add(loadingClass);

    // Create the actual component
    try {
      const component = componentFactory();

      // Replace placeholder with component
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(component, placeholder);
      }
    } catch {
      // On error, remove loading state and show error message
      placeholder.classList.remove(loadingClass);
      placeholder.setAttribute('aria-busy', 'false');
      placeholder.textContent = 'Failed to load content';
    }
  };

  // Check if IntersectionObserver is supported
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadComponent();
          break;
        }
      }
    }, { rootMargin, threshold });

    // Start observing once the placeholder is in the DOM
    // Use requestAnimationFrame to ensure element is attached
    requestAnimationFrame(() => {
      if (placeholder.isConnected && observer) {
        observer.observe(placeholder);
      } else if (!placeholder.isConnected) {
        // If not connected, try again after a short delay
        setTimeout(() => {
          if (placeholder.isConnected && observer) {
            observer.observe(placeholder);
          }
        }, 0);
      }
    });
  } else {
    // Fallback: load immediately for browsers without IntersectionObserver
    requestAnimationFrame(loadComponent);
  }

  return placeholder;
}

/**
 * Create a lazy-loaded image element
 * Uses native loading="lazy" with fallback for older browsers
 * 
 * @param {Object} options - Image options
 * @param {string} options.src - Image source URL
 * @param {string} options.alt - Alt text for the image
 * @param {string} options.className - CSS class for the image
 * @param {number} options.width - Image width (helps prevent CLS)
 * @param {number} options.height - Image height (helps prevent CLS)
 * @returns {HTMLImageElement} Image element with lazy loading
 */
export function lazyImage({ src, alt = '', className = '', width, height }: { src: string; alt?: string; className?: string; width?: number; height?: number }) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';

  if (className) {
    img.className = className;
  }

  if (width) {
    img.width = width;
  }

  if (height) {
    img.height = height;
  }

  return img;
}

/**
 * Batch lazy load multiple elements with a single IntersectionObserver
 * More efficient than creating separate observers for each element
 * 
 * @param {Array<{element: HTMLElement, onVisible: Function}>} items - Array of items to observe
 * @param {Object} options - IntersectionObserver options
 * @returns {Function} Cleanup function to disconnect the observer
 */
export function batchLazyLoad(items: Array<{ element: HTMLElement; onVisible: () => void }>, options: Pick<LazyLoadOptions, 'rootMargin' | 'threshold'> = {}) {
  const { rootMargin = DEFAULT_OPTIONS.rootMargin, threshold = DEFAULT_OPTIONS.threshold } = options;

  if (!items || items.length === 0) {
    return () => {};
  }

  // Build a Map for O(1) element-to-item lookup
  const itemMap = new Map<Element, { element: HTMLElement; onVisible: () => void }>();
  for (const item of items) {
    itemMap.set(item.element, item);
  }

  // Track which items have been loaded
  const loadedSet = new WeakSet<Element>();

  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all immediately
    items.forEach(({ onVisible }) => {
      try {
        onVisible();
      } catch {
        // Silently handle errors
      }
    });
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const item = itemMap.get(entry.target);
        if (item && !loadedSet.has(item.element)) {
          loadedSet.add(item.element);
          observer.unobserve(item.element);

          try {
            item.onVisible();
          } catch {
            // Silently handle errors
          }
        }
      }
    }
  }, { rootMargin, threshold });

  // Start observing all elements
  requestAnimationFrame(() => {
    items.forEach(({ element }) => {
      if (element.isConnected) {
        observer.observe(element);
      }
    });
  });

  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}
