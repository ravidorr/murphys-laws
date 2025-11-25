package com.murphyslaws.util

import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException

object ErrorMessageMapper {
    fun map(throwable: Throwable?): String {
        return when (throwable) {
            is HttpException -> {
                when (throwable.code()) {
                    in 500..599 -> "Our servers are currently down for maintenance. Please try again later."
                    404 -> "Resource not found."
                    in 400..499 -> "Something went wrong with the request. Please try again."
                    else -> "An unexpected server error occurred."
                }
            }
            is SocketTimeoutException -> "The connection timed out. Please check your internet connection."
            is IOException -> "No internet connection. Please check your network settings."
            else -> "An unexpected error occurred. Please try again."
        }
    }
}
