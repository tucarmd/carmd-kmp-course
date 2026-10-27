import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            DeviceListView()
                .navigationDestination(for: DeviceRoute.self) { route in
                    DeviceDetailView(deviceId: route.id)
                }
        }
    }
}

struct DeviceRoute: Hashable {
    let id: String
}
