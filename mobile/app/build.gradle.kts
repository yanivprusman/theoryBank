import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    id("android-flavors")
}

val gitCommitCount = providers.exec {
    commandLine("git", "rev-list", "--count", "HEAD")
}.standardOutput.asText.get().trim().toIntOrNull() ?: 1

val gitShortHash = providers.exec {
    commandLine("git", "rev-parse", "--short", "HEAD")
}.standardOutput.asText.get().trim().ifEmpty { "dev" }

// Local, gitignored build config (mobile/.env): backend base URL baked at build time.
val envFile = rootProject.file(".env")
val envProps = Properties()
if (envFile.exists()) envFile.inputStream().use { envProps.load(it) }
val apiBaseUrl = envProps.getProperty("API_BASE_URL", "http://10.7.0.1:3159/")
// The web app's Google client: Android sign-in asks Google for an id_token minted
// for it, which the server verifies (/api/auth/token). Public, not a secret.
val googleWebClientId = envProps.getProperty("GOOGLE_WEB_CLIENT_ID")
    ?: throw GradleException("mobile/.env: GOOGLE_WEB_CLIENT_ID is not set (the web app's THEORYBANK_GOOGLE_CLIENT_ID)")

android {
    namespace = "com.automatelinux.theoryBank"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.automatelinux.theoryBank"
        minSdk = 26
        targetSdk = 35
        versionCode = gitCommitCount
        versionName = "v${gitCommitCount} (${gitShortHash})"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Shared KMP module (commonMain code shared with iOS)
    implementation(project(":shared"))
    implementation(libs.kotlinx.datetime)
    implementation(libs.multiplatform.settings)
    implementation(libs.kotlinx.serialization.json)

    // Teachers tab: Google sign-in on the phone, and lesson sync + reminders
    implementation(libs.credentials)
    implementation(libs.credentials.play.services)
    implementation(libs.googleid)
    implementation(libs.work.runtime)

    // Compose BOM
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    // Lifecycle
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)

    // Core
    implementation(libs.core.ktx)
    implementation(libs.activity.compose)
}
