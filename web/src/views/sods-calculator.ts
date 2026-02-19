
// Sod's Law Calculator view integrated with site styles (no inline CSS in HTML)
// Reuses the original formula and interaction, scoped under .calc- classes

import templateHtml from '@views/templates/sods-calculator.html?raw';
import { SOCIAL_IMAGE_SOD, SITE_NAME } from '@utils/constants.ts';
import { ensureMathJax } from '@utils/mathjax.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import { renderInlineShareButtonsHTML, initInlineShareButtons } from '@components/social-share.ts';
import type { CleanableElement } from '../types/app.d.ts';

type SliderKey = 'urgency' | 'complexity' | 'importance' | 'skill' | 'frequency';

export function Calculator(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  if (typeof document !== 'undefined') {
    // Update page title
    document.title = `Sod's Law Calculator | ${SITE_NAME}`;
    
    // Update meta description for SEO
    updateMetaDescription("Calculate the probability of Murphy's Law striking your task. Adjust urgency, complexity, importance, skill, and frequency to see your odds of things going wrong.");
    
    const head = document.head;
    const ogImage = head.querySelector('meta[property="og:image"]');
    const twitterImage = head.querySelector('meta[property="twitter:image"]');
    if (ogImage) ogImage.setAttribute('content', SOCIAL_IMAGE_SOD);
    if (twitterImage) twitterImage.setAttribute('content', SOCIAL_IMAGE_SOD);
  }

  // Wire up interactions
  const sliders: Record<SliderKey, HTMLInputElement | null> = {
    urgency: el.querySelector<HTMLInputElement>('#urgency'),
    complexity: el.querySelector<HTMLInputElement>('#complexity'),
    importance: el.querySelector<HTMLInputElement>('#importance'),
    skill: el.querySelector<HTMLInputElement>('#skill'),
    frequency: el.querySelector<HTMLInputElement>('#frequency'),
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

  function updateCalculation() {
    const U = parseFloat(sliders.urgency.value);
    const C = parseFloat(sliders.complexity.value);
    const I = parseFloat(sliders.importance.value);
    const S = parseFloat(sliders.skill.value);
    const F = parseFloat(sliders.frequency.value);
    const A = 0.7;

    // Calculate score
    const score = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));
    const displayScore = Math.min(score, 8.6);
    const scoreText = displayScore.toFixed(2);

    // Update score display
    if (scoreValueDisplay) scoreValueDisplay.textContent = scoreText;
    updateResultInterpretation(displayScore);

    // Generate LaTeX formula - show variable name or value based on showValues
    const pFormula = showValues.U ? scoreText : 'P';
    const uDisplay = showValues.U ? U : 'U';
    const cDisplay = showValues.C ? C : 'C';
    const iDisplay = showValues.I ? I : 'I';
    const sDisplay = showValues.S ? S : 'S';
    const fDisplay = showValues.F ? F : 'F';
    const aDisplay = showValues.U ? '0.7' : 'A'; // Show 0.7 when flashing

    const formula = `\\(${pFormula}=\\frac{((${uDisplay}+${cDisplay}+${iDisplay})\\times (10-${sDisplay}))}{20}\\times ${aDisplay}\\times \\frac{1}{(1-\\sin (\\frac{${fDisplay}}{10}))}\\)`;

    if (formulaDisplay) {
      formulaDisplay.textContent = formula;
      // Tell MathJax to re-render this element after the browser updates the DOM
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        // Capture MathJax reference to avoid race conditions in test environments
        const mathJax = window.MathJax;
        requestAnimationFrame(() => {
          /* v8 ignore next 3 - MathJax defensive check for race conditions */
          if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
            return;
          }

          mathJax.typesetPromise([formulaDisplay as HTMLElement]).then(() => {
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
        });
      }
    }
  }

  function flashAllVariables() {
    // Show all values temporarily
    Object.keys(showValues).forEach(v => showValues[v] = true);
    updateCalculation();

    // Clear existing timeouts
    Object.values(resetTimeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    // Reset all back to variable names after 2 seconds
    const timeout = setTimeout(() => {
      Object.keys(showValues).forEach(v => showValues[v] = false);
      updateCalculation();
    }, 2000);

    // Store timeout for all variables
    Object.keys(resetTimeouts).forEach(v => resetTimeouts[v] = timeout);
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      const val = sliders[k].value;
      if (sliderValues[k]) sliderValues[k].textContent = val;
      
      // Update ARIA attributes
      sliders[k].setAttribute('aria-valuenow', val);
      sliders[k].setAttribute('aria-valuetext', val);
      
      flashAllVariables();
    });
  });

  // Initialize formula and score after MathJax is loaded
  ensureMathJax()
    .then(() => {
      updateCalculation();
    })
    .catch(() => {
      // MathJax load failed, show formula without rendering
      updateCalculation();
    });

  function updateResultInterpretation(score: number) {
    let interpretation: string;
    let cls: string;

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
      resultDisplay.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
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

  // Generate shareable URL with parameters
  function getShareableUrl() {
    updateState();
    const url = new URL(window.location.href);
    url.searchParams.set('u', String(state.urgency));
    url.searchParams.set('c', String(state.complexity));
    url.searchParams.set('i', String(state.importance));
    url.searchParams.set('s', String(state.skill));
    url.searchParams.set('f', String(state.frequency));
    return url.toString();
  }

  // Generate share text for social platforms
  function getShareText() {
    updateState();
    return `My Sod's Law score is ${state.probability}! ${state.interpretation}`;
  }

  // Load parameters from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const paramKeys = { u: 'urgency', c: 'complexity', i: 'importance', s: 'skill', f: 'frequency' };
  
  Object.entries(paramKeys).forEach(([param, slider]) => {
    const value = urlParams.get(param);
    if (value && sliders[slider]) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 9) {
        sliders[slider].value = numValue;
        if (sliderValues[slider]) {
          sliderValues[slider].textContent = String(numValue);
        }
      }
    }
  });

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
    emailSubject: "Check out my Sod's Law calculation"
  });

  (el as CleanableElement).cleanup = teardownShare;

  return el;
}
