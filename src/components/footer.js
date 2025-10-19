import templateHtml from '@components/templates/footer.html?raw';

export function Footer({ onNavigate }) {
  const footer = document.createElement('footer');
  footer.className = 'footer';

  footer.innerHTML = templateHtml;

  // Initialize AdSense ad
  // Wrap in try-catch to silently handle "already initialized" errors
  // This happens on route changes when ads are already loaded
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // Silently ignore AdSense errors
  }

  footer.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  return footer;
}
