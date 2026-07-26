package com.murphyslaws.presentation.lawdetail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.murphyslaws.domain.model.Law
import com.murphyslaws.presentation.home.SocialIcons
import com.murphyslaws.ui.components.DSCircularIconButton
import com.murphyslaws.ui.components.DSCard
import com.murphyslaws.ui.components.DSIconButton
import com.murphyslaws.ui.theme.DS

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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
                .padding(DS.Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s4)
        ) {
            // Law Card
            DSCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(DS.Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
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
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Normal
                        ),
                        modifier = Modifier.padding(bottom = DS.Spacing.s3)
                    )

                    // Voting and Share Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Voting Buttons
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s3),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Upvote
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s1),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                DSIconButton(
                                    onClick = { viewModel.onUpvoteClicked() },
                                    enabled = !uiState.isVoting,
                                    modifier = Modifier.size(DS.Component.iconButtonSize)
                                ) {
                                    Icon(
                                        Icons.Filled.ThumbUp,
                                        contentDescription = "Upvote",
                                        tint = DS.Color.success,
                                        modifier = Modifier.size(DS.Component.buttonIconSize)
                                    )
                                }
                                Text(
                                    text = displayLaw.upvotes.toString(),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }

                            // Downvote
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s1),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                DSIconButton(
                                    onClick = { viewModel.onDownvoteClicked() },
                                    enabled = !uiState.isVoting,
                                    modifier = Modifier.size(DS.Component.iconButtonSize)
                                ) {
                                    Icon(
                                        Icons.Filled.ThumbDown,
                                        contentDescription = "Downvote",
                                        tint = DS.Color.error,
                                        modifier = Modifier.size(DS.Component.buttonIconSize)
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
                            horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
                        ) {
                            val context = LocalContext.current
                            // Third-party brand colors are shared DS tokens.
                            val socialButtons = listOf(
                                Triple(SocialIcons.X, DS.Color.brandSocialX, com.murphyslaws.util.SocialPlatform.X),
                                Triple(SocialIcons.Facebook, DS.Color.brandSocialFacebook, com.murphyslaws.util.SocialPlatform.FACEBOOK),
                                Triple(SocialIcons.LinkedIn, DS.Color.brandSocialLinkedin, com.murphyslaws.util.SocialPlatform.LINKEDIN),
                                Triple(SocialIcons.Reddit, DS.Color.brandSocialReddit, com.murphyslaws.util.SocialPlatform.REDDIT),
                                Triple(SocialIcons.Email, DS.Color.brandSocialEmail, com.murphyslaws.util.SocialPlatform.EMAIL)
                            )

                            socialButtons.forEach { (icon, color, platform) ->
                                DSCircularIconButton(
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
                                    color = color
                                ) {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = platform.contentDescription,
                                        tint = DS.Color.brandSocialIconFg,
                                        modifier = Modifier.size(DS.Component.iconSize)
                                    )
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
                            modifier = Modifier.padding(top = DS.Spacing.s2)
                        )
                    }
                }
            }
        }
    }
}
