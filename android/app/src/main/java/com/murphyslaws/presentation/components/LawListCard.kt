package com.murphyslaws.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.murphyslaws.domain.model.Law
import com.murphyslaws.ui.theme.DS

@Composable
fun LawListCard(
    law: Law,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier.padding(DS.Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
        ) {
            // Title (if present)
            if (!law.title.isNullOrBlank()) {
                Text(
                    text = law.title,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold
                    )
                )
            }
            
            // Text
            Text(
                text = law.text,
                style = MaterialTheme.typography.bodyMedium
            )
            
            // Vote Counts (Read-only)
            Row(
                horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s4),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Upvotes
                Row(
                    horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ThumbUp,
                        contentDescription = null,
                        tint = DS.Color.success,
                        modifier = Modifier.size(DS.Spacing.s4)
                    )
                    Text(
                        text = law.upvotes.toString(),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                
                // Downvotes
                Row(
                    horizontalArrangement = Arrangement.spacedBy(DS.Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ThumbDown,
                        contentDescription = null,
                        tint = DS.Color.error,
                        modifier = Modifier.size(DS.Spacing.s4)
                    )
                    Text(
                        text = law.downvotes.toString(),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}
