package com.murphyslaws.data.repository

import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.LawDto
import com.murphyslaws.data.remote.dto.LawOfDayResponse
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class LawRepositoryImplTest {

    private lateinit var apiService: ApiService
    private lateinit var repository: LawRepositoryImpl

    @Before
    fun setup() {
        apiService = mockk()
        repository = LawRepositoryImpl(apiService)
    }

    @Test
    fun `getLawOfTheDay returns mapped LawOfDay successfully`() = runTest {
        // Given
        val lawDto = LawDto(
            id = 1,
            text = "Test law text",
            title = "Test Title",
            upvotes = 10,
            downvotes = 2,
            createdAt = "2024-01-01"
        )
        val response = LawOfDayResponse(
            law = lawDto,
            date = "2024-01-15"
        )
        coEvery { apiService.getLawOfTheDay() } returns response

        // When
        val result = repository.getLawOfTheDay()

        // Then
        val expectedLaw = Law(
            id = 1,
            text = "Test law text",
            title = "Test Title",
            upvotes = 10,
            downvotes = 2,
            createdAt = "2024-01-01"
        )
        val expected = LawOfDay(law = expectedLaw, date = "2024-01-15")
        assertEquals(expected, result)
    }

    @Test
    fun `getLawOfTheDay maps DTO with null fields correctly`() = runTest {
        // Given
        val lawDto = LawDto(
            id = 2,
            text = "Another law",
            title = null,
            upvotes = 5,
            downvotes = 1,
            createdAt = null
        )
        val response = LawOfDayResponse(
            law = lawDto,
            date = "2024-01-16"
        )
        coEvery { apiService.getLawOfTheDay() } returns response

        // When
        val result = repository.getLawOfTheDay()

        // Then
        assertEquals(2, result.law.id)
        assertEquals("Another law", result.law.text)
        assertEquals(null, result.law.title)
        assertEquals(null, result.law.createdAt)
        assertEquals("2024-01-16", result.date)
    }
}
