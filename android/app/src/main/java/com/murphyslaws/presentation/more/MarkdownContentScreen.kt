package com.murphyslaws.presentation.more

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.murphyslaws.domain.model.ContentPage
import com.murphyslaws.util.ContentLoader
import com.murphyslaws.util.MarkdownElement
import com.murphyslaws.util.MarkdownParser

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarkdownContentScreen(
    page: ContentPage,
    onNavigateBack: () -> Unit,
    onNavigateToContent: ((ContentPage) -> Unit)? = null
) {
    val context = LocalContext.current
    var markdown by remember { mutableStateOf<List<MarkdownParser.MarkdownElement>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var lastUpdated by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(page) {
        isLoading = true
        error = null

        val content = ContentLoader.loadContent(context, page)
        if (content != null) {
            markdown = MarkdownParser.parse(content)
            lastUpdated = ContentLoader.getLastUpdated(context, page)
            isLoading = false
        } else {
            error = "Could not load ${page.title} content"
            isLoading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(page.title) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Navigate back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                error != null -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "Content Unavailable",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = error!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        // Show last updated date
                        lastUpdated?.let { date ->
                            item {
                                Text(
                                    text = "Last updated: $date",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(bottom = 8.dp)
                                )
                            }
                        }

                        // Render markdown elements
                        items(markdown) { element ->
                            MarkdownElement(
                                element = element,
                                onNavigate = { navTarget ->
                                    // Handle internal navigation from data-nav attributes
                                    when (navTarget.lowercase()) {
                                        "contact" -> onNavigateToContent?.invoke(ContentPage.CONTACT)
                                        "submit" -> {
                                            // Navigate back and let user access submit via tab
                                            onNavigateBack()
                                        }
                                        "browse" -> {
                                            // Navigate back and let user access browse via tab
                                            onNavigateBack()
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        
                        // Add bottom spacing
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                        }
                    }
                }
            }
        }
    }
}
