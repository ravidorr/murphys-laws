/**
 * @fileoverview Export Context System
 *
 * Provides a singleton context for pages to register their exportable content.
 * The export menu component subscribes to content changes and displays
 * appropriate format options based on the content type.
 *
 * @example
 * // In a view component
 * import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.js';
 *
 * // Register content after loading
 * setExportContent({
 *   type: ContentType.LAWS,
 *   title: 'Search Results',
 *   data: laws,
 *   metadata: { total: 100 }
 * });
 *
 * // Clear on cleanup
 * el.cleanup = () => clearExportContent();
 *
 * @module export-context
 */

/**
 * Content types for export.
 * Determines which export formats are available.
 * @readonly
 * @enum {string}
 */
export const ContentType = {
  /** Array of law objects (browse, favorites, category pages) */
  LAWS: 'laws',
  /** Single law object (law detail page) */
  SINGLE_LAW: 'single_law',
  /** Markdown/text content (about, privacy, terms pages) */
  CONTENT: 'content',
  /** Array of category objects (categories list page) */
  CATEGORIES: 'categories'
};

// Using a singleton pattern to allow any page to register content
// and the header export menu to access it without prop drilling

/** @type {ExportContent|null} */
let currentContent = null;

/** @type {Set<Function>} */
const listeners = new Set();

/**
 * @typedef {Object} ExportContent
 * @property {string} type - Content type from ContentType enum
 * @property {string} title - Title for the exported document
 * @property {*} data - The actual data to export (laws array, single law, markdown string, categories array)
 * @property {Object} [metadata] - Optional metadata (e.g., total count, filters)
 */

/**
 * Register page content for export.
 * Call this when a page loads its content to make it available for export.
 * @param {ExportContent} content - The content to register
 */
export function setExportContent({ type, title, data, metadata = {} }) {
  currentContent = { type, title, data, metadata };
  // Notify all subscribers of the content change
  listeners.forEach(fn => fn(currentContent));
}

/**
 * Get the current exportable content.
 * @returns {ExportContent|null} The current content or null if none registered
 */
export function getExportContent() {
  return currentContent;
}

/**
 * Clear export content.
 * Call this when a page unmounts to prevent stale content from being exported.
 */
export function clearExportContent() {
  currentContent = null;
  // Notify all subscribers that content has been cleared
  listeners.forEach(fn => fn(null));
}

/**
 * Subscribe to export content changes.
 * The callback is called immediately with current content and whenever content changes.
 * @param {Function} callback - Function to call when content changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToExportContent(callback) {
  listeners.add(callback);
  // Return unsubscribe function
  return () => listeners.delete(callback);
}

/**
 * Get available export formats for the current content type.
 * CSV is only available for structured data (laws, categories).
 * @returns {string[]} Array of format identifiers ('pdf', 'csv', 'md', 'txt')
 */
export function getAvailableFormats() {
  if (!currentContent) return [];

  const { type } = currentContent;
  const formats = ['pdf', 'md', 'txt']; // Always available for all content types

  // CSV only for structured data (laws and categories)
  if ([ContentType.LAWS, ContentType.SINGLE_LAW, ContentType.CATEGORIES].includes(type)) {
    formats.splice(1, 0, 'csv'); // Insert after PDF
  }

  return formats;
}

/**
 * Reset the export context (useful for testing).
 * Clears content and removes all listeners.
 */
export function resetExportContext() {
  currentContent = null;
  listeners.clear();
}
