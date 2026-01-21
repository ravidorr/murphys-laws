// Keyboard shortcuts manager for global navigation
// Shortcuts: / (search), j/k (navigate cards), ? (help modal)

import { openKeyboardHelpModal, closeKeyboardHelpModal, isKeyboardHelpModalOpen } from '../components/keyboard-help-modal.js';

/**
 * Check if the current focus is in an editable element
 * @returns {boolean} True if user is typing in an input/textarea/contenteditable
 */
function isEditableElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName?.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  
  // Check both property and attribute for contentEditable (jsdom compatibility)
  if (element.isContentEditable || element.getAttribute?.('contenteditable') === 'true') {
    return true;
  }
  
  return false;
}

/**
 * Focus the header search input
 */
function focusSearch() {
  const searchInput = document.querySelector('#header-search');
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

/**
 * Navigate to the next law card
 */
function navigateToNextCard() {
  const cards = document.querySelectorAll('.law-card-mini');
  if (cards.length === 0) return;
  
  const currentIndex = Array.from(cards).indexOf(document.activeElement);
  
  if (currentIndex === -1) {
    // No card focused, focus the first one
    cards[0]?.focus();
  } else {
    // Move to next card
    const nextIndex = Math.min(currentIndex + 1, cards.length - 1);
    cards[nextIndex]?.focus();
  }
}

/**
 * Navigate to the previous law card
 */
function navigateToPreviousCard() {
  const cards = document.querySelectorAll('.law-card-mini');
  if (cards.length === 0) return;
  
  const currentIndex = Array.from(cards).indexOf(document.activeElement);
  
  if (currentIndex === -1) {
    // No card focused, focus the last one
    cards[cards.length - 1]?.focus();
  } else {
    // Move to previous card
    const prevIndex = Math.max(currentIndex - 1, 0);
    cards[prevIndex]?.focus();
  }
}

/**
 * Handle global keydown events for shortcuts
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
  const target = event.target;
  
  // Always handle Escape to close modal
  if (event.key === 'Escape') {
    if (isKeyboardHelpModalOpen()) {
      closeKeyboardHelpModal();
      event.preventDefault();
      return;
    }
    // Let other Escape handlers run (e.g., share popovers)
    return;
  }
  
  // Skip shortcuts when typing in editable elements
  if (isEditableElement(target)) {
    return;
  }
  
  switch (event.key) {
    case '/':
      event.preventDefault();
      focusSearch();
      break;
      
    case '?':
      event.preventDefault();
      // Only open if not already open - prevents overwriting previousActiveElement
      // with an element inside the modal, which would break focus restoration
      if (!isKeyboardHelpModalOpen()) {
        openKeyboardHelpModal();
      }
      break;
      
    case 'j':
      // Don't prevent default - allow normal typing if somehow triggered
      navigateToNextCard();
      break;
      
    case 'k':
      navigateToPreviousCard();
      break;
  }
}

let initialized = false;

/**
 * Initialize global keyboard shortcuts
 * Safe to call multiple times - will only attach listener once
 */
export function initKeyboardShortcuts() {
  if (initialized) return;
  
  document.addEventListener('keydown', handleKeydown);
  initialized = true;
}

/**
 * Remove global keyboard shortcuts listener
 * Useful for cleanup in tests
 */
export function destroyKeyboardShortcuts() {
  document.removeEventListener('keydown', handleKeydown);
  initialized = false;
}

// Export for testing
export {
  isEditableElement,
  focusSearch,
  navigateToNextCard,
  navigateToPreviousCard,
  handleKeydown
};
