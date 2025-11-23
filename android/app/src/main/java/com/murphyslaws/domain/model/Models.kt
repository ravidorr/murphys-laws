package com.murphyslaws.domain.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Law(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String? = null
) : Parcelable

data class LawOfDay(
    val law: Law,
    val date: String
)
