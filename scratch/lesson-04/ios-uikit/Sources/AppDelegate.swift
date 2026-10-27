import UIKit
import os

let lifecycleLog = Logger(subsystem: "com.example.lesson04", category: "Lifecycle")

let testLifeCycleLog = Logger(subsystem: <#T##String#>, category: <#T##String#>)
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        lifecycleLog.notice("didFinishLaunching")
        
        
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}
