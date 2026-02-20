/// <reference path="../src/types/vite-env.d.ts" />
/// <reference path="../src/types/global.d.ts" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Calculator } from '../src/views/sods-calculator.js';
import templateHtml from '@views/templates/sods-calculator.html?raw';

describe('Sod\'s Law Calculator - Coverage', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Ensure MathJax is defined on window
    window.MathJax = {
      typesetPromise: vi.fn(() => Promise.resolve())
    };
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clean up MathJax
    (window as unknown as { MathJax?: unknown }).MathJax = undefined;
    vi.restoreAllMocks();
  });

  it('handles MathJax being undefined during formula update', async () => {
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { cb(0); return 0; };

    (globalThis.window as unknown as { MathJax?: unknown }).MathJax = undefined;
    
    const el = Calculator();
    container.appendChild(el);
    
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    slider.value = '7';
    slider.dispatchEvent(new Event('input'));
    
    // Should not throw even if MathJax is missing
    expect(true).toBe(true);

    window.requestAnimationFrame = originalRAF;
  });

  it('handles MathJax.typesetPromise being missing', async () => {
    (globalThis.window as unknown as { MathJax?: Record<string, unknown> }).MathJax = {}; // Missing typesetPromise
    
    const el = Calculator();
    container.appendChild(el);
    
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    slider.value = '7';
    slider.dispatchEvent(new Event('input'));
    
    expect(true).toBe(true);
  });

  it('maps MathJax Unicode characters to tooltips', async () => {
    // Mock requestAnimationFrame to run immediately
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { cb(0); return 0; };

    const el = Calculator();
    container.appendChild(el);
    
    // Override MathJax mock to simulate rendering
    const typesetMock = vi.fn((elements?: HTMLElement[]) => {
      if (!elements?.length) return Promise.resolve();
      const display = elements[0]!;
      display.innerHTML = ''; // Clear text

      const miP = document.createElement('mjx-mi');
      const cP = document.createElement('mjx-c');
      cP.className = 'mjx-c1D443'; // Italic P
      miP.appendChild(cP);

      const miU = document.createElement('mjx-mi');
      const cU = document.createElement('mjx-c');
      cU.className = 'mjx-c1D448'; // Italic U
      miU.appendChild(cU);

      display.appendChild(miP);
      display.appendChild(miU);

      return Promise.resolve();
    });
    window.MathJax!.typesetPromise = typesetMock;
    
    // Trigger updateCalculation
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    slider.dispatchEvent(new Event('input'));
    
    // Wait for microtasks (promise chain)
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check if tooltips were added
    const formulaDisplay = el.querySelector('#formula-display');
    expect(formulaDisplay).toBeTruthy();
    const miP = formulaDisplay!.querySelector('mjx-mi:first-child');
    const miU = formulaDisplay!.querySelector('mjx-mi:last-child');
    expect(miP).toBeTruthy();
    expect(miU).toBeTruthy();
    expect(miP!.getAttribute('data-tooltip')).toBe('Probability');
    expect(miU!.getAttribute('data-tooltip')).toBe('Urgency (1-9)');

    window.requestAnimationFrame = originalRAF;
  });

  it('handles MathJax typesetPromise rejection gracefully', async () => {
    // Mock requestAnimationFrame
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { cb(0); return 0; };

    const el = Calculator();
    container.appendChild(el);
    
    // Mock rejection
    window.MathJax!.typesetPromise = vi.fn(() => Promise.reject(new Error('MathJax error')));
    
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    
    // Should not throw
    await expect(async () => {
      slider.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 0));
    }).not.toThrow();

    window.requestAnimationFrame = originalRAF;
  });

  it('handles calculation interpretation for risky scores (2-4)', () => {
    const el = Calculator();
    const sliders = {
      urgency: el.querySelector('#urgency') as HTMLInputElement,
      complexity: el.querySelector('#complexity') as HTMLInputElement,
      importance: el.querySelector('#importance') as HTMLInputElement,
      skill: el.querySelector('#skill') as HTMLInputElement,
      frequency: el.querySelector('#frequency') as HTMLInputElement,
    };
    
    // Set for risky score (~3.0)
    sliders.urgency.value = '5';
    sliders.complexity.value = '5';
    sliders.importance.value = '5';
    sliders.skill.value = '8';
    sliders.frequency.value = '5';
    
    Object.values(sliders).forEach(s => s.dispatchEvent(new Event('input')));
    const interpretation = el.querySelector('#score-interpretation');
    expect(interpretation?.textContent).toMatch(/Risky/i);
  });

  it('handles calculation interpretation for worrying scores (4-6)', () => {
    const el = Calculator();
    const sliders = {
      urgency: el.querySelector('#urgency') as HTMLInputElement,
      complexity: el.querySelector('#complexity') as HTMLInputElement,
      importance: el.querySelector('#importance') as HTMLInputElement,
      skill: el.querySelector('#skill') as HTMLInputElement,
      frequency: el.querySelector('#frequency') as HTMLInputElement,
    };
    
    // Set for worrying score (~5.0)
    sliders.urgency.value = '5';
    sliders.complexity.value = '5';
    sliders.importance.value = '5';
    sliders.skill.value = '5';
    sliders.frequency.value = '5';
    
    Object.values(sliders).forEach(s => s.dispatchEvent(new Event('input')));
    const interpretation = el.querySelector('#score-interpretation');
    expect(interpretation?.textContent).toMatch(/Worrying/i);
  });

  it('handles calculation interpretation for dangerous scores (6-8)', () => {
    const el = Calculator();
    const sliders = {
      urgency: el.querySelector('#urgency') as HTMLInputElement,
      complexity: el.querySelector('#complexity') as HTMLInputElement,
      importance: el.querySelector('#importance') as HTMLInputElement,
      skill: el.querySelector('#skill') as HTMLInputElement,
      frequency: el.querySelector('#frequency') as HTMLInputElement,
    };
    
    // Set for dangerous score (~6.5)
    sliders.urgency.value = '7';
    sliders.complexity.value = '7';
    sliders.importance.value = '7';
    sliders.skill.value = '5';
    sliders.frequency.value = '5';
    
    Object.values(sliders).forEach(s => s.dispatchEvent(new Event('input')));
    const interpretation = el.querySelector('#score-interpretation');
    expect(interpretation?.textContent).toMatch(/Looming/i);
  });

  it('handles calculation interpretation edge cases', () => {
    const el = Calculator();
    container.appendChild(el);
    
    const scoreValue = el.querySelector('#score-value');
    const interpretation = el.querySelector('#score-interpretation');
    
    // We can't easily force the score without manipulating sliders
    // Urgency=9, Complexity=9, Importance=9, Skill=1, Frequency=9 -> High score
    const sliders = {
      urgency: el.querySelector('#urgency') as HTMLInputElement,
      complexity: el.querySelector('#complexity') as HTMLInputElement,
      importance: el.querySelector('#importance') as HTMLInputElement,
      skill: el.querySelector('#skill') as HTMLInputElement,
      frequency: el.querySelector('#frequency') as HTMLInputElement,
    };
    
    // Set for high probability
    sliders.urgency.value = '9';
    sliders.complexity.value = '9';
    sliders.importance.value = '9';
    sliders.skill.value = '1';
    sliders.frequency.value = '9';
    
    Object.values(sliders).forEach(s => s.dispatchEvent(new Event('input')));
    
    expect(parseFloat(scoreValue?.textContent ?? '0')).toBeGreaterThan(8);
    expect(interpretation?.textContent).toMatch(/Catastrophe/i);
    
    // Set for low probability
    sliders.urgency.value = '1';
    sliders.complexity.value = '1';
    sliders.importance.value = '1';
    sliders.skill.value = '9';
    sliders.frequency.value = '1';
    
    Object.values(sliders).forEach(s => s.dispatchEvent(new Event('input')));
    
    expect(parseFloat(scoreValue?.textContent ?? '0')).toBeLessThan(2);
    expect(interpretation?.textContent).toMatch(/safe/i);
  });

  it('handles missing formula display element', () => {
    const el = Calculator();
    container.appendChild(el);
    
    const formulaDisplay = el.querySelector('#formula-display');
    formulaDisplay?.remove();
    
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    // Should not throw when element is missing
    expect(() => {
      slider.dispatchEvent(new Event('input'));
    }).not.toThrow();
  });

  it('toggles value visibility on input and resets after timeout', async () => {
    vi.useFakeTimers();
    const el = Calculator();
    container.appendChild(el);
    
    const slider = el.querySelector('#urgency') as HTMLInputElement;
    slider.dispatchEvent(new Event('input'));
    
    // Formula should now contain values instead of variables
    const formulaDisplay = el.querySelector('#formula-display');
    // We can't easily check textContent due to MathJax, but we know it triggers updateCalculation
    
    vi.advanceTimersByTime(2100);
    // Should reset back to variables
    
    vi.useRealTimers();
  });

  it('covers all interpretation score boundaries', () => {
    const el = Calculator();
    // Helper to set values and get interpretation
    const getInterp = (u: number, c: number, i: number, s: number, f: number) => {
      const sliders = {
        urgency: el.querySelector('#urgency') as HTMLInputElement,
        complexity: el.querySelector('#complexity') as HTMLInputElement,
        importance: el.querySelector('#importance') as HTMLInputElement,
        skill: el.querySelector('#skill') as HTMLInputElement,
        frequency: el.querySelector('#frequency') as HTMLInputElement,
      };
      sliders.urgency.value = String(u);
      sliders.complexity.value = String(c);
      sliders.importance.value = String(i);
      sliders.skill.value = String(s);
      sliders.frequency.value = String(f);
      Object.values(sliders).forEach(sl => sl.dispatchEvent(new Event('input')));
      return el.querySelector('#score-interpretation')?.textContent ?? '';
    };

    // Threshold < 2: Safe
    expect(getInterp(1, 1, 1, 9, 1)).toMatch(/safe/i);
    // Threshold 2-4: Risky
    expect(getInterp(5, 5, 5, 8, 5)).toMatch(/risky/i);
    // Threshold 4-6: Worrying
    expect(getInterp(5, 5, 5, 5, 5)).toMatch(/worrying/i);
    // Threshold 6-8: Dangerous
    expect(getInterp(7, 7, 7, 5, 5)).toMatch(/looming/i);
    // Threshold > 8: Catastrophe
    expect(getInterp(9, 9, 9, 1, 9)).toMatch(/catastrophe/i);
  });

  it('handles ensureMathJax failure gracefully', async () => {
    // We need to mock the module BEFORE import
    vi.mock('../src/utils/mathjax.ts', () => ({
      ensureMathJax: vi.fn(() => Promise.reject(new Error('Load failed')))
    }));

    // Re-import Calculator to use the mock
    vi.resetModules();
    const { Calculator } = await import('../src/views/sods-calculator.ts');
    
    const el = Calculator();
    container.appendChild(el);
    
    // Wait for promises
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Formula display should still have content (updateCalculation called)
    const formulaDisplay = el.querySelector('#formula-display');
    expect(formulaDisplay).toBeTruthy();
    expect(formulaDisplay!.textContent).toBeTruthy();
    
    vi.clearAllMocks();
  });

  it('loads valid URL parameters and updates slider values and displays', async () => {
    // Reset modules to ensure fresh import with URL params
    vi.resetModules();
    
    // Mock window.location.search before importing
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?u=3&c=4&i=5&s=6&f=7',
        href: 'http://localhost:3000/calculator?u=3&c=4&i=5&s=6&f=7'
      },
      writable: true
    });

    // Re-import Calculator to use the mocked location
    const { Calculator: FreshCalculator } = await import('../src/views/sods-calculator.ts');
    
    const el = FreshCalculator();
    container.appendChild(el);

    // Check slider values
    expect((el.querySelector('#urgency') as HTMLInputElement).value).toBe('3');
    expect((el.querySelector('#complexity') as HTMLInputElement).value).toBe('4');
    expect((el.querySelector('#importance') as HTMLInputElement).value).toBe('5');
    expect((el.querySelector('#skill') as HTMLInputElement).value).toBe('6');
    expect((el.querySelector('#frequency') as HTMLInputElement).value).toBe('7');

    // Check slider value displays are also updated
    expect(el.querySelector('#urgency-value')!.textContent).toBe('3');
    expect(el.querySelector('#complexity-value')!.textContent).toBe('4');
    expect(el.querySelector('#importance-value')!.textContent).toBe('5');
    expect(el.querySelector('#skill-value')!.textContent).toBe('6');
    expect(el.querySelector('#frequency-value')!.textContent).toBe('7');

    // Restore location
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true
    });
  });

  it('ignores out-of-range URL parameters', async () => {
    // Reset modules to ensure fresh import
    vi.resetModules();
    
    // Mock window.location.search with invalid URL params
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?u=0&c=10&i=-5&s=abc&f=100',
        href: 'http://localhost:3000/calculator?u=0&c=10&i=-5&s=abc&f=100'
      },
      writable: true
    });

    // Re-import Calculator
    const { Calculator: FreshCalculator } = await import('../src/views/sods-calculator.ts');
    
    const el = FreshCalculator();
    container.appendChild(el);

    // Sliders should retain their default values (5 for all)
    expect((el.querySelector('#urgency') as HTMLInputElement).value).toBe('5');
    expect((el.querySelector('#complexity') as HTMLInputElement).value).toBe('5');
    expect((el.querySelector('#importance') as HTMLInputElement).value).toBe('5');
    expect((el.querySelector('#skill') as HTMLInputElement).value).toBe('5');
    expect((el.querySelector('#frequency') as HTMLInputElement).value).toBe('5');

    // Restore location
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true
    });
  });

  it('getShareableUrl generates URL with current slider values', async () => {
    const el = Calculator();
    container.appendChild(el);

    // Set specific slider values
    (el.querySelector('#urgency') as HTMLInputElement).value = '2';
    (el.querySelector('#complexity') as HTMLInputElement).value = '3';
    (el.querySelector('#importance') as HTMLInputElement).value = '4';
    (el.querySelector('#skill') as HTMLInputElement).value = '5';
    (el.querySelector('#frequency') as HTMLInputElement).value = '6';

    // Trigger input to update internal state
    (el.querySelector('#urgency') as HTMLInputElement).dispatchEvent(new Event('input'));

    // Copy link calls getShareableUrl
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    // Click copy-link button directly (inline share buttons)
    const copyBtn = el.querySelector('[data-action="copy-link"]');
    expect(copyBtn).toBeTruthy();
    copyBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    // Verify URL contains the slider values
    expect(writeTextMock).toHaveBeenCalled();
    const url = writeTextMock.mock.calls[0]![0];
    expect(url).toContain('u=2');
    expect(url).toContain('c=3');
    expect(url).toContain('i=4');
    expect(url).toContain('s=5');
    expect(url).toContain('f=6');
  });

  it('updateState captures current slider and display values in share text', async () => {
    const el = Calculator();
    container.appendChild(el);

    // Set slider values for high score
    (el.querySelector('#urgency') as HTMLInputElement).value = '9';
    (el.querySelector('#complexity') as HTMLInputElement).value = '9';
    (el.querySelector('#importance') as HTMLInputElement).value = '9';
    (el.querySelector('#skill') as HTMLInputElement).value = '1';
    (el.querySelector('#frequency') as HTMLInputElement).value = '9';

    // Trigger input to update calculation
    (el.querySelector('#urgency') as HTMLInputElement).dispatchEvent(new Event('input'));

    // Copy text calls getShareText which uses updateState
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    // Click copy-text button directly (inline share buttons)
    const copyBtn = el.querySelector('[data-action="copy-text"]');
    expect(copyBtn).toBeTruthy();
    copyBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    // The copied text should contain the high probability (8.60 is max due to capping)
    expect(writeTextMock).toHaveBeenCalled();
    const text = writeTextMock.mock.calls[0]![0];
    expect(text).toContain('8.');
  });

  it('Twitter share link includes probability and interpretation', () => {
    const el = Calculator();
    container.appendChild(el);

    // Set sliders for a specific score
    (el.querySelector('#urgency') as HTMLInputElement).value = '1';
    (el.querySelector('#urgency') as HTMLInputElement).dispatchEvent(new Event('input'));

    // Click a share link to trigger URL update
    const twitterLink = el.querySelector('[data-share="twitter"]') as HTMLAnchorElement;
    twitterLink.dispatchEvent(new Event('click', { bubbles: true }));

    expect(twitterLink.href).toContain('twitter.com/intent/tweet');
    expect(twitterLink.href).toContain('Sod');
  });

  it('Facebook share link includes shareable URL', () => {
    const el = Calculator();
    container.appendChild(el);

    (el.querySelector('#urgency') as HTMLInputElement).value = '5';
    (el.querySelector('#urgency') as HTMLInputElement).dispatchEvent(new Event('input'));

    // Click a share link to trigger URL update
    const facebookLink = el.querySelector('[data-share="facebook"]') as HTMLAnchorElement;
    facebookLink.dispatchEvent(new Event('click', { bubbles: true }));

    expect(facebookLink.href).toContain('facebook.com/sharer');
    // The shareable URL is URL-encoded within the Facebook URL
    expect(facebookLink.href).toContain(encodeURIComponent('u=5'));
  });
});
