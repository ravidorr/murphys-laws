package com.murphyslaws.data.remote

import com.murphyslaws.data.remote.dto.LawDto
import com.murphyslaws.data.remote.dto.LawOfDayResponse
import com.murphyslaws.data.remote.dto.CategoriesResponse
import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.http.Path

interface ApiService {
    @GET("laws")
    suspend fun getLaws(
        @Query("limit") limit: Int = 25,
        @Query("offset") offset: Int = 0,
        @Query("sort") sort: String = "score",
        @Query("order") order: String = "desc",
        @Query("q") query: String? = null,
        @Query("category_id") categoryId: Int? = null
    ): List<LawDto> // Assuming the API returns a list directly or a wrapper. Checking web code might be needed if unsure.

    @GET("law-of-day")
    suspend fun getLawOfTheDay(): LawOfDayResponse

    @GET("categories")
    suspend fun getCategories(): CategoriesResponse

    @GET("laws/{id}")
    suspend fun getLaw(@Path("id") id: Int): LawDto
}
