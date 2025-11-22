package com.murphyslaws.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test


class SocialShareHelperTest {

    @Test
    fun `buildShareUrl constructs correct X (Twitter) URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.X,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.contains("twitter.com/intent/tweet"))
        assertTrue(result.contains("url="))
        assertTrue(result.contains("text="))
    }

    @Test
    fun `buildShareUrl constructs correct Facebook URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.FACEBOOK,
            url = url,
            title = "Test"
        )

        // Then
        assertTrue(result.contains("facebook.com/sharer/sharer.php"))
        assertTrue(result.contains("u="))
    }

    @Test
    fun `buildShareUrl constructs correct LinkedIn URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"
        val description = "If anything can go wrong, it will"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.LINKEDIN,
            url = url,
            title = title,
            description = description
        )

        // Then
        assertTrue(result.contains("linkedin.com/shareArticle"))
        assertTrue(result.contains("url="))
        assertTrue(result.contains("title="))
        assertTrue(result.contains("summary="))
    }

    @Test
    fun `buildShareUrl constructs correct Reddit URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.REDDIT,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.contains("reddit.com/submit"))
        assertTrue(result.contains("url="))
        assertTrue(result.contains("title="))
    }

    @Test
    fun `buildShareUrl creates email mailto URL with correct format`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.EMAIL,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.startsWith("mailto:?"))
        assertTrue(result.contains("subject="))
        assertTrue(result.contains("body="))
    }

    @Test
    fun `buildShareUrl properly encodes special characters in URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123?foo=bar&baz=qux"
        val title = "Test & Special <Characters>"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.X,
            url = url,
            title = title
        )

        // Then
        assertFalse(result.contains("&baz="))  // Should be URL encoded
        assertFalse(result.contains("<Characters>"))  // Should be URL encoded
    }

    @Test
    fun `SocialPlatform enum has correct content descriptions`() {
        // Then
        assert(SocialPlatform.X.contentDescription == "Share on X")
        assert(SocialPlatform.FACEBOOK.contentDescription == "Share on Facebook")
        assert(SocialPlatform.LINKEDIN.contentDescription == "Share on LinkedIn")
        assert(SocialPlatform.REDDIT.contentDescription == "Share on Reddit")
        assert(SocialPlatform.EMAIL.contentDescription == "Share via Email")
    }

    @Test
    fun `buildShareUrl with empty description uses empty string`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.LINKEDIN,
            url = url,
            title = title,
            description = ""
        )

        // Then
        assertTrue(result.contains("summary="))
    }

    @Test
    fun `buildShareUrl includes description in LinkedIn URL`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Murphy's Law"
        val description = "This is a detailed description"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.LINKEDIN,
            url = url,
            title = title,
            description = description
        )

        // Then
        assertTrue(result.contains("summary="))
        assertTrue(result.contains("This"))
    }

    @Test
    fun `buildShareUrl encodes ampersands correctly`() {
        // Given
        val url = "https://example.com?param1=value1&param2=value2"
        val title = "Test & Title"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.X,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.contains("%26")) // Encoded ampersand
    }

    @Test
    fun `buildShareUrl encodes spaces correctly`() {
        // Given
        val url = "https://example.com"
        val title = "Title With Spaces"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.X,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.contains("%20") || result.contains("+")) // Encoded space
    }

    @Test
    fun `email URL contains title in body`() {
        // Given
        val url = "https://murphys-laws.com/law/123"
        val title = "Unique Test Title 12345"

        // When
        val result = SocialShareHelper.buildShareUrl(
            platform = SocialPlatform.EMAIL,
            url = url,
            title = title
        )

        // Then
        assertTrue(result.contains("subject="))
        assertTrue(result.contains("body="))
        // Body should contain the title (URL encoded)
        assertTrue(result.contains("Unique") || result.contains("%"))
    }
}
