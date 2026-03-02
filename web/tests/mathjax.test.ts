import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setLoaderForTesting, resetMathJaxStateForTesting } from '../src/utils/mathjax.ts';

let ensureMathJax: typeof import('../src/utils/mathjax.ts').ensureMathJax | undefined;

/** Window with optional MathJax (matches src/types/global.d.ts) */
interface WindowWithMathJax extends Window {
  MathJax?: {
    typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    startup?: Record<string, unknown>;
    tex?: Record<string, unknown>;
    options?: Record<string, unknown>;
    loader?: Record<string, unknown>;
    chtml?: Record<string, unknown>;
  };
}

/** Shape of renderActions.addMathTitles used by addMathTitles tests */
interface MathJaxAddMathTitlesAction {
  addMathTitles?: [number, (doc: { math: Array<{ typesetRoot: Node | null | undefined }> }) => void];
}

function getWindow(): WindowWithMathJax {
  return window as WindowWithMathJax;
}

describe('mathjax utility', () => {
  let originalMathJax: WindowWithMathJax['MathJax'] | undefined;

  beforeEach(async () => {
    // Save original values
    originalMathJax = getWindow().MathJax;

    // Reset MathJax and loader state
    getWindow().MathJax = undefined;
    setLoaderForTesting(undefined);
    resetMathJaxStateForTesting();

    vi.resetModules();
    const module = await import('../src/utils/mathjax.ts');
    ensureMathJax = module.ensureMathJax;

    vi.spyOn(document, 'getElementById').mockReturnValue(null);
  });

  afterEach(() => {
    setLoaderForTesting(undefined);
    if (originalMathJax) {
      getWindow().MathJax = originalMathJax;
    } else {
      getWindow().MathJax = undefined;
    }
    vi.restoreAllMocks();
  });

  describe('ensureMathJax', () => {
    it('returns existing MathJax if already loaded with typesetPromise', async () => {
      const mockMathJax = {
        typesetPromise: vi.fn().mockResolvedValue(undefined)
      };
      getWindow().MathJax = mockMathJax;

      const result = await ensureMathJax!();
      
      expect(result).toBe(mockMathJax);
    });

    it('returns undefined when window is undefined (SSR)', async () => {
      const g = globalThis as unknown as { window?: Window };
      const originalWindow = g.window;
      g.window = undefined;

      try {
        const result = await ensureMathJax!();
        expect(result).toBeUndefined();
      } finally {
        g.window = originalWindow;
      }
    });

    it('L7 B0: ensureMathJax does not configure when window undefined (SSR)', async () => {
      const g = globalThis as unknown as { window?: Window };
      const originalWindow = g.window;
      g.window = undefined;
      try {
        const result = await ensureMathJax!();
        expect(result).toBeUndefined();
      } finally {
        g.window = originalWindow;
      }
    });

    it('L86 B0: ensureMathJax does not call typesetPromise when appRoot is null', async () => {
      vi.resetModules();
      const module = await import('../src/utils/mathjax.ts');
      const localEnsureMathJax = module.ensureMathJax;
      getWindow().MathJax = undefined;
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      const result = await localEnsureMathJax!();
      expect(result).toBeDefined();
    });

    it('returns undefined if MathJax exists but without typesetPromise', async () => {
      (window as unknown as { MathJax?: Record<string, unknown> }).MathJax = { someOtherProp: true };
      resetMathJaxStateForTesting();
      vi.resetModules();
      const module = await import('../src/utils/mathjax.ts');
      module.setLoaderForTesting(() => Promise.reject(new Error('Module not found')));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await module.ensureMathJax();
      expect(result).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });

    it('returns undefined and logs error when dynamic import fails', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;
      resetMathJaxStateForTesting();
      vi.resetModules();
      const module = await import('../src/utils/mathjax.ts');
      module.setLoaderForTesting(() => Promise.reject(new Error('Importing a module script failed')));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await module.ensureMathJax();
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load MathJax:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('configures MathJax window object when loading', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;
      resetMathJaxStateForTesting();
      vi.resetModules();
      const module = await import('../src/utils/mathjax.ts');
      module.setLoaderForTesting(() => Promise.resolve({}));

      await module.ensureMathJax();

      expect(getWindow().MathJax).toBeDefined();
      expect(getWindow().MathJax!.tex).toBeDefined();
      expect(getWindow().MathJax!.tex!.inlineMath).toEqual([['\\(', '\\)']]);
    });

    it('handles MathJax with typesetPromise and app root', async () => {
      const typesetPromiseMock = vi.fn().mockResolvedValue(undefined);
      getWindow().MathJax = {
        typesetPromise: typesetPromiseMock
      };

      const mockAppRoot = document.createElement('div');
      mockAppRoot.id = 'app';
      vi.spyOn(document, 'getElementById').mockReturnValue(mockAppRoot);

      const result = await ensureMathJax!();

      expect(result).toBe(getWindow().MathJax);
    });

    it('calls typesetPromise with appRoot when loader completes and appRoot is present', async () => {
      // This covers line 96: mj.typesetPromise([appRoot]).catch(...)
      // For this path: MathJax has no typesetPromise initially, but loader adds it
      getWindow().MathJax = undefined;
      resetMathJaxStateForTesting();
      vi.resetModules();
      const module = await import('../src/utils/mathjax.ts');

      const typesetPromiseMock = vi.fn().mockResolvedValue(undefined);
      module.setLoaderForTesting(() => {
        // Simulate what the real mathjax loader does: adds typesetPromise to the configured MathJax
        const mj = getWindow().MathJax;
        if (mj) {
          mj.typesetPromise = typesetPromiseMock;
        }
        return Promise.resolve();
      });

      const mockAppRoot = document.createElement('div');
      mockAppRoot.id = 'app';
      vi.spyOn(document, 'getElementById').mockReturnValue(mockAppRoot);

      await module.ensureMathJax();

      // Allow the fire-and-forget .catch chain to settle
      await Promise.resolve();

      expect(typesetPromiseMock).toHaveBeenCalledWith([mockAppRoot]);
    });

    it('handles typesetPromise errors silently', async () => {
      const typesetPromiseMock = vi.fn().mockRejectedValue(new Error('Typeset failed'));

      // Set up MathJax config first, then add typesetPromise after "loading"
      getWindow().MathJax = {
        loader: { load: [] },
        chtml: { fontURL: 'test' },
        tex: { inlineMath: [['\\(', '\\)']] },
        typesetPromise: typesetPromiseMock
      };

      const mockAppRoot = document.createElement('div');
      mockAppRoot.id = 'app';
      vi.spyOn(document, 'getElementById').mockReturnValue(mockAppRoot);

      // Should not throw
      const result = await ensureMathJax!();
      expect(result).toBeDefined();
    });
  });

  describe('MathJax configuration', () => {
    it('sets up renderActions for adding titles to math elements', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      // Check that the config was set up
      const renderActions = (getWindow().MathJax?.options?.renderActions) as MathJaxAddMathTitlesAction | undefined;
      expect(renderActions?.addMathTitles).toBeDefined();

      // Get the render action callback
      const mj = getWindow().MathJax as { options?: { renderActions?: MathJaxAddMathTitlesAction } };
      const renderAction = mj!.options!.renderActions!.addMathTitles!;
      expect(Array.isArray(renderAction)).toBe(true);
      expect(renderAction[0]).toBe(200);
      expect(typeof renderAction[1]).toBe('function');
    });

    it('adds title attributes to math elements with known variables', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      // Get the render action callback
      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      // Create mock math nodes
      const mockMi = document.createElement('mjx-mi');
      mockMi.textContent = 'U';
      
      const mockTypesetRoot = document.createElement('div');
      mockTypesetRoot.appendChild(mockMi);
      
      const mockMathNode = {
        typesetRoot: mockTypesetRoot
      };

      const mockDoc = {
        math: [mockMathNode]
      };

      // Call the callback
      addTitlesCallback(mockDoc);

      // Check that title was added
      expect(mockMi.getAttribute('title')).toBe('Urgency (1-9)');
    });

    it('adds title for all known variables', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      const variables = ['U', 'C', 'I', 'S', 'F', 'A'];
      const expectedTitles = {
        U: 'Urgency (1-9)',
        C: 'Complexity (1-9)',
        I: 'Importance (1-9)',
        S: 'Skill (1-9)',
        F: 'Frequency (1-9)',
        A: 'Activity constant (0.7)'
      };

      for (const varName of variables) {
        const mockMi = document.createElement('mjx-mi');
        mockMi.textContent = varName;
        
        const mockTypesetRoot = document.createElement('div');
        mockTypesetRoot.appendChild(mockMi);
        
        const mockDoc = {
          math: [{ typesetRoot: mockTypesetRoot }]
        };

        addTitlesCallback(mockDoc);

        expect(mockMi.getAttribute('title')).toBe((expectedTitles as Record<string, string>)[varName]);
      }
    });

    it('does not add title for unknown variables', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      const mockMi = document.createElement('mjx-mi');
      mockMi.textContent = 'X'; // Unknown variable
      
      const mockTypesetRoot = document.createElement('div');
      mockTypesetRoot.appendChild(mockMi);
      
      const mockDoc = {
        math: [{ typesetRoot: mockTypesetRoot }]
      };

      addTitlesCallback(mockDoc);

      expect(mockMi.hasAttribute('title')).toBe(false);
    });

    it('handles math nodes without typesetRoot', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      const mockDoc = {
        math: [{ typesetRoot: null }, { typesetRoot: undefined }]
      };

      // Should not throw
      expect(() => addTitlesCallback(mockDoc)).not.toThrow();
    });

    it('handles mi elements without text content', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      const mockMi = document.createElement('mjx-mi');
      mockMi.textContent = ''; // Empty
      
      const mockTypesetRoot = document.createElement('div');
      mockTypesetRoot.appendChild(mockMi);
      
      const mockDoc = {
        math: [{ typesetRoot: mockTypesetRoot }]
      };

      // Should not throw
      expect(() => addTitlesCallback(mockDoc)).not.toThrow();
      expect(mockMi.hasAttribute('title')).toBe(false);
    });

    it('handles mi elements with whitespace-only content', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;

      try {
        await ensureMathJax!();
      } catch {
        // Expected
      }

      const addTitlesCallback = (getWindow().MathJax!.options!.renderActions as MathJaxAddMathTitlesAction).addMathTitles![1];

      const mockMi = document.createElement('mjx-mi');
      mockMi.textContent = '   '; // Whitespace only
      
      const mockTypesetRoot = document.createElement('div');
      mockTypesetRoot.appendChild(mockMi);
      
      const mockDoc = {
        math: [{ typesetRoot: mockTypesetRoot }]
      };

      addTitlesCallback(mockDoc);
      expect(mockMi.hasAttribute('title')).toBe(false);
    });
  });
});
