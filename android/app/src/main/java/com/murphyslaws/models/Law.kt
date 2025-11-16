package com.murphyslaws.models

import com.google.gson.annotations.SerializedName

data class Law(
    val id: Int,
    val text: String,
    val title: String? = null,
    val slug: String? = null,
    @SerializedName("raw_markdown")
    val rawMarkdown: String? = null,
    @SerializedName("origin_note")
    val originNote: String? = null,
    val upvotes: Int = 0,
    val downvotes: Int = 0,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("updated_at")
    val updatedAt: String? = null,
    val categories: List<Category>? = null
) {
    val score: Int
        get() = upvotes - downvotes

    val displayText: String
        get() = if (!title.isNullOrEmpty()) {
            "$title: $text"
        } else {
            text
        }
}

data class Category(
    val id: Int,
    val title: String,
    val slug: String? = null,
    val description: String? = null
)

data class LawOfDayResponse(
    val law: Law,
    @SerializedName("featured_date")
    val featuredDate: String
)

data class LawsResponse(
    val data: List<Law>,
    val total: Int,
    val limit: Int,
    val offset: Int
)

