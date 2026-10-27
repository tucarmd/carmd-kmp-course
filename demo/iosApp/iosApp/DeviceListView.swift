import SwiftUI
import Shared

struct DeviceListView: View {
    @State private var filter = ""
    @State private var devices: [Device]? = nil
    @State private var isScanning = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Device name filter", text: $filter)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
            Button(action: scan) {
                Text("Scan")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
            ScanStatus(isScanning: isScanning, devices: devices)
            List(devices ?? [], id: \.id) { device in
                NavigationLink(value: DeviceRoute(id: device.id)) {
                    DeviceRow(device: device)
                }
            }
            .listStyle(.plain)
        }
        .padding()
        .navigationTitle("Device Monitor")
    }

    private func scan() {
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

private struct ScanStatus: View {
    let isScanning: Bool
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

private struct DeviceRow: View {
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
