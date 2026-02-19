// Unified loading component for consistent loading states
import { getRandomLoadingMessage } from '../utils/constants.ts';

interface LoadingOptions {
  message?: string | null;
  size?: 'small' | 'default' | 'large';
  ariaLabel?: string | null;
}

/**
 * Default options for loading component
 */
const DEFAULT_OPTIONS: Required<LoadingOptions> = {
  message: null,      // null = random Murphy message
  size: 'default',    // 'small' | 'default' | 'large'
  ariaLabel: null,    // Custom aria-label (optional)
};

/**
 * Valid size values for the loading component
 * @type {string[]}
 */
const VALID_SIZES = ['small', 'default', 'large'];

/**
 * Builds CSS class string based on options
 * @param {Object} options - Loading options
 * @returns {string} CSS class string
 */
function buildClassString(options: Required<LoadingOptions>) {
  const classes = ['loading-placeholder'];
  if (options.size && options.size !== 'default') {
    classes.push(`size-${options.size}`);
  }
  return classes.join(' ');
}

/**
 * Validates and normalizes options
 * @param {Object} options - User-provided options
 * @returns {Object} Normalized options
 */
function normalizeOptions(options: LoadingOptions = {}): Required<LoadingOptions> {
  const normalized = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate size
  if (!VALID_SIZES.includes(normalized.size)) {
    normalized.size = 'default';
  }
  
  return normalized;
}

/**
 * Creates a loading placeholder DOM element with proper ARIA attributes
 * @param {Object} options - Loading options
 * @param {string|null} options.message - Loading message (null = random Murphy message)
 * @param {string} options.size - Size variant: 'small' | 'default' | 'large'
 * @param {string|null} options.ariaLabel - Custom aria-label (optional)
 * @returns {HTMLElement} Loading placeholder element
 * @example
 * // Basic usage with random message
 * const loading = createLoading();
 * container.appendChild(loading);
 * 
 * @example
 * // Custom message and size
 * const loading = createLoading({ 
 *   message: 'Loading laws...', 
 *   size: 'large' 
 * });
 */
export function createLoading(options: LoadingOptions = {}) {
  const opts = normalizeOptions(options);
  const message = opts.message || getRandomLoadingMessage();
  
  const wrapper = document.createElement('div');
  wrapper.className = buildClassString(opts);
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');
  
  if (opts.ariaLabel) {
    wrapper.setAttribute('aria-label', opts.ariaLabel);
  }

  const text = document.createElement('p');
  text.className = 'small';
  text.textContent = message;
  wrapper.appendChild(text);

  return wrapper;
}

/**
 * Renders loading placeholder as HTML string for SSR/templates
 * @param {Object} options - Loading options
 * @param {string|null} options.message - Loading message (null = random Murphy message)
 * @param {string} options.size - Size variant: 'small' | 'default' | 'large'
 * @param {string|null} options.ariaLabel - Custom aria-label (optional)
 * @returns {string} HTML string
 * @example
 * // Basic usage
 * element.innerHTML = renderLoadingHTML();
 * 
 * @example
 * // With custom options
 * element.innerHTML = renderLoadingHTML({ 
 *   message: 'Loading categories...', 
 *   size: 'small',
 *   ariaLabel: 'Loading category list'
 * });
 */
export function renderLoadingHTML(options: LoadingOptions = {}) {
  const opts = normalizeOptions(options);
  const message = opts.message || getRandomLoadingMessage();
  const className = buildClassString(opts);
  const ariaLabelAttr = opts.ariaLabel ? ` aria-label="${opts.ariaLabel}"` : '';
  
  return `<div class="${className}" role="status" aria-live="polite"${ariaLabelAttr}>
  <p class="small">${message}</p>
</div>`;
}
