package com.example.devicemonitor

import android.os.Build

/**
 * Bản Android của [platformName] (`actual` cho `expect` trong commonMain). (Bài 05)
 *
 * Nằm trong `androidMain`, nên được dùng API Android như `Build.VERSION.RELEASE`.
 *
 * @return ví dụ `"Android 14"`.
 */
actual fun platformName(): String = "Android ${Build.VERSION.RELEASE}"
