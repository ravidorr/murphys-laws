let loaderPromise;

const MATHJAX_FONT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/output/chtml/fonts/woff-v2';

function configureMathJax() {
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
        throw error;
      }

      const mj = window.MathJax;
      const appRoot = document.getElementById('app');
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

