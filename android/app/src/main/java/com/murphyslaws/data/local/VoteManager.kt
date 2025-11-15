package com.murphyslaws.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.murphyslaws.domain.model.VoteType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoteManager @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val votesKey = stringPreferencesKey("user_votes")

    /**
     * Get user's vote for a specific law
     */
    fun getVote(lawId: Int): Flow<VoteType?> = dataStore.data.map { prefs ->
        prefs[stringPreferencesKey("vote_$lawId")]?.let { voteValue ->
            VoteType.fromValue(voteValue)
        }
    }

    /**
     * Save user's vote for a specific law
     */
    suspend fun setVote(lawId: Int, voteType: VoteType) {
        dataStore.edit { prefs ->
            prefs[stringPreferencesKey("vote_$lawId")] = voteType.value
        }
    }

    /**
     * Remove user's vote for a specific law
     */
    suspend fun removeVote(lawId: Int) {
        dataStore.edit { prefs ->
            prefs.remove(stringPreferencesKey("vote_$lawId"))
        }
    }

    /**
     * Get all user votes
     */
    fun getAllVotes(): Flow<Map<Int, VoteType>> = dataStore.data.map { prefs ->
        prefs.asMap()
            .filterKeys { it.name.startsWith("vote_") }
            .mapKeys { it.key.name.removePrefix("vote_").toInt() }
            .mapValues { VoteType.fromValue(it.value as String) }
            .filterValues { it != null }
            .mapValues { it.value!! }
    }

    /**
     * Clear all votes
     */
    suspend fun clearAllVotes() {
        dataStore.edit { prefs ->
            prefs.asMap().keys
                .filter { it.name.startsWith("vote_") }
                .forEach { key ->
                    prefs.remove(key)
                }
        }
    }
}
