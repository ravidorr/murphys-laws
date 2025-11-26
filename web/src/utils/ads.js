/**
 * Dynamically loads the Google AdSense script.
 * This is used to defer loading until after the main content has rendered,
 * preventing "Google-served ads on screens without publisher-content" violations.
 */
export function initAdSense() {
  // Prevent double loading
  if (window.adsbygoogle || document.querySelector('script[src*="adsbygoogle"]')) {
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3615614508734124';
  script.async = true;
  script.crossOrigin = 'anonymous';

  script.onerror = () => {
    console.warn('AdSense failed to load');
  };

  document.head.appendChild(script);
}
