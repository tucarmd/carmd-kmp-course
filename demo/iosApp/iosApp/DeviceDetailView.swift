import SwiftUI
import Shared

struct DeviceDetailView: View {
    let deviceId: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
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
        .navigationBarTitleDisplayMode(.inline)
    }
}
