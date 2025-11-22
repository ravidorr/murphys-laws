package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class GetLawsUseCase @Inject constructor(
    private val repository: LawRepository
) {
    suspend operator fun invoke(limit: Int = 25, offset: Int = 0): Result<List<Law>> {
        return try {
            val laws = repository.getLaws(limit, offset)
            Result.success(laws)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
