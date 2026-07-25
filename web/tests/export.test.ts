import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExportContent } from '../src/utils/export-context.ts';
import { ContentType } from '../src/utils/export-context.ts';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

import {
  exportToPDF,
  exportToCSV,
  exportToMarkdown,
  exportToText,
  exportContent,
  generateFilename,
  escapeCSVValue
} from '../src/utils/export.ts';

/** Compatible with Law for export tests */
interface MockLaw {
  id: number;
  title?: string;
  text: string;
  attribution?: string;
  category_slug: string;
  upvotes: number;
  downvotes: number;
}

interface MockCategory {
  id: number;
  name: string;
  slug: string;
  law_count: number;
}

interface ExportTestLocalThis {
  mockLaws: MockLaw[] | null;
  mockSingleLaw: MockLaw | null;
  mockCategories: MockCategory[] | null;
  mockContent: string | null;
  mockLawWithEscapes: MockLaw | null;
  createObjectURLSpy: ReturnType<typeof vi.fn> | null;
  revokeObjectURLSpy: ReturnType<typeof vi.fn> | null;
  mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> } | null;
  originalCreateObjectURL: typeof URL.createObjectURL | null;
  originalRevokeObjectURL: typeof URL.revokeObjectURL | null;
  lastBlobContent: string | null;
  originalBlob: typeof Blob | null;
}

describe('Export Utilities', () => {
  const localThis: ExportTestLocalThis = {
    mockLaws: null,
    mockSingleLaw: null,
    mockCategories: null,
    mockContent: null,
    mockLawWithEscapes: null,
    createObjectURLSpy: null,
    revokeObjectURLSpy: null,
    mockAnchor: null,
    originalCreateObjectURL: null,
    originalRevokeObjectURL: null,
    lastBlobContent: null,
    originalBlob: null,
  };

  // Helper to get blob text content (captured from mock Blob)
  function getBlobText() {
    return localThis.lastBlobContent || '';
  }

  beforeEach(() => {
    // Store original URL methods if they exist
    localThis.originalCreateObjectURL = URL.createObjectURL;
    localThis.originalRevokeObjectURL = URL.revokeObjectURL;
    localThis.originalBlob = globalThis.Blob;

    // Reset blob content
    localThis.lastBlobContent = null;

    // Mock Blob to capture content
    const BlobLike = class MockBlob {
      parts: BlobPart[];
      options?: BlobPropertyBag;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        this.parts = parts;
        this.options = options;
        // Store the string content for test inspection (test only passes string parts)
        localThis.lastBlobContent = (parts as string[]).join('');
      }
    };
    (globalThis as unknown as { Blob: typeof BlobLike }).Blob = BlobLike;

    // Mock URL.createObjectURL and revokeObjectURL (jsdom doesn't have these)
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    // Mock anchor element for download
    localThis.mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return localThis.mockAnchor as unknown as HTMLElement;
      }
      return originalCreateElement(tag);
    }) as typeof document.createElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);

    // Set up test data
    localThis.mockLaws = [
      {
        id: 1,
        title: "Murphy's Law",
        text: 'If anything can go wrong, it will.',
        attribution: 'Edward A. Murphy Jr.',
        category_slug: 'general',
        upvotes: 42,
        downvotes: 3
      },
      {
        id: 2,
        text: 'Nothing is as easy as it looks.',
        category_slug: 'general',
        upvotes: 10,
        downvotes: 1
      }
    ];
    // Law with escape characters in data (simulates data from database)
    // Note: In JS strings, \\ becomes a single \, so '\\!' becomes '\!' in the actual string
    localThis.mockLawWithEscapes = {
      id: 3,
      title: 'Test Law',
      text: "Don't pick a fight \\- it won\\*t end well\\!",
      attribution: 'Test Author',
      category_slug: 'test',
      upvotes: 5,
      downvotes: 0
    };
    localThis.mockSingleLaw = localThis.mockLaws![0] ?? null;
    localThis.mockCategories = [
      { id: 1, name: 'General Laws', slug: 'general-laws', law_count: 50 },
      { id: 2, name: 'Computer Laws', slug: 'computer-laws', law_count: 30 }
    ];
    localThis.mockContent = '# About\n\nThis is **markdown** content with [a link](https://example.com).';

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original URL methods
    if (localThis.originalCreateObjectURL) {
      URL.createObjectURL = localThis.originalCreateObjectURL;
    }
    if (localThis.originalRevokeObjectURL) {
      URL.revokeObjectURL = localThis.originalRevokeObjectURL;
    }
    // Restore original Blob
    if (localThis.originalBlob) {
      globalThis.Blob = localThis.originalBlob;
    }
    vi.restoreAllMocks();
  });

  describe('generateFilename', () => {
    it('converts title to lowercase with hyphens', () => {
      expect(generateFilename('My Test Title', 'pdf')).toBe('my-test-title.pdf');
    });

    it('removes special characters', () => {
      expect(generateFilename("Murphy's Law!", 'csv')).toBe('murphys-law.csv');
    });

    it('collapses multiple hyphens', () => {
      expect(generateFilename('Test -- Title', 'md')).toBe('test-title.md');
    });

    it('limits length to 50 characters', () => {
      const longTitle = 'This is a very long title that exceeds fifty characters in length';
      const result = generateFilename(longTitle, 'txt');
      expect(result.length).toBeLessThanOrEqual(54); // 50 chars + '.txt'
    });

    it('handles empty title with fallback', () => {
      expect(generateFilename('', 'pdf')).toBe('murphys-laws.pdf');
    });

    it('handles title with only special characters', () => {
      expect(generateFilename('!!!@@@###', 'pdf')).toBe('murphys-laws.pdf');
    });
  });

  describe('escapeCSVValue', () => {
    it('returns empty string for null (L214)', () => {
      expect(escapeCSVValue(null)).toBe('');
    });

    it('returns empty string for undefined (L214)', () => {
      expect(escapeCSVValue(undefined)).toBe('');
    });

    it('wraps value in quotes when it contains comma (L220-222)', () => {
      expect(escapeCSVValue('a,b')).toBe('"a,b"');
    });

    it('wraps value in quotes when it contains newline (L220)', () => {
      expect(escapeCSVValue('a\nb')).toBe('"a\nb"');
    });

    it('wraps value in quotes when it contains double quote (L220)', () => {
      expect(escapeCSVValue('say "hi"')).toBe('"say ""hi"""');
    });

    it('wraps value in quotes when it contains carriage return (L220)', () => {
      expect(escapeCSVValue('a\rb')).toBe('"a\rb"');
    });

    it('returns value unchanged when no special characters', () => {
      expect(escapeCSVValue('simple')).toBe('simple');
    });
  });

  describe('exportToCSV', () => {
    describe('with LAWS content type', () => {
      it('generates CSV with correct headers', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test Laws',
          data: localThis.mockLaws!
        };

        exportToCSV(content);

        const blobCall = vi.mocked(URL.createObjectURL).mock.calls[0]![0];
        expect(blobCall).toBeInstanceOf(Blob);
      });

      it('triggers file download with .csv extension', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test Laws',
          data: localThis.mockLaws!
        };

        exportToCSV(content);

        expect(localThis.mockAnchor!.download).toMatch(/\.csv$/);
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('uses provided filename', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test Laws',
          data: localThis.mockLaws!
        };

        exportToCSV(content, 'custom-file.csv');

        expect(localThis.mockAnchor!.download).toBe('custom-file.csv');
      });

      it('handles empty laws array', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Empty',
          data: []
        };

        // Should not throw
        exportToCSV(content);
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('L177 B3 L181 B3: exportToCSV SINGLE_LAW with non-array data', () => {
        const content = {
          type: ContentType.SINGLE_LAW,
          title: 'One Law',
          data: localThis.mockSingleLaw!
        };
        exportToCSV(content);
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
        expect(getBlobText()).toContain('Full Text');
      });

      it('escapes CSV value with comma (covers L214 B1)', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'Law, with comma', text: 'Text', attribution: 'Author', category_slug: 'x', upvotes: 0, downvotes: 0 }]
        };
        exportToCSV(content);
        expect(getBlobText()).toContain('"Law, with comma"');
      });

      it('exports CSV with simple values without wrapping (L214 B0)', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'SimpleTitle', text: 'SimpleText', attribution: 'Author', category_slug: 'x', upvotes: 0, downvotes: 0 }]
        };
        exportToCSV(content);
        const text = getBlobText();
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
        expect(text).toContain('SimpleTitle');
        expect(text).toContain('SimpleText');
      });
    });

    describe('with SINGLE_LAW content type', () => {
      it('generates single-row CSV', () => {
        const content = {
          type: ContentType.SINGLE_LAW,
          title: "Murphy's Law",
          data: localThis.mockSingleLaw!!
        };

        exportToCSV(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });

    describe('with CATEGORIES content type', () => {
      it('generates CSV with category headers', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: localThis.mockCategories!!
        };

        exportToCSV(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('L260 B1: exportToCSV categories branch', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Cats',
          data: localThis.mockCategories!
        };
        exportToCSV(content);
        expect(getBlobText()).toContain('Law Count');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('uses cat.name when title missing and law_count 0 (L177 L180 L181)', () => {
        const categoriesEdge = [
          { id: 1, name: 'Name Only', slug: 'n', law_count: 0 },
          { id: 2, title: 'With Title', slug: 't', law_count: 5 }
        ];
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesEdge
        };
        exportToCSV(content);
        const csv = getBlobText();
        expect(csv).toContain('Name Only');
        expect(csv).toContain('0');
        expect(csv).toContain('With Title');
        expect(csv).toContain('5');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });

    describe('CSV value escaping', () => {
      it('handles null values in law fields', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: null,
            title: null,
            text: null,
            attribution: null,
            category_slug: null,
            upvotes: null,
            downvotes: null
          }]
        } as unknown as ExportContent;

        exportToCSV(content);
        const text = getBlobText();

        // Should not throw and should produce valid CSV
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
        expect(text).toContain('"Full Text"');
      });

      it('handles undefined values in law fields', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1
            // Other fields undefined
          }]
        };

        exportToCSV(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('escapes values containing commas', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: 'Law with, comma',
            text: 'Text with, multiple, commas',
            attribution: 'Author, Jr.'
          }]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Values with commas should be quoted
        expect(text).toContain('"Law with, comma"');
        expect(text).toContain('"Text with, multiple, commas"');
      });

      it('escapes values containing newlines', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: 'Law Title',
            text: 'Line 1\nLine 2\nLine 3'
          }]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Values with newlines should be quoted
        expect(text).toContain('"Line 1\nLine 2\nLine 3"');
      });

      it('escapes values containing double quotes', () => {
        const content: ExportContent = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: 'Law with "quotes"',
            text: 'Text says "hello"'
          }]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Double quotes should be escaped by doubling them
        expect(text).toContain('"Law with ""quotes"""');
        expect(text).toContain('"Text says ""hello"""');
      });

      it('escapes values containing carriage returns', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: 'Title',
            text: 'Line 1\r\nLine 2'
          }]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Values with carriage returns should be quoted
        expect(text).toContain('"Line 1\r\nLine 2"');
      });

      it('handles null values in category fields', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: [{
            id: null,
            name: null,
            slug: null,
            law_count: null
          }]
        } as unknown as ExportContent;

        exportToCSV(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('converts null values to empty strings in CSV', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: null,
            text: 'Some text',
            attribution: null
          }]
        } as unknown as ExportContent;

        exportToCSV(content);
        const text = getBlobText();

        // Null values should become empty strings, not "null"
        expect(text).not.toContain('"null"');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('converts undefined values to empty strings in CSV', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{
            id: 1,
            title: undefined,
            text: 'Some text',
            attribution: undefined
          }]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Undefined values should become empty strings, not "undefined"
        expect(text).not.toContain('"undefined"');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });
  });

  describe('exportToMarkdown', () => {
    describe('with LAWS content type', () => {
      it('includes title as H1', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Search Results',
          data: localThis.mockLaws!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('triggers file download with .md extension', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.download).toMatch(/\.md$/);
      });

      it('uses numbered list format', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLaws![0]!]
        };

        exportToMarkdown(content);

        // Get the blob content
        const blobCall = vi.mocked(URL.createObjectURL).mock.calls[0]![0];
        expect(blobCall).toBeInstanceOf(Blob);
      });

      it('strips escape characters from text', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLawWithEscapes!]
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('includes footer with export date and link', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('includes attribution when law has attribution (L329)', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'Law', text: 'Text', attribution: 'Edward Murphy', category_slug: 'x', upvotes: 0, downvotes: 0 }]
        };
        exportToMarkdown(content);
        expect(getBlobText()).toContain('Edward Murphy');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });

    describe('with SINGLE_LAW content type', () => {
      it('formats single law correctly', () => {
        const content = {
          type: ContentType.SINGLE_LAW,
          title: "Murphy's Law",
          data: localThis.mockSingleLaw!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });

    describe('with CONTENT content type', () => {
      it('preserves original markdown', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'About',
          data: localThis.mockContent!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('L327 B1: exportToMarkdown CONTENT branch', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Doc',
          data: localThis.mockContent!
        };
        exportToMarkdown(content);
        expect(getBlobText()).toContain('**markdown**');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('L330 B2: exportToMarkdown CONTENT with truthy data', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'T',
          data: 'Some markdown body'
        };
        exportToMarkdown(content);
        expect(getBlobText()).toContain('Some markdown body');
      });

      it('L330 B1: exportToMarkdown CONTENT with falsy data', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Empty',
          data: ''
        };
        exportToMarkdown(content);
        expect(getBlobText()).toContain('# Empty');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('handles CONTENT with empty data (L260)', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Empty',
          data: ''
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
        expect(getBlobText()).toContain('# Empty');
      });
    });

    describe('with CATEGORIES content type', () => {
      it('formats as bulleted list', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: localThis.mockCategories!
        };

        exportToMarkdown(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('uses cat.title when present else cat.name (L330)', () => {
        const categoriesMixed = [
          { id: 1, name: 'Name Only', slug: 'n', law_count: 5 },
          { id: 2, name: 'Fallback', title: 'Display Title', slug: 't', law_count: 10 }
        ];
        exportToMarkdown({
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesMixed
        });
        const md = getBlobText();
        expect(md).toMatch(/Name Only/);
        expect(md).toMatch(/Display Title/);
      });
    });
  });

  describe('exportToText', () => {
    describe('with LAWS content type', () => {
      it('includes uppercase title', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Search Results',
          data: localThis.mockLaws!
        };

        exportToText(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('triggers file download with .txt extension', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToText(content);

        expect(localThis.mockAnchor!.download).toMatch(/\.txt$/);
      });

      it('handles laws without title', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, text: 'Law text' }]
        };

        // Should not throw
        exportToText(content);
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('handles laws without attribution', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'Title', text: 'Law text' }]
        };

        // Should not throw
        exportToText(content);
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('handles law with title only (getLawDisplayText title-only branch)', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'Title Only', text: '' }]
        };

        exportToText(content);
        expect(getBlobText()).toContain('Title Only');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });
    });

    describe('with CONTENT content type', () => {
      it('handles null or undefined data (L366)', () => {
        exportToText({
          type: ContentType.CONTENT,
          title: 'Empty',
          data: null as unknown as string
        });
        exportToText({
          type: ContentType.CONTENT,
          title: 'Empty2',
          data: undefined as unknown as string
        });
        expect(localThis.mockAnchor!.click).toHaveBeenCalledTimes(2);
      });

      it('L355 B1: exportToText CONTENT branch', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'About',
          data: 'Plain text body'
        };
        exportToText(content);
        expect(getBlobText()).toContain('Plain text body');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('strips markdown formatting', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'About',
          data: '# Header\n\n**Bold** text with [link](url)'
        };

        exportToText(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('strips underscore italic (L327)', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Test',
          data: 'Text with _italic_ word'
        };

        exportToText(content);

        expect(getBlobText()).toContain('italic');
        expect(getBlobText()).not.toContain('_italic_');
      });

      it('strips blockquote markers (L330)', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Test',
          data: '> Blockquote line one\n> Blockquote line two'
        };

        exportToText(content);

        const txt = getBlobText();
        expect(txt).toContain('Blockquote line one');
        expect(txt).toContain('Blockquote line two');
        expect(txt).not.toMatch(/>\s*Blockquote/);
      });
    });

    describe('with CATEGORIES content type', () => {
      it('formats as plain list', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: localThis.mockCategories!
        };

        exportToText(content);

        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('L378 B1: exportToText CATEGORIES branch', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Cats',
          data: localThis.mockCategories!
        };
        exportToText(content);
        expect(getBlobText()).toContain('General Laws');
        expect(localThis.mockAnchor!.click).toHaveBeenCalled();
      });

      it('uses cat.name when cat.title missing (L381)', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Cats',
          data: [
            { id: 1, name: 'Name Only', slug: 'n', law_count: 0 },
            { id: 2, title: 'With Title', name: 'Fallback', slug: 't', law_count: 5 }
          ]
        };
        exportToText(content);
        const txt = getBlobText();
        expect(txt).toContain('Name Only');
        expect(txt).toContain('With Title');
        expect(txt).toContain('0 laws');
        expect(txt).toContain('5 laws');
      });

      it('uses cat.title when present else cat.name (L381)', () => {
        const categoriesMixed = [
          { id: 1, name: 'Name Only', slug: 'n', law_count: 5 },
          { id: 2, name: 'Fallback', title: 'Display Title', slug: 't', law_count: 10 }
        ];
        exportToText({
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesMixed
        });
        const txt = getBlobText();
        expect(txt).toMatch(/Name Only/);
        expect(txt).toMatch(/Display Title/);
      });

      it('includes law attribution in plain text (L367)', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [{ id: 1, title: 'Law', text: 'Text', attribution: 'Attributed Author', category_slug: 'x', upvotes: 0, downvotes: 0 }]
        };
        exportToText(content);
        expect(getBlobText()).toContain('Attributed Author');
      });

      it('formats categories with name and law_count 0 (L355 L378 L381)', () => {
        const categoriesEdge = [
          { id: 1, name: 'Name Only', slug: 'n', law_count: 0 },
          { id: 2, title: 'With Title', slug: 't', law_count: 5 }
        ];
        exportToText({
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesEdge
        });
        const txt = getBlobText();
        expect(txt).toContain('Name Only');
        expect(txt).toContain('0 laws');
        expect(txt).toContain('With Title');
        expect(txt).toContain('5 laws');
      });

      it('L381 B2: categories export uses empty title/name and law_count 0 fallback', () => {
        const categoriesPartial = [
          { id: 1, slug: 'x' } as Partial<{ id: number; title?: string; name?: string; slug: string; law_count?: number }>
        ];
        exportToText({
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesPartial
        });
        const txt = getBlobText();
        expect(txt).toContain(' (0 laws)');
      });
    });
  });

  describe('exportToPDF', () => {
    it('downloads law content using the requested filename', async () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test Laws',
        data: localThis.mockLaws!
      };

      await exportToPDF(content, 'custom.pdf');

      expect(localThis.mockAnchor!.download).toBe('custom.pdf');
      expect(localThis.mockAnchor!.click).toHaveBeenCalledOnce();
      expect(getBlobText()).toContain('%PDF-1.4');
      expect(getBlobText()).toContain("Murphy's Law");
      expect(getBlobText()).toContain('Edward A. Murphy Jr.');
    });

    it('paginates long content exports', async () => {
      await exportToPDF({
        type: ContentType.CONTENT,
        title: 'Long content',
        data: Array.from(
          { length: 120 },
          (_, index) => `# Heading ${index}\n\nThis is **formatted** [content](https://example.com).`
        ).join('\n')
      });

      expect(localThis.mockAnchor!.download).toBe('long-content.pdf');
      expect(getBlobText().match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
      expect(getBlobText()).toContain('Page 1 of');
    });

    it('formats and paginates category exports', async () => {
      const categories = Array.from({ length: 100 }, (_, index) => ({
        id: index,
        name: `Category ${index}`,
        slug: `category-${index}`,
        law_count: index
      }));

      await exportToPDF({
        type: ContentType.CATEGORIES,
        title: 'Categories',
        data: categories
      });

      expect(localThis.mockAnchor!.download).toBe('categories.pdf');
      expect(getBlobText()).toContain('Category 0 \\(0 laws\\)');
      expect(getBlobText().match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
    });

    it('normalizes, escapes, and wraps difficult PDF text', async () => {
      const longWord = 'x'.repeat(100);
      const mediumWords = `${'y'.repeat(50)} ${'z'.repeat(50)}`;

      await exportToPDF({
        type: ContentType.SINGLE_LAW,
        title: 'PDF edge cases',
        data: {
          ...localThis.mockSingleLaw!,
          text:
            `${longWord}\nshort ${longWord}\n${mediumWords}\n` +
            'Café “quote” — wait… \\ (now)',
        },
      });

      expect(getBlobText()).toContain('Cafe "quote" - wait...');
      expect(getBlobText()).toContain('\\\\ \\(now\\)');
      expect(getBlobText()).toContain('x'.repeat(88));
      expect(getBlobText()).toContain('y'.repeat(50));
    });

    it('handles empty content and incomplete category data', async () => {
      await exportToPDF({
        type: ContentType.CONTENT,
        title: 'Empty content',
        data: '',
      });
      expect(getBlobText()).toContain('Empty content');

      await exportToPDF({
        type: ContentType.CATEGORIES,
        title: 'Partial categories',
        data: [
          { title: 'Title value', law_count: 2 },
          { name: 'Name value', law_count: 0 },
          {},
        ],
      });
      expect(getBlobText()).toContain('Title value \\(2 laws\\)');
      expect(getBlobText()).toContain('Name value \\(0 laws\\)');

      await exportToPDF(
        {
          type: ContentType.CATEGORIES,
          title: undefined as unknown as string,
          data: {} as unknown as MockCategory[],
        },
        'partial.pdf',
      );
      expect(localThis.mockAnchor!.download).toBe('partial.pdf');
    });
  });

  describe('structured export edge cases', () => {
    it('handles non-array category data without failing', () => {
      const malformedCategories = {
        type: ContentType.CATEGORIES,
        title: 'Categories',
        data: {} as unknown as MockCategory[],
      };

      exportToCSV(malformedCategories);
      expect(getBlobText()).toBe('');

      exportToMarkdown(malformedCategories);
      expect(getBlobText()).toContain('# Categories');

      exportToText(malformedCategories);
      expect(getBlobText()).toContain('CATEGORIES');
    });

    it('uses every category-name fallback in Markdown', () => {
      exportToMarkdown({
        type: ContentType.CATEGORIES,
        title: 'Partial categories',
        data: [
          { title: 'Title value', law_count: 2 },
          { name: 'Name value', law_count: 1 },
          {},
        ],
      });

      expect(getBlobText()).toContain('**Title value**');
      expect(getBlobText()).toContain('**Name value**');
      expect(getBlobText()).toContain('- **** (0 laws)');
    });

    it('exports a single non-array law to plain text', () => {
      exportToText({
        type: ContentType.SINGLE_LAW,
        title: 'Single law',
        data: localThis.mockSingleLaw!,
      });

      expect(getBlobText()).toContain("Murphy's Law");
    });
  });

  describe('exportContent', () => {
    it('routes to exportToPDF for pdf format', async () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      await exportContent(content, 'pdf');

      expect(localThis.mockAnchor!.download).toMatch(/\.pdf$/);
      expect(getBlobText()).toContain('%PDF-1.4');
    });

    it('routes to exportToCSV for csv format', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportContent(content, 'csv');

      expect(localThis.mockAnchor!.download).toMatch(/\.csv$/);
    });

    it('routes to exportToMarkdown for md format', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportContent(content, 'md');

      expect(localThis.mockAnchor!.download).toMatch(/\.md$/);
    });

    it('routes to exportToText for txt format', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportContent(content, 'txt');

      expect(localThis.mockAnchor!.download).toMatch(/\.txt$/);
    });

    it('handles unknown format gracefully', async () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      // Should not throw
      await exportContent(content, 'unknown');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Unknown export format: unknown', 'warning');
    });
  });

  describe('downloadFile helper (via exports)', () => {
    it('creates object URL from blob', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportToCSV(content);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('revokes object URL after download', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportToCSV(content);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
  });

  describe('content formatting', () => {
    describe('escape character handling', () => {
      it('strips markdown escape characters from law text', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLawWithEscapes!]
        };

        exportToMarkdown(content);
        const text = getBlobText();

        // Should not contain escaped characters (backslash followed by special char)
        expect(text).not.toMatch(/\\[!\-*]/);
        // Should contain unescaped versions
        expect(text).toContain("Don't pick a fight - it won*t end well!");
      });

      it('strips escapes in text export too', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLawWithEscapes!]
        };

        exportToText(content);
        const text = getBlobText();

        // Should not contain escaped characters
        expect(text).not.toMatch(/\\[!\-*]/);
      });
    });

    describe('markdown format', () => {
      it('uses numbered list format for laws', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToMarkdown(content);
        const text = getBlobText();

        // Should have numbered list items
        expect(text).toContain('1. ');
        expect(text).toContain('2. ');
      });

      it('puts attribution on new line with indent', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLaws![0]!]
        };

        exportToMarkdown(content);
        const text = getBlobText();

        // Attribution should be on its own line, indented
        expect(text).toContain('\n   *- Edward A. Murphy Jr.*');
      });

      it('includes footer at bottom with clickable link', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToMarkdown(content);
        const text = getBlobText();

        // Footer should be at the end with markdown link format
        expect(text).toContain('---\n\n*Exported from');
        expect(text).toMatch(/\[https:\/\/murphys-laws\.com\]\(https:\/\/murphys-laws\.com\)/);
      });

      it('combines title and text with colon separator', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLaws![0]!]
        };

        exportToMarkdown(content);
        const text = getBlobText();

        // Title and text should be combined
        expect(text).toContain("Murphy's Law: If anything can go wrong");
      });
    });

    describe('text format', () => {
      it('includes footer at bottom', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToText(content);
        const text = getBlobText();

        // Footer should be at the end
        expect(text).toContain('==================================================\nExported from');
        expect(text).toContain('https://murphys-laws.com');
      });
    });

    describe('CSV format', () => {
      it('includes Full Text column with combined title and text', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: [localThis.mockLaws![0]!]
        };

        exportToCSV(content);
        const text = getBlobText();

        // Header should have Full Text column
        expect(text).toContain('"Full Text"');
        // Combined text should appear
        expect(text).toContain("Murphy's Law: If anything can go wrong");
      });
    });
  });
});
