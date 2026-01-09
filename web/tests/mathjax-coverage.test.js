import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureMathJax, resetMathJaxStateForTesting } from '../src/utils/mathjax.js';

describe('MathJax utility - Coverage', () => {
  let originalWindow;

  beforeEach(() => {
    resetMathJaxStateForTesting();
    originalWindow = global.window;
    delete global.window.MathJax;
    // Mock import if possible, or just rely on failure in test env not crashing
  });

  afterEach(() => {
    global.window = originalWindow;
    resetMathJaxStateForTesting();
    vi.restoreAllMocks();
  });

  it('handles SSR (missing window) gracefully', async () => {
    delete global.window;
    const result = await ensureMathJax();
    expect(result).toBeUndefined();
  });

  it('returns existing MathJax instance if already loaded', async () => {
    global.window.MathJax = { typesetPromise: () => Promise.resolve() };
    const result = await ensureMathJax();
    expect(result).toBe(global.window.MathJax);
  });

  it('configures MathJax correctly before load', async () => {
    // Trigger load
    const promise = ensureMathJax().catch(() => {}); // Catch import error
    
    // Wait for async execution to start (microtask)
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check config
    expect(global.window.MathJax).toBeDefined();
    expect(global.window.MathJax.tex).toBeDefined();
    expect(global.window.MathJax.options.renderActions.addMathTitles).toBeDefined();
    
    await promise; 
  });

  it('correctly applies math titles in renderActions callback', async () => {
    // Manually run the configuration
    const promise = ensureMathJax().catch(() => {});
    
    // Wait for config to be applied
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // We expect import to fail in test environment, but config should be applied
    await promise;
    
    const callback = global.window.MathJax.options.renderActions.addMathTitles[1];
    
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
    const promise = ensureMathJax().catch(() => {});
    
    // Wait for config
    await new Promise(resolve => setTimeout(resolve, 0));
    
    await promise;
    
    const callback = global.window.MathJax.options.renderActions.addMathTitles[1];
    
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
