import {
  setJsonLd,
  removeJsonLd,
  clearPageStructuredData,
  setSiteStructuredData,
  setHomeStructuredData,
  setBrowseStructuredData,
  setLawStructuredData,
  setSodCalculatorStructuredData,
  setToastCalculatorStructuredData
} from '../src/modules/structured-data.js';

describe('Structured Data module', () => {
  beforeEach(() => {
    // Clear any existing JSON-LD scripts
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
      el.remove();
    });
  });

  afterEach(() => {
    // Clean up after each test
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
      el.remove();
    });
  });

  describe('setJsonLd', () => {
    it('creates a script element with JSON-LD data', () => {
      setJsonLd('test', { '@type': 'WebSite', name: 'Test' });

      const el = document.head.querySelector('#jsonld-test');
      expect(el).toBeTruthy();
      expect((el as HTMLScriptElement).type).toBe('application/ld+json');

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('WebSite');
      expect(data.name).toBe('Test');
    });

    it('updates existing element if id already exists', () => {
      setJsonLd('test', { name: 'First' });
      setJsonLd('test', { name: 'Second' });

      const elements = document.head.querySelectorAll('#jsonld-test');
      expect(elements.length).toBe(1);

      const data = JSON.parse(elements[0].textContent);
      expect(data.name).toBe('Second');
    });

    it('does nothing if id is empty', () => {
      setJsonLd('', { name: 'Test' });

      const el = document.head.querySelector('#jsonld-');
      expect(el).toBeFalsy();
    });

    it('does nothing if data is not an object', () => {
      setJsonLd('test', 'string' as unknown as Record<string, unknown>);

      const el = document.head.querySelector('#jsonld-test');
      expect(el).toBeFalsy();
    });

    it('does nothing if data is null', () => {
      setJsonLd('test', null as unknown as Record<string, unknown>);

      const el = document.head.querySelector('#jsonld-test');
      expect(el).toBeFalsy();
    });

    it('prunes undefined values from data', () => {
      setJsonLd('test', {
        name: 'Test',
        description: undefined,
        url: 'https://example.com'
      });

      const el = document.head.querySelector('#jsonld-test');
      const data = JSON.parse(el.textContent);

      expect(data.name).toBe('Test');
      expect(data.url).toBe('https://example.com');
      expect(data.description).toBeUndefined();
    });

    it('prunes null values from data', () => {
      setJsonLd('test', {
        name: 'Test',
        description: null,
        url: 'https://example.com'
      });

      const el = document.head.querySelector('#jsonld-test');
      const data = JSON.parse(el.textContent);

      expect(data.name).toBe('Test');
      expect(data.url).toBe('https://example.com');
      expect(data.description).toBeUndefined();
    });

    it('prunes undefined values from nested objects', () => {
      setJsonLd('test', {
        name: 'Test',
        author: {
          '@type': 'Person',
          name: 'John',
          email: undefined
        }
      });

      const el = document.head.querySelector('#jsonld-test');
      const data = JSON.parse(el.textContent);

      expect(data.author.name).toBe('John');
      expect(data.author.email).toBeUndefined();
    });

    it('prunes undefined values from arrays', () => {
      setJsonLd('test', {
        name: 'Test',
        items: ['one', undefined, 'two', null, 'three']
      });

      const el = document.head.querySelector('#jsonld-test');
      const data = JSON.parse(el.textContent);

      expect(data.items).toEqual(['one', 'two', 'three']);
    });

    it('handles NaN values', () => {
      setJsonLd('test', {
        name: 'Test',
        value: NaN
      });

      const el = document.head.querySelector('#jsonld-test');
      const data = JSON.parse(el.textContent);

      expect(data.value).toBeUndefined();
    });
  });

  describe('removeJsonLd', () => {
    it('removes JSON-LD element by id', () => {
      setJsonLd('test', { name: 'Test' });
      expect(document.head.querySelector('#jsonld-test')).toBeTruthy();

      removeJsonLd('test');
      expect(document.head.querySelector('#jsonld-test')).toBeFalsy();
    });

    it('does nothing if element does not exist', () => {
      expect(() => removeJsonLd('nonexistent')).not.toThrow();
    });

    it('does nothing if id is empty', () => {
      expect(() => removeJsonLd('')).not.toThrow();
    });

    it('does nothing if id is null', () => {
      expect(() => removeJsonLd(null)).not.toThrow();
    });
  });

  describe('clearPageStructuredData', () => {
    it('removes all page-specific JSON-LD elements', () => {
      setJsonLd('home-page', { name: 'Home' });
      setJsonLd('browse-page', { name: 'Browse' });
      setJsonLd('law-article', { name: 'Law' });
      setJsonLd('calculator-sod', { name: 'Sod' });
      setJsonLd('calculator-toast', { name: 'Toast' });
      setJsonLd('examples-article', { name: 'Examples' });

      clearPageStructuredData();

      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
      expect(document.head.querySelector('#jsonld-browse-page')).toBeFalsy();
      expect(document.head.querySelector('#jsonld-law-article')).toBeFalsy();
      expect(document.head.querySelector('#jsonld-calculator-sod')).toBeFalsy();
      expect(document.head.querySelector('#jsonld-calculator-toast')).toBeFalsy();
      expect(document.head.querySelector('#jsonld-examples-article')).toBeFalsy();
    });

    it('does not remove site-wide elements', () => {
      setJsonLd('website', { name: 'Website' });
      setJsonLd('organization', { name: 'Org' });
      setJsonLd('home-page', { name: 'Home' });

      clearPageStructuredData();

      expect(document.head.querySelector('#jsonld-website')).toBeTruthy();
      expect(document.head.querySelector('#jsonld-organization')).toBeTruthy();
      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
    });
  });

  describe('setSiteStructuredData', () => {
    it('creates website structured data', () => {
      setSiteStructuredData();

      const el = document.head.querySelector('#jsonld-website');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('WebSite');
      expect(data.name).toBeTruthy();
      expect(data.url).toBeTruthy();
      expect(data.description).toBeTruthy();
    });

    it('creates organization structured data', () => {
      setSiteStructuredData();

      const el = document.head.querySelector('#jsonld-organization');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('Organization');
      expect(data.name).toBeTruthy();
      expect(data.url).toBeTruthy();
    });

    it('includes SearchAction in website data', () => {
      setSiteStructuredData();

      const el = document.head.querySelector('#jsonld-website');
      const data = JSON.parse(el.textContent);

      expect(data.potentialAction).toBeTruthy();
      expect(data.potentialAction['@type']).toBe('SearchAction');
    });

    it('includes publisher in website data', () => {
      setSiteStructuredData();

      const el = document.head.querySelector('#jsonld-website');
      const data = JSON.parse(el.textContent);

      expect(data.publisher).toBeTruthy();
      expect(data.publisher['@type']).toBe('Person');
      expect(data.publisher.name).toBe('Raanan Avidor');
    });
  });

  describe('setHomeStructuredData', () => {
    it('creates home page structured data', () => {
      setHomeStructuredData();

      const el = document.head.querySelector('#jsonld-home-page');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('CollectionPage');
      expect(data.name).toMatch(/Murphy's Laws/);
    });

    it('includes calculators in hasPart', () => {
      setHomeStructuredData();

      const el = document.head.querySelector('#jsonld-home-page');
      const data = JSON.parse(el.textContent);

      expect(data.hasPart).toBeTruthy();
      expect(data.hasPart.length).toBe(2);
      expect(data.hasPart[0]['@type']).toBe('WebApplication');
      expect(data.hasPart[1]['@type']).toBe('WebApplication');
    });

    it('clears previous page data', () => {
      setJsonLd('browse-page', { name: 'Browse' });
      setHomeStructuredData();

      expect(document.head.querySelector('#jsonld-browse-page')).toBeFalsy();
    });
  });

  describe('setBrowseStructuredData', () => {
    it('creates browse page structured data', () => {
      setBrowseStructuredData();

      const el = document.head.querySelector('#jsonld-browse-page');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('CollectionPage');
      expect(data.name).toMatch(/Browse Murphy's Laws/);
    });

    it('includes isPartOf reference', () => {
      setBrowseStructuredData();

      const el = document.head.querySelector('#jsonld-browse-page');
      const data = JSON.parse(el.textContent);

      expect(data.isPartOf).toBeTruthy();
      expect(data.isPartOf['@id']).toBeTruthy();
    });

    it('clears previous page data', () => {
      setJsonLd('home-page', { name: 'Home' });
      setBrowseStructuredData();

      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
    });
  });

  describe('setLawStructuredData', () => {
    it('creates law article structured data', () => {
      const law = {
        id: 123,
        title: 'Murphy\'s Law',
        text: 'Anything that can go wrong, will.',
        author: 'Murphy',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toEqual(['Article', 'Quotation']);
      expect(data.headline).toBe('Murphy\'s Law');
      expect(data.description).toBe('Anything that can go wrong, will.');
    });

    it('uses text slice as headline if no title', () => {
      const law = {
        id: 123,
        text: 'A very long law text that exceeds one hundred and twenty characters and should be truncated when used as headline',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      const data = JSON.parse(el.textContent);

      expect(data.headline).toBe(law.text.slice(0, 120));
    });

    it('includes author if provided', () => {
      const law = {
        id: 123,
        text: 'Test law',
        author: 'Edward Murphy',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      const data = JSON.parse(el.textContent);

      expect(data.author).toBeTruthy();
      expect(data.author.name).toBe('Edward Murphy');
    });

    it('handles missing author gracefully', () => {
      const law = {
        id: 123,
        text: 'Test law',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      const data = JSON.parse(el.textContent);

      expect(data.author).toBeUndefined();
    });

    it('does nothing if law is null', () => {
      setLawStructuredData(null);

      const el = document.head.querySelector('#jsonld-law-article');
      expect(el).toBeFalsy();
    });

    it('clears previous page data', () => {
      setJsonLd('home-page', { name: 'Home' });

      const law = { id: 123, text: 'Test', created_at: '2024-01-01' };
      setLawStructuredData(law);

      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
    });

    it('uses created_at for dateModified if updated_at is missing', () => {
      const law = {
        id: 123,
        text: 'Test law',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      const data = JSON.parse(el.textContent);

      expect(data.dateModified).toBe('2024-01-01');
    });

    it('includes speakable specification for voice search', () => {
      const law = {
        id: 123,
        title: 'Murphy\'s Law',
        text: 'Anything that can go wrong, will.',
        created_at: '2024-01-01'
      };

      setLawStructuredData(law);

      const el = document.head.querySelector('#jsonld-law-article');
      const data = JSON.parse(el.textContent);

      expect(data.speakable).toBeTruthy();
      expect(data.speakable['@type']).toBe('SpeakableSpecification');
      expect(data.speakable.cssSelector).toBeInstanceOf(Array);
      expect(data.speakable.cssSelector).toContain('.law-text');
    });
  });

  describe('setSodCalculatorStructuredData', () => {
    it('creates Sod calculator structured data', () => {
      setSodCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-sod');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('WebApplication');
      expect(data.applicationCategory).toBe('CalculatorApplication');
      expect(data.name).toMatch(/Sod's Law/);
    });

    it('includes description', () => {
      setSodCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-sod');
      const data = JSON.parse(el.textContent);

      expect(data.description).toBeTruthy();
      expect(data.description).toMatch(/probability/);
    });

    it('clears previous page data', () => {
      setJsonLd('home-page', { name: 'Home' });
      setSodCalculatorStructuredData();

      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
    });

    it('includes speakable specification for voice search', () => {
      setSodCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-sod');
      const data = JSON.parse(el.textContent);

      expect(data.speakable).toBeTruthy();
      expect(data.speakable['@type']).toBe('SpeakableSpecification');
      expect(data.speakable.cssSelector).toBeInstanceOf(Array);
    });

    it('creates HowTo schema with steps', () => {
      setSodCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-sod-howto');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('HowTo');
      expect(data.name).toMatch(/Sod's Law Calculator/);
      expect(data.step).toBeInstanceOf(Array);
      expect(data.step.length).toBeGreaterThan(0);
      expect(data.step[0]['@type']).toBe('HowToStep');
      expect(data.step[0].position).toBe(1);
    });
  });

  describe('setToastCalculatorStructuredData', () => {
    it('creates Toast calculator structured data', () => {
      setToastCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-toast');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('WebApplication');
      expect(data.applicationCategory).toBe('CalculatorApplication');
      expect(data.name).toMatch(/Buttered Toast/);
    });

    it('includes description', () => {
      setToastCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-toast');
      const data = JSON.parse(el.textContent);

      expect(data.description).toBeTruthy();
      expect(data.description).toMatch(/height|gravity|butter/);
    });

    it('clears previous page data', () => {
      setJsonLd('home-page', { name: 'Home' });
      setToastCalculatorStructuredData();

      expect(document.head.querySelector('#jsonld-home-page')).toBeFalsy();
    });

    it('includes speakable specification for voice search', () => {
      setToastCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-toast');
      const data = JSON.parse(el.textContent);

      expect(data.speakable).toBeTruthy();
      expect(data.speakable['@type']).toBe('SpeakableSpecification');
      expect(data.speakable.cssSelector).toBeInstanceOf(Array);
    });

    it('creates HowTo schema with steps', () => {
      setToastCalculatorStructuredData();

      const el = document.head.querySelector('#jsonld-calculator-toast-howto');
      expect(el).toBeTruthy();

      const data = JSON.parse(el.textContent);
      expect(data['@type']).toBe('HowTo');
      expect(data.name).toMatch(/Buttered Toast/);
      expect(data.step).toBeInstanceOf(Array);
      expect(data.step.length).toBeGreaterThan(0);
      expect(data.step[0]['@type']).toBe('HowToStep');
      expect(data.step[0].position).toBe(1);
    });
  });
});
