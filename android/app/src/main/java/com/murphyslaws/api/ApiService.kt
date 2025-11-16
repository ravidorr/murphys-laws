package com.murphyslaws.api

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.murphyslaws.models.LawOfDayResponse
import com.murphyslaws.models.LawsResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

object ApiService {
    private const val BASE_URL = "https://murphys-laws.com/api/v1"
    private val gson: Gson = GsonBuilder().create()

    suspend fun fetchLawOfDay(): LawOfDayResponse = withContext(Dispatchers.IO) {
        val url = URL("$BASE_URL/law-of-day")
        val connection = url.openConnection() as HttpURLConnection
        
        try {
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                gson.fromJson(response, LawOfDayResponse::class.java)
            } else {
                throw Exception("HTTP error: $responseCode")
            }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun fetchLaws(
        limit: Int = 25,
        offset: Int = 0,
        sort: String = "score",
        order: String = "desc"
    ): LawsResponse = withContext(Dispatchers.IO) {
        val url = URL("$BASE_URL/laws?limit=$limit&offset=$offset&sort=$sort&order=$order")
        val connection = url.openConnection() as HttpURLConnection
        
        try {
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                gson.fromJson(response, LawsResponse::class.java)
            } else {
                throw Exception("HTTP error: $responseCode")
            }
        } finally {
            connection.disconnect()
        }
    }
}

