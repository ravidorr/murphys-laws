package com.murphyslaws.presentation.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Light Theme Colors (Material 3) - Matching HTML Design
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF2b6cee),           // Primary blue from HTML
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE3EDFF),
    onPrimaryContainer = Color(0xFF001B3D),
    secondary = Color(0xFF2C3E50),          // Accent color from HTML
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFDBE3ED),
    onSecondaryContainer = Color(0xFF1A1A1A),
    tertiary = Color(0xFF6b7280),           // Subtext color from HTML
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFE5E7EB),
    onTertiaryContainer = Color(0xFF1A1A1A),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
    background = Color(0xFFf6f6f8),         // Background-light from HTML
    onBackground = Color(0xFF1A1A1A),       // Text-light from HTML
    surface = Color(0xFFFFFFFF),            // Surface-light from HTML
    onSurface = Color(0xFF1A1A1A),          // Text-light from HTML
    surfaceVariant = Color(0xFFf6f6f8),
    onSurfaceVariant = Color(0xFF6b7280),   // Subtext-light from HTML
    outline = Color(0xFFE5E7EB),
    outlineVariant = Color(0xFFF3F4F6),
)

// Dark Theme Colors (Material 3)
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    onPrimaryContainer = Color(0xFFEADDFF),
    secondary = Color(0xFFCCC2DC),
    onSecondary = Color(0xFF332D41),
    secondaryContainer = Color(0xFF4A4458),
    onSecondaryContainer = Color(0xFFE8DEF8),
    tertiary = Color(0xFFEFB8C8),
    onTertiary = Color(0xFF492532),
    tertiaryContainer = Color(0xFF633B48),
    onTertiaryContainer = Color(0xFFFFD8E4),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
    background = Color(0xFF1C1B1F),
    onBackground = Color(0xFFE6E1E5),
    surface = Color(0xFF1C1B1F),
    onSurface = Color(0xFFE6E1E5),
    surfaceVariant = Color(0xFF49454F),
    onSurfaceVariant = Color(0xFFCAC4D0),
    outline = Color(0xFF938F99),
    outlineVariant = Color(0xFF49454F),
)

@Composable
fun MurphysLawsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
