import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock export context
vi.mock('../src/utils/export-context.js', () => ({
  getExportContent: vi.fn(),
  getAvailableFormats: vi.fn(() => []),
  subscribeToExportContent: vi.fn(() => vi.fn()),
  ContentType: {
    LAWS: 'laws',
    SINGLE_LAW: 'single_law',
    CONTENT: 'content',
    CATEGORIES: 'categories'
  }
}));

// Mock export utilities
vi.mock('../src/utils/export.js', () => ({
  exportToPDF: vi.fn(),
  exportToCSV: vi.fn(),
  exportToMarkdown: vi.fn(),
  exportToText: vi.fn(),
  generateFilename: vi.fn((title, ext) => `${title.toLowerCase().replace(/\s+/g, '-')}.${ext}`)
}));

// Mock icons
vi.mock('../src/utils/icons.js', () => ({
  createIcon: vi.fn(() => {
    const svg = document.createElement('svg');
    svg.setAttribute('data-icon-name', 'download');
    return svg;
  })
}));

import type { CleanableElement } from '../src/types/app.js';
import type { ExportContent } from '../src/utils/export-context.js';
import { ExportMenu } from '../src/components/export-menu.js';
import {
  getExportContent,
  getAvailableFormats,
  subscribeToExportContent
} from '../src/utils/export-context.js';
import {
  exportToPDF,
  exportToCSV,
  exportToMarkdown,
  exportToText
} from '../src/utils/export.js';

interface ExportMenuLocalThis {
  container: HTMLDivElement | null;
  mockContent: ExportContent | null;
  subscribeCallback: ((content: ExportContent | null) => void) | null;
}

describe('Export Menu Component', () => {
  const localThis: ExportMenuLocalThis = {
    container: null,
    mockContent: null,
    subscribeCallback: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mocks
    localThis.mockContent = {
      type: 'laws',
      title: 'Test Laws',
      data: [{ id: 1, text: 'Test law' }]
    } as ExportContent;

    vi.mocked(getExportContent).mockReturnValue(localThis.mockContent);
    vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'csv', 'md', 'txt']);
    vi.mocked(subscribeToExportContent).mockImplementation((callback) => {
      localThis.subscribeCallback = callback;
      return vi.fn(); // Unsubscribe function
    });

    // Create container
    localThis.container = document.createElement('div');
    document.body.appendChild(localThis.container);
  });

  afterEach(() => {
    if (localThis.container?.parentNode) {
      document.body.removeChild(localThis.container!);
    }
    localThis.subscribeCallback = null;
  });

  describe('Rendering', () => {
    it('renders export button with download icon', () => {
      const menu = ExportMenu();
      expect(localThis.container).toBeTruthy();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button!.querySelector('svg')).toBeTruthy();
    });

    it('renders button when createIcon returns null', async () => {
      const icons = await import('../src/utils/icons.js');
      vi.mocked(icons.createIcon).mockReturnValueOnce(null as unknown as SVGSVGElement);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button!.querySelector('svg')).toBeFalsy();
    });

    it('renders dropdown menu (hidden by default)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(dropdown).toBeTruthy();
      expect(dropdown!.hidden).toBe(true);
    });

    it('shows all formats when LAWS content type', () => {
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'csv', 'md', 'txt']);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      expect(items).toHaveLength(4);
    });

    it('uses format.toUpperCase() for unknown format label (L108)', () => {
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'custom']);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const customItem = menu.querySelector('[data-format="custom"]');
      expect(customItem).toBeTruthy();
      expect(customItem!.textContent).toBe('CUSTOM');
    });

    it('hides CSV option for CONTENT type', () => {
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'md', 'txt']);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      expect(items).toHaveLength(3);
      expect(menu.querySelector('[data-format="csv"]')).toBeNull();
    });

    it('disables button when no export content', () => {
      vi.mocked(getExportContent).mockReturnValue(null);
      vi.mocked(getAvailableFormats).mockReturnValue([]);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      expect(button).toBeTruthy();
      expect(button!.disabled).toBe(true);
    });

    it('enables button when export content available', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      expect(button).toBeTruthy();
      expect(button!.disabled).toBe(false);
    });

    it('does not open dropdown when button is disabled', () => {
      vi.mocked(getAvailableFormats).mockReturnValue([]);
      vi.mocked(getExportContent).mockReturnValue(null);

      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button!.disabled).toBe(true);
      button!.click();
      expect(dropdown!.hidden).toBe(true);
    });
  });

  describe('Dropdown behavior', () => {
    it('opens dropdown on button click', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      expect(dropdown!.hidden).toBe(false);
    });

    it('focuses first menuitem when opening dropdown (L122)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const firstItem = menu.querySelector('[role="menuitem"]') as HTMLElement | null;
      const focusSpy = vi.spyOn(firstItem!, 'focus');

      button!.click();

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('opens dropdown without focusing when no menuitems (L122 false branch)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      dropdown!.innerHTML = '';
      expect(dropdown!.querySelector('[role="menuitem"]')).toBeNull();

      button!.click();

      expect(dropdown!.hidden).toBe(false);
    });

    it('first dropdown item has tabindex 0, rest have -1 (L106 L122)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0]!.getAttribute('tabindex')).toBe('0');
      for (let i = 1; i < items.length; i++) {
        expect(items[i]!.getAttribute('tabindex')).toBe('-1');
      }
    });

    it('keydown with non-handled key does not close dropdown', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      button!.click();
      (dropdown!.querySelector('[role="menuitem"]') as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      expect(dropdown!.hidden).toBe(false);
    });

    it('keydown Enter when focus not on menuitem does not call handleExport (L207)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      button!.click();
      button!.focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(exportToPDF).not.toHaveBeenCalled();
      expect(exportToCSV).not.toHaveBeenCalled();
    });

    it('handles Enter on focused menuitem (L208 L209)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const pdfItem = menu.querySelector('[data-format="pdf"]') as HTMLElement | null;
      button!.click();
      pdfItem!.focus();
      pdfItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('handles Space on focused menuitem', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const csvItem = menu.querySelector('[data-format="csv"]') as HTMLElement | null;
      button!.click();
      csvItem!.focus();
      csvItem!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(exportToCSV).toHaveBeenCalled();
    });

    it('keydown Enter on focused menuitem uses data-format and handleExport (L209)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const txtItem = menu.querySelector('[data-format="txt"]') as HTMLElement | null;
      button!.click();
      txtItem!.focus();
      txtItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(exportToText).toHaveBeenCalled();
    });

    it('ArrowUp on first menuitem wraps focus to last item (L230)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('dropdown click on item with data-format calls handleExport (L237 L238)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      button!.click();

      const mdItem = menu.querySelector('[data-format="md"]') as HTMLElement | null;
      expect(mdItem).toBeTruthy();
      mdItem!.click();

      expect(exportToMarkdown).toHaveBeenCalled();
    });

    it('closes dropdown on outside click', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      // Open dropdown
      button!.click();
      expect(dropdown!.hidden).toBe(false);

      // Click outside
      document.body.click();

      expect(dropdown!.hidden).toBe(true);
    });

    it('closes dropdown on Escape key', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      // Open dropdown
      button!.click();
      expect(dropdown!.hidden).toBe(false);

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(dropdown!.hidden).toBe(true);
    });

    it('sets aria-expanded correctly', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      expect(button).toBeTruthy();

      expect(button!.getAttribute('aria-expanded')).toBe('false');

      button!.click();
      expect(button!.getAttribute('aria-expanded')).toBe('true');

      button!.click();
      expect(button!.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Format selection', () => {
    it('calls exportToPDF when PDF option clicked', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const pdfOption = menu.querySelector('[data-format="pdf"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(pdfOption).toBeTruthy();
      button!.click();
      pdfOption!.click();

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('calls exportToCSV when CSV option clicked', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const csvOption = menu.querySelector('[data-format="csv"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(csvOption).toBeTruthy();
      button!.click();
      csvOption!.click();

      expect(exportToCSV).toHaveBeenCalled();
    });

    it('calls exportToMarkdown when Markdown option clicked', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const mdOption = menu.querySelector('[data-format="md"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(mdOption).toBeTruthy();
      button!.click();
      mdOption!.click();

      expect(exportToMarkdown).toHaveBeenCalled();
    });

    it('calls exportToText when Text option clicked', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const txtOption = menu.querySelector('[data-format="txt"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(txtOption).toBeTruthy();
      button!.click();
      txtOption!.click();

      expect(exportToText).toHaveBeenCalled();
    });

    it('does not export when content is null', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const pdfOption = menu.querySelector('[data-format="pdf"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(pdfOption).toBeTruthy();
      button!.click();

      // Set content to null before clicking export
      vi.mocked(getExportContent).mockReturnValue(null);

      pdfOption!.click();

      // exportToPDF should NOT be called when content is null
      expect(exportToPDF).not.toHaveBeenCalled();
    });

    it('closes dropdown after selection', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      const pdfOption = menu.querySelector('[data-format="pdf"]') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();
      expect(pdfOption).toBeTruthy();

      button!.click();
      expect(dropdown!.hidden).toBe(false);

      pdfOption!.click();

      expect(dropdown!.hidden).toBe(true);
    });
  });

  describe('Keyboard navigation', () => {
    it('moves focus with Arrow Down', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(items[1]);
    });

    it('moves focus with Arrow Up', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[1] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps focus at boundaries (down)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[items.length - 1] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps focus at boundaries (up)', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('selects item on Enter', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('selects item on Space', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('closes dropdown on Escape and focuses toggle', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();

      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(dropdown!.hidden).toBe(true);
      expect(document.activeElement).toBe(button);
    });

    it('closes dropdown on Tab key', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      const dropdown = menu.querySelector('#export-dropdown') as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(dropdown).toBeTruthy();

      button!.click();
      expect(dropdown!.hidden).toBe(false);

      // Focus an item and press Tab
      const items = dropdown!.querySelectorAll('[role="menuitem"]');
      (items[0] as HTMLElement).focus();

      dropdown!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

      expect(dropdown!.hidden).toBe(true);
    });
  });

  describe('Content updates', () => {
    it('subscribes to export content changes', () => {
      ExportMenu();

      expect(subscribeToExportContent).toHaveBeenCalled();
    });

    it('updates available formats when content changes', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      // Initially 4 formats
      expect(menu.querySelectorAll('.export-dropdown-item')).toHaveLength(4);

      // Simulate content change to CONTENT type (no CSV)
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'md', 'txt']);
      vi.mocked(getExportContent).mockReturnValue({
        type: 'content',
        title: 'About',
        data: 'Markdown content'
      });

      // Trigger the callback
      if (localThis.subscribeCallback) {
        localThis.subscribeCallback!({ type: 'content', title: 'About', data: 'Markdown' });
      }

      expect(menu.querySelectorAll('.export-dropdown-item')).toHaveLength(3);
    });

    it('disables when content cleared', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle') as HTMLButtonElement | null;
      expect(button).toBeTruthy();
      expect(button!.disabled).toBe(false);

      // Simulate content cleared
      vi.mocked(getAvailableFormats).mockReturnValue([]);
      vi.mocked(getExportContent).mockReturnValue(null);

      if (localThis.subscribeCallback) {
        localThis.subscribeCallback!(null);
      }

      expect(button!.disabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('button has aria-label', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button!.getAttribute('aria-label')).toBe('Download page content');
    });

    it('button has aria-haspopup="true"', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button!.getAttribute('aria-haspopup')).toBe('true');
    });

    it('button has aria-expanded attribute', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button!.hasAttribute('aria-expanded')).toBe(true);
    });

    it('dropdown has role="menu"', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const dropdown = menu.querySelector('#export-dropdown');
      expect(dropdown).toBeTruthy();
      expect(dropdown!.getAttribute('role')).toBe('menu');
    });

    it('menu items have role="menuitem"', () => {
      const menu = ExportMenu();
      localThis.container!.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      items.forEach(item => {
        expect(item.getAttribute('role')).toBe('menuitem');
      });
    });
  });

  describe('Cleanup', () => {
    it('has cleanup function', () => {
      const menu = ExportMenu();

      expect(typeof (menu as CleanableElement).cleanup).toBe('function');
    });

    it('unsubscribes on cleanup', () => {
      const unsubscribeMock = vi.fn();
      vi.mocked(subscribeToExportContent).mockReturnValue(unsubscribeMock);

      const menu = ExportMenu();
      (menu as CleanableElement).cleanup!();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
