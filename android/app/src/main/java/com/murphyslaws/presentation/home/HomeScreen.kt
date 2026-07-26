package com.murphyslaws.presentation.home

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
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.murphyslaws.ui.components.DSCircularIconButton
import com.murphyslaws.ui.components.DSBrandBadge
import com.murphyslaws.ui.components.DSCard
import com.murphyslaws.ui.components.DSIconButton
import com.murphyslaws.ui.components.DSRow
import com.murphyslaws.ui.theme.DS

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
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
                    ) {
                        DSBrandBadge()
                        Text(
                            "Murphy's Laws",
                            style = MaterialTheme.typography.headlineMedium
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
                .padding(DS.Spacing.s4)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s4)
        ) {
            // Search Bar (clickable, navigates to search screen)
            DSRow(
                onClick = onNavigateToSearch,
                modifier = Modifier
                    .fillMaxWidth()
            ) {
                Icon(
                    Icons.Filled.Search,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(DS.Component.iconSize)
                )
                Text(
                    "Search laws...",
                    modifier = Modifier.padding(start = DS.Spacing.s3),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Law of the Day Card
            DSCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(DS.Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
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
                            style = MaterialTheme.typography.labelLarge
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
                                .height(DS.Spacing.s10 + DS.Spacing.s16),
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
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Normal
                            ),
                            modifier = Modifier.padding(bottom = DS.Spacing.s3)
                        )

                        // Voting and Share Buttons (combined in one row)
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
                                        text = lawOfDay.law.upvotes.toString(),
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
                                        text = lawOfDay.law.downvotes.toString(),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
                            }

                            // Share Buttons
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
                            ) {
                                val context = androidx.compose.ui.platform.LocalContext.current
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
}
