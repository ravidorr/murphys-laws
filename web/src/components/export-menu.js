/**
 * @fileoverview Export Menu Component
 *
 * Provides a dropdown menu for exporting page content to various formats.
 * The component subscribes to the export context and dynamically updates
 * available format options based on the current page content type.
 *
 * @module export-menu
 */

import { createIcon } from '../utils/icons.js';
import {
  getExportContent,
  getAvailableFormats,
  subscribeToExportContent
} from '../utils/export-context.js';
import {
  exportToPDF,
  exportToCSV,
  exportToMarkdown,
  exportToText,
  generateFilename
} from '../utils/export.js';

/**
 * Format labels for the dropdown menu
 */
const FORMAT_LABELS = {
  pdf: 'PDF Document',
  csv: 'CSV Spreadsheet',
  md: 'Markdown',
  txt: 'Plain Text'
};

/**
 * Create the export menu component.
 * Format options are dynamically shown based on current page content type.
 * CSV is hidden for non-structured content (about, privacy, etc.).
 * The menu subscribes to content changes to update available options.
 *
 * @returns {HTMLElement} The export menu container element
 */
export function ExportMenu() {
  const container = document.createElement('div');
  container.className = 'export-menu-container';

  // Create the toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = 'export-toggle';
  toggleBtn.className = 'export-toggle';
  toggleBtn.setAttribute('data-tooltip', 'Export page');
  toggleBtn.setAttribute('data-tooltip-pos', 'bottom');
  toggleBtn.setAttribute('aria-label', 'Export page content');
  toggleBtn.setAttribute('aria-haspopup', 'true');
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.disabled = true; // Disabled by default until content is registered

  // Add download icon
  const icon = createIcon('download');
  if (icon) {
    toggleBtn.appendChild(icon);
  }

  // Create the dropdown menu
  const dropdown = document.createElement('div');
  dropdown.id = 'export-dropdown';
  dropdown.className = 'export-dropdown';
  dropdown.setAttribute('role', 'menu');
  dropdown.setAttribute('aria-label', 'Export formats');
  dropdown.hidden = true;

  container.appendChild(toggleBtn);
  container.appendChild(dropdown);

  /**
   * Update the dropdown with available formats
   */
  function updateFormats() {
    const formats = getAvailableFormats();
    const hasContent = formats.length > 0;

    // Update button state
    toggleBtn.disabled = !hasContent;
    toggleBtn.setAttribute('aria-disabled', String(!hasContent));

    // Update tooltip
    toggleBtn.setAttribute(
      'data-tooltip',
      hasContent ? 'Export page' : 'No exportable content'
    );

    // Clear and rebuild dropdown
    dropdown.innerHTML = '';

    if (!hasContent) {
      return;
    }

    formats.forEach((format, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'export-dropdown-item';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('data-format', format);
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      item.textContent = FORMAT_LABELS[format] || format.toUpperCase();
      dropdown.appendChild(item);
    });
  }

  /**
   * Open the dropdown menu
   */
  function openDropdown() {
    dropdown.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');

    // Focus first item
    const firstItem = dropdown.querySelector('[role="menuitem"]');
    if (firstItem) {
      firstItem.focus();
    }
  }

  /**
   * Close the dropdown menu
   */
  function closeDropdown() {
    dropdown.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  /**
   * Toggle the dropdown menu
   */
  function toggleDropdown() {
    if (dropdown.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  }

  /**
   * Handle format selection
   * @param {string} format - Format identifier
   */
  function handleExport(format) {
    const content = getExportContent();
    if (!content) {
      return;
    }

    const filename = generateFilename(content.title, format);

    switch (format) {
      case 'pdf':
        exportToPDF(content, filename);
        break;
      case 'csv':
        exportToCSV(content, filename);
        break;
      case 'md':
        exportToMarkdown(content, filename);
        break;
      case 'txt':
        exportToText(content, filename);
        break;
    }

    closeDropdown();
  }

  /**
   * Handle keyboard navigation within dropdown
   * @param {KeyboardEvent} e - Keyboard event
   */
  function handleKeydown(e) {
    const items = Array.from(dropdown.querySelectorAll('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1].focus();
        } else {
          // Wrap to first item
          items[0].focus();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex - 1].focus();
        } else {
          // Wrap to last item
          items[items.length - 1].focus();
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (document.activeElement.hasAttribute('data-format')) {
          const format = document.activeElement.getAttribute('data-format');
          handleExport(format);
        }
        break;

      case 'Escape':
        e.preventDefault();
        closeDropdown();
        toggleBtn.focus();
        break;

      case 'Tab':
        // Close dropdown when tabbing out
        closeDropdown();
        break;
    }
  }

  // Event listeners
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!toggleBtn.disabled) {
      toggleDropdown();
    }
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('[data-format]');
    if (item) {
      const format = item.getAttribute('data-format');
      handleExport(format);
    }
  });

  dropdown.addEventListener('keydown', handleKeydown);

  // Close on outside click
  const handleDocumentClick = (e) => {
    if (!container.contains(e.target)) {
      closeDropdown();
    }
  };
  document.addEventListener('click', handleDocumentClick);

  // Close on escape anywhere
  const handleDocumentKeydown = (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      closeDropdown();
      toggleBtn.focus();
    }
  };
  document.addEventListener('keydown', handleDocumentKeydown);

  // Subscribe to content changes
  const unsubscribe = subscribeToExportContent(() => {
    updateFormats();
    // Close dropdown when content changes
    closeDropdown();
  });

  // Initial update
  updateFormats();

  // Cleanup function
  container.cleanup = () => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
    unsubscribe();
  };

  return container;
}
