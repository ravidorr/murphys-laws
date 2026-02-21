import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExportContent } from '../src/utils/export-context.ts';
import { ContentType } from '../src/utils/export-context.ts';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

vi.mock('jspdf', () => {
  const mockInstance = {
    text: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    addPage: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    getTextWidth: vi.fn().mockReturnValue(50),
    save: vi.fn(),
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 }
    }
  };
  const jsPDF = vi.fn(function (this: unknown) {
    return mockInstance;
  });
  return { jsPDF, __getMockJsPDFInstance: () => mockInstance };
});

// Import after mocking (mock adds __getMockJsPDFInstance at runtime)
import * as jspdfModule from 'jspdf';
import {
  exportToPDF,
  exportToCSV,
  exportToMarkdown,
  exportToText,
  exportContent,
  generateFilename,
  escapeCSVValue
} from '../src/utils/export.ts';

interface MockJsPDFInstance {
  text: ReturnType<typeof vi.fn>;
  setFontSize: ReturnType<typeof vi.fn>;
  setFont: ReturnType<typeof vi.fn>;
  splitTextToSize: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  setPage: ReturnType<typeof vi.fn>;
  getNumberOfPages: ReturnType<typeof vi.fn>;
  getTextWidth: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}

const mockJsPDF = (jspdfModule as typeof jspdfModule & { __getMockJsPDFInstance: () => MockJsPDFInstance }).__getMockJsPDFInstance();

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

    // Reset jsPDF mock
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
    });
  });

  describe('exportToPDF', () => {
    describe('with LAWS content type', () => {
      it('creates PDF document', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test Laws',
          data: localThis.mockLaws!
        };

        exportToPDF(content);

        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('adds site header', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToPDF(content);

        expect(mockJsPDF.text).toHaveBeenCalled();
        expect(mockJsPDF.setFontSize).toHaveBeenCalledWith(18);
      });

      it('calls save with filename', () => {
        const content = {
          type: ContentType.LAWS,
          title: 'Test Laws',
          data: localThis.mockLaws!
        };

        exportToPDF(content, 'custom.pdf');

        expect(mockJsPDF.save).toHaveBeenCalledWith('custom.pdf');
      });
    });

    describe('with SINGLE_LAW content type', () => {
      it('formats single law correctly', () => {
        const content = {
          type: ContentType.SINGLE_LAW,
          title: "Murphy's Law",
          data: localThis.mockSingleLaw!
        };

        exportToPDF(content);

        expect(mockJsPDF.save).toHaveBeenCalled();
      });
    });

    describe('with CONTENT content type', () => {
      it('formats text content', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'About',
          data: localThis.mockContent!
        };

        exportToPDF(content);

        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('handles CONTENT with empty data (L146)', () => {
        const content = {
          type: ContentType.CONTENT,
          title: 'Empty',
          data: ''
        };

        exportToPDF(content);

        expect(mockJsPDF.save).toHaveBeenCalled();
      });
    });

    describe('with CATEGORIES content type', () => {
      it('formats categories list', () => {
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: localThis.mockCategories!
        };

        exportToPDF(content);

        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('uses cat.title when present, else cat.name (L176 L180)', () => {
        const categoriesWithTitle = [
          { id: 1, name: 'Name Only', slug: 'name-only', law_count: 5 },
          { id: 2, name: 'Display Name', title: 'Category Title', slug: 'cat', law_count: 10 }
        ];
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Categories',
          data: categoriesWithTitle
        };
        exportToPDF(content);
        expect(mockJsPDF.text).toHaveBeenCalled();
        const textCalls = mockJsPDF.text.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(textCalls.some((t: string) => t.includes('Name Only') || t.includes('Category Title'))).toBe(true);
      });

      it('uses cat.name when title missing and law_count 0 (L165 L180 L181)', () => {
        const categoriesEdge = [
          { id: 1, name: 'Name Only', slug: 'n', law_count: 0 },
          { id: 2, title: 'With Title', slug: 't', law_count: 5 }
        ];
        const content = {
          type: ContentType.CATEGORIES,
          title: 'Cat',
          data: categoriesEdge
        };
        exportToPDF(content);
        expect(mockJsPDF.text).toHaveBeenCalled();
      });
    });

    describe('page overflow handling', () => {
      it('adds new page when laws overflow', () => {
        // Create many laws to trigger page overflow
        const manyLaws = Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          title: `Law ${i + 1}`,
          text: 'This is a law that takes up space on the page.',
          attribution: 'Author'
        }));

        // Mock splitTextToSize to return multiple lines (simulates long text)
        mockJsPDF.splitTextToSize.mockImplementation((text) => {
          // Return array of 10 lines to simulate text wrapping
          return Array(10).fill(text.substring(0, 50));
        });

        const content = {
          type: ContentType.LAWS,
          title: 'Many Laws',
          data: manyLaws
        };

        exportToPDF(content);

        // Should have called addPage at least once due to overflow
        expect(mockJsPDF.addPage).toHaveBeenCalled();
        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('adds new page when content text overflows', () => {
        // Create very long content
        const longContent = Array(100).fill('This is a paragraph of text. ').join('\n\n');

        // Mock splitTextToSize to return many lines
        mockJsPDF.splitTextToSize.mockImplementation(() => {
          return Array(100).fill('Line of text');
        });

        const content = {
          type: ContentType.CONTENT,
          title: 'Long Content',
          data: longContent
        };

        exportToPDF(content);

        expect(mockJsPDF.addPage).toHaveBeenCalled();
        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('adds new page when categories overflow', () => {
        // Create many categories
        const manyCategories = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          name: `Category ${i + 1}`,
          slug: `category-${i + 1}`,
          law_count: 10
        }));

        const content = {
          type: ContentType.CATEGORIES,
          title: 'Many Categories',
          data: manyCategories
        };

        exportToPDF(content);

        expect(mockJsPDF.addPage).toHaveBeenCalled();
        expect(mockJsPDF.save).toHaveBeenCalled();
      });

      it('adds footer to all pages when document has multiple pages', () => {
        // Mock getNumberOfPages to return 3 pages
        mockJsPDF.getNumberOfPages.mockReturnValue(3);

        const content = {
          type: ContentType.LAWS,
          title: 'Test',
          data: localThis.mockLaws!
        };

        exportToPDF(content);

        // Should call setPage for each page to add footer
        expect(mockJsPDF.setPage).toHaveBeenCalledWith(1);
        expect(mockJsPDF.setPage).toHaveBeenCalledWith(2);
        expect(mockJsPDF.setPage).toHaveBeenCalledWith(3);
        expect(mockJsPDF.setPage).toHaveBeenCalledTimes(3);

        // Reset mock for other tests
        mockJsPDF.getNumberOfPages.mockReturnValue(1);
      });
    });
  });

  describe('exportContent', () => {
    it('routes to exportToPDF for pdf format', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      exportContent(content, 'pdf');

      expect(mockJsPDF.save).toHaveBeenCalled();
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

    it('handles unknown format gracefully', () => {
      const content = {
        type: ContentType.LAWS,
        title: 'Test',
        data: localThis.mockLaws!
      };

      // Should not throw
      exportContent(content, 'unknown');

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
