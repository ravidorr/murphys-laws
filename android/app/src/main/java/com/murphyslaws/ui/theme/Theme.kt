package com.murphyslaws.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Light Material 3 ColorScheme mapped from shared/DESIGN.md tokens via the
 * generated DS namespace (shared/design-tokens/export-android-tokens.ts).
 *
 * Mapping decisions worth knowing about:
 *  - `primary` -> `btnPrimaryBg` (the WCAG-tuned interaction blue), not the
 *    deep brand navy `DS.Color.primary`. Brand navy lives on `secondary`.
 *  - `outline` -> `surfaceBorder`, the shared solid border token.
 *  - `surfaceVariant` -> `surface`, so cards and text fields do not fall
 *    through to Material 3 defaults.
 *  - `errorContainer` / `onErrorContainer` map to the web's error-bg /
 *    error-text pair so banners and snackbars get the same surface treatment.
 */
private val LightColorScheme = lightColorScheme(
    primary = DS.Color.btnPrimaryBg,
    onPrimary = DS.Color.btnPrimaryFg,
    secondary = DS.Color.primary,
    background = DS.Color.bg,
    surface = DS.Color.surface,
    surfaceVariant = DS.Color.surface,
    onBackground = DS.Color.fg,
    onSurface = DS.Color.fg,
    onSurfaceVariant = DS.Color.mutedFg,
    outline = DS.Color.surfaceBorder,
    error = DS.Color.error,
    errorContainer = DS.Color.errorBg,
    onError = DS.Color.btnPrimaryFg,
    onErrorContainer = DS.Color.errorText,
)

// Dark counterparts use the actual DESIGN.md dark-token names:
//   bg          -> darkBgPrimary    (NOT darkBg, which is a standalone
//                                    "dark emphasis" semantic from the
//                                    light palette)
//   fg          -> darkFgPrimary
//   error-text  -> darkErrorFg      (asymmetric naming in DESIGN.md)
//   error-bg    -> darkErrorBg
private val DarkColorScheme = darkColorScheme(
    primary = DS.Color.darkPrimary,
    onPrimary = DS.Color.btnPrimaryFg,
    secondary = DS.Color.darkLink,
    background = DS.Color.darkBgPrimary,
    surface = DS.Color.darkSurface,
    surfaceVariant = DS.Color.darkSurface,
    onBackground = DS.Color.darkFgPrimary,
    onSurface = DS.Color.darkFgPrimary,
    onSurfaceVariant = DS.Color.darkMutedFg,
    outline = DS.Color.darkSurfaceBorder,
    error = DS.Color.error,
    errorContainer = DS.Color.darkErrorBg,
    onError = DS.Color.btnPrimaryFg,
    onErrorContainer = DS.Color.darkErrorFg,
)

@Composable
fun MurphysLawsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = false, // Disabled to enforce Web App brand
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = !darkTheme
            // Set status bar color using WindowCompat (statusBarColor is deprecated)
            WindowCompat.setDecorFitsSystemWindows(window, false)
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content,
    )
}
