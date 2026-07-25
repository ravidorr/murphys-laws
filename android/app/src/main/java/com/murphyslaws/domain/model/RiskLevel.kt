package com.murphyslaws.domain.model

enum class RiskLevel {
    LOW,
    MEDIUM,
    HIGH;

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
