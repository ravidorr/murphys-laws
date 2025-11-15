package com.murphyslaws.util

object Constants {
    // API Configuration
    const val API_BASE_URL = "https://murphys-laws.com/api/v1/"

    // Pagination
    const val DEFAULT_PAGE_SIZE = 25
    const val PREFETCH_DISTANCE = 5

    // Cache TTL
    const val CACHE_TTL_LAWS = 60 * 60 * 1000L // 1 hour
    const val CACHE_TTL_CATEGORIES = 24 * 60 * 60 * 1000L // 24 hours
    const val CACHE_TTL_ATTRIBUTIONS = 24 * 60 * 60 * 1000L // 24 hours

    // Search
    const val SEARCH_DEBOUNCE_MS = 300L
    const val MIN_SEARCH_LENGTH = 2

    // Vote limits
    const val MAX_VOTES_PER_MINUTE = 30

    // Device ID
    const val PREFS_NAME = "murphys_laws_prefs"
    const val KEY_DEVICE_ID = "device_id"

    // DataStore
    const val DATASTORE_NAME = "murphys_laws_datastore"

    // Database
    const val DATABASE_NAME = "murphys_laws.db"
    const val DATABASE_VERSION = 1

    // Deep Links
    const val DEEP_LINK_SCHEME = "murphyslaws"
    const val DEEP_LINK_HOST_LAW = "law"
}
