package com.murphyslaws.domain.model

data class Law(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String? = null
)

data class LawOfDay(
    val law: Law,
    val date: String
)
