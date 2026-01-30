/**
 * Social Share Component
 * Renders a share button with popover menu containing sharing options for
 * Twitter, Facebook, LinkedIn, Reddit, WhatsApp, Email, Copy Text, and Copy Link
 */

import { createIcon } from '../utils/icons.js';
import { createButton, renderShareLinkHTML } from '../utils/button.js';

/**
 * Share platforms configuration - Single source of truth for all share options
 * Used by both dropdown popover and inline share buttons
 */
export const SHARE_PLATFORMS = {
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
 * Build share URLs for each platform
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share
 * @param {string} options.title - Title/text to share
 * @param {string} options.description - Optional description for some platforms
 * @param {string} options.lawText - The law text for email body
 * @param {string} options.emailSubject - Custom email subject (optional)
 * @returns {Object} - Object with URL for each platform
 */
export function buildShareUrls({ url, title, description = '', lawText, emailSubject } = {}) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  
  const subject = encodeURIComponent(emailSubject || "Check out this Murphy's Law");
  const emailBody = encodeURIComponent(
    `I found this and thought you'd like it:\n\n${lawText || title}\n\n${url}`
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
export function SocialShare({ url, title, description, lawText, lawId } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'share-wrapper';

  // Use provided values or defaults
  const shareUrl = url || window.location.href;
  const shareTitle = title || document.title;
  const shareDescription = description || '';
  const textToCopy = lawText || shareTitle;

  // Build share URLs using the centralized function
  const shareUrls = buildShareUrls({
    url: shareUrl,
    title: shareTitle,
    description: shareDescription,
    lawText: textToCopy,
  });

  // Create trigger button
  const trigger = createButton({
    variant: 'secondary',
    icon: 'share',
    text: 'Share',
    className: 'share-trigger',
    ariaExpanded: false,
    ariaHaspopup: true,
    ariaLabel: 'Share this law',
  });
  wrapper.appendChild(trigger);

  // Create popover
  const popover = document.createElement('div');
  popover.className = 'share-popover';
  popover.setAttribute('role', 'menu');

  // Create social link items using SHARE_PLATFORMS config
  SHARE_PLATFORMS.social.forEach(({ id, label, icon: iconName }) => {
    const link = document.createElement('a');
    link.className = 'share-popover-item';
    link.href = shareUrls[id];
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

  // Add divider
  const divider = document.createElement('div');
  divider.className = 'share-popover-divider';
  popover.appendChild(divider);

  // Create copy action buttons using SHARE_PLATFORMS config
  const copyValues = {
    'copy-text': textToCopy,
    'copy-link': shareUrl,
  };

  SHARE_PLATFORMS.copy.forEach(({ id, label, icon: iconName, action }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'share-popover-item';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('data-action', action);
    button.setAttribute('data-copy-value', copyValues[action]);
    if (lawId) {
      button.setAttribute('data-law-id', lawId);
    }

    // Use 'copy' or 'link' class for icon circle styling
    const iconCircleClass = id === 'copy-text' ? 'copy' : 'link';
    const iconCircle = document.createElement('span');
    iconCircle.className = `icon-circle ${iconCircleClass}`;
    const icon = createIcon(iconName, { classNames: [] });
    if (icon) {
      iconCircle.appendChild(icon);
    }
    button.appendChild(iconCircle);
    button.appendChild(document.createTextNode(label));
    popover.appendChild(button);
  });

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
        const otherTrigger = p.previousElementSibling;
        if (otherTrigger) {
          otherTrigger.setAttribute('aria-expanded', 'false');
        }
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
    // Don't stop propagation for links - let them navigate
    if (e.target.closest('a')) {
      // Close popover after clicking a share link
      setTimeout(() => {
        popover.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 100);
      return;
    }
    // Don't stop propagation for copy buttons - let them bubble to parent handlers
    if (e.target.closest('[data-action="copy-text"]') || e.target.closest('[data-action="copy-link"]')) {
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
export function renderShareButtonsHTML({ lawId, lawText, url } = {}) {
  const shareUrl = url || `${window.location.origin}/law/${lawId}`;
  const safeText = lawText ? lawText.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';

  // Build share URLs using centralized function
  const shareUrls = buildShareUrls({
    url: shareUrl,
    title: lawText || '',
    lawText: lawText || '',
  });

  // Build share link HTML using SHARE_PLATFORMS config
  const shareLinkItems = SHARE_PLATFORMS.social.map(({ id, label, icon }) =>
    renderShareLinkHTML({ href: shareUrls[id], text: label, icon, platform: id })
  ).join('\n        ');

  // Build copy buttons HTML using SHARE_PLATFORMS config
  const copyValues = {
    'copy-text': safeText,
    'copy-link': shareUrl,
  };
  const copyButtonsHTML = SHARE_PLATFORMS.copy.map(({ id, label, icon, action }) => {
    const iconCircleClass = id === 'copy-text' ? 'copy' : 'link';
    return `<button type="button" class="share-popover-item" role="menuitem" data-action="${action}" data-copy-value="${copyValues[action]}" data-law-id="${lawId}">
          <span class="icon-circle ${iconCircleClass}"><span class="icon" data-icon="${icon}" aria-hidden="true"></span></span>
          ${label}
        </button>`;
  }).join('\n        ');

  return `
    <div class="share-wrapper">
      <button type="button" class="share-trigger" aria-expanded="false" aria-haspopup="true" aria-label="Share this law">
        <span class="icon" data-icon="share" aria-hidden="true"></span>
        Share
      </button>
      <div class="share-popover" role="menu">
        ${shareLinkItems}
        <div class="share-popover-divider"></div>
        ${copyButtonsHTML}
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
export function initSharePopovers(container = document) {
  const wrappers = container.querySelectorAll('.share-wrapper');
  
  wrappers.forEach(wrapper => {
    const trigger = wrapper.querySelector('.share-trigger');
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
          const otherTrigger = p.previousElementSibling;
          if (otherTrigger) {
            otherTrigger.setAttribute('aria-expanded', 'false');
          }
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
      // Let links navigate, then close
      if (e.target.closest('a')) {
        setTimeout(() => {
          popover.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        }, 100);
        return;
      }
      // Let copy buttons bubble to parent handlers, then close
      if (e.target.closest('[data-action="copy-text"]') || e.target.closest('[data-action="copy-link"]')) {
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
export function renderInlineShareButtonsHTML({ url: _url, title: _title, lawText: _lawText } = {}) {
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
export function initInlineShareButtons(container, { getShareableUrl, getShareText, emailSubject } = {}) {
  const wrapper = container.querySelector('.share-buttons-inline');
  if (!wrapper) {
    return () => {};
  }

  const feedback = wrapper.querySelector('.share-copy-feedback');
  const listeners = [];

  function addListener(target, event, handler) {
    if (!target) return;
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }

  // Show copy feedback
  function showCopyFeedback() {
    if (!feedback) return;
    feedback.classList.add('visible');
    setTimeout(() => {
      feedback.classList.remove('visible');
    }, 1500);
  }

  // Update share link URLs
  function updateShareLinks() {
    const url = getShareableUrl();
    const text = getShareText();
    const shareUrls = buildShareUrls({
      url,
      title: text,
      lawText: text,
      emailSubject,
    });

    // Update all social share links
    SHARE_PLATFORMS.social.forEach(({ id }) => {
      const link = wrapper.querySelector(`[data-share="${id}"]`);
      if (link && shareUrls[id]) {
        link.href = shareUrls[id];
      }
    });
  }

  // Handle copy actions
  async function handleCopyAction(e) {
    const button = e.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    let textToCopy = '';

    if (action === 'copy-text') {
      textToCopy = getShareText();
    } else if (action === 'copy-link') {
      textToCopy = getShareableUrl();
    } else {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      showCopyFeedback();
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showCopyFeedback();
    }
  }

  // Handle clicks on the wrapper
  function handleClick(e) {
    // Update URLs before navigation for share links
    if (e.target.closest('[data-share]')) {
      updateShareLinks();
      return; // Let the link navigate
    }
    // Handle copy buttons
    if (e.target.closest('[data-action]')) {
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
if (typeof document !== 'undefined') {
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
