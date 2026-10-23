package com.example.devicemonitor.android

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.example.devicemonitor.SampleDevices
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Stateful: owns the screen's state and the scan side effect.
@Composable
fun DeviceMonitorScreen() {
    var filter by rememberSaveable { mutableStateOf("") }
    var foundCount by rememberSaveable { mutableStateOf<Int?>(null) }
    var isScanning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    DeviceMonitorContent(
        filter = filter,
        onFilterChange = { filter = it },
        isScanning = isScanning,
        foundCount = foundCount,
        onScan = {
            val query = filter
            isScanning = true
            foundCount = null
            scope.launch {
                delay(1_500)
                foundCount = SampleDevices.matching(query).size
                isScanning = false
            }
        },
    )
}

// Stateless: renders whatever it's given, reports events up.
@Composable
fun DeviceMonitorContent(
    filter: String,
    onFilterChange: (String) -> Unit,
    isScanning: Boolean,
    foundCount: Int?,
    onScan: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.ic_bluetooth),
                contentDescription = null,
                colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary),
                modifier = Modifier.size(32.dp),
            )
            Text("Device Monitor", style = MaterialTheme.typography.headlineSmall)
        }
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
        ScanStatus(isScanning = isScanning, foundCount = foundCount)
    }
}

@Composable
private fun ScanStatus(isScanning: Boolean, foundCount: Int?) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when {
            isScanning -> {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                Text("Scanning…")
            }
            foundCount == null -> Text("Tap Scan to look for devices.")
            foundCount == 0 -> Text(
                "No devices found. Try another filter.",
                color = MaterialTheme.colorScheme.error,
            )
            else -> Text("Devices found: $foundCount")
        }
    }
}
