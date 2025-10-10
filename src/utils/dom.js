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
