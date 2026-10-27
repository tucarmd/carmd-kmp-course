import SwiftUI

/// Khung app iOS: giữ back stack và nói route nào mở màn hình nào. (Bài 07 · mục 4)
///
/// Bản Swift của `DeviceMonitorApp` bên Compose. Nút back và vuốt-back có sẵn nhờ
/// `NavigationStack`, không cần viết code.
struct ContentView: View {
    var body: some View {
        // NavigationStack sở hữu back stack; màn gốc là danh sách.
        NavigationStack {
            DeviceListView()
                // Gắn kiểu route với màn hình. Đặt trên view gốc, BÊN TRONG stack,
                // không đặt trên chính NavigationStack.
                .navigationDestination(for: DeviceRoute.self) { route in
                    DeviceDetailView(deviceId: route.id)
                }
        }
    }
}

/// Route của màn chi tiết: chỉ mang id. Bản Swift của `DeviceDetail(id)` bên Compose. (Bài 07 · mục 4)
///
/// Phải `Hashable` để `NavigationLink(value:)` đẩy được nó lên stack. Dùng một kiểu riêng
/// thay vì `String` trần để sau này không đụng với màn khác cũng nhận `String`.
struct DeviceRoute: Hashable {
    /// Id của thiết bị được bấm; màn chi tiết tự tra thiết bị từ id này.
    let id: String
}
