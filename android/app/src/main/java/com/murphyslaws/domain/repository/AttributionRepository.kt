package com.murphyslaws.domain.repository

import com.murphyslaws.domain.model.Attribution
import kotlinx.coroutines.flow.Flow

interface AttributionRepository {
    /**
     * Get all attributions
     */
    fun getAttributions(): Flow<List<Attribution>>

    /**
     * Refresh attributions from network
     */
    suspend fun refreshAttributions(): Result<Unit>
}
