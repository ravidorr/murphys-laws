package com.murphyslaws.data.remote

import com.murphyslaws.data.remote.dto.LawOfDayResponse
import com.murphyslaws.data.remote.dto.LawsResponse
import com.murphyslaws.data.remote.dto.SubmitLawRequest
import com.murphyslaws.data.remote.dto.SubmitLawResponse
import com.murphyslaws.data.remote.dto.VoteRequest
import com.murphyslaws.data.remote.dto.VoteResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @GET("law-of-day")
    suspend fun getLawOfTheDay(): LawOfDayResponse
    
    @GET("laws")
    suspend fun searchLaws(
        @Query("q") query: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
        @Query("sort") sort: String = "score",
        @Query("order") order: String = "desc"
    ): LawsResponse
    
    @POST("laws/{id}/vote")
    suspend fun voteLaw(
        @Path("id") lawId: Int,
        @Body request: VoteRequest
    ): VoteResponse
    
    @DELETE("laws/{id}/vote")
    suspend fun unvoteLaw(
        @Path("id") lawId: Int
    ): VoteResponse

    @POST("laws")
    suspend fun submitLaw(
        @Body request: SubmitLawRequest
    ): SubmitLawResponse
}
