package com.example.devicemonitor.android

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import kotlinx.serialization.Serializable

/**
 * Route của màn danh sách (màn gốc, không có tham số). (Bài 07 · mục 4)
 *
 * Route là một *giá trị* mô tả màn hình cần mở. `@Serializable` để Navigation lưu được
 * back stack khi xoay máy hoặc khi hệ điều hành tạm giết app.
 */
@Serializable
data object DeviceList

/**
 * Route của màn chi tiết. (Bài 07 · mục 4)
 *
 * Chỉ mang id, không mang cả `Device`: route phải nhỏ và lưu được. Màn chi tiết tự tra
 * thiết bị bằng `SampleDevices.find(id)`. Giống URL `/devices/:id` trên web.
 *
 * @property id id của thiết bị được bấm.
 */
@Serializable
data class DeviceDetail(val id: String)

/**
 * Khung app: giữ back stack và quyết định mỗi route là màn hình nào. (Bài 07 · mục 4)
 *
 * Màn danh sách chỉ báo "thiết bị này được bấm" qua `onDeviceClick`; chính hàm này mới
 * quyết định bấm xong thì `navigate` tới đâu. Nút back hệ thống do `NavHost` tự xử lý.
 */
@Composable
fun DeviceMonitorApp() {
    // Bộ điều khiển back stack: navigate() để push, popBackStack() để pop.
    val navController = rememberNavController()
    // Scaffold đưa xuống innerPadding = khoảng cần chừa cho thanh hệ thống.
    Scaffold { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = DeviceList,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable<DeviceList> {
                DeviceListScreen(
                    onDeviceClick = { device -> navController.navigate(DeviceDetail(device.id)) },
                )
            }
            composable<DeviceDetail> { entry ->
                // Lấy lại route có kiểu (kèm id) từ mục trên back stack.
                val route: DeviceDetail = entry.toRoute()
                DeviceDetailScreen(
                    deviceId = route.id,
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
