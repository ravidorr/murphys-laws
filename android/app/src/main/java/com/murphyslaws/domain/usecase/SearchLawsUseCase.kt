package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

/**
 * Use case for searching laws by query term
 */
class SearchLawsUseCase @Inject constructor(
    private val repository: LawRepository
) {
    
    /**
     * Search for laws matching the query
     * @param query Search term
     * @return Result with list of matching laws (empty if query is blank)
     */
    suspend operator fun invoke(query: String, limit: Int = 50, offset: Int = 0): Result<List<Law>> {
        return if (query.isBlank()) {
            Result.success(emptyList())
        } else {
            repository.searchLaws(query.trim(), limit, offset)
        }
    }
}
