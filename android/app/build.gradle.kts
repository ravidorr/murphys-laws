import java.math.BigDecimal

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("jacoco")
    id("kotlin-parcelize")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.murphyslaws"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.murphyslaws"
        minSdk = 26
        targetSdk = 37
        versionCode = 14
        versionName = "1.2.7"

        testInstrumentationRunner = "com.murphyslaws.CustomTestRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            enableUnitTestCoverage = true
            enableAndroidTestCoverage = true
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/LICENSE.md"
            excludes += "META-INF/LICENSE-notice.md"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

// Task to copy shared content into assets
tasks.register<Copy>("copySharedContent") {
    from("${project.rootDir}/../shared/content") {
        include("*.md", "*.json")
    }
    into("${project.projectDir}/src/main/assets/content")
}

// Regenerate Android design tokens from shared/DESIGN.md.
// Outputs (Tokens.kt, colors.xml, values-night/colors.xml, dimens.xml) are
// gitignore: this task ensures they exist and are up to date on every build.
val resolvedNpmExecutable: String? by lazy {
    val candidatePaths = mutableListOf(
        "/usr/local/bin/npm",
        "/opt/homebrew/bin/npm",
        "${System.getProperty("user.home")}/.proto/bin/npm",
        "${System.getProperty("user.home")}/.fnm/current/bin/npm",
        "${System.getProperty("user.home")}/.volta/bin/npm",
        "${System.getProperty("user.home")}/.asdf/shims/npm"
    )

    // Dynamically discover NVM-managed Node versions (latest semver first)
    val nvmVersionsDir = file("${System.getProperty("user.home")}/.nvm/versions/node")
    if (nvmVersionsDir.isDirectory) {
        fun nvmVersionKey(dirName: String): List<Int> =
            dirName.removePrefix("v").split('.').mapNotNull { segment -> segment.toIntOrNull() }

        fun compareNvmVersionsDescending(a: List<Int>, b: List<Int>): Int {
            val maxLen = maxOf(a.size, b.size)
            for (index in 0 until maxLen) {
                val diff = b.getOrElse(index) { 0 } - a.getOrElse(index) { 0 }
                if (diff != 0) {
                    return diff
                }
            }
            return 0
        }

        nvmVersionsDir.listFiles()
            ?.filter { it.isDirectory && it.name.startsWith("v") }
            ?.sortedWith { left, right ->
                compareNvmVersionsDescending(nvmVersionKey(left.name), nvmVersionKey(right.name))
            }
            ?.forEach { versionDir ->
                candidatePaths.add("${versionDir.absolutePath}/bin/npm")
            }
    }

    candidatePaths.firstOrNull { file(it).exists() } ?: try {
        val proc = ProcessBuilder("which", "npm").start()
        if (proc.waitFor() == 0) proc.inputStream.bufferedReader().readText().trim().ifEmpty { null } else null
    } catch (_: Exception) {
        null
    }
}

tasks.register<Exec>("exportDesignTokens") {
    workingDir = file("${project.rootDir}/..")
    val npmPath = resolvedNpmExecutable
    if (npmPath != null) {
        val npmDir = file(npmPath).parent
        executable = npmPath
        args("run", "design:export:android")
        val currentPath = System.getenv("PATH") ?: ""
        environment("PATH", "$npmDir:/usr/local/bin:/opt/homebrew/bin:$currentPath")
    } else {
        // Fallback command so Exec task initialization doesn't throw if npm is missing
        commandLine("echo", "npm not found on PATH; skipping exportDesignTokens")
    }
    isIgnoreExitValue = false
    onlyIf {
        if (npmPath == null) {
            logger.warn(
                "npm not found on PATH; skipping exportDesignTokens. " +
                    "Tokens.kt and the ds_* resources may be missing or stale."
            )
            false
        } else {
            true
        }
    }
}

// Run before processing resource
tasks.named("preBuild") {
    dependsOn("copySharedContent")
    dependsOn("exportDesignTokens")
}


dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation(platform("androidx.compose:compose-bom:2026.05.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.59.2")
    ksp("com.google.dagger:hilt-android-compiler:2.59.2")
    implementation("androidx.hilt:hilt-navigation-compose:1.3.0")
    implementation("androidx.hilt:hilt-lifecycle-viewmodel-compose:1.3.0")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.9.8")

    // Retrofit & Moshi
    implementation("com.squareup.retrofit2:retrofit:3.0.0")
    implementation("com.squareup.retrofit2:converter-moshi:3.0.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.2")
    implementation("com.squareup.okhttp3:logging-interceptor:5.3.2")

    // Kotlinx Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

    // Testing - Unit Tests
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.14.9")
    testImplementation("org.mockito:mockito-core:5.23.0")
    testImplementation("org.mockito:mockito-inline:5.2.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("app.cash.turbine:turbine:1.2.1")
    testImplementation("com.google.truth:truth:1.4.5")
    
    // Testing - Android/Instrumented Tests
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("io.mockk:mockk-android:1.14.9")
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    
    // Testing - Compose UI
    androidTestImplementation(platform("androidx.compose:compose-bom:2026.05.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    
    // Testing - Hilt
    testImplementation("com.google.dagger:hilt-android-testing:2.59.2")
    kspTest("com.google.dagger:hilt-android-compiler:2.59.2")
    androidTestImplementation("com.google.dagger:hilt-android-testing:2.59.2")
    kspAndroidTest("com.google.dagger:hilt-android-compiler:2.59.2")
}

// JaCoCo Configuration
tasks.withType<Test> {
    configure<JacocoTaskExtension> {
        isIncludeNoLocationClasses = true
        excludes = listOf("jdk.internal.*")
    }
}

val jacocoFileFilter = listOf(
        "**/R.class",
        "**/R$*.class",
        "**/BuildConfig.*",
        "**/Manifest*.*",
        "**/*Test*.*",
        "android/**/*.*",
        // Hilt generated
        "**/*_HiltModules*",
        "**/*_Factory*",
        "**/*_MembersInjector*",
        "**/*Module_Provide*Factory*",
        // Moshi generated
        "**/*JsonAdapter*",
        // Android components (Activities, Screens)
        "**/presentation/**/MainActivity*",
        "**/presentation/**/*Screen*",
        "**/MurphysLawsApp*",
        // Navigation
        "**/presentation/navigation/*",
        // Android integration methods in util (require Context, tested via instrumented tests)
        $$"**/util/SocialShareHelper$shareToSocial*",
        $$"**/util/SocialShareHelper$openUrl*"
    )

val jacocoDebugTree = fileTree(project.layout.buildDirectory.asFile.get().resolve(
    "intermediates/built_in_kotlinc/debug/compileDebugKotlin/classes"
)) {
    exclude(jacocoFileFilter)
}

val jacocoMainSrc = "${project.projectDir}/src/main/java"
val jacocoExecutionData = fileTree(project.layout.buildDirectory) {
    include("outputs/unit_test_code_coverage/debugUnitTest/testDebugUnitTest.exec")
}

tasks.register<JacocoReport>("jacocoTestReport") {
    dependsOn("testDebugUnitTest")
    
    reports {
        xml.required.set(true)
        html.required.set(true)
        csv.required.set(false)
    }
    
    sourceDirectories.setFrom(files(jacocoMainSrc))
    classDirectories.setFrom(files(jacocoDebugTree))
    executionData.setFrom(jacocoExecutionData)
}

tasks.register<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
    dependsOn("testDebugUnitTest")

    sourceDirectories.setFrom(files(jacocoMainSrc))
    classDirectories.setFrom(files(jacocoDebugTree))
    executionData.setFrom(jacocoExecutionData)

    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = BigDecimal("0.30")
            }
        }
    }
}
