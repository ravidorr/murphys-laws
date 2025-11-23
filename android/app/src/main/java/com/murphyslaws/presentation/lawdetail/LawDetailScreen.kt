package com.murphyslaws.presentation.lawdetail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.murphyslaws.domain.model.Law
import com.murphyslaws.presentation.home.SocialIcons

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LawDetailScreen(
    law: Law,
    viewModel: LawDetailViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    // Set the law in the ViewModel
    LaunchedEffect(law) {
        viewModel.setLaw(law)
    }

    val uiState by viewModel.uiState.collectAsState()
    val displayLaw = uiState.law ?: law // Use updated law from state, fallback to passed law

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(displayLaw.title ?: "Murphy's Law") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Law Card
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
                    // Title
                    if (!displayLaw.title.isNullOrBlank()) {
                        Text(
                            text = displayLaw.title,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }

                    // Law Text
                    Text(
                        text = displayLaw.text,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 20.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Normal
                        ),
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    // Voting and Share Buttons
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
                                    text = displayLaw.upvotes.toString(),
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
                                    text = displayLaw.downvotes.toString(),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }

                        // Share Buttons
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            val context = LocalContext.current
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
                                        val url = "https://murphys-laws.com/law/${displayLaw.id}"
                                        val title = displayLaw.title ?: "Murphy's Law"
                                        val description = displayLaw.text
                                        com.murphyslaws.util.SocialShareHelper.shareToSocial(
                                            context = context,
                                            platform = platform,
                                            url = url,
                                            title = title,
                                            description = description
                                        )
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
