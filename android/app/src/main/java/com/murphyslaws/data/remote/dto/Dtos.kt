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
data class CategoriesResponse(
    val data: List<CategoryDto>
)

@JsonClass(generateAdapter = true)
data class CategoryDto(
    val id: Int,
    val title: String,
    val slug: String
)
