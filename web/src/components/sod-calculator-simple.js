// Simple Sod's Law Calculator component
import templateHtml from '@components/templates/sod-calculator-simple.html?raw';
import { hydrateIcons } from '@utils/icons.js';

export function SodCalculatorSimple({ onNavigate }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

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

  const scoreDisplay = el.querySelector('#score-display');
  const interpretationDisplay = el.querySelector('#interpretation');

  function calculateScore() {
    const U = parseFloat(sliders.urgency.value);
    const C = parseFloat(sliders.complexity.value);
    const I = parseFloat(sliders.importance.value);
    const S = parseFloat(sliders.skill.value);
    const F = parseFloat(sliders.frequency.value);
    const A = 0.7;

    const score = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));
    const displayScore = Math.min(score, 8.6);

    if (scoreDisplay) {
      scoreDisplay.textContent = displayScore.toFixed(2);
    }
    updateInterpretation(displayScore);
  }

  function updateInterpretation(score) {
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

    if (interpretationDisplay) {
      interpretationDisplay.textContent = interpretation;
    }

    const scoreSection = el.querySelector('.sod-simple-score');
    if (scoreSection) {
      scoreSection.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      scoreSection.classList.add(cls);
    }
  }

  Object.keys(sliders).forEach((k) => {
    if (!sliders[k]) return;
    
    // Initial value setup
    sliders[k].setAttribute('aria-valuenow', sliders[k].value);
    sliders[k].setAttribute('aria-valuetext', sliders[k].value);
    sliders[k].setAttribute('aria-describedby', `${k}-value`);

    sliders[k].addEventListener('input', () => {
      const val = sliders[k].value;
      if (sliderValues[k]) sliderValues[k].textContent = val;
      
      // Update ARIA attributes
      sliders[k].setAttribute('aria-valuenow', val);
      sliders[k].setAttribute('aria-valuetext', val);
      
      calculateScore();
    });
  });

  // Calculate initial score
  calculateScore();

  // Navigation
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    // Check if clicked element or any parent has data-nav
    const navElement = t.closest('[data-nav]');
    if (navElement) {
      onNavigate(navElement.dataset.nav);
    }
  });

  return el;
}
