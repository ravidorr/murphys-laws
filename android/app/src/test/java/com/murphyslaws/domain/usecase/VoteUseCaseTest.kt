package com.murphyslaws.domain.usecase

import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.repository.LawRepository
import com.murphyslaws.util.VoteManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class VoteUseCaseTest {

    private lateinit var mockRepository: LawRepository
    private lateinit var mockVoteManager: VoteManager
    private lateinit var voteUseCase: VoteUseCase

    @Before
    fun setup() {
        mockRepository = mockk()
        mockVoteManager = mockk(relaxed = true)
        voteUseCase = VoteUseCase(mockRepository, mockVoteManager)
    }

    @Test
    fun `toggleVote adds upvote when no existing vote`() = runTest {
        // Given
        val lawId = 123
        val response = VoteResponse(upvotes = 5, downvotes = 2)
        every { mockVoteManager.getUserVote(lawId) } returns null
        coEvery { mockRepository.voteLaw(lawId, "up") } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "up")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(5, result.getOrNull()?.upvotes)
        verify { mockVoteManager.saveVote(lawId, "up") }
        coVerify { mockRepository.voteLaw(lawId, "up") }
    }

    @Test
    fun `toggleVote adds downvote when no existing vote`() = runTest {
        // Given
        val lawId = 123
        val response = VoteResponse(upvotes = 4, downvotes = 3)
        every { mockVoteManager.getUserVote(lawId) } returns null
        coEvery { mockRepository.voteLaw(lawId, "down") } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "down")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(3, result.getOrNull()?.downvotes)
        verify { mockVoteManager.saveVote(lawId, "down") }
        coVerify { mockRepository.voteLaw(lawId, "down") }
    }

    @Test
    fun `toggleVote removes upvote when clicking same upvote`() = runTest {
        // Given
        val lawId = 123
        val response = VoteResponse(upvotes = 4, downvotes = 2)
        every { mockVoteManager.getUserVote(lawId) } returns "up"
        coEvery { mockRepository.unvoteLaw(lawId) } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "up")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(4, result.getOrNull()?.upvotes)
        verify { mockVoteManager.removeVote(lawId) }
        coVerify { mockRepository.unvoteLaw(lawId) }
        coVerify(exactly = 0) { mockRepository.voteLaw(any(), any()) }
    }

    @Test
    fun `toggleVote removes downvote when clicking same downvote`() = runTest {
        // Given
        val lawId = 456
        val response = VoteResponse(upvotes = 4, downvotes = 1)
        every { mockVoteManager.getUserVote(lawId) } returns "down"
        coEvery { mockRepository.unvoteLaw(lawId) } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "down")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()?.downvotes)
        verify { mockVoteManager.removeVote(lawId) }
        coVerify { mockRepository.unvoteLaw(lawId) }
        coVerify(exactly = 0) { mockRepository.voteLaw(any(), any()) }
    }

    @Test
    fun `toggleVote changes from upvote to downvote`() = runTest {
        // Given
        val lawId = 123
        val response = VoteResponse(upvotes = 3, downvotes = 3)
        every { mockVoteManager.getUserVote(lawId) } returns "up"
        coEvery { mockRepository.voteLaw(lawId, "down") } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "down")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(3, result.getOrNull()?.downvotes)
        verify { mockVoteManager.saveVote(lawId, "down") }
        coVerify { mockRepository.voteLaw(lawId, "down") }
        coVerify(exactly = 0) { mockRepository.unvoteLaw(any()) }
    }

    @Test
    fun `toggleVote changes from downvote to upvote`() = runTest {
        // Given
        val lawId = 123
        val response = VoteResponse(upvotes = 5, downvotes = 2)
        every { mockVoteManager.getUserVote(lawId) } returns "down"
        coEvery { mockRepository.voteLaw(lawId, "up") } returns Result.success(response)

        // When
        val result = voteUseCase.toggleVote(lawId, "up")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(5, result.getOrNull()?.upvotes)
        verify { mockVoteManager.saveVote(lawId, "up") }
        coVerify { mockRepository.voteLaw(lawId, "up") }
        coVerify(exactly = 0) { mockRepository.unvoteLaw(any()) }
    }

    @Test
    fun `toggleVote does not update local state on API failure`() = runTest {
        // Given
        val lawId = 123
        every { mockVoteManager.getUserVote(lawId) } returns null
        coEvery { mockRepository.voteLaw(lawId, "up") } returns Result.failure(Exception("Network error"))

        // When
        val result = voteUseCase.toggleVote(lawId, "up")

        // Then
        assertTrue(result.isFailure)
        verify(exactly = 0) { mockVoteManager.saveVote(any(), any()) }
        verify(exactly = 0) { mockVoteManager.removeVote(any()) }
    }

    @Test
    fun `toggleVote returns failure result on network error`() = runTest {
        // Given
        val lawId = 123
        val error = Exception("Network error")
        every { mockVoteManager.getUserVote(lawId) } returns null
        coEvery { mockRepository.voteLaw(lawId, "up") } returns Result.failure(error)

        // When
        val result = voteUseCase.toggleVote(lawId, "up")

        // Then
        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
