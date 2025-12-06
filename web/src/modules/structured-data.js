import { SITE_NAME, SITE_URL, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_SOD, SOCIAL_IMAGE_TOAST } from '@utils/constants.js';

const JSONLD_PREFIX = 'jsonld-';
const PAGE_IDS = new Set([
  'home-page',
  'browse-page',
  'law-article',
  'calculator-sod',
  'calculator-toast',
  'browse-page-breadcrumbs',
  'categories-page',
  'category-detail-page',
  'category-detail-breadcrumbs',
  'origin-story-article'
]);

function ensureJsonLdElement(id) {
  const elementId = `${JSONLD_PREFIX}${id}`;
  let el = document.head.querySelector(`#${elementId}`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = elementId;
    document.head.appendChild(el);
  }
  return el;
}

function pruneUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .map(pruneUndefined)
      .filter((item) => item !== undefined && item !== null);
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      const sanitized = pruneUndefined(val);
      if (sanitized !== undefined && sanitized !== null && (typeof sanitized !== 'object' || Object.keys(sanitized).length > 0)) {
        next[key] = sanitized;
      }
    });
    return next;
  }
  if (value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

export function setJsonLd(id, data) {
  if (!id || typeof data !== 'object' || data === null) {
    return;
  }
  const el = ensureJsonLdElement(id);
  const sanitized = pruneUndefined(data);
  el.textContent = JSON.stringify(sanitized, null, 2);
}

export function removeJsonLd(id) {
  if (!id) return;
  const elementId = `${JSONLD_PREFIX}${id}`;
  const el = document.head.querySelector(`#${elementId}`);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

export function clearPageStructuredData() {
  PAGE_IDS.forEach(removeJsonLd);
}

export function setSiteStructuredData() {
  setJsonLd('website', {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': SITE_NAME,
    'url': SITE_URL,
    'description': SITE_DEFAULT_DESCRIPTION,
    'publisher': {
      '@type': 'Person',
      'name': 'Raanan Avidor'
    },
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE_URL}/#/browse?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });

  setJsonLd('organization', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': SITE_NAME,
    'url': SITE_URL,
    'logo': `${SITE_URL}/favicon-512x512.png`,
    'sameAs': [
      'https://github.com/ravidor',
      'https://www.linkedin.com/in/raananavidor/'
    ]
  });
}

export function setHomeStructuredData() {
  clearPageStructuredData();
  setJsonLd('home-page', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': `${SITE_NAME} - Murphy's Laws, Corollaries & Calculators`,
    'url': SITE_URL,
    'description': SITE_DEFAULT_DESCRIPTION,
    'image': SITE_DEFAULT_SOCIAL_IMAGE,
    'hasPart': [
      {
        '@type': 'WebApplication',
        'name': "Sod's Law Calculator",
        'applicationCategory': 'CalculatorApplication',
        'url': `${SITE_URL}/#/calculator`
      },
      {
        '@type': 'WebApplication',
        'name': 'Buttered Toast Landing Calculator',
        'applicationCategory': 'CalculatorApplication',
        'url': `${SITE_URL}/#/toastcalculator`
      }
    ]
  });
}

export function setBrowseStructuredData() {
  clearPageStructuredData();
  setJsonLd('browse-page', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Browse Murphy\'s Laws',
    'url': `${SITE_URL}/#/browse`,
    'description': 'Filter and search hundreds of Murphy\'s Laws, corollaries, and variations.',
    'isPartOf': {
      '@id': `${SITE_URL}`
    }
  });

  // Add BreadcrumbList Schema for the browse page
  setJsonLd('browse-page-breadcrumbs', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_URL
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Browse Murphy\'s Laws',
        'item': `${SITE_URL}/#/browse`
      }
    ]
  });
}

export function setLawStructuredData(law) {
  if (!law) return;
  clearPageStructuredData();
  const lawUrl = `${SITE_URL}/#/law:${law.id}`;
  setJsonLd('law-article', {
    '@context': 'https://schema.org',
    '@type': ['Article', 'Quotation'],
    'headline': law.title || law.text.slice(0, 120),
    'description': law.text,
    'text': law.text, // For Quotation schema
    'speechToText': law.text, // For Quotation schema
    'datePublished': law.created_at || undefined,
    'dateModified': law.updated_at || law.created_at || undefined,
    'author': law.author ? {
      '@type': 'Person',
      'name': law.author
    } : undefined,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': lawUrl
    },
    'publisher': {
      '@type': 'Person',
      'name': 'Raanan Avidor'
    },
    'url': lawUrl
  });
}

export function setSodCalculatorStructuredData() {
  clearPageStructuredData();
  setJsonLd('calculator-sod', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'applicationCategory': 'CalculatorApplication',
    'operatingSystem': 'Web',
    'name': "Sod's Law Calculator",
    'url': `${SITE_URL}/#/calculator`,
    'description': 'Quantify the probability of Murphy\'s Law striking by balancing urgency, complexity, skill, and frequency.',
    'image': SOCIAL_IMAGE_SOD
  });
}

export function setToastCalculatorStructuredData() {
  clearPageStructuredData();
  setJsonLd('calculator-toast', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'applicationCategory': 'CalculatorApplication',
    'operatingSystem': 'Web',
    'name': 'Buttered Toast Landing Calculator',
    'url': `${SITE_URL}/#/toastcalculator`,
    'description': 'Simulate how height, gravity, and butter factor influence a toast landing butter-side down.',
    'image': SOCIAL_IMAGE_TOAST
  });
}

