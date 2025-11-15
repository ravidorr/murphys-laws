package com.murphyslaws.domain.repository

import com.murphyslaws.domain.model.Category
import kotlinx.coroutines.flow.Flow

interface CategoryRepository {
    /**
     * Get all categories
     */
    fun getCategories(): Flow<List<Category>>

    /**
     * Get a single category by ID
     */
    suspend fun getCategory(id: Int): Result<Category>

    /**
     * Refresh categories from network
     */
    suspend fun refreshCategories(): Result<Unit>
}
