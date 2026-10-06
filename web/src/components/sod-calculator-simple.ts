// Simple Sod's Law Calculator component
import templateHtml from '@components/templates/sod-calculator-simple.html?raw';
import { hydrateIcons } from '@utils/icons.ts';
import { trackPendoEvent } from '@utils/pendo.ts';
import { createDebouncedTask } from '@utils/debounce.ts';
import { CALCULATOR_RISK_LEVELS, CALCULATOR_RESULT_SETTLE_MS, type CalculatorResultBand } from '@utils/calculator-state.ts';
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
    const U = parseFloat(sliders.urgency.value);
    const C = parseFloat(sliders.complexity.value);
    const I = parseFloat(sliders.importance.value);
    const S = parseFloat(sliders.skill.value);
    const F = parseFloat(sliders.frequency.value);
    const A = 0.7;

    const score = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));
    const displayScore = Math.min(score, 8.6);
    // Same 0-100% scale as the full calculator page, so results are comparable
    probabilityPercent = Math.round((displayScore / 8.6) * 100);

    // Template always provides score display
    scoreDisplay!.textContent = displayScore.toFixed(2);
    updateInterpretation(displayScore);
  }

  function updateInterpretation(score: number) {
    let interpretation: string;
    let cls: CalculatorResultBand;

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

    // Template always provides interpretation display
    interpretationDisplay!.textContent = interpretation;

    // Template always provides score section
    const scoreSection = el.querySelector('.sod-simple-score')!;
    scoreSection.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
    scoreSection.classList.add(cls);
    riskLevel = CALCULATOR_RISK_LEVELS[cls];
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

  (el as CleanableElement).cleanup = () => {
    calculatorUsed.flush();
  };

  return el;
}
