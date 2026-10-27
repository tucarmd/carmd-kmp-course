package com.example.devicemonitor

/**
 * Tên và phiên bản hệ điều hành đang chạy. (Bài 05)
 *
 * `expect` nghĩa là: code chung chỉ khai báo chữ ký, không có thân hàm. Mỗi nền tảng bắt buộc
 * có một bản `actual`: `Platform.android.kt` (androidMain) và `Platform.ios.kt` (iosMain).
 * Thiếu một bản là build lỗi.
 *
 * @return ví dụ `"Android 14"` hoặc `"iOS 26.5"`.
 */
expect fun platformName(): String
