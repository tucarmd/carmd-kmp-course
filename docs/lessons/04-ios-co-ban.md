---
source: lessons/04-ios-fundamentals.html
source_sha: f6beeae
---

# iOS cơ bản

<p class="kicker">Bài 04 · Tuần 1 · Ngày 4 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/04-ios-fundamentals.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~1,75 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: app nháp (iOS)</span>
  <span class="tag">Cần trước: <a href="../03-android-co-ban/">03</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Một monitor chạy nền móc vào sai vòng đời sẽ không bao giờ nhận ra app đã xuống nền. iOS tách câu hỏi "app có đang ở phía trước không?" khỏi câu hỏi "màn hình này có đang hiện không?", và chỉ một trong hai cho bạn biết điều đó.
    Hôm nay bạn dựng một app iOS nhỏ xíu ghi log cả hai loại sự kiện, rồi xem log trong lúc bạn chọc vào app.

!!! info "Nguồn chính"
    [Managing your app's life cycle](https://developer.apple.com/documentation/uikit/managing-your-app-s-life-cycle) của Apple, cộng với [`ScenePhase`](https://developer.apple.com/documentation/swiftui/scenephase) của SwiftUI.

!!! info "Track"
    Bản gốc có nút chọn track UI. Ở đây, chỗ nào hai track khác nhau thì có hai tab **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Phần lớn ý tưởng hôm nay giống nhau trên cả hai track. Chỉ đoạn code đưa thứ gì đó lên màn hình là khác.

## 1. Trong một project iOS có gì

Ở đây project Xcode được *sinh ra* từ một file `project.yml` nhỏ bằng [XcodeGen](https://github.com/yonaskolb/XcodeGen), nên nó có thể được tạo và diff dưới dạng text. Tạo project qua hộp thoại "New Project" của Xcode cũng ra cùng cấu trúc.

=== "SwiftUI"

    <figure class="diagram">
    <svg class="dg" viewBox="0 0 640 176" role="img" aria-labelledby="l04-tree-swiftui-title">
    <title id="l04-tree-swiftui-title">Các file của project iOS nháp ở track SwiftUI và việc của từng file. project.yml là spec XcodeGen sinh ra Lesson04iOS.xcodeproj. Sources/Lesson04App.swift là App @main, cửa vào và các scene của nó. Sources/ContentView.swift giữ các view. Sources/Info.plist giữ metadata của app và các chuỗi xin quyền, và XcodeGen sinh nó từ project.yml.</title>
    <text class="mono" x="20" y="16">Lesson04iOS/</text>
    <rect class="box" x="20" y="28" width="240" height="28" rx="6"/><text class="mono small" x="30" y="46">project.yml</text>
    <text class="small muted" x="280" y="46">spec XcodeGen → sinh ra Lesson04iOS.xcodeproj</text>
    <rect class="box" x="20" y="64" width="240" height="28" rx="6"/><text class="mono small" x="30" y="82">Sources/Lesson04App.swift</text>
    <text class="small muted" x="280" y="82">App @main: cửa vào và các scene</text>
    <rect class="box" x="20" y="100" width="240" height="28" rx="6"/><text class="mono small" x="30" y="118">Sources/ContentView.swift</text>
    <text class="small muted" x="280" y="118">các view</text>
    <rect class="box" x="20" y="136" width="240" height="28" rx="6"/><text class="mono small" x="30" y="154">Sources/Info.plist</text>
    <text class="small muted" x="280" y="154">metadata của app + chuỗi xin quyền; được sinh ra</text>
    </svg>
    <figcaption>Project của track SwiftUI.</figcaption>
    </figure>

=== "UIKit"

    <figure class="diagram">
    <svg class="dg" viewBox="0 0 640 212" role="img" aria-labelledby="l04-tree-uikit-title">
    <title id="l04-tree-uikit-title">Các file của project iOS nháp ở track UIKit và việc của từng file. project.yml là spec XcodeGen sinh ra Lesson04iOS.xcodeproj. Sources/AppDelegate.swift là class @main cho các sự kiện cấp process. Sources/SceneDelegate.swift xử lý sự kiện cửa sổ và scene, và dựng màn hình đầu tiên. Sources/ViewController.swift giữ màn hình đầu tiên và màn hình chi tiết. Sources/Info.plist giữ metadata, chuỗi xin quyền và cấu hình scene, và XcodeGen sinh nó từ project.yml.</title>
    <text class="mono" x="20" y="16">Lesson04iOS/</text>
    <rect class="box" x="20" y="28" width="240" height="28" rx="6"/><text class="mono small" x="30" y="46">project.yml</text>
    <text class="small muted" x="280" y="46">spec XcodeGen → sinh ra Lesson04iOS.xcodeproj</text>
    <rect class="box" x="20" y="64" width="240" height="28" rx="6"/><text class="mono small" x="30" y="82">Sources/AppDelegate.swift</text>
    <text class="small muted" x="280" y="82">@main: sự kiện cấp process</text>
    <rect class="box" x="20" y="100" width="240" height="28" rx="6"/><text class="mono small" x="30" y="118">Sources/SceneDelegate.swift</text>
    <text class="small muted" x="280" y="118">sự kiện cửa sổ/scene; dựng màn hình đầu tiên</text>
    <rect class="box" x="20" y="136" width="240" height="28" rx="6"/><text class="mono small" x="30" y="154">Sources/ViewController.swift</text>
    <text class="small muted" x="280" y="154">màn hình đầu tiên và màn hình chi tiết</text>
    <rect class="box" x="20" y="172" width="240" height="28" rx="6"/><text class="mono small" x="30" y="190">Sources/Info.plist</text>
    <text class="small muted" x="280" y="190">metadata, cấu hình scene; được sinh ra</text>
    </svg>
    <figcaption>Project của track UIKit.</figcaption>
    </figure>

Nếu bạn vừa làm xong bài 03, đây là các thứ tương đương gần đúng bên Android:

| Android | iOS |
|---|---|
| `AndroidManifest.xml` | `Info.plist` |
| Gradle module | Xcode target |
| Activity | **SwiftUI:** một `Scene` cùng view gốc của nó · **UIKit:** một scene cùng root view controller của nó |

## 2. Info.plist

Info.plist là từ điển metadata của app: tên hiển thị, phiên bản, launch screen, và sau này là các **chuỗi usage-description** mà iOS hiện trong hộp thoại xin quyền ([Apple: Information property list](https://developer.apple.com/documentation/bundleresources/information-property-list)).
Xin quyền Bluetooth mà thiếu `NSBluetoothAlwaysUsageDescription` thì bạn không nhận được một lời từ chối lịch sự; app bị tắt luôn. Bạn sẽ thêm nó ở bài 12.

Với XcodeGen bạn không tự viết Info.plist. Mục `info` của `project.yml` giữ nội dung của nó, và `xcodegen generate` ghi ra file.

=== "SwiftUI"

    ```yaml title="project.yml" hl_lines="11 12 13 14"
    name: Lesson04iOS
    options:
      bundleIdPrefix: com.example
      deploymentTarget:
        iOS: "17.0"
    targets:
      Lesson04iOS:
        type: application
        platform: iOS
        sources: [Sources]
        info:
          path: Sources/Info.plist
          properties:
            CFBundleDisplayName: Lesson 04
            UILaunchScreen: {}
        settings:
          base:
            SWIFT_VERSION: "6.0"
            MARKETING_VERSION: "1.0"
            CURRENT_PROJECT_VERSION: "1"
    ```

    Track SwiftUI không cần gì ngoài tên hiển thị và launch screen. `App` của SwiftUI tự tạo scene của nó.

=== "UIKit"

    ```yaml title="project.yml" hl_lines="7 8 9 10 11 12"
    ⋯ name, options, target type, settings
        info:
          path: Sources/Info.plist
          properties:
            CFBundleDisplayName: "Lesson 04"
            UILaunchScreen: {}
            UIApplicationSceneManifest:
              UIApplicationSupportsMultipleScenes: false
              UISceneConfigurations:
                UIWindowSceneSessionRoleApplication:
                  - UISceneConfigurationName: "Default Configuration"
                    UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate"
    ```

    Mục `UIApplicationSceneManifest` là cách UIKit tìm ra scene delegate của bạn: nó nêu tên class `SceneDelegate` chạy mỗi cửa sổ. Thiếu nó, scene delegate không bao giờ chạy và không có cửa sổ nào hiện ra.

## 3. Hai vòng đời, không phải một

Android gắn câu hỏi "màn hình này có đang hiện không?" và "app có đang ở phía trước không?" vào cùng các callback của Activity. iOS tách chúng ra:

- **Cấp app/scene:** cửa sổ của app đang active, inactive, hay ở background?
  **SwiftUI:** SwiftUI đưa ra thông tin này dưới dạng [`scenePhase`](https://developer.apple.com/documentation/swiftui/scenephase).
  **UIKit:** UIKit gửi nó tới [scene delegate](https://developer.apple.com/documentation/uikit/uiscenedelegate) (`sceneDidBecomeActive`, `sceneDidEnterBackground`, …).
- **Cấp view:** *màn hình này* vừa hiện ra hay biến mất bên trong app?
  **SwiftUI:** [`onAppear`](https://developer.apple.com/documentation/swiftui/view/onappear(perform:)) / `onDisappear`.
  **UIKit:** [`viewDidLoad`, `viewWillAppear`, `viewDidAppear`, `viewWillDisappear`, `viewDidDisappear`](https://developer.apple.com/documentation/uikit/uiviewcontroller).

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 230" role="img" aria-labelledby="l04-levels-title">
<title id="l04-levels-title">Hai tầng vòng đời của iOS. Tầng app và scene trả lời câu hỏi cửa sổ của app có đang ở trước mặt người dùng không, và chuyển giữa background, inactive và active. Tầng view trả lời câu hỏi một màn hình vừa hiện ra hay biến mất bên trong app, và chuyển giữa disappeared và appeared. Hai tầng độc lập với nhau: một màn hình có thể vẫn appeared trong khi scene xuống background.</title>
<defs><marker id="l04-levels-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="edge" x="20" y="14" width="600" height="98" rx="8"/>
<text x="36" y="36" font-weight="600">Cấp app / scene</text>
<text class="small muted" x="36" y="52">Cửa sổ của app có đang ở trước mặt người dùng không?</text>
<rect class="box" x="40" y="64" width="150" height="34" rx="6"/><text class="mono" x="115" y="86" text-anchor="middle">background</text>
<rect class="box" x="245" y="64" width="150" height="34" rx="6"/><text class="mono" x="320" y="86" text-anchor="middle">inactive</text>
<rect class="box" x="450" y="64" width="150" height="34" rx="6"/><text class="mono" x="525" y="86" text-anchor="middle">active</text>
<path class="edge" d="M192,81 L243,81" marker-start="url(#l04-levels-arrow)" marker-end="url(#l04-levels-arrow)"/>
<path class="edge" d="M397,81 L448,81" marker-start="url(#l04-levels-arrow)" marker-end="url(#l04-levels-arrow)"/>
<rect class="edge" x="20" y="126" width="600" height="92" rx="8"/>
<text x="36" y="148" font-weight="600">Cấp view</text>
<text class="small muted" x="36" y="164">Màn hình này vừa hiện ra hay biến mất bên trong app?</text>
<rect class="box" x="140" y="176" width="150" height="34" rx="6"/><text class="mono" x="215" y="198" text-anchor="middle">disappeared</text>
<rect class="box" x="350" y="176" width="150" height="34" rx="6"/><text class="mono" x="425" y="198" text-anchor="middle">appeared</text>
<path class="edge" d="M292,193 L348,193" marker-start="url(#l04-levels-arrow)" marker-end="url(#l04-levels-arrow)"/>
</svg>
<figcaption>Hai câu hỏi riêng với hai bộ callback riêng. Đi qua lại bên trong app làm hàng dưới đổi; rời khỏi app làm hàng trên đổi.</figcaption>
</figure>

Việc ghi log dùng [`Logger`](https://developer.apple.com/documentation/os/logger) của Apple, thứ tương đương `Log.d(TAG, …)` của Android: subsystem + category ↔ tag.
Output hiện trong console của Xcode, nơi bạn lọc được theo `Lifecycle`. Subsystem là chuỗi bất kỳ bạn chọn (ở đây là `com.example.lesson04`, không phải bundle ID), nên hãy lọc theo nó hoặc theo category.
Mỗi đoạn trích dưới đây chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

=== "SwiftUI"

    ```swift title="Sources/Lesson04App.swift" hl_lines="2 4 5 6"
    ⋯ imports
    let lifecycleLog = Logger(subsystem: "com.example.lesson04", category: "Lifecycle")

    @main
    struct Lesson04App: App {
        @Environment(\.scenePhase) private var scenePhase

        init() {
            lifecycleLog.notice("App init")
        }
    ⋯ var body
    }
    ```

    ```swift title="Sources/Lesson04App.swift" hl_lines="6 8 11"
    ⋯ imports, lifecycleLog, init()
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
    ```

    ```swift title="Sources/ContentView.swift" hl_lines="12 13"
    ⋯ import SwiftUI
    struct ContentView: View {
        var body: some View {
            NavigationStack {
                VStack(spacing: 16) {
                    Text("Lesson 04: watch the Xcode console")
                    NavigationLink("Open detail screen") {
                        DetailView()
                    }
                }
                .navigationTitle("Lifecycle")
                .onAppear { lifecycleLog.notice("ContentView onAppear") }
                .onDisappear { lifecycleLog.notice("ContentView onDisappear") }
            }
        }
    }
    ⋯ DetailView: the same two modifiers on a Text
    ```

    1. `@main struct … : App` là cửa vào. Không có AppDelegate; SwiftUI sở hữu object app.
    2. `@Environment(\.scenePhase)` đọc một giá trị do SwiftUI cung cấp. Theo dõi nó bằng `.onChange(of:)` ở cấp `Scene` cho bạn vòng đời cấp app.
    3. Mỗi message log là một chuỗi cố định cho từng case. Mặc định Logger che các chuỗi *interpolate* và object, và có thể hiện chúng thành `<private>` trong log đã lưu. Chuỗi cố định thì không bao giờ bị che.
    4. `@unknown default` xử lý các phase mà Apple có thể thêm ở các bản iOS sau. `ScenePhase` không phải enum đóng như các enum bạn tự viết.
    5. `onAppear`/`onDisappear` gắn vào view. Chúng báo những gì xảy ra *bên trong* app (điều hướng), không báo app có đang ở phía trước không.

=== "UIKit"

    ```swift title="Sources/AppDelegate.swift" hl_lines="2 3 10 11 12 13"
    ⋯ imports, lifecycleLog
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
    ```

    ```swift title="Sources/SceneDelegate.swift" hl_lines="9 15 16 17 18"
    ⋯ import UIKit
    final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
        var window: UIWindow?

        func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
                   options connectionOptions: UIScene.ConnectionOptions) {
            guard let windowScene = scene as? UIWindowScene else { return }
            let window = UIWindow(windowScene: windowScene)
            window.rootViewController = UINavigationController(rootViewController: ViewController())
            window.makeKeyAndVisible()
            self.window = window
            lifecycleLog.notice("scene willConnect")
        }

        func sceneWillEnterForeground(_ scene: UIScene) { lifecycleLog.notice("sceneWillEnterForeground") }
        func sceneDidBecomeActive(_ scene: UIScene) { lifecycleLog.notice("sceneDidBecomeActive") }
        func sceneWillResignActive(_ scene: UIScene) { lifecycleLog.notice("sceneWillResignActive") }
        func sceneDidEnterBackground(_ scene: UIScene) { lifecycleLog.notice("sceneDidEnterBackground") }
    }
    ```

    ```swift title="Sources/ViewController.swift" hl_lines="11"
    ⋯ import UIKit
    final class ViewController: UIViewController {
        override func viewDidLoad() {
            super.viewDidLoad()
            lifecycleLog.notice("ViewController viewDidLoad")
            title = "Lifecycle"
            view.backgroundColor = .systemBackground

            let button = UIButton(type: .system)
            button.setTitle("Open detail screen", for: .normal)
            button.addAction(UIAction { [weak self] _ in
                self?.navigationController?.pushViewController(DetailViewController(), animated: true)
            }, for: .touchUpInside)
            button.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(button)
            NSLayoutConstraint.activate([
                button.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                button.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            ])
        }
    ⋯ viewWillAppear, viewDidAppear, viewWillDisappear, viewDidDisappear
    ```

    ```swift title="Sources/ViewController.swift" hl_lines="2 4"
    ⋯ ViewController.viewDidLoad
        override func viewWillAppear(_ animated: Bool) {
            super.viewWillAppear(animated)
            lifecycleLog.notice("ViewController viewWillAppear")
        }

    ⋯ viewDidAppear, viewWillDisappear, viewDidDisappear: identical shape, one log each
    }

    final class DetailViewController: UIViewController {
    ⋯ viewDidLoad, and the four appear/disappear callbacks, each logging "DetailViewController …"
    }
    ```

    1. `AppDelegate` sở hữu các sự kiện cấp process. Cấu hình scene nêu tên class delegate (qua Info.plist) chạy mỗi cửa sổ.
    2. `SceneDelegate` tạo cửa sổ và gốc của nó: một `UINavigationController`, thứ cho bạn điều hướng push/pop và một nút back.
    3. Bốn method `scene…` là vòng đời cấp app mà bạn sẽ móc một monitor chạy nền vào.
    4. UI được dựng bằng code (không có storyboard): tạo một view, thêm nó vào, ràng buộc vị trí nó. `[weak self]` tránh một retain cycle giữa view controller và action của chính nút bấm của nó.
    5. Các callback của view controller là vòng đời cấp view. `viewDidLoad` chạy khi view của màn hình được tạo lần đầu. Bốn callback appear/disappear chạy mỗi lần điều hướng hiện hoặc ẩn màn hình (một lần push hay pop). Bấm Home không gọi cái nào trong số đó (mục 4). Mỗi override gọi `super` trước.
    6. Info.plist cần mục `UIApplicationSceneManifest` từ `project.yml`, như ở mục 2. Thiếu nó thì `SceneDelegate` không bao giờ chạy.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    UIKit chia vòng đời ra ba object bạn tự viết (AppDelegate, SceneDelegate, các view controller). SwiftUI biến cả hai tầng thành *state mà bạn quan sát*: `scenePhase` cho app, và các modifier `onAppear`/`onDisappear` cho view.
    Mô hình hai vòng đời bên dưới vẫn là một.

## 4. Thực tế xảy ra gì

Chúng tôi điều khiển app này trên simulator iOS 26.2 bằng một UI test (mở app, push màn hình chi tiết, quay lại, bấm Home, quay về) và đọc log:

=== "SwiftUI"

    | Bạn làm | Log hiện (SwiftUI) |
    |---|---|
    | Mở app | `App init · ContentView onAppear · scenePhase → active` |
    | Push chi tiết | `DetailView onAppear · ContentView onDisappear` |
    | Back | `ContentView onAppear · DetailView onDisappear` |
    | Bấm Home | `scenePhase → inactive · scenePhase → background` |
    | Quay về | `scenePhase → inactive · scenePhase → active` |

=== "UIKit"

    | Bạn làm | Log hiện (UIKit) |
    |---|---|
    | Mở app | `didFinishLaunching · scene willConnect · sceneWillEnterForeground · ViewController viewDidLoad · viewWillAppear · viewDidAppear · sceneDidBecomeActive` |
    | Push chi tiết | `Detail viewDidLoad · ViewController viewWillDisappear · Detail viewWillAppear · ViewController viewDidDisappear · Detail viewDidAppear` |
    | Back | `Detail viewWillDisappear · ViewController viewWillAppear · Detail viewDidDisappear · ViewController viewDidAppear` |
    | Bấm Home | `sceneWillResignActive · sceneDidEnterBackground` |
    | Quay về | `sceneWillEnterForeground · sceneDidBecomeActive` |

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 190" role="img" aria-labelledby="l04-home-title">
<title id="l04-home-title">Những gì chạy khi bạn bấm Home, theo thứ tự. Trên Android, Activity ghi onPause rồi onStop. Trên iOS, tầng app và scene chuyển sang inactive rồi xuống background. Trên iOS, tầng view không chạy gì cả, vì không có màn hình nào được push hay pop.</title>
<path class="edge dashed" d="M200,30 L200,178"/>
<text class="small muted" x="200" y="22" text-anchor="middle">bấm Home</text>
<text class="small muted" x="10" y="64">Activity Android</text>
<path class="axis" d="M150,60 L630,60"/>
<circle class="dot" cx="300" cy="60" r="5"/><text class="mono small" x="300" y="48" text-anchor="middle">onPause</text>
<circle class="dot" cx="440" cy="60" r="5"/><text class="mono small" x="440" y="48" text-anchor="middle">onStop</text>
<text class="small muted" x="10" y="114">iOS cấp app / scene</text>
<path class="axis" d="M150,110 L630,110"/>
<circle class="dot" cx="300" cy="110" r="5"/><text class="mono small" x="300" y="98" text-anchor="middle">inactive</text>
<circle class="dot" cx="440" cy="110" r="5"/><text class="mono small" x="440" y="98" text-anchor="middle">background</text>
<text class="small muted" x="10" y="164">iOS cấp view</text>
<path class="axis" d="M150,160 L630,160"/>
<circle class="dot dropped" cx="370" cy="160" r="5"/><text class="small muted" x="370" y="148" text-anchor="middle">không có gì chạy</text>
</svg>
<figcaption>Thứ tự các sự kiện, không phải thời điểm của chúng. Android báo việc rời màn hình qua Activity. iOS chỉ báo nó ở cấp app/scene.</figcaption>
</figure>

!!! warning "Gotcha · xuống nền không gọi callback nào của view"
    Bấm Home thì *không* có callback "disappear" nào của cấp view chạy. Chỉ cấp scene/app đổi. Callback của view báo việc điều hướng bên trong app, không báo việc app rời khỏi màn hình.
    Vì vậy một monitor chạy nền (bài 18) dựng trên callback của view sẽ lặng lẽ không bao giờ nhận ra app đã đi: hãy móc vào cấp **app/scene**.
    Cũng để ý thứ tự khi điều hướng. **SwiftUI:** `onAppear` của view mới chạy *trước* `onDisappear` của view cũ. **UIKit:** callback của hai màn hình đan xen nhau (`viewWillDisappear` cũ, `viewWillAppear` mới, `viewDidDisappear` cũ, `viewDidAppear` mới).
    Đừng viết code phụ thuộc vào việc callback của màn hình nào chạy trước.

!!! warning "Gotcha · app đang treo bị kill thì không có callback nào"
    Vuốt app đi trong app switcher, hoặc hệ điều hành thu hồi bộ nhớ, sẽ kết thúc một app đang treo (suspended) mà không báo gì cả. `applicationWillTerminate` không được gọi cho app đang treo ([tài liệu Apple](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/applicationwillterminate(_:))).
    Hãy lưu thứ gì quan trọng lúc vào background, đừng đợi "lúc thoát".

!!! question "Hỏi agent của bạn"
    Nhờ agent giải thích bất cứ thứ gì làm bạn bất ngờ trong log. Bất ngờ chính là mục đích của bài này.
    Ví dụ: *"Why does Android rebuild the Activity on rotation but iOS doesn't rebuild the view?"* (Vì sao Android dựng lại Activity khi xoay máy còn iOS thì không dựng lại view?)

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Bạn bấm Home khi đang ở màn hình chi tiết. Những sự kiện nào chạy?</p>
<div class="opts">
<button class="opt">chỉ các sự kiện disappear của view</button>
<button class="opt" data-correct>chỉ các sự kiện cấp scene/app</button>
<button class="opt">cả sự kiện view lẫn scene</button>
</div>
<p class="feedback"></p>
<p class="why">Xuống nền không đổi những gì đang nằm trong navigation stack, nên không callback nào của view chạy.</p>
</div>

<div class="quiz">
<p class="q">File nào giữ đoạn chữ iOS hiện trong hộp thoại xin quyền Bluetooth?</p>
<div class="opts">
<button class="opt">Package.swift</button>
<button class="opt" data-correct>Info.plist</button>
<button class="opt">project.yml</button>
</div>
<p class="feedback"></p>
<p class="why">Usage description là các key trong Info.plist. Thiếu một key thì app bị tắt khi xin quyền đó.</p>
</div>

<div class="quiz">
<p class="q">Một monitor chạy nền nên móc vào đâu để biết app đã rời khỏi màn hình?</p>
<div class="opts">
<button class="opt"><code>onDisappear</code> / <code>viewDidDisappear</code> của một view</button>
<button class="opt" data-correct>Cấp app/scene</button>
<button class="opt">Info.plist</button>
</div>
<p class="feedback"></p>
<p class="why">Xuống nền là một sự kiện app/scene. Cấp view chỉ báo việc điều hướng bên trong app.</p>
</div>

<div class="quiz">
<p class="q"><code>ScenePhase</code> có thể có thêm case mới ở một bản iOS sau. <code>@unknown default</code> thêm gì cho một <code>switch</code> trên nó?</p>
<div class="opts">
<button class="opt">Nó làm switch không còn phải đủ nhánh</button>
<button class="opt" data-correct>Một nhánh cho các case tương lai, trong khi trình biên dịch vẫn cảnh báo nếu thiếu case đã biết</button>
<button class="opt">Nó tắt mọi kiểm tra của trình biên dịch trên switch</button>
</div>
<p class="feedback"></p>
<p class="why">Với <code>default</code> thường, một case mới thêm vào sẽ bị xử lý lặng lẽ. <code>@unknown default</code> giữ việc kiểm tra đủ nhánh cho các case bạn đã biết.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Thứ gần nhất với Info.plist của iOS bên Android là: (Bài 03)</p>
<div class="opts">
<button class="opt">build.gradle.kts</button>
<button class="opt" data-correct>AndroidManifest.xml</button>
<button class="opt">settings.gradle.kts</button>
</div>
<p class="feedback"></p>
<p class="why">Cả hai là file khai báo app với hệ điều hành: thành phần và quyền bên Android, metadata và chuỗi xin quyền bên iOS.</p>
</div>

<div class="quiz">
<p class="q">Sự kiện nào mặc định huỷ và tạo lại object màn hình? (Bài 03)</p>
<div class="opts">
<button class="opt" data-correct>Xoay máy trên Android</button>
<button class="opt">Bấm Home trên iOS</button>
<button class="opt">Xoay máy trên iOS</button>
</div>
<p class="feedback"></p>
<p class="why">Android huỷ và tạo lại Activity khi có thay đổi cấu hình như xoay máy. Bấm Home trên iOS chỉ đưa scene xuống background.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent)"
    1. Đoán toàn bộ log cho chuỗi: mở app → push chi tiết → bấm Home → quay về → back. Chạy thật và so.
    2. Thêm một log cho lúc view của màn hình chi tiết được tạo lần đầu (**SwiftUI:** gợi ý, một `init()` tự viết trên `DetailView` · **UIKit:** nó đã là `viewDidLoad` rồi; push, quay lại rồi push lần nữa, và đếm xem nó chạy bao nhiêu lần). Nó chạy thường xuyên cỡ nào so với các callback appear? Vì sao?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/04-ios-fundamentals.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/04-ios-fundamentals.html" -o .course/lesson-04.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html" -o .course/ref-platform-lifecycles-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my track exactly,
except where the brief below says otherwise.

Lesson 04 (iOS fundamentals): build a scratch iOS app that logs lifecycle events.
My track: iOS = [SwiftUI | UIKit]  (default SwiftUI).
Starting point: nothing. Work in scratch/lesson-04/ios/ in my workspace.
Prereqs: Xcode, XcodeGen (`brew install xcodegen`).

1. Create exactly these files, complete, as in the lesson's "Full files" section for my
   track:
     project.yml
     SwiftUI track: Sources/Lesson04App.swift, Sources/ContentView.swift
     UIKit track: Sources/AppDelegate.swift, Sources/SceneDelegate.swift,
       Sources/ViewController.swift
   Do NOT write Sources/Info.plist: XcodeGen generates it from project.yml.
2. Run `xcodegen generate`. Pick an iPhone simulator on iOS 17 or newer (the deployment
   target) from `xcrun simctl list devices available`, then build for it, as one command:
     xcodebuild -project Lesson04iOS.xcodeproj -scheme Lesson04iOS \
       -destination 'platform=iOS Simulator,name=<that iPhone>' \
       -derivedDataPath build build
3. Boot that simulator, then install and launch the app (bundle ID
   com.example.Lesson04iOS) with `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/Lesson04iOS.app`
   and `xcrun simctl launch booted com.example.Lesson04iOS`. Read its log with
     xcrun simctl spawn booted log show --last 2m --info --predicate 'category == "Lifecycle"'

Acceptance checks:
- The build succeeds with no compiler warnings from our own code (don't use -q to check
  warnings; read the build output). Xcode's own "appintentsmetadataprocessor ... warning:
  Metadata extraction skipped" line is expected and isn't from our code.
- Launch logs (category Lifecycle) start with "App init" (SwiftUI) or "didFinishLaunching"
  (UIKit) and include the first screen's appear callback.
Then walk me through each file line by line. Do NOT run the lifecycle experiments or the
unaided exercise for me; I do those myself.
```

## Đọc thêm

- [Cheatsheet: vòng đời các nền tảng](https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html), cả hai nền tảng và mọi track trên một trang.
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html)
- Kinh nghiệm thực tế: [r/iOSProgramming](https://reddit.com/r/iOSProgramming) cho những câu hỏi kiểu "hành vi vòng đời này có bình thường không?".

## File đầy đủ

Mọi file bài này tạo ra, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. `Sources/Info.plist` do `xcodegen generate` sinh ra từ `project.yml`.

=== "SwiftUI"

    ??? example "project.yml"
        ```yaml
        name: Lesson04iOS
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          Lesson04iOS:
            type: application
            platform: iOS
            sources: [Sources]
            info:
              path: Sources/Info.plist
              properties:
                CFBundleDisplayName: Lesson 04
                UILaunchScreen: {}
            settings:
              base:
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
        ```

    ??? example "Sources/Lesson04App.swift"
        ```swift
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
        ```

    ??? example "Sources/ContentView.swift"
        ```swift
        import SwiftUI

        struct ContentView: View {
            var body: some View {
                NavigationStack {
                    VStack(spacing: 16) {
                        Text("Lesson 04: watch the Xcode console")
                        NavigationLink("Open detail screen") {
                            DetailView()
                        }
                    }
                    .navigationTitle("Lifecycle")
                    .onAppear { lifecycleLog.notice("ContentView onAppear") }
                    .onDisappear { lifecycleLog.notice("ContentView onDisappear") }
                }
            }
        }

        struct DetailView: View {
            var body: some View {
                Text("Detail screen")
                    .onAppear { lifecycleLog.notice("DetailView onAppear") }
                    .onDisappear { lifecycleLog.notice("DetailView onDisappear") }
            }
        }
        ```

=== "UIKit"

    ??? example "project.yml"
        ```yaml
        name: Lesson04iOS
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          Lesson04iOS:
            type: application
            platform: iOS
            sources: [Sources]
            settings:
              base:
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
            info:
              path: Sources/Info.plist
              properties:
                CFBundleDisplayName: "Lesson 04"
                UILaunchScreen: {}
                UIApplicationSceneManifest:
                  UIApplicationSupportsMultipleScenes: false
                  UISceneConfigurations:
                    UIWindowSceneSessionRoleApplication:
                      - UISceneConfigurationName: "Default Configuration"
                        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate"
        ```

    ??? example "Sources/AppDelegate.swift"
        ```swift
        import UIKit
        import os

        let lifecycleLog = Logger(subsystem: "com.example.lesson04", category: "Lifecycle")

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
        ```

    ??? example "Sources/SceneDelegate.swift"
        ```swift
        import UIKit

        final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
            var window: UIWindow?

            func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
                       options connectionOptions: UIScene.ConnectionOptions) {
                guard let windowScene = scene as? UIWindowScene else { return }
                let window = UIWindow(windowScene: windowScene)
                window.rootViewController = UINavigationController(rootViewController: ViewController())
                window.makeKeyAndVisible()
                self.window = window
                lifecycleLog.notice("scene willConnect")
            }

            func sceneWillEnterForeground(_ scene: UIScene) { lifecycleLog.notice("sceneWillEnterForeground") }
            func sceneDidBecomeActive(_ scene: UIScene) { lifecycleLog.notice("sceneDidBecomeActive") }
            func sceneWillResignActive(_ scene: UIScene) { lifecycleLog.notice("sceneWillResignActive") }
            func sceneDidEnterBackground(_ scene: UIScene) { lifecycleLog.notice("sceneDidEnterBackground") }
        }
        ```

    ??? example "Sources/ViewController.swift"
        ```swift
        import UIKit

        final class ViewController: UIViewController {
            override func viewDidLoad() {
                super.viewDidLoad()
                lifecycleLog.notice("ViewController viewDidLoad")
                title = "Lifecycle"
                view.backgroundColor = .systemBackground

                let button = UIButton(type: .system)
                button.setTitle("Open detail screen", for: .normal)
                button.addAction(UIAction { [weak self] _ in
                    self?.navigationController?.pushViewController(DetailViewController(), animated: true)
                }, for: .touchUpInside)
                button.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(button)
                NSLayoutConstraint.activate([
                    button.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                    button.centerYAnchor.constraint(equalTo: view.centerYAnchor),
                ])
            }

            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
                lifecycleLog.notice("ViewController viewWillAppear")
            }

            override func viewDidAppear(_ animated: Bool) {
                super.viewDidAppear(animated)
                lifecycleLog.notice("ViewController viewDidAppear")
            }

            override func viewWillDisappear(_ animated: Bool) {
                super.viewWillDisappear(animated)
                lifecycleLog.notice("ViewController viewWillDisappear")
            }

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                lifecycleLog.notice("ViewController viewDidDisappear")
            }
        }

        final class DetailViewController: UIViewController {
            override func viewDidLoad() {
                super.viewDidLoad()
                lifecycleLog.notice("DetailViewController viewDidLoad")
                view.backgroundColor = .systemBackground
                let label = UILabel()
                label.text = "Detail screen"
                label.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(label)
                NSLayoutConstraint.activate([
                    label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                    label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
                ])
            }

            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
                lifecycleLog.notice("DetailViewController viewWillAppear")
            }

            override func viewDidAppear(_ animated: Bool) {
                super.viewDidAppear(animated)
                lifecycleLog.notice("DetailViewController viewDidAppear")
            }

            override func viewWillDisappear(_ animated: Bool) {
                super.viewWillDisappear(animated)
                lifecycleLog.notice("DetailViewController viewWillDisappear")
            }

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                lifecycleLog.notice("DetailViewController viewDidDisappear")
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Code iOS trong phần này chỉ để minh hoạ, không kèm output. Ví dụ có output (A4) là chương trình Swift đã chạy thật (Swift 6.3.2, macOS, chế độ Swift 6).

### A1. Hai tầng vòng đời, nói bằng chuyện đời thường

Giải thích thêm cho [mục 3](#3-hai-vong-oi-khong-phai-mot).

!!! abstract "Một câu để nhớ"
    App iOS là **một cửa hàng**. **Cấp app/scene** là **cửa cuốn**: mở (active), kéo xuống một nửa (inactive), đóng hẳn (background).
    **Cấp view** là **khách đi giữa các phòng** trong cửa hàng (push/pop). Đóng cửa cuốn không làm khách đổi phòng, nên không phòng nào báo "khách vừa rời đi".

So với bài 03: Android dồn hai câu hỏi vào cùng một bộ callback của Activity, nên `onStop` vừa có nghĩa "màn hình này bị che" vừa có thể nghĩa "app xuống nền". iOS tách thành hai bộ:

| Câu hỏi | Android (bài 03) | iOS · SwiftUI | iOS · UIKit | Gần giống bên web |
|---|---|---|---|---|
| App có đang ở phía trước? | `onResume` / `onPause` / `onStop` của Activity | `scenePhase` (`.active` / `.inactive` / `.background`) | `sceneDidBecomeActive`, `sceneWillResignActive`, `sceneDidEnterBackground`, `sceneWillEnterForeground` | `visibilitychange`, `focus` / `blur` của cửa sổ |
| Màn hình này vừa hiện / ẩn trong app? | (vẫn là callback của Activity, hoặc của Fragment/Compose) | `onAppear` / `onDisappear` | `viewWillAppear`, `viewDidAppear`, `viewWillDisappear`, `viewDidDisappear` | router đổi route: component mount / unmount |
| Màn hình được tạo lần đầu | `onCreate` | `init()` của view (có thể chạy nhiều lần) | `viewDidLoad` | constructor / mount lần đầu |
| App khởi động | `Application.onCreate` | `init()` của `App` | `application(_:didFinishLaunchingWithOptions:)` | trang load |

Chỗ dễ nhầm nhất cho dev web: `onDisappear` **không** phải `visibilitychange`. Nó giống "component bị unmount khi đổi route" hơn, còn việc app xuống nền phải nghe ở cấp scene.

!!! tip "Áp vào app"
    Monitor nền ở bài 18 cần biết "app vừa xuống nền" để chuyển sang chế độ ghi log định kỳ: móc vào `scenePhase == .background` (SwiftUI) hoặc `sceneDidEnterBackground` (UIKit). Còn "bắt đầu quét khi mở màn hình Scan, dừng khi rời màn hình đó" là chuyện cấp view: `onAppear` / `onDisappear`.

### A2. `project.yml`, `Info.plist`, Xcode target: soi sang Android và npm

Giải thích thêm cho [mục 1](#1-trong-mot-project-ios-co-gi) và [mục 2](#2-infoplist).

| Việc | TS / npm | Android (bài 03) | iOS (bài này) |
|---|---|---|---|
| Khai báo app với hệ điều hành | `manifest.json` của PWA | `AndroidManifest.xml` | `Info.plist` |
| Chuỗi giải thích khi xin quyền | không có (trình duyệt tự hỏi) | không bắt buộc trong manifest | **bắt buộc**: `NS…UsageDescription`, thiếu là app bị tắt |
| Đơn vị build ra một sản phẩm | một package | Gradle module | Xcode target |
| File cấu hình build | `package.json` | `build.gradle.kts` | `.xcodeproj` (sinh từ `project.yml`) |
| Phiên bản hệ điều hành thấp nhất | `browserslist` | `minSdk = 26` | `deploymentTarget: iOS: "17.0"` |
| Phiên bản hiển thị / số build | `"version"` | `versionName` / `versionCode` | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` |
| Mã định danh app | tên miền | `applicationId` | bundle ID (`bundleIdPrefix` + tên target) |

Vì sao khoá dùng XcodeGen: file `.xcodeproj` là một file text khổng lồ do Xcode tự ghi, đầy ID ngẫu nhiên, rất khó đọc diff và hay conflict khi merge. `project.yml` thì ngắn, đọc được, nên commit nó và coi `.xcodeproj` như **file sinh ra** (giống `dist/`), chạy `xcodegen generate` là có lại.

Bundle ID của bài: `bundleIdPrefix` `com.example` + tên target `Lesson04iOS` → `com.example.Lesson04iOS`, đúng cái brief dùng trong lệnh `xcrun simctl launch`.

### A3. `Logger`: `Log.d` của iOS, và vì sao log hiện `<private>`

Giải thích thêm cho ghi chú 3 của track SwiftUI ở [mục 3](#3-hai-vong-oi-khong-phai-mot).

| Việc | TypeScript | Android | iOS |
|---|---|---|---|
| Ghi một dòng log | `console.log("…")` | `Log.d(TAG, "…")` | `logger.notice("…")` |
| Phân nhóm để lọc | prefix tự đặt | `TAG` | `subsystem` + `category` |
| Xem log | DevTools console | Logcat, lọc `tag:Lifecycle` | console Xcode, hoặc `log show --predicate 'category == "Lifecycle"'` |
| Mức log | `debug` / `info` / `warn` / `error` | `Log.v/d/i/w/e` | `debug` / `info` / `notice` / `error` / `fault` |

Điểm khác lớn: `Logger` **mặc định che giá trị động** để không lộ dữ liệu người dùng trong log của máy:

```swift
let name = "OBD-II Dongle"
lifecycleLog.notice("found \(name)")                     // log đã lưu có thể hiện: found <private>
lifecycleLog.notice("found \(name, privacy: .public)")   // hiện đủ: found OBD-II Dongle
lifecycleLog.notice("scenePhase → active")               // chuỗi cố định: không bao giờ bị che
```

Đó là lý do bài viết mỗi `case` một chuỗi cố định thay vì `"scenePhase → \(newPhase)"`. Chỉ thêm `privacy: .public` cho giá trị bạn chắc chắn không nhạy cảm.

### A4. `[weak self]`: vì sao cần, nhìn bằng mắt

Giải thích thêm cho ghi chú 4 của track UIKit ở [mục 3](#3-hai-vong-oi-khong-phai-mot).

Swift dọn bộ nhớ bằng **đếm tham chiếu** (ARC), không có garbage collector quét vòng như JS. Hai object giữ chặt lẫn nhau thì không bao giờ được giải phóng: đó là **retain cycle**.
Ở bài: view controller giữ nút bấm, nút bấm giữ closure, closure mà giữ `self` (view controller) thì thành vòng.

Ví dụ sau dựng đúng hình dạng đó. `deinit` in ra khi object thật sự được giải phóng:

```swift
final class Button {
    var action: (() -> Void)?
}

final class Screen {
    let name: String
    let button = Button()
    init(name: String) { self.name = name; print("\(name) init") }
    deinit { print("\(name) deinit") }

    func wireStrong() { button.action = { print(self.name, "tapped") } }
    func wireWeak()   { button.action = { [weak self] in print(self?.name ?? "gone", "tapped") } }
}

print("-- strong self --")
var a: Screen? = Screen(name: "A")
a?.wireStrong()
a?.button.action?()
a = nil
print("A set to nil")

print("-- [weak self] --")
var b: Screen? = Screen(name: "B")
b?.wireWeak()
b?.button.action?()
b = nil
print("B set to nil")
```

Output:

```text
-- strong self --
A init
A tapped
A set to nil
-- [weak self] --
B init
B tapped
B deinit
B set to nil
```

`A` **không bao giờ** in `deinit`: nó bị rò bộ nhớ. `B` được giải phóng ngay khi không còn ai giữ, vì closure chỉ giữ yếu (`weak`), và bên trong `self` thành optional (`self?.name`).

| | JS / TS | Kotlin (JVM, Android) | Swift |
|---|---|---|---|
| Dọn bộ nhớ | GC, tự gỡ được vòng | GC, tự gỡ được vòng | ARC, **không** tự gỡ vòng |
| Closure bắt `this`/`self` | không sao | không sao (nhưng coi chừng giữ Activity sống quá lâu) | có thể tạo retain cycle |
| Cách tránh | không cần | không cần cho vòng; tránh giữ Context lâu | `[weak self]` (hoặc `[unowned self]`) |

!!! tip "Áp vào app"
    Ở bài 13, delegate và callback của CoreBluetooth sẽ bắt `self` khắp nơi. Quy tắc dễ nhớ: closure được **cất lại** (gán vào property, đăng ký làm callback) thì dùng `[weak self]`; closure chạy xong ngay (như `map { }`) thì không cần.

### A5. Không có "lúc thoát": lưu dữ liệu ở đâu

Giải thích thêm cho [gotcha app bị kill](#4-thuc-te-xay-ra-gi).

Dev web quen `beforeunload`; dev Android quen `onDestroy`. Trên iOS, app ở background vài giây sẽ bị **treo** (suspended), và từ trạng thái treo hệ điều hành có thể kill nó bất cứ lúc nào mà không gọi code nào của bạn.

| Thời điểm | Chắc chắn được gọi? | Nên làm gì |
|---|---|---|
| Vào background (`scenePhase == .background` / `sceneDidEnterBackground`) | có | **lưu mọi thứ quan trọng ở đây** |
| `applicationWillTerminate` | không, nếu app đang treo | đừng trông vào nó |
| Bị vuốt khỏi app switcher khi đang treo | không có callback nào | không làm được gì |

So với bài 03: Android cũng có thể kill process ở nền mà không gọi `onDestroy`, nên quy tắc giống nhau ở cả hai bên: **lưu khi xuống nền, không đợi lúc thoát**.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 05.

- [ ] Nói được mỗi file trong project iOS của track mình làm gì, và vì sao `.xcodeproj` được sinh từ `project.yml` (xem [A2](#a2-projectyml-infoplist-xcode-target-soi-sang-android-va-npm)).
- [ ] Ghép đúng cặp Android ↔ iOS: Manifest ↔ Info.plist, Gradle module ↔ Xcode target, Activity ↔ scene + view gốc.
- [ ] Biết thiếu `NS…UsageDescription` trong Info.plist thì app bị tắt khi xin quyền.
- [ ] (UIKit) Biết `UIApplicationSceneManifest` để làm gì và thiếu nó thì chuyện gì xảy ra.
- [ ] Phân biệt hai tầng vòng đời: cấp app/scene và cấp view, kể được callback của từng tầng trên track mình (xem [A1](#a1-hai-tang-vong-oi-noi-bang-chuyen-oi-thuong)).
- [ ] Đoán đúng log cho: mở app, push chi tiết, back, bấm Home, quay về.
- [ ] Giải thích vì sao bấm Home không gọi callback nào của view, và monitor nền phải móc vào đâu.
- [ ] Dùng `Logger` với subsystem + category, hiểu vì sao log có thể hiện `<private>` (xem [A3](#a3-logger-logd-cua-ios-va-vi-sao-log-hien-private)).
- [ ] Giải thích `@unknown default` khác `default` ở chỗ nào.
- [ ] Giải thích retain cycle và khi nào cần `[weak self]` (xem [A4](#a4-weak-self-vi-sao-can-nhin-bang-mat)).
- [ ] Biết lưu dữ liệu quan trọng lúc xuống nền, không đợi lúc thoát (xem [A5](#a5-khong-co-luc-thoat-luu-du-lieu-o-au)).
- [ ] Làm xong 2 bài tự làm ở trên mà không cần agent.
