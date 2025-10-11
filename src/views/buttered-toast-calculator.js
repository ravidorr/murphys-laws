// Buttered Toast Landing Calculator view - full version with formula display

export function ButteredToastCalculator() {
  const el = document.createElement('div');
  el.className = 'container page calculator';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <header>
          <h1><span class="accent-text">Buttered</span> Toast Landing Calculator</h1>
          <p class="calc-description">The (P)robability of a buttered toast landing butter-side down by weighing it's combined (H)eight, (g)ravity, (O)verhang push, (B)utter Factor, (F)riction, and (T)oast Inertia.</p>
          <p class="formula" id="toast-formula-display"></p>
        </header>
        <div class="calc-input-grid">
          <div class="calc-slider-group">
            <label for="toast-height">H (Height of Fall): <span class="calc-slider-value" id="toast-height-value">75 cm</span></label>
            <input type="range" id="toast-height" min="30" max="200" value="75" />
          </div>
          <div class="calc-slider-group">
            <label for="toast-gravity">g (Gravity): <span class="calc-slider-value" id="toast-gravity-value">980 cm/s²</span></label>
            <input type="range" id="toast-gravity" min="162" max="2479" value="980" />
          </div>
          <div class="calc-slider-group">
            <label for="toast-overhang">O (Initial Overhang / Push): <span class="calc-slider-value" id="toast-overhang-value">5 cm</span></label>
            <input type="range" id="toast-overhang" min="1" max="20" value="5" />
          </div>
          <div class="calc-slider-group">
            <label for="toast-butter">B (Butter Factor): <span class="calc-slider-value" id="toast-butter-value">1.20</span></label>
            <input type="range" id="toast-butter" min="1.0" max="2.0" value="1.2" step="0.05" />
          </div>
          <div class="calc-slider-group">
            <label for="toast-friction">F (Air Friction / Drag): <span class="calc-slider-value" id="toast-friction-value">20</span></label>
            <input type="range" id="toast-friction" min="0" max="100" value="20" />
          </div>
          <div class="calc-slider-group">
            <label for="toast-inertia">T (Toast Inertia): <span class="calc-slider-value" id="toast-inertia-value">350</span></label>
            <input type="range" id="toast-inertia" min="250" max="500" value="350" />
          </div>
        </div>
        <h2>P (Probability of Butter-Side Down Landing):</h2>
        <div id="toast-result-display" class="calc-result-display calc-ok">
          <span id="toast-probability-value" class="calc-score">0%</span>
          <p id="toast-interpretation" class="calc-interpretation">Adjust the parameters to see the probability.</p>
        </div>
        <div class="calc-info">
          <p>The probability is on a scale of 0% to 100%.</p>
          <p>The higher the probability (P), the greater the chance the toast will land butter-side down.</p>
          <p>How the formula explains the phenomenon?</p>
          <p>The components of the equation reflect the physical forces and properties governing a falling, rotating object:</p>
          <p>The probability of a butter-down landing is determined not by any single factor, but by how all factors combine to affect the toast's final rotational position when it hits the floor.</p>
          <p>The likelihood of rotation is increased by a greater Fall Height (H), a stronger Initial Push (O), and a more significant Butter Factor (B).</p>
          <p>The likelihood of rotation is decreased by the toast's "laziness" to spin, or Toast Inertia (T), as well as by Air Friction (F) and stronger Gravity (g), which reduces the total fall time.</p>
          <p>The Half-Rotation Principle:</p>
          <p>The core of the equation "(... mod 1) - 0.5" reveals the secret: the absolute speed of rotation doesn't matter as much as the toast's orientation at the end of the fall.</p>
          <p>The formula calculates the total number of rotations and then looks at the fractional remainder ("mod 1"). A remainder of 0.5 represents a perfect half-turn, guaranteeing a butter-side down landing and yielding the highest probability (100%).</p>
          <p>The further the final orientation is from a perfect half-turn, the lower the probability.</p>
          <p>How to increase your chances of a butter-up landing:</p>
          <p>Change the Fall Height (H): Drastically increase or decrease it. A fall from a coffee table or a high counter is less likely to result in a perfect half-rotation than a fall from a standard dining table.</p>
          <p>Minimize the Initial Push (O): Let the toast slide off as slowly as possible to reduce its initial tumble.</p>
          <p>Use a Different Bread (T): A very light, airy piece of toast (low inertia) or a very dense, heavy one (high inertia) will rotate at a different rate.</p>
          <p>Don't butter it! (B): An unbuttered slice is perfectly balanced, making its rotation less predictable.</p>
          <p>How it works:</p>
          <p>This calculator uses a simplified physics model to estimate the probability of a buttered toast landing butter-side down when it falls off a surface.</p>
          <p>The variables:</p>
          <p>H (Height): The height from which the toast falls. Typical table height is ~75cm.</p>
          <p>g (Gravity): The gravitational acceleration. Earth is ~980 cm/s², the Moon is 162 cm/s².</p>
          <p>O (Overhang/Push): How much the toast extends over the edge or the force of the initial push. A larger overhang imparts more initial angular velocity.</p>
          <p>B (Butter Factor): Accounts for how butter weight alters the center of mass, affecting rotation.</p>
          <p>F (Air Friction): Resistance from the air slowing the toast's rotation during the fall.</p>
          <p>T (Toast Inertia): A factor for toast density and shape. Denser or thicker toast rotates slower.</p>
          <p>Why butter-side down? The formula calculates total rotation based on fall time, initial rotation, and resistances. When the rotation lands close to a half-turn (180°), the butter side is more likely to face down!</p>
        </div>
      </div>
    </div>
  `;

  // Wire up interactions
  const sliders = {
    height: el.querySelector('#toast-height'),
    gravity: el.querySelector('#toast-gravity'),
    overhang: el.querySelector('#toast-overhang'),
    butter: el.querySelector('#toast-butter'),
    friction: el.querySelector('#toast-friction'),
    inertia: el.querySelector('#toast-inertia'),
  };

  const sliderValues = {
    height: el.querySelector('#toast-height-value'),
    gravity: el.querySelector('#toast-gravity-value'),
    overhang: el.querySelector('#toast-overhang-value'),
    butter: el.querySelector('#toast-butter-value'),
    friction: el.querySelector('#toast-friction-value'),
    inertia: el.querySelector('#toast-inertia-value'),
  };

  const probabilityDisplay = el.querySelector('#toast-probability-value');
  const interpretationDisplay = el.querySelector('#toast-interpretation');
  const resultDisplay = el.querySelector('#toast-result-display');
  const formulaDisplay = el.querySelector('#toast-formula-display');

  // Track which variables should show values (temporarily after slider change)
  const showValues = { H: false, g: false, O: false, B: false, F: false, T: false };
  let resetTimeouts = { H: null, g: null, O: null, B: null, F: null, T: null };

  function updateFormula() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

    // Generate LaTeX formula - show variable name or value based on showValues
    const hDisplay = showValues.H ? H : 'H';
    const gDisplay = showValues.g ? g : 'g';
    const oDisplay = showValues.O ? O : 'O';
    const bDisplay = showValues.B ? B.toFixed(2) : 'B';
    const fDisplay = showValues.F ? F : 'F';
    const tDisplay = showValues.T ? T : 'T';

    const formula = `\\(P_{\\text{butter-down}} = \\left(1 - \\left| \\left( \\frac{30 \\sqrt{\\frac{${hDisplay}}{${gDisplay}}} \\cdot ${oDisplay} \\cdot ${bDisplay}}{${tDisplay} + ${fDisplay}} \\bmod{1} \\right) - 0.5 \\right| \\cdot 2 \\right) \\cdot 100\\% \\)`;

    if (formulaDisplay) {
      formulaDisplay.textContent = formula;
      // Tell MathJax to re-render this element
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([formulaDisplay]).then(() => {
          // Add title attributes to variables after MathJax renders
          const titles = {
            'H': 'Height of Fall (30-200 cm)',
            'g': 'Gravity (162-2479 cm/s²)',
            'O': 'Initial Overhang / Push (1-20 cm)',
            'B': 'Butter Factor (1.0-2.0)',
            'F': 'Air Friction / Drag (0-100)',
            'T': 'Toast Inertia (250-500)',
            'P': 'Probability of Butter-Side Down'
          };

          const variables = formulaDisplay.querySelectorAll('mjx-mi');

          variables.forEach((mi) => {
            // MathJax CHTML uses Unicode in class names (e.g., mjx-c1D443 = U+1D443 = Italic P)
            // Map Unicode Math Italic characters to regular letters
            const unicodeMap = {
              '1D443': 'P', // 𝑃
              '1D43B': 'H', // 𝐻
              '1D434': 'A', // 𝐴 (not used but included)
              '1D435': 'B', // 𝐵
              '1D43F': 'F', // 𝐹
              '1D447': 'T', // 𝑇
              '1D442': 'O', // 𝑂
              '1D454': 'g'  // 𝑔
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

  function calculateLanding() {
    const H = parseFloat(sliders.height.value);
    const g = parseFloat(sliders.gravity.value);
    const O = parseFloat(sliders.overhang.value);
    const B = parseFloat(sliders.butter.value);
    const F = parseFloat(sliders.friction.value);
    const T = parseFloat(sliders.inertia.value);

    // Update display values
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

    if (probabilityDisplay) probabilityDisplay.textContent = `${Math.round(finalProbability)}%`;
    updateInterpretation(finalProbability);
  }

  function updateInterpretation(probability) {
    let interpretation = '';
    let cls = 'calc-ok';

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
      interpretation = "Clean floors ahead! It's very likely to land safely.";
    }

    if (interpretationDisplay) interpretationDisplay.textContent = interpretation;
    if (resultDisplay) {
      resultDisplay.classList.remove('calc-ok', 'calc-warn', 'calc-orange', 'calc-danger', 'calc-dark');
      resultDisplay.classList.add(cls);
    }
  }

  Object.keys(sliders).forEach((k) => {
    sliders[k]?.addEventListener('input', () => {
      flashAllVariables();
      calculateLanding();
    });
  });

  // Initialize formula and calculation on load
  updateFormula();
  calculateLanding();

  // If MathJax isn't loaded yet, poll for it and re-render when ready
  if (typeof window !== 'undefined' && (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function')) {
    const pollMathJax = setInterval(() => {
      if (typeof window !== 'undefined' && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        clearInterval(pollMathJax);
        updateFormula();
      }
    }, 100);

    // Stop polling after 10 seconds
    setTimeout(() => clearInterval(pollMathJax), 10000);
  }

  return el;
}
