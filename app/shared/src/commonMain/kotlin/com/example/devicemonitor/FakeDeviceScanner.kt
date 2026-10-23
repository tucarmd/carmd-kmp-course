package com.example.devicemonitor

import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class ScanException(message: String) : Exception(message)

// Stand-in for the BLE scanner of Lesson 13. Like a real scan, devices arrive one at a
// time and the flow never completes on its own: the collector stops it by cancelling.
class FakeDeviceScanner {
    fun scan(filter: String): Flow<Device> = flow {
        // Test hook for now: the filter "fail" simulates a radio error.
        if (filter.trim().equals("fail", ignoreCase = true)) {
            delay(500)
            throw ScanException("Bluetooth adapter not responding (simulated).")
        }
        for (device in SampleDevices.matching(filter)) {
            delay(300)
            emit(device)
        }
        awaitCancellation()
    }
}
