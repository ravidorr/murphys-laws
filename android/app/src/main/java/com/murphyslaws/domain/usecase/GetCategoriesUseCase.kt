package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Category
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class GetCategoriesUseCase @Inject constructor(
    private val repository: LawRepository
) {
    suspend operator fun invoke(): Result<List<Category>> {
        return try {
            val categories = repository.getCategories()
            Result.success(categories)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
