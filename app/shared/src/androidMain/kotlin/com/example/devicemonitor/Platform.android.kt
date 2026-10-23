package com.example.devicemonitor

import android.os.Build

actual fun platformName(): String = "Android ${Build.VERSION.RELEASE}"
