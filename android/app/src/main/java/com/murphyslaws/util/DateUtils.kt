package com.murphyslaws.util

import java.text.SimpleDateFormat
import java.util.Locale

object DateUtils {
    
    /**
     * Format a date string from "yyyy-MM-dd" to "MMMM dd, yyyy"
     * Returns the original string if parsing fails
     */
    fun formatDate(dateString: String): String {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val outputFormat = SimpleDateFormat("MMMM dd, yyyy", Locale.US)
            val date = inputFormat.parse(dateString)
            date?.let { outputFormat.format(it) } ?: dateString
        } catch (e: Exception) {
            dateString
        }
    }
}
