package com.murphyslaws.data.repository

import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.VoteRequest
import com.murphyslaws.data.remote.dto.VoteResponse
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class LawRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : LawRepository {

    override suspend fun getLawOfTheDay(): LawOfDay {
        val response = apiService.getLawOfTheDay()
        return LawOfDay(
            law = Law(
                id = response.law.id,
                text = response.law.text,
                title = response.law.title,
                upvotes = response.law.upvotes,
                downvotes = response.law.downvotes,
                createdAt = response.law.createdAt
            ),
            date = response.date
        )
    }
    
    override suspend fun searchLaws(query: String): Result<List<Law>> {
        return try {
            val response = apiService.searchLaws(query)
            val laws = response.data.map { lawDto ->
                Law(
                    id = lawDto.id,
                    text = lawDto.text,
                    title = lawDto.title,
                    upvotes = lawDto.upvotes,
                    downvotes = lawDto.downvotes,
                    createdAt = lawDto.createdAt
                )
            }
            Result.success(laws)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun voteLaw(lawId: Int, voteType: String): Result<VoteResponse> {
        return try {
            val response = apiService.voteLaw(lawId, VoteRequest(voteType))
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun unvoteLaw(lawId: Int): Result<VoteResponse> {
        return try {
            val response = apiService.unvoteLaw(lawId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
