package com.murphyslaws.util

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class MarkdownParserTest {

    @Test
    fun `buildAnnotatedString uses the supplied link color`() {
        val linkColor = Color(0xFF9ECBFF)
        val annotatedString = MarkdownParser.buildAnnotatedString(
            text = "Read [docs](https://example.com)",
            links = listOf(
                ExtractedLink(
                    text = "docs",
                    url = "https://example.com",
                    start = 5,
                    end = 32
                )
            ),
            linkColor = linkColor,
            onUrlClick = {}
        )

        val link = annotatedString.getLinkAnnotations(0, annotatedString.length).single()
        val linkAnnotation = link.item as androidx.compose.ui.text.LinkAnnotation.Clickable

        assertEquals("Read docs", annotatedString.text)
        assertEquals(linkColor.value.toLong(), linkAnnotation.styles?.style?.color?.value?.toLong())
    }
}
