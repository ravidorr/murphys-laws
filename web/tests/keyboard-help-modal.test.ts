// @ts-nocheck
import {
  openKeyboardHelpModal,
  closeKeyboardHelpModal,
  isKeyboardHelpModalOpen,
  destroyKeyboardHelpModal
} from '../src/components/keyboard-help-modal.js';

describe('keyboard-help-modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    destroyKeyboardHelpModal();
  });

  afterEach(() => {
    destroyKeyboardHelpModal();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('openKeyboardHelpModal', () => {
    it('creates and appends modal to body', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      expect(localThis.modal).toBeTruthy();
      expect(document.body.contains(localThis.modal)).toBe(true);
    });

    it('removes hidden class when opening', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      expect(localThis.modal.classList.contains('hidden')).toBe(false);
    });

    it('sets body overflow to hidden', () => {
      openKeyboardHelpModal();
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('focuses the close button', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.closeBtn = document.querySelector('[data-modal-close]');
      expect(document.activeElement).toBe(localThis.closeBtn);
    });

    it('stores previous active element', () => {
      const localThis = {};
      localThis.button = document.createElement('button');
      localThis.button.textContent = 'Test';
      document.body.appendChild(localThis.button);
      localThis.button.focus();

      openKeyboardHelpModal();
      closeKeyboardHelpModal();

      expect(document.activeElement).toBe(localThis.button);
    });

    it('reuses existing modal element', () => {
      const localThis = {};
      openKeyboardHelpModal();
      localThis.modal1 = document.getElementById('keyboard-help-modal');
      closeKeyboardHelpModal();
      openKeyboardHelpModal();
      localThis.modal2 = document.getElementById('keyboard-help-modal');

      expect(localThis.modal1).toBe(localThis.modal2);
    });
  });

  describe('closeKeyboardHelpModal', () => {
    it('adds hidden class when closing', () => {
      const localThis = {};
      openKeyboardHelpModal();
      closeKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      expect(localThis.modal.classList.contains('hidden')).toBe(true);
    });

    it('restores body overflow', () => {
      openKeyboardHelpModal();
      expect(document.body.style.overflow).toBe('hidden');

      closeKeyboardHelpModal();
      expect(document.body.style.overflow).toBe('');
    });

    it('restores focus to previous element', () => {
      const localThis = {};
      localThis.button = document.createElement('button');
      localThis.button.textContent = 'Test';
      document.body.appendChild(localThis.button);
      localThis.button.focus();

      openKeyboardHelpModal();
      closeKeyboardHelpModal();

      expect(document.activeElement).toBe(localThis.button);
    });

    it('does nothing when modal does not exist', () => {
      expect(() => closeKeyboardHelpModal()).not.toThrow();
    });

    it('handles null previousActiveElement gracefully', () => {
      openKeyboardHelpModal();
      // Force previous element to null
      closeKeyboardHelpModal();
      closeKeyboardHelpModal(); // Call again with no previous element

      expect(() => closeKeyboardHelpModal()).not.toThrow();
    });
  });

  describe('isKeyboardHelpModalOpen', () => {
    it('returns false when modal does not exist', () => {
      expect(isKeyboardHelpModalOpen()).toBe(false);
    });

    it('returns false when modal is hidden', () => {
      openKeyboardHelpModal();
      closeKeyboardHelpModal();
      expect(isKeyboardHelpModalOpen()).toBe(false);
    });

    it('returns true when modal is open', () => {
      openKeyboardHelpModal();
      expect(isKeyboardHelpModalOpen()).toBe(true);
    });
  });

  describe('destroyKeyboardHelpModal', () => {
    it('removes modal from DOM', () => {
      const localThis = {};
      openKeyboardHelpModal();
      localThis.modal = document.getElementById('keyboard-help-modal');
      expect(localThis.modal).toBeTruthy();

      destroyKeyboardHelpModal();
      localThis.modalAfter = document.getElementById('keyboard-help-modal');
      expect(localThis.modalAfter).toBeNull();
    });

    it('does nothing when modal does not exist', () => {
      expect(() => destroyKeyboardHelpModal()).not.toThrow();
    });

    it('allows creating new modal after destroy', () => {
      const localThis = {};
      openKeyboardHelpModal();
      localThis.modal1 = document.getElementById('keyboard-help-modal');
      destroyKeyboardHelpModal();
      openKeyboardHelpModal();
      localThis.modal2 = document.getElementById('keyboard-help-modal');

      expect(localThis.modal2).toBeTruthy();
      expect(localThis.modal1).not.toBe(localThis.modal2);
    });
  });

  describe('modal interactions', () => {
    it('closes when clicking backdrop', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.backdrop = document.querySelector('[data-modal-backdrop]');
      localThis.backdrop.click();

      expect(isKeyboardHelpModalOpen()).toBe(false);
    });

    it('closes when clicking close button', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.closeBtn = document.querySelector('[data-modal-close]');
      localThis.closeBtn.click();

      expect(isKeyboardHelpModalOpen()).toBe(false);
    });
  });

  describe('focus trap', () => {
    it('traps Tab to last focusable when on first', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.closeBtn = document.querySelector('[data-modal-close]');
      localThis.closeBtn.focus();

      localThis.event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true
      });
      localThis.event.preventDefault = vi.fn();

      localThis.modal = document.getElementById('keyboard-help-modal');
      localThis.modal.dispatchEvent(localThis.event);

      expect(localThis.event.preventDefault).toHaveBeenCalled();
    });

    it('traps Shift+Tab to first focusable when on last', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      localThis.focusables = localThis.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      localThis.lastFocusable = localThis.focusables[localThis.focusables.length - 1];
      localThis.lastFocusable.focus();

      localThis.event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true
      });
      localThis.event.preventDefault = vi.fn();

      localThis.modal.dispatchEvent(localThis.event);

      expect(localThis.event.preventDefault).toHaveBeenCalled();
    });

    it('allows Tab within modal when not at boundary', () => {
      const localThis = {};
      openKeyboardHelpModal();

      // Add extra focusable element to test mid-list Tab
      localThis.modal = document.getElementById('keyboard-help-modal');
      localThis.container = localThis.modal.querySelector('.modal-container');
      localThis.extraBtn = document.createElement('button');
      localThis.extraBtn.textContent = 'Extra';
      localThis.container.appendChild(localThis.extraBtn);

      localThis.closeBtn = document.querySelector('[data-modal-close]');
      localThis.closeBtn.focus();

      localThis.event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true
      });
      localThis.event.preventDefault = vi.fn();

      localThis.modal.dispatchEvent(localThis.event);

      // Should not prevent default when not at boundary
      // Note: The actual focus trap logic prevents at boundaries only
      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores non-Tab keys', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      localThis.event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      localThis.event.preventDefault = vi.fn();

      localThis.modal.dispatchEvent(localThis.event);

      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('modal content', () => {
    it('contains keyboard shortcuts title', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.title = document.getElementById('keyboard-help-title');
      expect(localThis.title).toBeTruthy();
      expect(localThis.title.textContent).toMatch(/keyboard shortcuts/i);
    });

    it('has proper ARIA attributes', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.dialog = document.querySelector('[role="dialog"]');
      expect(localThis.dialog).toBeTruthy();
      expect(localThis.dialog.getAttribute('aria-modal')).toBe('true');
      expect(localThis.dialog.getAttribute('aria-labelledby')).toBe('keyboard-help-title');
    });

    it('contains shortcut descriptions', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.modal = document.getElementById('keyboard-help-modal');
      localThis.content = localThis.modal.textContent;

      expect(localThis.content).toMatch(/focus search/i);
      expect(localThis.content).toMatch(/next law card/i);
      expect(localThis.content).toMatch(/previous law card/i);
    });

    it('contains kbd elements for keys', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.kbds = document.querySelectorAll('kbd');
      expect(localThis.kbds.length).toBeGreaterThan(0);

      localThis.keyTexts = Array.from(localThis.kbds).map(kbd => kbd.textContent);
      expect(localThis.keyTexts).toContain('/');
      expect(localThis.keyTexts).toContain('j');
      expect(localThis.keyTexts).toContain('k');
      expect(localThis.keyTexts).toContain('?');
    });

    it('has accessible close button', () => {
      const localThis = {};
      openKeyboardHelpModal();

      localThis.closeBtn = document.querySelector('[data-modal-close]');
      expect(localThis.closeBtn.getAttribute('aria-label')).toBeTruthy();
      expect(localThis.closeBtn.getAttribute('type')).toBe('button');
    });
  });
});
