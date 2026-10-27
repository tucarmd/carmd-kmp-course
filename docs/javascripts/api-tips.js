// Tooltip API: rê chuột / focus vào `tênAPI` (inline code hoặc link) → popup giải thích ngắn + code mẫu.
// Chỉ là phần phụ trợ đọc bài, không thuộc bản gốc. Thêm API mới: thêm một mục vào TIPS (khoá = đúng chữ hiện trên trang).
const TIPS = {
  // ── iOS · cấp app / scene ──
  scenePhase: {
    p: "SwiftUI",
    d: "Giá trị môi trường cho biết scene đang active, inactive hay background. Theo dõi bằng .onChange(of:) để biết app ra/vào phía trước.",
    c: `@Environment(\\.scenePhase) private var scenePhase

.onChange(of: scenePhase) { _, phase in
    if phase == .background { save() }
}`,
  },
  "scene delegate": {
    p: "UIKit",
    d: "Object (UIWindowSceneDelegate) UIKit gọi khi một cửa sổ được tạo và khi nó đổi trạng thái active / background. Khai báo trong Info.plist → UIApplicationSceneManifest.",
    c: `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func sceneDidBecomeActive(_ scene: UIScene) { … }
    func sceneDidEnterBackground(_ scene: UIScene) { … }
}`,
  },
  sceneWillEnterForeground: {
    p: "UIKit",
    d: "Scene sắp từ background quay lại phía trước (chưa nhận chạm). ≈ onStart của Android.",
    c: `func sceneWillEnterForeground(_ scene: UIScene) {
    refreshData()
}`,
  },
  sceneDidBecomeActive: {
    p: "UIKit",
    d: "Scene đã ở phía trước và nhận chạm. ≈ onResume. Nơi chạy lại thứ đã tạm dừng.",
    c: `func sceneDidBecomeActive(_ scene: UIScene) {
    timer.resume()
}`,
  },
  sceneWillResignActive: {
    p: "UIKit",
    d: "Scene sắp mất active: kéo Notification Center, có cuộc gọi, hoặc trước khi vào background. ≈ onPause.",
    c: `func sceneWillResignActive(_ scene: UIScene) {
    timer.pause()
}`,
  },
  sceneDidEnterBackground: {
    p: "UIKit",
    d: "Scene đã xuống background (bấm Home, đổi app). ≈ onStop. Lưu dữ liệu ở đây vì app có thể bị hệ thống tắt bất cứ lúc nào sau đó.",
    c: `func sceneDidEnterBackground(_ scene: UIScene) {
    store.save()
}`,
  },
  applicationWillTerminate: {
    p: "UIKit",
    d: "App sắp bị tắt hẳn. Không đáng tin: app bị hệ thống kill khi đang ở background thì thường không được gọi.",
    c: `func applicationWillTerminate(_ application: UIApplication) {
    // đừng dựa vào chỗ này để lưu
}`,
  },
  "application(_:didFinishLaunchingWithOptions:)": {
    p: "UIKit",
    d: "Hàm đầu tiên của AppDelegate khi app khởi động: cài đặt dịch vụ, SDK. Chưa có cửa sổ ở đây (cửa sổ do scene delegate dựng).",
    c: `func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    setupLogging()
    return true
}`,
  },

  // ── iOS · cấp view ──
  onAppear: {
    p: "SwiftUI",
    d: "Modifier chạy closure mỗi lần view hiện lên trong app (lần đầu, hoặc khi pop quay lại). Không chạy khi app từ background quay lại.",
    c: `Text("Home")
    .onAppear { viewModel.load() }`,
  },
  onDisappear: {
    p: "SwiftUI",
    d: "Modifier chạy khi view rời khỏi màn hình bên trong app (push màn khác, pop đi). Bấm Home không gọi nó.",
    c: `DetailView()
    .onDisappear { player.stop() }`,
  },
  viewDidLoad: {
    p: "UIKit",
    d: "Gọi một lần khi view của view controller được tạo trong bộ nhớ. Nơi dựng UI, gắn subview, cấu hình ban đầu. ≈ onCreate.",
    c: `override func viewDidLoad() {
    super.viewDidLoad()
    view.addSubview(label)
}`,
  },
  viewWillAppear: {
    p: "UIKit",
    d: "Gọi mỗi lần màn hình sắp hiện (kể cả khi pop quay lại). Hợp để làm mới dữ liệu trước khi người dùng thấy.",
    c: `override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    tableView.reloadData()
}`,
  },
  viewDidAppear: {
    p: "UIKit",
    d: "Gọi sau khi màn hình đã hiện xong (animation chuyển cảnh kết thúc). Hợp để bắt đầu animation, log analytics.",
    c: `override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    analytics.screen("Home")
}`,
  },
  viewWillDisappear: {
    p: "UIKit",
    d: "Gọi khi màn hình sắp bị che hoặc gỡ (push màn khác, pop). Hợp để lưu nháp, dừng thứ đang chạy.",
    c: `override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    view.endEditing(true)
}`,
  },
  viewDidDisappear: {
    p: "UIKit",
    d: "Gọi sau khi màn hình đã khuất hẳn. Hợp để dừng timer, huỷ lắng nghe.",
    c: `override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    timer?.invalidate()
}`,
  },
  deinit: {
    p: "Swift",
    d: "Chạy khi object class bị giải phóng khỏi bộ nhớ (hết tham chiếu mạnh). Không chạy → thường là có vòng tham chiếu (retain cycle).",
    c: `deinit {
    print("DetailViewController freed")
}`,
  },
  Logger: {
    p: "Swift · os",
    d: "Logger của Apple (framework os). Ghi log có subsystem + category, xem trong Console.app hoặc Xcode, lọc theo mức debug/info/notice/error/fault.",
    c: `import os
let log = Logger(subsystem: "com.example.app", category: "Lifecycle")
log.notice("scenePhase → active")`,
  },

  // ── Android · Activity ──
  onCreate: {
    p: "Android",
    d: "Gọi một lần khi Activity được tạo (và tạo lại sau khi xoay màn hình). Nơi setContentView, nối view, khôi phục state.",
    c: `override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
}`,
  },
  onStart: {
    p: "Android",
    d: "Activity bắt đầu hiện trên màn hình (chưa chắc nhận chạm). ≈ sceneWillEnterForeground.",
    c: `override fun onStart() {
    super.onStart()
    Log.d(TAG, "onStart")
}`,
  },
  onResume: {
    p: "Android",
    d: "Activity ở phía trước và nhận chạm. ≈ sceneDidBecomeActive. Bật lại camera, cảm biến, animation.",
    c: `override fun onResume() {
    super.onResume()
    sensor.start()
}`,
  },
  onPause: {
    p: "Android",
    d: "Activity mất focus (hộp thoại, chia màn hình, sắp rời đi). Việc ở đây phải nhanh. ≈ sceneWillResignActive.",
    c: `override fun onPause() {
    super.onPause()
    sensor.stop()
}`,
  },
  onStop: {
    p: "Android",
    d: "Activity không còn hiện (bấm Home, mở màn khác). Lưu dữ liệu ở đây. ≈ sceneDidEnterBackground.",
    c: `override fun onStop() {
    super.onStop()
    repo.saveDraft()
}`,
  },
  onRestart: {
    p: "Android",
    d: "Gọi trước onStart khi Activity đã stop rồi quay lại (không gọi ở lần mở đầu tiên).",
    c: `override fun onRestart() {
    super.onRestart()
}`,
  },
  onDestroy: {
    p: "Android",
    d: "Activity bị huỷ: người dùng thoát hẳn (finish) hoặc bị tạo lại khi xoay màn hình. Không đảm bảo được gọi khi process bị kill.",
    c: `override fun onDestroy() {
    super.onDestroy()
    if (!isChangingConfigurations) cleanup()
}`,
  },
  onSaveInstanceState: {
    p: "Android",
    d: "Cho bạn ghi state nhỏ vào Bundle trước khi Activity có thể bị huỷ, để onCreate đọc lại.",
    c: `override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    outState.putInt("count", count)
}`,
  },
  savedInstanceState: {
    p: "Android",
    d: "Bundle truyền vào onCreate: null ở lần tạo đầu, có dữ liệu khi Activity được tạo lại (xoay màn hình, process bị kill).",
    c: `count = savedInstanceState?.getInt("count") ?: 0`,
  },
  isChangingConfigurations: {
    p: "Android",
    d: "true khi Activity đang bị huỷ chỉ để tạo lại (xoay màn hình, đổi ngôn ngữ), không phải người dùng thoát.",
    c: `if (isChangingConfigurations) return`,
  },
  setContentView: {
    p: "Android",
    d: "Gắn layout (XML hoặc View) làm nội dung của Activity. Gọi trong onCreate.",
    c: `setContentView(R.layout.activity_main)`,
  },
  findViewById: {
    p: "Android",
    d: "Tìm một view trong layout theo id để đọc/sửa nó.",
    c: `val title = findViewById<TextView>(R.id.title)
title.text = "Xin chào"`,
  },
};

const tipKey = (el) => {
  const t = el.textContent.trim();
  return TIPS[t] ? t : null;
};

let pop;
let hideTimer;

function popup() {
  if (pop) return pop;
  pop = document.createElement("div");
  pop.className = "api-tip";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  pop.addEventListener("mouseleave", hideSoon);
  document.body.appendChild(pop);
  return pop;
}

function show(el) {
  clearTimeout(hideTimer);
  const key = el.dataset.tip;
  const tip = TIPS[key];
  const box = popup();
  box.innerHTML = "";
  const head = document.createElement("div");
  head.className = "api-tip-head";
  const name = document.createElement("code");
  name.textContent = key;
  const plat = document.createElement("span");
  plat.className = "api-tip-plat";
  plat.textContent = tip.p;
  head.append(name, plat);
  const desc = document.createElement("p");
  desc.textContent = tip.d;
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = tip.c;
  pre.appendChild(code);
  box.append(head, desc, pre);
  box.hidden = false;

  const r = el.getBoundingClientRect();
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const below = r.bottom + 8 + h < window.innerHeight;
  const top = below ? r.bottom + 6 : r.top - h - 6;
  box.style.left = `${left + window.scrollX}px`;
  box.style.top = `${top + window.scrollY}px`;
}

function hideSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (pop) pop.hidden = true; }, 150);
}

document$.subscribe(() => {
  if (pop) pop.hidden = true;
  document.querySelectorAll(".md-typeset code, .md-typeset a").forEach((el) => {
    if (el.closest("pre, .api-tip, .md-nav, .headerlink")) return;
    if (el.tagName === "A" && el.querySelector("code")) return; // link bọc code: gắn vào từng code bên trong
    const key = tipKey(el);
    if (!key || el.dataset.tip) return;
    el.dataset.tip = key;
    el.classList.add("has-tip");
    if (el.tagName !== "A") el.tabIndex = 0;
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("mouseleave", hideSoon);
    el.addEventListener("focus", () => show(el));
    el.addEventListener("blur", hideSoon);
  });
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) pop.hidden = true; });
