package com.murphyslaws.data.repository

import com.murphyslaws.data.local.dao.CategoryDao
import com.murphyslaws.data.local.entity.toDomain
import com.murphyslaws.data.local.entity.toEntity
import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.toDomain
import com.murphyslaws.domain.model.Category
import com.murphyslaws.domain.repository.CategoryRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CategoryRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val categoryDao: CategoryDao
) : CategoryRepository {

    override fun getCategories(): Flow<List<Category>> {
        return categoryDao.getCategories().map { entities ->
            if (entities.isEmpty()) {
                // If cache is empty, fetch from network
                refreshCategoriesInternal()
                emptyList()
            } else {
                entities.map { it.toDomain() }
            }
        }
    }

    override suspend fun getCategory(id: Int): Result<Category> {
        return try {
            val category = categoryDao.getCategory(id)?.toDomain()
            if (category != null) {
                Result.success(category)
            } else {
                // Fetch from network if not in cache
                refreshCategoriesInternal()
                val updatedCategory = categoryDao.getCategory(id)?.toDomain()
                if (updatedCategory != null) {
                    Result.success(updatedCategory)
                } else {
                    Result.failure(Exception("Category not found"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun refreshCategories(): Result<Unit> {
        return try {
            refreshCategoriesInternal()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun refreshCategoriesInternal() {
        val response = apiService.getCategories()
        val categories = response.data.map { it.toDomain() }
        categoryDao.insertCategories(categories.map { it.toEntity() })
    }
}
