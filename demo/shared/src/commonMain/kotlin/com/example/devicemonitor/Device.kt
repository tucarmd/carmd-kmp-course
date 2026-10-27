package com.example.devicemonitor

/**
 * Một thiết bị Bluetooth tìm thấy khi quét. (Bài 06 · mục 3)
 *
 * Là `data class`, nên Kotlin tự sinh `equals`/`hashCode`/`toString`/`copy`: hai `Device`
 * cùng các trường thì bằng nhau. ListAdapter (track XML) dựa vào điều này để biết hàng nào
 * cần vẽ lại.
 *
 * Swift thấy class này là `Device` (trong header là `SharedDevice`).
 *
 * @property id danh tính ổn định của thiết bị. Dùng làm key cho từng hàng trong danh sách
 *   (Bài 07 · mục 2) và là thứ duy nhất route chi tiết mang theo (Bài 07 · mục 4).
 *   Id giả ở đây trông như địa chỉ MAC Android; trên iOS, id BLE thật là một UUID do hệ thống cấp.
 * @property name tên hiển thị, cũng là thứ bộ lọc tìm trong đó.
 * @property rssi cường độ tín hiệu, đơn vị dBm. Số âm, càng gần 0 càng mạnh (-48 mạnh hơn -85).
 */
data class Device(val id: String, val name: String, val rssi: Int)
