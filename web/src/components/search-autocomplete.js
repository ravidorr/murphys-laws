// Search autocomplete component with dropdown and keyboard navigation
import { debounce } from '../utils/debounce.js';
import { fetchSuggestions } from '../utils/api.js';
import { SEARCH_AUTOCOMPLETE_DEBOUNCE_DELAY } from '../utils/constants.js';

/**
 * Creates a search autocomplete component
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.inputElement - The search input element
 * @param {Function} options.onSelect - Callback when a suggestion is selected (receives law object with id)
 * @param {number} options.debounceDelay - Debounce delay in milliseconds (default: 240)
 * @returns {Object} Component object with cleanup method
 */
export function SearchAutocomplete({ inputElement, onSelect, debounceDelay = SEARCH_AUTOCOMPLETE_DEBOUNCE_DELAY }) {
  if (!inputElement) {
    throw new Error('inputElement is required');
  }

  let suggestions = [];
  let selectedIndex = -1;
  let dropdown = null;
  let dropdownOpen = false;

  // Create dropdown container
  function createDropdown() {
    if (dropdown) return dropdown;

    dropdown = document.createElement('div');
    dropdown.className = 'search-autocomplete';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Search suggestions');
    dropdown.setAttribute('aria-hidden', 'true');
    
    // Insert after input element's parent (form)
    const form = inputElement.closest('form');
    if (form) {
      form.style.position = 'relative';
      form.appendChild(dropdown);
    } else {
      // Fallback: insert after input
      inputElement.parentNode.insertBefore(dropdown, inputElement.nextSibling);
    }

    return dropdown;
  }

  // Highlight matching text in suggestion
  function highlightMatch(text, query) {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="search-suggestion-highlight">$1</mark>');
  }

  // Render suggestions dropdown
  function renderSuggestions() {
    if (!dropdown) {
      createDropdown();
    }

    if (suggestions.length === 0) {
      dropdown.innerHTML = '';
      dropdown.setAttribute('aria-hidden', 'true');
      inputElement.setAttribute('aria-expanded', 'false');
      dropdownOpen = false;
      return;
    }

    dropdown.innerHTML = suggestions.map((law, index) => {
      const isSelected = index === selectedIndex;
      const text = law.text || '';
      const title = law.title || '';
      const displayText = title ? `${title}: ${text}` : text;
      const highlightedText = highlightMatch(displayText, inputElement.value.trim());
      
      return `
        <div
          class="search-suggestion-item ${isSelected ? 'selected' : ''}"
          role="option"
          aria-selected="${isSelected}"
          data-index="${index}"
          data-law-id="${law.id}"
        >
          ${highlightedText}
        </div>
      `;
    }).join('');

    dropdown.setAttribute('aria-hidden', 'false');
    inputElement.setAttribute('aria-expanded', 'true');
    dropdownOpen = true;
  }

  // Select a suggestion by index
  function selectSuggestion(index) {
    if (index < 0 || index >= suggestions.length) return;

    const law = suggestions[index];
    if (law && onSelect) {
      onSelect(law);
    }
    closeDropdown();
  }

  // Close dropdown
  function closeDropdown() {
    suggestions = [];
    selectedIndex = -1;
    if (dropdown) {
      dropdown.innerHTML = '';
      dropdown.setAttribute('aria-hidden', 'true');
    }
    inputElement.setAttribute('aria-expanded', 'false');
    dropdownOpen = false;
  }

  // Update selected index and re-render
  function updateSelectedIndex(newIndex) {
    if (newIndex < -1) {
      selectedIndex = suggestions.length - 1;
    } else if (newIndex >= suggestions.length) {
      selectedIndex = -1;
    } else {
      selectedIndex = newIndex;
    }
    renderSuggestions();
    
    // Scroll selected item into view (if scrollIntoView is available, e.g., not in jsdom)
    if (selectedIndex >= 0 && dropdown) {
      const selectedItem = dropdown.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedItem && typeof selectedItem.scrollIntoView === 'function') {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  // Handle input changes with debouncing
  const debouncedSearch = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
      closeDropdown();
      return;
    }

    try {
      const result = await fetchSuggestions({ q: query.trim(), limit: 10 });
      suggestions = result.data || [];
      selectedIndex = -1;
      renderSuggestions();
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      closeDropdown();
    }
  }, debounceDelay);

  // Handle input event
  function handleInput(event) {
    const query = event.target.value;
    debouncedSearch(query);
  }

  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!dropdownOpen && suggestions.length === 0) {
      return; // Don't handle keys when dropdown is closed
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        updateSelectedIndex(selectedIndex + 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (selectedIndex === -1) {
          updateSelectedIndex(suggestions.length - 1);
        } else {
          updateSelectedIndex(selectedIndex - 1);
        }
        break;

      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          event.preventDefault();
          selectSuggestion(selectedIndex);
        }
        // If no selection, let form submit normally
        break;

      case 'Escape':
        event.preventDefault();
        closeDropdown();
        inputElement.blur();
        break;

      default:
        // Allow other keys to work normally
        break;
    }
  }

  // Handle mouse clicks on suggestions
  function handleDropdownClick(event) {
    const item = event.target.closest('.search-suggestion-item');
    if (item) {
      const index = parseInt(item.getAttribute('data-index'), 10);
      if (!isNaN(index)) {
        selectSuggestion(index);
      }
    }
  }

  // Handle clicks outside dropdown
  function handleDocumentClick(event) {
    if (!inputElement.contains(event.target) && 
        (!dropdown || !dropdown.contains(event.target))) {
      closeDropdown();
    }
  }

  // Initialize
  inputElement.setAttribute('aria-expanded', 'false');
  inputElement.setAttribute('aria-autocomplete', 'list');
  inputElement.setAttribute('aria-controls', 'search-autocomplete-listbox');
  
  if (!dropdown) {
    createDropdown();
  }
  dropdown.setAttribute('id', 'search-autocomplete-listbox');

  // Attach event listeners
  inputElement.addEventListener('input', handleInput);
  inputElement.addEventListener('keydown', handleKeydown);
  dropdown.addEventListener('click', handleDropdownClick);
  document.addEventListener('click', handleDocumentClick);

  // Cleanup function
  return {
    cleanup() {
      inputElement.removeEventListener('input', handleInput);
      inputElement.removeEventListener('keydown', handleKeydown);
      if (dropdown) {
        dropdown.removeEventListener('click', handleDropdownClick);
        dropdown.remove();
      }
      document.removeEventListener('click', handleDocumentClick);
    },
    isOpen() {
      return dropdownOpen;
    }
  };
}
