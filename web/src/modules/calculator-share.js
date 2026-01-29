/**
 * Calculator Share Module
 * Handles the share popover functionality for calculators
 * Uses the same share options as laws: Twitter, Facebook, LinkedIn, Reddit, WhatsApp, Email, Copy text, Copy link
 */

/**
 * Initialize share popover for a calculator
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.root - Root element containing the share popover
 * @param {Function} options.getShareableUrl - Function that returns the shareable URL with calculation parameters
 * @param {Function} options.getShareText - Function that returns the share text for social platforms
 * @param {string} options.emailSubject - Subject line for email sharing
 * @returns {Function} Teardown function to remove event listeners
 */
export function initCalculatorSharePopover({ root, getShareableUrl, getShareText, emailSubject }) {
  if (!root) {
    throw new Error('initCalculatorSharePopover requires a root element');
  }

  const wrapper = root.querySelector('.share-wrapper.calculator-share');
  if (!wrapper) {
    return () => {};
  }

  const trigger = wrapper.querySelector('.share-trigger');
  const popover = wrapper.querySelector('.share-popover');
  const feedback = wrapper.querySelector('.share-copy-feedback');

  if (!trigger || !popover) {
    return () => {};
  }

  const listeners = [];

  function addListener(target, event, handler) {
    if (!target) return;
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }

  // Build share URLs for each platform
  function buildShareUrls() {
    const url = getShareableUrl();
    const text = getShareText();
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const encodedSubject = encodeURIComponent(emailSubject || 'Check out this calculation');
    const emailBody = encodeURIComponent(`I thought you'd like this:\n\n${text}\n\n${url}`);

    return {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText}`,
      reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      email: `mailto:?subject=${encodedSubject}&body=${emailBody}`
    };
  }

  // Update share link hrefs
  function updateShareLinks() {
    const urls = buildShareUrls();
    
    const shareLinks = popover.querySelectorAll('[data-share]');
    shareLinks.forEach(link => {
      const platform = link.dataset.share;
      if (urls[platform]) {
        link.href = urls[platform];
      }
    });
  }

  // Toggle popover
  function togglePopover(e) {
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
      // Update share links before opening
      updateShareLinks();

      // Check if popover would overflow viewport bottom
      const triggerRect = trigger.getBoundingClientRect();
      const popoverHeight = 320;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      
      if (spaceBelow < popoverHeight && triggerRect.top > popoverHeight) {
        popover.classList.add('popover-above');
      } else {
        popover.classList.remove('popover-above');
      }
      
      popover.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  // Show copy feedback
  function showCopyFeedback() {
    if (!feedback) return;
    feedback.classList.add('visible');
    setTimeout(() => {
      feedback.classList.remove('visible');
    }, 1500);
  }

  // Close popover
  function closePopover() {
    popover.classList.remove('open');
    popover.classList.remove('popover-above');
    trigger.setAttribute('aria-expanded', 'false');
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

    // Close popover after copy
    setTimeout(closePopover, 100);
  }

  // Handle popover clicks
  function handlePopoverClick(e) {
    // Stop propagation for all clicks inside popover to prevent
    // handleOutsideClick from immediately closing the popover
    e.stopPropagation();

    // Let links navigate, then close
    if (e.target.closest('a[data-share]')) {
      setTimeout(closePopover, 100);
      return;
    }
    // Handle copy buttons
    if (e.target.closest('[data-action]')) {
      handleCopyAction(e);
      return;
    }
  }

  // Close on outside click
  function handleOutsideClick() {
    if (popover.classList.contains('open')) {
      closePopover();
    }
  }

  // Close on Escape key
  function handleEscape(e) {
    if (e.key === 'Escape' && popover.classList.contains('open')) {
      closePopover();
    }
  }

  // Set up event listeners
  addListener(trigger, 'click', togglePopover);
  addListener(popover, 'click', handlePopoverClick);
  addListener(document, 'click', handleOutsideClick);
  addListener(document, 'keydown', handleEscape);

  // Initialize share links
  updateShareLinks();

  // Return teardown function
  return () => {
    listeners.forEach(unsubscribe => unsubscribe());
  };
}
