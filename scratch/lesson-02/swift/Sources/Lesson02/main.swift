struct Device {
    let name: String?
    let address: String
    let rssi: Int
}

extension Device {
    var label: String { "\(name ?? "Unknown") (\(address)) \(rssi) dBm" }
}

enum ScanState {
    case idle
    case scanning(found: Int)
    case done([Device])
}

func fakeScan() -> AsyncStream<Device> {
    AsyncStream { continuation in
        Task {
            let nearby = [
                Device(name: "OBD-II Dongle", address: "AA:01", rssi: -48),
                Device(name: nil, address: "BB:02", rssi: -91),
                Device(name: "Heart Rate", address: "CC:03", rssi: -67),
            ]
            for device in nearby {
                try? await Task.sleep(for: .milliseconds(300))
                continuation.yield(device)
            }
            continuation.finish()
        }
    }
}

@MainActor
final class Scanner {
    var onChange: ((ScanState) -> Void)?

    private(set) var state: ScanState = .idle {
        didSet { onChange?(state) }
    }

    func start() async {
        var found: [Device] = []
        for await device in fakeScan() where device.rssi > -80 {
            found.append(device)
            state = .scanning(found: found.count)
        }
        state = .done(found)
    }
}

func render(_ state: ScanState) -> String {
    switch state {
    case .idle:
        return "Idle"
    case .scanning(let found):
        return "Scanning… \(found) found"
    case .done(let devices):
        return "Done: " + devices.map(\.label).joined(separator: ", ")
    }
}

let scanner = Scanner()
scanner.onChange = { print(render($0)) }
print(render(scanner.state))
await scanner.start()
