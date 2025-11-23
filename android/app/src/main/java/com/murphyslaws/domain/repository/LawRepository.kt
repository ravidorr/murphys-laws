package com.murphyslaws.domain.repository

import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay

interface LawRepository {
    suspend fun getLawOfTheDay(): LawOfDay
    suspend fun getLaws(limit: Int = 50, offset: Int = 0): Result<List<Law>>
    suspend fun searchLaws(query: String, limit: Int = 50, offset: Int = 0): Result<List<Law>>
    suspend fun voteLaw(lawId: Int, voteType: String): Result<VoteResponse>
    suspend fun unvoteLaw(lawId: Int): Result<VoteResponse>
    suspend fun submitLaw(text: String, title: String?, name: String?, email: String?): Result<Unit>
}
