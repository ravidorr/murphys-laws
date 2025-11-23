package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

/**
 * Use case for fetching all laws
 */
class GetLawsUseCase @Inject constructor(
    private val repository: LawRepository
) {
    
    /**
     * Fetch all laws
     * @return Result with list of laws
     */
    suspend operator fun invoke(limit: Int = 50, offset: Int = 0): Result<List<Law>> {
        return repository.getLaws(limit, offset)
    }
}
