// DOM utilities and event listener management

/**
 * Creates an element with automatic cleanup of event listeners
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @param {string} options.className - CSS class name
 * @param {string} options.innerHTML - Inner HTML
 * @returns {Object} Element with cleanup method
 */
export function createComponent(tag = 'div', { className = '', innerHTML = '' } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;

  const listeners = [];
  const cleanup = () => {
    listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    listeners.length = 0;
  };

  // Enhanced addEventListener that tracks listeners
  const originalAddEventListener = el.addEventListener.bind(el);
  el.addEventListener = (event, handler, options) => {
    listeners.push({ target: el, event, handler, options });
    originalAddEventListener(event, handler, options);
  };

  // Add cleanup method
  el.cleanup = cleanup;

  return el;
}

/**
 * Adds a global event listener with automatic cleanup
 * @param {EventTarget} target - Target element (window, document, etc.)
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event options
 * @returns {Function} Cleanup function
 */
export function addGlobalListener(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/**
 * Creates an AbortController-based event listener
 * @param {EventTarget} target - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {AbortSignal} signal - Abort signal
 */
export function addAbortableListener(target, event, handler, signal) {
  target.addEventListener(event, handler, { signal });
}

/**
 * Creates a loading state element with ARIA live region
 * @param {string} message - Loading message
 * @returns {HTMLElement} Loading element
 */
export function createLoadingState(message = 'Loading...') {
  const el = document.createElement('div');
  el.className = 'loading-state';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<p class="small">${message}</p>`;
  return el;
}

/**
 * Creates an error state element with ARIA live region
 * @param {string} message - Error message
 * @returns {HTMLElement} Error element
 */
export function createErrorState(message = 'An error occurred.') {
  const el = document.createElement('div');
  el.className = 'error-state';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `<p class="small error">${message}</p>`;
  return el;
}

/**
 * Sets loading state on an element
 * @param {HTMLElement} el - Target element
 * @param {boolean} isLoading - Loading state
 * @param {string} message - Loading message
 */
export function setLoadingState(el, isLoading, message = 'Loading...') {
  if (isLoading) {
    el.setAttribute('aria-busy', 'true');
    const existing = el.querySelector('.loading-state');
    if (!existing) {
      el.appendChild(createLoadingState(message));
    }
  } else {
    el.setAttribute('aria-busy', 'false');
    const loading = el.querySelector('.loading-state');
    if (loading) loading.remove();
  }
}
