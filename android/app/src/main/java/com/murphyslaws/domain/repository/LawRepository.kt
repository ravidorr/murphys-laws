package com.murphyslaws.domain.repository

import androidx.paging.PagingData
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.model.SubmitLawRequest
import com.murphyslaws.domain.model.SubmitLawResponse
import com.murphyslaws.domain.model.VoteResponse
import com.murphyslaws.domain.model.VoteType
import kotlinx.coroutines.flow.Flow

interface LawRepository {
    /**
     * Get paginated list of laws with optional filters
     */
    fun getLaws(
        query: String? = null,
        categoryId: Int? = null,
        attribution: String? = null,
        sort: String = "score",
        order: String = "desc"
    ): Flow<PagingData<Law>>

    /**
     * Get a single law by ID
     */
    suspend fun getLaw(id: Int): Result<Law>

    /**
     * Get Law of the Day
     */
    suspend fun getLawOfDay(): Result<LawOfDay>

    /**
     * Vote on a law
     */
    suspend fun voteLaw(lawId: Int, voteType: VoteType): Result<VoteResponse>

    /**
     * Remove vote from a law
     */
    suspend fun unvoteLaw(lawId: Int): Result<VoteResponse>

    /**
     * Submit a new law
     */
    suspend fun submitLaw(request: SubmitLawRequest): Result<SubmitLawResponse>

    /**
     * Get user's vote for a specific law
     */
    fun getUserVote(lawId: Int): Flow<VoteType?>

    /**
     * Save user's vote locally
     */
    suspend fun saveUserVote(lawId: Int, voteType: VoteType)

    /**
     * Remove user's vote locally
     */
    suspend fun removeUserVote(lawId: Int)
}
