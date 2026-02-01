// Buttered Toast Landing Calculator view - full version with formula display

import templateHtml from '@views/templates/buttered-toast-calculator.html?raw';
import { SOCIAL_IMAGE_TOAST, SITE_NAME } from '@utils/constants.js';
import { ensureMathJax } from '@utils/mathjax.js';
import { hydrateIcons } from '@utils/icons.js';
import { updateMetaDescription } from '@utils/dom.js';
import { renderInlineShareButtonsHTML, initInlineShareButtons } from '@components/social-share.js';

export function ButteredToastCalculator() {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  if (typeof document !== 'undefined') {
    // Update page title
    document.title = `Buttered Toast Landing Calculator | ${SITE_NAME}`;
    
    // Update meta description for SEO
    updateMetaDescription("Will your toast land butter-side down? Calculate the probability based on height, gravity, overhang, butter factor, and more. Based on real physics!");
    
    const head = document.head;
    const ogImage = head.querySelector('meta[property="og:image"]');
    const twitterImage = head.querySelector('meta[property="twitter:image"]');
    if (ogImage) ogImage.setAttribute('content', SOCIAL_IMAGE_TOAST);
    if (twitterImage) twitterImage.setAttribute('content', SOCIAL_IMAGE_TOAST);
  }

  // Wire up interactions
  const sliders = {
    height: el.querySelector('#toast-height'),
    gravity: el.querySelector('#toast-gravity'),
    overhang: el.querySelector('#toast-overhang'),
    butter: el.querySelector('#toast-butter'),
    friction: el.querySelector('#toast-friction'),
    inertia: el.querySelector('#toast-inertia'),
  };

  const sliderValues = {
    height: el.querySelector('#toast-height-value'),
    gravity: el.querySelector('#toast-gravity-value'),
    overhang: el.querySelector('#toast-overhang-value'),
    butter: el.querySelector('#toast-butter-value'),
    friction: el.querySelector('#toast-friction-value'),
    inertia: el.querySelector('#toast-inertia-value'),
  };

  const probabilityDisplay = el.querySelector('#toast-probability-value');
  const interpretationDisplay = el.querySelector('#toast-interpretation');
  const resultDisplay = el.querySelector('#toast-result-display');
  const formulaDisplay = el.querySelector('#toast-formula-display');

  // Track which variables should show values (temporarily after slider change)
  const showValues = { H: false, g: false, O: false, B: false, F: false, T: false };
  let resetTimeouts = { H: null, g: null, O: null, B: null, F: null, T: null };

  function updateFormula() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

    // Generate LaTeX formula - show variable name or value based on showValues
    const hDisplay = showValues.H ? H : 'H';
    const gDisplay = showValues.g ? g : 'g';
    const oDisplay = showValues.O ? O : 'O';
    const bDisplay = showValues.B ? B.toFixed(2) : 'B';
    const fDisplay = showValues.F ? F : 'F';
    const tDisplay = showValues.T ? T : 'T';

    const formula = `\\(P_{\\text{butter-down}} = \\left(1 - \\left| \\left( \\frac{30 \\sqrt{\\frac{${hDisplay}}{${gDisplay}}} \\cdot ${oDisplay} \\cdot ${bDisplay}}{${tDisplay} + ${fDisplay}} \\bmod{1} \\right) - 0.5 \\right| \\cdot 2 \\right) \\cdot 100\\% \\)`;

    if (formulaDisplay) {
      formulaDisplay.textContent = formula;
      // Tell MathJax to re-render this element after the browser updates the DOM
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        // Capture MathJax reference to avoid race conditions in test environments
        const mathJax = window.MathJax;
        requestAnimationFrame(() => {
          // Defensive check: MathJax might become undefined in test environments
          if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
            return;
          }

          mathJax.typesetPromise([formulaDisplay]).then(() => {
            // Add title attributes to variables after MathJax renders
            const titles = {
              'H': 'Height of Fall (30-200 cm)',
              'g': 'Gravity (162-2479 cm/s²)',
              'O': 'Initial Overhang / Push (1-20 cm)',
              'B': 'Butter Factor (1.0-2.0)',
              'F': 'Air Friction / Drag (0-100)',
              'T': 'Toast Inertia (250-500)',
              'P': 'Probability of Butter-Side Down'
            };

            const variables = formulaDisplay.querySelectorAll('mjx-mi');

            variables.forEach((mi) => {
              // MathJax CHTML uses Unicode in class names (e.g., mjx-c1D443 = U+1D443 = Italic P)
              // Map Unicode Math Italic characters to regular letters
              const unicodeMap = {
                '1D443': 'P', // 𝑃
                '1D43B': 'H', // 𝐸
                '1D434': 'A', // 𝐴 (not used but included)
                '1D435': 'B', // 𝐵
                '1D43F': 'F', // 𝐹
                '1D447': 'T', // 𝑇
                '1D442': 'O', // 𝑂
                '1D454': 'g'  // 𝑔
              };

              // Get the first mjx-c child to identify the variable
              const mjxC = mi.querySelector('mjx-c');
              if (mjxC) {
                const classMatch = mjxC.className.match(/mjx-c([0-9A-F]+)/);
                if (classMatch) {
                  const unicodeHex = classMatch[1];
                  const letter = unicodeMap[unicodeHex];

                  if (letter && titles[letter]) {
                    mi.setAttribute('data-tooltip', titles[letter]);
                  }
                }
              }
            });
          }).catch(() => {
            // Silently handle MathJax errors
          });
        });
      }
    }
  }

  function flashAllVariables() {
    // Show all values temporarily
    Object.keys(showValues).forEach(v => showValues[v] = true);
    updateFormula();

    // Clear existing timeouts
    Object.values(resetTimeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    // Reset all back to variable names after 2 seconds
    const timeout = setTimeout(() => {
      Object.keys(showValues).forEach(v => showValues[v] = false);
      updateFormula();
    }, 2000);

    // Store timeout for all variables
    Object.keys(resetTimeouts).forEach(v => resetTimeouts[v] = timeout);
  }

  function calculateLanding() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

    // Update display values
    sliderValues.height.textContent = `${H} cm`;
    sliderValues.gravity.textContent = `${g} cm/s²`;
    sliderValues.overhang.textContent = `${O} cm`;
    sliderValues.butter.textContent = `${B.toFixed(2)}`;
    sliderValues.friction.textContent = `${F}`;
    sliderValues.inertia.textContent = `${T}`;

    // Calculate rotation factor
    const totalRotationFactor = (30 * Math.sqrt(H / g) * O * B) / (T + F);
    const landingOrientation = totalRotationFactor % 1;
    const probability = (1 - Math.abs(landingOrientation - 0.5) * 2) * 100;
    const finalProbability = Math.max(0, probability);

    if (probabilityDisplay) probabilityDisplay.textContent = `${Math.round(finalProbability)}%`;
    updateInterpretation(finalProbability);
  }

  function updateInterpretation(probability) {
    let interpretation = '';
    let cls = 'calc-ok';

    if (probability > 85) {
      cls = 'calc-dark';
      interpretation = "Catastrophe is imminent! Prepare for cleaning.";
    } else if (probability > 60) {
      cls = 'calc-danger';
      interpretation = "You're in the butter zone. High risk of a mess.";
    } else if (probability > 25) {
      cls = 'calc-orange';
      interpretation = "It's a toss-up. May the odds be ever in your favor.";
    } else {
      cls = 'calc-ok';
      interpretation = "Looking good! Toast should land safely.";
    }

    if (interpretationDisplay) interpretationDisplay.textContent = interpretation;
    if (resultDisplay) {
      resultDisplay.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      resultDisplay.classList.add(cls);
    }
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      const val = sliders[k].value;
      
      // Update ARIA attributes
      sliders[k].setAttribute('aria-valuenow', val);
      
      // Set descriptive value text with units
      let valueText = val;
      if (k === 'height' || k === 'overhang') valueText += ' cm';
      else if (k === 'gravity') valueText += ' cm/s²';
      else if (k === 'butter') valueText = parseFloat(val).toFixed(2);
      
      sliders[k].setAttribute('aria-valuetext', valueText);

      flashAllVariables();
      calculateLanding();
    });
  });

  // Initialize calculation on load
  calculateLanding();

  // Initialize formula after MathJax is loaded
  ensureMathJax()
    .then(() => {
      updateFormula();
    })
    .catch(() => {
      // MathJax load failed, show formula without rendering
      updateFormula();
    });

  // State for sharing
  const state = {
    height: parseFloat(sliders.height.value),
    gravity: parseFloat(sliders.gravity.value),
    overhang: parseFloat(sliders.overhang.value),
    butter: parseFloat(sliders.butter.value),
    friction: parseFloat(sliders.friction.value),
    inertia: parseFloat(sliders.inertia.value),
    probability: probabilityDisplay?.textContent || '0%',
    interpretation: interpretationDisplay?.textContent || ''
  };

  function updateState() {
    state.height = parseFloat(sliders.height.value);
    state.gravity = parseFloat(sliders.gravity.value);
    state.overhang = parseFloat(sliders.overhang.value);
    state.butter = parseFloat(sliders.butter.value);
    state.friction = parseFloat(sliders.friction.value);
    state.inertia = parseFloat(sliders.inertia.value);
    state.probability = probabilityDisplay?.textContent || '0%';
    state.interpretation = interpretationDisplay?.textContent || '';
  }

  // Generate shareable URL with parameters
  function getShareableUrl() {
    updateState();
    const url = new URL(window.location.href);
    url.searchParams.set('h', state.height);
    url.searchParams.set('g', state.gravity);
    url.searchParams.set('o', state.overhang);
    url.searchParams.set('b', state.butter);
    url.searchParams.set('f', state.friction);
    url.searchParams.set('t', state.inertia);
    return url.toString();
  }

  // Generate share text for social platforms
  function getShareText() {
    updateState();
    return `My Buttered Toast has a ${state.probability} chance of landing butter-side down! ${state.interpretation}`;
  }

  // Load parameters from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const paramKeys = { h: 'height', g: 'gravity', o: 'overhang', b: 'butter', f: 'friction', t: 'inertia' };
  
  Object.entries(paramKeys).forEach(([param, slider]) => {
    const value = urlParams.get(param);
    if (value && sliders[slider]) {
      const numValue = parseFloat(value);
      const min = parseFloat(sliders[slider].min);
      const max = parseFloat(sliders[slider].max);
      if (numValue >= min && numValue <= max) {
        sliders[slider].value = numValue;
      }
    }
  });

  // Recalculate if URL params were loaded
  if (urlParams.has('h') || urlParams.has('g') || urlParams.has('o') || urlParams.has('b') || urlParams.has('f') || urlParams.has('t')) {
    calculateLanding();
    updateFormula();
  }

  // Render inline share buttons
  const shareContainer = el.querySelector('#calculator-share-container');
  if (shareContainer) {
    shareContainer.innerHTML = renderInlineShareButtonsHTML();
    hydrateIcons(shareContainer);
  }

  // Initialize inline share buttons
  const teardownShare = initInlineShareButtons(el, {
    getShareableUrl,
    getShareText,
    emailSubject: 'Check out my Buttered Toast calculation'
  });

  el._teardownShare = teardownShare;

  return el;
}
