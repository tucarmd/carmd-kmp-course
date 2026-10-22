// Bài 02 · Swift cho dev TypeScript
// Bản quét BLE giả, viết lại chương trình bài 01 bằng Swift.
// Luồng chạy: fakeScan() yield thiết bị → Scanner.start() đọc bằng for await, lọc rssi
//             → gán state → didSet gọi onChange → in ra bằng render().

// MARK: - Model

/// Một thiết bị quét được. `struct` = value type: gán/truyền đi là copy,
/// nên mỗi kết quả quét là một "ảnh chụp" không ai sửa được của ai.
struct Device {
    let name: String?   // có thể nil: thiết bị không phát tên
    let address: String
    let rssi: Int       // cường độ sóng (dBm), càng gần 0 càng mạnh
}

extension Device {
    /// Nhãn hiển thị, vd "Heart Rate (CC:03) -67 dBm".
    /// Computed property: không lưu, mỗi lần đọc thì tính lại. `\(…)` = `${…}` của TS.
    var label: String { "\(name ?? "Unknown") (\(address)) \(rssi) dBm" }
}

/// Trạng thái của một lần quét: tập đóng, bản Swift của `sealed interface` Kotlin.
/// `switch` trên nó phải đủ mọi case.
enum ScanState {
    case idle                   // chưa quét
    case scanning(found: Int)   // đang quét, đã thấy `found` thiết bị qua bộ lọc
    case done([Device])         // quét xong, kèm danh sách cuối
}

// MARK: - Bản quét giả

/// Giả lập sóng radio: cứ 300 ms đẩy ra một thiết bị, hết 3 cái thì đóng stream.
/// Khác `flow { }` của Kotlin: stream này NÓNG, Task bắt đầu chạy ngay khi gọi fakeScan(),
/// giá trị nằm chờ trong buffer cho tới khi có `for await` đọc.
/// Bài 13: callback của CoreBluetooth sẽ gọi `continuation.yield` thay cho đoạn này.
func fakeScan() -> AsyncStream<Device> {
    AsyncStream { continuation in
        // Task không thuộc scope nào: không có gì tự huỷ nó (khác `launch` của Kotlin).
        Task {
            let nearby = [
                Device(name: "OBD-II Dongle", address: "AA:01", rssi: -48),
                Device(name: nil, address: "BB:02", rssi: -91),   // yếu, sẽ bị lọc
                Device(name: "Heart Rate", address: "CC:03", rssi: -67),
            ]
            for device in nearby {
                try? await Task.sleep(for: .milliseconds(300))  // try?: bỏ qua lỗi khi bị huỷ
                continuation.yield(device)                      // = emit() của Kotlin
            }
            continuation.finish()  // báo hết stream, để vòng for await bên kia thoát
        }
    }
}

// MARK: - Scanner

/// Chủ sở hữu trạng thái quét. `class` vì scanner có danh tính: ai giữ cũng là cùng một cái.
/// `@MainActor`: state chỉ được đọc/ghi trên main actor (luồng UI), trình biên dịch ép điều này.
@MainActor
final class Scanner {
    /// Callback báo mỗi lần state đổi. Optional: chưa ai nghe thì là nil.
    var onChange: ((ScanState) -> Void)?

    /// State hiện tại. `private(set)`: bên ngoài chỉ đọc, chỉ Scanner ghi được
    /// (Kotlin cần cặp `_state` / `state` cho việc này).
    private(set) var state: ScanState = .idle {
        // Chạy đồng bộ sau MỖI lần gán → không bỏ sót state nào
        // (khác StateFlow của Kotlin, nên Swift in thêm "Scanning… 2 found").
        didSet { onChange?(state) }
    }

    /// Chạy một lần quét: đọc stream, bỏ thiết bị yếu (rssi <= -80),
    /// cập nhật `.scanning(n)` sau mỗi thiết bị, cuối cùng `.done(danh sách)`.
    func start() async {
        var found: [Device] = []
        for await device in fakeScan() where device.rssi > -80 {
            found.append(device)
            state = .scanning(found: found.count)
        }
        state = .done(found)
    }
}

// MARK: - Render

/// Đổi một state thành dòng chữ để in. `_` = người gọi viết `render(x)`, không có nhãn.
/// `switch` đủ nhánh, không cần `default`.
func render(_ state: ScanState) -> String {
    switch state {
    case .idle:
        return "Idle"
    case .scanning(let found):  // lấy associated value ra thành biến `found`
        return "Scanning… \(found) found"
    case .done(let devices):
        // `\.label` là key path, viết tắt của `{ $0.label }`
        return "Done: " + devices.map(\.label).joined(separator: ", ")
    }
}

// MARK: - Code top-level (chỉ main.swift được có)
// Chạy trên main actor nên đụng được Scanner @MainActor, và được `await` trực tiếp (SE-0343).

let scanner = Scanner()
scanner.onChange = { print(render($0)) }  // mỗi lần state đổi → in một dòng
print(render(scanner.state))              // didSet không chạy cho giá trị đầu, nên in "Idle" bằng tay
await scanner.start()                     // chờ quét xong rồi chương trình thoát
