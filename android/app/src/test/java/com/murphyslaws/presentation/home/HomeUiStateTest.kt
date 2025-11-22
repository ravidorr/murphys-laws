package com.murphyslaws.presentation.home

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class HomeUiStateTest {

    @Test
    fun `HomeUiState data class methods work correctly`() {
        val law = Law(1, "text", "title", 10, 2, "date")
        val lod = LawOfDay(law, "2024-01-01")
        
        val state1 = HomeUiState(isLoading = true, lawOfDay = null, error = null)
        val state2 = HomeUiState(isLoading = true, lawOfDay = null, error = null)
        val state3 = HomeUiState(isLoading = false, lawOfDay = lod, error = null)

        assertEquals(state1, state2)
        assertNotEquals(state1, state3)
        assertEquals(state1.hashCode(), state2.hashCode())
        assert(state1.toString().contains("isLoading=true"))
        
        val state4 = state1.copy(isLoading = false)
        assertEquals(false, state4.isLoading)
    }
}
