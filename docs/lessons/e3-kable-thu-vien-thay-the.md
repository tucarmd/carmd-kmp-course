---
source: lessons/e3-kable-library-alternative.html
source_ref: live
source_sha: e67a374
---

<p class="kicker">Phần mở rộng E3 · tuỳ chọn, sau các bài lõi · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/e3-kable-library-alternative.html">Bản gốc tiếng Anh</a></p>

# Kable: phương án dùng thư viện

<div class="meta">
  <span class="tag">~2 giờ · không tốn thêm giờ cho mỗi track UI</span>
  <span class="tag">Milestone: e3 stack BLE chuyển được giữa tự viết và Kable</span>
  <span class="tag">Cần trước: <a href="../20-tich-hop-va-kiem-tra-cuoi/">20</a> (m15)</span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Bài 13–16 viết code Bluetooth LE bằng tay, mỗi nền tảng một lần: một object callback biến thành `Flow` trên Android, một delegate Swift kèm một nửa Kotlin trên iOS. Đó là cách tốt nhất để hiểu radio làm gì, và các app của team vẫn chứa code kiểu đó. Nhưng một project thật cũng có thể dùng thư viện. **Kable** là một thư viện BLE Kotlin Multiplatform: một API coroutine phủ trên `BluetoothGatt` của Android và CoreBluetooth của Apple. Phần mở rộng này viết một cặp adapter thứ hai dựa trên Kable, sau *cùng* các outbound port `BleScanner` và `BleConnection`, và chuyển cả app sang chúng bằng một dòng Koin. Không gì trong app core, các ViewModel hay các màn hình đổi. Rồi nó so sánh hai stack theo những gì bạn thật sự cân nhắc: số dòng code, trạng thái kết nối, lỗi và hành vi trên iOS, đo ở chỗ đo được. Điều đó cho milestone **e3**: một stack BLE bạn chuyển được giữa tự viết và Kable.

!!! info "Nguồn chính"
    [README](https://github.com/JuulLabs/kable) của Kable (quét, kết nối, quan sát, hỗ trợ nền và quyền Android) trước mục 2, và [API docs](https://juullabs.github.io/kable/) của nó cho `Peripheral` và `Scanner` trước mục 3–5. [Release notes](https://github.com/JuulLabs/kable/releases) của Kable cho 0.44.0 (mục 3). Trang [Modules](https://insert-koin.io/docs/reference/koin-core/modules) của Koin, phần "Load order and overrides", trước mục 6.

!!! info "Track"
    Mọi file phần mở rộng này động tới đều nằm trong module dùng chung, nên giống nhau trên Compose, XML Views, SwiftUI và UIKit, và không màn hình nào đổi. Các track chỉ khác ở cách bạn chạy các kiểm tra. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

!!! info "Đã làm E1 hay E2 trước?"
    Mọi phần mở rộng bắt đầu từ m15, và các file đầy đủ ở đây là m15 cộng E3. Nếu project của bạn đã có e1 hay e2, ba file có dòng của cả hai phần mở rộng: giữ dòng của chúng và thêm dòng của E3. Các file đó là `shared/build.gradle.kts` (dependency của Kable cạnh của Ktor hay ExifInterface), `di/AppModule.kt` (`kableBleModule` và dòng `initKoin`, cạnh các binding của chúng) và `di/AppModuleTest.kt` (test Kable, cạnh các ViewModel của chúng). Code của trang này được dựng chỉ từ m15, nên hãy kiểm tra các file đã gộp bằng test.

## Thay đổi so với m15

| Cái gì | m15 | e3 |
|---|---|---|
| app core | các outbound port `BleScanner` và `BleConnection` | cùng các port đó; chỉ comment của chúng giờ nhắc thêm các adapter Kable |
| outbound adapter | tự viết: `AndroidBleScanner` và `AndroidBleConnection` (`androidMain`); `IosBleScanner` và `IosBleConnection` (Swift) với `scanFlow` và `LinkedBleConnection` (`iosMain`) | tất cả vẫn còn, thêm `KableBleScanner` và `KableBleConnection` (dùng chung, `commonMain`) với `kableScanner()` và `kablePeripheral()`: mỗi cái một `actual` trong `androidMain` và `iosMain` |
| Koin | `appModule` and `platformModule(…)` | thêm `kableBleModule`, đặt cuối trong `initKoin`: một dòng chọn stack BLE |
| màn hình, ViewModel, service | — | không đổi |
| `shared/build.gradle.kts` | không có thư viện BLE | `com.juul.kable:kable-core:0.45.0` trong `commonMain` |
| test | 105 mỗi nền tảng | 110 mỗi nền tảng: 4 cho các phép dịch của adapter Kable, thêm 1 trong test graph |

## 1. Cùng các port, một stack thứ hai

Bài 10 hứa rằng app core không quan tâm cái gì đứng sau một outbound port. Bài 20 dùng lời hứa đó một lần, để thay radio giả lập vào cho một lần chạy. Phần mở rộng này dùng nó thật: cả một bộ adapter thứ hai cho hai port BLE, viết dựa trên một thư viện thay vì dựa trên các nền tảng.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="le3-stacks-title">
      <title id="le3-stacks-title">Hai stack BLE sau cùng các port. App core chứa ScanningService và SessionService, thứ gọi các outbound port BleScanner và BleConnection. Stack tự viết implement chúng theo từng nền tảng: AndroidBleScanner và AndroidBleConnection trong androidMain, và trên iOS là IosBleScanner và IosBleConnection bằng Swift cùng nửa Kotlin của chúng trong iosMain. Stack Kable implement chúng một lần, trong commonMain: KableBleScanner và KableBleConnection, dựa trên thư viện Kable, với hai hàm expect nhỏ, mỗi cái một actual trong androidMain và iosMain. kableBleModule của Koin, nạp cuối cùng, quyết định các service nhận stack nào.</title>
      <defs><marker id="le3-stacks-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="core">
        <rect class="box" x="230" y="20" width="300" height="86" rx="6"></rect>
        <text class="title" x="244" y="42">App core (không đổi)</text>
        <text class="mono small" x="244" y="64">ScanningService · SessionService</text>
        <text class="small" x="244" y="88">outbound port: BleScanner · BleConnection</text>
      </g>
      <text class="small muted" x="380" y="128" text-anchor="middle">được implement bởi stack này hoặc stack kia</text>
      <path class="edge dashed" d="M300,106 L190,158" marker-start="url(#le3-stacks-arrow)"></path>
      <path class="edge dashed" d="M460,106 L570,158" marker-start="url(#le3-stacks-arrow)"></path>
      <text class="small muted" x="20" y="152">tự viết (bài 13–16)</text>
      <g data-part="android">
        <rect class="box" x="20" y="162" width="160" height="64" rx="6"></rect>
        <text class="title" x="32" y="182">androidMain</text>
        <text class="mono small" x="32" y="200">AndroidBleScanner</text>
        <text class="mono small" x="32" y="216">AndroidBleConnection</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="196" y="162" width="170" height="64" rx="6"></rect>
        <text class="title" x="208" y="182">Swift + iosMain</text>
        <text class="mono small" x="208" y="200">IosBleScanner, scanFlow</text>
        <text class="mono small" x="208" y="216">IosBleConnection, Linked…</text>
      </g>
      <text class="small muted" x="430" y="152">Kable (phần mở rộng này)</text>
      <g data-part="outbound">
        <rect class="box" x="430" y="162" width="310" height="64" rx="6"></rect>
        <text class="title" x="442" y="182">commonMain: một bản cho cả hai</text>
        <text class="mono small" x="442" y="200">KableBleScanner · KableBleConnection</text>
        <text class="small" x="442" y="216">dựa trên com.juul.kable</text>
      </g>
      <g data-part="android">
        <rect class="box" x="430" y="250" width="150" height="44" rx="6"></rect>
        <text class="mono small" x="442" y="277">KablePlatform.android</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="590" y="250" width="150" height="44" rx="6"></rect>
        <text class="mono small" x="602" y="277">KablePlatform.ios</text>
      </g>
      <path class="edge" d="M505,226 L505,248" marker-end="url(#le3-stacks-arrow)"></path>
      <path class="edge" d="M665,226 L665,248" marker-end="url(#le3-stacks-arrow)"></path>
      <text class="small muted" x="430" y="316">expect/actual: kableScanner(), kablePeripheral()</text>
      <text class="small muted" x="20" y="262">Koin: kableBleModule, đặt cuối,</text>
      <text class="small muted" x="20" y="280">thay hai binding của nền tảng.</text>
      <text class="small muted" x="20" y="298">Xoá dòng của nó: stack tự viết.</text>
    </svg>
    <figcaption>Cả hai stack implement cùng hai port. Service nhận stack nào được quyết định ở một chỗ, danh sách module của Koin.
<ul class="legend">
    <li data-part="core">app core</li>
    <li data-part="outbound">outbound adapter (dùng chung)</li>
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

Sao adapter Kable sống được trong `commonMain` trong khi adapter tự viết thì không? Vì code nền tảng đã dời vào thư viện. `commonMain` của Kable khai báo một `Scanner` và một `Peripheral`, và `androidMain` cùng `appleMain` của chính Kable implement chúng dựa trên `BluetoothLeScanner`/`BluetoothGatt` và `CBCentralManager`/`CBPeripheral`. Đó là cùng cách chia expect/actual của bài 05, xuống một tầng, bên trong code của người khác. Adapter của chúng ta dịch giữa kiểu của Kable và kiểu của app: `Device`, `ConnectionState`, `DeviceService`, `ScanException`, `ConnectionException`. Đó là việc mọi outbound adapter đều có; ADR 0001 đặt một adapter dùng chung, như Ktor client của E1, trong `commonMain`.

## 2. Kable trong bản build

Kable tự mô tả là "một API đơn giản chạy bằng Coroutines để tương tác với thiết bị Bluetooth Low Energy". Quét là một `Flow` các advertisement; một `Peripheral` có các hàm `suspend` cho `connect`, `read` và `write`, một `StateFlow` `state`, và `observe`, một `Flow` các notification của một characteristic. Một dependency trong `commonMain`:

```kotlin title="shared/build.gradle.kts" hl_lines="3"
        commonMain.dependencies {
⋯ as in m15
            implementation("com.juul.kable:kable-core:0.45.0")
        }
```

1. **Không kèm quyền nào.** README của Kable: "Kable không khai báo quyền nào; app dùng nó được kỳ vọng tự khai báo các quyền cần thiết." Một artifact riêng, `kable-default-permissions`, sẽ thêm một số; app không dùng nó, vì manifest của nó đã khai báo đúng những gì nó cần từ bài 12. Chúng tôi so manifest Android đã gộp của m15 và e3: cùng các dòng quyền.
2. **Thứ nó có thêm trên Android.** Hai mục trong manifest đã gộp, cả hai dưới `InitializationProvider` của AndroidX Startup: `com.juul.kable.KableInitializer`, và `TuulboxCoroutinesInitializer` từ tuulbox, một thư viện JuulLabs mà Kable dùng. Cái đầu là cách Kable lấy `Context` của application mà code của chúng ta không cần truyền, đó là lý do `KableBleScanner` và `KableBleConnection` không nhận `Context`. Cây dependency của Gradle (`./gradlew :androidApp:dependencies`) cũng cho thấy Kable kéo theo gì trên Android: kotlinx-io, atomicfu, tuulbox, AndroidX Startup, `core-ktx` (thứ bài 20 đã gỡ khỏi build file của chính app) và runtime của parcelize.
3. **0.45.0, ghim cứng.** Kable là 0.x: các bản phát hành vẫn có thay đổi phá vỡ (0.44.0 biến `Bluetooth.availability` thành lỗi compile, mục 3). Ghim version, và đọc release notes trước khi nâng cấp.

## 3. Scanner: một Flow có sẵn

Scanner Android của bài 13 là một `callbackFlow` quanh một `ScanCallback`, cộng một broadcast receiver; cái iOS là một delegate Swift nuôi một `callbackFlow` Kotlin. `Scanner` của Kable đã có một `Flow`, `advertisements`, nên adapter chỉ việc dịch:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleScanner.kt" hl_lines="1 3 9 10 11 18 19"
internal class KableBleScanner(private val bluetooth: BluetoothProvider) : BleScanner {
⋯ why Kable doesn't answer the next two
    override suspend fun isAvailable(): Boolean = bluetooth.isEnabled() != null

    override suspend fun isEnabled(): Boolean = bluetooth.isEnabled() == true

⋯ comments: collecting starts the scan; the name; the identifier
    override fun scan(): Flow<Device> =
        kableScanner().advertisements
            .map { Device(id = "${it.identifier}", name = it.name.orEmpty(), rssi = it.rssi) }
            .catch { failure -> throw ScanException(scanFailure(failure)) }
}

⋯ comment
internal fun scanFailure(failure: Throwable): String = when {
    failure is UnmetRequirementException && failure.reason == UnmetRequirementReason.BluetoothDisabled ->
        "Bluetooth is off. Turn it on, then scan again."
    failure is UnmetRequirementException ->
        "Scanning needs Location turned on on this phone (Android 11 and lower)."
    else -> "The scan failed (Kable: ${failure.message})."
}
```

1. **Collect thì bắt đầu quét, huỷ thì dừng.** Đó là hợp đồng của port từ bài 10, và `advertisements` của Kable đã giữ nó: trên Android nó là một `callbackFlow` mà `awaitClose` gọi `stopScan` (trong mã nguồn Kable), khá giống của chúng ta. Trên emulator, một lần quét hết 10 s và một lần chúng tôi dừng sau 2 s đều hiện là đã dừng trong `adb shell dumpsys bluetooth_manager` ("LE scans (started/stopped): 2 / 2").
2. **Tên là tên được quảng bá.** `Advertisement.name` của Kable là `ScanRecord.getDeviceName` trên Android và `CBAdvertisementDataLocalNameKey` trên Apple, cùng các trường bài 13 đọc. Kable còn có `peripheralName`, tên hệ thống lưu đệm, có thể khác; adapter giữ tên được quảng bá, nên danh sách hiện cùng tên với cả hai stack.
3. **Định danh là chuỗi.** `Identifier` của Kable là một kiểu `expect` mà các `actual` là typealias: một `String` (địa chỉ MAC) trên Android, một `Uuid` trên Apple. Một string template biến cái nào cũng thành `String` mà một `Device` giữ, và `kablePeripheral` biến nó ngược lại (mục 4).
4. **Lỗi bằng lời của app.** `catch` thấy thứ Kable ném khi lần quét bắt đầu hay thất bại: `UnmetRequirementException` kèm một lý do (`BluetoothDisabled`, hoặc `LocationServicesDisabled`, thứ tài liệu Kable nói "chỉ áp dụng trên Android 11 (API 30) trở xuống"), hoặc một `IllegalStateException` (thiếu quyền, lần quét thất bại). `catch` không thấy việc huỷ của chính bên collect, nên Stop và giới hạn 10 s vẫn kết thúc lần quét lặng lẽ.
5. **`isAvailable` và `isEnabled` tới từ port khác.** Kable không còn trả lời chúng: release notes của 0.44.0 nói "Nâng mức deprecate của `Bluetooth.availability`", và "giờ bạn sẽ cần tự duy trì phiên bản của riêng mình trong codebase"; thông báo deprecate nói nó "có hành vi không nhất quán giữa các nền tảng". `Bluetooth.isSupported()` thử nghiệm của Kable "luôn trả `true` trên Apple". App đã có câu trả lời: port `BluetoothProvider` của bài 17, mà `null` của nó nghĩa là "app không biết được: điện thoại không có radio, hoặc (iOS) người dùng chưa cho phép Bluetooth". `ScanningService` kiểm tra quyền trước, nên tới lúc nó hỏi, `null` của một iPhone nghĩa là không có radio. Adapter không giữ quy tắc nào khi hỏi: nó chuyển câu hỏi đi, và Koin truyền vào `BluetoothProvider` nào mà nền tảng đã dựng. Cách kia, `isAvailable` và `isEnabled` riêng của mỗi nền tảng, sẽ đưa code nền tảng trở lại một adapter dùng chung.
6. **`internal`.** Koin dựng cả hai adapter Kable trong code dùng chung (mục 6), nên chúng là `internal`, như adapter Ktor của E1. Header của framework iOS không có class `Kable` nào (`grep -c Kable Shared.h` in ra 0).

Hai thứ code dùng chung không nói được, vì các tuỳ chọn builder của Kable khác nhau theo nền tảng: cách dựng scanner, và cách lấy lại `Peripheral` của một thiết bị từ id của nó. Mỗi cái là một `expect` với một `actual` mỗi nền tảng, là một phần của adapter như `httpEngine()` của E1:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.kt" hl_lines="2 4"
⋯ package, imports, comment
internal expect fun kableScanner(): PlatformScanner

internal expect fun kablePeripheral(device: Device): Peripheral
```

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.android.kt" hl_lines="4 8"
⋯ package, imports, comment
@OptIn(ObsoleteKableApi::class)
internal actual fun kableScanner(): PlatformScanner = Scanner {
    scanSettings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
}

⋯ comment
internal actual fun kablePeripheral(device: Device): Peripheral = Peripheral(device.id)
```

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.ios.kt" hl_lines="2 7 13"
⋯ package, imports, comment: the power alert
private val managerSetUp = lazy { CentralManager.configure { } }

⋯ comment: duplicate filtering
internal actual fun kableScanner(): PlatformScanner {
    managerSetUp.value
    return Scanner { allowDuplicateKeys = false }
}

⋯ comment
internal actual fun kablePeripheral(device: Device): Peripheral {
    managerSetUp.value
    return Peripheral(device.id.toIdentifier())
}
```

1. **Mặc định của Kable không phải của bài 13.** Trên Android, `scanSettings` của Kable mặc định là `ScanSettings.Builder().build()`. Chúng tôi dựng một bản sao với `Scanner()` trơn và quét trên emulator API 36: `dumpsys bluetooth_manager` hiện `ScanMode=LOW_POWER`; với dòng ở trên, `ScanMode=LOW_LATENCY`, như `AndroidBleScanner` xin. Kable đánh dấu `scanSettings` là `@ObsoleteKableApi`: KDoc của nó nói nó "sẽ được thay bằng một DSL do Kable cung cấp", nên phải opt-in.
2. **Trên iOS, Kable báo mọi advertisement trừ khi được bảo không.** `allowDuplicateKeys` của nó mặc định là `true`. Mặc định của chính CoreBluetooth là `false`: central "gộp nhiều lần phát hiện cùng một peripheral thành một sự kiện phát hiện", và Apple cảnh báo tắt điều đó "có thể ảnh hưởng xấu tới thời lượng pin; chỉ dùng khi cần". `IosBleScanner` giữ mặc định của Apple, nên cái này cũng vậy. Port cho phép cả hai (bài 13: "cùng một thiết bị có thể tới lần nữa"), và dù sao `ScanningService` cũng báo mỗi thiết bị một lần.
3. **Một `CBCentralManager`, cấu hình trước lần dùng đầu.** Kable tạo một manager cho cả app, ở lần dùng đầu (một lần quét, hoặc tạo một `Peripheral`), trên một dispatch queue riêng của nó. Không có `configure`, nó không truyền tuỳ chọn nào, và mặc định của Apple cho `CBCentralManagerOptionShowPowerAlertKey` là `true`: "Nếu khoá không được chỉ định, giá trị mặc định là true", nên iOS sẽ hiện alert riêng nếu Bluetooth đang tắt khi manager được tạo. Bất kỳ lời gọi `configure` nào cũng làm Kable truyền `false` (trong mã nguồn Kable), nên app vẫn hiện thông báo của riêng nó, như các adapter tự viết. README của Kable: "cố `configure` nó sau khi đã khởi tạo sẽ gây ra một `IllegalStateException`". `lazy` chạy nó một lần, trước scanner hay peripheral đầu tiên. Trong app này, `ScanningService` kiểm tra Bluetooth có bật không trước lần quét đầu, nên manager của Kable thường được tạo khi Bluetooth đang bật; `configure` đảm bảo alert không hiện được dù thế nào.
4. **Từ một id trở lại một `Peripheral`.** Trên Android, `Peripheral(identifier)` gọi `getRemoteDevice` với địa chỉ, như `AndroidBleConnection` làm. Trên iOS, nó nhờ manager của Kable lấy peripheral theo UUID, như `IosBleConnection` nhờ manager riêng của nó, và tài liệu Kable nói nó ném `NoSuchElementException` nếu iOS không biết nó: "sẽ cần một lần quét". Adapter kết nối biến điều đó thành "Scan again".

## 4. Kết nối: treo, đừng gọi lại

Các adapter kết nối của bài 14–16 có nhiều bộ máy nhất: một `callbackFlow` cho liên kết, một `CompletableDeferred` cho câu trả lời của mỗi request, một delegate phải được giữ sống. `Peripheral` của Kable làm tất cả bên trong: `connect()`, `read()` và phần còn lại là các hàm `suspend` trả về câu trả lời hoặc ném lỗi. Nên `connect` là một `flow { }` trơn:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleConnection.kt" hl_lines="9 11 12 17 18"
    override fun connect(device: Device): Flow<ConnectionState> = flow {
        val peripheral = try {
            kablePeripheral(device)
        } catch (e: Exception) {
            throw ConnectionException("Kable couldn't find ${device.name} (${e.message}). Scan again.")
        }
        try {
            emit(ConnectionState.Connecting(device))
            val scope = kable("The connection failed") { peripheral.connect() }
            link = Link(peripheral, scope)
            emit(ConnectionState.Connected(device))
            val ended = peripheral.state.first { it is State.Disconnected } as State.Disconnected
            val reason = ended.status?.toString() ?: "no reason given"
            throw ConnectionException("The link to ${device.name} was lost (Kable: $reason).")
        } finally {
            link = null
            withContext(NonCancellable) { peripheral.disconnect() }
            peripheral.close()
        }
    }
```

1. **`connect()` trả về khi liên kết sẵn sàng, kể cả khám phá.** README của Kable: "Một kết nối được coi là sẵn sàng khi đã kết nối, các service đã được khám phá, và các observation (nếu có) đã được nối lại. *Khám phá service diễn ra tự động khi kết nối.*" Nên adapter này phát `Connected` muộn hơn các adapter tự viết, thứ phát nó ngay khi liên kết lên và khám phá service như một request riêng. Các màn hình hiện cùng các state, nhưng "connecting…" giờ kéo dài tới khi khám phá xong, và giới hạn 10 giây của `SessionService` (bài 14) giờ bao cả khám phá.
2. **Đời của flow là đời của liên kết.** Sau `Connected`, flow treo trên `state` của Kable cho tới khi nó là `Disconnected`: một lần rớt. Điều đó thành `ConnectionException` của port, thứ `SessionService` báo, như ở bài 16. Một lần bấm Disconnect không tới được đó: nó huỷ bên collect, nên `first` bị huỷ và chỉ `finally` chạy.
3. **Mọi lối ra đều giải phóng radio.** `finally` gọi `disconnect()`, thứ cũng "huỷ một lần thử kết nối đang diễn ra", rồi `close()`: `Peripheral` của Kable "nên được giải phóng (bằng `close`) khi không còn cần". `disconnect()` treo, và `finally` này thường chạy vì bên collect đã bị huỷ, nên nó chạy dưới `NonCancellable`, như việc huỷ đăng ký của `SessionService` ở bài 16. Trên emulator API 30, một lần thử hết giờ kết thúc với `BluetoothGatt: cancelOpen()`, rồi `close()` và `unregisterApp()` trong logcat.
4. **`disconnect()` chờ radio.** Nó "treo cho tới khi peripheral ổn định ở trạng thái đã ngắt kết nối", tối đa `disconnectTimeout` của peripheral, mặc định 5 giây (trong mã nguồn Kable, Android và Apple như nhau). Một lần thử đang chờ bị huỷ không bao giờ báo ngắt kết nối trên Android, nên ở đó nó chờ đủ 5 s. Mục 8 đo việc đó làm gì với màn hình.
5. **Liên kết giữ scope.** `connect()` trả về một `CoroutineScope` mà Kable huỷ khi ngắt kết nối. Adapter giữ nó cùng peripheral trong `Link`, cho các lần đăng ký (mục 5).

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleConnection.kt" hl_lines="3 10 13 18 19"
    // Not a request any more: Kable discovered everything before connect() returned.
    override suspend fun discoverServices(): List<DeviceService> {
        val services = openLink().peripheral.services.value
            ?: throw ConnectionException("Discovery failed: Kable has no services for this link.")
        return services.map { it.toDeviceService() }
    }

    override suspend fun read(characteristic: Characteristic): ByteArray {
        val peripheral = openLink().peripheral
        return kable("The device refused the read") { peripheral.read(characteristic.inKable()) }
    }
⋯ subscribe, unsubscribe, notifications (section 5), openLink, and a comment
private fun Characteristic.inKable() = characteristicOf(Uuid.parse(serviceUuid), Uuid.parse(uuid))
⋯ toDeviceService: fullUuid and propertiesOf, as in Lessons 15–16; and a comment
private suspend fun <T> kable(what: String, call: suspend () -> T): T =
    try {
        call()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ConnectionException(connectionFailure(what, e))
    }
```

1. **`discoverServices()` không hỏi thiết bị gì.** `services` của Kable là một `StateFlow` "`null` cho tới khi các service đã được khám phá", và sau `connect()` nó đã được điền. Port vẫn có hàm này, nên session service và các màn hình chạy không đổi; adapter này chỉ trả lời từ những gì nó đã biết.
2. **Một characteristic theo hai UUID của nó.** `characteristicOf(service, characteristic)` gọi tên một cái theo cách app gọi; Kable rồi dùng "characteristic đầu tiên tìm thấy có property [Read] khớp UUID service và UUID characteristic" (KDoc của nó). Không phải dò qua các object GATT của nền tảng, việc `AndroidBleConnection.find` và `target(for:)` bằng Swift đã làm bằng tay.
3. **Mỗi lần một request vẫn là quy tắc của service.** Kable cũng tự tuần tự hoá các request của nó (một `Mutex` trong `Connection` của nó, trên cả hai nền tảng, trong mã nguồn), nhưng hợp đồng của port nói bên gọi gửi mỗi lần một request ("bên gọi chờ từng cái xong rồi mới gửi cái tiếp theo"), và khoá của `SessionService` giữ điều đó. Không gì ở đây phụ thuộc vào khoá đó, hay lách quanh nó.
4. **Mọi lỗi thành `ConnectionException`, trừ việc huỷ.** `kable { }` bọc mỗi lời gọi: một lần huỷ đi qua, như adapter của E1 làm (tài liệu Kotlin: "nếu phải bắt nó, hãy ném lại nó"), và mọi thứ khác nhận câu chữ của app trước, rồi của Kable: `NotConnectedException` là "liên kết đóng trước", `NoSuchElementException` là "không có characteristic đó", `UnmetRequirementException` là "Bluetooth đang tắt". `KableTranslationTest` ghim câu chữ liên-kết-đã-đóng và phương án dự phòng mà không cần radio; `UnmetRequirementException` của Kable có constructor `internal`, nên test không tạo được nó.

## 5. Notification: một Flow, tách thành các request

Kable không có `subscribe`. `observe(characteristic)` của nó trả về một `Flow<ByteArray>`: collect nó thì bật notification (Kable ghi descriptor CCCD, như bài 16 làm bằng tay), và huỷ việc collect thì tắt chúng. Port, từ bài 16, tách điều đó thành request và dữ liệu: `subscribe` và `unsubscribe`, mỗi cái một request dưới khoá của session, và `notifications`, một `Flow` bạn collect trước. Nên adapter bắt đầu việc collect bên trong `subscribe`, và để nó chạy trong scope của liên kết:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleConnection.kt" hl_lines="4 6 7 16 21"
    override suspend fun subscribe(characteristic: Characteristic) {
        val link = openLink()
        val on = CompletableDeferred<Unit>()
        val job = link.scope.launch {
            try {
                link.peripheral.observe(characteristic.inKable()) { on.complete(Unit) }
                    .collect { notified.emit(Notified(characteristic, it)) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                on.completeExceptionally(e)
            }
        }
        job.invokeOnCompletion { on.completeExceptionally(NotConnectedException("The link closed first.")) }
        link.subscriptions[characteristic] = job
        kable("The device refused to turn on its notifications") { on.await() }
    }

    // Cancelling the collection is Kable's unsubscribe: it writes the CCCD to turn them off.
    override suspend fun unsubscribe(characteristic: Characteristic) {
        openLink().subscriptions.remove(characteristic)?.cancelAndJoin()
    }
```

1. **`onSubscription` nói khi nào chúng đã bật.** Kable chạy hành động `onSubscription` của `observe` "*sau khi* observation đã khởi động (tức là sau khi bật notification hay indication)". Hoàn tất `on` ở đó làm `subscribe` trả về khi thiết bị đã chấp nhận, như port hứa. Nếu bật thất bại, flow `observe` thất bại, và `on` mang lỗi đó tới bên gọi `subscribe`. Nếu liên kết đóng trước, job kết thúc, và `invokeOnCompletion` làm `on` thất bại (một `CompletableDeferred` bỏ qua lần hoàn tất thứ hai, nên điều này chỉ có tác dụng khi chưa có gì tới trước).
2. **Trong scope của liên kết, nên nó kết thúc cùng liên kết.** README của Kable nói một flow `observe` "sẽ vẫn active" qua một lần rớt và tiếp tục sau khi kết nối lại. Port hứa điều ngược lại: "Liên kết kết thúc thì các giá trị kết thúc". Launch việc collect trong scope mà `connect()` trả về làm được điều đó, vì Kable huỷ scope đó khi ngắt kết nối.
3. **Huỷ rồi chờ là cách huỷ đăng ký của Kable.** Khi bên collect cuối cùng của một observation đi mất trong lúc đang kết nối, Kable tắt notification (`Observation.onCompletion` của nó, dưới `NonCancellable`). `cancelAndJoin` chờ điều đó, nên `unsubscribe` trả về sau lần ghi CCCD, như cái tự viết đã làm.
4. **Các giá trị đi ra như trước.** `notified` là một `MutableSharedFlow`, và `notifications(characteristic)` lọc nó theo hai UUID, y như `AndroidBleConnection` và `LinkedBleConnection` làm. `SessionService` vẫn collect trước, rồi mới đăng ký (bài 16).

!!! warning "Gotcha · hình dạng của thư viện không phải hình dạng của port"
    Rất dễ muốn đổi port cho hợp với thư viện: cho `subscribe` trả về `Flow` của Kable và bỏ `unsubscribe`. Khi đó các adapter tự viết, fake và `SessionService` đều đổi, và khoá mỗi-lần-một-request của session không còn bao lần ghi CCCD. Port được đặt tên theo cách nói của app (ADR 0001), nên adapter phải uốn theo: ở đây, một cây cầu nhỏ từ "một Flow mà việc collect chính là lần đăng ký" sang "một request, rồi một dòng chảy". Nếu hai thư viện đều khớp kém với một port, thì đáng để hỏi liệu port có sai không. Một lần khớp gượng thì chưa phải vậy.

## 6. Một dòng Koin

Nền tảng vẫn dựng các adapter tự viết của nó và truyền vào `initKoin`, như ở m15. Một module thứ ba, trong code dùng chung, bind cùng hai port với các adapter Kable, và nó được đặt cuối:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="1 2 3 12"
internal val kableBleModule = module {
    single<BleScanner> { KableBleScanner(get()) }
    single<BleConnection> { KableBleConnection() }
}
⋯ a comment, and initKoin with its nine parameters
    startKoin {
        modules(
            appModule,
            platformModule(
⋯ the nine adapters the platform built
            ),
            kableBleModule, // the BLE stack: delete this line for the hand-written adapters
        )
    }
```

1. **Module nạp sau cùng thắng.** Trang Modules của Koin: "Khi hai module đã nạp khai báo cùng một kiểu, module nạp sau cùng thắng. Trong một khối khởi động DSL, đó là thứ tự của `modules(...)`." `platformModule` bind `BleScanner` và `BleConnection` với thứ nền tảng đã truyền; `kableBleModule`, đứng sau, bind lại cả hai. `KableBleScanner(get())` nhận `BluetoothProvider` của nền tảng, thứ không gì ghi đè.
2. **Một dòng, cả hai nền tảng.** `initKoin` là code dùng chung, nên dòng đó chuyển Android và iOS cùng lúc. Xoá nó đi, và app lại là của m15; không gì khác trong app biết. Đó là mục "thay một adapter là một dòng" của checklist refactor (bài 20), cho cả một stack.
3. **Các adapter của nền tảng vẫn được dựng.** Mỗi phần khởi động app vẫn tạo `AndroidBleScanner`, `IosBleConnection` và phần còn lại, và truyền chúng vào `initKoin`, nơi các binding Kable thay chúng, nên Koin không bao giờ trao chúng ra. Chúng rẻ: `IosBleScanner` và `IosBleConnection` tạo `CBCentralManager` ở lần dùng đầu, thứ không bao giờ tới. Dời lựa chọn vào từng phần khởi động app thay vào (truyền adapter Kable vào `initKoin`) sẽ cần các adapter là public, và hai dòng mỗi nền tảng; giữ nó trong code dùng chung là một dòng.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt" hl_lines="3 5 6"
    @Test
    fun kableBleModuleReplacesThePlatformsBleAdapters() {
        val withKable = koinApplication { modules(appModule, platformFakes(), kableBleModule) }
        try {
            assertIs<KableBleScanner>(withKable.koin.get<BleScanner>())
            assertIs<KableBleConnection>(withKable.koin.get<BleConnection>())
            assertNotNull(withKable.koin.get<DeviceDetailViewModel>())
        } finally {
            withKable.close()
        }
    }
```

Test graph (bài 11) có thêm một trường hợp: với các fake truyền vào làm adapter của nền tảng và `kableBleModule` đứng sau, Koin trao ra các adapter Kable, và một ViewModel cần session vẫn dựng được trên đó. Dựng chúng không chạm radio nào: `KableBleScanner` lưu `BluetoothProvider` của nó, còn scanner và `CBCentralManager` của Kable chỉ được tạo khi một lần quét hay kết nối bắt đầu. `platformFakes()` là module inline cũ, dời vào một hàm để cả hai test dùng. `KableTranslationTest` bao các phép dịch: một `DiscoveredService` của Kable (một interface, nên test tạo được) thành `DeviceService` của app với UUID đầy đủ chữ hoa và đúng các property, và ba lỗi nhận câu chữ của app.

!!! warning "Gotcha · dòng Kable ghi đè lần chạy giả lập của bài 20"
    Bài 20 chạy các hàng BLE đầu-cuối bằng cách truyền `SimulatedBleScanner` và `SimulatedBleConnection` vào `initKoin` từ mỗi phần khởi động app. Khi có `kableBleModule` trong danh sách, việc thay đó không làm gì: các binding Kable đứng sau, và chúng thắng, như `kableBleModuleReplacesThePlatformsBleAdapters` cho thấy bằng fake. Muốn chạy giả lập trên e3, xoá cả dòng Kable, rồi đặt lại cả hai.

## 7. Hai stack, đặt cạnh nhau

Phép so sánh mà kế hoạch khoá học đòi: số dòng code, cách xử lý trạng thái kết nối, lỗi và hành vi trên iOS. "Dòng code" bên dưới đếm các dòng không trống, không phải comment, `package` hay `import`. Các hàng đánh dấu "đã thấy" lấy từ các lần chạy của mục 8; phần còn lại lấy từ code của hai stack và mã nguồn Kable, và các hàng iOS chờ một iPhone.

|   | Tự viết (m15) | Kable (e3) |
|---|---|---|
| số file và kích thước | Android: 2 file Kotlin trong `androidMain`, 326 dòng, 202 dòng code. iOS: 2 file Kotlin trong `iosMain` và 2 file Swift, 475 dòng, 321 dòng code | 5 file Kotlin (hai adapter và file `expect` trong `commonMain`, mỗi cái một `actual` trong `androidMain` và `iosMain`), 256 dòng, 118 dòng code, cho cả hai nền tảng. Cộng một dependency bạn không bảo trì, và không tự sửa được |
| bộ máy bạn phải viết | các `callbackFlow`, mỗi request một `CompletableDeferred`, một broadcast receiver, các delegate được giữ sống, một đường nối Kotlin/Swift trên iOS (`IosLink`, reply) | không cái nào: các lời gọi `suspend` và các `Flow`. Cây cầu duy nhất còn lại là của `subscribe`, từ hình dạng của Kable sang của port |
| khi nào là `Connected` | liên kết đã lên; khám phá là một request riêng | liên kết đã lên và mọi service và characteristic đã được khám phá |
| một lần rớt | callback của nền tảng: "was lost (Android status N)" hoặc lỗi của iOS | `state` của Kable thành `Disconnected(status)`: "was lost (Kable: …)" |
| bỏ cuộc với một thiết bị (đã thấy, API 30) | lỗi hiện khoảng 10 s sau Connect | khoảng 15 s: `disconnect()` chờ tối đa `disconnectTimeout` (5 s) một lần ngắt kết nối mà lần thử đang chờ không bao giờ báo |
| Bluetooth tắt giữa lúc quét (đã thấy, API 36) | "Scan failed: Bluetooth was turned off." ngay lập tức (receiver của bài 13) | "Scanning…" cho tới giới hạn 10 s, rồi "No devices found. Try another filter.": scanner của Kable không theo dõi radio một khi đã bắt đầu (cả trên Apple, trong mã nguồn) |
| Vị trí tắt, Android 11 trở xuống (đã thấy, API 30) | lần quét không tìm thấy gì, và nói "No devices found" | "Scanning needs Location turned on on this phone (Android 11 and lower)": Kable kiểm tra trước khi bắt đầu |
| chi tiết lỗi | mã status của Android, `localizedDescription` của iOS | exception có kiểu (`UnmetRequirementException` kèm lý do, `NotConnectedException`, `GattStatusException`) và thông báo của Kable |
| log | không có cái nào của chúng ta | Kable ghi log ở mức mặc định, warning: một lần thử bị huỷ ghi "Failed to establish connection" kèm stack trace (đã thấy, API 30). Đó không phải crash |
| iOS | các class Swift trên main queue, mỗi adapter một `CBCentralManager`, `ShowPowerAlert` false | một `CBCentralManager` cho cả hai adapter, trên queue riêng của Kable, cấu hình trước lần dùng đầu; lọc trùng đặt lại về mặc định của Apple; hoàn toàn không có Swift |
| test không cần radio | fake sau các port (bài 11–16) | cùng các fake, cộng các phép dịch; bản thân Kable không có test double, nên đằng nào các đường đi radio của adapter cũng phải chờ một chiếc điện thoại |

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 210" role="img" aria-labelledby="le3-giveup-title">
      <title id="le3-giveup-title">Dòng thời gian của một lần thử kết nối tới một thiết bị không bao giờ trả lời, trên emulator API 30. Cả hai stack bắt đầu kết nối ở 0 giây. Ở 10 giây SessionService bỏ cuộc và huỷ việc collect của liên kết. awaitClose của adapter tự viết gọi disconnect và close ngay, và lỗi hiện khoảng 10 giây. finally của adapter Kable gọi disconnect, thứ chờ tối đa disconnectTimeout, 5 giây, một lần ngắt kết nối mà lần thử đang chờ không bao giờ báo; close chạy khoảng 15 giây, và lỗi hiện lúc đó.</title>
      <text class="small muted" x="10" y="60">tự viết</text>
      <text class="small muted" x="10" y="130">Kable</text>
      <path class="axis" d="M120,55 L700,55 M120,125 L700,125"></path>
      <circle class="dot" cx="120" cy="55" r="5"></circle><text class="mono small" x="120" y="43" text-anchor="middle">Connect</text>
      <circle class="dot" cx="480" cy="55" r="5"></circle><text class="mono small" x="480" y="43" text-anchor="middle">bỏ cuộc: close()</text>
      <text class="small" x="480" y="76" text-anchor="middle">lỗi hiện ra</text>
      <circle class="dot" cx="120" cy="125" r="5"></circle><text class="mono small" x="120" y="113" text-anchor="middle">Connect</text>
      <circle class="dot" cx="480" cy="125" r="5"></circle><text class="mono small" x="480" y="113" text-anchor="middle">bỏ cuộc: disconnect()</text>
      <path class="edge dashed" d="M486,125 L654,125"></path>
      <text class="small muted" x="570" y="146" text-anchor="middle">chờ Disconnected, tối đa 5 s</text>
      <circle class="dot" cx="660" cy="125" r="5"></circle><text class="mono small" x="660" y="113" text-anchor="middle">close()</text>
      <text class="small" x="660" y="166" text-anchor="middle">lỗi hiện ra</text>
      <path class="axis" d="M120,185 L700,185"></path>
      <text class="small muted" x="120" y="202" text-anchor="middle">0 s</text>
      <text class="small muted" x="300" y="202" text-anchor="middle">5 s</text>
      <text class="small muted" x="480" y="202" text-anchor="middle">10 s</text>
      <text class="small muted" x="660" y="202" text-anchor="middle">15 s</text>
    </svg>
    <figcaption>Cùng một quy tắc, "bỏ cuộc sau 10 giây", trong cùng một service, sau cùng một port: lỗi vẫn hiện muộn hơn 5 giây với Kable, vì việc dọn dẹp của nó chờ radio.</figcaption>
  </figure>

## 8. Thực tế xảy ra gì: các lần chạy đứng sau trang này

Chúng tôi build e3 trên cả bốn track (Kotlin 2.4.20, Kable 0.45.0, Koin 4.2.2, Xcode 26.2). `allTests` pass 110 trên 110 trên JVM và 110 trên 110 trên iOS simulator, và không bản build nào in cảnh báo compiler từ code của chúng ta. Bluetooth của emulator là giả lập và không nghe được LightBlue trên máy Mac của bạn, còn Simulator hoàn toàn không có Bluetooth (bài 13), nên các lần chạy này kiểm tra những gì kiểm được khi không có peripheral. Để so sánh, chúng tôi còn chạy một bản sao đã xoá dòng Kable.

| Ở đâu | Chúng tôi đã làm gì | Stack Kable | Stack tự viết |
|---|---|---|---|
| API 36 emulator, Compose and XML | Scan, chờ | "Scanning…", rồi sau 10 s "No devices found. Try another filter."; `dumpsys`: một lần quét, `ScanMode=LOW_LATENCY`, dừng sau 9,9 s | như vậy (bài 13) |
| API 36 emulator, Compose | Scan, Stop sau 2 s | `dumpsys`: dừng sau 2,1 s | như vậy |
| API 36 emulator, Compose | Tắt Bluetooth (`adb shell cmd bluetooth_manager disable`), Scan | "Bluetooth is off. Turn it on, then scan again." (từ `ScanningService`, trước khi Kable chạy) | như vậy |
| Emulator API 36, Compose và XML (tự viết: Compose) | Scan, rồi tắt Bluetooth sau 2 s | "Scanning…" cho tới giới hạn 10 s, rồi "No devices found. Try another filter." | "Scan failed: Bluetooth was turned off." ngay lập tức |
| API 30 emulator, Compose | Scan | hai hàng `gDevice-beacon`, `BE:AC:10:00:00:01` và `…:02`, "Devices found: 2" | như vậy (bài 13) |
| API 30 emulator, Compose | màn hình của một beacon, Connect | "Status: connecting…", rồi khoảng 15 s sau khi bấm "Connection failed: gDevice-beacon didn't answer within 10 seconds."; logcat: `cancelOpen()` ở 10 s, `close()` 5 s sau | cùng hộp thoại đó khoảng 10 s sau khi bấm; `cancelOpen()` và `close()` cách nhau 6 ms |
| API 30 emulator, Compose | Tắt vị trí (`adb shell cmd location set-location-enabled false`), Scan | "Scan failed: Scanning needs Location turned on on this phone (Android 11 and lower)." | "No devices found. Try another filter." sau 10 s |
| iOS 26.2 Simulator, SwiftUI and UIKit | Scan (một XCUITest tạm) | "Scan failed: This phone has no Bluetooth LE radio." (`BluetoothProvider` nói `null`: radio của Simulator là `unsupported`); app vẫn ở foreground | như vậy (bài 13) |

Mục tiêu thật, LightBlue được quét, kết nối, đọc, đăng ký và ngắt kết nối qua Kable, cần điện thoại của bạn; các hàng iOS của mục 7 cũng vậy. Brief cho agent liệt kê chúng là các kiểm tra trên thiết bị. **e3 là một điểm dừng tự nhiên** khi test pass trên cả hai nền tảng, emulator và Simulator hiện các dòng ở trên, và xoá dòng Kable trả lại cho bạn hành vi của m15. Hãy commit nó, và gắn tag.

## 9. Khi nào chọn cái nào

Không stack nào đúng ở mọi nơi. Những gì các lần chạy và code ở trên gợi ý:

1. **Chọn một thư viện như Kable** khi nhu cầu BLE của app là bình thường (quét, kết nối, đọc, ghi, notify) và team viết Kotlin trên cả hai nền tảng: một bản adapter thay vì mỗi nền tảng một bản, chưa tới một phần tư số dòng code (118 so với 202 + 321), không có đường nối Swift-sang-Kotlin, và lỗi là exception có kiểu. Nó hợp với một team mà nếu không sẽ phải bảo trì cùng một máy trạng thái hai lần.
2. **Tự viết** khi bạn cần đúng hành vi của một nền tảng: background mode và khôi phục trạng thái trên iOS, một tật của hãng điện thoại phải lách trên Android, một thời điểm chính xác để báo `Connected`, hay một phản ứng khi Bluetooth tắt giữa lúc quét, thứ scanner của Kable không theo dõi. Cũng vậy khi team sở hữu iOS bằng Swift và muốn CoreBluetooth bằng chính ngôn ngữ của mình.
3. **Cách nào thì cũng giữ port.** Lựa chọn ở đây rẻ vì app core không bao giờ thấy `BluetoothGatt`, `CBPeripheral` hay một kiểu Kable nào. Có port, bạn có thể bắt đầu bằng thư viện rồi sau này xuống code tự viết cho một nền tảng, hoặc ngược lại, mỗi lần một dòng Koin.
4. **Đọc các mặc định của nó.** Phần lớn khác biệt chúng tôi gặp là mặc định: quét tiết kiệm pin, bật trùng lặp, chờ ngắt kết nối 5 giây, alert nguồn. Một thư viện quyết định thay bạn; adapter là nơi bạn quyết định lại.

!!! question "Hỏi agent của bạn"
    Hỏi agent nó sẽ làm `KableBleScanner` kết thúc lần quét khi Bluetooth tắt ra sao, như `AndroidBleScanner` làm, mà không đổi port: code nằm đâu (dùng chung, hay mỗi nền tảng một `actual`), nó nghe cái gì, và một test kiểm tra nó mà không cần radio bằng cách nào. Đối chiếu câu trả lời với mục 3 và 6, rồi so với câu trả lời của chính bạn cho bước 2 của bài tự làm.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao <code>KableBleScanner</code> và <code>KableBleConnection</code> sống được trong <code>commonMain</code>, khi các adapter của bài 13 cần mỗi nền tảng một cái?</p>
<div class="opts">
<button class="opt">Kable nói chuyện với radio qua một giao thức Bluetooth đa nền tảng của riêng nó</button>
<button class="opt" data-correct>Kable là một thư viện Kotlin Multiplatform: <code>androidMain</code> và <code>appleMain</code> của chính nó implement <code>Scanner</code> và <code>Peripheral</code> dựa trên API của từng nền tảng, nên adapter của chúng ta chỉ dịch kiểu</button>
<button class="opt">các port đã dời vào source set của nền tảng</button>
</div>
<p class="feedback"></p>
<p class="why">Code nền tảng không biến mất; nó dời vào thư viện. Hai <code>actual</code> nhỏ còn lại là các lựa chọn theo nền tảng mà builder của Kable để cho chúng ta.</p>
</div>

<div class="quiz">
<p class="q"><code>initKoin</code> liệt kê <code>appModule</code>, <code>platformModule(…)</code>, rồi <code>kableBleModule</code>. <code>ScanningService</code> nhận <code>BleScanner</code> nào?</p>
<div class="opts">
<button class="opt">của nền tảng: definition đầu tiên của một kiểu thắng</button>
<button class="opt">không cái nào: Koin fail lúc khởi động vì trùng definition</button>
<button class="opt" data-correct><code>KableBleScanner</code>: khi hai module đã nạp khai báo cùng một kiểu, module nạp sau cùng thắng</button>
</div>
<p class="feedback"></p>
<p class="why">"Load order and overrides" của Koin. Muốn một lần ghi đè vô tình bị fail thay vào, Koin có <code>allowOverride(false)</code>; app này dựa vào việc ghi đè, và test graph ghim nó.</p>
</div>

<div class="quiz">
<p class="q"><code>KableBleConnection</code> phát <code>Connected</code> khi nào, so với <code>AndroidBleConnection</code>?</p>
<div class="opts">
<button class="opt">cùng lúc: cả hai báo khi liên kết lên</button>
<button class="opt" data-correct>muộn hơn: <code>connect()</code> của Kable chỉ trả về khi các service đã được khám phá, trong khi adapter tự viết phát <code>Connected</code> khi liên kết lên</button>
<button class="opt">sớm hơn: Kable phát <code>Connected</code> ngay khi bắt đầu kết nối</button>
</div>
<p class="feedback"></p>
<p class="why">README của Kable: "Khám phá service diễn ra tự động khi kết nối." Nên giới hạn 10 giây của session giờ bao cả khám phá, và <code>discoverServices()</code> trả lời mà không hỏi thiết bị.</p>
</div>

<div class="quiz">
<p class="q">Với stack Kable trên Android, Bluetooth tắt hai giây sau khi bắt đầu quét. Màn hình hiện gì?</p>
<div class="opts">
<button class="opt">"Scan failed: Bluetooth was turned off." ngay lập tức</button>
<button class="opt">"Bluetooth is off. Turn it on, then scan again." ngay lập tức</button>
<button class="opt" data-correct>"Scanning…" cho tới giới hạn 10 giây, rồi "No devices found. Try another filter."</button>
</div>
<p class="feedback"></p>
<p class="why">Kable kiểm tra Bluetooth trước khi bắt đầu quét, không trong lúc quét, và scan callback của Android không báo gì khi radio tắt (bài 13). Adapter tự viết nghe broadcast; scanner của Kable thì không.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>subscribe</code> launch việc collect <code>observe</code> của Kable trong scope của liên kết thay vì trả về <code>Flow</code> của Kable?</p>
<div class="opts">
<button class="opt"><code>Flow</code> của Kable không collect được ngoài scope riêng của Kable</button>
<button class="opt" data-correct>port tách request (<code>subscribe</code>, dưới khoá của session) khỏi dữ liệu (<code>notifications</code>); một lần collect trong scope của liên kết kết thúc khi liên kết kết thúc, như port hứa</button>
<button class="opt">để notification tiếp tục tới sau một lần kết nối lại</button>
</div>
<p class="feedback"></p>
<p class="why">Flow <code>observe</code> của chính Kable sống qua một lần rớt và tiếp tục sau khi kết nối lại; port nói "Liên kết kết thúc thì các giá trị kết thúc". Scope mà <code>connect()</code> trả về bị huỷ khi ngắt kết nối, nên việc collect kết thúc cùng liên kết.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>actual</code> của iOS gọi <code>CentralManager.configure { }</code>, bên trong trống, trước lần quét đầu của Kable?</p>
<div class="opts">
<button class="opt">Kable không quét cho tới khi manager của nó được cấu hình</button>
<button class="opt" data-correct>không có nó Kable không truyền tuỳ chọn nào, và mặc định của iOS hiện một alert hệ thống nếu Bluetooth đang tắt khi manager được tạo; bất kỳ <code>configure</code> nào cũng làm Kable truyền <code>ShowPowerAlert</code> false. Nó phải chạy trước khi manager tồn tại, không thì nó ném lỗi</button>
<button class="opt">để bật khôi phục trạng thái cho việc quét nền</button>
</div>
<p class="feedback"></p>
<p class="why">Apple: "Nếu khoá không được chỉ định, giá trị mặc định là true." <code>lazy</code> đảm bảo nó chạy một lần, trước tiên.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Vì sao <code>AndroidBleScanner</code> đăng ký một receiver cho <code>ACTION_STATE_CHANGED</code>? (Bài 13)</p>
<div class="opts">
<button class="opt">để bắt đầu quét ngay khi Bluetooth bật</button>
<button class="opt" data-correct>tắt Bluetooth kết thúc lần quét mà không có lời gọi nào tới <code>ScanCallback</code>, nên không có broadcast thì app không biết được</button>
<button class="opt">Android đòi một receiver trước <code>startScan</code></button>
</div>
<p class="feedback"></p>
<p class="why">Cùng sự im lặng đó là thứ stack Kable vấp phải ở mục 8.</p>
</div>

<div class="quiz">
<p class="q">Bạn thêm <code>kableBleModule</code> vào <code>initKoin</code> nhưng quên bind <code>BluetoothProvider</code> ở bất kỳ đâu. Khi nào bạn phát hiện ra? (Bài 11)</p>
<div class="opts">
<button class="opt">lúc compile: <code>get()</code> kiểm tra kiểu của nó</button>
<button class="opt" data-correct>lúc chạy, khi Koin dựng <code>KableBleScanner</code> lần đầu, trừ khi một test graph dựng nó trước</button>
<button class="opt">không bao giờ: Koin truyền <code>null</code></button>
</div>
<p class="feedback"></p>
<p class="why">Koin giải <code>get()</code> khi nó dựng definition, đó là lý do bài 11 thêm một test graph, và vì sao phần mở rộng này thêm một trường hợp vào đó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>finally</code> của adapter Kable bọc <code>peripheral.disconnect()</code> trong <code>withContext(NonCancellable)</code>? (Bài 16)</p>
<div class="opts">
<button class="opt"><code>disconnect()</code> của Kable phải chạy trên main thread</button>
<button class="opt" data-correct><code>finally</code> thường chạy vì coroutine đã bị huỷ, và lần treo tiếp theo của một coroutine đã bị huỷ ném lỗi ngay; <code>NonCancellable</code> cho việc dọn dẹp treo được tới khi xong</button>
<button class="opt">để một lần bấm Disconnect không làm gián đoạn lần thử kết nối</button>
</div>
<p class="feedback"></p>
<p class="why">Cùng lý do <code>SessionService</code> gửi lệnh huỷ đăng ký dưới <code>NonCancellable</code> khi bên collect đi mất.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên project e3 của bạn)"
    1. **Đoán, rồi chuyển.** Ghi ra màn hình sẽ nói gì khi Bluetooth tắt hai giây sau khi bắt đầu quét, trước với dòng Kable, rồi không có nó. Chạy cả hai trên emulator (`adb shell cmd bluetooth_manager disable`, rồi `enable`). Rồi chạy `./gradlew :shared:allTests` khi không có dòng đó: test nào vẫn pass, và vì sao nó không cần dòng đó trong `initKoin`?
    2. **Bịt khoảng trống.** Làm `KableBleScanner` kết thúc lần quét bằng `ScanException("Bluetooth was turned off.")` khi Bluetooth tắt, mà không đổi port. Một ý tưởng đầu không cần gì mới: trong lúc quét, hỏi `BluetoothProvider` mỗi giây, và thất bại khi nó thôi nói `true`. Viết sao cho một test kiểm tra được bằng `FakeBluetoothProvider` và một nguồn advertisement giả, rồi thử trên emulator. Hỏi định kỳ tốn gì, và một `actual` mỗi nền tảng sẽ nghe cái gì thay vào?
    3. **Lần chờ 5 giây.** Trên emulator API 30, đo thời gian hộp thoại "didn't answer" sau Connect trên một `gDevice-beacon`. Rồi cho `Peripheral` của Android một lần chờ ngắn hơn (`Peripheral(device.id) { disconnectTimeout = 1.seconds }`) và đo lại. Một lần chờ quá ngắn có thể tốn gì trên một điện thoại thật có liên kết đang sống?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và các kiểm tra, so sánh hai stack khi có và không có dòng Kable, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/e3-kable-library-alternative.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/e3-kable-library-alternative.html" -o .course/lesson-e3.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html" -o .course/ref-ble-cheatsheet.html
Lesson 20, which this extension builds on; skipped if it's already there:
  [ -f .course/lesson-20.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html" -o .course/lesson-20.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" exactly, except where the brief
below says otherwise.

Extension E3 (Kable: the library alternative): build milestone e3 on top of m15: a second
pair of BLE outbound adapters over Kable 0.45.0 (com.juul.kable:kable-core, commonMain only),
KableBleScanner and KableBleConnection in commonMain, behind the unchanged BleScanner and
BleConnection ports; kableScanner() and kablePeripheral() as expect funs with one actual each
in androidMain (a low-latency scan; Peripheral(address)) and iosMain (CentralManager.configure
before first use; allowDuplicateKeys = false, Apple's default; Peripheral(uuid)); a Koin module,
kableBleModule, listed last in initKoin, so one line switches the whole app between the Kable
and the hand-written stacks; translation tests (KableTranslationTest) and one more graph test.
No screen, ViewModel or service changes. The hand-written adapters stay as they are.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI). This
extension's files are the same on every track.
Starting point: my m15 project in demo/ (Lesson 20). Use exactly the file contents shown in the
lesson's "Full files" section, including package lines, imports and comments. All paths are
relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks: shared/build.gradle.kts: replaced (adds kable-core 0.45.0).
   Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     replaced: core/outbound/BleScanner.kt, core/outbound/BleConnection.kt (comments only),
       di/AppModule.kt
     add: adapter/outbound/KableBleScanner.kt, adapter/outbound/KableBleConnection.kt,
       adapter/outbound/KablePlatform.kt
   add: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.android.kt
   add: shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.ios.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: adapter/outbound/KableTranslationTest.kt
     replaced: di/AppModuleTest.kt
   Every other file in shared/ stays as in m15.
2. Android and iOS apps, every track: no file changes. No new Swift file, so no xcodegen run.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), and grant the Bluetooth
   permission in the app (or adb shell pm grant com.example.devicemonitor
   android.permission.BLUETOOTH_SCAN, and the same for BLUETOOTH_CONNECT):
     adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk
     adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`,
     then `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 110 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 10 in MonitoringServiceTest, 9 in
  ScanningServiceTest, 8 in ValueDecoderTest, 6 in MonitorViewModelTest, 5 in
  StatusServiceTest, 4 in AppModuleTest, 4 in KableTranslationTest, 4 in JsonLinesTest, 4 in
  PermissionServiceTest, 3 in DeviceServiceTest, 1 in SessionConnectionStatusTest, and 5 in
  AndroidLogStoreTest (JVM results) or 5 in IosLogStoreTest (iOS results). Show the counts from
  the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- Placement, each from demo/:
    grep -rln 'import com.juul.kable' shared/src androidApp/src iosApp/iosApp
  lists exactly KableBleScanner.kt, KableBleConnection.kt, KablePlatform.kt,
  KablePlatform.android.kt, KablePlatform.ios.kt and KableTranslationTest.kt;
    grep -rn 'import com.juul\|import android\.\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing; and after the iOS build,
    grep -c Kable shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 0 (the Kable adapters are internal).
- Android emulator (API 31+), my track. Find text with `adb shell uiautomator dump` (the XML
  buttons show their text in capitals, so match case-insensitively).
  1. Scan: "Scanning…", then about 10 s later "No devices found. Try another filter." (or the
     devices the emulator's image hears). Then `adb shell dumpsys bluetooth_manager`: under
     com.example.devicemonitor, the last scan says ScanMode=LOW_LATENCY, and "LE scans
     (started/stopped)" shows the same number twice.
  2. Scan, and tap Stop within 2 s (the Stop that takes Scan's place, not the monitor's Stop
     higher up): dumpsys shows that scan stopped after about 2 s.
  3. adb shell cmd bluetooth_manager disable; Scan: "Bluetooth is off. Turn it on, then scan
     again."; then adb shell cmd bluetooth_manager enable.
  4. Wait 30 s (Android limits how often an app may start scans), Scan, and 2 s later
     adb shell cmd bluetooth_manager disable: the screen stays on "Scanning…" until the 10 s
     limit, then says "No devices found. Try another filter." (Kable doesn't watch the radio
     during a scan). Then enable Bluetooth again.
  5. Delete the kableBleModule line from initKoin, rebuild, install, and repeat check 4: "Scan
     failed" / "Bluetooth was turned off." at once (the hand-written stack). Put the line back,
     rebuild and reinstall, and run git diff on AppModule.kt: nothing left of the change.
- Optional, if you have an emulator with Android 11 (API 30): grant
  android.permission.ACCESS_FINE_LOCATION, then
  1. Scan: two gDevice-beacon rows, "Devices found: 2".
  2. Tap one, Connect: "Status: connecting…", then about 15 s after the tap "Connection
     failed" / "gDevice-beacon didn't answer within 10 seconds."; adb logcat -d shows
     BluetoothGatt cancelOpen() and, 5 s later, close(), and Kable/Peripheral's "Failed to
     establish connection" with a stack trace (Kable's log, not a crash: the app is still
     running, adb shell pidof com.example.devicemonitor prints a pid).
  3. adb shell cmd location set-location-enabled false; back on the main screen, Scan: "Scan
     failed" / "Scanning needs Location turned on on this phone (Android 11 and lower)." Then
     adb shell cmd location set-location-enabled true.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  1. Tap Scan: "Scan failed" and "This phone has no Bluetooth LE radio."; the app stays in the
     foreground.
- Device checks (record them, don't run them): on a physical Android phone and an iPhone, with
  LightBlue's virtual peripheral (Lesson 13) and the Kable line in: scan finds it; connect;
  services listed; read and decode a value; subscribe and receive a notification; unsubscribe;
  Disconnect; stop the virtual device for an unexpected drop. On the iPhone also: Bluetooth off
  two seconds into a scan (expected as on Android: "Scanning…" until the limit), and Bluetooth
  off before the first scan after a fresh launch (expected: the app's own message, no system
  alert).
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me the placement greps' output.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Appendix A.3](https://phongna-inn.github.io/carmd-kmp-course/COURSE_PLAN.md) của kế hoạch khoá học (các yêu cầu BLE mà cả hai stack phải đáp ứng) và ADR 0001 (một outbound adapter dùng chung nằm ở đâu).
- Kable: [README](https://github.com/JuulLabs/kable) (nguồn chính: "một API đơn giản chạy bằng Coroutines", quét, "Khám phá service diễn ra tự động khi kết nối", `disconnect` "treo cho tới khi peripheral ổn định ở trạng thái đã ngắt kết nối", `observe` và `onSubscription`, `CentralManager.configure` trước lần dùng đầu, "Kable không khai báo quyền nào"), [API docs](https://juullabs.github.io/kable/) (`Peripheral`, `Scanner`, `State`, `UnmetRequirementException`) và [release notes](https://github.com/JuulLabs/kable/releases) (0.44.0: "Nâng mức deprecate của `Bluetooth.availability`").
- Koin: [Modules](https://insert-koin.io/docs/reference/koin-core/modules) (nguồn chính: "Load order and overrides", "module nạp sau cùng thắng", `allowOverride(false)`).
- Apple: [CBCentralManagerOptionShowPowerAlertKey](https://developer.apple.com/documentation/corebluetooth/cbcentralmanageroptionshowpoweralertkey) ("Nếu khoá không được chỉ định, giá trị mặc định là true") và [CBCentralManagerScanOptionAllowDuplicatesKey](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerscanoptionallowduplicateskey) (mặc định false; tắt lọc "có thể ảnh hưởng xấu tới thời lượng pin").
- Android: [ScanSettings.Builder](https://developer.android.com/reference/android/bluetooth/le/ScanSettings.Builder) (`setScanMode`, và các chế độ quét mà mặc định của Kable và của chúng ta chọn giữa).
- Kotlin: [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) (ném lại `CancellationException`, và `NonCancellable` cho việc dọn dẹp có treo).
- [Cheatsheet: BLE](https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html) (các adapter tự viết mà phần mở rộng này so sánh với) và [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html) (port, adapter, test graph của Koin).
- Kinh nghiệm thực tế: [GitHub issues](https://github.com/JuulLabs/kable/issues) của Kable, nơi hành vi của nó được bàn (issue 737 là cái mà thông báo deprecate của `Bluetooth.availability` trỏ tới); kênh #multiplatform của Kotlin Slack.

## File đầy đủ

Mọi file phần mở rộng này thêm hoặc sửa, đầy đủ, giống nhau trên mọi track. Các app Android và iOS, `project.yml`, `Info.plist`, cả hai file `androidApp/build.gradle.kts`, các build file gốc và mọi adapter BLE tự viết giữ như ở m15.

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
                implementation("com.juul.kable:kable-core:0.45.0")
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

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Outbound port: what the app needs from a Bluetooth radio, in the app's own terms.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app. Or one shared adapter
    // over the Kable library, KableBleScanner in commonMain (Extension E3).
    interface BleScanner {
        // Whether this phone has a Bluetooth LE radio the app can use.
        suspend fun isAvailable(): Boolean

        // Whether that radio is switched on.
        suspend fun isEnabled(): Boolean

        // Every device the radio hears, as it hears it; the same device may come again. A device
        // that advertises no name comes with name "". Collecting starts the radio scan, and
        // cancelling the collector stops it. Throws ScanException.
        fun scan(): Flow<Device>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import kotlinx.coroutines.flow.Flow

    // Outbound port: what the app needs from a Bluetooth radio to hold a link to one device, in the
    // app's own terms. One adapter per platform: Kotlin in androidMain; on iOS, a Kotlin half in
    // iosMain (LinkedBleConnection) over a Swift half in the iOS app. Or one shared adapter over the
    // Kable library, KableBleConnection in commonMain (Extension E3).
    interface BleConnection {
        // The link to device, as its state changes: Connecting, then Connected once it's up.
        // Collecting starts the connection, and cancelling the collector ends it and frees what the
        // radio held for it. Throws ConnectionException when the attempt fails or the link drops.
        fun connect(device: Device): Flow<ConnectionState>

        // The requests below go over the link that connect() holds open, one at a time: callers wait
        // for each to finish before sending the next. Each throws ConnectionException when there's
        // no link, when the link closes first, or when the device or the radio reports an error.

        // Every service on the device with its characteristics, all UUIDs in the full form (fullUuid).
        suspend fun discoverServices(): List<DeviceService>

        // The characteristic's value, as the bytes the device sent. Only after discoverServices().
        suspend fun read(characteristic: Characteristic): ByteArray

        // Asks the device to send the characteristic's value each time it changes (it must notify):
        // from then on the values arrive in notifications(characteristic). Only after
        // discoverServices().
        suspend fun subscribe(characteristic: Characteristic)

        // Asks the device to stop sending them.
        suspend fun unsubscribe(characteristic: Characteristic)

        // Not a request: the values the device sends for characteristic, as they arrive, for as long
        // as it is collected. A value that arrives while nobody collects is lost, so collect first,
        // then subscribe. The link ending ends the values, not this Flow.
        fun notifications(characteristic: Characteristic): Flow<ByteArray>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.juul.kable.UnmetRequirementException
    import com.juul.kable.UnmetRequirementReason
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.catch
    import kotlinx.coroutines.flow.map

    // Outbound adapter: the phone's Bluetooth LE radio through the Kable library, behind the
    // BleScanner port. Shared code, the same Kotlin on Android and iOS. Kable's Scanner is already a
    // Flow, so there's no callback here: the adapter translates Kable's advertisements and failures
    // into the app's Device and ScanException.
    internal class KableBleScanner(private val bluetooth: BluetoothProvider) : BleScanner {
        // Kable doesn't answer these two: 0.44.0 made Bluetooth.availability a compile error (it
        // behaved differently on each platform), and its experimental isSupported() is always true on
        // iOS. So they ask the BluetoothProvider port (Lesson 17), whose null means no radio to use.
        override suspend fun isAvailable(): Boolean = bluetooth.isEnabled() != null

        override suspend fun isEnabled(): Boolean = bluetooth.isEnabled() == true

        // Collecting starts Kable's scan and cancelling the collector stops it, as the port asks.
        // Kable's name is the advertised name, as in the hand-written adapters; none becomes "".
        // The identifier is the address (a String) on Android and a Uuid on iOS: "$" makes it text.
        override fun scan(): Flow<Device> =
            kableScanner().advertisements
                .map { Device(id = "${it.identifier}", name = it.name.orEmpty(), rssi = it.rssi) }
                .catch { failure -> throw ScanException(scanFailure(failure)) }
    }

    // Kable's failures, in the words the app shows. catch never sees the collector's cancellation.
    internal fun scanFailure(failure: Throwable): String = when {
        failure is UnmetRequirementException && failure.reason == UnmetRequirementReason.BluetoothDisabled ->
            "Bluetooth is off. Turn it on, then scan again."
        failure is UnmetRequirementException ->
            "Scanning needs Location turned on on this phone (Android 11 and lower)."
        else -> "The scan failed (Kable: ${failure.message})."
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KableBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.fullUuid
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.propertiesOf
    import com.juul.kable.DiscoveredService
    import com.juul.kable.NotConnectedException
    import com.juul.kable.Peripheral
    import com.juul.kable.State
    import com.juul.kable.UnmetRequirementException
    import com.juul.kable.characteristicOf
    import kotlinx.coroutines.CompletableDeferred
    import kotlinx.coroutines.CoroutineScope
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.NonCancellable
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableSharedFlow
    import kotlinx.coroutines.flow.filter
    import kotlinx.coroutines.flow.first
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.flow.map
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.withContext
    import kotlin.concurrent.Volatile
    import kotlin.coroutines.cancellation.CancellationException
    import kotlin.uuid.Uuid

    // Outbound adapter: a link to one device through the Kable library, behind the BleConnection
    // port. Shared code, the same Kotlin on Android and iOS. Kable's Peripheral suspends where the
    // platforms call back, so there's no callback object and no request waiting for its answer here:
    // each port function calls Kable and translates the answer, and the failure, into the app's terms.
    internal class KableBleConnection : BleConnection {
        // The open link: the device's Peripheral, the scope Kable keeps for this one connection, and
        // the subscriptions running in it. The session service sends one request at a time.
        private class Link(val peripheral: Peripheral, val scope: CoroutineScope) {
            val subscriptions = mutableMapOf<Characteristic, Job>()
        }

        @Volatile private var link: Link? = null

        // Every value a subscribed characteristic sends on the link; nobody collecting, it's dropped.
        private val notified = MutableSharedFlow<Notified>(extraBufferCapacity = 64)

        private class Notified(val characteristic: Characteristic, val value: ByteArray)

        // Kable's connect() suspends until the link is up and every service is discovered, then
        // returns. Kable's state then says when the link drops. However the Flow ends, finally
        // disconnects and closes the Peripheral, which frees what the radio held for it.
        override fun connect(device: Device): Flow<ConnectionState> = flow {
            val peripheral = try {
                kablePeripheral(device)
            } catch (e: Exception) {
                throw ConnectionException("Kable couldn't find ${device.name} (${e.message}). Scan again.")
            }
            try {
                emit(ConnectionState.Connecting(device))
                val scope = kable("The connection failed") { peripheral.connect() }
                link = Link(peripheral, scope)
                emit(ConnectionState.Connected(device))
                val ended = peripheral.state.first { it is State.Disconnected } as State.Disconnected
                val reason = ended.status?.toString() ?: "no reason given"
                throw ConnectionException("The link to ${device.name} was lost (Kable: $reason).")
            } finally {
                link = null
                withContext(NonCancellable) { peripheral.disconnect() }
                peripheral.close()
            }
        }

        // Not a request any more: Kable discovered everything before connect() returned.
        override suspend fun discoverServices(): List<DeviceService> {
            val services = openLink().peripheral.services.value
                ?: throw ConnectionException("Discovery failed: Kable has no services for this link.")
            return services.map { it.toDeviceService() }
        }

        override suspend fun read(characteristic: Characteristic): ByteArray {
            val peripheral = openLink().peripheral
            return kable("The device refused the read") { peripheral.read(characteristic.inKable()) }
        }

        // Kable has no subscribe: observe() returns a Flow, and collecting it writes the CCCD
        // descriptor. So subscribing starts a collection in the link's scope, and waits until Kable
        // says notifications are on (observe's onSubscription) or the collection fails or ends.
        override suspend fun subscribe(characteristic: Characteristic) {
            val link = openLink()
            val on = CompletableDeferred<Unit>()
            val job = link.scope.launch {
                try {
                    link.peripheral.observe(characteristic.inKable()) { on.complete(Unit) }
                        .collect { notified.emit(Notified(characteristic, it)) }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    on.completeExceptionally(e)
                }
            }
            job.invokeOnCompletion { on.completeExceptionally(NotConnectedException("The link closed first.")) }
            link.subscriptions[characteristic] = job
            kable("The device refused to turn on its notifications") { on.await() }
        }

        // Cancelling the collection is Kable's unsubscribe: it writes the CCCD to turn them off.
        override suspend fun unsubscribe(characteristic: Characteristic) {
            openLink().subscriptions.remove(characteristic)?.cancelAndJoin()
        }

        override fun notifications(characteristic: Characteristic): Flow<ByteArray> =
            notified
                .filter { it.characteristic.serviceUuid == characteristic.serviceUuid }
                .filter { it.characteristic.uuid == characteristic.uuid }
                .map { it.value }

        private fun openLink(): Link = link ?: throw ConnectionException("Not connected.")
    }

    // The app's characteristic as Kable names one: by its service's UUID and its own.
    private fun Characteristic.inKable() = characteristicOf(Uuid.parse(serviceUuid), Uuid.parse(uuid))

    // A service Kable discovered, in the app's terms: full upper-case UUIDs (fullUuid), and the
    // properties from the same Characteristic Properties bits both platforms report.
    internal fun DiscoveredService.toDeviceService(): DeviceService {
        val serviceUuid = fullUuid(serviceUuid.toString())
        return DeviceService(
            uuid = serviceUuid,
            characteristics = characteristics.map {
                Characteristic(serviceUuid, fullUuid(it.characteristicUuid.toString()), propertiesOf(it.properties.value))
            },
        )
    }

    // Runs one Kable call, and gives any failure to the app core as a ConnectionException: the
    // user's words first, Kable's after. Cancellation passes through as it is.
    private suspend fun <T> kable(what: String, call: suspend () -> T): T =
        try {
            call()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw ConnectionException(connectionFailure(what, e))
        }

    internal fun connectionFailure(what: String, failure: Exception): String = when (failure) {
        is UnmetRequirementException -> "Bluetooth is off. Turn it on, then connect again."
        is NotConnectedException -> "$what: the link closed first."
        is NoSuchElementException -> "This device has no such characteristic. Scan and connect again."
        else -> "$what (Kable: ${failure.message})."
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device
    import com.juul.kable.Peripheral
    import com.juul.kable.PlatformScanner

    // The two things the Kable adapters can't do in common code, each with one actual per platform:
    // build Kable's Scanner the way the hand-written scanners scan, and get a device's Peripheral back
    // from the id its scan reported. Part of the Kable adapters, like the httpEngine files of E1.
    internal expect fun kableScanner(): PlatformScanner

    internal expect fun kablePeripheral(device: Device): Peripheral
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.android.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.bluetooth.le.ScanSettings
    import com.example.devicemonitor.core.Device
    import com.juul.kable.ObsoleteKableApi
    import com.juul.kable.Peripheral
    import com.juul.kable.PlatformScanner
    import com.juul.kable.Scanner

    // Android: the low-latency scan AndroidBleScanner runs. Without scanSettings, Kable passes
    // Android's default settings, whose mode is low power. Kable marks scanSettings obsolete: it
    // plans a builder of its own for these settings.
    @OptIn(ObsoleteKableApi::class)
    internal actual fun kableScanner(): PlatformScanner = Scanner {
        scanSettings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    }

    // The id is the address the scan reported, as for AndroidBleConnection.
    internal actual fun kablePeripheral(device: Device): Peripheral = Peripheral(device.id)
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/KablePlatform.ios.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device
    import com.juul.kable.CentralManager
    import com.juul.kable.Peripheral
    import com.juul.kable.PlatformScanner
    import com.juul.kable.Scanner
    import com.juul.kable.toIdentifier

    // iOS: Kable makes one CBCentralManager for the app, on first use. Unless configure runs before
    // that, Kable passes no options, and iOS then shows its own alert if Bluetooth is off as the
    // manager is made. Any configure call passes ShowPowerAlert false, so the app shows its own
    // message instead, as the hand-written adapters do. configure throws once the manager exists,
    // so it runs once, first.
    private val managerSetUp = lazy { CentralManager.configure { } }

    // Kable turns off iOS's duplicate filtering unless told otherwise: an event for every
    // advertisement, which costs battery. IosBleScanner keeps iOS's default, each device once per
    // scan, and so does this.
    internal actual fun kableScanner(): PlatformScanner {
        managerSetUp.value
        return Scanner { allowDuplicateKeys = false }
    }

    // The id is the identifier the scan reported. Kable asks its manager for that peripheral, as
    // IosBleConnection asks its own, and throws NoSuchElementException if iOS doesn't know it.
    internal actual fun kablePeripheral(device: Device): Peripheral {
        managerSetUp.value
        return Peripheral(device.id.toIdentifier())
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
    import com.example.devicemonitor.adapter.outbound.KableBleConnection
    import com.example.devicemonitor.adapter.outbound.KableBleScanner
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

    // The other BLE stack: the Kable adapters, shared code that each platform doesn't build itself.
    // Listed after platformModule, its two definitions replace the platform's BleScanner and
    // BleConnection: when two modules define the same type, Koin keeps the one loaded last.
    internal val kableBleModule = module {
        single<BleScanner> { KableBleScanner(get()) }
        single<BleConnection> { KableBleConnection() }
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
                kableBleModule, // the BLE stack: delete this line for the hand-written adapters
            )
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/KableTranslationTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.CharacteristicProperty
    import com.juul.kable.DiscoveredCharacteristic
    import com.juul.kable.DiscoveredDescriptor
    import com.juul.kable.DiscoveredService
    import com.juul.kable.ExperimentalKableApi
    import com.juul.kable.NotConnectedException
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.uuid.Uuid

    // The Kable adapters' translations, without a radio: Kable's discovered services and its
    // failures, in the app's terms. Kable's discovered types are interfaces, so a test can make one.
    class KableTranslationTest {
        @OptIn(ExperimentalKableApi::class)
        private fun battery(): DiscoveredService {
            val serviceUuid = Uuid.parse("0000180f-0000-1000-8000-00805f9b34fb")
            val level = object : DiscoveredCharacteristic {
                override val serviceUuid = serviceUuid
                override val characteristicUuid = Uuid.parse("00002a19-0000-1000-8000-00805f9b34fb")
                override val descriptors = emptyList<DiscoveredDescriptor>()
                override val properties = com.juul.kable.Characteristic.Properties(0x12) // read, notify
            }
            return object : DiscoveredService {
                override val serviceUuid = serviceUuid
                override val characteristics = listOf(level)
            }
        }

        @Test
        fun aDiscoveredServiceComesInTheAppsTerms() {
            val service = battery().toDeviceService()

            assertEquals("0000180F-0000-1000-8000-00805F9B34FB", service.uuid)
            val level = service.characteristics.single()
            assertEquals(service.uuid, level.serviceUuid)
            assertEquals("00002A19-0000-1000-8000-00805F9B34FB", level.uuid)
            assertEquals(listOf(CharacteristicProperty.Read, CharacteristicProperty.Notify), level.properties)
        }

        @Test
        fun aDroppedLinkSaysWhatFailed() {
            val message = connectionFailure("The device refused the read", NotConnectedException("gone"))

            assertEquals("The device refused the read: the link closed first.", message)
        }

        @Test
        fun anyOtherFailureKeepsKablesWords() {
            val message = connectionFailure("The device refused the read", IllegalStateException("Read failed"))

            assertEquals("The device refused the read (Kable: Read failed).", message)
        }

        @Test
        fun aScanFailureKeepsKablesWords() {
            assertEquals("The scan failed (Kable: Scan failed).", scanFailure(IllegalStateException("Scan failed")))
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
    import com.example.devicemonitor.adapter.outbound.KableBleConnection
    import com.example.devicemonitor.adapter.outbound.KableBleScanner
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.BleScanner
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
    import org.koin.core.module.Module
    import org.koin.dsl.koinApplication
    import kotlin.test.AfterTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertIs
    import kotlin.test.assertNotNull
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.minutes

    class AppModuleTest {
        // Fakes stand in for the adapters each platform passes to initKoin.
        private val radio = FakeBleConnection()
        private val os = FakePermissionChecker()
        private val log = FakeLogStore()
        private val timer = FakeMonitorScheduler()
        private fun platformFakes(): Module = platformModule(
            os, FakeBleScanner(), radio,
            FakeBatteryProvider(), FakeNetworkProvider(), FakeBluetoothProvider(),
            log, timer, FakeMonitorSettings(),
        )
        private val app = koinApplication { modules(appModule, platformFakes()) }
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

        // The one Koin line of Extension E3: kableBleModule, listed after the platform's adapters,
        // replaces both BLE bindings, and the rest of the graph still builds on top of them.
        @Test
        fun kableBleModuleReplacesThePlatformsBleAdapters() {
            val withKable = koinApplication { modules(appModule, platformFakes(), kableBleModule) }
            try {
                assertIs<KableBleScanner>(withKable.koin.get<BleScanner>())
                assertIs<KableBleConnection>(withKable.koin.get<BleConnection>())
                assertNotNull(withKable.koin.get<DeviceDetailViewModel>())
            } finally {
                withKable.close()
            }
        }
    }
    ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, Koin 4.2.2). Nó là **mô hình**: các class là bản rút gọn chỉ đủ để thấy Koin chọn binding nào; Kable cần Android hoặc iOS nên không chạy được trên JVM thường.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-hai-stack-nhu-tu-nau-va-goi-o-an): hai stack như tự nấu và gọi đồ ăn (mục 1, 7, 9).
    3. [A3](#a3-mot-dong-koin-module-nap-sau-cung-thang-chay-that): một dòng Koin: module nạp sau cùng thắng, chạy thật (mục 6).
    4. [A4](#a4-chuyen-gi-oi-khi-oi-sang-kable): chuyện gì đổi khi đổi sang Kable (mục 3, 4, 8).
    5. [A5](#a5-uon-adapter-khong-uon-port): uốn adapter, không uốn port (mục 5).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. **Kable** là thư viện BLE Kotlin Multiplatform: một API coroutine phủ trên `BluetoothGatt` (Android) và CoreBluetooth (iOS).
    2. Phần mở rộng viết **một cặp adapter thứ hai** (`KableBleScanner`, `KableBleConnection`) sau **cùng** hai port `BleScanner` và `BleConnection`; vì code nền tảng đã nằm trong Kable, cả hai adapter sống trong `commonMain`.
    3. **Một dòng Koin** (`kableBleModule`, đặt cuối trong `initKoin`) chuyển cả app sang Kable; xoá dòng đó là quay về stack tự viết. App core, ViewModel, màn hình không đổi.
    4. Kable khác ở **mặc định và thời điểm**: `Connected` tới sau khi đã khám phá service, `disconnect()` chờ tới 5 s, scanner không theo dõi Bluetooth tắt giữa chừng, quét tiết kiệm pin và báo trùng trừ khi được chỉnh.
    5. Chọn thư viện khi nhu cầu BLE bình thường và team viết Kotlin; tự viết khi cần đúng hành vi của nền tảng. **Cách nào cũng giữ port.**

Ví dụ đời thường cho cả bài: bữa tối có thể **tự nấu** (stack tự viết: biết từng gia vị, sửa được món theo ý, nhưng tốn công nấu hai lần cho hai nhà bếp Android và iOS) hoặc **gọi đồ ăn** (Kable: một đơn cho cả hai, ít việc hơn, nhưng nhà hàng có công thức mặc định riêng: ít cay, giao chậm hơn chút). Cái bàn ăn (port) giữ nguyên; bạn chỉ đổi ai mang đồ ăn lên (một dòng Koin).

| Chữ trong bài | Nói đơn giản | Trong e3 là |
|---|---|---|
| Kable | thư viện BLE KMP của JuulLabs | `com.juul.kable:kable-core:0.45.0` |
| `Scanner` / `advertisements` | `Flow` các gói quảng bá; collect là quét | `KableBleScanner.scan()` |
| `Peripheral` | một thiết bị với `connect`, `read`, `observe` dạng `suspend` / `Flow` | `KableBleConnection` |
| `observe(characteristic)` | `Flow` notification; collect là bật, huỷ là tắt | được tách thành `subscribe` / `unsubscribe` |
| `kableBleModule` | module Koin bind lại hai port BLE | đặt cuối trong `initKoin` |
| "module nạp sau cùng thắng" | cùng một kiểu khai báo hai lần, cái sau ghi đè | Kable thay adapter của nền tảng |
| `allowOverride(false)` | cấm ghi đè, biến nó thành lỗi | app này **không** dùng |
| `disconnectTimeout` | Kable chờ radio báo đã ngắt tối đa bao lâu | mặc định 5 s |
| `@ObsoleteKableApi` | API Kable sắp thay, phải opt-in | `scanSettings` trên Android |

### A2. Hai stack, như tự nấu và gọi đồ ăn

Giải thích thêm cho [mục 1](#1-cung-cac-port-mot-stack-thu-hai), [mục 7](#7-hai-stack-at-canh-nhau) và [mục 9](#9-khi-nao-chon-cai-nao).

| | Tự viết (bài 13–16) | Kable (e3) |
|---|---|---|
| Số bản | Android một bản, iOS một bản (Kotlin + Swift) | một bản trong `commonMain` |
| Dòng code (không tính trống, comment, import) | 202 (Android) + 321 (iOS) = 523 | 118 cho cả hai |
| Bộ máy tự viết | `callbackFlow`, `CompletableDeferred`, receiver, delegate, đường nối Kotlin/Swift | gần như không: `suspend` và `Flow` có sẵn |
| Ai sửa bug của radio | bạn | JuulLabs (bạn không tự sửa được) |
| Phản ứng Bluetooth tắt giữa lúc quét | báo lỗi ngay | chờ hết 10 s, "No devices found" |
| Thời gian báo lỗi khi thiết bị im lặng | ~10 s | ~15 s |
| Rủi ro nâng cấp | thấp (code của bạn) | Kable 0.x còn thay đổi phá vỡ: ghim version |

Bài không chọn hộ bạn. Ý chính của mục 9: **giữ port**, để lựa chọn luôn rẻ.

### A3. Một dòng Koin: module nạp sau cùng thắng, chạy thật

Giải thích thêm cho [mục 6](#6-mot-dong-koin). Ba module rút gọn như trong bài: `platformModule` bind `BleScanner` với adapter tự viết, `kableBleModule` bind lại nó với Kable, và `appModule` có một `ScanningService` xin `BleScanner`. Dựng Koin theo ba thứ tự, có và không có `app.close()` sau mỗi lần:

```kotlin title="le3/Main.kt (mô hình, không có trong app)"
val platformModule = module {
    single<BleScanner> { AndroidBleScanner() }
    single<BluetoothProvider> { AndroidBluetoothProvider() }
}
val appModule = module { single { ScanningService(get()) } }
val kableBleModule = module { single<BleScanner> { KableBleScanner(get()) } }

fun scannerWith(vararg order: org.koin.core.module.Module, close: Boolean): String {
    val app = koinApplication { modules(*order) }
    val name = app.koin.get<ScanningService>().scanner.name
    if (close) app.close()
    return name
}

fun main() {
    for (close in listOf(true, false)) {
        println("-- close() sau mỗi lần dựng: $close")
        println("appModule, platformModule, kableBleModule -> " + scannerWith(appModule, platformModule, kableBleModule, close = close))
        println("appModule, platformModule                 -> " + scannerWith(appModule, platformModule, close = close))
        println("appModule, kableBleModule, platformModule -> " + scannerWith(appModule, kableBleModule, platformModule, close = close))
    }
    try {
        koinApplication { allowOverride(false); modules(appModule, platformModule, kableBleModule) }
        println("allowOverride(false) -> không lỗi")
    } catch (e: Exception) {
        println("allowOverride(false) -> ${e::class.simpleName}: ${e.message?.take(90)}")
    }
}
```

Output thật:

```text
-- close() sau mỗi lần dựng: true
appModule, platformModule, kableBleModule -> KableBleScanner
appModule, platformModule                 -> AndroidBleScanner (tự viết)
appModule, kableBleModule, platformModule -> AndroidBleScanner (tự viết)
-- close() sau mỗi lần dựng: false
appModule, platformModule, kableBleModule -> KableBleScanner
appModule, platformModule                 -> KableBleScanner
appModule, kableBleModule, platformModule -> KableBleScanner
allowOverride(false) -> DefinitionOverrideException: Already existing definition for [Singleton: 'le3.BleScanner'] at le3.BleScanner::_root_
```

1. **Có `close()`**: đúng như bài nói. Kable đứng cuối thì thắng; bỏ dòng Kable thì về adapter tự viết; đặt Kable **trước** `platformModule` thì adapter tự viết thắng. Thứ tự trong `modules(...)` chính là công tắc.
2. **Không có `close()`**: cả ba lần đều ra Kable. Đây là gotcha của [bài 17](../17-trang-thai-may-va-kho-log/): Koin 4.2.2 giữ instance của `single` **ngay trong object module**, và `appModule` là một `val` dùng chung, nên `ScanningService` dựng ở lần đầu bị dùng lại cho các lần sau. Trong app chỉ có một Koin mỗi process nên không gặp; trong test dựng nhiều Koin trên cùng module thì **phải** `close()`.
3. **`allowOverride(false)`** biến việc ghi đè thành `DefinitionOverrideException` ngay lúc khởi động. App này cố tình dựa vào việc ghi đè, nên không bật nó; test graph ghim rằng Kable thắng.

So với TS/JS: giống `Object.assign({}, platformBindings, kableBindings)`: khoá trùng thì bên phải thắng; đổi thứ tự tham số là đổi kết quả.

### A4. Chuyện gì đổi khi đổi sang Kable

Giải thích thêm cho [mục 3](#3-scanner-mot-flow-co-san), [mục 4](#4-ket-noi-treo-ung-goi-lai) và [mục 8](#8-thuc-te-xay-ra-gi-cac-lan-chay-ung-sau-trang-nay).

| Chỗ | Tự viết | Kable | Vì sao |
|---|---|---|---|
| chế độ quét Android | `LOW_LATENCY` | `LOW_POWER` nếu để mặc định | adapter đặt lại `LOW_LATENCY` qua `scanSettings` |
| báo trùng trên iOS | tắt (mặc định Apple) | bật nếu để mặc định | adapter đặt `allowDuplicateKeys = false` |
| alert "Bluetooth đang tắt" của iOS | không hiện | hiện nếu không `configure` | adapter gọi `CentralManager.configure { }` trước lần dùng đầu |
| lúc báo `Connected` | liên kết lên | liên kết lên **và** khám phá xong | `connect()` của Kable gộp khám phá |
| lỗi khi thiết bị im lặng | ~10 s | ~15 s | `disconnect()` chờ `disconnectTimeout` 5 s |
| Bluetooth tắt giữa lúc quét | lỗi ngay (receiver) | hết 10 s rồi "No devices found" | scanner của Kable không theo dõi radio sau khi bắt đầu |
| Vị trí tắt (Android ≤ 11) | "No devices found" | lỗi rõ ràng | Kable kiểm tra trước khi quét |

Ví dụ đời thường cho dòng "~15 s": bạn gọi taxi, chờ 10 phút không thấy, bấm huỷ. Tổng đài tự viết huỷ ngay. Tổng đài của Kable thì **chờ tài xế xác nhận đã huỷ** tối đa 5 phút nữa rồi mới báo bạn; vì tài xế không bao giờ nhận cuộc gọi đầu, xác nhận cũng không bao giờ tới, nên bạn luôn chờ đủ 5 phút đó.

Bài học chung của mục 9: phần lớn khác biệt là **mặc định**. Adapter là chỗ đặt lại mặc định cho hợp với app.

### A5. Uốn adapter, không uốn port

Giải thích thêm cho [mục 5](#5-notification-mot-flow-tach-thanh-cac-request).

| | Kable cho | Port (từ bài 16) đòi | Adapter làm |
|---|---|---|---|
| Bật notification | collect `observe(c)` | `suspend fun subscribe(c)` trả về khi thiết bị đã chấp nhận | launch việc collect trong scope của liên kết, hoàn tất một `CompletableDeferred` trong `onSubscription` |
| Các giá trị | chính `Flow` đó | `fun notifications(c): Flow<ByteArray>`, collect trước | đẩy vào một `MutableSharedFlow`, lọc theo hai UUID |
| Tắt | huỷ việc collect | `suspend fun unsubscribe(c)` | `cancelAndJoin()` job đó (chờ Kable ghi CCCD) |
| Khi liên kết rớt | flow **sống tiếp**, nối lại sau | các giá trị **kết thúc** | collect trong scope mà `connect()` trả về, scope đó bị huỷ khi ngắt |

Vì sao không đổi port cho khớp Kable? Vì khi đó adapter tự viết, fake, `SessionService` đều phải đổi, và khoá mỗi-lần-một-request của session không còn bao lần ghi CCCD (Android sẽ từ chối vì bận, bài 15–16). Port nói bằng ngôn ngữ của app; thư viện phải thích nghi, không phải ngược lại.

So với TS/JS: giống bọc một `Observable` của RxJS thành `subscribe(): Promise<void>` + `values$: Subject` để khớp với interface sẵn có của bạn, thay vì sửa interface theo RxJS.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là xong E3, và là xong cả khoá.

- [ ] Giải thích vì sao adapter Kable sống được trong `commonMain` còn adapter tự viết thì không.
- [ ] Thêm Kable vào build, ghim version, và kiểm manifest đã gộp không có quyền mới.
- [ ] Viết `KableBleScanner` dịch `advertisements` sang `Device` và lỗi của Kable sang `ScanException`, lấy `isAvailable` / `isEnabled` từ `BluetoothProvider`.
- [ ] Đặt lại các mặc định của Kable cho khớp app: `LOW_LATENCY`, không báo trùng, `configure` trước lần dùng đầu (xem [A4](#a4-chuyen-gi-oi-khi-oi-sang-kable)).
- [ ] Viết `KableBleConnection` với `flow { }`, `finally` gồm `disconnect()` dưới `NonCancellable` rồi `close()`, và nói vì sao lỗi tới muộn 5 s.
- [ ] Tách `observe` của Kable thành `subscribe` / `unsubscribe` / `notifications` mà không đổi port (xem [A5](#a5-uon-adapter-khong-uon-port)).
- [ ] Chuyển cả app giữa hai stack bằng một dòng Koin, và giải thích "module nạp sau cùng thắng" (xem [A3](#a3-mot-dong-koin-module-nap-sau-cung-thang-chay-that)).
- [ ] Giải thích vì sao lần chạy giả lập của bài 20 không còn tác dụng khi có dòng Kable.
- [ ] So sánh hai stack về dòng code, trạng thái kết nối, lỗi và iOS, và nói khi nào chọn cái nào (xem [A2](#a2-hai-stack-nhu-tu-nau-va-goi-o-an)).
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
