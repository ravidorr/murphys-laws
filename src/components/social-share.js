/**
 * Social Share Component
 * Renders social sharing buttons for Twitter, Facebook, LinkedIn, Reddit, and Email
 */

const ICON_PATHS = {
  twitter: '/social/x-twitter-brands-solid-full.svg',
  facebook: '/social/facebook-f-brands-solid-full.svg',
  linkedin: '/social/linkedin-in-brands-solid-full.svg',
  reddit: '/social/reddit-alien-brands-solid-full.svg',
  email: '/social/envelope-solid-full.svg'
};

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
      label: 'Share on Twitter',
      iconPath: ICON_PATHS.twitter,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-facebook',
      href: facebookUrl,
      label: 'Share on Facebook',
      iconPath: ICON_PATHS.facebook,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-linkedin',
      href: linkedinUrl,
      label: 'Share on LinkedIn',
      iconPath: ICON_PATHS.linkedin,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-reddit',
      href: redditUrl,
      label: 'Share on Reddit',
      iconPath: ICON_PATHS.reddit,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    {
      className: 'share-button share-email',
      href: emailUrl,
      label: 'Share via Email',
      iconPath: ICON_PATHS.email,
    },
  ];

  el.innerHTML = platforms
    .map(({ className, href, label, rel, target, iconPath }) => {
      const relAttr = rel ? ` rel="${rel}"` : '';
      const targetAttr = target ? ` target="${target}"` : '';
      return `
        <a class="${className}" href="${href}" aria-label="${label}" title="${label}"${targetAttr}${relAttr}>
          <img src="${iconPath}" class="share-icon" alt="" aria-hidden="true" />
        </a>
      `;
    })
    .join('');

  return el;
}
