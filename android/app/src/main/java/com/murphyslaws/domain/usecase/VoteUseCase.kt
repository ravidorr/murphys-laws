package com.murphyslaws.domain.usecase

import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.repository.LawRepository
import com.murphyslaws.util.VoteManager
import javax.inject.Inject

/**
 * Use case for toggling votes on laws
 * Mirrors web app's toggleVote logic
 */
class VoteUseCase @Inject constructor(
    private val repository: LawRepository,
    private val voteManager: VoteManager
) {
    
    /**
     * Toggle vote on a law (if same type clicked, remove; if different, change; if no vote, add)
     * @param lawId The law ID
     * @param voteType Either "up" or "down"
     * @return Result with VoteResponse containing updated vote counts
     */
    suspend fun toggleVote(lawId: Int, voteType: String): Result<VoteResponse> {
        val currentVote = voteManager.getUserVote(lawId)
        
        return if (currentVote == voteType) {
            // Same vote clicked - remove it
            repository.unvoteLaw(lawId).also { result ->
                if (result.isSuccess) {
                    voteManager.removeVote(lawId)
                }
            }
        } else {
            // Different vote or no vote - set new vote
            repository.voteLaw(lawId, voteType).also { result ->
                if (result.isSuccess) {
                    voteManager.saveVote(lawId, voteType)
                }
            }
        }
    }
}
