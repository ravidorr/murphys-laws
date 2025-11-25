package com.murphyslaws.domain.model

import androidx.compose.ui.graphics.Color

enum class RiskLevel(val label: String, val emoji: String, val color: Color) {
    LOW("Low risk of failure", "🟢", Color.Green),
    MEDIUM("Moderate risk of failure", "🟡", Color(0xFFFFA500)), // Orange
    HIGH("High risk of failure", "🔴", Color.Red);

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
