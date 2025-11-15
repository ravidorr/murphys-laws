package com.murphyslaws.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.murphyslaws.domain.model.Law

data class LawDto(
    @SerializedName("id")
    val id: Int,
    @SerializedName("text")
    val text: String,
    @SerializedName("title")
    val title: String?,
    @SerializedName("upvotes")
    val upvotes: Int,
    @SerializedName("downvotes")
    val downvotes: Int,
    @SerializedName("created_at")
    val createdAt: String,
    @SerializedName("attributions")
    val attributions: List<AttributionDto>?,
    @SerializedName("categories")
    val categories: List<CategoryDto>?
)

fun LawDto.toDomain(): Law {
    return Law(
        id = id,
        text = text,
        title = title,
        upvotes = upvotes,
        downvotes = downvotes,
        createdAt = createdAt,
        attributions = attributions?.map { it.toDomain() },
        categories = categories?.map { it.toDomain() }
    )
}
