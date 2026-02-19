// @ts-nocheck
// We need to reset the module between tests to clear the loaderPromise
let ensureMathJax;

describe('mathjax utility', () => {
  let originalMathJax;

  beforeEach(async () => {
    // Save original values
    originalMathJax = window.MathJax;
    
    // Reset MathJax
    delete window.MathJax;
    
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
      window.MathJax = originalMathJax;
    } else {
      delete window.MathJax;
    }
    
    vi.restoreAllMocks();
  });

  describe('ensureMathJax', () => {
    it('returns existing MathJax if already loaded with typesetPromise', async () => {
      const mockMathJax = {
        typesetPromise: vi.fn().mockResolvedValue(undefined)
      };
      window.MathJax = mockMathJax;

      const result = await ensureMathJax();
      
      expect(result).toBe(mockMathJax);
    });

    it('returns undefined when window is undefined (SSR)', async () => {
      const originalWindow = global.window;
      delete global.window;
      
      try {
        const result = await ensureMathJax();
        expect(result).toBeUndefined();
      } finally {
        global.window = originalWindow;
      }
    });

    it('returns undefined if MathJax exists but without typesetPromise', async () => {
      window.MathJax = { someOtherProp: true };
      
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
      const result = await localEnsureMathJax();
      expect(result).toBeUndefined();
    });

    it('returns undefined and logs error when dynamic import fails', async () => {
      delete window.MathJax;
      
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
      const result = await localEnsureMathJax();
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
      delete window.MathJax;
      
      // Reset modules and set up mock for dynamic import
      vi.resetModules();
      vi.doMock('mathjax/es5/tex-chtml.js', () => ({}));

      // Re-import to use the mocked module
      const module = await import('../src/utils/mathjax.ts');
      const localEnsureMathJax = module.ensureMathJax;

      try {
        await localEnsureMathJax();
      } catch {
        // Expected - module won't actually load
      }

      // MathJax config should have been set
      expect(window.MathJax).toBeDefined();
      expect(window.MathJax.tex).toBeDefined();
      expect(window.MathJax.tex.inlineMath).toEqual([['\\(', '\\)']]);
    });

    it('handles MathJax with typesetPromise and app root', async () => {
      const typesetPromiseMock = vi.fn().mockResolvedValue(undefined);
      window.MathJax = {
        typesetPromise: typesetPromiseMock
      };

      const mockAppRoot = document.createElement('div');
      mockAppRoot.id = 'app';
      vi.spyOn(document, 'getElementById').mockReturnValue(mockAppRoot);

      const result = await ensureMathJax();
      
      expect(result).toBe(window.MathJax);
    });

    it('handles typesetPromise errors silently', async () => {
      const typesetPromiseMock = vi.fn().mockRejectedValue(new Error('Typeset failed'));
      
      // Set up MathJax config first, then add typesetPromise after "loading"
      window.MathJax = {
        loader: { load: [] },
        chtml: { fontURL: 'test' },
        tex: { inlineMath: [['\\(', '\\)']] },
        typesetPromise: typesetPromiseMock
      };

      const mockAppRoot = document.createElement('div');
      mockAppRoot.id = 'app';
      vi.spyOn(document, 'getElementById').mockReturnValue(mockAppRoot);

      // Should not throw
      const result = await ensureMathJax();
      expect(result).toBeDefined();
    });
  });

  describe('MathJax configuration', () => {
    it('sets up renderActions for adding titles to math elements', async () => {
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      // Check that the config was set up
      expect((window.MathJax?.options?.renderActions as any)?.addMathTitles).toBeDefined();
      
      // Get the render action callback
      const renderAction = (window.MathJax!.options!.renderActions as any).addMathTitles;
      expect(Array.isArray(renderAction)).toBe(true);
      expect(renderAction[0]).toBe(200);
      expect(typeof renderAction[1]).toBe('function');
    });

    it('adds title attributes to math elements with known variables', async () => {
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      // Get the render action callback
      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

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
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

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

        expect(mockMi.getAttribute('title')).toBe(expectedTitles[varName]);
      }
    });

    it('does not add title for unknown variables', async () => {
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

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
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

      const mockDoc = {
        math: [{ typesetRoot: null }, { typesetRoot: undefined }]
      };

      // Should not throw
      expect(() => addTitlesCallback(mockDoc)).not.toThrow();
    });

    it('handles mi elements without text content', async () => {
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

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
      delete window.MathJax;

      try {
        await ensureMathJax();
      } catch {
        // Expected
      }

      const addTitlesCallback = (window.MathJax!.options!.renderActions as any).addMathTitles[1];

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

