package com.murphyslaws.presentation.calculators

import com.murphyslaws.domain.model.RiskLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CalculatorViewModelTest {

    private val viewModel = CalculatorViewModel()

    @Test
    fun `initial state is correct`() {
        assertEquals(5.0, viewModel.urgency, 0.0)
        assertEquals(5.0, viewModel.complexity, 0.0)
        assertEquals(5.0, viewModel.importance, 0.0)
        assertEquals(5.0, viewModel.skillLevel, 0.0)
        assertEquals(5.0, viewModel.frequency, 0.0)
        // Check initial calculation result (approximate)
        assertTrue(viewModel.probability > 0)
    }

    @Test
    fun `calculate updates probability correctly`() {
        // Test case: All inputs 5
        // P = ((5+5+5) * (10-5))/20 * 1 * (1/(1-sin(0.5)))
        // P = (15 * 5)/20 * 1 * (1/(1-0.479))
        // P = 75/20 * 1.92
        // P = 3.75 * 1.92 = 7.2
        // Calibrated = 7.2 * 7 = 50.4
        
        viewModel.reset() // Ensure defaults
        val prob = viewModel.probability
        
        // Allow some margin for floating point math
        assertEquals(50.0, prob, 5.0) 
    }

    @Test
    fun `updating inputs triggers recalculation`() {
        val initialProb = viewModel.probability
        
        // Increase urgency, probability should increase
        viewModel.onUrgencyChange(10.0)
        
        assertTrue(viewModel.probability > initialProb)
    }

    @Test
    fun `reset restores default values`() {
        viewModel.onUrgencyChange(10.0)
        viewModel.onComplexityChange(1.0)
        
        viewModel.reset()
        
        assertEquals(5.0, viewModel.urgency, 0.0)
        assertEquals(5.0, viewModel.complexity, 0.0)
    }

    @Test
    fun `risk level updates based on probability`() {
        // High risk scenario
        viewModel.onUrgencyChange(10.0)
        viewModel.onComplexityChange(10.0)
        viewModel.onImportanceChange(10.0)
        viewModel.onSkillLevelChange(1.0) // Low skill
        viewModel.onFrequencyChange(10.0) // High frequency
        
        assertEquals(RiskLevel.HIGH, viewModel.riskLevel)
        
        // Low risk scenario
        viewModel.onUrgencyChange(1.0)
        viewModel.onComplexityChange(1.0)
        viewModel.onImportanceChange(1.0)
        viewModel.onSkillLevelChange(10.0) // High skill
        viewModel.onFrequencyChange(1.0) // Low frequency
        
        assertEquals(RiskLevel.LOW, viewModel.riskLevel)
    }
}
