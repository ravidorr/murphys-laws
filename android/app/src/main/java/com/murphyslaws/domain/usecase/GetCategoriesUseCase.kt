package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Category
import com.murphyslaws.domain.repository.CategoryRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetCategoriesUseCase @Inject constructor(
    private val categoryRepository: CategoryRepository
) {
    operator fun invoke(): Flow<List<Category>> {
        return categoryRepository.getCategories()
    }
}
