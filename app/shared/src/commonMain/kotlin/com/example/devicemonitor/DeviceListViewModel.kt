package com.example.devicemonitor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.seconds

class DeviceListViewModel(
    private val scanner: FakeDeviceScanner,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DeviceListUiState())
    val uiState: StateFlow<DeviceListUiState> = _uiState.asStateFlow()

    private var scanJob: Job? = null

    fun startScan(filter: String) {
        if (scanJob?.isActive == true) return
        _uiState.update { it.copy(scan = ScanState.Scanning(emptyList())) }
        scanJob = viewModelScope.launch {
            val found = mutableListOf<Device>()
            try {
                withTimeoutOrNull(SCAN_TIMEOUT) {
                    scanner.scan(filter).collect { device ->
                        found += device
                        _uiState.update { it.copy(scan = ScanState.Scanning(found.toList())) }
                    }
                }
                _uiState.update { it.copy(scan = ScanState.Finished(found.toList())) }
            } catch (e: ScanException) {
                _uiState.update { it.copy(scan = ScanState.Idle, errorMessage = e.message) }
            }
        }
    }

    fun errorShown() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    companion object {
        val SCAN_TIMEOUT = 3.seconds

        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { DeviceListViewModel(FakeDeviceScanner()) }
        }
    }
}
