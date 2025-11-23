package com.murphyslaws.presentation.home

import app.cash.turbine.test
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.usecase.GetLawOfTheDayUseCase
import com.murphyslaws.domain.usecase.VoteUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private lateinit var getLawOfTheDayUseCase: GetLawOfTheDayUseCase
    private lateinit var voteUseCase: VoteUseCase
    private lateinit var viewModel: HomeViewModel

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        getLawOfTheDayUseCase = mockk()
        voteUseCase = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `viewModel loads law of the day successfully`() = runTest(testDispatcher) {
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
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)

        // When
        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isLoading)
            assertNotNull(state.lawOfDay)
            assertEquals(lawOfDay, state.lawOfDay)
            assertNull(state.error)
        }
    }

    @Test
    fun `viewModel sets error when use case fails`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        coEvery { getLawOfTheDayUseCase() } returns Result.failure(Exception(errorMessage))

        // When
        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isLoading)
            assertNull(state.lawOfDay)
            assertEquals(errorMessage, state.error)
        }
    }

    @Test
    fun `viewModel loads data on initialization`() = runTest(testDispatcher) {
        // Given
        val law = Law(1, "text",null, 0, 0)
        val lawOfDay = LawOfDay(law, "2024-01-01")
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)

        // When
        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // Then - data should be loaded
        viewModel.uiState.test {
            val state = awaitItem()
            assertNotNull(state.lawOfDay)
            assertFalse(state.isLoading)
        }
    }

    @Test
    fun `onUpvoteClicked updates vote counts on success`() = runTest(testDispatcher) {
        // Given
        val law = Law(1, "Test", null, 10, 5)
        val lawOfDay = LawOfDay(law, "2024-01-01")
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.success(
            com.murphyslaws.data.remote.dto.VoteResponse(upvotes = 11, downvotes = 5)
        )

        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // When
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isVoting)
            assertEquals(11, state.lawOfDay?.law?.upvotes)
            assertEquals(5, state.lawOfDay?.law?.downvotes)
            assertNull(state.voteError)
        }
    }

    @Test
    fun `onDownvoteClicked updates vote counts on success`() = runTest(testDispatcher) {
        // Given
        val law = Law(1, "Test", null, 10, 5)
        val lawOfDay = LawOfDay(law, "2024-01-01")
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)
        coEvery { voteUseCase.toggleVote(1, "down") } returns Result.success(
            com.murphyslaws.data.remote.dto.VoteResponse(upvotes = 10, downvotes = 6)
        )

        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // When
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isVoting)
            assertEquals(10, state.lawOfDay?.law?.upvotes)
            assertEquals(6, state.lawOfDay?.law?.downvotes)
            assertNull(state.voteError)
        }
    }

    @Test
    fun `onUpvoteClicked sets error on failure`() = runTest(testDispatcher) {
        // Given
        val law = Law(1, "Test", null, 10, 5)
        val lawOfDay = LawOfDay(law, "2024-01-01")
        val errorMessage = "Network error"
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.failure(Exception(errorMessage))

        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // When
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isVoting)
            assertEquals(errorMessage, state.voteError)
            // Vote counts should remain unchanged
            assertEquals(10, state.lawOfDay?.law?.upvotes)
            assertEquals(5, state.lawOfDay?.law?.downvotes)
        }
    }

    @Test
    fun `onDownvoteClicked sets error on failure`() = runTest(testDispatcher) {
        // Given
        val law = Law(1, "Test", null, 10, 5)
        val lawOfDay = LawOfDay(law, "2024-01-01")
        val errorMessage = "API error"
        coEvery { getLawOfTheDayUseCase() } returns Result.success(lawOfDay)
        coEvery { voteUseCase.toggleVote(1, "down") } returns Result.failure(Exception(errorMessage))

        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // When
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isVoting)
            assertEquals(errorMessage, state.voteError)
        }
    }

    @Test
    fun `vote actions do nothing when lawOfDay is null`() = runTest(testDispatcher) {
        // Given - no law loaded
        coEvery { getLawOfTheDayUseCase() } returns Result.failure(Exception("No data"))

        viewModel = HomeViewModel(getLawOfTheDayUseCase, voteUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // When
        viewModel.onUpvoteClicked()
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.advanceUntilIdle()

        // Then - voteUseCase should not be called
        coVerify(exactly = 0) { voteUseCase.toggleVote(any(), any()) }
    }
}

