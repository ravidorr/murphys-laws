package com.murphyslaws.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LawDto(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class LawOfDayResponse(
    val law: LawDto,
    @Json(name = "featured_date") val date: String
)

@JsonClass(generateAdapter = true)
data class VoteRequest(
    @Json(name = "vote_type") val voteType: String  // "up" or "down"
)

@JsonClass(generateAdapter = true)
data class VoteResponse(
    val upvotes: Int,
    val downvotes: Int
)

@JsonClass(generateAdapter = true)
data class LawsResponse(
    val data: List<LawDto>,
    val total: Int,
    val limit: Int,
    val offset: Int
)
