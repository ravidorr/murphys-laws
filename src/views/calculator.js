 
// Sod's Law Calculator view integrated with site styles (no inline CSS in HTML)
// Reuses the original formula and interaction, scoped under .calc- classes

export function Calculator() {
  // Formula is rendered by MathJax; per-symbol annotations are added via renderActions in main.js
  // Use a normal JS string so the DOM contains single backslashes (\\( ... \\)) that MathJax recognizes as \( ... \)
  const formula = '\\(P=\\frac{((U+C+I)\\times (10-S))}{20}\\times A\\times \\frac{1}{(1-\\sin (\\frac{F}{10}))}\\)';

  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <header>
          <h1><span class="accent-text">Sod's</span> Law Calculator</h1>
          <p class="formula">${formula}</p>
        </header>
        <div class="calc-container">
          <p>P: The probability that things will go wrong.</p>
          <div class="calc-input-grid">
            <div class="calc-slider-group">
              <label for="urgency">U: Urgency of the task.</label>
              <input type="range" id="urgency" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="urgency-value">5</span>
            </div>
            <div class="calc-slider-group">
              <label for="complexity">C: Complexity of the task.</label>
              <input type="range" id="complexity" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="complexity-value">5</span>
            </div>
            <div class="calc-slider-group">
              <label for="importance">I: Importance of the task.</label>
              <input type="range" id="importance" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="importance-value">5</span>
            </div>
            <div class="calc-slider-group">
              <label for="skill">S: Your skill in performing the task.</label>
              <input type="range" id="skill" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="skill-value">5</span>
            </div>
            <div class="calc-slider-group">
              <label for="frequency">F: Frequency of the task.</label>
              <input type="range" id="frequency" min="1" max="9" value="5" />
              <span class="calc-slider-value" id="frequency-value">5</span>
            </div>
          </div>
          <p>A: Aggravation factor, a constantset at 0.7 by the researchers.</p>

          <section class="calc-result-section">
            <h2>The probability of things going wrong:</h2>
            <div id="result-display" class="calc-result-display calc-ok">
              <span id="score-value" class="calc-score">0.00</span>
              <p id="score-interpretation" class="calc-interpretation">Enter your values and see your fate.</p>
            </div>
            <div class="calc-info">
              <p>probabilities are on a scale of 0.12 to 8.6.</p>
              <p>The higher the probability (P), the greater the chance that Sod's law will strike.</p>
              <p>How the formula explains Sod's Law?</p>
              <p>The components of the equation reflect the intuitive reasoning behind Sod's law:</p>
              <p>The probability (P) of a mishap increases with the urgency (U), complexity (C), and importance (I) of the task.</p>
              <p>The likelihood of a mishap decreases with your skill level (S).</p>
              <p>An aggravating circumstance is a constant, negative influence (A).</p>
              <p>The equation has a frequency term (1/(1-sin (F/10))) that implies that repeated actions (F) could lead to a sudden, unexpected failure.</p>
              <p>How to reduce the probability (P) of things going wrong:</p>
              <p>Improve your skill (S).</p>
              <p> Reduce the urgency (U), complexity (C) and/or importance (I).</p>
              <p>Lower the frequency (F) of the task.</p>
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

  const scoreValueDisplay = el.querySelector('#score-value');
  const scoreInterpretationDisplay = el.querySelector('#score-interpretation');
  const resultDisplay = el.querySelector('#result-display');

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
      calculateScore();
    });
  });

  // Calculate initial score on load
  calculateScore();

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
