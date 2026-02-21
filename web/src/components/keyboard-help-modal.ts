// Keyboard help modal component
// Shows available keyboard shortcuts in an accessible modal

import templateHtml from '@components/templates/keyboard-help-modal.html?raw';
import { hydrateIcons } from '../utils/icons.ts';

let modalElement: HTMLDivElement | null = null;
let previousActiveElement: HTMLElement | null = null;
let focusableElements: NodeListOf<HTMLElement> | HTMLElement[] = [];
let firstFocusable: HTMLElement | null = null;
let lastFocusable: HTMLElement | null = null;

/**
 * Create the modal element if it doesn't exist
 * @returns {HTMLElement}
 */
function getOrCreateModal() {
  if (modalElement && document.body.contains(modalElement)) {
    return modalElement;
  }
  
  modalElement = document.createElement('div');
  modalElement.className = 'modal keyboard-help hidden';
  modalElement.id = 'keyboard-help-modal';
  modalElement.innerHTML = templateHtml;
  
  // Hydrate icons
  hydrateIcons(modalElement);
  
  // Add event listeners
  const backdrop = modalElement.querySelector('[data-modal-backdrop]');
  const closeBtn = modalElement.querySelector('[data-modal-close]');
  
  backdrop?.addEventListener('click', closeKeyboardHelpModal);
  closeBtn?.addEventListener('click', closeKeyboardHelpModal);
  
  // Handle focus trap
  modalElement.addEventListener('keydown', handleModalKeydown);

  document.body.appendChild(modalElement);

  return modalElement;
}

/**
 * Update focusable elements list for focus trap
 */
function updateFocusableElements() {
  const modal = getOrCreateModal();
  const container = modal.querySelector('.modal-container')!;
  // Template always has .modal-container with at least one focusable (close button).
  focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  // Template always has at least one focusable (close button).
  firstFocusable = focusableElements[0]!;
  lastFocusable = focusableElements[focusableElements.length - 1]!;
}

/**
 * Handle keydown events within modal for focus trap
 * @param {KeyboardEvent} event
 */
function handleModalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  
  updateFocusableElements();
  
  if (event.shiftKey) {
    // Shift + Tab: if on first element, go to last
    if (document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable!.focus();
    }
  } else {
    // Tab: if on last element, go to first
    if (document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable!.focus();
    }
  }
}

/**
 * Check if the keyboard help modal is currently open
 * @returns {boolean}
 */
export function isKeyboardHelpModalOpen(): boolean {
  return !!(modalElement && !modalElement.classList.contains('hidden'));
}

/**
 * Open the keyboard help modal
 */
export function openKeyboardHelpModal() {
  const modal = getOrCreateModal();
  
  // Store current focus to restore later
  previousActiveElement = document.activeElement as HTMLElement | null;
  
  // Show modal
  modal.classList.remove('hidden');
  
  // Focus the close button
  updateFocusableElements();
  firstFocusable?.focus();
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close the keyboard help modal
 */
export function closeKeyboardHelpModal() {
  if (!modalElement) return;
  
  modalElement.classList.add('hidden');
  
  // Restore body scroll
  document.body.style.overflow = '';
  
  // Restore focus to previous element
  if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    previousActiveElement.focus();
  }
  
  previousActiveElement = null;
}

/**
 * Destroy the modal element (useful for cleanup in tests)
 */
export function destroyKeyboardHelpModal() {
  if (modalElement && modalElement.parentNode) {
    modalElement.parentNode.removeChild(modalElement);
  }
  modalElement = null;
  previousActiveElement = null;
  focusableElements = [];
  firstFocusable = null;
  lastFocusable = null;
}
