/**
 * Social Share Component
 * Renders a share button with popover menu containing sharing options for
 * Twitter, Facebook, LinkedIn, Reddit, WhatsApp, Email, Copy Text, and Copy Link
 */

import { createIcon } from '../utils/icons.js';
import { createButton, renderShareLinkHTML } from '../utils/button.js';

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

  // Encode for URLs
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  const encodedDescription = encodeURIComponent(shareDescription);

  // Email specifics
  const emailSubject = encodeURIComponent("Check out this Murphy's Law");
  const emailBody = encodeURIComponent(
    `I found this and thought you'd like it:\n\n${shareTitle}\n\n${shareUrl}`
  );

  // Build share URLs for each platform
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`;
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

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

  // Social link platforms
  const linkPlatforms = [
    { href: twitterUrl, label: 'Share on X', iconName: 'twitter', platform: 'twitter' },
    { href: facebookUrl, label: 'Share on Facebook', iconName: 'facebook', platform: 'facebook' },
    { href: linkedinUrl, label: 'Share on LinkedIn', iconName: 'linkedin', platform: 'linkedin' },
    { href: redditUrl, label: 'Share on Reddit', iconName: 'reddit', platform: 'reddit' },
    { href: whatsappUrl, label: 'Share on WhatsApp', iconName: 'whatsapp', platform: 'whatsapp' },
    { href: emailUrl, label: 'Share via Email', iconName: 'email', platform: 'email' },
  ];

  // Create link items
  linkPlatforms.forEach(({ href, label, iconName, platform }) => {
    const link = document.createElement('a');
    link.className = 'share-popover-item';
    link.href = href;
    link.setAttribute('role', 'menuitem');
    link.setAttribute('target', platform === 'email' ? '_self' : '_blank');
    if (platform !== 'email') {
      link.setAttribute('rel', 'noopener noreferrer');
    }

    const iconCircle = document.createElement('span');
    iconCircle.className = `icon-circle ${platform}`;
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

  // Copy action buttons
  const copyPlatforms = [
    { label: 'Copy text', iconName: 'copy', platform: 'copy', dataAction: 'copy-text', dataCopyValue: textToCopy },
    { label: 'Copy link', iconName: 'link', platform: 'link', dataAction: 'copy-link', dataCopyValue: shareUrl },
  ];

  copyPlatforms.forEach(({ label, iconName, platform, dataAction, dataCopyValue }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'share-popover-item';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('data-action', dataAction);
    button.setAttribute('data-copy-value', dataCopyValue);
    if (lawId) {
      button.setAttribute('data-law-id', lawId);
    }

    const iconCircle = document.createElement('span');
    iconCircle.className = `icon-circle ${platform}`;
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
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(lawText || '');

  // Build share URLs
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
  const emailSubject = encodeURIComponent("Check out this Murphy's Law");
  const emailBody = encodeURIComponent(`I found this and thought you'd like it:\n\n${lawText || ''}\n\n${shareUrl}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  // Build share link HTML using renderShareLinkHTML helper
  const shareLinkItems = [
    renderShareLinkHTML({ href: twitterUrl, text: 'Share on X', icon: 'twitter', platform: 'twitter' }),
    renderShareLinkHTML({ href: facebookUrl, text: 'Share on Facebook', icon: 'facebook', platform: 'facebook' }),
    renderShareLinkHTML({ href: linkedinUrl, text: 'Share on LinkedIn', icon: 'linkedin', platform: 'linkedin' }),
    renderShareLinkHTML({ href: redditUrl, text: 'Share on Reddit', icon: 'reddit', platform: 'reddit' }),
    renderShareLinkHTML({ href: whatsappUrl, text: 'Share on WhatsApp', icon: 'whatsapp', platform: 'whatsapp' }),
    renderShareLinkHTML({ href: emailUrl, text: 'Share via Email', icon: 'email', platform: 'email' }),
  ].join('\n        ');

  return `
    <div class="share-wrapper">
      <button type="button" class="share-trigger" aria-expanded="false" aria-haspopup="true" aria-label="Share this law">
        <span class="icon" data-icon="share" aria-hidden="true"></span>
        Share
      </button>
      <div class="share-popover" role="menu">
        ${shareLinkItems}
        <div class="share-popover-divider"></div>
        <button type="button" class="share-popover-item" role="menuitem" data-action="copy-text" data-copy-value="${safeText}" data-law-id="${lawId}">
          <span class="icon-circle copy"><span class="icon" data-icon="copy" aria-hidden="true"></span></span>
          Copy text
        </button>
        <button type="button" class="share-popover-item" role="menuitem" data-action="copy-link" data-copy-value="${shareUrl}" data-law-id="${lawId}">
          <span class="icon-circle link"><span class="icon" data-icon="link" aria-hidden="true"></span></span>
          Copy link
        </button>
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
