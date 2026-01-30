// Submit a Law section component
// Refactored to use generic API request helper

import templateHtml from '@views/templates/submit-law-section.html?raw';
import { showSuccess, showError } from './notification.js';
import { fetchAPI } from '../utils/api.js';
import { apiPost } from '../utils/request.js';
import { hydrateIcons } from '@utils/icons.js';
import { stripMarkdownFootnotes } from '../utils/sanitize.js';
import {
  getCachedCategories,
  setCachedCategories,
  deferUntilIdle
} from '../utils/category-cache.js';

export function SubmitLawSection() {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';
  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  const form = el.querySelector('.submit-form');
  const submitBtn = el.querySelector('#submit-btn');
  const textArea = el.querySelector('#submit-text');
  const termsCheckbox = el.querySelector('#submit-terms');
  const messageDiv = el.querySelector('.submit-message');
  const charCounter = el.querySelector('.submit-char-counter');
  const categorySelect = el.querySelector('#submit-category');
  const requirementsDiv = el.querySelector('.submit-requirements');
  const textRequirement = el.querySelector('[data-requirement="text"]');
  const termsRequirement = el.querySelector('[data-requirement="terms"]');
  let categoriesLoaded = false;

  // Populate dropdown with cached categories
  function populateFromCache() {
    const cached = getCachedCategories();
    if (cached && cached.length > 0) {
      cached.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = stripMarkdownFootnotes(category.title);
        categorySelect.appendChild(option);
      });
    }
  }

  // Load categories into dropdown
  async function loadCategories() {
    if (categoriesLoaded) return;
    categoriesLoaded = true;

    try {
      const response = await fetchAPI('/api/v1/categories');
      if (response && response.data && Array.isArray(response.data)) {
        const categories = response.data;
        setCachedCategories(categories);
        
        // Clear existing options (except any that might have been cached)
        categorySelect.innerHTML = '<option value="">Select a category (optional)</option>';
        
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = stripMarkdownFootnotes(category.title);
          categorySelect.appendChild(option);
        });
      }
    } catch {
      // Don't show error to user as category is optional
      // If fetch fails, keep cached options if they exist
    }
  }

  // Lazy load on user interaction (fallback)
  categorySelect?.addEventListener('focus', () => {
    if (!categoriesLoaded) {
      loadCategories();
    }
  }, { once: true });

  // Initialize: populate from cache immediately, then load fresh data when idle
  populateFromCache();
  
  // Defer loading categories until browser is idle (non-blocking)
  deferUntilIdle(() => {
    loadCategories();
  }, 2000);

  // Function to check if submit should be enabled
  function checkSubmitValidity() {
    const text = textArea?.value || '';
    const textLength = text.length;
    const trimmedLength = text.trim().length;
    const termsChecked = termsCheckbox?.checked;

    // Update character counter
    if (charCounter) {
      charCounter.textContent = `${textLength} / 1000`;
      if (textLength > 0 && trimmedLength < 10) {
        charCounter.classList.add('submit-char-counter-error');
      } else {
        charCounter.classList.remove('submit-char-counter-error');
      }
    }

    // Update requirements display
    const textValid = trimmedLength >= 10;
    const termsValid = termsChecked;
    
    if (textRequirement) {
      textRequirement.classList.toggle('requirement-met', textValid);
    }
    if (termsRequirement) {
      termsRequirement.classList.toggle('requirement-met', termsValid);
    }
    
    // Show/hide requirements based on validity
    if (requirementsDiv) {
      const allValid = textValid && termsValid;
      requirementsDiv.classList.toggle('all-requirements-met', allValid);
    }

    // Validate text length - show inline error
    if (trimmedLength > 0 && trimmedLength < 10) {
      showMessage('Law text must be at least 10 characters', true);
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // Clear error if text is valid or empty
    if (trimmedLength === 0 || trimmedLength >= 10) {
      clearMessage();
    }

    // Enable button only if text is valid AND terms are checked
    const isValid = textValid && termsValid;
    if (submitBtn) {
      submitBtn.disabled = !isValid;
      // Update tooltip based on button state
      if (isValid) {
        submitBtn.removeAttribute('data-tooltip');
      } else {
        submitBtn.setAttribute('data-tooltip', 'Complete required fields to submit');
      }
    }
  }

  // Show message (success or error)
  function showMessage(message, isError = false) {
    if (messageDiv) {
      messageDiv.className = `submit-message ${isError ? 'error' : 'success'}`;
      messageDiv.textContent = message;
      messageDiv.style.display = 'block';
    }
  }

  // Clear message
  function clearMessage() {
    if (messageDiv) {
      messageDiv.textContent = '';
      messageDiv.style.display = 'none';
    }
  }

  // Set loading state
  function setLoading(isLoading) {
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      const btnText = submitBtn.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = isLoading ? 'Submitting...' : 'Submit Law';
      }
    }
  }

  // Submit law to API - Uses generic request helper (eliminates ~80 lines of duplicate code)
  async function submitLaw(lawData) {
    return await apiPost('/api/v1/laws', lawData);
  }

  // Add event listeners to check validity
  textArea?.addEventListener('input', () => {
    checkSubmitValidity();
    clearMessage();
  });

  termsCheckbox?.addEventListener('change', () => {
    checkSubmitValidity();
    clearMessage();
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = el.querySelector('#submit-title')?.value.trim();
      const text = el.querySelector('#submit-text')?.value.trim();
      const author = el.querySelector('#submit-author')?.value.trim();
      const email = el.querySelector('#submit-email')?.value.trim();
      const anonymous = el.querySelector('#submit-anonymous')?.checked;
      const categoryId = el.querySelector('#submit-category')?.value;

      if (!text) {
        showError('Please enter law text');
        return;
      }

      if (!termsCheckbox?.checked) {
        showError('Please accept the terms to submit');
        return;
      }

      // Prepare submission data
      const lawData = {
        text,
        title: title || undefined,
        author: anonymous ? undefined : (author || undefined),
        email: anonymous ? undefined : (email || undefined),
        anonymous,
        category_id: categoryId || undefined
      };

      // Submit to API
      setLoading(true);
      clearMessage();

      try {
        await submitLaw(lawData);

        showSuccess('Thank you! Your law has been submitted successfully and is pending review.');

        // Clear form after successful submission
        setTimeout(() => {
          if (el.querySelector('#submit-title')) el.querySelector('#submit-title').value = '';
          if (el.querySelector('#submit-text')) el.querySelector('#submit-text').value = '';
          if (el.querySelector('#submit-author')) el.querySelector('#submit-author').value = '';
          if (el.querySelector('#submit-email')) el.querySelector('#submit-email').value = '';
          if (el.querySelector('#submit-category')) el.querySelector('#submit-category').value = '';
          if (el.querySelector('#submit-anonymous')) el.querySelector('#submit-anonymous').checked = false;
          if (el.querySelector('#submit-terms')) el.querySelector('#submit-terms').checked = false;

          // Re-check validity after clearing
          checkSubmitValidity();
        }, 300);

      } catch (error) {
        showError(error.message || 'Failed to submit law. Please try again.');
      } finally {
        setLoading(false);
      }
    });
  }

  return el;
}

