package com.murphyslaws.data.remote

import com.murphyslaws.data.remote.dto.LawOfDayResponse
import com.murphyslaws.data.remote.dto.VoteRequest
import com.murphyslaws.data.remote.dto.VoteResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @GET("law-of-day")
    suspend fun getLawOfTheDay(): LawOfDayResponse
    
    @POST("laws/{id}/vote")
    suspend fun voteLaw(
        @Path("id") lawId: Int,
        @Body request: VoteRequest
    ): VoteResponse
    
    @DELETE("laws/{id}/vote")
    suspend fun unvoteLaw(
        @Path("id") lawId: Int
    ): VoteResponse
}
