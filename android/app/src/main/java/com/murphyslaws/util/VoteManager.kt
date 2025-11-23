package com.murphyslaws.util

import android.content.SharedPreferences

/**
 * Manages vote state in SharedPreferences
 * Mirrors web app's localStorage implementation
 */
class VoteManager(private val sharedPreferences: SharedPreferences) {
    
    companion object {
        private const val VOTES_KEY_PREFIX = "vote_"
    }
    
    /**
     * Get user's vote for a specific law
     * @param lawId The law ID
     * @return "up", "down", or null if no vote exists
     */
    fun getUserVote(lawId: Int): String? {
        return sharedPreferences.getString("$VOTES_KEY_PREFIX$lawId", null)
    }
    
    /**
     * Save a vote for a law
     * @param lawId The law ID
     * @param voteType Either "up" or "down"
     */
    fun saveVote(lawId: Int, voteType: String) {
        require(voteType == "up" || voteType == "down") {
            "voteType must be 'up' or 'down'"
        }
        sharedPreferences.edit()
            .putString("$VOTES_KEY_PREFIX$lawId", voteType)
            .apply()
    }
    
    /**
     * Remove a vote for a law
     * @param lawId The law ID
     */
    fun removeVote(lawId: Int) {
        sharedPreferences.edit()
            .remove("$VOTES_KEY_PREFIX$lawId")
            .apply()
    }
}
