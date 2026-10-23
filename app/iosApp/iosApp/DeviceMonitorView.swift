import SwiftUI
import Shared

struct DeviceMonitorView: View {
    @State private var filter = ""
    @State private var foundCount: Int? = nil
    @State private var isScanning = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.title)
                    .foregroundStyle(.tint)
                Text("Device Monitor")
                    .font(.title2)
            }
            TextField("Device name filter", text: $filter)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
            Button(action: scan) {
                Text("Scan")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
            ScanStatus(isScanning: isScanning, foundCount: foundCount)
            Spacer()
        }
        .padding()
    }

    private func scan() {
        let query = filter
        isScanning = true
        foundCount = nil
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            foundCount = SampleDevices.shared.matching(filter: query).count
            isScanning = false
        }
    }
}

private struct ScanStatus: View {
    let isScanning: Bool
    let foundCount: Int?

    var body: some View {
        if isScanning {
            HStack {
                ProgressView()
                Text("Scanning…")
            }
        } else if let foundCount {
            if foundCount == 0 {
                Text("No devices found. Try another filter.")
                    .foregroundStyle(.red)
            } else {
                Text("Devices found: \(foundCount)")
            }
        } else {
            Text("Tap Scan to look for devices.")
        }
    }
}
