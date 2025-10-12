import {
  createSodsEmailPreviewHtml,
  createSodsEmailSubject
} from '@modules/sods-email-template.js';
import { API_BASE_URL, API_FALLBACK_URL } from '../utils/constants.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENDING_BUTTON_TEXT = 'Sending...';
const DEFAULT_BUTTON_TEXT = '✉️ Send Email';

export function initShareCalculation({ root, getCalculationState }) {
  if (!root) {
    throw new Error('initShareCalculation requires a root element');
  }

  const shareCta = root.querySelector('#share-cta');
  const shareFormContainer = root.querySelector('#share-form-container');
  const taskDescriptionInput = root.querySelector('#task-description');
  const senderNameInput = root.querySelector('#sender-name');
  const senderEmailInput = root.querySelector('#sender-email');
  const recipientNameInput = root.querySelector('#recipient-name');
  const recipientEmailInput = root.querySelector('#recipient-email');
  const previewButton = root.querySelector('#preview-email');
  const sendButton = root.querySelector('#send-email');
  const cancelButton = root.querySelector('#cancel-share');
  const shareStatus = root.querySelector('#share-status');
  const emailPreviewModal = root.querySelector('#email-preview-modal');
  const previewContent = root.querySelector('#preview-content');
  const closePreviewButtons = [
    root.querySelector('#close-preview'),
    root.querySelector('#close-preview-footer')
  ];

  let successHideTimeout = null;
  const listeners = [];

  function addListener(target, event, handler) {
    if (!target) return;
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }

  function hideShareStatus() {
    if (!shareStatus) return;
    shareStatus.textContent = '';
    shareStatus.className = 'share-status hidden';
  }

  function showShareStatus(message, type = 'info') {
    if (!shareStatus) return;
    shareStatus.textContent = message;
    shareStatus.className = `share-status ${type}`;
    shareStatus.classList.remove('hidden');
  }

  function resetSuccessTimeout() {
    if (successHideTimeout) {
      clearTimeout(successHideTimeout);
      successHideTimeout = null;
    }
  }

  function getState() {
    if (typeof getCalculationState === 'function') {
      return getCalculationState();
    }

    return {
      urgency: 5,
      complexity: 5,
      importance: 5,
      skill: 5,
      frequency: 5,
      probability: '0.00',
      interpretation: ''
    };
  }

  function generateEmailPreview(taskDescription, senderName, senderEmail, recipientName, recipientEmail) {
    const state = getState();
    const {
      urgency,
      complexity,
      importance,
      skill,
      frequency,
      probability,
      interpretation
    } = state;

    const bodyHtml = createSodsEmailPreviewHtml({
      taskDescription,
      senderName,
      senderEmail,
      recipientName,
      urgency,
      complexity,
      importance,
      skill,
      frequency,
      probability,
      interpretation
    });
    const subject = createSodsEmailSubject(probability, senderName);

    return `
      ${bodyHtml}
      <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 4px;">
        <p style="margin: 0;"><strong>From:</strong> ${senderName} &lt;${senderEmail}&gt;</p>
        <p style="margin: 5px 0 0 0;"><strong>To:</strong> ${recipientName} &lt;${recipientEmail}&gt;</p>
        <p style="margin: 5px 0 0 0;"><strong>Subject:</strong> ${subject}</p>
      </div>
    `;
  }

  function toggleShareForm() {
    shareFormContainer?.classList.toggle('hidden');
    if (shareFormContainer && !shareFormContainer.classList.contains('hidden')) {
      taskDescriptionInput?.focus();
    }
  }

  function cancelShare() {
    shareFormContainer?.classList.add('hidden');
    if (taskDescriptionInput) taskDescriptionInput.value = '';
    if (senderNameInput) senderNameInput.value = '';
    if (senderEmailInput) senderEmailInput.value = '';
    if (recipientNameInput) recipientNameInput.value = '';
    if (recipientEmailInput) recipientEmailInput.value = '';
    hideShareStatus();
    resetSuccessTimeout();
  }

  function handlePreview() {
    hideShareStatus();
    resetSuccessTimeout();

    const errors = [];
    const taskDescription = taskDescriptionInput?.value.trim();
    const senderName = senderNameInput?.value.trim();
    const senderEmail = senderEmailInput?.value.trim();
    const recipientName = recipientNameInput?.value.trim();
    const recipientEmail = recipientEmailInput?.value.trim();

    if (!taskDescription) {
      errors.push('Please enter a task description.');
    }

    if (!senderName) {
      errors.push('Please enter your name.');
    }

    if (!senderEmail) {
      errors.push('Please enter your email address.');
    } else if (!EMAIL_REGEX.test(senderEmail)) {
      errors.push('Please enter a valid email address for sender.');
    }

    if (!recipientName) {
      errors.push('Please enter recipient name.');
    }

    if (!recipientEmail) {
      errors.push('Please enter recipient email address.');
    } else if (!EMAIL_REGEX.test(recipientEmail)) {
      errors.push('Please enter a valid recipient email address.');
    }

    if (errors.length) {
      showShareStatus(errors.join(' '), 'error');
      return;
    }

    const preview = generateEmailPreview(taskDescription, senderName, senderEmail, recipientName, recipientEmail);
    if (previewContent) previewContent.innerHTML = preview;
    emailPreviewModal?.classList.remove('hidden');
  }

  function closePreviewModal() {
    emailPreviewModal?.classList.add('hidden');
  }

  async function handleSend() {
    hideShareStatus();
    resetSuccessTimeout();

    const errors = [];
    const taskDescription = taskDescriptionInput?.value.trim();
    const senderName = senderNameInput?.value.trim();
    const senderEmail = senderEmailInput?.value.trim();
    const recipientName = recipientNameInput?.value.trim();
    const recipientEmail = recipientEmailInput?.value.trim();

    if (!taskDescription) {
      errors.push('Please enter a task description.');
    }

    if (!senderName) {
      errors.push('Please enter your name.');
    }

    if (!senderEmail) {
      errors.push('Please enter your email address.');
    } else if (!EMAIL_REGEX.test(senderEmail)) {
      errors.push('Please enter a valid email address for sender.');
    }

    if (!recipientName) {
      errors.push('Please enter recipient name.');
    }

    if (!recipientEmail) {
      errors.push('Please enter recipient email address.');
    } else if (!EMAIL_REGEX.test(recipientEmail)) {
      errors.push('Please enter a valid recipient email address.');
    }

    if (errors.length) {
      showShareStatus(errors.join(' '), 'error');
      return;
    }

    if (!sendButton) return;

    sendButton.disabled = true;
    sendButton.textContent = SENDING_BUTTON_TEXT;
    showShareStatus('Sending email...', 'info');

    try {
      const state = getState();
      const endpoint = '/api/share-calculation';
      const primaryUrl = `${API_BASE_URL}${endpoint}`;
      const fallbackUrl = `${API_FALLBACK_URL}${endpoint}`;

      const requestBody = JSON.stringify({
        email: recipientEmail,
        taskDescription,
        senderName,
        senderEmail,
        recipientName,
        urgency: state.urgency,
        complexity: state.complexity,
        importance: state.importance,
        skill: state.skill,
        frequency: state.frequency,
        probability: state.probability,
        interpretation: state.interpretation
      });

      let response;
      let result;

      try {
        response = await fetch(primaryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        });

        if (!response.ok) {
          throw new Error(`Primary API failed: ${response.status}`);
        }

        result = await response.json();
      } catch {
        // Try fallback URL
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        });

        result = await response.json();
      }

      if (response.ok) {
        showShareStatus('✅ Email sent successfully!', 'success');
        successHideTimeout = setTimeout(() => {
          cancelShare();
        }, 2000);
      } else {
        showShareStatus(`❌ Failed to send email: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showShareStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = DEFAULT_BUTTON_TEXT;
    }
  }

  addListener(shareCta, 'click', toggleShareForm);
  addListener(cancelButton, 'click', cancelShare);
  addListener(previewButton, 'click', handlePreview);
  addListener(sendButton, 'click', handleSend);
  closePreviewButtons.forEach((btn) => addListener(btn, 'click', closePreviewModal));
  addListener(emailPreviewModal, 'click', (event) => {
    if (event.target === emailPreviewModal) {
      closePreviewModal();
    }
  });

  return () => {
    listeners.forEach((unsubscribe) => unsubscribe());
    resetSuccessTimeout();
  };
}
