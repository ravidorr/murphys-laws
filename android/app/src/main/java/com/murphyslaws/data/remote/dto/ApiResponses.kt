package com.murphyslaws.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Wrapper for paginated law responses
 */
data class LawsResponse(
    @SerializedName("data")
    val data: List<LawDto>,
    @SerializedName("total")
    val total: Int,
    @SerializedName("limit")
    val limit: Int,
    @SerializedName("offset")
    val offset: Int
)

/**
 * Wrapper for categories response
 */
data class CategoriesResponse(
    @SerializedName("data")
    val data: List<CategoryDto>
)

/**
 * Wrapper for attributions response
 */
data class AttributionsResponse(
    @SerializedName("data")
    val data: List<AttributionDto>
)

/**
 * Vote request body
 */
data class VoteRequest(
    @SerializedName("vote_type")
    val voteType: String
)

/**
 * Vote response
 */
data class VoteResponseDto(
    @SerializedName("upvotes")
    val upvotes: Int,
    @SerializedName("downvotes")
    val downvotes: Int
)

/**
 * Law of the day response
 */
data class LawOfDayResponse(
    @SerializedName("law")
    val law: LawDto,
    @SerializedName("featured_date")
    val featuredDate: String
)

/**
 * Submit law request
 */
data class SubmitLawRequestDto(
    @SerializedName("text")
    val text: String,
    @SerializedName("title")
    val title: String?,
    @SerializedName("category_id")
    val categoryId: Int,
    @SerializedName("author_name")
    val authorName: String?,
    @SerializedName("author_email")
    val authorEmail: String?,
    @SerializedName("submit_anonymously")
    val submitAnonymously: Boolean
)

/**
 * Submit law response
 */
data class SubmitLawResponseDto(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("message")
    val message: String,
    @SerializedName("law_id")
    val lawId: Int?
)

/**
 * Generic error response
 */
data class ErrorResponse(
    @SerializedName("error")
    val error: String,
    @SerializedName("message")
    val message: String,
    @SerializedName("retry_after")
    val retryAfter: Int?
)
