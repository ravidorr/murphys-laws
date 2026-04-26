package com.murphyslaws.domain.model

import androidx.compose.ui.graphics.Color
import com.murphyslaws.ui.theme.DS

enum class RiskLevel(val label: String, val emoji: String, val color: Color) {
    LOW("Low risk of failure", "🟢", DS.Color.success),

    MEDIUM("Moderate risk of failure", "🟡", DS.Color.riskMedium),

    HIGH("High risk of failure", "🔴", DS.Color.error);

    companion object {
        fun fromProbability(probability: Double): RiskLevel {
            return when {
                probability < 30 -> LOW
                probability < 60 -> MEDIUM
                else -> HIGH
            }
        }
    }
}
