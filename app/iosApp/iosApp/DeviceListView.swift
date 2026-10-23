import SwiftUI
import Shared

// Stateful: owns the filter text and connects the shared ViewModel to the content below.
struct DeviceListView: View {
    @State private var owner = ViewModelOwner()
    @State private var filter = ""
    @State private var state: DeviceListUiState?

    var body: some View {
        let viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
        let state = self.state ?? viewModel.uiState.value
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
        .task {
            for await newState in viewModel.uiState {
                self.state = newState
            }
        }
    }

    // SKIE turns the sealed interface into a Swift enum, so this switch is exhaustive.
    private func devices(in scan: ScanState) -> [Device]? {
        switch onEnum(of: scan) {
        case .idle: nil
        case .scanning(let scanning): scanning.found
        case .finished(let finished): finished.found
        }
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
