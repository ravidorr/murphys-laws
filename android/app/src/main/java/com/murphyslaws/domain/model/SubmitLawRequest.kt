package com.murphyslaws.domain.model

data class SubmitLawRequest(
    val text: String,
    val title: String? = null,
    val categoryId: Int,
    val authorName: String? = null,
    val authorEmail: String? = null,
    val submitAnonymously: Boolean = false
)

data class SubmitLawResponse(
    val success: Boolean,
    val message: String,
    val lawId: Int?
)
