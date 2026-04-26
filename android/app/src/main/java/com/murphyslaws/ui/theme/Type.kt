package com.murphyslaws.ui.theme

import androidx.compose.material3.Typography

/**
 * Material 3 Typography mapped from shared/DESIGN.md typography levels via
 * the generated DS.Typography namespace.
 *
 * DESIGN.md exposes 9 semantic levels (display, h1..h4, body-lg..body-sm,
 * caption); Material 3 has its own 5x3 typography slot grid (display /
 * headline / title / body / label x large/medium/small). Mapping below
 * keeps the visual hierarchy intact while populating every Material slot
 * so no app text falls back to untracked M3 defaults.
 *
 *   display    -> displayLarge
 *   h1         -> headlineLarge
 *   h2         -> headlineMedium
 *   h3         -> titleLarge
 *   h4         -> titleMedium
 *   body-lg    -> bodyLarge
 *   body-md    -> bodyMedium
 *   body-sm    -> bodySmall
 *   caption    -> labelSmall
 *
 * The fontFamily on every level is FontFamily.Default until PR Android-3
 * bundles Work Sans into res/font/ and the generator flips to a custom
 * FontFamily.
 */
val Typography = Typography(
    displayLarge = DS.Typography.display,
    displayMedium = DS.Typography.h1,
    displaySmall = DS.Typography.h2,
    headlineLarge = DS.Typography.h1,
    headlineMedium = DS.Typography.h2,
    headlineSmall = DS.Typography.h3,
    titleLarge = DS.Typography.h3,
    titleMedium = DS.Typography.h4,
    titleSmall = DS.Typography.bodyLg,
    bodyLarge = DS.Typography.bodyLg,
    bodyMedium = DS.Typography.bodyMd,
    bodySmall = DS.Typography.bodySm,
    labelLarge = DS.Typography.bodyMd,
    labelMedium = DS.Typography.bodySm,
    labelSmall = DS.Typography.caption,
)
