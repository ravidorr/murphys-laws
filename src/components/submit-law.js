// Submit a Law section component

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
        <textarea id="submit-text" placeholder="Enter the law text" class="input" rows="3"></textarea>
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
    </form>
    <div class="section-footer">
      <span></span>
      <button id="submit-btn" class="btn" type="submit" disabled aria-label="Submit your law">
        Submit Law
        <span class="material-symbols-outlined icon ml">send</span>
      </button>
    </div>
  `;

  const form = el.querySelector('.submit-form');
  const submitBtn = el.querySelector('#submit-btn');
  const textArea = el.querySelector('#submit-text');
  const termsCheckbox = el.querySelector('#submit-terms');

  // Function to check if submit should be enabled
  function checkSubmitValidity() {
    const hasText = textArea?.value.trim().length > 0;
    const termsChecked = termsCheckbox?.checked;

    if (submitBtn) {
      submitBtn.disabled = !(hasText && termsChecked);
    }
  }

  // Add event listeners to check validity
  textArea?.addEventListener('input', checkSubmitValidity);
  termsCheckbox?.addEventListener('change', checkSubmitValidity);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = el.querySelector('#submit-title')?.value;
      const text = el.querySelector('#submit-text')?.value;
      const author = el.querySelector('#submit-author')?.value;
      const email = el.querySelector('#submit-email')?.value;
      const anonymous = el.querySelector('#submit-anonymous')?.checked;

      if (!text) {
        alert('Please enter law text');
        return;
      }

      // In a real app, this would send to an API
      console.log('Submitting law:', { title, text, author, email, anonymous });
      alert('Thank you for submitting your law!');

      // Clear form
      if (el.querySelector('#submit-title')) el.querySelector('#submit-title').value = '';
      if (el.querySelector('#submit-text')) el.querySelector('#submit-text').value = '';
      if (el.querySelector('#submit-author')) el.querySelector('#submit-author').value = '';
      if (el.querySelector('#submit-email')) el.querySelector('#submit-email').value = '';
      if (el.querySelector('#submit-anonymous')) el.querySelector('#submit-anonymous').checked = false;
      if (el.querySelector('#submit-terms')) el.querySelector('#submit-terms').checked = false;

      // Re-check validity after clearing
      checkSubmitValidity();
    });
  }

  return el;
}
