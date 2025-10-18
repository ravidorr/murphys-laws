 
// Sod's Law Calculator view integrated with site styles (no inline CSS in HTML)
// Reuses the original formula and interaction, scoped under .calc- classes

import templateHtml from '@views/templates/sods-calculator.html?raw';
import { SOCIAL_IMAGE_SOD } from '@utils/constants.js';
import { initShareCalculation } from '@modules/sods-share.js';

export function Calculator() {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = templateHtml;

  if (typeof document !== 'undefined') {
    const head = document.head;
    const ogImage = head.querySelector('meta[property="og:image"]');
    const twitterImage = head.querySelector('meta[property="twitter:image"]');
    if (ogImage) ogImage.setAttribute('content', SOCIAL_IMAGE_SOD);
    if (twitterImage) twitterImage.setAttribute('content', SOCIAL_IMAGE_SOD);
  }

  // Wire up interactions
  const sliders = {
    urgency: el.querySelector('#urgency'),
    complexity: el.querySelector('#complexity'),
    importance: el.querySelector('#importance'),
    skill: el.querySelector('#skill'),
    frequency: el.querySelector('#frequency'),
  };
  const sliderValues = {
    urgency: el.querySelector('#urgency-value'),
    complexity: el.querySelector('#complexity-value'),
    importance: el.querySelector('#importance-value'),
    skill: el.querySelector('#skill-value'),
    frequency: el.querySelector('#frequency-value'),
  };

  const scoreValueDisplay = el.querySelector('#score-value');
  const scoreInterpretationDisplay = el.querySelector('#score-interpretation');
  const resultDisplay = el.querySelector('#result-display');
  const formulaDisplay = el.querySelector('#formula-display');

  // Track which variables should show values (temporarily after slider change)
  const showValues = { U: false, C: false, I: false, S: false, F: false };
  let resetTimeouts = { U: null, C: null, I: null, S: null, F: null };

  function updateFormula() {
    const U = parseFloat(sliders.urgency.value);
    const C = parseFloat(sliders.complexity.value);
    const I = parseFloat(sliders.importance.value);
    const S = parseFloat(sliders.skill.value);
    const F = parseFloat(sliders.frequency.value);
    const A = 0.7;

    // Calculate P value
    const P = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));
    const PDisplay = Math.min(P, 8.6).toFixed(2);

    // Generate LaTeX formula - show variable name or value based on showValues
    const pFormula = showValues.U ? PDisplay : 'P';
    const uDisplay = showValues.U ? U : 'U';
    const cDisplay = showValues.C ? C : 'C';
    const iDisplay = showValues.I ? I : 'I';
    const sDisplay = showValues.S ? S : 'S';
    const fDisplay = showValues.F ? F : 'F';
    const aDisplay = showValues.U ? '0.7' : 'A'; // Show 0.7 when flashing

    const formula = `\\(${pFormula}=\\frac{((${uDisplay}+${cDisplay}+${iDisplay})\\times (10-${sDisplay}))}{20}\\times ${aDisplay}\\times \\frac{1}{(1-\\sin (\\frac{${fDisplay}}{10}))}\\)`;

    if (formulaDisplay) {
      formulaDisplay.textContent = formula;
      // Tell MathJax to re-render this element
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([formulaDisplay]).then(() => {
          // Add title attributes to variables after MathJax renders
          const titles = {
            'U': 'Urgency (1-9)',
            'C': 'Complexity (1-9)',
            'I': 'Importance (1-9)',
            'S': 'Skill (1-9)',
            'F': 'Frequency (1-9)',
            'A': 'Activity constant (0.7)',
            'P': 'Probability'
          };

          const variables = formulaDisplay.querySelectorAll('mjx-mi');

          variables.forEach((mi) => {
            // MathJax CHTML uses Unicode in class names (e.g., mjx-c1D443 = U+1D443 = Italic P)
            // Map Unicode Math Italic characters to regular letters
            const unicodeMap = {
              '1D443': 'P', // 𝑃
              '1D448': 'U', // 𝑈
              '1D436': 'C', // 𝐶
              '1D43C': 'I', // 𝐼
              '1D446': 'S', // 𝑆
              '1D439': 'F', // 𝐹
              '1D434': 'A'  // 𝐴
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

  function calculateScore() {
    const U = parseFloat(sliders.urgency.value);
    const C = parseFloat(sliders.complexity.value);
    const I = parseFloat(sliders.importance.value);
    const S = parseFloat(sliders.skill.value);
    const F = parseFloat(sliders.frequency.value);
    const A = 0.7;

    const score = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));
    const displayScore = Math.min(score, 8.6);

    if (scoreValueDisplay) scoreValueDisplay.textContent = displayScore.toFixed(2);
    
    updateResultInterpretation(displayScore);
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      if (sliderValues[k]) sliderValues[k].textContent = sliders[k].value;
      flashAllVariables();
      calculateScore();
    });
  });

  // Initialize formula and score on load
  updateFormula();
  calculateScore();

  // If MathJax isn't loaded yet, poll for it and re-render when ready
  if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
    const pollMathJax = setInterval(() => {
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        clearInterval(pollMathJax);
        updateFormula();
      }
    }, 100); // Check every 100ms

    // Stop polling after 10 seconds
    setTimeout(() => clearInterval(pollMathJax), 10000);
  }

  function updateResultInterpretation(score) {
    let interpretation = '';
    let cls = 'calc-ok';

    if (score < 2) {
      interpretation = "You're probably safe. What could possibly go wrong?";
      cls = 'calc-ok';
    } else if (score < 4) {
      interpretation = 'A bit risky. Maybe have a backup plan.';
      cls = 'calc-warn';
    } else if (score < 6) {
      interpretation = 'Definitely worrying. Proceed with caution.';
      cls = 'calc-orange';
    } else if (score < 8) {
      interpretation = "Disaster is looming. It's not looking good.";
      cls = 'calc-danger';
    } else {
      interpretation = 'Catastrophe is almost certain. Good luck.';
      cls = 'calc-dark';
    }

    if (scoreInterpretationDisplay) scoreInterpretationDisplay.textContent = interpretation;
    if (resultDisplay) {
      resultDisplay.classList.remove('calc-ok','calc-warn','calc-orange','calc-danger','calc-dark');
      resultDisplay.classList.add(cls);
    }
  }

  const state = {
    urgency: parseFloat(sliders.urgency.value),
    complexity: parseFloat(sliders.complexity.value),
    importance: parseFloat(sliders.importance.value),
    skill: parseFloat(sliders.skill.value),
    frequency: parseFloat(sliders.frequency.value),
    probability: scoreValueDisplay?.textContent || '0.00',
    interpretation: scoreInterpretationDisplay?.textContent || ''
  };

  function updateState() {
    state.urgency = parseFloat(sliders.urgency.value);
    state.complexity = parseFloat(sliders.complexity.value);
    state.importance = parseFloat(sliders.importance.value);
    state.skill = parseFloat(sliders.skill.value);
    state.frequency = parseFloat(sliders.frequency.value);
    state.probability = scoreValueDisplay?.textContent || '0.00';
    state.interpretation = scoreInterpretationDisplay?.textContent || '';
  }

  const teardownShare = initShareCalculation({
    root: el,
    getCalculationState() {
      updateState();
      return { ...state };
    }
  });

  el._teardownShare = teardownShare;

  return el;
}
