package com.murphyslaws.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.murphyslaws.domain.model.Category

data class CategoryDto(
    @SerializedName("id")
    val id: Int,
    @SerializedName("name")
    val name: String,
    @SerializedName("description")
    val description: String?,
    @SerializedName("law_count")
    val lawCount: Int = 0
)

fun CategoryDto.toDomain(): Category {
    return Category(
        id = id,
        name = name,
        description = description,
        lawCount = lawCount
    )
}
