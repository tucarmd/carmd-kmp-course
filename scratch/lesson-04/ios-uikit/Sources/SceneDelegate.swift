import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UINavigationController(rootViewController: ViewController())
        window.makeKeyAndVisible()`
        self.window = window
        lifecycleLog.notice("scene willConnect")
    }

    func sceneWillEnterForeground(_ scene: UIScene) { lifecycleLog.notice("sceneWillEnterForeground") }
    func sceneDidBecomeActive(_ scene: UIScene) { lifecycleLog.notice("sceneDidBecomeActive") }
    func sceneWillResignActive(_ scene: UIScene) { lifecycleLog.notice("sceneWillResignActive") }
    func sceneDidEnterBackground(_ scene: UIScene) { lifecycleLog.notice("sceneDidEnterBackground") }
}
