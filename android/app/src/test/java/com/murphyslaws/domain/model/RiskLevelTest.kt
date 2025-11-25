package com.murphyslaws.domain.model

import org.junit.Assert.assertEquals
import org.junit.Test

class RiskLevelTest {

    @Test
    fun `fromProbability returns LOW for values under 30`() {
        assertEquals(RiskLevel.LOW, RiskLevel.fromProbability(0.0))
        assertEquals(RiskLevel.LOW, RiskLevel.fromProbability(29.9))
    }

    @Test
    fun `fromProbability returns MEDIUM for values between 30 and 60`() {
        assertEquals(RiskLevel.MEDIUM, RiskLevel.fromProbability(30.0))
        assertEquals(RiskLevel.MEDIUM, RiskLevel.fromProbability(45.0))
        assertEquals(RiskLevel.MEDIUM, RiskLevel.fromProbability(59.9))
    }

    @Test
    fun `fromProbability returns HIGH for values 60 and above`() {
        assertEquals(RiskLevel.HIGH, RiskLevel.fromProbability(60.0))
        assertEquals(RiskLevel.HIGH, RiskLevel.fromProbability(80.0))
        assertEquals(RiskLevel.HIGH, RiskLevel.fromProbability(100.0))
    }
}
