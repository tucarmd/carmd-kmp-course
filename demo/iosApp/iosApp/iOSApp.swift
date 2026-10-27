import SwiftUI

/// Điểm vào của app iOS (`@main`). (Bài 04)
///
/// Chỉ mở một cửa sổ (`WindowGroup`) chứa `ContentView`; mọi màn hình nằm trong đó.
/// Khác Android: xoay máy trên iOS không tạo lại màn hình, nên `@State` không mất.
@main
struct iOSApp: App {
    /// Cảnh (scene) của app: một cửa sổ chứa `ContentView`.
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
