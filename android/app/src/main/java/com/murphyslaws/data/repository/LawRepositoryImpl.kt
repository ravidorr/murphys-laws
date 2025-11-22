package com.murphyslaws.data.repository

import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.domain.model.Category
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class LawRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : LawRepository {

    override suspend fun getLaws(limit: Int, offset: Int): List<Law> {
        return apiService.getLaws(limit = limit, offset = offset).map { dto ->
            Law(
                id = dto.id,
                text = dto.text,
                title = dto.title,
                upvotes = dto.upvotes,
                downvotes = dto.downvotes,
                createdAt = dto.createdAt
            )
        }
    }

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

    override suspend fun getCategories(): List<Category> {
        return apiService.getCategories().data.map { dto ->
            Category(
                id = dto.id,
                name = dto.title,
                slug = dto.slug
            )
        }
    }

    override suspend fun getLaw(id: Int): Law {
        // Workaround: The /laws/:id endpoint returns 404 in production
        // Fetch from /laws list and filter by ID client-side
        try {
            val dto = apiService.getLaw(id)
            return Law(
                id = dto.id,
                text = dto.text,
                title = dto.title,
                upvotes = dto.upvotes,
                downvotes = dto.downvotes,
                createdAt = dto.createdAt
            )
        } catch (e: Exception) {
            // Fallback: fetch from list endpoint
            val laws = apiService.getLaws(limit = 1000, offset = 0)
            val lawDto = laws.firstOrNull { it.id == id }
                ?: throw Exception("Law not found")
            return Law(
                id = lawDto.id,
                text = lawDto.text,
                title = lawDto.title,
                upvotes = lawDto.upvotes,
                downvotes = lawDto.downvotes,
                createdAt = lawDto.createdAt
            )
        }
    }
}
