/**
 * Social Share Component
 * Renders social sharing buttons for Twitter, Facebook, LinkedIn, Reddit, Email,
 * Copy Text, and Copy Link
 */

import { createIcon } from '../utils/icons.js';

/**
 * Create social share buttons
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share (defaults to current page URL)
 * @param {string} options.title - Title/text to share (defaults to document title)
 * @param {string} options.description - Optional description for some platforms
 * @param {string} options.lawText - The law text for copy-text functionality
 * @param {string} options.lawId - The law ID for data attributes
 * @returns {HTMLElement} - Social share buttons container
 */
export function SocialShare({ url, title, description, lawText, lawId } = {}) {
  const el = document.createElement('div');
  el.className = 'share-buttons';

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
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  // Social link platforms (open external URLs)
  const linkPlatforms = [
    {
      className: 'share-button share-twitter',
      href: twitterUrl,
      label: 'Share on X',
      iconName: 'twitter',
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-facebook',
      href: facebookUrl,
      label: 'Share on Facebook',
      iconName: 'facebook',
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-linkedin',
      href: linkedinUrl,
      label: 'Share on LinkedIn',
      iconName: 'linkedin',
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-reddit',
      href: redditUrl,
      label: 'Share on Reddit',
      iconName: 'reddit',
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-email',
      href: emailUrl,
      label: 'Share via Email',
      iconName: 'email',
    },
  ];

  // Create link elements for social platforms
  linkPlatforms.forEach(({ className, href, label, rel, target, iconName }) => {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.setAttribute('aria-label', label);
    link.setAttribute('title', label);
    if (rel) link.setAttribute('rel', rel);
    if (target) link.setAttribute('target', target);

    const icon = createIcon(iconName, { classNames: ['share-icon'] });
    if (icon) {
      link.appendChild(icon);
    }

    el.appendChild(link);
  });

  // Copy action buttons (trigger JavaScript)
  const buttonPlatforms = [
    {
      className: 'share-button share-copy-text',
      label: 'Copy text',
      iconName: 'copy',
      dataAction: 'copy-text',
      dataCopyValue: textToCopy,
    },
    {
      className: 'share-button share-copy-link',
      label: 'Copy link',
      iconName: 'link',
      dataAction: 'copy-link',
      dataCopyValue: shareUrl,
    },
  ];

  // Create button elements for copy actions
  buttonPlatforms.forEach(({ className, label, iconName, dataAction, dataCopyValue }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('data-action', dataAction);
    button.setAttribute('data-copy-value', dataCopyValue);
    if (lawId) {
      button.setAttribute('data-law-id', lawId);
    }

    const icon = createIcon(iconName, { classNames: ['share-icon'] });
    if (icon) {
      button.appendChild(icon);
    }

    el.appendChild(button);
  });

  return el;
}

/**
 * Generate share buttons HTML string (for use in template strings)
 * @param {Object} options - Configuration options
 * @param {string} options.lawId - The law ID
 * @param {string} options.lawText - The law text for copy-text functionality
 * @param {string} options.url - URL to share (optional, will be constructed from lawId if not provided)
 * @returns {string} - HTML string for share buttons
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
  const emailSubject = encodeURIComponent("Check out this Murphy's Law");
  const emailBody = encodeURIComponent(`I found this and thought you'd like it:\n\n${lawText || ''}\n\n${shareUrl}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  return `
    <div class="share-buttons">
      <a class="share-button share-twitter" href="${twitterUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on X" title="Share on X">
        <span class="icon share-icon" data-icon="twitter" aria-hidden="true"></span>
      </a>
      <a class="share-button share-facebook" href="${facebookUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" title="Share on Facebook">
        <span class="icon share-icon" data-icon="facebook" aria-hidden="true"></span>
      </a>
      <a class="share-button share-linkedin" href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" title="Share on LinkedIn">
        <span class="icon share-icon" data-icon="linkedin" aria-hidden="true"></span>
      </a>
      <a class="share-button share-reddit" href="${redditUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Reddit" title="Share on Reddit">
        <span class="icon share-icon" data-icon="reddit" aria-hidden="true"></span>
      </a>
      <a class="share-button share-email" href="${emailUrl}" aria-label="Share via Email" title="Share via Email">
        <span class="icon share-icon" data-icon="email" aria-hidden="true"></span>
      </a>
      <button type="button" class="share-button share-copy-text" data-action="copy-text" data-copy-value="${safeText}" data-law-id="${lawId}" aria-label="Copy text" title="Copy text">
        <span class="icon share-icon" data-icon="copy" aria-hidden="true"></span>
      </button>
      <button type="button" class="share-button share-copy-link" data-action="copy-link" data-copy-value="${shareUrl}" data-law-id="${lawId}" aria-label="Copy link" title="Copy link">
        <span class="icon share-icon" data-icon="link" aria-hidden="true"></span>
      </button>
    </div>
  `.trim();
}
