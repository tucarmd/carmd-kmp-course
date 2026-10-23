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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.devicemonitor.Device
import com.example.devicemonitor.DeviceListViewModel
import com.example.devicemonitor.ScanState

// Stateful: owns the filter text and connects the shared ViewModel to the content below.
@Composable
fun DeviceListScreen(
    onDeviceClick: (Device) -> Unit,
    viewModel: DeviceListViewModel = viewModel(factory = DeviceListViewModel.Factory),
) {
    var filter by rememberSaveable { mutableStateOf("") }
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    DeviceListContent(
        filter = filter,
        onFilterChange = { filter = it },
        isScanning = state.scan is ScanState.Scanning,
        devices = when (val scan = state.scan) {
            ScanState.Idle -> null
            is ScanState.Scanning -> scan.found
            is ScanState.Finished -> scan.found
        },
        onScan = { viewModel.startScan(filter) },
        onDeviceClick = onDeviceClick,
    )

    state.errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::errorShown,
            confirmButton = { TextButton(onClick = viewModel::errorShown) { Text("OK") } },
            title = { Text("Scan failed") },
            text = { Text(message) },
        )
    }
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
