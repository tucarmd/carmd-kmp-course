plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library")
}

kotlin {
    android {
        namespace = "com.example.devicemonitor.shared"
        compileSdk = 37
        minSdk = 26
    }

    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "Shared"
            isStatic = true
            export("androidx.lifecycle:lifecycle-viewmodel:2.11.0")
            binaryOption("bundleId", "com.example.devicemonitor.shared")
        }
    }

    sourceSets {
        commonMain.dependencies {
            api("androidx.lifecycle:lifecycle-viewmodel:2.11.0")
            api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
        }
    }
}
