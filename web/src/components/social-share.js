/**
 * Social Share Component
 * Renders social sharing buttons for Twitter, Facebook, LinkedIn, Reddit, and Email
 */

import { createIcon } from '../utils/icons.js';

/**
 * Create social share buttons
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to share (defaults to current page URL)
 * @param {string} options.title - Title/text to share (defaults to document title)
 * @param {string} options.description - Optional description for some platforms
 * @returns {HTMLElement} - Social share buttons container
 */
export function SocialShare({ url, title, description } = {}) {
  const el = document.createElement('div');
  el.className = 'share-buttons';

  // Use provided values or defaults
  const shareUrl = url || window.location.href;
  const shareTitle = title || document.title;
  const shareDescription = description || '';

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

  const platforms = [
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

  platforms.forEach(({ className, href, label, rel, target, iconName }) => {
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

  return el;
}
