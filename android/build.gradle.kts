// Top-level build file where you can add configuration options common to all sub-projects/modules.

// Note: AGP 8.13.1 produces warnings about deprecated multi-string dependency notation
// (com.android.tools.lint:lint-gradle and com.android.tools.build:aapt2).
// These warnings are from AGP's internal dependencies, not our code, and will be fixed
// by Google in a future AGP release before Gradle 10. Safe to ignore.

plugins {
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.2.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.21" apply false
    id("com.google.dagger.hilt.android") version "2.57.2" apply false
    id("com.google.devtools.ksp") version "2.2.21-2.0.4" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.21" apply false
}
