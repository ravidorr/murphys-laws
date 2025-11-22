package com.murphyslaws.data.repository

import com.murphyslaws.data.remote.ApiService
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
}
