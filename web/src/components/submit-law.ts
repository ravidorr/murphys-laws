// Submit a Law section component
// Refactored to use generic API request helper

import templateHtml from '@views/templates/submit-law-section.html?raw';
import { showSuccess, showError } from './notification.ts';
import { fetchAPI } from '../utils/api.ts';
import { apiPost } from '../utils/request.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { stripMarkdownFootnotes } from '../utils/sanitize.ts';
import {
  getCachedCategories,
  setCachedCategories,
  deferUntilIdle
} from '../utils/category-cache.ts';
import type { Category } from '../types/app.d.ts';

interface SubmitLawPayload extends Record<string, unknown> {
  text: string;
  title?: string;
  author?: string;
  email?: string;
  anonymous?: boolean;
  category_id?: string;
}

export function SubmitLawSection() {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';
  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  const form = el.querySelector('.submit-form');
  const submitBtn = el.querySelector('#submit-btn') as HTMLButtonElement | null;
  const textArea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
  const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;
  const messageDiv = el.querySelector('.submit-message') as HTMLElement | null;
  const charCounter = el.querySelector('.submit-char-counter');
  const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
  const requirementsDiv = el.querySelector('.submit-requirements');
  const textRequirement = el.querySelector('[data-requirement="text"]');
  const termsRequirement = el.querySelector('[data-requirement="terms"]');
  let categoriesLoaded = false;

  // Populate dropdown with cached categories (template always has categorySelect)
  function populateFromCache() {
    const cached = getCachedCategories();
    if (cached && cached.length > 0) {
      cached.forEach((category) => {
        const option = document.createElement('option');
        option.value = String(category.id);
        option.textContent = stripMarkdownFootnotes(category.title);
        categorySelect!.appendChild(option);
      });
    }
  }

  // Load categories into dropdown
  async function loadCategories() {
    if (categoriesLoaded) return;
    categoriesLoaded = true;

    try {
      const response = await fetchAPI('/api/v1/categories') as { data?: Category[] };
      if (response && response.data && Array.isArray(response.data)) {
        const categories = response.data;
        setCachedCategories(categories);

        // Clear existing options (template always has categorySelect)
        categorySelect!.innerHTML = '<option value="">Select a category (optional)</option>';

        categories.forEach((category) => {
          const option = document.createElement('option');
          option.value = String(category.id);
          option.textContent = stripMarkdownFootnotes(category.title);
          categorySelect!.appendChild(option);
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

    // Update character counter (template always has charCounter)
    charCounter!.textContent = `${textLength} / 1000`;
    if (textLength > 0 && trimmedLength < 10) {
      charCounter!.classList.add('submit-char-counter-error');
    } else {
      charCounter!.classList.remove('submit-char-counter-error');
    }

    // Update requirements display (template always has these elements)
    const textValid = trimmedLength >= 10;
    const termsValid = termsChecked;
    textRequirement!.classList.toggle('requirement-met', textValid);
    termsRequirement!.classList.toggle('requirement-met', termsValid);
    const allValid = textValid && termsValid;
    requirementsDiv!.classList.toggle('all-requirements-met', allValid);

    // Validate text length - show inline error
    if (trimmedLength > 0 && trimmedLength < 10) {
      showMessage('Law text must be at least 10 characters', true);
      submitBtn!.disabled = true;
      return;
    }

    // Clear error if text is valid or empty
    if (trimmedLength === 0 || trimmedLength >= 10) {
      clearMessage();
    }

    // Enable button only if text is valid AND terms are checked (template always has submitBtn)
    const isValid = textValid && termsValid;
    submitBtn!.disabled = !isValid;
    if (isValid) {
      submitBtn!.removeAttribute('data-tooltip');
    } else {
      submitBtn!.setAttribute('data-tooltip', 'Complete required fields to submit');
    }
  }

  // Show message (success or error) (template always has messageDiv)
  function showMessage(message: string, isError = false) {
    messageDiv!.className = `submit-message ${isError ? 'error' : 'success'}`;
    messageDiv!.textContent = message;
    messageDiv!.style.display = 'block';
  }

  // Clear message
  function clearMessage() {
    messageDiv!.textContent = '';
    messageDiv!.style.display = 'none';
  }

  // Set loading state (template always has submitBtn and .btn-text)
  function setLoading(isLoading: boolean) {
    submitBtn!.disabled = isLoading;
    submitBtn!.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    const btnText = submitBtn!.querySelector('.btn-text')!;
    btnText.textContent = isLoading ? 'Submitting...' : 'Submit Law';
  }

  // Submit law to API - Uses generic request helper (eliminates ~80 lines of duplicate code)
  async function submitLaw(lawData: SubmitLawPayload) {
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

  // Template always has .submit-form
  form!.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = (el.querySelector('#submit-title') as HTMLInputElement | null)?.value.trim();
    const text = (el.querySelector('#submit-text') as HTMLTextAreaElement | null)?.value.trim();
    const author = (el.querySelector('#submit-author') as HTMLInputElement | null)?.value.trim();
    const email = (el.querySelector('#submit-email') as HTMLInputElement | null)?.value.trim();
    const anonymous = (el.querySelector('#submit-anonymous') as HTMLInputElement | null)?.checked;
    const categoryId = (el.querySelector('#submit-category') as HTMLSelectElement | null)?.value;

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

      // Clear form after successful submission (template always has these fields)
      setTimeout(() => {
        (el.querySelector('#submit-title') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-text') as HTMLTextAreaElement)!.value = '';
        (el.querySelector('#submit-author') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-email') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-category') as HTMLSelectElement)!.value = '';
        (el.querySelector('#submit-anonymous') as HTMLInputElement)!.checked = false;
        (el.querySelector('#submit-terms') as HTMLInputElement)!.checked = false;

        checkSubmitValidity();
      }, 300);

    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit law. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  return el;
}

