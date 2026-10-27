package com.example.devicemonitor

// Stand-in for a real BLE scan until Lesson 13.
/**
 * Nguồn thiết bị giả, dùng chung cho cả Android và iOS. (Bài 06 · mục 3, Bài 07 · mục 1)
 *
 * Là `object` (singleton): cả app chỉ có một bản. Kotlin gọi thẳng `SampleDevices.matching(…)`,
 * còn Swift gọi qua instance duy nhất `SampleDevices.shared.matching(filter:)`.
 *
 * Ở đây chưa có `delay`: chờ đợi là việc của màn hình (m01, m02). Bài 08 chuyển việc chờ vào
 * code dùng chung, bài 13 thay cả object này bằng máy quét BLE thật.
 */
object SampleDevices {
    /** Năm thiết bị mẫu, xếp theo tín hiệu mạnh nhất trước. Danh sách trên màn hình giữ đúng thứ tự này. */
    val all: List<Device> = listOf(
        Device(id = "C4:7C:8D:6A:01:10", name = "OBD-II Adapter", rssi = -48),
        Device(id = "C4:7C:8D:6A:01:11", name = "Heart Rate Monitor", rssi = -61),
        Device(id = "C4:7C:8D:6A:01:12", name = "Tire Pressure Sensor", rssi = -67),
        Device(id = "C4:7C:8D:6A:01:13", name = "Thermometer", rssi = -74),
        Device(id = "C4:7C:8D:6A:01:14", name = "Smart Scale", rssi = -85),
    )

    /**
     * Quy tắc lọc của app, viết một lần cho cả hai nền tảng.
     *
     * Tên thiết bị phải *chứa* chuỗi lọc, không phân biệt hoa thường, sau khi bỏ khoảng trắng
     * hai đầu. Chuỗi rỗng khớp mọi thiết bị. Ví dụ: `"sens"` → chỉ Tire Pressure Sensor;
     * `"zzz"` → list rỗng.
     *
     * Swift: `SampleDevices.shared.matching(filter: query)`, trả về `[Device]`.
     *
     * @param filter chữ người dùng gõ trong ô "Device name filter".
     * @return các thiết bị khớp, giữ nguyên thứ tự của [all]; rỗng nếu không có cái nào.
     */
    fun matching(filter: String): List<Device> =
        all.filter { it.name.contains(filter.trim(), ignoreCase = true) }

    /**
     * Tìm một thiết bị theo id. (Bài 07 · mục 1)
     *
     * Có hai chỗ dùng: Compose dựng lại các hàng từ danh sách id đã lưu (vì Bundle không chứa
     * được `Device`), và màn chi tiết lấy thiết bị khi chỉ có id trong tay.
     *
     * Swift: `SampleDevices.shared.find(id:)`, trả về `Device?`, nên phải mở bằng `if let`.
     *
     * @param id id của thiết bị, ví dụ `"C4:7C:8D:6A:01:12"`.
     * @return thiết bị có id đó, hoặc `null` nếu không có (màn chi tiết khi đó hiện "Unknown device").
     */
    fun find(id: String): Device? = all.firstOrNull { it.id == id }
}
