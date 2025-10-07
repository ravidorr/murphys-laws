// Simple Sod's Law Calculator component

export function SodCalculatorSimple({ onNavigate }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  el.innerHTML = `
      <div class="section-header">
        <h3 class="section-title"><span class="accent-text">Sod's</span> Law Calculator</h3>
      </div>
      <div class="section-subheader">
        <p class="section-subtitle">Calculate the probability of things going wrong</p>
      </div>
      <div class="section-body">
        <div class="sod-simple-inputs">
          <div class="sod-simple-slider-group">
            <label for="urgency">The task urgency: <span class="sod-simple-value" id="urgency-value">5</span></label>
            <input type="range" id="urgency" min="1" max="9" value="5" />
          </div>
          <div class="sod-simple-slider-group">
            <label for="complexity">The task complexity: <span class="sod-simple-value" id="complexity-value">5</span></label>
            <input type="range" id="complexity" min="1" max="9" value="5" />
          </div>
          <div class="sod-simple-slider-group">
            <label for="importance">The task importance: <span class="sod-simple-value" id="importance-value">5</span></label>
            <input type="range" id="importance" min="1" max="9" value="5" />
          </div>
          <div class="sod-simple-slider-group">
            <label for="skill">Your skills: <span class="sod-simple-value" id="skill-value">5</span></label>
            <input type="range" id="skill" min="1" max="9" value="5" />
          </div>
          <div class="sod-simple-slider-group">
            <label for="frequency">The task frequency: <span class="sod-simple-value" id="frequency-value">5</span></label>
            <input type="range" id="frequency" min="1" max="9" value="5" />
          </div>
        </div>
        <div class="sod-simple-score-label">The probability of things going wrong:</div>
        <div class="sod-simple-score">
          <div id="score-display" class="sod-simple-score-value">5.25</div>
          <div id="interpretation" class="sod-simple-interpretation">Definitely worrying. Proceed with caution.</div>
        </div>
      </div>

      <div class="section-footer">
        <span/> </span>
        <button class="btn" type="button" data-nav="calculator" aria-label="View full Sod's Law Calculator">
          <span class="btn-text">View Full Calculator</span>
          <span class="material-symbols-outlined icon ml">arrow_forward</span>
        </button>
      </div>
  `;

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

    if (scoreDisplay) scoreDisplay.textContent = displayScore.toFixed(2);
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

    if (interpretationDisplay) interpretationDisplay.textContent = interpretation;

    const scoreSection = el.querySelector('.sod-simple-score');
    if (scoreSection) {
      scoreSection.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      scoreSection.classList.add(cls);
    }
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      if (sliderValues[k]) sliderValues[k].textContent = sliders[k].value;
      calculateScore();
    });
  });

  // Calculate initial score
  calculateScore();

  // Navigation
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.nav) {
      onNavigate(t.dataset.nav);
    }
  });

  return el;
}
