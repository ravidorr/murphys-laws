package com.murphyslaws.presentation.calculators

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.lifecycle.viewmodel.compose.viewModel
import com.murphyslaws.ui.theme.DS

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorsScreen(
    viewModel: CalculatorViewModel = viewModel()
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sod's Law Calculator") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(DS.Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s6)
        ) {
            // Header
            Text(
                text = "Calculate the probability of your task going wrong",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // Result Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        color = viewModel.riskLevel.color.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(DS.Radius.xl)
                    )
                    .border(
                        width = DS.Spacing.s1 / 2,
                        color = viewModel.riskLevel.color.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(DS.Radius.xl)
                    )
                    .padding(DS.Spacing.s6),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
            ) {
                Text(
                    text = viewModel.riskLevel.emoji,
                    style = DS.Typography.display
                )
                Text(
                    text = "${String.format(java.util.Locale.US, "%.1f", viewModel.probability)}%",
                    style = DS.Typography.display,
                    fontWeight = FontWeight.Bold,
                    color = viewModel.riskLevel.color
                )
                Text(
                    text = viewModel.riskLevel.label,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Sliders
            Column(verticalArrangement = Arrangement.spacedBy(DS.Spacing.s4)) {
                ParameterSlider(
                    title = "Urgency",
                    icon = Icons.Filled.AccessTime,
                    value = viewModel.urgency,
                    onValueChange = viewModel::onUrgencyChange,
                    description = "How urgent is this task?"
                )

                ParameterSlider(
                    title = "Complexity",
                    icon = Icons.Filled.Extension, // Puzzle piece equivalent
                    value = viewModel.complexity,
                    onValueChange = viewModel::onComplexityChange,
                    description = "How complex is this task?"
                )

                ParameterSlider(
                    title = "Importance",
                    icon = Icons.Filled.Star,
                    value = viewModel.importance,
                    onValueChange = viewModel::onImportanceChange,
                    description = "How important is this task?"
                )

                ParameterSlider(
                    title = "Skill Level",
                    icon = Icons.Filled.School, // Graduation cap equivalent
                    value = viewModel.skillLevel,
                    onValueChange = viewModel::onSkillLevelChange,
                    description = "Your skill level for this task"
                )

                ParameterSlider(
                    title = "Frequency",
                    icon = Icons.Filled.Repeat,
                    value = viewModel.frequency,
                    onValueChange = viewModel::onFrequencyChange,
                    description = "How often do you do this?"
                )
            }

            // Actions
            Column(verticalArrangement = Arrangement.spacedBy(DS.Spacing.s3)) {
                Button(
                    onClick = {
                        val sendIntent: Intent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, viewModel.shareText)
                            type = "text/plain"
                        }
                        val shareIntent = Intent.createChooser(sendIntent, null)
                        context.startActivity(shareIntent)
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Filled.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(DS.Spacing.s2))
                    Text("Share Results")
                }

                OutlinedButton(
                    onClick = {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "message/rfc822" // Email MIME type
                            putExtra(Intent.EXTRA_SUBJECT, "Sod's Law Calculation Results")
                            putExtra(Intent.EXTRA_TEXT, viewModel.shareText)
                        }
                        // Try to start email intent, fallback to chooser if no specific email app found
                        try {
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            // Fallback to plain text share if no email client
                            val shareIntent = Intent.createChooser(intent, "Send email...")
                            context.startActivity(shareIntent)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Filled.Email, contentDescription = null)
                    Spacer(modifier = Modifier.width(DS.Spacing.s2))
                    Text("Email Results")
                }

                TextButton(
                    onClick = viewModel::reset,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Filled.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(DS.Spacing.s2))
                    Text("Reset")
                }
            }
            
            // Bottom spacing
            Spacer(modifier = Modifier.height(DS.Spacing.s8))
        }
    }
}
