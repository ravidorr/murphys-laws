package com.murphyslaws.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri

/**
 * Data class for extracted links (both HTML and Markdown)
 */
data class ExtractedLink(
    val text: String,
    val url: String,
    val start: Int,
    val end: Int,
    val isInternal: Boolean = false,
    val navTarget: String? = null
)

/**
 * Enhanced Markdown parser with link handling
 */
object MarkdownParser {
    sealed class MarkdownElement {
        data class Header1(val text: String) : MarkdownElement()
        data class Header2(val text: String) : MarkdownElement()
        data class Header3(val text: String) : MarkdownElement()
        data class Paragraph(val text: String, val links: List<ExtractedLink>) : MarkdownElement()
        data class Quote(val text: String, val links: List<ExtractedLink>) : MarkdownElement()
        data class BulletPoint(val text: String, val links: List<ExtractedLink>) : MarkdownElement()
    }

    fun parse(markdown: String): List<MarkdownElement> {
        val elements = mutableListOf<MarkdownElement>()
        val lines = markdown.lines()
        var currentParagraph = StringBuilder()

        for (line in lines) {
            val trimmed = line.trim()

            when {
                trimmed.isEmpty() -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                }
                trimmed.startsWith("### ") -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                    elements.add(MarkdownElement.Header3(trimmed.substring(4)))
                }
                trimmed.startsWith("## ") -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                    elements.add(MarkdownElement.Header2(trimmed.substring(3)))
                }
                trimmed.startsWith("# ") -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                    elements.add(MarkdownElement.Header1(trimmed.substring(2)))
                }
                trimmed.startsWith("> ") -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                    val quoteText = trimmed.substring(2)
                    elements.add(MarkdownElement.Quote(quoteText, extractLinks(quoteText)))
                }
                trimmed.startsWith("- ") -> {
                    if (currentParagraph.isNotEmpty()) {
                        val text = currentParagraph.toString()
                        elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
                        currentParagraph = StringBuilder()
                    }
                    val bulletText = trimmed.substring(2)
                    elements.add(MarkdownElement.BulletPoint(bulletText, extractLinks(bulletText)))
                }
                else -> {
                    if (currentParagraph.isNotEmpty()) {
                        currentParagraph.append(" ")
                    }
                    currentParagraph.append(trimmed)
                }
            }
        }

        if (currentParagraph.isNotEmpty()) {
            val text = currentParagraph.toString()
            elements.add(MarkdownElement.Paragraph(text, extractLinks(text)))
        }

        return elements
    }

    /**
     * Extract both HTML and Markdown links from text
     */
    private fun extractLinks(text: String): List<ExtractedLink> {
        val links = mutableListOf<ExtractedLink>()
        
        // Extract HTML links: <a href="..." data-nav="...">text</a>
        val htmlLinkRegex = Regex("""<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([^<]*)</a>""")
        val dataNavRegex = Regex("""data-nav=["']([^"']*)["']""")
        
        htmlLinkRegex.findAll(text).forEach { match ->
            val fullMatch = match.value
            val url = match.groupValues[1]
            val linkText = match.groupValues[2]
            val start = match.range.first
            
            // Check for data-nav attribute
            val navMatch = dataNavRegex.find(fullMatch)
            val navTarget = navMatch?.groupValues?.get(1)
            
            links.add(ExtractedLink(
                text = linkText,
                url = url,
                start = start,
                end = match.range.last + 1,
                isInternal = navTarget != null,
                navTarget = navTarget
            ))
        }
        
        // Extract Markdown links: [text](url)
        val markdownLinkRegex = Regex("""\[([^\]]+)]\(([^)]+)\)""")
        markdownLinkRegex.findAll(text).forEach { match ->
            val linkText = match.groupValues[1]
            val url = match.groupValues[2]
            
            links.add(ExtractedLink(
                text = linkText,
                url = url,
                start = match.range.first,
                end = match.range.last + 1,
                isInternal = false
            ))
        }
        
        return links.sortedBy { it.start }
    }

    /**
     * Build annotated string with clickable links
     */
    fun buildAnnotatedString(
        text: String,
        links: List<ExtractedLink>
    ): AnnotatedString {
        // Remove all link syntax and get clean text
        var cleanText = text
        
        // Remove HTML links
        cleanText = cleanText.replace(Regex("""<a\s+(?:[^>]*?\s+)?href=["'][^"']*["'][^>]*>([^<]*)</a>""")) { it.groupValues[1] }
        
        // Remove Markdown links but keep text
        cleanText = cleanText.replace(Regex("""\[([^\]]+)]\([^)]+\)""")) { it.groupValues[1] }
        
        // Parse inline formatting (bold, italic)
        cleanText = cleanText.replace(Regex("""\*\*([^*]+)\*\*""")) { it.groupValues[1] }
        cleanText = cleanText.replace(Regex("""\*([^*]+)\*""")) { it.groupValues[1] }
        
        return buildAnnotatedString {
            append(cleanText)
            
            // Add link annotations based on positions in clean text
            links.forEach { link ->
                val linkStart = cleanText.indexOf(link.text)
                if (linkStart >= 0) {
                    val linkEnd = linkStart + link.text.length
                    
                    // Add visual styling
                    addStyle(
                        SpanStyle(
                            color = Color(0xFF1976D2),
                            textDecoration = TextDecoration.Underline
                        ),
                        linkStart,
                        linkEnd
                    )
                    
                    // Add URL annotation for click handling
                    addStringAnnotation(
                        tag = "URL",
                        annotation = link.url,
                        start = linkStart,
                        end = linkEnd
                    )
                    
                    // Add navigation annotation if internal link
                    if (link.isInternal && link.navTarget != null) {
                        addStringAnnotation(
                            tag = "NAV",
                            annotation = link.navTarget,
                            start = linkStart,
                            end = linkEnd
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MarkdownElement(
    element: MarkdownParser.MarkdownElement,
    modifier: Modifier = Modifier,
    onNavigate: ((String) -> Unit)? = null
) {
    when (element) {
        is MarkdownParser.MarkdownElement.Header1 -> {
            Text(
                text = element.text,
                style = MaterialTheme.typography.headlineMedium,
                modifier = modifier.padding(vertical = 8.dp)
            )
        }
        is MarkdownParser.MarkdownElement.Header2 -> {
            Text(
                text = element.text,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = modifier.padding(vertical = 8.dp)
            )
        }
        is MarkdownParser.MarkdownElement.Header3 -> {
            Text(
                text = element.text,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = modifier.padding(vertical = 4.dp)
            )
        }
        is MarkdownParser.MarkdownElement.Paragraph -> {
            ClickableMarkdownText(
                text = element.text,
                links = element.links,
                style = MaterialTheme.typography.bodyLarge,
                onNavigate = onNavigate,
                modifier = modifier.padding(vertical = 4.dp)
            )
        }
        is MarkdownParser.MarkdownElement.Quote -> {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            ) {
                Row(modifier = Modifier.padding(12.dp)) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .width(4.dp)
                            .fillMaxHeight()
                    ) {}
                    Spacer(modifier = Modifier.width(12.dp))
                    ClickableMarkdownText(
                        text = element.text,
                        links = element.links,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontStyle = FontStyle.Italic
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        onNavigate = onNavigate
                    )
                }
            }
        }
        is MarkdownParser.MarkdownElement.BulletPoint -> {
            Row(
                modifier = modifier
                    .padding(vertical = 2.dp)
                    .padding(start = 16.dp)
            ) {
                Text(
                    text = "•",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(end = 8.dp)
                )
                ClickableMarkdownText(
                    text = element.text,
                    links = element.links,
                    style = MaterialTheme.typography.bodyLarge,
                    onNavigate = onNavigate
                )
            }
        }
    }
}

@Composable
fun ClickableMarkdownText(
    text: String,
    links: List<ExtractedLink>,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    onNavigate: ((String) -> Unit)? = null
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val annotatedString = remember(text, links) {
        MarkdownParser.buildAnnotatedString(text, links)
    }

    ClickableText(
        text = annotatedString,
        style = style.copy(color = color),
        modifier = modifier,
        onClick = { offset ->
            // Check for internal navigation annotations
            annotatedString.getStringAnnotations(tag = "NAV", start = offset, end = offset)
                .firstOrNull()?.let { annotation ->
                    onNavigate?.invoke(annotation.item)
                    return@ClickableText
                }

            // Check for URL annotations
            annotatedString.getStringAnnotations(tag = "URL", start = offset, end = offset)
                .firstOrNull()?.let { annotation ->
                    val url = annotation.item
                    when {
                        url.startsWith("mailto:") -> {
                            // Handle mailto links
                            val intent = Intent(Intent.ACTION_SENDTO).apply {
                                data = url.toUri()
                            }
                            context.startActivity(intent)
                        }
                        url.startsWith("http://") || url.startsWith("https://") -> {
                            // Handle external links
                            uriHandler.openUri(url)
                        }
                    }
                }
        }
    )
}
