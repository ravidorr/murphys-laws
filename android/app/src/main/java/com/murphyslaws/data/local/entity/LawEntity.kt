package com.murphyslaws.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.murphyslaws.domain.model.Law

@Entity(tableName = "laws")
data class LawEntity(
    @PrimaryKey
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String? = null,
    val cachedAt: Long = System.currentTimeMillis()
)

fun LawEntity.toDomain(): Law {
    return Law(
        id = id,
        text = text,
        title = title,
        upvotes = upvotes,
        downvotes = downvotes,
        createdAt = createdAt,
        attributions = null, // Attributions stored separately
        categories = null // Categories stored separately
    )
}

fun Law.toEntity(): LawEntity {
    return LawEntity(
        id = id,
        text = text,
        title = title,
        upvotes = upvotes,
        downvotes = downvotes,
        createdAt = createdAt
    )
}
