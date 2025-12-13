import templateHtml from '@components/templates/footer.html?raw';
import { ensureAdsense } from '@utils/third-party.js';
import { hasMinimumContent } from '@utils/ads.js';

export function Footer({ onNavigate, hideAds = false }) {
  const footer = document.createElement('footer');
  footer.className = 'footer';

  footer.innerHTML = templateHtml;

  const adHost = footer.querySelector('[data-ad-slot]');

  // Don't load ads if explicitly disabled (e.g., 404 pages, insufficient content)
  if (adHost && !hideAds) {
    let observer;

    const loadAd = () => {
      if (!adHost || adHost.dataset.loaded === 'true') {
        return;
      }

      adHost.dataset.loaded = 'true';

      if (observer) {
        observer.disconnect();
        observer = undefined;
      }

      ensureAdsense().catch(() => {
        // Ignore ads script load failures
      });

      const ad = document.createElement('ins');
      ad.className = 'adsbygoogle footer-ad';
      ad.style.display = 'block';
      ad.setAttribute('data-ad-client', 'ca-pub-3615614508734124');
      ad.setAttribute('data-ad-slot', '4091490183');
      ad.setAttribute('data-ad-format', 'auto');
      ad.setAttribute('data-full-width-responsive', 'true');

      adHost.innerHTML = '';
      adHost.appendChild(ad);

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Silently ignore AdSense errors
      }
    };

    const defer = (cb) => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(cb, { timeout: 1500 });
      } else {
        window.setTimeout(cb, 1200);
      }
    };

    const scheduleAd = () => {
      if (!adHost) {
        return;
      }

      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              loadAd();
              break;
            }
          }
        }, { rootMargin: '0px 0px 200px 0px' });

        observer.observe(adHost);
      } else {
        defer(loadAd);
      }
    };

    const primeAd = () => {
      if (adHost.dataset.loaded === 'true') {
        return;
      }

      // Check if page has sufficient content before loading ads
      // This prevents ads on empty states, 404 pages, etc.
      const mainContent = document.querySelector('main');
      if (!hasMinimumContent(mainContent)) {
        return; // Don't load ads if content is insufficient
      }

      scheduleAd();

      const triggerOnce = () => {
        // Re-check content at trigger time in case page changed
        if (!hasMinimumContent(document.querySelector('main'))) {
          return;
        }
        loadAd();
      };

      window.addEventListener('pointerdown', triggerOnce, { once: true });
      window.addEventListener('keydown', triggerOnce, { once: true });
      window.addEventListener('scroll', triggerOnce, { once: true, passive: true });
    };

    footer.addEventListener('adslot:init', () => {
      loadAd();
    }, { once: true });

    if (document.readyState === 'complete') {
      primeAd();
    } else {
      window.addEventListener('load', primeAd, { once: true });
    }
  }

  footer.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

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
