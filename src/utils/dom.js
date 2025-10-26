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
  el.innerHTML = `
    <section class="section section-card">
      <div class="section-header">
        <h3 class="section-title">
          <span class="material-symbols-outlined icon">error</span>
          <span class="accent-text">Connection</span> Error
        </h3>
      </div>
      <div class="section-body text-center">
        <p class="small mb-4">${message}</p>
      </div>
      <div class="section-footer">
        <div class="left"></div>
        <div class="right">
          <button class="btn outline" onclick="window.location.reload()">
            <span class="btn-text">Retry</span>
            <span class="material-symbols-outlined icon">refresh</span>
          </button>
          <a href="/" class="btn">
            <span class="btn-text">Go Home</span>
            <span class="material-symbols-outlined icon">home</span>
          </a>
        </div>
      </div>
    </section>
  `;
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
