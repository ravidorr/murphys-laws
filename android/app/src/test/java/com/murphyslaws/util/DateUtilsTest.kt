package com.murphyslaws.util

import org.junit.Assert.assertEquals
import org.junit.Test

class DateUtilsTest {

    @Test
    fun `formatDate converts yyyy-MM-dd to MMMM dd, yyyy format`() {
        // Given
        val input = "2024-01-15"

        // When
        val result = DateUtils.formatDate(input)

        // Then
        assertEquals("January 15, 2024", result)
    }

    @Test
    fun `formatDate handles different months correctly`() {
        assertEquals("December 25, 2023", DateUtils.formatDate("2023-12-25"))
        assertEquals("March 01, 2024", DateUtils.formatDate("2024-03-01"))
        assertEquals("July 04, 2024", DateUtils.formatDate("2024-07-04"))
    }

    @Test
    fun `formatDate returns original string when parsing fails`() {
        // Given
        val invalidDate = "invalid-date"

        // When
        val result = DateUtils.formatDate(invalidDate)

        // Then
        assertEquals("invalid-date", result)
    }

    @Test
    fun `formatDate handles edge case dates`() {
        assertEquals("February 29, 2024", DateUtils.formatDate("2024-02-29")) // Leap year
        assertEquals("January 01, 2000", DateUtils.formatDate("2000-01-01")) // Y2K
    }

    @Test
    fun `formatDate returns original string for empty input`() {
        // When
        val result = DateUtils.formatDate("")

        // Then
        assertEquals("", result)
    }

    @Test
    fun `formatDate returns original string for completely malformed input`() {
        assertEquals("not-a-date", DateUtils.formatDate("not-a-date"))
        assertEquals("invalid", DateUtils.formatDate("invalid"))
    }
}
