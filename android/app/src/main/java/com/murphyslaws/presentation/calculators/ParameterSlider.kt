package com.murphyslaws.presentation.calculators

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import com.murphyslaws.ui.components.DSCard
import com.murphyslaws.ui.components.DSSlider
import com.murphyslaws.ui.theme.DS

@Composable
fun ParameterSlider(
    title: String,
    icon: ImageVector,
    value: Double,
    onValueChange: (Double) -> Unit,
    description: String,
    modifier: Modifier = Modifier
) {
    DSCard(
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(DS.Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s2)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(DS.Component.iconSize)
                    )
                    Spacer(modifier = Modifier.width(DS.Spacing.s2))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = value.toInt().toString(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            DSSlider(
                value = value.toFloat(),
                onValueChange = { onValueChange(it.toDouble()) },
                valueRange = 1f..10f,
                steps = 8,
                modifier = Modifier.fillMaxWidth()
            )

            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
