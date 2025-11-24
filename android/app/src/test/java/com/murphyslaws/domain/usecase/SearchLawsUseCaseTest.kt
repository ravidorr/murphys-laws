package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class SearchLawsUseCaseTest {

    private lateinit var mockRepository: LawRepository
    private lateinit var searchLawsUseCase: SearchLawsUseCase

    @Before
    fun setup() {
        mockRepository = mockk()
        searchLawsUseCase = SearchLawsUseCase(mockRepository)
    }

    @Test
    fun `invoke returns empty list for blank query`() = runTest {
        // When
        val result = searchLawsUseCase("")

        // Then
        assertTrue(result.isSuccess)
        assertTrue(result.getOrNull()?.isEmpty() == true)
        coVerify(exactly = 0) { mockRepository.searchLaws(any()) }
    }

    @Test
    fun `invoke returns empty list for whitespace query`() = runTest {
        // When
        val result = searchLawsUseCase("   ")

        // Then
        assertTrue(result.isSuccess)
        assertTrue(result.getOrNull()?.isEmpty() == true)
        coVerify(exactly = 0) { mockRepository.searchLaws(any()) }
    }

    @Test
    fun `invoke trims whitespace from query`() = runTest {
        // Given
        val laws = listOf(Law(1, "Murphy's Law", "Murphy's Law", 10, 2))
        coEvery { mockRepository.searchLaws("murphy") } returns Result.success(laws)

        // When
        val result = searchLawsUseCase("  murphy  ")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(laws, result.getOrNull())
        coVerify { mockRepository.searchLaws("murphy") }
    }

    @Test
    fun `invoke returns success with results from repository`() = runTest {
        // Given
        val laws = listOf(
            Law(1, "Murphy's Law", "Murphy's Law", 10, 2),
            Law(2, "Another law with murphy", null, 5, 1)
        )
        coEvery { mockRepository.searchLaws("murphy") } returns Result.success(laws)

        // When
        val result = searchLawsUseCase("murphy")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
        assertEquals(laws, result.getOrNull())
    }

    @Test
    fun `invoke returns failure when repository fails`() = runTest {
        // Given
        val error = Exception("Network error")
        coEvery { mockRepository.searchLaws("test") } returns Result.failure(error)

        // When
        val result = searchLawsUseCase("test")

        // Then
        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `invoke handles single character query`() = runTest {
        // Given
        val laws = listOf(Law(1, "A test law", null, 10, 2))
        coEvery { mockRepository.searchLaws("a") } returns Result.success(laws)

        // When
        val result = searchLawsUseCase("a")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(laws, result.getOrNull())
    }

    @Test
    fun `invoke returns empty list from repository when no matches`() = runTest {
        // Given
        coEvery { mockRepository.searchLaws("xyz123") } returns Result.success(emptyList())

        // When
        val result = searchLawsUseCase("xyz123")

        // Then
        assertTrue(result.isSuccess)
        assertTrue(result.getOrNull()?.isEmpty() == true)
    }
}
