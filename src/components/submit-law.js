// Submit a Law section component

import { API_BASE_URL, API_FALLBACK_URL } from '../utils/constants.js';
import { showSuccess, showError } from './notification.js';

export function SubmitLawSection() {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';
  el.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="accent-text">Submit</span> a Law</h3>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Share your own Murphy's Law discovery</p>
    </div>
    <form class="section-body submit-form">
      <div class="submit-input-group">
        <label for="submit-title">Law Title (optional)</label>
        <input id="submit-title" type="text" placeholder="Enter law title" class="input" />
      </div>
      <div class="submit-input-group">
        <label for="submit-text">Law Text</label>
        <textarea id="submit-text" placeholder="Enter the law text" class="input" rows="3" maxlength="1000"></textarea>
        <div class="submit-helper-text">
          <span class="submit-helper-message">Minimum 10 characters, maximum 1000</span>
          <span class="submit-char-counter" aria-live="polite">0 / 1000</span>
        </div>
      </div>
      <div class="submit-input-group">
        <label for="submit-author">Name (optional)</label>
        <input id="submit-author" type="text" placeholder="Name" class="input" />
      </div>
      <div class="submit-input-group">
        <label for="submit-email">Email address (optional)</label>
        <input id="submit-email" type="email" placeholder="your@email.com" class="input" />
      </div>
      <div class="submit-checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="submit-anonymous" />
          <span>Stay Anonymous</span>
        </label>
      </div>
      <div class="submit-checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="submit-terms" />
          <span>I release this law into the public domain (<a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>) and understand it may be freely used, modified, and shared by anyone.</span>
        </label>
      </div>
      <div class="submit-message" role="alert" aria-live="polite"></div>
      <div class="section-footer">
        <span></span>
        <button id="submit-btn" class="btn" type="submit" disabled aria-label="Submit your law">
          <span class="btn-text">Submit Law</span>
          <span class="material-symbols-outlined icon ml">send</span>
        </button>
      </div>
    </form>
  `;

  const form = el.querySelector('.submit-form');
  const submitBtn = el.querySelector('#submit-btn');
  const textArea = el.querySelector('#submit-text');
  const termsCheckbox = el.querySelector('#submit-terms');
  const messageDiv = el.querySelector('.submit-message');
  const charCounter = el.querySelector('.submit-char-counter');

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

    // Validate text length
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
    const isValid = trimmedLength >= 10 && termsChecked;
    if (submitBtn) {
      submitBtn.disabled = !isValid;
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

  // Submit law to API
  async function submitLaw(lawData) {
    const apiUrl = API_BASE_URL || '';
    const fallbackUrl = API_FALLBACK_URL || 'http://127.0.0.1:8787';

    const endpoint = '/api/laws';
    const primaryUrl = `${apiUrl}${endpoint}`;

    try {
      const response = await fetch(primaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(lawData)
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If can't parse JSON, provide user-friendly message based on status
          if (response.status === 404) {
            errorMessage = 'The submission endpoint is not available. Please make sure the API server is running.';
          } else if (response.status >= 500) {
            errorMessage = 'The server encountered an error. Please try again later.';
          } else if (response.status === 400) {
            errorMessage = 'Invalid submission. Please check your input.';
          } else {
            errorMessage = `Unable to submit (error ${response.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (err) {
      // Try fallback URL
      console.error('Primary API failed, trying fallback:', err);

      const fallbackFullUrl = `${fallbackUrl}${endpoint}`;
      const fallbackResponse = await fetch(fallbackFullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(lawData)
      });

      if (!fallbackResponse.ok) {
        let errorMessage;
        try {
          const errorData = await fallbackResponse.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Provide user-friendly message based on status
          if (fallbackResponse.status === 404) {
            errorMessage = 'The submission endpoint is not available. Please make sure the API server is running.';
          } else if (fallbackResponse.status >= 500) {
            errorMessage = 'The server encountered an error. Please try again later.';
          } else if (fallbackResponse.status === 400) {
            errorMessage = 'Invalid submission. Please check your input.';
          } else {
            errorMessage = `Unable to submit (error ${fallbackResponse.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      return await fallbackResponse.json();
    }
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
        anonymous
      };

      // Submit to API
      setLoading(true);
      clearMessage();

      try {
        const result = await submitLaw(lawData);
        console.log('Law submitted successfully:', result);

        showSuccess('Thank you! Your law has been submitted successfully and is pending review.');

        // Clear form after successful submission
        setTimeout(() => {
          if (el.querySelector('#submit-title')) el.querySelector('#submit-title').value = '';
          if (el.querySelector('#submit-text')) el.querySelector('#submit-text').value = '';
          if (el.querySelector('#submit-author')) el.querySelector('#submit-author').value = '';
          if (el.querySelector('#submit-email')) el.querySelector('#submit-email').value = '';
          if (el.querySelector('#submit-anonymous')) el.querySelector('#submit-anonymous').checked = false;
          if (el.querySelector('#submit-terms')) el.querySelector('#submit-terms').checked = false;

          // Re-check validity after clearing
          checkSubmitValidity();
        }, 300);

      } catch (error) {
        console.error('Failed to submit law:', error);
        showError(error.message || 'Failed to submit law. Please try again.');
      } finally {
        setLoading(false);
      }
    });
  }

  return el;
}
