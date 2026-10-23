import SwiftUI
import Shared

// Stateful: owns the filter text and connects the shared ViewModel to the content below.
struct DeviceListView: View {
    @State private var observer = DeviceListObserver()
    @State private var filter = ""

    var body: some View {
        let viewModel = observer.viewModel
        let state = observer.state
        DeviceListContent(
            filter: $filter,
            isScanning: state.scan is ScanStateScanning,
            devices: devices(in: state.scan),
            onScan: { viewModel.startScan(filter: filter) }
        )
        .alert(
            "Scan failed",
            isPresented: Binding(
                get: { state.errorMessage != nil },
                set: { if !$0 { viewModel.errorShown() } }
            ),
            actions: { Button("OK") {} },
            message: { Text(state.errorMessage ?? "") }
        )
    }

    // Without SKIE, Swift sees ScanState as a protocol: no exhaustive switch, so cast.
    private func devices(in scan: ScanState) -> [Device]? {
        if let scanning = scan as? ScanStateScanning { return scanning.found }
        if let finished = scan as? ScanStateFinished { return finished.found }
        return nil
    }
}

// Stateless: renders whatever it's given, reports events up.
struct DeviceListContent: View {
    @Binding var filter: String
    let isScanning: Bool
    let devices: [Device]?
    let onScan: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Device name filter", text: $filter)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
            Button(action: onScan) {
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
