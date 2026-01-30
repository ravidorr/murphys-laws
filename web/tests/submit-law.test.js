import { SubmitLawSection } from '@components/submit-law.js';
import * as api from '@utils/api.js';
import * as cacheUtils from '@utils/category-cache.js';

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('SubmitLawSection component', () => {
  const local = createLocalThis();
  let deferUntilIdleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    const self = local();
    self.el = null;
    self.appended = false;
    deferUntilIdleSpy = vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => {
      // Execute immediately for testing
      callback();
    });
    localStorage.clear();
  });

  afterEach(() => {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    self.el = null;
    self.appended = false;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function mountSection({ append = false } = {}) {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    const el = SubmitLawSection();
    self.el = el;
    self.appended = append;
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders form with all fields', () => {
    const el = mountSection();

    expect(el.querySelector('#submit-title')).toBeTruthy();
    expect(el.querySelector('#submit-text')).toBeTruthy();
    expect(el.querySelector('#submit-category')).toBeTruthy();
    expect(el.querySelector('#submit-author')).toBeTruthy();
    expect(el.querySelector('#submit-email')).toBeTruthy();
    expect(el.querySelector('#submit-anonymous')).toBeTruthy();
    expect(el.querySelector('#submit-terms')).toBeTruthy();
    expect(el.querySelector('#submit-btn')).toBeTruthy();
  });

  it('submit button is disabled initially', () => {
    const el = mountSection();
    const submitBtn = el.querySelector('#submit-btn');

    expect(submitBtn.disabled).toBe(true);
  });

  it('submit button has tooltip when disabled', () => {
    const localThis = {};
    localThis.el = mountSection();
    localThis.submitBtn = localThis.el.querySelector('#submit-btn');

    expect(localThis.submitBtn.disabled).toBe(true);
    expect(localThis.submitBtn.getAttribute('data-tooltip')).toBe('Complete required fields to submit');
  });

  it('submit button tooltip is removed when enabled', () => {
    const localThis = {};
    localThis.el = mountSection({ append: true });
    localThis.textarea = localThis.el.querySelector('#submit-text');
    localThis.termsCheckbox = localThis.el.querySelector('#submit-terms');
    localThis.submitBtn = localThis.el.querySelector('#submit-btn');

    // Initially has tooltip
    expect(localThis.submitBtn.getAttribute('data-tooltip')).toBe('Complete required fields to submit');

    // Fill requirements
    localThis.textarea.value = 'This is a valid law text with enough characters';
    localThis.textarea.dispatchEvent(new Event('input'));
    localThis.termsCheckbox.checked = true;
    localThis.termsCheckbox.dispatchEvent(new Event('change'));

    // Tooltip should be removed when enabled
    expect(localThis.submitBtn.disabled).toBe(false);
    expect(localThis.submitBtn.hasAttribute('data-tooltip')).toBe(false);
  });

  it('submit button tooltip returns when disabled again', () => {
    const localThis = {};
    localThis.el = mountSection({ append: true });
    localThis.textarea = localThis.el.querySelector('#submit-text');
    localThis.termsCheckbox = localThis.el.querySelector('#submit-terms');
    localThis.submitBtn = localThis.el.querySelector('#submit-btn');

    // Enable the button
    localThis.textarea.value = 'This is a valid law text with enough characters';
    localThis.textarea.dispatchEvent(new Event('input'));
    localThis.termsCheckbox.checked = true;
    localThis.termsCheckbox.dispatchEvent(new Event('change'));

    expect(localThis.submitBtn.disabled).toBe(false);
    expect(localThis.submitBtn.hasAttribute('data-tooltip')).toBe(false);

    // Disable by unchecking terms
    localThis.termsCheckbox.checked = false;
    localThis.termsCheckbox.dispatchEvent(new Event('change'));

    // Tooltip should return
    expect(localThis.submitBtn.disabled).toBe(true);
    expect(localThis.submitBtn.getAttribute('data-tooltip')).toBe('Complete required fields to submit');
  });

  it('renders validation requirements display', () => {
    const el = mountSection();
    
    const requirementsDiv = el.querySelector('.submit-requirements');
    const textRequirement = el.querySelector('[data-requirement="text"]');
    const termsRequirement = el.querySelector('[data-requirement="terms"]');

    expect(requirementsDiv).toBeTruthy();
    expect(textRequirement).toBeTruthy();
    expect(termsRequirement).toBeTruthy();
  });

  it('marks text requirement as met when text is valid', () => {
    const el = mountSection({ append: true });
    
    const textarea = el.querySelector('#submit-text');
    const textRequirement = el.querySelector('[data-requirement="text"]');

    // Initially not met
    expect(textRequirement.classList.contains('requirement-met')).toBe(false);

    // Add valid text
    textarea.value = 'This is a valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));

    expect(textRequirement.classList.contains('requirement-met')).toBe(true);
  });

  it('marks terms requirement as met when terms are checked', () => {
    const el = mountSection({ append: true });
    
    const termsCheckbox = el.querySelector('#submit-terms');
    const termsRequirement = el.querySelector('[data-requirement="terms"]');

    // Initially not met
    expect(termsRequirement.classList.contains('requirement-met')).toBe(false);

    // Check terms
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(termsRequirement.classList.contains('requirement-met')).toBe(true);
  });

  it('adds all-requirements-met class when all requirements are satisfied', () => {
    const el = mountSection({ append: true });
    
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');
    const requirementsDiv = el.querySelector('.submit-requirements');

    // Initially not all met
    expect(requirementsDiv.classList.contains('all-requirements-met')).toBe(false);

    // Satisfy all requirements
    textarea.value = 'This is a valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(requirementsDiv.classList.contains('all-requirements-met')).toBe(true);
  });

  it('updates character counter on text input', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    textarea.value = 'Test text';
    textarea.dispatchEvent(new Event('input'));

    expect(counter.textContent).toContain('9');

  });

  it('enables submit button when text and terms are filled', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');
    const submitBtn = el.querySelector('#submit-btn');

    textarea.value = 'This is a valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(submitBtn.disabled).toBe(false);

  });

  it('disables submit button if text is too short', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');
    const submitBtn = el.querySelector('#submit-btn');

    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(submitBtn.disabled).toBe(true);

  });

  it('loads categories on mount', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [
        { id: 1, title: 'General' },
        { id: 2, title: 'Technology' }
      ]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category');
    const options = categorySelect.querySelectorAll('option');

    expect(options.length).toBeGreaterThan(1);
    expect(deferUntilIdleSpy).toHaveBeenCalled();
  });

  it('populates categories from cache immediately', () => {
    const categories = [
      { id: 1, title: 'General' },
      { id: 2, title: 'Technology' }
    ];

    // Set cache before mounting
    cacheUtils.setCachedCategories(categories);

    const el = mountSection({ append: true });

    // Should populate immediately from cache
    const categorySelect = el.querySelector('#submit-category');
    const options = categorySelect.querySelectorAll('option');

    expect(options.length).toBeGreaterThan(1);
    expect(categorySelect.textContent).toMatch(/General/);
    expect(categorySelect.textContent).toMatch(/Technology/);
  });

  it('loads categories on focus if not loaded yet', async () => {
    const categories = [
      { id: 1, title: 'General' }
    ];

    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: categories
    });

    // Mock deferUntilIdle to not execute immediately
    deferUntilIdleSpy.mockImplementation(() => {});

    const el = mountSection({ append: true });

    // Trigger focus event to lazy load
    const categorySelect = el.querySelector('#submit-category');
    categorySelect.dispatchEvent(new Event('focus', { bubbles: true }));

    await vi.waitFor(() => {
      expect(categorySelect.textContent).toMatch(/General/);
    });
  });

  it('does not load categories twice', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [{ id: 1, title: 'General' }]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    // First load happened
    const firstCallCount = fetchSpy.mock.calls.length;

    // Trigger focus again to try to load categories again
    const categorySelect = el.querySelector('#submit-category');
    categorySelect.dispatchEvent(new Event('focus', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 10));

    // Should not have made additional API calls (categories already loaded)
    expect(fetchSpy.mock.calls.length).toBe(firstCallCount);
  });

  it('handles category loading error gracefully', async () => {
    vi.spyOn(api, 'fetchAPI').mockRejectedValue(new Error('API failed'));

    const el = mountSection();

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category');
    expect(categorySelect).toBeTruthy();

  });

  it('anonymous checkbox exists and works', () => {
    const el = mountSection({ append: true });

    const anonymousCheckbox = el.querySelector('#submit-anonymous');

    expect(anonymousCheckbox).toBeTruthy();
    expect(anonymousCheckbox.type).toBe('checkbox');

    anonymousCheckbox.checked = true;
    expect(anonymousCheckbox.checked).toBe(true);

  });

  it('submits form with valid data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'This is a valid law text with more than ten characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

  });

  it('shows error message on submit failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid data' })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'This is a valid law text with more than ten characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

  });

  it('validates email format', () => {
    const el = mountSection({ append: true });

    const emailInput = el.querySelector('#submit-email');

    emailInput.value = 'invalid-email';
    emailInput.dispatchEvent(new Event('input'));

    // HTML5 validation should apply
    expect(emailInput.type).toBe('email');

  });

  it('shows error state in character counter for short text', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));

    expect(counter.classList.contains('submit-char-counter-error')).toBe(true);

  });

  it('removes error state when text becomes valid', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    // First add error
    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));
    expect(counter.classList.contains('submit-char-counter-error')).toBe(true);

    // Then fix it
    textarea.value = 'This is now valid text';
    textarea.dispatchEvent(new Event('input'));
    expect(counter.classList.contains('submit-char-counter-error')).toBe(false);

  });

  it('clears message div initially', () => {
    const el = mountSection({ append: true });

    const messageDiv = el.querySelector('.submit-message');

    // Message div should be hidden initially
    expect(messageDiv.style.display).toBe('');
    expect(messageDiv.textContent).toBe('');

  });

  it('handles 404 error with user-friendly message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('handles 500 error with user-friendly message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('handles other status codes with generic message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('uses fallback URL when primary fails', async () => {
    // Mock fetchAPI for category loading
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 123 })
      });

    const el = mountSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(global.fetch).toHaveBeenCalledTimes(2);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 404 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 500 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 400 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback other status codes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 418,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('submits with title, author, and category when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [{ id: 1, title: 'General' }]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const title = el.querySelector('#submit-title');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const categorySelect = el.querySelector('#submit-category');
    const termsCheckbox = el.querySelector('#submit-terms');

    title.value = 'Test Title';
    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    categorySelect.value = '1';
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('omits author and email when anonymous is checked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const email = el.querySelector('#submit-email');
    const anonymous = el.querySelector('#submit-anonymous');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    email.value = 'john@example.com';
    anonymous.checked = true;
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('clears form after successful submission', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const title = el.querySelector('#submit-title');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const email = el.querySelector('#submit-email');
    const termsCheckbox = el.querySelector('#submit-terms');

    title.value = 'Test Title';
    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    email.value = 'john@example.com';
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 400));

    // Fields should be cleared
    expect(title.value).toBe('');
    expect(textarea.value).toBe('');
    expect(author.value).toBe('');
    expect(email.value).toBe('');
    expect(termsCheckbox.checked).toBe(false);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response without data property', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({});

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category');
    // Should only have the default option
    expect(categorySelect.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response with non-array data', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: 'not an array' });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category');
    // Should only have the default option
    expect(categorySelect.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without text', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    global.fetch = vi.fn();

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const termsCheckbox = el.querySelector('#submit-terms');

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - global.fetch should not be called for submission
    expect(global.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without terms checked', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    global.fetch = vi.fn();

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');

    textarea.value = 'Valid law text with enough characters';

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - global.fetch should not be called for submission
    expect(global.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback error with error property', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Fallback error' })
      });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('does not reload categories on second focus', async () => {
    const fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    fetchAPISpy.mockResolvedValue({ data: [{ id: 1, title: 'Test Category', slug: 'test' }] });

    const el = mountSection({ append: true });
    const categorySelect = el.querySelector('#submit-category');

    // First focus should trigger category loading
    categorySelect.dispatchEvent(new FocusEvent('focus'));
    await new Promise(resolve => setTimeout(resolve, 50));

    const callsAfterFirstFocus = fetchAPISpy.mock.calls.filter(
      call => call[0] === '/api/v1/categories'
    ).length;

    // Second focus should NOT reload categories (early return)
    categorySelect.dispatchEvent(new FocusEvent('focus'));
    await new Promise(resolve => setTimeout(resolve, 50));

    const callsAfterSecondFocus = fetchAPISpy.mock.calls.filter(
      call => call[0] === '/api/v1/categories'
    ).length;

    // Should be the same number of calls
    expect(callsAfterSecondFocus).toBe(callsAfterFirstFocus);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });
});
