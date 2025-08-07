document.addEventListener('DOMContentLoaded', () => {
    const sliders = {
        urgency: document.getElementById('urgency'),
        complexity: document.getElementById('complexity'),
        importance: document.getElementById('importance'),
        skill: document.getElementById('skill'),
        frequency: document.getElementById('frequency'),
    };

    const sliderValues = {
        urgency: document.getElementById('urgency-value'),
        complexity: document.getElementById('complexity-value'),
        importance: document.getElementById('importance-value'),
        skill: document.getElementById('skill-value'),
        frequency: document.getElementById('frequency-value'),
    };

    const calculateBtn = document.getElementById('calculate-btn');
    const scoreValueDisplay = document.getElementById('score-value');
    const scoreInterpretationDisplay = document.getElementById('score-interpretation');
    const resultDisplay = document.getElementById('result-display');

    // Update slider value display on input
    for (const key in sliders) {
        sliders[key].addEventListener('input', () => {
            sliderValues[key].textContent = sliders[key].value;
        });
    }

    // Calculation logic
    calculateBtn.addEventListener('click', () => {
        const U = parseFloat(sliders.urgency.value);
        const C = parseFloat(sliders.complexity.value);
        const I = parseFloat(sliders.importance.value);
        const S = parseFloat(sliders.skill.value);
        const F = parseFloat(sliders.frequency.value);
        const A = 0.7; // Constant for Activity

        // Sod's Law Formula
        const score = ((U + C + I) * (10 - S)) / 20 * A * (1 / (1 - Math.sin(F / 10)));

        // Clamp the score to a max of 8.6 for display consistency
        const displayScore = Math.min(score, 8.6);

        scoreValueDisplay.textContent = displayScore.toFixed(2);
        updateResultInterpretation(displayScore);
    });

    function updateResultInterpretation(score) {
        let interpretation = '';
        let color = '#ffffff';

        if (score < 2) {
            interpretation = "You're probably safe. What could possibly go wrong?";
            color = '#28a745'; // Green
        } else if (score < 4) {
            interpretation = "A bit risky. Maybe have a backup plan.";
            color = '#ffc107'; // Yellow
        } else if (score < 6) {
            interpretation = "Definitely worrying. Proceed with caution.";
            color = '#fd7e14'; // Orange
        } else if (score < 8) {
            interpretation = "Disaster is looming. It's not looking good.";
            color = '#dc3545'; // Red
        } else {
            interpretation = "Catastrophe is almost certain. Good luck.";
            color = '#b30000'; // Dark Red
        }

        scoreInterpretationDisplay.textContent = interpretation;
        resultDisplay.style.backgroundColor = color;
        // Adjust text color for better contrast on dark backgrounds
        resultDisplay.style.color = (score >= 6) ? '#ffffff' : '#000000';
    }
});
