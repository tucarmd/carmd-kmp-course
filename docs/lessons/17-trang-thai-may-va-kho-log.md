---
source: lessons/17-device-status-and-log-store.html
source_ref: live
source_sha: 55a78ee
---

<p class="kicker">Bài 17 · Tuần 4 · Ngày 17 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/17-device-status-and-log-store.html">Bản gốc tiếng Anh</a></p>

# Trạng thái máy và kho log

<div class="meta">
  <span class="tag">~2,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m12 báo trạng thái trực tiếp; ghi các dòng log và đọc lại được</span>
  <span class="tag">Cần trước: <a href="../16-ble-notify-ngat-ket-noi-loi/">16</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Tới giờ app chỉ theo dõi các thiết bị khác. Một device monitor còn cần trạng thái của chính điện thoại: pin còn bao nhiêu, Wi-Fi và mạng di động có lên không, Bluetooth có bật không và app có đang giữ liên kết không. Hôm nay đó thành một khả năng riêng, inbound port `StatusReport`, được màn hình danh sách đọc và được trả lời bởi một service đứng trên ba outbound port nhỏ, mỗi port một adapter cho mỗi nền tảng. Một câu trả lời, app có đang giữ liên kết không, thuộc về một khả năng khác, BLE session, và cách một service hỏi một service khác mà không biết nó là một bài học riêng: một bridge adapter. Rồi app có chỗ để giữ những gì nó thấy: một outbound port `LogStore` với một file JSON Lines phía sau. Adapter iOS của nó là ví dụ Kotlin/Native trong `iosMain` của khoá học: một outbound adapter làm mọi việc qua Foundation của Apple, được gọi từ Kotlin, kể cả con trỏ. Monitor của bài 18 đọc trạng thái theo bộ hẹn giờ và ghi mỗi lần đọc vào log này. Đó là milestone **m12**: trạng thái trực tiếp trên màn hình, và các dòng log được ghi và đọc lại trên cả hai nền tảng.

!!! info "Nguồn chính"
    Trang [Read network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state) của Android trước mục 4. Với iOS, các trang [NWPathMonitor](https://developer.apple.com/documentation/network/nwpathmonitor) và [UIDevice.batteryLevel](https://developer.apple.com/documentation/uikit/uidevice/batterylevel) của Apple trước mục 5. Với kho log, [JSON Lines](https://jsonlines.org/) trước mục 7, và các trang [Interoperability with C](https://kotlinlang.org/docs/native-c-interop.html) (phần "Memory allocation") và [Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html) (phần "Errors and exceptions") của Kotlin trước mục 9.

!!! info "Track"
    Các port, service, bridge, các adapter, kho log và các test (mục 1–5 và 7–10) giống nhau trên mọi track; chỉ phần khởi động app khác nhau giữa SwiftUI và UIKit, và build file gốc của track XML thêm một dòng (mục 7). Các track khác nhau ở màn hình danh sách (mục 6), thứ có thêm một dòng trạng thái và một nút Refresh. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m11

| Cái gì | m11 | m12 |
|---|---|---|
| app core | quét, quyền, BLE session | các model mới `DeviceStatus`, `NetworkStatus`, `LogRecord` và `LogStoreException`; một inbound port mới, `StatusReport`, do `StatusService` implement; năm outbound port mới: `BatteryProvider`, `NetworkProvider`, `BluetoothProvider`, `ConnectionStatus` và `LogStore` |
| adapter Android | radio BLE, quyền | ba adapter trạng thái trong `AndroidStatusProviders.kt`, và `AndroidLogStore`; manifest xin `ACCESS_NETWORK_STATE` và `ACCESS_WIFI_STATE` |
| adapter iOS | các class BLE và quyền bằng Swift, nửa Kotlin trong `iosMain` | ba adapter trạng thái bằng Swift trong `IosStatusProviders.swift`, và `IosLogStore`, Kotlin trong `iosMain` dùng Foundation |
| code adapter dùng chung | radio giả lập | `SessionConnectionStatus`, một bridge adapter trả lời `ConnectionStatus` từ session; `JsonLines`, định dạng file log, dùng bởi cả hai kho log; `shared/build.gradle.kts` áp plugin kotlinx.serialization và thêm thư viện JSON của nó |
| Koin | ba adapter truyền vào `initKoin` | sáu: thêm ba adapter trạng thái. `StatusReport` được bind với `StatusService`, và `ConnectionStatus` với `SessionConnectionStatus`. `LogStore` chưa được bind: không gì dùng nó cho tới bài 18 |
| màn hình danh sách | bộ lọc, quyền, Scan | thêm một dòng trạng thái điện thoại, đọc khi màn hình hiện ra, khi app quay lại foreground, và khi bấm Refresh |
| test | 68 mỗi nền tảng | 87 mỗi nền tảng: 5 cho status service, 1 cho bridge, thêm 1 cho graph Koin, thêm 3 cho ViewModel danh sách, 4 cho định dạng file, và 5 mà mọi kho log phải pass, chạy với adapter Android trên JVM và adapter iOS trong simulator |

## 1. Một khả năng, ba câu hỏi cho nền tảng

Appendix A.6 của kế hoạch khoá học đòi mức pin, Wi-Fi bật và đã kết nối, mạng di động có sẵn, và Bluetooth bật và đã kết nối. Theo cách nói của app, đó là một model và một inbound port:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/DeviceStatus.kt" hl_lines="3 4 5 8"
// The phone's own status at one moment, in the app's terms. null means "this phone can't tell":
// the iPhone Simulator has no battery level, and iOS doesn't say whether Wi-Fi is switched on.
data class DeviceStatus(
    val battery: Int?, // percent, 0 to 100
    val wifiEnabled: Boolean?,
    val wifiConnected: Boolean,
    val cellularAvailable: Boolean, // a cellular network is up that this app can use
    val bluetoothEnabled: Boolean?,
    val bluetoothConnected: Boolean, // this app holds a link to a device (ConnectionStatus)
)
⋯ NetworkStatus: wifiEnabled, wifiConnected and cellularAvailable, the network half
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/StatusReport.kt" hl_lines="3"
interface StatusReport {
    // The status right now: battery, Wi-Fi, cellular and Bluetooth. Each call reads it again.
    suspend fun current(): DeviceStatus
}
```

1. **Ba trường nullable**, vì "tôi không biết" là một câu trả lời trung thực mà app phải đưa ra được, và nó không phải `false`. Mức pin `-1` hay `0` sẽ là một lời nói dối mà màn hình và log sẽ lặp lại. Mục 4 và 5 cho thấy mỗi `null` tới từ đâu.
2. **`suspend`**, vì một trong các câu trả lời tốn chút thời gian trên iOS: một `CBCentralManager` mới biết state của radio trong một callback (bài 13). Hai cái kia là đọc tức thì.

Service cần ba thứ từ nền tảng, mỗi thứ là một outbound port nhỏ đặt theo tên điều nó trả lời:

```text title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BatteryProvider.kt, NetworkProvider.kt, BluetoothProvider.kt" hl_lines="3 8 13"
interface BatteryProvider {
    // The charge left, in percent (0 to 100), or null if this phone can't tell.
    fun level(): Int?
}
interface NetworkProvider {
    // Wi-Fi switched on (null if this platform can't tell) and connected, and whether a cellular
    // network is up that this app can use, as the system last reported them.
    fun current(): NetworkStatus
}
interface BluetoothProvider {
    // Whether Bluetooth is switched on, or null if the app can't tell: the phone has no radio,
    // or (iOS) the user hasn't allowed Bluetooth. Never shows a permission prompt.
    suspend fun isEnabled(): Boolean?
}
```

1. **Sao không dùng lại `BleScanner.isEnabled()`?** Nó trả lời câu hỏi của scanning service và sống cùng lần quét; nó sẽ kéo scanner vào báo cáo trạng thái, và adapter iOS của nó tạo một `CBCentralManager` ở lần đầu được hỏi, việc hiện hộp thoại xin quyền cho một người dùng chưa trả lời. Mỗi câu hỏi một port giữ mỗi adapter nhỏ và mỗi quy tắc đúng chỗ của nó.
2. **"Như hệ thống báo lần gần nhất."** Cả hai nền tảng đẩy thay đổi mạng tới app (mục 4 và 5), nên adapter giữ cái mới nhất và `current()` chỉ đọc nó. Đó là lý do nó không phải `suspend`.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 490" role="img" aria-labelledby="l17-hex-title">
      <title id="l17-hex-title">Ai trả lời "trạng thái điện thoại thế nào?". DeviceListViewModel của màn hình danh sách, một inbound adapter, gọi inbound port StatusReport. StatusService trong app core implement nó. Nó hỏi bốn outbound port: BatteryProvider, NetworkProvider và BluetoothProvider về điện thoại, và ConnectionStatus về việc app này có đang giữ liên kết tới một thiết bị không. Trên Android, ba adapter Kotlin trong androidMain implement ba port về điện thoại dựa trên BatteryManager, ConnectivityManager cùng WifiManager, và BluetoothAdapter. Trên iOS, ba adapter Swift trong app iOS implement chúng dựa trên UIDevice, NWPathMonitor và CBCentralManager. ConnectionStatus được implement trong code dùng chung bởi SessionConnectionStatus, một bridge adapter hỏi inbound port DeviceSession (mục 3). Trong test, các fake đứng thay các adapter.</title>
      <defs><marker id="l17-hex-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="inbound">
        <rect class="box" x="10" y="150" width="150" height="60" rx="6"></rect>
        <text class="title small" x="20" y="174">DeviceListViewModel</text>
        <text class="small muted" x="20" y="194">inbound adapter</text>
      </g>
      <g data-part="core">
        <rect class="box" x="190" y="40" width="300" height="320" rx="6"></rect>
        <text class="title" x="204" y="64">App core</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="204" y="150" width="120" height="40" rx="6"></rect>
        <text class="mono small" x="214" y="175">StatusReport</text>
      </g>
      <g data-part="core">
        <rect class="box" x="204" y="210" width="120" height="40" rx="6"></rect>
        <text class="mono small" x="214" y="235">StatusService</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="350" y="60" width="128" height="40" rx="6"></rect>
        <text class="mono small" x="358" y="85">BatteryProvider</text>
        <rect class="box" x="350" y="130" width="128" height="40" rx="6"></rect>
        <text class="mono small" x="358" y="155">NetworkProvider</text>
        <rect class="box" x="350" y="200" width="128" height="40" rx="6"></rect>
        <text class="mono small" x="358" y="225">BluetoothProvider</text>
        <rect class="box" x="350" y="290" width="128" height="40" rx="6"></rect>
        <text class="mono small" x="358" y="315">ConnectionStatus</text>
      </g>
      <g data-part="android">
        <rect class="box" x="520" y="40" width="230" height="140" rx="6"></rect>
        <text class="title small" x="530" y="62">Android, Kotlin (androidMain)</text>
        <text class="small" x="530" y="88">BatteryManager</text>
        <text class="small" x="530" y="110">ConnectivityManager, WifiManager</text>
        <text class="small" x="530" y="132">BluetoothAdapter</text>
        <text class="small muted" x="530" y="160">AndroidStatusProviders.kt</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="520" y="210" width="230" height="140" rx="6"></rect>
        <text class="title small" x="530" y="232">iOS, Swift (app iOS)</text>
        <text class="small" x="530" y="258">UIDevice</text>
        <text class="small" x="530" y="280">NWPathMonitor</text>
        <text class="small" x="530" y="302">CBCentralManager</text>
        <text class="small muted" x="530" y="330">IosStatusProviders.swift</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="300" y="390" width="290" height="56" rx="6"></rect>
        <text class="title small" x="312" y="412">SessionConnectionStatus</text>
        <text class="small muted" x="312" y="433">bridge adapter (commonMain): hỏi DeviceSession</text>
      </g>
      <path class="edge" d="M160,175 L202,172" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge" d="M264,190 L264,208" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge" d="M324,220 L348,84" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge" d="M324,226 L348,154" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge" d="M324,232 L348,222" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge" d="M324,242 L348,306" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge dashed" d="M518,110 L482,150" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge dashed" d="M518,280 L482,226" marker-end="url(#l17-hex-arrow)"></path>
      <path class="edge dashed" d="M440,388 L420,334" marker-end="url(#l17-hex-arrow)"></path>
      <text class="small muted" x="10" y="476">Liền: lời gọi. Đứt: adapter implement outbound port. Trong test, các fake thế chỗ các adapter.</text>
    </svg>
    <figcaption>Một inbound port và bốn outbound port: ba được trả lời bởi sáu adapter nền tảng, một bởi một bridge adapter tới session.
<ul class="legend">
    <li data-part="core">App core</li>
    <li data-part="inbound">Inbound</li>
    <li data-part="outbound">Outbound port và bridge adapter</li>
    <li data-part="android">Adapter Android</li>
    <li data-part="ios">Adapter iOS</li>
  </ul>
</figcaption>
  </figure>

## 2. Status service: các quy tắc của app cho trạng thái

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/StatusService.kt" hl_lines="1 5 12 16"
class StatusService(
    private val battery: BatteryProvider,
    private val network: NetworkProvider,
    private val bluetooth: BluetoothProvider,
    private val connection: ConnectionStatus,
) : StatusReport {
    override suspend fun current(): DeviceStatus {
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
}
```

1. **Quy tắc Wi-Fi** là của app, không phải của nền tảng: một điện thoại đang kết nối qua Wi-Fi thì Wi-Fi đang bật. Trên iOS, nơi adapter không nói được Wi-Fi có bật không (mục 5), quy tắc này biến phần lớn các `null` thành một `true` trung thực. Chỉ "không kết nối, và nền tảng không nói được" là vẫn không biết. `aWifiConnectionMeansWifiIsOn` kiểm tra nó; gỡ phần `?:` thì nó fail với "expected:&lt;true> but was:&lt;null>" (chúng tôi đã thử).
2. **"Bluetooth connected" là việc của session nói.** Điều một device monitor quan tâm là *app này* có đang giữ liên kết tới thiết bị của nó không, và bài 14 đã cho `SessionService` là chủ duy nhất của state đó. Hỏi nền tảng thay vào thậm chí không cho cùng câu trả lời trên cả hai: `retrieveConnectedPeripherals(withServices:)` của CoreBluetooth "Lấy mọi peripheral đang kết nối với hệ thống và implement bất kỳ service nào trong danh sách" (`CBCentralManager.h`), nên nó cần UUID service để tìm, và nó tính cả liên kết của các app khác.
3. **Nhưng service hỏi port của chính nó.** `StatusService` nhận một outbound port thứ tư, `ConnectionStatus`, không phải `DeviceSession` và không phải `SessionService`. Câu trả lời của session tới port đó bằng cách nào là chuyện của mục sau.
4. **Đang kết nối không phải đã kết nối.** Port trao cả `ConnectionState`, và quy tắc "chỉ một liên kết đang mở mới tính" là dòng này, trong service này. `onlyAnOpenLinkCountsAsConnected` cho nó đi qua `Connecting`, `Connected` và `Disconnected`; thay `is ConnectionState.Connected` bằng `!is ConnectionState.Disconnected` thì nó fail (chúng tôi đã thử).
5. **Một ảnh chụp, đọc một lần mỗi lời gọi.** Mỗi lời gọi đọc lại mọi thứ, đó là nghĩa của "trực tiếp" ở đây: `eachCallReadsAgain` kiểm tra điều đó.

!!! warning "Gotcha · bạn chưa thấy được "device connected" trên màn hình danh sách đâu"
    Dòng trạng thái nằm trên màn hình danh sách, và rời màn hình chi tiết thì clear ViewModel của nó, việc đó kết thúc kết nối (bài 14). Nên mỗi khi danh sách đọc trạng thái, không có liên kết nào đang lên. Quy tắc vẫn đúng, và `onlyAnOpenLinkCountsAsConnected` chứng minh nó với mỗi state kết nối. Bản ghi mà monitor của bài 18 ghi theo bộ hẹn giờ là nơi nó bắt đầu có ý nghĩa.

## 3. Các service gặp nhau qua một bridge adapter

Trạng thái cần một sự thật mà session giữ. Code ngắn nhất sẽ trao cho `StatusService` inbound port của session và đọc `session.connectionState.value`. Nó compile, và nó phá một quy tắc mà mọi bài từ bài 10 đã giữ: một service gọi outbound port. Câu trả lời của app, từ hôm nay, là một câu:

!!! info "Quy tắc"
    **Các service không biết nhau.** Khi một khả năng cần thứ mà một khả năng khác giữ, service của nó hỏi qua một outbound port đặt tên theo cách nói của chính nó, và một **bridge adapter** nhỏ trong code dùng chung implement port đó bằng cách gọi inbound port của khả năng kia.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 410" role="img" aria-labelledby="l17-bridge-title">
      <title id="l17-bridge-title">Hai khả năng gặp nhau qua một bridge adapter. Bên trái, trạng thái điện thoại: DeviceListViewModel gọi inbound port StatusReport, do StatusService implement, và StatusService gọi outbound port ConnectionStatus của nó. Bên phải, BLE session: DeviceDetailViewModel gọi inbound port DeviceSession, do SessionService implement, và SessionService gọi outbound port BleConnection của nó, do các adapter radio implement. Dưới app core, trong code dùng chung, bridge adapter SessionConnectionStatus implement ConnectionStatus và gọi DeviceSession. StatusService không bao giờ thấy DeviceSession hay SessionService, và SessionService không bao giờ thấy trạng thái.</title>
      <defs><marker id="l17-bridge-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="inbound">
        <rect class="box" x="40" y="14" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="52" y="39">DeviceListViewModel</text>
        <rect class="box" x="520" y="14" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="532" y="39">DeviceDetailViewModel</text>
      </g>
      <g data-part="core">
        <rect class="box" x="20" y="80" width="720" height="220" rx="6"></rect>
        <text class="title" x="320" y="104">App core</text>
        <text class="small muted" x="40" y="104">trạng thái điện thoại</text>
        <text class="small muted" x="520" y="104">BLE session</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="40" y="116" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="52" y="141">StatusReport</text>
        <rect class="box" x="520" y="116" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="532" y="141">DeviceSession</text>
      </g>
      <g data-part="core">
        <rect class="box" x="40" y="176" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="52" y="201">StatusService</text>
        <rect class="box" x="520" y="176" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="532" y="201">SessionService</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="40" y="236" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="52" y="261">ConnectionStatus</text>
        <rect class="box" x="520" y="236" width="200" height="40" rx="6"></rect>
        <text class="mono small" x="532" y="261">BleConnection</text>
        <rect class="box" x="250" y="326" width="260" height="56" rx="6"></rect>
        <text class="title small" x="262" y="348">SessionConnectionStatus</text>
        <text class="small muted" x="262" y="369">bridge adapter, adapter/outbound</text>
      </g>
      <text class="small muted" x="250" y="196">không có đường nào giữa</text>
      <text class="small muted" x="250" y="212">hai service</text>
      <path class="edge" d="M140,54 L140,114" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M620,54 L620,114" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M140,156 L140,174" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M620,156 L620,174" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M140,216 L140,234" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M620,216 L620,234" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge dashed" d="M270,324 L200,280" marker-end="url(#l17-bridge-arrow)"></path>
      <path class="edge" d="M480,324 L518,142" marker-end="url(#l17-bridge-arrow)"></path>
      <text class="small muted" x="20" y="402">Liền: lời gọi. Đứt: implement. Các adapter radio sau BleConnection được lược bỏ.</text>
    </svg>
    <figcaption>Trạng thái hỏi port của chính nó; bridge trả lời bằng cách hỏi inbound port của session. Không service nào biết service kia.
<ul class="legend">
    <li data-part="core">App core</li>
    <li data-part="inbound">Inbound</li>
    <li data-part="outbound">Outbound port và adapter</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/ConnectionStatus.kt" hl_lines="1 3"
interface ConnectionStatus {
    // Where the app's connection to a device stands right now.
    fun current(): ConnectionState
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SessionConnectionStatus.kt" hl_lines="1 2"
class SessionConnectionStatus(private val session: DeviceSession) : ConnectionStatus {
    override fun current(): ConnectionState = session.connectionState.value
}
```

1. **Một port theo cách nói của service đi hỏi.** `ConnectionStatus` có đúng một lời gọi mà trạng thái cần, bằng model của chính app core, `ConnectionState`. Fake của nó, `FakeConnectionStatus`, là một property và một method; một bản thay cho `DeviceSession` sẽ cần cả `connect`, `disconnect`, `services`, `read` và `subscribe` (`TestDeviceSession`, lớn dần qua các bài 14–16, dài 72 dòng).
2. **Bridge không giữ quy tắc nào.** Nó chuyển state của session đi nguyên như vậy: thế nào là đã kết nối vẫn nằm trong `StatusService` (mục 2), và máy trạng thái kết nối vẫn nằm trong `SessionService` (bài 16). Nếu có lúc một bridge có vẻ cần một `if`, quy tắc đó thuộc về một trong hai service, nơi test của chúng thấy được nó.
3. **Một outbound adapter, trong code dùng chung.** Nó nằm trong `adapter/outbound` cạnh radio giả lập: một outbound adapter mà "thế giới bên ngoài" của nó là một khả năng khác. Nó không chạm API nền tảng nào, nên một bản trong `commonMain` phục vụ cả hai nền tảng.
4. **Một định nghĩa được nới ra.** Bảng của bài 10 nói inbound adapter gọi inbound port; từ hôm nay, một bridge adapter cũng gọi được. Mọi thứ khác vẫn đúng: mọi outbound port được implement bởi một outbound adapter, và một service chỉ gọi outbound port.

Sao không dùng thứ gì gần hơn? Mỗi cách dưới đây ngắn hơn hoặc quen hơn, và mỗi cách phá một quy tắc mà khoá học dựa vào:

| Thay cho bridge | Nó phá gì |
|---|---|
| `StatusService` nhận `DeviceSession` và gọi trực tiếp | "Một service gọi outbound port" không còn đúng, và trạng thái phụ thuộc vào connect, read và subscribe chỉ để đọc một giá trị; test double của nó lớn theo chúng. |
| `SessionService` implement luôn `ConnectionStatus` | Một outbound port sẽ được implement bởi một service thay vì một adapter, và "outbound" sẽ không còn nghĩa "bên ngoài khả năng này". |
| một inbound port nhỏ chỉ-đọc trên session | Một inbound port chỉ dùng bên trong app core thì không còn là "thứ app cung cấp". |
| một chỗ giữ state dùng chung trong app core mà session ghi còn trạng thái đọc | Một loại thứ mới trong app core, và "ai được ghi nó" chỉ nằm trong quy ước. |
| domain event: session phát, các service khác đăng ký nghe | Được làm ra để phản ứng với những chuyện xảy ra, nhưng trạng thái cần state hiện tại, nên bus sẽ phải phát lại sự kiện mới nhất: một state flow có thêm một lớp. Nó còn thêm event, bus và publish/subscribe vào vốn từ của khoá học. |
| ViewModel danh sách kết hợp `StatusReport` với `DeviceSession` | "Connected" sẽ rời khỏi trạng thái của app core, và monitor nền của bài 18, thứ chạy mà không có màn hình nào, sẽ cần lại quy tắc đó ở chỗ khác. |

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="3 7"
⋯ imports; appModule's other bindings
    // One session for the whole app: every screen sees the same connection state.
    single<DeviceSession> { SessionService(get(), get()) }
    single<PermissionAccess> { PermissionService(get()) }
    single<StatusReport> { StatusService(get(), get(), get(), get()) }
    // The bridge adapter: the status asks ConnectionStatus, and the one session answers.
    single<ConnectionStatus> { SessionConnectionStatus(get()) }
```

Bridge được bind trong `appModule`, không trong `platformModule`: nó là code dùng chung, nên không nền tảng nào dựng nó. `get()` của nó tìm thấy đúng một `DeviceSession` mà các màn hình dùng, nên trạng thái đọc cùng kết nối mà màn hình chi tiết giữ. Ba test bao ba phần:

1. **Quy tắc**: `StatusServiceTest` dựng service với `FakeConnectionStatus` và đặt từng state (mục 2).
2. **Bridge**: `SessionConnectionStatusTest` điều khiển nó qua outbound port, theo cách `StatusService` gọi nó, với `TestDeviceSession` của bài 14–16 phía sau: mọi state test đặt đều quay về không đổi. Một bridge luôn trả lời `Disconnected` sẽ fail nó.
3. **Nối dây**: `AppModuleTest` có thêm `theStatusSeesTheAppsOneSession`. Nó kết nối qua `DeviceSession` của graph, với `FakeBleConnection` trả lời, rồi hỏi `StatusReport` của graph: `bluetoothConnected` phải là `true`. Với bridge dựng trên một session thứ hai, `SessionConnectionStatus(SessionService(get(), get()))`, nó fail (chúng tôi đã thử): session đó không bao giờ kết nối.

!!! warning "Gotcha · hai test graph trên một module cần close()"
    Lần chạy đầu của test graph mới fail với "Connecting needs the Bluetooth permission." dù test đã cấp quyền. `appModule` là một object, dùng chung bởi mọi test, và Koin 4.2.2 giữ instance của một `single` cùng definition của nó trong module (một `SingleInstanceFactory` giữ giá trị), nên `koinApplication` của test thứ hai nhận được session mà test đầu đã dựng, kèm fake quyền của test đầu. Gọi `app.close()` trong một `@AfterTest` bỏ các instance đó; hướng dẫn test của Koin đưa cùng quy tắc cho `startKoin`: "Mỗi test nên khởi động container riêng và dừng nó ở cuối." Tới giờ `AppModuleTest` chỉ có một test, nên chưa từng gặp chuyện này.

## 4. Android: ba adapter, hai quyền cấp lúc cài

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidStatusProviders.kt" hl_lines="7 13"
class AndroidBatteryProvider(context: Context) : BatteryProvider {
    private val battery = context.getSystemService(BatteryManager::class.java)

    // The charge left, in percent. An app that targets Android 9 or later gets Int.MIN_VALUE
    // when the phone can't tell.
    override fun level(): Int? =
        battery?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
}
⋯ AndroidNetworkProvider: below
class AndroidBluetoothProvider(context: Context) : BluetoothProvider {
    private val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter

    override suspend fun isEnabled(): Boolean? = adapter?.isEnabled // null: no Bluetooth radio
}
```

1. **Pin.** `BATTERY_PROPERTY_CAPACITY` là "Dung lượng pin còn lại dưới dạng phần trăm nguyên của tổng dung lượng". Nếu property không được hỗ trợ, `getIntProperty` trả về "(a) 0 nếu `targetSdkVersion < VERSION_CODES.P` hoặc (b) Integer.MIN_VALUE nếu `targetSdkVersion >= VERSION_CODES.P`" ([BatteryManager](https://developer.android.com/reference/android/os/BatteryManager)). App nhắm 36, nên câu trả lời không-hỗ-trợ là `Int.MIN_VALUE`, và `takeIf` biến nó thành `null`: việc của adapter là dịch từ ngữ của nền tảng sang từ ngữ của port.
2. **Bluetooth bật hay tắt** là `adapter?.isEnabled` của bài 13. Mã nguồn Android đánh dấu `BluetoothAdapter.isEnabled()` là `@RequiresNoPermission` (với quyền cũ `BLUETOOTH` tới Android 11, thứ manifest đã có), nên báo cáo trạng thái chạy được trước khi người dùng cho phép Nearby devices.

Adapter mạng là cái thú vị. Hướng dẫn của Android: "các method đồng bộ của `ConnectivityManager` không báo cho app về bất cứ thứ gì xảy ra sau một lời gọi", và "App có thể đăng ký một callback với `ConnectivityManager` để được báo về những thay đổi mà app quan tâm" ([Read network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state)).

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidStatusProviders.kt" hl_lines="3 7 11 15"
class AndroidNetworkProvider(context: Context) : NetworkProvider {
    private val wifi = context.getSystemService(WifiManager::class.java)
    private val networks = ConcurrentHashMap<Network, NetworkCapabilities>() // callbacks run on another thread

    init {
        // One registration for the life of the process: Koin keeps this adapter as long.
        context.getSystemService(ConnectivityManager::class.java).registerNetworkCallback(
            NetworkRequest.Builder().build(), // the default request: no VPNs, no restricted networks
            object : ConnectivityManager.NetworkCallback() {
                override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                    networks[network] = capabilities
                }

                override fun onLost(network: Network) {
                    networks.remove(network)
                }
            },
        )
    }
⋯ current(): below
```

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidStatusProviders.kt" hl_lines="4 5 6"
    override fun current(): NetworkStatus {
        val up = networks.values
        return NetworkStatus(
            wifiEnabled = wifi?.isWifiEnabled,
            wifiConnected = up.any { it.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) },
            cellularAvailable = up.any { it.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) },
        )
    }
```

1. **Một map mà các callback giữ cho cập nhật.** `onCapabilitiesChanged` tới cho mỗi mạng mà request khớp, và tới lại khi capability của nó đổi; hướng dẫn nói nó "được gọi ngay sau `onAvailable()` trên thiết bị chạy Android 8.0 (API 26) trở lên", mức tối thiểu của app. `onLost` gỡ nó đi. Khi đó `current()` là một lần đọc, không phải một lần truy vấn.
2. **`ConcurrentHashMap`**, vì "Mặc định, các method callback được gọi trên connectivity thread của app, một thread riêng mà `ConnectivityManager` dùng" (hướng dẫn), trong khi `current()` chạy trên main thread. Một `HashMap` thường dùng chung bởi hai thread có thể bị đọc khi mới cập nhật dở.
3. **`NetworkRequest` mặc định** không phải "mọi mạng". Trong mã nguồn Android, một `NetworkCapabilities` mới bắt đầu với `NOT_RESTRICTED`, `TRUSTED` và `NOT_VPN` (và `NOT_BANDWIDTH_CONSTRAINED` từ Android 15): VPN và các mạng dành cho app đặc quyền bị bỏ ra, đúng thứ một dòng trạng thái muốn.
4. **Không bao giờ huỷ đăng ký**: adapter được dựng một lần trong `Application.onCreate` và Koin giữ nó suốt đời process, nên lần đăng ký sống đúng chừng đó. Một adapter sống ngắn hơn sẽ gọi `unregisterNetworkCallback`; trang reference cảnh báo một app có giới hạn số callback được đăng ký.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 300" role="img" aria-labelledby="l17-cell-title">
      <title id="l17-cell-title">Những gì network callback của app thấy trên emulator API 36, theo thời gian từ trái sang phải. Làn trên, Wi-Fi: đã kết nối, rồi bị tắt, rồi bật lại. Làn dưới, mạng di động, luôn kết nối suốt thời gian đó. Khi Wi-Fi tắt, mạng di động là mạng của app và trạng thái nói cellular available. Một lúc sau khi Wi-Fi quay lại, mạng di động vẫn có thể được tính: 6 giây sau, trạng thái vẫn nói available ở một lần chạy, và đã nói no cellular ở một lần khác. Rồi Android chỉ giữ mạng di động ở nền, và một app không có quyền CHANGE_NETWORK_STATE được báo là mạng đã mất: tới 46 giây, trạng thái nói no cellular ở mọi lần chạy, dù hệ thống vẫn liệt kê mạng di động là đã kết nối.</title>
      <defs><marker id="l17-cell-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small" x="20" y="74">Wi-Fi</text>
      <text class="small" x="20" y="164">mạng di động</text>
      <line class="axis" x1="100" y1="70" x2="740" y2="70"></line>
      <line class="axis" x1="100" y1="160" x2="740" y2="160"></line>
      <g data-part="android">
        <rect class="box" x="100" y="55" width="150" height="30" rx="4"></rect>
        <text class="small" x="112" y="75">đã kết nối</text>
        <rect class="box" x="400" y="55" width="340" height="30" rx="4"></rect>
        <text class="small" x="412" y="75">kết nối lại</text>
        <rect class="box" x="100" y="145" width="640" height="30" rx="4"></rect>
        <text class="small" x="112" y="165">kết nối suốt thời gian (dumpsys connectivity)</text>
      </g>
      <text class="small muted" x="270" y="75">tắt</text>
      <circle class="dot" cx="320" cy="220" r="5"></circle>
      <text class="small" x="260" y="245">"cellular available"</text>
      <circle class="dot" cx="450" cy="220" r="5"></circle>
      <text class="small" x="410" y="245">6 s: vẫn available,</text>
      <text class="small" x="410" y="260">hoặc đã không còn</text>
      <circle class="dot dropped" cx="640" cy="220" r="5"></circle>
      <text class="small" x="590" y="245">46 s: "no cellular"</text>
      <path class="edge dashed" d="M560,178 L620,210" marker-end="url(#l17-cell-arrow)"></path>
      <text class="small muted" x="420" y="128">sau đó: mạng di động chỉ được giữ ở nền,</text>
      <text class="small muted" x="420" y="142">và callback của app nhận onLost</text>
      <text class="small muted" x="20" y="285">Chấm: thứ Refresh đã hiện. Điện thoại không bao giờ bỏ mạng di động; app chỉ thôi không được báo về nó.</text>
    </svg>
    <figcaption>"Available" nghĩa là "một mạng app này dùng được", và Android không tính một mạng nó giữ ở nền phía sau Wi-Fi.</figcaption>
  </figure>

Vì sao mạng di động biến mất trong khi nó vẫn lên: mã nguồn `ConnectivityService` của Android nói "Các app không có quyền CHANGE_NETWORK_STATE không dùng được mạng nền, nên cho mọi lần lắng nghe của chúng kèm NET_CAPABILITY_FOREGROUND. Như vậy, chúng sẽ nhận callback onLost và onAvailable khi mạng chuyển vào và ra khỏi nền." Hướng dẫn đồng ý từ phía bên kia: "Nếu app muốn dùng một mạng nền, nó cần quyền `CHANGE_NETWORK_STATE`." Thêm quyền đó vào manifest, emulator của chúng tôi báo "cellular available" cạnh Wi-Fi (chúng tôi đã thử, rồi gỡ ra lại). App không xin quyền đó: nó muốn báo cáo, không muốn đổi mạng của điện thoại, và comment của port nói rõ "available" nghĩa là gì.

```xml title="androidApp/src/main/AndroidManifest.xml" hl_lines="3 4"
⋯ the Bluetooth permissions and uses-feature, as in Lesson 13
    <!-- The phone's status (Lesson 17): install-time permissions, granted without a prompt. -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

1. **Cấp lúc cài, không phải lúc chạy.** Manifest của framework Android cho cả hai mức bảo vệ `normal` (`ACCESS_WIFI_STATE` là `android:protectionLevel="normal"`, `ACCESS_NETWORK_STATE` là `"normal|instant"`, cho phép cả instant app giữ nó): hệ thống cấp chúng lúc cài, không hộp thoại nào, và `PermissionAccess` của bài 12 không có việc gì để làm.
2. **Cả hai đều bị kiểm tra.** `registerNetworkCallback` được đánh dấu `@RequiresPermission(android.Manifest.permission.ACCESS_NETWORK_STATE)`, và `WifiManager.isWifiEnabled` được Wi-Fi service kiểm tra. Chúng tôi lần lượt gỡ từng dòng: thiếu dòng đầu, app crash lúc mở với "SecurityException: ConnectivityService: Neither user … nor current process has android.permission.ACCESS_NETWORK_STATE"; thiếu dòng thứ hai, crash ở lần đọc trạng thái đầu tiên, cùng thông báo đó từ WifiService và `ACCESS_WIFI_STATE`.

!!! warning "Gotcha · hướng dẫn nói không cần quyền; reference và app nói khác"
    Hướng dẫn Read network state của Android nói "Dùng `NetworkCallback` và các cách khác để biết trạng thái kết nối của thiết bị không cần quyền đặc biệt nào." Chú thích trong API reference và lần crash của chúng tôi nói khác với `registerNetworkCallback`. Khi một hướng dẫn và trang reference của chính method đó nói khác nhau, hãy tin reference, rồi chạy thử.

## 5. iOS: ba adapter Swift

Trên iOS, ba adapter trạng thái là các class Swift trong app iOS implement các protocol Kotlin, mẫu của bài 12. Chúng nằm chung một file, dùng bởi cả hai track iOS:

```swift title="iosApp/iosApp/IosStatusProviders.swift" hl_lines="5 10 12"
@MainActor
final class IosBatteryProvider: @preconcurrency BatteryProvider {
    init() {
        // Without this, batteryLevel is always -1.0.
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    // batteryLevel runs from 0.0 to 1.0, or is -1.0 when iOS can't tell (on the Simulator,
    // always). A Kotlin Int? crosses as KotlinInt?.
    func level() -> KotlinInt? {
        let level = UIDevice.current.batteryLevel
        guard level >= 0 else { return nil }
        return KotlinInt(int: Int32((level * 100).rounded()))
    }
}
```

1. **Theo dõi pin mặc định tắt.** Apple: "Mức pin trong khoảng từ 0.0 (cạn hết) tới 1.0 (sạc 100%). Trước khi truy cập property này, hãy chắc rằng việc theo dõi pin đã được bật. Nếu chưa bật, trạng thái pin là không biết và giá trị của property này là –1.0" ([batteryLevel](https://developer.apple.com/documentation/uikit/uidevice/batterylevel)). Trên Simulator iOS 26.2 nó vẫn là –1.0 khi đã bật theo dõi, nên màn hình ở đó ghi "Battery unknown"; một mức pin thật phải chờ iPhone của bạn (một kiểm tra trên thiết bị).
2. **`KotlinInt?`**: một `Int?` của Kotlin không thể là `Int?` của Swift trong header Objective-C, nên nó đi qua dưới dạng một số được đóng hộp (header có `- (SharedInt * _Nullable)level`, thứ Swift thấy là `KotlinInt?`). Một `Boolean` non-null vẫn là `Bool` trơn, như constructor của `NetworkStatus` cho thấy bên dưới.
3. **`@MainActor`**, vì `UIDevice` là UIKit, và UIKit là code chạy trên main thread. Phần tuân theo protocol `@preconcurrency` (bài 12) kiểm tra lúc chạy rằng Kotlin gọi nó trên main thread, thứ `viewModelScope` của màn hình danh sách đảm bảo.

```swift title="iosApp/iosApp/IosStatusProviders.swift" hl_lines="3 4 7 15 16"
@MainActor
final class IosNetworkProvider: @preconcurrency NetworkProvider {
    private let wifi = NWPathMonitor(requiredInterfaceType: .wifi)
    private let cellular = NWPathMonitor(requiredInterfaceType: .cellular)

    init() {
        wifi.start(queue: .main)
        cellular.start(queue: .main)
    }

    // The Network framework reports paths, not whether the Wi-Fi radio is switched on, so
    // wifiEnabled is nil: unknown.
    func current() -> NetworkStatus {
        NetworkStatus(
            wifiEnabled: nil,
            wifiConnected: wifi.currentPath.status == .satisfied,
            cellularAvailable: cellular.currentPath.status == .satisfied
        )
    }
}
```

1. **Mỗi loại interface một monitor.** `NWPathMonitor` là "Một observer bạn dùng để theo dõi và phản ứng với thay đổi mạng"; `init(requiredInterfaceType:)` "Khởi tạo một path monitor để quan sát một loại interface cụ thể"; `currentPath` là "Đường mạng hiện có mà path monitor quan sát được"; và `start(queue:)` "Bắt đầu theo dõi thay đổi đường mạng" ([NWPathMonitor](https://developer.apple.com/documentation/network/nwpathmonitor)). Một path `.satisfied` qua Wi-Fi nghĩa là đã kết nối; qua mạng di động, là có một mạng di động app dùng được. Giống adapter Android, nó cứ lắng nghe và `current()` chỉ đọc.
2. **Không có "Wi-Fi đang bật".** Một `NWPath` có status, các interface nó dùng, gateway, và việc nó có tốn tiền hay bị hạn chế không, cùng các mục khác trong reference của Apple, nhưng không có property nào nói radio Wi-Fi có bật không. Gần nhất là `unsatisfiedReason`, mà case `wifiDenied` được header mô tả là "Người dùng đã tắt Wi-Fi"; nhưng một lý do chỉ đi kèm một path chưa thoả, và "Trong nhiều trường hợp, path có thể chưa thoả mà không có lý do nào" (`path.h`), nên nó không trả lời được "bật hay tắt". Vì vậy adapter nói `nil`, và quy tắc của mục 2 điền `true` mỗi khi Wi-Fi đã kết nối.
3. **Trên Simulator**, với máy Mac đang dùng Wi-Fi, monitor Wi-Fi đã thoả ("Wi-Fi connected") và monitor mạng di động thì không ("no cellular"). Một iPhone đang dùng Wi-Fi báo gì về mạng di động là một kiểm tra trên thiết bị: đừng giả định nó khớp với câu trả lời của Android ở mục 4.

```swift title="iosApp/iosApp/IosStatusProviders.swift" hl_lines="2 5 8 13"
⋯ IosBluetoothProvider: NSObject, BluetoothProvider, CBCentralManagerDelegate, @MainActor
    func __isEnabled() async throws -> KotlinBoolean? {
        // Creating a CBCentralManager is what shows the Bluetooth prompt, and only an allowed
        // app learns the radio's state: until then, say "unknown" and create nothing.
        guard CBManager.authorization == .allowedAlways else { return nil }
        let manager = self.manager ?? makeManager()
        if manager.state == .unknown || manager.state == .resetting {
            await withCheckedContinuation { waiting.append($0) }
        }
        switch manager.state {
        case .poweredOn: return KotlinBoolean(bool: true)
        case .poweredOff: return KotlinBoolean(bool: false)
        default: return nil // unsupported (the Simulator) or unauthorized
        }
    }
⋯ centralManagerDidUpdateState resumes everyone waiting, once the state is known; makeManager as in IosBleScanner
```

1. **Chặn trước.** Bài 12: đọc `CBManager.authorization` không bao giờ hiện hộp thoại, và hộp thoại hiện khi app dùng Bluetooth lần đầu, bằng cách tạo một `CBCentralManager`. Màn hình danh sách đọc trạng thái ngay khi hiện ra; không có điều kiện chặn, dòng trạng thái sẽ làm hiện hộp thoại hệ thống trước khi người dùng kịp bấm "Allow Bluetooth". Comment của port hứa "Never shows a permission prompt", và dòng này giữ lời hứa đó.
2. **Cách chờ của bài 13**, chép lại: một manager mới là `.unknown` cho tới `centralManagerDidUpdateState`, nên lời gọi chờ callback đó. Trên Simulator, state lúc đó là `.unsupported`: "Bluetooth unknown", kể cả sau khi bạn cho phép Bluetooth.
3. **`__isEnabled`**, `suspend fun` của Kotlin khi Swift implement nó (như `__request` của bài 12), trả về `KotlinBoolean?` cho `Boolean?` của Kotlin.

Cả hai cách khởi động app iOS truyền ba adapter vào Koin, sau các adapter BLE; `DeviceMonitorApplication` của Android làm y vậy với tham số có tên, giờ đã có sáu:

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="5 6 7"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: LinkedBleConnection(link: IosBleConnection()),
                batteryProvider: IosBatteryProvider(),
                networkProvider: IosNetworkProvider(),
                bluetoothProvider: IosBluetoothProvider()
            )
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="5 6 7"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: LinkedBleConnection(link: IosBleConnection()),
                batteryProvider: IosBatteryProvider(),
                networkProvider: IosNetworkProvider(),
                bluetoothProvider: IosBluetoothProvider()
            )
    ```


`IosStatusProviders.swift` là một file mới, nên chạy `xcodegen generate` trong `iosApp/` (bài 13): `project.yml` liệt kê thư mục, không liệt kê file. Trong `di/AppModule.kt`, `initKoin` và `platformModule` nhận ba adapter mới, và `appModule` có thêm `single<StatusReport> { StatusService(get(), get(), get(), get()) }` cùng bridge của mục 3. Test graph của bài 11 đã xin `DeviceListViewModel`, thứ giờ cần một `StatusReport`, nên một binding bị thiếu sẽ làm nó fail.

## 6. Một dòng trên màn hình danh sách

ViewModel danh sách nhận inbound port và biến mỗi `DeviceStatus` thành một dòng chữ, giống nhau trên mọi track:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt" hl_lines="3 6 7"
    // The screen calls this when it appears, when the app comes back to the foreground, and from
    // its Refresh button: each call reads the status again.
    fun refreshStatus() {
        if (statusJob?.isActive == true) return
        statusJob = viewModelScope.launch {
            val current = statusReport.current()
            _uiState.update { it.copy(phoneStatus = describe(current)) }
        }
    }
⋯ describe(s): "Battery 82 %", "Wi-Fi connected", "cellular available", "Bluetooth on", joined with " · "
```

1. **Đọc khi nó có thể đã đổi**: màn hình hiện ra (kể cả khi quay về từ màn hình chi tiết), app quay lại foreground (người dùng có thể đã bật tắt Wi-Fi trong Settings), và Refresh. Không gì hỏi định kỳ: danh sách là màn hình đầu của app và ở lại trong bộ nhớ dưới màn hình chi tiết, nên một bộ hẹn giờ trong ViewModel của nó sẽ cứ chạy trong khi không ai nhìn. Bộ hẹn giờ là chủ đề của bài 18.
2. **Câu chữ nằm trong ViewModel**, không nằm trong bốn màn hình: "unknown" cho pin hay trạng thái Bluetooth là `null`, và với Wi-Fi, "off", "connected", "on, not connected", hoặc chỉ "not connected" khi nền tảng không nói được. `showsThePhoneStatusAsOneLine` và `saysWhatThePhoneCantTell` ghim đúng câu chữ.
3. **`phoneStatus`** bắt đầu là "Reading the phone's status…" trong `DeviceListUiState`. Các test ViewModel có sẵn chỉ thêm `TestStatusReport` mới vào constructor: không cái nào gọi `refreshStatus()`, nên chuỗi Turbine của chúng không thấy state thừa nào.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="2 4 14 16"
        // Back from Settings (or anywhere else): the permission and the status may have changed.
        LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
            viewModel.refreshPermission()
            viewModel.refreshStatus()
        }
    ⋯ DeviceListContent gets phoneStatus and onRefreshStatus, and shows PhoneStatusRow under the title
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
    ```

    `ON_RESUME` tới khi màn hình hiện lần đầu, khi quay lại foreground, và khi danh sách trở lại trên cùng sau màn hình chi tiết: trên emulator, đổi mức pin khi màn hình chi tiết đang mở rồi nhấn Back hiện mức mới mà không cần bấm Refresh. `Modifier.weight(1f)` cho đoạn chữ phần chỗ mà nút không cần, nên một dòng dài sẽ xuống dòng thay vì đẩy Refresh ra khỏi màn hình.

=== "XML"

    ```xml title="androidApp/src/main/res/layout/fragment_device_list.xml" hl_lines="2 5 11"
        <!-- The phone's own status, as the ViewModel words it, and a button to read it again. -->
        <LinearLayout
            android:id="@+id/phoneStatusRow"
    ⋯ under the title, full width, center_vertical
            android:orientation="horizontal"
    ⋯ constraints: start, end, top_toBottomOf title
            <TextView
                android:id="@+id/phoneStatusText"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:textAppearance="@style/TextAppearance.AppCompat.Small" />

            <Button
                android:id="@+id/refreshStatusButton"
                style="?attr/borderlessButtonStyle"
    ⋯ wrap_content, "Refresh"
        </LinearLayout>
    ⋯ filterInput: layout_constraintTop_toBottomOf="@id/phoneStatusRow"
    ```

    Một `LinearLayout` ngang với một `TextView` có trọng số là cách ngắn nhất để đặt chữ và nút cạnh nhau khi chữ có thể xuống dòng: hai view ràng buộc cạnh nhau trong `ConstraintLayout` sẽ cần một barrier để ô bộ lọc nằm dưới cái nào cao hơn. Trong `DeviceListFragment`, nút gọi `viewModel.refreshStatus()`, `onResume()` gọi nó cạnh `refreshPermission()`, và `render` gán `b.phoneStatusText.text = state.phoneStatus`. Một Fragment được resume lại khi nó quay về từ màn hình chi tiết; trên emulator, một thay đổi pin khi màn hình chi tiết đang mở hiện ra sau Back.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="2 7"
            // Shown, and back from the detail screen: the status may have changed.
            .onAppear { viewModel.refreshStatus() }
            // Back from Settings (or anywhere else): the permission and the status may have changed.
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    viewModel.refreshPermission()
                    viewModel.refreshStatus()
                }
            }
    ```

    `scenePhase` bao việc quay lại foreground, nhưng không bao đường quay về từ màn hình chi tiết, nơi scene vẫn active; `onAppear` bao cái đó, và lần hiện đầu tiên. Chúng tôi đã kiểm tra bằng một adapter pin tạm có đếm số lần đọc: hai lần lúc mở (cả hai hook đều chạy), rồi một lần cho Refresh và một lần cho Back từ màn hình chi tiết. `PhoneStatusRow` là một `HStack` gồm đoạn chữ, `.frame(maxWidth: .infinity, alignment: .leading)`, và một nút Refresh.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="2 9"
            // The label takes the room the button doesn't need.
            refreshStatusButton.setContentHuggingPriority(.required, for: .horizontal)
            refreshStatusButton.setContentCompressionResistancePriority(.required, for: .horizontal)
    ⋯ phoneStatusRow, a UIStackView of the label and the button, goes first in the screen's stack; then:
        // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android. Shown, and back
        // from the detail screen: the status may have changed.
        override func viewWillAppear(_ animated: Bool) {
            super.viewWillAppear(animated)
            viewModel.refreshStatus()
    ```

    `sceneDidActivate` gọi `refreshStatus()` cạnh `refreshPermission()`, và `render` gán `phoneStatusLabel.text`. Không có hai priority, một dòng trạng thái dài có thể bóp nhỏ nút trong một stack view ngang. Pop màn hình chi tiết thì gọi lại `viewWillAppear` của danh sách: một adapter pin tạm có đếm số lần đọc thấy một lần lúc mở, một lần lúc Refresh và một lần sau Back.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Cùng một hàng ở cả hai: chữ chiếm phần rộng còn thừa, và một nút Refresh không viền. Compose nói điều đó bằng `Modifier.weight(1f)` trong một `Row`; XML bằng `layout_weight="1"` và `layout_width="0dp"` trong một `LinearLayout` ngang. Cả hai làm mới khi resume, thứ trên cả hai đều quay lại sau màn hình chi tiết.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    SwiftUI cần hai hook, `onAppear` và `scenePhase`; UIKit cũng hai cái tương ứng, `viewWillAppear` và notification của scene mà nó đã quan sát sẵn. UIKit còn cần các priority hugging và compression mà modifier frame của SwiftUI làm cho không cần thiết.

## 7. Kho log: một port, và một định dạng file

Một monitor đọc trạng thái vài phút một lần cần chỗ để giữ mỗi lần đọc, qua nhiều lần mở app. Theo cách nói của app, đó là một outbound port với ba lời gọi:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/LogStore.kt" hl_lines="7 11 14"
// Outbound port: where the app keeps its log records, oldest first, across launches.
// One adapter per platform, both writing JSON Lines (one JSON object per line): Kotlin in
// androidMain, and Kotlin in iosMain over Apple's Foundation. Each call throws LogStoreException
// when the file system refuses.
interface LogStore {
    // Adds the record at the end of the log.
    suspend fun append(record: LogRecord)

    // Every record, oldest first; empty if none was ever appended, or after clear(). Also throws
    // LogStoreException if a line in the file isn't a record.
    suspend fun read(): List<LogRecord>

    // Removes every record.
    suspend fun clear()
}
```

1. **`LogRecord`** là `data class LogRecord(val timestamp: Instant, val status: DeviceStatus)`: một trạng thái và thời điểm nó được đọc. `kotlin.time.Instant` là thời điểm của thư viện chuẩn ("Từ Kotlin 2.3"), nên app core không cần thư viện ngày giờ nào.
2. **Lỗi theo cách nói của app.** Đĩa đầy hay file hỏng thành `LogStoreException`, một exception của core như `ScanException` của bài 13, kèm thông báo nói cái gì đã hỏng. Bên gọi không bao giờ thấy `IOException` hay `NSError`: đó là từ ngữ của từng nền tảng.
3. **`suspend`**, vì lời gọi file chặn thread chúng chạy trên; các adapter dời chúng sang `Dispatchers.IO`, và một coroutine gọi từ main thread sẽ treo cho tới khi lời gọi file xong, trong khi main thread vẫn rảnh (bài 07).

[JSON Lines](https://jsonlines.org/) là định dạng: chữ UTF-8, mỗi dòng một giá trị JSON hợp lệ, các dòng kết thúc bằng `\n`. Thêm vào là ghi thêm một dòng ở cuối, không đụng gì khác trong file, và người đọc có thể đọc từng dòng một. Các trường là bản ghi ví dụ của kế hoạch khoá học:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 360" role="img" aria-labelledby="l17-log-title">
      <title id="l17-log-title">Các phần của kho log. Trong app core, outbound port LogStore. Trong code dùng chung ở commonMain, JsonLines biến một LogRecord thành một dòng JSON và biến chữ của file trở lại thành bản ghi; cả hai adapter dùng nó. Trên Android, AndroidLogStore, Kotlin trong androidMain, ghi file bằng java.io. Trên iOS, IosLogStore, Kotlin trong iosMain, ghi nó bằng Foundation của Apple: NSFileManager và NSFileHandle. Cả hai ghi cùng một định dạng file, hiện thành hai dòng JSON, mỗi dòng một bản ghi. Trong test, LogStoreContract trong commonTest giữ năm test viết một lần; AndroidLogStoreTest chạy chúng trên JVM với AndroidLogStore, và IosLogStoreTest chạy chúng trong iOS simulator với IosLogStore.</title>
      <defs><marker id="l17-log-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="outbound">
        <rect class="box" x="20" y="20" width="150" height="44" rx="6"></rect>
        <text class="mono small" x="34" y="47">LogStore (port)</text>
        <rect class="box" x="300" y="20" width="160" height="44" rx="6"></rect>
        <text class="mono small" x="314" y="40">JsonLines</text>
        <text class="small muted" x="314" y="56">dùng chung, commonMain</text>
      </g>
      <g data-part="android">
        <rect class="box" x="20" y="110" width="220" height="56" rx="6"></rect>
        <text class="mono small" x="32" y="132">AndroidLogStore</text>
        <text class="small muted" x="32" y="152">Kotlin, androidMain · java.io</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="520" y="110" width="220" height="56" rx="6"></rect>
        <text class="mono small" x="532" y="132">IosLogStore</text>
        <text class="small muted" x="532" y="152">Kotlin, iosMain · Foundation</text>
      </g>
      <path class="edge dashed" d="M130,108 L100,66" marker-end="url(#l17-log-arrow)"></path>
      <path class="edge dashed" d="M560,108 L172,50" marker-end="url(#l17-log-arrow)"></path>
      <path class="edge" d="M240,124 L330,66" marker-end="url(#l17-log-arrow)"></path>
      <path class="edge" d="M540,108 L430,66" marker-end="url(#l17-log-arrow)"></path>
      <rect class="box" x="20" y="196" width="720" height="64" rx="6"></rect>
      <text class="small muted" x="32" y="214">status-log.jsonl: mỗi dòng một bản ghi</text>
      <text class="mono small" x="32" y="234">{"timestamp":"2026-09-11T10:30:00Z","battery":82,"wifiEnabled":true,…,"bluetoothConnected":false}</text>
      <text class="mono small" x="32" y="252">{"timestamp":"2026-09-11T10:45:00Z","battery":null,"wifiEnabled":true,…,"bluetoothConnected":false}</text>
      <path class="edge" d="M130,166 L130,194" marker-end="url(#l17-log-arrow)"></path>
      <path class="edge" d="M630,166 L630,194" marker-end="url(#l17-log-arrow)"></path>
      <g data-part="inbound">
        <rect class="box" x="250" y="286" width="260" height="44" rx="6"></rect>
        <text class="mono small" x="262" y="306">LogStoreContract</text>
        <text class="small muted" x="262" y="322">commonTest: 5 test, viết một lần</text>
        <rect class="box" x="20" y="286" width="200" height="44" rx="6"></rect>
        <text class="mono small" x="32" y="306">AndroidLogStoreTest</text>
        <text class="small muted" x="32" y="322">trên JVM</text>
        <rect class="box" x="540" y="286" width="200" height="44" rx="6"></rect>
        <text class="mono small" x="552" y="306">IosLogStoreTest</text>
        <text class="small muted" x="552" y="322">trong iOS simulator</text>
      </g>
      <path class="edge" d="M222,308 L248,308" marker-start="url(#l17-log-arrow)"></path>
      <path class="edge" d="M512,308 L538,308" marker-end="url(#l17-log-arrow)"></path>
      <text class="small muted" x="20" y="352">Đứt: implement port. Liền: dùng hoặc ghi. Hai subclass của contract, mỗi cái mở rộng nó với adapter của nền tảng mình.</text>
    </svg>
    <figcaption>Một port, một định dạng file, hai adapter trên file thật, và một bộ test cho cả hai.
<ul class="legend">
    <li data-part="outbound">Outbound port và code adapter dùng chung</li>
    <li data-part="android">Adapter Android</li>
    <li data-part="ios">Adapter iOS</li>
    <li data-part="inbound">Test</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/JsonLines.kt" hl_lines="1 2 5 12"
internal object JsonLines {
    @Serializable
    private class Line(
        val timestamp: String,
        val battery: Int?,
⋯ wifiEnabled, wifiConnected, cellularAvailable, bluetoothEnabled, bluetoothConnected
    )

    // One record as one line of JSON, without the line break.
    fun encode(record: LogRecord): String {
⋯ val line = Line(record.timestamp.toString(), …the six status fields…)
        return Json.encodeToString(line)
    }
⋯ decode(text): below
```

1. **Class JSON nằm trong adapter.** `@Serializable` làm compiler plugin kotlinx.serialization sinh encoder và decoder cho `Line`. Đặt nó lên `LogRecord` thay vào sẽ bắt app core import một thư viện serialization và uốn model của nó theo một định dạng file; checklist refactor của Appendix B nói app core không import framework nào. `JsonLines` là `internal`: thấy được với adapter của cả hai nền tảng trong module `shared`, và với test của nó, nhưng không thấy được với Swift.
2. **Những thứ không biết được ghi là `null`.** `explicitNulls` của kotlinx.serialization "Chỉ định giá trị `null` có được mã hoá cho các property nullable hay không và có bắt buộc có mặt trong object JSON khi giải mã hay không", và nó "mặc định là `true`" ([JsonBuilder.explicitNulls](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-builder/explicit-nulls.html)). Nên mỗi dòng có đủ mọi trường, và một dòng thiếu `"battery"` không phải là bản ghi.
3. **Timestamp kết thúc bằng `Z`.** `Instant.toString()` "Chuyển instant này thành chuỗi theo ISO 8601, ví dụ `2023-01-02T23:40:57.120Z`" ([Instant](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.time/-instant/)): UTC, nên một log đọc ở múi giờ khác vẫn mang cùng các thời điểm. Bản ghi ví dụ của kế hoạch khoá học bỏ múi giờ; của chúng ta giữ nó, và `aRecordIsOneLineOfJsonWithTheExampleFields` kiểm tra cả dòng.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/JsonLines.kt" hl_lines="4 5 7 9 10"
    // Every record in the file's text, in order. Blank lines are skipped; any other line that
    // isn't a record fails the whole read, with its line number.
    fun decode(text: String): List<LogRecord> =
        text.lines().mapIndexedNotNull { index, line ->
            if (line.isBlank()) return@mapIndexedNotNull null
            try {
                val l = Json.decodeFromString<Line>(line)
⋯ val status = DeviceStatus(…the six fields of l…)
                LogRecord(Instant.parse(l.timestamp), status)
            } catch (e: IllegalArgumentException) { // kotlinx.serialization's errors, and Instant.parse's
                throw LogStoreException("Line ${index + 1} of the log isn't a record: ${e.message}")
            }
        }
```

1. **Dòng trống** phần lớn là dòng cuối: một file kết thúc bằng `\n`, như mọi dòng chúng ta ghi, tách ra thành các dòng và một chuỗi rỗng sau chúng.
2. **Bắt `IllegalArgumentException`** là lời khuyên của chính thư viện: "`SerializationException` là subclass của `IllegalArgumentException`", và "Với các mẫu "bắt tất cả" quanh việc giải mã dữ liệu có thể không đáng tin/không hợp lệ/bị hỏng, nên bắt `IllegalArgumentException`" ([SerializationException](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-core/kotlinx.serialization/-serialization-exception/)). `Instant.parse` ném cùng kiểu đó cho một timestamp hỏng.
3. **Một dòng hỏng làm thất bại cả lần đọc**, kèm số dòng. Một dòng cuối ghi dở sau một lần crash là trường hợp kinh điển; app này báo nó thay vì giấu đi, và `clear()` bắt đầu lại từ đầu. Một monitor buộc phải chạy tiếp có thể bỏ qua dòng hỏng: đó sẽ là một quy tắc trong hợp đồng của port, kèm một test.

Plugin vào `shared/build.gradle.kts` dưới dạng `id("org.jetbrains.kotlin.plugin.serialization")`, cạnh `implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")` trong `commonMain`. `build.gradle.kts` gốc của track Compose đã khai báo plugin này, `version "2.4.20" apply false`, cho các route navigation của bài 07; file gốc của track XML thêm đúng một dòng đó, không thì Gradle không tìm thấy plugin.

## 8. Android: java.io và một cái khoá

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidLogStore.kt" hl_lines="1 6 11 14 15"
class AndroidLogStore(private val file: File) : LogStore {
    private val lock = Mutex() // one file operation at a time, so lines never interleave

    override suspend fun append(record: LogRecord) = io("Couldn't write to the log") {
        file.parentFile?.mkdirs()
        file.appendText(JsonLines.encode(record) + "\n")
    }
⋯ read: JsonLines.decode(file.readText()), or emptyList() if there's no file; clear: file.delete()
    // File calls block their thread, so they run on Dispatchers.IO, never on the main thread.
    private suspend fun <T> io(what: String, block: () -> T): T = lock.withLock {
        withContext(Dispatchers.IO) {
            try {
                block()
            } catch (e: IOException) {
                throw LogStoreException("$what: ${e.message}")
            }
        }
    }
}
```

1. **Một `File`, không phải một `Context`.** Adapter không dùng gì của Android, chỉ `java.io`, nên test JVM chạy nó trên một file tạm thật. Khi app bind nó (bài 18), nó có thể truyền một file trong bộ nhớ riêng, `File(filesDir, …)`.
2. **`Dispatchers.IO`** là dispatcher coroutine "được thiết kế để đẩy các tác vụ IO chặn sang một pool thread dùng chung" ([Dispatchers.IO](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-i-o.html)). Quy tắc của bài 07: đừng chặn main thread.
3. **`Mutex` của bài 15** lần nữa: hai lần thêm cùng lúc trên một pool thread có thể xen kẽ byte của nhau. Giữ khoá quanh cả mỗi lời gọi giữ cho mỗi dòng nguyên vẹn.

## 9. iOS: Kotlin gọi Foundation

Mọi adapter iOS tới giờ làm việc nền tảng bằng Swift; nửa Kotlin của chúng trong `iosMain` dựng các `Flow` và chuyển lời gọi qua lại. Kho log không cần gì mà một class Swift làm tốt hơn: không delegate, không main thread, chỉ file. Và bằng Kotlin, nó dùng chung `JsonLines` với Android và chạy trong `iosSimulatorArm64Test` từ Gradle. Bài 05 đã cho thấy ý tưởng trong một dòng, `import platform.UIKit.UIDevice`: Kotlin/Native đóng gói các framework của Apple thành package Kotlin, và "các framework hệ thống được import mặc định" ([Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html)).

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStore.kt" hl_lines="2 3 5 7 12 13"
⋯ imports: kotlinx.cinterop (alloc, memScoped, ptr, value, ObjCObjectVar), kotlinx.coroutines.IO, platform.Foundation.*
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class IosLogStore(private val path: String) : LogStore {
    // For the app: status-log.jsonl in the app's Application Support folder.
    constructor() : this(applicationSupportFile("status-log.jsonl"))

    private val files = NSFileManager.defaultManager
    private val folder = path.substringBeforeLast('/')
    private val lock = Mutex() // one file operation at a time, so lines never interleave

    override suspend fun append(record: LogRecord) = io {
        val text = NSString.create(string = JsonLines.encode(record) + "\n")
        val data = checkNotNull(text.dataUsingEncoding(NSUTF8StringEncoding))
⋯ then the file calls: below
```

1. **Objective-C, nhìn từ Kotlin.** `NSFileManager.defaultManager` là class property. `NSString.create(string = …)` là initializer `-initWithString:`: "Một initializer Swift/Objective-C được import sang Kotlin thành constructor hoặc thành factory method tên `create`. Trường hợp sau xảy ra với các initializer khai báo trong category của Objective-C", và `NSString.h` khai báo cái này trong một category. `dataUsingEncoding` trả về `NSData?` vì header ghi `nullable`. Các tên là của Objective-C, không phải của Swift: `FileManager.default` trong Swift ở đây là `NSFileManager.defaultManager`.
2. **Hai opt-in.** Hướng dẫn của Kotlin: "Các thư viện nền tảng native đi kèm Kotlin/Native (như Foundation, UIKit và POSIX) chỉ đòi opt-in cho một số API". Ở đây, `memScoped`, `alloc`, `.ptr` và mọi lời gọi Foundation nhận con trỏ cần `@ExperimentalForeignApi` (thiếu nó, build fail), còn `NSString.create` và việc đọc `.value` của biến error cần `@BetaInteropApi` (thiếu nó, một cảnh báo). Một `@OptIn` trên class bao cả hai.
3. **Hai constructor**, vì header Objective-C không có tham số mặc định: class tự khai báo constructor không tham số, và header có cả `init()` lẫn `init(path:)`. App sẽ dùng `IosLogStore()` khi bài 18 bind nó; các test truyền một đường dẫn tạm. Chúng tôi đã chạy cái không tham số một lần trong một test iOS tạm: hai lần thêm, hai bản ghi, đã xoá.

Các lời gọi file của Foundation báo lỗi theo cách của Objective-C. Hướng dẫn của Kotlin nói rõ nó sẽ không dịch: "Các method ném lỗi của Swift/Objective-C không được import sang Kotlin dưới dạng ném exception." Nên code Kotlin làm đúng như code Objective-C, và truyền địa chỉ của một biến để nhận lỗi:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 290" role="img" aria-labelledby="l17-err-title">
      <title id="l17-err-title">Một lỗi Foundation tới Kotlin bằng cách nào. Bên trong một khối memScoped, Kotlin cấp phát một biến chứa được một NSError, ban đầu là null. Nó gọi createDirectoryAtPath với error.ptr, địa chỉ của biến đó. Foundation thất bại, trả về false, và ghi một NSError vào biến ở địa chỉ đó. Kotlin thấy false, đọc localizedDescription của error.value, và ném một LogStoreException kèm nó. Khi khối kết thúc, bộ nhớ của biến được giải phóng và con trỏ không còn hợp lệ.</title>
      <defs><marker id="l17-err-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="outbound">
        <rect class="box" x="20" y="30" width="420" height="220" rx="6"></rect>
        <text class="title small" x="34" y="52">memScoped { … }: Kotlin, iosMain</text>
        <rect class="box" x="40" y="70" width="250" height="44" rx="4"></rect>
        <text class="mono small" x="52" y="90">error: ObjCObjectVar&lt;NSError?&gt;</text>
        <text class="small muted" x="52" y="106">alloc&lt;…&gt;(): ban đầu là null</text>
        <text class="mono small" x="40" y="150">createDirectoryAtPath(folder, true, null, error.ptr)</text>
        <text class="mono small" x="40" y="196">false → failure(…, error)</text>
        <text class="small" x="40" y="216">đọc error.value?.localizedDescription</text>
        <text class="small" x="40" y="234">ném LogStoreException</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="540" y="110" width="200" height="70" rx="6"></rect>
        <text class="title small" x="552" y="134">Foundation</text>
        <text class="small" x="552" y="154">thất bại: trả về NO,</text>
        <text class="small" x="552" y="170">ghi NSError</text>
      </g>
      <path class="edge" d="M410,146 L538,140" marker-end="url(#l17-err-arrow)"></path>
      <text class="small muted" x="440" y="130">địa chỉ</text>
      <path class="edge dashed" d="M540,120 L292,92" marker-end="url(#l17-err-arrow)"></path>
      <text class="small muted" x="420" y="88">vào biến</text>
      <path class="edge dashed" d="M540,172 L250,190" marker-end="url(#l17-err-arrow)"></path>
      <text class="small muted" x="20" y="275">Sau khối, bộ nhớ của biến được giải phóng: "Khi luồng điều khiển rời khỏi scope memScoped, các con trỏ C không còn hợp lệ."</text>
    </svg>
    <figcaption>Một tham số out: Kotlin sở hữu biến, Foundation điền vào, và <code>memScoped</code> giải phóng nó.</figcaption>
  </figure>

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStore.kt" hl_lines="1 2 4 8 14 15"
        memScoped {
            val error = alloc<ObjCObjectVar<NSError?>>()
            // Application Support doesn't exist until an app creates it.
            if (!files.createDirectoryAtPath(folder, true, null, error.ptr)) {
                throw failure("Couldn't create the log's folder", error)
            }
            if (!files.fileExistsAtPath(path)) {
                if (!files.createFileAtPath(path, data, null)) throw LogStoreException("Couldn't create the log file.")
                return@memScoped
            }
            val handle = NSFileHandle.fileHandleForWritingToURL(NSURL.fileURLWithPath(path), error.ptr)
                ?: throw failure("Couldn't open the log file", error)
            try {
                if (!handle.seekToEndReturningOffset(null, error.ptr)) throw failure("Couldn't open the log file", error)
                if (!handle.writeData(data, error.ptr)) throw failure("Couldn't write to the log", error)
            } finally {
                handle.closeAndReturnError(null)
            }
        }
⋯ failure(what, error) = LogStoreException("$what: ${error.value?.localizedDescription}")
```

1. **`memScoped`, `alloc`, `.ptr`.** Hướng dẫn của Kotlin: "bạn có thể dùng `memScoped { }`. Bên trong cặp ngoặc, vùng đặt tạm có sẵn dưới dạng receiver ngầm định, nên có thể cấp phát bộ nhớ native bằng alloc và allocArray, và bộ nhớ đã cấp phát sẽ tự được giải phóng khi rời scope"; `.ptr` "lấy lvalue và trả về con trỏ tới nó" ([Interoperability with C](https://kotlinlang.org/docs/native-c-interop.html)). `NSError **` trong header Objective-C thành một con trỏ tới `ObjCObjectVar<NSError?>`, và `.value` đọc thứ Foundation đã đặt vào đó.
2. **Kiểm tra giá trị trả về, rồi mới đọc lỗi**: quy tắc của Cocoa, và của header: method "trả về NO nếu có lỗi ở bất kỳ giai đoạn nào của thao tác. Nếu có truyền tham số error, một NSError hiển thị được sẽ được trả về qua tham chiếu" (`NSFileManager.h`).
3. **Thư mục trước.** Trong container của một app vừa cài trên Simulator, `Library` chứa `Caches`, `Preferences` và các thư mục hệ thống thêm lúc mở app, nhưng không có `Application Support`: app phải tự tạo nó. `NSSearchPathForDirectoriesInDomains` của Apple cảnh báo "Thư mục mà method này trả về có thể không tồn tại." Với `true` cho các thư mục trung gian, lời gọi cũng thành công khi thư mục đã có sẵn (mỗi lần thêm thứ hai trong test đều làm vậy). Chúng tôi gỡ lời gọi đó ra: ba trong năm test iOS fail với "Couldn't create the log file."
4. **`createFileAtPath` không có tham số error**: `- (BOOL)createFileAtPath:(NSString *)path contents:(nullable NSData *)data attributes:…`. Nên lỗi đó không có lý do nào để chuyển tiếp, chỉ có `false`.
5. **Seek, rồi mới ghi.** Apple: "Nếu handle đại diện cho một file, việc ghi diễn ra ở vị trí hiện tại của con trỏ file" ([FileHandle.write(_:)](https://developer.apple.com/documentation/foundation/filehandle/write(_:))), và với một handle từ `fileHandleForWritingToURL`, "Con trỏ file được đặt ở đầu file" ([FileHandle(forWritingTo:)](https://developer.apple.com/documentation/foundation/filehandle/init(forwritingto:))). Chúng tôi gỡ `seekToEndReturningOffset`: dòng thứ hai ghi đè dòng đầu, và `readsBackWhatWasAppendedInOrder` fail trên iOS.
6. **Các phiên bản có `error:`.** `writeData:error:`, `seekToEndReturningOffset:error:` và `closeAndReturnError:` có từ iOS 13 (`NSFileHandle.h`), và header đánh dấu `seekToEndOfFile` và `closeFile` cũ hơn là "sẽ bị deprecate", gọi tên các hàm trên làm bản thay thế. Seek cũ "Ném `fileHandleOperationException` … nếu có bất kỳ lỗi nào khác khi seek" ([seekToEndOfFile()](https://developer.apple.com/documentation/foundation/filehandle/seektoendoffile())): một exception của Objective-C, không có giá trị trả về hay `NSError` nào để code ở trên biến thành `LogStoreException`.

!!! warning "Gotcha · `Dispatchers.IO` cần một import trong `iosMain`"
    Trên Kotlin/Native, `Dispatchers.IO` là một extension property, `kotlinx.coroutines.IO`, và file phải import nó. Thiếu import, build của chúng tôi fail với "Cannot access 'val IO: CoroutineDispatcher': it is internal in 'kotlinx.coroutines.Dispatchers'". Trên Android cùng cái tên đó resolve được mà không cần import, nên code chép từ `androidMain` chỉ hỏng trên iOS.

`read()` dùng `NSString.stringWithContentsOfFile(path, NSUTF8StringEncoding, error.ptr)` và trao chữ cho `JsonLines.decode`; `clear()` dùng `removeItemAtPath(path, error.ptr)`. Cả hai trả về sớm khi `fileExistsAtPath` nói không có file: một log rỗng không phải là lỗi.

## 10. Test: một hợp đồng, hai nền tảng

Status service được test như các service của bài 11, qua inbound port của nó với các fake phía sau outbound port. Các adapter của kho log không thể bị thay bằng fake, vì chúng *chính là* code đang được test, nên chúng được test trên file thật: một lần trên mỗi nền tảng, từ một bộ test.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/LogStoreContract.kt" hl_lines="1 3 10"
abstract class LogStoreContract {
    // A store on a file that doesn't exist yet, in a folder of this test's own.
    protected abstract fun storeAt(fileName: String): LogStore
⋯ storeWhereAFileBlocksTheFolder(); two sample records, first and second
    @Test
    fun theRecordsAreInTheFile() = runTest {
        storeAt("status-log.jsonl").append(first)

        // Another store on the same file, as after the app is relaunched.
        assertEquals(listOf(first), storeAt("status-log.jsonl").read())
    }
⋯ aNewLogIsEmpty, readsBackWhatWasAppendedInOrder, clearEmptiesTheLog, aFileErrorIsReported
```

```kotlin title="shared/src/iosTest/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStoreTest.kt" hl_lines="1 3 5"
class IosLogStoreTest : LogStoreContract() {
    private val files = NSFileManager.defaultManager
    private val folder = NSTemporaryDirectory() + "log-store-" + NSUUID().UUIDString

    override fun storeAt(fileName: String): LogStore = IosLogStore("$folder/$fileName")
⋯ storeWhereAFileBlocksTheFolder: a file named "logs" where the store needs a folder; @AfterTest removes the folder
```

1. **Một abstract class trong `commonTest`** giữ các hàm `@Test`; test source set của mỗi nền tảng mở rộng nó. `shared/src/androidHostTest/kotlin/…/AndroidLogStoreTest.kt` truyền `AndroidLogStore(File(folder, fileName))` trong một thư mục từ `Files.createTempDirectory`. Cả hai test runner đều chạy test được kế thừa: kết quả liệt kê năm test dưới `AndroidLogStoreTest` trên JVM và năm dưới `IosLogStoreTest` trên iOS. Hai thư mục này là source set mới, được nhận theo tên mà không cần đổi build.
2. **Nửa iOS chạy trong simulator**, trên hệ thống file thật của iOS: `iosSimulatorArm64Test` của Gradle chạy test binary ở đó. Đó là lý do thứ hai adapter iOS là Kotlin: một adapter Swift không chạy được trong test của Gradle, và project này không có test target của Xcode.
3. **Cố tình gây lỗi file.** `storeWhereAFileBlocksTheFolder` tạo một file tên `logs` và xin `logs/status-log.jsonl`. Apple: lời gọi tạo thư mục "cũng thất bại nếu bất kỳ phần tử trung gian nào của đường dẫn là một file chứ không phải thư mục"; `java.io` không mở được file. Cả hai phải kết thúc thành `LogStoreException`.

Các test mới khác: `StatusServiceTest` (5) dùng `FakeBatteryProvider`, `FakeNetworkProvider` và `FakeBluetoothProvider` (một file nhỏ, `doubles/FakeStatusProviders.kt`), với `FakeConnectionStatus` đặt state kết nối; `SessionConnectionStatusTest` (1) và `AppModuleTest` thứ hai nằm ở mục 3. `JsonLinesTest` (4) kiểm tra đúng nguyên dòng, `null` theo cả hai chiều, thứ tự, và số dòng trong thông báo lỗi. `DeviceListViewModelTest` thêm 3, với `TestStatusReport`, một bản cài đặt test của inbound port. Các kiểm tra đột biến chúng tôi đã chạy: gỡ quy tắc Wi-Fi làm `aWifiConnectionMeansWifiIsOn` fail; gỡ seek hoặc lời gọi tạo thư mục làm các test hợp đồng iOS fail (mục 9).

## 11. Thực tế xảy ra gì

Chúng tôi build m12 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, kotlinx.serialization 1.12.0, Xcode 26.2). `allTests` pass 87 trên 87 trên JVM và 87 trên 87 trên iOS simulator, không có cảnh báo compiler nào từ code của chúng ta.

| Lần chạy | Thứ chúng tôi thấy |
|---|---|
| Emulator Android API 36, Compose và XML, mở app | "Battery 77 % · Wi-Fi connected · no cellular · Bluetooth on" dưới tiêu đề (nút XML ghi REFRESH) |
| như trên, rồi `adb emu power capacity 47`, `adb shell svc wifi disable`, `adb shell cmd bluetooth_manager disable`, Refresh | "Battery 47 % · Wi-Fi off · cellular available · Bluetooth off"; không gì đổi trước khi Refresh |
| bật lại Wi-Fi và Bluetooth, Refresh sau 6 s, rồi sau 46 s | "… Wi-Fi connected · cellular available …", rồi "… Wi-Fi connected · no cellular …" (sơ đồ của mục 4). Câu trả lời đầu phụ thuộc thời điểm: ở một lần chạy sau, "no cellular" tới trong vòng 6 s sau khi Wi-Fi kết nối |
| Home, đổi mức pin và Bluetooth, mở lại app | các giá trị mới mà không cần Refresh (`ON_RESUME` / `onResume`) |
| Emulator Android API 30, Compose, mở app | "Battery 100 % · Wi-Fi connected · no cellular · Bluetooth on" |
| API 36, manifest thiếu `ACCESS_NETWORK_STATE` / thiếu `ACCESS_WIFI_STATE` | crash lúc mở với một `SecurityException` gọi tên quyền bị thiếu (mục 4) |
| Simulator iOS 26.2, SwiftUI và UIKit (XCUITest), cài mới, mở app | "Battery unknown · Wi-Fi connected · no cellular · Bluetooth unknown", và không có alert hệ thống nào. Như vậy cả sau Refresh, và sau khi cho phép Bluetooth |

Mức pin thật trên iOS, Bluetooth bật và tắt trên cả hai nền tảng với radio thật, và một iPhone báo gì về mạng di động cạnh Wi-Fi đều cần điện thoại của bạn; brief cho agent liệt kê chúng là các kiểm tra trên thiết bị. **m12 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng với năm test kho log trên mỗi bên, các lần chạy ở trên diễn ra giống vậy với bạn, và trên ít nhất một điện thoại, dòng trạng thái đi theo pin và công tắc Bluetooth. Hãy commit nó. Bài 18 dựng monitor đọc trạng thái theo bộ hẹn giờ và ghi mỗi lần đọc vào kho log.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một lần bấm Refresh trên track iOS của bạn: hàm Kotlin nào chạy trước, coroutine nào gọi `StatusService.current()`, nó tới ba method Swift nào và trên thread nào, `KotlinInt?` và `KotlinBoolean?` thành `Int?` và `Boolean?` của Kotlin ở đâu, và dòng chữ được dựng ở đâu. Rồi nhờ nó giải thích, từng dòng một, chuyện gì xảy ra trong bộ nhớ ở `IosLogStore.append` khi thư mục không tạo được.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">"Bluetooth connected" trong <code>DeviceStatus</code> tới từ đâu?</p>
<div class="opts">
<button class="opt">từ <code>BluetoothProvider</code>, thứ hỏi hệ điều hành các thiết bị đã kết nối</button>
<button class="opt" data-correct>từ session, qua port <code>ConnectionStatus</code> riêng của <code>StatusService</code>, thứ bridge adapter trả lời từ <code>DeviceSession.connectionState</code>; service kiểm tra <code>Connected</code></button>
<button class="opt">từ ViewModel danh sách, thứ nhớ lần kết nối gần nhất</button>
</div>
<p class="feedback"></p>
<p class="why">Nó nghĩa là "app này đang giữ một liên kết", và session service sở hữu state đó. iOS chỉ liệt kê được các peripheral đã kết nối theo UUID service bạn đặt tên, kể cả liên kết của app khác, nên câu trả lời của nền tảng sẽ không mang cùng nghĩa trên cả hai.</p>
</div>

<div class="quiz">
<p class="q">Service của một khả năng mới cần một sự thật mà service của một khả năng khác giữ. Service mới phụ thuộc vào cái gì?</p>
<div class="opts">
<button class="opt">inbound port của khả năng kia, vì nó đã là "thứ app cung cấp"</button>
<button class="opt">class của service kia, để đọc state trực tiếp</button>
<button class="opt" data-correct>một outbound port của riêng nó, đặt tên theo cách nói của nó, mà một bridge adapter trong code dùng chung implement bằng cách gọi inbound port của khả năng kia</button>
</div>
<p class="feedback"></p>
<p class="why">Các service không biết nhau: một service chỉ gọi outbound port, và mọi outbound port được implement bởi một outbound adapter. Bridge là adapter đó, và nó không giữ quy tắc nào.</p>
</div>

<div class="quiz">
<p class="q">Sao <code>SessionService</code> không implement luôn <code>ConnectionStatus</code> cho đỡ một file bridge?</p>
<div class="opts">
<button class="opt" data-correct>khi đó một outbound port sẽ được implement bởi một service, không phải adapter, và "outbound" sẽ không còn nghĩa "bên ngoài khả năng này"</button>
<button class="opt">Koin không bind được một class với hai interface</button>
<button class="opt">một class Kotlin chỉ implement được một interface</button>
</div>
<p class="feedback"></p>
<p class="why">Bridge giữ cả hai định nghĩa đúng. Các lựa chọn gần khác cũng phá một quy tắc: gọi trực tiếp phá "một service gọi outbound port", một chỗ giữ dùng chung để "ai được ghi" cho quy ước, và domain event sẽ cần phát lại mới cho ra state hiện tại.</p>
</div>

<div class="quiz">
<p class="q">Trên emulator API 36, <code>dumpsys connectivity</code> vẫn liệt kê một mạng di động đã kết nối, nhưng một phút sau khi Wi-Fi quay lại, trạng thái nói "no cellular". Vì sao?</p>
<div class="opts">
<button class="opt">emulator tắt dữ liệu di động khi Wi-Fi quay lại</button>
<button class="opt" data-correct>Android giữ mạng di động ở nền phía sau Wi-Fi, và một app không có <code>CHANGE_NETWORK_STATE</code> được báo là mạng đó đã mất</button>
<button class="opt">network callback ngừng chạy sau phút đầu tiên</button>
</div>
<p class="feedback"></p>
<p class="why"><code>ConnectivityService</code> thêm <code>NET_CAPABILITY_FOREGROUND</code> vào các lần lắng nghe của app không có quyền đó, nên chúng nhận <code>onLost</code> khi một mạng chuyển xuống nền. "Available" trong app này nghĩa là "một mạng app này dùng được".</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>IosBluetoothProvider</code> trả <code>nil</code> trước khi người dùng cho phép Bluetooth, thay vì hỏi radio?</p>
<div class="opts">
<button class="opt">CoreBluetooth ném lỗi nếu app chưa được phép</button>
<button class="opt" data-correct>tạo một <code>CBCentralManager</code> làm hiện hộp thoại Bluetooth, và dòng trạng thái đọc trạng thái ngay khi danh sách hiện ra</button>
<button class="opt">đọc <code>CBManager.authorization</code> làm hiện hộp thoại, nên không được đọc hai lần</button>
</div>
<p class="feedback"></p>
<p class="why">Đọc <code>CBManager.authorization</code> không bao giờ hiện hộp thoại (bài 12); tạo một manager thì có. Port hứa "Never shows a permission prompt".</p>
</div>

<div class="quiz">
<p class="q">Trong <code>IosLogStore.append</code>, <code>error.ptr</code> cho Foundation cái gì?</p>
<div class="opts">
<button class="opt">một exception Kotlin để ném khi lời gọi thất bại</button>
<button class="opt">một callback Foundation gọi kèm lỗi</button>
<button class="opt" data-correct>địa chỉ của một biến, cấp phát trong <code>memScoped</code>, nơi Foundation ghi một <code>NSError</code> nếu lời gọi thất bại</button>
</div>
<p class="feedback"></p>
<p class="why">Các method ném lỗi của Objective-C không được import thành exception Kotlin, nên code truyền một <code>NSError **</code> như Objective-C làm: kiểm tra giá trị trả về, rồi đọc <code>error.value</code>. Bộ nhớ được giải phóng khi <code>memScoped</code> kết thúc.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>@Serializable</code> nằm trên một class private bên trong <code>JsonLines</code>, mà không trên <code>LogRecord</code>?</p>
<div class="opts">
<button class="opt">plugin không xử lý được class có <code>Instant</code> bên trong</button>
<button class="opt" data-correct>định dạng file thuộc về các adapter; model của app core không import framework nào và không đổi khi file đổi</button>
<button class="opt">Swift không thấy được các class <code>@Serializable</code></button>
</div>
<p class="feedback"></p>
<p class="why">Appendix B: app core không import gì từ framework nào. Adapter ánh xạ giữa <code>LogRecord</code> của core và <code>Line</code> của riêng nó, nên bên nào cũng đổi được độc lập.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Các adapter của bài 12 và các adapter trạng thái hôm nay trên iOS là class Swift. Điều gì làm một class Swift thành một outbound adapter ở đây? (Bài 10 và 12)</p>
<div class="opts">
<button class="opt">nó kế thừa một base class Kotlin</button>
<button class="opt" data-correct>nó tuân theo interface Kotlin (một protocol trong header framework), và phần khởi động app iOS truyền nó vào <code>doInitKoin</code></button>
<button class="opt">SKIE sinh nó từ interface Kotlin</button>
</div>
<p class="feedback"></p>
<p class="why">Swift thấy một interface Kotlin là một protocol. Koin bind object Swift như mọi adapter khác; app core chỉ biết port.</p>
</div>

<div class="quiz">
<p class="q">Test kho log và test session đều dùng <code>runTest</code>. Vì sao test kho log tốn thời gian thật, trong khi lần chờ 100 ms của bài 16 thì không? (Bài 11)</p>
<div class="opts">
<button class="opt"><code>runTest</code> không chạy trên iOS</button>
<button class="opt" data-correct>các adapter dời lời gọi file sang <code>Dispatchers.IO</code>, các thread thật nằm ngoài test scheduler; chỉ các <code>delay</code> trên test dispatcher mới bị bỏ qua</button>
<button class="opt">một <code>Mutex</code> tắt thời gian ảo</button>
</div>
<p class="feedback"></p>
<p class="why">Thời gian ảo điều khiển các coroutine trên test dispatcher. Việc gửi sang dispatcher khác chạy thật, và test chờ nó; với vài file nhỏ thì chỉ vài mili giây.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m12 của bạn)"
    1. **Đoán, rồi xem.** Trên emulator, ghi ra dòng trạng thái sẽ nói gì sau mỗi bước, rồi làm và bấm Refresh: `adb shell svc wifi disable`; `adb emu power capacity 5`; `adb shell svc wifi enable` (Refresh ngay, rồi lại sau một phút); `adb shell cmd bluetooth_manager disable`. Dòng nào của adapter nào giải thích mỗi câu trả lời?
    2. **Test trước: pin yếu.** Thêm `val batteryLow: Boolean` vào `DeviceStatus`, true ở 15 % trở xuống, false khi không biết mức pin. File nào giữ quy tắc, và sao không phải các adapter? Viết `aBatteryAt15PercentIsLow` và `anUnknownBatteryIsNotLow` trong `StatusServiceTest`, xem chúng fail, rồi làm chúng pass. Còn gì khác phải đổi để compile, và `JsonLinesTest` có nhận ra không?
    3. **Qua bridge.** Thêm `connectedDevice: String?` vào `DeviceStatus`: tên thiết bị khi app đang giữ liên kết, ngược lại thì `null` (kể cả khi đang kết nối). Viết `namesTheDeviceOnlyWhileConnected` trong `StatusServiceTest` với `FakeConnectionStatus` trước. `ConnectionStatus` hay `SessionConnectionStatus` có phải đổi không? Nếu bạn muốn đặt `if` vào bridge, service nào nên giữ nó thay vào, và test nào sẽ bỏ lỡ nó?
    4. **Một thay đổi không test nào bắt được.** Trong `AndroidLogStore.append`, xoá `file.parentFile?.mkdirs()`. Đoán xem test hợp đồng nào fail, rồi chạy `./gradlew :shared:testAndroidHostTest`. Vì sao không gì fail? Thêm một test hợp đồng lẽ ra bắt được nó (gợi ý: `storeAt` nhận tên file, và tên có thể chứa thư mục), xem nó fail trên JVM, khôi phục dòng đó, và chạy cả trên iOS: dòng nào của `IosLogStore` làm nó pass ở đó?
    5. **Đọc Objective-C.** Mở `NSFileManager.h` trong Xcode (Open Quickly, ⇧⌘O) và tìm `removeItemAtPath:error:`. Viết lời gọi Kotlin của nó bằng trí nhớ, với khối `memScoped`, và so với `clear()`.
    6. **Trên điện thoại của bạn**: so dòng trạng thái với phần trăm pin của hệ thống, rồi tắt Bluetooth trong bảng điều khiển hệ thống và quay lại app. Trên iPhone, trước khi bạn cho phép Bluetooth ở một lần cài mới, dòng đó nói gì, và có hộp thoại nào hiện ra không? Khi bật cả Wi-Fi lẫn dữ liệu di động, mỗi điện thoại nói gì về mạng di động?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/17-device-status-and-log-store.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/17-device-status-and-log-store.html" -o .course/lesson-17.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 12 and 16, which this lesson builds on; skipped if they're already there:
  [ -f .course/lesson-12.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html" -o .course/lesson-12.html
  [ -f .course/lesson-16.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/16-ble-notify-disconnect-errors.html" -o .course/lesson-16.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 17 (Device status and the log store): build milestone m12 on top of m11: the StatusReport
inbound port (current(): DeviceStatus), implemented by StatusService over three outbound ports,
BatteryProvider, NetworkProvider and BluetoothProvider (Kotlin adapters in androidMain, Swift
adapters in IosStatusProviders.swift), with "Bluetooth connected" read through a fourth outbound
port, ConnectionStatus, that a bridge adapter in commonMain, SessionConnectionStatus, answers from
DeviceSession (StatusService knows no other service or inbound port); one line of phone status with a Refresh button on the list screen; and a LogStore outbound port
(append / read / clear, LogStoreException) with JSON Lines adapters: AndroidLogStore (java.io,
androidMain) and IosLogStore (Kotlin over Foundation, iosMain), sharing JsonLines
(kotlinx.serialization), tested by one LogStoreContract on the JVM and in the iOS simulator.
LogStore is NOT bound in Koin yet (Lesson 18 does that).
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m11 project in demo/ (Lesson 16). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks.
     replaced: shared/build.gradle.kts (the serialization plugin and kotlinx-serialization-json)
     XML track only: replaced: build.gradle.kts in demo/ (the root build file gains the
       serialization plugin line; the Compose track's root file already has it: leave it as in m11)
   Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/DeviceStatus.kt, core/LogRecord.kt, core/LogStoreException.kt,
       core/StatusService.kt, core/inbound/StatusReport.kt, core/outbound/BatteryProvider.kt,
       core/outbound/NetworkProvider.kt, core/outbound/BluetoothProvider.kt,
       core/outbound/ConnectionStatus.kt, core/outbound/LogStore.kt,
       adapter/outbound/SessionConnectionStatus.kt, adapter/outbound/JsonLines.kt
     replaced: adapter/inbound/DeviceListUiState.kt, adapter/inbound/DeviceListViewModel.kt,
       di/AppModule.kt
   Under shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/:
     add: AndroidStatusProviders.kt, AndroidLogStore.kt
   add: shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStore.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: doubles/FakeStatusProviders.kt, doubles/FakeConnectionStatus.kt,
       doubles/TestStatusReport.kt, core/StatusServiceTest.kt,
       adapter/outbound/SessionConnectionStatusTest.kt, adapter/outbound/JsonLinesTest.kt,
       adapter/outbound/LogStoreContract.kt
     replaced: adapter/inbound/DeviceListViewModelTest.kt, di/AppModuleTest.kt
   add (new test source set folders, no build change needed):
     shared/src/androidHostTest/kotlin/com/example/devicemonitor/adapter/outbound/AndroidLogStoreTest.kt
     shared/src/iosTest/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStoreTest.kt
   Every other file in shared/ stays as in m11.

2. Android, both tracks: androidApp/src/main/AndroidManifest.xml (my track's: the two differ in
   their theme) and androidApp/src/main/java/com/example/devicemonitor/android/
   DeviceMonitorApplication.kt: replaced. androidApp/build.gradle.kts stays as in m11.
     Compose: DeviceListScreen.kt: replaced.
     XML: DeviceListFragment.kt and androidApp/src/main/res/layout/fragment_device_list.xml:
       replaced.
   iOS, both tracks: add iosApp/iosApp/IosStatusProviders.swift, then run `xcodegen generate` in
   iosApp/ so the Xcode project includes it. project.yml stays as in m11. Do NOT edit
   Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift and DeviceListView.swift: replaced.
     UIKit: AppDelegate.swift and DeviceListViewController.swift: replaced.
   Every other Android and iOS file stays as in m11, including both detail screens.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), and grant the permissions:
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
     `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 87 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 8 in ValueDecoderTest, 8 in
  ScanningServiceTest, 5 in StatusServiceTest, 4 in JsonLinesTest, 4 in PermissionServiceTest,
  3 in DeviceServiceTest, 2 in AppModuleTest, 1 in SessionConnectionStatusTest, and 5 in
  AndroidLogStoreTest (JVM results) or 5 in IosLogStoreTest (iOS results). Show the counts from the XML files in
  shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- The app core stays platform-free and format-free:
    grep -rn 'import android\|import platform\.\|import org.koin\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing, and services don't know each other:
    grep -n 'DeviceSession\|SessionService' shared/src/commonMain/kotlin/com/example/devicemonitor/core/StatusService.kt
  finds nothing. In the exported header (build it first with
  ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64):
    grep -c 'doInitKoin(permissionChecker:bleScanner:bleConnection:batteryProvider:networkProvider:bluetoothProvider:)' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'Koin_core' on the same file prints 0.
- Android emulator (API 31+, with the real adapters; find text with `adb shell uiautomator
  dump`; the XML button shows REFRESH in capitals, so match case-insensitively):
  1. Make sure Wi-Fi and Bluetooth are on (adb shell svc wifi enable; adb shell cmd
     bluetooth_manager enable) and adb emu power capacity 77, then launch: under the title,
     "Battery 77 % · Wi-Fi connected · … · Bluetooth on" (the cellular part depends on how long
     Wi-Fi has been up: section 4), next to a Refresh button.
  2. adb emu power capacity 47; adb shell svc wifi disable; adb shell cmd bluetooth_manager
     disable; wait 5 s: the line hasn't changed. Tap Refresh: "Battery 47 % · Wi-Fi off ·
     cellular available · Bluetooth off".
  3. Turn Wi-Fi and Bluetooth back on and set the capacity to 77; adb shell input keyevent
     KEYCODE_HOME, then the am start command again: the line shows the new values without
     a tap on Refresh. Wait 60 s and tap Refresh: "… Wi-Fi connected · no cellular · …".
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events. After the fresh
  install: a static text beginning "Battery unknown · " and ending "· no cellular · Bluetooth
  unknown" (with the Mac on Wi-Fi, the middle part is "Wi-Fi connected"), a Refresh button,
  and no alert from SpringBoard (XCUIApplication(bundleIdentifier: "com.apple.springboard")
  .alerts.count is 0). Tap Refresh: the same line.
- Device checks (list them for me, don't try to run them), on a physical Android phone and an
  iPhone on my track, with the real adapters:
  1. The battery: the status line's percentage matches the system's.
  2. Bluetooth: turn it off in the system controls and come back to the app: "Bluetooth
     off"; on again: "Bluetooth on" (on the iPhone, after allowing Bluetooth).
  3. iPhone, fresh install, before tapping "Allow Bluetooth": "Bluetooth unknown" and no
     system prompt until the tap.
  4. Cellular: with mobile data on, Wi-Fi off: "cellular available" on both; Wi-Fi on for a
     minute: record what each phone says (Android is expected to say "no cellular").
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each null in a DeviceStatus can come from, on each platform.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Read network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state) (nguồn chính: callback thay cho lời gọi đồng bộ, connectivity thread, mạng nền và `CHANGE_NETWORK_STATE`; nó nói không cần quyền, điều mà reference của `registerNetworkCallback` mâu thuẫn), và các trang reference của [ConnectivityManager](https://developer.android.com/reference/android/net/ConnectivityManager), [NetworkCapabilities](https://developer.android.com/reference/android/net/NetworkCapabilities), [WifiManager](https://developer.android.com/reference/android/net/wifi/WifiManager) và [BatteryManager](https://developer.android.com/reference/android/os/BatteryManager) (`getIntProperty`, `BATTERY_PROPERTY_CAPACITY`). Vì sao app không thấy mạng nền nằm trong mã nguồn Android: `listenForNetwork` trong `ConnectivityService.java`, mà comment của nó giải thích lời gọi `restrictBackgroundRequestForCaller` ngay bên dưới.
- iOS: [NWPathMonitor](https://developer.apple.com/documentation/network/nwpathmonitor) và [NWPath](https://developer.apple.com/documentation/network/nwpath) (nguồn chính), [UIDevice.batteryLevel](https://developer.apple.com/documentation/uikit/uidevice/batterylevel) và [isBatteryMonitoringEnabled](https://developer.apple.com/documentation/uikit/uidevice/isbatterymonitoringenabled). File: [createDirectory(atPath:withIntermediateDirectories:attributes:)](https://developer.apple.com/documentation/foundation/filemanager/createdirectory(atpath:withintermediatedirectories:attributes:)), [FileHandle](https://developer.apple.com/documentation/foundation/filehandle) (các method `error:` đầy đủ nhất trong `NSFileHandle.h`), và [applicationSupportDirectory](https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/applicationsupportdirectory).
- Kotlin/Native: [Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html) (framework hệ thống được import mặc định; lỗi Objective-C không được import thành exception) và [Interoperability with C](https://kotlinlang.org/docs/native-c-interop.html) (`memScoped`, `alloc`, `.ptr`, `.value`).
- Kotlin: [kotlin.time.Instant](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.time/-instant/), [Serialization](https://kotlinlang.org/docs/serialization.html) với [explicitNulls](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-builder/explicit-nulls.html) và [SerializationException](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-core/kotlinx.serialization/-serialization-exception/), và [Dispatchers.IO](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-i-o.html).
- Định dạng: [JSON Lines](https://jsonlines.org/).
- [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): các quy tắc đặt chỗ của lục giác (giờ có thêm "các service không biết nhau" và bridge adapter), binding Koin và các fake mà port và test mới của bài này tuân theo.
- Koin: [Testing](https://insert-koin.io/docs/reference/koin-test/testing) ("Mỗi test nên khởi động container riêng và dừng nó ở cuối"), cho gotcha của mục 3.
- Kinh nghiệm thực tế: kênh #multiplatform của Kotlin Slack cho câu hỏi về interop Kotlin/Native; tag [kotlin-native](https://stackoverflow.com/questions/tagged/kotlin-native) của Stack Overflow.

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Không file nào bị xoá. `iosApp/iosApp.xcodeproj` được sinh lại bởi `xcodegen generate`; `build.gradle.kts` gốc của track Compose, `androidApp/build.gradle.kts` và cả hai màn hình chi tiết giữ như ở m11. File chỉ một track có nằm trong tab của track đó; khi hai track cùng sửa một file cùng đường dẫn, tiêu đề của nó ghi tên track.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/DeviceStatus.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // The phone's own status at one moment, in the app's terms. null means "this phone can't tell":
    // the iPhone Simulator has no battery level, and iOS doesn't say whether Wi-Fi is switched on.
    data class DeviceStatus(
        val battery: Int?, // percent, 0 to 100
        val wifiEnabled: Boolean?,
        val wifiConnected: Boolean,
        val cellularAvailable: Boolean, // a cellular network is up that this app can use
        val bluetoothEnabled: Boolean?,
        val bluetoothConnected: Boolean, // this app holds a link to a device (ConnectionStatus)
    )

    // What NetworkProvider reports: the network half of DeviceStatus.
    data class NetworkStatus(
        val wifiEnabled: Boolean?,
        val wifiConnected: Boolean,
        val cellularAvailable: Boolean,
    )
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/LogRecord.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.time.Instant

    // One line of the log: the phone's status, and when it was read.
    data class LogRecord(val timestamp: Instant, val status: DeviceStatus)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/LogStoreException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // The log couldn't be written, read or cleared: the file system refused, or a line in the file
    // isn't a record. The message says which. The LogStore adapters throw it.
    class LogStoreException(message: String) : Exception(message)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/StatusReport.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.DeviceStatus

    // Inbound port: what the app offers for the phone's own status. The shared ViewModels call it,
    // and StatusService implements it.
    interface StatusReport {
        // The status right now: battery, Wi-Fi, cellular and Bluetooth. Each call reads it again.
        suspend fun current(): DeviceStatus
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BatteryProvider.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    // Outbound port: what the app needs to know about the phone's battery, in the app's terms.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
    interface BatteryProvider {
        // The charge left, in percent (0 to 100), or null if this phone can't tell.
        fun level(): Int?
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/NetworkProvider.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.NetworkStatus

    // Outbound port: what the app needs to know about the phone's network connections.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
    interface NetworkProvider {
        // Wi-Fi switched on (null if this platform can't tell) and connected, and whether a cellular
        // network is up that this app can use, as the system last reported them.
        fun current(): NetworkStatus
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BluetoothProvider.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    // Outbound port: what the app needs to know about the phone's Bluetooth.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
    interface BluetoothProvider {
        // Whether Bluetooth is switched on, or null if the app can't tell: the phone has no radio,
        // or (iOS) the user hasn't allowed Bluetooth. Never shows a permission prompt.
        suspend fun isEnabled(): Boolean?
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/ConnectionStatus.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.ConnectionState

    // Outbound port: what the status needs to know about the app's own link to a device. It's
    // answered inside the app, by a bridge adapter to the session (SessionConnectionStatus), so
    // StatusService never knows DeviceSession or SessionService.
    interface ConnectionStatus {
        // Where the app's connection to a device stands right now.
        fun current(): ConnectionState
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/LogStore.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.LogRecord

    // Outbound port: where the app keeps its log records, oldest first, across launches.
    // One adapter per platform, both writing JSON Lines (one JSON object per line): Kotlin in
    // androidMain, and Kotlin in iosMain over Apple's Foundation. Each call throws LogStoreException
    // when the file system refuses.
    interface LogStore {
        // Adds the record at the end of the log.
        suspend fun append(record: LogRecord)

        // Every record, oldest first; empty if none was ever appended, or after clear(). Also throws
        // LogStoreException if a line in the file isn't a record.
        suspend fun read(): List<LogRecord>

        // Removes every record.
        suspend fun clear()
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
    class StatusService(
        private val battery: BatteryProvider,
        private val network: NetworkProvider,
        private val bluetooth: BluetoothProvider,
        private val connection: ConnectionStatus,
    ) : StatusReport {
        override suspend fun current(): DeviceStatus {
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
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/JsonLines.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import kotlin.time.Instant
    import kotlinx.serialization.Serializable
    import kotlinx.serialization.json.Json

    // The log store's file format, shared by both platforms' LogStore adapters: JSON Lines, one JSON
    // object per line, with the fields of the course's example record. The @Serializable class
    // lives here, in the adapter, so the app core's models carry no JSON annotations.
    internal object JsonLines {
        @Serializable
        private class Line(
            val timestamp: String,
            val battery: Int?,
            val wifiEnabled: Boolean?,
            val wifiConnected: Boolean,
            val cellularAvailable: Boolean,
            val bluetoothEnabled: Boolean?,
            val bluetoothConnected: Boolean,
        )

        // One record as one line of JSON, without the line break.
        fun encode(record: LogRecord): String {
            val s = record.status
            val line = Line(
                record.timestamp.toString(), s.battery, s.wifiEnabled, s.wifiConnected,
                s.cellularAvailable, s.bluetoothEnabled, s.bluetoothConnected,
            )
            return Json.encodeToString(line)
        }

        // Every record in the file's text, in order. Blank lines are skipped; any other line that
        // isn't a record fails the whole read, with its line number.
        fun decode(text: String): List<LogRecord> =
            text.lines().mapIndexedNotNull { index, line ->
                if (line.isBlank()) return@mapIndexedNotNull null
                try {
                    val l = Json.decodeFromString<Line>(line)
                    val status = DeviceStatus(
                        l.battery, l.wifiEnabled, l.wifiConnected, l.cellularAvailable,
                        l.bluetoothEnabled, l.bluetoothConnected,
                    )
                    LogRecord(Instant.parse(l.timestamp), status)
                } catch (e: IllegalArgumentException) { // kotlinx.serialization's errors, and Instant.parse's
                    throw LogStoreException("Line ${index + 1} of the log isn't a record: ${e.message}")
                }
            }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SessionConnectionStatus.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.outbound.ConnectionStatus

    // Bridge adapter: implements the status's ConnectionStatus port by calling the session's inbound
    // port, so the two services never know each other. It only passes the answer on: what counts as
    // "connected" is StatusService's rule, and the state itself is SessionService's.
    class SessionConnectionStatus(private val session: DeviceSession) : ConnectionStatus {
        override fun current(): ConnectionState = session.connectionState.value
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.PermissionStatus

    // Everything the device list shows that the user didn't type.
    data class DeviceListUiState(
        val bluetooth: PermissionStatus = PermissionStatus.NotRequested,
        val scan: ScanState = ScanState.Idle,
        val errorMessage: String? = null,
        val phoneStatus: String = "Reading the phone's status…",
    )

    sealed interface ScanState {
        data object Idle : ScanState
        data class Scanning(val found: List<Device>) : ScanState
        data class Finished(val found: List<Device>) : ScanState
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceStatus
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
    import kotlinx.coroutines.withTimeoutOrNull
    import kotlin.time.Duration.Companion.seconds

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
                    withTimeoutOrNull(SCAN_TIMEOUT) {
                        scanning.scan(filter).collect { device ->
                            found += device
                            _uiState.update { it.copy(scan = ScanState.Scanning(found.toList())) }
                        }
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
                _uiState.update { it.copy(phoneStatus = describe(current)) }
            }
        }

        // One line of text for the screen, the same on every track.
        private fun describe(s: DeviceStatus): String {
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

        companion object {
            // A real radio drains the battery while it scans, so every scan has a time limit.
            val SCAN_TIMEOUT = 10.seconds
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.outbound.SessionConnectionStatus
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.SessionService
    import com.example.devicemonitor.core.StatusService
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
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
    ) = module {
        single { permissionChecker }
        single { bleScanner }
        single { bleConnection }
        single { batteryProvider }
        single { networkProvider }
        single { bluetoothProvider }
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin(
        permissionChecker: PermissionChecker,
        bleScanner: BleScanner,
        bleConnection: BleConnection,
        batteryProvider: BatteryProvider,
        networkProvider: NetworkProvider,
        bluetoothProvider: BluetoothProvider,
    ) {
        startKoin {
            modules(
                appModule,
                platformModule(
                    permissionChecker, bleScanner, bleConnection, batteryProvider, networkProvider, bluetoothProvider,
                ),
            )
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidStatusProviders.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.bluetooth.BluetoothManager
    import android.content.Context
    import android.net.ConnectivityManager
    import android.net.Network
    import android.net.NetworkCapabilities
    import android.net.NetworkRequest
    import android.net.wifi.WifiManager
    import android.os.BatteryManager
    import com.example.devicemonitor.core.NetworkStatus
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.NetworkProvider
    import java.util.concurrent.ConcurrentHashMap

    // Outbound adapter: the battery, behind the BatteryProvider port.
    class AndroidBatteryProvider(context: Context) : BatteryProvider {
        private val battery = context.getSystemService(BatteryManager::class.java)

        // The charge left, in percent. An app that targets Android 9 or later gets Int.MIN_VALUE
        // when the phone can't tell.
        override fun level(): Int? =
            battery?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
    }

    // Outbound adapter: Wi-Fi and cellular, behind the NetworkProvider port. Android reports each
    // network that comes, changes or goes to a callback; the adapter keeps the networks it was told
    // about, so current() only reads them. Android tells an app only about networks it can use:
    // not a cellular network kept up in the background behind Wi-Fi. Needs ACCESS_NETWORK_STATE
    // and ACCESS_WIFI_STATE.
    class AndroidNetworkProvider(context: Context) : NetworkProvider {
        private val wifi = context.getSystemService(WifiManager::class.java)
        private val networks = ConcurrentHashMap<Network, NetworkCapabilities>() // callbacks run on another thread

        init {
            // One registration for the life of the process: Koin keeps this adapter as long.
            context.getSystemService(ConnectivityManager::class.java).registerNetworkCallback(
                NetworkRequest.Builder().build(), // the default request: no VPNs, no restricted networks
                object : ConnectivityManager.NetworkCallback() {
                    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                        networks[network] = capabilities
                    }

                    override fun onLost(network: Network) {
                        networks.remove(network)
                    }
                },
            )
        }

        override fun current(): NetworkStatus {
            val up = networks.values
            return NetworkStatus(
                wifiEnabled = wifi?.isWifiEnabled,
                wifiConnected = up.any { it.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) },
                cellularAvailable = up.any { it.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) },
            )
        }
    }

    // Outbound adapter: Bluetooth on or off, behind the BluetoothProvider port. Reading it needs no
    // runtime permission.
    class AndroidBluetoothProvider(context: Context) : BluetoothProvider {
        private val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter

        override suspend fun isEnabled(): Boolean? = adapter?.isEnabled // null: no Bluetooth radio
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidLogStore.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.outbound.LogStore
    import java.io.File
    import java.io.IOException
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.sync.Mutex
    import kotlinx.coroutines.sync.withLock
    import kotlinx.coroutines.withContext

    // Outbound adapter: the log store on Android, a JSON Lines file behind the LogStore port. Plain
    // java.io: the app passes a file in its private storage (Context.filesDir), and the tests pass
    // one in a temporary folder.
    class AndroidLogStore(private val file: File) : LogStore {
        private val lock = Mutex() // one file operation at a time, so lines never interleave

        override suspend fun append(record: LogRecord) = io("Couldn't write to the log") {
            file.parentFile?.mkdirs()
            file.appendText(JsonLines.encode(record) + "\n")
        }

        override suspend fun read(): List<LogRecord> = io("Couldn't read the log") {
            if (file.exists()) JsonLines.decode(file.readText()) else emptyList()
        }

        override suspend fun clear() = io("Couldn't clear the log") {
            if (file.exists() && !file.delete()) throw IOException("${file.path} wasn't deleted.")
        }

        // File calls block their thread, so they run on Dispatchers.IO, never on the main thread.
        private suspend fun <T> io(what: String, block: () -> T): T = lock.withLock {
            withContext(Dispatchers.IO) {
                try {
                    block()
                } catch (e: IOException) {
                    throw LogStoreException("$what: ${e.message}")
                }
            }
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStore.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.outbound.LogStore
    import kotlinx.cinterop.BetaInteropApi
    import kotlinx.cinterop.ExperimentalForeignApi
    import kotlinx.cinterop.ObjCObjectVar
    import kotlinx.cinterop.alloc
    import kotlinx.cinterop.memScoped
    import kotlinx.cinterop.ptr
    import kotlinx.cinterop.value
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.IO
    import kotlinx.coroutines.sync.Mutex
    import kotlinx.coroutines.sync.withLock
    import kotlinx.coroutines.withContext
    import platform.Foundation.NSApplicationSupportDirectory
    import platform.Foundation.NSError
    import platform.Foundation.NSFileHandle
    import platform.Foundation.NSFileManager
    import platform.Foundation.NSSearchPathForDirectoriesInDomains
    import platform.Foundation.NSString
    import platform.Foundation.NSURL
    import platform.Foundation.NSUTF8StringEncoding
    import platform.Foundation.NSUserDomainMask
    import platform.Foundation.create
    import platform.Foundation.dataUsingEncoding
    import platform.Foundation.fileHandleForWritingToURL
    import platform.Foundation.stringWithContentsOfFile
    import platform.Foundation.writeData

    // Outbound adapter: the log store on iOS, a JSON Lines file behind the LogStore port. Kotlin,
    // not Swift: Kotlin/Native calls Apple's Foundation directly (the platform.Foundation imports),
    // so this adapter shares JsonLines with Android and runs in the iOS tests from Gradle.
    @OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
    class IosLogStore(private val path: String) : LogStore {
        // For the app: status-log.jsonl in the app's Application Support folder.
        constructor() : this(applicationSupportFile("status-log.jsonl"))

        private val files = NSFileManager.defaultManager
        private val folder = path.substringBeforeLast('/')
        private val lock = Mutex() // one file operation at a time, so lines never interleave

        override suspend fun append(record: LogRecord) = io {
            val text = NSString.create(string = JsonLines.encode(record) + "\n")
            val data = checkNotNull(text.dataUsingEncoding(NSUTF8StringEncoding))
            memScoped {
                val error = alloc<ObjCObjectVar<NSError?>>()
                // Application Support doesn't exist until an app creates it.
                if (!files.createDirectoryAtPath(folder, true, null, error.ptr)) {
                    throw failure("Couldn't create the log's folder", error)
                }
                if (!files.fileExistsAtPath(path)) {
                    if (!files.createFileAtPath(path, data, null)) throw LogStoreException("Couldn't create the log file.")
                    return@memScoped
                }
                val handle = NSFileHandle.fileHandleForWritingToURL(NSURL.fileURLWithPath(path), error.ptr)
                    ?: throw failure("Couldn't open the log file", error)
                try {
                    if (!handle.seekToEndReturningOffset(null, error.ptr)) throw failure("Couldn't open the log file", error)
                    if (!handle.writeData(data, error.ptr)) throw failure("Couldn't write to the log", error)
                } finally {
                    handle.closeAndReturnError(null)
                }
            }
        }

        override suspend fun read(): List<LogRecord> = io {
            if (!files.fileExistsAtPath(path)) return@io emptyList()
            memScoped {
                val error = alloc<ObjCObjectVar<NSError?>>()
                val text = NSString.stringWithContentsOfFile(path, NSUTF8StringEncoding, error.ptr)
                    ?: throw failure("Couldn't read the log", error)
                JsonLines.decode(text)
            }
        }

        override suspend fun clear() = io {
            if (!files.fileExistsAtPath(path)) return@io
            memScoped {
                val error = alloc<ObjCObjectVar<NSError?>>()
                if (!files.removeItemAtPath(path, error.ptr)) throw failure("Couldn't clear the log", error)
            }
        }

        // Foundation reports a failure the Objective-C way: the call returns NO (false) or nil, and
        // writes an NSError into the variable whose address (error.ptr) it was given.
        private fun failure(what: String, error: ObjCObjectVar<NSError?>) =
            LogStoreException("$what: ${error.value?.localizedDescription}")

        // File calls block their thread, so they run on Dispatchers.IO, never on the main thread.
        private suspend fun <T> io(block: () -> T): T = lock.withLock { withContext(Dispatchers.IO) { block() } }

        private companion object {
            fun applicationSupportFile(name: String): String {
                val folders = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, true)
                return "${folders.first()}/$name"
            }
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeStatusProviders.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.NetworkStatus
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.NetworkProvider

    // Fakes: outbound adapters written for tests, behind the three status ports. The test plays the
    // phone: it sets what each one reports.
    class FakeBatteryProvider : BatteryProvider {
        var percent: Int? = 82

        override fun level(): Int? = percent
    }

    class FakeNetworkProvider : NetworkProvider {
        var status = NetworkStatus(wifiEnabled = true, wifiConnected = true, cellularAvailable = true)

        override fun current(): NetworkStatus = status
    }

    class FakeBluetoothProvider : BluetoothProvider {
        var enabled: Boolean? = true

        override suspend fun isEnabled(): Boolean? = enabled
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeConnectionStatus.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.outbound.ConnectionStatus

    // Fake: an outbound adapter written for tests, behind the ConnectionStatus port. The test plays
    // the session: it sets where the connection stands.
    class FakeConnectionStatus : ConnectionStatus {
        var state: ConnectionState = ConnectionState.Disconnected

        override fun current(): ConnectionState = state
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestStatusReport.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.inbound.StatusReport

    // Test implementation of the StatusReport inbound port, for ViewModel tests. The test sets the
    // status it reports, and counts the reads.
    class TestStatusReport : StatusReport {
        var status = DeviceStatus(
            battery = 82, wifiEnabled = true, wifiConnected = true, cellularAvailable = true,
            bluetoothEnabled = true, bluetoothConnected = false,
        )
        var reads = 0
            private set

        override suspend fun current(): DeviceStatus {
            reads++
            return status
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/StatusServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.doubles.FakeBatteryProvider
    import com.example.devicemonitor.doubles.FakeBluetoothProvider
    import com.example.devicemonitor.doubles.FakeConnectionStatus
    import com.example.devicemonitor.doubles.FakeNetworkProvider
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertNull
    import kotlin.test.assertTrue

    class StatusServiceTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val battery = FakeBatteryProvider()
        private val network = FakeNetworkProvider()
        private val bluetooth = FakeBluetoothProvider()
        private val connection = FakeConnectionStatus() // where the app's link stands is set by the test

        // Through the inbound port, as the ViewModel calls it.
        private val status: StatusReport = StatusService(battery, network, bluetooth, connection)

        @Test
        fun reportsWhatTheProvidersSay() = runTest {
            battery.percent = 47
            network.status = NetworkStatus(wifiEnabled = false, wifiConnected = false, cellularAvailable = true)
            bluetooth.enabled = false

            val expected = DeviceStatus(
                battery = 47, wifiEnabled = false, wifiConnected = false, cellularAvailable = true,
                bluetoothEnabled = false, bluetoothConnected = false,
            )
            assertEquals(expected, status.current())
        }

        @Test
        fun unknownsStayUnknown() = runTest {
            battery.percent = null
            bluetooth.enabled = null
            network.status = NetworkStatus(wifiEnabled = null, wifiConnected = false, cellularAvailable = false)

            val current = status.current()

            assertNull(current.battery)
            assertNull(current.bluetoothEnabled)
            assertNull(current.wifiEnabled) // not connected either: nothing to go on
        }

        @Test
        fun aWifiConnectionMeansWifiIsOn() = runTest {
            network.status = NetworkStatus(wifiEnabled = null, wifiConnected = true, cellularAvailable = false)

            assertEquals(true, status.current().wifiEnabled)
        }

        @Test
        fun onlyAnOpenLinkCountsAsConnected() = runTest {
            connection.state = ConnectionState.Connecting(obd)
            assertFalse(status.current().bluetoothConnected)

            connection.state = ConnectionState.Connected(obd)
            assertTrue(status.current().bluetoothConnected)

            connection.state = ConnectionState.Disconnected
            assertFalse(status.current().bluetoothConnected)
        }

        @Test
        fun eachCallReadsAgain() = runTest {
            battery.percent = 82
            assertEquals(82, status.current().battery)

            battery.percent = 81
            assertEquals(81, status.current().battery)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/SessionConnectionStatusTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.doubles.TestDeviceSession
    import kotlin.test.Test
    import kotlin.test.assertEquals

    class SessionConnectionStatusTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val session = TestDeviceSession() // the session's state is set by the test

        // Through the outbound port, as StatusService calls it.
        private val connection: ConnectionStatus = SessionConnectionStatus(session)

        @Test
        fun answersWithTheSessionsStateAtEachCall() {
            val states = listOf(
                ConnectionState.Disconnected,
                ConnectionState.Connecting(obd),
                ConnectionState.Connected(obd),
                ConnectionState.Disconnected,
            )
            for (state in states) {
                session.connectionState.value = state
                assertEquals(state, connection.current())
            }
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/JsonLinesTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFailsWith
    import kotlin.test.assertTrue
    import kotlin.time.Instant

    class JsonLinesTest {
        private val record = LogRecord(
            Instant.parse("2026-09-11T10:30:00Z"),
            DeviceStatus(
                battery = 82, wifiEnabled = true, wifiConnected = true, cellularAvailable = true,
                bluetoothEnabled = true, bluetoothConnected = false,
            ),
        )

        @Test
        fun aRecordIsOneLineOfJsonWithTheExampleFields() {
            assertEquals(
                """{"timestamp":"2026-09-11T10:30:00Z","battery":82,"wifiEnabled":true,"wifiConnected":true,""" +
                    """"cellularAvailable":true,"bluetoothEnabled":true,"bluetoothConnected":false}""",
                JsonLines.encode(record),
            )
        }

        @Test
        fun unknownsAreWrittenAsNullAndReadBack() {
            val unknown = record.copy(status = record.status.copy(battery = null, wifiEnabled = null))

            val line = JsonLines.encode(unknown)

            assertTrue(""""battery":null""" in line)
            assertEquals(listOf(unknown), JsonLines.decode(line))
        }

        @Test
        fun readsEveryLineInOrderAndSkipsBlankOnes() {
            val later = record.copy(timestamp = Instant.parse("2026-09-11T10:45:00Z"))
            val text = JsonLines.encode(record) + "\n" + JsonLines.encode(later) + "\n"

            assertEquals(listOf(record, later), JsonLines.decode(text))
        }

        @Test
        fun aLineThatIsNotARecordFailsTheReadWithItsNumber() {
            val text = JsonLines.encode(record) + "\n" + """{"timestamp":"2026-09-11T1""" + "\n"

            val failure = assertFailsWith<LogStoreException> { JsonLines.decode(text) }

            assertTrue(failure.message!!.startsWith("Line 2 of the log isn't a record"), failure.message)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/LogStoreContract.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.DeviceStatus
    import com.example.devicemonitor.core.LogRecord
    import com.example.devicemonitor.core.LogStoreException
    import com.example.devicemonitor.core.outbound.LogStore
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFailsWith
    import kotlin.time.Instant

    // What every LogStore adapter must do, written once. Each platform's test source set extends it
    // with its own adapter on real files: AndroidLogStoreTest on the JVM, IosLogStoreTest in the
    // iOS simulator.
    abstract class LogStoreContract {
        // A store on a file that doesn't exist yet, in a folder of this test's own.
        protected abstract fun storeAt(fileName: String): LogStore

        // A store whose folder can't be created, because a file has the folder's name.
        protected abstract fun storeWhereAFileBlocksTheFolder(): LogStore

        private val first = record("2026-09-11T10:30:00Z", battery = 82)
        private val second = record("2026-09-11T10:45:00Z", battery = null)

        @Test
        fun aNewLogIsEmpty() = runTest {
            assertEquals(emptyList(), storeAt("status-log.jsonl").read())
        }

        @Test
        fun readsBackWhatWasAppendedInOrder() = runTest {
            val store = storeAt("status-log.jsonl")

            store.append(first)
            store.append(second)

            assertEquals(listOf(first, second), store.read())
        }

        @Test
        fun theRecordsAreInTheFile() = runTest {
            storeAt("status-log.jsonl").append(first)

            // Another store on the same file, as after the app is relaunched.
            assertEquals(listOf(first), storeAt("status-log.jsonl").read())
        }

        @Test
        fun clearEmptiesTheLog() = runTest {
            val store = storeAt("status-log.jsonl")
            store.append(first)

            store.clear()
            assertEquals(emptyList(), store.read())

            store.append(second)
            assertEquals(listOf(second), store.read())
        }

        @Test
        fun aFileErrorIsReported() = runTest {
            val store = storeWhereAFileBlocksTheFolder()

            assertFailsWith<LogStoreException> { store.append(first) }
        }

        private fun record(at: String, battery: Int?) = LogRecord(
            Instant.parse(at),
            DeviceStatus(
                battery = battery, wifiEnabled = true, wifiConnected = true, cellularAvailable = false,
                bluetoothEnabled = true, bluetoothConnected = false,
            ),
        )
    }
    ```

??? example "shared/src/androidHostTest/kotlin/com/example/devicemonitor/adapter/outbound/AndroidLogStoreTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.outbound.LogStore
    import java.io.File
    import java.nio.file.Files
    import kotlin.test.AfterTest

    // The LogStore contract, run on the JVM against the Android adapter and real files.
    class AndroidLogStoreTest : LogStoreContract() {
        private val folder: File = Files.createTempDirectory("log-store").toFile()

        override fun storeAt(fileName: String): LogStore = AndroidLogStore(File(folder, fileName))

        override fun storeWhereAFileBlocksTheFolder(): LogStore {
            val blocker = File(folder, "logs").apply { writeText("") }
            return AndroidLogStore(File(blocker, "status-log.jsonl"))
        }

        @AfterTest
        fun deleteTheFolder() {
            folder.deleteRecursively()
        }
    }
    ```

??? example "shared/src/iosTest/kotlin/com/example/devicemonitor/adapter/outbound/IosLogStoreTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.outbound.LogStore
    import kotlinx.cinterop.ExperimentalForeignApi
    import platform.Foundation.NSFileManager
    import platform.Foundation.NSTemporaryDirectory
    import platform.Foundation.NSUUID
    import kotlin.test.AfterTest

    // The LogStore contract, run in the iOS simulator against the Kotlin/Native adapter and real files.
    @OptIn(ExperimentalForeignApi::class)
    class IosLogStoreTest : LogStoreContract() {
        private val files = NSFileManager.defaultManager
        private val folder = NSTemporaryDirectory() + "log-store-" + NSUUID().UUIDString

        override fun storeAt(fileName: String): LogStore = IosLogStore("$folder/$fileName")

        override fun storeWhereAFileBlocksTheFolder(): LogStore {
            files.createDirectoryAtPath(folder, true, null, null)
            files.createFileAtPath("$folder/logs", null, null)
            return IosLogStore("$folder/logs/status-log.jsonl")
        }

        @AfterTest
        fun deleteTheFolder() {
            files.removeItemAtPath(folder, null)
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

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain, currentTime
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
        fun showsDevicesAsTheyArriveThenFinishesAtTheTimeout() = runTest {
            viewModel.uiState.test {
                assertEquals(ScanState.Idle, awaitItem().scan)

                viewModel.startScan(filter = "")
                assertEquals(ScanState.Scanning(emptyList()), awaitItem().scan)

                scanning.find(obd)
                assertEquals(ScanState.Scanning(listOf(obd)), awaitItem().scan)

                scanning.find(heart)
                assertEquals(ScanState.Scanning(listOf(obd, heart)), awaitItem().scan)

                // Nothing else is found: 10 s of virtual time pass, and the timeout ends the scan.
                assertEquals(ScanState.Finished(listOf(obd, heart)), awaitItem().scan)
                assertEquals(DeviceListViewModel.SCAN_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
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
            assertEquals(0, testScheduler.currentTime) // stopped by the user, not by the timeout
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
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.doubles.FakeBatteryProvider
    import com.example.devicemonitor.doubles.FakeBleConnection
    import com.example.devicemonitor.doubles.FakeBleScanner
    import com.example.devicemonitor.doubles.FakeBluetoothProvider
    import com.example.devicemonitor.doubles.FakeNetworkProvider
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.test.runTest
    import org.koin.dsl.koinApplication
    import kotlin.test.AfterTest
    import kotlin.test.Test
    import kotlin.test.assertNotNull
    import kotlin.test.assertTrue

    class AppModuleTest {
        // Fakes stand in for the adapters each platform passes to initKoin.
        private val radio = FakeBleConnection()
        private val os = FakePermissionChecker()
        private val app = koinApplication {
            modules(
                appModule,
                platformModule(
                    os, FakeBleScanner(), radio,
                    FakeBatteryProvider(), FakeNetworkProvider(), FakeBluetoothProvider(),
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
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
            }
        }
    }
    ```

=== "XML"

    ??? example "build.gradle.kts · XML track (the Compose track's stays as in m11)"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
            id("org.jetbrains.kotlin.multiplatform") version "2.4.20" apply false
            id("org.jetbrains.kotlin.plugin.serialization") version "2.4.20" apply false
            id("co.touchlab.skie") version "0.10.15" apply false
        }
        ```

**Android**

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
    import com.example.devicemonitor.adapter.outbound.AndroidBatteryProvider
    import com.example.devicemonitor.adapter.outbound.AndroidBleConnection
    import com.example.devicemonitor.adapter.outbound.AndroidBleScanner
    import com.example.devicemonitor.adapter.outbound.AndroidBluetoothProvider
    import com.example.devicemonitor.adapter.outbound.AndroidNetworkProvider
    import com.example.devicemonitor.adapter.outbound.AndroidPermissionChecker
    import com.example.devicemonitor.di.initKoin

    // Runs once per process, before any Activity: the place to start Koin.
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
            )
        }
    }
    ```

=== "Compose"

    ??? example "androidApp/src/main/AndroidManifest.xml · Compose track"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <!-- Android 11 and lower: Bluetooth itself, and location for BLE scans. -->
            <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
            <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
            <!-- Android 12 and higher: the Nearby devices permissions. -->
            <uses-permission
                android:name="android.permission.BLUETOOTH_SCAN"
                android:usesPermissionFlags="neverForLocation" />
            <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
            <!-- The app uses Bluetooth LE but still installs without it, and checks at run time. -->
            <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
            <!-- The phone's status (Lesson 17): install-time permissions, granted without a prompt. -->
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
            <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

            <application
                android:name=".DeviceMonitorApplication"
                android:label="Device Monitor"
                android:theme="@android:style/Theme.Material.Light.NoActionBar">
                <activity android:name=".MainActivity" android:exported="true">
                    <intent-filter>
                        <action android:name="android.intent.action.MAIN" />
                        <category android:name="android.intent.category.LAUNCHER" />
                    </intent-filter>
                </activity>
            </application>
        </manifest>
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

        // Stateful: owns the filter text and connects the shared ViewModel to the content below.
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
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Device Monitor", style = MaterialTheme.typography.headlineSmall)
                PhoneStatusRow(text = phoneStatus, onRefresh = onRefreshStatus)
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

=== "XML"

    ??? example "androidApp/src/main/AndroidManifest.xml · XML track"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <!-- Android 11 and lower: Bluetooth itself, and location for BLE scans. -->
            <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
            <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
            <!-- Android 12 and higher: the Nearby devices permissions. -->
            <uses-permission
                android:name="android.permission.BLUETOOTH_SCAN"
                android:usesPermissionFlags="neverForLocation" />
            <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
            <!-- The app uses Bluetooth LE but still installs without it, and checks at run time. -->
            <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
            <!-- The phone's status (Lesson 17): install-time permissions, granted without a prompt. -->
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
            <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

            <application
                android:name=".DeviceMonitorApplication"
                android:label="Device Monitor"
                android:theme="@style/Theme.AppCompat.Light.NoActionBar">
                <activity android:name=".MainActivity" android:exported="true">
                    <intent-filter>
                        <action android:name="android.intent.action.MAIN" />
                        <category android:name="android.intent.category.LAUNCHER" />
                    </intent-filter>
                </activity>
            </application>
        </manifest>
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
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.android.databinding.FragmentDeviceListBinding
        import com.example.devicemonitor.core.PermissionStatus
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        class DeviceListFragment : Fragment() {
            // Survives rotation and the trip to the detail screen; cleared when this
            // Fragment leaves the back stack for good.
            private val viewModel: DeviceListViewModel by viewModel()

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
                return b.root
            }

            override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
                super.onViewCreated(view, savedInstanceState)
                viewLifecycleOwner.lifecycleScope.launch {
                    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                        viewModel.uiState.collect { render(it) }
                    }
                }
            }

            override fun onStart() {
                super.onStart()
                permissionChecker.attach(requireActivity(), permissionLauncher)
            }

            // Back from Settings (or anywhere else): the permission and the status may have changed.
            override fun onResume() {
                super.onResume()
                viewModel.refreshPermission()
                viewModel.refreshStatus()
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
                app:layout_constraintTop_toBottomOf="@id/phoneStatusRow" />

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

??? example "iosApp/iosApp/IosStatusProviders.swift · both iOS tracks"
    ```swift
    import CoreBluetooth
    import Network
    import Shared
    import UIKit

    // Outbound adapter: the battery, behind the Kotlin BatteryProvider port.
    @MainActor
    final class IosBatteryProvider: @preconcurrency BatteryProvider {
        init() {
            // Without this, batteryLevel is always -1.0.
            UIDevice.current.isBatteryMonitoringEnabled = true
        }

        // batteryLevel runs from 0.0 to 1.0, or is -1.0 when iOS can't tell (on the Simulator,
        // always). A Kotlin Int? crosses as KotlinInt?.
        func level() -> KotlinInt? {
            let level = UIDevice.current.batteryLevel
            guard level >= 0 else { return nil }
            return KotlinInt(int: Int32((level * 100).rounded()))
        }
    }

    // Outbound adapter: Wi-Fi and cellular, behind the Kotlin NetworkProvider port. Each
    // NWPathMonitor watches the paths over one kind of interface and keeps the latest in
    // currentPath, so current() only reads them.
    @MainActor
    final class IosNetworkProvider: @preconcurrency NetworkProvider {
        private let wifi = NWPathMonitor(requiredInterfaceType: .wifi)
        private let cellular = NWPathMonitor(requiredInterfaceType: .cellular)

        init() {
            wifi.start(queue: .main)
            cellular.start(queue: .main)
        }

        // The Network framework reports paths, not whether the Wi-Fi radio is switched on, so
        // wifiEnabled is nil: unknown.
        func current() -> NetworkStatus {
            NetworkStatus(
                wifiEnabled: nil,
                wifiConnected: wifi.currentPath.status == .satisfied,
                cellularAvailable: cellular.currentPath.status == .satisfied
            )
        }
    }

    // Outbound adapter: Bluetooth on or off, behind the Kotlin BluetoothProvider port.
    @MainActor
    final class IosBluetoothProvider: NSObject, @preconcurrency BluetoothProvider,
        @preconcurrency CBCentralManagerDelegate {
        private var manager: CBCentralManager?
        private var waiting: [CheckedContinuation<Void, Never>] = []

        // The Kotlin suspend fun, as Swift implements it (Lesson 12's __request). A Kotlin
        // Boolean? crosses as KotlinBoolean?.
        func __isEnabled() async throws -> KotlinBoolean? {
            // Creating a CBCentralManager is what shows the Bluetooth prompt, and only an allowed
            // app learns the radio's state: until then, say "unknown" and create nothing.
            guard CBManager.authorization == .allowedAlways else { return nil }
            let manager = self.manager ?? makeManager()
            if manager.state == .unknown || manager.state == .resetting {
                await withCheckedContinuation { waiting.append($0) }
            }
            switch manager.state {
            case .poweredOn: return KotlinBoolean(bool: true)
            case .poweredOff: return KotlinBoolean(bool: false)
            default: return nil // unsupported (the Simulator) or unauthorized
            }
        }

        // A new manager starts in .unknown and learns the radio's state a moment later, here.
        func centralManagerDidUpdateState(_ central: CBCentralManager) {
            guard central.state != .unknown, central.state != .resetting else { return }
            let answered = waiting
            waiting = []
            answered.forEach { $0.resume() }
        }

        private func makeManager() -> CBCentralManager {
            let manager = CBCentralManager(
                delegate: self, queue: nil,
                options: [CBCentralManagerOptionShowPowerAlertKey: false]
            )
            self.manager = manager
            return manager
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
            init() {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider()
                )
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

        // Stateful: owns the filter text and connects the shared ViewModel to the content below.
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
                    onRefreshStatus: { viewModel.refreshStatus() }
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

        // Stateless: renders whatever it's given, reports events up.
        struct DeviceListContent: View {
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

            var body: some View {
                VStack(alignment: .leading, spacing: 12) {
                    PhoneStatusRow(text: phoneStatus, onRefresh: onRefreshStatus)
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

=== "UIKit"

    ??? example "iosApp/iosApp/AppDelegate.swift"
        ```swift
        import UIKit
        import Shared

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            func application(_ application: UIApplication,
                             didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider()
                )
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

        final class DeviceListViewController: UIViewController, UITableViewDelegate {
            private let owner = ViewModelOwner()
            private lazy var viewModel: DeviceListViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?

            private let phoneStatusLabel = UILabel()
            private let refreshStatusButton = UIButton(configuration: .plain())
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
                let stack = UIStackView(arrangedSubviews: [
                    phoneStatusRow, filterField, permissionRow, scanButton, statusRow, tableView,
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
                // Back from Settings (or anywhere else): the permission and the status may have changed.
                NotificationCenter.default.addObserver(
                    self, selector: #selector(sceneDidActivate),
                    name: UIScene.didActivateNotification, object: nil
                )
            }

            @objc private func sceneDidActivate() {
                viewModel.refreshPermission()
                viewModel.refreshStatus()
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
            }

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                observation?.cancel()
                observation = nil
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
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0, kotlinx.serialization 1.12.0). Nó chạy **đúng code** `StatusService.kt`, `DeviceStatus.kt`, `LogRecord.kt`, `JsonLines.kt` và các port của bài (chỉ gom về một package); các provider là fake viết tay.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-bridge-adapter-nhu-quay-le-tan-giua-hai-phong-ban): bridge adapter như quầy lễ tân giữa hai phòng ban (mục 3).
    3. [A3](#a3-quy-tac-trang-thai-va-json-lines-chay-that-bang-code-cua-bai): quy tắc trạng thái và JSON Lines, chạy thật bằng code của bài (mục 2, 7).
    4. [A4](#a4-ba-nen-tang-tra-loi-ba-cau-hoi): ba câu hỏi về điện thoại, Android cạnh iOS (mục 4, 5).
    5. [A5](#a5-kotlin-goi-foundation-bien-out-va-memscoped): Kotlin gọi Foundation: biến out và `memScoped` (mục 9).
    6. [A6](#a6-mot-hop-ong-test-hai-nen-tang): một hợp đồng test, hai nền tảng (mục 10).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. App có thêm một khả năng: báo **trạng thái của chính điện thoại** (pin, Wi-Fi, mạng di động, Bluetooth) qua inbound port `StatusReport`, do `StatusService` trả lời.
    2. Mỗi câu hỏi cho nền tảng là một outbound port nhỏ (`BatteryProvider`, `NetworkProvider`, `BluetoothProvider`); `null` nghĩa là "nền tảng không nói được", không phải `false`.
    3. "Bluetooth connected" là việc của **session**; nhưng `StatusService` không gọi session, nó hỏi port riêng `ConnectionStatus`, và một **bridge adapter** (`SessionConnectionStatus`) trả lời bằng cách hỏi `DeviceSession`. Luật mới: **các service không biết nhau**.
    4. Kho log là outbound port `LogStore` với một file **JSON Lines** (mỗi dòng một bản ghi JSON); định dạng nằm trong `JsonLines` dùng chung, còn model của app core không dính JSON.
    5. Adapter iOS của kho log viết **bằng Kotlin gọi thẳng Foundation**, truyền địa chỉ một biến cho `NSError` trong `memScoped`; cùng 5 test hợp đồng chạy trên JVM và trong iOS simulator.

Ví dụ đời thường cho cả bài: **bảng tình trạng xe trên taplô.** Đồng hồ xăng (pin), đèn sóng (Wi-Fi, di động), đèn Bluetooth. Mỗi đèn do một cảm biến riêng báo (provider). Đèn "đang nối với điện thoại" thì không do cảm biến nào, mà do **hệ thống giải trí** biết (session); bảng taplô hỏi qua một sợi dây riêng (bridge) chứ không mở hộp hệ thống giải trí ra xem. Và **hộp đen** ghi lại tình trạng mỗi lúc (kho log), mỗi dòng một bản ghi.

| Chữ trong bài | Nói đơn giản | Trong m12 là |
|---|---|---|
| `DeviceStatus` | ảnh chụp trạng thái điện thoại một lúc | pin, Wi-Fi bật / đã kết nối, di động, Bluetooth bật / đã kết nối |
| provider | adapter trả lời một câu hỏi về điện thoại | `AndroidBatteryProvider`, `IosNetworkProvider`… |
| bridge adapter | adapter dùng chung trả lời port của service này bằng inbound port của service kia | `SessionConnectionStatus` |
| `ConnectionStatus` | port "app có đang giữ liên kết không" theo cách nói của status | `current(): ConnectionState` |
| quyền cấp lúc cài | quyền mức `normal`, không hộp thoại | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` |
| mạng nền | mạng Android giữ phía sau Wi-Fi, app thường không được dùng | lý do "no cellular" khi Wi-Fi đã lên |
| JSON Lines | file chữ, mỗi dòng một JSON | `status-log.jsonl` |
| `@Serializable` | plugin sinh code đọc / ghi JSON cho một class | `JsonLines.Line` (private) |
| `memScoped` / `alloc` / `.ptr` | cấp phát bộ nhớ native tạm, lấy địa chỉ, tự giải phóng | biến `NSError` cho Foundation |
| test hợp đồng | một bộ test viết một lần, chạy với mọi adapter của một port | `LogStoreContract` |

### A2. Bridge adapter như quầy lễ tân giữa hai phòng ban

Giải thích thêm cho [mục 3](#3-cac-service-gap-nhau-qua-mot-bridge-adapter).

Ví dụ đời thường: phòng **Hành chính** (`StatusService`) cần biết "giám đốc có đang tiếp khách không". Phòng **Lễ tân** (`SessionService`) biết chuyện đó. Hành chính không chạy sang lục sổ của Lễ tân (gọi thẳng service), cũng không bắt Lễ tân phải làm việc của Hành chính (`SessionService` implement luôn port). Hành chính ghi trong quy trình của mình "hỏi **bàn tin nhắn**" (port `ConnectionStatus`), và có một nhân viên ngồi ở bàn tin nhắn (bridge) chuyên gọi điện sang quầy công khai của Lễ tân (`DeviceSession`) rồi chép lại nguyên câu trả lời, không tự thêm ý kiến.

| | Không có bridge (gọi thẳng `DeviceSession`) | Có bridge |
|---|---|---|
| `StatusService` phụ thuộc | `DeviceSession` (connect, read, subscribe…) | `ConnectionStatus` (một hàm) |
| Fake trong test | `TestDeviceSession`, 72 dòng | `FakeConnectionStatus`, vài dòng |
| Quy tắc "chỉ `Connected` mới tính" ở | `StatusService` | `StatusService` (bridge không có `if`) |
| Đổi session sau này | có thể làm vỡ test của status | chỉ đụng bridge |

So với TS/JS: giống một `interface ConnectionStatus { current(): ConnectionState }` trong module status, và một file `sessionConnectionStatus.ts` trong lớp adapter: `export const fromSession = (s: DeviceSession): ConnectionStatus => ({ current: () => s.connectionState.value })`. Module status không bao giờ `import` gì từ module session.

### A3. Quy tắc trạng thái và JSON Lines, chạy thật bằng code của bài

Giải thích thêm cho [mục 2](#2-status-service-cac-quy-tac-cua-app-cho-trang-thai) và [mục 7](#7-kho-log-mot-port-va-mot-inh-dang-file). Chương trình dưới dựng `StatusService` thật với bốn fake, đổi trạng thái mạng và kết nối, rồi ghi và đọc lại hai bản ghi bằng `JsonLines` thật:

```kotlin title="l17/Main.kt (chạy code của bài, không có trong app)"
class Battery(var level: Int?) : BatteryProvider { override fun level() = level }
class Network(var now: NetworkStatus) : NetworkProvider { override fun current() = now }
class Bluetooth(var on: Boolean?) : BluetoothProvider { override suspend fun isEnabled() = on }
class Link(var state: ConnectionState) : ConnectionStatus { override fun current() = state }

fun main() = runBlocking {
    val obd = Device("1", "OBD-II Adapter", -60)
    val net = Network(NetworkStatus(wifiEnabled = null, wifiConnected = true, cellularAvailable = false))
    val link = Link(ConnectionState.Disconnected)
    val service = StatusService(Battery(null), net, Bluetooth(null), link)

    println("Wi-Fi đã kết nối    -> wifiEnabled = ${service.current().wifiEnabled}")
    net.now = NetworkStatus(wifiEnabled = null, wifiConnected = false, cellularAvailable = true)
    println("Wi-Fi chưa kết nối  -> wifiEnabled = ${service.current().wifiEnabled}")

    for (s in listOf(ConnectionState.Disconnected, ConnectionState.Connecting(obd), ConnectionState.Connected(obd))) {
        link.state = s
        println("%-13s -> bluetoothConnected = %s".format(s::class.simpleName, service.current().bluetoothConnected))
    }

    val a = LogRecord(Instant.parse("2026-09-11T10:30:00Z"), DeviceStatus(82, true, true, false, true, false))
    val b = LogRecord(Instant.parse("2026-09-11T10:45:00Z"), DeviceStatus(null, null, false, true, null, false))
    val text = JsonLines.encode(a) + "\n" + JsonLines.encode(b) + "\n"
    print(text)
    println("đọc lại: ${JsonLines.decode(text).size} bản ghi, bằng nhau: ${JsonLines.decode(text) == listOf(a, b)}")
    try {
        JsonLines.decode(text + """{"timestamp":"2026-09-11T11:00:00Z","battery":7""" + "\n")
    } catch (e: LogStoreException) {
        println("dòng ghi dở: ${e.message?.take(70)}…")
    }
    Unit
}
```

Output thật (đã bỏ các dòng tiêu đề):

```text
Wi-Fi đã kết nối    -> wifiEnabled = true
Wi-Fi chưa kết nối  -> wifiEnabled = null
Disconnected  -> bluetoothConnected = false
Connecting    -> bluetoothConnected = false
Connected     -> bluetoothConnected = true
{"timestamp":"2026-09-11T10:30:00Z","battery":82,"wifiEnabled":true,"wifiConnected":true,"cellularAvailable":false,"bluetoothEnabled":true,"bluetoothConnected":false}
{"timestamp":"2026-09-11T10:45:00Z","battery":null,"wifiEnabled":null,"wifiConnected":false,"cellularAvailable":true,"bluetoothEnabled":null,"bluetoothConnected":false}
đọc lại: 2 bản ghi, bằng nhau: true
dòng ghi dở: Line 3 of the log isn't a record: Expected end of the object '}', but …
```

1. **Quy tắc Wi-Fi.** Adapter iOS luôn trả `wifiEnabled = null`. Service biến nó thành `true` khi Wi-Fi đã kết nối; khi chưa kết nối thì vẫn `null`, vì "không biết" trung thực hơn đoán.
2. **Đang kết nối không phải đã kết nối.** Chỉ `Connected` cho `true`.
3. **Mỗi dòng đủ mọi trường**, kể cả `null` (`explicitNulls` mặc định bật); timestamp kết thúc bằng `Z` (UTC).
4. **Đọc lại bằng nhau**: `LogRecord` là data class, nên `==` so từng trường, kể cả `Instant`.
5. **Một dòng ghi dở** (như sau một lần crash) làm cả lần đọc thất bại, và thông báo gọi đúng số dòng.

So với TS/JS: `JsonLines.encode` giống `JSON.stringify(line)`, và `decode` giống `text.split("\n").filter(Boolean).map(JSON.parse)`. Khác ở chỗ Kotlin kiểm tra kiểu: thiếu một trường bắt buộc là lỗi, không phải `undefined`.

### A4. Ba nền tảng trả lời ba câu hỏi

Giải thích thêm cho [mục 4](#4-android-ba-adapter-hai-quyen-cap-luc-cai) và [mục 5](#5-ios-ba-adapter-swift).

| Câu hỏi | Android (Kotlin, `androidMain`) | iOS (Swift, app iOS) | Khi không biết |
|---|---|---|---|
| Pin còn bao nhiêu? | `BatteryManager.getIntProperty(BATTERY_PROPERTY_CAPACITY)` | `UIDevice.current.batteryLevel` (phải bật `isBatteryMonitoringEnabled`) | Android: `Int.MIN_VALUE`; iOS: `-1.0` (Simulator luôn vậy) → `null` |
| Wi-Fi bật? | `WifiManager.isWifiEnabled` | **không có API** | iOS: `null`, service điền `true` nếu đã kết nối |
| Wi-Fi đã kết nối? | `NetworkCallback` + `NetworkCapabilities.TRANSPORT_WIFI` | `NWPathMonitor(requiredInterfaceType: .wifi)` `.satisfied` | |
| Có mạng di động dùng được? | `NetworkCallback` + `TRANSPORT_CELLULAR` | `NWPathMonitor(requiredInterfaceType: .cellular)` | |
| Bluetooth bật? | `BluetoothAdapter.isEnabled` | `CBCentralManager.state` sau `centralManagerDidUpdateState` | iOS chưa cho phép Bluetooth: `nil`, **không** tạo manager |
| Quyền cần | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` (cấp lúc cài) | không | |

Hai chỗ dễ vấp:

- **"no cellular" khi điện thoại vẫn có 4G.** Khi Wi-Fi lên, Android đẩy mạng di động xuống **nền**. App không có `CHANGE_NETWORK_STATE` thì không dùng được mạng nền, nên callback của nó nhận `onLost`. "Available" trong app nghĩa là "app này dùng được", nên câu trả lời đúng.
- **Hướng dẫn nói không cần quyền, reference nói cần.** `registerNetworkCallback` thật sự ném `SecurityException` khi thiếu `ACCESS_NETWORK_STATE`. Khi hai tài liệu cãi nhau: tin trang reference của method, rồi chạy thử.

### A5. Kotlin gọi Foundation: biến out và `memScoped`

Giải thích thêm cho [mục 9](#9-ios-kotlin-goi-foundation).

Ví dụ đời thường: bạn gửi một **phong bì rỗng có ghi địa chỉ nhà mình** kèm đơn xin việc. Nếu bị từ chối, công ty bỏ thư từ chối vào phong bì đó gửi về; nếu được nhận, phong bì về rỗng. Bạn xem kết quả trước (`false` = bị từ chối), rồi mới mở phong bì đọc lý do. Hết việc thì vứt phong bì (`memScoped` giải phóng).

| Bước | Objective-C | Kotlin/Native (`IosLogStore`) | Swift (để so) |
|---|---|---|---|
| Chuẩn bị chỗ chứa lỗi | `NSError *error = nil;` | `val error = alloc<ObjCObjectVar<NSError?>>()` trong `memScoped { }` | (không cần) |
| Gọi | `[fm createDirectoryAtPath:… error:&error]` | `createDirectoryAtPath(folder, true, null, error.ptr)` | `try fm.createDirectory(atPath:…)` |
| Biết thất bại | giá trị trả về `NO` | giá trị trả về `false` | Swift ném lỗi |
| Đọc lý do | `error.localizedDescription` | `error.value?.localizedDescription` | `catch { error.localizedDescription }` |
| Đổi sang lỗi của app | | `throw LogStoreException(…)` | |
| Giải phóng | ARC | hết khối `memScoped` | ARC |

Vì sao Kotlin không có `try` như Swift? Vì Kotlin/Native import header Objective-C, và "các method ném lỗi của Swift/Objective-C không được import sang Kotlin dưới dạng ném exception". Swift có lớp dịch riêng biến `NSError **` thành `throws`; Kotlin thì để nguyên con trỏ.

So với TS/JS: không có con trỏ; gần nhất là truyền một object rỗng `const out = {}` để hàm gán `out.error = …` vào, kiểu C-style mà JS gần như không bao giờ dùng.

### A6. Một hợp đồng test, hai nền tảng

Giải thích thêm cho [mục 10](#10-test-mot-hop-ong-hai-nen-tang).

```text
commonTest/LogStoreContract (abstract)      ← 5 @Test viết một lần, gọi storeAt(fileName)
├── androidHostTest/AndroidLogStoreTest     ← storeAt = AndroidLogStore(File(tempDir, fileName))   chạy trên JVM
└── iosTest/IosLogStoreTest                 ← storeAt = IosLogStore(tempPath + fileName)          chạy trong iOS simulator
```

| | Test service (bài 11 tới giờ) | Test hợp đồng kho log |
|---|---|---|
| Thứ được test | quy tắc trong app core | chính adapter |
| Phía sau port | fake | **file thật** |
| Viết mấy lần | một | một, kế thừa hai lần |
| Chạy ở | JVM và iOS (cùng code) | JVM với adapter Android, iOS với adapter iOS |
| Thời gian | ảo | thật (`Dispatchers.IO`), vài mili giây |

So với TS/JS: giống một hàm `describeLogStore(name, makeStore)` chứa các `it(...)`, rồi gọi `describeLogStore("node fs", () => new FsLogStore(tmp))` và `describeLogStore("indexeddb", () => new IdbLogStore())`.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 18.

- [ ] Giải thích vì sao `DeviceStatus` có ba trường nullable, và vì sao `null` không phải `false`.
- [ ] Đọc `StatusService` và nói hai quy tắc của nó: Wi-Fi đã kết nối nghĩa là đang bật, và chỉ `Connected` mới tính là đã kết nối (xem [A3](#a3-quy-tac-trang-thai-va-json-lines-chay-that-bang-code-cua-bai)).
- [ ] Phát biểu luật "các service không biết nhau", và vẽ đường đi status → `ConnectionStatus` → bridge → `DeviceSession` (xem [A2](#a2-bridge-adapter-nhu-quay-le-tan-giua-hai-phong-ban)).
- [ ] Nói được vì sao không dùng các cách gần hơn bridge (gọi thẳng, `SessionService` implement port, domain event…).
- [ ] Viết một adapter Android dùng `NetworkCallback` giữ trạng thái mới nhất, và giải thích "no cellular" khi Wi-Fi đã lên (xem [A4](#a4-ba-nen-tang-tra-loi-ba-cau-hoi)).
- [ ] Khai báo `ACCESS_NETWORK_STATE` / `ACCESS_WIFI_STATE`, và biết chúng là quyền cấp lúc cài.
- [ ] Viết một adapter Swift không bao giờ làm hiện hộp thoại Bluetooth khi đọc trạng thái.
- [ ] Hiện dòng trạng thái và làm mới đúng lúc trên track của mình (resume, quay về từ màn hình chi tiết, Refresh).
- [ ] Ghi và đọc một file JSON Lines bằng kotlinx.serialization, giữ `@Serializable` trong adapter chứ không trong model của core.
- [ ] Đọc một lời gọi Foundation từ Kotlin có `memScoped`, `alloc`, `.ptr`, `.value`, và biến lỗi `NSError` thành `LogStoreException` (xem [A5](#a5-kotlin-goi-foundation-bien-out-va-memscoped)).
- [ ] Viết một test hợp đồng trong `commonTest` và kế thừa nó cho hai nền tảng (xem [A6](#a6-mot-hop-ong-test-hai-nen-tang)).
- [ ] Làm xong 6 bài tự làm ở trên mà không cần agent.
