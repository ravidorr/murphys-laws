package com.murphyslaws.domain.model

enum class VoteType(val value: String) {
    UP("up"),
    DOWN("down");

    companion object {
        fun fromValue(value: String): VoteType? {
            return entries.find { it.value == value }
        }
    }
}

data class VoteResponse(
    val upvotes: Int,
    val downvotes: Int
)
