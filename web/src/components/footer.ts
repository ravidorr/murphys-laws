import templateHtml from '@components/templates/footer.html?raw';
import { APP_VERSION } from '@utils/app-version.ts';
import { ensureAdsense, scheduleWhenIdle } from '@utils/third-party.ts';
import { hasMinimumContent } from '@utils/ads.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { isKindleBrowser } from '@utils/legacy-display.ts';
import type { OnNavigate } from '../types/app.d.ts';

export function Footer({ onNavigate, hideAds = false }: { onNavigate: OnNavigate; hideAds?: boolean }) {
  const footer = document.createElement('footer');
  footer.className = 'footer';

  footer.innerHTML = templateHtml;

  const versionElement = footer.querySelector<HTMLElement>('[data-app-version]')!;
  versionElement.textContent = `Version: ${APP_VERSION}`;

  // Hydrate icons (for RSS icon)
  hydrateIcons(footer);

  const adHost = footer.querySelector('[data-ad-slot]') as HTMLElement | null;
  const adsDisabled = hideAds || isKindleBrowser();

  if (adHost && adsDisabled) {
    adHost.classList.add('hidden');
  }

  // Don't load ads if explicitly disabled (e.g., 404 pages)
  if (adHost && !adsDisabled) {
    let observer: IntersectionObserver | undefined;

    const showShellAndLoadAd = () => {
      adHost.classList.remove('hidden');
      loadAd();
    };

    const loadAd = () => {
      if (adHost.dataset.loaded === 'true') {
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

    const scheduleAd = () => {
      // Hide the "Advertisement" placeholder until we are about to load; show only when triggering.
      adHost.classList.add('hidden');

      if (typeof window.IntersectionObserver === 'function') {
        // Observe the footer so we trigger when it nears view (shell is hidden so has no box).
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              showShellAndLoadAd();
              break;
            }
          }
        }, { rootMargin: '0px 0px 200px 0px' });

        observer.observe(footer);
      }
    };

    const primeAd = () => {
      if (adHost.dataset.loaded === 'true') {
        return;
      }

      // Check if page has sufficient content before loading ads
      // This prevents ads on empty states, 404 pages, etc.
      const mainContent = document.querySelector<HTMLElement>('main');
      if (!mainContent || !hasMinimumContent(mainContent)) {
        adHost.classList.add('hidden');
        return; // Don't load ads if content is insufficient
      }

      scheduleAd();

      // The ad no longer waits for a click or keystroke: it loads on its own once the page has loaded and
      // the browser is idle. This moves the start off the first interaction; it does not guarantee the work
      // never overlaps input (an idle callback with a timeout can fire on a busy thread, and the ad
      // iframe renders when the ad response arrives).
      scheduleWhenIdle(() => {
        // Skip if the ad already loaded (footer scrolled near view) or this footer was replaced by navigation
        if (adHost.dataset.loaded === 'true' || !footer.isConnected) {
          return;
        }
        // Re-check content at trigger time in case page changed
        const mainEl = document.querySelector<HTMLElement>('main');
        if (!mainEl || !hasMinimumContent(mainEl)) {
          adHost.classList.add('hidden');
          return;
        }
        showShellAndLoadAd();
      });
    };

    footer.addEventListener('adslot:init', () => {
      showShellAndLoadAd();
    }, { once: true });

    if (document.readyState === 'complete') {
      primeAd();
    } else {
      window.addEventListener('load', primeAd, { once: true });
    }
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
