// Simple Sod's Law Calculator component
import templateHtml from '@components/templates/sod-calculator-simple.html?raw';
import { hydrateIcons } from '@utils/icons.ts';
import { trackPendoEvent } from '@utils/pendo.ts';
import { createDebouncedTask } from '@utils/debounce.ts';
import { CALCULATOR_RISK_LEVELS, CALCULATOR_RESULT_SETTLE_MS } from '@utils/calculator-state.ts';
import { calculateSodsLaw } from '@utils/sods-law.ts';
import { registerSodsLawTool } from '@utils/webmcp-tools.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

type SliderKey = 'urgency' | 'complexity' | 'importance' | 'skill' | 'frequency';

export function SodCalculatorSimple({ onNavigate }: { onNavigate: OnNavigate }) {
  const el = document.createElement('section');
  el.className = 'section card card--section section-card mb-12';

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  // Wire up interactions
  const _sliders: Record<SliderKey, HTMLInputElement | null> = {
    urgency: el.querySelector<HTMLInputElement>('#urgency'),
    complexity: el.querySelector<HTMLInputElement>('#complexity'),
    importance: el.querySelector<HTMLInputElement>('#importance'),
    skill: el.querySelector<HTMLInputElement>('#skill'),
    frequency: el.querySelector<HTMLInputElement>('#frequency'),
  };

  // Template always contains these elements
  const sliders = _sliders as Record<SliderKey, HTMLInputElement>;

  const sliderValues = {
    urgency: el.querySelector('#urgency-value'),
    complexity: el.querySelector('#complexity-value'),
    importance: el.querySelector('#importance-value'),
    skill: el.querySelector('#skill-value'),
    frequency: el.querySelector('#frequency-value'),
  };

  const scoreDisplay = el.querySelector('#score-display');
  const interpretationDisplay = el.querySelector('#interpretation');

  // Latest result reported with calculator_used once the sliders settle
  let probabilityPercent = 0;
  let riskLevel = CALCULATOR_RISK_LEVELS['calc-ok'];
  let adjustmentCount = 0;
  const calculatorUsed = createDebouncedTask(() => {
    trackPendoEvent('calculator_used', {
      calculator: 'sods-law',
      surface: 'home_widget',
      probability_percent: probabilityPercent,
      risk_level: riskLevel,
      urgency: Number(sliders.urgency.value),
      complexity: Number(sliders.complexity.value),
      importance: Number(sliders.importance.value),
      skill: Number(sliders.skill.value),
      frequency: Number(sliders.frequency.value),
      from_shared_link: false,
      adjustment_count: adjustmentCount,
    });
  }, CALCULATOR_RESULT_SETTLE_MS);

  function calculateScore() {
    const result = calculateSodsLaw({
      urgency: parseFloat(sliders.urgency.value),
      complexity: parseFloat(sliders.complexity.value),
      importance: parseFloat(sliders.importance.value),
      skill: parseFloat(sliders.skill.value),
      frequency: parseFloat(sliders.frequency.value),
    });
    // Same 0-100% scale as the full calculator page, so results are comparable
    probabilityPercent = result.probabilityPercent;
    riskLevel = result.riskLevel;

    // Template always provides score display, interpretation display and score section
    scoreDisplay!.textContent = result.score.toFixed(2);
    interpretationDisplay!.textContent = result.interpretation;
    const scoreSection = el.querySelector('.sod-simple-score')!;
    scoreSection.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
    scoreSection.classList.add(result.band);
  }

  (Object.keys(sliders) as SliderKey[]).forEach((k) => {
    // Sliders always present (template)
    const slider = sliders[k]!;
    slider.setAttribute('aria-valuenow', slider.value);
    slider.setAttribute('aria-valuetext', slider.value);
    slider.setAttribute('aria-describedby', `${k}-value`);

    slider.addEventListener('input', () => {
      const val = slider.value;
      // Template always has value elements
      (sliderValues[k] as HTMLElement)!.textContent = val;

      slider.setAttribute('aria-valuenow', val);
      slider.setAttribute('aria-valuetext', val);

      calculateScore();
      adjustmentCount++;
      calculatorUsed.schedule();
    });
  });

  // Calculate initial score
  calculateScore();

  // Navigation
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Check if clicked element or any parent has data-nav
    const navElement = t.closest('[data-nav]');
    if (navElement) {
      const nav = (navElement as HTMLElement).dataset.nav!; // data-nav always has value in template
      onNavigate(nav);
    }
  });

  const unregisterTool = registerSodsLawTool();

  (el as CleanableElement).cleanup = () => {
    calculatorUsed.flush();
    unregisterTool();
  };

  return el;
}
