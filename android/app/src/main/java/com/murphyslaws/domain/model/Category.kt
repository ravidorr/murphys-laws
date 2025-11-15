package com.murphyslaws.domain.model

data class Category(
    val id: Int,
    val name: String,
    val description: String?,
    val lawCount: Int = 0
)
