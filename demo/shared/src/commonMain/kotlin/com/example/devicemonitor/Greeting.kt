package com.example.devicemonitor

/**
 * Lời chào từ code dùng chung, có từ m00 để chứng minh hai app gọi được Kotlin chung. (Bài 05)
 *
 * Từ m01 không màn hình nào dùng nó nữa, nhưng vẫn giữ lại theo brief.
 */
class Greeting {
    /**
     * @return câu chào kèm tên nền tảng đang chạy, ví dụ
     *   `"Hello from shared Kotlin, running on Android 14"`.
     */
    fun greet(): String = "Hello from shared Kotlin, running on ${platformName()}"
}
