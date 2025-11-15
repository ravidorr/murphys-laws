package com.murphyslaws.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.murphyslaws.domain.model.Category

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey
    val id: Int,
    val name: String,
    val description: String?,
    val lawCount: Int,
    val cachedAt: Long = System.currentTimeMillis()
)

fun CategoryEntity.toDomain(): Category {
    return Category(
        id = id,
        name = name,
        description = description,
        lawCount = lawCount
    )
}

fun Category.toEntity(): CategoryEntity {
    return CategoryEntity(
        id = id,
        name = name,
        description = description,
        lawCount = lawCount
    )
}
