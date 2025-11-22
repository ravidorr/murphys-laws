package com.murphyslaws.data.remote

import com.murphyslaws.data.remote.dto.LawOfDayResponse
import retrofit2.http.GET

interface ApiService {
    @GET("law-of-day")
    suspend fun getLawOfTheDay(): LawOfDayResponse
}
