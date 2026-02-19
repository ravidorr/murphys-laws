// Simple Buttered Toast Landing Calculator component for home page
import templateHtml from '@components/templates/buttered-toast-calculator-simple.html?raw';
import { hydrateIcons } from '@utils/icons.ts';
import type { OnNavigate } from '../types/app.d.ts';

type ToastSimpleSliderKey = 'height' | 'overhang';

export function ButteredToastCalculatorSimple({ onNavigate }: { onNavigate: OnNavigate }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  // Wire up interactions
  const _sliders: Record<ToastSimpleSliderKey, HTMLInputElement | null> = {
    height: el.querySelector<HTMLInputElement>('#toast-height-simple'),
    overhang: el.querySelector<HTMLInputElement>('#toast-overhang-simple'),
  };

  // Verify all sliders exist
  for (const [name, slider] of Object.entries(_sliders)) {
    if (!slider) throw new Error(`Calculator slider "${name}" not found`);
  }
  const sliders = _sliders as Record<ToastSimpleSliderKey, HTMLInputElement>;

  const sliderValues = {
    height: el.querySelector('#toast-height-simple-value'),
    overhang: el.querySelector('#toast-overhang-simple-value'),
  };

  const probabilityDisplay = el.querySelector('#toast-probability-simple');
  const interpretationDisplay = el.querySelector('#toast-interpretation-simple');

  // Constants
  const GRAVITY = 980; // cm/s²
  const BUTTER_FACTOR = 1.2;
  const AIR_FRICTION = 20;
  const TOAST_INERTIA = 250;

  function updateDisplayValues() {
    if (sliderValues.height) sliderValues.height.textContent = `${sliders.height.value} cm`;
    if (sliderValues.overhang) sliderValues.overhang.textContent = `${sliders.overhang.value} cm`;
  }

  function calculateLanding() {
    const H = parseFloat(sliders.height.value);
    const g = GRAVITY;
    const O = parseFloat(sliders.overhang.value);
    const B = BUTTER_FACTOR;
    const F = AIR_FRICTION;
    const T = TOAST_INERTIA;

    // Calculate rotation factor
    const totalRotationFactor = (30 * Math.sqrt(H / g) * O * B) / (T + F);
    const landingOrientation = totalRotationFactor % 1;
    const probability = (1 - Math.abs(landingOrientation - 0.5) * 2) * 100;
    const finalProbability = Math.max(0, probability);

    if (probabilityDisplay) probabilityDisplay.textContent = `${Math.round(finalProbability)}%`;
    updateInterpretation(finalProbability);
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

    if (interpretationDisplay) interpretationDisplay.textContent = interpretation;

    const scoreSection = el.querySelector('.sod-simple-score');
    if (scoreSection) {
      scoreSection.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      scoreSection.classList.add(cls);
    }
  }

  (Object.keys(sliders) as ToastSimpleSliderKey[]).forEach((k) => {
    if (!sliders[k]) return;

    // Initial setup
    const initialVal = sliders[k].value;
    sliders[k].setAttribute('aria-valuenow', initialVal);
    sliders[k].setAttribute('aria-valuetext', `${initialVal} cm`);
    const descId = k === 'height' ? 'toast-height-simple-value' : 'toast-overhang-simple-value';
    sliders[k].setAttribute('aria-describedby', descId);

    sliders[k].addEventListener('input', () => {
      const val = sliders[k].value;
      updateDisplayValues();

      // Update ARIA attributes
      sliders[k].setAttribute('aria-valuenow', val);
      sliders[k].setAttribute('aria-valuetext', `${val} cm`);

      calculateLanding();
    });
  });

  // Calculate initial values
  updateDisplayValues();
  calculateLanding();

  // Navigation
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const navElement = t.closest('[data-nav]');
    if (navElement) {
      const nav = (navElement as HTMLElement).dataset.nav;
      if (nav) onNavigate(nav);
    }
  });

  return el;
}
