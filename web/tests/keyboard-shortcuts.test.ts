// @ts-nocheck
import {
  initKeyboardShortcuts,
  destroyKeyboardShortcuts,
  isEditableElement,
  isAutocompleteOpen,
  focusSearch,
  navigateToNextCard,
  navigateToPreviousCard,
  handleKeydown
} from '../src/utils/keyboard-shortcuts.ts';
import * as helpModal from '../src/components/keyboard-help-modal.js';

// Mock the keyboard help modal module
vi.mock('../src/components/keyboard-help-modal.js', () => ({
  openKeyboardHelpModal: vi.fn(),
  closeKeyboardHelpModal: vi.fn(),
  isKeyboardHelpModalOpen: vi.fn().mockReturnValue(false)
}));

describe('keyboard-shortcuts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    destroyKeyboardShortcuts();
  });

  afterEach(() => {
    destroyKeyboardShortcuts();
    document.body.innerHTML = '';
  });

  describe('isEditableElement', () => {
    it('returns false for null element', () => {
      const localThis: Record<string, any> = {};
      localThis.result = isEditableElement(null);
      expect(localThis.result).toBe(false);
    });

    it('returns true for input elements', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.result = isEditableElement(localThis.input);
      expect(localThis.result).toBe(true);
    });

    it('returns true for textarea elements', () => {
      const localThis: Record<string, any> = {};
      localThis.textarea = document.createElement('textarea');
      localThis.result = isEditableElement(localThis.textarea);
      expect(localThis.result).toBe(true);
    });

    it('returns true for select elements', () => {
      const localThis: Record<string, any> = {};
      localThis.select = document.createElement('select');
      localThis.result = isEditableElement(localThis.select);
      expect(localThis.result).toBe(true);
    });

    it('returns true for contenteditable elements', () => {
      const localThis: Record<string, any> = {};
      localThis.div = document.createElement('div');
      localThis.div.setAttribute('contenteditable', 'true');
      localThis.result = isEditableElement(localThis.div);
      expect(localThis.result).toBe(true);
    });

    it('returns false for regular div', () => {
      const localThis: Record<string, any> = {};
      localThis.div = document.createElement('div');
      localThis.result = isEditableElement(localThis.div);
      expect(localThis.result).toBe(false);
    });

    it('returns false for button', () => {
      const localThis: Record<string, any> = {};
      localThis.button = document.createElement('button');
      localThis.result = isEditableElement(localThis.button);
      expect(localThis.result).toBe(false);
    });
  });

  describe('isAutocompleteOpen', () => {
    it('returns false when search input does not exist', () => {
      const localThis: Record<string, any> = {};
      document.body.innerHTML = '';
      localThis.result = isAutocompleteOpen();
      expect(localThis.result).toBe(false);
    });

    it('returns false when search input aria-expanded is false', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.setAttribute('aria-expanded', 'false');
      document.body.appendChild(localThis.input);

      localThis.result = isAutocompleteOpen();
      expect(localThis.result).toBe(false);
    });

    it('returns false when search input aria-expanded is not set', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      localThis.result = isAutocompleteOpen();
      expect(localThis.result).toBe(false);
    });

    it('returns true when search input aria-expanded is true', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.setAttribute('aria-expanded', 'true');
      document.body.appendChild(localThis.input);

      localThis.result = isAutocompleteOpen();
      expect(localThis.result).toBe(true);
    });
  });

  describe('focusSearch', () => {
    it('focuses the header search input', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      focusSearch();

      expect(document.activeElement).toBe(localThis.input);
    });

    it('selects the text in the search input', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.value = 'test query';
      document.body.appendChild(localThis.input);

      const selectSpy = vi.spyOn(localThis.input, 'select');
      focusSearch();

      expect(selectSpy).toHaveBeenCalled();
    });

    it('does nothing when search input does not exist', () => {
      expect(() => focusSearch()).not.toThrow();
    });
  });

  describe('navigateToNextCard', () => {
    it('focuses first card when no card is focused', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      navigateToNextCard();

      expect(document.activeElement).toBe(localThis.cards[0]);
    });

    it('focuses next card when a card is focused', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      localThis.cards[0].focus();
      navigateToNextCard();

      expect(document.activeElement).toBe(localThis.cards[1]);
    });

    it('stays on last card when already at end', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      localThis.cards[2].focus();
      navigateToNextCard();

      expect(document.activeElement).toBe(localThis.cards[2]);
    });

    it('does nothing when no cards exist', () => {
      expect(() => navigateToNextCard()).not.toThrow();
    });
  });

  describe('navigateToPreviousCard', () => {
    it('focuses last card when no card is focused', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      navigateToPreviousCard();

      expect(document.activeElement).toBe(localThis.cards[2]);
    });

    it('focuses previous card when a card is focused', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      localThis.cards[2].focus();
      navigateToPreviousCard();

      expect(document.activeElement).toBe(localThis.cards[1]);
    });

    it('stays on first card when already at start', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 3 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        card.textContent = `Card ${i + 1}`;
        document.body.appendChild(card);
        return card;
      });

      localThis.cards[0].focus();
      navigateToPreviousCard();

      expect(document.activeElement).toBe(localThis.cards[0]);
    });

    it('does nothing when no cards exist', () => {
      expect(() => navigateToPreviousCard()).not.toThrow();
    });
  });

  describe('handleKeydown', () => {
    it('focuses search on / key', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(localThis.event.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(localThis.input);
    });

    it('opens help modal on ? key', () => {
      const localThis: Record<string, any> = {};
      localThis.event = new KeyboardEvent('keydown', { key: '?' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(localThis.event.preventDefault).toHaveBeenCalled();
      expect(helpModal.openKeyboardHelpModal).toHaveBeenCalled();
    });

    it('does not reopen help modal on ? key when modal is already open', () => {
      const localThis: Record<string, any> = {};
      // Simulate modal already being open
      (helpModal.isKeyboardHelpModalOpen as any).mockReturnValue(true);

      localThis.event = new KeyboardEvent('keydown', { key: '?' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      // Should still prevent default (to avoid typing ? in inputs)
      expect(localThis.event.preventDefault).toHaveBeenCalled();
      // But should NOT call openKeyboardHelpModal - this prevents overwriting
      // previousActiveElement with an element inside the modal
      expect(helpModal.openKeyboardHelpModal).not.toHaveBeenCalled();
    });

    it('navigates to next card on j key', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 2 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        document.body.appendChild(card);
        return card;
      });

      localThis.event = new KeyboardEvent('keydown', { key: 'j' });
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(document.activeElement).toBe(localThis.cards[0]);
    });

    it('navigates to previous card on k key', () => {
      const localThis: Record<string, any> = {};
      localThis.cards = Array.from({ length: 2 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        document.body.appendChild(card);
        return card;
      });

      localThis.event = new KeyboardEvent('keydown', { key: 'k' });
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(document.activeElement).toBe(localThis.cards[1]);
    });

    it('closes help modal on Escape when modal is open', () => {
      const localThis: Record<string, any> = {};
      (helpModal.isKeyboardHelpModalOpen as any).mockReturnValue(true);

      localThis.event = new KeyboardEvent('keydown', { key: 'Escape' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(helpModal.closeKeyboardHelpModal).toHaveBeenCalled();
      expect(localThis.event.preventDefault).toHaveBeenCalled();
    });

    it('does not close modal on Escape when modal is not open', () => {
      const localThis: Record<string, any> = {};
      (helpModal.isKeyboardHelpModalOpen as any).mockReturnValue(false);

      localThis.event = new KeyboardEvent('keydown', { key: 'Escape' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      expect(helpModal.closeKeyboardHelpModal).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when typing in input', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      localThis.textInput = document.createElement('input');
      document.body.appendChild(localThis.textInput);
      localThis.textInput.focus();

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: localThis.textInput });

      handleKeydown(localThis.event);

      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
      // Focus should not have changed to header-search
      expect(document.activeElement).toBe(localThis.textInput);
    });

    it('ignores shortcuts when typing in textarea', () => {
      const localThis: Record<string, any> = {};
      localThis.textarea = document.createElement('textarea');
      document.body.appendChild(localThis.textarea);
      localThis.textarea.focus();

      localThis.event = new KeyboardEvent('keydown', { key: 'j' });
      Object.defineProperty(localThis.event, 'target', { value: localThis.textarea });

      const card = document.createElement('article');
      card.className = 'law-card-mini';
      card.tabIndex = 0;
      document.body.appendChild(card);

      handleKeydown(localThis.event);

      // Focus should not have moved to the card
      expect(document.activeElement).toBe(localThis.textarea);
    });

    it('ignores shortcuts when typing in select', () => {
      const localThis: Record<string, any> = {};
      localThis.select = document.createElement('select');
      localThis.option = document.createElement('option');
      localThis.option.value = 'test';
      localThis.select.appendChild(localThis.option);
      document.body.appendChild(localThis.select);
      localThis.select.focus();

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: localThis.select });

      handleKeydown(localThis.event);

      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when autocomplete dropdown is open', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.setAttribute('aria-expanded', 'true');
      document.body.appendChild(localThis.input);

      localThis.cards = Array.from({ length: 2 }, (_, i) => {
        const card = document.createElement('article');
        card.className = 'law-card-mini';
        card.tabIndex = 0;
        document.body.appendChild(card);
        return card;
      });

      localThis.event = new KeyboardEvent('keydown', { key: 'j' });
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      // Focus should not have moved to the card when autocomplete is open
      expect(document.activeElement).not.toBe(localThis.cards[0]);
    });

    it('ignores / shortcut when autocomplete dropdown is open', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.setAttribute('aria-expanded', 'true');
      document.body.appendChild(localThis.input);

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      // Should not prevent default or focus search when autocomplete is open
      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores ? shortcut when autocomplete dropdown is open', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      localThis.input.setAttribute('aria-expanded', 'true');
      document.body.appendChild(localThis.input);

      localThis.event = new KeyboardEvent('keydown', { key: '?' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      // Should not open help modal when autocomplete is open
      expect(helpModal.openKeyboardHelpModal).not.toHaveBeenCalled();
    });

    it('does nothing for unrecognized keys', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      localThis.event = new KeyboardEvent('keydown', { key: 'x' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: document.body });

      handleKeydown(localThis.event);

      // Should not prevent default or change focus
      expect(localThis.event.preventDefault).not.toHaveBeenCalled();
      expect(document.activeElement).not.toBe(localThis.input);
    });

    it('ignores shortcuts when typing in contenteditable', () => {
      const localThis: Record<string, any> = {};
      localThis.div = document.createElement('div');
      localThis.div.setAttribute('contenteditable', 'true');
      localThis.div.tabIndex = 0;
      document.body.appendChild(localThis.div);
      localThis.div.focus();

      localThis.event = new KeyboardEvent('keydown', { key: '?' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: localThis.div });

      handleKeydown(localThis.event);

      expect(helpModal.openKeyboardHelpModal).not.toHaveBeenCalled();
    });

    it('still handles Escape when in editable element', () => {
      const localThis: Record<string, any> = {};
      (helpModal.isKeyboardHelpModalOpen as any).mockReturnValue(true);

      localThis.input = document.createElement('input');
      document.body.appendChild(localThis.input);
      localThis.input.focus();

      localThis.event = new KeyboardEvent('keydown', { key: 'Escape' });
      localThis.event.preventDefault = vi.fn();
      Object.defineProperty(localThis.event, 'target', { value: localThis.input });

      handleKeydown(localThis.event);

      // Escape should still close modal even from input
      expect(helpModal.closeKeyboardHelpModal).toHaveBeenCalled();
    });
  });

  describe('initKeyboardShortcuts', () => {
    it('attaches global keydown listener', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      initKeyboardShortcuts();

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      document.dispatchEvent(localThis.event);

      expect(document.activeElement).toBe(localThis.input);
    });

    it('only attaches listener once when called multiple times', () => {
      const localThis: Record<string, any> = {};
      localThis.addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      initKeyboardShortcuts();
      initKeyboardShortcuts();
      initKeyboardShortcuts();

      localThis.keydownCalls = localThis.addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'keydown'
      );
      expect(localThis.keydownCalls.length).toBe(1);

      localThis.addEventListenerSpy.mockRestore();
    });
  });

  describe('destroyKeyboardShortcuts', () => {
    it('removes global keydown listener', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      initKeyboardShortcuts();
      destroyKeyboardShortcuts();

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      document.dispatchEvent(localThis.event);

      // Focus should not have moved since listener was removed
      expect(document.activeElement).not.toBe(localThis.input);
    });

    it('allows re-initialization after destroy', () => {
      const localThis: Record<string, any> = {};
      localThis.input = document.createElement('input');
      localThis.input.id = 'header-search';
      document.body.appendChild(localThis.input);

      initKeyboardShortcuts();
      destroyKeyboardShortcuts();
      initKeyboardShortcuts();

      localThis.event = new KeyboardEvent('keydown', { key: '/' });
      document.dispatchEvent(localThis.event);

      expect(document.activeElement).toBe(localThis.input);
    });
  });
});
