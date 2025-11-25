package com.murphyslaws.util

import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.net.SocketTimeoutException

class ErrorMessageMapperTest {

    @Test
    fun `map returns server maintenance message for 502 error`() {
        val response = Response.error<Any>(502, "Bad Gateway".toResponseBody("text/plain".toMediaTypeOrNull()))
        val exception = HttpException(response)
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("Our servers are currently down for maintenance. Please try again later.", message)
    }

    @Test
    fun `map returns server maintenance message for 500 error`() {
        val response = Response.error<Any>(500, "Internal Server Error".toResponseBody("text/plain".toMediaTypeOrNull()))
        val exception = HttpException(response)
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("Our servers are currently down for maintenance. Please try again later.", message)
    }

    @Test
    fun `map returns resource not found for 404 error`() {
        val response = Response.error<Any>(404, "Not Found".toResponseBody("text/plain".toMediaTypeOrNull()))
        val exception = HttpException(response)
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("Resource not found.", message)
    }

    @Test
    fun `map returns client error message for 400 error`() {
        val response = Response.error<Any>(400, "Bad Request".toResponseBody("text/plain".toMediaTypeOrNull()))
        val exception = HttpException(response)
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("Something went wrong with the request. Please try again.", message)
    }

    @Test
    fun `map returns network error message for IOException`() {
        val exception = IOException("No internet")
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("No internet connection. Please check your network settings.", message)
    }

    @Test
    fun `map returns timeout message for SocketTimeoutException`() {
        val exception = SocketTimeoutException("Timeout")
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("The connection timed out. Please check your internet connection.", message)
    }

    @Test
    fun `map returns generic error message for unknown exception`() {
        val exception = RuntimeException("Unknown")
        
        val message = ErrorMessageMapper.map(exception)
        
        assertEquals("An unexpected error occurred. Please try again.", message)
    }
}
