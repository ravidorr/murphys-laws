// Sod's Law Calculator view integrated with site styles (no inline CSS in HTML)
// Reuses the original formula and interaction, scoped under .calc- classes

export function Calculator() {
  const formula = String.raw`\(\frac{\frac{((U+C+I)(10-S))}{20}\cdot A\cdot 1}{(1-\sin \left(\frac{F}{10}\right))}\)`;

  const el = document.createElement('div');
  el.className = 'container page';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <header>
          <h1>Sod's Law Calculator</h1>
          <h2>Quantifying the likelihood of things going wrong.</h2>
          <p class="formula">${formula}</p>
          <p>U = Urgency (1-9) | C = Complexity (1-9) | I = Importance (1-9) | S = Skill (1-9) | F = Frequency (1-9) | A = Activity constant (0.7)</p> 
        </header>

        <div class="calc-container">
          <div class="calc-input-grid">
            <div class="calc-slider-group">
              <label for="urgency">Urgency (U)</label>
              <input type="range" id="urgency" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="urgency-value">5</span>
            </div>

            <div class="calc-slider-group">
              <label for="complexity">Complexity (C)</label>
              <input type="range" id="complexity" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="complexity-value">5</span>
            </div>

            <div class="calc-slider-group">
              <label for="importance">Importance (I)</label>
              <input type="range" id="importance" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="importance-value">5</span>
            </div>

            <div class="calc-slider-group">
              <label for="skill">Your Skill (S)</label>
              <input type="range" id="skill" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="skill-value">5</span>
            </div>

            <div class="calc-slider-group">
              <label for="frequency">Frequency (F)</label>
              <input type="range" id="frequency" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="frequency-value">5</span>
            </div>
          </div>

          <div class="mb-8">
            <button id="calculate-btn">Calculate Sod's Law Score</button>
          </div>

          <section class="calc-result-section">
            <h2>The Verdict</h2>
            <div id="result-display" class="calc-result-display calc-ok">
              <span id="score-value" class="calc-score">0.00</span>
              <p id="score-interpretation" class="calc-interpretation">Enter your values and see your fate.</p>
            </div>
            <div class="calc-info">
              <p class="small">This calculator uses the formula commissioned by British Gas. The 'Activity' (A) factor is set to a constant of 0.7. Scores are on a scale of 0 to ~8.6.</p>
            </div>
          </section>
        </div>
      </div>
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

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      if (sliderValues[k]) sliderValues[k].textContent = sliders[k].value;
    });
  });

  const calculateBtn = el.querySelector('#calculate-btn');
  const scoreValueDisplay = el.querySelector('#score-value');
  const scoreInterpretationDisplay = el.querySelector('#score-interpretation');
  const resultDisplay = el.querySelector('#result-display');

  calculateBtn?.addEventListener('click', () => {
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
  });

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

  return el;
}
