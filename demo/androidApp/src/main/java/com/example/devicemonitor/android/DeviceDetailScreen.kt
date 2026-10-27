package com.example.devicemonitor.android

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.dropUnlessResumed
import com.example.devicemonitor.SampleDevices

/**
 * Màn chi tiết một thiết bị. (Bài 07 · mục 4)
 *
 * Màn này không có state riêng: chỉ nhận id rồi tự tra thiết bị, mọi thứ hiển thị đều suy ra
 * từ id. Id lạ thì hiện "Unknown device" thay vì crash. Icon Bluetooth là icon header cũ của m01.
 *
 * @param deviceId id lấy từ route [DeviceDetail].
 * @param onBack gọi khi bấm nút Back trên màn hình. Back hệ thống thì `NavHost` tự lo.
 */
@Composable
fun DeviceDetailScreen(deviceId: String, onBack: () -> Unit) {
    val device = SampleDevices.find(deviceId)
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Image(
            painter = painterResource(R.drawable.ic_bluetooth),
            contentDescription = null,
            colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary),
            modifier = Modifier.size(96.dp),
        )
        if (device == null) {
            Text("Unknown device", color = MaterialTheme.colorScheme.error)
        } else {
            Text(device.name, style = MaterialTheme.typography.headlineSmall)
            Text("ID: ${device.id}")
            Text("Signal: ${device.rssi} dBm")
        }
        // dropUnlessResumed: bỏ qua cú bấm nếu màn không còn "resumed". Bấm đúp nhanh thì cú
        // thứ hai bị bỏ, nên không pop luôn màn danh sách và để lại màn trắng (Bài 07 · mục 6).
        TextButton(onClick = dropUnlessResumed { onBack() }) {
            Text("Back")
        }
    }
}
