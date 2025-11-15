package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.VoteResponse
import com.murphyslaws.domain.model.VoteType
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class VoteLawUseCase @Inject constructor(
    private val lawRepository: LawRepository
) {
    suspend operator fun invoke(lawId: Int, voteType: VoteType): Result<VoteResponse> {
        // Save vote locally first (optimistic update)
        lawRepository.saveUserVote(lawId, voteType)

        // Then sync with backend
        return lawRepository.voteLaw(lawId, voteType).onFailure {
            // Revert on failure
            lawRepository.removeUserVote(lawId)
        }
    }
}
