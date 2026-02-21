import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleCopyAction, addCopyActionListeners } from '../src/utils/copy-actions.js';
import * as clipboard from '../src/utils/clipboard.js';

interface CopyContext {
  copyCalls?: Array<{ text: string; message: string }>;
}

function createLocalThis(): () => CopyContext {
  const context: CopyContext = {};

  beforeEach(() => {
    (Object.keys(context) as (keyof CopyContext)[]).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('copy-actions', () => {
  const local = createLocalThis();
  let copyToClipboardSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    local().copyCalls = [];
    copyToClipboardSpy = vi.spyOn(clipboard, 'copyToClipboard').mockImplementation(async (text, message) => {
      local().copyCalls!.push({ text, message });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleCopyAction', () => {
    it('returns true and copies when copy-text button has data-copy-value', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-text');
      btn.setAttribute('data-copy-value', 'Law text here');
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, btn);

      expect(result).toBe(true);
      expect(copyToClipboardSpy).toHaveBeenCalledWith('Law text here', 'Law text copied to clipboard!');
    });

    it('returns true and copies when copy-link button has data-copy-value', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-link');
      btn.setAttribute('data-copy-value', 'https://example.com/law/1');
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, btn);

      expect(result).toBe(true);
      expect(copyToClipboardSpy).toHaveBeenCalledWith('https://example.com/law/1', 'Link copied to clipboard!');
    });

    it('returns true when copy-text has no data-copy-value and does not call copyToClipboard', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-text');
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, btn);

      expect(result).toBe(true);
      expect(copyToClipboardSpy).not.toHaveBeenCalled();
    });

    it('returns true when copy-link has no data-copy-value and does not call copyToClipboard with value', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-link');
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, btn);

      expect(result).toBe(true);
      expect(copyToClipboardSpy).not.toHaveBeenCalled();
    });

    it('returns false when target is not inside copy-text or copy-link', async () => {
      const div = document.createElement('div');
      div.setAttribute('data-other', 'x');
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, div);

      expect(result).toBe(false);
      expect(copyToClipboardSpy).not.toHaveBeenCalled();
    });

    it('returns true when target is child of copy-text button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-text');
      btn.setAttribute('data-copy-value', 'Nested text');
      const span = document.createElement('span');
      btn.appendChild(span);
      const e = new Event('click', { bubbles: true });

      const result = await handleCopyAction(e, span);

      expect(result).toBe(true);
      expect(copyToClipboardSpy).toHaveBeenCalledWith('Nested text', 'Law text copied to clipboard!');
    });
  });

  describe('addCopyActionListeners', () => {
    it('invokes handleCopyAction on click and copies when clicking copy-text', async () => {
      const container = document.createElement('div');
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-text');
      btn.setAttribute('data-copy-value', 'From container');
      container.appendChild(btn);

      addCopyActionListeners(container);
      btn.click();

      await new Promise((r) => setTimeout(r, 10));

      expect(copyToClipboardSpy).toHaveBeenCalledWith('From container', 'Law text copied to clipboard!');
    });

    it('does not throw when click target is not an Element', () => {
      const container = document.createElement('div');
      addCopyActionListeners(container);
      const e = new Event('click', { bubbles: true });
      Object.defineProperty(e, 'target', { value: null, configurable: true });
      expect(() => container.dispatchEvent(e)).not.toThrow();
      expect(copyToClipboardSpy).not.toHaveBeenCalled();
    });
  });
});
