 
// Sod's Law Calculator view integrated with site styles (no inline CSS in HTML)
// Reuses the original formula and interaction, scoped under .calc- classes

export function Calculator() {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <header>
          <h1><span class="accent-text">Sod's</span> Law Calculator</h1>
          <p class="calc-description">The (P)robability of a task going wrong by weighing it's combined (U)rgency, (C)omplexity, and (I)mportance, against the performer's (S)kill level,  multiplied by the (A)ctivity constant, amplifyed by the (F)requency of doing the task.</p>
          <p class="formula" id="formula-display"></p>
        </header>
        <div class="calc-container">
          <div class="calc-input-grid">
            <div class="calc-slider-group">
              <label for="urgency">U (Urgency of the task): <span class="calc-slider-value" id="urgency-value">5</span></label>
              <input type="range" id="urgency" min="1" max="9" value="5" />
            </div>
            <div class="calc-slider-group">
              <label for="complexity">C (Complexity of the task): <span class="calc-slider-value" id="complexity-value">5</span></label>
              <input type="range" id="complexity" min="1" max="9" value="5" />
            </div>
            <div class="calc-slider-group">
              <label for="importance">I (Importance of the task): <span class="calc-slider-value" id="importance-value">5</span></label>
              <input type="range" id="importance" min="1" max="9" value="5" />
            </div>
            <div class="calc-slider-group">
              <label for="skill">S (Your skill in performing the task): <span class="calc-slider-value" id="skill-value">5</span></label>
              <input type="range" id="skill" min="1" max="9" value="5" />
            </div>
            <div class="calc-slider-group">
              <label for="frequency">F (Frequency of the task): <span class="calc-slider-value" id="frequency-value">5</span></label>
              <input type="range" id="frequency" min="1" max="9" value="5" />
            </div>
          </div>
          <p class="label-without-input">A (Aggravation factor, a constant set by researchers): <span class="calc-slider-value" id="a-value">0.7</span></p>

          <section class="calc-result-section">
            <h2>P (Probability of things going wrong):</h2>
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
        }).catch((err) => console.error('MathJax typeset error:', err));
      } else {
        console.warn('MathJax not available');
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
        console.log('MathJax loaded, re-rendering formula with tooltips');
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

  return el;
}
