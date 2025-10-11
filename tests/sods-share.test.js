import { initShareCalculation } from '@modules/sods-share.js';
import templateHtml from '@views/templates/sods-calculator.html?raw';
import { API_SHARE_CALCULATION_ENDPOINT } from '../src/utils/constants.js';

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

function createState(overrides = {}) {
  return {
    urgency: 5,
    complexity: 5,
    importance: 5,
    skill: 5,
    frequency: 5,
    probability: '0.00',
    interpretation: 'Enter your values and see your fate.',
    ...overrides
  };
}

describe('Sod\'s share module', () => {
  const local = createLocalThis();

  beforeEach(() => {
    const self = local();
    const container = document.createElement('div');
    container.innerHTML = templateHtml;
    document.body.appendChild(container);

    self.root = container;
    self.state = createState();

    self.teardown = initShareCalculation({
      root: container,
      getCalculationState: () => ({ ...self.state })
    });
  });

  afterEach(() => {
    const self = local();
    self.teardown?.();
    if (self.root?.parentNode) {
      self.root.parentNode.removeChild(self.root);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('toggles share form visibility when CTA is clicked', () => {
    const { root } = local();
    const shareCta = root.querySelector('#share-cta');
    const shareForm = root.querySelector('#share-form-container');

    expect(shareForm.classList.contains('hidden')).toBe(true);

    shareCta.click();
    expect(shareForm.classList.contains('hidden')).toBe(false);

    shareCta.click();
    expect(shareForm.classList.contains('hidden')).toBe(true);
  });

  it('cancels share and clears inputs', () => {
    const { root } = local();
    const shareCta = root.querySelector('#share-cta');
    const cancelBtn = root.querySelector('#cancel-share');
    const shareForm = root.querySelector('#share-form-container');
    const taskInput = root.querySelector('#task-description');
    const emailInput = root.querySelector('#recipient-email');

    shareCta.click();
    taskInput.value = 'Test task';
    emailInput.value = 'user@example.com';

    cancelBtn.click();
    expect(shareForm.classList.contains('hidden')).toBe(true);
    expect(taskInput.value).toBe('');
    expect(emailInput.value).toBe('');
  });

  it('shows errors when preview is attempted without required fields', () => {
    const { root } = local();
    const shareCta = root.querySelector('#share-cta');
    const previewBtn = root.querySelector('#preview-email');
    const shareStatus = root.querySelector('#share-status');

    shareCta.click();
    previewBtn.click();

    expect(shareStatus.classList.contains('hidden')).toBe(false);
    expect(shareStatus.classList.contains('error')).toBe(true);
    expect(shareStatus.textContent).toMatch(/task description/i);
    expect(shareStatus.textContent).toMatch(/email address/i);
  });

  it('validates email format before previewing', () => {
    const { root } = local();
    const shareCta = root.querySelector('#share-cta');
    const previewBtn = root.querySelector('#preview-email');
    const taskInput = root.querySelector('#task-description');
    const emailInput = root.querySelector('#recipient-email');
    const shareStatus = root.querySelector('#share-status');

    shareCta.click();
    taskInput.value = 'Test task';
    emailInput.value = 'invalid-email';

    previewBtn.click();

    expect(shareStatus.classList.contains('hidden')).toBe(false);
    expect(shareStatus.classList.contains('error')).toBe(true);
    expect(shareStatus.textContent).toMatch(/valid email/i);
  });

  it('opens preview modal when inputs are valid', () => {
    const self = local();
    const { root } = self;
    const shareCta = root.querySelector('#share-cta');
    const previewBtn = root.querySelector('#preview-email');
    const taskInput = root.querySelector('#task-description');
    const emailInput = root.querySelector('#recipient-email');
    const modal = root.querySelector('#email-preview-modal');
    const shareStatus = root.querySelector('#share-status');

    shareCta.click();
    taskInput.value = 'Deploy app';
    emailInput.value = 'user@example.com';

    self.state = createState({ probability: '4.20' });

    previewBtn.click();

    expect(shareStatus.classList.contains('hidden')).toBe(true);
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(root.querySelector('#preview-content').innerHTML).toContain('Deploy app');
  });

  it('closes preview modal via close buttons and backdrop', () => {
    const { root } = local();
    const shareCta = root.querySelector('#share-cta');
    const previewBtn = root.querySelector('#preview-email');
    const taskInput = root.querySelector('#task-description');
    const emailInput = root.querySelector('#recipient-email');
    const modal = root.querySelector('#email-preview-modal');
    const closeBtn = root.querySelector('#close-preview');
    const closeFooter = root.querySelector('#close-preview-footer');

    shareCta.click();
    taskInput.value = 'Deploy app';
    emailInput.value = 'user@example.com';
    previewBtn.click();

    closeBtn.click();
    expect(modal.classList.contains('hidden')).toBe(true);

    previewBtn.click();
    closeFooter.click();
    expect(modal.classList.contains('hidden')).toBe(true);

    previewBtn.click();
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  describe('sending email', () => {
    beforeEach(() => {
      const self = local();
      self.fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
      const self = local();
      self.fetchSpy?.mockRestore?.();
      delete self.fetchSpy;
    });

    it('validates email before sending', () => {
      const { root, fetchSpy } = local();
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');
      const shareStatus = root.querySelector('#share-status');

      shareCta.click();
      taskInput.value = 'Test task';
      emailInput.value = 'invalid-email';

      sendBtn.click();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(shareStatus.classList.contains('error')).toBe(true);
      expect(shareStatus.textContent).toMatch(/valid email/i);
    });

    it('sends calculation email with current state', async () => {
      const self = local();
      const { root, fetchSpy } = self;
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');

      shareCta.click();
      taskInput.value = 'Deploy production server';
      emailInput.value = 'user@example.com';

      self.state = createState({
        urgency: 7,
        complexity: 6,
        importance: 8,
        skill: 5,
        frequency: 4,
        probability: '5.67',
        interpretation: 'Risky business.'
      });

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      sendBtn.click();

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(API_SHARE_CALCULATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        });
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toMatchObject({
        email: 'user@example.com',
        taskDescription: 'Deploy production server',
        urgency: 7,
        complexity: 6,
        importance: 8,
        skill: 5,
        frequency: 4,
        probability: '5.67',
        interpretation: 'Risky business.'
      });
    });

    it('shows success message and auto hides form', async () => {
      vi.useFakeTimers();

      const { root, fetchSpy } = local();
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');
      const shareStatus = root.querySelector('#share-status');
      const shareForm = root.querySelector('#share-form-container');

      shareCta.click();
      taskInput.value = 'Test task';
      emailInput.value = 'user@example.com';

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      sendBtn.click();

      await vi.waitFor(() => {
        expect(shareStatus.classList.contains('success')).toBe(true);
        expect(shareStatus.textContent).toMatch(/sent successfully/i);
      });

      vi.advanceTimersByTime(2100);

      expect(shareForm.classList.contains('hidden')).toBe(true);
      expect(taskInput.value).toBe('');
      expect(emailInput.value).toBe('');
    });

    it('shows error when API responds with failure', async () => {
      const { root, fetchSpy } = local();
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');
      const shareStatus = root.querySelector('#share-status');

      shareCta.click();
      taskInput.value = 'Test task';
      emailInput.value = 'user@example.com';

      fetchSpy.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Email service not configured' })
      });

      sendBtn.click();

      await vi.waitFor(() => {
        expect(shareStatus.classList.contains('error')).toBe(true);
        expect(shareStatus.textContent).toMatch(/Email service not configured/i);
      });
    });

    it('handles fetch throwing an error', async () => {
      const { root, fetchSpy } = local();
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');
      const shareStatus = root.querySelector('#share-status');

      shareCta.click();
      taskInput.value = 'Test task';
      emailInput.value = 'user@example.com';

      fetchSpy.mockRejectedValue(new Error('Network down'));

      sendBtn.click();

      await vi.waitFor(() => {
        expect(shareStatus.classList.contains('error')).toBe(true);
        expect(shareStatus.textContent).toMatch(/Network down/);
      });
    });

    it('disables send button while sending', async () => {
      const { root, fetchSpy } = local();
      const shareCta = root.querySelector('#share-cta');
      const sendBtn = root.querySelector('#send-email');
      const taskInput = root.querySelector('#task-description');
      const emailInput = root.querySelector('#recipient-email');

      shareCta.click();
      taskInput.value = 'Test task';
      emailInput.value = 'user@example.com';

      fetchSpy.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 50);
      }));

      sendBtn.click();

      expect(sendBtn.disabled).toBe(true);
      expect(sendBtn.textContent).toBe('Sending...');

      await vi.waitFor(() => {
        expect(sendBtn.disabled).toBe(false);
        expect(sendBtn.textContent).toBe('✉️ Send Email');
      });
    });
  });
});
