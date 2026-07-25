// Buttered Toast Landing Calculator view - full version with formula display

import templateHtml from '@views/templates/buttered-toast-calculator.html?raw';
import { SOCIAL_IMAGE_TOAST, SITE_NAME } from '@utils/constants.ts';
import { renderToastFormula } from '@utils/mathjax.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { updatePageMetadata } from '@utils/dom.ts';
import { setExportContent, clearExportContent, ContentType } from '@utils/export-context.ts';
import { renderInlineShareButtonsHTML, initInlineShareButtons } from '@components/social-share.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import { parseCalculatorState, serializeCalculatorState } from '@utils/calculator-state.ts';
import { getCalculatorScenarioLinks, renderInternalLinkList } from '@utils/internal-links.ts';
import type { CleanableElement } from '../types/app.d.ts';

type ToastSliderKey = 'height' | 'gravity' | 'overhang' | 'butter' | 'friction' | 'inertia';

export function ButteredToastCalculator(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page calculator';
  let hasTrackedStart = false;

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  /* v8 ignore next -- SSR guard: document is always defined in browser/jsdom */
  if (typeof document !== 'undefined') {
    updatePageMetadata({
      title: `Buttered Toast Landing Calculator | ${SITE_NAME}`,
      description: 'Explore a playful toast-landing simulation using height, overhang, butter, friction, and inertia. For entertainment only.',
      path: '/calculator/buttered-toast',
      image: SOCIAL_IMAGE_TOAST
    });
  }

  // Wire up interactions
  const _sliders: Record<ToastSliderKey, HTMLInputElement | null> = {
    height: el.querySelector<HTMLInputElement>('#toast-height'),
    gravity: el.querySelector<HTMLInputElement>('#toast-gravity'),
    overhang: el.querySelector<HTMLInputElement>('#toast-overhang'),
    butter: el.querySelector<HTMLInputElement>('#toast-butter'),
    friction: el.querySelector<HTMLInputElement>('#toast-friction'),
    inertia: el.querySelector<HTMLInputElement>('#toast-inertia'),
  };

  // Verify all sliders exist
  for (const [name, slider] of Object.entries(_sliders)) {
    /* v8 ignore next -- slider is always provided by the template HTML */
    if (!slider) throw new Error(`Calculator slider "${name}" not found`);
  }
  const sliders = _sliders as Record<ToastSliderKey, HTMLInputElement>;

  const sliderValues = {
    height: el.querySelector('#toast-height-value')!,
    gravity: el.querySelector('#toast-gravity-value')!,
    overhang: el.querySelector('#toast-overhang-value')!,
    butter: el.querySelector('#toast-butter-value')!,
    friction: el.querySelector('#toast-friction-value')!,
    inertia: el.querySelector('#toast-inertia-value')!,
  };

  const probabilityDisplay = el.querySelector('#toast-probability-value')!;
  const interpretationDisplay = el.querySelector('#toast-interpretation')!;
  const resultDisplay = el.querySelector('#toast-result-display')!;
  const formulaDisplay = el.querySelector('#toast-formula-display')!;

  // Track which variables should show values (temporarily after slider change)
  type FormulaVarKey = 'H' | 'g' | 'O' | 'B' | 'F' | 'T';
  const showValues: Record<FormulaVarKey, boolean> = { H: false, g: false, O: false, B: false, F: false, T: false };
  let resetTimeouts: Record<FormulaVarKey, ReturnType<typeof setTimeout> | null> = { H: null, g: null, O: null, B: null, F: null, T: null };

  function clearFormulaTimeouts() {
    new Set(Object.values(resetTimeouts)).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    resetTimeouts = { H: null, g: null, O: null, B: null, F: null, T: null };
  }

  function updateFormula() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

    const hDisplay = showValues.H ? H : 'H';
    const gDisplay = showValues.g ? g : 'g';
    const oDisplay = showValues.O ? O : 'O';
    const bDisplay = showValues.B ? B.toFixed(2) : 'B';
    const fDisplay = showValues.F ? F : 'F';
    const tDisplay = showValues.T ? T : 'T';

    renderToastFormula(formulaDisplay, {
      height: hDisplay,
      gravity: gDisplay,
      overhang: oDisplay,
      butter: bDisplay,
      friction: fDisplay,
      inertia: tDisplay,
    });
  }

  function flashAllVariables() {
    // Show all values temporarily
    (Object.keys(showValues) as FormulaVarKey[]).forEach(v => showValues[v] = true);
    updateFormula();

    // Clear existing timeouts
    clearFormulaTimeouts();

    // Reset all back to variable names after 2 seconds
    const timeout = setTimeout(() => {
      if (!el.isConnected) return;
      (Object.keys(showValues) as FormulaVarKey[]).forEach(v => showValues[v] = false);
      updateFormula();
    }, 2000);

    // Store timeout for all variables
    (Object.keys(resetTimeouts) as FormulaVarKey[]).forEach(v => resetTimeouts[v] = timeout);
  }

  function calculateLanding() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

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

    probabilityDisplay.textContent = `${Math.round(finalProbability)}%`;
    updateInterpretation(finalProbability);

    const interpretation = interpretationDisplay.textContent || '';
    setExportContent({
      type: ContentType.CONTENT,
      title: 'Buttered Toast Landing Calculator',
      data: `Probability butter-side down: ${Math.round(finalProbability)}%. ${interpretation}`
    });
  }

  function updateInterpretation(probability: number) {
    let interpretation: string;
    let cls: string;

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

    interpretationDisplay.textContent = interpretation;
    resultDisplay.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
    resultDisplay.classList.add(cls);
  }

  (Object.keys(sliders) as ToastSliderKey[]).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      if (!hasTrackedStart) {
        hasTrackedStart = true;
        trackProductEvent('calculator.start', { surface: 'calculator_page', calculator: 'buttered-toast' });
      }
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
      trackProductEvent('calculator.complete', { surface: 'calculator_page', calculator: 'buttered-toast' });
    });
  });

  // Initialize calculation on load
  calculateLanding();
  updateFormula();

  // State for sharing
  const state = {
    height: parseFloat(sliders.height.value),
    gravity: parseFloat(sliders.gravity.value),
    overhang: parseFloat(sliders.overhang.value),
    butter: parseFloat(sliders.butter.value),
    friction: parseFloat(sliders.friction.value),
    inertia: parseFloat(sliders.inertia.value),
    /* v8 ignore next -- textContent is always set by calculateLanding() before this runs */
    probability: probabilityDisplay.textContent || '0%',
    /* v8 ignore next -- textContent is always set by calculateLanding() before this runs */
    interpretation: interpretationDisplay.textContent || ''
  };

  function updateState() {
    state.height = parseFloat(sliders.height.value);
    state.gravity = parseFloat(sliders.gravity.value);
    state.overhang = parseFloat(sliders.overhang.value);
    state.butter = parseFloat(sliders.butter.value);
    state.friction = parseFloat(sliders.friction.value);
    state.inertia = parseFloat(sliders.inertia.value);
    /* v8 ignore next -- textContent is always set by calculateLanding() before this runs */
    state.probability = probabilityDisplay.textContent || '0%';
    /* v8 ignore next -- textContent is always set by calculateLanding() before this runs */
    state.interpretation = interpretationDisplay.textContent || '';
  }

  // Generate shareable URL with parameters
  function getShareableUrl() {
    updateState();
    return serializeCalculatorState(window.location.href, {
      h: state.height,
      g: state.gravity,
      o: state.overhang,
      b: state.butter,
      f: state.friction,
      t: state.inertia,
    });
  }

  // Generate share text for social platforms
  function getShareText() {
    updateState();
    return `My Buttered Toast has a ${state.probability} chance of landing butter-side down! ${state.interpretation}`;
  }

  // Load parameters from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const paramKeys: Record<string, ToastSliderKey> = { h: 'height', g: 'gravity', o: 'overhang', b: 'butter', f: 'friction', t: 'inertia' };
  const parsedState = parseCalculatorState(urlParams, Object.fromEntries(
    Object.entries(paramKeys).map(([param, slider]) => [
      param,
      { min: Number(sliders[slider].min), max: Number(sliders[slider].max) }
    ])
  ));

  Object.entries(parsedState).forEach(([param, value]) => {
    const slider = paramKeys[param];
    if (slider) {
      sliders[slider].value = String(value);
    }
  });

  // Recalculate if URL params were loaded
  if (urlParams.has('h') || urlParams.has('g') || urlParams.has('o') || urlParams.has('b') || urlParams.has('f') || urlParams.has('t')) {
    calculateLanding();
    updateFormula();
  }

  const scenarioLinks = el.querySelector('[data-calculator-scenario-links]');
  if (scenarioLinks) {
    scenarioLinks.innerHTML = renderInternalLinkList(getCalculatorScenarioLinks('buttered-toast'));
  }

  const shareContainer = el.querySelector('#calculator-share-container')!;
  shareContainer.innerHTML = renderInlineShareButtonsHTML();
  hydrateIcons(shareContainer);

  // Initialize inline share buttons
  const teardownShare = initInlineShareButtons(el, {
    getShareableUrl,
    getShareText,
    emailSubject: 'Check out my Buttered Toast calculation'
  });

  (el as CleanableElement).cleanup = () => {
    clearFormulaTimeouts();
    clearExportContent();
    teardownShare();
  };

  return el;
}
