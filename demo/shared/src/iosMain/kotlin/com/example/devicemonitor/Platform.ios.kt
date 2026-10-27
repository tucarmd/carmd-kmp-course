package com.example.devicemonitor

import platform.UIKit.UIDevice

/**
 * Bản iOS của [platformName] (`actual` cho `expect` trong commonMain). (Bài 05)
 *
 * Nằm trong `iosMain`, nên gọi thẳng được UIKit qua gói `platform.*` của Kotlin/Native.
 * Swift thấy hàm này là `Platform_iosKt.platformName()`.
 *
 * @return ví dụ `"iOS 26.5"`.
 */
actual fun platformName(): String =
    UIDevice.currentDevice.systemName() + " " + UIDevice.currentDevice.systemVersion
