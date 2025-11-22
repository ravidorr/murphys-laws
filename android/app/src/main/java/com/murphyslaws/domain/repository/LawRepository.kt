package com.murphyslaws.domain.repository

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.model.Category

interface LawRepository {
    suspend fun getLaws(limit: Int, offset: Int): List<Law>
    suspend fun getLawOfTheDay(): LawOfDay
    suspend fun getCategories(): List<Category>
    suspend fun getLaw(id: Int): Law
}
