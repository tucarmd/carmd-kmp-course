package com.example.devicemonitor.android

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.devicemonitor.Device
import com.example.devicemonitor.SampleDevices
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Stateful: owns the screen's state and the scan side effect.
/**
 * Màn danh sách, phần **có state**: giữ state của màn hình và chạy việc quét. (Bài 07 · mục 1)
 *
 * State gồm ba thứ; mọi thứ hiện trên màn hình đều suy ra từ chúng:
 * - `filter`: chữ trong ô lọc, sống qua xoay máy (`rememberSaveable`).
 * - `foundIds`: id của các thiết bị tìm thấy. `null` = chưa quét lần nào; list rỗng = quét
 *   rồi nhưng không thấy gì. Lưu **id** chứ không lưu `Device`, vì Bundle chỉ chứa được
 *   chuỗi, số…, không chứa được class Kotlin của mình.
 * - `isScanning`: cố ý dùng `remember` thường. Xoay máy giữa lúc quét thì việc quét bị huỷ;
 *   nếu lưu `true` lại, màn hình sẽ kẹt ở "Scanning…" mãi.
 *
 * Phần vẽ nằm ở [DeviceListContent]; bài 08 sẽ thay hàm này bằng một ViewModel dùng chung.
 *
 * @param onDeviceClick gọi khi người dùng bấm một hàng. Màn này không biết bấm xong đi đâu;
 *   [DeviceMonitorApp] quyết định.
 */
@Composable
fun DeviceListScreen(onDeviceClick: (Device) -> Unit) {
    var filter by rememberSaveable { mutableStateOf("") }
    var foundIds by rememberSaveable { mutableStateOf<List<String>?>(null) }
    var isScanning by remember { mutableStateOf(false) }
    // Scope gắn với màn hình này: màn rời khỏi composition (xoay máy) thì coroutine bị huỷ.
    val scope = rememberCoroutineScope()

    DeviceListContent(
        filter = filter,
        onFilterChange = { filter = it },
        isScanning = isScanning,
        // Suy ra lại mỗi lần vẽ: biến id đã lưu thành Device. Id là nguồn sự thật duy nhất.
        devices = foundIds?.mapNotNull { SampleDevices.find(it) },
        onScan = {
            // Chụp chuỗi lọc NGAY lúc bấm; đọc `filter` sau 1,5 s sẽ ra chữ người dùng gõ thêm.
            val query = filter
            // Đổi state đồng bộ trước: frame kế tiếp nút đã tắt, bấm đúp không mở hai lần quét.
            isScanning = true
            foundIds = null
            scope.launch {
                // delay tạm dừng coroutine, KHÔNG chặn main thread: UI vẫn vẽ và nhận chạm.
                delay(1_500)
                foundIds = SampleDevices.matching(query).map { it.id }
                isScanning = false
            }
        },
        onDeviceClick = onDeviceClick,
    )
}

// Stateless: renders whatever it's given, reports events up.
/**
 * Màn danh sách, phần **không state**: chỉ vẽ những gì được đưa vào. (Bài 06 · mục 4–5, Bài 07 · mục 2)
 *
 * "State đi xuống, sự kiện đi lên": giá trị đi vào qua tham số, hành động của người dùng đi ra
 * qua các lambda. Hàm này không tự đổi state nào, nên không thể lệch khỏi state.
 * Compose có thể gọi lại nó rất nhiều lần, nên trong này tuyệt đối không có side effect.
 *
 * @param filter chữ hiện trong ô lọc.
 * @param onFilterChange gọi mỗi lần gõ phím, với chuỗi mới.
 * @param isScanning `true` thì tắt nút Scan và hiện vòng quay.
 * @param devices kết quả quét; `null` = chưa quét, list rỗng = không tìm thấy.
 * @param onScan gọi khi bấm Scan.
 * @param onDeviceClick gọi khi bấm một hàng, kèm thiết bị của hàng đó.
 */
@Composable
fun DeviceListContent(
    filter: String,
    onFilterChange: (String) -> Unit,
    isScanning: Boolean,
    devices: List<Device>?,
    onScan: () -> Unit,
    onDeviceClick: (Device) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Device Monitor", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = filter,
            onValueChange = onFilterChange,
            label = { Text("Device name filter") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(onClick = onScan, enabled = !isScanning, modifier = Modifier.fillMaxWidth()) {
            Text("Scan")
        }
        ScanStatus(isScanning = isScanning, devices = devices)
        // LazyColumn chỉ vẽ các hàng đang thấy; weight(1f) cho nó hết chiều cao còn lại.
        LazyColumn(modifier = Modifier.weight(1f)) {
            // key = id: hàng gắn với thiết bị chứ không gắn với vị trí (Bài 07 · mục 2).
            // orEmpty() biến null ("chưa quét") thành list rỗng.
            items(devices.orEmpty(), key = { it.id }) { device ->
                DeviceRow(device = device, onClick = { onDeviceClick(device) })
                HorizontalDivider()
            }
        }
    }
}

/**
 * Dòng trạng thái dưới nút Scan, tương đương hàm `render()` của toy ở Bài 06 · mục 1.
 *
 * Chữ, màu và vòng quay đều tính lại từ state mỗi lần vẽ ("derive, don't store"), nên không
 * bao giờ còn sót màu đỏ của lần lỗi trước.
 *
 * @param isScanning đang quét thì hiện vòng quay và "Scanning…".
 * @param devices `null` → "Tap Scan…", rỗng → lỗi màu đỏ, còn lại → "Devices found: N".
 */
@Composable
private fun ScanStatus(isScanning: Boolean, devices: List<Device>?) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when {
            isScanning -> {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                Text("Scanning…")
            }
            devices == null -> Text("Tap Scan to look for devices.")
            devices.isEmpty() -> Text(
                "No devices found. Try another filter.",
                color = MaterialTheme.colorScheme.error,
            )
            else -> Text("Devices found: ${devices.size}")
        }
    }
}

/**
 * Một hàng trong danh sách: tên, id bên dưới, tín hiệu bên phải. (Bài 07 · mục 2)
 *
 * @param device thiết bị của hàng.
 * @param onClick gọi khi bấm vào bất kỳ đâu trên hàng (`Modifier.clickable`).
 */
@Composable
private fun DeviceRow(device: Device, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(device.name) },
        supportingContent = { Text(device.id) },
        trailingContent = { Text("${device.rssi} dBm") },
        modifier = Modifier.clickable(onClick = onClick),
    )
}
