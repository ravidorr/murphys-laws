package com.murphyslaws.presentation.more

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.murphyslaws.domain.model.ContentPage
import androidx.core.net.toUri

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    onNavigateToContent: (ContentPage) -> Unit
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("More") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            // Information Section
            item {
                ListItem(
                    headlineContent = { Text("Information") },
                    colors = ListItemDefaults.colors(
                        headlineColor = MaterialTheme.colorScheme.primary
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("About Murphy's Laws") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        onNavigateToContent(ContentPage.ABOUT)
                    }
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Visit Website") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Language,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        val intent = Intent(Intent.ACTION_VIEW, "https://murphys-laws.com".toUri())
                        context.startActivity(intent)
                    }
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Privacy Policy") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.PrivacyTip,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        onNavigateToContent(ContentPage.PRIVACY)
                    }
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Terms of Service") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Description,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        onNavigateToContent(ContentPage.TERMS)
                    }
                )
            }

            item {
                Divider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // Share Section
            item {
                ListItem(
                    headlineContent = { Text("Share") },
                    colors = ListItemDefaults.colors(
                        headlineColor = MaterialTheme.colorScheme.primary
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Share App") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Share,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, 
                                "Check out Murphy's Laws - an archive of laws, corollaries, and calculators! https://murphys-laws.com")
                            type = "text/plain"
                        }
                        context.startActivity(Intent.createChooser(sendIntent, "Share via"))
                    }
                )
            }

            item {
                Divider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // App Section
            item {
                ListItem(
                    headlineContent = { Text("App") },
                    colors = ListItemDefaults.colors(
                        headlineColor = MaterialTheme.colorScheme.primary
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Version") },
                    supportingContent = { Text("1.0.0") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.PhoneAndroid,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Contact Support") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Email,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        onNavigateToContent(ContentPage.CONTACT)
                    }
                )
            }

            item {
                ListItem(
                    headlineContent = { Text("Email Us") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Filled.Send,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    modifier = Modifier.clickableListItem {
                        val emailIntent = Intent(Intent.ACTION_SENDTO).apply {
                            data = "mailto:contact@murphys-laws.com".toUri()
                        }
                        context.startActivity(emailIntent)
                    }
                )
            }
        }
    }
}

// Helper extension for clickable list items
private fun Modifier.clickableListItem(onClick: () -> Unit): Modifier {
    return this.then(
        Modifier.clickable(
            onClick = onClick
        ).padding(horizontal = 8.dp)
    )
}
