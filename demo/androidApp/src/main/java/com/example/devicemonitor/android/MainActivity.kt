package com.example.devicemonitor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme

/**
 * Activity duy nhất của app Android: điểm vào được khai báo trong `AndroidManifest.xml`. (Bài 03, 05)
 *
 * Nó chỉ dựng giao diện Compose; mọi màn hình nằm trong [DeviceMonitorApp].
 * Lưu ý: xoay máy sẽ huỷ và tạo lại Activity này (Bài 03). State nào không "saveable" sẽ mất.
 */
class MainActivity : ComponentActivity() {
    /**
     * Chạy khi Activity được tạo (lần đầu, hoặc sau khi xoay máy).
     *
     * @param savedInstanceState dữ liệu đã lưu từ lần trước; `null` ở lần chạy đầu tiên.
     *   `rememberSaveable` trong Compose tự đọc lại từ đây.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        // Cho app vẽ tràn ra sau thanh trạng thái và thanh điều hướng (cần với targetSdk 36).
        // Phần tránh hai thanh đó do Scaffold lo, qua innerPadding.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            // MaterialTheme cung cấp màu, kiểu chữ, hình dạng cho mọi thành phần Material bên trong.
            MaterialTheme {
                DeviceMonitorApp()
            }
        }
    }
}
