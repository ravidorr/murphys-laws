package com.murphyslaws.domain.usecase

import androidx.paging.PagingData
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetLawsUseCase @Inject constructor(
    private val lawRepository: LawRepository
) {
    operator fun invoke(
        query: String? = null,
        categoryId: Int? = null,
        attribution: String? = null,
        sort: String = "score",
        order: String = "desc"
    ): Flow<PagingData<Law>> {
        return lawRepository.getLaws(query, categoryId, attribution, sort, order)
    }
}
