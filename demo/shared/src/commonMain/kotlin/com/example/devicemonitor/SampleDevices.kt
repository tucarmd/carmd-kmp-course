package com.example.devicemonitor

// Stand-in for a real BLE scan until Lesson 13.
object SampleDevices {
    val all: List<Device> = listOf(
        Device(id = "C4:7C:8D:6A:01:10", name = "OBD-II Adapter", rssi = -48),
        Device(id = "C4:7C:8D:6A:01:11", name = "Heart Rate Monitor", rssi = -61),
        Device(id = "C4:7C:8D:6A:01:12", name = "Tire Pressure Sensor", rssi = -67),
        Device(id = "C4:7C:8D:6A:01:13", name = "Thermometer", rssi = -74),
        Device(id = "C4:7C:8D:6A:01:14", name = "Smart Scale", rssi = -85),
    )

    fun matching(filter: String): List<Device> =
        all.filter { it.name.contains(filter.trim(), ignoreCase = true) }

    fun find(id: String): Device? = all.firstOrNull { it.id == id }
}
