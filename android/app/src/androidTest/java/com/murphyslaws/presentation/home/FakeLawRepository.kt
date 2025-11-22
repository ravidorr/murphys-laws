package com.murphyslaws.presentation.home

import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.repository.LawRepository

class FakeLawRepository : LawRepository {
    var lawOfDayResult: Result<LawOfDay>? = null

    var delayMs: Long = 0

    override suspend fun getLawOfTheDay(): LawOfDay {
        if (delayMs > 0) {
            kotlinx.coroutines.delay(delayMs)
        }
        return lawOfDayResult?.getOrThrow() ?: throw Exception("No result set")
    }
}
