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
import {
  canOfferSplit,
  parseCorollaries,
  COROLLARY_TEXT_MAX_LENGTH,
  COROLLARY_TEXT_MIN_LENGTH,
  COROLLARY_TITLE_MAX_LENGTH,
  MAX_COROLLARIES_PER_PARENT
} from '@shared/modules/corollary-parser.ts';

interface SubmitLawPayload extends Record<string, unknown> {
  text: string;
  title?: string;
  author?: string;
  email?: string;
  anonymous?: boolean;
  category_id?: string;
  corollaries?: { title?: string; text: string }[];
}

interface CorollaryRowFields {
  row: HTMLElement;
  title: HTMLInputElement;
  text: HTMLTextAreaElement;
}

const SUBMIT_LABEL = 'Submit Law';

/** "Submit law with 2 corollaries": the button says how many corollaries go with the law. */
function submitLabel(corollaryCount: number): string {
  if (corollaryCount === 0) return SUBMIT_LABEL;
  return `Submit law with ${corollaryCount} ${corollaryCount === 1 ? 'corollary' : 'corollaries'}`;
}

export interface SubmitLawSectionOptions {
  /** Starting law text, such as the words of a search that found nothing, so the visitor does not start over. */
  initialText?: string;
  /** Slug of the category to preselect, such as the category page the visitor came from. */
  initialCategorySlug?: string;
}

export function SubmitLawSection({ initialText, initialCategorySlug }: SubmitLawSectionOptions = {}) {
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
  const corollaryRows = el.querySelector('[data-corollary-rows]') as HTMLElement;
  const corollaryTemplate = el.querySelector('[data-corollary-template]') as HTMLTemplateElement;
  const addCorollaryBtn = el.querySelector('[data-action="add-corollary"]') as HTMLButtonElement;
  const corollaryCount = el.querySelector('[data-corollary-count]') as HTMLElement;
  const corollaryHint = el.querySelector('[data-corollary-hint]') as HTMLElement;
  const corollaryHintText = el.querySelector('[data-corollary-hint-text]') as HTMLElement;
  let corollarySeq = 0;
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

  // The starting category is applied once, when its option first exists, and never after the visitor touches the field
  let initialCategoryHandled = !initialCategorySlug;
  categorySelect?.addEventListener('change', () => {
    initialCategoryHandled = true;
  });

  /** Selects the starting category once its option is in the dropdown, unless the visitor has already chosen. */
  function selectInitialCategory() {
    if (initialCategoryHandled) return;
    const option = Array.from(categorySelect!.options).find((opt) => opt.dataset.categorySlug === initialCategorySlug);
    if (!option) return;
    categorySelect!.value = option.value;
    initialCategoryHandled = true;
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
        // Rebuilding the options resets the choice, so keep the one already made (or preselected)
        const selectedCategoryId = categorySelect!.value;

        // Clear existing options (template always has categorySelect)
        categorySelect!.innerHTML = '<option value="">Select a category (optional)</option>';

        categories.forEach((category) => {
          const option = document.createElement('option');
          option.value = String(category.id);
          option.dataset.categorySlug = category.slug;
          option.textContent = stripMarkdownFootnotes(category.title);
          categorySelect!.appendChild(option);
        });
        categorySelect!.value = selectedCategoryId;
        selectInitialCategory();
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
  selectInitialCategory();
  
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

    // A box with something in it needs a real corollary; an empty box is ignored.
    const corollaryProblem = findCorollaryProblem();
    if (corollaryProblem) {
      showMessage(corollaryProblem, true);
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

  function corollaryFields(): CorollaryRowFields[] {
    return Array.from(corollaryRows.querySelectorAll<HTMLElement>('[data-corollary-row]')).map((row) => ({
      row,
      title: row.querySelector('[data-corollary-title]') as HTMLInputElement,
      text: row.querySelector('[data-corollary-text]') as HTMLTextAreaElement
    }));
  }

  /** Boxes with any content, in order, with the position each has on screen. */
  function filledCorollaries() {
    return corollaryFields()
      .map((fields, index) => ({ ...fields, position: index + 1, title: fields.title.value.trim(), text: fields.text.value.trim() }))
      .filter((entry) => entry.title !== '' || entry.text !== '');
  }

  /** The same comparison the server makes: ignoring case and runs of whitespace. */
  const sameText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  /**
   * The first problem the server would refuse, worded with the position each box has on screen (the server counts only
   * the boxes that were sent, so its numbers can differ when an earlier box is empty).
   */
  function findCorollaryProblem(): string | null {
    const seen = new Set([sameText(textArea?.value || '')]);
    for (const entry of filledCorollaries()) {
      const label = `Corollary ${entry.position}`;
      if (entry.text.length < COROLLARY_TEXT_MIN_LENGTH) return `${label} text must be at least ${COROLLARY_TEXT_MIN_LENGTH} characters`;
      if (entry.text.length > COROLLARY_TEXT_MAX_LENGTH) return `${label} text must be at most ${COROLLARY_TEXT_MAX_LENGTH} characters`;
      if (entry.title.length > COROLLARY_TITLE_MAX_LENGTH) return `${label} name must be at most ${COROLLARY_TITLE_MAX_LENGTH} characters`;
      if (seen.has(sameText(entry.text))) return `${label} repeats another corollary or the law text`;
      seen.add(sameText(entry.text));
    }
    return null;
  }

  function currentSubmitLabel(): string {
    return submitLabel(filledCorollaries().length);
  }

  /** Keeps labels, ids, the counter and the buttons in step with the boxes on screen. */
  function renumberCorollaries() {
    const rows = corollaryFields();
    rows.forEach(({ row, title, text }, index) => {
      const n = index + 1;
      const labelId = `${row.dataset.corollaryId}-label`;
      row.querySelector('[data-corollary-label]')!.textContent = `Corollary ${n}`;
      row.querySelector('[data-action="remove-corollary"]')!.setAttribute('aria-label', `Remove corollary ${n}`);
      (row.querySelector('[data-corollary-title-label]') as HTMLLabelElement).htmlFor = title.id;
      (row.querySelector('[data-corollary-text-label]') as HTMLLabelElement).htmlFor = text.id;
      row.setAttribute('aria-labelledby', labelId);
    });
    corollaryCount.textContent = `${rows.length} of ${MAX_COROLLARIES_PER_PARENT} added`;
    addCorollaryBtn.disabled = rows.length >= MAX_COROLLARIES_PER_PARENT;
    if (submitBtn!.getAttribute('aria-busy') !== 'true') {
      submitBtn!.querySelector('.btn-text')!.textContent = currentSubmitLabel();
    }
  }

  function updateCorollaryCounter(fields: CorollaryRowFields) {
    const length = fields.text.value.length;
    const counter = fields.row.querySelector('[data-corollary-counter]') as HTMLElement;
    counter.textContent = `${length} / ${COROLLARY_TEXT_MAX_LENGTH}`;
    const trimmed = fields.text.value.trim().length;
    counter.classList.toggle('submit-char-counter-error', length > 0 && trimmed < COROLLARY_TEXT_MIN_LENGTH);
  }

  /** Adds an empty box and returns its fields. Callers check the maximum first: the add button is disabled at five. */
  function addCorollaryRow(): CorollaryRowFields {
    const row = (corollaryTemplate.content.cloneNode(true) as DocumentFragment).querySelector('[data-corollary-row]') as HTMLElement;
    corollarySeq += 1;
    const id = `submit-corollary-${corollarySeq}`;
    row.dataset.corollaryId = id;
    row.setAttribute('role', 'group');
    row.querySelector('[data-corollary-label]')!.id = `${id}-label`;
    const title = row.querySelector('[data-corollary-title]') as HTMLInputElement;
    const text = row.querySelector('[data-corollary-text]') as HTMLTextAreaElement;
    title.id = `${id}-title`;
    text.id = `${id}-text`;
    const fields = { row, title, text };
    const onChange = () => {
      updateCorollaryCounter(fields);
      checkSubmitValidity();
      renumberCorollaries();
    };
    title.addEventListener('input', onChange);
    text.addEventListener('input', onChange);
    corollaryRows.appendChild(row);
    hydrateIcons(row);
    updateCorollaryCounter(fields);
    renumberCorollaries();
    return fields;
  }

  function removeCorollaryRow(row: HTMLElement) {
    row.remove();
    renumberCorollaries();
    checkSubmitValidity();
    addCorollaryBtn.focus();
  }

  addCorollaryBtn.addEventListener('click', () => {
    const fields = addCorollaryRow();
    trackPendoEvent('law_corollary_added', { corollary_count: corollaryFields().length, via: 'button' });
    checkSubmitValidity();
    fields.title.focus();
  });

  corollaryRows.addEventListener('click', (event) => {
    const remove = (event.target as Element).closest('[data-action="remove-corollary"]');
    if (!remove) return;
    removeCorollaryRow(remove.closest('[data-corollary-row]') as HTMLElement);
  });

  /** Offers to move bullets written in the law text into boxes, when they look like corollaries. */
  function updateCorollaryHint() {
    const parsed = parseCorollaries(textArea?.value || '');
    const offer = canOfferSplit(parsed) && parsed.items.some((item) => item.labeled);
    corollaryHint.hidden = !offer;
    if (offer) {
      const labeled = parsed.items.filter((item) => item.labeled).length;
      corollaryHintText.textContent = `Looks like your text includes ${labeled === 1 ? 'a corollary' : `${labeled} corollaries`}.`;
    }
  }

  /**
   * Moves the corollary-labeled bullets into boxes. Unlabeled bullets stay in the law text, and so do labeled ones that
   * do not fit under the maximum, so nothing the visitor wrote is dropped.
   */
  function moveCorollariesIntoBoxes() {
    const parsed = parseCorollaries(textArea!.value);
    if (!canOfferSplit(parsed)) return;
    const empty = corollaryFields().filter(({ title, text }) => title.value.trim() === '' && text.value.trim() === '');
    let room = empty.length + (MAX_COROLLARIES_PER_PARENT - corollaryFields().length);
    const kept: string[] = [];
    let moved = 0;
    for (const item of parsed.items) {
      if (item.labeled && room > 0) {
        const fields = empty.shift() ?? addCorollaryRow();
        // A labeled bullet always has a title: the label is what makes it labeled.
        fields.title.value = item.title!;
        fields.text.value = item.text;
        updateCorollaryCounter(fields);
        room -= 1;
        moved += 1;
      } else {
        kept.push(`• ${item.labeled ? `${item.title}: ${item.text}` : item.text}`);
      }
    }
    if (moved === 0) {
      corollaryCount.textContent = `No room: there are already ${MAX_COROLLARIES_PER_PARENT} corollary boxes. Remove one to move another from your law text.`;
      return;
    }
    textArea!.value = kept.length > 0 ? `${parsed.parentText}\n\n${kept.join('\n')}` : parsed.parentText;
    renumberCorollaries();
    checkSubmitValidity();
    updateCorollaryHint();
    trackPendoEvent('law_corollary_added', { corollary_count: corollaryFields().length, via: 'text_hint', moved });
    const stayed = parsed.items.filter((item) => item.labeled).length - moved;
    corollaryCount.textContent = `${corollaryFields().length} of ${MAX_COROLLARIES_PER_PARENT} added. Moved ${moved} from your law text${stayed > 0 ? `; ${stayed} stayed in the text because there is no room for more boxes` : ''}.`;
    corollaryRows.querySelector<HTMLElement>('[data-corollary-row] [data-corollary-title]')?.focus();
  }

  el.querySelector('[data-action="move-corollaries"]')!.addEventListener('click', moveCorollariesIntoBoxes);

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
    btnText.textContent = isLoading ? 'Submitting...' : currentSubmitLabel();
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
    updateCorollaryHint();
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

  // Start from the text the visitor brought with them. The counter and requirements update, but no short-text error
  // shows until they edit it.
  const startingText = initialText?.trim().slice(0, 1000);
  if (startingText) {
    textArea!.value = startingText;
    checkSubmitValidity();
    clearMessage();
  }

  // Put the cursor in the law text box when the page opens, so visitors can start writing straight away.
  // Waits a frame so it runs after the router moves focus to the page. Only when the box is already fully
  // on screen (no scrolling, so the guidance above stays in view) and on a fine pointer, where focusing
  // does not open an on-screen keyboard over the guidance.
  requestAnimationFrame(() => {
    if (!el.isConnected || el.contains(document.activeElement)) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches) return;
    const rect = textArea!.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) return;
    textArea!.focus({ preventScroll: true });
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

    const corollaries = filledCorollaries();
    if (findCorollaryProblem()) {
      trackSubmissionFailed('corollary_invalid');
      showError(findCorollaryProblem()!);
      return;
    }

    // Prepare submission data
    const lawData: SubmitLawPayload = {
      text,
      title: title || undefined,
      author: anonymous ? undefined : (author || undefined),
      email: anonymous ? undefined : (email || undefined),
      anonymous,
      category_id: categoryId || undefined,
      corollaries: corollaries.length > 0 ? corollaries.map((entry) => ({ title: entry.title || undefined, text: entry.text })) : undefined
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
        corollary_count: corollaries.length,
      });
      duplicateWarningShown = false;
      reportedDuplicateMatchIds.clear();

      showMessage(
        `Thank you! Your law ${corollaries.length > 0 ? `and ${corollaries.length === 1 ? 'its corollary have' : `its ${corollaries.length} corollaries have`}` : 'has'} been submitted. We review submissions within a few days${corollaries.length > 0 ? ', and the law and its corollaries are reviewed together' : ''}. Accepted laws appear in the archive. You cannot edit after submission.`,
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
        corollaryRows.replaceChildren();
        renumberCorollaries();
        updateCorollaryHint();

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
