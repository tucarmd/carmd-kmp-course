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
@Composable
fun DeviceListScreen(onDeviceClick: (Device) -> Unit) {
    var filter by rememberSaveable { mutableStateOf("") }
    var foundIds by rememberSaveable { mutableStateOf<List<String>?>(null) }
    var isScanning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    DeviceListContent(
        filter = filter,
        onFilterChange = { filter = it },
        isScanning = isScanning,
        devices = foundIds?.mapNotNull { SampleDevices.find(it) },
        onScan = {
            val query = filter
            isScanning = true
            foundIds = null
            scope.launch {
                delay(1_500)
                foundIds = SampleDevices.matching(query).map { it.id }
                isScanning = false
            }
        },
        onDeviceClick = onDeviceClick,
    )
}

// Stateless: renders whatever it's given, reports events up.
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
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(devices.orEmpty(), key = { it.id }) { device ->
                DeviceRow(device = device, onClick = { onDeviceClick(device) })
                HorizontalDivider()
            }
        }
    }
}

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

@Composable
private fun DeviceRow(device: Device, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(device.name) },
        supportingContent = { Text(device.id) },
        trailingContent = { Text("${device.rssi} dBm") },
        modifier = Modifier.clickable(onClick = onClick),
    )
}
