import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureMathJax, resetMathJaxStateForTesting } from '../src/utils/mathjax.js';

describe('MathJax utility - Coverage', () => {
  beforeEach(() => {
    resetMathJaxStateForTesting();
    // Clean window
    delete global.window.MathJax;
    const script = document.querySelector('script[src*="mathjax"]');
    if (script) script.remove();
  });

  afterEach(() => {
    resetMathJaxStateForTesting();
    vi.restoreAllMocks();
  });

  it('polls for MathJax and resolves when it appears', async () => {
    vi.useFakeTimers();
    
    const promise = ensureMathJax();
    
    // Simulate MathJax appearing after some time
    setTimeout(() => {
      global.window.MathJax = { typesetPromise: () => Promise.resolve() };
    }, 100);
    
    vi.advanceTimersByTime(150);
    
    await promise;
    expect(global.window.MathJax).toBeDefined();
    vi.useRealTimers();
  });

  it('resolves after max attempts even if MathJax never appears', async () => {
    vi.useFakeTimers();
    
    const promise = ensureMathJax();
    
    // Fast forward past max attempts (50 * 100ms = 5000ms)
    vi.advanceTimersByTime(6000);
    
    await promise;
    // Should resolve anyway to not block
    expect(true).toBe(true);
    vi.useRealTimers();
  });

  it('correctly applies math titles in renderActions', async () => {
    // We need to trigger the callback in window.MathJax.options.renderActions.addMathTitles[1]
    await ensureMathJax();
    const callback = window.MathJax.options.renderActions.addMathTitles[1];
    
    const mockMi = document.createElement('mjx-mi');
    mockMi.textContent = 'U';
    const mockRoot = document.createElement('div');
    mockRoot.appendChild(mockMi);
    
    const mockDoc = {
      math: [{ typesetRoot: mockRoot }]
    };
    
    callback(mockDoc);
    expect(mockMi.getAttribute('title')).toBe('Urgency (1-9)');
  });

  it('handles empty mi elements in math titles callback', async () => {
    await ensureMathJax();
    const callback = window.MathJax.options.renderActions.addMathTitles[1];
    
    const mockMi = document.createElement('mjx-mi');
    mockMi.textContent = ''; // Empty
    const mockRoot = document.createElement('div');
    mockRoot.appendChild(mockMi);
    
    const mockDoc = {
      math: [{ typesetRoot: mockRoot }]
    };
    
    callback(mockDoc);
    expect(mockMi.hasAttribute('title')).toBe(false);
  });
});
