// @ts-nocheck
import { vi } from 'vitest';

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

describe('Export Menu Component', () => {
  const localThis = {
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
    };
    
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
    if (localThis.container && localThis.container.parentNode) {
      document.body.removeChild(localThis.container);
    }
    localThis.subscribeCallback = null;
  });

  describe('Rendering', () => {
    it('renders export button with download icon', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button).toBeTruthy();
      expect(button.querySelector('svg')).toBeTruthy();
    });

    it('renders dropdown menu (hidden by default)', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const dropdown = menu.querySelector('#export-dropdown');
      expect(dropdown).toBeTruthy();
      expect(dropdown.hidden).toBe(true);
    });

    it('shows all formats when LAWS content type', () => {
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'csv', 'md', 'txt']);

      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      expect(items).toHaveLength(4);
    });

    it('hides CSV option for CONTENT type', () => {
      vi.mocked(getAvailableFormats).mockReturnValue(['pdf', 'md', 'txt']);

      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      expect(items).toHaveLength(3);
      expect(menu.querySelector('[data-format="csv"]')).toBeNull();
    });

    it('disables button when no export content', () => {
      vi.mocked(getExportContent).mockReturnValue(null);
      vi.mocked(getAvailableFormats).mockReturnValue([]);

      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.disabled).toBe(true);
    });

    it('enables button when export content available', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.disabled).toBe(false);
    });
  });

  describe('Dropdown behavior', () => {
    it('opens dropdown on button click', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      expect(dropdown.hidden).toBe(false);
    });

    it('closes dropdown on outside click', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      // Open dropdown
      button.click();
      expect(dropdown.hidden).toBe(false);

      // Click outside
      document.body.click();

      expect(dropdown.hidden).toBe(true);
    });

    it('closes dropdown on Escape key', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      // Open dropdown
      button.click();
      expect(dropdown.hidden).toBe(false);

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(dropdown.hidden).toBe(true);
    });

    it('sets aria-expanded correctly', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');

      expect(button.getAttribute('aria-expanded')).toBe('false');

      button.click();
      expect(button.getAttribute('aria-expanded')).toBe('true');

      button.click();
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Format selection', () => {
    it('calls exportToPDF when PDF option clicked', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      button.click();

      const pdfOption = menu.querySelector('[data-format="pdf"]');
      pdfOption.click();

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('calls exportToCSV when CSV option clicked', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      button.click();

      const csvOption = menu.querySelector('[data-format="csv"]');
      csvOption.click();

      expect(exportToCSV).toHaveBeenCalled();
    });

    it('calls exportToMarkdown when Markdown option clicked', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      button.click();

      const mdOption = menu.querySelector('[data-format="md"]');
      mdOption.click();

      expect(exportToMarkdown).toHaveBeenCalled();
    });

    it('calls exportToText when Text option clicked', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      button.click();

      const txtOption = menu.querySelector('[data-format="txt"]');
      txtOption.click();

      expect(exportToText).toHaveBeenCalled();
    });

    it('does not export when content is null', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      button.click();

      // Set content to null before clicking export
      vi.mocked(getExportContent).mockReturnValue(null);

      const pdfOption = menu.querySelector('[data-format="pdf"]');
      pdfOption.click();

      // exportToPDF should NOT be called when content is null
      expect(exportToPDF).not.toHaveBeenCalled();
    });

    it('closes dropdown after selection', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();
      expect(dropdown.hidden).toBe(false);

      const pdfOption = menu.querySelector('[data-format="pdf"]');
      pdfOption.click();

      expect(dropdown.hidden).toBe(true);
    });
  });

  describe('Keyboard navigation', () => {
    it('moves focus with Arrow Down', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(items[1]);
    });

    it('moves focus with Arrow Up', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[1].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps focus at boundaries (down)', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[items.length - 1].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps focus at boundaries (up)', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('selects item on Enter', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('selects item on Space', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(exportToPDF).toHaveBeenCalled();
    });

    it('closes dropdown on Escape and focuses toggle', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(dropdown.hidden).toBe(true);
      expect(document.activeElement).toBe(button);
    });

    it('closes dropdown on Tab key', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      const dropdown = menu.querySelector('#export-dropdown');

      button.click();
      expect(dropdown.hidden).toBe(false);

      // Focus an item and press Tab
      const items = dropdown.querySelectorAll('[role="menuitem"]');
      items[0].focus();

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

      expect(dropdown.hidden).toBe(true);
    });
  });

  describe('Content updates', () => {
    it('subscribes to export content changes', () => {
      ExportMenu();

      expect(subscribeToExportContent).toHaveBeenCalled();
    });

    it('updates available formats when content changes', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

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
        localThis.subscribeCallback({ type: 'content', title: 'About', data: 'Markdown' });
      }

      expect(menu.querySelectorAll('.export-dropdown-item')).toHaveLength(3);
    });

    it('disables when content cleared', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.disabled).toBe(false);

      // Simulate content cleared
      vi.mocked(getAvailableFormats).mockReturnValue([]);
      vi.mocked(getExportContent).mockReturnValue(null);

      if (localThis.subscribeCallback) {
        localThis.subscribeCallback(null);
      }

      expect(button.disabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('button has aria-label', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.getAttribute('aria-label')).toBe('Download page content');
    });

    it('button has aria-haspopup="true"', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.getAttribute('aria-haspopup')).toBe('true');
    });

    it('button has aria-expanded attribute', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const button = menu.querySelector('#export-toggle');
      expect(button.hasAttribute('aria-expanded')).toBe(true);
    });

    it('dropdown has role="menu"', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const dropdown = menu.querySelector('#export-dropdown');
      expect(dropdown.getAttribute('role')).toBe('menu');
    });

    it('menu items have role="menuitem"', () => {
      const menu = ExportMenu();
      localThis.container.appendChild(menu);

      const items = menu.querySelectorAll('.export-dropdown-item');
      items.forEach(item => {
        expect(item.getAttribute('role')).toBe('menuitem');
      });
    });
  });

  describe('Cleanup', () => {
    it('has cleanup function', () => {
      const menu = ExportMenu();

      expect(typeof menu.cleanup).toBe('function');
    });

    it('unsubscribes on cleanup', () => {
      const unsubscribeMock = vi.fn();
      vi.mocked(subscribeToExportContent).mockReturnValue(unsubscribeMock);

      const menu = ExportMenu();
      menu.cleanup();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
