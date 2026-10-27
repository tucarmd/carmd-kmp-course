import SwiftUI
import os

let lifecycleLog = Logger(subsystem: "com.example.lesson04", category: "Lifecycle")

@main
struct Lesson04App: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        lifecycleLog.notice("App init")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active: lifecycleLog.notice("scenePhase → active")
            case .inactive: lifecycleLog.notice("scenePhase → inactive")
            case .background: lifecycleLog.notice("scenePhase → background")
            @unknown default: lifecycleLog.notice("scenePhase → unknown")
            }
        }
    }
}
