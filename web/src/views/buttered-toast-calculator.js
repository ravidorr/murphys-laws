// Buttered Toast Landing Calculator view - full version with formula display

import templateHtml from '@views/templates/buttered-toast-calculator.html?raw';
import { SOCIAL_IMAGE_TOAST } from '@utils/constants.js';
import { ensureMathJax } from '@utils/mathjax.js';
import { triggerAdSense } from '../utils/ads.js';

export function ButteredToastCalculator() {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = templateHtml;

  if (typeof document !== 'undefined') {
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
      interpretation = "Clean floors ahead! It's very likely to land safely.";
    }

    if (interpretationDisplay) interpretationDisplay.textContent = interpretation;
    if (resultDisplay) {
      resultDisplay.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      resultDisplay.classList.add(cls);
    }
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
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

  triggerAdSense();

  return el;
}
