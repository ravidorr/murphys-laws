// Origin Story view - displays a high-quality article about the origin of Murphy's Law

import templateHtml from '@views/templates/origin-story.html?raw';
import { setJsonLd } from '@modules/structured-data.js';
import { SITE_URL } from '@utils/constants.js';

export function OriginStory({ _onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  el.innerHTML = templateHtml;

  // Set structured data for the article
  setJsonLd('origin-story-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': 'The True Origin of Murphy\'s Law',
    'description': 'Delve into the fascinating history and real-world events that gave birth to the universally recognized Murphy\'s Law.',
    'image': `${SITE_URL}/social/home.png`, // Placeholder image
    'datePublished': '2023-01-01T00:00:00Z', // Placeholder date
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
      '@id': `${SITE_URL}/#/origin-story`
    }
  });

  return el;
}
