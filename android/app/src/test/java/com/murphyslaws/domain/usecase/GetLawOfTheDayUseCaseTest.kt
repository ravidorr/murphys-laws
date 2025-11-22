package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetLawOfTheDayUseCaseTest {

    private lateinit var repository: LawRepository
    private lateinit var useCase: GetLawOfTheDayUseCase

    @Before
    fun setup() {
        repository = mockk()
        useCase = GetLawOfTheDayUseCase(repository)
    }

    @Test
    fun `invoke returns success with law of the day`() = runTest {
        // Given
        val law = Law(
            id = 1,
            text = "Test law",
            title = "Title",
            upvotes = 10,
            downvotes = 2,
            createdAt = "2024-01-01"
        )
        val lawOfDay = LawOfDay(law = law, date = "2024-01-15")
        coEvery { repository.getLawOfTheDay() } returns lawOfDay

        // When
        val result = useCase()

        // Then
        assertTrue(result.isSuccess)
        assertEquals(lawOfDay, result.getOrNull())
    }

    @Test
    fun `invoke returns failure when repository throws exception`() = runTest {
        // Given
        val exception = Exception("Network error")
        coEvery { repository.getLawOfTheDay() } throws exception

        // When
        val result = useCase()

        // Then
        assertTrue(result.isFailure)
        assertEquals(exception, result.exceptionOrNull())
    }
}
