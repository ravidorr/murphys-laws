import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// We need to reset the module between tests to clear the loaderPromise
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

    // Reset MathJax
    getWindow().MathJax = undefined;
    
    // Reset the module to clear loaderPromise
    vi.resetModules();
    const module = await import('../src/utils/mathjax.ts');
    ensureMathJax = module.ensureMathJax;
    
    // Mock document.getElementById
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
  });

  afterEach(() => {
    // Restore
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

    it('returns undefined if MathJax exists but without typesetPromise', async () => {
      (window as unknown as { MathJax?: Record<string, unknown> }).MathJax = { someOtherProp: true };
      
      // Reset modules and use vi.doMock() for dynamic mocking (not hoisted like vi.mock())
      vi.resetModules();
      vi.doMock('mathjax/es5/tex-chtml.js', () => {
        throw new Error('Module not found');
      });

      // Re-import to use the mocked module
      const module = await import('../src/utils/mathjax.ts');
      const localEnsureMathJax = module.ensureMathJax;

      // The ensureMathJax will try to load mathjax, which will fail
      // It should return undefined gracefully instead of throwing
      const result = await localEnsureMathJax!();
      expect(result).toBeUndefined();
    });

    it('returns undefined and logs error when dynamic import fails', async () => {
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;
      
      // Reset modules and mock the mathjax import to fail
      vi.resetModules();
      vi.doMock('mathjax/es5/tex-chtml.js', () => {
        throw new Error('Importing a module script failed');
      });

      // Re-import to use the mocked module
      const module = await import('../src/utils/mathjax.ts');
      const localEnsureMathJax = module.ensureMathJax;

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should return undefined gracefully, not throw
      const result = await localEnsureMathJax!();
      expect(result).toBeUndefined();
      
      // Should have logged the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load MathJax:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('configures MathJax window object when loading', async () => {
      // Ensure MathJax is not set
      (window as unknown as { MathJax?: unknown }).MathJax = undefined;
      
      // Reset modules and set up mock for dynamic import
      vi.resetModules();
      vi.doMock('mathjax/es5/tex-chtml.js', () => ({}));

      // Re-import to use the mocked module
      const module = await import('../src/utils/mathjax.ts');
      const localEnsureMathJax = module.ensureMathJax;

      try {
        await localEnsureMathJax!();
      } catch {
        // Expected - module won't actually load
      }

      // MathJax config should have been set
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
