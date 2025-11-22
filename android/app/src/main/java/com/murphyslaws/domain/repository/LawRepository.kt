package com.murphyslaws.domain.repository

import com.murphyslaws.domain.model.LawOfDay

interface LawRepository {
    suspend fun getLawOfTheDay(): LawOfDay
}
