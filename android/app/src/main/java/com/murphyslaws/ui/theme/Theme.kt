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
import androidx.compose.ui.graphics.Color
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
 *  - `outline` -> `mutedFg` is approximate; DESIGN.md doesn't tokenize a
 *    border colour. Good enough for default M3 outlines.
 *  - `surfaceVariant` is intentionally NOT overridden. Material 3's default
 *    is fine; the previous hand-picked `#F3F4F6` was an "inferred" value
 *    not present in DESIGN.md.
 *  - `errorContainer` / `onErrorContainer` map to the web's error-bg /
 *    error-text pair so banners and snackbars get the same surface treatment.
 */
private val LightColorScheme = lightColorScheme(
    primary = DS.Color.btnPrimaryBg,
    onPrimary = DS.Color.btnPrimaryFg,
    secondary = DS.Color.primary,
    background = DS.Color.bg,
    surface = DS.Color.bg,
    onBackground = DS.Color.fg,
    onSurface = DS.Color.fg,
    outline = DS.Color.mutedFg,
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
    onPrimary = Color.White,
    secondary = DS.Color.darkLink,
    background = DS.Color.darkBgPrimary,
    surface = DS.Color.darkBgPrimary,
    onBackground = DS.Color.darkFgPrimary,
    onSurface = DS.Color.darkFgPrimary,
    outline = DS.Color.darkMutedFg,
    error = DS.Color.error,
    errorContainer = DS.Color.darkErrorBg,
    onError = Color.White,
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
        content = content,
    )
}
