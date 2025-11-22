package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class GetLawOfTheDayUseCase @Inject constructor(
    private val repository: LawRepository
) {
    suspend operator fun invoke(): Result<LawOfDay> {
        return try {
            val lawOfDay = repository.getLawOfTheDay()
            Result.success(lawOfDay)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
