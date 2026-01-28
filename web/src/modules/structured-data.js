import { SITE_NAME, SITE_URL, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_SOD, SOCIAL_IMAGE_TOAST } from '@utils/constants.js';

const JSONLD_PREFIX = 'jsonld-';
const PAGE_IDS = new Set([
  'home-page',
  'browse-page',
  'law-article',
  'calculator-sod',
  'calculator-sod-faq',
  'calculator-toast',
  'calculator-toast-faq',
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
      'target': `${SITE_URL}/browse?q={search_term_string}`,
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
        'url': `${SITE_URL}/calculator/sods-law`
      },
      {
        '@type': 'WebApplication',
        'name': 'Buttered Toast Landing Calculator',
        'applicationCategory': 'CalculatorApplication',
        'url': `${SITE_URL}/calculator/buttered-toast`
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
    'url': `${SITE_URL}/browse`,
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
        'item': `${SITE_URL}/browse`
      }
    ]
  });
}

export function setLawStructuredData(law) {
  if (!law) return;
  clearPageStructuredData();
  const lawUrl = `${SITE_URL}/law/${law.id}`;
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
    'url': `${SITE_URL}/calculator/sods-law`,
    'description': 'Quantify the probability of Murphy\'s Law striking by balancing urgency, complexity, skill, and frequency.',
    'image': SOCIAL_IMAGE_SOD
  });

  // FAQ Schema for Sod's Law Calculator
  setJsonLd('calculator-sod-faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': "What is the Sod's Law Calculator?",
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "The Sod's Law Calculator estimates how likely your task is to go wrong based on five factors: urgency, complexity, importance, your skill level, and task frequency. It uses a mathematical formula to quantify Murphy's Law."
        }
      },
      {
        '@type': 'Question',
        'name': "How do I interpret my Sod's Law score?",
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "Probabilities range from 0.12 (barely cursed) to 8.6 (catastrophic). Scores below 2 mean you're probably safe. Scores between 2-4 are a bit risky. Scores between 4-6 are definitely worrying. Scores between 6-8 mean disaster is looming. Scores above 8 indicate catastrophe is almost certain."
        }
      },
      {
        '@type': 'Question',
        'name': "How can I reduce my Sod's Law probability?",
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "To reduce your probability score: cut urgency by questioning if everything really needs to ship today, break huge projects into smaller tasks to reduce complexity, reconsider if the task is truly critical to lower importance, build your skill level through practice, and batch low-stakes tasks together to reduce frequency."
        }
      }
    ]
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
    'url': `${SITE_URL}/calculator/buttered-toast`,
    'description': 'Simulate how height, gravity, and butter factor influence a toast landing butter-side down.',
    'image': SOCIAL_IMAGE_TOAST
  });

  // FAQ Schema for Buttered Toast Calculator
  setJsonLd('calculator-toast-faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'Why does toast always land butter-side down?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "Toast tends to land butter-side down due to physics: when toast slides off a table, it typically starts butter-side up and doesn't have enough time to complete a full rotation before hitting the floor. The standard table height of about 75cm gives the toast just enough time for a half rotation, resulting in a butter-side-down landing."
        }
      },
      {
        '@type': 'Question',
        'name': 'What factors affect how toast lands?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "The landing orientation is affected by: height of fall (higher tables allow more rotation), gravity (affects fall speed), initial overhang or push (how far the toast extended over the edge), butter factor (heavier butter side affects rotation), air friction, and the toast's moment of inertia."
        }
      },
      {
        '@type': 'Question',
        'name': 'How can I prevent my toast from landing butter-side down?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': "To prevent butter-side-down landings: eat at a higher table or counter (allowing a full rotation), catch the toast before it falls, or apply butter after you've safely secured your toast. The calculator shows that drop heights above 2 meters give toast time to complete a full rotation."
        }
      }
    ]
  });
}

