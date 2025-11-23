package com.murphyslaws.presentation.lawdetail

import app.cash.turbine.test
import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.model.Law
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
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LawDetailViewModelTest {

    private lateinit var voteUseCase: VoteUseCase
    private lateinit var viewModel: LawDetailViewModel

    private val testDispatcher = StandardTestDispatcher()

    private val testLaw = Law(
        id = 1,
        text = "Test law text",
        title = "Test Law",
        upvotes = 10,
        downvotes = 2
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        voteUseCase = mockk()
        viewModel = LawDetailViewModel(voteUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state has no law`() = runTest(testDispatcher) {
        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(state.law)
            assertFalse(state.isVoting)
            assertNull(state.voteError)
        }
    }

    @Test
    fun `setLaw updates state with law`() = runTest(testDispatcher) {
        // When
        viewModel.setLaw(testLaw)

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(testLaw, state.law)
            assertFalse(state.isVoting)
            assertNull(state.voteError)
        }
    }

    @Test
    fun `onUpvoteClicked updates vote counts on success`() = runTest(testDispatcher) {
        // Given
        viewModel.setLaw(testLaw)
        val response = VoteResponse(upvotes = 11, downvotes = 2)
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.success(response)

        // When
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(11, state.law?.upvotes)
            assertEquals(2, state.law?.downvotes)
            assertFalse(state.isVoting)
            assertNull(state.voteError)
        }

        coVerify { voteUseCase.toggleVote(1, "up") }
    }

    @Test
    fun `onDownvoteClicked updates vote counts on success`() = runTest(testDispatcher) {
        // Given
        viewModel.setLaw(testLaw)
        val response = VoteResponse(upvotes = 10, downvotes = 3)
        coEvery { voteUseCase.toggleVote(1, "down") } returns Result.success(response)

        // When
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(10, state.law?.upvotes)
            assertEquals(3, state.law?.downvotes)
            assertFalse(state.isVoting)
            assertNull(state.voteError)
        }

        coVerify { voteUseCase.toggleVote(1, "down") }
    }

    @Test
    fun `onUpvoteClicked sets error on failure`() = runTest(testDispatcher) {
        // Given
        viewModel.setLaw(testLaw)
        val error = Exception("Network error")
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.failure(error)

        // When
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(testLaw, state.law) // Law unchanged
            assertFalse(state.isVoting)
            assertEquals("Network error", state.voteError)
        }
    }

    @Test
    fun `onDownvoteClicked sets error on failure`() = runTest(testDispatcher) {
        // Given
        viewModel.setLaw(testLaw)
        val error = Exception("Network error")
        coEvery { voteUseCase.toggleVote(1, "down") } returns Result.failure(error)

        // When
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(testLaw, state.law) // Law unchanged
            assertFalse(state.isVoting)
            assertEquals("Network error", state.voteError)
        }
    }

    @Test
    fun `onUpvoteClicked does nothing when no law is set`() = runTest(testDispatcher) {
        // When
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(state.law)
            assertFalse(state.isVoting)
        }

        coVerify(exactly = 0) { voteUseCase.toggleVote(any(), any()) }
    }

    @Test
    fun `onDownvoteClicked does nothing when no law is set`() = runTest(testDispatcher) {
        // When
        viewModel.onDownvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(state.law)
            assertFalse(state.isVoting)
        }

        coVerify(exactly = 0) { voteUseCase.toggleVote(any(), any()) }
    }

    @Test
    fun `voting clears previous error`() = runTest(testDispatcher) {
        // Given - set up initial error state
        viewModel.setLaw(testLaw)
        val error = Exception("First error")
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.failure(error)
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Verify error is set
        assertEquals("First error", viewModel.uiState.value.voteError)

        // When - successful vote
        val response = VoteResponse(upvotes = 11, downvotes = 2)
        coEvery { voteUseCase.toggleVote(1, "up") } returns Result.success(response)
        viewModel.onUpvoteClicked()
        testDispatcher.scheduler.runCurrent()

        // Then - error is cleared
        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(state.voteError)
            assertEquals(11, state.law?.upvotes)
        }
    }
}
