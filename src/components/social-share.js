/**
 * Social Share Component
 * Renders social sharing buttons for Twitter, Facebook, LinkedIn, Reddit, and Email
 */

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

  el.innerHTML = `
    <a class="share-button share-twitter" href="${twitterUrl}" target="_blank" rel="noopener noreferrer" title="Share on Twitter">
      <i class="fab fa-twitter"></i>
    </a>
    <a class="share-button share-facebook" href="${facebookUrl}" target="_blank" rel="noopener noreferrer" title="Share on Facebook">
      <i class="fab fa-facebook-f"></i>
    </a>
    <a class="share-button share-linkedin" href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" title="Share on LinkedIn">
      <i class="fab fa-linkedin-in"></i>
    </a>
    <a class="share-button share-reddit" href="${redditUrl}" target="_blank" rel="noopener noreferrer" title="Share on Reddit">
      <i class="fab fa-reddit-alien"></i>
    </a>
    <a class="share-button share-email" href="${emailUrl}" title="Share via Email">
      <i class="fas fa-envelope"></i>
    </a>
  `;

  return el;
}
