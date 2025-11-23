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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.murphyslaws.domain.model.Law

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
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
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
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Upvotes
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ThumbUp,
                        contentDescription = null,
                        tint = Color(0xFF10b981),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = law.upvotes.toString(),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                
                // Downvotes
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ThumbDown,
                        contentDescription = null,
                        tint = Color(0xFFef4444),
                        modifier = Modifier.size(16.dp)
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
