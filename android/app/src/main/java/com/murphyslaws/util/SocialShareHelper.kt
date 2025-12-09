package com.murphyslaws.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import androidx.core.net.toUri

enum class SocialPlatform(val contentDescription: String) {
    X("Share on X"),
    FACEBOOK("Share on Facebook"),
    LINKEDIN("Share on LinkedIn"),
    REDDIT("Share on Reddit"),
    EMAIL("Share via Email")
}

object SocialShareHelper {

    /**
     * Build the share URL for a given platform (testable pure function)
     */
    fun buildShareUrl(
        platform: SocialPlatform,
        url: String,
        title: String,
        description: String = ""
    ): String {
        val encodedUrl = URLEncoder.encode(url, StandardCharsets.UTF_8.toString())
        val encodedTitle = URLEncoder.encode(title, StandardCharsets.UTF_8.toString())
        val encodedDescription = URLEncoder.encode(description, StandardCharsets.UTF_8.toString())

        return when (platform) {
            SocialPlatform.X -> {
                "https://twitter.com/intent/tweet?url=$encodedUrl&text=$encodedTitle"
            }
            SocialPlatform.FACEBOOK -> {
                "https://www.facebook.com/sharer/sharer.php?u=$encodedUrl"
            }
            SocialPlatform.LINKEDIN -> {
                "https://www.linkedin.com/shareArticle?mini=true&url=$encodedUrl&title=$encodedTitle&summary=$encodedDescription"
            }
            SocialPlatform.REDDIT -> {
                "https://www.reddit.com/submit?url=$encodedUrl&title=$encodedTitle"
            }
            SocialPlatform.EMAIL -> {
                val subject = "Check out this Murphy's Law"
                val body = "I found this and thought you'd like it:\n\n$title\n\n$url"
                "mailto:?subject=${URLEncoder.encode(subject, StandardCharsets.UTF_8.toString())}&body=${URLEncoder.encode(body, StandardCharsets.UTF_8.toString())}"
            }
        }
    }

    fun shareToSocial(
        context: Context,
        platform: SocialPlatform,
        url: String,
        title: String,
        description: String = ""
    ) {
        when (platform) {
            SocialPlatform.EMAIL -> {
                val emailUrl = buildShareUrl(platform, url, title, description)
                val intent = Intent(Intent.ACTION_SENDTO, emailUrl.toUri())
                try {
                    context.startActivity(intent)
                } catch (e: Exception) {
                    // Fallback or ignore if no email app
                }
            }
            else -> {
                val shareUrl = buildShareUrl(platform, url, title, description)
                openUrl(context, shareUrl)
            }
        }
    }

    private fun openUrl(context: Context, url: String) {
        val intent = Intent(Intent.ACTION_VIEW, url.toUri())
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            // Handle case where no browser is available
        }
    }
}
