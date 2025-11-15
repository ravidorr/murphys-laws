package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class GetLawOfDayUseCase @Inject constructor(
    private val lawRepository: LawRepository
) {
    suspend operator fun invoke(): Result<LawOfDay> {
        return lawRepository.getLawOfDay()
    }
}
