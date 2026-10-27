---
source: lessons/14-ble-connect.html
source_ref: live
source_sha: 8108021
---

# BLE: kết nối

<p class="kicker">Bài 14 · Tuần 3 · Ngày 14 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/14-ble-connect.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m09 kết nối, trạng thái kết nối trực tiếp</span>
  <span class="tag">Cần trước: <a href="../13-ble-khai-niem-va-quet/">13</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Ở m08 danh sách đã hiện thiết bị thật, nhưng chạm vào một thiết bị thì mở ra màn hình chi tiết ghi "Unknown device" và không làm được gì. Hôm nay màn hình chi tiết nhận đúng thiết bị bạn đã chạm, và có một nút Connect.
    App kết nối qua một inbound port mới, `DeviceSession`, mà session service của nó giữ các quy tắc (quyền, mỗi lần một thiết bị, giới hạn thời gian) và trạng thái kết nối mà mọi màn hình hiển thị. Việc của radio nằm sau một outbound port mới, `BleConnection`: `connectGatt` của Android bằng Kotlin, và `connect(_:)` của CoreBluetooth bằng Swift. Lỗi tới màn hình dưới dạng một thông báo.
    Và bạn gặp cái bẫy làm mất kết nối trong các app thật: kết nối được giữ trong một thứ mà một lần xoay màn hình hay một view đóng lại sẽ vứt đi. Đó là milestone **m09**.

!!! info "Nguồn chính"
    Trang [Connect to a GATT server](https://developer.android.com/develop/connectivity/bluetooth/ble/connect-gatt-server) của Android, trước mục 4. Với iOS, trang [CBCentralManager](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager) của Apple, phần các phương thức kết nối, trước mục 5. Sơ đồ vòng đời của bài 08, trước mục 7.

!!! info "Track"
    Các khái niệm, các port, service, cả hai radio và các test (mục 1–5 và 9) giống nhau trên mọi track. Các track khác nhau ở màn hình chi tiết (mục 6), cách danh sách đưa thiết bị cho nó, và phần khởi động app (mục 8).
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## Thay đổi so với m08

| Cái gì | m08 | m09 |
|---|---|---|
| app core | quét và quyền | thêm `ConnectionState`, `ConnectionException`, inbound port `DeviceSession`, outbound port `BleConnection` và `SessionService` |
| outbound adapter | hai scanner | thêm `AndroidBleConnection` (Kotlin, `androidMain`), `IosBleConnection` (Swift, app iOS) cùng `ConnectFlow.kt` trong `iosMain`, và `SimulatedBleConnection` (không dùng, để chạy khi không có radio) |
| màn hình chi tiết | tra id của nó trong `SampleDevices`; "Unknown device" với thiết bị thật | nhận cả `Device` qua navigation; một `DeviceDetailViewModel`, một dòng trạng thái, Connect / Disconnect, một alert "Connection failed" |
| `SampleDevices` | các thiết bị của radio giả lập, và `find(id)` cho màn hình chi tiết | chỉ còn các thiết bị; không còn gì gọi `find`, nên nó bị bỏ |
| khởi động Koin | `initKoin(permissionChecker, bleScanner)` | `initKoin(permissionChecker, bleScanner, bleConnection)` |
| test | 20 mỗi nền tảng | 33 mỗi nền tảng: 8 cho session service, 5 cho ViewModel chi tiết |

## 1. Kết nối nghĩa là gì

Một lần quét chỉ nghe. Để đọc hay nhận dữ liệu của một thiết bị (bài 15–16), điện thoại phải kết nối. Hướng dẫn của Android viết: "Để kết nối tới một GATT server trên một thiết bị BLE, dùng phương thức `connectGatt()`", và "Bên gọi (app Android) là GATT client" ([Connect to a GATT server](https://developer.android.com/develop/connectivity/bluetooth/ble/connect-gatt-server)). Trên iOS, `connect(_:options:)` của `CBCentralManager` "Bắt đầu một kết nối tới *peripheral*" (`CBCentralManager.h`). Hôm nay app chỉ mở và đóng liên kết đó, và cho thấy nó đang ở đâu.

Bài 13 đã liệt kê bốn trạng thái mà cả hai nền tảng đặt tên: disconnected, connecting, connected, disconnecting. App core có `ConnectionState` của riêng nó, theo cách nói của app, và nó chỉ cần ba:

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 270" role="img" aria-labelledby="l14-states-title">
<title id="l14-states-title">Các trạng thái kết nối của app core. Ba ô: Disconnected, Connecting kèm thiết bị của nó, Connected kèm thiết bị của nó. connect(device) chuyển Disconnected sang Connecting. Radio báo liên kết đã lên thì chuyển Connecting sang Connected. Từ Connecting hoặc Connected, bốn thứ dẫn về Disconnected: disconnect(), coroutine của bên gọi bị huỷ, radio báo lỗi hoặc liên kết bị rớt, và, chỉ từ Connecting, hết hạn 10 giây. Hai cái đầu kết thúc lặng lẽ; hai cái sau kết thúc bằng một ConnectionException mà màn hình hiện là Connection failed.</title>
<defs><marker id="l14-states-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="core">
<rect class="box" x="20" y="40" width="170" height="56" rx="8"/>
<text class="title" x="36" y="64">Disconnected</text>
<text class="small muted" x="36" y="84">không có thiết bị</text>
<rect class="box" x="295" y="40" width="170" height="56" rx="8"/>
<text class="title" x="311" y="64">Connecting</text>
<text class="small muted" x="311" y="84">(device)</text>
<rect class="box" x="570" y="40" width="170" height="56" rx="8"/>
<text class="title" x="586" y="64">Connected</text>
<text class="small muted" x="586" y="84">(device)</text>
</g>
<path class="edge" d="M190,60 L293,60" marker-end="url(#l14-states-arrow)"/>
<text class="mono small" x="192" y="30">connect(device)</text>
<path class="edge" d="M465,60 L568,60" marker-end="url(#l14-states-arrow)"/>
<text class="small" x="470" y="30">radio: liên kết đã lên</text>
<path class="edge dashed" d="M380,96 L380,150 L105,150 L105,98" marker-end="url(#l14-states-arrow)"/>
<path class="edge dashed" d="M655,96 L655,170 L95,170 L95,98" marker-end="url(#l14-states-arrow)"/>
<text class="small" x="20" y="200">Về Disconnected, lặng lẽ: disconnect(), hoặc coroutine của bên gọi bị huỷ</text>
<text class="small" x="20" y="220">Về Disconnected kèm một ConnectionException (màn hình hiện "Connection failed"):</text>
<text class="small" x="20" y="240">radio báo lỗi hoặc liên kết bị rớt, hoặc (từ Connecting) qua 10 s không có trả lời</text>
</svg>
<figcaption>Ba trạng thái của app. Mọi lối ra đều dẫn về Disconnected; chỉ các lỗi mới mang theo thông báo.
<ul class="legend"><li data-part="core">App core</li></ul>
</figcaption>
</figure>

1. **Không có trạng thái disconnecting.** Khi app đã xin ngắt kết nối, nó xong việc với thiết bị và không chờ radio xác nhận. Các adapter giải phóng thứ chúng giữ ngay lập tức (mục 4 và 5).
2. **Cũng không có trạng thái failed.** Một lần lỗi là một khoảnh khắc, không phải một chỗ để ở lại: trạng thái quay về Disconnected, và lý do đi theo một `ConnectionException` tới chỗ đã gọi `connect`. Màn hình hiện nó bằng mẫu của bài 08, `errorMessage` cộng `errorShown()`, như danh sách làm với `ScanException`.
3. **Thiết bị nằm trong trạng thái**, nên bất kỳ màn hình nào cũng nói được app đang kết nối với cái gì, không chỉ màn hình đã kết nối.

## 2. Hai port mới

Trước hết là từ ngữ của app: trạng thái, và lỗi.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ConnectionState.kt" hl_lines="4"
⋯ package
// Where the app's connection to a device stands, in the app's terms. Each platform's adapter
// turns its radio's callbacks into these.
sealed interface ConnectionState {
    data object Disconnected : ConnectionState
    data class Connecting(val device: Device) : ConnectionState
    data class Connected(val device: Device) : ConnectionState
}
```

`ConnectionException` là anh em sinh đôi của `ScanException`: một class, một thông báo cho người dùng, do service và các adapter ném ra. Outbound port có hình dạng bạn đã gặp ở `BleScanner.scan()` của bài 13:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleConnection.kt" hl_lines="4 6 8"
⋯ package and imports: ConnectionState, Device, Flow
// Outbound port: what the app needs from a Bluetooth radio to hold a link to one device, in the
// app's own terms. One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
interface BleConnection {
    // The link to device, as its state changes: Connecting, then Connected once it's up.
    // Collecting starts the connection, and cancelling the collector ends it and frees what the
    // radio held for it. Throws ConnectionException when the attempt fails or the link drops.
    fun connect(device: Device): Flow<ConnectionState>
}
```

1. **Một lời gọi, ba việc.** Collect thì kết nối, mỗi giá trị phát ra báo trạng thái của liên kết, và huỷ thì ngắt kết nối. Cả hai adapter dựng nó bằng `callbackFlow`, nên `awaitClose` là nơi liên kết của radio được đóng, bất kể cái gì kết thúc nó.
2. **Sao không phải `connect()`, `disconnect()` và một state flow, như Appendix A.3 trong kế hoạch khoá học gợi ý?** Kế hoạch gọi các tên của nó là gợi ý, còn hành vi mới là yêu cầu. Với ba lời gọi riêng, adapter nào cũng phải giữ state giữa chúng, và một `disconnect()` bị quên sẽ để một liên kết mở. Ở đây, kết thúc việc collect luôn đóng nó: một quy tắc, chính quy tắc bài 13 đã dùng cho lần quét của radio.

Inbound port là thứ các ViewModel nhìn thấy. Nó có ba thành phần của kế hoạch:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt" hl_lines="4 6 11 14"
⋯ package and imports: ConnectionState, Device, StateFlow
// Inbound port: what the app offers for talking to one device. Inbound adapters (the shared
// ViewModels) call it, and SessionService implements it.
interface DeviceSession {
    // Where the connection stands now. Every screen that shows it reads this one state.
    val connectionState: StateFlow<ConnectionState>

    // Connects to device and holds the connection for as long as the call runs. Returns after
    // disconnect(); cancelling the caller's coroutine also disconnects. Throws ConnectionException:
    // no permission, another connection open, no answer, or the link failed or dropped.
    suspend fun connect(device: Device)

    // Ends the connection, or the attempt, that connect() is holding.
    fun disconnect()
}
```

1. **`connectionState` là một `StateFlow`**: nó luôn có giá trị, nên một màn hình mở sau vẫn đọc được ngay tình hình hiện tại (bài 08).
2. **`connect` treo (suspend) suốt cả kết nối**, không chỉ tới khi liên kết lên. Ai gọi nó thì quyết định kết nối được sống bao lâu: chính coroutine nó chạy trong đó. Mục 7 cho thấy vì sao điều đó quan trọng hơn mọi thứ khác trong bài này.
3. **Ba lối ra khỏi `connect`**: nó trả về sau `disconnect()`, nó ném `CancellationException` khi bên gọi bị huỷ, và nó ném `ConnectionException` khi có lỗi.

## 3. Session service

Các quy tắc nằm trong `SessionService`: giống nhau trên cả hai nền tảng, và được test một lần trên JVM.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="2 7 10 15 17 22"
⋯ class SessionService(connection: BleConnection, permissions: PermissionChecker) : DeviceSession
    private val state = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    override val connectionState: StateFlow<ConnectionState> = state.asStateFlow()
    private var link: Job? = null

    override suspend fun connect(device: Device) {
        if (permissions.check(Permission.Bluetooth) != PermissionStatus.Granted) {
            throw ConnectionException("Connecting needs the Bluetooth permission.")
        }
        if (state.value != ConnectionState.Disconnected) {
            throw ConnectionException("Another connection is open. Disconnect it first.")
        }
        state.value = ConnectionState.Connecting(device)
⋯ try { the link: below }
        } finally {
            link = null
            state.value = ConnectionState.Disconnected
        }
    }

    // Cancelling the link ends its collection, and the adapter closes the radio's link.
    override fun disconnect() {
        link?.cancel()
    }
```

1. **Service sở hữu state.** Chỉ service ghi nó, còn các adapter chỉ báo. Dù cái gì kết thúc kết nối, `finally` cũng để state ở Disconnected, nên không màn hình nào có thể bị kẹt ở "connected" cho một liên kết đã mất.
2. **Quyền trước tiên**, như trong `ScanningService`: `connectGatt` của Android được khai báo `@RequiresPermission(BLUETOOTH_CONNECT)` (source của Android), và `Permission.Bluetooth` của bài 12 đã bao `BLUETOOTH_CONNECT` trên Android 12 trở lên.
3. **Mỗi lần một thiết bị** là quy tắc của app này. Màn hình cũng ẩn Connect khi đang có kết nối, nhưng đó là phần trình bày (lập luận của bài 13): quy tắc nằm ở nơi mọi bên gọi đều phải đi qua.
4. **State được đặt thành Connecting trước lần treo đầu tiên**, nên một `connect` thứ hai theo ngay sau lần đầu đã thấy nó.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="2 3 5 7 9 11"
        try {
            coroutineScope {
                link = launch {
                    // iOS never gives up on a connection attempt, so the app does.
                    val giveUp = launch {
                        delay(CONNECT_TIMEOUT)
                        throw ConnectionException("${device.name} didn't answer within 10 seconds.")
                    }
                    connection.connect(device).collect { linkState ->
                        state.value = linkState
                        if (linkState is ConnectionState.Connected) giveUp.cancel()
                    }
                }
            }
        } finally {
⋯ as above; CONNECT_TIMEOUT = 10.seconds in the companion object
```

1. **`link` là một coroutine con** bên trong `coroutineScope`, và `disconnect()` huỷ nó. Một coroutine con bị huỷ không làm hỏng cha của nó, nên `coroutineScope` khi đó trả về bình thường và `connect` trả về: một lần ngắt kết nối do app xin thì không phải lỗi.
2. **Một lỗi làm hỏng scope.** Một `ConnectionException` từ flow của adapter, hoặc từ `giveUp`, huỷ link và thoát khỏi `coroutineScope`, và do đó khỏi `connect`, cùng exception đó. Huỷ việc collect chạy `awaitClose` của adapter: liên kết của radio được đóng trên mọi đường.
3. **Vì sao cần hết hạn?** Apple: "Các lần thử kết nối không bao giờ hết hạn" (`CBCentralManager.h`, `connectPeripheral:options:`). Không có giới hạn riêng của app, một thiết bị đã tắt sẽ để màn hình iPhone ở "connecting…" mãi mãi. Trên emulator API 30 của chúng tôi, lần thử của chính Android kết thúc sau khoảng 30 giây (mục 7), nên 10 giây là lựa chọn của app trên cả hai nền tảng. `giveUp` bị huỷ khi liên kết đã lên: giới hạn là cho việc kết nối, không phải cho việc đang kết nối.

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 330" role="img" aria-labelledby="l14-hex-title">
<title id="l14-hex-title">Ai nói chuyện với ai khi người dùng chạm Connect. Màn hình chi tiết gọi DeviceDetailViewModel, một inbound adapter, thứ gọi inbound port DeviceSession. SessionService trong app core implement nó. Nó hỏi outbound port PermissionChecker về quyền, rồi collect BleConnection.connect(device). Hai outbound adapter implement BleConnection: AndroidBleConnection, Kotlin trong androidMain trên BluetoothGatt; và IosBleConnection, Swift trong app iOS trên CBCentralManager, lấy Flow của nó từ ConnectFlow.kt, Kotlin trong iosMain. Trong test, FakeBleConnection và FakePermissionChecker đứng thay các adapter.</title>
<defs><marker id="l14-hex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="android">
<rect class="box" x="10" y="30" width="130" height="50" rx="6"/>
<text class="title small" x="20" y="50">Chi tiết Android</text>
<text class="small muted" x="20" y="68">Compose · XML</text>
</g>
<g data-part="ios">
<rect class="box" x="10" y="100" width="130" height="50" rx="6"/>
<text class="title small" x="20" y="120">Chi tiết iOS</text>
<text class="small muted" x="20" y="138">SwiftUI · UIKit</text>
</g>
<g data-part="inbound">
<rect class="box" x="170" y="62" width="130" height="56" rx="6"/>
<text class="mono small" x="180" y="84">DeviceDetail</text>
<text class="mono small" x="180" y="100">ViewModel</text>
</g>
<g data-part="core">
<polygon class="box" points="320,90 350,20 560,20 590,90 560,160 350,160"/>
<text class="title" x="455" y="40" text-anchor="middle">App core</text>
<rect class="box" x="400" y="62" width="110" height="44" rx="6"/>
<text class="mono small" x="408" y="80">Session</text>
<text class="mono small" x="408" y="96">Service</text>
</g>
<g data-part="inbound">
<rect class="box" x="300" y="128" width="110" height="26" rx="6"/>
<text class="mono small" x="308" y="146">DeviceSession</text>
</g>
<g data-part="outbound">
<rect class="box" x="574" y="40" width="130" height="26" rx="6"/>
<text class="mono small" x="580" y="58">PermissionChecker</text>
<rect class="box" x="480" y="128" width="106" height="26" rx="6"/>
<text class="mono small" x="486" y="146">BleConnection</text>
<rect class="box" x="520" y="196" width="230" height="50" rx="6"/>
<text class="mono small" x="530" y="216">AndroidBleConnection</text>
<text class="small muted" x="530" y="234">Kotlin, androidMain · BluetoothGatt</text>
<rect class="box" x="520" y="262" width="230" height="56" rx="6"/>
<text class="mono small" x="530" y="282">IosBleConnection</text>
<text class="small muted" x="530" y="300">Swift, app iOS · CBCentralManager</text>
<text class="small muted" x="530" y="314">+ ConnectFlow.kt, Kotlin ở iosMain</text>
<rect class="box" x="300" y="262" width="190" height="56" rx="6"/>
<text class="mono small" x="310" y="282">FakeBleConnection</text>
<text class="mono small" x="310" y="298">FakePermissionChecker</text>
<text class="small muted" x="310" y="312">commonTest</text>
</g>
<path class="edge" d="M140,55 L168,80" marker-end="url(#l14-hex-arrow)"/>
<path class="edge" d="M140,125 L168,102" marker-end="url(#l14-hex-arrow)"/>
<path class="edge" d="M235,118 L300,140" marker-end="url(#l14-hex-arrow)"/>
<path class="edge dashed" d="M420,106 L390,126" marker-end="url(#l14-hex-arrow)"/>
<path class="edge" d="M510,72 L572,56" marker-end="url(#l14-hex-arrow)"/>
<path class="edge" d="M500,106 L525,126" marker-end="url(#l14-hex-arrow)"/>
<text class="small" x="596" y="96">1. có quyền?</text>
<text class="small" x="596" y="112">2. connect(device)</text>
<text class="small" x="596" y="128">được collect</text>
<path class="edge dashed" d="M600,196 L560,156" marker-end="url(#l14-hex-arrow)"/>
<path class="edge dashed" d="M520,288 L508,288 L508,176 L533,157" marker-end="url(#l14-hex-arrow)"/>
<path class="edge dashed" d="M400,262 L493,157" marker-end="url(#l14-hex-arrow)"/>
</svg>
<figcaption>Mũi tên liền là lời gọi; mũi tên đứt đi vào một port nghĩa là "implement" (mỗi fake implement port của riêng nó). Các con số là thứ tự của service. Sơ đồ của bài 13 có cùng hình dạng: thêm một khả năng, vẫn cái lục giác đó.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound (port và adapter)</li><li data-part="outbound">Outbound (port và adapter)</li><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

## 4. Liên kết Android: `connectGatt`

Hướng dẫn của Android: `connectGatt` nhận "một object Context, autoConnect (một boolean cho biết có tự động kết nối tới thiết bị BLE ngay khi nó sẵn sàng hay không), và một tham chiếu tới một BluetoothGattCallback", và "trả về một instance BluetoothGatt, mà bạn dùng sau đó để thực hiện các thao tác GATT client" ([Connect to a GATT server](https://developer.android.com/develop/connectivity/bluetooth/ble/connect-gatt-server)). Cùng mẫu với scanner: một object callback, được `callbackFlow` biến thành một `Flow`.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="2 4 8 11 13 15 17 18"
⋯ the class, its BluetoothAdapter, and @SuppressLint("MissingPermission"): as in AndroidBleScanner
    override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
        val adapter = adapter
        if (adapter == null || !adapter.isEnabled) {
            throw ConnectionException("Bluetooth is off. Turn it on, then connect again.")
        }
        // Called on a background thread. trySend and close are safe from any thread.
        val callback = object : BluetoothGattCallback() {
            private var linked = false

            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                when {
                    status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED -> {
                        linked = true
                        trySend(ConnectionState.Connected(device))
                    }
                    linked -> close(ConnectionException("The link to ${device.name} was lost (Android status $status)."))
                    else -> close(ConnectionException("The connection failed (Android status $status)."))
                }
            }
        }
⋯ connectGatt and awaitClose: below
```

1. **`onConnectionStateChange`** là "Callback cho biết khi nào GATT client đã kết nối/ngắt kết nối tới/khỏi một GATT server từ xa". `status` của nó là "`GATT_SUCCESS` nếu thao tác thành công", và `newState` "Có thể là `STATE_DISCONNECTED` hoặc `STATE_CONNECTED`" (`BluetoothGattCallback`, source của Android). Chỉ một tổ hợp có nghĩa là liên kết đã lên. Mọi lần gọi khác kết thúc flow bằng một lỗi.
2. **`linked` phân biệt hai loại lỗi**: lỗi trước khi liên kết lên ("The connection failed"), hoặc rớt sau đó ("was lost"). Status nằm trong thông báo, như scanner đã để mã lỗi của nó ở đó; bài 16 xử lý chuyện rớt cho đàng hoàng.
3. **Một background thread.** Không có `Handler` thì "các callback sẽ chạy trên một background thread không xác định" (tài liệu của `BluetoothDevice.connectGatt` trong source của Android). Trong lần chạy API 30 của chúng tôi (mục 7), các dòng log của callback đến từ một thread khác thread chính. Ở đây không sao: `ProducerScope` của `callbackFlow` "dùng được từ bất kỳ context nào", và service collect trên thread của ViewModel.
4. **Bluetooth tắt** được kiểm tra ở đây, như scanner kiểm tra việc thiếu `bluetoothLeScanner`. Port không có `isEnabled()`: adapter là bên biết chuyện đó.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="4 5 6 9 11 12"
        send(ConnectionState.Connecting(device))
        // The id is the address the scan reported. false: connect directly, now. Android 17 (API 37)
        // deprecates this connectGatt for a new one that older phones don't have.
        @Suppress("DEPRECATION")
        val gatt: BluetoothGatt = adapter.getRemoteDevice(device.id)
            .connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            ?: throw ConnectionException("Android couldn't start the connection.")

        awaitClose {
            // Whatever ended the link, close the GATT client, or Android keeps it registered.
            gatt.disconnect()
            gatt.close()
        }
    }
```

1. **`getRemoteDevice(device.id)`**: id là địa chỉ lấy từ lần quét. "Một `BluetoothDevice` luôn được trả về cho một địa chỉ phần cứng hợp lệ, kể cả khi adapter này chưa bao giờ thấy thiết bị đó" (`BluetoothAdapter`, source của Android). Hướng dẫn của Android cũng kết nối theo cách đó, từ một địa chỉ.
2. **`autoConnect = false`**: "Kết nối trực tiếp tới thiết bị từ xa (false) hay tự động kết nối ngay khi thiết bị từ xa sẵn sàng (true)". Người dùng vừa chạm Connect, nên app kết nối ngay.
3. **`TRANSPORT_LE`** là "transport ưu tiên cho các kết nối GATT tới thiết bị từ xa hai chế độ": một thiết bị nói được cả Bluetooth Classic lẫn BLE thì được nối qua BLE.
4. **`@Suppress("DEPRECATION")`**: khoá học compile với API 37, nơi mọi `connectGatt` nhận `Context` đều bị `@Deprecated` để nhường cho `connectGatt(BluetoothGattConnectionSettings, Executor, BluetoothGattCallback)` (`android.jar` của API 37 và stub source của nó). Hàm mới đó không có trên API 36 trở xuống, còn app chạy từ API 26, nên lời gọi cũ ở lại, kèm một comment nói lý do.
5. **`?: throw`**: Kotlin thấy kiểu trả về của Java là `BluetoothGatt!`, và trong source của Android `connectGatt` trả về `null` khi nó không tới được dịch vụ GATT của hệ thống. Kiểu khai báo rõ cộng toán tử elvis biến chuyện đó thành một thông báo, thay vì một lần crash về sau.
6. **`disconnect()` rồi `close()`**: `disconnect` "Ngắt một kết nối đã thiết lập, hoặc huỷ một lần thử kết nối đang diễn ra", còn với `close`, "App nên gọi phương thức này càng sớm càng tốt sau khi xong việc với GATT client này" (`BluetoothGatt`, source của Android). Lời của chính hướng dẫn: "Một bước quan trọng khi làm việc với kết nối Bluetooth là đóng kết nối khi bạn đã dùng xong." `awaitClose` chạy trên mọi lối ra: `disconnect()`, việc huỷ của bên gọi, hết hạn và các lỗi ở trên.

## 5. Liên kết iOS, bằng Swift

Cùng vấn đề với bài 13: port trả về một `Flow` của Kotlin, và Swift không dựng được nó. Nên cùng lời giải: vài dòng Kotlin trong `iosMain` dựng `Flow`, và class Swift cấp dữ liệu cho nó.

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ConnectFlow.kt" hl_lines="2 3 4 8 14"
⋯ package, imports, and a comment: Swift can't build a Kotlin Flow, so it asks for one here
fun connectFlow(link: IosLink, device: Device): Flow<ConnectionState> = callbackFlow {
    link.open(device, LinkFeed(this))
    awaitClose { link.close() }
}

// What the Swift connection implements for connectFlow: open and close the real link.
interface IosLink {
    fun open(device: Device, feed: LinkFeed)
    fun close()
}

// Where the Swift connection reports: each state of the link, or the failure that ends it.
class LinkFeed internal constructor(private val scope: ProducerScope<ConnectionState>) {
    fun changed(state: ConnectionState) {
        scope.trySend(state)
    }

    fun failed(message: String) {
        scope.close(ConnectionException(message))
    }
}
```

Đây là `ScanFlow.kt` với tên đã đổi: `open` và `close` thay cho `startScan` và `stopScan`, và một feed báo trạng thái thay vì thiết bị. Giống `IosRadio`, `IosLink` không phải port: nó là đường nối giữa hai nửa của một adapter. Nửa Swift:

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="3 6 8 9 18 22"
⋯ imports: CoreBluetooth, Shared
@MainActor
final class IosBleConnection: NSObject, @preconcurrency BleConnection, @preconcurrency IosLink,
    @preconcurrency CBCentralManagerDelegate {
⋯ private var manager: CBCentralManager?
    private var peripheral: CBPeripheral?
⋯ private var device: Device?, private var feed: LinkFeed?, and a comment: Swift asks Kotlin for the Flow
    func connect(device: Device) -> SkieSwiftFlow<ConnectionState> {
        connectFlow(link: self, device: device)
    }

    // IosLink: connectFlow calls these when the Flow is collected and when it is cancelled.
    func open(device: Device, feed: LinkFeed) {
        self.device = device
        self.feed = feed
        let manager = self.manager ?? makeManager()
⋯ a comment: a new manager learns the radio's state a moment later; centralManagerDidUpdateState then calls start
        if manager.state != .unknown && manager.state != .resetting { start(on: manager) }
    }

    func close() {
        if let peripheral, manager?.state == .poweredOn { manager?.cancelPeripheralConnection(peripheral) }
        peripheral = nil
⋯ device = nil, feed = nil
```

1. **`CBCentralManager` của riêng nó**, được tạo lần đầu app kết nối, sau khi service đã kiểm tra quyền (quy tắc thứ tự của bài 13). `makeManager()` là của scanner, với `CBCentralManagerOptionShowPowerAlertKey: false`.
2. **`open` có thể phải chờ**: state của một manager mới là `unknown` cho tới `centralManagerDidUpdateState`. Scanner của bài 13 đã đỗ một continuation để chờ chuyện đó; class này có lựa chọn đơn giản hơn, vì `open` không trả về gì: nó nhớ thiết bị và feed, và callback của delegate gọi `start` (đoạn trích kế tiếp).
3. **`cancelPeripheralConnection`** "Huỷ một kết nối đang hoạt động hoặc đang chờ tới *peripheral*. Lưu ý rằng nó không chặn" (`CBCentralManager.h`). Adapter cũng không chờ xác nhận: khi `close` đã chạy, nó quên peripheral.

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="3 6 9 11 15 17 21 23"
    private func start(on manager: CBCentralManager) {
        guard let device, let feed, peripheral == nil else { return }
        guard manager.state == .poweredOn else { return end(with: message(for: manager.state)) }
        // The scanner found the device with its own manager; this one asks for it by identifier.
        guard let id = UUID(uuidString: device.id),
              let found = manager.retrievePeripherals(withIdentifiers: [id]).first else {
            return end(with: "This iPhone doesn't know \(device.name) any more. Scan again.")
        }
        peripheral = found
        feed.changed(state: ConnectionStateConnecting(device: device))
        manager.connect(found)
    }

    // Called on the main queue (queue: nil) when the link is up.
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard peripheral === self.peripheral, let device else { return }
        feed?.changed(state: ConnectionStateConnected(device: device))
    }
⋯ didFailToConnect: end(with: "The connection failed: …")
    // error is nil when the app asked for the disconnection, in close(): nothing is waiting then.
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral,
                        error: Error?) {
        guard peripheral === self.peripheral, let error, let device else { return }
        end(with: "The link to \(device.name) was lost: \(error.localizedDescription)")
    }
```

1. **`retrievePeripherals(withIdentifiers:)`** "Thử lấy (các) object `CBPeripheral` có các *identifier* tương ứng" (`CBCentralManager.h`). Id mà scanner đặt vào `Device` là UUID `identifier` của peripheral (bài 13), nên phần kết nối không cần các object của scanner. Một manager thứ hai trong cùng app có lấy được peripheral mà manager thứ nhất đã khám phá hay không là điều chỉ điện thoại thật mới cho thấy: nó nằm trong danh sách kiểm tra trên thiết bị.
2. **`peripheral = found` giữ nó sống.** "Các lần thử đang chờ bị huỷ tự động khi *peripheral* bị giải phóng" (`CBCentralManager.h`, `connectPeripheral:options:`). Không có property đó, `found` sẽ là một hằng cục bộ, bị giải phóng khi `start` trả về, và việc giải phóng nó sẽ huỷ lần thử mà `manager.connect` vừa bắt đầu. Đây lại là câu "một peripheral đã khám phá phải được giữ lại" của bài 13, giờ với một kết nối đang bị đe doạ.
3. **Ba lời gọi delegate báo kết quả**: `didConnect` "khi một kết nối do `connectPeripheral:options:` khởi tạo đã thành công"; `didFailToConnect` khi nó "không hoàn tất được"; và `didDisconnectPeripheral`, nơi "Nếu việc ngắt kết nối không do `cancelPeripheralConnection` khởi tạo, nguyên nhân sẽ được nêu trong tham số *error*" (tất cả từ `CBCentralManager.h`). Nên một error `nil` nghĩa là chính `close()` của app, và không có gì đang chờ nó.
4. **`===`** so sánh danh tính object: một callback đến muộn về một peripheral mà adapter này đã buông ra thì không đổi gì cả.
5. **`end(with:)`** lấy feed, gọi `close()`, rồi `feed.failed(message:)`, thứ đóng flow Kotlin bằng một `ConnectionException`. `awaitClose` của Kotlin sau đó gọi `close()` lần thứ hai, lần này không làm gì. Trong `centralManagerDidUpdateState`, adapter hoặc gọi `start` (một `open` đang chờ state), hoặc, khi đang có liên kết mở và state dưới `poweredOn`, kết thúc nó bằng "Bluetooth was turned off.".

!!! warning "Gotcha · Simulator không có radio để kết nối"
    Như ở bài 13, manager trên iOS Simulator báo `unsupported`, nên Connect kết thúc ngay với "This phone has no Bluetooth LE radio." (`message(for:)`). Đó là adapter thật đang làm đúng việc. Để thấy một kết nối thành công mà không cần điện thoại, hãy bind `SimulatedBleScanner` và `SimulatedBleConnection` thay vào (mục 8 và bài tự làm).

## 6. Màn hình chi tiết

ViewModel là inbound adapter thứ hai, và toàn bộ việc của nó là quyết định coroutine của kết nối chạy ở đâu:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModel.kt" hl_lines="1 7 9 11 13 18"
class DeviceDetailViewModel(private val session: DeviceSession) : ViewModel() {
    private val _uiState = MutableStateFlow(DeviceDetailUiState(connection = session.connectionState.value))
    val uiState: StateFlow<DeviceDetailUiState> = _uiState.asStateFlow()
⋯ connectJob; init collects session.connectionState into _uiState
    // The connection runs in viewModelScope, so it lasts as long as this ViewModel: through a
    // rotation, and until the screen is gone for good, when clearing the ViewModel cancels it.
    fun connect(device: Device) {
        if (connectJob?.isActive == true) return
        connectJob = viewModelScope.launch {
            try {
                session.connect(device)
            } catch (e: ConnectionException) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    fun disconnect() {
        session.disconnect()
    }
⋯ errorShown(): errorMessage = null
```

1. **`DeviceDetailUiState`** có hai trường: `connection` (state của session) và `errorMessage`. Bản thân thiết bị không nằm trong đó: màn hình đã nhận nó từ danh sách.
2. **Không override `onCleared()`.** Clear một ViewModel thì huỷ `viewModelScope` (bài 08), việc đó huỷ `session.connect`, và link của service cùng `awaitClose` của adapter theo sau. Test `theConnectionEndsWhenTheScreenIsGoneForGood` kiểm tra điều đó.
3. **Chỉ bắt `ConnectionException`.** Một `CancellationException` từ một ViewModel đã bị clear phải được đi tiếp lên trên, để coroutine kết thúc ở trạng thái bị huỷ.

Màn hình chi tiết cần cả `Device`, không chỉ id của nó: ở m08 nó tra id trong `SampleDevices`, và một thiết bị thật ra "Unknown device" (gotcha của bài 13). Giờ danh sách đưa cả thiết bị sang, và màn hình hiện một dòng trạng thái và một nút, Connect hoặc Disconnect, như Scan và Stop.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApp.kt" hl_lines="3 6 12"
    // The selected device travels in the route: the detail screen needs all of it to connect.
    @Serializable
    data class DeviceDetail(val id: String, val name: String, val rssi: Int)
    ⋯ in the NavHost:
                        onDeviceClick = { device ->
                            navController.navigate(DeviceDetail(device.id, device.name, device.rssi))
                        },
    ⋯ 
                composable<DeviceDetail> { entry ->
                    val route: DeviceDetail = entry.toRoute()
                    DeviceDetailScreen(
                        device = Device(id = route.id, name = route.name, rssi = route.rssi),
                        onBack = { navController.popBackStack() },
                    )
                }
    ```

    Route chép ba trường của thiết bị thay vì giữ một `Device`: một class route là `@Serializable`, còn app core không phụ thuộc kotlinx.serialization.

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailScreen.kt" hl_lines="5 12 21"
    @Composable
    fun DeviceDetailScreen(
        device: Device,
        onBack: () -> Unit,
        viewModel: DeviceDetailViewModel = koinViewModel(),
    ) {
        val state by viewModel.uiState.collectAsStateWithLifecycle()

        DeviceDetailContent(
            device = device,
            connection = state.connection,
            onConnect = { viewModel.connect(device) },
            onDisconnect = viewModel::disconnect,
            onBack = onBack,
        )
    ⋯ state.errorMessage: an AlertDialog "Connection failed", as on the list
    }
    ⋯ in DeviceDetailContent, under the device's name, ID and signal:
            val disconnected = connection is ConnectionState.Disconnected
            Button(
                onClick = if (disconnected) onConnect else onDisconnect,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (disconnected) "Connect" else "Disconnect")
            }
    ```

    `koinViewModel()` bên trong một destination `composable<DeviceDetail>` nhận một ViewModel gắn với entry đó của back stack, như ViewModel của danh sách (bài 11). `ConnectionStatus` hiện "Status: not connected", "Status: connecting…" kèm một vòng tiến trình nhỏ, hoặc "Status: connected".

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="5 6"
    ⋯ in the adapter's click handler, from the list itself:
                // The selected device travels in the arguments: the detail screen needs all of it.
                val args = Bundle().apply {
                    putString("deviceId", device.id)
                    putString("deviceName", device.name)
                    putInt("deviceRssi", device.rssi)
                }
                nav.navigate(R.id.toDetail, args)
    ```

    Navigation graph khai báo hai argument mới dưới `deviceDetail`: `deviceName` kiểu `string` và `deviceRssi` kiểu `integer`.

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt" hl_lines="1 5 6 13 19"
        private val viewModel: DeviceDetailViewModel by viewModel()
    ⋯ in onCreateView, after building device from requireArguments():
            // One button: Connect while disconnected, Disconnect while connecting or connected.
            b.connectButton.setOnClickListener {
                if (viewModel.uiState.value.connection is ConnectionState.Disconnected) {
                    viewModel.connect(device)
                } else {
                    viewModel.disconnect()
                }
            }
    ⋯ onViewCreated: repeatOnLifecycle(STARTED) collects uiState into render(), as on the list
    ⋯ in render(), after the ProgressBar shows only while connecting:
            b.statusText.text = when (connection) {
                ConnectionState.Disconnected -> "Status: not connected"
                is ConnectionState.Connecting -> "Status: connecting…"
                is ConnectionState.Connected -> "Status: connected"
            }
    ⋯ the status colour
            b.connectButton.text = if (connection is ConnectionState.Disconnected) "Connect" else "Disconnect"
    ```

    `by viewModel()` gắn ViewModel với Fragment: nó sống qua lần xoay và bị clear khi Fragment rời back stack hẳn (bài 11). Layout có thêm một hàng chứa một `ProgressBar` và `statusText`, và `connectButton`, phía trên nút Back.

!!! info "XML vs Compose · cái gì đổi và vì sao"
    Route của Compose là một class `@Serializable` có ba trường; graph XML khai báo chúng là argument và Fragment đọc chúng từ một `Bundle`. Cách nào thì thiết bị cũng đi qua dưới dạng các giá trị trơn, và màn hình dựng lại `Device`. ViewModel, scope của nó và thứ clear nó thì giống nhau.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/ContentView.swift" hl_lines="2 7 8"
                    .navigationDestination(for: DeviceRoute.self) { route in
                        DeviceDetailView(device: route.device)
                    }
    ⋯ 
    // The selected device travels in the route: the detail screen needs all of it to connect.
    // A Kotlin class is an NSObject in Swift, so Device is Hashable through isEqual and hash.
    struct DeviceRoute: Hashable {
        let device: Device
    }
    ```

    Trong `Shared.h`, `SharedDevice` kế thừa `SharedBase : NSObject` và khai báo `isEqual:` và `hash`, tức `equals` và `hashCode` của data class Kotlin. `NSObject` là `Hashable` trong Swift qua hai hàm đó, nên struct được `Hashable` miễn phí. `NavigationLink` của danh sách giờ truyền `DeviceRoute(device: device)`.

    ```swift title="iosApp/iosApp/DeviceDetailView.swift" hl_lines="3 7 12 20"
    struct DeviceDetailView: View {
        let device: Device
        @State private var owner = ViewModelOwner()
        @State private var state: DeviceDetailUiState?

        var body: some View {
            let viewModel: DeviceDetailViewModel = owner.viewModel()
            let state = self.state ?? viewModel.uiState.value
            DeviceDetailContent(
                device: device,
                connection: state.connection,
                onConnect: { viewModel.connect(device: device) },
                onDisconnect: { viewModel.disconnect() }
            )
    ⋯ .alert("Connection failed", …) and .task { for await … in viewModel.uiState }, as on the list
        }
    }
    ⋯ in DeviceDetailContent:
                Button(action: disconnected ? onConnect : onDisconnect) {
                    Text(disconnected ? "Connect" : "Disconnect")
    ⋯ ConnectionStatus: switch onEnum(of: connection), one case per state
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="3 5"
        func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
            tableView.deselectRow(at: indexPath, animated: true)
            guard let deviceId = dataSource.itemIdentifier(for: indexPath), let device = devicesById[deviceId] else { return }
            // The detail screen gets the whole device: it needs all of it to connect.
            navigationController?.pushViewController(DeviceDetailViewController(device: device), animated: true)
        }
    ```

    ```swift title="iosApp/iosApp/DeviceDetailViewController.swift" hl_lines="4 5 8 17"
    final class DeviceDetailViewController: UIViewController {
        private let device: Device
    ⋯ a comment on the owner's lifetime
        private let owner = ViewModelOwner()
        private lazy var viewModel: DeviceDetailViewModel = owner.viewModel()
        private var observation: Task<Void, Never>?
    ⋯ in viewDidLoad, the button's action:
                if viewModel.uiState.value.connection is ConnectionStateDisconnected {
                    viewModel.connect(device: device)
                } else {
                    viewModel.disconnect()
                }
    ⋯ 
        // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android. Leaving the
        // screen stops the collection, not the connection.
    ⋯ viewWillAppear: a Task collects uiState into render(_:)
        override func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)
            observation?.cancel()
            observation = nil
        }
    ```

    `render(_:)` dùng `switch` trên `onEnum(of: state.connection)` cho chữ trạng thái, chạy vòng quay khi đang kết nối, và đặt tiêu đề cho nút. Action của nút giữ `[weak self]`, nên controller có thể được giải phóng khi nó bị pop.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Route của SwiftUI mang chính `Device`, vì một route chỉ cần `Hashable`. UIKit truyền nó vào hàm khởi tạo của controller. Ở cả hai, `ViewModelOwner` sống đúng bằng màn hình (`@State` của view, property của controller), nên pop màn hình thì clear ViewModel.

## 7. Cái bẫy: kết nối được giữ trong một thứ sẽ biến mất

Một kết nối BLE sống vài giây hay vài phút. Các object của một màn hình thường sống ngắn hơn. Bài 03 đã cảnh báo rằng xoay màn hình huỷ Activity, và rằng "một object kết nối BLE được giữ trong Activity bị vứt bỏ giữa chừng kết nối trong khi liên kết radio có thể vẫn còn mở". Chúng tôi đã chạy đúng chuyện đó trên emulator API 30, với một màn hình dùng-một-lần giữ `BluetoothGatt` của nó trong `remember` của Compose (state của composition, tức là của Activity) và gọi `connectGatt` khi chạm:

| Bước | Logcat và màn hình cho thấy gì |
|---|---|
| Chạm Connect | `connect() - device: BE:AC:10:00:00:01, auto: false`, `registerApp()`, client 6 đã đăng ký. Màn hình giữ `BluetoothGatt` |
| Xoay | màn hình của Activity mới không giữ gì: nút Close của nó đóng `null` |
| Chạm Connect lần nữa | một `registerApp()` thứ hai: client 7, trong khi client 6 chưa bao giờ được đóng (không có `close()` hay `unregisterApp()` nào cho nó trong log) |
| Khoảng 30 s sau lần thử đầu | `onClientConnectionState() - status=133` cho cả hai client, và callback của client đầu, một object từ màn hình đã bị huỷ, vẫn chạy và ghi log |

Beacon không bao giờ trả lời, nên đây chỉ là một lần thử, nhưng hình dạng thì y như với một liên kết đang sống: sau một lần xoay, không gì trong app với tới được `BluetoothGatt` cũ để đóng nó, Android giữ client của nó ở trạng thái đã đăng ký, và callback của nó giữ các object của một màn hình đã chết vẫn còn với tới được. Cách sửa không phải là "remember chặt hơn". Mà là đặt mỗi thứ vào nơi có vòng đời vừa với nó:

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 300" role="img" aria-labelledby="l14-life-title">
<title id="l14-life-title">Các vòng đời trên Android khi đang kết nối, theo thời gian. Làn trên cùng, màn hình chi tiết: Activity số một bị huỷ bởi một lần xoay và Activity số hai thế chỗ; sau đó người dùng bấm Back. Làn thứ hai, DeviceDetailViewModel: một instance từ lần Connect đầu tiên cho tới khi Back clear nó. Làn thứ ba, coroutine của kết nối, được launch trong viewModelScope khi Connect: nó chạy qua lần xoay và bị huỷ khi ViewModel bị clear, thứ đóng GATT client trong awaitClose của adapter. Làn dưới cùng, session service và adapter, các Koin single sống bằng tiến trình. Một đường đứt đánh dấu cái bẫy: một BluetoothGatt giữ trong Activity số một bị mất ở lần xoay trong khi liên kết của nó vẫn mở.</title>
<defs><marker id="l14-life-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<line class="axis" x1="150" y1="270" x2="740" y2="270"/>
<text class="small muted" x="150" y="290">Connect</text>
<text class="small muted" x="380" y="290">xoay</text>
<text class="small muted" x="640" y="290">Back</text>
<text class="small" x="10" y="44">màn hình</text>
<g data-part="android">
<rect class="box" x="150" y="26" width="240" height="30" rx="6"/>
<text class="small" x="160" y="46">Activity #1</text>
<rect class="box" x="400" y="26" width="250" height="30" rx="6"/>
<text class="small" x="410" y="46">Activity #2</text>
</g>
<text class="small" x="10" y="94">ViewModel</text>
<g data-part="inbound">
<rect class="box" x="150" y="76" width="500" height="30" rx="6"/>
<text class="small" x="160" y="96">DeviceDetailViewModel: sống qua lần xoay, bị clear khi Back</text>
</g>
<text class="small" x="10" y="144">kết nối</text>
<g data-part="inbound">
<rect class="box" x="150" y="126" width="500" height="30" rx="6"/>
<text class="small" x="160" y="146">session.connect trong viewModelScope: huỷ khi Back → awaitClose → close()</text>
</g>
<text class="small" x="10" y="194">tiến trình</text>
<g data-part="core">
<rect class="box" x="150" y="176" width="590" height="30" rx="6"/>
<text class="small" x="160" y="196">SessionService, AndroidBleConnection: Koin single, sống suốt lúc app chạy</text>
</g>
<text class="small" x="10" y="238">cái bẫy</text>
<path class="edge dashed" d="M150,234 L390,234" marker-end="url(#l14-life-arrow)"/>
<text class="small muted" x="400" y="238">gatt giữ trong Activity #1: mất ở đây, liên kết vẫn mở</text>
</svg>
<figcaption>Mỗi phần sống ở nơi vòng đời của nó vừa vặn: các view trong màn hình, coroutine của kết nối trong ViewModel, các object của radio trong adapter.
<ul class="legend"><li data-part="android">Android (màn hình)</li><li data-part="inbound">Inbound adapter (ViewModel và scope của nó)</li><li data-part="core">App core và các adapter, sống bằng tiến trình</li></ul>
</figcaption>
</figure>

1. **Các object của radio sống trong adapter.** Không màn hình nào từng thấy một `BluetoothGatt` hay một `CBPeripheral`; adapter và session service là các Koin single. Bản đồ của bài 03 đã đặt kết nối ở đó: "Giữ một kết nối BLE thuộc về một Android BLE adapter, một outbound adapter đứng sau một outbound port, bên ngoài Activity".
2. **Kết nối kéo dài bao lâu do một scope quyết định.** ViewModel chạy `session.connect` trong `viewModelScope`. Một lần xoay không clear ViewModel (bài 08), nên kết nối tiếp tục. Khi màn hình biến mất hẳn, ViewModel bị clear, scope bị huỷ, và `awaitClose` đóng liên kết. Không ai phải nhớ gọi `close()`.
3. **Chúng tôi đã chạy nó trên emulator API 30**: Connect, xoay trong lúc đang thử, xoay lại: chỉ một `registerApp()`, và màn hình vẫn ghi "connecting…". Connect, rồi Back ba giây sau: `cancelOpen()`, `close()` và `unregisterApp()` ngay lập tức.

!!! warning "Gotcha · scope riêng của màn hình quá ngắn (Android)"
    Scope quan trọng ngang với chỗ các object sống. Nếu màn hình launch `session.connect` trong `rememberCoroutineScope()` của Compose thay vì scope của ViewModel, một lần xoay sẽ huỷ nó. Bài 06 đã nói lý do: scope đó "gắn với vị trí của composable này trên màn hình. Nó bị huỷ khi composable rời đi (xoay, điều hướng)".
    Chúng tôi đã thử với các adapter giả lập trên emulator API 36: kết nối, xoay, và màn hình ghi "Status: not connected". App đã tự cúp máy. Bài tự làm cho bạn tự thấy điều đó.

!!! warning "Gotcha · view bị dỡ trên iOS"
    iOS không dựng lại màn hình khi xoay, nhưng nó có những cách riêng để làm mất kết nối. **Một peripheral không được giữ:** CoreBluetooth huỷ một kết nối đang chờ "khi *peripheral* bị giải phóng", nên một `CBPeripheral` chỉ được giữ bởi một hằng cục bộ, hay bởi một view sẽ biến mất, sẽ kết thúc lần thử; mục 5 giữ nó trong adapter.
    **Biến mất không có nghĩa là "đi hẳn":** `onDisappear` và `viewDidDisappear` cũng chạy khi một màn hình khác được push lên trên. Log của bài 04 cho thấy điều đó: push màn hình chi tiết ghi log `ContentView onDisappear` trên SwiftUI và `ViewController viewDidDisappear` trên UIKit. Ngắt kết nối ở đó sẽ cắt liên kết mỗi khi một bài sau hiện thứ gì đó lên trên màn hình chi tiết.
    Ở đây, `ViewModelOwner` chỉ clear ViewModel khi nó bị deinit: khi màn hình rời navigation stack. `viewDidDisappear` chỉ dừng việc màn hình UIKit collect `uiState`.

## 8. Nối dây: mỗi nền tảng truyền kết nối của mình

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="4 7 11"
internal val appModule = module {
    single<DeviceScanning> { ScanningService(get(), get()) }
    // One session for the whole app: every screen sees the same connection state.
    single<DeviceSession> { SessionService(get(), get()) }
    single<PermissionAccess> { PermissionService(get()) }
    viewModelOf(::DeviceListViewModel)
    viewModelOf(::DeviceDetailViewModel)
}
⋯ platformModule(permissionChecker, bleScanner, bleConnection): one single { } per adapter
// Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
fun initKoin(permissionChecker: PermissionChecker, bleScanner: BleScanner, bleConnection: BleConnection) {
    startKoin {
        modules(appModule, platformModule(permissionChecker, bleScanner, bleConnection))
    }
}
```

1. **`single` cho session**: `connectionState` của nó là sự thật duy nhất của app về kết nối, và quy tắc một-thiết-bị của nó chỉ đúng khi chỉ có một service. Một `factory` sẽ cho mỗi màn hình một state riêng.
2. **Adapter kết nối đi qua `platformModule`**, như scanner và vì cùng lý do: adapter của Android cần một `Context`, còn của iOS là một object Swift.

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks" hl_lines="2"
        permissionChecker = AndroidPermissionChecker(this)
        initKoin(permissionChecker, AndroidBleScanner(this), AndroidBleConnection(this))
```

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="4"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: IosBleConnection()
            )
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="4"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: IosBleConnection()
            )
            return true
    ```

`SimulatedBleConnection`, trong `commonMain` cạnh `SimulatedBleScanner`, không được bind ở đâu cả. Nó kết nối mỗi thiết bị mẫu sau một giây và không bao giờ trả lời với Smart Scale. Truyền cả hai adapter giả lập vào `initKoin` là cách để xem một kết nối trên emulator hay Simulator, nơi không có thiết bị thật nào để tới.

## 9. Test

Radio giả cho kết nối để test quyết định khi nào thiết bị trả lời và khi nào liên kết lỗi:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleConnection.kt" hl_lines="1 6 11 12 16"
class FakeBleConnection : BleConnection {
    private val events = Channel<Event>(Channel.UNLIMITED)
⋯ attempts and isLinked, both with private set
    override fun connect(device: Device): Flow<ConnectionState> = flow {
        attempts++
        isLinked = true
        try {
            emit(ConnectionState.Connecting(device))
            for (event in events) {
                when (event) {
                    Event.Answer -> emit(ConnectionState.Connected(device))
                    is Event.Fail -> throw ConnectionException(event.message)
                }
            }
        } finally {
            isLinked = false
        }
    }
⋯ answer() and fail(message) send an event
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/SessionServiceTest.kt" hl_lines="2 8 9 11 16 20"
    @Test
    fun disconnectEndsTheLinkAndConnectReturns() = runTest {
        val call = async { session.connect(obd) }
        radio.answer()
        testScheduler.runCurrent()
        assertTrue(radio.isLinked)

        session.disconnect()
        call.await() // returns normally: the app asked for it

        assertFalse(radio.isLinked)
        assertEquals(ConnectionState.Disconnected, session.connectionState.value)
    }
⋯ cancellingTheCallerAlsoDisconnects, aFailedLinkReachesTheCaller
    @Test
    fun givesUpOnADeviceThatDoesNotAnswer() = runTest {
        val error = assertFailsWith<ConnectionException> { session.connect(obd) }

        assertEquals("OBD-II Adapter didn't answer within 10 seconds.", error.message)
        assertEquals(SessionService.CONNECT_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
        assertFalse(radio.isLinked)
    }
```

1. **`isLinked`** thành `false` trong `finally` của fake, thứ chạy khi việc collect của service kết thúc: đúng lúc `awaitClose` của một adapter thật đóng radio. Các test cho `disconnect()`, một bên gọi bị huỷ và hết hạn đều kiểm tra nó.
2. **Hết hạn không tốn thời gian thật**: `runTest` bỏ qua `delay`, và `currentTime` chứng minh lần thử kết thúc đúng ở 10 giây ảo (bài 11). `theTimeoutStopsOnceConnected` kiểm tra phía bên kia: đã kết nối, rồi một phút ảo sau vẫn kết nối. Chúng tôi cố tình làm hỏng nó, bỏ `giveUp.cancel()`, và test đó fail.
3. **Năm test còn lại**: mọi state theo đúng thứ tự (`reportsEachStateOfTheConnection`, với Turbine), huỷ bên gọi thì ngắt kết nối, một lỗi của radio tới được bên gọi, không có quyền thì không thử, và mỗi lần một thiết bị.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModelTest.kt" hl_lines="2 5 10 13"
    private val session = TestDeviceSession()
    private val store = ViewModelStore() // plays the screen that owns the ViewModel
⋯ setUp: setMain, then ViewModelProvider.create(store, factory)[DeviceDetailViewModel::class]
    @Test
    fun theConnectionEndsWhenTheScreenIsGoneForGood() = runTest {
        viewModel.connect(obd)
        testScheduler.runCurrent()
        assertTrue(session.isHolding)

        store.clear() // the screen left the back stack: the ViewModel is cleared
        testScheduler.runCurrent()

        assertFalse(session.isHolding)
    }
```

`TestDeviceSession` là một bản implement cho test của inbound port: `connect` của nó giữ cho tới khi bị huỷ, và `isHolding` cho biết nó còn giữ không. ViewModel đến từ một `ViewModelStore` thật qua `ViewModelProvider.create` và một `viewModelFactory { initializer { … } }`, nên `store.clear()` làm đúng việc mà rời màn hình làm trên cả hai nền tảng. Bốn test ViewModel nữa: nó hiện state của session, một lỗi thành một thông báo cho tới khi được hiện, một lần Connect thứ hai trong lúc đang giữ một kết nối bị bỏ qua, và Disconnect tới được session.

## 10. Thực tế xảy ra gì

Chúng tôi build m09 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, Xcode 26.2). `allTests` qua 33/33 trên JVM và 33/33 trên simulator iOS, không có warning compiler nào từ code của chúng tôi. Với các adapter thật thì không có gì để kết nối trên emulator và Simulator, nên phần lớn các lần chạy thay vào các adapter giả lập:

| Lần chạy | Chúng tôi thấy gì |
|---|---|
| Emulator Android API 30, adapter thật, Compose: chạm một hàng `gDevice-beacon` | tên beacon, "ID: BE:AC:10:00:00:01" và tín hiệu của nó; "Status: not connected"; Connect |
| như trên, Connect | "Status: connecting…" và Disconnect; sau 10 s "Connection failed: gDevice-beacon didn't answer within 10 seconds."; logcat: `connect() … auto: false`, rồi `cancelOpen()`, `close()`, `unregisterApp()` |
| như trên, Connect, Back 3 s sau | `cancelOpen()`, `close()`, `unregisterApp()` ngay lập tức |
| Emulator Android API 36, `SimulatedBleScanner` với `AndroidBleConnection` thật, Compose | Bluetooth tắt, Connect: "Bluetooth is off. Turn it on, then connect again." Bluetooth bật, Connect: thông báo 10 giây, và cùng bốn dòng logcat |
| API 36, cả hai adapter giả lập, Compose và XML | Connect: "Status: connected" trong vòng 2 s; xoay: vẫn connected; Disconnect: not connected; Connect, Back, mở Heart Rate Monitor, Connect: connected, không có "Another connection is open"; Smart Scale: "connecting…", rồi "Smart Scale didn't answer within 10 seconds." |
| Simulator iOS 26.2, `SimulatedBleScanner` với `IosBleConnection` thật, SwiftUI và UIKit | Connect: "Connection failed: This phone has no Bluetooth LE radio."; sau OK, "Status: not connected" và lại Connect |
| Simulator, cả hai adapter giả lập, SwiftUI và UIKit | giống lần chạy API 36, kể cả màn hình ngang |

Lần chạy Back-rồi-thiết-bị-khác là lần quan trọng: thiết bị thứ hai kết nối được chỉ vì rời màn hình đầu tiên đã clear ViewModel của nó và kết thúc kết nối của nó. Mục tiêu thật, một kết nối tới LightBlue, cần điện thoại của bạn; brief cho agent liệt kê các lần chạy đó dưới dạng kiểm tra trên thiết bị.
**m09 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng, các lần chạy ở trên diễn ra giống vậy với bạn, và ít nhất một điện thoại của bạn kết nối được tới LightBlue. Hãy commit nó. Bài 15 khám phá các service của thiết bị và đọc một giá trị.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một lần chạm Back khi đang kết nối, trên track Android của bạn, xuống tới `gatt.close()`: object nào bị clear, scope nào bị huỷ, việc đó huỷ coroutine nào, và khối nào chạy. Rồi làm tương tự trên iOS, từ lúc màn hình rời navigation stack tới `cancelPeripheralConnection`.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao <code>DeviceSession.connect(device)</code> treo suốt thời gian kết nối, thay vì trả về khi liên kết đã lên?</p>
<div class="opts">
<button class="opt">để màn hình hiện được vòng quay</button>
<button class="opt" data-correct>để coroutine của bên gọi quyết định vòng đời của kết nối: huỷ nó là ngắt kết nối, và liên kết không thể sống lâu hơn bên đã xin nó</button>
<button class="opt">vì <code>connectGatt</code> của Android chặn cho tới khi kết nối xong</button>
</div>
<p class="feedback"></p>
<p class="why">Kết nối chính là lời gọi. Trong app lời gọi chạy trong <code>viewModelScope</code>, nên kết nối sống bằng ViewModel của màn hình chi tiết, và clear nó thì đóng liên kết qua <code>awaitClose</code> của adapter.</p>
</div>

<div class="quiz">
<p class="q">Một màn hình giữ <code>BluetoothGatt</code> của nó trong state của Compose và kết nối từ đó. Người dùng xoay điện thoại. Kết nối đó ra sao?</p>
<div class="opts">
<button class="opt" data-correct>màn hình mới không với tới được nó, nên không gì đóng nó: Android giữ GATT client cũ ở trạng thái đã đăng ký, và callback của nó vẫn chạy</button>
<button class="opt">Android đóng nó cùng Activity cũ</button>
<button class="opt"><code>remember</code> mang nó sang Activity mới</button>
</div>
<p class="feedback"></p>
<p class="why">Lần chạy API 30 của chúng tôi: sau lần xoay, màn hình mới không giữ gì, một lần Connect thứ hai đăng ký client thứ hai, và callback của client đầu vẫn ghi log status 133 ba mươi giây sau. Chỉ <code>close()</code> mới huỷ đăng ký một client.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>IosBleConnection</code> giữ <code>CBPeripheral</code> trong một property?</p>
<div class="opts">
<button class="opt">để scanner tìm lại được nó</button>
<button class="opt">vì <code>retrievePeripherals</code> chỉ gọi được một lần</button>
<button class="opt" data-correct>CoreBluetooth huỷ một kết nối đang chờ khi peripheral của nó bị giải phóng</button>
</div>
<p class="feedback"></p>
<p class="why"><code>CBCentralManager.h</code>: "Các lần thử đang chờ bị huỷ tự động khi <i>peripheral</i> bị giải phóng". Một hằng cục bộ sẽ bị giải phóng khi <code>start</code> trả về.</p>
</div>

<div class="quiz">
<p class="q">Hạn 10 giây cho việc kết nối nằm ở đâu, và vì sao ở đó?</p>
<div class="opts">
<button class="opt">trong adapter iOS, vì chỉ iOS cần nó</button>
<button class="opt" data-correct>trong <code>SessionService</code>: đó là quy tắc của app, giống nhau trên cả hai nền tảng, và các lần thử trên iOS tự chúng không bao giờ hết hạn</button>
<button class="opt">trong ViewModel, như hạn của lần quét</button>
</div>
<p class="feedback"></p>
<p class="why">Apple: "Các lần thử kết nối không bao giờ hết hạn". Hạn của lần quét là lựa chọn của một màn hình (màn hình này quét bao lâu); "một thiết bị không trả lời là đã thất bại" là quy tắc cho mọi bên gọi, được test một lần với thời gian ảo.</p>
</div>

<div class="quiz">
<p class="q">Trong <code>centralManager(_:didDisconnectPeripheral:error:)</code>, <code>error</code> là <code>nil</code>. Chuyện gì đã xảy ra?</p>
<div class="opts">
<button class="opt" data-correct>app đã xin điều đó bằng <code>cancelPeripheralConnection</code></button>
<button class="opt">peripheral đã ra khỏi tầm sóng</button>
<button class="opt">Bluetooth đã bị tắt</button>
</div>
<p class="feedback"></p>
<p class="why">"Nếu việc ngắt kết nối không do <code>cancelPeripheralConnection</code> khởi tạo, nguyên nhân sẽ được nêu trong tham số <i>error</i>." Nên adapter chỉ kết thúc Flow kèm thông báo khi có error.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Trên iOS, cái gì clear <code>DeviceDetailViewModel</code>, và do đó kết thúc kết nối? (Bài 08)</p>
<div class="opts">
<button class="opt"><code>onDisappear</code>, khi màn hình chi tiết bị che</button>
<button class="opt" data-correct><code>deinit</code> của <code>ViewModelOwner</code>, thứ gọi <code>store.clear()</code> khi màn hình rời navigation stack</button>
<button class="opt">Koin, khi app xuống nền</button>
</div>
<p class="feedback"></p>
<p class="why">Owner sống trong <code>@State</code> của view (SwiftUI) hoặc property của controller (UIKit). Clear store thì huỷ <code>viewModelScope</code>, như trên Android.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>DeviceSession</code> được bind bằng <code>single</code> chứ không phải <code>factory</code>? (Bài 11)</p>
<div class="opts">
<button class="opt"><code>factory</code> không dựng được một class có hai tham số</button>
<button class="opt" data-correct>mọi màn hình phải thấy cùng một state kết nối, và quy tắc một-thiết-bị cần một service duy nhất</button>
<button class="opt"><code>single</code> biến nó thành một ViewModel</button>
</div>
<p class="feedback"></p>
<p class="why">Một <code>factory</code> dựng một instance mới cho mỗi lần yêu cầu: mỗi màn hình sẽ có state riêng, và hai service có thể mỗi cái kết nối một thiết bị.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m09 của bạn)"
    1. **Đoán, rồi xem.** Truyền `SimulatedBleScanner()` và `SimulatedBleConnection()` vào `initKoin` trên Android (hoặc `doInitKoin` trên iOS). Ghi ra dòng trạng thái sẽ nói gì, rồi: Connect; xoay (Android) hoặc xoay Simulator sang ngang; Disconnect; Connect, Back, Connect trên một thiết bị khác; Smart Scale.
       Rồi đặt lại `AndroidBleConnection(this)` thật, giữ scanner giả lập, chạy `adb logcat -s BluetoothGatt`, và Connect: những dòng nào xuất hiện, và khi nào?
    2. **Viết một test.** Thêm `aDroppedLinkReachesTheCaller` vào `SessionServiceTest`: kết nối trước, rồi `radio.fail("The link to OBD-II Adapter was lost (Android status 8).")`; lời gọi ném thông báo đó, state là Disconnected và `isLinked` là false.
       Rồi xoá dòng trong `finally` đặt Disconnected, đoán xem test nào fail, và chạy chúng trên cả hai nền tảng.
    3. **Cố tình làm hỏng vòng đời.** Với cả hai adapter giả lập, cho màn hình giữ kết nối thay vì ViewModel. Compose: trong `DeviceDetailScreen`, lấy `val session: DeviceSession = koinInject()` và `val scope = rememberCoroutineScope()`, và truyền `onConnect = { scope.launch { session.connect(device) } }`. XML: trong `DeviceDetailFragment`, lấy `private val session: DeviceSession by inject()` và kết nối trong `viewLifecycleOwner.lifecycleScope.launch { … }`.
       Đoán xem trạng thái ghi gì sau một lần xoay, rồi thử. Hoàn tác.
    4. **Trên điện thoại của bạn**, với LightBlue đang quảng bá: kết nối tới hàng của máy Mac, rồi bỏ tick thiết bị ảo trong LightBlue. Mỗi điện thoại nói gì, và mất bao lâu?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/14-ble-connect.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/14-ble-connect.html" -o .course/lesson-14.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html" -o .course/ref-ble-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 08, 11 and 13, which this lesson builds on; skipped if they're already there:
  [ -f .course/lesson-08.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/08-shared-viewmodels.html" -o .course/lesson-08.html
  [ -f .course/lesson-11.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html" -o .course/lesson-11.html
  [ -f .course/lesson-13.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/13-ble-concepts-and-scan.html" -o .course/lesson-13.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 14 (BLE: connect): build milestone m09, a connection to the selected device through
the DeviceSession inbound port and SessionService, over a BleConnection outbound port
(Android connectGatt + callbackFlow, iOS Swift CBCentralManager.connect + ConnectFlow.kt),
with the connection state on a new detail screen, on top of m08.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m08 project in demo/ (Lesson 13). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/ConnectionState.kt, core/ConnectionException.kt, core/SessionService.kt,
       core/inbound/DeviceSession.kt, core/outbound/BleConnection.kt,
       adapter/inbound/DeviceDetailUiState.kt, adapter/inbound/DeviceDetailViewModel.kt,
       adapter/outbound/SimulatedBleConnection.kt
     replaced: adapter/outbound/SampleDevices.kt, di/AppModule.kt
     add shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt
     add shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ConnectFlow.kt
     under shared/src/commonTest/kotlin/com/example/devicemonitor/:
       add: doubles/FakeBleConnection.kt, doubles/TestDeviceSession.kt,
         core/SessionServiceTest.kt, adapter/inbound/DeviceDetailViewModelTest.kt
       replaced: di/AppModuleTest.kt
   shared/build.gradle.kts and every other file in shared/ stay as in m08.

2. Android, both tracks: androidApp/src/main/java/com/example/devicemonitor/android/
   DeviceMonitorApplication.kt: replaced. androidApp/build.gradle.kts and the manifest stay as in m08.
     Compose: DeviceMonitorApp.kt and DeviceDetailScreen.kt: replaced (DeviceListScreen.kt stays).
     XML: DeviceListFragment.kt, DeviceDetailFragment.kt, res/layout/fragment_device_detail.xml and
       res/navigation/nav_graph.xml: replaced.
   iOS, both tracks: add iosApp/iosApp/IosBleConnection.swift, then run `xcodegen generate` in
   iosApp/ so the Xcode project includes it. project.yml stays as in m08. Do NOT edit
   Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift, ContentView.swift, DeviceListView.swift and DeviceDetailView.swift: replaced.
     UIKit: AppDelegate.swift, DeviceListViewController.swift and DeviceDetailViewController.swift:
       replaced.
   Every other Android and iOS file stays as in m08.

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
   Run: `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`, then
     `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 33 tests pass on each: 8 in SessionServiceTest, 5 in
  DeviceDetailViewModelTest, 8 in ScanningServiceTest, 7 in DeviceListViewModelTest, 4 in
  PermissionServiceTest, 1 in AppModuleTest. Show the counts from the XML files in
  shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: the same lines as in Lesson 13's brief (SKIE's "Configuration '…' was
  resolved during configuration time", SLF4J "Failed to load class", Gradle's "Deprecated
  Gradle features … Gradle 10", "Unable to strip the following libraries", Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", xcodebuild's
  "WARNING: Using the first of multiple matching destinations", and Gradle's "The Daemon will
  expire …"). Xcode "note:" lines are not warnings.
- The app core stays platform-free:
    grep -rn 'import android\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing. The exported header declares the new entry point and still no Koin types:
    grep -c 'doInitKoinPermissionChecker:(id<SharedPermissionChecker>)permissionChecker bleScanner:(id<SharedBleScanner>)bleScanner bleConnection' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'Koin_core' on the same file prints 0 (build that framework first
  with ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 if it isn't there).
- The emulator and the Simulator can't reach a real device, so two runs swap adapters for a
  while. Make each swap in the app-start file only (Android: DeviceMonitorApplication.kt; iOS:
  iOSApp.swift or AppDelegate.swift), rebuild, and put the file back exactly as in Full files
  afterwards (diff it). The simulated classes are in com.example.devicemonitor.adapter.outbound.
  Run A: SimulatedBleScanner() in place of the real scanner, the real connection kept.
  Run B: SimulatedBleScanner() and SimulatedBleConnection() in place of both.
- Android emulator (API 31+), my track (the XML buttons show their text in capitals, so match
  case-insensitively; find nodes with `adb shell uiautomator dump`):
  Run A:
  1. Scan, tap the "OBD-II Adapter" row: "OBD-II Adapter", "ID: C4:7C:8D:6A:01:10",
     "Signal: -48 dBm", "Status: not connected" and a "Connect" button.
  2. adb shell cmd bluetooth_manager disable; tap Connect: an alert "Connection failed" with
     "Bluetooth is off. Turn it on, then connect again." Tap OK. adb shell cmd bluetooth_manager enable.
  3. adb logcat -c; tap Connect: "Status: connecting…" and a "Disconnect" button. Wait 12 s: the
     alert says "OBD-II Adapter didn't answer within 10 seconds."; after OK, "Status: not
     connected". `adb logcat -d -s BluetoothGatt` shows connect(), then about 10 s later
     cancelOpen(), close() and unregisterApp().
  4. adb logcat -c; tap Connect, then within 3 s go back (adb shell input keyevent KEYCODE_BACK):
     the list. `adb logcat -d -s BluetoothGatt` shows cancelOpen(), close() and unregisterApp()
     within 2 s of going back, long before the 10 s timeout.
  Run B:
  5. Scan, tap "OBD-II Adapter", Connect: "Status: connected" within 3 s, and "Disconnect".
  6. Rotate: adb shell settings put system accelerometer_rotation 0, then
     adb shell settings put system user_rotation 1. Still "Status: connected". Rotate back
     (user_rotation 0). Tap Disconnect: "Status: not connected".
  7. Connect, wait for "connected", go back, tap "Heart Rate Monitor", Connect: "Status:
     connected" and no alert (leaving the first screen ended its connection).
  8. Go back, tap "Smart Scale", Connect: "Status: connecting…", then after 10 s the alert
     "Smart Scale didn't answer within 10 seconds."
- Optional, if you have an emulator with Android 11 (API 30) and the real adapters: grant
  android.permission.ACCESS_FINE_LOCATION instead in step 3 above, scan, tap a
  "gDevice-beacon" row and Connect. On our API 30 image the beacon never answered: the
  10-second message. Report what yours shows.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  Run A: Scan, tap "OBD-II Adapter", Connect: an alert "Connection failed" with "This phone has
  no Bluetooth LE radio." OK: "Status: not connected" and Connect enabled.
  Run B: steps 5, 7 and 8 above, and for step 6 set XCUIDevice.shared.orientation to
  .landscapeLeft: still "Status: connected"; back to .portrait, Disconnect: "Status: not connected".
- Device checks (list them for me, don't try to run them): with LightBlue advertising a
  virtual device on my Mac, on a physical Android phone and an iPhone on my track, using the
  real adapters: Connect reaches "Status: connected"; Disconnect returns to "not connected";
  unchecking the virtual device in LightBlue while connected shows "Connection failed" with a
  "link … was lost" message; Connect with the virtual device unchecked gives a "Connection
  failed" message (the 10-second one, or the radio's own); rotating an Android phone while
  connected keeps "connected", and going back from the detail screen ends the connection;
  turning Bluetooth off while connected ends the connection with a message.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each box of the lesson's "who talks to whom" diagram is in the code.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Connect to a GATT server](https://developer.android.com/develop/connectivity/bluetooth/ble/connect-gatt-server) (nguồn chính: `connectGatt`, callback, việc đóng), và các trang reference của [BluetoothDevice](https://developer.android.com/reference/android/bluetooth/BluetoothDevice) (`connectGatt`, `TRANSPORT_LE`), [BluetoothGatt](https://developer.android.com/reference/android/bluetooth/BluetoothGatt) (`disconnect`, `close`, các mã status), [BluetoothGattCallback](https://developer.android.com/reference/android/bluetooth/BluetoothGattCallback) và [BluetoothAdapter](https://developer.android.com/reference/android/bluetooth/BluetoothAdapter) (`getRemoteDevice`).
- iOS: [CBCentralManager](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager) (nguồn chính: `connect(_:options:)`, `cancelPeripheralConnection(_:)`, `retrievePeripherals(withIdentifiers:)`), [CBCentralManagerDelegate](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerdelegate) (`didConnect`, `didFailToConnect`, `didDisconnectPeripheral`) và [CBPeripheral](https://developer.apple.com/documentation/corebluetooth/cbperipheral). Câu chữ đầy đủ nhất nằm trong `CBCentralManager.h` của SDK, thứ Xcode mở bằng Jump to Definition.
- Vòng đời: [ViewModel overview](https://developer.android.com/topic/libraries/architecture/viewmodel) của Android (cái gì sống qua một thay đổi cấu hình) và [Handle configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes); [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) của Kotlin (huỷ và `finally`), [coroutineScope](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/coroutine-scope.html) (một con lỗi làm hỏng scope) và [Coroutine exceptions handling](https://kotlinlang.org/docs/exception-handling.html) (một con bị huỷ không huỷ cha của nó).
- [Cheatsheet: BLE](https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html): giờ có thêm kết nối đặt cạnh nhau, các vòng đời, và các cái bẫy.
- Kinh nghiệm thực tế: các tag [android-bluetooth](https://stackoverflow.com/questions/tagged/android-bluetooth) và [core-bluetooth](https://stackoverflow.com/questions/tagged/core-bluetooth) của Stack Overflow; tìm "gatt close status 133" và "CBPeripheral connection cancelled not retained".

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Không file nào bị xoá, và mọi thứ khác giữ như ở m08. `iosApp/iosApp.xcodeproj` được sinh bởi `xcodegen generate`.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ConnectionState.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // Where the app's connection to a device stands, in the app's terms. Each platform's adapter
    // turns its radio's callbacks into these.
    sealed interface ConnectionState {
        data object Disconnected : ConnectionState
        data class Connecting(val device: Device) : ConnectionState
        data class Connected(val device: Device) : ConnectionState
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ConnectionException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A connection that couldn't start, failed, or dropped: no permission, Bluetooth off, no answer,
    // or an error from the radio. The message is for the user. The service and outbound adapters
    // throw it, and it reaches inbound adapters through DeviceSession.
    class ConnectionException(message: String) : Exception(message)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Outbound port: what the app needs from a Bluetooth radio to hold a link to one device, in the
    // app's own terms. One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
    interface BleConnection {
        // The link to device, as its state changes: Connecting, then Connected once it's up.
        // Collecting starts the connection, and cancelling the collector ends it and frees what the
        // radio held for it. Throws ConnectionException when the attempt fails or the link drops.
        fun connect(device: Device): Flow<ConnectionState>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.StateFlow

    // Inbound port: what the app offers for talking to one device. Inbound adapters (the shared
    // ViewModels) call it, and SessionService implements it.
    interface DeviceSession {
        // Where the connection stands now. Every screen that shows it reads this one state.
        val connectionState: StateFlow<ConnectionState>

        // Connects to device and holds the connection for as long as the call runs. Returns after
        // disconnect(); cancelling the caller's coroutine also disconnects. Throws ConnectionException:
        // no permission, another connection open, no answer, or the link failed or dropped.
        suspend fun connect(device: Device)

        // Ends the connection, or the attempt, that connect() is holding.
        fun disconnect()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.coroutineScope
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.launch
    import kotlin.time.Duration.Companion.seconds

    // Service: the app's connection rules. Connect only with the Bluetooth permission and to one
    // device at a time, and give up on a device that doesn't answer within CONNECT_TIMEOUT. It owns
    // the connection state that the screens show.
    class SessionService(
        private val connection: BleConnection,
        private val permissions: PermissionChecker,
    ) : DeviceSession {
        private val state = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
        override val connectionState: StateFlow<ConnectionState> = state.asStateFlow()
        private var link: Job? = null

        override suspend fun connect(device: Device) {
            if (permissions.check(Permission.Bluetooth) != PermissionStatus.Granted) {
                throw ConnectionException("Connecting needs the Bluetooth permission.")
            }
            if (state.value != ConnectionState.Disconnected) {
                throw ConnectionException("Another connection is open. Disconnect it first.")
            }
            state.value = ConnectionState.Connecting(device)
            try {
                coroutineScope {
                    link = launch {
                        // iOS never gives up on a connection attempt, so the app does.
                        val giveUp = launch {
                            delay(CONNECT_TIMEOUT)
                            throw ConnectionException("${device.name} didn't answer within 10 seconds.")
                        }
                        connection.connect(device).collect { linkState ->
                            state.value = linkState
                            if (linkState is ConnectionState.Connected) giveUp.cancel()
                        }
                    }
                }
            } finally {
                link = null
                state.value = ConnectionState.Disconnected
            }
        }

        // Cancelling the link ends its collection, and the adapter closes the radio's link.
        override fun disconnect() {
            link?.cancel()
        }

        companion object {
            val CONNECT_TIMEOUT = 10.seconds
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.ConnectionState

    // Everything the detail screen shows about the connection. The device itself comes from the
    // list, through navigation.
    data class DeviceDetailUiState(
        val connection: ConnectionState = ConnectionState.Disconnected,
        val errorMessage: String? = null,
    )
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.inbound.DeviceSession
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the detail screen's Connect and Disconnect into calls on the
    // DeviceSession port, and the session's state into UI state. It knows the port only.
    class DeviceDetailViewModel(private val session: DeviceSession) : ViewModel() {
        private val _uiState = MutableStateFlow(DeviceDetailUiState(connection = session.connectionState.value))
        val uiState: StateFlow<DeviceDetailUiState> = _uiState.asStateFlow()

        private var connectJob: Job? = null

        init {
            viewModelScope.launch {
                session.connectionState.collect { connection ->
                    _uiState.update { it.copy(connection = connection) }
                }
            }
        }

        // The connection runs in viewModelScope, so it lasts as long as this ViewModel: through a
        // rotation, and until the screen is gone for good, when clearing the ViewModel cancels it.
        fun connect(device: Device) {
            if (connectJob?.isActive == true) return
            connectJob = viewModelScope.launch {
                try {
                    session.connect(device)
                } catch (e: ConnectionException) {
                    _uiState.update { it.copy(errorMessage = e.message) }
                }
            }
        }

        fun disconnect() {
            session.disconnect()
        }

        fun errorShown() {
            _uiState.update { it.copy(errorMessage = null) }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.coroutines.awaitCancellation
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Outbound adapter: a pretend link behind the BleConnection port, for the sample devices of
    // SimulatedBleScanner. Each one connects after 1 s and stays connected until the collector
    // cancels, except the Smart Scale, which never answers. The app doesn't bind it; bind it with
    // SimulatedBleScanner in place of the real radio to run without one.
    class SimulatedBleConnection : BleConnection {
        override fun connect(device: Device): Flow<ConnectionState> = flow {
            emit(ConnectionState.Connecting(device))
            if (device.name != "Smart Scale") {
                delay(1000)
                emit(ConnectionState.Connected(device))
            }
            awaitCancellation()
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SampleDevices.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device

    // The devices the simulated radio "hears".
    object SampleDevices {
        val all: List<Device> = listOf(
            Device(id = "C4:7C:8D:6A:01:10", name = "OBD-II Adapter", rssi = -48),
            Device(id = "C4:7C:8D:6A:01:11", name = "Heart Rate Monitor", rssi = -61),
            Device(id = "C4:7C:8D:6A:01:12", name = "Tire Pressure Sensor", rssi = -67),
            Device(id = "C4:7C:8D:6A:01:13", name = "Thermometer", rssi = -74),
            Device(id = "C4:7C:8D:6A:01:14", name = "Smart Scale", rssi = -85),
        )
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.SessionService
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.BleScanner
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
        viewModelOf(::DeviceListViewModel)
        viewModelOf(::DeviceDetailViewModel)
    }

    // The outbound adapters that each platform builds itself and passes to initKoin.
    internal fun platformModule(
        permissionChecker: PermissionChecker,
        bleScanner: BleScanner,
        bleConnection: BleConnection,
    ) = module {
        single { permissionChecker }
        single { bleScanner }
        single { bleConnection }
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin(permissionChecker: PermissionChecker, bleScanner: BleScanner, bleConnection: BleConnection) {
        startKoin {
            modules(appModule, platformModule(permissionChecker, bleScanner, bleConnection))
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.annotation.SuppressLint
    import android.bluetooth.BluetoothAdapter
    import android.bluetooth.BluetoothDevice
    import android.bluetooth.BluetoothGatt
    import android.bluetooth.BluetoothGattCallback
    import android.bluetooth.BluetoothManager
    import android.bluetooth.BluetoothProfile
    import android.content.Context
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow

    // Outbound adapter: a GATT connection over the phone's Bluetooth LE radio, behind the
    // BleConnection port. BluetoothGatt reports to a callback object; callbackFlow turns those calls
    // into a Flow, and closes the GATT client when the collector cancels.
    class AndroidBleConnection(private val context: Context) : BleConnection {
        private val adapter: BluetoothAdapter? =
            context.getSystemService(BluetoothManager::class.java)?.adapter

        // SessionService checks the permission before every connection, so lint's check is suppressed.
        @SuppressLint("MissingPermission")
        override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
            val adapter = adapter
            if (adapter == null || !adapter.isEnabled) {
                throw ConnectionException("Bluetooth is off. Turn it on, then connect again.")
            }
            // Called on a background thread. trySend and close are safe from any thread.
            val callback = object : BluetoothGattCallback() {
                private var linked = false

                override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                    when {
                        status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED -> {
                            linked = true
                            trySend(ConnectionState.Connected(device))
                        }
                        linked -> close(ConnectionException("The link to ${device.name} was lost (Android status $status)."))
                        else -> close(ConnectionException("The connection failed (Android status $status)."))
                    }
                }
            }
            send(ConnectionState.Connecting(device))
            // The id is the address the scan reported. false: connect directly, now. Android 17 (API 37)
            // deprecates this connectGatt for a new one that older phones don't have.
            @Suppress("DEPRECATION")
            val gatt: BluetoothGatt = adapter.getRemoteDevice(device.id)
                .connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
                ?: throw ConnectionException("Android couldn't start the connection.")

            awaitClose {
                // Whatever ended the link, close the GATT client, or Android keeps it registered.
                gatt.disconnect()
                gatt.close()
            }
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ConnectFlow.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.channels.ProducerScope
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow

    // Swift can't build a Kotlin Flow, so the Swift connection asks for one here, as the Swift
    // scanner does in ScanFlow.kt. Collecting the Flow calls the link's open; cancelling the
    // collector calls its close. Not a port: it's the Kotlin half of the iOS adapter.
    fun connectFlow(link: IosLink, device: Device): Flow<ConnectionState> = callbackFlow {
        link.open(device, LinkFeed(this))
        awaitClose { link.close() }
    }

    // What the Swift connection implements for connectFlow: open and close the real link.
    interface IosLink {
        fun open(device: Device, feed: LinkFeed)
        fun close()
    }

    // Where the Swift connection reports: each state of the link, or the failure that ends it.
    class LinkFeed internal constructor(private val scope: ProducerScope<ConnectionState>) {
        fun changed(state: ConnectionState) {
            scope.trySend(state)
        }

        fun failed(message: String) {
            scope.close(ConnectionException(message))
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Fake: an outbound adapter written for tests, behind the BleConnection port. The test plays
    // the radio and the device: whether and when the device answers, and whether the link fails.
    class FakeBleConnection : BleConnection {
        private val events = Channel<Event>(Channel.UNLIMITED)
        var attempts = 0
            private set
        var isLinked = false // true while a collector holds the link
            private set

        override fun connect(device: Device): Flow<ConnectionState> = flow {
            attempts++
            isLinked = true
            try {
                emit(ConnectionState.Connecting(device))
                for (event in events) {
                    when (event) {
                        Event.Answer -> emit(ConnectionState.Connected(device))
                        is Event.Fail -> throw ConnectionException(event.message)
                    }
                }
            } finally {
                isLinked = false
            }
        }

        // The device answers: the link is up.
        fun answer() {
            events.trySend(Event.Answer)
        }

        // The attempt fails, or the link drops, with this message.
        fun fail(message: String) {
            events.trySend(Event.Fail(message))
        }

        private sealed interface Event {
            data object Answer : Event
            data class Fail(val message: String) : Event
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestDeviceSession.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.inbound.DeviceSession
    import kotlinx.coroutines.awaitCancellation
    import kotlinx.coroutines.flow.MutableStateFlow

    // Test implementation of the DeviceSession inbound port. It stands in for the whole app core,
    // so a ViewModel test tests the ViewModel only. The test sets the state and the failures.
    class TestDeviceSession : DeviceSession {
        override val connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
        var failure: ConnectionException? = null
        val connected = mutableListOf<Device>() // one entry per connect() call
        var isHolding = false // true while a connect() call is running
            private set
        var disconnects = 0
            private set

        override suspend fun connect(device: Device) {
            connected += device
            failure?.let { throw it }
            isHolding = true
            try {
                awaitCancellation()
            } finally {
                isHolding = false
            }
        }

        override fun disconnect() {
            disconnects++
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/SessionServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import app.cash.turbine.test
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.doubles.FakeBleConnection
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.ExperimentalCoroutinesApi
    import kotlinx.coroutines.async
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFailsWith
    import kotlin.test.assertFalse
    import kotlin.test.assertTrue

    @OptIn(ExperimentalCoroutinesApi::class) // currentTime
    class SessionServiceTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val heart = Device(id = "02", name = "Heart Rate Monitor", rssi = -61)

        private val radio = FakeBleConnection()
        private val os = FakePermissionChecker().apply {
            statuses[Permission.Bluetooth] = PermissionStatus.Granted
        }

        // Through the inbound port, as the ViewModel calls it.
        private val session: DeviceSession = SessionService(radio, os)

        @Test
        fun reportsEachStateOfTheConnection() = runTest {
            session.connectionState.test {
                assertEquals(ConnectionState.Disconnected, awaitItem())

                val call = launch { session.connect(obd) }
                assertEquals(ConnectionState.Connecting(obd), awaitItem())

                radio.answer()
                assertEquals(ConnectionState.Connected(obd), awaitItem())

                call.cancelAndJoin()
                assertEquals(ConnectionState.Disconnected, awaitItem())
            }
        }

        @Test
        fun disconnectEndsTheLinkAndConnectReturns() = runTest {
            val call = async { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()
            assertTrue(radio.isLinked)

            session.disconnect()
            call.await() // returns normally: the app asked for it

            assertFalse(radio.isLinked)
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun cancellingTheCallerAlsoDisconnects() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            call.cancelAndJoin() // what clearing a ViewModel does to viewModelScope

            assertFalse(radio.isLinked)
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun aFailedLinkReachesTheCaller() = runTest {
            radio.fail("The connection failed (Android status 133).")

            val error = assertFailsWith<ConnectionException> { session.connect(obd) }

            assertEquals("The connection failed (Android status 133).", error.message)
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun givesUpOnADeviceThatDoesNotAnswer() = runTest {
            val error = assertFailsWith<ConnectionException> { session.connect(obd) }

            assertEquals("OBD-II Adapter didn't answer within 10 seconds.", error.message)
            assertEquals(SessionService.CONNECT_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
            assertFalse(radio.isLinked)
        }

        @Test
        fun theTimeoutStopsOnceConnected() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()

            testScheduler.advanceTimeBy(SessionService.CONNECT_TIMEOUT * 6) // a minute, connected

            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            call.cancelAndJoin()
        }

        @Test
        fun neverTouchesTheRadioWithoutThePermission() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Denied

            val error = assertFailsWith<ConnectionException> { session.connect(obd) }

            assertEquals("Connecting needs the Bluetooth permission.", error.message)
            assertEquals(0, radio.attempts)
        }

        @Test
        fun connectsToOneDeviceAtATime() = runTest {
            val first = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.connect(heart) }

            assertEquals("Another connection is open. Disconnect it first.", error.message)
            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            assertEquals(1, radio.attempts)
            first.cancelAndJoin()
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModelProvider
    import androidx.lifecycle.ViewModelStore
    import androidx.lifecycle.viewmodel.initializer
    import androidx.lifecycle.viewmodel.viewModelFactory
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.doubles.TestDeviceSession
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

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain
    class DeviceDetailViewModelTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)

        private val session = TestDeviceSession()
        private val store = ViewModelStore() // plays the screen that owns the ViewModel
        private lateinit var viewModel: DeviceDetailViewModel

        @BeforeTest
        fun setUp() {
            Dispatchers.setMain(StandardTestDispatcher())
            val factory = viewModelFactory { initializer { DeviceDetailViewModel(session) } }
            viewModel = ViewModelProvider.create(store, factory)[DeviceDetailViewModel::class]
        }

        @AfterTest
        fun tearDown() {
            Dispatchers.resetMain()
        }

        @Test
        fun showsTheSessionsConnectionState() = runTest {
            testScheduler.runCurrent()

            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            assertEquals(ConnectionState.Connected(obd), viewModel.uiState.value.connection)
        }

        @Test
        fun aFailedConnectionBecomesAMessageUntilItIsShown() = runTest {
            session.failure = ConnectionException("OBD-II Adapter didn't answer within 10 seconds.")

            viewModel.connect(obd)
            testScheduler.runCurrent()
            assertEquals("OBD-II Adapter didn't answer within 10 seconds.", viewModel.uiState.value.errorMessage)

            viewModel.errorShown()
            assertNull(viewModel.uiState.value.errorMessage)
        }

        @Test
        fun ignoresConnectWhileAConnectionIsHeld() = runTest {
            viewModel.connect(obd)
            testScheduler.runCurrent()
            viewModel.connect(obd)
            testScheduler.runCurrent()

            assertEquals(listOf(obd), session.connected)
        }

        @Test
        fun disconnectAsksTheSession() {
            viewModel.disconnect()

            assertEquals(1, session.disconnects)
        }

        @Test
        fun theConnectionEndsWhenTheScreenIsGoneForGood() = runTest {
            viewModel.connect(obd)
            testScheduler.runCurrent()
            assertTrue(session.isHolding)

            store.clear() // the screen left the back stack: the ViewModel is cleared
            testScheduler.runCurrent()

            assertFalse(session.isHolding)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.doubles.FakeBleConnection
    import com.example.devicemonitor.doubles.FakeBleScanner
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import org.koin.dsl.koinApplication
    import kotlin.test.Test
    import kotlin.test.assertNotNull

    class AppModuleTest {
        // Koin checks the graph only when something asks for an instance, at run time. This
        // test asks for every screen's ViewModel, so a missing binding fails here, not in the app.
        // Fakes stand in for the adapters each platform passes to initKoin.
        @Test
        fun buildsEveryViewModel() {
            val koin = koinApplication {
                modules(appModule, platformModule(FakePermissionChecker(), FakeBleScanner(), FakeBleConnection()))
            }.koin

            assertNotNull(koin.get<DeviceListViewModel>())
            assertNotNull(koin.get<DeviceDetailViewModel>())
        }
    }
    ```

**Android**

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
    import com.example.devicemonitor.adapter.outbound.AndroidBleConnection
    import com.example.devicemonitor.adapter.outbound.AndroidBleScanner
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
            initKoin(permissionChecker, AndroidBleScanner(this), AndroidBleConnection(this))
        }
    }
    ```

=== "Compose"

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApp.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.layout.padding
        import androidx.compose.material3.Scaffold
        import androidx.compose.runtime.Composable
        import androidx.compose.ui.Modifier
        import androidx.navigation.compose.NavHost
        import androidx.navigation.compose.composable
        import androidx.navigation.compose.rememberNavController
        import androidx.navigation.toRoute
        import com.example.devicemonitor.core.Device
        import kotlinx.serialization.Serializable

        @Serializable
        data object DeviceList

        // The selected device travels in the route: the detail screen needs all of it to connect.
        @Serializable
        data class DeviceDetail(val id: String, val name: String, val rssi: Int)

        @Composable
        fun DeviceMonitorApp() {
            val navController = rememberNavController()
            Scaffold { innerPadding ->
                NavHost(
                    navController = navController,
                    startDestination = DeviceList,
                    modifier = Modifier.padding(innerPadding),
                ) {
                    composable<DeviceList> {
                        DeviceListScreen(
                            onDeviceClick = { device ->
                                navController.navigate(DeviceDetail(device.id, device.name, device.rssi))
                            },
                        )
                    }
                    composable<DeviceDetail> { entry ->
                        val route: DeviceDetail = entry.toRoute()
                        DeviceDetailScreen(
                            device = Device(id = route.id, name = route.name, rssi = route.rssi),
                            onBack = { navController.popBackStack() },
                        )
                    }
                }
            }
        }
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailScreen.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.Image
        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.Row
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.fillMaxWidth
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.size
        import androidx.compose.material3.AlertDialog
        import androidx.compose.material3.Button
        import androidx.compose.material3.CircularProgressIndicator
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.runtime.getValue
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.graphics.ColorFilter
        import androidx.compose.ui.res.painterResource
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
        import com.example.devicemonitor.core.ConnectionState
        import com.example.devicemonitor.core.Device
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: connects the shared ViewModel to the content below. koinViewModel() scopes the
        // ViewModel to this screen's back stack entry: it survives a rotation, and it is cleared,
        // connection and all, when the screen is popped.
        @Composable
        fun DeviceDetailScreen(
            device: Device,
            onBack: () -> Unit,
            viewModel: DeviceDetailViewModel = koinViewModel(),
        ) {
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            DeviceDetailContent(
                device = device,
                connection = state.connection,
                onConnect = { viewModel.connect(device) },
                onDisconnect = viewModel::disconnect,
                onBack = onBack,
            )

            state.errorMessage?.let { message ->
                AlertDialog(
                    onDismissRequest = viewModel::errorShown,
                    confirmButton = { TextButton(onClick = viewModel::errorShown) { Text("OK") } },
                    title = { Text("Connection failed") },
                    text = { Text(message) },
                )
            }
        }

        // Stateless: renders whatever it's given, reports events up.
        @Composable
        fun DeviceDetailContent(
            device: Device,
            connection: ConnectionState,
            onConnect: () -> Unit,
            onDisconnect: () -> Unit,
            onBack: () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_bluetooth),
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary),
                    modifier = Modifier.size(96.dp),
                )
                Text(device.name, style = MaterialTheme.typography.headlineSmall)
                Text("ID: ${device.id}")
                Text("Signal: ${device.rssi} dBm")
                ConnectionStatus(connection)
                // One button: Connect while disconnected, Disconnect while connecting or connected.
                val disconnected = connection is ConnectionState.Disconnected
                Button(
                    onClick = if (disconnected) onConnect else onDisconnect,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (disconnected) "Connect" else "Disconnect")
                }
                TextButton(onClick = dropUnlessResumed { onBack() }) {
                    Text("Back")
                }
            }
        }

        @Composable
        private fun ConnectionStatus(connection: ConnectionState) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                when (connection) {
                    ConnectionState.Disconnected -> Text("Status: not connected")
                    is ConnectionState.Connecting -> {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Status: connecting…")
                    }
                    is ConnectionState.Connected -> Text("Status: connected", color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        ```

=== "XML"

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

            // Back from Settings (or anywhere else): the permission may have changed.
            override fun onResume() {
                super.onResume()
                viewModel.refreshPermission()
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Color
        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import androidx.appcompat.app.AlertDialog
        import androidx.fragment.app.Fragment
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import com.example.devicemonitor.adapter.inbound.DeviceDetailUiState
        import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
        import com.example.devicemonitor.android.databinding.FragmentDeviceDetailBinding
        import com.example.devicemonitor.core.ConnectionState
        import com.example.devicemonitor.core.Device
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        class DeviceDetailFragment : Fragment() {
            // Survives rotation; cleared, connection and all, when this Fragment leaves the back stack
            // for good. The views below are rebuilt on every rotation; the connection is not in them.
            private val viewModel: DeviceDetailViewModel by viewModel()

            private var binding: FragmentDeviceDetailBinding? = null
            private var errorDialog: AlertDialog? = null

            override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
                val b = FragmentDeviceDetailBinding.inflate(inflater, container, false)
                binding = b
                val args = requireArguments()
                val device = Device(
                    id = args.getString("deviceId").orEmpty(),
                    name = args.getString("deviceName").orEmpty(),
                    rssi = args.getInt("deviceRssi"),
                )
                b.deviceName.text = device.name
                b.deviceId.text = "ID: ${device.id}"
                b.deviceRssi.text = "Signal: ${device.rssi} dBm"
                // One button: Connect while disconnected, Disconnect while connecting or connected.
                b.connectButton.setOnClickListener {
                    if (viewModel.uiState.value.connection is ConnectionState.Disconnected) {
                        viewModel.connect(device)
                    } else {
                        viewModel.disconnect()
                    }
                }
                b.backButton.setOnClickListener {
                    val nav = findNavController()
                    // A fast double tap would otherwise pop the list too and empty the back stack.
                    if (nav.currentDestination?.id == R.id.deviceDetail) nav.popBackStack()
                }
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

            override fun onDestroyView() {
                super.onDestroyView()
                errorDialog?.dismiss() // a dismiss() doesn't call the cancel listener, so the error stays in state
                errorDialog = null
                binding = null
            }

            // The one place that touches views: every new state ends here.
            private fun render(state: DeviceDetailUiState) {
                val b = binding ?: return
                val connection = state.connection
                b.progress.visibility = if (connection is ConnectionState.Connecting) View.VISIBLE else View.GONE
                b.statusText.text = when (connection) {
                    ConnectionState.Disconnected -> "Status: not connected"
                    is ConnectionState.Connecting -> "Status: connecting…"
                    is ConnectionState.Connected -> "Status: connected"
                }
                b.statusText.setTextColor(if (connection is ConnectionState.Connected) Color.BLUE else Color.DKGRAY)
                b.connectButton.text = if (connection is ConnectionState.Disconnected) "Connect" else "Disconnect"
                renderError(state.errorMessage)
            }

            private fun renderError(message: String?) {
                if (message == null) {
                    errorDialog?.dismiss()
                    errorDialog = null
                } else if (errorDialog == null) {
                    errorDialog = AlertDialog.Builder(requireContext())
                        .setTitle("Connection failed")
                        .setMessage(message)
                        .setPositiveButton("OK") { _, _ -> viewModel.errorShown() }
                        .setOnCancelListener { viewModel.errorShown() }
                        .show()
                }
            }
        }
        ```

    ??? example "androidApp/src/main/res/layout/fragment_device_detail.xml"
        ```xml
        <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
            xmlns:app="http://schemas.android.com/apk/res-auto"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:gravity="center_horizontal"
            android:orientation="vertical"
            android:padding="16dp">

            <ImageView
                android:id="@+id/deviceIcon"
                android:layout_width="96dp"
                android:layout_height="96dp"
                android:contentDescription="@null"
                android:src="@drawable/ic_bluetooth"
                app:tint="?attr/colorAccent" />

            <TextView
                android:id="@+id/deviceName"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:textAppearance="@style/TextAppearance.AppCompat.Headline" />

            <TextView
                android:id="@+id/deviceId"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp" />

            <TextView
                android:id="@+id/deviceRssi"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <ProgressBar
                    android:id="@+id/progress"
                    android:layout_width="20dp"
                    android:layout_height="20dp"
                    android:layout_marginEnd="8dp"
                    android:visibility="gone" />

                <TextView
                    android:id="@+id/statusText"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content" />
            </LinearLayout>

            <Button
                android:id="@+id/connectButton"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:text="Connect" />

            <Button
                android:id="@+id/backButton"
                style="@style/Widget.AppCompat.Button.Borderless.Colored"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:text="Back" />
        </LinearLayout>
        ```

    ??? example "androidApp/src/main/res/navigation/nav_graph.xml"
        ```xml
        <navigation xmlns:android="http://schemas.android.com/apk/res/android"
            xmlns:app="http://schemas.android.com/apk/res-auto"
            android:id="@+id/nav_graph"
            app:startDestination="@id/deviceList">

            <fragment
                android:id="@+id/deviceList"
                android:name="com.example.devicemonitor.android.DeviceListFragment">
                <action
                    android:id="@+id/toDetail"
                    app:destination="@id/deviceDetail" />
            </fragment>

            <fragment
                android:id="@+id/deviceDetail"
                android:name="com.example.devicemonitor.android.DeviceDetailFragment">
                <argument
                    android:name="deviceId"
                    app:argType="string" />
                <argument
                    android:name="deviceName"
                    app:argType="string" />
                <argument
                    android:name="deviceRssi"
                    app:argType="integer" />
            </fragment>
        </navigation>
        ```

**iOS**

??? example "iosApp/iosApp/IosBleConnection.swift · both iOS tracks"
    ```swift
    import CoreBluetooth
    import Shared

    // Outbound adapter: a link to one peripheral over the iPhone's radio, behind the Kotlin
    // BleConnection port. Like the scanner, it is its own manager's delegate and Koin keeps it alive.
    // It also keeps the CBPeripheral while the link lasts: CoreBluetooth cancels a pending
    // connection when its peripheral is deallocated.
    @MainActor
    final class IosBleConnection: NSObject, @preconcurrency BleConnection, @preconcurrency IosLink,
        @preconcurrency CBCentralManagerDelegate {
        private var manager: CBCentralManager?
        private var peripheral: CBPeripheral?
        private var device: Device?
        private var feed: LinkFeed?

        // Swift can't build a Kotlin Flow, so it asks Kotlin for one (ConnectFlow.kt, in iosMain).
        func connect(device: Device) -> SkieSwiftFlow<ConnectionState> {
            connectFlow(link: self, device: device)
        }

        // IosLink: connectFlow calls these when the Flow is collected and when it is cancelled.
        func open(device: Device, feed: LinkFeed) {
            self.device = device
            self.feed = feed
            let manager = self.manager ?? makeManager()
            // A new manager learns the radio's state a moment later; centralManagerDidUpdateState
            // then calls start.
            if manager.state != .unknown && manager.state != .resetting { start(on: manager) }
        }

        func close() {
            if let peripheral, manager?.state == .poweredOn { manager?.cancelPeripheralConnection(peripheral) }
            peripheral = nil
            device = nil
            feed = nil
        }

        private func start(on manager: CBCentralManager) {
            guard let device, let feed, peripheral == nil else { return }
            guard manager.state == .poweredOn else { return end(with: message(for: manager.state)) }
            // The scanner found the device with its own manager; this one asks for it by identifier.
            guard let id = UUID(uuidString: device.id),
                  let found = manager.retrievePeripherals(withIdentifiers: [id]).first else {
                return end(with: "This iPhone doesn't know \(device.name) any more. Scan again.")
            }
            peripheral = found
            feed.changed(state: ConnectionStateConnecting(device: device))
            manager.connect(found)
        }

        // Called on the main queue (queue: nil) when the link is up.
        func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
            guard peripheral === self.peripheral, let device else { return }
            feed?.changed(state: ConnectionStateConnected(device: device))
        }

        func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral,
                            error: Error?) {
            guard peripheral === self.peripheral else { return }
            end(with: "The connection failed: \(error?.localizedDescription ?? "no reason given").")
        }

        // error is nil when the app asked for the disconnection, in close(): nothing is waiting then.
        func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral,
                            error: Error?) {
            guard peripheral === self.peripheral, let error, let device else { return }
            end(with: "The link to \(device.name) was lost: \(error.localizedDescription)")
        }

        func centralManagerDidUpdateState(_ central: CBCentralManager) {
            guard central.state != .unknown, central.state != .resetting else { return }
            if peripheral == nil {
                start(on: central) // open() was waiting for the state
            } else if central.state != .poweredOn {
                end(with: "Bluetooth was turned off.")
            }
        }

        // Ends the Flow with the message; Kotlin then calls close().
        private func end(with message: String) {
            let feed = self.feed
            close()
            feed?.failed(message: message)
        }

        private func message(for state: CBManagerState) -> String {
            switch state {
            case .unsupported: "This phone has no Bluetooth LE radio."
            case .unauthorized: "Connecting needs the Bluetooth permission."
            default: "Bluetooth is off. Turn it on, then connect again."
            }
        }

        // No system alert when Bluetooth is off: the app shows its own message.
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
                    bleConnection: IosBleConnection()
                )
            }

            var body: some Scene {
                WindowGroup {
                    ContentView()
                }
            }
        }
        ```

    ??? example "iosApp/iosApp/ContentView.swift"
        ```swift
        import SwiftUI
        import Shared

        struct ContentView: View {
            var body: some View {
                NavigationStack {
                    DeviceListView()
                        .navigationDestination(for: DeviceRoute.self) { route in
                            DeviceDetailView(device: route.device)
                        }
                }
            }
        }

        // The selected device travels in the route: the detail screen needs all of it to connect.
        // A Kotlin class is an NSObject in Swift, so Device is Hashable through isEqual and hash.
        struct DeviceRoute: Hashable {
            let device: Device
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
                    onOpenSettings: { viewModel.openSettings() }
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
                // Back from Settings (or anywhere else): the permission may have changed.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { viewModel.refreshPermission() }
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

            var body: some View {
                VStack(alignment: .leading, spacing: 12) {
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

    ??? example "iosApp/iosApp/DeviceDetailView.swift"
        ```swift
        import SwiftUI
        import Shared

        // Stateful: connects the shared ViewModel to the content below. The owner lives in @State, so
        // the ViewModel lasts as long as this screen is on the navigation stack; popping the screen
        // deinitialises the owner, which clears the ViewModel and ends the connection.
        struct DeviceDetailView: View {
            let device: Device
            @State private var owner = ViewModelOwner()
            @State private var state: DeviceDetailUiState?

            var body: some View {
                let viewModel: DeviceDetailViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                DeviceDetailContent(
                    device: device,
                    connection: state.connection,
                    onConnect: { viewModel.connect(device: device) },
                    onDisconnect: { viewModel.disconnect() }
                )
                .alert(
                    "Connection failed",
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
            }
        }

        // Stateless: renders whatever it's given, reports events up.
        struct DeviceDetailContent: View {
            let device: Device
            let connection: ConnectionState
            let onConnect: () -> Void
            let onDisconnect: () -> Void

            var body: some View {
                let disconnected = connection is ConnectionStateDisconnected
                VStack(spacing: 12) {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .font(.system(size: 64))
                        .foregroundStyle(.tint)
                    Text(device.name)
                        .font(.title2)
                    Text("ID: \(device.id)")
                    Text("Signal: \(device.rssi) dBm")
                    ConnectionStatus(connection: connection)
                    // One button: Connect while disconnected, Disconnect while connecting or connected.
                    Button(action: disconnected ? onConnect : onDisconnect) {
                        Text(disconnected ? "Connect" : "Disconnect")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    Spacer()
                }
                .padding()
                .navigationTitle("Device")
                .navigationBarTitleDisplayMode(.inline)
            }
        }

        // SKIE turns the sealed interface into a Swift enum, so this switch is exhaustive.
        private struct ConnectionStatus: View {
            let connection: ConnectionState

            var body: some View {
                switch onEnum(of: connection) {
                case .disconnected:
                    Text("Status: not connected")
                case .connecting:
                    HStack {
                        ProgressView()
                        Text("Status: connecting…")
                    }
                case .connected:
                    Text("Status: connected")
                        .foregroundStyle(.tint)
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
                    bleConnection: IosBleConnection()
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
                tableView.register(UITableViewCell.self, forCellReuseIdentifier: "device")
                tableView.delegate = self

                let statusRow = UIStackView(arrangedSubviews: [spinner, statusLabel])
                statusRow.spacing = 8
                let permissionRow = UIStackView(arrangedSubviews: [permissionLabel, permissionButton])
                permissionRow.axis = .vertical
                permissionRow.alignment = .leading
                let stack = UIStackView(arrangedSubviews: [filterField, permissionRow, scanButton, statusRow, tableView])
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
                // Back from Settings (or anywhere else): the permission may have changed.
                NotificationCenter.default.addObserver(
                    self, selector: #selector(sceneDidActivate),
                    name: UIScene.didActivateNotification, object: nil
                )
            }

            @objc private func sceneDidActivate() {
                viewModel.refreshPermission()
            }

            // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android.
            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
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

    ??? example "iosApp/iosApp/DeviceDetailViewController.swift"
        ```swift
        import UIKit
        import Shared

        final class DeviceDetailViewController: UIViewController {
            private let device: Device
            // The ViewModel lives as long as this controller: popping it deinitialises the owner, which
            // clears the ViewModel and ends the connection. Its views can come and go; the link is not in them.
            private let owner = ViewModelOwner()
            private lazy var viewModel: DeviceDetailViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?

            private let spinner = UIActivityIndicatorView(style: .medium)
            private let statusLabel = UILabel()
            private let connectButton = UIButton(configuration: .filled())

            init(device: Device) {
                self.device = device
                super.init(nibName: nil, bundle: nil)
            }

            required init?(coder: NSCoder) { fatalError("not used") }

            override func viewDidLoad() {
                super.viewDidLoad()
                title = "Device"
                navigationItem.largeTitleDisplayMode = .never
                view.backgroundColor = .systemBackground

                let icon = UIImageView(image: UIImage(systemName: "antenna.radiowaves.left.and.right"))
                icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 64)
                icon.tintColor = .tintColor
                let nameLabel = UILabel()
                nameLabel.font = .preferredFont(forTextStyle: .title2)
                nameLabel.text = device.name
                let idLabel = UILabel()
                idLabel.text = "ID: \(device.id)"
                let rssiLabel = UILabel()
                rssiLabel.text = "Signal: \(device.rssi) dBm"
                // One button: Connect while disconnected, Disconnect while connecting or connected.
                connectButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if viewModel.uiState.value.connection is ConnectionStateDisconnected {
                        viewModel.connect(device: device)
                    } else {
                        viewModel.disconnect()
                    }
                }, for: .touchUpInside)

                let statusRow = UIStackView(arrangedSubviews: [spinner, statusLabel])
                statusRow.spacing = 8
                let stack = UIStackView(arrangedSubviews: [icon, nameLabel, idLabel, rssiLabel, statusRow, connectButton])
                stack.axis = .vertical
                stack.alignment = .center
                stack.spacing = 12
                stack.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(stack)
                NSLayoutConstraint.activate([
                    stack.topAnchor.constraint(equalTo: view.layoutMarginsGuide.topAnchor, constant: 12),
                    stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
                    stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
                    connectButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
                ])
                render(viewModel.uiState.value)
            }

            // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android. Leaving the
            // screen stops the collection, not the connection.
            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
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

            // The one place that touches views: every new state ends here. SKIE turns the sealed
            // interface into a Swift enum, so this switch is exhaustive.
            private func render(_ state: DeviceDetailUiState) {
                let disconnected = state.connection is ConnectionStateDisconnected
                switch onEnum(of: state.connection) {
                case .disconnected:
                    statusLabel.text = "Status: not connected"
                    statusLabel.textColor = .label
                case .connecting:
                    statusLabel.text = "Status: connecting…"
                    statusLabel.textColor = .label
                case .connected:
                    statusLabel.text = "Status: connected"
                    statusLabel.textColor = .tintColor
                }
                let connecting = state.connection is ConnectionStateConnecting
                if connecting { spinner.startAnimating() } else { spinner.stopAnimating() }
                spinner.isHidden = !connecting
                connectButton.configuration?.title = disconnected ? "Connect" : "Disconnect"
                renderError(state.errorMessage)
            }

            private func renderError(_ message: String?) {
                guard let message, presentedViewController == nil else { return }
                let alert = UIAlertController(title: "Connection failed", message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
                    self?.viewModel.errorShown()
                })
                present(alert, animated: true)
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 là chương trình Kotlin đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0, thời gian ảo của `kotlinx-coroutines-test`); ở A6 là chương trình Swift đã compile và chạy thật (Swift 6.3.2, chế độ Swift 6). Cả hai là **mô hình**: console không có radio Bluetooth, nên radio và CoreBluetooth được giả lập. A7 là mô phỏng bấm được, không phải app thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A7](#a7-phong-thi-nghiem-goi-cup-may-rot-song): **bấm thử** trước: Connect, Disconnect, tắt thiết bị, đi xa, chờ hết 10 s, xoay màn hình.
    3. [A2](#a2-ba-trang-thai-nhu-mot-cuoc-goi-ien-thoai): ba trạng thái và vì sao không có "disconnecting" hay "failed" (mục 1).
    4. [A3](#a3-mot-loi-goi-giu-ca-cuoc-goi-mo-hinh-sessionservice-chay-that): `connect` treo suốt cuộc gọi, hết hạn 10 s, chạy thật bằng Kotlin (mục 2, 3).
    5. [A4](#a4-callback-cua-radio-noi-gi-android-canh-ios): các callback của Android và iOS nói gì, và adapter dịch chúng ra sao (mục 4, 5).
    6. [A5](#a5-cai-bay-vong-oi-ai-uoc-cam-ong-nghe): cái bẫy vòng đời: giữ kết nối ở đâu thì sống qua xoay màn hình (mục 7).
    7. [A6](#a6-ios-vi-sao-phai-giu-peripheral-chay-that-bang-swift): iOS: vì sao phải giữ `CBPeripheral` trong một property (mục 5, gotcha mục 7).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Quét chỉ là **nghe**; muốn đọc dữ liệu thì phải **kết nối** (Android `connectGatt`, iOS `connect(_:)`).
    2. App có ba trạng thái: `Disconnected`, `Connecting(device)`, `Connected(device)`. Lỗi không phải một trạng thái: nó là một `ConnectionException` bay về chỗ đã gọi `connect`, và state quay về `Disconnected`.
    3. `SessionService` giữ luật: phải có quyền, mỗi lần một thiết bị, quá **10 s** không trả lời là bỏ. Nó là chỗ duy nhất ghi state.
    4. `connect(device)` **treo suốt cả kết nối**: coroutine gọi nó sống bao lâu thì kết nối sống bấy lâu; huỷ coroutine là cúp máy, và `awaitClose` của adapter đóng radio.
    5. Vì vậy kết nối phải chạy trong `viewModelScope` (sống qua xoay màn hình), các object của radio nằm trong adapter (Koin single), không bao giờ nằm trong Activity hay view.

Ví dụ đời thường cho cả bài: **một cuộc gọi điện thoại.** Bấm gọi là *Connecting* (đang đổ chuông). Đầu kia nhấc máy là *Connected*. Bạn cúp máy là *Disconnected*, không cần chờ ai xác nhận. Đầu kia không nghe máy thì sau 10 s bạn tự bỏ (iPhone thì đổ chuông mãi mãi nếu bạn không bỏ). Đang nói mà mất sóng là "rớt cuộc gọi", và bạn được báo lý do. Và cái bẫy: nếu ống nghe nằm trong tay một người sắp rời phòng (Activity bị xoay), cuộc gọi vẫn mở mà không ai còn cầm máy để cúp.

| Chữ trong bài | Nói đơn giản | Trong m09 là |
|---|---|---|
| GATT client / server | điện thoại là bên gọi (client), thiết bị BLE là bên nghe máy (server) | app là client, OBD-II Adapter là server |
| `ConnectionState` | ba trạng thái của cuộc gọi, theo cách nói của app | `Disconnected` / `Connecting` / `Connected` |
| `ConnectionException` | lý do cuộc gọi hỏng, có câu chữ để hiện cho người dùng | alert "Connection failed" |
| `DeviceSession` (inbound port) | thứ ViewModel được phép gọi: `connectionState`, `connect`, `disconnect` | `SessionService` implement nó |
| `BleConnection` (outbound port) | thứ app cần từ radio: một `Flow` của trạng thái liên kết | `AndroidBleConnection`, `IosBleConnection` |
| `callbackFlow` / `awaitClose` | biến callback thành `Flow`; `awaitClose` là chỗ dọn dẹp khi `Flow` kết thúc | `gatt.close()` / `link.close()` |
| `coroutineScope` | khối chờ mọi coroutine con xong; con lỗi thì cả khối lỗi | chứa `link` và `giveUp` |
| hết hạn (timeout) | tự bỏ nếu đầu kia không trả lời | `CONNECT_TIMEOUT = 10.seconds` |
| `status` / `newState` | hai con số Android đưa vào `onConnectionStateChange` | `0` + `STATE_CONNECTED` là đã lên, còn lại là lỗi |
| `retrievePeripherals` | iOS: lấy lại `CBPeripheral` theo UUID mà scanner đã thấy | `Device.id` là UUID đó |
| `viewModelScope` | scope sống bằng ViewModel: qua xoay màn hình, chết khi màn hình đi hẳn | nơi `session.connect` chạy |

### A2. Ba trạng thái như một cuộc gọi điện thoại

Giải thích thêm cho [mục 1](#1-ket-noi-nghia-la-gi).

Một cuộc gọi có bốn khoảnh khắc mà điện thoại nào cũng có: đang gọi, đang nói, đang cúp, đã cúp. Android và iOS cũng đặt tên cả bốn. App chỉ giữ ba, vì hai lý do:

- **Không có "đang cúp" (disconnecting).** Khi bạn đã bấm cúp, bạn không đứng nhìn màn hình chờ chữ "đã cúp". App cũng vậy: `close()` của adapter gọi `gatt.disconnect(); gatt.close()` hoặc `cancelPeripheralConnection` rồi quên luôn thiết bị.
- **Không có "lỗi" (failed).** "Không ai nghe máy" không phải là một chỗ để đứng lại; bạn quay về màn hình chờ gọi, và lý do được báo một lần. Trong app: state về `Disconnected`, và lý do đi theo `ConnectionException` tới `DeviceDetailViewModel`, thứ đặt `errorMessage` để màn hình hiện alert.

So với thứ bạn đã biết từ web:

| WebSocket (`readyState`) | `ConnectionState` của app | Android `newState` (`BluetoothProfile`) | iOS `CBPeripheralState` |
|---|---|---|---|
| `CONNECTING` (0) | `Connecting(device)` | `STATE_CONNECTING` (1) | `.connecting` |
| `OPEN` (1) | `Connected(device)` | `STATE_CONNECTED` (2) | `.connected` |
| `CLOSING` (2) | không có: app không chờ | `STATE_DISCONNECTING` (3) | `.disconnecting` |
| `CLOSED` (3) | `Disconnected` | `STATE_DISCONNECTED` (0) | `.disconnected` |
| `onerror` rồi `onclose` | `ConnectionException` cho bên gọi, state về `Disconnected` | `status != GATT_SUCCESS` | `didFailToConnect`, `didDisconnectPeripheral(error:)` có error |

Hai khác biệt với WebSocket đáng nhớ:

1. **Thiết bị nằm trong state.** `readyState` chỉ là một con số; `Connected(device)` nói luôn *nối với ai*. Một màn hình khác (bài sau) đọc `connectionState` là biết, không cần hỏi màn hình chi tiết.
2. **State có một chủ.** Với WebSocket, ai giữ object `ws` thì đọc được `readyState`. Ở đây chỉ `SessionService` ghi `state`, adapter chỉ báo, và `finally` luôn đưa nó về `Disconnected`. Không có chuyện màn hình kẹt ở "connected" cho một liên kết đã mất.

Áp vào app: ba chữ trên dòng trạng thái ("Status: not connected", "Status: connecting…", "Status: connected") ánh xạ 1-1 với ba trạng thái, và nút chỉ có hai nhãn: Connect khi `Disconnected`, Disconnect khi đang `Connecting` hoặc `Connected` (cúp được cả lúc đang đổ chuông).

### A3. Một lời gọi giữ cả cuộc gọi: mô hình `SessionService` chạy thật

Giải thích thêm cho [mục 2](#2-hai-port-moi) (`connect` treo suốt kết nối) và [mục 3](#3-session-service) (`coroutineScope`, `link`, `giveUp`, `finally`).

Ví dụ đời thường: `connect(device)` không phải "gửi lời mời rồi đi làm việc khác". Nó là **cầm ống nghe**: hàm chỉ trả về khi cuộc gọi kết thúc. Ai cầm ống nghe (coroutine nào gọi `connect`) thì người đó quyết định cuộc gọi dài bao lâu: người đó rời đi (bị huỷ) là cuộc gọi bị cúp.

So với TypeScript, gần nhất là một hàm `async` chỉ resolve khi kết nối đóng, kèm một `AbortSignal`:

```ts
// TS tương tự (minh hoạ, không chạy trong khoá): promise chỉ resolve khi cúp máy
const ac = new AbortController();
const call = session.connect(device, ac.signal); // treo suốt cuộc gọi
ac.abort();                                       // ~ huỷ coroutine: cúp máy
```

Khác ở chỗ Kotlin không cần truyền `signal` bằng tay: huỷ coroutine tự lan xuống `collect`, xuống `callbackFlow`, và chạy `awaitClose`.

Chương trình dưới đây là **mô hình** của `SessionService`: cùng khung (`coroutineScope`, `link`, `giveUp`, `finally`), nhưng radio là một `callbackFlow` giả, và đồng hồ là thời gian ảo của `runTest` (như test của bài), nên 10 giây trôi qua tức thì và output luôn giống nhau. Nó bỏ bước kiểm tra quyền cho gọn.

```kotlin
// Mô hình SessionService của bài 14 (không phải code app): radio giả, thời gian ảo của runTest.
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*
import kotlin.time.Duration.Companion.seconds

data class Device(val name: String) {
    override fun toString() = name
}

sealed interface ConnectionState {
    data object Disconnected : ConnectionState
    data class Connecting(val device: Device) : ConnectionState
    data class Connected(val device: Device) : ConnectionState
}

class ConnectionException(message: String) : Exception(message)

// Radio giả: trả lời sau answerMs, hoặc báo lỗi sau failMs. awaitClose = chỗ adapter thật đóng GATT.
class ModelRadio(
    private val log: (String) -> Unit,
    private val answerMs: Long? = null,
    private val failMs: Long? = null,
) {
    fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
        log("radio: connectGatt(${device.name})")
        send(ConnectionState.Connecting(device))
        launch {
            if (failMs != null) {
                delay(failMs)
                log("radio: onConnectionStateChange(status=133, newState=0)")
                close(ConnectionException("The connection failed (Android status 133)."))
            } else if (answerMs != null) {
                delay(answerMs)
                log("radio: onConnectionStateChange(status=0, newState=2)")
                trySend(ConnectionState.Connected(device))
            }
        }
        awaitClose { log("radio: awaitClose -> gatt.disconnect(); gatt.close()") }
    }
}

// Cùng khung với SessionService của bài: kiểm tra, Connecting, coroutineScope + link + giveUp, finally.
class ModelSession(private val radio: ModelRadio, private val log: (String) -> Unit) {
    private val state = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = state.asStateFlow()
    private var link: Job? = null

    private fun set(s: ConnectionState) { state.value = s; log("state = $s") }

    suspend fun connect(device: Device) {
        if (state.value != ConnectionState.Disconnected) {
            throw ConnectionException("Another connection is open. Disconnect it first.")
        }
        set(ConnectionState.Connecting(device))
        try {
            coroutineScope {
                link = launch {
                    val giveUp = launch {
                        delay(10.seconds)
                        throw ConnectionException("${device.name} didn't answer within 10 seconds.")
                    }
                    radio.connect(device).collect { s ->
                        if (s != state.value) set(s)
                        if (s is ConnectionState.Connected) giveUp.cancel()
                    }
                }
            }
        } finally {
            link = null
            set(ConnectionState.Disconnected)
        }
    }

    fun disconnect() { link?.cancel() }
}

fun scenario(title: String, body: suspend TestScope.(log: (String) -> Unit) -> Unit) {
    println("== $title")
    runTest {
        val log: (String) -> Unit = { msg -> println("[t=%5.1fs] %s".format(currentTime / 1000.0, msg)) }
        body(log)
    }
    println()
}

// Ai gọi connect thì bắt lỗi giống DeviceDetailViewModel: chỉ ConnectionException.
suspend fun caller(session: ModelSession, device: Device, log: (String) -> Unit) {
    try {
        session.connect(device)
        log("connect() returned normally")
    } catch (e: ConnectionException) {
        log("ConnectionException: ${e.message}")
    } catch (e: CancellationException) {
        log("connect() cancelled (CancellationException goes on up)")
        throw e
    }
}

val obd = Device("OBD-II Adapter")
val scale = Device("Smart Scale")

fun main() {
    scenario("1. answer after 1.2 s, user taps Disconnect at 5 s") { log ->
        val session = ModelSession(ModelRadio(log, answerMs = 1200), log)
        launch { caller(session, obd, log) }
        delay(5000); log("user: Disconnect"); session.disconnect()
    }
    scenario("2. Smart Scale never answers") { log ->
        val session = ModelSession(ModelRadio(log), log)
        caller(session, scale, log)
    }
    scenario("3. the radio fails before the link is up") { log ->
        val session = ModelSession(ModelRadio(log, failMs = 500), log)
        caller(session, obd, log)
    }
    scenario("4. connected, then the ViewModel is cleared (Back) at 3 s") { log ->
        val session = ModelSession(ModelRadio(log, answerMs = 1000), log)
        val viewModelScope = CoroutineScope(coroutineContext + Job())
        viewModelScope.launch { caller(session, obd, log) }
        delay(3000); log("user: Back -> viewModelScope.cancel()"); viewModelScope.cancel()
        delay(1)
    }
    scenario("5. a second connect while the first is open") { log ->
        val session = ModelSession(ModelRadio(log, answerMs = 1000), log)
        val first = launch { caller(session, obd, log) }
        delay(2000); caller(session, scale, log)
        first.cancelAndJoin()
    }
    scenario("6. connected: 60 s later the timeout has not fired") { log ->
        val session = ModelSession(ModelRadio(log, answerMs = 1000), log)
        val call = launch { caller(session, obd, log) }
        delay(60_000); log("still ${session.connectionState.value}")
        call.cancelAndJoin()
    }
}
```

```text
== 1. answer after 1.2 s, user taps Disconnect at 5 s
[t=  0.0s] state = Connecting(device=OBD-II Adapter)
[t=  0.0s] radio: connectGatt(OBD-II Adapter)
[t=  1.2s] radio: onConnectionStateChange(status=0, newState=2)
[t=  1.2s] state = Connected(device=OBD-II Adapter)
[t=  5.0s] user: Disconnect
[t=  5.0s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t=  5.0s] state = Disconnected
[t=  5.0s] connect() returned normally

== 2. Smart Scale never answers
[t=  0.0s] state = Connecting(device=Smart Scale)
[t=  0.0s] radio: connectGatt(Smart Scale)
[t= 10.0s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t= 10.0s] state = Disconnected
[t= 10.0s] ConnectionException: Smart Scale didn't answer within 10 seconds.

== 3. the radio fails before the link is up
[t=  0.0s] state = Connecting(device=OBD-II Adapter)
[t=  0.0s] radio: connectGatt(OBD-II Adapter)
[t=  0.5s] radio: onConnectionStateChange(status=133, newState=0)
[t=  0.5s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t=  0.5s] state = Disconnected
[t=  0.5s] ConnectionException: The connection failed (Android status 133).

== 4. connected, then the ViewModel is cleared (Back) at 3 s
[t=  0.0s] state = Connecting(device=OBD-II Adapter)
[t=  0.0s] radio: connectGatt(OBD-II Adapter)
[t=  1.0s] radio: onConnectionStateChange(status=0, newState=2)
[t=  1.0s] state = Connected(device=OBD-II Adapter)
[t=  3.0s] user: Back -> viewModelScope.cancel()
[t=  3.0s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t=  3.0s] state = Disconnected
[t=  3.0s] connect() cancelled (CancellationException goes on up)

== 5. a second connect while the first is open
[t=  0.0s] state = Connecting(device=OBD-II Adapter)
[t=  0.0s] radio: connectGatt(OBD-II Adapter)
[t=  1.0s] radio: onConnectionStateChange(status=0, newState=2)
[t=  1.0s] state = Connected(device=OBD-II Adapter)
[t=  2.0s] ConnectionException: Another connection is open. Disconnect it first.
[t=  2.0s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t=  2.0s] state = Disconnected
[t=  2.0s] connect() cancelled (CancellationException goes on up)

== 6. connected: 60 s later the timeout has not fired
[t=  0.0s] state = Connecting(device=OBD-II Adapter)
[t=  0.0s] radio: connectGatt(OBD-II Adapter)
[t=  1.0s] radio: onConnectionStateChange(status=0, newState=2)
[t=  1.0s] state = Connected(device=OBD-II Adapter)
[t= 60.0s] still Connected(device=OBD-II Adapter)
[t= 60.0s] radio: awaitClose -> gatt.disconnect(); gatt.close()
[t= 60.0s] state = Disconnected
[t= 60.0s] connect() cancelled (CancellationException goes on up)
```

Đọc output:

- **Kịch bản 1** (Disconnect): `connect()` **trả về bình thường**. `disconnect()` huỷ `link`, một con bị huỷ không làm hỏng `coroutineScope` (walkthrough 1, mục 3). `awaitClose` chạy trước, rồi `finally` đặt `Disconnected`.
- **Kịch bản 2** (Smart Scale): đúng ở `t = 10.0s`, `giveUp` ném lỗi, lỗi làm hỏng scope, `link` bị huỷ, `awaitClose` đóng radio, rồi bên gọi nhận `ConnectionException`. Đây là thứ test `givesUpOnADeviceThatDoesNotAnswer` kiểm bằng `currentTime`.
- **Kịch bản 3**: radio báo lỗi trước khi lên. `close(ConnectionException(…))` trong `callbackFlow` làm `collect` ném lỗi, cùng một đường với kịch bản 2.
- **Kịch bản 4** (Back): huỷ "viewModelScope" thì `connect()` kết thúc bằng `CancellationException`, **không** phải `ConnectionException`, nên không có alert. Đây là lý do `DeviceDetailViewModel` chỉ bắt `ConnectionException` (walkthrough 3, mục 6).
- **Kịch bản 5**: lần `connect` thứ hai bị từ chối ngay, radio không bị chạm (không có dòng `connectGatt` thứ hai). Hai dòng cuối là bước dọn dẹp của chính chương trình (huỷ lần gọi đầu).
- **Kịch bản 6**: sau 60 s ảo vẫn `Connected`: `giveUp.cancel()` đã chạy khi liên kết lên. Hạn 10 s là cho việc *kết nối*, không phải cho việc *đang nối*.
- Dòng `state = Connecting` in **trước** `connectGatt`: service đặt `Connecting` trước lần treo đầu tiên (walkthrough 4, mục 3), nên một `connect` thứ hai ngay sau đó đã thấy nó.

Kịch bản "đang nối thì rớt" cố ý không có ở đây: đó là test mà bài tự làm 2 nhờ bạn tự viết.

### A4. Callback của radio nói gì: Android cạnh iOS

Giải thích thêm cho [mục 4](#4-lien-ket-android-connectgatt) và [mục 5](#5-lien-ket-ios-bang-swift).

Ví dụ đời thường: radio là **tổng đài**. Tổng đài Android gửi mọi tin qua *một* cửa sổ (`onConnectionStateChange`) với hai con số; bạn phải tự đọc hai số đó. Tổng đài iOS có *ba* cửa sổ riêng (`didConnect`, `didFailToConnect`, `didDisconnectPeripheral`), và cửa sổ thứ ba có kèm hoặc không kèm "biên bản lỗi". Adapter là người trực tổng đài, dịch mọi tin thành ba chữ của app.

| Chuyện xảy ra | Android: `onConnectionStateChange(status, newState)` | iOS: delegate | Adapter dịch thành |
|---|---|---|---|
| liên kết lên | `status = 0` (`GATT_SUCCESS`), `newState = 2` (`STATE_CONNECTED`) | `didConnect` | `Connected(device)` |
| thử nối thất bại | còn lại, khi `linked == false` (vd. `status = 133`) | `didFailToConnect` | lỗi "The connection failed …" |
| đang nối thì rớt | còn lại, khi `linked == true` (vd. `status = 8`) | `didDisconnectPeripheral` có `error` | lỗi "The link to … was lost …" |
| app tự cúp | (flow đã kết thúc trong `awaitClose`; callback muộn không còn ai nghe) | `didDisconnectPeripheral` với `error == nil` | không làm gì |
| callback muộn về peripheral cũ | không áp dụng | `peripheral !== self.peripheral` | không làm gì |
| Bluetooth tắt khi đang nối | (callback rớt, `status` tuỳ máy, chưa kiểm chứng) | `centralManagerDidUpdateState`, state dưới `.poweredOn` | lỗi "Bluetooth was turned off." (iOS) |
| không ai trả lời | API 30 của bài: `status=133` sau ~30 s | không bao giờ (Apple: "never time out") | `giveUp` của service, sau 10 s |

Ý nghĩa của vài `status` hay gặp, theo bảng mã lỗi của chuẩn Bluetooth và mã nguồn stack Bluetooth của Android (chưa kiểm chứng trên máy thật trong khoá): `8` = connection timeout (thiết bị im lặng quá lâu: tắt nguồn hay ra khỏi tầm sóng), `19` = đầu kia chủ động ngắt, `22` = chính máy này ngắt, `133` (`0x85`) = `GATT_ERROR`, lỗi chung chung, hay gặp khi lần thử kết nối không tới được thiết bị. Bài chỉ dựa vào `0` và `STATE_CONNECTED`; mọi số khác chỉ được ghi vào thông báo.

Ba điều dễ trượt:

1. **Android: một cửa sổ cho mọi tin**, nên `linked` là thứ phân biệt "chưa từng lên" với "đang lên thì rớt". Kể cả `status = 0` mà `newState = 0` cũng rơi vào nhánh lỗi khi `linked` là true: với app, mất liên kết mà không do nó xin là rớt.
2. **Android: callback chạy trên background thread.** `trySend` và `close` của `callbackFlow` an toàn từ mọi thread, nên adapter không cần chuyển thread (walkthrough 3, mục 4).
3. **iOS: `error == nil` nghĩa là "chính mình cúp".** Apple chỉ điền `error` khi việc ngắt *không* do `cancelPeripheralConnection`. Adapter dựa vào đó để không báo lỗi cho một lần Disconnect bình thường.

Thử phân loại từng callback trong [trò thứ 3 của A7](#3-callback-nay-nghia-la-gi).

### A5. Cái bẫy vòng đời: ai được cầm ống nghe

Giải thích thêm cho [mục 7](#7-cai-bay-ket-noi-uoc-giu-trong-mot-thu-se-bien-mat) và hai gotcha của nó.

Ví dụ đời thường: bạn gọi điện từ **máy bàn trong phòng khách sạn**. Giữa cuộc gọi, khách sạn đổi bạn sang phòng khác (xoay màn hình: Activity cũ bị huỷ, Activity mới thế chỗ). Ống nghe ở phòng cũ vẫn đang mở, đường dây vẫn bận, và phòng mới không có cách nào cúp nó. Gọi lại từ phòng mới thì thành hai đường dây cùng bận. Đó chính là bảng logcat ở mục 7: client 6 không bao giờ được đóng, client 7 được mở thêm, và 30 s sau cả hai báo `status=133`.

Cách sửa của bài: **cuộc gọi không thuộc về căn phòng**. Tổng đài (adapter, Koin single) giữ đường dây; người quản lý phòng (ViewModel) sống qua việc đổi phòng và quyết định khi nào cúp; căn phòng (màn hình) chỉ hiển thị.

| Giữ kết nối ở đâu | Xoay (Android) | Back (rời hẳn) | Đánh giá |
|---|---|---|---|
| `BluetoothGatt` trong `remember` (state của Activity) | mất tham chiếu; liên kết vẫn mở, client vẫn đăng ký | vẫn không ai đóng | bẫy (mục 7) |
| `session.connect` trong `rememberCoroutineScope()` | scope bị huỷ: **app tự cúp** | cúp | quá ngắn (gotcha đầu của mục 7) |
| `session.connect` trong `viewModelScope` | **vẫn nối** | cúp, `awaitClose` đóng radio | cách của bài |

Trên iOS không có chuyện xoay huỷ màn hình, nhưng có hai cái bẫy riêng (gotcha thứ hai của mục 7): peripheral không được giữ (xem [A6](#a6-ios-vi-sao-phai-giu-peripheral-chay-that-bang-swift)), và cúp máy trong `onDisappear` / `viewDidDisappear`, thứ cũng chạy khi chỉ có một màn hình khác được push lên trên. Biến thể XML của bẫy scope (`viewLifecycleOwner.lifecycleScope`) là việc của bài tự làm 3, nên không có trong bảng.

So với web: giống một component React mở `WebSocket` trong `useRef` mà quên hàm dọn dẹp của `useEffect`. Unmount component thì socket vẫn mở và không ai đóng được. Cách sửa trên web cũng giống ở đây: đưa socket vào một service/store sống lâu hơn component, và để "người sở hữu" đóng nó.

Áp vào app (cũng là đường đi mà phần "Hỏi agent" ở mục 10 nhờ agent lần theo trên code thật), với Android:

1. Back → Fragment hoặc entry `composable` rời back stack → `ViewModelStore` của nó bị clear.
2. `DeviceDetailViewModel` bị clear → `viewModelScope` bị huỷ → `connectJob` bị huỷ.
3. `session.connect` nhận `CancellationException` → `link` bị huỷ → `collect` trên `Flow` của adapter dừng.
4. `awaitClose { gatt.disconnect(); gatt.close() }` chạy → logcat: `cancelOpen()`, `close()`, `unregisterApp()`.
5. `finally` của service → `Disconnected`.

Trên iOS, bước 1 là màn hình rời navigation stack → `ViewModelOwner` bị deinit → `store.clear()`; bước 4 là `awaitClose { link.close() }` → `cancelPeripheralConnection`.

### A6. iOS: vì sao phải giữ peripheral, chạy thật bằng Swift

Giải thích thêm cho walkthrough 2 ở đoạn trích thứ hai của [mục 5](#5-lien-ket-ios-bang-swift) và gotcha "view bị dỡ trên iOS" ở [mục 7](#7-cai-bay-ket-noi-uoc-giu-trong-mot-thu-se-bien-mat).

Ví dụ đời thường: `manager.connect(found)` giống **nhờ tổng đài nối máy tới một số trên tờ giấy nhớ**. Tổng đài không giữ tờ giấy; nó chỉ nhìn vào tờ giấy *của bạn*. Bạn vứt tờ giấy (biến cục bộ hết phạm vi) thì tổng đài huỷ lệnh nối. CoreBluetooth nói đúng như vậy: "Các lần thử đang chờ bị huỷ tự động khi *peripheral* bị giải phóng".

Swift dùng ARC (đếm tham chiếu): một object sống khi còn ít nhất một tham chiếu **mạnh**. Chương trình dưới đây là **mô hình** (không dùng CoreBluetooth): `Manager` chỉ giữ peripheral bằng tham chiếu `weak`, và `deinit` của peripheral đóng vai "huỷ lần thử đang chờ".

```swift
// Mô hình (không phải CoreBluetooth): manager chỉ giữ peripheral YẾU, như CBCentralManager.
// "Pending attempts are cancelled automatically upon deallocation of peripheral."
final class Peripheral {
    let name: String
    init(_ name: String) { self.name = name }
    deinit { print("  deinit \(name) -> pending connection cancelled") }
}

final class Manager {
    weak var pending: Peripheral?
    func connect(_ p: Peripheral) { pending = p; print("  manager.connect(\(p.name))") }
    func radioTick() {
        if let p = pending { print("  radio: still trying \(p.name)") }
        else { print("  radio: nothing left to connect to") }
    }
}

final class LocalOnlyAdapter {
    func start(on manager: Manager) {
        let found = Peripheral("OBD-II Adapter")   // only a local constant
        manager.connect(found)
    }                                              // start returns: found is released here
}

final class RetainingAdapter {
    private var peripheral: Peripheral?
    func start(on manager: Manager) {
        let found = Peripheral("OBD-II Adapter")
        peripheral = found                         // like `peripheral = found` in IosBleConnection
        manager.connect(found)
    }
    func close() { peripheral = nil }
}

print("A. local constant only")
let m1 = Manager()
LocalOnlyAdapter().start(on: m1)
m1.radioTick()

print("B. kept in a property")
let m2 = Manager()
let adapter = RetainingAdapter()
adapter.start(on: m2)
m2.radioTick()
print("  close()")
adapter.close()
m2.radioTick()
```

```text
A. local constant only
  manager.connect(OBD-II Adapter)
  deinit OBD-II Adapter -> pending connection cancelled
  radio: nothing left to connect to
B. kept in a property
  manager.connect(OBD-II Adapter)
  radio: still trying OBD-II Adapter
  close()
  deinit OBD-II Adapter -> pending connection cancelled
  radio: nothing left to connect to
```

- **A**: `found` chỉ là hằng cục bộ. `start` vừa trả về là `deinit` chạy, lần thử bị huỷ, và radio không còn gì để nối. Trên iPhone thật, suy ra từ code (chưa kiểm chứng), màn hình sẽ đứng ở "connecting…" tới khi `giveUp` của service hết 10 s, không có callback nào giải thích.
- **B**: `peripheral = found` giữ một tham chiếu mạnh, lần thử sống tới khi `close()` đặt `peripheral = nil`. Đây chính là dòng `peripheral = found` (dòng được tô trong đoạn trích thứ hai của mục 5).
- Cùng lý do, peripheral không được nằm trong một view SwiftUI hay một view controller: view đi là peripheral đi. Nó nằm trong `IosBleConnection`, mà Koin giữ suốt đời app.

So với TS/JS: JS có garbage collector chứ không đếm tham chiếu, và gần như không bao giờ chạy "dọn dẹp" ngay khi biến hết phạm vi. Ở Swift thì có: `deinit` chạy đúng lúc tham chiếu mạnh cuối cùng mất, nên "quên giữ" là hỏng ngay, không phải "thỉnh thoảng".

### A7. Phòng thí nghiệm: gọi, cúp máy, rớt sóng

Ba mô phỏng bấm được. Chúng là mô hình dựng theo bài, không phải radio hay app thật. Thời gian được tua nhanh: 1 giây trong mô phỏng là khoảng 0,3 giây thật. Chuỗi thông báo lấy từ code của bài; chữ lỗi của iOS (phần sau dấu hai chấm) và mã `status` khi rớt chỉ để minh hoạ, chưa kiểm chứng trên máy thật.

#### 1. Bảng điều khiển kết nối

Chọn thiết bị, bấm Connect, rồi thử: Disconnect, tắt thiết bị, đi xa (RSSI tụt), tắt Bluetooth, Back, hay để Smart Scale chờ hết 10 s. Ba trạng thái sáng lên theo state của `SessionService`, và hai làn log cho thấy callback Android và delegate iOS nào chạy cho cùng một chuyện ([A2](#a2-ba-trang-thai-nhu-mot-cuoc-goi-ien-thoai), [A4](#a4-callback-cua-radio-noi-gi-android-canh-ios)).

<div class="lab" id="l14-call"></div>

!!! tip "Điều cần thấy ở mô phỏng 1"
    Disconnect và Back đều về `Disconnected` **không có alert**; tắt thiết bị, đi xa, tắt Bluetooth và hết 10 s đều về `Disconnected` **có alert**. Ở mọi đường, dòng `awaitClose` hiện ra: radio luôn được đóng. Smart Scale: Android và iOS đều im lặng, chỉ `giveUp` của service kết thúc lần thử.

#### 2. Giữ kết nối ở đâu?

Chọn chỗ giữ kết nối, bấm Connect, chờ "connected", rồi Xoay vài lần và Back. Đếm số GATT client còn đăng ký với Android ([A5](#a5-cai-bay-vong-oi-ai-uoc-cam-ong-nghe)).

<div class="lab" id="l14-lifetime"></div>

!!! tip "Điều cần thấy ở mô phỏng 2"
    Chế độ `remember`: mỗi lần xoay rồi Connect lại sinh thêm một client không ai đóng được. `rememberCoroutineScope`: xoay là tự cúp. `viewModelScope`: xoay bao nhiêu lần vẫn một client, vẫn connected; chỉ Back mới đóng nó, và đóng ngay.

#### 3. Callback này nghĩa là gì?

Mỗi câu là một callback mà radio gọi vào adapter. Chọn adapter sẽ dịch nó thành gì ([A4](#a4-callback-cua-radio-noi-gi-android-canh-ios)).

<div class="lab" id="l14-callbacks"></div>

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 15.

- [ ] Nói được ba trạng thái của `ConnectionState`, và vì sao không có trạng thái disconnecting hay failed (xem [A2](#a2-ba-trang-thai-nhu-mot-cuoc-goi-ien-thoai)).
- [ ] Phân biệt inbound port `DeviceSession` (ViewModel gọi) với outbound port `BleConnection` (radio implement), và chỉ được mỗi ô của sơ đồ "ai nói chuyện với ai" trong code.
- [ ] Giải thích vì sao `connect` treo suốt kết nối, và ba lối ra của nó: trả về, `CancellationException`, `ConnectionException` (xem [A3](#a3-mot-loi-goi-giu-ca-cuoc-goi-mo-hinh-sessionservice-chay-that)).
- [ ] Đọc `SessionService` và nói cái gì xảy ra khi `link` bị huỷ so với khi `giveUp` ném lỗi trong `coroutineScope` (xem [A3](#a3-mot-loi-goi-giu-ca-cuoc-goi-mo-hinh-sessionservice-chay-that)).
- [ ] Nói vì sao hạn 10 s nằm trong service chứ không trong adapter iOS hay ViewModel.
- [ ] Đọc một lần gọi `onConnectionStateChange(status, newState)` hoặc một delegate call của iOS và biết adapter dịch nó thành gì (thử [Callback này nghĩa là gì?](#3-callback-nay-nghia-la-gi)).
- [ ] Viết một `callbackFlow` có `awaitClose` đóng tài nguyên trên mọi lối ra (Disconnect, huỷ, hết hạn, lỗi) (thử [Bảng điều khiển kết nối](#1-bang-ieu-khien-ket-noi)).
- [ ] Giải thích cái bẫy `BluetoothGatt` giữ trong Activity, và vì sao `rememberCoroutineScope` cũng quá ngắn (xem [A5](#a5-cai-bay-vong-oi-ai-uoc-cam-ong-nghe), thử [Giữ kết nối ở đâu?](#2-giu-ket-noi-o-au)).
- [ ] Giải thích vì sao `IosBleConnection` giữ `CBPeripheral` trong property, và vì sao không cúp máy trong `onDisappear` / `viewDidDisappear` (xem [A6](#a6-ios-vi-sao-phai-giu-peripheral-chay-that-bang-swift)).
- [ ] Đưa `Device` từ danh sách sang màn hình chi tiết trên track của mình (route `@Serializable`, `Bundle`, `DeviceRoute` hoặc hàm khởi tạo controller).
- [ ] Tự lần theo một lần Back khi đang kết nối xuống tới `gatt.close()` / `cancelPeripheralConnection` (xem [A5](#a5-cai-bay-vong-oi-ai-uoc-cam-ong-nghe)).
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.

