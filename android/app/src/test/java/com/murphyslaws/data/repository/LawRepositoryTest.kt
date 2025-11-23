package com.murphyslaws.data.repository

import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.SubmitLawRequest
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LawRepositoryTest {

    private val apiService: ApiService = mockk()
    private val repository = LawRepositoryImpl(apiService)

    @Test
    fun `submitLaw maps parameters to correct DTO fields`() = runTest {
        // Given
        val text = "My Law Text"
        val title = "My Title"
        val name = "John Doe"
        val email = "john@example.com"
        
        val slot = slot<SubmitLawRequest>()
        coEvery { apiService.submitLaw(capture(slot)) } returns mockk()

        // When
        val result = repository.submitLaw(text, title, name, email)

        // Then
        assertTrue(result.isSuccess)
        coVerify { apiService.submitLaw(any()) }
        
        val capturedRequest = slot.captured
        assertEquals(text, capturedRequest.text)
        assertEquals(title, capturedRequest.title)
        assertEquals(name, capturedRequest.authorName) // Verify mapping to authorName (which uses @Json(name="author"))
        assertEquals(email, capturedRequest.authorEmail) // Verify mapping to authorEmail (which uses @Json(name="email"))
    }
}
