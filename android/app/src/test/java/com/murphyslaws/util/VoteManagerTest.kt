package com.murphyslaws.util

import android.content.SharedPreferences
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.*

class VoteManagerTest {

    private lateinit var mockPreferences: SharedPreferences
    private lateinit var mockEditor: SharedPreferences.Editor
    private lateinit var voteManager: VoteManager

    @Before
    fun setup() {
        mockPreferences = mock(SharedPreferences::class.java)
        mockEditor = mock(SharedPreferences.Editor::class.java)
        
        `when`(mockPreferences.edit()).thenReturn(mockEditor)
        `when`(mockEditor.putString(anyString(), anyString())).thenReturn(mockEditor)
        `when`(mockEditor.remove(anyString())).thenReturn(mockEditor)
        
        voteManager = VoteManager(mockPreferences)
    }

    @Test
    fun `getUserVote returns null when no vote exists`() {
        // Given
        `when`(mockPreferences.getString("vote_123", null)).thenReturn(null)

        // When
        val result = voteManager.getUserVote(123)

        // Then
        assertNull(result)
    }

    @Test
    fun `getUserVote returns up when upvote exists`() {
        // Given
        `when`(mockPreferences.getString("vote_123", null)).thenReturn("up")

        // When
        val result = voteManager.getUserVote(123)

        // Then
        assertEquals("up", result)
    }

    @Test
    fun `getUserVote returns down when downvote exists`() {
        // Given
        `when`(mockPreferences.getString("vote_456", null)).thenReturn("down")

        // When
        val result = voteManager.getUserVote(456)

        // Then
        assertEquals("down", result)
    }

    @Test
    fun `saveVote stores upvote correctly`() {
        // When
        voteManager.saveVote(123, "up")

        // Then
        verify(mockEditor).putString("vote_123", "up")
        verify(mockEditor).apply()
    }

    @Test
    fun `saveVote stores downvote correctly`() {
        // When
        voteManager.saveVote(456, "down")

        // Then
        verify(mockEditor).putString("vote_456", "down")
        verify(mockEditor).apply()
    }

    @Test(expected = IllegalArgumentException::class)
    fun `saveVote throws when invalid voteType provided`() {
        // When/Then
        voteManager.saveVote(123, "invalid")
    }

    @Test
    fun `removeVote clears vote from preferences`() {
        // When
        voteManager.removeVote(123)

        // Then
        verify(mockEditor).remove("vote_123")
        verify(mockEditor).apply()
    }
}
