/**
 * @fileoverview Button Component Factory
 *
 * A centralized button factory for consistent button creation across the application.
 * This module provides functions for creating both DOM elements and HTML strings
 * for buttons, link-buttons, and share links.
 *
 * ## Overview
 *
 * The button system enforces consistent patterns for:
 * - Icon positioning (left by default, right only for forward navigation)
 * - Accessibility (ARIA attributes, semantic HTML)
 * - Visual styling (variants: primary, secondary, vote)
 *
 * ## Available Functions
 *
 * | Function | Purpose | Use Case |
 * |----------|---------|----------|
 * | `createButton()` | DOM element | Dynamic JS button creation |
 * | `renderButtonHTML()` | HTML string | Template literals, innerHTML |
 * | `renderLinkButtonHTML()` | HTML string | Links styled as buttons |
 * | `renderShareLinkHTML()` | HTML string | Share popover link items |
 *
 * ## Icon Position Rules
 *
 * - **Left (default)**: All icons except forward navigation arrows
 * - **Right**: Only `arrowForward` icon (e.g., "Next Page" buttons)
 * - Attempting to use `iconPosition: 'right'` with any other icon throws an error
 *
 * ## Examples
 *
 * @example
 * // DOM element creation
 * const btn = createButton({ text: 'Search', icon: 'search' });
 * document.body.appendChild(btn);
 *
 * @example
 * // HTML string generation (requires hydrateIcons after DOM insertion)
 * const html = renderButtonHTML({ variant: 'secondary', text: 'Cancel' });
 * container.innerHTML = html;
 * hydrateIcons(container);
 *
 * @example
 * // Link styled as button
 * const linkHtml = renderLinkButtonHTML({
 *   href: '/',
 *   text: 'Go Home',
 *   icon: 'home'
 * });
 *
 * @example
 * // Forward navigation with right-aligned arrow
 * const nextHtml = renderLinkButtonHTML({
 *   href: '/next',
 *   text: 'Next Page',
 *   icon: 'arrowForward',
 *   iconPosition: 'right'
 * });
 *
 * @example
 * // Share popover link
 * const shareHtml = renderShareLinkHTML({
 *   href: 'https://twitter.com/intent/tweet?url=...',
 *   text: 'Share on X',
 *   icon: 'twitter',
 *   platform: 'twitter'
 * });
 *
 * @example
 * // Vote button with count
 * const voteBtn = createButton({
 *   variant: 'vote',
 *   direction: 'up',
 *   icon: 'thumbUp',
 *   count: 42,
 *   lawId: '123',
 *   vote: 'up',
 *   ariaLabel: 'Upvote this law'
 * });
 *
 * @module button
 */

import { createIcon } from './icons.ts';

export interface ButtonOptions {
  text?: string | null;
  icon?: string | null;
  iconPosition?: 'left' | 'right';
  iconOnly?: boolean;
  variant?: 'primary' | 'secondary' | 'vote';
  direction?: 'up' | 'down' | null;
  count?: number;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string | null;
  nav?: string | null;
  navParam?: string | null;
  lawId?: string | number | null;
  action?: string | null;
  page?: number | null;
  copyValue?: string | null;
  vote?: string | null;
  ariaLabel?: string | null;
  ariaExpanded?: boolean | null;
  ariaHaspopup?: boolean | string | null;
  ariaCurrent?: string | null;
  ariaBusy?: boolean | null;
  ariaDisabled?: boolean | null;
  role?: string | null;
  id?: string | null;
  className?: string | null;
  tooltip?: string | null;
}

/**
 * CSS classes for each variant
 */
const VARIANT_CLASSES: Record<string, string> = {
  primary: 'btn',
  secondary: 'btn outline',
  vote: 'vote-btn',
};

/**
 * Default options for button creation
 */
const DEFAULT_OPTIONS: ButtonOptions = {
  // Content
  text: null,
  icon: null,
  iconPosition: 'left',
  iconOnly: false,

  // Variant
  variant: 'primary',
  direction: null, // 'up' | 'down' for vote variant
  count: 0, // for vote variant

  // Type and state
  type: 'button',
  disabled: false,
  loading: false,
  loadingText: null,

  // Data attributes
  nav: null,
  navParam: null,
  lawId: null,
  action: null,
  page: null,
  copyValue: null,
  vote: null, // 'up' | 'down' for data-vote attribute

  // Accessibility
  ariaLabel: null,
  ariaExpanded: null,
  ariaHaspopup: null,
  ariaCurrent: null,
  ariaBusy: null,
  ariaDisabled: null,
  role: null,

  // Custom
  id: null,
  className: null,
  tooltip: null,
};

/**
 * Validate button options
 * @param {Object} options - Button options
 * @throws {Error} If validation fails
 */
function validateOptions(options: ButtonOptions): void {
  const { variant, direction, iconOnly, ariaLabel, iconPosition, icon } = options;

  if (variant === 'vote' && !direction) {
    throw new Error('vote variant requires direction: "up" | "down"');
  }

  if (iconOnly && !ariaLabel) {
    throw new Error('iconOnly buttons require ariaLabel for accessibility');
  }

  if (iconPosition === 'right' && icon !== 'arrowForward') {
    throw new Error('iconPosition "right" only allowed for arrowForward icon (forward navigation)');
  }
}

/**
 * Build CSS class string for button
 * @param {Object} options - Button options
 * @returns {string} CSS class string
 */
function buildClassString(options: ButtonOptions): string {
  const { variant, direction, className, loading } = options;

  const classes = [];

  // Base variant class
  classes.push(VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary);

  // Vote direction class
  if (variant === 'vote' && direction) {
    classes.push(`count-${direction}`);
  }

  // Loading state class
  if (loading) {
    classes.push('loading');
  }

  // Custom classes
  if (className) {
    classes.push(className);
  }

  return classes.join(' ');
}

/**
 * Create a button DOM element
 * @param {Object} options - Button configuration options
 * @returns {HTMLButtonElement} Button element
 */
export function createButton(options: ButtonOptions = {}): HTMLButtonElement {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(opts);

  const {
    text,
    icon,
    iconPosition,
    iconOnly,
    variant,
    count,
    type,
    disabled,
    loading,
    loadingText,
    nav,
    navParam,
    lawId,
    action,
    page,
    copyValue,
    vote,
    ariaLabel,
    ariaExpanded,
    ariaHaspopup,
    ariaCurrent,
    ariaBusy,
    ariaDisabled,
    role,
    id,
    tooltip,
  } = opts;

  // Create button element
  const button = document.createElement('button');
  button.type = type ?? 'button';
  button.className = buildClassString(opts);

  // Set ID if provided
  if (id) {
    button.id = id;
  }

  // Build content based on variant
  if (variant === 'vote') {
    // Vote buttons: icon + count
    if (icon) {
      const iconEl = createIcon(icon);
      if (iconEl) {
        button.appendChild(iconEl);
      }
    }
    const countSpan = document.createElement('span');
    countSpan.className = 'count-num';
    countSpan.textContent = String(count);
    button.appendChild(countSpan);
  } else if (iconOnly) {
    // Icon-only buttons
    if (icon) {
      const iconEl = createIcon(icon);
      if (iconEl) {
        button.appendChild(iconEl);
      }
    }
  } else {
    // Standard buttons: icon (left) + text OR text + icon (right)
    const displayText = loading && loadingText ? loadingText : text;

    if (icon && iconPosition === 'left') {
      const iconEl = createIcon(icon);
      if (iconEl) {
        button.appendChild(iconEl);
      }
    }

    if (displayText) {
      const textSpan = document.createElement('span');
      textSpan.className = 'btn-text';
      textSpan.textContent = displayText;
      button.appendChild(textSpan);
    }

    if (icon && iconPosition === 'right') {
      const iconEl = createIcon(icon);
      if (iconEl) {
        button.appendChild(iconEl);
      }
    }
  }

  // Set disabled state
  if (disabled || loading) {
    button.disabled = true;
  }

  // Set data attributes
  if (nav !== null) {
    button.setAttribute('data-nav', nav);
  }
  if (navParam !== null) {
    button.setAttribute('data-param', navParam);
  }
  if (lawId !== null) {
    button.setAttribute('data-law-id', String(lawId));
  }
  if (action !== null) {
    button.setAttribute('data-action', action);
  }
  if (page !== null) {
    button.setAttribute('data-page', String(page));
  }
  if (copyValue !== null) {
    button.setAttribute('data-copy-value', copyValue);
  }
  if (vote !== null) {
    button.setAttribute('data-vote', vote);
  }
  if (tooltip !== null) {
    button.setAttribute('data-tooltip', tooltip);
  }

  // Set ARIA attributes
  if (ariaLabel !== null) {
    button.setAttribute('aria-label', ariaLabel);
  }
  if (ariaExpanded !== null) {
    button.setAttribute('aria-expanded', String(ariaExpanded));
  }
  if (ariaHaspopup !== null) {
    button.setAttribute('aria-haspopup', String(ariaHaspopup));
  }
  if (ariaCurrent !== null) {
    button.setAttribute('aria-current', ariaCurrent);
  }
  if (ariaBusy !== null || loading) {
    button.setAttribute('aria-busy', String(ariaBusy ?? loading));
  }
  if (ariaDisabled !== null) {
    button.setAttribute('aria-disabled', String(ariaDisabled));
  }
  if (role !== null) {
    button.setAttribute('role', role);
  }

  return button;
}

/**
 * Generate button HTML string (for use in template strings)
 * Uses icon placeholder syntax that requires hydrateIcons() to be called after DOM insertion
 * @param {Object} options - Button configuration options
 * @returns {string} HTML string for button
 */
export function renderButtonHTML(options: ButtonOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(opts);

  const {
    text,
    icon,
    iconPosition,
    iconOnly,
    variant,
    count,
    type,
    disabled,
    loading,
    loadingText,
    nav,
    navParam,
    lawId,
    action,
    page,
    copyValue,
    vote,
    ariaLabel,
    ariaExpanded,
    ariaHaspopup,
    ariaCurrent,
    ariaBusy,
    ariaDisabled,
    role,
    id,
    tooltip,
  } = opts;

  // Build attributes array
  const attrs = [];

  // Type attribute
  attrs.push(`type="${type}"`);

  // Class attribute
  attrs.push(`class="${buildClassString(opts)}"`);

  // ID attribute
  if (id) {
    attrs.push(`id="${id}"`);
  }

  // Disabled attribute
  if (disabled || loading) {
    attrs.push('disabled');
  }

  // Data attributes
  if (nav !== null) {
    attrs.push(`data-nav="${nav}"`);
  }
  if (navParam !== null) {
    attrs.push(`data-param="${navParam}"`);
  }
  if (lawId !== null) {
    attrs.push(`data-law-id="${lawId}"`);
  }
  if (action !== null) {
    attrs.push(`data-action="${action}"`);
  }
  if (page !== null) {
    attrs.push(`data-page="${page}"`);
  }
  if (copyValue !== null) {
    // Escape quotes in copy value
    const safeCopyValue = String(copyValue).replace(/"/g, '&quot;');
    attrs.push(`data-copy-value="${safeCopyValue}"`);
  }
  if (vote !== null) {
    attrs.push(`data-vote="${vote}"`);
  }
  if (tooltip !== null) {
    attrs.push(`data-tooltip="${tooltip}"`);
  }

  // ARIA attributes
  if (ariaLabel !== null) {
    attrs.push(`aria-label="${ariaLabel}"`);
  }
  if (ariaExpanded !== null) {
    attrs.push(`aria-expanded="${ariaExpanded}"`);
  }
  if (ariaHaspopup !== null) {
    attrs.push(`aria-haspopup="${ariaHaspopup}"`);
  }
  if (ariaCurrent !== null) {
    attrs.push(`aria-current="${ariaCurrent}"`);
  }
  if (ariaBusy !== null || loading) {
    attrs.push(`aria-busy="${ariaBusy ?? loading}"`);
  }
  if (ariaDisabled !== null) {
    attrs.push(`aria-disabled="${ariaDisabled}"`);
  }
  if (role !== null) {
    attrs.push(`role="${role}"`);
  }

  // Build icon HTML (placeholder syntax for hydrateIcons)
  const iconHTML = icon
    ? `<span class="icon" data-icon="${icon}" aria-hidden="true"></span>`
    : '';

  // Build content based on variant
  let content: string;

  if (variant === 'vote') {
    // Vote buttons: icon + count
    content = `${iconHTML}<span class="count-num">${count}</span>`;
  } else if (iconOnly) {
    // Icon-only buttons
    content = iconHTML;
  } else {
    // Standard buttons: icon (left) + text OR text + icon (right)
    const displayText = loading && loadingText ? loadingText : text;
    const textHTML = displayText ? `<span class="btn-text">${displayText}</span>` : '';

    if (iconPosition === 'right') {
      content = `${textHTML}${iconHTML}`;
    } else {
      content = `${iconHTML}${textHTML}`;
    }
  }

  return `<button ${attrs.join(' ')}>${content}</button>`;
}

/**
 * Generate link-button HTML string (for `<a>` elements styled as buttons)
 * Use this for semantic links that look like buttons (e.g., navigation links)
 * Uses icon placeholder syntax that requires hydrateIcons() to be called after DOM insertion
 *
 * @param {Object} options - Link-button configuration options
 * @param {string} options.href - Link destination URL (required)
 * @param {string} options.text - Button text
 * @param {string} options.icon - Icon name (optional)
 * @param {string} options.iconPosition - 'left' (default) or 'right' (only for arrowForward)
 * @param {string} options.variant - 'primary' (default) or 'secondary'
 * @param {string} options.className - Additional CSS classes
 * @param {string} options.ariaLabel - Accessible label
 * @param {string} options.target - Link target (e.g., '_blank')
 * @param {string} options.rel - Link relationship (e.g., 'noopener noreferrer')
 * @param {string} options.id - Element ID
 * @returns {string} HTML string for link-button
 *
 * @example
 * // Simple link-button
 * renderLinkButtonHTML({ href: '/', text: 'Go Home', icon: 'home' })
 *
 * @example
 * // Link-button with external target
 * renderLinkButtonHTML({
 *   href: 'https://example.com',
 *   text: 'Visit Site',
 *   icon: 'arrowForward',
 *   iconPosition: 'right',
 *   target: '_blank',
 *   rel: 'noopener noreferrer'
 * })
 */
export interface LinkButtonOptions {
  href?: string;
  text?: string | null;
  icon?: string | null;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary';
  className?: string | null;
  ariaLabel?: string | null;
  target?: string | null;
  rel?: string | null;
  id?: string | null;
}

export function renderLinkButtonHTML(options: LinkButtonOptions): string {
  const {
    href,
    text = null,
    icon = null,
    iconPosition = 'left',
    variant = 'primary',
    className = null,
    ariaLabel = null,
    target = null,
    rel = null,
    id = null,
  } = options;

  // Validate href is provided
  if (!href) {
    throw new Error('renderLinkButtonHTML requires href');
  }

  // Validate iconPosition: 'right' only allowed for arrowForward
  if (iconPosition === 'right' && icon !== 'arrowForward') {
    throw new Error('iconPosition "right" only allowed for arrowForward icon (forward navigation)');
  }

  // Build class list
  const classes = [];
  classes.push(VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary);
  if (className) {
    classes.push(className);
  }

  // Build attributes array
  const attrs = [];
  attrs.push(`href="${href}"`);
  attrs.push(`class="${classes.join(' ')}"`);

  if (id) {
    attrs.push(`id="${id}"`);
  }
  if (ariaLabel) {
    attrs.push(`aria-label="${ariaLabel}"`);
  }
  if (target) {
    attrs.push(`target="${target}"`);
  }
  if (rel) {
    attrs.push(`rel="${rel}"`);
  }

  // Build icon HTML
  const iconHTML = icon
    ? `<span class="icon" data-icon="${icon}" aria-hidden="true"></span>`
    : '';

  // Build text HTML
  const textHTML = text ? `<span class="btn-text">${text}</span>` : '';

  // Build content based on icon position
  const content = iconPosition === 'right'
    ? `${textHTML}${iconHTML}`
    : `${iconHTML}${textHTML}`;

  return `<a ${attrs.join(' ')}>${content}</a>`;
}

/**
 * Generate share popover link HTML string
 * Use this for social share links with the icon-circle pattern
 * Uses icon placeholder syntax that requires hydrateIcons() to be called after DOM insertion
 *
 * @param {Object} options - Share link configuration options
 * @param {string} options.href - Share URL (required)
 * @param {string} options.text - Link text (required)
 * @param {string} options.icon - Icon name (required)
 * @param {string} options.platform - Platform identifier for styling (required)
 *   Supported: 'twitter', 'facebook', 'linkedin', 'reddit', 'whatsapp', 'email'
 * @param {string} options.target - Link target (default: '_blank', '_self' for email)
 * @param {string} options.rel - Link relationship (default: 'noopener noreferrer', omitted for email)
 * @returns {string} HTML string for share link
 *
 * @example
 * renderShareLinkHTML({
 *   href: 'https://twitter.com/intent/tweet?url=...',
 *   text: 'Share on X',
 *   icon: 'twitter',
 *   platform: 'twitter'
 * })
 */
export interface ShareLinkOptions {
  href?: string;
  text?: string;
  icon?: string;
  platform?: string;
  target?: string;
  rel?: string | null;
}

export function renderShareLinkHTML(options: ShareLinkOptions): string {
  const {
    href,
    text,
    icon,
    platform,
    target = platform === 'email' ? '_self' : '_blank',
    rel = platform === 'email' ? null : 'noopener noreferrer',
  } = options;

  // Validate required options
  if (!href) {
    throw new Error('renderShareLinkHTML requires href');
  }
  if (!text) {
    throw new Error('renderShareLinkHTML requires text');
  }
  if (!icon) {
    throw new Error('renderShareLinkHTML requires icon');
  }
  if (!platform) {
    throw new Error('renderShareLinkHTML requires platform');
  }

  // Build attributes array
  const attrs = [];
  attrs.push('class="share-popover-item"');
  attrs.push(`href="${href}"`);
  attrs.push('role="menuitem"');

  if (target) {
    attrs.push(`target="${target}"`);
  }
  if (rel) {
    attrs.push(`rel="${rel}"`);
  }

  // Build icon-circle with icon inside
  const iconCircleHTML = `<span class="icon-circle ${platform}"><span class="icon" data-icon="${icon}" aria-hidden="true"></span></span>`;

  return `<a ${attrs.join(' ')}>${iconCircleHTML}${text}</a>`;
}
