let loaderPromise;

const MATHJAX_FONT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/output/chtml/fonts/woff-v2';

function configureMathJax() {
  /* v8 ignore next 3 - SSR environment check */
  if (typeof window === 'undefined') {
    return;
  }

  window.MathJax = {
    loader: { load: [] },
    chtml: {
      fontURL: MATHJAX_FONT_URL,
    },
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      packages: { '[+]': ['html'] },
    },
    startup: { typeset: false },
    options: {
      enableMenu: false,
      enableAssistiveMml: false,
      a11y: { speech: false },
      renderActions: {
        addMathTitles: [
          200,
          (doc) => {
            for (const node of doc.math) {
              const element = node.typesetRoot;
              if (element) {
                element.querySelectorAll('mjx-mi').forEach((mi) => {
                  const text = mi.textContent?.trim();
                  const titles = {
                    U: 'Urgency (1-9)',
                    C: 'Complexity (1-9)',
                    I: 'Importance (1-9)',
                    S: 'Skill (1-9)',
                    F: 'Frequency (1-9)',
                    A: 'Activity constant (0.7)',
                  };
                  if (text && titles[text]) {
                    mi.setAttribute('title', titles[text]);
                  }
                });
              }
            }
          },
        ],
      },
    },
  };
}

export async function ensureMathJax() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    return window.MathJax;
  }

  if (!loaderPromise) {
    loaderPromise = (async () => {
      configureMathJax();

      try {
        await import('mathjax/es5/tex-chtml.js');
      } catch (error) {
        loaderPromise = undefined;
        // Module import failures are typically caused by:
        // - Stale service worker cache (old HTML references new chunks)
        // - Network connectivity issues  
        // - Mobile Safari ES module bugs
        // These are transient issues outside our control, so we don't report to Sentry.
        // MathJax is non-critical - pages still render without math formatting
        console.error('Failed to load MathJax:', error);
        return undefined;
      }

      const mj = window.MathJax;
      const appRoot = document.getElementById('app');
      /* v8 ignore next 5 - MathJax async initialization, tested via integration tests */
      if (mj && typeof mj.typesetPromise === 'function' && appRoot) {
        mj.typesetPromise([appRoot]).catch(() => {
          // Silently handle MathJax errors
        });
      }

      return mj;
    })();
  }

  return loaderPromise;
}

/**
 * Resets the MathJax loader state.
 * ONLY FOR TESTING PURPOSES.
 */
export function resetMathJaxStateForTesting() {
  loaderPromise = undefined;
}

/* v8 ignore start - HMR code only runs in Vite dev mode */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loaderPromise = undefined;

    if (typeof window !== 'undefined') {
      delete window.MathJax;
    }

    if (typeof document !== 'undefined') {
      document
        .querySelectorAll('style[data-mathjax],link[data-mathjax]')
        .forEach((el) => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
    }
  });
}
/* v8 ignore stop */