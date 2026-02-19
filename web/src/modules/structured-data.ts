import { SITE_NAME, SITE_URL, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_SOD, SOCIAL_IMAGE_TOAST } from '@utils/constants.ts';
import type { Law } from '../types/app.d.ts';

const JSONLD_PREFIX = 'jsonld-';
const PAGE_IDS = new Set([
  'home-page',
  'browse-page',
  'law-article',
  'calculator-sod',
  'calculator-sod-howto',
  'calculator-toast',
  'calculator-toast-howto',
  'browse-page-breadcrumbs',
  'categories-page',
  'category-detail-page',
  'category-detail-breadcrumbs',
  'category-detail-itemlist',
  'origin-story-article',
  'examples-article',
  'speakable'
]);

function ensureJsonLdElement(id: string): Element {
  const elementId = `${JSONLD_PREFIX}${id}`;
  let el = document.head.querySelector(`#${elementId}`);
  if (!el) {
    el = document.createElement('script');
    (el as HTMLScriptElement).type = 'application/ld+json';
    el.id = elementId;
    document.head.appendChild(el);
  }
  return el;
}

function pruneUndefined(value: unknown): unknown {
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

export function setJsonLd(id: string, data: Record<string, unknown>): void {
  if (!id || typeof data !== 'object' || data === null) {
    return;
  }
  const el = ensureJsonLdElement(id);
  const sanitized = pruneUndefined(data);
  el.textContent = JSON.stringify(sanitized, null, 2);
}

export function removeJsonLd(id: string): void {
  if (!id) return;
  const elementId = `${JSONLD_PREFIX}${id}`;
  const el = document.head.querySelector(`#${elementId}`);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

export function clearPageStructuredData(): void {
  PAGE_IDS.forEach(removeJsonLd);
}

export function setSiteStructuredData(): void {
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

export function setHomeStructuredData(): void {
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
        'url': `${SITE_URL}/calculator`
      },
      {
        '@type': 'WebApplication',
        'name': 'Buttered Toast Landing Calculator',
        'applicationCategory': 'CalculatorApplication',
        'url': `${SITE_URL}/toastcalculator`
      }
    ]
  });
}

export function setBrowseStructuredData(): void {
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

export function setLawStructuredData(law: Law): void {
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
    'url': lawUrl,
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': ['.law-text', '.card-title', '.attribution']
    }
  });
}

export function setSodCalculatorStructuredData(): void {
  clearPageStructuredData();
  setJsonLd('calculator-sod', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'applicationCategory': 'CalculatorApplication',
    'operatingSystem': 'Web',
    'name': "Sod's Law Calculator",
    'url': `${SITE_URL}/calculator/sods-law`,
    'description': 'Quantify the probability of Murphy\'s Law striking by balancing urgency, complexity, skill, and frequency.',
    'image': SOCIAL_IMAGE_SOD,
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': ['.calc-description', '#score-interpretation', '.calc-info-summary']
    }
  });

  // HowTo schema for calculator usage
  setJsonLd('calculator-sod-howto', {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': "How to Use the Sod's Law Calculator",
    'description': "Calculate the probability of things going wrong for any task using Murphy's Law principles.",
    'totalTime': 'PT2M',
    'step': [
      {
        '@type': 'HowToStep',
        'position': 1,
        'name': 'Set Urgency',
        'text': 'Adjust the Urgency slider from 1-9 based on how time-sensitive your task is. Higher urgency increases failure probability.'
      },
      {
        '@type': 'HowToStep',
        'position': 2,
        'name': 'Set Complexity',
        'text': 'Set the Complexity slider based on how many steps or components your task involves. More complex tasks are more likely to fail.'
      },
      {
        '@type': 'HowToStep',
        'position': 3,
        'name': 'Set Importance',
        'text': 'Adjust Importance to reflect how critical the task is. Murphy\'s Law tends to strike hardest when stakes are highest.'
      },
      {
        '@type': 'HowToStep',
        'position': 4,
        'name': 'Set Your Skill Level',
        'text': 'Rate your skill level for this task. Higher skill reduces the probability of failure.'
      },
      {
        '@type': 'HowToStep',
        'position': 5,
        'name': 'Set Frequency',
        'text': 'Indicate how often you perform this task. Frequent tasks have cumulative failure risk.'
      },
      {
        '@type': 'HowToStep',
        'position': 6,
        'name': 'Read Your Score',
        'text': 'View your calculated probability score. Scores range from 0.12 (low risk) to 8.6 (catastrophic risk).'
      }
    ]
  });
}

export function setToastCalculatorStructuredData(): void {
  clearPageStructuredData();
  setJsonLd('calculator-toast', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'applicationCategory': 'CalculatorApplication',
    'operatingSystem': 'Web',
    'name': 'Buttered Toast Landing Calculator',
    'url': `${SITE_URL}/calculator/buttered-toast`,
    'description': 'Simulate how height, gravity, and butter factor influence a toast landing butter-side down.',
    'image': SOCIAL_IMAGE_TOAST,
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': ['.calc-description', '#toast-interpretation', '.calc-info-summary']
    }
  });

  // HowTo schema for calculator usage
  setJsonLd('calculator-toast-howto', {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': 'How to Use the Buttered Toast Landing Calculator',
    'description': 'Calculate the probability of your toast landing butter-side down based on physics.',
    'totalTime': 'PT2M',
    'step': [
      {
        '@type': 'HowToStep',
        'position': 1,
        'name': 'Set Drop Height',
        'text': 'Adjust the height slider to match the height from which your toast falls (typically table height, around 75cm).'
      },
      {
        '@type': 'HowToStep',
        'position': 2,
        'name': 'Set Gravity',
        'text': 'Adjust gravity if simulating on other planets. Earth gravity is 980 cm/s².'
      },
      {
        '@type': 'HowToStep',
        'position': 3,
        'name': 'Set Push Force',
        'text': 'Set how far the toast overhangs or how hard it was pushed off the edge. This affects initial rotation.'
      },
      {
        '@type': 'HowToStep',
        'position': 4,
        'name': 'Set Butter Factor',
        'text': 'Adjust for the amount of butter. More butter shifts the center of mass and affects rotation.'
      },
      {
        '@type': 'HowToStep',
        'position': 5,
        'name': 'Set Air Friction',
        'text': 'Adjust air friction to simulate different conditions. Higher friction slows rotation.'
      },
      {
        '@type': 'HowToStep',
        'position': 6,
        'name': 'Read the Result',
        'text': 'View the probability percentage. Higher percentages mean your toast is more likely to land butter-side down.'
      }
    ]
  });
}

/**
 * Set ItemList schema for category detail pages
 * @param {Object} options - Configuration options
 * @param {string} options.categoryTitle - Title of the category
 * @param {string} options.categorySlug - URL slug of the category
 * @param {Array} options.laws - Array of law objects
 */
export function setCategoryItemListSchema({ categoryTitle, categorySlug, laws }: { categoryTitle: string; categorySlug: string; laws: Law[] }): void {
  if (!laws || laws.length === 0) {
    clearPageStructuredData();
    return;
  }
  
  const categoryUrl = `${SITE_URL}/category/${categorySlug}`;
  
  const itemListElements = laws.slice(0, 10).map((law, index) => ({
    '@type': 'ListItem',
    'position': index + 1,
    'item': {
      '@type': 'Quotation',
      'name': law.title || `Murphy's Law #${law.id}`,
      'text': law.text,
      'url': `${SITE_URL}/law/${law.id}`
    }
  }));
  
  setJsonLd('category-detail-itemlist', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': `${categoryTitle} - Murphy's Laws`,
    'description': `Collection of Murphy's Laws related to ${categoryTitle}`,
    'url': categoryUrl,
    'numberOfItems': laws.length,
    'itemListElement': itemListElements
  });
}
