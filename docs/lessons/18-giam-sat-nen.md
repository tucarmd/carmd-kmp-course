---
source: lessons/18-background-monitor.html
source_ref: live
source_sha: fa9a20c
---

<p class="kicker">Bài 18 · Tuần 4 · Ngày 18 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/18-background-monitor.html">Bản gốc tiếng Anh</a></p>

# Giám sát nền: dựng nó

<div class="meta">
  <span class="tag">~2 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m13 monitor ghi log trạng thái theo chu kỳ</span>
  <span class="tag">Cần trước: <a href="../17-trang-thai-may-va-kho-log/">17</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Bài 17 cho app trạng thái của điện thoại và một log để giữ nó. Việc thật của một device monitor là cứ đọc tiếp khi không ai nhìn: mỗi 15 phút, khi app đang mở, khi ở nền, hay khi không chạy chút nào. Không điện thoại nào để một app lặp mãi ở nền. Android chạy việc lặp lại qua WorkManager, nhiều nhất 15 phút một lần; iOS tạm dừng một app ở nền và chỉ mở lại nó khi nó quyết định, qua `BGTaskScheduler`. Hôm nay app có một inbound port `DeviceMonitoring` và một monitoring service biến mỗi nhịp (tick) thành một bản ghi log, và một outbound port `MonitorScheduler` mà hai adapter xin mỗi nền tảng các nhịp theo cách nó cho phép. Monitor khởi động ở nơi app khởi động, không phải nơi một màn hình hiện ra, vì những lần mở app quan trọng nhất không hiện màn hình nào. Đó là milestone **m13**: monitor ghi log trạng thái theo chu kỳ, trên cả hai nền tảng.

!!! info "Nguồn chính"
    Các trang [Task scheduling](https://developer.android.com/topic/libraries/architecture/workmanager) (WorkManager) và [Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work) (phần "Schedule periodic work") của Android trước mục 4. Trang [Using background tasks to update your app](https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app) của Apple trước mục 5, cùng các comment trong `BGTaskScheduler.h` (Xcode: Open Quickly, ⇧⌘O). Trang [Clock](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.time/-clock/) của Kotlin trước mục 3.

!!! info "Track"
    Các port, service, cả hai adapter, móc khởi động app và các test là code dùng chung, giống nhau trên mọi track, và class `Application` của Android cũng vậy. Chỉ phần khởi động app iOS khác: `iOSApp.swift` (SwiftUI) hoặc `AppDelegate.swift` (UIKit), mỗi cái có `project.yml` riêng. Hôm nay không màn hình nào đổi: bài 20 cho monitor các nút của nó. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m12

| Cái gì | m12 | m13 |
|---|---|---|
| app core | quét, quyền, BLE session, báo cáo trạng thái; port `LogStore` | một model mới, `MonitorStatus`; một inbound port mới, `DeviceMonitoring`, do `MonitoringService` implement; một outbound port mới, `MonitorScheduler`. Các quy tắc trạng thái dời ra khỏi `StatusService` vào `readStatus`, thứ cả hai service gọi |
| adapter Android | radio BLE, quyền, trạng thái, `AndroidLogStore` | thêm `AndroidMonitorScheduler` và `MonitorWorker` của nó, dùng WorkManager 2.12.0 (một dòng trong `shared/build.gradle.kts`); manifest không đổi |
| adapter iOS | các class BLE, quyền và trạng thái bằng Swift; `IosLogStore` trong `iosMain` | thêm `IosMonitorScheduler`, Kotlin trong `iosMain` dùng BackgroundTasks và UIKit của Apple; `project.yml` có thêm background mode và task identifier |
| inbound adapter dùng chung | ViewModel của hai màn hình | thêm `AppLaunch.kt`: `onAppLaunch()`, thứ khởi động monitor |
| Koin | sáu adapter truyền vào `initKoin`; `LogStore` chưa bind | tám: thêm kho log và scheduler. `DeviceMonitoring` được bind với `MonitoringService` |
| lúc app khởi động | `initKoin(…)` | `initKoin(…)`, rồi `onAppLaunch()`: trong `Application.onCreate`, `init` của `App` SwiftUI, hoặc `didFinishLaunchingWithOptions` của UIKit |
| các màn hình | không đổi |
| test | 87 mỗi nền tảng | 95 mỗi nền tảng: 7 cho monitoring service, thêm 1 cho graph Koin |

## 1. Ai giữ đồng hồ

Khi đang trên màn hình, một app chạy được bất kỳ bộ hẹn giờ nào nó thích. Khi đã rời màn hình, cái gì chạy và khi nào là quyết định của từng nền tảng, theo cách riêng của nó:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="l18-clock-title">
      <title id="l18-clock-title">Ai chạy nhịp của monitor, trong ba tình huống từ trái sang phải: app trên màn hình, app ở nền, và process của app đã mất. Trên Android, ở cả ba, WorkManager chạy nhịp nhiều nhất 15 phút một lần, thường muộn hơn, vào lúc Android chọn; khi process đã mất, nó khởi động process trước, và Application.onCreate chạy trước việc đó. Trên iOS, khi app trên màn hình, bộ hẹn giờ riêng của app nhịp mỗi 15 phút. Ở nền iOS tạm dừng app, và khi process đã mất thì không gì của app chạy; trong cả hai trường hợp, một background refresh task có thể mở hoặc đánh thức app, không trước ngày giờ sớm nhất app đã xin, vào lúc iOS chọn, và không bao giờ trên Simulator.</title>
      <defs><marker id="l18-clock-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="title small" x="150" y="28">app trên màn hình</text>
      <text class="title small" x="360" y="28">ở nền</text>
      <text class="title small" x="580" y="28">process đã mất</text>
      <line class="axis" x1="120" y1="40" x2="740" y2="40"></line>
      <g data-part="android">
        <text class="title" x="20" y="96">Android</text>
        <rect class="box" x="120" y="66" width="620" height="60" rx="6"></rect>
        <text class="small" x="134" y="90">WorkManager: nhiều nhất một nhịp mỗi 15 phút, thường muộn hơn; thời điểm là của Android</text>
        <text class="small muted" x="134" y="112">như nhau dù app đang mở hay không; với cột process đã mất, nó khởi động process trước</text>
      </g>
      <circle class="dot" cx="180" cy="150" r="5"></circle>
      <circle class="dot" cx="330" cy="150" r="5"></circle>
      <circle class="dot" cx="500" cy="150" r="5"></circle>
      <circle class="dot" cx="680" cy="150" r="5"></circle>
      <g data-part="ios">
        <text class="title" x="20" y="214">iOS</text>
        <rect class="box" x="120" y="184" width="190" height="60" rx="6"></rect>
        <text class="small" x="132" y="208">bộ hẹn giờ riêng của app:</text>
        <text class="small" x="132" y="228">một nhịp mỗi 15 phút</text>
        <rect class="box" x="330" y="184" width="410" height="60" rx="6"></rect>
        <text class="small" x="342" y="208">bị tạm dừng, hoặc không chạy: không gì của app chạy</text>
        <text class="small" x="342" y="228">cho tới khi iOS mở nó cho một background refresh task</text>
      </g>
      <circle class="dot" cx="200" cy="268" r="5"></circle>
      <circle class="dot" cx="290" cy="268" r="5"></circle>
      <circle class="dot dropped" cx="420" cy="268" r="5"></circle>
      <circle class="dot" cx="610" cy="268" r="5"></circle>
      <path class="edge dashed" d="M430,268 L598,268" marker-end="url(#l18-clock-arrow)"></path>
      <text class="small muted" x="440" y="292">"không trước" ngày giờ đã xin; iOS chọn khi nào, hoặc không bao giờ</text>
      <text class="small muted" x="20" y="320">Chấm: các nhịp. Chấm rỗng là lúc app xin được chạy; chấm đặc là lúc iOS có thể chạy nó. Simulator không bao giờ chạy nó.</text>
    </svg>
    <figcaption>Trên Android một cơ chế bao mọi trường hợp; trên iOS foreground và nền là hai cơ chế khác nhau.
<ul class="legend">
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

1. **Android: WorkManager.** "WorkManager dành cho việc cần chạy đáng tin cậy kể cả khi người dùng rời màn hình, app thoát, hoặc thiết bị khởi động lại", và nó "giữ các tác vụ qua những lần app khởi động lại và thiết bị reboot" ([Task scheduling](https://developer.android.com/topic/libraries/architecture/workmanager)). Với việc lặp lại: "Khoảng lặp tối thiểu có thể định nghĩa là 15 phút (giống JobScheduler API)", và "Khoảng thời gian được định nghĩa là thời gian tối thiểu giữa các lần lặp. Thời điểm chính xác worker được chạy phụ thuộc vào các ràng buộc bạn dùng trong object WorkRequest và vào các tối ưu mà hệ thống thực hiện" ([Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)).
2. **iOS: hai cơ chế.** Ở foreground app chạy bộ hẹn giờ riêng. Ở nền, app bị tạm dừng, và "Background task cho app một cách để chạy code khi app đang bị tạm dừng" (`BGTaskScheduler.h`). `earliestBeginDate` của một refresh task nghĩa là "hệ thống không đảm bảo mở task vào đúng ngày giờ chỉ định, mà chỉ đảm bảo nó sẽ không bắt đầu sớm hơn", và "Hệ thống sẽ đáp ứng request này một cách thông minh dựa trên điều kiện hệ thống và cách dùng app" (`BGTaskRequest.h`). Ví dụ của chính Apple xin "không sớm hơn 15 phút kể từ bây giờ" ([Using background tasks](https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app)).
3. **15 phút, trên cả hai.** Đó là mức sàn của Android, và một nhịp hợp lý cho pin và mạng của điện thoại. iOS không có mức sàn trong API, và cũng không có lời hứa nào: ở nền, 15 phút là sớm nhất, không bao giờ là lịch. Bài 19 đo xem mỗi điện thoại thật sự làm gì.

**Không lách giới hạn của hệ điều hành.** Mỗi nền tảng có những công cụ trông như một cách lách qua. Mỗi cái hoặc dành cho việc khác, hoặc không được phép cho việc này:

| Hấp dẫn | Nền tảng nói gì |
|---|---|
| một vòng coroutine với `delay` trong ViewModel hay Activity | Coroutine dành cho việc "không cần tồn tại tiếp nếu app rời trạng thái hiển thị"; "chúng dừng ngay khi app đóng. Với việc cần tồn tại cả sau khi app đóng, hãy dùng WorkManager" ([Task scheduling](https://developer.android.com/topic/libraries/architecture/workmanager)). Adapter iOS có dùng một bộ hẹn giờ, nhưng chỉ ở foreground, nơi điều đó hoàn toàn đúng. |
| exact alarm của Android vài phút một lần | "exact alarm đánh thức thiết bị khỏi chế độ Doze. Vì vậy nó không hiệu quả về quản lý năng lượng và tài nguyên. Chỉ dùng nó cho báo thức hoặc thông báo cần chính xác như sự kiện lịch, không dùng cho việc nền lặp lại" (cùng trang đó). |
| một foreground service của Android chạy mãi, để giữ process sống | "Chỉ dùng foreground service khi app cần làm một tác vụ người dùng nhận thấy được" ([Foreground services overview](https://developer.android.com/develop/background-work/services/fgs)). Nó hiện một thông báo khi đang chạy, cần một type được khai báo từ Android 14, và một app nhắm Android 12 trở lên "không khởi động được foreground service khi app đang chạy ở nền, trừ vài trường hợp đặc biệt" (mục 4). |
| một background mode của iOS mà app không cần (audio, vị trí) để được thức | App Review Guideline 2.5.4: "App đa nhiệm chỉ được dùng các dịch vụ nền cho đúng mục đích của chúng: VoIP, phát audio, vị trí, hoàn tất tác vụ, thông báo cục bộ, v.v." ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). |

## 2. Hai port: thứ app cung cấp, thứ app cần

Appendix A.7 của kế hoạch khoá học đòi một monitor có thể bắt đầu theo một chu kỳ, dừng, báo nó đang ở đâu, và hiện hoặc xoá log của nó. Đó là inbound port:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceMonitoring.kt" hl_lines="4 7 10"
interface DeviceMonitoring {
    // Starts the monitor, or changes its interval: about every interval, as often as the
    // platform allows, it reads the phone's status and appends it to the log.
    fun start(interval: Duration)

    // Stops the monitor. The log is kept.
    fun stop()

    // Stopped, or running with its newest reading and error.
    val status: StateFlow<MonitorStatus>
⋯ logs(): every record, oldest first; clearLogs(): removes them (both suspend)
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitorStatus.kt" hl_lines="1 6"
sealed interface MonitorStatus {
    data object Stopped : MonitorStatus

    // Started, at this interval. lastRecord is the newest reading this process saved; lastError
    // is set when the newest attempt couldn't be saved, and cleared by the next one that is.
    data class Running(
        val interval: Duration,
        val lastRecord: LogRecord? = null,
        val lastError: String? = null,
    ) : MonitorStatus
}
```

1. **`start` không phải `suspend`**: nó trao nhịp cho nền tảng rồi trả về. Các nhịp tới sau, theo lịch của nền tảng.
2. **Một `StateFlow`, như `connectionState` của session** (bài 14): một màn hình collect được nó, và một test đọc được `.value`. `MonitorStatus` là sealed vì cùng lý do với `ConnectionState`: một `when` trên nó phải xử lý cả hai state.
3. **"Process này".** Trạng thái sống trong bộ nhớ, nên mỗi process có cái riêng. Trên Android, một nhịp có thể chạy trong một process mà WorkManager khởi động khi không ai nhìn; nếu process đó kết thúc và một process mới hiện màn hình sau, process mới không bao giờ thấy `lastRecord` của nhịp đó. File log là thứ còn lại lâu dài.

Thứ service cần từ nền tảng là một bộ hẹn giờ mà nó không tự dựng được:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MonitorScheduler.kt" hl_lines="5 7 10"
// Outbound port: the platform's way to run the monitor's tick on a timer, inside the limits the
// platform sets. One adapter per platform: WorkManager on Android, a timer and BGTaskScheduler
// on iOS. Neither promises an exact time: the interval is "about", and in the background the
// platform decides when.
interface MonitorScheduler {
    // Calls tick about every interval until cancel(). Calling it again replaces both.
    fun schedule(interval: Duration, tick: suspend () -> Unit)

    // Stops calling tick.
    fun cancel()
}
```

1. **Đặt tên theo thứ app cần**, không theo một nền tảng: không "work", không "task", không "job". WorkManager và `BGTaskScheduler` ở yên bên trong adapter của chúng.
2. **Nhịp là một hàm `suspend` mà service trao đi.** Adapter quyết định *khi nào*; service quyết định *làm gì*. Cách chia đó là toàn bộ thiết kế: các quy tắc của một nhịp được test trên JVM và trong iOS simulator với một bộ hẹn giờ giả (mục 7), và mỗi adapter chỉ là một bộ hẹn giờ.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 470" role="img" aria-labelledby="l18-hex-title">
      <title id="l18-hex-title">Các phần của monitor. Lần khởi động app, một inbound adapter trong code dùng chung tên onAppLaunch, gọi inbound port DeviceMonitoring. MonitoringService trong app core implement nó. Nó gọi sáu outbound port: bốn port trạng thái của bài 17 (BatteryProvider, NetworkProvider, BluetoothProvider, và ConnectionStatus, thứ bridge SessionConnectionStatus trả lời từ session), LogStore, và MonitorScheduler. Các quy tắc trạng thái là một hàm trong app core, readStatus, mà cả MonitoringService và StatusService gọi. MonitorScheduler được implement trên Android bởi AndroidMonitorScheduler, Kotlin trong androidMain dùng WorkManager, và trên iOS bởi IosMonitorScheduler, Kotlin trong iosMain dùng BackgroundTasks và UIKit. Khi tới giờ, mỗi adapter gọi cái nhịp mà service đã trao cho nó.</title>
      <defs><marker id="l18-hex-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="inbound">
        <rect class="box" x="10" y="150" width="150" height="60" rx="6"></rect>
        <text class="title small" x="20" y="174">onAppLaunch()</text>
        <text class="small muted" x="20" y="194">inbound adapter</text>
      </g>
      <g data-part="core">
        <rect class="box" x="190" y="40" width="320" height="330" rx="6"></rect>
        <text class="title" x="204" y="64">App core</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="204" y="150" width="140" height="40" rx="6"></rect>
        <text class="mono small" x="214" y="175">DeviceMonitoring</text>
      </g>
      <g data-part="core">
        <rect class="box" x="204" y="210" width="140" height="40" rx="6"></rect>
        <text class="mono small" x="214" y="235">MonitoringService</text>
        <rect class="box" x="204" y="300" width="140" height="40" rx="6"></rect>
        <text class="mono small" x="214" y="325">readStatus(…)</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="368" y="60" width="132" height="70" rx="6"></rect>
        <text class="small" x="378" y="82">BatteryProvider,</text>
        <text class="small" x="378" y="100">NetworkProvider,</text>
        <text class="small" x="378" y="118">BluetoothProvider</text>
        <rect class="box" x="368" y="150" width="132" height="40" rx="6"></rect>
        <text class="mono small" x="376" y="175">ConnectionStatus</text>
        <rect class="box" x="368" y="210" width="132" height="40" rx="6"></rect>
        <text class="mono small" x="376" y="235">LogStore</text>
        <rect class="box" x="368" y="270" width="132" height="40" rx="6"></rect>
        <text class="mono small" x="376" y="295">MonitorScheduler</text>
      </g>
      <g data-part="android">
        <rect class="box" x="540" y="230" width="210" height="60" rx="6"></rect>
        <text class="title small" x="550" y="252">AndroidMonitorScheduler</text>
        <text class="small muted" x="550" y="274">androidMain · WorkManager</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="540" y="310" width="210" height="60" rx="6"></rect>
        <text class="title small" x="550" y="332">IosMonitorScheduler</text>
        <text class="small muted" x="550" y="354">iosMain · BackgroundTasks, UIKit</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="540" y="140" width="210" height="60" rx="6"></rect>
        <text class="title small" x="550" y="162">SessionConnectionStatus</text>
        <text class="small muted" x="550" y="184">bridge adapter (bài 17)</text>
      </g>
      <path class="edge" d="M160,175 L202,172" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M274,190 L274,208" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M344,220 L366,100" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M344,226 L366,172" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M344,232 L366,230" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M344,240 L366,286" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge" d="M274,250 L274,298" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge dashed" d="M538,170 L502,170" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge dashed" d="M538,262 L502,290" marker-end="url(#l18-hex-arrow)"></path>
      <path class="edge dashed" d="M538,336 L502,300" marker-end="url(#l18-hex-arrow)"></path>
      <text class="small muted" x="10" y="410">Liền: lời gọi. Đứt: adapter implement outbound port. Các adapter nền tảng của port trạng thái (bài 17) được lược bỏ.</text>
      <text class="small muted" x="10" y="430">Khi tới giờ, adapter scheduler gọi lại cái nhịp mà MonitoringService đã trao cho nó.</text>
      <text class="small muted" x="10" y="450">StatusService (bài 17) cũng gọi readStatus; trong test, các fake thế chỗ mọi adapter.</text>
    </svg>
    <figcaption>Một inbound port, sáu outbound port; chỉ <code>MonitorScheduler</code> là mới ở phía ngoài.
<ul class="legend">
    <li data-part="core">App core</li>
    <li data-part="inbound">Inbound</li>
    <li data-part="outbound">Outbound port và bridge adapter</li>
    <li data-part="android">Adapter Android</li>
    <li data-part="ios">Adapter iOS</li>
  </ul>
</figcaption>
  </figure>

## 3. Monitoring service: một nhịp, một bản ghi

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitoringService.kt" hl_lines="1 5 8 14 18"
class MonitoringService(
    private val battery: BatteryProvider,
    private val network: NetworkProvider,
    private val bluetooth: BluetoothProvider,
    private val connection: ConnectionStatus,
    private val log: LogStore,
    private val scheduler: MonitorScheduler,
    private val clock: Clock = Clock.System,
) : DeviceMonitoring {
⋯ _status: MutableStateFlow<MonitorStatus>(Stopped), exposed as status
    override fun start(interval: Duration) {
        require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
        _status.value = MonitorStatus.Running(interval)
        scheduler.schedule(interval) { tick() }
    }

    override fun stop() {
        scheduler.cancel()
        _status.value = MonitorStatus.Stopped
    }
⋯ logs() = log.read(); clearLogs() = log.clear()
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitoringService.kt" hl_lines="4 5 7 9"
    // One reading. A tick that comes after stop() writes nothing. A file error doesn't stop the
    // monitor: it shows in the status, and the next tick tries again.
    private suspend fun tick() {
        if (_status.value !is MonitorStatus.Running) return
        val record = LogRecord(clock.now(), readStatus(battery, network, bluetooth, connection))
        val error = try {
            log.append(record)
            null
        } catch (e: LogStoreException) {
            e.message
        }
⋯ _status.update: Running gets lastRecord = record and lastError = null, or lastError = error
    }
```

1. **Lại bốn port trạng thái, kể cả `ConnectionStatus`.** Monitor đọc "Bluetooth connected" qua port của bài 17 và bridge của nó, không bao giờ qua `DeviceSession`: các service không biết nhau (bài 17, mục 3). Koin trao cho cả hai service cùng các adapter, nên một bản ghi và dòng trạng thái của màn hình danh sách đọc từ cùng nguồn.
2. **Sao không có bridge tới `StatusReport`?** Bridge dành cho thứ một khả năng khác *giữ*: session sở hữu state kết nối, nên trạng thái hỏi qua một bridge. Không ai trong app giữ mức pin hay mạng; nền tảng giữ, và monitor hỏi thẳng các port của nền tảng. Thứ hai service dùng chung là *quy tắc*, và quy tắc mà hai service dùng chung được viết một lần, thành một hàm thường trong app core:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ReadStatus.kt" hl_lines="4"
// The app's rules for the phone's status, written once: StatusService answers the screen with
// them, and MonitoringService logs them. A plain function in the app core, not a third service:
// it applies rules to what the ports report, and holds no state.
internal suspend fun readStatus(
    battery: BatteryProvider,
    network: NetworkProvider,
    bluetooth: BluetoothProvider,
    connection: ConnectionStatus,
): DeviceStatus {
⋯ the body of Lesson 17's StatusService.current(): the Wi-Fi rule, and only Connected counts
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/StatusService.kt" hl_lines="2"
⋯ class StatusService(battery, network, bluetooth, connection) : StatusReport {
    override suspend fun current(): DeviceStatus = readStatus(battery, network, bluetooth, connection)
}
```

1. **Vẫn trong app core, vẫn được test qua cả hai service.** `StatusServiceTest` không đổi và vẫn pass; `theRecordFollowsTheStatusRules` của `MonitoringServiceTest` kiểm tra cùng hai quy tắc trong một bản ghi. Gỡ quy tắc Wi-Fi khỏi `readStatus` làm fail một test ở mỗi bên (chúng tôi đã thử). `internal` giữ nó ngoài header của Swift.
2. **Một `Clock`, được truyền vào.** `kotlin.time.Clock` là interface của thư viện chuẩn có một method, `now()`. Reference của nó: "Không nên dùng `Clock.System` trực tiếp trong phần cài đặt. Thay vào đó, bạn có thể truyền một `Clock` tường minh vào các hàm hay class cần nó. Như vậy, test có thể viết theo cách xác định bằng cách đưa vào các bản cài đặt `Clock` tuỳ chỉnh" ([Clock](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.time/-clock/)). Giá trị mặc định giữ cho binding Koin ngắn; các test truyền một đồng hồ do chúng đặt.
3. **Một nhịp muộn không ghi gì.** Một nền tảng có thể đang sắp gọi nhịp đúng lúc `stop()` chạy: WorkManager có thể đã khởi động worker, hoặc một coroutine có thể đã qua `delay` của nó. Dòng đầu làm "đã dừng" nghĩa là đã dừng thật. `stopCancelsAndALateTickWritesNothing` fail khi thiếu nó (chúng tôi đã thử).
4. **Một lỗi file là một lần đọc thất bại, không phải crash.** Đĩa đầy (`LogStoreException`, bài 17) nằm trong `lastError`, và nhịp sau thử lại. Mọi thứ khác vẫn ném: một bug phải lộ ra rõ ràng.

## 4. Android: WorkManager

WorkManager tới từ Jetpack: `implementation("androidx.work:work-runtime:2.12.0")` trong dependency của `androidMain` ở `shared/build.gradle.kts`. Từ 2.9, các API Kotlin nằm trong artifact đó: "`work-runtime-ktx` giờ rỗng, `CoroutineWorker` và các tiện ích riêng cho Kotlin giờ có trong artifact `work-runtime` chính" ([WorkManager release notes](https://developer.android.com/jetpack/androidx/releases/work)).

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt" hl_lines="1 5 7 8 11 16"
class AndroidMonitorScheduler(context: Context) : MonitorScheduler {
    private val workManager = WorkManager.getInstance(context)

    override fun schedule(interval: Duration, tick: suspend () -> Unit) {
        currentTick = tick
        // Android's floor for periodic work is 15 minutes: never ask for less.
        val period = interval.coerceAtLeast(PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS.milliseconds)
        val request = PeriodicWorkRequestBuilder<MonitorWorker>(period.toJavaDuration()).build()
        // One schedule however many launches call this: UPDATE keeps the work that is already
        // scheduled, with its timing, and only changes its period.
        workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    override fun cancel() {
        currentTick = null
        workManager.cancelUniqueWork(WORK_NAME)
    }
⋯ companion object: WORK_NAME = "status-monitor", and currentTick (below)
}
```

1. **Việc định kỳ, cách nhau ít nhất 15 phút.** "Khoảng lặp phải lớn hơn hoặc bằng `PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS`" ([Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)). `coerceAtLeast` biến đó thành lời hứa của adapter thay vì một bất ngờ. Builder nhận một `java.time.Duration` cần API 26, mức tối thiểu của app; `toJavaDuration()` đổi từ cái của Kotlin.
2. **Việc duy nhất, theo tên.** App khởi động monitor ở mỗi lần mở (mục 6), nên `schedule` chạy nhiều lần. `UPDATE`: "Nếu đã có việc đang chờ (chưa xong) cùng tên duy nhất, nó sẽ được cập nhật với đặc tả mới. Nếu không, việc mới với tên đó sẽ được xếp hàng", và "Nó giữ nguyên thời điểm xếp hàng" ([ExistingPeriodicWorkPolicy](https://developer.android.com/reference/androidx/work/ExistingPeriodicWorkPolicy)). `KEEP` sẽ bỏ qua một chu kỳ mới; `CANCEL_AND_REENQUEUE` bắt đầu lại từ đầu: với nó, lần mở lại của chúng tôi ghi ngay một bản ghi thứ hai. Với `UPDATE`, một lần mở lại để lần chạy tiếp theo ở yên chỗ cũ (`dumpsys jobscheduler` vẫn đếm lùi) và không ghi bản ghi thừa nào.
3. **Lần chạy đầu là ngay lập tức.** Một request định kỳ mới không có độ trễ ban đầu, nên bản ghi đầu tiên xuất hiện ngay sau lần mở đầu tiên: trên emulator, trong vòng một giây sau `am start`.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt" hl_lines="7 13 15 17"
    internal companion object {
        const val WORK_NAME = "status-monitor"

        // WorkManager builds MonitorWorker itself, so the worker can't be handed the tick: it
        // finds it here, in the process they share. A new process gets it from onAppLaunch.
        @Volatile
        var currentTick: (suspend () -> Unit)? = null
    }
}

// What WorkManager runs each period, in the app's process: Android starts the process for it
// if it isn't running, and Application.onCreate runs first.
class MonitorWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val tick = AndroidMonitorScheduler.currentTick
        Log.i("DeviceMonitor", if (tick == null) "Monitor work ran, but the monitor is stopped" else "Monitor tick")
        tick?.invoke()
        return Result.success()
    }
}
```

1. **WorkManager tự dựng worker.** "Các class ListenableWorker được khởi tạo lúc chạy bởi `WorkerFactory` chỉ định trong `Configuration`" ([ListenableWorker](https://developer.android.com/reference/androidx/work/ListenableWorker)), và app này giữ cấu hình mặc định, mà factory của nó tìm constructor nhận một `Context` và `WorkerParameters` (`getDeclaredConstructor` trong bytecode của `WorkerFactory`, work-runtime 2.12.0). Một lambda cũng không đi kèm request được: "Việc đã lên lịch được lưu trong một cơ sở dữ liệu SQLite quản lý nội bộ" ([Task scheduling](https://developer.android.com/topic/libraries/architecture/workmanager)). Nên worker với tới nhịp qua thứ duy nhất nó dùng chung với adapter: process. `@Volatile`, vì worker đọc nó trên một thread khác.
2. **Một process mới.** Nếu app không chạy, Android khởi động process của nó để chạy việc: trên emulator, logcat ghi "Start proc … for service {com.example.devicemonitor/androidx.work.impl.background.systemjob.SystemJobService}", `JobService` của WorkManager. `Application.onCreate` được "Gọi khi application đang khởi động, trước khi bất kỳ object activity, service hay receiver nào (trừ content provider) được tạo" ([Application](https://developer.android.com/reference/android/app/Application#onCreate())), nên `onAppLaunch()` đã trao nhịp trước khi `doWork` chạy (mục 6).
3. **`CoroutineWorker`** cho `doWork` là `suspend`, và "mặc định dùng `Dispatchers.Default`" ([Threading in CoroutineWorker](https://developer.android.com/develop/background-work/background-tasks/persistent/threading/coroutineworker)). Ở đây điều đó ổn: không adapter trạng thái Android nào của bài 17 cần main thread (cái mạng đã giữ map trong `ConcurrentHashMap`, vì callback của nó tới trên thread khác), và kho log tự dời sang `Dispatchers.IO`.
4. **Không đổi manifest.** Manifest riêng của WorkManager được gộp vào của app: `aapt2 dump permissions` trên APK của chúng tôi liệt kê `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED` và `FOREGROUND_SERVICE`, và merge report ghi tên `work-runtime:2.12.0` cho mỗi cái.

!!! warning "Gotcha · bạn không ép một lần chạy định kỳ chạy sớm được"
    JobScheduler có thể chạy một job theo yêu cầu (`adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler com.example.devicemonitor <job id>`; trên emulator API 36 của chúng tôi, các job của WorkManager nằm trong namespace đó, và thiếu `-n` thì lệnh nói "Could not find job"). Với việc định kỳ của chúng tôi, chạy trước khi đủ 15 phút, WorkManager khi đó từ chối: "Delaying execution for com.example.devicemonitor.adapter.outbound.MonitorWorker because it is being executed before schedule." (logcat, tag `WM-WorkerWrapper`), và không ghi bản ghi nào. Muốn thấy nhịp thứ hai, hãy chờ đủ 15 phút: khi job đã tới hạn, cùng lệnh đó được chấp nhận và worker chạy. Job id cũng đổi khi WorkManager lên lịch lại, nên hãy đọc nó từ `dumpsys jobscheduler` mỗi lần.

**Còn foreground service thì sao?** Kế hoạch khoá học gọi tên nó cạnh WorkManager, và nó là công cụ đúng cho một monitor khác: một monitor người dùng tự bắt đầu và theo dõi, như đọc số liệu trực tiếp từ một thiết bị đã kết nối mỗi vài giây trong khi một thông báo nói rõ điều đó. Hướng dẫn về tác vụ nền của Android nói như vậy: "Nếu tác vụ không vô hình với người dùng, giải pháp đúng có thể là dùng foreground service. Các service này chạy liên tục một khi đã khởi động", còn với việc có thể chờ, "Trong đa số trường hợp, lựa chọn tốt nhất để chạy tác vụ nền là dùng WorkManager" ([Background tasks overview](https://developer.android.com/develop/background-work/background-tasks)). Monitor của chúng ta vô hình và có thể chờ vài phút, nên dùng WorkManager. Một foreground service còn cần, từ Android 14, "một service type phù hợp cho mỗi foreground service" khai báo trong manifest kèm quyền của nó ([Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)), và không khởi động được từ nền: "App nhắm Android 12 (API 31) trở lên không khởi động được foreground service khi app đang chạy ở nền, trừ vài trường hợp đặc biệt" ([Restrictions on starting a foreground service from the background](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)).

## 5. iOS: một bộ hẹn giờ ở foreground, BGTaskScheduler ở nền

Adapter iOS là Kotlin trong `iosMain`, như kho log của bài 17: port nhận một `Duration` của Kotlin và một lambda `suspend`, thứ tới header của Swift thành một `int64_t` và một `id<SharedKotlinSuspendFunction0>` (`- (void)scheduleInterval:(int64_t)interval tick:…`), trong khi Kotlin/Native import BackgroundTasks và UIKit của Apple thành `platform.BackgroundTasks` và `platform.UIKit`. Nó theo dõi trạng thái của app bằng các notification mức app của UIKit:

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt" hl_lines="1 7 10 13 15 17"
class IosMonitorScheduler : MonitorScheduler {
    private val scope = MainScope() // ticks run on the main thread, like the status adapters
⋯ scheduler = BGTaskScheduler.sharedScheduler; tick, interval, timer: Job?
    init {
        // Once per process, and during launch: registering after launch is an error, and a second
        // registration of the same identifier ends the app. false: the identifier isn't permitted.
        val registered = scheduler.registerForTaskWithIdentifier(TASK_ID, dispatch_get_main_queue()) { task ->
            refresh(task as BGAppRefreshTask)
        }
        check(registered) { "$TASK_ID isn't in BGTaskSchedulerPermittedIdentifiers (project.yml)." }
        // App-level lifecycle, not a screen's: these fire whichever screen is showing.
        val center = NSNotificationCenter.defaultCenter
        center.addObserverForName(UIApplicationDidBecomeActiveNotification, null, NSOperationQueue.mainQueue) { _ ->
            scheduler.cancelTaskRequestWithIdentifier(TASK_ID) // the timer takes over
            startTimer()
        }
        center.addObserverForName(UIApplicationDidEnterBackgroundNotification, null, NSOperationQueue.mainQueue) { _ ->
⋯ hand over: if the timer is running, cancel it and submit() a refresh request
        }
    }
```

1. **Đăng ký trong `init`, nên được dựng lúc mở app.** Apple: "Việc đăng ký mọi launch handler phải xong trước khi kết thúc `applicationDidFinishLaunching(_:)`", và "Chỉ đăng ký mỗi task identifier một lần. Hệ thống kill app ở lần đăng ký thứ hai của cùng một task identifier" ([register(forTaskWithIdentifier:using:launchHandler:)](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler/register(fortaskwithidentifier:using:launchhandler:))). Nên phần khởi động app dựng một `IosMonitorScheduler()` và truyền nó vào `doInitKoin`, như các adapter khác; một `single { IosMonitorScheduler() }` của Koin sẽ dựng nó vào lúc có thứ đầu tiên xin, có thể sau khi mở app. `register` "Trả về `false` nếu identifier không có trong `BGTaskSchedulerPermittedIdentifiers` của Info.plist", và `check` sau nó biến điều đó thành một crash lúc mở app kèm thông báo nói phải sửa gì, thay vì một monitor lặng lẽ không bao giờ chạy ở nền.
2. **Main queue, và `MainScope`.** Truyền `nil` cho queue sẽ nghĩa là "một background queue mặc định". Nhịp đọc các adapter trạng thái iOS của bài 17, thứ là `@MainActor` và kiểm tra lúc chạy rằng chúng được gọi trên main thread, nên mọi thứ ở đây chạy ở đó.
3. **Notification mức app.** `didBecomeActiveNotification` "được phát khi app trở nên active", và `didEnterBackgroundNotification` "được phát khi app vào nền" ([didBecomeActiveNotification](https://developer.apple.com/documentation/uikit/uiapplication/didbecomeactivenotification), [didEnterBackgroundNotification](https://developer.apple.com/documentation/uikit/uiapplication/didenterbackgroundnotification)). Cả hai track iOS dùng scene, và với scene UIKit không gọi `applicationDidEnterBackground(_:)` của app delegate, nhưng "UIKit phát `didEnterBackgroundNotification` bất kể app có dùng scene hay không" ([applicationDidEnterBackground(_:)](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/applicationdidenterbackground(_:))): notification chạy được cho SwiftUI lẫn UIKit, từ code dùng chung. `onAppear` hay `viewWillAppear` của một màn hình sẽ theo một màn hình, và hoàn toàn không chạy trong một lần mở app không có màn hình.

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt" hl_lines="4 6 15 16 19"
    private fun startTimer() {
        val tick = tick ?: return
        timer?.cancel()
        timer = scope.launch {
            while (true) {
                delay(interval)
                println("Monitor tick (foreground)")
                tick()
            }
        }
    }

    // Asks iOS to launch the app in the background, not before one interval from now.
    private fun submit() {
        val request = BGAppRefreshTaskRequest(identifier = TASK_ID)
        request.earliestBeginDate = NSDate.dateWithTimeIntervalSinceNow(interval.inWholeSeconds.toDouble())
        memScoped {
            val error = alloc<ObjCObjectVar<NSError?>>()
            if (!scheduler.submitTaskRequest(request, error.ptr)) {
                // On the Simulator, always: it "doesn't support background processing".
                println("Monitor: no background refresh: ${error.value?.localizedDescription}")
            }
        }
    }
```

1. **Ở foreground, một bộ hẹn giờ coroutine thường**: nhịp đầu một chu kỳ sau khi app thành active, rồi mỗi chu kỳ một nhịp khi nó còn active. Khi app vào nền, bộ hẹn giờ bị huỷ, và dù sao cũng không gì chạy nó: iOS tạm dừng app.
2. **Lại mẫu xử lý lỗi của bài 17.** `submitTaskRequest:error:` trả về `NO` và điền một `NSError **`, nên phía Kotlin truyền `error.ptr` trong `memScoped`. "Gửi một task request cho một task chưa chạy đã có trong hàng đợi sẽ thay request trước đó", và "Có thể có tổng cộng 1 refresh task và 10 processing task được lên lịch bất cứ lúc nào" (`BGTaskScheduler.h`): một identifier, nhiều nhất một request đang chờ.
3. **Simulator không làm được.** `BGTaskSchedulerErrorCodeUnavailable` (1) được ghi cho trường hợp "App đang chạy trên Simulator, thứ không hỗ trợ xử lý nền" (`BGTaskScheduler.h`), và đó là thứ chúng tôi nhận được trên Simulator iOS 26.2 mỗi lần app vào nền: "Monitor: no background refresh: The operation couldn't be completed. (BGTaskSchedulerErrorDomain error 1.)". Trên điện thoại, header cho mã 1 khi "Người dùng đã tắt background refresh trong cài đặt"; thiếu background mode hay identifier thì là mã 3, `NotPermitted`.

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt" hl_lines="8 12 14"
    // iOS launched (or woke) the app in the background for the refresh task.
    private fun refresh(task: BGAppRefreshTask) {
        val tick = tick
        if (tick == null) {
            task.setTaskCompletedWithSuccess(true)
            return
        }
        submit() // the next one first: this one may be cut short
        val work = scope.launch {
            println("Monitor tick (background)")
            tick()
            task.setTaskCompletedWithSuccess(true)
        }
        task.expirationHandler = {
            work.cancel()
            task.setTaskCompletedWithSuccess(false)
        }
    }
```

1. **Thứ tự của chính Apple**: handler của mẫu lên lịch một refresh task mới trước, cho task một expiration handler huỷ công việc, và báo hoàn tất khi công việc xong ([Using background tasks](https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app)). Mỗi lần refresh xin lần tiếp theo, nên chuỗi tiếp tục chừng nào iOS còn cấp.
2. **Luôn hoàn tất task.** `BGTask.h`: "Hệ thống tạm dừng app ngay khi mọi background task đã hoàn tất", và "Không gọi `setTaskCompletedWithSuccess:` trước khi thời gian cho task hết có thể khiến hệ thống kill app." Expiration handler được "gọi ngay trước khi thời gian nền của task hết"; huỷ coroutine ở đó dừng một nhịp chậm.
3. **Một lần mở thẳng vào nền** chạy phần khởi động app trước: "hệ thống mở app và chuyển nó thẳng vào nền", rồi UIKit "gọi method `applicationDidEnterBackground(_:)` của app delegate" (với scene, UIKit bỏ qua method đó nhưng vẫn phát notification), rồi "giao sự kiện đã gây ra lần mở" ([About the background execution sequence](https://developer.apple.com/documentation/uikit/about-the-background-execution-sequence)). Notification vào-nền đó tới khi không có bộ hẹn giờ nào đang chạy, nên adapter không gửi gì lúc đó; refresh task gửi cái tiếp theo.

Bài viết của Apple liệt kê hai cài đặt: mode "Background fetch", và task identifier trong `BGTaskSchedulerPermittedIdentifiers`. Thiếu cái đầu, một refresh task không chạy được ("Chạy app refresh task cần đặt capability `fetch` trong `UIBackgroundModes`", `BGTask.h`); thiếu cái thứ hai, `register` "Trả về `false` nếu identifier không có trong `BGTaskSchedulerPermittedIdentifiers` của Info.plist". XcodeGen ghi cả hai từ `project.yml`, trên cả hai track iOS:

```yaml title="iosApp/project.yml" hl_lines="6 7"
    info:
      path: iosApp/Info.plist
      properties:
⋯ CFBundleDisplayName, UILaunchScreen, NSBluetoothAlwaysUsageDescription (and, on UIKit, the scene manifest)
        # The monitor (Lesson 18): background refresh, and the one task identifier it uses.
        UIBackgroundModes: [fetch]
        BGTaskSchedulerPermittedIdentifiers: [com.example.devicemonitor.monitor]
```

Chạy `xcodegen generate` trong `iosApp/` sau đó, và kiểm tra cả hai khoá có trong `Info.plist` được sinh ra. Không gì khác trong project Xcode đổi: adapter mới nằm trong framework Kotlin.

!!! warning "Gotcha · NSLog từ Kotlin làm crash app"
    Bản đầu của chúng tôi ghi lỗi bằng `NSLog("Monitor: no background refresh: %@", message)`, một `String` Kotlin truyền vào `NSLog` dạng variadic của Foundation. App crash ngay lúc nó vào nền (`EXC_BAD_ACCESS` bên trong `NSLog`, địa chỉ trong crash report được làm từ chính các ký tự của thông báo): chuỗi không tới dưới dạng object mà `%@` chờ. `println` của Kotlin không nhận format, và trên iOS nó ghi ra standard output của app: console của Xcode, hoặc `xcrun simctl launch --console-pty`.

## 6. Khởi động nó ở nơi app khởi động

Phải có thứ gọi `start(interval)`, và ở m13 chưa có nút nào. Chỗ hiển nhiên, một màn hình hiện ra, là chỗ sai: một màn hình có thể đi mất trong khi app vẫn chạy, và những lần mở app mà monitor phụ thuộc, Android khởi động process cho WorkManager và iOS mở app cho một refresh task, hoàn toàn không hiện màn hình nào. Móc chạy trong mọi process là phần khởi động app:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/AppLaunch.kt" hl_lines="3 10 11"
// How often the monitor reads the phone's status: the shortest period Android allows for
// repeating background work, used on both platforms.
private val MONITOR_INTERVAL = 15.minutes

// Inbound adapter: the app's launch. Both app starts call this once per process, right after
// initKoin: on every launch, including the ones the OS makes in the background to run the
// monitor, which never show a screen. Each new process needs the monitor's tick handed to the
// scheduler again, and a screen is the wrong place for that: it may never appear, and it goes
// away while the app keeps running.
fun onAppLaunch() {
    KoinPlatform.getKoin().get<DeviceMonitoring>().start(MONITOR_INTERVAL)
}
```

1. **Một inbound adapter không phải ViewModel.** Nó điều khiển app qua một inbound port, đó là điều làm nó thành một inbound adapter (bài 10); ViewModel của các màn hình là loại kia. Nó nằm trong code dùng chung để chu kỳ được viết một lần và Swift không cần `Duration`.
2. **Ở mỗi lần mở app, và điều đó an toàn.** `UPDATE` của adapter Android giữ một lịch; adapter iOS chỉ lưu nhịp và, nếu app đã active, khởi động lại bộ hẹn giờ. Thứ mỗi process mới cần là nhịp: cái lambda mà service đã trao cho process cũ đã chết theo nó.
3. **Luôn bật, tạm thời.** Monitor của m13 chạy bất cứ khi nào app đã chạy một lần. Màn hình của bài 20 thêm Start và Stop, gọi cùng port đó.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 300" role="img" aria-labelledby="l18-life-title">
      <title id="l18-life-title">So sánh các vòng đời, theo thời gian từ trái sang phải. Thanh trên cùng là process của app, từ lúc mở tới lúc kết thúc; phần khởi động app chạy một lần ở đầu và trao nhịp cho monitor. Bên dưới, một màn hình hiện một lúc, bị ẩn khi người dùng ở app khác, hiện lại, rồi đi mất, trong khi process vẫn sống. Một process thứ hai, do hệ điều hành khởi động ở nền cho monitor, chạy lại phần khởi động app nhưng hoàn toàn không hiện màn hình nào. Các móc gắn với màn hình, như onAppear, viewWillAppear hay effect của một composable, chỉ chạy khi màn hình đó tồn tại; phần khởi động app chạy trong cả hai process.</title>
      <defs><marker id="l18-life-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small" x="20" y="62">process 1</text>
      <g data-part="inbound">
        <rect class="box" x="120" y="44" width="360" height="30" rx="4"></rect>
        <text class="small" x="132" y="64">khởi động app: initKoin, onAppLaunch()</text>
      </g>
      <text class="small" x="20" y="112">màn hình của nó</text>
      <g data-part="android">
        <rect class="box" x="150" y="94" width="110" height="30" rx="4"></rect>
        <text class="small" x="160" y="114">hiện</text>
        <rect class="box" x="320" y="94" width="90" height="30" rx="4"></rect>
        <text class="small" x="330" y="114">hiện</text>
      </g>
      <text class="small muted" x="266" y="114">ẩn</text>
      <text class="small muted" x="414" y="114">mất</text>
      <text class="small" x="20" y="182">process 2</text>
      <g data-part="inbound">
        <rect class="box" x="540" y="164" width="200" height="30" rx="4"></rect>
        <text class="small" x="550" y="184">khởi động app, lần nữa</text>
      </g>
      <text class="small" x="20" y="232">màn hình của nó</text>
      <text class="small muted" x="550" y="232">không có: hệ điều hành mở nó cho monitor</text>
      <path class="edge dashed" d="M480,60 L538,176" marker-end="url(#l18-life-arrow)"></path>
      <text class="small muted" x="486" y="140">process kết thúc</text>
      <text class="small muted" x="20" y="280">Các móc màn hình (onAppear, viewWillAppear, effect của một composable) theo các hàng giữa; phần khởi động app theo các hàng trên.</text>
    </svg>
    <figcaption>Monitor cần một móc chạy một lần trong mỗi process, kể cả những process không có màn hình.
<ul class="legend">
    <li data-part="inbound">Khởi động app (inbound adapter)</li>
    <li data-part="android">Một màn hình</li>
  </ul>
</figcaption>
  </figure>

Phần khởi động app có thêm hai adapter và một lời gọi. Của Android giống nhau trên cả hai track Android:

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt" hl_lines="2 3 5"
⋯ permissionChecker, then initKoin(… the six adapters from Lesson 17,
            logStore = AndroidLogStore(File(filesDir, "status-log.jsonl")),
            monitorScheduler = AndroidMonitorScheduler(this),
        )
        onAppLaunch()
    }
```

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="3 6 7 9"
        // Runs once per launch, before the app finishes launching, whether the user opened it or
        // iOS launched it in the background for the monitor: the place for app-level work.
        init() {
            AppModuleKt.doInitKoin(
    ⋯ the six adapters from Lesson 17,
                logStore: IosLogStore(),
                monitorScheduler: IosMonitorScheduler()
            )
            AppLaunchKt.onAppLaunch()
        }
    ```

    `init` của `App` SwiftUI đã khởi động Koin (bài 11), và nó chạy đủ sớm để đăng ký một background task: stack trace của crash ở mục 8 cho thấy `App.main()` của SwiftUI gọi `iOSApp.init()`, ngay đầu chuỗi mở app.

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="5 6 8"
        func application(_ application: UIApplication,
                         didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
            AppModuleKt.doInitKoin(
    ⋯ the six adapters from Lesson 17,
                logStore: IosLogStore(),
                monitorScheduler: IosMonitorScheduler()
            )
            AppLaunchKt.onAppLaunch()
            return true
        }
    ```

    `didFinishLaunchingWithOptions` chính là hạn chót: việc đăng ký phải xong "trước khi kết thúc" nó, và dựng adapter bên trong nó là đáp ứng điều đó.


!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Cùng hai adapter và cùng một lời gọi, trong phần khởi động app của mỗi track: `init` của `App` SwiftUI, hoặc `didFinishLaunchingWithOptions` của app delegate. Không cái nào là scene hay view: `SceneDelegate`, `ContentView` và các view controller giữ nguyên.

Trong `di/AppModule.kt`, `initKoin` và `platformModule` nhận `logStore` và `monitorScheduler`, và `appModule` có thêm một dòng:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="3"
⋯ imports; appModule's other bindings, the bridge included
    // The monitor reads the same four status ports, and writes to the log store.
    single<DeviceMonitoring> { MonitoringService(get(), get(), get(), get(), get(), get()) }
```

`LogStore` cuối cùng được bind, như bài 17 đã định: của Android nằm trong bộ nhớ riêng của app, `File(filesDir, "status-log.jsonl")`; của iOS dùng constructor không tham số, trong Application Support.

## 7. Test: bộ hẹn giờ của nền tảng, do test đóng vai

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeMonitorScheduler.kt" hl_lines="1 5 11"
class FakeMonitorScheduler : MonitorScheduler {
⋯ interval and cancelled (read by the tests); the tick it was handed
    override fun schedule(interval: Duration, tick: suspend () -> Unit) {
        this.interval = interval
        this.tick = tick
        cancelled = false
    }
⋯ cancel(): cancelled = true
    // What the platform does when the time comes. Keeps the tick after cancel(), so a test can
    // play a late tick that was already on its way.
    suspend fun fire() {
        checkNotNull(tick) { "Nothing was scheduled." }.invoke()
    }
}
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/MonitoringServiceTest.kt" hl_lines="7 8 13"
⋯ the four status fakes, FakeLogStore, FakeMonitorScheduler, and a clock the test sets
    @Test
    fun eachTickAppendsTheStatusAndTheTime() = runTest {
        monitor.start(15.minutes)
        battery.percent = 47

        scheduler.fire()
        clock.now = Instant.parse("2026-09-11T10:45:00Z")
        battery.percent = 46
        scheduler.fire()

        assertEquals(listOf("2026-09-11T10:30:00Z", "2026-09-11T10:45:00Z"), log.records.map { it.timestamp.toString() })
        assertEquals(listOf(47, 46), log.records.map { it.status.battery })
⋯ and the status's lastRecord is the second record
    }
```

1. **Mười lăm phút trong chớp mắt.** Test không chờ bộ hẹn giờ nào, thật hay ảo: nó *chính là* bộ hẹn giờ, và gọi `fire()` khi nó muốn. Đồng hồ là một object do test đặt, nên các timestamp chính xác.
2. **Bảy test**, qua inbound port: `startAsksTheSchedulerForTheInterval`, `eachTickAppendsTheStatusAndTheTime`, `theRecordFollowsTheStatusRules` (quy tắc Wi-Fi, và `Connecting` không phải đã kết nối), `stopCancelsAndALateTickWritesNothing`, `aFileErrorIsReportedAndTheNextTickTriesAgain` (với `FakeLogStore.failNextAppend`), `logsAndClearLogsUseTheLogStore`, và `anIntervalMustBePositive`.
3. **Graph.** `AppModuleTest` có thêm `theMonitorLogsWhatTheAppsOneSessionSays`: nó kết nối qua session của graph, khởi động `DeviceMonitoring` của graph, kích scheduler giả, và tìm thấy `bluetoothConnected = true` trong kho log giả. Một binding sai, hay một bridge trên session thứ hai, làm nó fail.
4. **Các kiểm tra đột biến chúng tôi đã chạy**, mỗi cái làm fail đúng test được nêu: không có điều kiện chặn nhịp muộn; không có `require`; bắt một kiểu exception khác `LogStoreException`. Thêm hai cái nữa, trong `readStatus`, mỗi cái làm fail một test ở mỗi service: gỡ quy tắc Wi-Fi, và tính `Connecting` là đã kết nối.

Hai adapter scheduler không có unit test: trong chúng không có quy tắc nào để test, chỉ có lời gọi tới nền tảng, và bộ hẹn giờ của nền tảng là lý do chúng tồn tại. Chúng được kiểm tra bằng cách chạy (mục 8), và những phần chỉ một chiếc điện thoại cho thấy được là các kiểm tra trên thiết bị.

## 8. Thực tế xảy ra gì

Chúng tôi build m13 trên cả bốn track (Kotlin 2.4.20, WorkManager 2.12.0, Xcode 26.2). `allTests` pass 95 trên 95 trên JVM và 95 trên 95 trên iOS simulator, không có cảnh báo compiler nào từ code của chúng ta.

| Lần chạy | Thứ chúng tôi thấy |
|---|---|
| Emulator Android API 36, Compose và XML, cài mới, mở app | một bản ghi trong vòng một giây sau `am start`, và "Monitor tick" trong logcat; `dumpsys jobscheduler`: lần chạy tiếp theo sau khoảng 15 phút (`TIME=+14m58s`) |
| như trên, rồi Home, `am kill`, mở lại | vẫn một bản ghi, và lần chạy tiếp theo vẫn đếm lùi từ chỗ cũ (`+14m50s`) |
| Compose: Home, `am kill`, chờ | 15 phút 42 giây sau bản ghi đầu, Android khởi động process "for service {…/androidx.work.impl.background.systemjob.SystemJobService}", và bản ghi thứ hai tới 2,3 giây sau, từ process mới đó |
| một bản build tạm với `CANCEL_AND_REENQUEUE`, mở lại | ngay lập tức có bản ghi thứ hai (mục 4) |
| `cmd jobscheduler run -f` trên job của chúng tôi, trước khi đủ 15 phút | "Delaying execution … because it is being executed before schedule.", không có bản ghi (mục 4) |
| Simulator iOS 26.2, SwiftUI và UIKit, cài mới, mở app, rồi sang app khác | không crash; khi vào nền, "Monitor: no background refresh: The operation couldn’t be completed. (BGTaskSchedulerErrorDomain error 1.)" |
| quay lại app, rồi 15 phút ở foreground | "Monitor tick (foreground)", và một bản ghi trong Application Support với `"battery":null` và `"bluetoothEnabled":null` (Simulator không báo mức pin, và Bluetooth chưa được cho phép: bài 17) |
| một bản build SwiftUI tạm với chu kỳ 1 phút | một nhịp khoảng một phút sau khi mở; không nhịp nào trong 75 s ở nền; nhịp tiếp theo khoảng một phút sau khi quay lại |
| một bản build SwiftUI tạm thiếu identifier được phép | crash lúc mở: "Uncaught Kotlin exception: kotlin.IllegalStateException: com.example.devicemonitor.monitor isn't in BGTaskSchedulerPermittedIdentifiers (project.yml)", stack trace chạy từ `App.main()` của SwiftUI qua `iOSApp.init()` tới constructor của `IosMonitorScheduler` |

Một chiếc điện thoại làm gì ở nền, và trong bao lâu, là chủ đề của bài 19; brief cho agent liệt kê những gì chỉ điện thoại cho thấy được dưới dạng kiểm tra trên thiết bị. **m13 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng, một lần cài mới trên Android ghi bản ghi đầu ngay lập tức và một bản ghi nữa sau 15 phút hoặc hơn, và app iOS ghi một bản ghi sau 15 phút ở foreground. Hãy commit nó.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một lần chạy WorkManager trong một process mà Android khởi động cho nó: code nào chạy trước, nhịp tới từ đâu, thread nào chạy `MonitoringService.tick()`, và chuyện gì xảy ra nếu monitor đã bị dừng. Rồi nhờ nó liệt kê mọi thứ xảy ra trên iOS, theo thứ tự, từ lúc người dùng nhấn Home tới lúc refresh task tiếp theo xong, và nói Simulator bỏ qua những bước nào.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao monitor khởi động trong phần khởi động app, mà không phải khi màn hình danh sách hiện ra?</p>
<div class="opts">
<button class="opt">ViewModel của màn hình danh sách không với tới được Koin</button>
<button class="opt" data-correct>những lần mở app mà monitor phụ thuộc (Android khởi động process cho WorkManager, iOS mở app cho một refresh task) không hiện màn hình nào, và mỗi process mới cần trao lại nhịp cho scheduler</button>
<button class="opt">khởi động hai lần sẽ lên lịch hai bộ hẹn giờ</button>
</div>
<p class="feedback"></p>
<p class="why">Một móc màn hình chỉ chạy khi màn hình đó tồn tại. Phần khởi động app chạy một lần trong mọi process, có hay không có màn hình, và khởi động lại monitor là an toàn: <code>UPDATE</code> giữ một lịch trên Android, và adapter iOS chỉ lưu nhịp mới.</p>
</div>

<div class="quiz">
<p class="q"><code>MonitorWorker</code> lấy cái nhịp nó gọi bằng cách nào?</p>
<div class="opts">
<button class="opt">WorkManager truyền nó vào constructor của worker</button>
<button class="opt">nó được lưu cùng work request trong cơ sở dữ liệu của WorkManager</button>
<button class="opt" data-correct>từ companion object của <code>AndroidMonitorScheduler</code>, do <code>schedule</code> đặt trong cùng process; một process mà Android khởi động cho việc này chạy <code>Application.onCreate</code>, và do đó <code>onAppLaunch()</code>, trước</button>
</div>
<p class="feedback"></p>
<p class="why">Factory mặc định của WorkManager dựng worker bằng reflection chỉ với một <code>Context</code> và <code>WorkerParameters</code>, và một lambda không lưu vào cơ sở dữ liệu của nó được. Process là thứ adapter và worker dùng chung.</p>
</div>

<div class="quiz">
<p class="q">Adapter iOS đặt <code>earliestBeginDate</code> của một refresh request là 15 phút sau. Khi nào iOS chạy nó?</p>
<div class="opts">
<button class="opt">15 phút sau, xê dịch vài giây</button>
<button class="opt">mỗi 15 phút, cho tới khi app huỷ nó</button>
<button class="opt" data-correct>không trước lúc đó; khi nào, hay có chạy không, là lựa chọn của iOS, dựa trên điều kiện hệ thống và cách dùng app, và không bao giờ trên Simulator</button>
</div>
<p class="feedback"></p>
<p class="why"><code>BGTaskRequest.h</code>: "hệ thống không đảm bảo mở task vào đúng ngày giờ chỉ định, mà chỉ đảm bảo nó sẽ không bắt đầu sớm hơn". Một request chạy một lần; handler gửi request tiếp theo.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>MonitoringService</code> nhận một <code>Clock</code> thay vì gọi <code>Clock.System.now()</code>?</p>
<div class="opts">
<button class="opt"><code>Clock.System</code> không có trên iOS</button>
<button class="opt" data-correct>để một test truyền được một đồng hồ nó đặt và kiểm tra timestamp chính xác; reference của Kotlin khuyên truyền một <code>Clock</code> thay vì dùng <code>Clock.System</code> trực tiếp</button>
<button class="opt">đồng hồ của nền tảng là một outbound adapter, nên phải bind trong <code>platformModule</code></button>
</div>
<p class="feedback"></p>
<p class="why">Tham số mặc định giữ cho binding Koin ngắn; <code>MonitoringServiceTest</code> truyền một object mà nó dời <code>now</code> từ 10:30 sang 10:45.</p>
</div>

<div class="quiz">
<p class="q">Cả hai service cần quy tắc Wi-Fi và quy tắc "chỉ <code>Connected</code> mới tính". Ở m13 các quy tắc nằm ở đâu?</p>
<div class="opts">
<button class="opt"><code>MonitoringService</code> gọi <code>StatusReport.current()</code></button>
<button class="opt" data-correct>trong <code>readStatus</code>, một hàm trong app core mà cả hai service gọi với các port của riêng mình</button>
<button class="opt">mỗi service một bản sao, để không service nào phụ thuộc vào service kia</button>
</div>
<p class="feedback"></p>
<p class="why">Một service không gọi inbound port của một khả năng khác, và một quy tắc viết hai lần sẽ lệch nhau. Bridge dành cho state mà khả năng khác giữ, như kết nối của session; pin và mạng thuộc về nền tảng, nên cả hai service hỏi các port và dùng chung quy tắc.</p>
</div>

<div class="quiz">
<p class="q">Vì sao adapter Android không dùng foreground service để nhịp mỗi phút?</p>
<div class="opts">
<button class="opt">foreground service không đọc được mức pin</button>
<button class="opt" data-correct>foreground service dành cho tác vụ người dùng nhận thấy, hiện một thông báo khi chạy, cần một type được khai báo từ Android 14, và không khởi động được từ nền với app nhắm Android 12 trở lên; một monitor vô hình mà có thể chờ thuộc về WorkManager</button>
<button class="opt">WorkManager không chạy được khi có một foreground service</button>
</div>
<p class="feedback"></p>
<p class="why">Dùng foreground service chỉ để giữ process sống là lách giới hạn mà khoá học bảo đừng lách. Nó là công cụ đúng cho một monitor người dùng tự bắt đầu và theo dõi.</p>
</div>

<div class="quiz">
<p class="q">Trên Simulator, app vào nền và console ghi "BGTaskSchedulerErrorDomain error 1". Nó nghĩa là gì?</p>
<div class="opts">
<button class="opt" data-correct>không có sẵn: Simulator không hỗ trợ xử lý nền (trên điện thoại: background refresh bị tắt)</button>
<button class="opt">identifier không có trong <code>BGTaskSchedulerPermittedIdentifiers</code></button>
<button class="opt">có quá nhiều request đang chờ</button>
</div>
<p class="feedback"></p>
<p class="why"><code>BGTaskScheduler.h</code> ghi mã 1, <code>Unavailable</code>, cho Simulator và cho người dùng đã tắt background refresh. Thiếu mode hay identifier là mã 3, và quá nhiều request là mã 2.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Adapter iOS là Kotlin gọi framework của Apple, như <code>IosLogStore</code>. <code>error.ptr</code> cho <code>submitTaskRequest</code> cái gì? (Bài 17)</p>
<div class="opts">
<button class="opt">một exception Kotlin để ném khi thất bại</button>
<button class="opt" data-correct>địa chỉ của một biến, cấp phát trong <code>memScoped</code>, nơi framework ghi một <code>NSError</code> nếu lời gọi trả về <code>NO</code></button>
<button class="opt">một callback framework gọi kèm lỗi</button>
</div>
<p class="feedback"></p>
<p class="why">Lỗi Objective-C không được import thành exception Kotlin; code Kotlin kiểm tra giá trị trả về, rồi đọc <code>error.value</code>, bên trong khối <code>memScoped</code> sở hữu vùng nhớ đó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao test kích scheduler giả thay vì chờ 15 phút thời gian ảo bằng <code>runTest</code>? (Bài 11)</p>
<div class="opts">
<button class="opt">thời gian ảo không vượt quá một phút được</button>
<button class="opt" data-correct>service không có bộ hẹn giờ riêng: bộ hẹn giờ nằm sau port <code>MonitorScheduler</code>, nên fake đứng thay nó quyết định khi nào nhịp chạy</button>
<button class="opt"><code>runTest</code> không hỗ trợ lambda <code>suspend</code></button>
</div>
<p class="feedback"></p>
<p class="why">Thời gian ảo điều khiển các <code>delay</code> trên test dispatcher. Ở đây trong service hoàn toàn không có <code>delay</code> nào; các adapter giữ bộ hẹn giờ, và fake đóng vai chúng.</p>
</div>

<div class="quiz">
<p class="q">Mỗi móc Android theo vòng đời nào? (Bài 03 và 11)</p>
<div class="opts">
<button class="opt"><code>Application.onCreate</code> chạy mỗi lần một Activity được tạo</button>
<button class="opt" data-correct><code>Application.onCreate</code> chạy một lần mỗi process, trước mọi Activity hay service; các callback của một Activity theo đúng màn hình đó</button>
<button class="opt">cả hai chạy một lần mỗi lần cài</button>
</div>
<p class="feedback"></p>
<p class="why">Một process có thể khởi động mà không có Activity nào, cho một job WorkManager; khi đó <code>Application</code> chạy và không Activity nào chạy, đó là lý do monitor khởi động ở đó.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m13 của bạn)"
    1. **Đoán, rồi đọc log.** Gỡ app Android, cài lại, mở nó, và đọc `adb shell run-as com.example.devicemonitor cat files/status-log.jsonl`. Bạn đoán có bao nhiêu bản ghi, và vì sao? Nhấn Home, mở lại: giờ là bao nhiêu? Dòng nào của adapter nào giải thích câu trả lời?
    2. **Test trước: chu kỳ trong trạng thái.** Viết `startAgainChangesTheInterval` trong `MonitoringServiceTest`: bắt đầu ở 15 phút, rồi ở 30; scheduler và trạng thái đều phải nói 30, và một nhịp được kích vẫn phải ghi một bản ghi. Nó đã pass sẵn chưa? Nếu rồi, dòng nào làm nó pass?
    3. **Một quy tắc trong service, không trong adapter.** Monitor không nên ghi hai bản ghi cách nhau dưới một phút (một nền tảng có thể chạy một nhịp muộn ngay trước nhịp tiếp theo). Quy tắc nằm ở đâu, và port nào cho service thứ nó cần? Viết test với đồng hồ giả trước, xem nó fail, rồi làm nó pass. Có adapter nào phải đổi không?
    4. **Cố tình phá cấu hình.** Gỡ identifier khỏi `BGTaskSchedulerPermittedIdentifiers` trong `project.yml`, chạy `xcodegen generate`, build và mở app. Đoán xem chuyện gì xảy ra, và dòng nào báo nó. Đặt lại.
    5. **Đọc header.** Mở `BGTaskScheduler.h` trong Xcode (Open Quickly, ⇧⌘O) và tìm các mã lỗi: SDK iOS 26 có bốn mã, và mã thứ tư chỉ dành cho continued-processing task, thứ monitor không dùng. Với mỗi mã trong ba mã đầu, viết một câu về việc monitor hôm nay làm gì khi nhận nó.
    6. **Trên điện thoại của bạn**: cài, mở app, rồi để yên mỗi điện thoại một giờ, đã khoá. Mỗi máy ghi bao nhiêu bản ghi, và vào những giờ nào? Giữ các con số đó cho bài 19.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/18-background-monitor.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/18-background-monitor.html" -o .course/lesson-18.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html" -o .course/ref-platform-lifecycles-cheatsheet.html
Lesson 17, which this lesson builds on; skipped if it's already there:
  [ -f .course/lesson-17.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/17-device-status-and-log-store.html" -o .course/lesson-17.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 18 (Background monitor: build it): build milestone m13 on top of m12: the DeviceMonitoring
inbound port (start(interval), stop(), status: StateFlow<MonitorStatus>, logs(), clearLogs()),
implemented by MonitoringService over the four status ports of Lesson 17 (ConnectionStatus
included, never DeviceSession), LogStore and a new MonitorScheduler outbound port
(schedule(interval, tick), cancel()); the status rules move from StatusService into readStatus
(core/ReadStatus.kt), which both services call. Adapters: AndroidMonitorScheduler + MonitorWorker
(WorkManager 2.12.0 periodic work, unique, UPDATE, never under 15 minutes) and IosMonitorScheduler
(Kotlin in iosMain: a coroutine timer while the app is active, a BGAppRefreshTask request in the
background). onAppLaunch() (adapter/inbound/AppLaunch.kt) starts the monitor at 15 minutes; each
app start calls it right after initKoin. LogStore is now bound. No screen changes.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m12 project in demo/ (Lesson 17). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks.
     replaced: shared/build.gradle.kts (androidx.work:work-runtime:2.12.0 in androidMain)
   Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/MonitorStatus.kt, core/ReadStatus.kt, core/MonitoringService.kt,
       core/inbound/DeviceMonitoring.kt, core/outbound/MonitorScheduler.kt,
       adapter/inbound/AppLaunch.kt
     replaced: core/StatusService.kt, di/AppModule.kt
   add: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt
   add: shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: doubles/FakeMonitorScheduler.kt, doubles/FakeLogStore.kt, core/MonitoringServiceTest.kt
     replaced: di/AppModuleTest.kt
   Every other file in shared/ stays as in m12.

2. Android, both tracks: androidApp/src/main/java/com/example/devicemonitor/android/
   DeviceMonitorApplication.kt: replaced. The manifest, androidApp/build.gradle.kts and every
   screen stay as in m12.
   iOS: iosApp/project.yml for my track: replaced (UIBackgroundModes and
   BGTaskSchedulerPermittedIdentifiers). Then run `xcodegen generate` in iosApp/, which rewrites
   iosApp/iosApp/Info.plist and the Xcode project. Do NOT edit Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift: replaced.
     UIKit: AppDelegate.swift: replaced.
   Every other Android and iOS file stays as in m12.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), a fresh install:
     adb uninstall com.example.devicemonitor   (ignore "Unknown package" the first time)
     adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk
     adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_SCAN
     adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_CONNECT
     adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl uninstall booted com.example.devicemonitor` (a fresh install), then
     `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`, then
     `xcrun simctl launch --console-pty booted com.example.devicemonitor` in a second terminal
     (or in the background, its output to a file): it shows the adapter's println lines.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 95 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 8 in ValueDecoderTest, 8 in
  ScanningServiceTest, 7 in MonitoringServiceTest, 5 in StatusServiceTest, 4 in JsonLinesTest,
  4 in PermissionServiceTest, 3 in DeviceServiceTest, 3 in AppModuleTest, 1 in
  SessionConnectionStatusTest, and 5 in AndroidLogStoreTest (JVM results) or 5 in
  IosLogStoreTest (iOS results). Show the counts from the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- The app core stays platform-free, and services don't know each other:
    grep -rn 'import android\|import platform\.\|import org.koin\|import kotlinx.serialization\|import androidx.work' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing, and
    grep -n 'DeviceSession\|SessionService\|StatusReport\|StatusService' shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitoringService.kt
  finds nothing. In the exported header (build it first with
  ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64):
    grep -c 'doInitKoin(permissionChecker:bleScanner:bleConnection:batteryProvider:networkProvider:bluetoothProvider:logStore:monitorScheduler:)' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, grep -c 'swift_name("onAppLaunch()")' on the same file prints 1, and
  grep -c 'Koin_core' prints 0. The generated iosApp/iosApp/Info.plist contains
  UIBackgroundModes with fetch, and BGTaskSchedulerPermittedIdentifiers with
  com.example.devicemonitor.monitor.
- Android emulator (API 31+), after the fresh install and launch above:
  1. Within 10 s: adb shell run-as com.example.devicemonitor cat files/status-log.jsonl prints
     exactly one line of JSON with the seven fields of Lesson 17 ("timestamp" … "bluetoothConnected"),
     and adb logcat -d -s DeviceMonitor:I shows "Monitor tick".
  2. adb shell dumpsys jobscheduler | grep 'JobStatus{.*devicemonitor' shows our job with
     TIME=+14m… (or a little less). adb shell input keyevent KEYCODE_HOME, launch again with
     the am start command: still one line in the log, and TIME= still counts down from where
     it was (no new 15 minutes).
  3. adb shell input keyevent KEYCODE_HOME; wait 3 seconds; adb shell am kill com.example.devicemonitor;
     adb shell pidof com.example.devicemonitor prints nothing (if it still prints a number,
     am kill skipped the process because it wasn't in the background yet: run am kill again).
     Wait until TIME= has passed (up to 20 minutes; check every minute): the log has two lines, the second about 15 minutes
     after the first, and logcat shows a second "Monitor tick" from a new process id.
     If TIME= is negative (the job is due) and the log still has one line five minutes later, the emulator's
     JobScheduler is slow to start it: run the job once by hand (WorkManager accepts that only after the
     15 minutes are up): the job id is the number after the slash in the "JobStatus{… u0aNNN/ …" line, and
       adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler -u 0 com.example.devicemonitor 
     writes the second line from a new process id. Say in your report that you had to do this.
- iOS Simulator, my track, after the fresh install and launch above:
  1. No crash at launch (a missing permitted identifier would crash it with "… isn't in
     BGTaskSchedulerPermittedIdentifiers (project.yml)").
  2. Switch to another app (xcrun simctl launch booted com.apple.Preferences): the console
     shows "Monitor: no background refresh: The operation couldn’t be completed.
     (BGTaskSchedulerErrorDomain error 1.)": the Simulator doesn't support background tasks.
  3. Launch the app again (xcrun simctl launch booted com.example.devicemonitor) and leave it in
     the foreground for 16 minutes. Then the console shows "Monitor tick (foreground)", and
       cat "$(xcrun simctl get_app_container booted com.example.devicemonitor data)/Library/Application Support/status-log.jsonl"
     prints one line of JSON beginning {"timestamp": and containing "battery":null.
- Device checks (list them for me, don't try to run them), on a physical Android phone and an
  iPhone on my track:
  1. Android: install, open the app once, lock the phone and leave it for an hour: the log has
     records about every 15 minutes or more (Doze can stretch the gaps).
  2. iPhone, Xcode attached: open the app, press Home; pause in the debugger after submit and run
       e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.example.devicemonitor.monitor"]
     then continue: the console shows "Monitor tick (background)" and the log gains a record.
  3. iPhone, no debugger: open the app, press Home, leave it for a few hours: count the
     background records (it may be none: iOS decides).
  4. iPhone: Settings → General → Background App Refresh off for the app, press Home: the
     console says error 1 (unavailable).
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me which process runs each tick on each platform.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Task scheduling](https://developer.android.com/topic/libraries/architecture/workmanager) (WorkManager: tồn tại qua các lần khởi động lại và reboot; quan hệ với coroutine và alarm), [Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work) ("Schedule periodic work": mức tối thiểu 15 phút, flex interval), [ExistingPeriodicWorkPolicy](https://developer.android.com/reference/androidx/work/ExistingPeriodicWorkPolicy) (`UPDATE` giữ thời điểm xếp hàng), [Threading in CoroutineWorker](https://developer.android.com/develop/background-work/background-tasks/persistent/threading/coroutineworker), và [WorkManager release notes](https://developer.android.com/jetpack/androidx/releases/work).
- Android, cách chọn: [Background tasks overview](https://developer.android.com/develop/background-work/background-tasks) (khi nào WorkManager, khi nào foreground service), [Foreground services overview](https://developer.android.com/develop/background-work/services/fgs), [Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types) và [Restrictions on starting a foreground service from the background](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start).
- iOS: [Using background tasks to update your app](https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app) (nguồn chính: hai cài đặt, register, submit, handler), [BGTaskScheduler](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler) (comment trong header đầy đủ hơn: mã lỗi, mỗi lúc một refresh task), [register(forTaskWithIdentifier:using:launchHandler:)](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler/register(fortaskwithidentifier:using:launchhandler:)), [Starting and terminating tasks during development](https://developer.apple.com/documentation/backgroundtasks/starting-and-terminating-tasks-during-development) (các lệnh debugger; "Các hàm debug chỉ chạy trên thiết bị"), và [About the background execution sequence](https://developer.apple.com/documentation/uikit/about-the-background-execution-sequence).
- Quy định của Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 2.5.4 (dịch vụ nền chỉ cho đúng mục đích của chúng).
- Kotlin: [kotlin.time.Clock](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.time/-clock/) (truyền một clock; đừng gọi `Clock.System` trực tiếp).
- [Cheatsheet: platform lifecycles](https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html): các callback của Activity, scene và view, và quy tắc của nó rằng việc mức app như monitor này móc vào mức app hay scene, không bao giờ vào của một view. [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): inbound và outbound port, fake, và binding Koin.
- Kinh nghiệm thực tế: Developer Forums của Apple, tag [Background Tasks](https://developer.apple.com/forums/tags/backgroundtasks), cho refresh task trên iPhone thật; tag [android-workmanager](https://stackoverflow.com/questions/tagged/android-workmanager) của Stack Overflow.

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Không file nào bị xoá, và mọi thứ khác giữ như ở m12: mọi màn hình, cả hai manifest, `androidApp/build.gradle.kts` và các build file gốc. `iosApp/iosApp/Info.plist` và `iosApp/iosApp.xcodeproj` được sinh bởi `xcodegen generate` từ `project.yml`. File chỉ một track có nằm trong tab của track đó; khi hai track cùng sửa một file cùng đường dẫn, tiêu đề của nó ghi tên track.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitorStatus.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.time.Duration

    // Where the background monitor stands, in the app's terms.
    sealed interface MonitorStatus {
        data object Stopped : MonitorStatus

        // Started, at this interval. lastRecord is the newest reading this process saved; lastError
        // is set when the newest attempt couldn't be saved, and cleared by the next one that is.
        data class Running(
            val interval: Duration,
            val lastRecord: LogRecord? = null,
            val lastError: String? = null,
        ) : MonitorStatus
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceMonitoring.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.MonitorStatus
    import kotlinx.coroutines.flow.StateFlow
    import kotlin.time.Duration

    // Inbound port: what the app offers for watching the phone over time. MonitoringService
    // implements it; the app's launch (adapter/inbound/AppLaunch.kt) and the tests call it.
    interface DeviceMonitoring {
        // Starts the monitor, or changes its interval: about every interval, as often as the
        // platform allows, it reads the phone's status and appends it to the log.
        fun start(interval: Duration)

        // Stops the monitor. The log is kept.
        fun stop()

        // Stopped, or running with its newest reading and error.
        val status: StateFlow<MonitorStatus>

        // Every record in the log, oldest first.
        suspend fun logs(): List<LogRecord>

        // Removes every record from the log.
        suspend fun clearLogs()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MonitorScheduler.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import kotlin.time.Duration

    // Outbound port: the platform's way to run the monitor's tick on a timer, inside the limits the
    // platform sets. One adapter per platform: WorkManager on Android, a timer and BGTaskScheduler
    // on iOS. Neither promises an exact time: the interval is "about", and in the background the
    // platform decides when.
    interface MonitorScheduler {
        // Calls tick about every interval until cancel(). Calling it again replaces both.
        fun schedule(interval: Duration, tick: suspend () -> Unit)

        // Stops calling tick.
        fun cancel()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ReadStatus.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.core.outbound.NetworkProvider

    // The app's rules for the phone's status, written once: StatusService answers the screen with
    // them, and MonitoringService logs them. A plain function in the app core, not a third service:
    // it applies rules to what the ports report, and holds no state.
    internal suspend fun readStatus(
        battery: BatteryProvider,
        network: NetworkProvider,
        bluetooth: BluetoothProvider,
        connection: ConnectionStatus,
    ): DeviceStatus {
        val net = network.current()
        return DeviceStatus(
            battery = battery.level(),
            // Connected over Wi-Fi means Wi-Fi is on, even where the platform can't say so (iOS).
            wifiEnabled = net.wifiEnabled ?: if (net.wifiConnected) true else null,
            wifiConnected = net.wifiConnected,
            cellularAvailable = net.cellularAvailable,
            bluetoothEnabled = bluetooth.isEnabled(),
            bluetoothConnected = connection.current() is ConnectionState.Connected,
        )
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/StatusService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.core.outbound.NetworkProvider

    // Service: the phone's status, from the three providers and from what the app core already
    // knows. "Bluetooth connected" means this app holds a link to a device: the session's to say,
    // not a platform's, so it asks through its own ConnectionStatus port, never the session itself.
    // The rules are in readStatus (ReadStatus.kt), which the monitor applies too.
    class StatusService(
        private val battery: BatteryProvider,
        private val network: NetworkProvider,
        private val bluetooth: BluetoothProvider,
        private val connection: ConnectionStatus,
    ) : StatusReport {
        override suspend fun current(): DeviceStatus = readStatus(battery, network, bluetooth, connection)
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitoringService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.core.outbound.LogStore
    import com.example.devicemonitor.core.outbound.MonitorScheduler
    import com.example.devicemonitor.core.outbound.NetworkProvider
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlin.time.Clock
    import kotlin.time.Duration

    // Service: the background monitor's rules. Each tick reads the phone's status through Lesson 17's
    // four status ports (ConnectionStatus included, never the session), stamps it with the time,
    // and appends it to the log. When it runs is the scheduler's business, not this class's.
    class MonitoringService(
        private val battery: BatteryProvider,
        private val network: NetworkProvider,
        private val bluetooth: BluetoothProvider,
        private val connection: ConnectionStatus,
        private val log: LogStore,
        private val scheduler: MonitorScheduler,
        private val clock: Clock = Clock.System,
    ) : DeviceMonitoring {
        private val _status = MutableStateFlow<MonitorStatus>(MonitorStatus.Stopped)
        override val status: StateFlow<MonitorStatus> = _status.asStateFlow()

        override fun start(interval: Duration) {
            require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
            _status.value = MonitorStatus.Running(interval)
            scheduler.schedule(interval) { tick() }
        }

        override fun stop() {
            scheduler.cancel()
            _status.value = MonitorStatus.Stopped
        }

        override suspend fun logs(): List<LogRecord> = log.read()

        override suspend fun clearLogs() = log.clear()

        // One reading. A tick that comes after stop() writes nothing. A file error doesn't stop the
        // monitor: it shows in the status, and the next tick tries again.
        private suspend fun tick() {
            if (_status.value !is MonitorStatus.Running) return
            val record = LogRecord(clock.now(), readStatus(battery, network, bluetooth, connection))
            val error = try {
                log.append(record)
                null
            } catch (e: LogStoreException) {
                e.message
            }
            _status.update { current ->
                when (current) {
                    is MonitorStatus.Running ->
                        if (error == null) current.copy(lastRecord = record, lastError = null)
                        else current.copy(lastError = error)
                    MonitorStatus.Stopped -> current
                }
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/AppLaunch.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import org.koin.mp.KoinPlatform
    import kotlin.time.Duration.Companion.minutes

    // How often the monitor reads the phone's status: the shortest period Android allows for
    // repeating background work, used on both platforms.
    private val MONITOR_INTERVAL = 15.minutes

    // Inbound adapter: the app's launch. Both app starts call this once per process, right after
    // initKoin: on every launch, including the ones the OS makes in the background to run the
    // monitor, which never show a screen. Each new process needs the monitor's tick handed to the
    // scheduler again, and a screen is the wrong place for that: it may never appear, and it goes
    // away while the app keeps running.
    fun onAppLaunch() {
        KoinPlatform.getKoin().get<DeviceMonitoring>().start(MONITOR_INTERVAL)
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.outbound.SessionConnectionStatus
    import com.example.devicemonitor.core.MonitoringService
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.SessionService
    import com.example.devicemonitor.core.StatusService
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.core.outbound.LogStore
    import com.example.devicemonitor.core.outbound.MonitorScheduler
    import com.example.devicemonitor.core.outbound.NetworkProvider
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import org.koin.core.context.startKoin
    import org.koin.core.module.dsl.viewModelOf
    import org.koin.dsl.module

    // The composition root, as a Koin module: which service implements each inbound port,
    // which adapter implements each outbound port, and how to build each ViewModel.
    internal val appModule = module {
        single<DeviceScanning> { ScanningService(get(), get()) }
        // One session for the whole app: every screen sees the same connection state.
        single<DeviceSession> { SessionService(get(), get()) }
        single<PermissionAccess> { PermissionService(get()) }
        single<StatusReport> { StatusService(get(), get(), get(), get()) }
        // The bridge adapter: the status asks ConnectionStatus, and the one session answers.
        single<ConnectionStatus> { SessionConnectionStatus(get()) }
        // The monitor reads the same four status ports, and writes to the log store.
        single<DeviceMonitoring> { MonitoringService(get(), get(), get(), get(), get(), get()) }
        viewModelOf(::DeviceListViewModel)
        viewModelOf(::DeviceDetailViewModel)
    }

    // The outbound adapters that each platform builds itself and passes to initKoin.
    internal fun platformModule(
        permissionChecker: PermissionChecker,
        bleScanner: BleScanner,
        bleConnection: BleConnection,
        batteryProvider: BatteryProvider,
        networkProvider: NetworkProvider,
        bluetoothProvider: BluetoothProvider,
        logStore: LogStore,
        monitorScheduler: MonitorScheduler,
    ) = module {
        single { permissionChecker }
        single { bleScanner }
        single { bleConnection }
        single { batteryProvider }
        single { networkProvider }
        single { bluetoothProvider }
        single { logStore }
        single { monitorScheduler }
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin(
        permissionChecker: PermissionChecker,
        bleScanner: BleScanner,
        bleConnection: BleConnection,
        batteryProvider: BatteryProvider,
        networkProvider: NetworkProvider,
        bluetoothProvider: BluetoothProvider,
        logStore: LogStore,
        monitorScheduler: MonitorScheduler,
    ) {
        startKoin {
            modules(
                appModule,
                platformModule(
                    permissionChecker, bleScanner, bleConnection, batteryProvider, networkProvider, bluetoothProvider,
                    logStore, monitorScheduler,
                ),
            )
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.content.Context
    import android.util.Log
    import androidx.work.CoroutineWorker
    import androidx.work.ExistingPeriodicWorkPolicy
    import androidx.work.PeriodicWorkRequest
    import androidx.work.PeriodicWorkRequestBuilder
    import androidx.work.WorkManager
    import androidx.work.WorkerParameters
    import com.example.devicemonitor.core.outbound.MonitorScheduler
    import kotlin.time.Duration
    import kotlin.time.Duration.Companion.milliseconds
    import kotlin.time.toJavaDuration

    // Outbound adapter: the monitor's timer on Android, behind the MonitorScheduler port. WorkManager
    // runs MonitorWorker about every interval, with the app open or not, and keeps the schedule
    // when the process ends and across reboots. Android picks the moment within each period.
    class AndroidMonitorScheduler(context: Context) : MonitorScheduler {
        private val workManager = WorkManager.getInstance(context)

        override fun schedule(interval: Duration, tick: suspend () -> Unit) {
            currentTick = tick
            // Android's floor for periodic work is 15 minutes: never ask for less.
            val period = interval.coerceAtLeast(PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS.milliseconds)
            val request = PeriodicWorkRequestBuilder<MonitorWorker>(period.toJavaDuration()).build()
            // One schedule however many launches call this: UPDATE keeps the work that is already
            // scheduled, with its timing, and only changes its period.
            workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        override fun cancel() {
            currentTick = null
            workManager.cancelUniqueWork(WORK_NAME)
        }

        internal companion object {
            const val WORK_NAME = "status-monitor"

            // WorkManager builds MonitorWorker itself, so the worker can't be handed the tick: it
            // finds it here, in the process they share. A new process gets it from onAppLaunch.
            @Volatile
            var currentTick: (suspend () -> Unit)? = null
        }
    }

    // What WorkManager runs each period, in the app's process: Android starts the process for it
    // if it isn't running, and Application.onCreate runs first.
    class MonitorWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result {
            val tick = AndroidMonitorScheduler.currentTick
            Log.i("DeviceMonitor", if (tick == null) "Monitor work ran, but the monitor is stopped" else "Monitor tick")
            tick?.invoke()
            return Result.success()
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.outbound.MonitorScheduler
    import kotlinx.cinterop.BetaInteropApi
    import kotlinx.cinterop.ExperimentalForeignApi
    import kotlinx.cinterop.ObjCObjectVar
    import kotlinx.cinterop.alloc
    import kotlinx.cinterop.memScoped
    import kotlinx.cinterop.ptr
    import kotlinx.cinterop.value
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.MainScope
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.launch
    import platform.BackgroundTasks.BGAppRefreshTask
    import platform.BackgroundTasks.BGAppRefreshTaskRequest
    import platform.BackgroundTasks.BGTaskScheduler
    import platform.Foundation.NSDate
    import platform.Foundation.NSError
    import platform.Foundation.NSNotificationCenter
    import platform.Foundation.NSOperationQueue
    import platform.Foundation.dateWithTimeIntervalSinceNow
    import platform.UIKit.UIApplication
    import platform.UIKit.UIApplicationDidBecomeActiveNotification
    import platform.UIKit.UIApplicationDidEnterBackgroundNotification
    import platform.UIKit.UIApplicationState
    import platform.darwin.dispatch_get_main_queue
    import kotlin.time.Duration

    // Outbound adapter: the monitor's timer on iOS, behind the MonitorScheduler port. In the
    // foreground the app runs as it likes, so a coroutine ticks every interval. In the background
    // iOS suspends the app, so the adapter asks BGTaskScheduler to launch it again in about one
    // interval, at the earliest; iOS decides when, or whether. Build it in the app start: its
    // launch handler must be registered before the app finishes launching.
    @OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
    class IosMonitorScheduler : MonitorScheduler {
        private val scope = MainScope() // ticks run on the main thread, like the status adapters
        private val scheduler = BGTaskScheduler.sharedScheduler
        private var tick: (suspend () -> Unit)? = null
        private var interval = Duration.ZERO
        private var timer: Job? = null

        init {
            // Once per process, and during launch: registering after launch is an error, and a second
            // registration of the same identifier ends the app. false: the identifier isn't permitted.
            val registered = scheduler.registerForTaskWithIdentifier(TASK_ID, dispatch_get_main_queue()) { task ->
                refresh(task as BGAppRefreshTask)
            }
            check(registered) { "$TASK_ID isn't in BGTaskSchedulerPermittedIdentifiers (project.yml)." }
            // App-level lifecycle, not a screen's: these fire whichever screen is showing.
            val center = NSNotificationCenter.defaultCenter
            center.addObserverForName(UIApplicationDidBecomeActiveNotification, null, NSOperationQueue.mainQueue) { _ ->
                scheduler.cancelTaskRequestWithIdentifier(TASK_ID) // the timer takes over
                startTimer()
            }
            center.addObserverForName(UIApplicationDidEnterBackgroundNotification, null, NSOperationQueue.mainQueue) { _ ->
                // Leaving the foreground: iOS will suspend the app, so hand over from the timer to
                // BGTaskScheduler. A launch straight into the background posts this too, with no
                // timer running: the refresh task that launched the app then submits the next one.
                if (timer?.isActive == true) {
                    timer?.cancel()
                    submit()
                }
            }
        }

        override fun schedule(interval: Duration, tick: suspend () -> Unit) {
            this.tick = tick
            this.interval = interval
            // At launch the app isn't active yet, and the notification starts the timer; later, start it now.
            if (UIApplication.sharedApplication.applicationState == UIApplicationState.UIApplicationStateActive) {
                startTimer()
            }
        }

        override fun cancel() {
            tick = null
            timer?.cancel()
            scheduler.cancelTaskRequestWithIdentifier(TASK_ID)
        }

        private fun startTimer() {
            val tick = tick ?: return
            timer?.cancel()
            timer = scope.launch {
                while (true) {
                    delay(interval)
                    println("Monitor tick (foreground)")
                    tick()
                }
            }
        }

        // Asks iOS to launch the app in the background, not before one interval from now.
        private fun submit() {
            val request = BGAppRefreshTaskRequest(identifier = TASK_ID)
            request.earliestBeginDate = NSDate.dateWithTimeIntervalSinceNow(interval.inWholeSeconds.toDouble())
            memScoped {
                val error = alloc<ObjCObjectVar<NSError?>>()
                if (!scheduler.submitTaskRequest(request, error.ptr)) {
                    // On the Simulator, always: it "doesn't support background processing".
                    println("Monitor: no background refresh: ${error.value?.localizedDescription}")
                }
            }
        }

        // iOS launched (or woke) the app in the background for the refresh task.
        private fun refresh(task: BGAppRefreshTask) {
            val tick = tick
            if (tick == null) {
                task.setTaskCompletedWithSuccess(true)
                return
            }
            submit() // the next one first: this one may be cut short
            val work = scope.launch {
                println("Monitor tick (background)")
                tick()
                task.setTaskCompletedWithSuccess(true)
            }
            task.expirationHandler = {
                work.cancel()
                task.setTaskCompletedWithSuccess(false)
            }
        }

        private companion object {
            // Also listed in Info.plist, under BGTaskSchedulerPermittedIdentifiers (project.yml).
            const val TASK_ID = "com.example.devicemonitor.monitor"
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeMonitorScheduler.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.outbound.MonitorScheduler
    import kotlin.time.Duration

    // Fake: an outbound adapter written for tests, behind the MonitorScheduler port. The test plays
    // the platform's timer: it fires the tick when it likes, as often as it likes.
    class FakeMonitorScheduler : MonitorScheduler {
        var interval: Duration? = null
            private set
        var cancelled = false
            private set
        private var tick: (suspend () -> Unit)? = null

        override fun schedule(interval: Duration, tick: suspend () -> Unit) {
            this.interval = interval
            this.tick = tick
            cancelled = false
        }

        override fun cancel() {
            cancelled = true
        }

        // What the platform does when the time comes. Keeps the tick after cancel(), so a test can
        // play a late tick that was already on its way.
        suspend fun fire() {
            checkNotNull(tick) { "Nothing was scheduled." }.invoke()
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeLogStore.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.outbound.LogStore

    // Fake: an outbound adapter written for tests, behind the LogStore port: a list in memory. The
    // test can make the next append fail, as a full disk would.
    class FakeLogStore : LogStore {
        val records = mutableListOf<LogRecord>()
        var failNextAppend: String? = null

        override suspend fun append(record: LogRecord) {
            failNextAppend?.let {
                failNextAppend = null
                throw LogStoreException(it)
            }
            records += record
        }

        override suspend fun read(): List<LogRecord> = records.toList()

        override suspend fun clear() = records.clear()
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/MonitoringServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.doubles.FakeBatteryProvider
    import com.example.devicemonitor.doubles.FakeBluetoothProvider
    import com.example.devicemonitor.doubles.FakeConnectionStatus
    import com.example.devicemonitor.doubles.FakeLogStore
    import com.example.devicemonitor.doubles.FakeMonitorScheduler
    import com.example.devicemonitor.doubles.FakeNetworkProvider
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFailsWith
    import kotlin.test.assertTrue
    import kotlin.time.Clock
    import kotlin.time.Duration.Companion.minutes
    import kotlin.time.Instant

    class MonitoringServiceTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val battery = FakeBatteryProvider()
        private val network = FakeNetworkProvider()
        private val bluetooth = FakeBluetoothProvider()
        private val connection = FakeConnectionStatus()
        private val log = FakeLogStore()
        private val scheduler = FakeMonitorScheduler()
        private val clock = object : Clock {
            var now = Instant.parse("2026-09-11T10:30:00Z")
            override fun now() = now
        }

        // Through the inbound port, as the app's launch calls it.
        private val monitor: DeviceMonitoring =
            MonitoringService(battery, network, bluetooth, connection, log, scheduler, clock)

        @Test
        fun startAsksTheSchedulerForTheInterval() {
            monitor.start(15.minutes)

            assertEquals(15.minutes, scheduler.interval)
            assertEquals(MonitorStatus.Running(15.minutes), monitor.status.value)
        }

        @Test
        fun eachTickAppendsTheStatusAndTheTime() = runTest {
            monitor.start(15.minutes)
            battery.percent = 47

            scheduler.fire()
            clock.now = Instant.parse("2026-09-11T10:45:00Z")
            battery.percent = 46
            scheduler.fire()

            assertEquals(listOf("2026-09-11T10:30:00Z", "2026-09-11T10:45:00Z"), log.records.map { it.timestamp.toString() })
            assertEquals(listOf(47, 46), log.records.map { it.status.battery })
            assertEquals(MonitorStatus.Running(15.minutes, lastRecord = log.records.last()), monitor.status.value)
        }

        @Test
        fun theRecordFollowsTheStatusRules() = runTest {
            monitor.start(15.minutes)
            network.status = NetworkStatus(wifiEnabled = null, wifiConnected = true, cellularAvailable = false)
            connection.state = ConnectionState.Connecting(obd)
            scheduler.fire()
            connection.state = ConnectionState.Connected(obd)
            scheduler.fire()

            assertEquals(listOf(true, true), log.records.map { it.status.wifiEnabled })
            assertEquals(listOf(false, true), log.records.map { it.status.bluetoothConnected })
        }

        @Test
        fun stopCancelsAndALateTickWritesNothing() = runTest {
            monitor.start(15.minutes)
            monitor.stop()

            scheduler.fire() // a tick that was already on its way

            assertTrue(scheduler.cancelled)
            assertEquals(MonitorStatus.Stopped, monitor.status.value)
            assertEquals(emptyList(), log.records)
        }

        @Test
        fun aFileErrorIsReportedAndTheNextTickTriesAgain() = runTest {
            monitor.start(15.minutes)
            log.failNextAppend = "Couldn't write to the log: No space left on device"

            scheduler.fire()
            assertEquals(
                MonitorStatus.Running(15.minutes, lastError = "Couldn't write to the log: No space left on device"),
                monitor.status.value,
            )

            scheduler.fire()
            assertEquals(1, log.records.size)
            assertEquals(MonitorStatus.Running(15.minutes, lastRecord = log.records.single()), monitor.status.value)
        }

        @Test
        fun logsAndClearLogsUseTheLogStore() = runTest {
            monitor.start(15.minutes)
            scheduler.fire()
            assertEquals(log.records, monitor.logs())

            monitor.clearLogs()

            assertEquals(emptyList(), monitor.logs())
        }

        @Test
        fun anIntervalMustBePositive() {
            assertFailsWith<IllegalArgumentException> { monitor.start(0.minutes) }
            assertEquals(null, scheduler.interval)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.doubles.FakeBatteryProvider
    import com.example.devicemonitor.doubles.FakeBleConnection
    import com.example.devicemonitor.doubles.FakeBleScanner
    import com.example.devicemonitor.doubles.FakeBluetoothProvider
    import com.example.devicemonitor.doubles.FakeLogStore
    import com.example.devicemonitor.doubles.FakeMonitorScheduler
    import com.example.devicemonitor.doubles.FakeNetworkProvider
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.test.runTest
    import org.koin.dsl.koinApplication
    import kotlin.test.AfterTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertNotNull
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.minutes

    class AppModuleTest {
        // Fakes stand in for the adapters each platform passes to initKoin.
        private val radio = FakeBleConnection()
        private val os = FakePermissionChecker()
        private val log = FakeLogStore()
        private val timer = FakeMonitorScheduler()
        private val app = koinApplication {
            modules(
                appModule,
                platformModule(
                    os, FakeBleScanner(), radio,
                    FakeBatteryProvider(), FakeNetworkProvider(), FakeBluetoothProvider(),
                    log, timer,
                ),
            )
        }
        private val koin = app.koin

        // A single's instance is kept in the module, and appModule is one object for every test:
        // without close(), the next test's koinApplication would get this test's session.
        @AfterTest
        fun closeKoin() {
            app.close()
        }

        // Koin checks the graph only when something asks for an instance, at run time. This
        // test asks for every screen's ViewModel, so a missing binding fails here, not in the app.
        @Test
        fun buildsEveryViewModel() {
            assertNotNull(koin.get<DeviceListViewModel>())
            assertNotNull(koin.get<DeviceDetailViewModel>())
        }

        // The bridge must reach the session the screens connect through, not a second one.
        @Test
        fun theStatusSeesTheAppsOneSession() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Granted
            val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
            val call = launch { koin.get<DeviceSession>().connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            assertTrue(koin.get<StatusReport>().current().bluetoothConnected)
            call.cancelAndJoin()
        }

        // The monitor reaches the same session through the same bridge, and writes to the log store
        // the platform passed in.
        @Test
        fun theMonitorLogsWhatTheAppsOneSessionSays() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Granted
            val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
            val call = launch { koin.get<DeviceSession>().connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            koin.get<DeviceMonitoring>().start(15.minutes)
            timer.fire()

            assertEquals(listOf(true), log.records.map { it.status.bluetoothConnected })
            call.cancelAndJoin()
        }
    }
    ```

??? example "shared/build.gradle.kts"
    ```kotlin
    plugins {
        id("org.jetbrains.kotlin.multiplatform")
        id("com.android.kotlin.multiplatform.library")
        id("org.jetbrains.kotlin.plugin.serialization")
        id("co.touchlab.skie")
    }

    kotlin {
        android {
            namespace = "com.example.devicemonitor.shared"
            compileSdk = 37
            minSdk = 26
            withHostTest {}
        }

        listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
            target.binaries.framework {
                baseName = "Shared"
                isStatic = true
                export("androidx.lifecycle:lifecycle-viewmodel:2.11.0")
                binaryOption("bundleId", "com.example.devicemonitor.shared")
            }
        }

        sourceSets {
            commonMain.dependencies {
                api("androidx.lifecycle:lifecycle-viewmodel:2.11.0")
                api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
                implementation("io.insert-koin:koin-core:4.2.2")
                implementation("io.insert-koin:koin-core-viewmodel:4.2.2")
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
            }
            androidMain.dependencies {
                implementation("androidx.activity:activity:1.13.0")
                implementation("androidx.work:work-runtime:2.12.0")
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
            }
        }
    }
    ```

**Android**

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
    import com.example.devicemonitor.adapter.inbound.onAppLaunch
    import com.example.devicemonitor.adapter.outbound.AndroidBatteryProvider
    import com.example.devicemonitor.adapter.outbound.AndroidBleConnection
    import com.example.devicemonitor.adapter.outbound.AndroidBleScanner
    import com.example.devicemonitor.adapter.outbound.AndroidBluetoothProvider
    import com.example.devicemonitor.adapter.outbound.AndroidLogStore
    import com.example.devicemonitor.adapter.outbound.AndroidMonitorScheduler
    import com.example.devicemonitor.adapter.outbound.AndroidNetworkProvider
    import com.example.devicemonitor.adapter.outbound.AndroidPermissionChecker
    import com.example.devicemonitor.di.initKoin
    import java.io.File

    // Runs once per process, before any Activity, and before any background work WorkManager runs
    // in it: the place to start Koin and to hand the monitor its tick.
    class DeviceMonitorApplication : Application() {
        // The Android permission adapter, one for the process. Koin hands it to the app core as
        // its PermissionChecker, and an Activity or a Fragment lends it a result launcher.
        lateinit var permissionChecker: AndroidPermissionChecker
            private set

        override fun onCreate() {
            super.onCreate()
            permissionChecker = AndroidPermissionChecker(this)
            initKoin(
                permissionChecker = permissionChecker,
                bleScanner = AndroidBleScanner(this),
                bleConnection = AndroidBleConnection(this),
                batteryProvider = AndroidBatteryProvider(this),
                networkProvider = AndroidNetworkProvider(this),
                bluetoothProvider = AndroidBluetoothProvider(this),
                logStore = AndroidLogStore(File(filesDir, "status-log.jsonl")),
                monitorScheduler = AndroidMonitorScheduler(this),
            )
            onAppLaunch()
        }
    }
    ```

**iOS**

=== "SwiftUI"

    ??? example "iosApp/project.yml · SwiftUI track"
        ```yaml
        name: iosApp
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          iosApp:
            type: application
            platform: iOS
            sources: [iosApp]
            info:
              path: iosApp/Info.plist
              properties:
                CFBundleDisplayName: Device Monitor
                UILaunchScreen: {}
                NSBluetoothAlwaysUsageDescription: Device Monitor uses Bluetooth to find and connect to nearby devices.
                # The monitor (Lesson 18): background refresh, and the one task identifier it uses.
                UIBackgroundModes: [fetch]
                BGTaskSchedulerPermittedIdentifiers: [com.example.devicemonitor.monitor]
            settings:
              base:
                PRODUCT_BUNDLE_IDENTIFIER: com.example.devicemonitor
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
                ENABLE_USER_SCRIPT_SANDBOXING: NO
            preBuildScripts:
              - name: Compile Kotlin Framework
                basedOnDependencyAnalysis: false
                script: |
                  if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                    echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                    exit 0
                  fi
                  cd "$SRCROOT/.."
                  ./gradlew :shared:embedAndSignAppleFrameworkForXcode
        ```

    ??? example "iosApp/iosApp/iOSApp.swift"
        ```swift
        import SwiftUI
        import Shared

        @main
        struct iOSApp: App {
            // Runs once per launch, before the app finishes launching, whether the user opened it or
            // iOS launched it in the background for the monitor: the place for app-level work.
            init() {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider(),
                    logStore: IosLogStore(),
                    monitorScheduler: IosMonitorScheduler()
                )
                AppLaunchKt.onAppLaunch()
            }

            var body: some Scene {
                WindowGroup {
                    ContentView()
                }
            }
        }
        ```

=== "UIKit"

    ??? example "iosApp/project.yml · UIKit track"
        ```yaml
        name: iosApp
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          iosApp:
            type: application
            platform: iOS
            sources: [iosApp]
            info:
              path: iosApp/Info.plist
              properties:
                CFBundleDisplayName: "Device Monitor"
                UILaunchScreen: {}
                NSBluetoothAlwaysUsageDescription: "Device Monitor uses Bluetooth to find and connect to nearby devices."
                # The monitor (Lesson 18): background refresh, and the one task identifier it uses.
                UIBackgroundModes: [fetch]
                BGTaskSchedulerPermittedIdentifiers: [com.example.devicemonitor.monitor]
                UIApplicationSceneManifest:
                  UIApplicationSupportsMultipleScenes: false
                  UISceneConfigurations:
                    UIWindowSceneSessionRoleApplication:
                      - UISceneConfigurationName: "Default Configuration"
                        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate"
            settings:
              base:
                PRODUCT_BUNDLE_IDENTIFIER: com.example.devicemonitor
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
                ENABLE_USER_SCRIPT_SANDBOXING: NO
            preBuildScripts:
              - name: "Compile Kotlin Framework"
                basedOnDependencyAnalysis: false
                script: |
                  if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                    echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                    exit 0
                  fi
                  cd "$SRCROOT/.."
                  ./gradlew :shared:embedAndSignAppleFrameworkForXcode
        ```

    ??? example "iosApp/iosApp/AppDelegate.swift"
        ```swift
        import UIKit
        import Shared

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            // Runs once per launch, whether the user opened the app or iOS launched it in the background
            // for the monitor, and the launch isn't finished until it returns: the place for app-level
            // work, and the last moment to register a background task.
            func application(_ application: UIApplication,
                             didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider(),
                    logStore: IosLogStore(),
                    monitorScheduler: IosMonitorScheduler()
                )
                AppLaunchKt.onAppLaunch()
                return true
            }

            func application(_ application: UIApplication,
                             configurationForConnecting connectingSceneSession: UISceneSession,
                             options: UIScene.ConnectionOptions) -> UISceneConfiguration {
                UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0). Nó chạy **đúng code** `MonitoringService.kt`, `ReadStatus.kt`, `MonitorStatus.kt`, `MonitorScheduler.kt` của bài và các model của bài 17 (chỉ gom về một package); scheduler, đồng hồ, log và các provider là fake viết tay. Không có WorkManager hay `BGTaskScheduler` thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-ai-giu-ong-ho-nhu-chuyen-bao-ve-tuan-tra): ai giữ đồng hồ, Android cạnh iOS (mục 1, 4, 5).
    3. [A3](#a3-mot-nhip-mot-ban-ghi-chay-that-bang-code-cua-bai): một nhịp, một bản ghi, chạy thật bằng code của bài (mục 2, 3, 7).
    4. [A4](#a4-vi-sao-khoi-ong-o-phan-khoi-ong-app): vì sao khởi động ở phần khởi động app, không ở màn hình (mục 6).
    5. [A5](#a5-nhung-cach-lach-va-vi-sao-khong-dung): những cách "lách" và vì sao không dùng (mục 1, 4).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Monitor phải đọc trạng thái **mỗi ~15 phút**, kể cả khi app ở nền hay không chạy; không hệ điều hành nào cho app tự lặp mãi ở nền.
    2. App core có inbound port `DeviceMonitoring` (`start`, `stop`, `status`, `logs`, `clearLogs`) do `MonitoringService` implement; mỗi **nhịp** (tick) đọc trạng thái qua `readStatus` và ghi một `LogRecord`.
    3. Bộ hẹn giờ nằm sau outbound port `MonitorScheduler`: **adapter quyết định khi nào, service quyết định làm gì**. Android dùng WorkManager (≥ 15 phút); iOS dùng một timer coroutine ở foreground và `BGTaskScheduler` ở nền.
    4. Monitor khởi động trong **phần khởi động app** (`onAppLaunch()` sau `initKoin`), vì những lần mở app ở nền không hiện màn hình nào, và mỗi process mới cần trao lại nhịp.
    5. Test không chờ đồng hồ: **test chính là bộ hẹn giờ** (`FakeMonitorScheduler.fire()`), và đồng hồ là một `Clock` do test đặt.

Ví dụ đời thường cho cả bài: **bảo vệ tuần tra một toà nhà**, mỗi vòng ghi sổ "giờ, điện, nước, cửa". Ban ngày (foreground) bạn tự đặt đồng hồ báo thức 15 phút. Ban đêm bạn không được tự đi (app ở nền): ở Android, **trưởng ca** (WorkManager) gọi bạn dậy đi tuần, không sớm hơn 15 phút, thường muộn hơn; ở iOS, **ban quản lý** (iOS) gọi bạn khi họ thấy tiện, có khi không gọi. Cuốn sổ (file log) là thứ còn lại sáng hôm sau, không phải trí nhớ của bạn (`MonitorStatus` trong bộ nhớ).

| Chữ trong bài | Nói đơn giản | Trong m13 là |
|---|---|---|
| tick (nhịp) | một lần đọc trạng thái và ghi một bản ghi | `MonitoringService.tick()` |
| `DeviceMonitoring` | inbound port của monitor | `start`, `stop`, `status`, `logs`, `clearLogs` |
| `MonitorScheduler` | outbound port "gọi nhịp này khoảng mỗi chu kỳ" | `AndroidMonitorScheduler`, `IosMonitorScheduler` |
| WorkManager | thư viện Jetpack chạy việc nền đáng tin cậy, sống qua reboot | `PeriodicWorkRequest`, `MonitorWorker` |
| `ExistingPeriodicWorkPolicy.UPDATE` | lên lịch lại không làm mất lịch cũ | mở app lại không ghi thừa bản ghi |
| `BGTaskScheduler` | cách iOS mở app ở nền khi nó muốn | `BGAppRefreshTaskRequest`, `earliestBeginDate` |
| `earliestBeginDate` | "không sớm hơn", không phải "đúng lúc" | 15 phút sau |
| `BGTaskSchedulerPermittedIdentifiers` | danh sách task identifier app được phép đăng ký | `com.example.devicemonitor.monitor` |
| `readStatus` | hàm quy tắc trạng thái dùng chung cho hai service | Wi-Fi, "chỉ `Connected`" |
| `Clock` | interface "bây giờ là mấy giờ", truyền vào để test đặt được | `Clock.System` mặc định |
| `onAppLaunch()` | inbound adapter khởi động monitor ở mỗi process | gọi sau `initKoin` |

### A2. Ai giữ đồng hồ, như chuyện bảo vệ tuần tra

Giải thích thêm cho [mục 1](#1-ai-giu-ong-ho), [mục 4](#4-android-workmanager) và [mục 5](#5-ios-mot-bo-hen-gio-o-foreground-bgtaskscheduler-o-nen).

| | Android (`AndroidMonitorScheduler`) | iOS (`IosMonitorScheduler`) |
|---|---|---|
| App trên màn hình | WorkManager, ≥ 15 phút | timer coroutine riêng của app, mỗi chu kỳ |
| App ở nền | WorkManager, như trên | app bị tạm dừng; chỉ chạy khi iOS mở cho một refresh task |
| Process đã mất | WorkManager khởi động process, `Application.onCreate` chạy trước | iOS có thể mở app thẳng vào nền cho refresh task |
| Lần đầu | ngay lập tức (request mới không có độ trễ) | foreground: sau một chu kỳ; nền: không sớm hơn 15 phút |
| Mở lại app | `UPDATE`: giữ lịch cũ, không ghi thừa | chỉ lưu nhịp mới, khởi động lại timer nếu đang active |
| Trên emulator / Simulator | chạy thật (chờ đủ 15 phút) | refresh task **không bao giờ** chạy (lỗi mã 1) |
| Cấu hình | không cần (manifest của WorkManager được gộp vào) | `UIBackgroundModes: fetch` + `BGTaskSchedulerPermittedIdentifiers` |

Vì sao `MonitorWorker` không nhận nhịp qua constructor? Vì WorkManager tự dựng worker bằng reflection (chỉ `Context` + `WorkerParameters`), và lưu request trong SQLite, nơi không chứa được một lambda. Nên nhịp nằm trong companion object của adapter, và `onAppLaunch()` (chạy trong `Application.onCreate`, trước `doWork`) đặt nó vào mỗi process.

So với TS/JS: foreground của iOS giống `setInterval` trong một tab đang mở. Phần nền giống **Service Worker** với Periodic Background Sync: bạn xin `minInterval`, trình duyệt quyết định khi nào (hoặc không bao giờ) chạy, và tab có thể không mở.

### A3. Một nhịp, một bản ghi, chạy thật bằng code của bài

Giải thích thêm cho [mục 2](#2-hai-port-thu-app-cung-cap-thu-app-can), [mục 3](#3-monitoring-service-mot-nhip-mot-ban-ghi) và [mục 7](#7-test-bo-hen-gio-cua-nen-tang-do-test-ong-vai). `MonitoringService` thật, với một scheduler giả mà chương trình tự `fire()`, một đồng hồ giả và một log trong bộ nhớ có thể giả làm "đĩa đầy":

```kotlin title="l18/Main.kt (chạy code của bài, không có trong app)"
class FakeScheduler : MonitorScheduler {
    var interval: kotlin.time.Duration? = null
    private var tick: (suspend () -> Unit)? = null
    override fun schedule(interval: kotlin.time.Duration, tick: suspend () -> Unit) { this.interval = interval; this.tick = tick }
    override fun cancel() { interval = null }
    suspend fun fire() = tick?.invoke()          // như WorkManager / BGTask gọi nhịp
}

fun main() = runBlocking {
    val scheduler = FakeScheduler()
    val clock = FakeClock(Instant.parse("2026-09-11T10:30:00Z"))
    val log = MemoryLog()
    val battery = Battery(82)
    val monitor = MonitoringService(battery, Network(), Bluetooth(), Link(), log, scheduler, clock)

    monitor.start(15.minutes)
    println("start(15 min)   -> scheduler.interval = ${scheduler.interval}")
    scheduler.fire()
    println("fire @10:30     -> ${monitor.status.value.short()}")
    clock.now = Instant.parse("2026-09-11T10:45:00Z"); battery.level = 81; log.failNext = true
    scheduler.fire()
    println("fire @10:45     -> ${monitor.status.value.short()}")
    clock.now = Instant.parse("2026-09-11T11:00:00Z"); battery.level = 80
    scheduler.fire()
    println("fire @11:00     -> ${monitor.status.value.short()}")
    monitor.stop()
    clock.now = Instant.parse("2026-09-11T11:15:00Z")
    scheduler.fire()
    println("stop, rồi nhịp muộn -> ${monitor.status.value.short()}")
    println("log: " + monitor.logs().map { "${it.timestamp} ${it.status.battery}% wifiEnabled=${it.status.wifiEnabled}" })
    try { monitor.start(kotlin.time.Duration.ZERO) } catch (e: IllegalArgumentException) { println("start(0): ${e.message}") }
}
```

Output thật:

```text
start(15 min)   -> scheduler.interval = 15m
fire @10:30     -> Running(15m, last=2026-09-11T10:30:00Z, error=null)
fire @10:45     -> Running(15m, last=2026-09-11T10:30:00Z, error=The disk is full (simulated).)
fire @11:00     -> Running(15m, last=2026-09-11T11:00:00Z, error=null)
stop, rồi nhịp muộn -> Stopped
log: [2026-09-11T10:30:00Z 82% wifiEnabled=true, 2026-09-11T11:00:00Z 80% wifiEnabled=true]
start(0): The monitor's interval must be positive, not 0s.
```

1. **`start` chỉ trao nhịp đi.** Không có bản ghi nào cho tới khi "nền tảng" (ở đây là `fire()`) gọi nhịp.
2. **Đồng hồ do test đặt**, nên timestamp đúng từng giây: 10:30, rồi 11:00. Không cần chờ 15 phút thật hay ảo.
3. **Đĩa đầy lúc 10:45** không làm crash: lỗi nằm trong `lastError`, `lastRecord` vẫn là bản 10:30, và nhịp 11:00 thử lại thành công, xoá lỗi.
4. **Nhịp muộn sau `stop()`** (scheduler giả vẫn giữ lambda, như WorkManager có thể đã khởi động worker) không ghi gì: dòng đầu của `tick()` chặn nó. Log chỉ có hai bản ghi.
5. **`wifiEnabled=true`** dù provider trả `null`: quy tắc Wi-Fi trong `readStatus`, cùng hàm mà `StatusService` dùng.
6. **`require`** từ chối chu kỳ 0 ngay ở inbound port, trước khi tới adapter.

So với TS/JS: giống truyền `scheduler = { schedule(ms, fn) {…} }` vào thay vì gọi `setInterval` trực tiếp, để test tự gọi `fn()`; và truyền `now = () => new Date(...)` thay vì gọi `Date.now()`.

### A4. Vì sao khởi động ở phần khởi động app

Giải thích thêm cho [mục 6](#6-khoi-ong-no-o-noi-app-khoi-ong).

| Móc | Chạy khi | Chạy trong process WorkManager khởi động? | Chạy khi iOS mở app vào nền? |
|---|---|---|---|
| `Application.onCreate` (Android) | một lần mỗi process | có | |
| `App.init` (SwiftUI) / `didFinishLaunchingWithOptions` (UIKit) | một lần mỗi lần mở app | | có |
| `onAppear` / `viewWillAppear` / effect của composable | khi một màn hình hiện | **không** | **không** |

Ví dụ đời thường: bạn muốn mỗi ca trực đều có người ghi sổ. Nếu chỉ giao việc khi **có người vào sảnh** (màn hình hiện), thì ca đêm (process nền, không ai vào sảnh) không ai ghi. Phải giao việc ngay **lúc mở cửa toà nhà** (khởi động app), ca nào cũng vậy.

Gọi `onAppLaunch()` ở mỗi lần mở có an toàn không? Có: Android dùng `UPDATE` nên vẫn một lịch, không ghi thừa; iOS chỉ lưu nhịp mới. Và **bắt buộc**: cái lambda mà process cũ trao cho adapter đã chết cùng process đó, nên process mới phải trao lại.

### A5. Những cách "lách" và vì sao không dùng

Giải thích thêm cho [mục 1](#1-ai-giu-ong-ho) và [mục 4](#4-android-workmanager).

| Cách lách | Có vẻ được gì | Thật ra |
|---|---|---|
| vòng `while (true) { delay(15.minutes) }` trong ViewModel | một timer đơn giản | chết khi app đóng; ở nền iOS tạm dừng nó |
| exact alarm Android mỗi vài phút | đúng giờ | đánh thức máy khỏi Doze, tốn pin; chỉ dành cho báo thức, lịch |
| foreground service chạy mãi | process luôn sống | phải hiện thông báo, cần type từ Android 14, không khởi động được từ nền (Android 12+); dành cho việc người dùng thấy |
| background mode audio / location trên iOS | app được thức | vi phạm App Review 2.5.4, bị từ chối |
| WorkManager / `BGTaskScheduler` | không đúng giờ | **cách đúng**: nền tảng tự cân pin, mạng, thói quen người dùng |

Khi nào foreground service mới là đúng? Khi người dùng **chủ động bắt đầu và theo dõi**: ví dụ "đọc nhịp tim trực tiếp mỗi 2 giây trong lúc chạy bộ", có thông báo trên thanh trạng thái suốt thời gian đó. Monitor của bài này vô hình và chờ vài phút được, nên là WorkManager.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 19.

- [ ] Giải thích vì sao không app nào được tự lặp mãi ở nền, và mỗi nền tảng cho cách nào thay vào (xem [A2](#a2-ai-giu-ong-ho-nhu-chuyen-bao-ve-tuan-tra)).
- [ ] Phân biệt `DeviceMonitoring` (inbound) với `MonitorScheduler` (outbound), và nói "adapter quyết định khi nào, service quyết định làm gì".
- [ ] Đọc `MonitoringService` và nói ba quy tắc: nhịp muộn không ghi gì, lỗi file vào `lastError` và nhịp sau thử lại, chu kỳ phải dương (xem [A3](#a3-mot-nhip-mot-ban-ghi-chay-that-bang-code-cua-bai)).
- [ ] Giải thích vì sao quy tắc trạng thái thành hàm `readStatus` dùng chung, chứ không phải một bridge tới `StatusReport`.
- [ ] Truyền một `Clock` vào service và đặt nó trong test.
- [ ] Lên lịch một `PeriodicWorkRequest` duy nhất với `UPDATE`, và giải thích vì sao worker lấy nhịp từ companion object.
- [ ] Biết vì sao không ép được một lần chạy định kỳ sớm, và cách đọc job id từ `dumpsys jobscheduler`.
- [ ] Đăng ký `BGTaskScheduler` đúng lúc (trước khi `didFinishLaunching` kết thúc), xin refresh task khi vào nền, và luôn gọi `setTaskCompleted`.
- [ ] Khai báo `fetch` và `BGTaskSchedulerPermittedIdentifiers` trong `project.yml`, và đọc mã lỗi 1 / 2 / 3 của `BGTaskScheduler`.
- [ ] Giải thích vì sao monitor khởi động trong phần khởi động app chứ không ở màn hình (xem [A4](#a4-vi-sao-khoi-ong-o-phan-khoi-ong-app)).
- [ ] Kể các cách "lách" giới hạn nền và vì sao không dùng, và khi nào foreground service mới đúng (xem [A5](#a5-nhung-cach-lach-va-vi-sao-khong-dung)).
- [ ] Làm xong 6 bài tự làm ở trên mà không cần agent.
