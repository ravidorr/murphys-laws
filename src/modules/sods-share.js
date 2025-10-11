import { API_SHARE_CALCULATION_ENDPOINT } from '../utils/constants.js';

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

  function generateEmailPreview(taskDescription, recipientEmail) {
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

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Sod's Law Calculator Result</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #667eea; font-size: 18px;">Your Task</h2>
            <p>${taskDescription}</p>
          </div>

          <h3 style="color: #667eea; margin-top: 30px;">Input Values</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Urgency (U)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">${urgency}</span>
            </div>
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Complexity (C)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">${complexity}</span>
            </div>
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Importance (I)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">${importance}</span>
            </div>
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Skill (S)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">${skill}</span>
            </div>
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Frequency (F)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">${frequency}</span>
            </div>
            <div style="background: white; padding: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong style="display: block; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Aggravation (A)</strong>
              <span style="font-size: 24px; color: #333; font-weight: bold;">0.7</span>
            </div>
          </div>

          <div style="background: white; padding: 25px; margin: 20px 0; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #667eea;">Probability of Things Going Wrong</h3>
            <div style="font-size: 48px; font-weight: bold; color: #667eea; margin: 10px 0;">${probability}</div>
            <div style="font-size: 18px; color: #555; margin: 15px 0; padding: 15px; background: #f0f0f0; border-radius: 4px;">${interpretation}</div>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">The higher the probability (P), the greater the chance that Sod's law will strike.</p>
          </div>

          <div style="text-align: center;">
            <a href="https://murphys-laws.com/sods-calculator" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold;">Try Another Calculation</a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 14px;">
            <p>Powered by Murphy's Laws - Where everything that can go wrong, will go wrong.</p>
            <p><a href="https://murphys-laws.com" style="color: #667eea; text-decoration: none;">Visit murphys-laws.com</a></p>
          </div>
        </div>
      </div>
      <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 4px;">
        <p style="margin: 0;"><strong>To:</strong> ${recipientEmail}</p>
        <p style="margin: 5px 0 0 0;"><strong>Subject:</strong> Your Sod's Law Calculation Result - ${probability}</p>
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
    if (recipientEmailInput) recipientEmailInput.value = '';
    hideShareStatus();
    resetSuccessTimeout();
  }

  function handlePreview() {
    hideShareStatus();
    resetSuccessTimeout();

    const errors = [];
    const taskDescription = taskDescriptionInput?.value.trim();
    const emailValue = recipientEmailInput?.value.trim();

    if (!taskDescription) {
      errors.push('Please enter a task description');
    }

    if (!emailValue) {
      errors.push('Please enter an email address');
    } else if (!EMAIL_REGEX.test(emailValue)) {
      errors.push('Please enter a valid email address');
    }

    if (errors.length) {
      showShareStatus(errors.join(' '), 'error');
      return;
    }

    const preview = generateEmailPreview(taskDescription, emailValue);
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
    const recipientEmail = recipientEmailInput?.value.trim();

    if (!taskDescription) {
      errors.push('Please enter a task description');
    }

    if (!recipientEmail) {
      errors.push('Please enter an email address');
    } else if (!EMAIL_REGEX.test(recipientEmail)) {
      errors.push('Please enter a valid email address');
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
      const response = await fetch(API_SHARE_CALCULATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: recipientEmail,
          taskDescription,
          urgency: state.urgency,
          complexity: state.complexity,
          importance: state.importance,
          skill: state.skill,
          frequency: state.frequency,
          probability: state.probability,
          interpretation: state.interpretation
        })
      });

      const result = await response.json();

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
