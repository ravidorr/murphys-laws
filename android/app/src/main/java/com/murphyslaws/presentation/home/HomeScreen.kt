package com.murphyslaws.presentation.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onNavigateToSearch: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "Murphy's Laws",
                        style = MaterialTheme.typography.headlineMedium
                    )
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
            // Search Bar (clickable, navigates to search screen)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToSearch() },
                shape = MaterialTheme.shapes.medium,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Filled.Search,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Search laws...",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

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
                                text = com.murphyslaws.util.DateUtils.formatDate(uiState.lawOfDay!!.date),
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
                                        onClick = { viewModel.onUpvoteClicked() },
                                        enabled = !uiState.isVoting,
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
                                        onClick = { viewModel.onDownvoteClicked() },
                                        enabled = !uiState.isVoting,
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
                        
                        // Vote Error Display
                        if (uiState.voteError != null) {
                            Text(
                                text = uiState.voteError!!,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
