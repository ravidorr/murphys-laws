package com.murphyslaws.domain.model

import androidx.compose.ui.graphics.Color
import com.murphyslaws.ui.theme.DS

enum class RiskLevel(val label: String, val emoji: String, val color: Color) {
    LOW("Low risk of failure", "🟢", DS.Color.success),

    // No DS token matches a bright friendly orange. DESIGN.md's orange-bg
    // (#ffe9d6) and orange-text (#6a2e00) are tuned for the calculator
    // result panel's background+foreground pair, not for a stand-alone
    // chip indicator. Leaving as a literal until a `risk-medium` token is
    // added to DESIGN.md or the design conversation lands on a swap.
    MEDIUM("Moderate risk of failure", "🟡", Color(0xFFFFA500)),

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
