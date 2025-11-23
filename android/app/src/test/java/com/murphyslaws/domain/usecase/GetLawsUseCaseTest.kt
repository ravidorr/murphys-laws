package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GetLawsUseCaseTest {

    private val repository: LawRepository = mockk()
    private val getLawsUseCase = GetLawsUseCase(repository)

    @Test
    fun `invoke calls repository getLaws`() = runTest {
        // Given
        val laws = listOf(
            Law(1, "Law 1", "Title 1", 0, 0),
            Law(2, "Law 2", "Title 2", 0, 0)
        )
        coEvery { repository.getLaws() } returns Result.success(laws)

        // When
        val result = getLawsUseCase()

        // Then
        assertTrue(result.isSuccess)
        assertEquals(laws, result.getOrNull())
    }

    @Test
    fun `invoke returns failure when repository fails`() = runTest {
        // Given
        val error = Exception("Network error")
        coEvery { repository.getLaws() } returns Result.failure(error)

        // When
        val result = getLawsUseCase()

        // Then
        assertTrue(result.isFailure)
        assertEquals(error, result.exceptionOrNull())
    }
}
