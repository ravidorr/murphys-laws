// Origin Story view - displays a high-quality article about the origin of Murphy's Law

import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.js';
import { setJsonLd } from '@modules/structured-data.js';
import { SITE_URL, SITE_NAME } from '@utils/constants.js';
import { triggerAdSense } from '../utils/ads.js';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.js';
import { updateMetaDescription } from '@utils/dom.js';

export function OriginStory({ onNavigate } = {}) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  // Set page title and meta description
  document.title = `The True Origin of Murphy's Law | ${SITE_NAME}`;
  updateMetaDescription("Discover the true origin of Murphy's Law - Captain Edward A. Murphy Jr. and the 1949 Air Force rocket sled experiment that gave birth to the famous maxim.");

  el.innerHTML = getPageContent('origin-story');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  // Register export content
  setExportContent({
    type: ContentType.CONTENT,
    title: 'The True Origin of Murphy\'s Law',
    data: getRawMarkdownContent('origin-story')
  });

  // Set structured data for the article
  setJsonLd('origin-story-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': 'The True Origin of Murphy\'s Law',
    'description': 'Delve into the fascinating history and real-world events that gave birth to the universally recognized Murphy\'s Law.',
    'image': `${SITE_URL}/social/home.png`,
    'datePublished': '2023-01-01T00:00:00Z',
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
      '@id': `${SITE_URL}/origin-story`
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
  el.cleanup = () => {
    clearExportContent();
  };

  return el;
}
