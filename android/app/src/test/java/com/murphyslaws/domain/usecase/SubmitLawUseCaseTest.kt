package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.repository.LawRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SubmitLawUseCaseTest {

    private val repository: LawRepository = mockk()
    private val submitLawUseCase = SubmitLawUseCase(repository)

    @Test
    fun `invoke calls repository with trimmed input when valid`() = runTest {
        // Given
        val text = "  My Law  "
        val title = "  My Title  "
        val name = "  John Doe  "
        val email = "  john@example.com  "
        coEvery { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) } returns Result.success(Unit)

        // When
        val result = submitLawUseCase(text, title, name, email)

        // Then
        assertTrue(result.isSuccess)
        coVerify { 
            repository.submitLaw(
                text = "My Law",
                title = "My Title",
                name = "John Doe",
                email = "john@example.com"
            )
        }
    }

    @Test
    fun `invoke returns failure when text is empty`() = runTest {
        // Given
        val text = ""
        
        // When
        val result = submitLawUseCase(text)

        // Then
        assertTrue(result.isFailure)
        assertEquals("Law text cannot be empty", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) }
    }

    @Test
    fun `invoke returns failure when text is blank`() = runTest {
        // Given
        val text = "   "
        
        // When
        val result = submitLawUseCase(text)

        // Then
        assertTrue(result.isFailure)
        assertEquals("Law text cannot be empty", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) }
    }

    @Test
    fun `invoke returns failure when text is too short`() = runTest {
        // Given
        val text = "Short" // < 10 chars
        
        // When
        val result = submitLawUseCase(text)

        // Then
        assertTrue(result.isFailure)
        assertEquals("Law text must be at least 10 characters", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) }
    }

    @Test
    fun `invoke passes null for empty optional fields`() = runTest {
        // Given
        val text = "My Law Text Content"
        val title = ""
        val name = "   "
        val email = null
        coEvery { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) } returns Result.success(Unit)

        // When
        val result = submitLawUseCase(text, title, name, email)

        // Then
        assertTrue(result.isSuccess)
        coVerify { 
            repository.submitLaw(
                text = "My Law Text Content",
                title = null,
                name = null,
                email = null
            )
        }
    }

    @Test
    fun `invoke returns failure when repository fails`() = runTest {
        // Given
        val text = "My Law Text Content"
        val error = Exception("Network error")
        coEvery { repository.submitLaw(any(), any() as String?, any() as String?, any() as String?) } returns Result.failure(error)

        // When
        val result = submitLawUseCase(text)

        // Then
        assertTrue(result.isFailure)
        assertEquals(error, result.exceptionOrNull())
    }
}
