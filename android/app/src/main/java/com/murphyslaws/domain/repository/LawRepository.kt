package com.murphyslaws.domain.repository

import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.model.LawOfDay

interface LawRepository {
    suspend fun getLawOfTheDay(): LawOfDay
    suspend fun voteLaw(lawId: Int, voteType: String): Result<VoteResponse>
    suspend fun unvoteLaw(lawId: Int): Result<VoteResponse>
}
