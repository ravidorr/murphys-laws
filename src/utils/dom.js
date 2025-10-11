// DOM utilities and event listener management

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
 * Creates a loading placeholder element with ARIA live region
 * @param {string} message - Loading message
 * @returns {HTMLElement} Loading element
 */
export function createLoadingPlaceholder(message = 'Loading...') {
  const wrapper = document.createElement('div');
  wrapper.className = 'loading-placeholder';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const text = document.createElement('p');
  text.className = 'small';
  text.textContent = message;
  wrapper.appendChild(text);

  return wrapper;
}

/**
 * Wraps HTML content with a standard loading container
 * @param {string} innerMarkup - HTML markup to wrap
 * @returns {string} Wrapper HTML containing the markup
 */
export function wrapLoadingMarkup(innerMarkup = '<p class="small">Loading...</p>') {
  return `
    <div class="loading-placeholder" role="status" aria-live="polite">
      ${innerMarkup}
    </div>
  `;
}
