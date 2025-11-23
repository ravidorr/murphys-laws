package com.murphyslaws.presentation.home

import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository

class FakeLawRepository : LawRepository {
    private var lawOfDay: LawOfDay = LawOfDay(
        law = Law(
            id = 1,
            text = "If anything can go wrong, it will.",
            title = "Murphy's Law",
            upvotes = 42,
            downvotes = 7,
            createdAt = "2024-01-01"
        ),
        date = "2024-01-15"
    )
    
    private var shouldReturnError = false
    
    fun setLawOfDay(law: LawOfDay) {
        lawOfDay = law
    }
    
    fun setShouldReturnError(value: Boolean) {
        shouldReturnError = value
    }
    
    override suspend fun getLawOfTheDay(): LawOfDay {
        if (shouldReturnError) {
            throw Exception("Test error")
        }
        return lawOfDay
    }
    
    override suspend fun voteLaw(lawId: Int, voteType: String): Result<VoteResponse> {
        // For tests, just return a success response
        return Result.success(VoteResponse(upvotes = 43, downvotes = 7))
    }
    
    override suspend fun unvoteLaw(lawId: Int): Result<VoteResponse> {
        // For tests, just return a success response
        return Result.success(VoteResponse(upvotes = 42, downvotes = 7))
    }
}
