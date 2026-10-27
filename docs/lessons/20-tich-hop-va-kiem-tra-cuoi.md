---
source: lessons/20-integration-and-end-to-end-check.html
source_ref: live
source_sha: f7b5ffa
---

<p class="kicker">Bài 20 · Tuần 4 · Ngày 20 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html">Bản gốc tiếng Anh</a></p>

# Tích hợp và kiểm tra đầu-cuối

<div class="meta">
  <span class="tag">~2,5 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m15 hoàn thành phần lõi của Native Device Monitor</span>
  <span class="tag">Cần trước: <a href="../19-bang-hanh-vi-nen/">19</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Mười chín bài đã dựng Native Device Monitor từng khả năng một, mỗi khả năng được test riêng. Hôm nay bạn dùng nó như một người dùng và đọc nó như một người review. Như người dùng: một màn hình từ đó điều khiển được mọi tính năng. Như người review: hai checklist của kế hoạch khoá học, đầu-cuối và refactor (Appendix B). Chạy trên m14, chúng tìm ra bốn thứ cần sửa. Monitor không có nút nào, nên không ai dừng được nó và lỗi của nó không bao giờ tới màn hình. Một lần Stop chỉ giữ được tới lần mở app tiếp theo. Một quy tắc của app, giới hạn thời gian của lần quét, nằm trong một ViewModel. Và project mang theo một dependency và một class không gì dùng tới. Sửa chúng cho milestone **m15**, app lõi hoàn chỉnh. Các checklist được đưa vào project, để team chạy được trước mỗi lần phát hành. Như các bài trước, những hàng cần điện thoại chờ điện thoại của bạn.

!!! info "Nguồn chính"
    [Appendix B](https://phongna-inn.github.io/carmd-kmp-course/COURSE_PLAN.md) của kế hoạch khoá học (hai checklist) và Appendix A.1 (UI) trước mục 1. Trang [Save simple data with SharedPreferences](https://developer.android.com/training/data-storage/shared-preferences) của Android và [UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults) của Apple trước mục 4.

!!! info "Track"
    ViewModel của monitor, port mới, các thay đổi trong service, quy tắc quét và việc dọn dẹp là code dùng chung, giống nhau trên mọi track. Adapter cài đặt của Android, trong `androidMain`, và class `Application` mà cả hai track Android dùng chung cũng vậy. Adapter cài đặt của iOS là một file Swift cho cả hai track iOS, được truyền vào từ phần khởi động app của mỗi track. Các track khác nhau ở màn hình chính, thứ có thêm một khu monitor (mục 3); 0,5 giờ thêm cho mỗi track là khu đó trên XML hoặc UIKit. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m14

| Cái gì | m14 | m15 |
|---|---|---|
| app core | monitor bắt đầu và dừng qua `DeviceMonitoring`; scanning service quét cho tới khi bên collect huỷ | `DeviceMonitoring` có thêm `restore(interval)`; `MonitoringService` giữ lần Stop của người dùng qua một outbound port mới, `MonitorSettings`; `ScanningService` kết thúc mọi lần quét sau 10 giây |
| inbound adapter dùng chung | `onAppLaunch()` gọi `start`; ViewModel danh sách giữ giới hạn thời gian quét và câu chữ trạng thái | `onAppLaunch()` gọi `restore`; một `MonitorViewModel` và `MonitorUiState` mới; câu chữ trạng thái dời sang `StatusText.kt`, dùng chung cho cả hai ViewModel; ViewModel danh sách mất giới hạn thời gian |
| outbound adapter | — | `AndroidMonitorSettings` (SharedPreferences, `androidMain`); `IosMonitorSettings` (UserDefaults, Swift, cả hai track iOS) |
| Koin | tám adapter truyền vào `initKoin` | chín: thêm `monitorSettings`; `MonitorViewModel` được bind |
| màn hình chính | trạng thái, bộ lọc, quyền, Scan, danh sách | thêm một khu monitor dưới dòng trạng thái: đang chạy hay đã dừng, Start hoặc Stop, log đang có bao nhiêu bản ghi, ba bản ghi mới nhất, Clear, và cái gì đã hỏng |
| đã gỡ | — | `Greeting` của m00 và `platformName()` `expect`/`actual` của nó (bốn file); `androidx.core:core-ktx` khỏi `androidApp/build.gradle.kts` |
| test | 95 mỗi nền tảng | 105 mỗi nền tảng: 6 cho ViewModel của monitor, thêm 3 cho monitoring service, thêm 1 cho scanning service |
| `docs/checklists.md` | — | mới: cả hai checklist, kèm cách chạy mỗi hàng và cách biết nó |

## 1. Một màn hình, mọi tính năng

Appendix A.1 đòi một UI đơn giản và "đủ để điều khiển và test mọi tính năng", và phác nó thành một màn hình: bộ lọc, Scan, các thiết bị, Connect, trạng thái, dữ liệu nhận được, Disconnect. m14 có hai màn hình (bài 07): danh sách, và một màn hình thiết bị cho thiết bị bạn chạm vào. Nó còn có một tính năng không có màn hình nào: monitor, thứ bài 18 khởi động từ lần mở app và để không có nút. Đây là nơi mỗi tính năng được điều khiển trong m15:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 400" role="img" aria-labelledby="l20-screen-title">
      <title id="l20-screen-title">Nơi mỗi tính năng được điều khiển trong m15. Màn hình chính chứa trạng thái điện thoại cùng Refresh, khu monitor mới với Start, Stop và Clear, quyền Bluetooth, bộ lọc và Scan, và danh sách thiết bị. Hai ViewModel của nó gọi bốn inbound port: ViewModel danh sách gọi StatusReport, PermissionAccess và DeviceScanning; ViewModel monitor mới gọi DeviceMonitoring. Chạm vào một thiết bị mở màn hình thiết bị: Connect, các service, Read, Subscribe và Disconnect, qua ViewModel chi tiết và DeviceSession. Lần mở app, không có màn hình, cũng gọi DeviceMonitoring, để đặt monitor lại đúng như người dùng đã để.</title>
      <defs><marker id="l20-screen-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="20" y="30" width="230" height="200" rx="6"></rect>
      <text class="title" x="32" y="54">Màn hình chính</text>
      <text class="small" x="32" y="80">trạng thái điện thoại · Refresh</text>
      <text class="small" x="32" y="104">monitor: Start / Stop · Clear (mới)</text>
      <text class="small" x="32" y="128">quyền · Allow</text>
      <text class="small" x="32" y="152">bộ lọc · Scan</text>
      <text class="small" x="32" y="176">thiết bị: chạm vào một cái</text>
      <text class="small muted" x="32" y="210">mọi tính năng bắt đầu ở đây</text>
      <rect class="box" x="20" y="268" width="230" height="70" rx="6"></rect>
      <text class="title" x="32" y="292">Màn hình thiết bị</text>
      <text class="small" x="32" y="316">Connect · Read · Subscribe · Disconnect</text>
      <path class="edge dashed" d="M90,232 L90,266" marker-end="url(#l20-screen-arrow)"></path>
      <text class="small muted" x="98" y="254">một lần chạm</text>
      <rect class="box" x="20" y="356" width="230" height="34" rx="6"></rect>
      <text class="small" x="32" y="378">mở app (không màn hình)</text>
      <g data-part="inbound">
        <rect class="box" x="300" y="60" width="180" height="44" rx="6"></rect>
        <text class="small" x="312" y="87">DeviceListViewModel</text>
        <rect class="box" x="300" y="136" width="180" height="44" rx="6"></rect>
        <text class="small" x="312" y="163">MonitorViewModel (mới)</text>
        <rect class="box" x="300" y="281" width="180" height="44" rx="6"></rect>
        <text class="small" x="312" y="308">DeviceDetailViewModel</text>
        <rect class="box" x="300" y="352" width="180" height="40" rx="6"></rect>
        <text class="small" x="312" y="377">onAppLaunch()</text>
        <rect class="box" x="540" y="30" width="200" height="34" rx="6"></rect>
        <text class="small mono" x="552" y="52">StatusReport</text>
        <rect class="box" x="540" y="74" width="200" height="34" rx="6"></rect>
        <text class="small mono" x="552" y="96">PermissionAccess</text>
        <rect class="box" x="540" y="118" width="200" height="34" rx="6"></rect>
        <text class="small mono" x="552" y="140">DeviceScanning</text>
        <rect class="box" x="540" y="190" width="200" height="34" rx="6"></rect>
        <text class="small mono" x="552" y="212">DeviceMonitoring</text>
        <rect class="box" x="540" y="286" width="200" height="34" rx="6"></rect>
        <text class="small mono" x="552" y="308">DeviceSession</text>
      </g>
      <path class="edge" d="M250,90 L298,82" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M250,110 L298,156" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M250,303 L298,303" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M250,373 L298,372" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,76 L538,47" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,82 L538,91" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,88 L538,135" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,158 L538,203" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,368 L538,215" marker-end="url(#l20-screen-arrow)"></path>
      <path class="edge" d="M480,303 L538,303" marker-end="url(#l20-screen-arrow)"></path>
    </svg>
    <figcaption>Mọi tính năng bắt đầu ở màn hình chính; kết nối cách một lần chạm. Mỗi ViewModel chỉ gọi inbound port.
<ul class="legend">
    <li data-part="inbound">inbound port và adapter</li>
  </ul>
</figcaption>
  </figure>

1. **Màn hình chính là nơi mọi tính năng bắt đầu.** Trạng thái điện thoại, monitor (mới hôm nay), quyền và việc quét được điều khiển ở đó; kết nối cách một lần chạm, trên màn hình của thiết bị bạn chạm vào. Đó là nghĩa của "một màn hình điều khiển mọi tính năng" trong m15.
2. **Sao không đưa Connect lên màn hình chính?** A.1 cũng đòi "điều hướng cơ bản giữa các màn hình/khu", và một kết nối thuộc về thiết bị người dùng đã chọn: ViewModel chi tiết giữ nó, và rời màn hình thì kết thúc nó (bài 14). Đặt nó lên danh sách sẽ nghĩa là dựng lại màn hình của bài 14–16 trên bốn track. m15 giữ hai màn hình.
3. **Các phần A.1 liệt kê đều có đủ:** một nhãn chữ và một ô nhập chữ (bộ lọc), các nút, một danh sách (các thiết bị), một hình ảnh (hình Bluetooth của màn hình thiết bị), điều hướng, một chỉ báo đang tải (đang quét, đang kết nối, đang khám phá), và các thông báo trạng thái và lỗi (dòng quyền, các alert, và hôm nay là dòng báo lỗi của monitor).

## 2. Chạy các checklist trên m14

Appendix B có hai danh sách. Danh sách **đầu-cuối** là những gì một người dùng làm: mỗi đường đi của quyền, luồng BLE từ quét tới một lần mất kết nối bất ngờ, và monitor từ lúc bắt đầu tới force-kill (camera và API chỉ khi bạn đã làm phần mở rộng E1 và E2). Danh sách **refactor** là những gì một người review đọc: code nằm đâu, nó import gì, nó giải phóng gì. Cả hai là để chạy, không phải để đọc: mỗi hàng đầu-cuối là một việc bạn làm trong app, và phần lớn mục refactor biến thành một lệnh hoặc một lần đọc ngắn các file được gọi tên. `docs/checklists.md` (mục 8) ghi lại cách làm, cho mọi hàng.

Chạy trên m14, chúng tìm ra những điều này:

| Mục checklist | m14 làm gì | Sửa ở |
|---|---|---|
| Đầu-cuối: monitor start · stop. Refactor: "monitor dừng được" | Lần mở app khởi động monitor; không nút nào dừng nó, và không gì trên màn hình nói nó đang chạy | mục 3 |
| Refactor: "lỗi tới UI dưới dạng state" | `MonitorStatus.Running.lastError` được đặt khi một bản ghi không lưu được; không gì hiện nó | mục 3 |
| Đầu-cuối: monitor khởi động lại | Một lần Stop chỉ giữ được tới process tiếp theo: `onAppLaunch()` gọi `start` ở mỗi lần mở app | mục 4 |
| Refactor: "mọi quy tắc của app nằm trong một service, không trong ViewModel" | "mọi lần quét đều có giới hạn thời gian" là `DeviceListViewModel.SCAN_TIMEOUT`, trong khi timeout kết nối của session đã là của session service | mục 5 |
| Refactor: "không có dependency thừa" | `core-ktx` trong `androidApp`, thứ không file nào ở đó import; `Greeting` và `platformName()` của m00, thứ không gì gọi | mục 6 |

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/AppLaunch.kt (m14)" hl_lines="4"
private val MONITOR_INTERVAL = 15.minutes
⋯ why the launch, not a screen
fun onAppLaunch() {
    KoinPlatform.getKoin().get<DeviceMonitoring>().start(MONITOR_INTERVAL)
}
```

1. **Monitor không dừng được.** `stop()` có trên port, và bài 18 đã test nó, nhưng ngoài test không gì gọi nó. Bài 18 đã nói ("Luôn bật, tạm thời"): hôm nay là ngày nó đổi.
2. **Chỉ một nút Stop là chưa đủ.** Dòng này chạy trong mọi process mới: khi người dùng mở app, và khi Android khởi động một process cho việc định kỳ. Một người dùng đã dừng monitor sẽ thấy nó chạy lại ở lần mở app sau.
3. **Ba mục cần cân nhắc, và đều qua.** Các quy tắc trạng thái nằm trong `readStatus`, một hàm trong app core mà cả hai service trạng thái gọi (bài 18): không phải service, nhưng cũng không phải ViewModel hay adapter, và được viết một lần, đó là mục đích của mục này. `MONITOR_INTERVAL` ở lại trong các inbound adapter: port nhận chu kỳ từ bên gọi (`start(interval)` của A.7), còn một chu kỳ nghĩa là gì là việc của service. Và `SimulatedBleScanner` cùng `SimulatedBleConnection`, thứ app không còn bind, ở lại: mục 8 dùng chúng để chạy các hàng BLE khi không có radio.

## 3. Khu monitor

Monitor có ViewModel dùng chung riêng, giống nhau trên mọi track. Nó gọi một inbound port, `DeviceMonitoring`, thứ đã có sẵn mọi thứ A.7 đòi: `start`, `stop`, `status`, `logs()` và `clearLogs()`.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MonitorViewModel.kt" hl_lines="2 6 9 15"
class MonitorViewModel(private val monitoring: DeviceMonitoring) : ViewModel() {
    private val _uiState = MutableStateFlow(MonitorUiState().showing(monitoring.status.value))
⋯ uiState, logJob
    init {
        viewModelScope.launch {
            monitoring.status.collect { status ->
                _uiState.update { it.showing(status) }
                // Start, Stop, or a new record from a tick in this process: read the log again.
                refreshLog()
            }
        }
    }

    fun start() {
        monitoring.start(MONITOR_INTERVAL)
    }
⋯ stop() calls monitoring.stop(); showing(status) turns MonitorStatus into running, summary and problem
```

1. **Khung hình đầu đã đúng.** State bắt đầu từ trạng thái hiện tại của port, như của ViewModel chi tiết bắt đầu từ của session (bài 14), nên khu này không bao giờ nháy "stopped" khi monitor đang chạy.
2. **Start dùng chu kỳ của lần mở app.** `MONITOR_INTERVAL` thành `internal` trong `AppLaunch.kt`, nên hai inbound adapter khởi động monitor xin cùng 15 phút.
3. **Trạng thái kích một lần đọc log.** Mỗi lần `status` đổi (Start, Stop, một bản ghi do một nhịp trong process này lưu) thì đọc lại log, nên một bản ghi mới hiện ra mà không cần chạm.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MonitorViewModel.kt" hl_lines="2 5 9 14 21"
    fun refreshLog() {
        logJob?.cancel() // the newest read wins
        logJob = viewModelScope.launch {
            try {
                val records = monitoring.logs()
                _uiState.update {
                    it.copy(
                        recordCount = records.size,
                        newest = records.takeLast(SHOWN).reversed().map(::line),
                        problem = savingError(),
                    )
                }
            } catch (e: LogStoreException) {
                _uiState.update { it.copy(problem = e.message) }
            }
        }
    }
⋯ clearLog(): clearLogs(), then refreshLog(); a LogStoreException becomes the problem
    // "2026-09-11 10:30:00 UTC · Battery 82 % · …": the time as the log stores it, in UTC.
    private fun line(record: LogRecord): String =
        record.timestamp.toString().take(19).replace('T', ' ') + " UTC · " + describe(record.status)
```

1. **Hiện log, không hiện `lastRecord`.** `MonitorStatus` sống trong bộ nhớ, mỗi process một cái. Trên Android, một nhịp chạy khi app đang đóng đã chạy trong một process Android khởi động cho việc định kỳ (bài 19, mục 2); bản ghi của nó nằm trong file, nhưng process của màn hình nào cũng chưa từng thấy nó trong trạng thái. File là thứ còn lại lâu dài, nên khu này đọc nó: khi trạng thái đổi, và mỗi lần màn hình quay lại foreground.
2. **Lần đọc mới nhất thắng.** Hai lần đọc có thể chồng lên nhau (một nhịp và một lần quay lại foreground); huỷ lần cũ hơn giữ cho một câu trả lời cũ không tới sau cùng.
3. **Lỗi tới UI dưới dạng state.** Một bản ghi không lưu được (`lastError`, do service đặt từ bài 18) và một log không đọc hay xoá được đều kết thúc trong `problem`, thứ khu này hiện màu đỏ. Một lần đọc tốt đặt lại lỗi lưu, nếu có, để điều mới nhất bị hỏng ở lại trên màn hình cho tới khi nó ổn.
4. **Giờ theo UTC.** Log lưu `Instant.toString()`, là UTC kèm `Z` (bài 17), và code dùng chung không có thư viện múi giờ. Dòng đó ghi "UTC" thay vì giả vờ là giờ địa phương.
5. **`describe` đã dời đi.** Câu chữ trạng thái của ViewModel danh sách giờ là `StatusText.kt`, một hàm `internal` mà cả hai ViewModel gọi: hai bản sao của cùng câu chữ sẽ lệch nhau. Các test của bài 17 ghim câu chữ vẫn pass không đổi.

Các màn hình chỉ khác ở cách đặt khu này và lúc xin một lần đọc mới:

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/MonitorSection.kt" hl_lines="2 6"
    @Composable
    fun MonitorSection(viewModel: MonitorViewModel = koinViewModel()) {
        val state by viewModel.uiState.collectAsStateWithLifecycle()

        // Back in the foreground: a tick may have written records while the screen was away.
        LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
            viewModel.refreshLog()
        }

        MonitorContent(
            state = state,
            onStart = viewModel::start,
            onStop = viewModel::stop,
            onClear = viewModel::clearLog,
        )
    }
    ⋯ MonitorContent: the summary and Start or Stop, the count and Clear, the newest records, the problem
    ```

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="2 6 9"
    ⋯ in DeviceListScreen: DeviceListContent(… the m14 arguments …,
            monitor = { MonitorSection() },
        )
    ⋯ DeviceListContent's parameters, as in m14, then:
        // A slot: the screen passes the stateful MonitorSection, so this function stays stateless.
        monitor: @Composable () -> Unit,
    ) {
    ⋯ Column: the title and PhoneStatusRow, then:
            monitor()
            HorizontalDivider()
    ```

    Một **slot** là một tham số composable: tài liệu Compose gọi chúng là slot API, và các component Material như `Scaffold` và `Button` nhận nội dung theo cách đó. `DeviceListContent` vẫn không có state: nó đặt bất cứ thứ gì được đưa, và một preview hay một test có thể truyền `{}`. `koinViewModel()` gắn ViewModel của monitor vào back stack entry của danh sách, cạnh ViewModel của chính danh sách. `ON_RESUME` tới khi khu này hiện lần đầu trên một màn hình đã resume (một observer thêm vào lifecycle được đưa lên state hiện tại của nó), khi quay lại foreground, và sau Back từ màn hình thiết bị.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="1 4 5 8"
        private val monitorViewModel: MonitorViewModel by viewModel()
    ⋯ onCreateView: monitorButton calls stop() or start(), clearLogButton calls clearLog()
                viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                    launch { viewModel.uiState.collect { render(it) } }
                    launch { monitorViewModel.uiState.collect { renderMonitor(it) } }
                }
    ⋯ onResume(): refreshPermission(), refreshStatus(), and now
            monitorViewModel.refreshLog()
    ⋯ renderMonitor(state): summary, button text, count, newest lines joined with "\n", the problem
    ```

    Hai flow, hai `launch`. `collect` trên một `StateFlow` không bao giờ trả về, nên một `collect` thứ hai viết sau cái đầu bên trong `repeatOnLifecycle` sẽ không bao giờ chạy. Layout thêm một `LinearLayout` dọc, `monitorSection`, dưới hàng trạng thái, rồi một đường kẻ cao `1dp`; `filterInput` giờ nằm dưới đường kẻ. Một Fragment xin Koin ViewModel thứ hai giống như cái đầu, bằng `by viewModel()`: mỗi class một cái, cả hai gắn với Fragment.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="2 7 9"
    ⋯ in DeviceListView's body: DeviceListContent(… the m14 arguments …,
                monitor: MonitorSection()
            )
    ⋯
    // Stateless: renders whatever it's given, reports events up. Monitor is a slot: the screen
    // passes the stateful MonitorSection, so this view stays stateless.
    struct DeviceListContent<Monitor: View>: View {
    ⋯ the m14 properties
        let monitor: Monitor
    ⋯ body: VStack { PhoneStatusRow(…); monitor; Divider(); … }
    ```

    Slot của SwiftUI là một tham số view generic, như trong `VStack<Content>`: Swift suy ra `Monitor` là `MonitorSection` ở chỗ gọi. `MonitorSection` (một file mới) giữ `ViewModelOwner` riêng trong `@State`, collect `uiState` trong `.task`, và gọi `refreshLog()` khi `scenePhase` thành `.active`, như việc kiểm tra quyền của danh sách.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="4 9"
        private let owner = ViewModelOwner()
        private lazy var viewModel: DeviceListViewModel = owner.viewModel()
        // The same store holds one ViewModel per class: the monitor section's is a second one.
        private lazy var monitorViewModel: MonitorViewModel = owner.viewModel()
    ⋯ viewWillAppear: a second Task, for await state in monitorViewModel.uiState { renderMonitor(state) }
        @objc private func sceneDidActivate() {
            viewModel.refreshPermission()
            viewModel.refreshStatus()
            monitorViewModel.refreshLog()
        }
    ```

    Một `ViewModelOwner` của controller phục vụ cả hai: `ViewModelProvider` đánh khoá mỗi ViewModel theo class của nó, nên xin `MonitorViewModel` tạo một cái thứ hai trong cùng store, được clear cùng cái đầu. Khu này là một `UIStackView` dọc gồm hai hàng (tóm tắt và Start/Stop; số lượng và Clear) và hai nhãn nhiều dòng, đặt sau hàng trạng thái, rồi một đường kẻ một point. `viewDidDisappear` huỷ cả hai task quan sát.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Cùng khu đó và cùng ViewModel đó. Compose truyền khu này vào nội dung không state dưới dạng một slot, và khu này tự xin Koin ViewModel của nó; Fragment XML sở hữu cả hai ViewModel và tự render cả hai state, trong hai bên collect. Cả hai làm mới log khi resume.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    SwiftUI cho khu này view riêng và `ViewModelOwner` riêng, truyền vào nội dung của danh sách dưới dạng một slot generic. UIKit giữ một controller và một owner, với một ViewModel thứ hai từ cùng store và một hàm render thứ hai. Cả hai đọc lại log khi scene thành active.

!!! warning "Gotcha · "Monitor running" mà không có bản ghi"
    Sau Start, Android ghi một bản ghi trong vài giây: một periodic work request mới chạy ngay. iOS ghi bản đầu cả một chu kỳ sau Start, vì bộ hẹn giờ foreground chờ một chu kỳ trước nhịp đầu (bài 19, mục 3). Cả hai đều đúng, và cả hai theo các hàng của bảng hành vi: "một bản ghi ngay sau lần mở đầu" của Android (việc mới chạy ngay) và bản ghi đầu "một chu kỳ sau khi app thành active" của iOS. Một tester bấm Start trên iPhone và thấy "Records in the log: 0" trong 15 phút chưa tìm ra bug nào.

## 4. Một lần Stop giữ được lâu

Stop phải sống lâu hơn process đã nghe nó. State của monitor sống trong bộ nhớ; lịch sống trong nền tảng (cơ sở dữ liệu của WorkManager trên Android, không có gì cả trên iOS khi app ở foreground); và mọi process mới chạy `onAppLaunch()`. Nên lựa chọn của người dùng cần một chỗ ở sống qua process, và lần mở app cần đọc nó:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MonitoringService.kt" hl_lines="3 8 14 16"
    override fun start(interval: Duration) {
        require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
        settings.setStoppedByUser(false)
        run(interval)
    }

    override fun stop() {
        settings.setStoppedByUser(true)
        scheduler.cancel()
        _status.value = MonitorStatus.Stopped
    }

    // A monitor the user never stopped runs from the first launch on; a stopped one stays stopped.
    override fun restore(interval: Duration) {
        require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
        if (!settings.isStoppedByUser()) run(interval)
    }
⋯ run(interval): status Running, scheduler.schedule(interval) { tick() }; tick() as in m13
```

1. **Quy tắc là của service:** một lần Stop giữ tới khi Start, và một monitor chưa ai dừng thì chạy. `restore` là một thành viên mới của inbound port, được `onAppLaunch()` gọi một lần mỗi process thay cho `start`.
2. **"Chưa bao giờ chọn" nghĩa là đang chạy.** Điều đó giữ hành vi của m14, nên mọi hàng của bảng hành vi bài 19 vẫn đúng, kể cả "một bản ghi ngay sau lần mở đầu" trên Android.
3. **Một lần mở app khi đã dừng không lên lịch gì.** Trên Android, `cancel()` của Stop đã gỡ việc định kỳ, nên không process nào được khởi động cho nó; một lần người dùng mở app sau đó để trạng thái là `Stopped` và không trao nhịp cho ai. Trên iOS, không bộ hẹn giờ nào khởi động và không refresh request nào được gửi.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 300" role="img" aria-labelledby="l20-restore-title">
      <title id="l20-restore-title">Mọi process mới làm gì với monitor trong m15. Một process khởi động: người dùng mở app, Android khởi động nó cho việc của monitor, hoặc iOS mở nó ở nền. Phần khởi động app gọi initKoin, rồi onAppLaunch, thứ gọi restore với 15 phút trên DeviceMonitoring. Monitoring service hỏi outbound port MonitorSettings lần chạm cuối của người dùng có phải Stop không. Các adapter của nó đọc SharedPreferences trên Android và UserDefaults trên iOS. Nếu không, monitor chạy: trạng thái Running, và nhịp được trao cho scheduler. Nếu có, nó vẫn dừng và không gì được lên lịch. Các nút Start và Stop ghi câu trả lời qua cùng port đó.</title>
      <defs><marker id="l20-restore-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="20" y="30" width="170" height="80" rx="6"></rect>
      <text class="small" x="30" y="54">một process mới:</text>
      <text class="small muted" x="30" y="74">người dùng mở,</text>
      <text class="small muted" x="30" y="94">hoặc khởi động cho việc định kỳ</text>
      <g data-part="inbound">
        <rect class="box" x="230" y="30" width="150" height="80" rx="6"></rect>
        <text class="small mono" x="240" y="58">onAppLaunch()</text>
        <text class="small muted" x="240" y="82">restore(15 min)</text>
        <rect class="box" x="230" y="200" width="150" height="70" rx="6"></rect>
        <text class="small" x="240" y="228">Start / Stop</text>
        <text class="small muted" x="240" y="250">MonitorViewModel</text>
      </g>
      <g data-part="core">
        <rect class="box" x="420" y="30" width="150" height="80" rx="6"></rect>
        <text class="small mono" x="430" y="58">MonitoringService</text>
        <text class="small muted" x="430" y="82">người dùng đã dừng?</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="420" y="200" width="150" height="70" rx="6"></rect>
        <text class="small mono" x="430" y="228">MonitorSettings</text>
        <text class="small muted" x="430" y="250">SharedPrefs · UserDefaults</text>
      </g>
      <rect class="box" x="610" y="20" width="130" height="50" rx="6"></rect>
      <text class="small" x="620" y="42">không: Running,</text>
      <text class="small muted" x="620" y="60">nhịp được lên lịch</text>
      <rect class="box" x="610" y="90" width="130" height="50" rx="6"></rect>
      <text class="small" x="620" y="112">có: Stopped,</text>
      <text class="small muted" x="620" y="130">không gì được lên lịch</text>
      <path class="edge" d="M190,70 L228,70" marker-end="url(#l20-restore-arrow)"></path>
      <path class="edge" d="M380,70 L418,70" marker-end="url(#l20-restore-arrow)"></path>
      <path class="edge" d="M495,110 L495,198" marker-end="url(#l20-restore-arrow)"></path>
      <path class="edge" d="M570,60 L608,46" marker-end="url(#l20-restore-arrow)"></path>
      <path class="edge" d="M570,84 L608,112" marker-end="url(#l20-restore-arrow)"></path>
      <path class="edge dashed" d="M380,235 L418,235" marker-end="url(#l20-restore-arrow)"></path>
      <text class="small muted" x="20" y="292">Đứt: qua inbound port và service, thứ ghi câu trả lời.</text>
    </svg>
    <figcaption>Mọi process hỏi cùng một câu lúc mở app; chỉ Start và Stop đổi câu trả lời.
<ul class="legend">
    <li data-part="inbound">inbound adapter</li>
    <li data-part="core">app core</li>
    <li data-part="outbound">outbound port và adapter</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MonitorSettings.kt" hl_lines="4 6 9"
// Outbound port: where the app keeps the user's Stop, so that it outlives the process. One
// adapter per platform: SharedPreferences on Android (Kotlin in androidMain), UserDefaults on iOS
// (Swift in the iOS app).
interface MonitorSettings {
    // True if the user's last tap was Stop; false before any tap, and after Start.
    fun isStoppedByUser(): Boolean

    // Keeps the answer for every later launch.
    fun setStoppedByUser(stopped: Boolean)
}
```

1. **Một port, vì việc lưu trữ là của nền tảng.** Công thức của bài 10 cho một khả năng của nền tảng: một outbound port theo cách nói của app, mỗi nền tảng một adapter. Port lưu một sự thật (lần chạm cuối là Stop); service quyết định nó nghĩa là gì.
2. **Một `Boolean` trơn, false cho tới khi được đặt,** nên các adapter không cần trường hợp "không có": SharedPreferences trả về giá trị mặc định bạn truyền "nếu khoá không có", và `UserDefaults.bool(forKey:)` trả về "`false` nếu khoá không có trong cơ sở dữ liệu defaults". Nó cũng đi qua Swift dưới dạng `Bool`; một `Boolean?` của Kotlin sẽ tới thành `KotlinBoolean?` (bài 17).
3. **Không suspend.** Lần mở app phải biết câu trả lời trước khi worker của Android đọc nhịp: `MonitorWorker` lấy `currentTick` khi nó chạy, và thời điểm duy nhất chắc chắn tới trước đó là `Application.onCreate` (bài 18). Một lần đọc suspend sẽ phải xong sau, trong một coroutine, nơi một worker có thể chạy trước và không thấy nhịp nào, hoặc chặn main thread cho tới khi xong.

=== "Compose"

    ```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorSettings.kt" hl_lines="2 4 8"
    class AndroidMonitorSettings(context: Context) : MonitorSettings {
        private val preferences = context.getSharedPreferences("monitor", Context.MODE_PRIVATE)

        override fun isStoppedByUser(): Boolean = preferences.getBoolean(STOPPED_BY_USER, false)

        override fun setStoppedByUser(stopped: Boolean) {
            // apply() changes the value in memory now and writes the file in the background.
            preferences.edit().putBoolean(STOPPED_BY_USER, stopped).apply()
        }
    ⋯ STOPPED_BY_USER = "stoppedByUser"
    ```

    Code dùng chung, nên giống nhau trên cả hai track Android; `DeviceMonitorApplication` truyền `AndroidMonitorSettings(this)` vào `initKoin`. Hướng dẫn của Android: "`apply()` đổi object `SharedPreferences` trong bộ nhớ ngay lập tức nhưng ghi các cập nhật xuống đĩa một cách bất đồng bộ", trong khi `commit()` là đồng bộ và "bạn nên tránh gọi nó từ main thread". Cùng hướng dẫn đó khuyên dùng **DataStore**: "một giải pháp lưu trữ dữ liệu hiện đại mà bạn nên dùng thay cho `SharedPreferences`", thứ "dùng coroutine và Flow của Kotlin để lưu dữ liệu bất đồng bộ". Đó là mặc định đúng cho cài đặt của một app; ở đây một giá trị duy nhất phải được đọc đồng bộ trong `Application.onCreate` (ý 6), đúng thứ SharedPreferences cung cấp. Trên emulator, sau Stop, `adb shell run-as com.example.devicemonitor cat shared_prefs/monitor.xml` hiện `<boolean name="stoppedByUser" value="true" />`.

=== "XML"

    Adapter cài đặt của Android là code dùng chung trong `androidMain`, giống như trên track Compose (chuyển Android sang Compose để xem đoạn trích của nó), và `DeviceMonitorApplication`, thứ cả hai track Android dùng chung, truyền `AndroidMonitorSettings(this)` vào `initKoin`.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/IosMonitorSettings.swift" hl_lines="3 7 11"
    // Outbound adapter: the user's Stop, behind the Kotlin MonitorSettings port, kept in
    // UserDefaults, which outlives the process. bool(forKey:) is false for a key never set.
    final class IosMonitorSettings: MonitorSettings {
        private let key = "monitorStoppedByUser"

        func isStoppedByUser() -> Bool {
            UserDefaults.standard.bool(forKey: key)
        }

        func setStoppedByUser(stopped: Bool) {
            UserDefaults.standard.set(stopped, forKey: key)
        }
    }
    ```

    Một adapter Swift, như các adapter iOS của khoá học vẫn là trừ khi có lý do khác: các kiểu của port đi qua gọn gàng, một `Bool` mỗi chiều. (Scheduler của bài 18 là Kotlin trong `iosMain` vì `Duration` và lambda `suspend` của nó không đi qua gọn được; kho log của bài 17 là ví dụ Kotlin/Native duy nhất được lên kế hoạch của khoá học.) Apple: hệ thống defaults "là một kho lưu bền cho cài đặt riêng của app và toàn hệ thống", và "Khi bạn ghi giá trị vào một object `UserDefaults`, object cập nhật bản trong bộ nhớ ngay lập tức, và ghi giá trị xuống đĩa một cách bất đồng bộ": cùng hình dạng với `apply()`. Phần khởi động app truyền `IosMonitorSettings()` vào `doInitKoin`; chạy `xcodegen generate` để project có file mới.

=== "UIKit"

    Adapter Swift, `IosMonitorSettings.swift`, là một file cho cả hai track iOS (chuyển iOS sang SwiftUI để xem đoạn trích của nó). `didFinishLaunchingWithOptions` của `AppDelegate` truyền `IosMonitorSettings()` vào `doInitKoin`; chạy `xcodegen generate` để project có file mới.


!!! warning "Gotcha · hỏi nền tảng thay vào"
    Trên Android rất dễ muốn bỏ cài đặt và hỏi WorkManager xem việc có còn được lên lịch không. iOS không có gì để hỏi: ở foreground lịch là một coroutine trong process, và refresh request bị huỷ khi app đang active. Câu trả lời cũng sẽ khác nhau theo nền tảng, và quy tắc sẽ dời vào hai adapter. Một port, một quy tắc trong service, một sự thật mỗi nền tảng.

## 5. Một quy tắc ra khỏi ViewModel: giới hạn thời gian quét

Bài 13 đặt giới hạn 10 giây quanh việc collect của ViewModel danh sách, kèm comment "Một radio thật làm hao pin khi quét, nên mọi lần quét đều có giới hạn thời gian." Bài 10 và 13 giữ nó ở đó như hành vi của màn hình này: một màn hình chờ bao lâu. Lý do trong comment rộng hơn thế: một lần quét làm hao pin dù màn hình nào bắt đầu nó, nên "mọi lần quét" là một quy tắc của app, và một màn hình thứ hai có quét sẽ phải nhớ chép nó. Timeout kết nối của session đã là của session service từ bài 14. Timeout quét dời vào service của nó:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanningService.kt" hl_lines="6 16"
    override fun scan(nameFilter: String): Flow<Device> = flow {
        checkReady()
        val wanted = nameFilter.trim()
        val seen = mutableSetOf<String>()
        // The timeout cancels the radio's collection, which stops the radio, and the Flow completes.
        withTimeoutOrNull(SCAN_TIMEOUT) {
            scanner.scan().collect { device ->
⋯ named, matching the filter, not seen yet: emit(device)
            }
        }
    }
⋯ checkReady(), as in m08
    companion object {
        // A real radio drains the battery while it scans, so every scan has a time limit,
        // whichever screen starts it.
        val SCAN_TIMEOUT = 10.seconds
    }
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt" hl_lines="3 7"
            try {
                // The scan ends by itself after its time limit (the scanning service's rule).
                scanning.scan(filter).collect { device ->
                    found += device
                    _uiState.update { it.copy(scan = ScanState.Scanning(found.toList())) }
                }
                _uiState.update { it.copy(scan = ScanState.Finished(found.toList())) }
            } catch (e: ScanException) {
```

1. **Cùng cơ chế, xuống một tầng.** `withTimeoutOrNull` huỷ khối của nó khi hết giờ và trả về `null` thay vì ném lỗi. Huỷ khối thì huỷ việc collect `BleScanner.scan()`, việc đó dừng radio trong `awaitClose` của adapter (bài 13), và Flow của service sau đó kết thúc bình thường.
2. **ViewModel chỉ chờ tới hết.** Khi Flow kết thúc, `collect` trả về và state thành `Finished`, như trước. Stop vẫn huỷ job của ViewModel, và việc huỷ đi xuống theo cùng đường đó. Trên emulator, với radio giả lập, năm thiết bị hiện ra và "Devices found: 5" tới 10 giây sau Scan, như ở m14.
3. **Port nói rõ điều đó.** Comment của `DeviceScanning.scan` giờ ghi "Lần quét tự kết thúc sau 10 giây, và Flow kết thúc; huỷ bên collect thì dừng nó sớm hơn." Bên gọi học quy tắc từ port, không từ một ViewModel.
4. **Test dời theo quy tắc.** `ScanningServiceTest` có thêm `aScanEndsByItselfAtTheTimeLimitAndStopsTheRadio` (10 s thời gian ảo, rồi `awaitComplete()` và radio giả đã dừng), và test cũ chờ "một giờ thời gian ảo" cho một lần quét không bao giờ kết thúc giờ chờ 5 giây. Test timeout của ViewModel danh sách thành `showsDevicesAsTheyArriveThenFinishesWhenTheScanEnds`: `TestDeviceScanning` có thêm `finish()`, thứ kết thúc lần quét như service sẽ làm.

## 6. Không gì thừa

Gradle đặt một dependency đã khai báo lên classpath dù bạn có dùng nó hay không, và Kotlin không cảnh báo về một class public không ai gọi. Một lần tìm kiếm thì cảnh báo được:

```text
grep -rn 'import androidx.core' androidApp/src                # nothing: core-ktx isn't used here
grep -rn 'Greeting\|platformName' shared androidApp iosApp \
  --include='*.kt' --include='*.swift'                        # only their own declarations
```

1. **`androidx.core:core-ktx`** đi kèm project Android từ bài 05, và không file nào trong `androidApp` import gì từ `androidx.core`, trên cả hai track Android. Gỡ dòng đó không gỡ thư viện: `androidx.activity` và các thư viện khác phụ thuộc vào nó, nên nó vẫn tới, ở version mà chúng xin (`dependencyInsight` hiện 1.18.0 thay vì 1.19.1 mà dòng đó xin). Cả hai app build và chạy y như cũ. `androidMain` của module dùng chung có dùng `androidx.core` (`ContextCompat`, `ActivityCompat`), và lấy nó qua dependency `androidx.activity` của chính nó.
2. **`Greeting` và `platformName()`** là "Hello from shared Kotlin" của m00 (bài 05). Các màn hình thôi hiện chúng từ bài 06. Xoá `Greeting.kt`, `Platform.kt`, `Platform.android.kt` và `Platform.ios.kt`; bài học về `expect`/`actual` vẫn ở lại trong bài 05.
3. **Cái gì ở lại.** `SimulatedBleScanner`, `SimulatedBleConnection` và `SampleDevices` không được app bind, nhưng chúng có được dùng: mục 8 thay chúng vào để chạy các hàng BLE khi không có radio. Một file được giữ có chủ ý thì nói lý do trong comment; các file này có.

## 7. Test

105 test mỗi nền tảng, tăng từ 95. Các test mới và đã đổi:

| Class | Test | Cái gì mới |
|---|---|---|
| `MonitorViewModelTest` | 6 (mới) | state đầu từ port; Start và Stop qua port; ba bản ghi mới nhất, mới nhất trước, kèm số lượng; một bản ghi mới trong process này đọc lại log; Clear; một lỗi hiện cho tới khi có gì đó ổn |
| `MonitoringServiceTest` | 10 (trước là 7) | `aFirstLaunchRunsTheMonitor`, `aStopLastsAcrossLaunches`, `startAfterAStopLastsAcrossLaunchesToo` |
| `ScanningServiceTest` | 9 (trước là 8) | `aScanEndsByItselfAtTheTimeLimitAndStopsTheRadio` |
| `DeviceListViewModelTest` | 10 | test timeout kết thúc lần quét bằng `finish()` |
| `AppModuleTest` | 3 | `buildsEveryViewModel` cũng dựng `MonitorViewModel`; platform module nhận một `FakeMonitorSettings` |

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/MonitoringServiceTest.kt" hl_lines="3 12 13 17"
    // A new process: a new service over the same settings and log. timer is what that process
    // asks the platform for.
    private fun launch(timer: FakeMonitorScheduler = scheduler): DeviceMonitoring =
        MonitoringService(battery, network, bluetooth, connection, log, timer, settings, clock)
⋯
    @Test
    fun aStopLastsAcrossLaunches() {
        monitor.restore(15.minutes)
        monitor.stop()
        assertTrue(settings.stopped)

        val timer = FakeMonitorScheduler()
        val next = launch(timer)
        next.restore(15.minutes)

        assertEquals(MonitorStatus.Stopped, next.status.value)
        assertEquals(null, timer.interval) // nothing scheduled
    }
```

Một lần mở app, trong test, là một service thứ hai dựng trên cùng các fake: cài đặt và log sống lâu hơn process, bộ nhớ của service thì không. Test không kết thúc được một process, nhưng nó dựng được những gì một process mới dựng. `FakeMonitorSettings` là một `Boolean`; `TestDeviceMonitoring` đóng vai cả app core cho các test của ViewModel, như `TestDeviceScanning` làm cho danh sách.

!!! warning "Gotcha · một property và một method cùng tên trên JVM"
    `FakeMonitorSettings` đầu tiên của chúng tôi có `var stoppedByUser` cạnh `setStoppedByUser(stopped)` của port. Bản build test JVM fail: "Platform declaration clash: The following declarations have the same JVM signature (setStoppedByUser(Z)V)". Một `var` Kotlin tên `stoppedByUser` có setter JVM tên `setStoppedByUser`. Bản build iOS không có xung đột đó, đó là lý do `allTests` chạy cả hai. Property của fake tên là `stopped`.

## 8. Lần chạy đầu-cuối, và các checklist trong project

Khi đã sửa xong, chạy danh sách đầu-cuối từ đầu. Các hàng BLE cần một peripheral; emulator và Simulator không có radio nào nghe được nó (bài 13). App core không quan tâm cái gì đứng sau outbound port của nó, nên cho lần chạy này, thay vào radio và liên kết giả lập của bài 10–16. Đó là mục "thay một adapter là một dòng" của danh sách refactor, dùng thật: hai dòng trong mỗi phần khởi động app.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt (for the run only)" hl_lines="3 4"
            initKoin(
                permissionChecker = permissionChecker,
                bleScanner = com.example.devicemonitor.adapter.outbound.SimulatedBleScanner(),
                bleConnection = com.example.devicemonitor.adapter.outbound.SimulatedBleConnection(),
    ⋯ the other six adapters, as in m15
    ```

=== "XML"

    Cùng hai dòng trong `DeviceMonitorApplication.kt`, thứ cả hai track Android dùng chung: `bleScanner = com.example.devicemonitor.adapter.outbound.SimulatedBleScanner()` và `bleConnection = com.example.devicemonitor.adapter.outbound.SimulatedBleConnection()`.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift (for the run only)" hl_lines="3 4"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: SimulatedBleScanner(),
                bleConnection: SimulatedBleConnection(),
    ⋯ the other six adapters, as in m15
    ```

=== "UIKit"

    Cùng hai tham số trong lời gọi `doInitKoin` của `AppDelegate.swift`: `bleScanner: SimulatedBleScanner()` và `bleConnection: SimulatedBleConnection()`.


Rồi đặt các adapter thật trở lại: `git diff` cho thấy không còn gì trong phần khởi động app. Những gì chúng tôi thấy, trên emulator API 36 (Compose) và Simulator iOS 26.2 (SwiftUI):

| Hàng | Chúng tôi đã làm gì | Chúng tôi thấy gì |
|---|---|---|
| quyền: kiểm tra, xin, từ chối, thử lại | Android, cài mới chưa cấp gì: Allow Bluetooth, Don't allow, Ask again, Don't allow | "needs Bluetooth permission" + Allow Bluetooth; hộp thoại hệ thống; "was denied" + Ask again; hộp thoại lần nữa; "is off. You can turn it on in Settings." + Open Settings. Simulator luôn báo Bluetooth được phép (bài 12), nên các hàng iOS chờ một iPhone |
| BLE: quét | giả lập, Scan với bộ lọc rỗng | năm thiết bị theo thứ tự được nghe thấy; "Devices found: 5" khi hết 10 giây |
| BLE: kết nối, khám phá, đọc | OBD-II Adapter, Connect, Read trên `2A19` | "Status: connected", bốn service; "82 %" dưới battery level |
| BLE: đăng ký, nhận | Subscribe trên `2A19` | Unsubscribe thế chỗ, và giá trị dưới nó đổi khoảng mỗi giây khi pin giả lập cạn dần |
| BLE: ngắt kết nối, kết nối lại | Unsubscribe, Disconnect, Connect | "Status: not connected", service biến mất; lại "Status: connected" |
| BLE: mất kết nối bất ngờ | Back, Tire Pressure Sensor, Connect, chờ 20 s | "Connection failed": "The link to Tire Pressure Sensor was lost (simulated)." |
| monitor: bắt đầu | cài mới, mở app | Android: "Monitor running, about every 15 min", "Records in the log: 1" và dòng của nó, trong vòng 10 s. iOS: đang chạy, 0 bản ghi; bản ghi đầu một chu kỳ sau khi bộ hẹn giờ bắt đầu (ở lần chạy UIKit của chúng tôi, 15 phút sau Start, hiện trên màn hình không cần chạm) |
| monitor: dừng | Stop | "Monitor stopped"; Android: job của chúng tôi biến mất khỏi `dumpsys jobscheduler`, và `stoppedByUser` là true trong `shared_prefs/monitor.xml` |
| monitor: khởi động lại | Android: Home, `am kill`, mở app (pid mới). iOS: terminate, mở app | vẫn "Monitor stopped", không job, không bản ghi mới. Start: đang chạy; Android ghi một bản ghi ngay và job quay lại với `TIME=+14m49s` |
| monitor: nền, quay lại, hệ điều hành kết thúc, force-kill | các lần chạy của bài 19 | không đổi: m15 chỉ đổi việc một lần mở app làm sau một lần Stop. Các hàng của `docs/monitor-behaviour.md` vẫn đúng |

Hai danh sách vào project, cạnh bảng hành vi, thành một file team chạy trước một lần phát hành. Mỗi hàng nói cách chạy nó và cách biết nó, với cùng các từ "Seen on" như `monitor-behaviour.md`:

```markdown title="docs/checklists.md" hl_lines="5 6 13"
⋯ title, when to run them, how to read "Seen on", and how to swap in the simulated adapters
| Row | What to do | Expect | Seen on |
|---|---|---|---|
⋯ the permission and BLE rows
| Monitor: stop | Stop | "Monitor stopped"; Android: no job left (adb shell dumpsys jobscheduler); no more records | emulator, Simulator |
| Monitor: restart | After Stop, end the process and open the app again | Still "Monitor stopped". Start: running again | emulator, Simulator |
⋯ the monitor's other rows point at monitor-behaviour.md
## Refactor

| Item | How to check | m15 |
|---|---|---|
⋯ the UI, ViewModels, the app core's imports
| Rules live in services | Read the ViewModels and adapters for decisions that aren't about the screen or the platform | yes, after moving the scan's time limit into ScanningService |
⋯ the other items, each with its command or the files to read
```

1. **Lệnh ở chỗ có lệnh.** "App core không import framework nào" là một `grep` phải không tìm thấy gì; "ViewModel chỉ gọi inbound port" là một cái khác. Người review chạy chúng trong vài giây; việc đọc để dành cho các mục không lệnh nào phán xét được.
2. **Cột m15 nói cái gì đã đổi.** "yes, after …" ghi lại bốn phát hiện, để người đọc sau biết mục đó đã được kiểm tra, không phải được giả định.
3. **Hàng điện thoại vẫn mở.** Như trong bảng hành vi, một hàng chỉ điện thoại cho thấy được ghi "phone, not yet run" cho tới khi bạn chạy nó trên máy của mình.

!!! warning "Gotcha · phát hành kèm radio giả lập"
    Việc thay compile, chạy và pass mọi test, nên không gì ngăn nó lọt vào một bản phát hành ngoài bạn. Trước khi commit, `grep -n Simulated androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt iosApp/iosApp/iOSApp.swift` (hoặc `AppDelegate.swift`) phải không tìm thấy gì. Một team hay thay thì biến nó thành một build flavour hay một launch argument; cho một lần chạy trước khi phát hành, hai dòng và một `git diff` là đủ.

## 9. Thực tế xảy ra gì: các lần chạy đứng sau trang này

Chúng tôi build m15 trên cả bốn track (Kotlin 2.4.20, Koin 4.2.2, WorkManager 2.12.0, Xcode 26.2). `allTests` pass 105 trên 105 trên JVM và 105 trên 105 trên iOS simulator, và không bản build nào in cảnh báo compiler từ code của chúng ta. Trên emulator API 36, cả hai track Android đi qua các hàng monitor của mục 8 (cài mới: đang chạy và một bản ghi; Stop: đã dừng và không job; `am kill` và mở app: vẫn dừng; Start: một bản ghi ngay; Clear: "Records in the log: 0"); app Compose còn chạy các hàng quyền và BLE giả lập. Trên Simulator iOS 26.2, một XCUITest tạm điều khiển cả hai track iOS qua đang chạy, Stop, terminate và mở app (vẫn dừng), và Start; mỗi track sau đó ghi bản ghi đầu 15 phút sau Start, và khu này hiện nó không cần chạm. App SwiftUI còn chạy các hàng BLE giả lập.

**m15 là một điểm dừng tự nhiên** khi test pass trên cả hai nền tảng, mọi hàng emulator và Simulator của `docs/checklists.md` khớp với những gì bạn thấy, các adapter BLE thật đã quay lại trong cả hai phần khởi động app, và mọi hàng điện thoại hoặc đã được chạy trên điện thoại của bạn, hoặc vẫn ghi "phone, not yet run". Đó là Native Device Monitor lõi hoàn chỉnh. Hãy commit nó, và gắn tag.

!!! question "Hỏi agent của bạn"
    Nhờ agent đi qua danh sách refactor từng mục trên project m15 của bạn và cho thấy, với mỗi mục, lệnh nó đã chạy hay các dòng nó đã đọc, và kết luận của nó. Rồi hỏi nó mục nào khó phán xét nhất, và vì sao.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Một người dùng bấm Stop, rồi mở app sáng hôm sau. Trong m14 chỉ thêm một nút Stop, không đổi gì khác, họ sẽ thấy gì?</p>
<div class="opts">
<button class="opt">monitor vẫn dừng: <code>stop()</code> huỷ lịch của nền tảng vĩnh viễn</button>
<button class="opt" data-correct>monitor chạy lại: <code>onAppLaunch()</code> gọi <code>start</code> trong mọi process mới</button>
<button class="opt">crash: scheduler không có nhịp nào</button>
</div>
<p class="feedback"></p>
<p class="why">Bộ nhớ của service kết thúc cùng process, và lần mở app khởi động nó lại. m15 giữ lần Stop của người dùng trong <code>MonitorSettings</code> và gọi <code>restore</code>.</p>
</div>

<div class="quiz">
<p class="q">Quy tắc "một lần Stop giữ tới khi Start; một monitor chưa ai dừng thì chạy" nằm ở đâu trong m15?</p>
<div class="opts">
<button class="opt">trong hai adapter cài đặt, thứ mặc định trả "running"</button>
<button class="opt">trong <code>onAppLaunch()</code>, thứ kiểm tra cài đặt trước khi khởi động</button>
<button class="opt" data-correct>trong <code>MonitoringService.restore</code>; các adapter chỉ lưu lần chạm cuối có phải Stop không</button>
</div>
<p class="feedback"></p>
<p class="why">Adapter giữ sự thật; service áp quy tắc. Một <code>Boolean</code> trơn, false cho tới khi được đặt, không cần quy tắc nào trong adapter.</p>
</div>

<div class="quiz">
<p class="q">Vì sao khu monitor đọc file log thay vì hiện <code>MonitorStatus.Running.lastRecord</code>?</p>
<div class="opts">
<button class="opt">đọc file nhanh hơn collect một <code>StateFlow</code></button>
<button class="opt" data-correct><code>MonitorStatus</code> nằm trong bộ nhớ, mỗi process một cái; bản ghi ghi trong một process Android khởi động cho việc định kỳ chỉ có trong file</button>
<button class="opt"><code>lastRecord</code> là private của service</button>
</div>
<p class="feedback"></p>
<p class="why">File là thứ còn lại lâu dài (bài 18). Khu này đọc nó khi trạng thái đổi và mỗi lần màn hình quay lại.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>MonitorSettings.isStoppedByUser()</code> phải trả lời đồng bộ?</p>
<div class="opts">
<button class="opt">interface Kotlin không thể có hàm <code>suspend</code> mà Swift implement</button>
<button class="opt">DataStore không có trên iOS</button>
<button class="opt" data-correct>lần mở app phải trao nhịp cho scheduler trong <code>Application.onCreate</code>, trước khi worker của WorkManager đọc nó; một lần đọc bất đồng bộ có thể xong quá muộn</button>
</div>
<p class="feedback"></p>
<p class="why">Swift implement được hàm <code>suspend</code> của Kotlin (<code>__request</code> của bài 12), và DataStore có bản Kotlin Multiplatform. Lý do là thứ tự các sự kiện trong một process Android khởi động cho việc định kỳ.</p>
</div>

<div class="quiz">
<p class="q">Sau khi giới hạn thời gian quét dời vào <code>ScanningService</code>, ViewModel danh sách biết lần quét đã kết thúc bằng cách nào?</p>
<div class="opts">
<button class="opt">nó bắt một <code>TimeoutCancellationException</code></button>
<button class="opt" data-correct>Flow kết thúc, nên <code>collect</code> trả về và dòng tiếp theo đặt <code>Finished</code></button>
<button class="opt">service bật một cờ mà ViewModel hỏi định kỳ</button>
</div>
<p class="feedback"></p>
<p class="why"><code>withTimeoutOrNull</code> trả về <code>null</code> thay vì ném lỗi, và khối của flow builder sau đó kết thúc: một lần kết thúc bình thường.</p>
</div>

<div class="quiz">
<p class="q">Gỡ <code>androidx.core:core-ktx</code> khỏi <code>androidApp/build.gradle.kts</code>: chuyện gì xảy ra với <code>androidx.core</code> trong app?</p>
<div class="opts">
<button class="opt">nó biến mất, và <code>ContextCompat</code> trong các adapter dùng chung thôi compile được</button>
<button class="opt" data-correct>nó ở lại, qua các thư viện phụ thuộc vào nó, ở version mà chúng xin</button>
<button class="opt">Gradle giữ version mà dòng bị gỡ đã xin</button>
</div>
<p class="feedback"></p>
<p class="why"><code>dependencyInsight</code> hiện <code>androidx.core:core:1.18.0</code>, từ <code>androidx.activity</code> và các thư viện khác, trong khi dòng đó đã xin 1.19.1. "Thừa" nghĩa là không gì trong module đó import nó.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">ViewModel của khu monitor được Koin dựng, như các cái khác. Cái gì fail, và khi nào, nếu bạn quên <code>viewModelOf(::MonitorViewModel)</code>? (Bài 11)</p>
<div class="opts">
<button class="opt">module dùng chung không compile</button>
<button class="opt" data-correct>app compile và crash khi màn hình chính xin ViewModel lần đầu; test graph (<code>buildsEveryViewModel</code>) bắt được nó trước</button>
<button class="opt">Koin vẫn dựng được nó, bằng reflection</button>
</div>
<p class="feedback"></p>
<p class="why">Koin giải lúc chạy. Đó là lý do test graph xin mọi ViewModel, và vì sao bản m15 của nó xin cả cái mới.</p>
</div>

<div class="quiz">
<p class="q">Trong Fragment XML, vì sao mỗi <code>collect</code> có <code>launch</code> riêng bên trong <code>repeatOnLifecycle</code>? (Bài 01 và 08)</p>
<div class="opts">
<button class="opt">một Fragment chỉ được collect một Flow mỗi coroutine</button>
<button class="opt" data-correct>collect một <code>StateFlow</code> không bao giờ kết thúc, nên một <code>collect</code> thứ hai sau cái đầu sẽ không bao giờ bắt đầu</button>
<button class="opt">để chạy hai lần render trên hai thread khác nhau</button>
</div>
<p class="feedback"></p>
<p class="why">Một <code>StateFlow</code> là nóng và không bao giờ kết thúc; <code>collect</code> treo cho tới khi coroutine của nó bị huỷ, thứ <code>repeatOnLifecycle</code> làm khi Fragment dừng.</p>
</div>

<div class="quiz">
<p class="q">Cho lần chạy đầu-cuối không có radio, bạn truyền <code>SimulatedBleScanner()</code> vào <code>initKoin</code>. Code nào đổi ngoài phần khởi động app? (Bài 10 và 11)</p>
<div class="opts">
<button class="opt">scanning service, thứ phải bỏ qua kiểm tra quyền</button>
<button class="opt">ViewModel danh sách, thứ phải biết các thiết bị là giả lập</button>
<button class="opt" data-correct>không gì cả: service và ViewModel thấy cùng port <code>BleScanner</code></button>
</div>
<p class="feedback"></p>
<p class="why">Đó là lý do có outbound port. Kiểm tra quyền vẫn chạy, qua <code>PermissionChecker</code>, thứ vẫn là thật.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên project m15 của bạn)"
    1. **Đoán, rồi chạy.** Trên emulator: Stop, rồi `adb shell am force-stop com.example.devicemonitor`, rồi mở app. Ghi ra khu này hiện gì, `dumpsys jobscheduler` có liệt kê job của chúng ta không, và WorkManager có ghi "Application was force-stopped, rescheduling." không. Rồi kiểm tra. Phần nào của mục 4 giải thích mỗi câu trả lời?
    2. **Câu chữ trong ViewModel.** Các màn hình tự dựng "Records in the log: N", trên mọi track. Dời câu chữ vào `MonitorUiState` (chẳng hạn một `logSummary` ghi "The log is empty" khi là 0), dùng nó trên các track của bạn, và ghim cả hai câu bằng một test trong `MonitorViewModelTest`.
    3. **Thêm một kiểm tra thành lệnh.** Chọn một mục refactor mà `docs/checklists.md` trả lời bằng cách đọc, và tìm một `grep` sẽ bắt được cách dễ phá nó nhất. Thêm nó vào file, và chạy nó.
    4. **Trên điện thoại của bạn**: chạy các hàng "phone, not yet run" của `docs/checklists.md` với adapter thật và LightBlue (brief cho agent liệt kê chúng là các kiểm tra trên thiết bị), và ghi tên điện thoại và phiên bản hệ điều hành vào mỗi hàng bạn đã chạy.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, đi qua `docs/checklists.md` từng hàng, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html" -o .course/lesson-20.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 18 and 19, which this lesson builds on; skipped if they're already there:
  [ -f .course/lesson-18.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/18-background-monitor.html" -o .course/lesson-18.html
  [ -f .course/lesson-19.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/19-background-behaviour-table.html" -o .course/lesson-19.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 20 (Integration and end-to-end check): build milestone m15 on top of m14: a monitor
section on the main screen (MonitorViewModel over the DeviceMonitoring port: running or stopped,
Start/Stop, how many records the log holds, the newest three, Clear, and what went wrong); a Stop
that lasts across launches (a new outbound port, MonitorSettings, with AndroidMonitorSettings
over SharedPreferences in androidMain and IosMonitorSettings over UserDefaults in Swift;
DeviceMonitoring.restore(interval), which onAppLaunch() now calls instead of start); the scan's
10-second limit moved from DeviceListViewModel into ScanningService; the status wording moved
into adapter/inbound/StatusText.kt; m00's Greeting and platformName() deleted, and core-ktx
removed from androidApp/build.gradle.kts; and docs/checklists.md.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m14 project in demo/ (Lesson 19). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/outbound/MonitorSettings.kt, adapter/inbound/StatusText.kt,
       adapter/inbound/MonitorUiState.kt, adapter/inbound/MonitorViewModel.kt
     replaced: core/inbound/DeviceMonitoring.kt, core/MonitoringService.kt,
       core/inbound/DeviceScanning.kt, core/ScanningService.kt, adapter/inbound/AppLaunch.kt,
       adapter/inbound/DeviceListViewModel.kt, di/AppModule.kt
     deleted: Greeting.kt, Platform.kt
   deleted: shared/src/androidMain/kotlin/com/example/devicemonitor/Platform.android.kt and
     shared/src/iosMain/kotlin/com/example/devicemonitor/Platform.ios.kt
   add: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorSettings.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: doubles/FakeMonitorSettings.kt, doubles/TestDeviceMonitoring.kt,
       adapter/inbound/MonitorViewModelTest.kt
     replaced: doubles/TestDeviceScanning.kt, core/MonitoringServiceTest.kt,
       core/ScanningServiceTest.kt, adapter/inbound/DeviceListViewModelTest.kt, di/AppModuleTest.kt
   add: docs/checklists.md
   Every other file in shared/ and docs/ stays as in m14, shared/build.gradle.kts included.

2. Android, both tracks: androidApp/src/main/java/com/example/devicemonitor/android/
   DeviceMonitorApplication.kt: replaced; androidApp/build.gradle.kts: replaced with my track's
   (each drops only the core-ktx line).
     Compose: DeviceListScreen.kt: replaced; add MonitorSection.kt (same folder).
     XML: DeviceListFragment.kt and androidApp/src/main/res/layout/fragment_device_list.xml:
       replaced.
   iOS, both tracks: add iosApp/iosApp/IosMonitorSettings.swift, then run `xcodegen generate` in
   iosApp/ (after adding every new Swift file) so the Xcode project includes it. project.yml stays
   as in m14. Do NOT edit Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift and DeviceListView.swift: replaced; add MonitorSection.swift.
     UIKit: AppDelegate.swift and DeviceListViewController.swift: replaced.
   Every other Android and iOS file stays as in m14, including both device screens.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), a fresh install:
     adb uninstall com.example.devicemonitor
     adb install androidApp/build/outputs/apk/debug/androidApp-debug.apk
     adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_SCAN
     adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_CONNECT
     adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl uninstall booted com.example.devicemonitor` (a fresh install), then
     `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`, then
     `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 105 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 10 in MonitoringServiceTest, 9 in
  ScanningServiceTest, 8 in ValueDecoderTest, 6 in MonitorViewModelTest, 5 in StatusServiceTest,
  4 in JsonLinesTest, 4 in PermissionServiceTest, 3 in DeviceServiceTest, 3 in AppModuleTest,
  1 in SessionConnectionStatusTest, and 5 in AndroidLogStoreTest (JVM results) or 5 in
  IosLogStoreTest (iOS results). Show the counts from the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- The refactor list's commands, each finding nothing:
    grep -rn 'import android\.\|import platform\.\|import org.koin\|import io.ktor\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core
    grep -n 'core.outbound\|adapter.outbound\|import android\.\|import platform\.' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/*.kt
    grep -rn 'Greeting\|platformName\|SCAN_TIMEOUT\|withTimeout' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter androidApp/src iosApp/iosApp
    grep -rn 'core-ktx\|import androidx.core' androidApp/build.gradle.kts androidApp/src
  and grep -n 'core.inbound' shared/src/commonMain/kotlin/com/example/devicemonitor/core/*Service.kt
  prints exactly five lines, each service importing only its own port.
- Android emulator (API 31+), my track, after the fresh install above (find text with
  `adb shell uiautomator dump`; the XML buttons show STOP, START, CLEAR in capitals, so match
  case-insensitively):
  1. Within 10 s of launch: "Monitor running, about every 15 min", "Records in the log: 1", and
     one line that starts with today's date (UTC) and " UTC · Battery ". adb shell run-as
     com.example.devicemonitor cat files/status-log.jsonl prints one record.
  2. Tap Stop: "Monitor stopped". adb shell dumpsys jobscheduler | grep 'JobStatus{.*devicemonitor'
     prints nothing, and adb shell run-as com.example.devicemonitor cat shared_prefs/monitor.xml
     shows <boolean name="stoppedByUser" value="true" />.
  3. adb shell input keyevent KEYCODE_HOME; wait 3 s; adb shell am kill com.example.devicemonitor;
     adb shell pidof com.example.devicemonitor prints nothing; launch again with am start (a new
     pid): "Monitor stopped", still one record, still no job.
  4. Tap Start: within 10 s "Monitor running, about every 15 min", "Records in the log: 2", two
     lines, newest first; the dumpsys grep shows our job with TIME=+14m… or a little less.
  5. Tap Clear: "Records in the log: 0", no record lines, and Clear disabled. (In the Compose track's
     uiautomator dump the label text always reads enabled="true"; the disabled flag is on the
     clickable android.view.View around it, so read that node's enabled attribute.)
  6. Permission rows: adb uninstall, adb install (no pm grant), launch: "Device Monitor needs
     Bluetooth permission to find nearby devices." Tap Allow Bluetooth, then Don't allow in the
     system dialog: "Bluetooth permission was denied. Scanning needs it to find nearby devices."
     and Ask again. Tap Ask again, Don't allow: "Bluetooth permission is off. You can turn it on
     in Settings." and Open Settings. Then grant both permissions with pm grant.
  7. BLE rows with the simulated adapters: in DeviceMonitorApplication.kt, change only the two
     lines shown in the lesson's section 8 (bleScanner, bleConnection), build, install, launch.
     Scan with an empty filter: five devices (OBD-II Adapter, Heart Rate Monitor, Tire Pressure
     Sensor, Thermometer, Smart Scale), then "Devices found: 5" about 10 s after Scan. Tap
     OBD-II Adapter, Connect: "Status: connected" and four services. Read on the first
     characteristic (00002A19-…): "82 %". Subscribe on it: Unsubscribe appears and the value
     changes about every second. Unsubscribe, Disconnect: "Status: not connected" and no
     services; Connect: "Status: connected". Back, tap Tire Pressure Sensor, Connect, wait 20 s:
     an alert "Connection failed" with "The link to Tire Pressure Sensor was lost (simulated)."
     Then put the two lines back, rebuild and reinstall; git diff on DeviceMonitorApplication.kt
     against the lesson's full file shows nothing.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  1. After the fresh install: static texts "Monitor running, about every 15 min" and "Records in
     the log: 0", a Stop button, and a Clear button that is not enabled.
  2. Tap Stop: "Monitor stopped" and a Start button. Terminate the app and launch it again:
     "Monitor stopped". Tap Start: "Monitor running, about every 15 min".
  3. Leave the app in the foreground. 15 to 16 minutes after Start: "Records in the log: 1" and
     one line that starts with today's date (UTC) and " UTC · Battery unknown · ", with no tap.
  4. BLE rows with the simulated adapters: in my track's app start (iOSApp.swift or
     AppDelegate.swift), change only the bleScanner and bleConnection arguments as in the
     lesson's section 8, build, install, launch, and repeat Android check 7's BLE steps (scan,
     connect, read, subscribe, unsubscribe, disconnect, connect, unexpected disconnect). Then put
     the real adapters back, rebuild, and show that the file matches the lesson's full file.
- Device checks (list them for me, don't try to run them), on a physical Android phone and an
  iPhone on my track, with the real adapters and LightBlue as in Lesson 13:
  1. BLE end-to-end: scan, connect, discover, read, subscribe and receive a notification,
     disconnect, reconnect, and an unexpected disconnect (stop the virtual device in LightBlue);
     expect what docs/checklists.md's BLE rows say.
  2. iPhone permission rows: fresh install, no prompt until Allow Bluetooth; Don't Allow:
     "Bluetooth permission is off. You can turn it on in Settings." and Open Settings; Settings →
     Device Monitor → Bluetooth on, back to the app: "Bluetooth permission: allowed".
  3. Monitor on a phone: Stop, lock the phone for an hour: no new records (on Android, no job in
     dumpsys jobscheduler); unlock, open the app: still "Monitor stopped". Start: running again.
  4. The phone rows of docs/monitor-behaviour.md (Lesson 19), unchanged by m15.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me, for each refactor item in docs/checklists.md, the command you ran or the
lines you read.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Appendix B](https://phongna-inn.github.io/carmd-kmp-course/COURSE_PLAN.md) của kế hoạch khoá học (hai checklist; nguồn chính) và Appendix A.1 (UI phải có gì).
- Android: [Save simple data with SharedPreferences](https://developer.android.com/training/data-storage/shared-preferences) (nguồn chính: `apply()` và `commit()`, và lời lưu ý khuyên dùng DataStore) và [DataStore](https://developer.android.com/topic/libraries/architecture/datastore) ("dùng coroutine và Flow của Kotlin để lưu dữ liệu bất đồng bộ"; nó cũng có bản cài đặt cho Kotlin Multiplatform).
- Apple: [UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults) (nguồn chính: một kho lưu bền cho cài đặt, ghi vào bộ nhớ ngay và xuống đĩa bất đồng bộ) và [bool(forKey:)](https://developer.apple.com/documentation/foundation/userdefaults/bool(forkey:)) (`false` cho một khoá không có).
- Compose: [Compose layout basics](https://developer.android.com/develop/ui/compose/layouts/basics#slot-based-layouts), phần "Slot-based layouts". Kotlin: [withTimeoutOrNull](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout-or-null.html) (trả về `null` thay vì ném lỗi).
- Gradle: [Viewing and debugging dependencies](https://docs.gradle.org/current/userguide/viewing_debugging_dependencies.html) (`dependencyInsight`, cho câu hỏi "thư viện này tới từ đâu?").
- [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): các quy tắc đặt chỗ mà danh sách refactor kiểm tra, và test graph của Koin.
- Kinh nghiệm thực tế: tag [kotlin-multiplatform](https://stackoverflow.com/questions/tagged/kotlin-multiplatform) của Stack Overflow; kênh #multiplatform của Kotlin Slack cho câu hỏi về cách tổ chức một app KMP khi nó lớn lên.

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Đã xoá: `shared/src/commonMain/kotlin/com/example/devicemonitor/Greeting.kt`, `…/Platform.kt`, `shared/src/androidMain/kotlin/com/example/devicemonitor/Platform.android.kt` và `shared/src/iosMain/kotlin/com/example/devicemonitor/Platform.ios.kt`. `iosApp/iosApp.xcodeproj` được sinh lại bởi `xcodegen generate`; `shared/build.gradle.kts`, các build file gốc, cả hai manifest, `project.yml` và cả hai màn hình thiết bị giữ như ở m14. File chỉ một track có nằm trong tab của track đó; khi hai track cùng sửa một file cùng đường dẫn, tiêu đề của nó ghi tên track.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceMonitoring.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.MonitorStatus
    import kotlinx.coroutines.flow.StateFlow
    import kotlin.time.Duration

    // Inbound port: what the app offers for watching the phone over time. MonitoringService
    // implements it; the app's launch (adapter/inbound/AppLaunch.kt), the monitor's ViewModel and
    // the tests call it.
    interface DeviceMonitoring {
        // Starts the monitor, or changes its interval: about every interval, as often as the
        // platform allows, it reads the phone's status and appends it to the log.
        fun start(interval: Duration)

        // Stops the monitor, until start(). The log is kept.
        fun stop()

        // Called once per process, at launch: puts the monitor back as the user left it. Running, at
        // this interval, unless the user's last tap was Stop.
        fun restore(interval: Duration)

        // Stopped, or running with its newest reading and error.
        val status: StateFlow<MonitorStatus>

        // Every record in the log, oldest first.
        suspend fun logs(): List<LogRecord>

        // Removes every record from the log.
        suspend fun clearLogs()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MonitorSettings.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    // Outbound port: where the app keeps the user's Stop, so that it outlives the process. One
    // adapter per platform: SharedPreferences on Android (Kotlin in androidMain), UserDefaults on iOS
    // (Swift in the iOS app).
    interface MonitorSettings {
        // True if the user's last tap was Stop; false before any tap, and after Start.
        fun isStoppedByUser(): Boolean

        // Keeps the answer for every later launch.
        fun setStoppedByUser(stopped: Boolean)
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
    import com.example.devicemonitor.core.outbound.MonitorSettings
    import com.example.devicemonitor.core.outbound.NetworkProvider
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlin.time.Clock
    import kotlin.time.Duration

    // Service: the background monitor's rules. Each tick reads the phone's status through Lesson 17's
    // four status ports (ConnectionStatus included, never the session), stamps it with the time,
    // and appends it to the log. When it runs is the scheduler's business, not this class's. Whether
    // it runs after a launch is the user's: a Stop lasts until Start.
    class MonitoringService(
        private val battery: BatteryProvider,
        private val network: NetworkProvider,
        private val bluetooth: BluetoothProvider,
        private val connection: ConnectionStatus,
        private val log: LogStore,
        private val scheduler: MonitorScheduler,
        private val settings: MonitorSettings,
        private val clock: Clock = Clock.System,
    ) : DeviceMonitoring {
        private val _status = MutableStateFlow<MonitorStatus>(MonitorStatus.Stopped)
        override val status: StateFlow<MonitorStatus> = _status.asStateFlow()

        override fun start(interval: Duration) {
            require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
            settings.setStoppedByUser(false)
            run(interval)
        }

        override fun stop() {
            settings.setStoppedByUser(true)
            scheduler.cancel()
            _status.value = MonitorStatus.Stopped
        }

        // A monitor the user never stopped runs from the first launch on; a stopped one stays stopped.
        override fun restore(interval: Duration) {
            require(interval.isPositive()) { "The monitor's interval must be positive, not $interval." }
            if (!settings.isStoppedByUser()) run(interval)
        }

        override suspend fun logs(): List<LogRecord> = log.read()

        override suspend fun clearLogs() = log.clear()

        private fun run(interval: Duration) {
            _status.value = MonitorStatus.Running(interval)
            scheduler.schedule(interval) { tick() }
        }

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

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceScanning.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Inbound port: what the app offers for finding devices. Inbound adapters (the shared
    // ViewModels) call it, and ScanningService implements it.
    interface DeviceScanning {
        // Named devices whose name contains nameFilter, each reported once, as they are found.
        // Collecting starts a scan. The scan ends by itself after 10 seconds, and the Flow completes;
        // cancelling the collector stops it sooner. Throws ScanException, also before the scan
        // starts: no permission, no radio, or Bluetooth off.
        fun scan(nameFilter: String): Flow<Device>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanningService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.withTimeoutOrNull
    import kotlin.time.Duration.Companion.seconds

    // Service: the app's scan rules on top of a raw radio scan. Start the radio only when the
    // permission is granted and the radio is there and on. Then keep the devices that have a
    // name containing the filter (ignoring case and surrounding spaces), and report each once,
    // for at most SCAN_TIMEOUT.
    class ScanningService(
        private val scanner: BleScanner,
        private val permissions: PermissionChecker,
    ) : DeviceScanning {
        override fun scan(nameFilter: String): Flow<Device> = flow {
            checkReady()
            val wanted = nameFilter.trim()
            val seen = mutableSetOf<String>()
            // The timeout cancels the radio's collection, which stops the radio, and the Flow completes.
            withTimeoutOrNull(SCAN_TIMEOUT) {
                scanner.scan().collect { device ->
                    val named = device.name.isNotBlank()
                    if (named && device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                        emit(device)
                    }
                }
            }
        }

        // In this order: on iOS, the radio's first use is what shows the permission prompt.
        private suspend fun checkReady() {
            if (permissions.check(Permission.Bluetooth) != PermissionStatus.Granted) {
                throw ScanException("Scanning needs the Bluetooth permission.")
            }
            if (!scanner.isAvailable()) throw ScanException("This phone has no Bluetooth LE radio.")
            if (!scanner.isEnabled()) throw ScanException("Bluetooth is off. Turn it on, then scan again.")
        }

        companion object {
            // A real radio drains the battery while it scans, so every scan has a time limit,
            // whichever screen starts it.
            val SCAN_TIMEOUT = 10.seconds
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
    // repeating background work, used on both platforms, at launch and by the Start button.
    internal val MONITOR_INTERVAL = 15.minutes

    // Inbound adapter: the app's launch. Both app starts call this once per process, right after
    // initKoin: on every launch, including the ones the OS makes in the background to run the
    // monitor, which never show a screen. Each new process needs the monitor put back as the user
    // left it, its tick handed to the scheduler again if it runs, and a screen is the wrong place
    // for that: it may never appear, and it goes away while the app keeps running.
    fun onAppLaunch() {
        KoinPlatform.getKoin().get<DeviceMonitoring>().restore(MONITOR_INTERVAL)
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/StatusText.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.DeviceStatus

    // The phone's status as one line of text, the same on every track: the list screen's status
    // line and each record the monitor section shows. Words for the screen, so an inbound adapter's
    // business, written once.
    internal fun describe(s: DeviceStatus): String {
        val battery = s.battery?.let { "Battery $it %" } ?: "Battery unknown"
        val wifi = when {
            s.wifiEnabled == false -> "Wi-Fi off"
            s.wifiConnected -> "Wi-Fi connected"
            s.wifiEnabled == true -> "Wi-Fi on, not connected"
            else -> "Wi-Fi not connected"
        }
        val cellular = if (s.cellularAvailable) "cellular available" else "no cellular"
        val bluetooth = when (s.bluetoothEnabled) {
            true -> "Bluetooth on"
            false -> "Bluetooth off"
            null -> "Bluetooth unknown"
        } + if (s.bluetoothConnected) ", device connected" else ""
        return listOf(battery, wifi, cellular, bluetooth).joinToString(" · ")
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.inbound.StatusReport
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the screen's events into calls on the DeviceScanning, PermissionAccess
    // and StatusReport ports, and the results into UI state. It knows the ports only.
    class DeviceListViewModel(
        private val scanning: DeviceScanning,
        private val permissions: PermissionAccess,
        private val statusReport: StatusReport,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(
            DeviceListUiState(bluetooth = permissions.status(Permission.Bluetooth)),
        )
        val uiState: StateFlow<DeviceListUiState> = _uiState.asStateFlow()

        private var scanJob: Job? = null
        private var permissionJob: Job? = null
        private var statusJob: Job? = null

        fun startScan(filter: String) {
            if (scanJob?.isActive == true) return
            _uiState.update { it.copy(scan = ScanState.Scanning(emptyList())) }
            scanJob = viewModelScope.launch {
                val found = mutableListOf<Device>()
                try {
                    // The scan ends by itself after its time limit (the scanning service's rule).
                    scanning.scan(filter).collect { device ->
                        found += device
                        _uiState.update { it.copy(scan = ScanState.Scanning(found.toList())) }
                    }
                    _uiState.update { it.copy(scan = ScanState.Finished(found.toList())) }
                } catch (e: ScanException) {
                    _uiState.update { it.copy(scan = ScanState.Idle, errorMessage = e.message) }
                }
            }
        }

        // The Stop button. Cancelling the scan's coroutine cancels its collection, which stops the
        // service's scan and the radio. The devices found so far stay on screen.
        fun stopScan() {
            val job = scanJob ?: return
            if (!job.isActive) return
            job.cancel()
            _uiState.update { state ->
                val scan = state.scan
                if (scan is ScanState.Scanning) state.copy(scan = ScanState.Finished(scan.found)) else state
            }
        }

        fun errorShown() {
            _uiState.update { it.copy(errorMessage = null) }
        }

        // The screen calls this each time it comes back to the foreground: the user may have
        // changed the permission in Settings meanwhile.
        fun refreshPermission() {
            if (permissionJob?.isActive == true) return
            _uiState.update { it.copy(bluetooth = permissions.status(Permission.Bluetooth)) }
        }

        fun requestPermission() {
            if (permissionJob?.isActive == true) return
            permissionJob = viewModelScope.launch {
                val result = permissions.request(listOf(Permission.Bluetooth))
                _uiState.update { it.copy(bluetooth = result.getValue(Permission.Bluetooth)) }
            }
        }

        fun openSettings() {
            permissions.openSettings()
        }

        // The screen calls this when it appears, when the app comes back to the foreground, and from
        // its Refresh button: each call reads the status again.
        fun refreshStatus() {
            if (statusJob?.isActive == true) return
            statusJob = viewModelScope.launch {
                val current = statusReport.current()
                _uiState.update { it.copy(phoneStatus = describe(current)) } // StatusText.kt
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MonitorUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    // Everything the monitor section of the main screen shows.
    data class MonitorUiState(
        val running: Boolean = false,
        // "Monitor stopped", or "Monitor running, about every 15 min".
        val summary: String = "Monitor stopped",
        // How many records the log holds, and the newest few as text, newest first.
        val recordCount: Int = 0,
        val newest: List<String> = emptyList(),
        // The newest thing that went wrong: a reading that couldn't be saved, or a log that couldn't
        // be read or cleared. Shown under the log until the next one goes right.
        val problem: String? = null,
    )
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MonitorViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.MonitorStatus
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the monitor section's Start, Stop and Clear into calls on the
    // DeviceMonitoring port, and the monitor's status and log into UI state. It knows the port only.
    class MonitorViewModel(private val monitoring: DeviceMonitoring) : ViewModel() {
        private val _uiState = MutableStateFlow(MonitorUiState().showing(monitoring.status.value))
        val uiState: StateFlow<MonitorUiState> = _uiState.asStateFlow()

        private var logJob: Job? = null

        init {
            viewModelScope.launch {
                monitoring.status.collect { status ->
                    _uiState.update { it.showing(status) }
                    // Start, Stop, or a new record from a tick in this process: read the log again.
                    refreshLog()
                }
            }
        }

        fun start() {
            monitoring.start(MONITOR_INTERVAL)
        }

        fun stop() {
            monitoring.stop()
        }

        // The status says only what this process saw. The log file is what lasts: records a tick
        // wrote in another process (Android starts one for the work when the app isn't running) or
        // while the screen was away. The screen calls this each time it comes back to the foreground.
        fun refreshLog() {
            logJob?.cancel() // the newest read wins
            logJob = viewModelScope.launch {
                try {
                    val records = monitoring.logs()
                    _uiState.update {
                        it.copy(
                            recordCount = records.size,
                            newest = records.takeLast(SHOWN).reversed().map(::line),
                            problem = savingError(),
                        )
                    }
                } catch (e: LogStoreException) {
                    _uiState.update { it.copy(problem = e.message) }
                }
            }
        }

        fun clearLog() {
            viewModelScope.launch {
                try {
                    monitoring.clearLogs()
                    refreshLog()
                } catch (e: LogStoreException) {
                    _uiState.update { it.copy(problem = e.message) }
                }
            }
        }

        private fun MonitorUiState.showing(status: MonitorStatus): MonitorUiState = when (status) {
            MonitorStatus.Stopped -> copy(running = false, summary = "Monitor stopped", problem = null)
            is MonitorStatus.Running -> copy(
                running = true,
                summary = "Monitor running, about every ${status.interval.inWholeMinutes} min",
                problem = status.lastError,
            )
        }

        // Why the newest tick's record couldn't be saved, if it couldn't.
        private fun savingError(): String? = (monitoring.status.value as? MonitorStatus.Running)?.lastError

        // "2026-09-11 10:30:00 UTC · Battery 82 % · …": the time as the log stores it, in UTC.
        private fun line(record: LogRecord): String =
            record.timestamp.toString().take(19).replace('T', ' ') + " UTC · " + describe(record.status)

        companion object {
            // How many records the section shows.
            const val SHOWN = 3
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
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
    import com.example.devicemonitor.core.outbound.MonitorSettings
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
        // The monitor reads the same four status ports, writes to the log store, and keeps the
        // user's Stop in the settings.
        single<DeviceMonitoring> { MonitoringService(get(), get(), get(), get(), get(), get(), get()) }
        viewModelOf(::DeviceListViewModel)
        viewModelOf(::DeviceDetailViewModel)
        viewModelOf(::MonitorViewModel)
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
        monitorSettings: MonitorSettings,
    ) = module {
        single { permissionChecker }
        single { bleScanner }
        single { bleConnection }
        single { batteryProvider }
        single { networkProvider }
        single { bluetoothProvider }
        single { logStore }
        single { monitorScheduler }
        single { monitorSettings }
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
        monitorSettings: MonitorSettings,
    ) {
        startKoin {
            modules(
                appModule,
                platformModule(
                    permissionChecker, bleScanner, bleConnection, batteryProvider, networkProvider, bluetoothProvider,
                    logStore, monitorScheduler, monitorSettings,
                ),
            )
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorSettings.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.content.Context
    import com.example.devicemonitor.core.outbound.MonitorSettings

    // Outbound adapter: the user's Stop, kept in SharedPreferences, a small key-value file in the
    // app's private storage that outlives the process. Read synchronously: Application.onCreate must
    // know the answer before WorkManager runs the monitor's work in that process.
    class AndroidMonitorSettings(context: Context) : MonitorSettings {
        private val preferences = context.getSharedPreferences("monitor", Context.MODE_PRIVATE)

        override fun isStoppedByUser(): Boolean = preferences.getBoolean(STOPPED_BY_USER, false)

        override fun setStoppedByUser(stopped: Boolean) {
            // apply() changes the value in memory now and writes the file in the background.
            preferences.edit().putBoolean(STOPPED_BY_USER, stopped).apply()
        }

        private companion object {
            const val STOPPED_BY_USER = "stoppedByUser"
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeMonitorSettings.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.outbound.MonitorSettings

    // Fake: an outbound adapter written for tests, behind the MonitorSettings port: one Boolean, as
    // the platform's storage would keep it. A test that builds a second service with the same fake
    // plays a new launch: a new process, the same settings.
    class FakeMonitorSettings : MonitorSettings {
        var stopped = false

        override fun isStoppedByUser(): Boolean = stopped

        override fun setStoppedByUser(stopped: Boolean) {
            this.stopped = stopped
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestDeviceMonitoring.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.MonitorStatus
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlin.time.Duration

    // Test implementation of the DeviceMonitoring inbound port, for ViewModel tests. The test sets
    // the status and the log, can make the next read or clear fail, and sees what was asked.
    class TestDeviceMonitoring : DeviceMonitoring {
        override val status = MutableStateFlow<MonitorStatus>(MonitorStatus.Stopped)
        val records = mutableListOf<LogRecord>()
        var failNextLogs: String? = null
        var failNextClear: String? = null
        var reads = 0
            private set

        override fun start(interval: Duration) {
            status.value = MonitorStatus.Running(interval)
        }

        override fun stop() {
            status.value = MonitorStatus.Stopped
        }

        override fun restore(interval: Duration) = start(interval)

        override suspend fun logs(): List<LogRecord> {
            reads++
            failNextLogs?.let {
                failNextLogs = null
                throw LogStoreException(it)
            }
            return records.toList()
        }

        override suspend fun clearLogs() {
            failNextClear?.let {
                failNextClear = null
                throw LogStoreException(it)
            }
            records.clear()
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestDeviceScanning.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.emitAll
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.flow.receiveAsFlow

    // Test implementation of the DeviceScanning inbound port. It stands in for the whole app
    // core, so a ViewModel test tests the ViewModel only. The test decides what a scan finds.
    class TestDeviceScanning : DeviceScanning {
        private val found = Channel<Device>(Channel.UNLIMITED)
        var failure: ScanException? = null
        val filters = mutableListOf<String>() // one entry per scan started
        var isScanning = false
            private set

        override fun scan(nameFilter: String): Flow<Device> = flow {
            filters += nameFilter
            failure?.let { throw it }
            isScanning = true
            try {
                emitAll(found.receiveAsFlow())
            } finally {
                isScanning = false
            }
        }

        fun find(vararg devices: Device) {
            devices.forEach { found.trySend(it) }
        }

        // The scan ends by itself, as the service's ends at its time limit.
        fun finish() {
            found.close()
        }
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
    import com.example.devicemonitor.doubles.FakeMonitorSettings
    import com.example.devicemonitor.doubles.FakeNetworkProvider
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
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
        private val settings = FakeMonitorSettings()
        private val clock = object : Clock {
            var now = Instant.parse("2026-09-11T10:30:00Z")
            override fun now() = now
        }

        // Through the inbound port, as the app's launch and the monitor's ViewModel call it.
        private val monitor: DeviceMonitoring = launch()

        // A new process: a new service over the same settings and log. timer is what that process
        // asks the platform for.
        private fun launch(timer: FakeMonitorScheduler = scheduler): DeviceMonitoring =
            MonitoringService(battery, network, bluetooth, connection, log, timer, settings, clock)

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

        @Test
        fun aFirstLaunchRunsTheMonitor() {
            monitor.restore(15.minutes)

            assertEquals(15.minutes, scheduler.interval)
            assertEquals(MonitorStatus.Running(15.minutes), monitor.status.value)
        }

        @Test
        fun aStopLastsAcrossLaunches() {
            monitor.restore(15.minutes)
            monitor.stop()
            assertTrue(settings.stopped)

            val timer = FakeMonitorScheduler()
            val next = launch(timer)
            next.restore(15.minutes)

            assertEquals(MonitorStatus.Stopped, next.status.value)
            assertEquals(null, timer.interval) // nothing scheduled
        }

        @Test
        fun startAfterAStopLastsAcrossLaunchesToo() {
            monitor.stop()
            monitor.start(15.minutes)
            assertFalse(settings.stopped)

            val next = launch()
            next.restore(15.minutes)

            assertEquals(MonitorStatus.Running(15.minutes), next.status.value)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/ScanningServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import app.cash.turbine.test
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.doubles.FakeBleScanner
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.ExperimentalCoroutinesApi
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertIs
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.seconds

    class ScanningServiceTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val heart = Device(id = "02", name = "Heart Rate Monitor", rssi = -61)
        private val scale = Device(id = "03", name = "Smart Scale", rssi = -85)
        private val nameless = Device(id = "04", name = "", rssi = -70)

        private val radio = FakeBleScanner()
        private val os = FakePermissionChecker().apply {
            statuses[Permission.Bluetooth] = PermissionStatus.Granted
        }

        // The test drives the app core the way the ViewModel does: through the inbound port.
        private val scanning: DeviceScanning = ScanningService(radio, os)

        @Test
        fun reportsEachDeviceOnceAsSoonAsItIsHeard() = runTest {
            scanning.scan(nameFilter = "").test {
                radio.hear(obd, heart, obd)
                assertEquals(obd, awaitItem())
                assertEquals(heart, awaitItem())

                radio.hear(scale, heart)
                assertEquals(scale, awaitItem())
            }
        }

        @Test
        fun keepsOnlyNamesContainingTheFilterIgnoringCaseAndSpaces() = runTest {
            scanning.scan(nameFilter = "  MONITOR ").test {
                radio.hear(obd, heart, scale)
                assertEquals(heart, awaitItem())
            }
        }

        @Test
        fun skipsDevicesThatAdvertiseNoName() = runTest {
            scanning.scan(nameFilter = "").test {
                radio.hear(nameless, obd)
                assertEquals(obd, awaitItem())
            }
        }

        @Test
        fun eachScanStartsWithNothingSeen() = runTest {
            scanning.scan(nameFilter = "").test {
                radio.hear(obd)
                assertEquals(obd, awaitItem())
            }
            scanning.scan(nameFilter = "").test {
                radio.hear(obd)
                assertEquals(obd, awaitItem())
            }
        }

        @Test
        fun scansUntilTheCollectorCancelsThenStopsTheRadio() = runTest {
            val collector = launch { scanning.scan(nameFilter = "").collect {} }

            testScheduler.advanceTimeBy(5.seconds) // virtual time, with nothing heard
            assertTrue(radio.isScanning)

            collector.cancelAndJoin()
            assertFalse(radio.isScanning)
        }

        @OptIn(ExperimentalCoroutinesApi::class) // currentTime
        @Test
        fun aScanEndsByItselfAtTheTimeLimitAndStopsTheRadio() = runTest {
            scanning.scan(nameFilter = "").test {
                radio.hear(obd)
                assertEquals(obd, awaitItem())

                awaitComplete() // nothing else is heard: 10 s of virtual time pass
            }
            assertEquals(ScanningService.SCAN_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
            assertFalse(radio.isScanning)
        }

        @Test
        fun aRadioFailureReachesTheCaller() = runTest {
            radio.failure = ScanException("The scan failed (Android error 2).")

            scanning.scan(nameFilter = "").test {
                val error = awaitError()
                assertIs<ScanException>(error)
                assertEquals("The scan failed (Android error 2).", error.message)
            }
        }

        @Test
        fun neverStartsTheRadioWithoutThePermission() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Denied

            scanning.scan(nameFilter = "").test {
                assertEquals("Scanning needs the Bluetooth permission.", awaitError().message)
            }
            assertEquals(0, radio.scansStarted)
        }

        @Test
        fun neverStartsTheRadioWhenItIsMissingOrOff() = runTest {
            radio.available = false
            scanning.scan(nameFilter = "").test {
                assertEquals("This phone has no Bluetooth LE radio.", awaitError().message)
            }

            radio.available = true
            radio.enabled = false
            scanning.scan(nameFilter = "").test {
                assertEquals("Bluetooth is off. Turn it on, then scan again.", awaitError().message)
            }
            assertEquals(0, radio.scansStarted)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/MonitorViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.MonitorStatus
    import com.example.devicemonitor.doubles.TestDeviceMonitoring
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.ExperimentalCoroutinesApi
    import kotlinx.coroutines.test.StandardTestDispatcher
    import kotlinx.coroutines.test.resetMain
    import kotlinx.coroutines.test.runTest
    import kotlinx.coroutines.test.setMain
    import kotlin.test.AfterTest
    import kotlin.test.BeforeTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertNull
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.minutes
    import kotlin.time.Instant

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain
    class MonitorViewModelTest {
        private val monitoring = TestDeviceMonitoring()
        private lateinit var viewModel: MonitorViewModel

        private fun record(time: String, battery: Int) = LogRecord(
            Instant.parse(time),
            DeviceStatus(
                battery = battery, wifiEnabled = true, wifiConnected = true, cellularAvailable = false,
                bluetoothEnabled = true, bluetoothConnected = false,
            ),
        )

        @BeforeTest
        fun setUp() {
            Dispatchers.setMain(StandardTestDispatcher())
            viewModel = MonitorViewModel(monitoring)
        }

        @AfterTest
        fun tearDown() {
            Dispatchers.resetMain()
        }

        @Test
        fun startsFromThePortsStatus() {
            monitoring.status.value = MonitorStatus.Running(15.minutes)

            val fresh = MonitorViewModel(monitoring)

            assertTrue(fresh.uiState.value.running)
            assertEquals("Monitor running, about every 15 min", fresh.uiState.value.summary)
        }

        @Test
        fun startAndStopGoThroughThePort() = runTest {
            viewModel.start()
            testScheduler.runCurrent()
            assertEquals(MonitorStatus.Running(MONITOR_INTERVAL), monitoring.status.value)
            assertTrue(viewModel.uiState.value.running)

            viewModel.stop()
            testScheduler.runCurrent()
            assertFalse(viewModel.uiState.value.running)
            assertEquals("Monitor stopped", viewModel.uiState.value.summary)
        }

        @Test
        fun showsTheNewestRecordsNewestFirstAndHowManyThereAre() = runTest {
            monitoring.records += listOf(
                record("2026-09-11T10:00:00Z", 85),
                record("2026-09-11T10:15:00Z", 84),
                record("2026-09-11T10:30:00Z", 83),
                record("2026-09-11T10:45:00Z", 82),
            )

            viewModel.refreshLog()
            testScheduler.runCurrent()

            assertEquals(4, viewModel.uiState.value.recordCount)
            assertEquals(
                listOf(
                    "2026-09-11 10:45:00 UTC · Battery 82 % · Wi-Fi connected · no cellular · Bluetooth on",
                    "2026-09-11 10:30:00 UTC · Battery 83 % · Wi-Fi connected · no cellular · Bluetooth on",
                    "2026-09-11 10:15:00 UTC · Battery 84 % · Wi-Fi connected · no cellular · Bluetooth on",
                ),
                viewModel.uiState.value.newest,
            )
        }

        @Test
        fun aNewRecordInThisProcessReadsTheLogAgain() = runTest {
            monitoring.start(15.minutes)
            testScheduler.runCurrent()
            val readsBefore = monitoring.reads

            val newest = record("2026-09-11T10:30:00Z", 82)
            monitoring.records += newest
            monitoring.status.value = MonitorStatus.Running(15.minutes, lastRecord = newest)
            testScheduler.runCurrent()

            assertEquals(readsBefore + 1, monitoring.reads)
            assertEquals(1, viewModel.uiState.value.recordCount)
        }

        @Test
        fun clearEmptiesTheLogOnScreen() = runTest {
            monitoring.records += record("2026-09-11T10:30:00Z", 82)
            viewModel.refreshLog()
            testScheduler.runCurrent()

            viewModel.clearLog()
            testScheduler.runCurrent()

            assertEquals(0, viewModel.uiState.value.recordCount)
            assertEquals(emptyList(), viewModel.uiState.value.newest)
        }

        @Test
        fun whatWentWrongIsShownUntilItGoesRight() = runTest {
            monitoring.status.value = MonitorStatus.Running(15.minutes, lastError = "Couldn't write to the log: disk full")
            testScheduler.runCurrent()
            assertEquals("Couldn't write to the log: disk full", viewModel.uiState.value.problem)

            monitoring.failNextClear = "Couldn't clear the log: permission denied"
            viewModel.clearLog()
            testScheduler.runCurrent()
            assertEquals("Couldn't clear the log: permission denied", viewModel.uiState.value.problem)

            monitoring.status.value = MonitorStatus.Running(15.minutes, lastRecord = record("2026-09-11T10:45:00Z", 82))
            testScheduler.runCurrent()
            assertNull(viewModel.uiState.value.problem)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import app.cash.turbine.test
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.doubles.TestDeviceScanning
    import com.example.devicemonitor.doubles.TestPermissionAccess
    import com.example.devicemonitor.doubles.TestStatusReport
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.ExperimentalCoroutinesApi
    import kotlinx.coroutines.test.StandardTestDispatcher
    import kotlinx.coroutines.test.resetMain
    import kotlinx.coroutines.test.runTest
    import kotlinx.coroutines.test.setMain
    import kotlin.test.AfterTest
    import kotlin.test.BeforeTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertNull

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain
    class DeviceListViewModelTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val heart = Device(id = "02", name = "Heart Rate Monitor", rssi = -61)

        private val scanning = TestDeviceScanning()
        private val permissions = TestPermissionAccess()
        private val status = TestStatusReport()
        private lateinit var viewModel: DeviceListViewModel

        @BeforeTest
        fun setUp() {
            // viewModelScope runs on Dispatchers.Main. In a test, Main becomes a test
            // dispatcher whose clock runTest controls, so delays and timeouts take no real time.
            Dispatchers.setMain(StandardTestDispatcher())
            viewModel = DeviceListViewModel(scanning, permissions, status)
        }

        @AfterTest
        fun tearDown() {
            Dispatchers.resetMain()
        }

        @Test
        fun showsDevicesAsTheyArriveThenFinishesWhenTheScanEnds() = runTest {
            viewModel.uiState.test {
                assertEquals(ScanState.Idle, awaitItem().scan)

                viewModel.startScan(filter = "")
                assertEquals(ScanState.Scanning(emptyList()), awaitItem().scan)

                scanning.find(obd)
                assertEquals(ScanState.Scanning(listOf(obd)), awaitItem().scan)

                scanning.find(heart)
                assertEquals(ScanState.Scanning(listOf(obd, heart)), awaitItem().scan)

                // The scan ends by itself (the service's time limit): the list stays, finished.
                scanning.finish()
                assertEquals(ScanState.Finished(listOf(obd, heart)), awaitItem().scan)
            }
        }

        @Test
        fun stopEndsTheScanAndKeepsWhatWasFound() = runTest {
            viewModel.uiState.test {
                skipItems(1) // Idle
                viewModel.startScan(filter = "")
                skipItems(1) // Scanning(emptyList())
                scanning.find(obd)
                assertEquals(ScanState.Scanning(listOf(obd)), awaitItem().scan)

                viewModel.stopScan()
                assertEquals(ScanState.Finished(listOf(obd)), awaitItem().scan)
            }
            testScheduler.runCurrent()
            assertFalse(scanning.isScanning)
        }

        @Test
        fun aFailedScanBecomesAMessageUntilItIsShown() = runTest {
            scanning.failure = ScanException("Bluetooth is off")

            viewModel.uiState.test {
                skipItems(1) // Idle
                viewModel.startScan(filter = "")
                skipItems(1) // Scanning(emptyList())

                val failed = awaitItem()
                assertEquals(ScanState.Idle, failed.scan)
                assertEquals("Bluetooth is off", failed.errorMessage)

                viewModel.errorShown()
                assertNull(awaitItem().errorMessage)
            }
        }

        @Test
        fun ignoresStartScanWhileAScanIsRunning() = runTest {
            viewModel.startScan(filter = "obd")
            testScheduler.runCurrent()
            viewModel.startScan(filter = "heart")
            testScheduler.runCurrent()

            assertEquals(listOf("obd"), scanning.filters)
        }

        @Test
        fun startsWithThePermissionStatusThePortReports() {
            permissions.current = PermissionStatus.Denied

            val fresh = DeviceListViewModel(scanning, permissions, status)

            assertEquals(PermissionStatus.Denied, fresh.uiState.value.bluetooth)
        }

        @Test
        fun showsTheAnswerToAPermissionRequest() = runTest {
            permissions.answer = PermissionStatus.PermanentlyDenied

            viewModel.requestPermission()
            testScheduler.runCurrent()

            assertEquals(PermissionStatus.PermanentlyDenied, viewModel.uiState.value.bluetooth)
        }

        @Test
        fun rereadsThePermissionOnRefresh() {
            permissions.current = PermissionStatus.Granted // changed in Settings meanwhile

            viewModel.refreshPermission()

            assertEquals(PermissionStatus.Granted, viewModel.uiState.value.bluetooth)
        }

        @Test
        fun showsThePhoneStatusAsOneLine() = runTest {
            status.status = DeviceStatus(
                battery = 82, wifiEnabled = true, wifiConnected = true, cellularAvailable = true,
                bluetoothEnabled = true, bluetoothConnected = true,
            )

            viewModel.refreshStatus()
            testScheduler.runCurrent()

            assertEquals(
                "Battery 82 % · Wi-Fi connected · cellular available · Bluetooth on, device connected",
                viewModel.uiState.value.phoneStatus,
            )
        }

        @Test
        fun saysWhatThePhoneCantTell() = runTest {
            // What the iPhone Simulator reports.
            status.status = DeviceStatus(
                battery = null, wifiEnabled = null, wifiConnected = false, cellularAvailable = false,
                bluetoothEnabled = null, bluetoothConnected = false,
            )

            viewModel.refreshStatus()
            testScheduler.runCurrent()

            assertEquals(
                "Battery unknown · Wi-Fi not connected · no cellular · Bluetooth unknown",
                viewModel.uiState.value.phoneStatus,
            )
        }

        @Test
        fun eachRefreshReadsTheStatusAgain() = runTest {
            viewModel.refreshStatus()
            testScheduler.runCurrent()
            status.status = status.status.copy(battery = 81, wifiEnabled = false, wifiConnected = false)

            viewModel.refreshStatus()
            testScheduler.runCurrent()

            assertEquals(2, status.reads)
            assertEquals(
                "Battery 81 % · Wi-Fi off · cellular available · Bluetooth on",
                viewModel.uiState.value.phoneStatus,
            )
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
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
    import com.example.devicemonitor.doubles.FakeMonitorSettings
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
                    log, timer, FakeMonitorSettings(),
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
            assertNotNull(koin.get<MonitorViewModel>())
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

??? example "docs/checklists.md"
    ```markdown
    # Release checklists

    The two checklists of the course plan's Appendix B (Lesson 20), as this app runs them. Run both
    before each release, and after any change that touches more than one part of the app.

    "Seen on" says how a row is known, as in monitor-behaviour.md:
    - emulator / Simulator: we ran it and saw this.
    - phone, not yet run: only a physical phone can show it. When you run it, write the phone and OS
      version here, and correct the row if the phone disagrees.

    ## End-to-end

    The BLE rows run twice. On the emulator and the Simulator, pass SimulatedBleScanner() and
    SimulatedBleConnection() to initKoin in the app start in place of the real adapters (two lines;
    put them back afterwards). On phones, use the real adapters and LightBlue (Lesson 13).

    | Row | What to do | Expect | Seen on |
    |---|---|---|---|
    | Permission: check | Fresh install, open the app | "Device Monitor needs Bluetooth permission…" and Allow Bluetooth | emulator; iPhone: phone, not yet run (the Simulator always says allowed) |
    | Permission: request, deny | Allow Bluetooth, then Don't allow | Android: "Bluetooth permission was denied…" and Ask again. iPhone: "Bluetooth permission is off…" and Open Settings (iOS never asks twice) | emulator; iPhone: phone, not yet run |
    | Permission: retry | Android: Ask again, then Don't allow again. iPhone: Open Settings, allow Bluetooth, come back | Android: "Bluetooth permission is off…" and Open Settings. iPhone: "Bluetooth permission: allowed" | emulator; iPhone: phone, not yet run |
    | BLE: scan | Scan | Devices appear as they are found; after 10 s, "Devices found: N" | emulator, Simulator (simulated); phone, not yet run |
    | BLE: connect, discover | Tap a device, Connect | "Status: connected", then its services and characteristics | emulator, Simulator (simulated); phone, not yet run |
    | BLE: read | Read on a readable characteristic | Its value under it (simulated battery: "82 %") | emulator, Simulator (simulated); phone, not yet run |
    | BLE: subscribe, receive | Subscribe on a notifying characteristic | A new value under it as the device sends one | emulator, Simulator (simulated); phone, not yet run |
    | BLE: disconnect, reconnect | Unsubscribe, Disconnect, Connect | "Status: not connected", services gone; then connected again | emulator, Simulator (simulated); phone, not yet run |
    | BLE: unexpected disconnect | Simulated: connect to Tire Pressure Sensor and wait 20 s. Phone: stop the peripheral | "Connection failed" with the reason, once; "Status: not connected" | emulator, Simulator (simulated); phone, not yet run |
    | Camera | Extension E2 only | | not in the core app |
    | API | Extension E1 only | | not in the core app |
    | Monitor: start | Start | "Monitor running, about every 15 min". Android: a record within seconds. iOS: the first record one interval after Start | emulator, Simulator |
    | Monitor: stop | Stop | "Monitor stopped"; Android: no job left (adb shell dumpsys jobscheduler); no more records | emulator, Simulator |
    | Monitor: restart | After Stop, end the process and open the app again | Still "Monitor stopped". Start: running again | emulator, Simulator |
    | Monitor: background, return, OS termination, force-kill | As in monitor-behaviour.md | The rows of monitor-behaviour.md | emulator, Simulator; phone rows: phone, not yet run |

    ## Refactor

    | Item | How to check | m15 |
    |---|---|---|
    | The UI has no device logic | Read each screen: it renders state and calls its ViewModel | yes |
    | ViewModels call only inbound ports | grep -n 'core.outbound\|adapter.outbound\|import android\.\|import platform\.' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/*.kt finds nothing | yes |
    | The app core imports no framework | grep -rn 'import android\.\|import platform\.\|import org.koin\|import io.ktor\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core finds nothing | yes |
    | One capability per inbound port; outbound ports named in the app's terms | Read core/inbound and core/outbound | yes |
    | Rules live in services | Read the ViewModels and adapters for decisions that aren't about the screen or the platform | yes, after moving the scan's time limit into ScanningService |
    | Services don't know each other | grep -n 'core.inbound' shared/src/commonMain/kotlin/com/example/devicemonitor/core/*Service.kt: one line per service, its own port; the bridge (SessionConnectionStatus) holds no rule | yes |
    | Koin binds ports to services and adapters; the graph test is green | AppModuleTest | yes |
    | Async work is scoped; errors reach the UI as state | Read the ViewModels: viewModelScope, and every exception caught into UI state | yes, after the monitor section showed the monitor's errors |
    | Resources are released | GATT closed and subscriptions cancelled (Lesson 16 tests); the monitor stops | yes, after Stop |
    | BLE connection state is consistent | SessionServiceTest, DeviceDetailViewModelTest | yes |
    | Service tests through inbound ports, with fakes, on JVM and iOS | ./gradlew :shared:allTests | yes |
    | No unused dependencies | For each dependency in a build file, grep its package in that module's sources; also look for code nothing calls | yes, after removing core-ktx from androidApp and the m00 greeting (Greeting, platformName). SimulatedBleScanner and SimulatedBleConnection stay: the end-to-end rows above use them |
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
    import com.example.devicemonitor.adapter.outbound.AndroidMonitorSettings
    import com.example.devicemonitor.adapter.outbound.AndroidNetworkProvider
    import com.example.devicemonitor.adapter.outbound.AndroidPermissionChecker
    import com.example.devicemonitor.di.initKoin
    import java.io.File

    // Runs once per process, before any Activity, and before any background work WorkManager runs
    // in it: the place to start Koin and to put the monitor back as the user left it.
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
                monitorSettings = AndroidMonitorSettings(this),
            )
            onAppLaunch()
        }
    }
    ```

=== "Compose"

    ??? example "androidApp/build.gradle.kts · Compose track"
        ```kotlin
        plugins {
            id("com.android.application")
            id("org.jetbrains.kotlin.plugin.compose")
            id("org.jetbrains.kotlin.plugin.serialization")
        }

        android {
            namespace = "com.example.devicemonitor.android"
            compileSdk = 37

            defaultConfig {
                applicationId = "com.example.devicemonitor"
                minSdk = 26
                targetSdk = 36
                versionCode = 1
                versionName = "1.0"
            }

            buildFeatures { compose = true }
        }

        dependencies {
            implementation(project(":shared"))
            implementation(platform("androidx.compose:compose-bom:2026.09.00"))
            implementation("androidx.activity:activity-compose:1.13.0")
            implementation("androidx.compose.material3:material3")
            implementation("androidx.navigation:navigation-compose:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
            implementation("io.insert-koin:koin-compose-viewmodel:4.2.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.12.0")
        }
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.clickable
        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.Row
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.fillMaxWidth
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.size
        import androidx.compose.foundation.lazy.LazyColumn
        import androidx.compose.foundation.lazy.items
        import androidx.compose.material3.AlertDialog
        import androidx.compose.material3.Button
        import androidx.compose.material3.CircularProgressIndicator
        import androidx.compose.material3.HorizontalDivider
        import androidx.compose.material3.ListItem
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.OutlinedTextField
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.runtime.getValue
        import androidx.compose.runtime.mutableStateOf
        import androidx.compose.runtime.saveable.rememberSaveable
        import androidx.compose.runtime.setValue
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.compose.LifecycleEventEffect
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.core.Device
        import com.example.devicemonitor.core.PermissionStatus
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: owns the filter text and connects the shared ViewModel to the content below. The
        // main screen: every feature starts here, and the device screen is one tap away.
        @Composable
        fun DeviceListScreen(
            onDeviceClick: (Device) -> Unit,
            viewModel: DeviceListViewModel = koinViewModel(),
        ) {
            var filter by rememberSaveable { mutableStateOf("") }
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            // Back from Settings (or anywhere else): the permission and the status may have changed.
            LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
                viewModel.refreshPermission()
                viewModel.refreshStatus()
            }

            DeviceListContent(
                filter = filter,
                onFilterChange = { filter = it },
                bluetooth = state.bluetooth,
                isScanning = state.scan is ScanState.Scanning,
                devices = when (val scan = state.scan) {
                    ScanState.Idle -> null
                    is ScanState.Scanning -> scan.found
                    is ScanState.Finished -> scan.found
                },
                onScan = { viewModel.startScan(filter) },
                onStop = viewModel::stopScan,
                onAllow = viewModel::requestPermission,
                onOpenSettings = viewModel::openSettings,
                onDeviceClick = onDeviceClick,
                phoneStatus = state.phoneStatus,
                onRefreshStatus = viewModel::refreshStatus,
                monitor = { MonitorSection() },
            )

            state.errorMessage?.let { message ->
                AlertDialog(
                    onDismissRequest = viewModel::errorShown,
                    confirmButton = { TextButton(onClick = viewModel::errorShown) { Text("OK") } },
                    title = { Text("Scan failed") },
                    text = { Text(message) },
                )
            }
        }

        // Stateless: renders whatever it's given, reports events up.
        @Composable
        fun DeviceListContent(
            filter: String,
            onFilterChange: (String) -> Unit,
            bluetooth: PermissionStatus,
            isScanning: Boolean,
            devices: List<Device>?,
            onScan: () -> Unit,
            onStop: () -> Unit,
            onAllow: () -> Unit,
            onOpenSettings: () -> Unit,
            onDeviceClick: (Device) -> Unit,
            phoneStatus: String,
            onRefreshStatus: () -> Unit,
            // A slot: the screen passes the stateful MonitorSection, so this function stays stateless.
            monitor: @Composable () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Device Monitor", style = MaterialTheme.typography.headlineSmall)
                PhoneStatusRow(text = phoneStatus, onRefresh = onRefreshStatus)
                monitor()
                HorizontalDivider()
                OutlinedTextField(
                    value = filter,
                    onValueChange = onFilterChange,
                    label = { Text("Device name filter") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                PermissionRow(status = bluetooth, onAllow = onAllow, onOpenSettings = onOpenSettings)
                // One button: Scan while idle, Stop while scanning.
                Button(
                    onClick = if (isScanning) onStop else onScan,
                    enabled = isScanning || bluetooth == PermissionStatus.Granted,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (isScanning) "Stop" else "Scan")
                }
                ScanStatus(isScanning = isScanning, devices = devices)
                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(devices.orEmpty(), key = { it.id }) { device ->
                        DeviceRow(device = device, onClick = { onDeviceClick(device) })
                        HorizontalDivider()
                    }
                }
            }
        }

        // The phone's own status, as the ViewModel words it, and a button to read it again.
        @Composable
        private fun PhoneStatusRow(text: String, onRefresh: () -> Unit) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = onRefresh) { Text("Refresh") }
            }
        }

        // One message and at most one action per permission status.
        @Composable
        private fun PermissionRow(status: PermissionStatus, onAllow: () -> Unit, onOpenSettings: () -> Unit) {
            val error = MaterialTheme.colorScheme.error
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                when (status) {
                    PermissionStatus.Granted -> Text(
                        "Bluetooth permission: allowed",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    PermissionStatus.NotRequested -> {
                        Text("Device Monitor needs Bluetooth permission to find nearby devices.")
                        TextButton(onClick = onAllow) { Text("Allow Bluetooth") }
                    }
                    PermissionStatus.Denied -> {
                        Text("Bluetooth permission was denied. Scanning needs it to find nearby devices.", color = error)
                        TextButton(onClick = onAllow) { Text("Ask again") }
                    }
                    PermissionStatus.PermanentlyDenied -> {
                        Text("Bluetooth permission is off. You can turn it on in Settings.", color = error)
                        TextButton(onClick = onOpenSettings) { Text("Open Settings") }
                    }
                    PermissionStatus.Restricted ->
                        Text("Bluetooth is restricted on this device, so scanning isn't available.", color = error)
                }
            }
        }

        @Composable
        private fun ScanStatus(isScanning: Boolean, devices: List<Device>?) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                when {
                    isScanning -> {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Scanning…")
                    }
                    devices == null -> Text("Tap Scan to look for devices.")
                    devices.isEmpty() -> Text(
                        "No devices found. Try another filter.",
                        color = MaterialTheme.colorScheme.error,
                    )
                    else -> Text("Devices found: ${devices.size}")
                }
            }
        }

        @Composable
        private fun DeviceRow(device: Device, onClick: () -> Unit) {
            ListItem(
                headlineContent = { Text(device.name) },
                supportingContent = { Text(device.id) },
                trailingContent = { Text("${device.rssi} dBm") },
                modifier = Modifier.clickable(onClick = onClick),
            )
        }
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/MonitorSection.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.Row
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.OutlinedButton
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.runtime.getValue
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.compose.LifecycleEventEffect
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import com.example.devicemonitor.adapter.inbound.MonitorUiState
        import com.example.devicemonitor.adapter.inbound.MonitorViewModel
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: connects the monitor's shared ViewModel to the content below. The list screen puts
        // it in its monitor slot.
        @Composable
        fun MonitorSection(viewModel: MonitorViewModel = koinViewModel()) {
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            // Back in the foreground: a tick may have written records while the screen was away.
            LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
                viewModel.refreshLog()
            }

            MonitorContent(
                state = state,
                onStart = viewModel::start,
                onStop = viewModel::stop,
                onClear = viewModel::clearLog,
            )
        }

        // Stateless: the monitor's state, Start or Stop, and the log's newest records with Clear.
        @Composable
        fun MonitorContent(state: MonitorUiState, onStart: () -> Unit, onStop: () -> Unit, onClear: () -> Unit) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(state.summary, modifier = Modifier.weight(1f))
                    // One button: Stop while running, Start while stopped.
                    OutlinedButton(onClick = if (state.running) onStop else onStart) {
                        Text(if (state.running) "Stop" else "Start")
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Records in the log: ${state.recordCount}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onClear, enabled = state.recordCount > 0) { Text("Clear") }
                }
                state.newest.forEach { line ->
                    Text(line, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                state.problem?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
            }
        }
        ```

=== "XML"

    ??? example "androidApp/build.gradle.kts · XML track"
        ```kotlin
        plugins {
            id("com.android.application")
        }

        android {
            namespace = "com.example.devicemonitor.android"
            compileSdk = 37

            defaultConfig {
                applicationId = "com.example.devicemonitor"
                minSdk = 26
                targetSdk = 36
                versionCode = 1
                versionName = "1.0"
            }

            buildFeatures { viewBinding = true }
        }

        dependencies {
            implementation(project(":shared"))
            implementation("androidx.appcompat:appcompat:1.8.0")
            implementation("androidx.fragment:fragment-ktx:1.9.1")
            implementation("androidx.constraintlayout:constraintlayout:2.2.2")
            implementation("androidx.recyclerview:recyclerview:1.4.0")
            implementation("androidx.navigation:navigation-fragment:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.11.0")
            implementation("io.insert-koin:koin-android:4.2.2")
        }
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Color
        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
        import androidx.appcompat.app.AlertDialog
        import androidx.fragment.app.Fragment
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import androidx.recyclerview.widget.DividerItemDecoration
        import com.example.devicemonitor.adapter.inbound.DeviceListUiState
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.MonitorUiState
        import com.example.devicemonitor.adapter.inbound.MonitorViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.android.databinding.FragmentDeviceListBinding
        import com.example.devicemonitor.core.PermissionStatus
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        // The main screen: every feature starts here, and the device screen is one tap away.
        class DeviceListFragment : Fragment() {
            // Survives rotation and the trip to the detail screen; cleared when this
            // Fragment leaves the back stack for good.
            private val viewModel: DeviceListViewModel by viewModel()
            private val monitorViewModel: MonitorViewModel by viewModel()

            // Android lets only an Activity or a Fragment register for a result, and only while it is
            // being created, so the Fragment registers here and lends the launcher to the adapter.
            // It decides nothing: the adapter reads the answer.
            private val permissionChecker by lazy {
                (requireActivity().application as DeviceMonitorApplication).permissionChecker
            }
            private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
                permissionChecker.onResult(requireActivity())
            }

            private var binding: FragmentDeviceListBinding? = null
            private var errorDialog: AlertDialog? = null
            private val adapter = DeviceAdapter { device ->
                val nav = findNavController()
                // A fast double tap delivers two clicks; only navigate from the list itself.
                if (nav.currentDestination?.id == R.id.deviceList) {
                    // The selected device travels in the arguments: the detail screen needs all of it.
                    val args = Bundle().apply {
                        putString("deviceId", device.id)
                        putString("deviceName", device.name)
                        putInt("deviceRssi", device.rssi)
                    }
                    nav.navigate(R.id.toDetail, args)
                }
            }

            override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
                val b = FragmentDeviceListBinding.inflate(inflater, container, false)
                binding = b
                b.deviceList.adapter = adapter
                b.deviceList.addItemDecoration(DividerItemDecoration(requireContext(), DividerItemDecoration.VERTICAL))
                // One button: Scan while idle, Stop while scanning.
                b.scanButton.setOnClickListener {
                    if (viewModel.uiState.value.scan is ScanState.Scanning) {
                        viewModel.stopScan()
                    } else {
                        viewModel.startScan(b.filterInput.text.toString())
                    }
                }
                b.refreshStatusButton.setOnClickListener { viewModel.refreshStatus() }
                // One button: Stop while running, Start while stopped.
                b.monitorButton.setOnClickListener {
                    if (monitorViewModel.uiState.value.running) monitorViewModel.stop() else monitorViewModel.start()
                }
                b.clearLogButton.setOnClickListener { monitorViewModel.clearLog() }
                return b.root
            }

            override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
                super.onViewCreated(view, savedInstanceState)
                viewLifecycleOwner.lifecycleScope.launch {
                    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                        launch { viewModel.uiState.collect { render(it) } }
                        launch { monitorViewModel.uiState.collect { renderMonitor(it) } }
                    }
                }
            }

            override fun onStart() {
                super.onStart()
                permissionChecker.attach(requireActivity(), permissionLauncher)
            }

            // Back from Settings (or anywhere else): the permission and the status may have changed, and
            // a tick may have written records while the screen was away.
            override fun onResume() {
                super.onResume()
                viewModel.refreshPermission()
                viewModel.refreshStatus()
                monitorViewModel.refreshLog()
            }

            override fun onStop() {
                permissionChecker.detach(permissionLauncher)
                super.onStop()
            }

            override fun onDestroyView() {
                super.onDestroyView()
                errorDialog?.dismiss() // a dismiss() doesn't call the cancel listener, so the error stays in state
                errorDialog = null
                binding?.deviceList?.adapter = null // the adapter outlives the view; don't let it keep the old list
                binding = null
            }

            // The one place that touches views: every new state ends here. The EditText keeps its
            // own text (and restores it after rotation), so render() never sets it.
            private fun render(state: DeviceListUiState) {
                val b = binding ?: return
                val isScanning = state.scan is ScanState.Scanning
                val devices = when (val scan = state.scan) {
                    ScanState.Idle -> null
                    is ScanState.Scanning -> scan.found
                    is ScanState.Finished -> scan.found
                }
                b.phoneStatusText.text = state.phoneStatus
                renderPermission(b, state.bluetooth)
                b.scanButton.text = if (isScanning) "Stop" else "Scan"
                b.scanButton.isEnabled = isScanning || state.bluetooth == PermissionStatus.Granted
                b.progress.visibility = if (isScanning) View.VISIBLE else View.GONE
                b.statusText.text = when {
                    isScanning -> "Scanning…"
                    devices == null -> "Tap Scan to look for devices."
                    devices.isEmpty() -> "No devices found. Try another filter."
                    else -> "Devices found: ${devices.size}"
                }
                b.statusText.setTextColor(if (devices?.isEmpty() == true && !isScanning) Color.RED else Color.DKGRAY)
                adapter.submitList(devices.orEmpty())
                renderError(state.errorMessage)
            }

            // The monitor section: every new monitor state ends here.
            private fun renderMonitor(state: MonitorUiState) {
                val b = binding ?: return
                b.monitorSummary.text = state.summary
                b.monitorButton.text = if (state.running) "Stop" else "Start"
                b.recordCountText.text = "Records in the log: ${state.recordCount}"
                b.clearLogButton.isEnabled = state.recordCount > 0
                b.newestRecordsText.text = state.newest.joinToString("\n")
                b.newestRecordsText.visibility = if (state.newest.isEmpty()) View.GONE else View.VISIBLE
                b.monitorProblemText.text = state.problem
                b.monitorProblemText.visibility = if (state.problem == null) View.GONE else View.VISIBLE
            }

            // One message and at most one action per permission status.
            private fun renderPermission(b: FragmentDeviceListBinding, status: PermissionStatus) {
                val (message, action) = when (status) {
                    PermissionStatus.Granted -> "Bluetooth permission: allowed" to null
                    PermissionStatus.NotRequested ->
                        "Device Monitor needs Bluetooth permission to find nearby devices." to "Allow Bluetooth"
                    PermissionStatus.Denied ->
                        "Bluetooth permission was denied. Scanning needs it to find nearby devices." to "Ask again"
                    PermissionStatus.PermanentlyDenied ->
                        "Bluetooth permission is off. You can turn it on in Settings." to "Open Settings"
                    PermissionStatus.Restricted ->
                        "Bluetooth is restricted on this device, so scanning isn't available." to null
                }
                b.permissionText.text = message
                val blocked = status != PermissionStatus.Granted && status != PermissionStatus.NotRequested
                b.permissionText.setTextColor(if (blocked) Color.RED else Color.DKGRAY)
                b.permissionButton.visibility = if (action == null) View.GONE else View.VISIBLE
                b.permissionButton.text = action
                b.permissionButton.setOnClickListener {
                    if (status == PermissionStatus.PermanentlyDenied) {
                        viewModel.openSettings()
                    } else {
                        viewModel.requestPermission()
                    }
                }
            }

            private fun renderError(message: String?) {
                if (message == null) {
                    errorDialog?.dismiss()
                    errorDialog = null
                } else if (errorDialog == null) {
                    errorDialog = AlertDialog.Builder(requireContext())
                        .setTitle("Scan failed")
                        .setMessage(message)
                        .setPositiveButton("OK") { _, _ -> viewModel.errorShown() }
                        .setOnCancelListener { viewModel.errorShown() }
                        .show()
                }
            }
        }
        ```

    ??? example "androidApp/src/main/res/layout/fragment_device_list.xml"
        ```xml
        <androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
            xmlns:app="http://schemas.android.com/apk/res-auto"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:padding="16dp">

            <TextView
                android:id="@+id/title"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:text="Device Monitor"
                android:textAppearance="@style/TextAppearance.AppCompat.Headline"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toTopOf="parent" />

            <!-- The phone's own status, as the ViewModel words it, and a button to read it again. -->
            <LinearLayout
                android:id="@+id/phoneStatusRow"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:gravity="center_vertical"
                android:orientation="horizontal"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/title">

                <TextView
                    android:id="@+id/phoneStatusText"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                <Button
                    android:id="@+id/refreshStatusButton"
                    style="?attr/borderlessButtonStyle"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Refresh" />
            </LinearLayout>

            <!-- The monitor: its state, Start or Stop, and the log's newest records with Clear. -->
            <LinearLayout
                android:id="@+id/monitorSection"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="vertical"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/phoneStatusRow">

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:gravity="center_vertical"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/monitorSummary"
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1" />

                    <Button
                        android:id="@+id/monitorButton"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:gravity="center_vertical"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/recordCountText"
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1"
                        android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                    <Button
                        android:id="@+id/clearLogButton"
                        style="?attr/borderlessButtonStyle"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="Clear" />
                </LinearLayout>

                <!-- The newest records, one per line, newest first. -->
                <TextView
                    android:id="@+id/newestRecordsText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                <TextView
                    android:id="@+id/monitorProblemText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small"
                    android:textColor="#D32F2F"
                    android:visibility="gone" />
            </LinearLayout>

            <View
                android:id="@+id/monitorDivider"
                android:layout_width="0dp"
                android:layout_height="1dp"
                android:layout_marginTop="8dp"
                android:background="?android:attr/listDivider"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/monitorSection" />

            <EditText
                android:id="@+id/filterInput"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:hint="Device name filter"
                android:importantForAutofill="no"
                android:inputType="text"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/monitorDivider" />

            <TextView
                android:id="@+id/permissionText"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/filterInput" />

            <Button
                android:id="@+id/permissionButton"
                style="?attr/borderlessButtonStyle"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintTop_toBottomOf="@id/permissionText" />

            <Button
                android:id="@+id/scanButton"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:text="Scan"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/permissionButton" />

            <ProgressBar
                android:id="@+id/progress"
                android:layout_width="20dp"
                android:layout_height="20dp"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintTop_toTopOf="@id/statusText"
                app:layout_constraintBottom_toBottomOf="@id/statusText" />

            <TextView
                android:id="@+id/statusText"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginStart="8dp"
                android:layout_marginTop="12dp"
                app:layout_constraintStart_toEndOf="@id/progress"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/scanButton"
                app:layout_goneMarginStart="0dp" />

            <androidx.recyclerview.widget.RecyclerView
                android:id="@+id/deviceList"
                android:layout_width="0dp"
                android:layout_height="0dp"
                android:layout_marginTop="12dp"
                app:layoutManager="androidx.recyclerview.widget.LinearLayoutManager"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/statusText"
                app:layout_constraintBottom_toBottomOf="parent" />
        </androidx.constraintlayout.widget.ConstraintLayout>
        ```

**iOS**

??? example "iosApp/iosApp/IosMonitorSettings.swift · both iOS tracks"
    ```swift
    import Foundation
    import Shared

    // Outbound adapter: the user's Stop, behind the Kotlin MonitorSettings port, kept in
    // UserDefaults, which outlives the process. bool(forKey:) is false for a key never set.
    final class IosMonitorSettings: MonitorSettings {
        private let key = "monitorStoppedByUser"

        func isStoppedByUser() -> Bool {
            UserDefaults.standard.bool(forKey: key)
        }

        func setStoppedByUser(stopped: Bool) {
            UserDefaults.standard.set(stopped, forKey: key)
        }
    }
    ```

=== "SwiftUI"

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
                    monitorScheduler: IosMonitorScheduler(),
                    monitorSettings: IosMonitorSettings()
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

    ??? example "iosApp/iosApp/DeviceListView.swift"
        ```swift
        import SwiftUI
        import Shared

        // Stateful: owns the filter text and connects the shared ViewModel to the content below. The
        // main screen: every feature starts here, and the device screen is one tap away.
        struct DeviceListView: View {
            @Environment(\.scenePhase) private var scenePhase
            @State private var owner = ViewModelOwner()
            @State private var filter = ""
            @State private var state: DeviceListUiState?

            var body: some View {
                let viewModel: DeviceListViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                DeviceListContent(
                    filter: $filter,
                    bluetooth: state.bluetooth,
                    isScanning: state.scan is ScanStateScanning,
                    devices: devices(in: state.scan),
                    onScan: { viewModel.startScan(filter: filter) },
                    onStop: { viewModel.stopScan() },
                    onAllow: { viewModel.requestPermission() },
                    onOpenSettings: { viewModel.openSettings() },
                    phoneStatus: state.phoneStatus,
                    onRefreshStatus: { viewModel.refreshStatus() },
                    monitor: MonitorSection()
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
                // Shown, and back from the detail screen: the status may have changed.
                .onAppear { viewModel.refreshStatus() }
                // Back from Settings (or anywhere else): the permission and the status may have changed.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        viewModel.refreshPermission()
                        viewModel.refreshStatus()
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

        // Stateless: renders whatever it's given, reports events up. Monitor is a slot: the screen
        // passes the stateful MonitorSection, so this view stays stateless.
        struct DeviceListContent<Monitor: View>: View {
            @Binding var filter: String
            let bluetooth: PermissionStatus
            let isScanning: Bool
            let devices: [Device]?
            let onScan: () -> Void
            let onStop: () -> Void
            let onAllow: () -> Void
            let onOpenSettings: () -> Void
            let phoneStatus: String
            let onRefreshStatus: () -> Void
            let monitor: Monitor

            var body: some View {
                VStack(alignment: .leading, spacing: 12) {
                    PhoneStatusRow(text: phoneStatus, onRefresh: onRefreshStatus)
                    monitor
                    Divider()
                    TextField("Device name filter", text: $filter)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    PermissionRow(status: bluetooth, onAllow: onAllow, onOpenSettings: onOpenSettings)
                    // One button: Scan while idle, Stop while scanning.
                    Button(action: isScanning ? onStop : onScan) {
                        Text(isScanning ? "Stop" : "Scan")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isScanning && bluetooth != .granted)
                    ScanStatus(isScanning: isScanning, devices: devices)
                    List(devices ?? [], id: \.id) { device in
                        NavigationLink(value: DeviceRoute(device: device)) {
                            DeviceRow(device: device)
                        }
                    }
                    .listStyle(.plain)
                }
                .padding()
                .navigationTitle("Device Monitor")
            }
        }

        // The phone's own status, as the ViewModel words it, and a button to read it again.
        private struct PhoneStatusRow: View {
            let text: String
            let onRefresh: () -> Void

            var body: some View {
                HStack {
                    Text(text)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Refresh", action: onRefresh)
                }
            }
        }

        // One message and at most one action per permission status. SKIE makes the Kotlin enum a
        // Swift enum, so this switch is exhaustive.
        private struct PermissionRow: View {
            let status: PermissionStatus
            let onAllow: () -> Void
            let onOpenSettings: () -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 6) {
                    switch status {
                    case .granted:
                        Text("Bluetooth permission: allowed")
                            .foregroundStyle(.secondary)
                    case .notRequested:
                        Text("Device Monitor needs Bluetooth permission to find nearby devices.")
                        Button("Allow Bluetooth", action: onAllow)
                    case .denied:
                        Text("Bluetooth permission was denied. Scanning needs it to find nearby devices.")
                            .foregroundStyle(.red)
                        Button("Ask again", action: onAllow)
                    case .permanentlyDenied:
                        Text("Bluetooth permission is off. You can turn it on in Settings.")
                            .foregroundStyle(.red)
                        Button("Open Settings", action: onOpenSettings)
                    case .restricted:
                        Text("Bluetooth is restricted on this device, so scanning isn't available.")
                            .foregroundStyle(.red)
                    }
                }
                .font(.callout)
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
        ```

    ??? example "iosApp/iosApp/MonitorSection.swift"
        ```swift
        import SwiftUI
        import Shared

        // Stateful: connects the monitor's shared ViewModel to the content below, with its own
        // ViewModelOwner. The list screen puts it in its monitor slot.
        struct MonitorSection: View {
            @Environment(\.scenePhase) private var scenePhase
            @State private var owner = ViewModelOwner()
            @State private var state: MonitorUiState?

            var body: some View {
                let viewModel: MonitorViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                MonitorContent(
                    state: state,
                    onStart: { viewModel.start() },
                    onStop: { viewModel.stop() },
                    onClear: { viewModel.clearLog() }
                )
                .task {
                    for await newState in viewModel.uiState {
                        self.state = newState
                    }
                }
                // Back in the foreground: a tick may have written records while the screen was away.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { viewModel.refreshLog() }
                }
            }
        }

        // Stateless: the monitor's state, Start or Stop, and the log's newest records with Clear.
        struct MonitorContent: View {
            let state: MonitorUiState
            let onStart: () -> Void
            let onStop: () -> Void
            let onClear: () -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(state.summary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        // One button: Stop while running, Start while stopped.
                        Button(state.running ? "Stop" : "Start", action: state.running ? onStop : onStart)
                            .buttonStyle(.bordered)
                    }
                    HStack {
                        Text("Records in the log: \(state.recordCount)")
                            .font(.footnote)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button("Clear", action: onClear)
                            .disabled(state.recordCount == 0)
                    }
                    ForEach(state.newest, id: \.self) { line in
                        Text(line)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let problem = state.problem {
                        Text(problem)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
        ```

=== "UIKit"

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
                    monitorScheduler: IosMonitorScheduler(),
                    monitorSettings: IosMonitorSettings()
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

    ??? example "iosApp/iosApp/DeviceListViewController.swift"
        ```swift
        import UIKit
        import Shared

        // The main screen: every feature starts here, and the device screen is one tap away.
        final class DeviceListViewController: UIViewController, UITableViewDelegate {
            private let owner = ViewModelOwner()
            private lazy var viewModel: DeviceListViewModel = owner.viewModel()
            // The same store holds one ViewModel per class: the monitor section's is a second one.
            private lazy var monitorViewModel: MonitorViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?
            private var monitorObservation: Task<Void, Never>?

            private let phoneStatusLabel = UILabel()
            private let refreshStatusButton = UIButton(configuration: .plain())
            private let monitorSummaryLabel = UILabel()
            private let monitorButton = UIButton(configuration: .gray())
            private let recordCountLabel = UILabel()
            private let clearLogButton = UIButton(configuration: .plain())
            private let newestRecordsLabel = UILabel()
            private let monitorProblemLabel = UILabel()
            private let filterField = UITextField()
            private let permissionLabel = UILabel()
            private let permissionButton = UIButton(configuration: .plain())
            private let scanButton = UIButton(configuration: .filled())
            private let spinner = UIActivityIndicatorView(style: .medium)
            private let statusLabel = UILabel()
            private let tableView = UITableView()
            // The rows' devices by id, from the last state rendered: the snapshot holds only the ids.
            private var devicesById: [String: Device] = [:]
            private lazy var dataSource = UITableViewDiffableDataSource<Int, String>(tableView: tableView) {
                [unowned self] tableView, indexPath, deviceId in
                let cell = tableView.dequeueReusableCell(withIdentifier: "device", for: indexPath)
                var content = UIListContentConfiguration.subtitleCell()
                if let device = devicesById[deviceId] {
                    content.text = device.name
                    content.secondaryText = "\(device.id)   \(device.rssi) dBm"
                }
                cell.contentConfiguration = content
                cell.accessoryType = .disclosureIndicator
                return cell
            }

            override func viewDidLoad() {
                super.viewDidLoad()
                title = "Device Monitor"
                navigationController?.navigationBar.prefersLargeTitles = true
                view.backgroundColor = .systemBackground

                filterField.placeholder = "Device name filter"
                filterField.borderStyle = .roundedRect
                filterField.autocorrectionType = .no
                scanButton.configuration?.title = "Scan"
                // One button: Scan while idle, Stop while scanning.
                scanButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if viewModel.uiState.value.scan is ScanStateScanning {
                        viewModel.stopScan()
                    } else {
                        viewModel.startScan(filter: filterField.text ?? "")
                    }
                }, for: .touchUpInside)
                permissionLabel.numberOfLines = 0
                permissionLabel.font = .preferredFont(forTextStyle: .callout)
                permissionButton.contentHorizontalAlignment = .leading
                permissionButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if viewModel.uiState.value.bluetooth == .permanentlyDenied {
                        viewModel.openSettings()
                    } else {
                        viewModel.requestPermission()
                    }
                }, for: .touchUpInside)
                statusLabel.numberOfLines = 0
                phoneStatusLabel.numberOfLines = 0
                phoneStatusLabel.font = .preferredFont(forTextStyle: .footnote)
                phoneStatusLabel.textColor = .secondaryLabel
                refreshStatusButton.configuration?.title = "Refresh"
                refreshStatusButton.addAction(UIAction { [weak self] _ in
                    self?.viewModel.refreshStatus()
                }, for: .touchUpInside)
                // The label takes the room the button doesn't need.
                refreshStatusButton.setContentHuggingPriority(.required, for: .horizontal)
                refreshStatusButton.setContentCompressionResistancePriority(.required, for: .horizontal)
                // One button: Stop while running, Start while stopped.
                monitorButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if monitorViewModel.uiState.value.running {
                        monitorViewModel.stop()
                    } else {
                        monitorViewModel.start()
                    }
                }, for: .touchUpInside)
                clearLogButton.configuration?.title = "Clear"
                clearLogButton.addAction(UIAction { [weak self] _ in
                    self?.monitorViewModel.clearLog()
                }, for: .touchUpInside)
                monitorSummaryLabel.numberOfLines = 0
                recordCountLabel.font = .preferredFont(forTextStyle: .footnote)
                newestRecordsLabel.numberOfLines = 0
                newestRecordsLabel.font = .preferredFont(forTextStyle: .caption1)
                newestRecordsLabel.textColor = .secondaryLabel
                monitorProblemLabel.numberOfLines = 0
                monitorProblemLabel.font = .preferredFont(forTextStyle: .caption1)
                monitorProblemLabel.textColor = .systemRed
                for button in [monitorButton, clearLogButton] {
                    button.setContentHuggingPriority(.required, for: .horizontal)
                    button.setContentCompressionResistancePriority(.required, for: .horizontal)
                }
                tableView.register(UITableViewCell.self, forCellReuseIdentifier: "device")
                tableView.delegate = self

                let statusRow = UIStackView(arrangedSubviews: [spinner, statusLabel])
                statusRow.spacing = 8
                let permissionRow = UIStackView(arrangedSubviews: [permissionLabel, permissionButton])
                permissionRow.axis = .vertical
                permissionRow.alignment = .leading
                let phoneStatusRow = UIStackView(arrangedSubviews: [phoneStatusLabel, refreshStatusButton])
                phoneStatusRow.spacing = 8
                phoneStatusRow.alignment = .center
                let monitorRow = UIStackView(arrangedSubviews: [monitorSummaryLabel, monitorButton])
                monitorRow.spacing = 8
                monitorRow.alignment = .center
                let logRow = UIStackView(arrangedSubviews: [recordCountLabel, clearLogButton])
                logRow.spacing = 8
                logRow.alignment = .center
                let monitorSection = UIStackView(arrangedSubviews: [
                    monitorRow, logRow, newestRecordsLabel, monitorProblemLabel,
                ])
                monitorSection.axis = .vertical
                monitorSection.spacing = 4
                let divider = UIView()
                divider.backgroundColor = .separator
                divider.heightAnchor.constraint(equalToConstant: 1).isActive = true
                let stack = UIStackView(arrangedSubviews: [
                    phoneStatusRow, monitorSection, divider, filterField, permissionRow, scanButton, statusRow, tableView,
                ])
                stack.axis = .vertical
                stack.spacing = 12
                stack.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(stack)
                NSLayoutConstraint.activate([
                    stack.topAnchor.constraint(equalTo: view.layoutMarginsGuide.topAnchor),
                    stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
                    stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
                    stack.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                ])
                render(viewModel.uiState.value)
                renderMonitor(monitorViewModel.uiState.value)
                // Back from Settings (or anywhere else): the permission and the status may have changed.
                NotificationCenter.default.addObserver(
                    self, selector: #selector(sceneDidActivate),
                    name: UIScene.didActivateNotification, object: nil
                )
            }

            // Back in the foreground: a tick may also have written records while the screen was away.
            @objc private func sceneDidActivate() {
                viewModel.refreshPermission()
                viewModel.refreshStatus()
                monitorViewModel.refreshLog()
            }

            // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android. Shown, and back
            // from the detail screen: the status may have changed.
            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
                viewModel.refreshStatus()
                observation?.cancel()
                observation = Task {
                    for await state in viewModel.uiState {
                        render(state)
                    }
                }
                monitorObservation?.cancel()
                monitorObservation = Task {
                    for await state in monitorViewModel.uiState {
                        renderMonitor(state)
                    }
                }
            }

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                observation?.cancel()
                observation = nil
                monitorObservation?.cancel()
                monitorObservation = nil
            }

            // The one place that touches views: every new state ends here. The text field owns
            // its own text, so render() never sets it.
            private func render(_ state: DeviceListUiState) {
                let isScanning = state.scan is ScanStateScanning
                // SKIE turns the sealed interface into a Swift enum, so this switch is exhaustive.
                let devices: [Device]? = switch onEnum(of: state.scan) {
                case .idle: nil
                case .scanning(let scanning): scanning.found
                case .finished(let finished): finished.found
                }
                phoneStatusLabel.text = state.phoneStatus
                renderPermission(state.bluetooth)
                scanButton.configuration?.title = isScanning ? "Stop" : "Scan"
                scanButton.isEnabled = isScanning || state.bluetooth == .granted
                if isScanning { spinner.startAnimating() } else { spinner.stopAnimating() }
                spinner.isHidden = !isScanning
                if isScanning {
                    statusLabel.text = "Scanning…"
                } else if let devices {
                    statusLabel.text = devices.isEmpty
                        ? "No devices found. Try another filter."
                        : "Devices found: \(devices.count)"
                } else {
                    statusLabel.text = "Tap Scan to look for devices."
                }
                statusLabel.textColor = devices?.isEmpty == true && !isScanning ? .systemRed : .label

                devicesById = Dictionary(uniqueKeysWithValues: (devices ?? []).map { ($0.id, $0) })
                var snapshot = NSDiffableDataSourceSnapshot<Int, String>()
                snapshot.appendSections([0])
                snapshot.appendItems((devices ?? []).map(\.id))
                dataSource.apply(snapshot, animatingDifferences: true)
                renderError(state.errorMessage)
            }

            // The monitor section: every new monitor state ends here.
            private func renderMonitor(_ state: MonitorUiState) {
                monitorSummaryLabel.text = state.summary
                monitorButton.configuration?.title = state.running ? "Stop" : "Start"
                recordCountLabel.text = "Records in the log: \(state.recordCount)"
                clearLogButton.isEnabled = state.recordCount > 0
                newestRecordsLabel.text = state.newest.joined(separator: "\n")
                newestRecordsLabel.isHidden = state.newest.isEmpty
                monitorProblemLabel.text = state.problem
                monitorProblemLabel.isHidden = state.problem == nil
            }

            // One message and at most one action per permission status. SKIE makes the Kotlin enum a
            // Swift enum, so this switch is exhaustive.
            private func renderPermission(_ status: PermissionStatus) {
                let (message, action): (String, String?) = switch status {
                case .granted: ("Bluetooth permission: allowed", nil)
                case .notRequested: ("Device Monitor needs Bluetooth permission to find nearby devices.", "Allow Bluetooth")
                case .denied: ("Bluetooth permission was denied. Scanning needs it to find nearby devices.", "Ask again")
                case .permanentlyDenied: ("Bluetooth permission is off. You can turn it on in Settings.", "Open Settings")
                case .restricted: ("Bluetooth is restricted on this device, so scanning isn't available.", nil)
                }
                permissionLabel.text = message
                permissionLabel.textColor = switch status {
                case .granted: .secondaryLabel
                case .notRequested: .label
                case .denied, .permanentlyDenied, .restricted: .systemRed
                }
                permissionButton.configuration?.title = action
                permissionButton.isHidden = action == nil
            }

            private func renderError(_ message: String?) {
                guard let message, presentedViewController == nil else { return }
                let alert = UIAlertController(title: "Scan failed", message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
                    self?.viewModel.errorShown()
                })
                present(alert, animated: true)
            }

            func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
                tableView.deselectRow(at: indexPath, animated: true)
                guard let deviceId = dataSource.itemIdentifier(for: indexPath), let device = devicesById[deviceId] else { return }
                // The detail screen gets the whole device: it needs all of it to connect.
                navigationController?.pushViewController(DeviceDetailViewController(device: device), animated: true)
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0). Nó chạy **đúng code** `MonitoringService.kt`, `DeviceMonitoring.kt` và `MonitorSettings.kt` của bài 20 (chỉ gom về một package), với các model của bài 17–18; cài đặt, log và scheduler là fake viết tay, và "một process mới" là một service mới dựng trên cùng cài đặt và log.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-hai-checklist-nhu-kiem-tra-xe-truoc-chuyen-i-xa): hai checklist như kiểm tra xe trước chuyến đi xa (mục 2, 8).
    3. [A3](#a3-mot-lan-stop-giu-uoc-qua-cac-process-chay-that-bang-code-cua-bai): một lần Stop giữ được qua các process, chạy thật (mục 4).
    4. [A4](#a4-cai-gi-song-qua-process-cai-gi-khong): cái gì sống qua process, cái gì không (mục 3, 4).
    5. [A5](#a5-quy-tac-nam-o-au-bon-phat-hien-va-cach-sua): quy tắc nằm ở đâu: bốn phát hiện và cách sửa (mục 2, 5, 6).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Bài cuối của phần lõi: dùng app **như người dùng** (một màn hình điều khiển mọi tính năng) và đọc nó **như người review** (hai checklist của Appendix B: đầu-cuối và refactor).
    2. Chạy checklist trên m14 tìm ra bốn chỗ: monitor không có nút và lỗi không lên màn hình; Stop không giữ được qua lần mở sau; giới hạn 10 giây của lần quét nằm trong ViewModel; một dependency và một class thừa.
    3. Khu **monitor** mới trên màn hình chính có Start/Stop, số bản ghi, ba bản ghi mới nhất, Clear và dòng lỗi; nó **đọc file log** chứ không đọc trạng thái trong bộ nhớ.
    4. Lần Stop được lưu qua outbound port mới `MonitorSettings` (SharedPreferences / UserDefaults); lần mở app gọi `restore` thay `start`, và **quy tắc nằm trong service**.
    5. Hai checklist vào `docs/checklists.md`, mỗi hàng có cách chạy (thường là một lệnh) và cột "Seen on"; các hàng BLE chạy bằng adapter giả lập rồi **đặt adapter thật trở lại**.

Ví dụ đời thường cho cả bài: **kiểm tra căn nhà trước khi bàn giao.** Bạn đi từng phòng bật tắt mọi công tắc (đầu-cuối), rồi mở tủ điện, xem dây đi đúng ống chưa, có ổ cắm nào không nối đi đâu không (refactor). Bạn thấy: phòng kho có đèn mà không có công tắc (monitor không có nút), công tắc tắt xong mất điện lại tự bật (Stop không giữ), cầu dao tổng gắn trong phòng ngủ thay vì tủ điện (quy tắc trong ViewModel), và vài sợi dây thừa (dependency thừa). Sửa xong, bạn dán danh sách kiểm tra lên cửa tủ điện cho lần sau.

| Chữ trong bài | Nói đơn giản | Trong m15 là |
|---|---|---|
| checklist đầu-cuối | việc người dùng làm, từng bước, trên app thật | quyền, luồng BLE, monitor |
| checklist refactor | việc người review đọc / chạy lệnh để kiểm | code nằm đâu, import gì, giải phóng gì |
| `MonitorViewModel` | ViewModel dùng chung của khu monitor | gọi `DeviceMonitoring` |
| slot | tham số nhận một phần UI để đặt vào | `monitor: @Composable () -> Unit`, `DeviceListContent<Monitor: View>` |
| `MonitorSettings` | outbound port lưu "lần chạm cuối là Stop" | `AndroidMonitorSettings`, `IosMonitorSettings` |
| `restore(interval)` | "đặt monitor lại như người dùng đã để" | `onAppLaunch()` gọi nó |
| SharedPreferences / UserDefaults | kho cài đặt nhỏ, ghi trong bộ nhớ ngay, xuống đĩa sau | `stoppedByUser` |
| `withTimeoutOrNull` | chạy khối, hết giờ thì huỷ và trả `null` | lần quét 10 giây trong `ScanningService` |
| `dependencyInsight` | lệnh Gradle cho biết thư viện tới từ đâu | `androidx.core` vẫn tới qua `androidx.activity` |

### A2. Hai checklist, như kiểm tra xe trước chuyến đi xa

Giải thích thêm cho [mục 2](#2-chay-cac-checklist-tren-m14) và [mục 8](#8-lan-chay-au-cuoi-va-cac-checklist-trong-project).

| | Đầu-cuối | Refactor |
|---|---|---|
| Ai làm | người dùng / tester | người review |
| Làm gì | bấm trong app, xem kết quả | chạy lệnh (`grep`, `dependencyInsight`) hoặc đọc file được chỉ tên |
| Ví dụ | "Stop, kill, mở lại: vẫn dừng" | "app core không import framework nào": `grep` không ra gì |
| Ví dụ đời thường | lái thử: phanh, đèn, còi | mở nắp capo: dầu, nước, dây curoa |
| Chạy trên emulator / Simulator | được, với adapter BLE giả lập | được, hoàn toàn |
| Cần điện thoại | quyền iOS, BLE thật, nền thật | không |

Hai điểm dễ quên khi chạy:

- **Thay adapter giả lập là hai dòng, và phải đặt lại.** `grep -n Simulated` trên file khởi động app phải không ra gì trước khi commit. Test không bắt được lỗi này, vì app chạy và pass hết với radio giả.
- **Cột "Seen on" như bảng hành vi.** Hàng nào chỉ điện thoại cho thấy được thì ghi "phone, not yet run" cho tới khi bạn chạy.

### A3. Một lần Stop giữ được qua các process, chạy thật bằng code của bài

Giải thích thêm cho [mục 4](#4-mot-lan-stop-giu-uoc-lau). Mỗi lời gọi `launch(n)` là một "process mới": service và scheduler mới (nhịp cũ đã chết cùng process), nhưng **cài đặt và log là cái cũ** (chúng nằm trên đĩa); rồi gọi `restore(15.minutes)` như `onAppLaunch()`:

```kotlin title="l20/Main.kt (chạy code của bài, không có trong app)"
val settings = StoredSettings()
val log = StoredLog()

fun launch(n: Int): Pair<MonitoringService, ProcessScheduler> {
    val scheduler = ProcessScheduler()
    val service = MonitoringService(Battery(), Network(), Bluetooth(), Link(), log, scheduler, settings, FixedClock())
    service.restore(15.minutes)
    val s = if (service.status.value is MonitorStatus.Running) "Running" else "Stopped"
    println("process $n: restore -> $s, nhịp được trao: ${scheduler.tick != null}")
    return service to scheduler
}

fun main() = runBlocking {
    var (svc, sch) = launch(1)
    sch.tick?.invoke()
    println("  một nhịp -> log có ${log.lines.size} bản ghi")
    svc.stop()
    println("  người dùng bấm Stop -> stoppedByUser = ${settings.stopped}")
    launch(2)
    launch(3).let { (s, _) -> s.start(15.minutes); println("  người dùng bấm Start -> stoppedByUser = ${settings.stopped}") }
    launch(4)
    Unit
}
```

Output thật:

```text
process 1: restore -> Running, nhịp được trao: true
  một nhịp -> log có 1 bản ghi
  người dùng bấm Stop -> stoppedByUser = true
process 2: restore -> Stopped, nhịp được trao: false
process 3: restore -> Stopped, nhịp được trao: false
  người dùng bấm Start -> stoppedByUser = false
process 4: restore -> Running, nhịp được trao: true
```

1. **Lần mở đầu tiên chạy monitor**: chưa ai từng bấm gì, `isStoppedByUser()` là `false`, giữ đúng hành vi của m14.
2. **Stop ghi một sự thật** (`stoppedByUser = true`) xuống "đĩa", rồi huỷ scheduler.
3. **Process 2 và 3** dựng service mới, đọc sự thật đó, và **không trao nhịp cho ai**: không bản ghi nào, không lịch nào.
4. **Start xoá sự thật đó**, nên process 4 lại chạy.

So với TS/JS: giống lưu `localStorage.setItem("monitorStopped", "true")` khi bấm Stop, và lúc tải trang thì `if (localStorage.getItem("monitorStopped") !== "true") startMonitor()`. Khác ở chỗ bài đặt câu `if` đó trong **service** (`restore`), không trong UI hay adapter.

### A4. Cái gì sống qua process, cái gì không

Giải thích thêm cho [mục 3](#3-khu-monitor) và [mục 4](#4-mot-lan-stop-giu-uoc-lau).

| Thứ | Sống ở đâu | Qua process? | Hệ quả trong m15 |
|---|---|---|---|
| `MonitorStatus` (`Running`, `lastRecord`, `lastError`) | `StateFlow` trong bộ nhớ | **không** | khu monitor không hiện `lastRecord`, mà đọc file |
| nhịp (lambda trao cho scheduler) | bộ nhớ của adapter | **không** | mỗi process phải gọi `onAppLaunch()` để trao lại |
| file log `status-log.jsonl` | đĩa | có | nguồn sự thật cho lịch sử |
| `stoppedByUser` | SharedPreferences / UserDefaults | có | `restore` đọc nó ở mỗi lần mở |
| lịch WorkManager (Android) | cơ sở dữ liệu của WorkManager | có | Stop phải `cancel()` nó, không thì Android vẫn khởi động process |
| bộ hẹn giờ foreground (iOS) | coroutine trong process | **không** | không có gì để huỷ khi app đã đóng |

Vì sao `isStoppedByUser()` **không** là `suspend`? Vì trên Android, process do WorkManager khởi động chạy `Application.onCreate` → `onAppLaunch()` → `restore`, rồi ngay sau đó `MonitorWorker` đọc nhịp. Nếu việc đọc cài đặt chạy trong một coroutine, worker có thể tới trước và không thấy nhịp nào. Đọc đồng bộ trong `onCreate` là cách chắc chắn tới trước.

### A5. Quy tắc nằm ở đâu: bốn phát hiện và cách sửa

Giải thích thêm cho [mục 2](#2-chay-cac-checklist-tren-m14), [mục 5](#5-mot-quy-tac-ra-khoi-viewmodel-gioi-han-thoi-gian-quet) và [mục 6](#6-khong-gi-thua).

| Phát hiện | Vì sao là lỗi | Cách sửa | Không sửa bằng cách |
|---|---|---|---|
| monitor không có nút, lỗi không lên màn hình | người dùng không dừng được; `lastError` không ai thấy | `MonitorViewModel` + khu monitor | thêm nút gọi thẳng scheduler |
| Stop không giữ qua lần mở sau | `onAppLaunch()` luôn gọi `start` | port `MonitorSettings` + `restore` trong service | hỏi WorkManager "còn lịch không" (iOS không có gì để hỏi) |
| giới hạn 10 giây quét nằm trong ViewModel | "mọi lần quét" là quy tắc của app; màn hình thứ hai sẽ quên | `withTimeoutOrNull` trong `ScanningService` | để mỗi ViewModel tự nhớ |
| `core-ktx`, `Greeting`, `platformName()` thừa | không gì dùng; làm người đọc tưởng có ý nghĩa | xoá; kiểm bằng `grep` và `dependencyInsight` | xoá luôn `Simulated*` (chúng **có** dùng, cho lần chạy không radio) |

Ví dụ đời thường cho quy tắc quét: "mọi lần mở cửa tủ lạnh tối đa 10 giây" nên là **cảm biến của tủ lạnh** (service), không phải tờ giấy dán trên tay nắm của một người (ViewModel). Người thứ hai mở tủ không đọc tờ giấy của người kia.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là xong phần lõi; các bài E1–E3 là phần mở rộng.

- [ ] Chỉ ra trên m15 nơi điều khiển mỗi tính năng: trạng thái, monitor, quyền, quét trên màn hình chính; kết nối, đọc, đăng ký trên màn hình thiết bị.
- [ ] Phân biệt checklist đầu-cuối và refactor, và biến một mục refactor thành một lệnh `grep` (xem [A2](#a2-hai-checklist-nhu-kiem-tra-xe-truoc-chuyen-i-xa)).
- [ ] Kể bốn phát hiện khi chạy checklist trên m14 và cách sửa từng cái (xem [A5](#a5-quy-tac-nam-o-au-bon-phat-hien-va-cach-sua)).
- [ ] Đọc `MonitorViewModel` và giải thích: khung hình đầu đúng, đọc log khi trạng thái đổi và khi resume, lần đọc mới nhất thắng, lỗi thành state.
- [ ] Giải thích vì sao khu monitor đọc file log chứ không hiện `lastRecord` (xem [A4](#a4-cai-gi-song-qua-process-cai-gi-khong)).
- [ ] Đặt khu monitor lên màn hình chính trên track của mình (slot Compose, hai `launch` trong Fragment, slot generic SwiftUI, hoặc ViewModel thứ hai trong cùng store UIKit).
- [ ] Giải thích vì sao một nút Stop là chưa đủ, và `restore` cùng `MonitorSettings` giữ lần Stop qua các process ra sao (xem [A3](#a3-mot-lan-stop-giu-uoc-qua-cac-process-chay-that-bang-code-cua-bai)).
- [ ] Nói vì sao `isStoppedByUser()` phải đồng bộ, và vì sao ở đây dùng SharedPreferences chứ không phải DataStore.
- [ ] Dời giới hạn 10 giây của lần quét vào `ScanningService` bằng `withTimeoutOrNull`, và giải thích ViewModel biết lần quét đã xong bằng cách nào.
- [ ] Tìm và gỡ dependency / class thừa, kiểm bằng `dependencyInsight`, và biết cái nào giữ lại có chủ ý.
- [ ] Chạy danh sách đầu-cuối với adapter BLE giả lập, rồi đặt adapter thật trở lại và kiểm bằng `grep -n Simulated`.
- [ ] Viết `docs/checklists.md` với cách chạy và cột "Seen on" cho mọi hàng.
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.
