// DOM utilities and event listener management
import { getRandomLoadingMessage } from './constants.js';

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
 * @param {string} message - Loading message (optional, defaults to random)
 * @returns {HTMLElement} Loading element
 */
export function createLoadingPlaceholder(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'loading-placeholder';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const text = document.createElement('p');
  text.className = 'small';
  text.textContent = message || getRandomLoadingMessage();
  wrapper.appendChild(text);

  return wrapper;
}

/**
 * Wraps HTML content with a standard loading container
 * @param {string} innerMarkup - HTML markup to wrap (optional, defaults to random loading message)
 * @returns {string} Wrapper HTML containing the markup
 */
export function wrapLoadingMarkup(innerMarkup) {
  const content = innerMarkup || `<p class="small">${getRandomLoadingMessage()}</p>`;
  return `
    <div class="loading-placeholder" role="status" aria-live="polite">
      ${content}
    </div>
  `;
}
