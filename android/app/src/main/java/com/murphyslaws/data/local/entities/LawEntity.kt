package com.murphyslaws.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "laws")
data class LawEntity(
    @PrimaryKey val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String,
    val cachedAt: Long = System.currentTimeMillis()
)
