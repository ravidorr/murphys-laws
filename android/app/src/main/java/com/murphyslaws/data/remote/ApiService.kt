package com.murphyslaws.data.remote

import com.murphyslaws.data.remote.dto.CategoriesResponse
import com.murphyslaws.data.remote.dto.LawDto
import com.murphyslaws.data.remote.dto.LawOfDayResponse
import com.murphyslaws.data.remote.dto.LawsResponse
import com.murphyslaws.data.remote.dto.SubmitLawRequestDto
import com.murphyslaws.data.remote.dto.SubmitLawResponseDto
import com.murphyslaws.data.remote.dto.VoteRequest
import com.murphyslaws.data.remote.dto.VoteResponseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @GET("laws")
    suspend fun getLaws(
        @Query("limit") limit: Int = 25,
        @Query("offset") offset: Int = 0,
        @Query("sort") sort: String = "score",
        @Query("order") order: String = "desc",
        @Query("q") query: String? = null,
        @Query("category_id") categoryId: Int? = null,
        @Query("attribution") attribution: String? = null
    ): LawsResponse

    @GET("laws/{id}")
    suspend fun getLaw(
        @Path("id") id: Int
    ): LawDto

    @POST("laws/{id}/vote")
    suspend fun voteLaw(
        @Path("id") id: Int,
        @Body voteRequest: VoteRequest,
        @Header("X-Device-ID") deviceId: String
    ): VoteResponseDto

    @DELETE("laws/{id}/vote")
    suspend fun unvoteLaw(
        @Path("id") id: Int,
        @Header("X-Device-ID") deviceId: String
    ): VoteResponseDto

    @GET("law-of-day")
    suspend fun getLawOfDay(): LawOfDayResponse

    @GET("categories")
    suspend fun getCategories(): CategoriesResponse

    @POST("laws")
    suspend fun submitLaw(
        @Body request: SubmitLawRequestDto
    ): SubmitLawResponseDto
}
