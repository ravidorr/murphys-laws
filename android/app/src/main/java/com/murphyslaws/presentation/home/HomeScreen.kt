package com.murphyslaws.presentation.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import java.text.SimpleDateFormat
import java.util.*

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") } // Keep this from original, as it's used in OutlinedTextField

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Murphy's Laws",
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = "Anything that can go wrong will go wrong",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery, // Use the state variable
                onValueChange = { searchQuery = it }, // Update the state variable
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search laws...") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true, // Added from original for consistency
                shape = MaterialTheme.shapes.medium
            )

            // Law of the Day Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = buildAnnotatedString {
                                withStyle(style = SpanStyle(color = MaterialTheme.colorScheme.primary)) {
                                    append("Murphy's")
                                }
                                append(" ")
                                withStyle(style = SpanStyle(color = MaterialTheme.colorScheme.onSurface)) {
                                    append("Law of the Day")
                                }
                            },
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 16.sp
                            )
                        )
                        if (uiState.lawOfDay?.date != null) {
                            Text(
                                text = formatDate(uiState.lawOfDay!!.date),
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }

                    if (uiState.isLoading) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(100.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    } else if (uiState.error != null) {
                        Text(
                            text = uiState.error!!,
                            color = MaterialTheme.colorScheme.error
                        )
                    } else if (uiState.lawOfDay != null) {
                        val lawOfDay = uiState.lawOfDay!!
                        Text(
                            text = lawOfDay.law.title ?: "Murphy's Law",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = lawOfDay.law.text,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 20.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Normal
                            ),
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        // Voting and Share Buttons (combined in one row)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Voting Buttons
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Upvote
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    IconButton(
                                        onClick = { /* TODO: Implement upvote */ },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Filled.ThumbUp,
                                            contentDescription = "Upvote",
                                            tint = Color(0xFF10b981),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Text(
                                        text = lawOfDay.law.upvotes.toString(),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }

                                // Downvote
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    IconButton(
                                        onClick = { /* TODO: Implement downvote */ },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Filled.ThumbDown,
                                            contentDescription = "Downvote",
                                            tint = Color(0xFFef4444),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Text(
                                        text = lawOfDay.law.downvotes.toString(),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
                            }

                            // Share Buttons
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                val context = androidx.compose.ui.platform.LocalContext.current
                                val socialButtons = listOf(
                                    Triple(SocialIcons.X, Color(0xFF1DA1F2), com.murphyslaws.util.SocialPlatform.X),
                                    Triple(SocialIcons.Facebook, Color(0xFF1877F2), com.murphyslaws.util.SocialPlatform.FACEBOOK),
                                    Triple(SocialIcons.LinkedIn, Color(0xFF0A66C2), com.murphyslaws.util.SocialPlatform.LINKEDIN),
                                    Triple(SocialIcons.Reddit, Color(0xFFFF4500), com.murphyslaws.util.SocialPlatform.REDDIT),
                                    Triple(SocialIcons.Email, Color(0xFF777777), com.murphyslaws.util.SocialPlatform.EMAIL)
                                )

                                socialButtons.forEach { (icon, color, platform) ->
                                    Surface(
                                        onClick = {
                                            val law = uiState.lawOfDay?.law
                                            if (law != null) {
                                                val url = "https://murphys-laws.com/law/${law.id}"
                                                val title = law.title ?: "Murphy's Law"
                                                val description = law.text
                                                com.murphyslaws.util.SocialShareHelper.shareToSocial(
                                                    context = context,
                                                    platform = platform,
                                                    url = url,
                                                    title = title,
                                                    description = description
                                                )
                                            }
                                        },
                                        shape = androidx.compose.foundation.shape.CircleShape,
                                        color = color,
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = icon,
                                                contentDescription = platform.contentDescription,
                                                tint = Color.White,
                                                modifier = Modifier.size(24.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatDate(dateString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val outputFormat = SimpleDateFormat("MMMM dd, yyyy", Locale.US)
        val date = inputFormat.parse(dateString)
        date?.let { outputFormat.format(it) } ?: dateString
    } catch (e: Exception) {
        dateString
    }
}
