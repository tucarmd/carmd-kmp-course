import SwiftUI
import Shared

/// Màn danh sách: ô lọc, nút Scan, dòng trạng thái và các hàng kết quả. (Bài 06–07)
///
/// State nằm trong ba biến `@State`. SwiftUI giữ chúng bên ngoài struct, nên struct bị tạo
/// lại liên tục mà state vẫn còn. Mọi thứ hiện ra đều suy ra từ state.
/// Màn này nằm dưới màn chi tiết khi push, nên quay lại thì state vẫn y nguyên.
struct DeviceListView: View {
    /// Chữ trong ô lọc, nối hai chiều với `TextField` qua `$filter` (một Binding).
    @State private var filter = ""
    /// Kết quả quét. `nil` = chưa quét lần nào; mảng rỗng = quét rồi nhưng không thấy gì.
    /// Lưu thẳng `Device` được, vì `@State` không phải đi qua Bundle như Android.
    @State private var devices: [Device]? = nil
    /// `true` trong khoảng 1,5 giây đang quét: tắt nút, hiện vòng quay.
    @State private var isScanning = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Device name filter", text: $filter)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
            Button(action: scan) {
                // frame đặt trên label (Text), không đặt trên Button,
                // nếu không nút sẽ nhỏ ở giữa một khung rộng vô hình (Bài 06 · mục 7).
                Text("Scan")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
            ScanStatus(isScanning: isScanning, devices: devices)
            // id: \.id là key của từng hàng (Device từ Kotlin không conform Identifiable).
            // `?? []` biến nil ("chưa quét") thành mảng rỗng.
            List(devices ?? [], id: \.id) { device in
                // Bấm hàng = đẩy một giá trị route lên stack; ContentView quyết định mở màn nào.
                NavigationLink(value: DeviceRoute(id: device.id)) {
                    DeviceRow(device: device)
                }
            }
            .listStyle(.plain)
        }
        .padding()
        .navigationTitle("Device Monitor")
    }

    /// Xử lý nút Scan. Đây là nơi duy nhất đổi state; `body` không có side effect.
    ///
    /// Đổi state ngay (tắt nút, xoá kết quả cũ), rồi chờ 1,5 giây trong một `Task`, rồi gán
    /// kết quả. `View` là `@MainActor` và `Task { }` thừa hưởng điều đó, nên các dòng sau
    /// `await` vẫn chạy trên main thread. Task này không bị huỷ khi rời màn hình; bài 08 sửa.
    private func scan() {
        // Chụp chuỗi lọc lúc bấm, không đọc lại sau khi chờ.
        let query = filter
        isScanning = true
        devices = nil
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            devices = SampleDevices.shared.matching(filter: query)
            isScanning = false
        }
    }
}

/// Dòng trạng thái: một `if/else` trên state, tương đương `render()` của toy ở Bài 06 · mục 1.
///
/// Nhận giá trị thường (không phải `@State`): view cha giữ state và truyền xuống.
private struct ScanStatus: View {
    /// Đang quét thì hiện `ProgressView` và "Scanning…".
    let isScanning: Bool
    /// `nil` → "Tap Scan…", rỗng → lỗi màu đỏ, còn lại → "Devices found: N".
    let devices: [Device]?

    var body: some View {
        if isScanning {
            HStack {
                ProgressView()
                Text("Scanning…")
            }
        } else if let devices {
            if devices.isEmpty {
                Text("No devices found. Try another filter.")
                    .foregroundStyle(.red)
            } else {
                Text("Devices found: \(devices.count)")
            }
        } else {
            Text("Tap Scan to look for devices.")
        }
    }
}

/// Một hàng: tên và id xếp dọc bên trái, tín hiệu bên phải. `NavigationLink` thêm mũi tên `>`.
private struct DeviceRow: View {
    /// Thiết bị của hàng.
    let device: Device

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(device.name)
                Text(device.id)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(device.rssi) dBm")
                .font(.caption)
        }
    }
}
