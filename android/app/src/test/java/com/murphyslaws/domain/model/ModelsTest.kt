package com.murphyslaws.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ModelsTest {

    @Test
    fun `Law data class methods work correctly`() {
        val law1 = Law(1, "text", "title", 10, 2, "date")
        val law2 = Law(1, "text", "title", 10, 2, "date")
        val law3 = Law(2, "text", "title", 10, 2, "date")

        // Test equals
        assertEquals(law1, law2)
        assertNotEquals(law1, law3)

        // Test hashCode
        assertEquals(law1.hashCode(), law2.hashCode())
        assertNotEquals(law1.hashCode(), law3.hashCode())

        // Test toString
        assert(law1.toString().contains("text"))
        
        // Test copy
        val law4 = law1.copy(upvotes = 20)
        assertEquals(20, law4.upvotes)
        assertEquals(law1.text, law4.text)
    }

    @Test
    fun `LawOfDay data class methods work correctly`() {
        val law = Law(1, "text", "title", 10, 2, "date")
        val lod1 = LawOfDay(law, "2024-01-01")
        val lod2 = LawOfDay(law, "2024-01-01")
        val lod3 = LawOfDay(law, "2024-01-02")

        assertEquals(lod1, lod2)
        assertNotEquals(lod1, lod3)
        assertEquals(lod1.hashCode(), lod2.hashCode())
        assert(lod1.toString().contains("2024-01-01"))
        
        val lod4 = lod1.copy(date = "2024-01-03")
        assertEquals("2024-01-03", lod4.date)
    }
}
