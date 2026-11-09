import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { marked } from 'marked';
import { CALCULATOR_META_DESCRIPTIONS } from '../src/utils/constants.ts';
import {
  wrapFirstWordWithAccent,
  enhanceMarkdownHtml,
  wrapInCardStructure,
  CONTENT_PAGES,
  buildStaticFavoritesContent,
  buildStaticSubmitContent,
  buildStaticCalculatorContent,
  buildStaticLawDetailContent,
  buildStaticArticleArchive,
  buildStaticHomeContent,
  buildNotFoundPage,
  validateNotFoundPage,
  applyPageMetadata,
  generateLawPage,
  buildSitemapXml,
  validateGeneratedPage,
  injectBreadcrumbJsonLd,
  buildContentBreadcrumbTrail,
  fetchAllCategories,
  fetchAllLaws,
  fetchFirstPageOfLaws,
  mergeReviewedLawDetails,
  REVIEWED_LAW_TITLES,
  categorySitemapPaths,
  pickRelatedLaws,
  renderLawLinkList
} from '@scripts/ssg';

const metadataTemplate = `<!doctype html><html><head>
<title>Home</title>
<meta name="description" content="Home description">
<link rel="canonical" href="https://murphys-laws.com/">
<link rel="alternate" hreflang="en" href="https://murphys-laws.com/">
<link rel="alternate" hreflang="x-default" href="https://murphys-laws.com/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://murphys-laws.com/">
<meta property="og:title" content="Home">
<meta property="og:description" content="Home description">
<meta property="og:image" content="https://murphys-laws.com/social/home.png">
<meta property="twitter:url" content="https://murphys-laws.com/">
<meta property="twitter:title" content="Home">
<meta property="twitter:description" content="Home description">
<meta property="twitter:image" content="https://murphys-laws.com/social/home.png">
</head><body><h1>Home</h1></body></html>`;

describe('SSG Utilities', () => {
  it('applies consistent route metadata to every social and canonical field', () => {
    const result = applyPageMetadata(metadataTemplate, {
      title: 'Submit a Law',
      description: 'Submit a reviewed law.',
      canonicalPath: '/submit',
      type: 'article'
    });

    expect(result).toContain('<title>Submit a Law</title>');
    expect(result).toContain('rel="canonical" href="https://murphys-laws.com/submit"');
    expect(result).toContain('property="og:title" content="Submit a Law"');
    expect(result).toContain('property="twitter:description" content="Submit a reviewed law."');
    expect(result).not.toContain('Home description');
  });

  it('rejects duplicate headings, contributor email links, and missing category navigation', () => {
    const invalid = metadataTemplate
      .replace('</body>', '<h1>Duplicate</h1><a href="mailto:person@example.com">Email</a></body>');

    expect(validateGeneratedPage(invalid, {
      canonicalPath: '/',
      forbidContactDetails: true,
      requireCategoryLink: true
    })).toEqual(expect.arrayContaining([
      'expected one h1, found 2',
      'contains a public mailto link',
      'missing navigable category link'
    ]));
  });

  describe('contact details in generated pages', () => {
    const check = (body: string) => validateGeneratedPage(
      metadataTemplate.replace('</body>', `${body}</body>`),
      { canonicalPath: '/', forbidContactDetails: true }
    );

    it.each([
      ['a bare address in a law text', '<p class="law-text">Sent by Karacourt@aol.com.</p>'],
      ['an address whose domain contains an image extension', '<p>Sent by pic@png.example.com</p>'],
      ['an address with a dotted domain and plus tag', '<p>Sent by first.last+tag@interactive.rogers.com</p>'],
      ['an address as an attribution name', '<p class="attribution">- Eppeguy@aol.com</p>']
    ])('rejects %s', (_label, body) => {
      expect(check(body)).toContain('contains a public email address');
    });

    it.each([
      ['a link cut inside the mailto target', '<h2>Sent [by Takura Razemba](mailto</h2>'],
      ['MAILTO in capitals', '<a href="MAILTO:x">x</a>'],
      ['a mailto link', '<a href="mailto:person@example.com">Email</a>']
    ])('rejects %s', (_label, body) => {
      expect(check(body)).toContain('contains a public mailto link');
    });

    it.each([
      ['an image name with a pixel ratio', '<img src="/img/logo@2x.png" alt="">'],
      ['an upper-case image name', '<img src="/img/LOGO@2X.PNG" alt="">'],
      ['asset names with other extensions', '<link href="/s/sprite@2x.css"><script src="/a/app@1.js"></script><link href="/f/font@1.woff2">'],
      ['an image name with another extension', '<img src="/img/hero@3x.webp" alt=""><img src="/img/a@2x.jpeg" alt="">'],
      ['JSON-LD keywords', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Quotation"}</script>'],
      ['a symbol-laden word', '<p>that mother@#?!&amp;* upside the head</p>'],
      ['a handle', '<p>Follow @murphyslaws today</p>']
    ])('accepts %s', (_label, body) => {
      expect(check(body)).toEqual([]);
    });

    it('reports a mailto link and an address together', () => {
      expect(check('<a href="mailto:person@example.com">x</a>')).toEqual([
        'contains a public mailto link',
        'contains a public email address'
      ]);
    });

    it('does not apply to pages that are not checked for contact details', () => {
      const html = metadataTemplate.replace('</body>', '<p>Write to contact@murphys-laws.com</p></body>');
      expect(validateGeneratedPage(html, { canonicalPath: '/' })).toEqual([]);
    });
  });

  it('keeps calculator meta descriptions unique, sized for search results, and plain text', () => {
    const descriptions = Object.values(CALCULATOR_META_DESCRIPTIONS);

    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThanOrEqual(150);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description).not.toMatch(/[–—]/);
      expect(description).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('requires route description, og:description, and twitter:description to match', () => {
    const description = CALCULATOR_META_DESCRIPTIONS.sodsLaw;
    const matching = applyPageMetadata(metadataTemplate, {
      title: 'Calculator',
      description,
      canonicalPath: '/calculator/sods-law'
    });

    expect(validateGeneratedPage(matching, { canonicalPath: '/calculator/sods-law', description }))
      .not.toContain('og:description does not match the route description');
    expect(validateGeneratedPage(metadataTemplate, { canonicalPath: '/', description }))
      .toEqual(expect.arrayContaining([
        'description does not match the route description',
        'og:description does not match the route description',
        'twitter:description does not match the route description'
      ]));
  });

  it('requires the article photo on pages that should have one', () => {
    const withFigure = metadataTemplate.replace(
      '</body>',
      '<figure class="content-figure"><img src="/img/sledtrk.jpg" alt="Sled"></figure></body>'
    );

    expect(validateGeneratedPage(metadataTemplate, { canonicalPath: '/', requireContentFigure: true }))
      .toContain('missing article photo');
    expect(validateGeneratedPage(withFigure, { canonicalPath: '/', requireContentFigure: true }))
      .not.toContain('missing article photo');
  });

  describe('wrapFirstWordWithAccent', () => {
    it('wraps first word with accent-text span for multi-word text', () => {
      const result = wrapFirstWordWithAccent('About Murphy\'s Law');
      expect(result).toBe('<span class="accent-text">About</span> Murphy\'s Law');
    });

    it('wraps single word with accent-text span', () => {
      const result = wrapFirstWordWithAccent('Contact');
      expect(result).toBe('<span class="accent-text">Contact</span>');
    });

    it('handles empty string', () => {
      const result = wrapFirstWordWithAccent('');
      expect(result).toBe('<span class="accent-text"></span>');
    });
  });

  describe('enhanceMarkdownHtml', () => {
    it('wraps h1 first word with accent-text', () => {
      const html = '<h1>About Us</h1>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<h1><span class="accent-text">About</span> Us</h1>');
    });

    it('wraps h2 first word and creates section', () => {
      const html = '<h2>Our Mission</h2><p>Some content</p>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<section class="content-section">');
      expect(result).toContain('<h2><span class="accent-text">Our</span> Mission</h2>');
    });

    it('wraps h3 first word with accent-text', () => {
      const html = '<h3>Sub Section</h3>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<h3><span class="accent-text">Sub</span> Section</h3>');
    });

    it('handles multiple h2 sections correctly', () => {
      const html = '<h1>Title</h1><h2>Section One</h2><p>Content 1</p><h2>Section Two</h2><p>Content 2</p>';
      const result = enhanceMarkdownHtml(html);
      
      // Should have two content-section wrappers
      const sectionCount = (result.match(/<section class="content-section">/g) || []).length;
      expect(sectionCount).toBe(2);
      
      // Should close sections properly
      expect(result).toContain('</section>');
    });

    it('removes orphaned closing section tag before first section', () => {
      const html = '<h1>Title</h1><h2>First Section</h2>';
      const result = enhanceMarkdownHtml(html);
      
      // Should not start with </section>
      expect(result.trim().startsWith('</section>')).toBe(false);
    });
  });

  describe('wrapInCardStructure', () => {
    it('extracts h1 into card-header', () => {
      const html = '<h1>Page Title</h1><p>Body content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<h1>Page Title</h1>');
      expect(result).toContain('</header>');
    });

    it('extracts first paragraph as lead text', () => {
      const html = '<h1>Title</h1><p>Lead paragraph text.</p><p>More content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<p class="lead">Lead paragraph text.</p>');
      expect(result).toContain('<div class="card-body">');
    });

    it('puts remaining content in card-body', () => {
      const html = '<h1>Title</h1><p>Lead text</p><section>Body section</section>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Body section');
      expect(result).toContain('</div>');
    });

    it('wraps in article with content-card class', () => {
      const html = '<h1>Title</h1><p>Content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<article class="card card--content content-card">');
      expect(result).toContain('</article>');
    });

    it('includes lastUpdated when provided', () => {
      const html = '<h1>Privacy Policy</h1><p>Lead text</p>';
      const result = wrapInCardStructure(html, { lastUpdated: '2025-01-15' });
      
      expect(result).toContain('<p class="small">Last updated: 2025-01-15</p>');
    });

    it('omits lastUpdated when not provided', () => {
      const html = '<h1>About</h1><p>Lead text</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).not.toContain('Last updated');
    });

    it('handles HTML without h1 by wrapping all in card-body', () => {
      const html = '<p>Just some content without a heading</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<article class="card card--content content-card">');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Just some content without a heading');
      expect(result).not.toContain('<header');
    });

    it('handles h1 without following paragraph', () => {
      const html = '<h1>Title Only</h1><section>Section content</section>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<h1>Title Only</h1>');
      expect(result).not.toContain('<p class="lead">');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Section content');
    });

    it('handles complex HTML with enhanced markdown', () => {
      const html = '<h1><span class="accent-text">About</span> Murphy\'s Law</h1>' +
        '<p>Welcome to the archive.</p>' +
        '<section class="content-section"><h2>Our Mission</h2><p>To preserve laws.</p></section>';
      
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<span class="accent-text">About</span>');
      expect(result).toContain('<p class="lead">Welcome to the archive.</p>');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('content-section');
    });
  });
});

describe('SSG Static Route Content', () => {
  it('uses the category API as the sitemap source of truth', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { slug: 'murphys-computer-laws', title: "Murphy's Computer Laws", law_count: 161 },
          { slug: 'murphys-law-of-the-open-road', title: "Murphy's Law of the Open Road", law_count: 20 }
        ]
      })
    });

    const categories = await fetchAllCategories(fetchRequest);

    expect(categorySitemapPaths(categories)).toEqual([
      '/category/murphys-computer-laws',
      '/category/murphys-law-of-the-open-road'
    ]);
    expect(categorySitemapPaths(categories)).not.toContain('/category/murphys-computers-laws');
  });

  it('includes developers as a generated content page', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toContain('developers');
  });

  it('includes SEO hub pages as generated content pages', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toEqual(expect.arrayContaining([
      'best-murphys-laws',
      'funniest-murphys-laws',
      'murphys-laws-about-work',
      'murphys-laws-about-technology',
      'murphys-law-vs-sods-law'
    ]));
  });

  it('includes examples subpages as generated content pages', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toEqual(expect.arrayContaining([
      'examples/work',
      'examples/travel',
      'examples/tech',
      'examples/everyday-life'
    ]));
  });

  it('renders a useful static favorites empty state', () => {
    const html = buildStaticFavoritesContent();

    expect(html).toContain('My Favorites');
    expect(html).toContain('stored in your browser');
    expect(html).toContain('/browse');
    expect(html).not.toMatch(/Loading favorites/i);
  });

  it('renders static submit guidance with moderation and attribution copy', () => {
    const html = buildStaticSubmitContent();

    expect(html).toContain("Submit a Murphy's Law");
    expect(html).toMatch(/reviewed by a human/i);
    expect(html).toMatch(/attribution/i);
    expect(html).toContain('/contact');
    expect(html).not.toMatch(/Loading the archive/i);
  });

  it('renders static calculator explainer content for Sod and toast calculators', () => {
    const sod = buildStaticCalculatorContent('sods-law');
    const toast = buildStaticCalculatorContent('buttered-toast');

    expect(sod).toContain("Sod's Law Calculator");
    expect(sod).toMatch(/Urgency/i);
    expect(sod).toMatch(/for entertainment/i);
    expect(toast).toContain('Buttered Toast');
    expect(toast).toMatch(/assumptions/i);
    expect(toast).toMatch(/simulator/i);
  });

  it('renders law detail pages as destination pages', () => {
    const html = buildStaticLawDetailContent({
      id: 42,
      title: 'Test Law',
      text: 'Anything tested can fail.',
      category_slug: 'murphys-technology-laws',
      category_name: "Murphy's Technology Laws",
      attributions: [{ name: 'QA Engineer' }],
      upvotes: 7,
      downvotes: 2,
      editorial: {
        explanation: 'A reviewed explanation.',
        practical_example: 'A practical example.',
        source_label: 'Primary source',
        source_url: 'https://example.com/source',
        reviewed_at: '2026-07-21'
      }
    });

    expect(html).toContain('Anything tested can fail.');
    expect(html).toContain('QA Engineer');
    expect(html).toMatch(/Source status/i);
    expect(html).toMatch(/In context/i);
    expect(html).toMatch(/Related laws/i);
    expect(html).toContain('card--section law-detail-card');
    expect(html).toContain('/category/murphys-technology-laws');
    expect(html).toContain('/examples/tech');
    expect(html).toContain('Technology hub');
    expect(html).toContain('/contact');
    expect(html).toContain('A reviewed explanation.');
    expect(html).toContain('https://example.com/source');
    expect(html).toContain('datetime="2026-07-21"');
  });

  it('renders static homepage content around the primary loops', () => {
    const html = buildStaticHomeContent();

    expect(html).toContain('Search the Archive');
    expect(html).toContain('Human-reviewed');
    expect(html).toContain('submissions');
    expect(html).toContain('since 1998');
    expect(html).toContain('home-proof-point');
    expect(html).toContain('/categories');
    expect(html).toContain('/submit');
    expect(html).toContain('Trending</span> Now');
    expect(html).not.toMatch(/Loading/i);
  });

  it('keeps words separated without relying on flex gap in static home markup', () => {
    const html = buildStaticHomeContent();

    expect(html).toContain('<strong>Complete</strong> <span>archive</span>');
    expect(html).toContain('<strong>Human-reviewed</strong> <span>submissions</span>');
  });

  it('renders a featured law in the static Law of the Day zone', () => {
    const html = buildStaticHomeContent({ id: 7, text: 'Everything takes longer.', upvotes: 1, downvotes: 0 });

    expect(html).toContain('/law/7');
    expect(html).toContain('Everything takes longer.');
    expect(html).toContain('Browse the full archive');
    expect(html).not.toContain('Enable JavaScript');
  });

  it('shows an accurate fallback when no law is available for the static Law of the Day zone', () => {
    const html = buildStaticHomeContent();

    expect(html).toContain('could not be loaded');
    expect(html).not.toContain('Enable JavaScript');
  });

  it('renders the article archive row and the top three laws from the featured category', () => {
    const laws = [
      { id: 1, text: 'Low scorer', upvotes: 1, downvotes: 1, category_slug: 'murphys-laws' },
      { id: 2, text: 'If anything can go wrong, it will.', upvotes: 9, downvotes: 0, category_slug: 'murphys-laws' },
      { id: 3, text: 'Office law', upvotes: 50, downvotes: 0, category_slug: 'murphys-office-laws' },
      { id: 4, text: 'Tied on score, more upvotes', upvotes: 6, downvotes: 2, category_slug: 'murphys-laws' },
      { id: 5, text: 'Tied on score, fewer upvotes', upvotes: 4, downvotes: 0, category_slug: 'murphys-laws' },
      { id: 6, text: 'No votes yet', category_slug: 'murphys-laws' }
    ];

    const { nextSteps, featuredLaws } = buildStaticArticleArchive('origin-story', laws);

    expect(nextSteps).toContain('class="section card card--section section-card article-next-steps" aria-label="Explore the archive"');
    expect(nextSteps).toContain('<a href="/category/murphys-laws" class="btn primary article-cta article-cta--category" data-nav="category/murphys-laws">');
    expect(featuredLaws).toContain('card card--law-list law-list-card law-list-card--reserved article-featured-laws');
    expect(featuredLaws).toContain('<span class="accent-text">Laws</span> behind this story');
    expect(featuredLaws.match(/law-card-mini/g)).toHaveLength(3);
    expect(featuredLaws).not.toContain('Office law');
    expect(featuredLaws).not.toContain('Low scorer');
    expect(featuredLaws.indexOf('If anything can go wrong')).toBeLessThan(featuredLaws.indexOf('more upvotes'));
    expect(featuredLaws.indexOf('more upvotes')).toBeLessThan(featuredLaws.indexOf('fewer upvotes'));
    expect(featuredLaws).toContain('href="/law/2"');
    expect(featuredLaws).toContain("See all Murphy's Laws");
    expect(featuredLaws).toContain('href="/submit"');
  });

  it('keeps the archive row when the featured category has no laws and skips unmapped pages', () => {
    const laws = [{ id: 9, text: 'Office law', upvotes: 1, downvotes: 0, category_slug: 'murphys-office-laws' }];

    expect(buildStaticArticleArchive('examples/travel', laws)).toEqual({
      nextSteps: expect.stringContaining('/category/murphys-travel-laws'),
      featuredLaws: ''
    });
    expect(buildStaticArticleArchive('about', laws)).toEqual({ nextSteps: '', featuredLaws: '' });
  });

  it('opens external Markdown links in a new tab and keeps site links in place', () => {
    const html = marked.parse('[Wikipedia](https://en.wikipedia.org/wiki/Murphy%27s_law) and [the archive](/browse)', { async: false });

    expect(html).toContain('<a href="https://en.wikipedia.org/wiki/Murphy%27s_law" target="_blank" rel="noopener noreferrer">Wikipedia<span class="visually-hidden"> (opens in a new tab)</span></a>');
    expect(html).toContain('<a href="/browse">the archive</a>');
  });
  it('injects absolute BreadcrumbList data with a client-matching script id', () => {
    const html = injectBreadcrumbJsonLd('<html><head></head></html>', 'calculator-sod-breadcrumbs', [
      { name: "Sod's Law Calculator", path: '/calculator/sods-law' }
    ]);
    const match = html.match(/<script type="application\/ld\+json" id="jsonld-calculator-sod-breadcrumbs">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const data = JSON.parse(match![1]!);

    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://murphys-laws.com' },
      { '@type': 'ListItem', position: 2, name: "Sod's Law Calculator", item: 'https://murphys-laws.com/calculator/sods-law' }
    ]);
    expect(html.indexOf('</script>')).toBeLessThan(html.indexOf('</head>'));
  });

  it('builds content breadcrumb trails with examples subpages nested under Examples', () => {
    expect(buildContentBreadcrumbTrail({ slug: 'about', title: 'About' })).toEqual([{ name: 'About', path: '/about' }]);
    expect(buildContentBreadcrumbTrail({ slug: 'examples/work', title: 'Work Examples' })).toEqual([
      { name: "Murphy's Law Examples", path: '/examples' },
      { name: 'Work Examples', path: '/examples/work' }
    ]);
    for (const page of CONTENT_PAGES) {
      const trail = buildContentBreadcrumbTrail(page);
      expect(trail[trail.length - 1]!.path).toBe(`/${page.slug}`);
    }
  });
});

describe('buildNotFoundPage', () => {
  const shell = `<!doctype html><html><head>
<title>Home</title>
<meta name="description" content="Home description">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://murphys-laws.com/">
<link rel="alternate" hreflang="en" href="https://murphys-laws.com/">
<link rel="alternate" hreflang="x-default" href="https://murphys-laws.com/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://murphys-laws.com/">
<meta property="og:title" content="Home">
<meta property="og:description" content="Home description">
<meta property="og:image" content="https://murphys-laws.com/social/home.png">
<meta property="twitter:url" content="https://murphys-laws.com/">
<meta property="twitter:title" content="Home">
<meta property="twitter:description" content="Home description">
<meta property="twitter:image" content="https://murphys-laws.com/social/home.png">
</head><body><header class="site-header">Header</header>
<main id="main-content" class="flex-1 container page" aria-label="Main content"><p>Loading</p></main>
</body></html>`;

  it('keeps the site shell and is noindex', () => {
    const html = buildNotFoundPage(shell, []);
    expect(html).toContain('<header class="site-header">Header</header>');
    expect(html).toContain('<title>Page Not Found - Murphy&#039;s Laws</title>');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('Loading');
  });

  it('keeps the canonical, hreflang, og:url and twitter:url tags so the app can update them', () => {
    const html = buildNotFoundPage(shell, []);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('property="twitter:url"');
  });

  it('passes validation for its own output and flags a bad page', () => {
    expect(validateNotFoundPage(buildNotFoundPage(shell, []))).toEqual([]);
    expect(validateNotFoundPage('<html><h1>a</h1><h1>b</h1></html>')).toEqual([
      'missing noindex',
      'missing 404 content',
      'expected one h1',
    ]);
  });

  it('renders the 404 content with suggested laws', () => {
    const html = buildNotFoundPage(shell, [{ id: 5, text: 'Anything can fail.' } as never]);
    expect(html).toContain('class="not-found-code"');
    expect(html).toContain('href="/law/5"');
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
  });
});

describe('SSG SEO output', () => {
  const lawTemplate = metadataTemplate
    .replace('<head>', '<head><meta name="robots" content="index, follow">')
    .replace('<body>', '<body><main class="flex-1 container page"><p>Loading</p></main>');

  it('applies a robots override only when requested', () => {
    const indexable = applyPageMetadata(lawTemplate, { title: 'A', description: 'B', canonicalPath: '/a' });
    expect(indexable).toContain('<meta name="robots" content="index, follow">');
    const hidden = applyPageMetadata(lawTemplate, { title: 'A', description: 'B', canonicalPath: '/a', robots: 'noindex, follow' });
    expect(hidden).toContain('<meta name="robots" content="noindex, follow">');
    expect(hidden).not.toContain('<meta name="robots" content="index, follow">');
  });

  it('gives generic-title laws a unique title and description from their text', () => {
    const law = { id: 2464, title: "Murphy's Law", text: "Night vision - isn't.", category_name: 'Military', category_slug: 'military' };
    const html = generateLawPage(law, lawTemplate);
    expect(html).toContain("<title>Night vision - isn&#039;t - Murphy&#039;s Law Archive</title>");
    expect(html).toContain('A Murphy&#039;s Law from the Military category.');
    expect(html).toContain('"headline": "Night vision - isn\'t"');
    expect(html).toContain('"@type": "BreadcrumbList"');
  });

  it('advertises the oEmbed endpoint on every law page', () => {
    const html = generateLawPage({ id: 31, title: 'Hofstadter', text: 'It takes longer.' }, lawTemplate);
    expect(html).toContain('<link rel="alternate" type="application/json+oembed" href="https://murphys-laws.com/api/v1/oembed?url=https%3A%2F%2Fmurphys-laws.com%2Flaw%2F31"');
  });

  describe('buildSitemapXml', () => {
    const xml = buildSitemapXml({
      baseUrl: 'https://murphys-laws.com',
      laws: [
        { id: 1, category_slug: 'tech', updated_at: '2026-05-01T10:00:00Z', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, category_slug: 'tech', created_at: '2026-03-01T00:00:00Z' },
        { id: 3 }
      ],
      categories: [{ slug: 'tech', title: 'Technology', law_count: 2 }, { slug: 'empty', title: 'Empty', law_count: 0 }],
      contentPages: [
        { slug: 'about', file: 'about.md', title: 'About', description: 'About' },
        { slug: 'examples', file: 'examples.md', title: 'Examples', description: 'Examples' }
      ],
      contentMetadata: { about: { lastUpdated: '2025-03-09' }, examples: {} },
      staticRoutePaths: ['calculator/sods-law']
    });

    it('omits changefreq and priority', () => {
      expect(xml).not.toContain('changefreq');
      expect(xml).not.toContain('priority');
    });

    it('does not list non-indexable routes', () => {
      expect(xml).not.toContain('/favorites');
      expect(xml).toContain('https://murphys-laws.com/calculator/sods-law');
    });

    it('derives lastmod from real dates', () => {
      expect(xml).toContain('<loc>https://murphys-laws.com/about</loc>\n    <lastmod>2025-03-09</lastmod>');
      expect(xml).toContain('<loc>https://murphys-laws.com/law/1</loc>\n    <lastmod>2026-05-01</lastmod>');
      expect(xml).toContain('<loc>https://murphys-laws.com/category/tech</loc>\n    <lastmod>2026-05-01</lastmod>');
      expect(xml).toContain('<loc>https://murphys-laws.com/</loc>\n    <lastmod>2026-05-01</lastmod>');
    });

    it('does not invent dates for URLs with no known date', () => {
      expect(xml).toContain('<loc>https://murphys-laws.com/category/empty</loc>\n  </url>');
      expect(xml).toContain('<loc>https://murphys-laws.com/law/3</loc>\n  </url>');
      expect(xml).toContain('<loc>https://murphys-laws.com/calculator/sods-law</loc>\n  </url>');
      expect(xml).toContain('<loc>https://murphys-laws.com/examples</loc>\n  </url>');
    });

    it('leaves lastmod out of an entry only when no date is known', () => {
      const bare = buildSitemapXml({
        baseUrl: 'https://murphys-laws.com',
        laws: [],
        categories: [],
        contentPages: [{ slug: 'about', file: 'about.md', title: 'About', description: 'About' }],
        contentMetadata: {},
        staticRoutePaths: []
      });
      expect(bare).not.toContain('lastmod');
      expect(bare).toContain('<loc>https://murphys-laws.com/about</loc>');
    });
  });

  describe('pickRelatedLaws', () => {
    const ring = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

    it('never picks the law itself and returns three distinct laws', () => {
      const laws = ring(50);
      for (const law of laws) {
        const related = pickRelatedLaws(law, laws);
        expect(related).toHaveLength(3);
        expect(new Set(related.map((r) => r.id)).size).toBe(3);
        expect(related.map((r) => r.id)).not.toContain(law.id);
      }
    });

    it('links every law in a category from exactly three others', () => {
      const laws = ring(228);
      const inbound = new Map<number, number>();
      for (const law of laws) {
        for (const related of pickRelatedLaws(law, laws)) inbound.set(related.id, (inbound.get(related.id) || 0) + 1);
      }
      expect(inbound.size).toBe(228);
      expect([...inbound.values()].every((count) => count === 3)).toBe(true);
    });

    it('is deterministic and uses the next law, then strides further on', () => {
      const laws = ring(100);
      expect(pickRelatedLaws(laws[0]!, laws).map((r) => r.id)).toEqual([2, 11, 21]);
      expect(pickRelatedLaws(laws[98]!, laws).map((r) => r.id)).toEqual([100, 9, 19]);
    });

    it('fills from the following laws in small categories', () => {
      expect(pickRelatedLaws({ id: 1 }, ring(4)).map((r) => r.id)).toEqual([2, 3, 4]);
      expect(pickRelatedLaws({ id: 1 }, ring(3)).map((r) => r.id)).toEqual([2, 3]);
      expect(pickRelatedLaws({ id: 1 }, ring(2)).map((r) => r.id)).toEqual([2]);
    });

    it('returns nothing for a category of one and falls back to the head of the list for a law not in it', () => {
      expect(pickRelatedLaws({ id: 1 }, ring(1))).toEqual([]);
      expect(pickRelatedLaws({ id: 99 }, ring(10)).map((r) => r.id)).toEqual([1, 2, 3]);
      expect(pickRelatedLaws({ id: 1 }, [])).toEqual([]);
    });
  });

  describe('renderLawLinkList', () => {
    it('renders escaped labels as links, using the unique SEO headline when there is one', () => {
      const seo = new Map([['5', { title: 't', description: 'd', headline: 'Unique <b> headline' }]]);
      const html = renderLawLinkList([
        { id: 5, title: 'Murphy\'s Law', text: 'Anything that can go wrong will.' },
        { id: 6, title: 'Sod\'s Law', text: 'Toast lands butter side down every single time you drop it.' }
      ], seo);
      expect(html).toContain('<li><a href="/law/5">Unique &lt;b&gt; headline</a></li>');
      expect(html).toContain('<a href="/law/6">');
      expect(html.match(/<li>/g)).toHaveLength(2);
    });

    it('renders nothing for no laws', () => {
      expect(renderLawLinkList([], new Map())).toBe('');
    });
  });
});

describe('SSG law data from the API', () => {
  type Reply = { ok: boolean; status: number; json(): Promise<unknown> };
  const reply = (body: unknown, status = 200): Reply => ({ ok: status < 400, status, json: async () => body });
  const law = (id: number, extra: Record<string, unknown> = {}) => ({ id, title: `Law ${id}`, text: `Text ${id}`, ...extra });

  describe('fetchAllLaws', () => {
    it('pages through the API until every law is read and asks for an order that votes cannot change', async () => {
      const request = vi.fn()
        .mockResolvedValueOnce(reply({ data: [law(1), law(2)], total: 3 }))
        .mockResolvedValueOnce(reply({ data: [law(3)], total: 3 }));

      const laws = await fetchAllLaws(request, 'https://api.test');

      expect(laws.map((item) => item.id).sort()).toEqual([1, 2, 3]);
      expect(request).toHaveBeenNthCalledWith(1, 'https://api.test/api/v1/laws?limit=100&offset=0&sort=created_at&order=asc');
      expect(request).toHaveBeenNthCalledWith(2, 'https://api.test/api/v1/laws?limit=100&offset=2&sort=created_at&order=asc');
    });

    it('returns laws in the API default order, highest score first', async () => {
      const request = vi.fn().mockResolvedValue(reply({
        data: [law(1, { score: 1, upvotes: 1 }), law(2, { score: 5, upvotes: 9 }), law(3, { score: 5, upvotes: 9 }), law(4, { score: 5, upvotes: 2 }), law(5)],
        total: 5
      }));

      const laws = await fetchAllLaws(request, 'https://api.test');

      expect(laws.map((item) => item.id)).toEqual([3, 2, 4, 1, 5]);
    });

    it('throws when the API answers with an error, instead of building a site with no law pages', async () => {
      await expect(fetchAllLaws(vi.fn().mockResolvedValue(reply({}, 503)), 'https://api.test')).rejects.toThrow('Law API returned 503');
    });

    it('throws when the API cannot be reached', async () => {
      await expect(fetchAllLaws(vi.fn().mockRejectedValue(new TypeError('fetch failed')), 'https://api.test')).rejects.toThrow('fetch failed');
    });

    it.each([
      ['no data array', { total: 1 }],
      ['no total', { data: [law(1)] }],
      ['a total that is not a number', { data: [law(1)], total: '1' }],
    ])('throws on a payload with %s', async (_name, body) => {
      await expect(fetchAllLaws(vi.fn().mockResolvedValue(reply(body)), 'https://api.test')).rejects.toThrow('unexpected payload');
    });

    it('throws when the API has no laws', async () => {
      await expect(fetchAllLaws(vi.fn().mockResolvedValue(reply({ data: [], total: 0 })), 'https://api.test')).rejects.toThrow('no laws');
    });

    it('throws when the pages add up to fewer laws than the total', async () => {
      const request = vi.fn()
        .mockResolvedValueOnce(reply({ data: [law(1), law(2)], total: 5 }))
        .mockResolvedValueOnce(reply({ data: [], total: 5 }));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow('2 of 5 laws');
    });

    it('throws when a later page fails, not only the first', async () => {
      const request = vi.fn()
        .mockResolvedValueOnce(reply({ data: [law(1)], total: 2 }))
        .mockResolvedValueOnce(reply({}, 503));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow('Law API returned 503');
    });

    it.each([
      ['a total that is not a whole number', { data: [law(1)], total: Number.NaN }],
      ['a negative total', { data: [law(1)], total: -1 }],
      ['a law without an ID', { data: [{ title: 'No ID' }], total: 1 }],
      ['a null entry', { data: [null], total: 1 }],
    ])('throws on %s', async (_name, body) => {
      await expect(fetchAllLaws(vi.fn().mockResolvedValue(reply(body)), 'https://api.test')).rejects.toThrow('unexpected payload');
    });

    it('throws when the API returns more laws than its total', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [law(1), law(2), law(3)], total: 2 }));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow('3 of 2 laws');
    });

    it('treats a missing score as zero when sorting', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [law(1, { score: -1 }), law(2), law(3, { score: 1 })], total: 3 }));

      expect((await fetchAllLaws(request, 'https://api.test')).map((item) => item.id)).toEqual([3, 2, 1]);
    });

    it('throws when the total changes while the pages are read, because a page boundary may have shifted', async () => {
      const request = vi.fn()
        .mockResolvedValueOnce(reply({ data: [law(1), law(2)], total: 3 }))
        .mockResolvedValueOnce(reply({ data: [law(3)], total: 2 }));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow('total changed from 3 to 2');
    });

    it('stops instead of looping when the API ignores the offset and keeps sending the same page', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [law(1), law(2)], total: 5 }));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow(/more than once|of 5 laws/);
      expect(request.mock.calls.length).toBeLessThan(10);
    });

    it('throws when one law came back twice', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [law(1), law(1)], total: 2 }));

      await expect(fetchAllLaws(request, 'https://api.test')).rejects.toThrow('more than once');
    });
  });

  describe('fetchFirstPageOfLaws', () => {
    it('asks for the first page, in the API default order, with the category when one is given', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [law(1)], total: 1 }));

      const page = await fetchFirstPageOfLaws({ limit: 25, category_slug: 'murphys-laws', category_id: 3 }, request, 'https://api.test');

      expect(page).toEqual({ data: [law(1)], total: 1 });
      expect(request).toHaveBeenCalledWith('https://api.test/api/v1/laws?limit=25&offset=0&sort=score&order=desc&category_id=3&category_slug=murphys-laws');
    });

    it('accepts a page that is empty because the category has no laws', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [], total: 0 }));

      expect(await fetchFirstPageOfLaws({ limit: 25 }, request, 'https://api.test')).toEqual({ data: [], total: 0 });
    });

    it('throws when the API answers with an error, instead of building a page with no laws on it', async () => {
      await expect(fetchFirstPageOfLaws({ limit: 25 }, vi.fn().mockResolvedValue(reply({}, 503)), 'https://api.test')).rejects.toThrow('Law API returned 503');
    });

    it('throws when the request itself fails', async () => {
      await expect(fetchFirstPageOfLaws({ limit: 25 }, vi.fn().mockRejectedValue(new TypeError('fetch failed')), 'https://api.test')).rejects.toThrow('fetch failed');
    });

    it.each([
      ['data that is not a list', { data: 'x', total: 1 }],
      ['no total', { data: [] }],
      ['a total that is not a number', { data: [], total: '3' }],
      ['a negative total', { data: [], total: -1 }],
    ])('throws on %s', async (_name, body) => {
      await expect(fetchFirstPageOfLaws({ limit: 25 }, vi.fn().mockResolvedValue(reply(body)), 'https://api.test')).rejects.toThrow('unexpected payload');
    });

    it('throws on an empty page that comes with a positive total', async () => {
      const request = vi.fn().mockResolvedValue(reply({ data: [], total: 40 }));

      await expect(fetchFirstPageOfLaws({ limit: 25 }, request, 'https://api.test')).rejects.toThrow('reports 40');
    });
  });

  describe('mergeReviewedLawDetails', () => {
    const annotation = { explanation: 'e', practical_example: 'p', source_label: 's', source_url: 'https://example.com', reviewed_at: '2026-07-21' };
    // Production numbers these laws 2381 and up; a freshly built archive numbers them 2, 4, 8 and so on
    const reviewedLaws = () => REVIEWED_LAW_TITLES.map((title, index) => law(2381 + index, { title }));

    function detailRequest(annotatedIds: number[], status = 200) {
      return vi.fn(async (url: string) => {
        const id = Number(url.split('/').pop());
        return reply(annotatedIds.includes(id) ? { ...law(id), editorial: annotation } : law(id), status);
      });
    }

    it('keeps the list unchanged when there are no laws', async () => {
      const request = vi.fn();
      expect(await mergeReviewedLawDetails([], request, 'https://api.test')).toEqual([]);
      expect(request).not.toHaveBeenCalled();
    });

    it('finds each reviewed law by title, whatever its ID, and merges its annotation', async () => {
      const laws = [law(1), ...reviewedLaws()];
      const request = detailRequest(laws.slice(1).map((item) => item.id));

      const merged = await mergeReviewedLawDetails(laws, request, 'https://api.test');

      expect(merged).toHaveLength(laws.length);
      expect(merged[0]).toEqual(law(1));
      expect(merged.slice(1).every((item) => item.editorial?.explanation === 'e')).toBe(true);
      expect(request).toHaveBeenCalledWith('https://api.test/api/v1/laws/2381');
      expect(request).not.toHaveBeenCalledWith('https://api.test/api/v1/laws/2');
    });

    it('matches titles without regard to case or surrounding space', async () => {
      const laws = reviewedLaws().map((item, index) => index === 0 ? { ...item, title: `  ${item.title!.toUpperCase()} ` } : item);

      const merged = await mergeReviewedLawDetails(laws, detailRequest(laws.map((item) => item.id)), 'https://api.test');

      expect(merged[0]!.editorial).toBeDefined();
    });

    it('picks the annotated law when another law shares the title', async () => {
      const laws = [...reviewedLaws(), law(974, { title: REVIEWED_LAW_TITLES[12] })];
      const request = detailRequest(reviewedLaws().map((item) => item.id));

      const merged = await mergeReviewedLawDetails(laws, request, 'https://api.test');

      expect(merged.find((item) => item.id === 974)!.editorial).toBeUndefined();
      expect(merged.find((item) => item.id === 2381 + 12)!.editorial).toBeDefined();
    });

    it('throws when a reviewed law is not in the list', async () => {
      const laws = reviewedLaws().slice(1);

      await expect(mergeReviewedLawDetails(laws, detailRequest([]), 'https://api.test')).rejects.toThrow(`"${REVIEWED_LAW_TITLES[0]}" is not in the API law list`);
    });

    it('throws instead of dropping reviewed content when the annotation is missing', async () => {
      const laws = reviewedLaws();

      await expect(mergeReviewedLawDetails(laws, detailRequest([]), 'https://api.test')).rejects.toThrow('missing its editorial annotation');
    });

    it('throws when two laws with the same title both carry an annotation', async () => {
      const laws = [...reviewedLaws(), law(974, { title: REVIEWED_LAW_TITLES[0] })];

      await expect(mergeReviewedLawDetails(laws, detailRequest(laws.map((item) => item.id)), 'https://api.test')).rejects.toThrow('more than one law');
    });

    it('keeps the list fields of a reviewed law that the detail answer leaves out', async () => {
      const laws = reviewedLaws().map((item, index) => index === 0 ? { ...item, score: 5, category_slug: 'murphys-laws' } : item);
      const request = vi.fn(async (url: string) => {
        const id = Number(url.split('/').pop());
        return reply({ id, title: laws.find((item) => item.id === id)!.title, editorial: annotation });
      });

      const merged = await mergeReviewedLawDetails(laws, request, 'https://api.test');

      expect(merged[0]).toMatchObject({ score: 5, category_slug: 'murphys-laws', editorial: annotation });
    });

    it('throws when the detail answer is for a different law than the one asked for', async () => {
      const request = vi.fn(async () => reply({ ...law(1), editorial: annotation }));

      await expect(mergeReviewedLawDetails(reviewedLaws(), request, 'https://api.test')).rejects.toThrow('API answered with law 1');
    });

    it('lists exactly the laws that migration 016 annotates, once each', () => {
      const migration = readFileSync(resolve(__dirname, '..', '..', 'backend', 'db', 'migrations', '016_add_reviewed_law_annotations.sql'), 'utf8');
      const slugs = [...migration.matchAll(/WHERE slug = '([^']+)'/g)].map((match) => match[1]);
      const slugify = (title: string) => title.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      expect(new Set(REVIEWED_LAW_TITLES).size).toBe(REVIEWED_LAW_TITLES.length);
      expect(REVIEWED_LAW_TITLES.map(slugify).sort()).toEqual([...slugs].sort());
    });

    it('throws when a detail request fails', async () => {
      await expect(mergeReviewedLawDetails(reviewedLaws(), detailRequest([], 500), 'https://api.test')).rejects.toThrow('API returned 500');
    });
  });
});
