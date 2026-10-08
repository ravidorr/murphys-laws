// Submit a Law section component
// Refactored to use generic API request helper

import templateHtml from '@views/templates/submit-law-section.html?raw';
import { showError } from './notification.ts';
import { fetchAPI, fetchDuplicateCandidates } from '../utils/api.ts';
import { apiPost } from '../utils/request.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { escapeHtml, stripMarkdownFootnotes } from '../utils/sanitize.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import { trackPendoEvent, getRequestErrorType } from '@utils/pendo.ts';
import { rankDuplicateCandidates } from '@utils/discovery.ts';
import {
  getCachedCategories,
  setCachedCategories,
  deferUntilIdle
} from '../utils/category-cache.ts';
import type { Category } from '../types/app.d.ts';
import { isUsefulDuplicateMatch } from '@shared/modules/duplicate-similarity.ts';

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
  el.className = 'section card card--section section-card mb-12';
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
  const nextActions = el.querySelector('[data-submit-next-actions]');
  const duplicateCandidates = el.querySelector('[data-duplicate-candidates]');
  let categoriesLoaded = false;
  let duplicateTimer: ReturnType<typeof setTimeout> | undefined;
  let duplicateRequestId = 0;
  // Duplicate-checker state for the law being written; reset after a successful submission
  let duplicateWarningShown = false;
  const reportedDuplicateMatchIds = new Set<string>();

  // Populate dropdown with cached categories (template always has categorySelect)
  function populateFromCache() {
    const cached = getCachedCategories();
    if (cached && cached.length > 0) {
      cached.forEach((category) => {
        const option = document.createElement('option');
        option.value = String(category.id);
        option.dataset.categorySlug = category.slug;
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
          option.dataset.categorySlug = category.slug;
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

    // The short-text case returned above, so all remaining input clears inline errors.
    clearMessage();

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
    messageDiv!.hidden = false;
    messageDiv!.setAttribute('role', isError ? 'alert' : 'status');
    messageDiv!.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  }

  // Clear message
  function clearMessage() {
    messageDiv!.textContent = '';
    messageDiv!.hidden = true;
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

  function showNextActions(categorySlug?: string) {
    const categoryLink = categorySlug
      ? `<a href="/category/${categorySlug}" class="btn outline">Browse your category</a>`
      : '<a href="/categories" class="btn outline">Browse categories</a>';
    nextActions!.innerHTML = `
      <div class="section card card--section section-card mt-4">
        <div class="section-header">
          <h3 class="section-title"><span class="accent-text">Keep</span> exploring</h3>
        </div>
        <div class="section-body">
          <p>Thanks. While your submission is reviewed, compare it with nearby laws or submit another variation.</p>
          <div class="not-found-actions">
            <a href="/browse" class="btn">Find similar laws</a>
            ${categoryLink}
            <button type="button" class="btn outline" data-action="submit-another-law">Submit another law</button>
          </div>
        </div>
      </div>`;
    nextActions!.removeAttribute('hidden');
  }

  // Add event listeners to check validity
  textArea?.addEventListener('input', () => {
    checkSubmitValidity();
    clearMessage();
    if (duplicateTimer) clearTimeout(duplicateTimer);
    duplicateTimer = setTimeout(() => {
      if (!el.isConnected) return;
      void checkForDuplicates();
    }, 500);
  });

  async function checkForDuplicates() {
    const text = textArea!.value.trim();
    const candidateContainer = duplicateCandidates!;
    if (text.length < 10) {
      candidateContainer.innerHTML = '';
      return;
    }
    const requestId = ++duplicateRequestId;
    try {
      const result = await fetchDuplicateCandidates(text);
      if (requestId !== duplicateRequestId) return;
      const ranked = rankDuplicateCandidates(text, result.data).filter(isUsefulDuplicateMatch).slice(0, 3);
      const exact = ranked.filter((candidate) => candidate.match_type === 'exact');
      const fuzzy = ranked.filter((candidate) => candidate.match_type === 'fuzzy');
      candidateContainer.innerHTML = ranked.length > 0
        ? `${exact.length > 0 ? '<p class="small"><strong>Already in the archive:</strong></p>' : '<p class="small"><strong>Possible duplicates:</strong></p>'}<ul>${[...exact, ...fuzzy].map((law) => `<li><a href="/law/${law.id}">${escapeHtml(law.title || law.text)}</a>${law.match_type === 'fuzzy' ? ` <span class="small text-muted-fg">${Math.round(law.similarity * 100)}% similar</span>` : ''}</li>`).join('')}</ul>`
        : '';
      const topMatch = ranked[0];
      if (topMatch) {
        duplicateWarningShown = true;
        // The check reruns as the visitor types, so report each distinct top match once
        const topMatchId = String(topMatch.id);
        if (!reportedDuplicateMatchIds.has(topMatchId)) {
          reportedDuplicateMatchIds.add(topMatchId);
          trackPendoEvent('law_duplicate_detected', {
            exact_match_count: exact.length,
            fuzzy_match_count: fuzzy.length,
            top_similarity: Math.round(topMatch.similarity * 100),
            top_match_law_id: topMatchId,
            text_length: text.length,
          });
        }
      }
    } catch {
      if (requestId === duplicateRequestId) candidateContainer.innerHTML = '';
    }
  }

  textArea?.addEventListener('blur', () => {
    if (duplicateTimer) clearTimeout(duplicateTimer);
    void checkForDuplicates();
  });

  termsCheckbox?.addEventListener('change', () => {
    checkSubmitValidity();
    clearMessage();
  });

  el.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('[data-action="submit-another-law"]')) return;

    nextActions?.setAttribute('hidden', '');
    textArea?.focus();
  });

  // Template always has .submit-form
  form!.addEventListener('submit', async (e) => {
    e.preventDefault();
    trackProductEvent('submit.start', { surface: 'submit_form' });

    const title = (el.querySelector('#submit-title') as HTMLInputElement | null)?.value.trim();
    const text = (el.querySelector('#submit-text') as HTMLTextAreaElement | null)?.value.trim();
    const author = (el.querySelector('#submit-author') as HTMLInputElement | null)?.value.trim();
    const email = (el.querySelector('#submit-email') as HTMLInputElement | null)?.value.trim();
    const anonymous = (el.querySelector('#submit-anonymous') as HTMLInputElement | null)?.checked;
    const categoryId = (el.querySelector('#submit-category') as HTMLSelectElement | null)?.value;
    const categorySlug = categorySelect?.selectedOptions[0]?.dataset.categorySlug;
    const honeypot = (el.querySelector('#submit-website') as HTMLInputElement | null)?.value?.trim();

    // Only non-personal details are reported: never the text, author or email themselves
    const failureContext = {
      text_length: text ? text.length : 0,
      category_id: categoryId || undefined,
      is_anonymous: Boolean(anonymous),
    };
    const trackSubmissionFailed = (failureReason: string) => {
      trackPendoEvent('law_submission_failed', { ...failureContext, failure_reason: failureReason });
    };

    if (honeypot) {
      trackSubmissionFailed('spam_trap');
      showError('Submission rejected.');
      setLoading(false);
      return;
    }

    if (!text) {
      trackSubmissionFailed('missing_text');
      showError('Please enter law text');
      return;
    }

    if (!termsCheckbox?.checked) {
      trackSubmissionFailed('terms_not_accepted');
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
      const response = await submitLaw(lawData) as { id?: number | string } | null;
      trackProductEvent('submit.complete', { surface: 'submit_form', result: 'success' });
      // The law is now in the human review queue
      trackPendoEvent('law_submitted', {
        submission_id: response?.id != null ? String(response.id) : undefined,
        category_id: lawData.category_id,
        category_slug: categorySlug || undefined,
        has_title: Boolean(lawData.title),
        text_length: text.length,
        is_anonymous: Boolean(anonymous),
        has_author: Boolean(lawData.author),
        has_email: Boolean(lawData.email),
        duplicate_warning_shown: duplicateWarningShown,
      });
      duplicateWarningShown = false;
      reportedDuplicateMatchIds.clear();

      showMessage(
        'Thank you! Your law has been submitted. We review submissions within a few days. Accepted laws appear in the archive. You cannot edit after submission.',
        false
      );
      showNextActions(categorySlug || undefined);

      // Clear form after successful submission (template always has these fields)
      setTimeout(() => {
        (el.querySelector('#submit-title') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-text') as HTMLTextAreaElement)!.value = '';
        (el.querySelector('#submit-author') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-email') as HTMLInputElement)!.value = '';
        (el.querySelector('#submit-category') as HTMLSelectElement)!.value = '';
        (el.querySelector('#submit-anonymous') as HTMLInputElement)!.checked = false;
        (el.querySelector('#submit-terms') as HTMLInputElement)!.checked = false;
        (el.querySelector('#submit-website') as HTMLInputElement)!.value = '';

        checkSubmitValidity();
      }, 300);

    } catch (error) {
      trackSubmissionFailed(getRequestErrorType(error));
      showError(error instanceof Error ? error.message : 'Failed to submit law. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  return el;
}
