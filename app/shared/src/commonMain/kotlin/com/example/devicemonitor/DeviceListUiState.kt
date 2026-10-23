package com.example.devicemonitor

// Everything the device list shows that the user didn't type.
data class DeviceListUiState(
    val scan: ScanState = ScanState.Idle,
    val errorMessage: String? = null,
)

sealed interface ScanState {
    data object Idle : ScanState
    data class Scanning(val found: List<Device>) : ScanState
    data class Finished(val found: List<Device>) : ScanState
}
