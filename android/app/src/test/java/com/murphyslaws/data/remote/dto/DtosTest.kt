package com.murphyslaws.data.remote.dto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class DtosTest {

    @Test
    fun `LawDto data class methods work correctly`() {
        val dto1 = LawDto(1, "text", "title", 10, 2, "date")
        val dto2 = LawDto(1, "text", "title", 10, 2, "date")
        val dto3 = LawDto(2, "text", "title", 10, 2, "date")

        assertEquals(dto1, dto2)
        assertNotEquals(dto1, dto3)
        assertEquals(dto1.hashCode(), dto2.hashCode())
        assert(dto1.toString().contains("text"))
        
        val dto4 = dto1.copy(upvotes = 20)
        assertEquals(20, dto4.upvotes)
    }

    @Test
    fun `LawOfDayResponse data class methods work correctly`() {
        val dto = LawDto(1, "text", "title", 10, 2, "date")
        val res1 = LawOfDayResponse(dto, "2024-01-01")
        val res2 = LawOfDayResponse(dto, "2024-01-01")
        val res3 = LawOfDayResponse(dto, "2024-01-02")

        assertEquals(res1, res2)
        assertNotEquals(res1, res3)
        assertEquals(res1.hashCode(), res2.hashCode())
        assert(res1.toString().contains("2024-01-01"))
        
        val res4 = res1.copy(date = "2024-01-03")
        assertEquals("2024-01-03", res4.date)
    }
}
