import SwiftUI
import Shared

/// Màn chi tiết một thiết bị. (Bài 07 · mục 4)
///
/// Không có state riêng: chỉ giữ id và tự tra thiết bị qua `SampleDevices.shared.find(id:)`.
/// Id lạ thì hiện "Unknown device" màu đỏ. Nút back và vuốt-back do `NavigationStack` lo.
struct DeviceDetailView: View {
    /// Id lấy từ `DeviceRoute`.
    let deviceId: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            // find(id:) trả về Device? (Kotlin `Device?`), nên mở bằng if let.
            if let device = SampleDevices.shared.find(id: deviceId) {
                Text(device.name)
                    .font(.title2)
                Text("ID: \(device.id)")
                Text("Signal: \(device.rssi) dBm")
            } else {
                Text("Unknown device")
                    .foregroundStyle(.red)
            }
            Spacer()
        }
        .padding()
        .navigationTitle("Device")
        // Tiêu đề nhỏ trên thanh điều hướng (màn danh sách dùng tiêu đề lớn).
        .navigationBarTitleDisplayMode(.inline)
    }
}
