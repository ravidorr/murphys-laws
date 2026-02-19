// @ts-nocheck
import {
  setExportContent,
  getExportContent,
  clearExportContent,
  subscribeToExportContent,
  getAvailableFormats,
  resetExportContext,
  ContentType
} from '../src/utils/export-context.ts';

describe('Export Context', () => {
  const localThis: Record<string, any> = {
    mockLawsContent: null,
    mockSingleLawContent: null,
    mockContentContent: null,
    mockCategoriesContent: null,
  };

  beforeEach(() => {
    // Reset context before each test
    resetExportContext();

    // Set up test data
    localThis.mockLawsContent = {
      type: ContentType.LAWS,
      title: 'Search Results',
      data: [
        { id: 1, text: 'Test law 1', title: 'Law 1' },
        { id: 2, text: 'Test law 2', title: 'Law 2' }
      ],
      metadata: { total: 2, page: 1 }
    };

    localThis.mockSingleLawContent = {
      type: ContentType.SINGLE_LAW,
      title: "Murphy's Law",
      data: { id: 1, text: 'If anything can go wrong, it will.', title: "Murphy's Law", attribution: 'Edward A. Murphy Jr.' }
    };

    localThis.mockContentContent = {
      type: ContentType.CONTENT,
      title: 'About Us',
      data: '# About\n\nThis is the about page content.'
    };

    localThis.mockCategoriesContent = {
      type: ContentType.CATEGORIES,
      title: 'Law Categories',
      data: [
        { id: 1, name: 'General Laws', slug: 'general-laws', law_count: 50 },
        { id: 2, name: 'Computer Laws', slug: 'computer-laws', law_count: 30 }
      ]
    };
  });

  afterEach(() => {
    resetExportContext();
  });

  describe('ContentType enum', () => {
    it('exports expected content types', () => {
      expect(ContentType.LAWS).toBe('laws');
      expect(ContentType.SINGLE_LAW).toBe('single_law');
      expect(ContentType.CONTENT).toBe('content');
      expect(ContentType.CATEGORIES).toBe('categories');
    });
  });

  describe('setExportContent', () => {
    it('stores content and notifies subscribers', () => {
      const callback = vi.fn();
      subscribeToExportContent(callback);

      setExportContent(localThis.mockLawsContent);

      expect(callback).toHaveBeenCalledWith(localThis.mockLawsContent);
      expect(getExportContent()).toEqual(localThis.mockLawsContent);
    });

    it('overwrites previous content', () => {
      setExportContent(localThis.mockLawsContent);
      expect(getExportContent().type).toBe(ContentType.LAWS);

      setExportContent(localThis.mockSingleLawContent);
      expect(getExportContent().type).toBe(ContentType.SINGLE_LAW);
      expect(getExportContent().title).toBe("Murphy's Law");
    });

    it('handles content with minimal fields', () => {
      const minimalContent = {
        type: ContentType.CONTENT,
        title: 'Minimal',
        data: 'Some content'
      };

      setExportContent(minimalContent);

      const result = getExportContent();
      expect(result.type).toBe(ContentType.CONTENT);
      expect(result.title).toBe('Minimal');
      expect(result.data).toBe('Some content');
      expect(result.metadata).toEqual({});
    });

    it('handles content with all optional metadata', () => {
      const contentWithMetadata = {
        ...localThis.mockLawsContent,
        metadata: { total: 100, filters: { q: 'test' }, page: 2, extra: 'data' }
      };

      setExportContent(contentWithMetadata);

      const result = getExportContent();
      expect(result.metadata.total).toBe(100);
      expect(result.metadata.filters.q).toBe('test');
      expect(result.metadata.page).toBe(2);
      expect(result.metadata.extra).toBe('data');
    });
  });

  describe('getExportContent', () => {
    it('returns null when no content set', () => {
      expect(getExportContent()).toBeNull();
    });

    it('returns current content after setExportContent', () => {
      setExportContent(localThis.mockSingleLawContent);

      const content = getExportContent();
      expect(content).not.toBeNull();
      expect(content.type).toBe(ContentType.SINGLE_LAW);
      expect(content.title).toBe("Murphy's Law");
    });

    it('returns null after clearExportContent', () => {
      setExportContent(localThis.mockLawsContent);
      expect(getExportContent()).not.toBeNull();

      clearExportContent();
      expect(getExportContent()).toBeNull();
    });
  });

  describe('clearExportContent', () => {
    it('clears stored content', () => {
      setExportContent(localThis.mockLawsContent);
      expect(getExportContent()).not.toBeNull();

      clearExportContent();
      expect(getExportContent()).toBeNull();
    });

    it('notifies subscribers with null', () => {
      const callback = vi.fn();
      setExportContent(localThis.mockLawsContent);
      subscribeToExportContent(callback);

      clearExportContent();

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('handles clearing when already empty', () => {
      expect(getExportContent()).toBeNull();

      // Should not throw
      clearExportContent();
      expect(getExportContent()).toBeNull();
    });
  });

  describe('subscribeToExportContent', () => {
    it('calls callback when content changes', () => {
      const callback = vi.fn();
      subscribeToExportContent(callback);

      setExportContent(localThis.mockLawsContent);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(localThis.mockLawsContent);
    });

    it('calls callback when content is cleared', () => {
      const callback = vi.fn();
      setExportContent(localThis.mockLawsContent);
      subscribeToExportContent(callback);

      clearExportContent();

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToExportContent(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe stops future notifications', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToExportContent(callback);

      setExportContent(localThis.mockLawsContent);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      setExportContent(localThis.mockSingleLawContent);
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('supports multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      subscribeToExportContent(callback1);
      subscribeToExportContent(callback2);
      subscribeToExportContent(callback3);

      setExportContent(localThis.mockLawsContent);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing one does not affect others', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = subscribeToExportContent(callback1);
      subscribeToExportContent(callback2);

      unsubscribe1();
      setExportContent(localThis.mockLawsContent);

      expect(callback1).toHaveBeenCalledTimes(0);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAvailableFormats', () => {
    it('returns empty array when no content', () => {
      expect(getAvailableFormats()).toEqual([]);
    });

    it('returns [pdf, csv, md, txt] for LAWS type', () => {
      setExportContent(localThis.mockLawsContent);

      const formats = getAvailableFormats();
      expect(formats).toContain('pdf');
      expect(formats).toContain('csv');
      expect(formats).toContain('md');
      expect(formats).toContain('txt');
      expect(formats).toHaveLength(4);
    });

    it('returns [pdf, csv, md, txt] for SINGLE_LAW type', () => {
      setExportContent(localThis.mockSingleLawContent);

      const formats = getAvailableFormats();
      expect(formats).toContain('pdf');
      expect(formats).toContain('csv');
      expect(formats).toContain('md');
      expect(formats).toContain('txt');
      expect(formats).toHaveLength(4);
    });

    it('returns [pdf, md, txt] for CONTENT type (no CSV)', () => {
      setExportContent(localThis.mockContentContent);

      const formats = getAvailableFormats();
      expect(formats).toContain('pdf');
      expect(formats).toContain('md');
      expect(formats).toContain('txt');
      expect(formats).not.toContain('csv');
      expect(formats).toHaveLength(3);
    });

    it('returns [pdf, csv, md, txt] for CATEGORIES type', () => {
      setExportContent(localThis.mockCategoriesContent);

      const formats = getAvailableFormats();
      expect(formats).toContain('pdf');
      expect(formats).toContain('csv');
      expect(formats).toContain('md');
      expect(formats).toContain('txt');
      expect(formats).toHaveLength(4);
    });

    it('returns formats in correct order (pdf first, then csv if applicable)', () => {
      setExportContent(localThis.mockLawsContent);

      const formats = getAvailableFormats();
      expect(formats[0]).toBe('pdf');
      expect(formats[1]).toBe('csv');
      expect(formats[2]).toBe('md');
      expect(formats[3]).toBe('txt');
    });

    it('returns formats in correct order for CONTENT type', () => {
      setExportContent(localThis.mockContentContent);

      const formats = getAvailableFormats();
      expect(formats[0]).toBe('pdf');
      expect(formats[1]).toBe('md');
      expect(formats[2]).toBe('txt');
    });
  });

  describe('resetExportContext', () => {
    it('clears content', () => {
      setExportContent(localThis.mockLawsContent);
      expect(getExportContent()).not.toBeNull();

      resetExportContext();
      expect(getExportContent()).toBeNull();
    });

    it('removes all subscribers', () => {
      const callback = vi.fn();
      subscribeToExportContent(callback);

      resetExportContext();
      setExportContent(localThis.mockLawsContent);

      // Callback should not be called after reset
      expect(callback).toHaveBeenCalledTimes(0);
    });
  });
});
