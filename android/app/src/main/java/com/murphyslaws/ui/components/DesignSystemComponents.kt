package com.murphyslaws.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.VisualTransformation
import com.murphyslaws.ui.theme.DS

object DSShapes {
    val checkbox = RoundedCornerShape(DS.Radius.sm)
    val brandBadge = RoundedCornerShape(DS.Radius.md)
    val button = RoundedCornerShape(DS.Radius.lg)
    val input = RoundedCornerShape(DS.Radius.lg)
    val iconButton = RoundedCornerShape(DS.Radius.lg)
    val card = RoundedCornerShape(DS.Radius.xl)
    val section = RoundedCornerShape(DS.Radius.xl)
    val dropdown = RoundedCornerShape(DS.Radius.xl)
    val modal = RoundedCornerShape(DS.Radius.xl)
    val pill = CircleShape
}

private const val RESULT_SURFACE_ALPHA = 0.1f

@Composable
fun DSButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = DS.Component.controlMinSize),
        enabled = enabled,
        shape = DSShapes.button,
        colors = ButtonDefaults.buttonColors(
            containerColor = DS.Color.btnPrimaryBg,
            contentColor = DS.Color.btnPrimaryFg
        ),
        content = content
    )
}

@Composable
fun DSOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = DS.Component.controlMinSize),
        enabled = enabled,
        shape = DSShapes.button,
        border = BorderStroke(DS.Spacing.s1 / 2, DS.Color.surfaceBorder),
        content = content
    )
}

@Composable
fun DSIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(DS.Component.iconButtonSize)
            .border(DS.Spacing.s1 / 2, DS.Color.surfaceBorder, DSShapes.iconButton),
        enabled = enabled,
        content = content
    )
}

@Composable
fun DSCircularIconButton(
    onClick: () -> Unit,
    color: Color,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = DSShapes.pill,
        color = color,
        modifier = modifier.size(DS.Component.iconButtonSize)
    ) {
        Box(contentAlignment = Alignment.Center) {
            content()
        }
    }
}

@Composable
fun DSCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = DSShapes.card,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(DS.Spacing.s1 / 2, DS.Color.surfaceBorder),
        content = content
    )
}

@Composable
fun DSRow(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier.heightIn(min = DS.Component.controlMinSize),
        shape = DSShapes.input,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(DS.Spacing.s1 / 2, DS.Color.surfaceBorder)
    ) {
        Row(
            modifier = Modifier.padding(DS.Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            content = content
        )
    }
}

@Composable
fun DSResultCard(
    tint: Color,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = DSShapes.card,
        colors = CardDefaults.cardColors(containerColor = tint.copy(alpha = RESULT_SURFACE_ALPHA)),
        border = BorderStroke(DS.Spacing.s1 / 2, tint),
        content = content
    )
}

@Composable
fun DSOutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = false,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    isError: Boolean = false,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    leadingIcon: @Composable (() -> Unit)? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.heightIn(min = DS.Component.controlMinSize),
        singleLine = singleLine,
        maxLines = maxLines,
        isError = isError,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        leadingIcon = leadingIcon,
        shape = DSShapes.input
    )
}

@Composable
fun DSSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    steps: Int,
    modifier: Modifier = Modifier
) {
    Slider(
        value = value,
        onValueChange = onValueChange,
        valueRange = valueRange,
        steps = steps,
        modifier = modifier.heightIn(min = DS.Component.controlMinSize)
    )
}

@Composable
fun DSHeading(
    text: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = text,
        modifier = modifier,
        style = DS.Typography.h2,
        color = DS.Color.fg
    )
}

@Composable
fun DSBrandBadge(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .size(DS.Component.brandBadgeSize)
            .background(DS.Color.primary, DSShapes.brandBadge)
            .clip(DSShapes.brandBadge),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = "M",
            style = DS.Typography.h3,
            color = DS.Color.btnPrimaryFg
        )
    }
}

@Composable
fun DSMessage(
    text: String,
    isError: Boolean,
    modifier: Modifier = Modifier
) {
    Text(
        text = text,
        modifier = modifier
            .fillMaxWidth()
            .background(
                if (isError) DS.Color.errorBg else DS.Color.successBg,
                DSShapes.section
            )
            .padding(DS.Spacing.s3),
        style = DS.Typography.bodySm,
        color = if (isError) DS.Color.errorText else DS.Color.successText
    )
}
