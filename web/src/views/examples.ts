// Examples view - displays real-life Murphy's Law examples

import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.ts';
import { setJsonLd } from '@modules/structured-data.ts';
import { SITE_URL, SITE_NAME } from '@utils/constants.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

export function Examples({ onNavigate }: { onNavigate?: OnNavigate } = {}): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  // Set page title and meta description
  document.title = `Murphy's Law Examples: Real-Life Situations | ${SITE_NAME}`;
  updateMetaDescription("Discover real-life Murphy's Law examples from technology, work, travel, and everyday life. See how 'anything that can go wrong, will go wrong' applies to daily situations.");

  el.innerHTML = getPageContent('examples');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  // Register export content
  setExportContent({
    type: ContentType.CONTENT,
    title: 'Murphy\'s Law Examples',
    data: getRawMarkdownContent('examples')
  });

  // Set structured data for the article
  setJsonLd('examples-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': 'Murphy\'s Law Examples: Real-Life Situations Where Anything Can Go Wrong',
    'description': 'Real-life Murphy\'s Law examples from technology, work, travel, and everyday situations demonstrating how anything that can go wrong, will go wrong.',
    'image': `${SITE_URL}/social/home.png`,
    'datePublished': '2024-01-01T00:00:00Z',
    'dateModified': new Date().toISOString(),
    'author': {
      '@type': 'Person',
      'name': 'Raanan Avidor'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Murphy\'s Law Archive',
      'logo': {
        '@type': 'ImageObject',
        'url': `${SITE_URL}/favicon-512x512.png`
      }
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/examples`
    }
  });

  // Handle navigation clicks
  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const navBtn = target.closest('[data-nav]');
    if (navBtn && onNavigate) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup =() => {
    clearExportContent();
  };

  return el;
}
