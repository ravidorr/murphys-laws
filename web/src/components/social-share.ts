/**
 * Social Share Component
 * Renders a share button with popover menu containing sharing options for
 * Twitter, Facebook, LinkedIn, Reddit, WhatsApp, Email, Copy Text, and Copy Link
 */

import { createIcon } from '../utils/icons.ts';
import { createButton, renderShareLinkHTML } from '../utils/button.ts';
import { copyToClipboard } from '../utils/clipboard.ts';
import { recordQualifyingUserAction } from './install-prompt.ts';

interface BuildShareUrlsOptions {
  url?: string;
  title?: string;
  description?: string;
  lawText?: string;
  emailSubject?: string;
}

interface SocialShareOptions {
  url?: string;
  title?: string;
  description?: string;
  lawText?: string;
  lawId?: string;
  /** Optional URL builder for tests; when provided, used instead of buildShareUrls. */
  getShareUrls?: (opts: BuildShareUrlsOptions) => Record<string, string>;
}

interface RenderShareButtonsOptions {
  lawId?: string;
  lawText?: string;
  url?: string;
}

interface RenderInlineShareButtonsOptions {
  url?: string;
  title?: string;
  lawText?: string;
}

interface InitInlineShareButtonsOptions {
  getShareableUrl?: () => string;
  getShareText?: () => string;
  emailSubject?: string;
}

/**
 * Share platforms configuration - Single source of truth for all share options
 * Used by both dropdown popover and inline share buttons
 * topChannels: shown as always-visible buttons (2-3); rest appear in Share popover
 */
export const SHARE_PLATFORMS = {
  topChannels: [
    { id: 'copy-link', label: 'Copy link', shortLabel: 'Link', icon: 'link', action: 'copy-link' },
    { id: 'twitter', label: 'Share on X', shortLabel: 'X', icon: 'twitter' },
    { id: 'email', label: 'Share via Email', shortLabel: 'Email', icon: 'email' },
  ],
  social: [
    { id: 'twitter', label: 'Share on X', shortLabel: 'X', icon: 'twitter' },
    { id: 'facebook', label: 'Share on Facebook', shortLabel: 'Facebook', icon: 'facebook' },
    { id: 'linkedin', label: 'Share on LinkedIn', shortLabel: 'LinkedIn', icon: 'linkedin' },
    { id: 'reddit', label: 'Share on Reddit', shortLabel: 'Reddit', icon: 'reddit' },
    { id: 'whatsapp', label: 'Share on WhatsApp', shortLabel: 'WhatsApp', icon: 'whatsapp' },
    { id: 'email', label: 'Share via Email', shortLabel: 'Email', icon: 'email' },
  ],
  copy: [
    { id: 'copy-text', label: 'Copy text', shortLabel: 'Copy', icon: 'copy', action: 'copy-text' },
    { id: 'copy-link', label: 'Copy link', shortLabel: 'Link', icon: 'link', action: 'copy-link' },
  ],
};

/**
 * Normalize URL for sharing: trim, strip invisible chars, canonical form (no fragment).
 */
export function normalizeShareUrl(url: string): string {
  const trimmed = (url ?? '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    return u.origin + u.pathname + u.search;
  } catch {
    return trimmed;
  }
}

/**
 * Build share URLs for each platform
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share
 * @param {string} options.title - Title/text to share
 * @param {string} options.description - Optional description for some platforms
 * @param {string} options.lawText - The law text for email body
 * @param {string} options.emailSubject - Custom email subject (optional)
 * @returns {Object} - Object with URL for each platform
 */
export function buildShareUrls({ url, title, description = '', lawText, emailSubject }: BuildShareUrlsOptions = {}): Record<string, string> {
  const normalizedUrl = normalizeShareUrl(url ?? '');
  const encodedUrl = encodeURIComponent(normalizedUrl);
  const encodedTitle = encodeURIComponent(title ?? '');
  const encodedDescription = encodeURIComponent(description);
  
  const subject = encodeURIComponent(emailSubject || "Check out this Murphy's Law");
  const emailBody = encodeURIComponent(
    `I found this and thought you'd like it:\n\n${lawText || title}\n\n${normalizedUrl}`
  );

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${subject}&body=${emailBody}`,
  };
}

/**
 * Create social share popover component
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share (defaults to current page URL)
 * @param {string} options.title - Title/text to share (defaults to document title)
 * @param {string} options.description - Optional description for some platforms
 * @param {string} options.lawText - The law text for copy-text functionality
 * @param {string} options.lawId - The law ID for data attributes
 * @returns {HTMLElement} - Social share popover container
 */
export function SocialShare({ url, title, description, lawText, lawId, getShareUrls }: SocialShareOptions = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'share-wrapper';

  const shareUrl = normalizeShareUrl(url || window.location.href);
  const shareTitle = title || document.title;
  const shareDescription = description || '';
  const textToCopy = lawText || shareTitle;

  // Build share URLs using the centralized function or optional injector (for tests)
  const shareUrls = getShareUrls
    ? getShareUrls({ url: shareUrl, title: shareTitle, description: shareDescription, lawText: textToCopy })
    : buildShareUrls({
      url: shareUrl,
      title: shareTitle,
      description: shareDescription,
      lawText: textToCopy,
    });

  // Top channels: Copy link, X, Email (always visible)
  const topRow = document.createElement('div');
  topRow.className = 'share-top-channels';
  topRow.setAttribute('aria-label', 'Share options');

  const copyLinkBtn = document.createElement('button');
  copyLinkBtn.type = 'button';
  copyLinkBtn.className = 'share-btn-top';
  copyLinkBtn.setAttribute('data-action', 'copy-link');
  copyLinkBtn.setAttribute('data-copy-value', shareUrl);
  if (lawId) copyLinkBtn.setAttribute('data-law-id', lawId);
  copyLinkBtn.setAttribute('aria-label', 'Copy link');
  const copyLinkIcon = createIcon('link', { classNames: [] });
  if (copyLinkIcon) copyLinkBtn.appendChild(copyLinkIcon);
  topRow.appendChild(copyLinkBtn);

  ['twitter', 'email'].forEach((id) => {
    const link = document.createElement('a');
    link.className = 'share-btn-top';
    link.href = shareUrls[id] ?? '#';
    link.setAttribute('aria-label', id === 'twitter' ? 'Share on X' : 'Share via Email');
    if (id !== 'email') {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
    const icon = createIcon(id === 'twitter' ? 'twitter' : 'email', { classNames: [] });
    if (icon) link.appendChild(icon);
    topRow.appendChild(link);
  });

  wrapper.appendChild(topRow);

  // Share button (opens popover with more options)
  const trigger = createButton({
    variant: 'secondary',
    icon: 'share',
    text: 'Share',
    className: 'share-trigger',
    ariaExpanded: false,
    ariaHaspopup: true,
    ariaLabel: 'More share options',
  });
  wrapper.appendChild(trigger);

  // Create popover (Facebook, LinkedIn, Reddit, WhatsApp, Copy text)
  const popover = document.createElement('div');
  popover.className = 'share-popover';
  popover.setAttribute('role', 'menu');

  const popoverSocialIds = SHARE_PLATFORMS.social.filter(({ id }) => !TOP_CHANNEL_IDS.has(id)).map(p => p.id);
  popoverSocialIds.forEach((id) => {
    const platform = SHARE_PLATFORMS.social.find(p => p.id === id)!;
    const { label, icon: iconName } = platform;
    const link = document.createElement('a');
    link.className = 'share-popover-item';
    link.href = shareUrls[id] ?? '';
    link.setAttribute('role', 'menuitem');
    link.setAttribute('target', id === 'email' ? '_self' : '_blank');
    if (id !== 'email') {
      link.setAttribute('rel', 'noopener noreferrer');
    }

    const iconCircle = document.createElement('span');
    iconCircle.className = `icon-circle ${id}`;
    const icon = createIcon(iconName, { classNames: [] });
    if (icon) {
      iconCircle.appendChild(icon);
    }
    link.appendChild(iconCircle);
    link.appendChild(document.createTextNode(label));
    popover.appendChild(link);
  });

  // Add divider and Copy text only (Copy link is in top row)
  const divider = document.createElement('div');
  divider.className = 'share-popover-divider';
  popover.appendChild(divider);

  const copyTextBtn = document.createElement('button');
  copyTextBtn.type = 'button';
  copyTextBtn.className = 'share-popover-item';
  copyTextBtn.setAttribute('role', 'menuitem');
  copyTextBtn.setAttribute('data-action', 'copy-text');
  copyTextBtn.setAttribute('data-copy-value', textToCopy);
  if (lawId) copyTextBtn.setAttribute('data-law-id', lawId);
  const copyIconCircle = document.createElement('span');
  copyIconCircle.className = 'icon-circle copy';
  const copyIcon = createIcon('copy', { classNames: [] });
  if (copyIcon) copyIconCircle.appendChild(copyIcon);
  copyTextBtn.appendChild(copyIconCircle);
  copyTextBtn.appendChild(document.createTextNode('Copy text'));
  popover.appendChild(copyTextBtn);

  // Add copy feedback element
  const feedback = document.createElement('div');
  feedback.className = 'share-copy-feedback';
  const checkIcon = createIcon('checkCircle', { classNames: [] });
  if (checkIcon) {
    feedback.appendChild(checkIcon);
  }
  feedback.appendChild(document.createTextNode('Copied!'));
  popover.appendChild(feedback);

  wrapper.appendChild(popover);

  // Toggle popover on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = popover.classList.contains('open');

    // Close all other popovers first
    document.querySelectorAll('.share-popover.open').forEach(p => {
      if (p !== popover) {
        p.classList.remove('open');
        p.classList.remove('popover-above');
        const otherTrigger = p.previousElementSibling; // template always has trigger before popover
        otherTrigger!.setAttribute('aria-expanded', 'false');
      }
    });

    if (isOpen) {
      popover.classList.remove('open');
      popover.classList.remove('popover-above');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      // Check if popover would overflow viewport bottom
      const triggerRect = trigger.getBoundingClientRect();
      const popoverHeight = 320; // Approximate height of popover
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      
      if (spaceBelow < popoverHeight && triggerRect.top > popoverHeight) {
        popover.classList.add('popover-above');
      } else {
        popover.classList.remove('popover-above');
      }
      
      popover.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  // Prevent clicks inside popover from closing it (except for actions)
  popover.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Don't stop propagation for links - let them navigate
    if (target.closest('a')) {
      // Close popover after clicking a share link
      setTimeout(() => {
        popover.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 100);
      return;
    }
    // Don't stop propagation for copy buttons - let them bubble to parent handlers
    if (target.closest('[data-action="copy-text"]') || target.closest('[data-action="copy-link"]')) {
      // Close popover after clicking a copy button
      setTimeout(() => {
        popover.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 100);
      return;
    }
    e.stopPropagation();
  });

  return wrapper;
}

/**
 * Generate share popover HTML string (for use in template strings)
 * @param {Object} options - Configuration options
 * @param {string} options.lawId - The law ID
 * @param {string} options.lawText - The law text for copy-text functionality
 * @param {string} options.url - URL to share (optional, will be constructed from lawId if not provided)
 * @returns {string} - HTML string for share popover
 */
const TOP_CHANNEL_IDS = new Set(SHARE_PLATFORMS.topChannels.map(c => ('action' in c ? c.action : c.id)));

export function renderShareButtonsHTML({ lawId, lawText, url }: RenderShareButtonsOptions = {}) {
  const shareUrl = normalizeShareUrl(url ?? `${window.location.origin}/law/${lawId}`);
  const safeText = lawText ? lawText.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';

  const shareUrls = buildShareUrls({
    url: shareUrl,
    title: lawText || '',
    lawText: lawText || '',
  });

  // Always-visible: Copy link, X, Email (2-3 top channels)
  const topButtonsHTML = SHARE_PLATFORMS.topChannels.map((ch) => {
    if ('action' in ch && ch.action === 'copy-link') {
      return `<button type="button" class="share-btn-top" data-action="copy-link" data-copy-value="${shareUrl.replace(/"/g, '&quot;')}" data-law-id="${lawId}" aria-label="Copy link"><span class="icon" data-icon="link" aria-hidden="true"></span></button>`;
    }
    if (ch.id === 'twitter') {
      return `<a href="${shareUrls.twitter ?? '#'}" class="share-btn-top" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><span class="icon" data-icon="twitter" aria-hidden="true"></span></a>`;
    }
    if (ch.id === 'email') {
      return `<a href="${shareUrls.email ?? '#'}" class="share-btn-top" aria-label="Share via Email"><span class="icon" data-icon="email" aria-hidden="true"></span></a>`;
    }
    return '';
  }).filter(Boolean).join('\n        ');

  // Popover: social channels not in top (Facebook, LinkedIn, Reddit, WhatsApp) + Copy text
  const popoverSocial = SHARE_PLATFORMS.social.filter(({ id }) => !TOP_CHANNEL_IDS.has(id));
  const shareLinkItems = popoverSocial.map(({ id, label, icon }) =>
    renderShareLinkHTML({ href: shareUrls[id], text: label, icon, platform: id })
  ).join('\n        ');

  const copyTextButton = `<button type="button" class="share-popover-item" role="menuitem" data-action="copy-text" data-copy-value="${safeText}" data-law-id="${lawId}">
          <span class="icon-circle copy"><span class="icon" data-icon="copy" aria-hidden="true"></span></span>
          Copy text
        </button>`;

  return `
    <div class="share-wrapper">
      <div class="share-top-channels" aria-label="Share options">
        ${topButtonsHTML}
      </div>
      <button type="button" class="share-trigger" aria-expanded="false" aria-haspopup="true" aria-label="More share options">
        <span class="icon" data-icon="share" aria-hidden="true"></span>
        Share
      </button>
      <div class="share-popover" role="menu">
        ${shareLinkItems}
        <div class="share-popover-divider"></div>
        ${copyTextButton}
        <div class="share-copy-feedback">
          <span class="icon" data-icon="checkCircle" aria-hidden="true"></span>
          Copied!
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Initialize share popover behavior for dynamically rendered HTML
 * Call this after inserting share popover HTML into the DOM
 * @param {HTMLElement} container - Container element to search for share popovers
 */
export function initSharePopovers(container: Document | HTMLElement = document) {
  const wrappers = container.querySelectorAll('.share-wrapper');
  
  wrappers.forEach(wrapper => {
    const trigger = wrapper.querySelector('.share-trigger') as HTMLElement | null;
    const popover = wrapper.querySelector('.share-popover');

    if (!trigger || !popover || trigger.dataset.initialized) return;

    trigger.dataset.initialized = 'true';
    
    // Toggle popover on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popover.classList.contains('open');

      // Close all other popovers first
      document.querySelectorAll('.share-popover.open').forEach(p => {
        if (p !== popover) {
          p.classList.remove('open');
          p.classList.remove('popover-above');
          const otherTrigger = p.previousElementSibling; // template always has trigger before popover
          otherTrigger!.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        popover.classList.remove('open');
        popover.classList.remove('popover-above');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        // Check if popover would overflow viewport bottom
        const triggerRect = trigger.getBoundingClientRect();
        const popoverHeight = 320; // Approximate height of popover
        const spaceBelow = window.innerHeight - triggerRect.bottom;

        if (spaceBelow < popoverHeight && triggerRect.top > popoverHeight) {
          popover.classList.add('popover-above');
        } else {
          popover.classList.remove('popover-above');
        }

        popover.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Handle clicks inside popover
    popover.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Let links navigate, then close
      if (target.closest('a')) {
        setTimeout(() => {
          popover.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        }, 100);
        return;
      }
      // Let copy buttons bubble to parent handlers, then close
      if (target.closest('[data-action="copy-text"]') || target.closest('[data-action="copy-link"]')) {
        setTimeout(() => {
          popover.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        }, 100);
        return;
      }
      e.stopPropagation();
    });
  });
}

/**
 * Generate inline share buttons HTML (horizontal layout for calculators)
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share (optional, defaults to current page)
 * @param {string} options.title - Title/text to share (optional, defaults to document title)
 * @param {string} options.lawText - Text for copy-text functionality
 * @returns {string} - HTML string for inline share buttons
 */
export function renderInlineShareButtonsHTML({ url: _url, title: _title, lawText: _lawText }: RenderInlineShareButtonsOptions = {}) {
  // Generate buttons HTML using SHARE_PLATFORMS config
  // Note: URLs will be updated dynamically by initInlineShareButtons
  const socialButtonsHTML = SHARE_PLATFORMS.social.map(({ id, shortLabel, icon }) => {
    return `<a class="share-btn-inline" href="#" data-share="${id}" target="${id === 'email' ? '_self' : '_blank'}" ${id !== 'email' ? 'rel="noopener noreferrer"' : ''} aria-label="Share on ${shortLabel}">
        <span class="icon-circle ${id}"><span class="icon" data-icon="${icon}" aria-hidden="true"></span></span>
        <span class="btn-text">${shortLabel}</span>
      </a>`;
  }).join('\n      ');

  const copyButtonsHTML = SHARE_PLATFORMS.copy.map(({ id, shortLabel, icon, action }) => {
    const iconCircleClass = id === 'copy-text' ? 'copy' : 'link';
    return `<button type="button" class="share-btn-inline" data-action="${action}" aria-label="${shortLabel}">
        <span class="icon-circle ${iconCircleClass}"><span class="icon" data-icon="${icon}" aria-hidden="true"></span></span>
        <span class="btn-text">${shortLabel}</span>
      </button>`;
  }).join('\n      ');

  return `
    <div class="share-buttons-inline">
      ${socialButtonsHTML}
      ${copyButtonsHTML}
      <div class="share-copy-feedback">
        <span class="icon" data-icon="checkCircle" aria-hidden="true"></span>
        Copied!
      </div>
    </div>
  `.trim();
}

/**
 * Initialize inline share buttons behavior
 * Call this after inserting inline share buttons HTML into the DOM
 * @param {HTMLElement} container - Container element with inline share buttons
 * @param {Object} options - Configuration options
 * @param {Function} options.getShareableUrl - Function that returns the shareable URL
 * @param {Function} options.getShareText - Function that returns the share text
 * @param {string} options.emailSubject - Custom email subject (optional)
 * @returns {Function} Teardown function to remove event listeners
 */
export function initInlineShareButtons(container: HTMLElement, { getShareableUrl, getShareText, emailSubject }: InitInlineShareButtonsOptions = {}) {
  const wrapper = container.querySelector('.share-buttons-inline');
  if (!wrapper) {
    return () => {};
  }

  const feedback = wrapper.querySelector('.share-copy-feedback');
  const listeners: (() => void)[] = [];

  // Only called with wrapper (truthy) in this module
  function addListener(target: EventTarget | null, event: string, handler: EventListener) {
    target!.addEventListener(event, handler);
    listeners.push(() => target!.removeEventListener(event, handler));
  }

  // Show copy feedback
  function showCopyFeedback() {
    if (!feedback) return;
    feedback.classList.add('visible');
    setTimeout(() => {
      feedback.classList.remove('visible');
    }, 1500);
  }

  function updateShareLinks() {
    const url = normalizeShareUrl(getShareableUrl?.() ?? '');
    const text = getShareText?.() ?? '';
    const shareUrls = buildShareUrls({
      url,
      title: text,
      lawText: text,
      emailSubject,
    });

    // Update all social share links (wrapper truthy after guard; shareUrls has all ids)
    SHARE_PLATFORMS.social.forEach(({ id }) => {
      const link = wrapper!.querySelector(`[data-share="${id}"]`) as HTMLAnchorElement | null;
      if (link && shareUrls[id]) {
        link.href = shareUrls[id]!;
      }
    });
  }

  async function handleCopyAction(e: Event) {
    const button = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!button) return;

    const action = button.dataset.action;
    let textToCopy: string;

    if (action === 'copy-text') {
      textToCopy = getShareText?.() ?? '';
    } else if (action === 'copy-link') {
      textToCopy = normalizeShareUrl(getShareableUrl?.() ?? '');
    } else {
      return;
    }

    if (!textToCopy) return;

    recordQualifyingUserAction();
    if (action === 'copy-link') {
      await copyToClipboard(textToCopy, 'Link copied to clipboard!');
    } else {
      await copyToClipboard(textToCopy, 'Law text copied to clipboard!');
    }
    showCopyFeedback();
  }

  // Handle clicks on the wrapper
  function handleClick(e: Event) {
    const target = e.target as HTMLElement;
    // Update URLs before navigation for share links
    if (target.closest('[data-share]')) {
      updateShareLinks();
      return; // Let the link navigate
    }
    // Handle copy buttons
    if (target.closest('[data-action]')) {
      handleCopyAction(e);
    }
  }

  // Set up event listeners
  addListener(wrapper, 'click', handleClick);

  // Initialize share links
  updateShareLinks();

  // Return teardown function
  return () => {
    listeners.forEach(unsubscribe => unsubscribe());
  };
}

// Global click handler to close popovers when clicking outside
let globalListenersInitialized = false;
if (typeof document !== 'undefined' && !globalListenersInitialized) {
  // eslint-disable-next-line no-useless-assignment -- flag is read on next top-level check
  globalListenersInitialized = true;

  document.addEventListener('click', () => {
    document.querySelectorAll('.share-popover.open').forEach(popover => {
      popover.classList.remove('open');
      popover.classList.remove('popover-above');
      const trigger = popover.previousElementSibling;
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.share-popover.open').forEach(popover => {
        popover.classList.remove('open');
        popover.classList.remove('popover-above');
        const trigger = popover.previousElementSibling;
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  });
}
