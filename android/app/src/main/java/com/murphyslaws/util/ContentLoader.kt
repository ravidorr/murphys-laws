package com.murphyslaws.util

import android.content.Context
import com.murphyslaws.domain.model.ContentPage
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.IOException

@Serializable
data class ContentMetadata(
    val version: String,
    val lastUpdated: String,
    val description: String
)

@Serializable
data class ContentMetadataRoot(
    val about: ContentMetadata,
    val privacy: ContentMetadata,
    val terms: ContentMetadata,
    val contact: ContentMetadata
)

object ContentLoader {
    private var metadataCache: ContentMetadataRoot? = null
    private val contentCache = mutableMapOf<ContentPage, String>()
    
    private val json = Json {
        ignoreUnknownKeys = true
    }

    /**
     * Load markdown content for a given page from assets
     */
    fun loadContent(context: Context, page: ContentPage): String? {
        // Check cache first
        contentCache[page]?.let { return it }

        return try {
            val content = context.assets.open("content/${page.markdownFile}")
                .bufferedReader()
                .use { it.readText() }
            contentCache[page] = content
            content
        } catch (e: IOException) {
            null
        }
    }

    /**
     * Load metadata from JSON file
     */
    fun loadMetadata(context: Context): ContentMetadataRoot? {
        // Check cache first
        metadataCache?.let { return it }

        return try {
            val jsonString = context.assets.open("content/metadata.json")
                .bufferedReader()
                .use { it.readText() }
            val metadata = json.decodeFromString<ContentMetadataRoot>(jsonString)
            metadataCache = metadata
            metadata
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Get last updated date for a specific page
     */
    fun getLastUpdated(context: Context, page: ContentPage): String? {
        val metadata = loadMetadata(context) ?: return null
        return when (page) {
            ContentPage.ABOUT -> metadata.about.lastUpdated
            ContentPage.PRIVACY -> metadata.privacy.lastUpdated
            ContentPage.TERMS -> metadata.terms.lastUpdated
            ContentPage.CONTACT -> metadata.contact.lastUpdated
        }
    }

    /**
     * Clear all caches
     */
    fun clearCache() {
        contentCache.clear()
        metadataCache = null
    }
}
