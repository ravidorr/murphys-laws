package com.murphyslaws.domain.model

data class Law(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String,
    val attributions: List<Attribution>?,
    val categories: List<Category>?
) {
    val score: Int
        get() = upvotes - downvotes
}
