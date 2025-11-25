package com.murphyslaws.presentation.calculators

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.murphyslaws.domain.model.RiskLevel
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

class CalculatorViewModel : ViewModel() {

    // Input parameters (1-10)
    var urgency by mutableDoubleStateOf(5.0)
        private set
    var complexity by mutableDoubleStateOf(5.0)
        private set
    var importance by mutableDoubleStateOf(5.0)
        private set
    var skillLevel by mutableDoubleStateOf(5.0)
        private set
    var frequency by mutableDoubleStateOf(5.0)
        private set

    // Calculation result
    var probability by mutableDoubleStateOf(0.0)
        private set
    var riskLevel by mutableStateOf(RiskLevel.MEDIUM)
        private set

    init {
        calculate()
    }

    fun onUrgencyChange(value: Double) {
        urgency = value
        calculate()
    }

    fun onComplexityChange(value: Double) {
        complexity = value
        calculate()
    }

    fun onImportanceChange(value: Double) {
        importance = value
        calculate()
    }

    fun onSkillLevelChange(value: Double) {
        skillLevel = value
        calculate()
    }

    fun onFrequencyChange(value: Double) {
        frequency = value
        calculate()
    }

    fun reset() {
        urgency = 5.0
        complexity = 5.0
        importance = 5.0
        skillLevel = 5.0
        frequency = 5.0
        calculate()
    }

    private fun calculate() {
        // Formula:
        // P = ((U+C+I) * (10-S))/20 * A * 1/(1-sin(F/10))
        // Where A (adversity factor) is typically 1.0

        val u = urgency
        val c = complexity
        val i = importance
        val s = skillLevel
        val f = frequency
        val a = 1.0 // Adversity factor

        // Calculate base probability
        val numerator = (u + c + i) * (10 - s)
        val baseProbability = numerator / 20.0

        // Apply frequency modifier
        val sinValue = sin(f / 10.0)
        val frequencyModifier = 1.0 / (1.0 - sinValue)

        // Final probability
        val rawProbability = baseProbability * a * frequencyModifier
        
        // Apply calibration factor (from iOS implementation)
        val calibrated = rawProbability * 7.0
        
        // Clamp to 0-100
        probability = min(max(calibrated, 0.0), 100.0)

        // Determine risk level
        riskLevel = RiskLevel.fromProbability(probability)
    }
    
    val shareText: String
        get() = """
            My task has a ${String.format("%.1f", probability)}% chance of going wrong! ${riskLevel.emoji}

            Sod's Law Calculator
            Urgency: ${urgency.toInt()}
            Complexity: ${complexity.toInt()}
            Importance: ${importance.toInt()}
            Skill Level: ${skillLevel.toInt()}
            Frequency: ${frequency.toInt()}

            #MurphysLaw
        """.trimIndent()
}
