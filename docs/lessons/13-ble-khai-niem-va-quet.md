---
source: lessons/13-ble-concepts-and-scan.html
source_ref: live
source_sha: ef7038c
---

# BLE: khái niệm và quét

<p class="kicker">Bài 13 · Tuần 3 · Ngày 13 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/13-ble-concepts-and-scan.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m08 quét một peripheral thật vào danh sách</span>
  <span class="tag">Cần trước: <a href="../12-quyen-truy-cap/">12</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Cho tới hôm nay, danh sách hiện năm thiết bị giả từ `SimulatedBleScanner`. Hôm nay app nghe một radio Bluetooth Low Energy (BLE) thật.
    Trước hết bạn học những chữ mà bốn bài tiếp theo dùng: central và peripheral, GATT, service, characteristic, UUID, và read, write, notify, indicate. Rồi bạn cài LightBlue trên Mac làm một peripheral để tìm, và viết hai outbound adapter `BleScanner` thật: Kotlin trên `BluetoothLeScanner` và `callbackFlow` ở Android, và một class Swift trên `CBCentralManager` ở iOS.
    Scanning service nhận thêm các luật mà một radio thật cần: quyền, có radio, và Bluetooth đang bật. Màn hình có thêm nút Stop bên cạnh một timeout 10 giây. ViewModel vẫn chỉ gọi `DeviceScanning`, và nó không bao giờ biết radio đã thành thật. Đó là milestone **m08**.

!!! info "Nguồn chính"
    Trang [Bluetooth Low Energy overview](https://developer.android.com/develop/connectivity/bluetooth/ble/ble-overview) của Android, phần "Key terms and concepts", đọc trước mục 1, và trang [Find BLE devices](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices) của nó trước mục 5. Với iOS, trang [CBCentralManager](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager) của Apple trước mục 6.

!!! info "Track"
    Phần lớn bài này giống nhau trên mọi track: các khái niệm, port, service, cả hai radio và các test (mục 1–6 và 9). Các track khác nhau ở hai chỗ nhỏ. Lúc app khởi động, mỗi nền tảng truyền radio của mình cho Koin (mục 7). Mỗi màn hình biến nút Scan thành Stop trong lúc quét, và danh sách UIKit thôi đọc các hàng của nó từ các thiết bị mẫu (mục 8).
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## Thay đổi so với m07

<table>
<tr><th>Cái gì</th><th>m07</th><th>m08</th></tr>
<tr><td>radio</td><td><code>SimulatedBleScanner</code>, năm thiết bị mẫu</td><td><code>AndroidBleScanner</code> (Kotlin, <code>androidMain</code>) và <code>IosBleScanner</code> (Swift, app iOS), cộng <code>ScanFlow.kt</code> trong <code>iosMain</code>. Radio giả vẫn ở trong code, không dùng</td></tr>
<tr><td>port <code>BleScanner</code></td><td><code>scan()</code></td><td>thêm <code>isAvailable()</code> và <code>isEnabled()</code></td></tr>
<tr><td><code>ScanningService</code></td><td>lọc theo tên, mỗi thiết bị một lần</td><td>trước hết kiểm tra quyền, radio và Bluetooth; bỏ qua thiết bị không quảng cáo tên</td></tr>
<tr><td>màn hình</td><td>Scan; một lần quét kết thúc sau 3 s</td><td>Scan thành Stop trong lúc quét; một lần quét kết thúc sau 10 s</td></tr>
<tr><td>khởi động Koin</td><td><code>initKoin(permissionChecker)</code></td><td><code>initKoin(permissionChecker, bleScanner)</code></td></tr>
<tr><td>manifest Android</td><td>các quyền Bluetooth</td><td>thêm <code>&lt;uses-feature … bluetooth_le … required="false"&gt;</code></td></tr>
<tr><td>test</td><td>16 trên mỗi nền tảng</td><td>20 trên mỗi nền tảng: 3 mới cho scanning service, 1 mới cho ViewModel</td></tr>
</table>

## 1. BLE trong vài câu

Trước hết là hai vai. Trang tổng quan của Android: "thiết bị ở vai central quét, tìm quảng cáo, và thiết bị ở vai peripheral phát quảng cáo." Device Monitor là một **central**. Thứ nó tìm (một cảm biến, một adapter xe hơi, hay hôm nay là LightBlue trên Mac của bạn) là một **peripheral**. Một peripheral phát ra những **quảng cáo** (advertisement) ngắn cho bất kỳ ai đang nghe. Một quảng cáo có thể mang một cái tên, và đó là cách danh sách của chúng ta hiện tên thiết bị.

Khi central đã kết nối (bài 14), một cặp vai thứ hai thay vào: "Thiết bị ở vai client gửi yêu cầu lấy dữ liệu, và thiết bị ở vai server đáp ứng chúng". Điện thoại là **GATT client**, peripheral là **GATT server**. GATT là "một đặc tả chung cho việc gửi và nhận những mẩu dữ liệu ngắn gọi là 'attribute' qua một liên kết BLE" ([BLE overview](https://developer.android.com/develop/connectivity/bluetooth/ble/ble-overview)). Dữ liệu của nó là một cây nhỏ:

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 340" role="img" aria-labelledby="l13-gatt-title">
<title id="l13-gatt-title">Central và peripheral, và thứ một peripheral chứa. Bên trái, điện thoại chạy Device Monitor là central: ở bài 13 nó quét và nghe các quảng cáo; từ bài 14 nó kết nối và trở thành GATT client. Bên phải, Mac chạy LightBlue là peripheral: nó phát quảng cáo, và khi đã kết nối thì nó là GATT server. Một mũi tên từ peripheral sang central mang các quảng cáo, có thể kèm một cái tên. Một mũi tên thứ hai, nét đứt, giữa chúng là kết nối của bài 14, với các yêu cầu đi từ client sang server. Bên dưới peripheral, dữ liệu GATT của nó là một cây: một service, nhận diện bằng một UUID, chứa các characteristic. Mỗi characteristic có UUID riêng, một giá trị và một tập thuộc tính; ví dụ cho thấy một cái có Read, dùng ở bài 15, và một cái có Notify, dùng ở bài 16. Một characteristic cũng có thể chứa các descriptor.</title>
<defs><marker id="l13-gatt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="box" x="20" y="30" width="230" height="86" rx="8"/>
<text class="title" x="34" y="54">Điện thoại: Device Monitor</text>
<text class="small" x="34" y="76">central: quét (bài 13)</text>
<text class="small" x="34" y="96">GATT client khi đã kết nối (14)</text>
<rect class="box" x="510" y="30" width="230" height="86" rx="8"/>
<text class="title" x="524" y="54">Mac: LightBlue</text>
<text class="small" x="524" y="76">peripheral: phát quảng cáo</text>
<text class="small" x="524" y="96">GATT server khi đã kết nối</text>
<path class="edge" d="M508,58 L252,58" marker-end="url(#l13-gatt-arrow)"/>
<text class="small" x="300" y="50">quảng cáo: một cái tên, có thể hơn</text>
<path class="edge dashed" d="M252,92 L508,92" marker-end="url(#l13-gatt-arrow)"/>
<text class="small" x="300" y="110">kết nối, các yêu cầu (bài 14–16)</text>
<rect class="box" x="430" y="150" width="310" height="44" rx="6"/>
<text class="mono small" x="442" y="170">Service</text>
<text class="small muted" x="442" y="186">một UUID; gom các characteristic</text>
<rect class="box" x="470" y="208" width="270" height="56" rx="6"/>
<text class="mono small" x="482" y="228">Characteristic · UUID</text>
<text class="small muted" x="482" y="246">một giá trị · thuộc tính: Read (bài 15)</text>
<rect class="box" x="470" y="274" width="270" height="56" rx="6"/>
<text class="mono small" x="482" y="294">Characteristic · UUID</text>
<text class="small muted" x="482" y="312">một giá trị · thuộc tính: Notify (bài 16)</text>
<path class="edge" d="M625,116 L625,148" marker-end="url(#l13-gatt-arrow)"/>
<path class="edge" d="M450,194 L450,236 L468,236" marker-end="url(#l13-gatt-arrow)"/>
<path class="edge" d="M450,236 L450,302 L468,302" marker-end="url(#l13-gatt-arrow)"/>
<text class="small muted" x="20" y="170">Phần bài này chạm tới:</text>
<text class="small muted" x="20" y="190">chỉ mũi tên trên cùng. Quét</text>
<text class="small muted" x="20" y="210">là nghe quảng cáo, không bao</text>
<text class="small muted" x="20" y="230">giờ kết nối, nên service và</text>
<text class="small muted" x="20" y="250">characteristic vẫn chưa thấy</text>
<text class="small muted" x="20" y="270">cho tới bài 15.</text>
</svg>
<figcaption>Các chữ của bài này, và bài nào sau này dùng từng chữ.</figcaption>
</figure>

1. **Service**: "một tập hợp các characteristic", ví dụ một service nhịp tim.
2. **Characteristic**: nó "chứa một giá trị duy nhất và 0-n descriptor mô tả giá trị của characteristic." **Descriptor** mô tả giá trị đó, ví dụ "một mô tả người đọc được, một khoảng giá trị chấp nhận được cho giá trị của characteristic, hoặc một đơn vị đo".
3. **UUID**: mỗi attribute "được nhận diện duy nhất bằng một Universally Unique Identifier (UUID), là một định dạng 128-bit chuẩn hoá" (cả ba câu: [BLE overview](https://developer.android.com/develop/connectivity/bluetooth/ble/ble-overview)). Bluetooth SIG công bố các UUID hay dùng, "nhiều cái trong số đó dài 16 hoặc 32 bit cho tiện". Một UUID ngắn đại diện cho một UUID đầy đủ dựng trên Bluetooth base UUID, `00000000-0000-1000-8000-00805F9B34FB`: "Core Bluetooth điền sẵn phần còn lại của UUID 128-bit bằng Bluetooth base UUID" ([CBUUID](https://developer.apple.com/documentation/corebluetooth/cbuuid)). SDK công khai của Android không có hằng số cho base UUID, nên trên Android bạn viết dạng 128-bit đầy đủ.

**Thuộc tính** (properties) của một characteristic nói central được làm gì với giá trị của nó. Mô tả của Apple, từ header `CBCharacteristic.h` của CoreBluetooth và tài liệu [CBCharacteristicProperties](https://developer.apple.com/documentation/corebluetooth/cbcharacteristicproperties):

<table>
<tr><th>Thuộc tính</th><th>Cho phép gì</th><th>Trong khoá này</th></tr>
<tr><td>read</td><td>"Cho phép đọc giá trị characteristic."</td><td>bài 15</td></tr>
<tr><td>write</td><td>"Cho phép ghi giá trị characteristic." Write without response: như vậy, nhưng "không có phản hồi".</td><td>không dùng (Phụ lục A.3 của kế hoạch khoá học chỉ yêu cầu hiểu nó)</td></tr>
<tr><td>notify</td><td>peripheral tự gửi giá trị mới, "không có phản hồi từ central để báo đã nhận thông báo"</td><td>bài 16</td></tr>
<tr><td>indicate</td><td>như vậy, nhưng "có phản hồi từ central để báo đã nhận"</td><td>không dùng; nó hoạt động như notify</td></tr>
</table>

Cuối cùng, **trạng thái kết nối**. Cả hai nền tảng gọi tên cùng bốn trạng thái: `BluetoothProfile` của Android có `STATE_DISCONNECTED`, `STATE_CONNECTING`, `STATE_CONNECTED` và `STATE_DISCONNECTING`, và `CBPeripheralState` của iOS có `disconnected`, `connecting`, `connected` và `disconnecting`. Bài 14 biến chúng thành `ConnectionState` riêng của app core. Một lần quét không có thứ nào trong số đó: nó chỉ nghe.

## 2. Vì sao BLE cần thiết bị thật, và LightBlue

Chúng tôi đã chạy app hoàn chỉnh của bài này trên những công cụ bạn có trên Mac. Không cái nào tìm được peripheral mà bài nói tới:

<table>
<tr><th>Ở đâu</th><th>Radio báo gì</th><th>App hiện gì sau khi bấm Scan</th></tr>
<tr><td>iOS 26.2 Simulator</td><td>không có radio BLE (state của manager là <code>unsupported</code>)</td><td>"Scan failed: This phone has no Bluetooth LE radio."</td></tr>
<tr><td>Emulator Android, image API 36</td><td>Bluetooth bật; lần quét chạy 10 s (<code>adb shell dumpsys bluetooth_manager</code>: một lần quét <code>LOW_LATENCY</code>, 0 kết quả)</td><td>"No devices found. Try another filter."</td></tr>
<tr><td>Emulator Android, image API 30</td><td>hai beacon giả lập, <code>gDevice-beacon</code> ở <code>BE:AC:10:00:00:01</code> và <code>…:02</code></td><td>"Devices found: 2"</td></tr>
</table>

Bluetooth của emulator là giả lập: emulator của Android "có một bộ giả lập mạng cho phép bạn phát triển và test app Android mà không cần radio vật lý" ([Advanced emulator networking](https://developer.android.com/studio/run/emulator-networking-advanced)). Nó không nghe được Mac của bạn. Nên mọi thứ trong bài này có dính tới một peripheral thật đều chạy trên **một điện thoại Android thật và một iPhone thật**. Emulator và Simulator vẫn kiểm tra phần còn lại: các test, các thông báo lỗi, Stop và timeout.

Peripheral là **LightBlue**, một app miễn phí của Punch Through. Trên Mac nó có thể "Phát quảng cáo như một peripheral tuỳ chỉnh để giả lập thiết bị của bạn", từ một profile mà bạn "Clone … hoặc dựng … từ đầu" ([LightBlue trên App Store](https://apps.apple.com/us/app/lightblue/id557428110); cần macOS 13.3 trở lên). Cài nó một lần:

1. Cài LightBlue trên Mac từ App Store và mở nó. Cho phép Bluetooth khi macOS hỏi.
2. Trong danh sách Virtual Devices của nó, thêm một thiết bị ảo bằng **+** và chọn một profile. Chọn profile có một characteristic có thuộc tính Read và một cái có Notify (LightBlue liệt kê thuộc tính của từng characteristic): bài 15 và 16 dùng chúng.
3. Đảm bảo thiết bị ảo được tick: "khi dấu tick xanh của một thiết bị được bật, Mac của bạn đang phát quảng cáo như peripheral BLE đó" (trang App Store).

Điện thoại của bạn thấy tên nào là tuỳ LightBlue đặt gì vào quảng cáo. Để tìm hàng của Mac: quét với bộ lọc rỗng, ghi lại các hàng, tắt thiết bị ảo trong LightBlue, chờ vài giây rồi quét lại. Hàng biến mất là Mac của bạn. Rồi gõ một phần tên của nó làm bộ lọc.

## 3. Port lớn thêm

Một radio thật có thể không có (Simulator) hoặc bị tắt (người dùng). App cần biết trước khi quét, nên `BleScanner` có thêm hai câu hỏi. Như Phụ lục A.3 của kế hoạch khoá học viết, `isAvailable()` và `isEnabled()` "đến cùng với các radio thật":

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleScanner.kt" hl_lines="4 6 9 12 14"
⋯ package and imports: core.Device, Flow
// Outbound port: what the app needs from a Bluetooth radio, in the app's own terms.
// One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
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

1. **Vì sao `suspend`?** Android trả lời ngay, nhưng iOS thì không. State của một `CBCentralManager` mới "ban đầu được đặt là `CBManagerStateUnknown`", nghĩa là "State chưa biết, sắp cập nhật", và bản cập nhật tới sau, trong một callback của delegate (`CBManager.h` của CoreBluetooth). Một hàm suspend cho adapter iOS chờ nó mà không chặn main thread. Port được thiết kế theo nền tảng chậm hơn, và nền tảng nhanh hơn không bận tâm.
2. **"Cùng một thiết bị có thể tới lần nữa."** Ở m07 comment hứa một thiết bị tới "lần nữa với mỗi quảng cáo nó nghe được". Điều đó đúng trên Android, nhưng iOS mặc định chỉ báo mỗi peripheral một lần cho mỗi lần quét: trừ khi app yêu cầu khác, "central gộp nhiều lần phát hiện cùng một peripheral thành một sự kiện phát hiện duy nhất" ([CBCentralManagerScanOptionAllowDuplicatesKey](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerscanoptionallowduplicateskey)). Giờ port chỉ hứa điều mà cả hai radio làm. Luật "mỗi thiết bị một lần" của service thì kiểu nào cũng được.
3. **`name = ""`** giữ `Device` như cũ. Nhiều peripheral không quảng cáo tên nào cả, và port nói rõ trường hợp đó trông thế nào, thay vì để mỗi adapter tự bịa một chuỗi thay thế.

## 4. Service sở hữu các luật quét

App có nên quét ngay bây giờ không? Đó là một luật của app, giống nhau trên cả hai nền tảng, nên nó vào `ScanningService`, cạnh bộ lọc:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanningService.kt" hl_lines="1 3 6 10 19 22 23"
class ScanningService(
    private val scanner: BleScanner,
    private val permissions: PermissionChecker,
) : DeviceScanning {
    override fun scan(nameFilter: String): Flow<Device> = flow {
        checkReady()
        val wanted = nameFilter.trim()
        val seen = mutableSetOf<String>()
        scanner.scan().collect { device ->
            val named = device.name.isNotBlank()
            if (named && device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                emit(device)
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
}
```

1. **Một service có thể dùng nhiều outbound port.** Giờ `ScanningService` cần `PermissionChecker` (outbound port của bài 12) cũng như `BleScanner`. Nó hỏi outbound port, không hỏi `PermissionAccess`: một service gọi outbound port, và chỉ inbound adapter mới gọi inbound port.
2. **Vì sao kiểm tra quyền ở đây, khi màn hình đã disable nút Scan?** Disable một nút là việc trình bày, và màn hình tiếp theo có thể quên. `startScan` của Android được khai báo `@RequiresPermission(BLUETOOTH_SCAN)`, và trên iOS lần dùng radio đầu tiên là thứ hiện hộp hỏi quyền (bài 12). Luật "không bao giờ chạm vào radio khi chưa có quyền" thuộc về nơi mọi lời gọi đều phải đi qua.
3. **Thứ tự quan trọng trên iOS.** `isAvailable()` tạo `CBCentralManager` của adapter iOS. Nếu quyền chưa được cấp, việc đó sẽ hiện hộp hỏi của hệ thống khi chưa có nút nào được bấm.
4. **Các lỗi là `ScanException`**, và chúng được ném bên trong `flow { }`, nên chúng tới collector y như một lỗi radio: `catch` sẵn có của ViewModel biến mỗi cái thành alert "Scan failed". Không code UI nào đổi cho ba thông báo mới.
5. **Bỏ qua thiết bị không tên** là luật của app này: người dùng tìm thiết bị theo tên, nên một hàng không tên là nhiễu. Đó không phải việc của radio, nên nó không nằm trong các adapter.

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 330" role="img" aria-labelledby="l13-hex-title">
<title id="l13-hex-title">Ai nói chuyện với ai khi người dùng bấm Scan. Màn hình gọi DeviceListViewModel, một inbound adapter, và nó gọi inbound port DeviceScanning. ScanningService trong app core implement port đó. Trước khi quét, nó hỏi hai outbound port: PermissionChecker về quyền, và BleScanner xem có radio và radio có đang bật không; rồi nó collect BleScanner.scan(). Hai outbound adapter implement BleScanner: AndroidBleScanner, Kotlin trong androidMain trên BluetoothLeScanner; và IosBleScanner, Swift trong app iOS trên CBCentralManager, lấy Flow của nó từ ScanFlow.kt, Kotlin trong iosMain. Trong test, FakeBleScanner và FakePermissionChecker đứng thay các adapter.</title>
<defs><marker id="l13-hex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="android">
<rect class="box" x="10" y="30" width="130" height="50" rx="6"/>
<text class="title small" x="20" y="50">Màn hình Android</text>
<text class="small muted" x="20" y="68">Compose · XML</text>
</g>
<g data-part="ios">
<rect class="box" x="10" y="100" width="130" height="50" rx="6"/>
<text class="title small" x="20" y="120">Màn hình iOS</text>
<text class="small muted" x="20" y="138">SwiftUI · UIKit</text>
</g>
<g data-part="inbound">
<rect class="box" x="170" y="62" width="130" height="56" rx="6"/>
<text class="mono small" x="180" y="84">DeviceList</text>
<text class="mono small" x="180" y="100">ViewModel</text>
</g>
<g data-part="core">
<polygon class="box" points="320,90 350,20 560,20 590,90 560,160 350,160"/>
<text class="title" x="455" y="40" text-anchor="middle">App core</text>
<rect class="box" x="400" y="62" width="110" height="44" rx="6"/>
<text class="mono small" x="408" y="80">Scanning</text>
<text class="mono small" x="408" y="96">Service</text>
</g>
<g data-part="inbound">
<rect class="box" x="300" y="128" width="110" height="26" rx="6"/>
<text class="mono small" x="306" y="146">DeviceScanning</text>
</g>
<g data-part="outbound">
<rect class="box" x="574" y="40" width="130" height="26" rx="6"/>
<text class="mono small" x="580" y="58">PermissionChecker</text>
<rect class="box" x="490" y="128" width="96" height="26" rx="6"/>
<text class="mono small" x="498" y="146">BleScanner</text>
<rect class="box" x="520" y="196" width="230" height="50" rx="6"/>
<text class="mono small" x="530" y="216">AndroidBleScanner</text>
<text class="small muted" x="530" y="234">Kotlin, androidMain · BluetoothLeScanner</text>
<rect class="box" x="520" y="262" width="230" height="56" rx="6"/>
<text class="mono small" x="530" y="282">IosBleScanner</text>
<text class="small muted" x="530" y="300">Swift, app iOS · CBCentralManager</text>
<text class="small muted" x="530" y="314">+ ScanFlow.kt, Kotlin trong iosMain</text>
<rect class="box" x="300" y="262" width="190" height="56" rx="6"/>
<text class="mono small" x="310" y="282">FakeBleScanner</text>
<text class="mono small" x="310" y="298">FakePermissionChecker</text>
<text class="small muted" x="310" y="312">commonTest</text>
</g>
<path class="edge" d="M140,55 L168,80" marker-end="url(#l13-hex-arrow)"/>
<path class="edge" d="M140,125 L168,102" marker-end="url(#l13-hex-arrow)"/>
<path class="edge" d="M235,118 L300,140" marker-end="url(#l13-hex-arrow)"/>
<path class="edge dashed" d="M420,106 L390,126" marker-end="url(#l13-hex-arrow)"/>
<path class="edge" d="M510,72 L572,56" marker-end="url(#l13-hex-arrow)"/>
<path class="edge" d="M500,106 L530,126" marker-end="url(#l13-hex-arrow)"/>
<text class="small" x="596" y="96">1. có quyền?</text>
<text class="small" x="596" y="112">2. có radio? đang bật?</text>
<text class="small" x="596" y="128">3. scan()</text>
<path class="edge dashed" d="M600,196 L560,156" marker-end="url(#l13-hex-arrow)"/>
<path class="edge dashed" d="M560,262 L548,156" marker-end="url(#l13-hex-arrow)"/>
<path class="edge dashed" d="M400,262 L520,156" marker-end="url(#l13-hex-arrow)"/>
</svg>
<figcaption>Mũi tên liền là lời gọi; mũi tên nét đứt chỉ vào một port nghĩa là "implement" (mỗi fake của test implement port của riêng nó: <code>FakeBleScanner</code> implement <code>BleScanner</code>, <code>FakePermissionChecker</code> implement <code>PermissionChecker</code>). Các con số là thứ tự của service.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound (port và adapter)</li><li data-part="outbound">Outbound (port và adapter)</li><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

## 5. Radio Android: `callbackFlow`

Hướng dẫn của Android: "Để tìm thiết bị BLE, bạn dùng phương thức `startScan()`. Phương thức này nhận một `ScanCallback` làm tham số. Bạn phải implement callback này, vì đó là cách kết quả quét được trả về" ([Find BLE devices](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)). Port muốn một `Flow`. Trước hết là hai câu hỏi:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleScanner.kt" hl_lines="4 6 9 11"
⋯ package and imports: android.bluetooth.*, android.bluetooth.le.*, android.content.*, ContextCompat, callbackFlow
// Outbound adapter: the phone's Bluetooth LE radio, behind the BleScanner port.
// BluetoothLeScanner reports to a callback object; callbackFlow turns those calls into a Flow.
class AndroidBleScanner(private val context: Context) : BleScanner {
    private val adapter: BluetoothAdapter? =
        context.getSystemService(BluetoothManager::class.java)?.adapter

    override suspend fun isAvailable(): Boolean =
        adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)

    override suspend fun isEnabled(): Boolean = adapter?.isEnabled == true
⋯ scan(): below
```

1. **Không có adapter thì không có Bluetooth**: "Nếu `getAdapter()` trả về null thì thiết bị không hỗ trợ Bluetooth." Và "Gọi `isEnabled()` để kiểm tra Bluetooth hiện có đang bật không" ([Set up Bluetooth](https://developer.android.com/develop/connectivity/bluetooth/setup)).
2. **`FEATURE_BLUETOOTH_LE`**: Bluetooth Classic và BLE là hai feature riêng. Trang quyền của Android cho thấy phép kiểm tra lúc chạy này, dành cho những app khai báo feature với `required="false"` ([Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)). Giờ manifest khai báo như vậy, nên một điện thoại không có BLE vẫn cài được app và nhận thông báo "no Bluetooth LE radio":

```xml title="androidApp/src/main/AndroidManifest.xml (both Android tracks)" hl_lines="4"
⋯ the Bluetooth permissions: as in m07
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <!-- The app uses Bluetooth LE but still installs without it, and checks at run time. -->
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
⋯ <application>: as in m07
```

Hướng dẫn cảnh báo `required="true"` sẽ làm gì: "Google Play store sẽ ẩn app của bạn khỏi người dùng trên những thiết bị thiếu các feature đó". Giờ tới chính việc quét:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleScanner.kt" hl_lines="3 4 5 7 8 12 17 19"
    // ScanningService checks the permission before every scan, so lint's check is suppressed.
    @SuppressLint("MissingPermission")
    override fun scan(): Flow<Device> = callbackFlow {
        val scanner = adapter?.bluetoothLeScanner ?: throw ScanException("Bluetooth is off.")
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val name = result.scanRecord?.deviceName.orEmpty()
                trySend(Device(id = result.device.address, name = name, rssi = result.rssi))
            }

            override fun onScanFailed(errorCode: Int) {
                close(ScanException("The scan failed (Android error $errorCode)."))
            }
        }
⋯ the Bluetooth-off receiver: below
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        scanner.startScan(null, settings, callback)

        awaitClose {
⋯ unregister the receiver and stop the scan: below
        }
    }
```

1. **`callbackFlow`** là cây cầu của Kotlin từ callback sang `Flow`. Khối của nó chạy mỗi lần có ai collect, và `ProducerScope` mà nó nhận "có thể dùng từ bất kỳ context nào, ví dụ từ một API dựa trên callback" ([callbackFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/callback-flow.html)). Ở bài 01, `emit(device)` đẩy từng thiết bị. Ở đây callback của radio đẩy nó, bằng `trySend`.
2. **`trySend`, không phải `send`**: một callback không phải coroutine, nên nó không suspend được. `trySend` "không bao giờ suspend và không bao giờ ném exception". Nếu buffer của channel đầy, phần tử bị bỏ. Mất một quảng cáo cũng không sao: radio sẽ nghe thiết bị đó lần nữa.
3. **`awaitClose`** giữ flow mở cho tới khi collector huỷ, rồi chạy phần dọn dẹp. Tài liệu bắt buộc nó: "Dùng awaitClose là bắt buộc để tránh rò rỉ bộ nhớ khi việc collect flow bị huỷ, nếu không callback có thể tiếp tục chạy ngay cả khi collector của flow đã xong." Nên huỷ job quét của ViewModel rốt cuộc dẫn tới đây, và ở đây radio dừng.
4. **`close(ScanException(…))`** kết thúc flow bằng một lỗi: "Nếu cause khác null, nó sẽ được ném ra … từ mọi lần thử nhận từ channel sau khi không còn phần tử nào" ([close](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-send-channel/close.html)). Nó đi ngược lên qua service tới `catch` của ViewModel. `onScanFailed` nhận một mã lỗi, là một trong các hằng `SCAN_FAILED_*` của `ScanCallback`, ví dụ 1, "BLE scan with the same settings is already started by the app" (app đã bắt đầu một lần quét BLE với cùng thiết lập).
5. **`bluetoothLeScanner` có thể null**: "Nếu Bluetooth không bật thì `getBluetoothLeScanner()` trả về null" ([Find BLE devices](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)). Service vừa kiểm tra một lúc trước, nhưng người dùng có thể tắt nó ở giữa.
6. **`scanRecord?.deviceName`** là tên trong quảng cáo, "tên local của thiết bị BLE". `BluetoothDevice.getName()` cũng được, nhưng nó được khai báo `@RequiresPermission(BLUETOOTH_CONNECT)`, và việc quét không nên cần quyền kết nối. `id` là địa chỉ của thiết bị, ví dụ "00:11:22:AA:BB:CC" (tài liệu của `BluetoothDevice.getAddress()`).
7. **`SCAN_MODE_LOW_LATENCY`**: "Quét với duty cycle cao nhất. Chỉ nên dùng chế độ này khi app đang chạy ở foreground." Lần quét của chúng ta chạy từ một màn hình, tối đa 10 giây.
8. **`@SuppressLint("MissingPermission")`** tắt phép kiểm tra của Android lint rằng quyền đã được cấp, vì service kiểm tra nó. Comment nói lý do, để không ai xoá phép kiểm tra của service vì nghĩ lint đã lo.

Thêm một mảnh nữa. Chúng tôi tắt Bluetooth giữa một lần quét (`adb shell cmd bluetooth_manager disable`, emulator API 36), với một phiên bản adapter chỉ ghi log. Callback không nhận được gì: không có `onScanFailed`. Màn hình ghi "Scanning…" cho tới timeout, rồi "No devices found", và điều đó sai. Android có phát thông báo về thay đổi này: "app của bạn cũng có thể nghe broadcast intent `ACTION_STATE_CHANGED`, mà hệ thống phát mỗi khi trạng thái Bluetooth thay đổi" ([Set up Bluetooth](https://developer.android.com/develop/connectivity/bluetooth/setup)). Nên adapter nghe nó trong lúc quét:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleScanner.kt" hl_lines="3 5 6 9 11 16 19 20 21"
        // Turning Bluetooth off ends the scan without a call to the callback, so listen for it.
        // The broadcast comes from the Bluetooth app, so the receiver must be exported.
        val bluetoothOff = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
                if (state != BluetoothAdapter.STATE_ON) close(ScanException("Bluetooth was turned off."))
            }
        }
        ContextCompat.registerReceiver(
            context, bluetoothOff, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_EXPORTED,
        )
⋯ the settings and startScan: above

        awaitClose {
            context.unregisterReceiver(bluetoothOff)
            // Stop even when isEnabled is false: it's false while Bluetooth is turning off, and in
            // the BLE-only mode some phones keep for location's "Bluetooth scanning".
            try {
                scanner.stopScan(callback)
            } catch (e: IllegalStateException) {
                // Bluetooth is fully off, and going fully off drops every app's scan.
            }
        }
```

1. **Đăng ký trong flow, huỷ đăng ký trong `awaitClose`**: receiver sống đúng bằng lần quét. Android: "luôn huỷ đăng ký broadcast receiver của bạn" ([Broadcasts overview](https://developer.android.com/develop/background-work/background-tasks/broadcasts)).
2. **`RECEIVER_EXPORTED`**: "Một số broadcast hệ thống đến từ các app có đặc quyền cao, như Bluetooth và điện thoại … Để nhận mọi broadcast hệ thống, kể cả broadcast từ các app có đặc quyền cao, đánh dấu receiver của bạn bằng `RECEIVER_EXPORTED`" (cùng trang).
3. **Vì sao không kiểm tra `isEnabled` trước `stopScan`?** `isEnabled` chỉ true khi Bluetooth bật hẳn: "Tương đương với: `getBluetoothState() == STATE_ON`" ([BluetoothAdapter.isEnabled](https://developer.android.com/reference/android/bluetooth/BluetoothAdapter#isEnabled())). `stopScan` hỏi một thứ khác. Trong source của Android, nó bắt đầu bằng `BluetoothLeUtils.checkAdapterStateOn`, thứ cho qua khi Bluetooth LE vẫn đang chạy: bật, đang bật, đang tắt, và chế độ chỉ-BLE ở dưới. Receiver đóng flow ở trạng thái đầu tiên không phải bật, `STATE_TURNING_OFF`, nên `awaitClose` thường chạy trước khi Bluetooth tắt hẳn.
   Chúng tôi ghi log trên emulator API 36: 4 trên 4 lần chạy, `awaitClose` chạy trong lúc Bluetooth đang tắt, `isEnabled` là false, và `stopScan` chạy mà không ném lỗi. Một số điện thoại còn giữ một chế độ chỉ-BLE chạy cho "Bluetooth scanning" của dịch vụ vị trí sau khi người dùng tắt Bluetooth; ở đó `isEnabled` vẫn false, và một lần quét không ai dừng sẽ chạy tiếp.
   Emulator cho thấy điều này. Bật Settings → Location → Location services → Bluetooth scanning, rồi tắt và bật Bluetooth một lần (trên image API 36 của chúng tôi, Google Play services yêu cầu chế độ chỉ-BLE trong lúc Bluetooth tắt). Từ đó, tắt Bluetooth để `adb shell dumpsys bluetooth_manager` ở `state: BLE_ON`. Với một phép chặn `isEnabled`, nó vẫn liệt kê lần quét của app chúng tôi dưới "Ongoing scans" sau khi "Bluetooth was turned off." đã hiện. Một phép chặn bằng `isEnabled` bỏ qua `stopScan` ở cả hai chỗ, nên adapter luôn gọi nó.
4. **Vì sao bắt `IllegalStateException`, và chỉ nó thôi?** Khi Bluetooth đã tắt hẳn, `checkAdapterStateOn` ném `IllegalStateException("BT Adapter is not turned ON")`. Tài liệu của Android cho `stopScan` không nhắc tới nó; source của nó thì có. Lúc đó không còn gì để dừng: khi Bluetooth tắt hẳn, scan service của Android tắt và bỏ mọi lần quét của mọi app (trong source của Android, `ScanController` xoá các scanner của nó khi tắt).
   Để chạm tới trường hợp này trên emulator, chúng tôi làm một bản sao dùng-một-lần của `awaitClose` chờ 3 giây trước: `stopScan` ném "BT Adapter is not turned ON", `catch` giữ nó lại, và màn hình hiện "Bluetooth was turned off." như thường. Không có `try`, lần chạy đó trông y vậy: flow đã kết thúc bằng `ScanException` của chúng ta, và exception thứ hai không tới được màn hình lẫn logcat. Đừng trông vào điều đó. `catch` nói rằng đúng một lần ném này là được dự tính; mọi exception khác vẫn đi tới flow.
   Ở chế độ chỉ-BLE, `stopScan` không ném, và nó kết thúc lần quét: trên emulator cài như ở ý trên, `dumpsys bluetooth_manager` không còn liệt kê lần quét nào đang chạy của app chúng tôi sau khi sửa, cả khi `awaitClose` chạy trong lúc Bluetooth đang tắt lẫn khi bản sao 3 giây gọi `stopScan` ở chế độ chỉ-BLE. Chúng tôi chưa kiểm tra trên điện thoại; các bước kiểm tra trên máy thật sẽ làm việc đó.

!!! warning "Gotcha · Android lặng lẽ bỏ qua một lần quét bắt đầu quá thường xuyên"
    Chúng tôi bấm Scan và Stop năm lần trong khoảng mười giây trên emulator API 36, rồi Scan thêm một lần. Lần quét thứ sáu đó không bao giờ bắt đầu. Logcat ghi `App 'com.example.devicemonitor' is scanning too frequently`, callback không nhận được gì, và màn hình hiện "Scanning…" trong 10 giây, rồi "No devices found". Chờ 31 giây thì quét lại được.
    Source của Android giải thích sự im lặng: `ScanCallback` có mã `SCAN_FAILED_SCANNING_TOO_FREQUENTLY`, nhưng `BluetoothLeScanner` bỏ qua nó với comment "If scanning too frequently, don't report anything to the app." (Nếu quét quá thường xuyên, đừng báo gì cho app.) Nếu trong lúc test một thiết bị thật "không tìm thấy được", hãy xem logcat có dòng đó không trước khi nghi code của bạn. Đó cũng là thêm một lý do để giữ các lần quét ít và dài, thay vì nhiều và ngắn.

## 6. Radio iOS, bằng Swift

Trên iOS, `CBCentralManager` "quét, phát hiện, kết nối tới và quản lý các peripheral", và nó báo mọi thứ cho một delegate. Bài 02 hình dung callback của delegate gọi `yield` của một `AsyncStream`. Cách đó ổn khi code Swift tiêu thụ stream, nhưng ở đây bên tiêu thụ là `ScanningService` của Kotlin, và nó muốn một `Flow` Kotlin. SKIE cho Swift thấy flow của Kotlin, nhưng "Chuyển đổi theo chiều ngược lại (từ `AsyncSequence` sang `Flow`) không được hỗ trợ" ([SKIE: Flows](https://skie.touchlab.co/features/flows)). Nên Kotlin dựng `Flow`, và Swift bơm dữ liệu vào nó. Nửa Kotlin là vài dòng Kotlin thuần trong `iosMain`, không có API Apple nào:

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ScanFlow.kt" hl_lines="5 6 7 11 17 19 23"
⋯ package and imports: Device, ScanException, ProducerScope, awaitClose, Flow, callbackFlow
// Swift can't build a Kotlin Flow, so the Swift scanner asks for one here. Collecting the Flow
// calls the radio's startScan; cancelling the collector calls its stopScan. Not a port: the
// app core never sees it. It's the Kotlin half of the iOS adapter.
fun scanFlow(radio: IosRadio): Flow<Device> = callbackFlow {
    radio.startScan(ScanFeed(this))
    awaitClose { radio.stopScan() }
}

// What the Swift scanner implements for scanFlow: start and stop the real radio.
interface IosRadio {
    fun startScan(feed: ScanFeed)
    fun stopScan()
}

// Where the Swift scanner reports: each device it hears, or the failure that ends the scan.
class ScanFeed internal constructor(private val scope: ProducerScope<Device>) {
    fun heard(device: Device) {
        scope.trySend(device)
    }

    fun failed(message: String) {
        scope.close(ScanException(message))
    }
}
```

1. **Lại là `callbackFlow` của Android**, với các callback quay ngược chiều: Swift gọi `heard` và `failed`, bên dưới là `trySend` và `close`, và `awaitClose` gọi `stopScan` của Swift.
2. **`IosRadio` không phải một port.** App core không bao giờ thấy nó, và nó không nói gì bằng ngôn ngữ của app. Nó là đường nối giữa hai nửa của một adapter, nằm trong `iosMain` vì chỉ iOS dùng nó. Dùng method thay vì lambda Kotlin giữ cho phía Swift đơn giản: trong bản build của chúng tôi, một tham số Kotlin `(Device) -> Unit` tới Swift thành một block trả về `KotlinUnit`.
3. **`internal constructor`**: chỉ `scanFlow` tạo `ScanFeed`, nên một feed luôn thuộc về một lần quét đang sống.

Nửa Swift implement cả hai protocol, `BleScanner` cho app core và `IosRadio` cho `scanFlow`:

```swift title="iosApp/iosApp/IosBleScanner.swift" hl_lines="6 14 16 21 22"
⋯ imports: CoreBluetooth, Shared
// Outbound adapter: the iPhone's Bluetooth LE radio, behind the Kotlin BleScanner port.
// CBCentralManager reports everything to its delegate, this object, and holds it only weakly:
// Koin keeps this adapter alive for the life of the app, and the adapter keeps the manager.
@MainActor
final class IosBleScanner: NSObject, @preconcurrency BleScanner, @preconcurrency IosRadio,
    @preconcurrency CBCentralManagerDelegate {
    private var manager: CBCentralManager?
    private var waitingForState: [CheckedContinuation<Void, Never>] = []
    private var feed: ScanFeed?

    // The Kotlin suspend funs. As with __request in Lesson 12, Swift implements the
    // originals; a Kotlin Boolean crosses as KotlinBoolean.
    func __isAvailable() async throws -> KotlinBoolean {
        let state = await knownState()
        return KotlinBoolean(bool: state != .unsupported)
    }
⋯ __isEnabled: the same, with state == .poweredOn
    // Swift can't build a Kotlin Flow, so it asks Kotlin for one (ScanFlow.kt, in iosMain).
    // SKIE shows a Kotlin Flow to Swift as SkieSwiftFlow, in both directions.
    func scan() -> SkieSwiftFlow<Device> {
        scanFlow(radio: self)
    }
```

1. **`__isAvailable`**: luật của bài 12 cho một `suspend fun` Kotlin: Swift implement bản gốc có tiền tố `__` dưới dạng `async throws`. Kết quả `Boolean` của một hàm suspend đi qua dưới dạng `KotlinBoolean`: completion handler trong header được xuất ra truyền một object `SharedBoolean`, không phải một `BOOL` trơn. `KotlinBoolean(bool:)` bọc một `Bool` của Swift.
2. **`scan() -> SkieSwiftFlow<Device>`**: SKIE cũng viết lại yêu cầu của protocol. Lần thử đầu của chúng tôi trả về `Kotlinx_coroutines_coreFlow` Objective-C trơn, và compiler đáp "protocol requires function 'scan()' with type '() -> SkieSwiftFlow<Device>'". SKIE cũng cho `scanFlow(radio:)` kiểu trả về đó, nên `Flow` Kotlin đi qua Swift rồi quay lại Kotlin mà Swift không bao giờ duyệt nó.
3. **`@MainActor` và `@preconcurrency`**, như `IosPermissionChecker` của bài 12: manager gọi delegate của nó trên main queue, và phía Kotlin gọi adapter từ các coroutine của ViewModel trên main thread.

```swift title="iosApp/iosApp/IosBleScanner.swift" hl_lines="3 8 13 17 19 20"
    // IosRadio: scanFlow calls these when the Flow is collected and when it is cancelled.
    func startScan(feed: ScanFeed) {
        guard let manager, manager.state == .poweredOn else {
            feed.failed(message: "Bluetooth is off.")
            return
        }
        self.feed = feed
        manager.scanForPeripherals(withServices: nil)
    }

    func stopScan() {
        feed = nil
        if manager?.state == .poweredOn { manager?.stopScan() }
    }

    // Called on the main queue (queue: nil) for each advertisement the radio hears.
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        feed?.heard(device: Device(id: peripheral.identifier.uuidString, name: name, rssi: RSSI.int32Value))
    }
```

1. **`withServices: nil`** nghĩa là mọi peripheral đang phát quảng cáo. Apple: "Cách làm được khuyến nghị là điền tham số `serviceUUIDs` thay vì để nó `nil`" ([scanForPeripherals](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager/scanforperipherals(withservices:options:))). Một app sản phẩm biết UUID service của peripheral của nó thì nên quét theo UUID đó. Device Monitor tìm thiết bị theo tên, và tên chỉ đọc được khi quảng cáo đã tới, nên nó quét mọi thứ và service lọc. `startScan(null, …)` của Android là cùng lựa chọn đó.
2. **`CBAdvertisementDataLocalNameKey`**: "Tên local của một peripheral", cùng cái tên được quảng cáo mà `scanRecord.deviceName` của Android đọc.
3. **`peripheral.identifier`** không phải địa chỉ của thiết bị. "Lần đầu một manager local gặp một peer, hệ thống gán cho peer đó một UUID" ([CBPeer.identifier](https://developer.apple.com/documentation/corebluetooth/cbpeer/identifier)). Nên cùng một thiết bị LightBlue có id kiểu MAC trên Android và một UUID trên iOS, như bài 06 đã cảnh báo. App core coi cả hai là một `String` mờ (opaque).
4. **RSSI** là cường độ tín hiệu "tính bằng dBm. Giá trị 127 được dành riêng và cho biết RSSI không có sẵn" (`CBCentralManager.h` của CoreBluetooth). App hiện nó như nó tới.

```swift title="iosApp/iosApp/IosBleScanner.swift" hl_lines="3 7 9 11 17 20"
    // Called on the main queue whenever the radio's state changes: first when the manager
    // learns it, then each time Bluetooth is turned off or on.
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state != .unknown, central.state != .resetting else { return }
        let waiting = waitingForState
        waitingForState = []
        waiting.forEach { $0.resume() }
        // Below poweredOn, scanning has stopped: end the scan the app is waiting on.
        if central.state != .poweredOn, let feed {
            self.feed = nil
            feed.failed(message: "Bluetooth was turned off.")
        }
    }

    // A new manager starts in .unknown and learns the radio's state a moment later, in
    // centralManagerDidUpdateState. Wait for that before answering.
    private func knownState() async -> CBManagerState {
        let manager = self.manager ?? makeManager()
        if manager.state == .unknown || manager.state == .resetting {
            await withCheckedContinuation { waitingForState.append($0) }
        }
        return manager.state
    }
⋯ makeManager(): CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: false])
```

1. **Mẫu chờ của bài 12**, cho một câu trả lời khác: `knownState` đỗ một continuation lại, và delegate resume nó khi state đã biết. `resetting` nghĩa là "Kết nối với system service tạm thời bị mất, sắp cập nhật", nên nó cũng chờ bản cập nhật đó.
2. **Bluetooth bị tắt giữa lúc quét.** Apple: "Một state có giá trị thấp hơn `poweredOn` ngụ ý rằng việc quét đã dừng" ([centralManagerDidUpdateState](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerdelegate/centralmanagerdidupdatestate(_:))). Khác Android, iOS báo cho delegate, nên adapter kết thúc lần quét của app bằng một thông báo thay vì để nó chờ tới timeout.
3. **`CBCentralManagerOptionShowPowerAlertKey: false`**: key này quyết định "hệ thống có cảnh báo người dùng không nếu app tạo central manager khi dịch vụ Bluetooth không sẵn sàng", và "Nếu không chỉ định key, giá trị mặc định là `true`" ([tài liệu](https://developer.apple.com/documentation/corebluetooth/cbcentralmanageroptionshowpoweralertkey)). Service đã hiện "Bluetooth is off", nên alert của hệ thống sẽ là cái thứ hai.
4. **Manager được tạo ở lần `isAvailable()` đầu tiên**, sau khi service đã kiểm tra quyền (mục 4). Đây là manager riêng của scanner. Adapter quyền của bài 12 bỏ manager của nó khi người dùng đã trả lời.

!!! warning "Gotcha · delegate là weak: giữ adapter sống"
    `CBCentralManager` khai báo `@property(nonatomic, weak, nullable) id<CBCentralManagerDelegate> delegate` (`CBCentralManager.h`). Một tham chiếu weak không giữ object của nó sống: khi không còn gì khác giữ delegate, Swift đặt tham chiếu thành `nil`, và mọi callback sau đó đi vào hư không.
    Một cách hay gặp để rơi vào đó là một object scanner tạo bên trong một hàm, hoặc một object delegate nhỏ riêng mà chỉ manager trỏ tới. Lần quét bắt đầu, và không thiết bị nào được báo.
    Ở đây, adapter là delegate của chính nó, và Koin giữ adapter dưới dạng `single` suốt đời process (như adapter của bài 12). Adapter giữ manager trong một property. Bài 14 gặp cùng luật này với peripheral: "Một peripheral được phát hiện phải được giữ lại để dùng nó; nếu không, nó được coi là không ai quan tâm và sẽ bị central manager dọn đi."

## 7. Nối dây: mỗi nền tảng truyền radio của mình

Bài 11 để lại `single<BleScanner> { SimulatedBleScanner() }` trong `appModule`. Các radio thật không thể dựng ở đó: radio Android cần một `Context`, và radio iOS là một object Swift. Nên binding chuyển sang `platformModule`, nơi bài 12 đặt adapter quyền vì cùng những lý do đó:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="2 8 10 14"
internal val appModule = module {
    single<DeviceScanning> { ScanningService(get(), get()) }
    single<PermissionAccess> { PermissionService(get()) }
    viewModelOf(::DeviceListViewModel)
}

// The outbound adapters that each platform builds itself and passes to initKoin.
internal fun platformModule(permissionChecker: PermissionChecker, bleScanner: BleScanner) = module {
    single { permissionChecker }
    single { bleScanner }
}

// Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
fun initKoin(permissionChecker: PermissionChecker, bleScanner: BleScanner) {
    startKoin {
        modules(appModule, platformModule(permissionChecker, bleScanner))
    }
}
```

1. **`ScanningService(get(), get())`**: Koin điền mỗi tham số theo kiểu của nó, `BleScanner` và `PermissionChecker`.
2. **Bài 11 hứa việc đổi radio sẽ là "một dòng".** Nó thành một binding bị dời cộng một tham số, vì các adapter phải được dựng ngoài code dùng chung. Điều lời hứa muốn nói phần lớn vẫn đúng: ViewModel vẫn chỉ nói chuyện với `DeviceScanning`, và nó không đổi để đổi radio. Port và service thì có lớn thêm, cho các luật mà một radio thật mang tới (mục 3 và 4), và danh sách UIKit hoá ra phụ thuộc vào các thiết bị mẫu của radio giả (mục 8).
3. **Header Swift** giờ khai báo `doInitKoin(permissionChecker:bleScanner:)`, vẫn không có kiểu Koin nào trong đó.

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks" hl_lines="4"
    override fun onCreate() {
        super.onCreate()
        permissionChecker = AndroidPermissionChecker(this)
        initKoin(permissionChecker, AndroidBleScanner(this))
    }
```

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="2"
        init() {
            AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker(), bleScanner: IosBleScanner())
        }
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="3"
        func application(_ application: UIApplication,
                         didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
            AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker(), bleScanner: IosBleScanner())
            return true
        }
    ```

Khác adapter quyền, màn hình không bao giờ cần scanner Android, nên `DeviceMonitorApplication` không giữ nó trong một property. Tạo `IosBleScanner()` lúc khởi động chưa tạo `CBCentralManager` nào, nên nó không hiện hộp hỏi nào.

`SimulatedBleScanner` vẫn ở trong `commonMain`, giờ với `isAvailable` và `isEnabled` đều `true`. Không gì bind nó. Truyền nó cho `initKoin` thay cho radio thật là cách bạn chạy danh sách trên Simulator (bài tự làm).

## 8. Stop, và timeout

Một lần quét dùng radio, và radio dùng pin. Hướng dẫn của Android: "Ngay khi bạn tìm thấy thiết bị mong muốn, hãy dừng quét", và "Đừng bao giờ quét trong một vòng lặp, và luôn đặt giới hạn thời gian cho lần quét. Một thiết bị trước đó có mặt có thể đã ra khỏi tầm, và tiếp tục quét làm hao pin." Mẫu của nó dừng sau 10 giây ([Find BLE devices](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)). ViewModel đã có giới hạn thời gian từ bài 08. Nó tăng từ 3 lên 10 giây, chu kỳ quét trong mẫu của Android, và màn hình có thêm Stop:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt" hl_lines="4 7 10 16"
⋯ startScan: as in m07, with withTimeoutOrNull(SCAN_TIMEOUT) around the collection
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
⋯ errorShown, refreshPermission, requestPermission, openSettings: as in m07
    companion object {
        // A real radio drains the battery while it scans, so every scan has a time limit.
        val SCAN_TIMEOUT = 10.seconds
    }
```

1. **Vì sao trong ViewModel, không phải service?** Câu trả lời của bài 10 vẫn đúng: màn hình này quét bao lâu, và người dùng có dừng được không, là hành vi của màn hình này. Các luật của service đúng cho mọi màn hình.
2. **Stop và timeout kết thúc một lần quét theo cùng một cách**: bằng cách huỷ việc collect. Timeout huỷ khối bên trong `withTimeoutOrNull`; Stop huỷ cả job. Đằng nào thì việc huỷ cũng tới `awaitClose` trong adapter, nơi dừng radio (sơ đồ dưới).
3. **Stop tự ghi `Finished`.** Một coroutine bị huỷ không chạy dòng sau `withTimeoutOrNull`, nên `stopScan` đặt state cuối cùng.

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 210" role="img" aria-labelledby="l13-stop-title">
<title id="l13-stop-title">Một lần quét dừng thế nào. Hai thứ kích hoạt, nút Stop của người dùng và timeout 10 giây của ViewModel, đều huỷ việc collect của ViewModel. Việc huỷ đi sang phải: nó huỷ flow của scanning service, thứ huỷ việc collect BleScanner.scan() của service. Trong adapter, việc đó chạy khối awaitClose của callbackFlow, nơi dừng radio: stopScan trên BluetoothLeScanner của Android, hoặc trên iOS, scanFlow của Kotlin gọi stopScan của adapter Swift, và nó gọi stopScan của CBCentralManager. Một lỗi đi theo chiều ngược lại: adapter đóng flow bằng một ScanException, tới catch của ViewModel và thành alert Scan failed.</title>
<defs><marker id="l13-stop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="inbound">
<rect class="box" x="20" y="40" width="170" height="70" rx="6"/>
<text class="title small" x="32" y="60">ViewModel</text>
<text class="small" x="32" y="80">Stop: job.cancel()</text>
<text class="small" x="32" y="98">hoặc timeout 10 s</text>
</g>
<g data-part="core">
<rect class="box" x="230" y="40" width="160" height="70" rx="6"/>
<text class="title small" x="242" y="60">ScanningService</text>
<text class="small" x="242" y="80">flow { } của nó</text>
<text class="small" x="242" y="98">bị huỷ</text>
</g>
<g data-part="outbound">
<rect class="box" x="430" y="40" width="310" height="70" rx="6"/>
<text class="title small" x="442" y="60">adapter: callbackFlow</text>
<text class="small" x="442" y="80">awaitClose { … } chạy và dừng radio:</text>
<text class="small" x="442" y="98">Android stopScan · iOS IosRadio.stopScan</text>
</g>
<path class="edge" d="M190,62 L228,62" marker-end="url(#l13-stop-arrow)"/>
<path class="edge" d="M390,62 L428,62" marker-end="url(#l13-stop-arrow)"/>
<text class="small muted" x="200" y="30">việc huỷ đi sang phải</text>
<path class="edge dashed" d="M585,112 L585,160 L105,160 L105,112" marker-end="url(#l13-stop-arrow)"/>
<text class="small" x="160" y="180">lỗi đi sang trái: close(ScanException) → catch của ViewModel → "Scan failed"</text>
</svg>
<figcaption>Một cơ chế cho Stop, timeout và lúc màn hình kết thúc: huỷ việc collect.</figcaption>
</figure>

Mỗi màn hình biến nút Scan thành Stop trong lúc quét. Nút vẫn bật trong lúc quét, để người dùng luôn dừng được.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="4 5 8"
    ⋯ DeviceListScreen passes onStop = viewModel::stopScan to DeviceListContent, which takes onStop: () -> Unit
            // One button: Scan while idle, Stop while scanning.
            Button(
                onClick = if (isScanning) onStop else onScan,
                enabled = isScanning || bluetooth == PermissionStatus.Granted,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (isScanning) "Stop" else "Scan")
            }
    ```

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="4 5 11 12"
    ⋯ in onCreateView:
            // One button: Scan while idle, Stop while scanning.
            b.scanButton.setOnClickListener {
                if (viewModel.uiState.value.scan is ScanState.Scanning) {
                    viewModel.stopScan()
                } else {
                    viewModel.startScan(b.filterInput.text.toString())
                }
            }
    ⋯ in render():
            b.scanButton.text = if (isScanning) "Stop" else "Scan"
            b.scanButton.isEnabled = isScanning || state.bluetooth == PermissionStatus.Granted
    ```

    Click listener được đặt một lần, trong `onCreateView`, nên nó đọc state hiện tại của ViewModel lúc được bấm. (Nút quyền làm theo cách ngược lại: mỗi lần `render()`, qua `renderPermission`, gắn cho nó một listener mới giữ status vừa vẽ.) Layout không đổi.

!!! info "XML vs Compose · cái gì đổi và vì sao"
    Compose chọn click handler và nhãn từ `isScanning` mỗi lần nó recompose. Fragment XML đặt nhãn trong `render()` và, vì listener của nó được đặt một lần trong `onCreateView`, hỏi state hiện tại của ViewModel đúng lúc bấm.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="3 4 8"
    ⋯ DeviceListView passes onStop: { viewModel.stopScan() } to DeviceListContent, which has let onStop: () -> Void
                // One button: Scan while idle, Stop while scanning.
                Button(action: isScanning ? onStop : onScan) {
                    Text(isScanning ? "Stop" : "Scan")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!isScanning && bluetooth != .granted)
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="2 7 10 11 13"
        // The rows' devices by id, from the last state rendered: the snapshot holds only the ids.
        private var devicesById: [String: Device] = [:]
        private lazy var dataSource = UITableViewDiffableDataSource<Int, String>(tableView: tableView) {
            [unowned self] tableView, indexPath, deviceId in
            let cell = tableView.dequeueReusableCell(withIdentifier: "device", for: indexPath)
            var content = UIListContentConfiguration.subtitleCell()
            if let device = devicesById[deviceId] {
    ⋯ the rest of the cell, and the Scan button's action (Stop while scanning): as in the XML track
    ⋯ in render():
            scanButton.configuration?.title = isScanning ? "Stop" : "Scan"
            scanButton.isEnabled = isScanning || state.bluetooth == .granted
    ⋯ 
            devicesById = Dictionary(uniqueKeysWithValues: (devices ?? []).map { ($0.id, $0) })
    ```

    Danh sách UIKit có một chỗ phụ thuộc thứ hai vào radio giả: các cell của nó tra từng id trong `SampleDevices`, nên một thiết bị thật sẽ vẽ ra một hàng trống. Giờ `render()` giữ các thiết bị nó được đưa, theo id, và cell đọc chúng. `uniqueKeysWithValues` an toàn vì service báo mỗi id một lần. `[unowned self]` tránh một vòng giữ (retain cycle): view controller sở hữu data source, và data source sở hữu closure này.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Cùng một luật cho nút ở cả hai. `List` của SwiftUI vẽ mỗi hàng từ `Device` nó được đưa, nên nó không cần đổi gì cho thiết bị thật. Diffable data source của UIKit chỉ giữ id, nên controller giữ các thiết bị cho cell của nó đọc.

!!! warning "Gotcha · màn hình chi tiết vẫn chỉ biết các thiết bị mẫu"
    Màn hình chi tiết của mọi track vẫn tra thiết bị của nó trong `SampleDevices` theo id. Trên emulator API 30 chúng tôi bấm một hàng `gDevice-beacon` và màn hình chi tiết ghi "Unknown device". Điều tương tự xảy ra với LightBlue trên điện thoại. Ở m08 đó là điều dự tính: bài này chỉ quét. Bài 14 mới là bài cần thiết bị được chọn, để kết nối tới nó.

## 9. Test

Radio giả học hai câu hỏi mới và đếm số lần quét nó bắt đầu:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleScanner.kt" hl_lines="1 3 4 6 10"
class FakeBleScanner : BleScanner {
    private val heard = Channel<Device>(Channel.UNLIMITED)
    var available = true
    var enabled = true
    var failure: ScanException? = null
    var scansStarted = 0
        private set
⋯ isScanning, isAvailable() and isEnabled() return the two flags
    override fun scan(): Flow<Device> = flow {
        scansStarted++
        failure?.let { throw it }
⋯ as in m07: emit what hear() sends, with isScanning true until the collector cancels
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/ScanningServiceTest.kt" hl_lines="2 3 7 10 16"
    private val radio = FakeBleScanner()
    private val os = FakePermissionChecker().apply {
        statuses[Permission.Bluetooth] = PermissionStatus.Granted
    }

    // The test drives the app core the way the ViewModel does: through the inbound port.
    private val scanning: DeviceScanning = ScanningService(radio, os)
⋯ the five m07 tests, and skipsDevicesThatAdvertiseNoName
    @Test
    fun neverStartsTheRadioWithoutThePermission() = runTest {
        os.statuses[Permission.Bluetooth] = PermissionStatus.Denied

        scanning.scan(nameFilter = "").test {
            assertEquals("Scanning needs the Bluetooth permission.", awaitError().message)
        }
        assertEquals(0, radio.scansStarted)
    }
⋯ neverStartsTheRadioWhenItIsMissingOrOff: available = false, then enabled = false
```

1. **Fake quyền đến từ bài 12**, dùng ở đây làm hệ điều hành cho một service khác. Phần setup của class cấp quyền, nên các test của m07 giữ nguyên ý nghĩa.
2. **`scansStarted`** chứng minh radio chưa bao giờ được bắt đầu, chính là điểm của luật. Chỉ kiểm tra thông báo lỗi thì không phân biệt được một service chưa bao giờ bắt đầu radio với một service đã bắt đầu nó rồi mới ném lỗi.
3. **ViewModel có `stopEndsTheScanAndKeepsWhatWasFound`**: tìm được một thiết bị, rồi Stop, và state là `Finished` với thiết bị đó ở thời gian ảo 0, nên timeout không đóng vai trò gì. `TestDeviceScanning` có thêm một cờ `isScanning` như của radio giả, để test cũng kiểm tra được việc collect đã bị huỷ.
4. **Test đồ thị** truyền `platformModule(FakePermissionChecker(), FakeBleScanner())`.

Các adapter không có test tự động: chúng là lớp mỏng bên trên radio, được kiểm tra bằng cách chạy app (mục 10) và, với một peripheral thật, trên điện thoại.

## 10. Thực tế xảy ra gì

Chúng tôi build m08 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, Xcode 26.2). `allTests` qua 20 trên 20 trên JVM và 20 trên 20 trên iOS simulator, và không bản build nào in warning của compiler từ code của chúng ta. Rồi chúng tôi chạy nó, với quyền đã được cấp:

<table>
<tr><th>Lần chạy</th><th>Chúng tôi thấy gì</th></tr>
<tr><td>Emulator Android API 36, Compose và XML: Scan, chờ</td><td>Stop và "Scanning…" trong 10 s, rồi "No devices found. Try another filter." <code>dumpsys</code>: lần quét đã bắt đầu và đã dừng</td></tr>
<tr><td>như trên, Scan, rồi Stop vài giây sau</td><td>Scan hiện lại ngay; <code>dumpsys</code> tính lần quét là đã dừng</td></tr>
<tr><td>Bluetooth tắt (<code>adb shell cmd bluetooth_manager disable</code>), rồi Scan</td><td>"Scan failed: Bluetooth is off. Turn it on, then scan again."</td></tr>
<tr><td>Scan, rồi tắt Bluetooth một giây sau</td><td>"Scan failed: Bluetooth was turned off."</td></tr>
<tr><td>Emulator Android API 30, Compose và XML</td><td>hai hàng <code>gDevice-beacon</code> (giá trị dBm của chúng đổi giữa các lần chạy), "Devices found: 2"; bộ lọc "beacon" tìm thấy chúng, "xyz" không thấy gì</td></tr>
<tr><td>iOS 26.2 Simulator, SwiftUI và UIKit: Scan</td><td>"Scan failed: This phone has no Bluetooth LE radio." Sau OK: "Tap Scan to look for devices.", Scan bật</td></tr>
<tr><td>Simulator với <code>SimulatedBleScanner</code> truyền cho <code>initKoin</code>, cả hai track iOS</td><td>các hàng có tên trên cả hai track; Stop kết thúc lần quét và các hàng ở lại</td></tr>
<tr><td>Simulator, SwiftUI, với một bản sao dùng-một-lần của <code>IosBleScanner</code> có <code>startScan</code> bơm <code>ScanFeed</code> từ một timer thay vì radio (hai thiết bị có tên và một không tên, lặp đi lặp lại)</td><td>hai hàng, mỗi hàng một lần; Stop ghi log <code>stopScan</code> của Swift; một <code>feed.failed("Bluetooth was turned off.")</code> sau đó hiện alert đó và cũng ghi log <code>stopScan</code>. Vậy đường Swift → Kotlin chạy trọn vẹn; chỉ bản thân radio là cần iPhone</td></tr>
</table>

Mục tiêu thật, LightBlue trong danh sách, cần điện thoại của bạn: một điện thoại Android hiện nó với một địa chỉ kiểu `XX:XX:…`, và một iPhone với một UUID. Brief cho agent liệt kê những lần chạy đó là các bước kiểm tra trên máy thật.
**m08 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng, emulator và Simulator hiện các thông báo ở trên, và LightBlue xuất hiện trong danh sách trên ít nhất một điện thoại của bạn. Hãy commit nó. Bài 14 kết nối tới thiết bị bạn bấm.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một quảng cáo trên iOS, từ `centralManager(_:didDiscover:…)` tới một hàng trên màn hình: method Swift nào gọi hàm Kotlin nào, `trySend` xảy ra ở đâu, và dòng nào bỏ quảng cáo thứ hai từ cùng một thiết bị. Rồi nhờ nó lần theo một lần bấm Stop trên Android, xuống tới `stopScan(callback)`.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Trong lúc quét, điện thoại đóng vai nào?</p>
<div class="opts">
<button class="opt" data-correct>central: nó quét và nghe quảng cáo của peripheral</button>
<button class="opt">GATT server: nó trả lời yêu cầu của peripheral</button>
<button class="opt">peripheral: nó quảng cáo Device Monitor</button>
</div>
<p class="feedback"></p>
<p class="why">"Thiết bị ở vai central quét, tìm quảng cáo, và thiết bị ở vai peripheral phát quảng cáo." Client và server chỉ có ý nghĩa khi đã kết nối (bài 14), và lúc đó điện thoại là client.</p>
</div>

<div class="quiz">
<p class="q">Một characteristic có thuộc tính <em>indicate</em>. Nó khác <em>notify</em> thế nào?</p>
<div class="opts">
<button class="opt">indicate chỉ gửi giá trị khi central đọc nó</button>
<button class="opt" data-correct>central phản hồi mỗi indication để xác nhận đã nhận; notification không có phản hồi</button>
<button class="opt">indicate hoạt động không cần kết nối</button>
</div>
<p class="feedback"></p>
<p class="why">Cả hai đều đẩy giá trị mới từ peripheral. Apple: notify là "không có phản hồi từ central để báo đã nhận", indicate là "có phản hồi".</p>
</div>

<div class="quiz">
<p class="q">Luật "không bao giờ bắt đầu radio khi chưa có quyền Bluetooth" sống ở đâu, và vì sao ở đó?</p>
<div class="opts">
<button class="opt">trong mỗi màn hình, nơi disable nút Scan</button>
<button class="opt">trong mỗi adapter, nơi kiểm tra trước <code>startScan</code></button>
<button class="opt" data-correct>trong <code>ScanningService</code>: đó là cùng một luật trên cả hai nền tảng, và mọi lời gọi đều đi qua nó</button>
</div>
<p class="feedback"></p>
<p class="why">Các màn hình cũng disable nút, nhưng đó là việc trình bày. Viết một lần trong service, luật bao mọi màn hình, và <code>neverStartsTheRadioWithoutThePermission</code> test nó trên JVM.</p>
</div>

<div class="quiz">
<p class="q">Vì sao adapter iOS cần <code>ScanFlow.kt</code>, một file Kotlin trong <code>iosMain</code>?</p>
<div class="opts">
<button class="opt">CoreBluetooth chỉ gọi được từ Kotlin</button>
<button class="opt" data-correct>port trả về một <code>Flow</code> Kotlin, và Swift không dựng được nó: SKIE không chuyển một <code>AsyncSequence</code> thành <code>Flow</code></button>
<button class="opt">Koin chỉ bind được class Kotlin</button>
</div>
<p class="feedback"></p>
<p class="why">SKIE chỉ chuyển flow từ Kotlin sang Swift. Nên <code>callbackFlow</code> của Kotlin dựng <code>Flow</code>, và class Swift bơm dữ liệu vào nó qua <code>ScanFeed</code>. Koin bind chính object Swift mà không có vấn đề gì.</p>
</div>

<div class="quiz">
<p class="q">Điều gì sai nếu delegate của <code>CBCentralManager</code> là một object không còn gì khác giữ?</p>
<div class="opts">
<button class="opt">app crash khi thiết bị đầu tiên được tìm thấy</button>
<button class="opt" data-correct>tham chiếu weak của manager thành <code>nil</code>, và các callback của nó đi vào hư không: lần quét không báo gì</button>
<button class="opt">iOS hiện lại hộp hỏi quyền Bluetooth</button>
</div>
<p class="feedback"></p>
<p class="why">Property <code>delegate</code> được khai báo <code>weak</code>, nên nó không giữ object sống. Trong app, Koin giữ adapter, và adapter là delegate của chính nó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>awaitClose</code> của <code>AndroidBleScanner</code> gọi <code>stopScan</code> bên trong một <code>try</code> thay vì chỉ <code>if (adapter.isEnabled)</code>?</p>
<div class="opts">
<button class="opt"><code>isEnabled</code> cần một quyền mà phần dọn dẹp không có</button>
<button class="opt" data-correct><code>isEnabled</code> đã false trong lúc Bluetooth đang tắt, và ở chế độ chỉ-BLE, khi <code>stopScan</code> không ném; nó chỉ ném khi Bluetooth LE không chạy, và LE dừng thì bỏ mọi lần quét của mọi app</button>
<button class="opt"><code>stopScan</code> ném ở mọi lần gọi sau khi một lần quét thất bại</button>
</div>
<p class="feedback"></p>
<p class="why"><code>isEnabled</code> nghĩa là bật hẳn. Phép kiểm tra riêng của <code>stopScan</code>, trong source của Android, cho qua khi Bluetooth LE vẫn chạy. Trên emulator API 36, phần dọn dẹp chạy trong lúc Bluetooth đang tắt ở mọi lần chúng tôi ghi log, và <code>stopScan</code> chạy ở đó mà không ném. Một phép chặn sẽ bỏ qua nó, và ở chế độ chỉ-BLE emulator vẫn liệt kê lần quét là đang chạy.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Stop huỷ job quét của ViewModel. Việc đó dừng radio Android thế nào? (Bài 01)</p>
<div class="opts">
<button class="opt">ViewModel gọi <code>AndroidBleScanner.stopScan()</code></button>
<button class="opt" data-correct>việc huỷ đi xuống qua các lần collect tới <code>callbackFlow</code>, nơi khối <code>awaitClose</code> gọi <code>stopScan</code></button>
<button class="opt">Koin đóng adapter khi job kết thúc</button>
</div>
<p class="feedback"></p>
<p class="why">Structured concurrency: huỷ một collector là huỷ các flow nó collect. ViewModel chỉ biết inbound port, nên nó không gọi được adapter kể cả nếu muốn.</p>
</div>

<div class="quiz">
<p class="q">Cùng một thiết bị LightBlue có id <code>4A:…</code> trên Android và một UUID trên iOS. Vì sao app core không bận tâm? (Bài 06 và 10)</p>
<div class="opts">
<button class="opt">service chuyển cả hai về cùng một định dạng</button>
<button class="opt" data-correct>id là một <code>String</code> mờ trong ngôn ngữ của app: app core chỉ so sánh id có bằng nhau không, trong một lần quét trên một điện thoại</button>
<button class="opt">id iOS là địa chỉ MAC đội lốt</button>
</div>
<p class="feedback"></p>
<p class="why">Port nói ngôn ngữ của app, và "mỗi thiết bị một lần" chỉ cần id ổn định trong một lần quét. Id trông thế nào là việc của từng adapter.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m08 của bạn)"
    1. **Đoán trước, rồi xem.** Trên emulator Android, ghi ra màn hình sẽ nói gì, rồi làm từng bước: Scan và để nó chạy hết; Scan rồi Stop; tắt Bluetooth bằng `adb shell cmd bluetooth_manager disable` rồi Scan; bật nó, Scan, và tắt nó giữa lúc quét. Rồi bấm Scan và Stop nhanh sáu lần, và tìm dòng "scanning too frequently" bằng `adb logcat | grep -i frequently`. Bật Bluetooth lại bằng `enable`.
    2. **Viết một test.** Thêm `asksTheRadioNothingWithoutThePermission` vào `ScanningServiceTest`: khi quyền bị từ chối, radio thậm chí không được hỏi `isAvailable()`, lời gọi tạo manager iOS. Bạn sẽ cần `FakeBleScanner` đếm các lời gọi đó. Rồi cố ý phá luật: dời phép kiểm tra quyền xuống dưới các phép kiểm tra radio và xem test thất bại trên cả hai nền tảng.
    3. **Đổi radio trên iOS.** Truyền `SimulatedBleScanner()` cho `doInitKoin` thay cho `IosBleScanner()` và chạy trên Simulator. Đoán trước: alert "no Bluetooth LE radio" có hiện không? Các hàng có hiện không, và bạn có Stop được không? Bạn đã đụng vào bao nhiêu file? Rồi trả lại như cũ.
    4. **Trên điện thoại của bạn**, khi LightBlue đang phát quảng cáo: tìm hàng của Mac bằng mẹo tắt-rồi-bật ở mục 2, rồi lọc theo một phần tên của nó.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy các test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/13-ble-concepts-and-scan.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/13-ble-concepts-and-scan.html" -o .course/lesson-13.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html" -o .course/ref-ble-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 11 and 12, which this brief's warning list points to; skipped if they're already there:
  [ -f .course/lesson-11.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html" -o .course/lesson-11.html
  [ -f .course/lesson-12.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html" -o .course/lesson-12.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 13 (BLE: concepts and scan): build milestone m08, real BleScanner outbound adapters
(Android BluetoothLeScanner + callbackFlow, iOS Swift CBCentralManager) behind the same
DeviceScanning inbound port, with the scan rules in ScanningService, a Stop button and a
10-second timeout, on top of m07.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m07 project in demo/ (Lesson 12). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     replaced: core/ScanException.kt, core/ScanningService.kt, core/inbound/DeviceScanning.kt,
       core/outbound/BleScanner.kt, adapter/inbound/DeviceListViewModel.kt,
       adapter/outbound/SimulatedBleScanner.kt, adapter/outbound/SampleDevices.kt,
       di/AppModule.kt
     add shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleScanner.kt
     add shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ScanFlow.kt
     replaced, under shared/src/commonTest/kotlin/com/example/devicemonitor/:
       doubles/FakeBleScanner.kt, doubles/TestDeviceScanning.kt, core/ScanningServiceTest.kt,
       adapter/inbound/DeviceListViewModelTest.kt, di/AppModuleTest.kt
   shared/build.gradle.kts and every other file in shared/ stay as in m07.

2. Android, both tracks: androidApp/src/main/AndroidManifest.xml (my track's) and
   androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt:
   replaced. androidApp/build.gradle.kts stays as in m07.
     Compose: DeviceListScreen.kt: replaced.
     XML: DeviceListFragment.kt: replaced (the layout stays as in m07).
   iOS, both tracks: add iosApp/iosApp/IosBleScanner.swift, then run `xcodegen generate` in
   iosApp/ so the Xcode project includes it. project.yml stays as in m07. Do NOT edit
   Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift and DeviceListView.swift: replaced.
     UIKit: AppDelegate.swift and DeviceListViewController.swift: replaced.
   Every other Android and iOS file stays as in m07, including the detail screens.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), and grant the permission
   so the scan can start:
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
  the task lines), and all 20 tests pass on each: 8 in ScanningServiceTest, 7 in
  DeviceListViewModelTest, 4 in PermissionServiceTest, 1 in AppModuleTest. Show the counts from
  the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: the same lines as in Lesson 12's brief (SKIE's "Configuration '…' was
  resolved during configuration time", SLF4J "Failed to load class", Gradle's "Deprecated
  Gradle features … Gradle 10", "Unable to strip the following libraries", Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", xcodebuild's
  "WARNING: Using the first of multiple matching destinations", and Gradle's "The Daemon will
  expire …"). Xcode "note:" lines are not warnings.
- The app core stays platform-free:
    grep -rn 'import android\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing. The exported header declares the new entry point and still no Koin types:
    grep -c 'doInitKoinPermissionChecker:(id<SharedPermissionChecker>)permissionChecker bleScanner' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'Koin_core' on the same file prints 0 (build that framework first
  with ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 if it isn't there).
- Android emulator (API 31+), my track (the XML button shows its text in capitals, so match
  case-insensitively; find nodes with `adb shell uiautomator dump`):
  1. Launch: "Bluetooth permission: allowed", and a "Scan" button.
  2. Tap Scan: the button says "Stop" and the status "Scanning…". Wait 12 s: the button says
     "Scan" again, and the status is either "Devices found: N" or "No devices found. Try another
     filter." (what the emulator's simulated Bluetooth hears depends on its image).
     `adb shell dumpsys bluetooth_manager | grep -A1 '^  com.example.devicemonitor$'` prints the
     app's own section (every app that scanned has one; the app's appears once it has scanned since
     Bluetooth was last turned on): its "LE scans (started/stopped)" line shows equal counts, like 1 / 1.
  3. Tap Scan, then Stop within 3 s: the button says "Scan" at once.
  4. adb shell cmd bluetooth_manager disable; tap Scan: an alert "Scan failed" with "Bluetooth
     is off. Turn it on, then scan again." Tap OK. adb shell cmd bluetooth_manager enable.
  5. Wait 30 s (Android ignores a scan started too often; lesson section 5). Tap Scan, and within
     2 s run adb shell cmd bluetooth_manager disable: "Scan failed" with "Bluetooth was turned
     off." Tap OK, then enable Bluetooth again.
  6. No crash in steps 4 and 5: before step 4, run `adb logcat -b crash -c` and note what
     `adb shell pidof com.example.devicemonitor` prints; after step 5 it prints the same number,
     and `adb logcat -d -b crash` prints nothing.
  Don't tap Scan more than five times within 30 s anywhere in these checks.
- Optional, if you have an emulator with Android 11 (API 30): grant
  android.permission.ACCESS_FINE_LOCATION instead in step 3 above, and scan. On our API 30 image
  (google_apis_playstore, arm64) two "gDevice-beacon" rows appeared; report what yours shows.
- iOS Simulator, my track: launch shows "Bluetooth permission: allowed". If you can drive the
  simulator (idb, or a throwaway XCUITest that launches the installed app by bundle ID; don't
  script the Simulator window with System Events), tap Scan: an alert "Scan failed" with
  "This phone has no Bluetooth LE radio." Tap OK: "Tap Scan to look for devices." and Scan
  enabled. Don't try to scan anything real on the Simulator.
- Device checks (list them for me, don't try to run them): with LightBlue advertising a
  virtual device on my Mac (lesson section 2), on a physical Android phone and an iPhone on my
  track: the virtual device appears in the list, once, with an address (Android) or a UUID
  (iOS); the filter finds it by part of its name; Stop and the 10-second timeout end the scan;
  Bluetooth off before Scan, and turned off during a scan, show the two messages above, with no
  system alert on iOS. On Android, once more with Settings → Location → Location services →
  Bluetooth scanning turned on (the BLE-only mode of section 5), after turning Bluetooth off and
  on once: Scan, turn Bluetooth off within 3 s, then `adb shell dumpsys bluetooth_manager`
  should list no scan still running for com.example.devicemonitor.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each box of the lesson's "who talks to whom" diagram is in the code.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Bluetooth Low Energy overview](https://developer.android.com/develop/connectivity/bluetooth/ble/ble-overview) (nguồn chính cho các khái niệm), [Find BLE devices](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices) (nguồn chính cho việc quét), [Set up Bluetooth](https://developer.android.com/develop/connectivity/bluetooth/setup) (adapter, `isEnabled`, `ACTION_STATE_CHANGED`), [BluetoothAdapter.isEnabled](https://developer.android.com/reference/android/bluetooth/BluetoothAdapter#isEnabled()) (chỉ true khi bật hẳn), [Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions) (`uses-feature`), và [Broadcasts overview](https://developer.android.com/develop/background-work/background-tasks/broadcasts) (receiver được export).
- iOS: [CBCentralManager](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager) (nguồn chính), [CBCentralManagerDelegate](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerdelegate), [scanForPeripherals(withServices:options:)](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager/scanforperipherals(withservices:options:)), [CBUUID](https://developer.apple.com/documentation/corebluetooth/cbuuid), [CBCharacteristicProperties](https://developer.apple.com/documentation/corebluetooth/cbcharacteristicproperties) và [CBPeer.identifier](https://developer.apple.com/documentation/corebluetooth/cbpeer/identifier).
- Kotlin và Swift: [callbackFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/callback-flow.html), [trySend](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-send-channel/try-send.html) và [close](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-send-channel/close.html); [SKIE: Flows](https://skie.touchlab.co/features/flows) (nó chuyển đổi theo chiều nào).
- [LightBlue](https://apps.apple.com/us/app/lightblue/id557428110) trên App Store: peripheral ảo cho bài này và các bài 14–16.
- [Cheatsheet: BLE](https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html): các chữ, hai API quét đặt cạnh nhau, và các cái bẫy.
- Kinh nghiệm thực tế: các tag [android-bluetooth](https://stackoverflow.com/questions/tagged/android-bluetooth) và [core-bluetooth](https://stackoverflow.com/questions/tagged/core-bluetooth) trên Stack Overflow; tìm "scanning too frequently" và "CBCentralManager delegate not called".

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Không file nào bị xoá, và mọi thứ khác giữ như ở m07. `iosApp/iosApp.xcodeproj` được sinh bởi `xcodegen generate`. Khi hai track đổi một file có cùng đường dẫn, tiêu đề của nó ghi tên track.

**Dùng chung cho mọi track: app core, adapter và Koin (`commonMain`)**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A scan that couldn't start or that failed: no permission, no radio, Bluetooth off, or an
    // error from the radio. The message is for the user. The service and outbound adapters
    // throw it, and it reaches inbound adapters through DeviceScanning.
    class ScanException(message: String) : Exception(message)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Outbound port: what the app needs from a Bluetooth radio, in the app's own terms.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
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

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceScanning.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Inbound port: what the app offers for finding devices. Inbound adapters (the shared
    // ViewModels) call it, and ScanningService implements it.
    interface DeviceScanning {
        // Named devices whose name contains nameFilter, each reported once, as they are found.
        // Collecting starts a scan, and cancelling the collector stops it. Throws ScanException,
        // also before the scan starts: no permission, no radio, or Bluetooth off.
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

    // Service: the app's scan rules on top of a raw radio scan. Start the radio only when the
    // permission is granted and the radio is there and on. Then keep the devices that have a
    // name containing the filter (ignoring case and surrounding spaces), and report each once.
    class ScanningService(
        private val scanner: BleScanner,
        private val permissions: PermissionChecker,
    ) : DeviceScanning {
        override fun scan(nameFilter: String): Flow<Device> = flow {
            checkReady()
            val wanted = nameFilter.trim()
            val seen = mutableSetOf<String>()
            scanner.scan().collect { device ->
                val named = device.name.isNotBlank()
                if (named && device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                    emit(device)
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
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.withTimeoutOrNull
    import kotlin.time.Duration.Companion.seconds

    // Inbound adapter: turns the screen's events into calls on the DeviceScanning and
    // PermissionAccess ports, and the results into UI state. It knows the ports only.
    class DeviceListViewModel(
        private val scanning: DeviceScanning,
        private val permissions: PermissionAccess,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(
            DeviceListUiState(bluetooth = permissions.status(Permission.Bluetooth)),
        )
        val uiState: StateFlow<DeviceListUiState> = _uiState.asStateFlow()

        private var scanJob: Job? = null
        private var permissionJob: Job? = null

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

        companion object {
            // A real radio drains the battery while it scans, so every scan has a time limit.
            val SCAN_TIMEOUT = 10.seconds
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.outbound.BleScanner
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Outbound adapter: a pretend radio behind the BleScanner port. Like a real one, it hears
    // every device over and over, one advertisement every 0.3 s, until the collector cancels.
    // The app no longer uses it; bind it in place of a real radio to run without one.
    class SimulatedBleScanner : BleScanner {
        override suspend fun isAvailable(): Boolean = true

        override suspend fun isEnabled(): Boolean = true

        override fun scan(): Flow<Device> = flow {
            while (true) {
                for (device in SampleDevices.all) {
                    delay(300)
                    emit(device)
                }
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SampleDevices.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device

    // The devices the simulated radio "hears". The detail screen still looks devices up here.
    object SampleDevices {
        val all: List<Device> = listOf(
            Device(id = "C4:7C:8D:6A:01:10", name = "OBD-II Adapter", rssi = -48),
            Device(id = "C4:7C:8D:6A:01:11", name = "Heart Rate Monitor", rssi = -61),
            Device(id = "C4:7C:8D:6A:01:12", name = "Tire Pressure Sensor", rssi = -67),
            Device(id = "C4:7C:8D:6A:01:13", name = "Thermometer", rssi = -74),
            Device(id = "C4:7C:8D:6A:01:14", name = "Smart Scale", rssi = -85),
        )

        fun find(id: String): Device? = all.firstOrNull { it.id == id }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import org.koin.core.context.startKoin
    import org.koin.core.module.dsl.viewModelOf
    import org.koin.dsl.module

    // The composition root, as a Koin module: which service implements each inbound port,
    // which adapter implements each outbound port, and how to build each ViewModel.
    internal val appModule = module {
        single<DeviceScanning> { ScanningService(get(), get()) }
        single<PermissionAccess> { PermissionService(get()) }
        viewModelOf(::DeviceListViewModel)
    }

    // The outbound adapters that each platform builds itself and passes to initKoin.
    internal fun platformModule(permissionChecker: PermissionChecker, bleScanner: BleScanner) = module {
        single { permissionChecker }
        single { bleScanner }
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin(permissionChecker: PermissionChecker, bleScanner: BleScanner) {
        startKoin {
            modules(appModule, platformModule(permissionChecker, bleScanner))
        }
    }
    ```

**Dùng chung cho mọi track: nửa Kotlin của hai radio (`androidMain`, `iosMain`)**

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.annotation.SuppressLint
    import android.bluetooth.BluetoothAdapter
    import android.bluetooth.BluetoothManager
    import android.bluetooth.le.ScanCallback
    import android.bluetooth.le.ScanResult
    import android.bluetooth.le.ScanSettings
    import android.content.BroadcastReceiver
    import android.content.Context
    import android.content.Intent
    import android.content.IntentFilter
    import android.content.pm.PackageManager
    import androidx.core.content.ContextCompat
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.outbound.BleScanner
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow

    // Outbound adapter: the phone's Bluetooth LE radio, behind the BleScanner port.
    // BluetoothLeScanner reports to a callback object; callbackFlow turns those calls into a Flow.
    class AndroidBleScanner(private val context: Context) : BleScanner {
        private val adapter: BluetoothAdapter? =
            context.getSystemService(BluetoothManager::class.java)?.adapter

        override suspend fun isAvailable(): Boolean =
            adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)

        override suspend fun isEnabled(): Boolean = adapter?.isEnabled == true

        // ScanningService checks the permission before every scan, so lint's check is suppressed.
        @SuppressLint("MissingPermission")
        override fun scan(): Flow<Device> = callbackFlow {
            val scanner = adapter?.bluetoothLeScanner ?: throw ScanException("Bluetooth is off.")
            val callback = object : ScanCallback() {
                override fun onScanResult(callbackType: Int, result: ScanResult) {
                    val name = result.scanRecord?.deviceName.orEmpty()
                    trySend(Device(id = result.device.address, name = name, rssi = result.rssi))
                }

                override fun onScanFailed(errorCode: Int) {
                    close(ScanException("The scan failed (Android error $errorCode)."))
                }
            }
            // Turning Bluetooth off ends the scan without a call to the callback, so listen for it.
            // The broadcast comes from the Bluetooth app, so the receiver must be exported.
            val bluetoothOff = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
                    if (state != BluetoothAdapter.STATE_ON) close(ScanException("Bluetooth was turned off."))
                }
            }
            ContextCompat.registerReceiver(
                context, bluetoothOff, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
                ContextCompat.RECEIVER_EXPORTED,
            )
            val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
            scanner.startScan(null, settings, callback)

            awaitClose {
                context.unregisterReceiver(bluetoothOff)
                // Stop even when isEnabled is false: it's false while Bluetooth is turning off, and in
                // the BLE-only mode some phones keep for location's "Bluetooth scanning".
                try {
                    scanner.stopScan(callback)
                } catch (e: IllegalStateException) {
                    // Bluetooth is fully off, and going fully off drops every app's scan.
                }
            }
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ScanFlow.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import kotlinx.coroutines.channels.ProducerScope
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow

    // Swift can't build a Kotlin Flow, so the Swift scanner asks for one here. Collecting the Flow
    // calls the radio's startScan; cancelling the collector calls its stopScan. Not a port: the
    // app core never sees it. It's the Kotlin half of the iOS adapter.
    fun scanFlow(radio: IosRadio): Flow<Device> = callbackFlow {
        radio.startScan(ScanFeed(this))
        awaitClose { radio.stopScan() }
    }

    // What the Swift scanner implements for scanFlow: start and stop the real radio.
    interface IosRadio {
        fun startScan(feed: ScanFeed)
        fun stopScan()
    }

    // Where the Swift scanner reports: each device it hears, or the failure that ends the scan.
    class ScanFeed internal constructor(private val scope: ProducerScope<Device>) {
        fun heard(device: Device) {
            scope.trySend(device)
        }

        fun failed(message: String) {
            scope.close(ScanException(message))
        }
    }
    ```

**Dùng chung cho mọi track: test (`commonTest`)**

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.outbound.BleScanner
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.emitAll
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.flow.receiveAsFlow

    // Fake: an outbound adapter written for tests, behind the BleScanner port. The test plays
    // the radio: whether it exists and is on, what is heard and when, and whether it fails.
    class FakeBleScanner : BleScanner {
        private val heard = Channel<Device>(Channel.UNLIMITED)
        var available = true
        var enabled = true
        var failure: ScanException? = null
        var scansStarted = 0
            private set
        var isScanning = false
            private set

        override suspend fun isAvailable(): Boolean = available

        override suspend fun isEnabled(): Boolean = enabled

        override fun scan(): Flow<Device> = flow {
            scansStarted++
            failure?.let { throw it }
            isScanning = true
            try {
                emitAll(heard.receiveAsFlow())
            } finally {
                isScanning = false
            }
        }

        fun hear(vararg devices: Device) {
            devices.forEach { heard.trySend(it) }
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
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/ScanningServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import app.cash.turbine.test
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.doubles.FakeBleScanner
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.cancelAndJoin
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertIs
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.hours

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

            testScheduler.advanceTimeBy(1.hours) // an hour of virtual time, with nothing heard
            assertTrue(radio.isScanning)

            collector.cancelAndJoin()
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

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import app.cash.turbine.test
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.doubles.TestDeviceScanning
    import com.example.devicemonitor.doubles.TestPermissionAccess
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
        private lateinit var viewModel: DeviceListViewModel

        @BeforeTest
        fun setUp() {
            // viewModelScope runs on Dispatchers.Main. In a test, Main becomes a test
            // dispatcher whose clock runTest controls, so delays and timeouts take no real time.
            Dispatchers.setMain(StandardTestDispatcher())
            viewModel = DeviceListViewModel(scanning, permissions)
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

            val fresh = DeviceListViewModel(scanning, permissions)

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
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
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
                modules(appModule, platformModule(FakePermissionChecker(), FakeBleScanner()))
            }.koin

            assertNotNull(koin.get<DeviceListViewModel>())
        }
    }
    ```

**Android**

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
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
            initKoin(permissionChecker, AndroidBleScanner(this))
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

            // Back from Settings (or anywhere else): the permission may have changed.
            LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refreshPermission() }

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
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Device Monitor", style = MaterialTheme.typography.headlineSmall)
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
                    nav.navigate(R.id.toDetail, Bundle().apply { putString("deviceId", device.id) })
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

**iOS**

??? example "iosApp/iosApp/IosBleScanner.swift · both iOS tracks"
    ```swift
    import CoreBluetooth
    import Shared

    // Outbound adapter: the iPhone's Bluetooth LE radio, behind the Kotlin BleScanner port.
    // CBCentralManager reports everything to its delegate, this object, and holds it only weakly:
    // Koin keeps this adapter alive for the life of the app, and the adapter keeps the manager.
    @MainActor
    final class IosBleScanner: NSObject, @preconcurrency BleScanner, @preconcurrency IosRadio,
        @preconcurrency CBCentralManagerDelegate {
        private var manager: CBCentralManager?
        private var waitingForState: [CheckedContinuation<Void, Never>] = []
        private var feed: ScanFeed?

        // The Kotlin suspend funs. As with __request in Lesson 12, Swift implements the
        // originals; a Kotlin Boolean crosses as KotlinBoolean.
        func __isAvailable() async throws -> KotlinBoolean {
            let state = await knownState()
            return KotlinBoolean(bool: state != .unsupported)
        }

        func __isEnabled() async throws -> KotlinBoolean {
            let state = await knownState()
            return KotlinBoolean(bool: state == .poweredOn)
        }

        // Swift can't build a Kotlin Flow, so it asks Kotlin for one (ScanFlow.kt, in iosMain).
        // SKIE shows a Kotlin Flow to Swift as SkieSwiftFlow, in both directions.
        func scan() -> SkieSwiftFlow<Device> {
            scanFlow(radio: self)
        }

        // IosRadio: scanFlow calls these when the Flow is collected and when it is cancelled.
        func startScan(feed: ScanFeed) {
            guard let manager, manager.state == .poweredOn else {
                feed.failed(message: "Bluetooth is off.")
                return
            }
            self.feed = feed
            manager.scanForPeripherals(withServices: nil)
        }

        func stopScan() {
            feed = nil
            if manager?.state == .poweredOn { manager?.stopScan() }
        }

        // Called on the main queue (queue: nil) for each advertisement the radio hears.
        func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                            advertisementData: [String: Any], rssi RSSI: NSNumber) {
            let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
            feed?.heard(device: Device(id: peripheral.identifier.uuidString, name: name, rssi: RSSI.int32Value))
        }

        // Called on the main queue whenever the radio's state changes: first when the manager
        // learns it, then each time Bluetooth is turned off or on.
        func centralManagerDidUpdateState(_ central: CBCentralManager) {
            guard central.state != .unknown, central.state != .resetting else { return }
            let waiting = waitingForState
            waitingForState = []
            waiting.forEach { $0.resume() }
            // Below poweredOn, scanning has stopped: end the scan the app is waiting on.
            if central.state != .poweredOn, let feed {
                self.feed = nil
                feed.failed(message: "Bluetooth was turned off.")
            }
        }

        // A new manager starts in .unknown and learns the radio's state a moment later, in
        // centralManagerDidUpdateState. Wait for that before answering.
        private func knownState() async -> CBManagerState {
            let manager = self.manager ?? makeManager()
            if manager.state == .unknown || manager.state == .resetting {
                await withCheckedContinuation { waitingForState.append($0) }
            }
            return manager.state
        }

        // No system alert when Bluetooth is off: the app shows its own message (ScanningService).
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
                AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker(), bleScanner: IosBleScanner())
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
                        NavigationLink(value: DeviceRoute(id: device.id)) {
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

=== "UIKit"

    ??? example "iosApp/iosApp/AppDelegate.swift"
        ```swift
        import UIKit
        import Shared

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            func application(_ application: UIApplication,
                             didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
                AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker(), bleScanner: IosBleScanner())
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
                guard let deviceId = dataSource.itemIdentifier(for: indexPath) else { return }
                navigationController?.pushViewController(DeviceDetailViewController(deviceId: deviceId), animated: true)
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A4, A5, A7 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0 cùng `kotlinx-coroutines-test` để có thời gian ảo); ví dụ ở A6 là chương trình Swift đã compile và chạy thật (Swift 6.3.2, chế độ Swift 6). Tất cả là **mô hình**: console không có radio Bluetooth, nên "radio" trong đó là code giả bắt chước hành vi mà bài mô tả. Mô phỏng ở A9 cũng là mô hình, không phải app thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-hinh-tuong-ble-ai-phat-thanh-nho-va-may-do-song): hình tượng cho BLE (đài phát thanh nhỏ, máy dò sóng, độ to của tiếng) (mục 1).
    3. [A9](#a9-phong-thi-nghiem-radar-quet-ba-cua-va-mot-cach-e-dung): **bấm thử** radar quét, ba cửa kiểm tra và cách một lần quét dừng.
    4. [A3](#a3-so-voi-web-bluetooth-va-vi-sao-phai-dung-may-that): đặt BLE native cạnh Web Bluetooth mà bạn có thể đã biết (mục 2, 5, 6).
    5. [A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that) và [A5](#a5-callbackflow-cay-cau-tu-callback-sang-flow-chay-that): luật của service và `callbackFlow`, chạy thật (mục 3, 4, 5).
    6. [A6](#a6-radio-ios-hai-nua-mot-adapter-va-delegate-weak-chay-that-bang-swift): radio iOS gồm hai nửa, và cái bẫy delegate weak (mục 6).
    7. [A7](#a7-stop-timeout-va-quet-qua-thuong-xuyen-chay-that) và [A8](#a8-android-tat-bluetooth-giua-chung-bang-trang-thai): Stop, timeout, "quét quá thường xuyên", và Bluetooth bị tắt giữa chừng (mục 5 và 8).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Một **peripheral** (cảm biến, LightBlue trên Mac) liên tục phát những **quảng cáo** ngắn; điện thoại là **central**, chỉ việc **nghe**. Quét là nghe, không kết nối.
    2. Port `BleScanner` có thêm hai câu hỏi, `isAvailable()` và `isEnabled()`, vì radio thật có thể không có hoặc bị tắt; chúng là `suspend` vì iOS trả lời chậm.
    3. `ScanningService` giữ **luật của app**: kiểm tra quyền → có radio → đang bật, rồi mới bật radio; sau đó bỏ thiết bị không tên, lọc theo tên, và báo **mỗi id một lần**.
    4. Mỗi nền tảng có một adapter thật: Android bọc `ScanCallback` thành `Flow` bằng **`callbackFlow`**; iOS để Swift bơm vào một `Flow` mà Kotlin dựng (`ScanFlow.kt`), vì Swift không tự dựng được `Flow`.
    5. Stop và timeout 10 s dừng quét **theo cùng một cách**: huỷ việc collect, việc huỷ chạy xuống tới `awaitClose`, và ở đó radio dừng.

Ví dụ đời thường cho cả bài: bạn đứng giữa một khu chợ đêm, mỗi sạp có một cái loa nhỏ cứ vài giây lại hô tên sạp (peripheral quảng cáo). Bạn cầm một máy ghi âm (central) đi dò. Trước khi bật máy, bạn kiểm tra: có được phép ghi âm không, máy có micro không, máy có pin không (ba cửa). Khi ghi, bạn chỉ chép vào sổ những sạp **có hô tên**, tên khớp thứ bạn tìm, và mỗi sạp chép **một lần** dù nó hô cả chục lần. Ghi tối đa 10 giây (timeout) hoặc tới khi bạn bấm dừng (Stop).

| Chữ trong bài | Nói đơn giản | Trong m08 là |
|---|---|---|
| central / peripheral | bên nghe / bên phát | điện thoại / LightBlue trên Mac |
| advertisement (quảng cáo) | gói tin ngắn peripheral phát đi liên tục, có thể kèm tên | thứ `onScanResult` / `didDiscover` nhận |
| RSSI | độ to của tín hiệu, dBm, số âm, gần 0 là mạnh | `Device.rssi`, ví dụ -48 |
| GATT client / server | sau khi kết nối: bên hỏi / bên trả lời | dùng từ bài 14 |
| service / characteristic / descriptor | ngăn kéo / tờ phiếu có một giá trị / nhãn ghi chú trên phiếu | dùng từ bài 15 |
| UUID | mã 128-bit nhận diện một service hay characteristic | chưa dùng ở bài này |
| `callbackFlow` | khuôn biến API callback thành `Flow` | `AndroidBleScanner.scan()`, `scanFlow()` |
| `trySend` | thả một giá trị vào flow, không chờ, không ném lỗi | trong `onScanResult`, `ScanFeed.heard` |
| `awaitClose` | "chờ tới khi người nghe bỏ đi, rồi dọn dẹp" | gọi `stopScan` |
| `close(e)` | kết thúc flow bằng một lỗi | `onScanFailed`, Bluetooth bị tắt |
| delegate weak | manager trỏ tới delegate mà không giữ nó sống | `IosBleScanner` phải được Koin giữ |
| `uses-feature … required="false"` | "app dùng BLE nhưng vẫn cài được trên máy không có" | manifest Android |

### A2. Hình tượng BLE: đài phát thanh nhỏ và máy dò sóng

Giải thích thêm cho [mục 1](#1-ble-trong-vai-cau).

**Peripheral là một đài phát thanh tí hon.** Nó không biết ai đang nghe, cũng không cần biết. Cứ đều đặn một khoảng thời gian, nó phát một đoạn quảng cáo rất ngắn: "Tôi là Heart Rate Monitor". Khoảng thời gian đó gọi là **advertising interval**; đặc tả Bluetooth cho phép từ vài chục mili giây tới vài giây (con số chính xác lấy từ đặc tả, mình không đo trong khoá này). Phát dày thì dễ được nghe thấy nhưng tốn pin của peripheral.

**Central là máy dò sóng.** Bật quét là xoay núm dò qua các kênh quảng cáo và ghi lại mọi đài nghe được. Mỗi lần nghe được một đoạn quảng cáo là một lần `onScanResult` (Android) hay `didDiscover` (iOS). Cùng một đài phát mười lần thì máy dò nghe mười lần: đó là vì sao port nói "cùng một thiết bị có thể tới lần nữa", và vì sao service phải lọc trùng.

**RSSI là độ to của tiếng.** Đơn vị dBm, luôn là số âm với BLE thường gặp: -48 là đài ngay cạnh bạn, -85 là đài ở cuối phòng. Nó dao động liên tục (người đi ngang, tường, cách bạn cầm máy), nên đừng coi nó là khoảng cách chính xác. Giá trị đặc biệt 127 trên iOS nghĩa là "không đo được".

**Quét khác kết nối.** Quét là nghe radio. Kết nối (bài 14) là **gọi điện vào đài**: lúc đó điện thoại thành GATT client (người hỏi), peripheral thành GATT server (người trả lời). Chỉ khi đã gọi được thì mới xem được "tủ hồ sơ" GATT:

| GATT | Hình tượng tủ hồ sơ | Ví dụ |
|---|---|---|
| service | một ngăn kéo có dán mã số | service nhịp tim, mã ngắn `180D` |
| characteristic | một tờ phiếu trong ngăn, ghi **một** giá trị | số đo nhịp tim hiện tại |
| descriptor | mẩu nhãn ghi chú dán trên phiếu | "đơn vị: nhịp/phút" |
| UUID | mã số của ngăn / phiếu, 128 bit | mã ngắn `180D` là `0000180D-0000-1000-8000-00805F9B34FB` (ghép vào base UUID ở mục 1) |

Bốn thuộc tính của một characteristic, theo cùng hình tượng:

| Thuộc tính | Hình tượng | Ai bắt đầu | Có xác nhận? | Trong khoá |
|---|---|---|---|---|
| read | bạn mở ngăn đọc tờ phiếu | central | (là một câu hỏi, có câu trả lời) | bài 15 |
| write | bạn bỏ phiếu mới vào ngăn; "without response" là bỏ vào rồi đi luôn | central | có / không | không dùng |
| notify | đài tự gọi báo khi có tin mới | peripheral | không | bài 16 |
| indicate | như notify, nhưng là **thư bảo đảm**: bạn phải ký nhận | peripheral | có | không dùng |

Áp vào app: ở m08, Device Monitor chỉ làm nửa trên của sơ đồ ở mục 1, là máy dò sóng. Mỗi hàng trong danh sách là một đài nó nghe được và có hô tên; cột dBm là độ to lúc **lần đầu** nghe đài đó (service bỏ các lần sau, xem [A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that)).

### A3. So với Web Bluetooth, và vì sao phải dùng máy thật

Giải thích thêm cho [mục 2](#2-vi-sao-ble-can-thiet-bi-that-va-lightblue), [mục 5](#5-radio-android-callbackflow) và [mục 6](#6-radio-ios-bang-swift).

Nếu bạn từng làm web hoặc Ionic, có thể bạn đã gặp **Web Bluetooth**. Khác biệt lớn nhất: trên web, trang **không được tự quét**. Trang gọi `navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "Heart" }] })`, trình duyệt hiện một hộp chọn, và trang chỉ nhận đúng một thiết bị người dùng đã chọn. Native thì ngược lại: app nhận **mọi** quảng cáo và tự quyết hiện gì. Đó là lý do bài này cần quyền, cần luật lọc, và cần nút Stop.

Các thông tin về Web Bluetooth dưới đây lấy từ tài liệu (MDN, Chrome), **chưa kiểm chứng** trong khoá này.

| Việc | Web Bluetooth (Chrome) | Android (`BluetoothLeScanner`) | iOS (`CBCentralManager`) |
|---|---|---|---|
| bắt đầu quét | `requestDevice(...)`; trình duyệt hiện hộp chọn | `startScan(null, settings, callback)` | `scanForPeripherals(withServices: nil)` |
| kết quả tới thế nào | một `Promise` trả về một thiết bị | gọi `onScanResult` mỗi quảng cáo | gọi `didDiscover` trên delegate, mặc định gộp trùng |
| id thiết bị | `device.id`, chuỗi mờ do trình duyệt cấp | địa chỉ kiểu `C4:7C:8D:…` | UUID do iPhone đó cấp |
| tên | `device.name` | `scanRecord?.deviceName` | `CBAdvertisementDataLocalNameKey` |
| dừng | trình duyệt tự lo | `stopScan(callback)` | `stopScan()` |
| radio tắt giữa chừng | — | không báo qua callback; phải nghe `ACTION_STATE_CHANGED` | `centralManagerDidUpdateState` |
| quét thô mọi quảng cáo | `requestLEScan()`, thử nghiệm, sau cờ | có | có |
| Safari / iOS | không hỗ trợ | — | — |

Với dev Ionic: plugin cộng đồng `@capacitor-community/bluetooth-le` có các hàm như `BleClient.requestLEScan(options, callback)` và `stopLEScan()`. Bên dưới, phần native của nó gọi chính hai API ở cột Android và iOS (mình đọc theo tài liệu plugin, chưa mở source). Bài này là bạn tự viết lớp đó, và nối nó vào app core qua port.

**Vì sao máy thật?** Ví dụ đời thường: emulator giống một **phòng thu cách âm** có sẵn vài cái loa giả (beacon giả lập của image API 30). Nó không có cửa sổ, nên không nghe được đài thật nào bên ngoài (Mac của bạn). Simulator iOS thì không có cả máy dò sóng (`unsupported`). Vậy:

| Cái cần kiểm | Emulator / Simulator | Máy thật |
|---|---|---|
| test `allTests`, thông báo lỗi, Stop, timeout | được | được |
| "Bluetooth is off…", "Bluetooth was turned off." | emulator Android được (`adb shell cmd bluetooth_manager disable`) | được |
| thấy LightBlue trong danh sách | không | **chỉ ở đây** |
| id kiểu MAC (Android) / UUID (iOS) của cùng một thiết bị | không | được |

### A4. Ba cửa trước khi quét, và lọc trùng: chạy thật

Giải thích thêm cho [mục 3](#3-port-lon-them) và [mục 4](#4-service-so-huu-cac-luat-quet).

Ví dụ đời thường: bảo vệ toà nhà kiểm theo **đúng thứ tự**: bạn có thẻ ra vào không (quyền), toà nhà có thang máy không (có radio), thang máy có điện không (đang bật). Thiếu một thứ là dừng ngay ở cửa đó, và thang máy **không bao giờ được gọi**. Thứ tự quan trọng vì trên iOS "hỏi có thang máy không" (`isAvailable()`) chính là việc tạo `CBCentralManager`, thứ bật hộp hỏi quyền. Qua cửa rồi thì lễ tân ghi sổ khách: chỉ khách có tên, tên khớp thứ bạn tìm, và mỗi người **một dòng** dù họ đi qua quầy nhiều lần.

Chương trình dưới đây dựng lại `ScanningService` của m08 với một radio giả phát lại cùng thiết bị nhiều lần, có cả một thiết bị không tên.

```kotlin title="service.kt"
// Mô hình của ScanningService m08: ba cửa kiểm tra, rồi lọc tên, bỏ thiết bị không tên,
// và mỗi id một lần (dedupe). Radio giả phát lại cùng thiết bị nhiều lần như radio Android.
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*

data class Device(val id: String, val name: String, val rssi: Int)
class ScanException(message: String) : Exception(message)

interface BleScanner {
    suspend fun isAvailable(): Boolean
    suspend fun isEnabled(): Boolean
    fun scan(): Flow<Device>
}

class AirRadio(private val air: List<Device>) : BleScanner {
    var available = true
    var enabled = true
    var scansStarted = 0
    override suspend fun isAvailable() = available
    override suspend fun isEnabled() = enabled
    override fun scan(): Flow<Device> = flow {
        scansStarted++
        for (d in air) {
            println("    radio nghe: ${d.id} \"${d.name}\" ${d.rssi} dBm")
            emit(d)
        }
    }
}

class ScanningService(private val scanner: BleScanner, private val granted: () -> Boolean) {
    fun scan(nameFilter: String): Flow<Device> = flow {
        if (!granted()) throw ScanException("Scanning needs the Bluetooth permission.")
        if (!scanner.isAvailable()) throw ScanException("This phone has no Bluetooth LE radio.")
        if (!scanner.isEnabled()) throw ScanException("Bluetooth is off. Turn it on, then scan again.")
        val wanted = nameFilter.trim()
        val seen = mutableSetOf<String>()
        scanner.scan().collect { device ->
            val named = device.name.isNotBlank()
            if (named && device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                emit(device)
            }
        }
    }
}

val air = listOf(
    Device("AA:01", "OBD-II Adapter", -48),
    Device("AA:02", "Heart Rate Monitor", -61),
    Device("AA:01", "OBD-II Adapter", -52),     // trùng id
    Device("AA:09", "", -70),                   // không quảng cáo tên
    Device("AA:02", "Heart Rate Monitor", -58), // trùng id
    Device("AA:03", "Smart Scale", -85),
)

suspend fun run(title: String, filter: String, setup: (AirRadio) -> Unit = {}, granted: Boolean = true) {
    println("— $title (filter=\"$filter\")")
    val radio = AirRadio(air).also(setup)
    val service = ScanningService(radio) { granted }
    try {
        service.scan(filter).collect { println("  → lên màn hình: ${it.name}") }
    } catch (e: ScanException) {
        println("  → Scan failed: ${e.message}")
    }
    println("  scansStarted = ${radio.scansStarted}")
}

fun main() = runTest {
    run("Quyền bị từ chối", "", granted = false)
    run("Không có radio", "", setup = { it.available = false })
    run("Bluetooth tắt", "", setup = { it.enabled = false })
    run("Mọi thứ sẵn sàng", "")
    run("Mọi thứ sẵn sàng", "  MONITOR ")

    println("— Bẫy: distinctUntilChanged chỉ bỏ trùng LIỀN NHAU")
    val ids = air.map { it.id }
    println("  distinctUntilChanged: ${ids.asFlow().distinctUntilChanged().toList()}")
    val seen = mutableSetOf<String>()
    println("  seen.add (như service): ${ids.asFlow().filter { seen.add(it) }.toList()}")
}
```

```text title="Output"
— Quyền bị từ chối (filter="")
  → Scan failed: Scanning needs the Bluetooth permission.
  scansStarted = 0
— Không có radio (filter="")
  → Scan failed: This phone has no Bluetooth LE radio.
  scansStarted = 0
— Bluetooth tắt (filter="")
  → Scan failed: Bluetooth is off. Turn it on, then scan again.
  scansStarted = 0
— Mọi thứ sẵn sàng (filter="")
    radio nghe: AA:01 "OBD-II Adapter" -48 dBm
  → lên màn hình: OBD-II Adapter
    radio nghe: AA:02 "Heart Rate Monitor" -61 dBm
  → lên màn hình: Heart Rate Monitor
    radio nghe: AA:01 "OBD-II Adapter" -52 dBm
    radio nghe: AA:09 "" -70 dBm
    radio nghe: AA:02 "Heart Rate Monitor" -58 dBm
    radio nghe: AA:03 "Smart Scale" -85 dBm
  → lên màn hình: Smart Scale
  scansStarted = 1
— Mọi thứ sẵn sàng (filter="  MONITOR ")
    radio nghe: AA:01 "OBD-II Adapter" -48 dBm
    radio nghe: AA:02 "Heart Rate Monitor" -61 dBm
  → lên màn hình: Heart Rate Monitor
    radio nghe: AA:01 "OBD-II Adapter" -52 dBm
    radio nghe: AA:09 "" -70 dBm
    radio nghe: AA:02 "Heart Rate Monitor" -58 dBm
    radio nghe: AA:03 "Smart Scale" -85 dBm
  scansStarted = 1
— Bẫy: distinctUntilChanged chỉ bỏ trùng LIỀN NHAU
  distinctUntilChanged: [AA:01, AA:02, AA:01, AA:09, AA:02, AA:03]
  seen.add (như service): [AA:01, AA:02, AA:09, AA:03]
```

Đọc output:

- Ba trường hợp đầu dừng ở đúng cửa của mình, với đúng thông báo của bài, và `scansStarted = 0`: radio chưa bao giờ được bật. Đó là thứ test `neverStartsTheRadio…` chứng minh.
- Radio nghe 6 quảng cáo, màn hình chỉ nhận 3 thiết bị: `AA:01` lần hai bị `seen.add` từ chối (trả `false` vì đã có), `AA:09` không tên bị bỏ, `AA:02` lần hai cũng bị bỏ.
- Thiết bị lên màn hình **ngay khi nghe lần đầu**, không chờ quét xong: dòng "lên màn hình" xen giữa các dòng "radio nghe".
- RSSI trên màn hình là của **lần nghe đầu** (`-48`, không phải `-52`), vì các lần sau bị bỏ.
- Bộ lọc `"  MONITOR "` vẫn khớp "Heart Rate Monitor": `trim()` bỏ khoảng trắng, `ignoreCase = true` bỏ hoa thường.
- **Bẫy**: `distinctUntilChanged()` của Flow chỉ bỏ trùng **liền nhau**, nên `AA:01, AA:02, AA:01` vẫn còn cả ba. Muốn "mỗi id một lần trong cả lần quét" thì cần một tập đã thấy, như `seen.add`.

Mình không đếm số lần gọi `isAvailable()` ở đây: đó là bài tự làm 2.

| Việc | TypeScript / RxJS | Kotlin trong m08 |
|---|---|---|
| lọc trùng theo khoá trên cả luồng | `distinct(d => d.id)` (RxJS) hoặc `new Set()` tự giữ | `val seen = mutableSetOf<String>()` + `seen.add(device.id)` |
| chỉ bỏ trùng liền nhau | `distinctUntilChanged()` | `distinctUntilChanged()` |
| ném lỗi trước khi bắt đầu luồng | `throwError(() => …)` / `throw` trong `new Observable` | `throw ScanException(…)` trong `flow { }` |
| lỗi tới đâu | `subscribe({ error })` | `catch` của ViewModel → alert "Scan failed" |

Bài không dùng `debounce`. Nếu bạn quen tay định thêm nó (như `debounceTime` cho ô tìm kiếm), đừng đặt nó lên luồng quét: `debounce` bỏ các giá trị đến dồn dập, tức là bỏ chính những thiết bị khác nhau tới sát nhau.

Áp vào app: luật nằm trong service nên **một lần** cho cả hai nền tảng và mọi màn hình; adapter Android và adapter iOS không biết gì về tên, bộ lọc hay trùng lặp.

### A5. `callbackFlow`: cây cầu từ callback sang Flow, chạy thật

Giải thích thêm cho [mục 5](#5-radio-android-callbackflow) (và nửa Kotlin của iOS ở [mục 6](#6-radio-ios-bang-swift)).

Ví dụ đời thường: radio là một **vòi nước** chỉ biết chảy vào bất kỳ cái gì đặt dưới nó (callback). `callbackFlow` là đặt một cái **xô có vòi xả** (channel) dưới vòi:

- `trySend(device)`: một giọt rơi vào xô. Không chờ, không ném lỗi; xô đầy thì giọt tràn ra ngoài (mất một quảng cáo, không sao).
- `close(ScanException(…))`: dán biển "ngừng vì sự cố" lên xô; người đang hứng nhận lỗi đó.
- `awaitClose { stopScan(callback) }`: người giữ xô đứng chờ cho tới khi không ai hứng nữa, rồi **khoá vòi**. Quên bước này thì vòi chảy mãi (rò rỉ callback, radio quét mãi).

| Việc | RxJS `new Observable` | Kotlin `callbackFlow` |
|---|---|---|
| đẩy một giá trị từ callback | `subscriber.next(v)` | `trySend(v)` |
| kết thúc bằng lỗi | `subscriber.error(e)` | `close(e)` |
| dọn dẹp khi người nghe huỷ | `return () => radio.off(cb)` | `awaitClose { radio.stopScan(cb) }` |
| quên dọn dẹp | không lỗi, chỉ rò rỉ | **ném `IllegalStateException`** (xem output) |

Chương trình dưới đây dựng một "radio" callback giả, bọc nó y như `AndroidBleScanner.scan()`, rồi thử ba chuyện: huỷ giữa chừng, radio báo lỗi, và quên `awaitClose`.

```kotlin title="callbackflow.kt"
// Mô hình (không phải Android thật): một "radio" kiểu callback như BluetoothLeScanner,
// được bọc thành Flow bằng callbackFlow như AndroidBleScanner. Thời gian là thời gian ảo của runTest.
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*

data class Device(val id: String, val name: String, val rssi: Int)
class ScanException(message: String) : Exception(message)

interface RadioCallback {                       // vai ScanCallback
    fun onScanResult(device: Device)
    fun onScanFailed(errorCode: Int)
}

// Radio giả: sau startScan, cứ 100 ms "nghe" một quảng cáo; failAfter thì báo lỗi.
class FakeRadio(private val scope: TestScope, private val failAfter: Int? = null) {
    private var job: Job? = null
    private val air = listOf(
        Device("AA:01", "OBD-II Adapter", -48),
        Device("AA:02", "Heart Rate Monitor", -61),
        Device("AA:01", "OBD-II Adapter", -50),   // cùng thiết bị, quảng cáo lần nữa
    )
    fun startScan(callback: RadioCallback) {
        println("t=${scope.currentTime}ms  [radio] startScan")
        job = scope.launch {
            var n = 0
            while (true) {
                delay(100)
                if (failAfter != null && n == failAfter) { callback.onScanFailed(2); return@launch }
                callback.onScanResult(air[n % air.size]); n++
            }
        }
    }
    fun stopScan(callback: RadioCallback) {
        job?.cancel()
        println("t=${scope.currentTime}ms  [radio] stopScan")
    }
}

// Như AndroidBleScanner.scan(): callback → trySend / close, awaitClose → stopScan.
fun FakeRadio.scan(): Flow<Device> = callbackFlow {
    val callback = object : RadioCallback {
        override fun onScanResult(device: Device) { trySend(device) }
        override fun onScanFailed(errorCode: Int) {
            close(ScanException("The scan failed (Android error $errorCode)."))
        }
    }
    startScan(callback)
    awaitClose { stopScan(callback) }
}

// Bản quên awaitClose.
fun FakeRadio.scanWithoutAwaitClose(): Flow<Device> = callbackFlow {
    startScan(object : RadioCallback {
        override fun onScanResult(device: Device) { trySend(device) }
        override fun onScanFailed(errorCode: Int) {}
    })
}

fun main() = runTest {
    println("— 1. Collect 350 ms rồi huỷ (như Stop / timeout)")
    val radio = FakeRadio(this)
    withTimeoutOrNull(350) {
        radio.scan().collect { println("t=${currentTime}ms  nhận ${it.id} ${it.name} ${it.rssi} dBm") }
    }
    println("t=${currentTime}ms  collector đã dừng")

    println("— 2. Radio báo lỗi sau 2 quảng cáo")
    try {
        FakeRadio(this, failAfter = 2).scan().collect { println("t=${currentTime}ms  nhận ${it.id}") }
    } catch (e: ScanException) {
        println("t=${currentTime}ms  catch: ${e.message}")
    }

    println("— 3. Quên awaitClose")
    try {
        FakeRadio(this).scanWithoutAwaitClose().collect { }
    } catch (e: IllegalStateException) {
        println("IllegalStateException: ${e.message}")
    }
    coroutineContext.cancelChildren() // dọn radio bị bỏ quên của phần 3
}
```

```text title="Output"
— 1. Collect 350 ms rồi huỷ (như Stop / timeout)
t=0ms  [radio] startScan
t=100ms  nhận AA:01 OBD-II Adapter -48 dBm
t=200ms  nhận AA:02 Heart Rate Monitor -61 dBm
t=300ms  nhận AA:01 OBD-II Adapter -50 dBm
t=350ms  [radio] stopScan
t=350ms  collector đã dừng
— 2. Radio báo lỗi sau 2 quảng cáo
t=350ms  [radio] startScan
t=450ms  nhận AA:01
t=550ms  nhận AA:02
t=650ms  [radio] stopScan
t=650ms  catch: The scan failed (Android error 2).
— 3. Quên awaitClose
t=650ms  [radio] startScan
IllegalStateException: 'awaitClose { yourCallbackOrListener.cancel() }' should be used in the end of callbackFlow block.
Otherwise, a callback/listener may leak in case of external cancellation.
See callbackFlow API documentation for the details.
```

Đọc output:

- **Phần 1**: `withTimeoutOrNull(350)` huỷ collector ở 350 ms, và ngay lúc đó `awaitClose` chạy `stopScan`. Không ai gọi `stopScan` trực tiếp: việc huỷ tự đi xuống. Để ý quảng cáo trùng `AA:01` vẫn tới: adapter không lọc, đó là việc của service ([A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that)).
- **Phần 2**: `close(ScanException)` cũng kết thúc flow, nên `awaitClose` **cũng chạy** (`stopScan` ở 650 ms) trước khi `catch` nhận lỗi. Một chỗ dọn dẹp cho cả hai đường kết thúc.
- **Phần 3**: thiếu `awaitClose`, khối `callbackFlow` chạy xong ngay và thư viện ném lỗi với câu nhắc `'awaitClose { yourCallbackOrListener.cancel() }' should be used in the end of callbackFlow block.` Đây là lý do tài liệu nói `awaitClose` "là bắt buộc".

Áp vào app: Android dùng nó trực tiếp trên `ScanCallback`. iOS dùng cùng khuôn trong `ScanFlow.kt`, chỉ đổi chỗ: callback là `ScanFeed.heard` / `ScanFeed.failed` mà Swift gọi, và `awaitClose` gọi `radio.stopScan()` của Swift.

### A6. Radio iOS: hai nửa một adapter, và delegate weak (chạy thật bằng Swift)

Giải thích thêm cho [mục 6](#6-radio-ios-bang-swift) và gotcha "delegate là weak".

**Vì sao hai nửa?** Ví dụ đời thường: Kotlin có một loại hộp thư riêng (`Flow`) mà chỉ thợ Kotlin đóng được. Swift không đóng được hộp, nhưng **bỏ thư vào** thì được. Nên Kotlin đóng hộp (`scanFlow`), đưa cho Swift một khe bỏ thư (`ScanFeed`), và Swift chỉ việc bỏ thư (`heard`) hoặc dán giấy báo lỗi (`failed`). Khi người nhận không đọc nữa, Kotlin gõ cửa Swift bảo "thôi phát" (`stopScan`).

Đường đi của một quảng cáo trên iOS, từng bước:

1. CoreBluetooth gọi `centralManager(_:didDiscover:advertisementData:rssi:)` của `IosBleScanner` trên main queue.
2. Swift đọc tên từ `CBAdvertisementDataLocalNameKey` (không có thì `""`), id từ `peripheral.identifier.uuidString`, rồi gọi `feed?.heard(device:)`.
3. `ScanFeed.heard` (Kotlin, `iosMain`) gọi `scope.trySend(device)` vào `callbackFlow` của `scanFlow`.
4. `ScanningService` collect flow đó: bỏ nếu không tên, không khớp bộ lọc, hoặc `seen.add(device.id)` trả `false`; còn lại thì `emit`.
5. ViewModel nhận thiết bị, cập nhật `ScanState.Scanning`, màn hình vẽ thêm một hàng.

So hai adapter:

| Việc | Android (`AndroidBleScanner`) | iOS (`IosBleScanner` + `ScanFlow.kt`) |
|---|---|---|
| ngôn ngữ | chỉ Kotlin | Swift (radio) + Kotlin (dựng `Flow`) |
| nhận kết quả | object `ScanCallback` | delegate `CBCentralManagerDelegate` (chính adapter) |
| biết radio có/bật | ngay (`adapter`, `isEnabled`) | phải chờ: state bắt đầu `.unknown`, chờ `centralManagerDidUpdateState` |
| Bluetooth tắt giữa chừng | callback im lặng; phải nghe broadcast | delegate được báo, adapter gọi `feed.failed` |
| quảng cáo trùng | mỗi quảng cáo một lần gọi | mặc định gộp: mỗi peripheral một lần |
| ai giữ object sống | Koin `single` | Koin `single`, **bắt buộc** vì delegate là weak |

**Delegate weak.** Ví dụ đời thường: manager ghi số điện thoại của delegate bằng **bút chì**. Nếu không ai khác giữ delegate (bằng bút mực), hệ thống tẩy số đó đi, và mọi cuộc gọi sau đó không tới ai. Chương trình dưới đây bắt chước đúng chuyện đó bằng một property `weak` như `CBCentralManager.delegate`:

```swift title="weak.swift"
// Mô hình (không phải CoreBluetooth thật): một manager giữ delegate bằng tham chiếu weak,
// như CBCentralManager. So hai cách giữ delegate.
protocol CentralDelegate: AnyObject {
    func didDiscover(_ name: String)
}

final class FakeCentralManager {
    weak var delegate: CentralDelegate?          // như CBCentralManager.delegate
    func radioHears(_ name: String) {
        if let delegate { delegate.didDiscover(name) }
        else { print("  [manager] nghe \(name), nhưng delegate = nil: không ai nhận") }
    }
}

final class Scanner: CentralDelegate {
    let label: String
    init(_ label: String) { self.label = label }
    func didDiscover(_ name: String) { print("  [\(label)] didDiscover \(name)") }
    deinit { print("  [\(label)] deinit: bị giải phóng") }
}

let manager = FakeCentralManager()

print("— 1. Scanner tạo trong một hàm, không ai giữ")
@MainActor func startScanLocally() {
    let scanner = Scanner("scanner cục bộ")
    manager.delegate = scanner
    manager.radioHears("OBD-II Adapter")         // còn trong hàm: vẫn sống
}                                                // hết hàm: scanner bị giải phóng
startScanLocally()
manager.radioHears("Heart Rate Monitor")

print("— 2. Scanner được giữ suốt đời app (như Koin single)")
let kept = Scanner("scanner được giữ")
manager.delegate = kept
manager.radioHears("Heart Rate Monitor")
manager.radioHears("Smart Scale")
```

```text title="Output"
— 1. Scanner tạo trong một hàm, không ai giữ
  [scanner cục bộ] didDiscover OBD-II Adapter
  [scanner cục bộ] deinit: bị giải phóng
  [manager] nghe Heart Rate Monitor, nhưng delegate = nil: không ai nhận
— 2. Scanner được giữ suốt đời app (như Koin single)
  [scanner được giữ] didDiscover Heart Rate Monitor
  [scanner được giữ] didDiscover Smart Scale
```

- Phần 1: scanner tạo trong hàm sống tới cuối hàm, nghe được thiết bị đầu tiên, rồi `deinit` ngay khi hàm kết thúc. Thiết bị sau tới manager nhưng `delegate` đã là `nil`: không crash, không lỗi, **chỉ im lặng**. Đây đúng là triệu chứng "quét bắt đầu nhưng không thiết bị nào được báo".
- Phần 2: scanner được giữ bởi một biến sống suốt chương trình (trong app là Koin `single`), nên mọi callback đều tới.
- Compile ở chế độ Swift 6, cần `@MainActor` trên hàm vì nó đụng vào biến toàn cục `manager`; `IosBleScanner` của bài cũng là `@MainActor`.

### A7. Stop, timeout và "quét quá thường xuyên" (chạy thật)

Giải thích thêm cho [mục 8](#8-stop-va-timeout) và gotcha "quét quá thường xuyên" ở [mục 5](#5-radio-android-callbackflow).

Ví dụ đời thường: lò vi sóng. Hẹn giờ hết (timeout) thì lò **tắt** và kêu "ting": bạn biết đồ ăn xong. Bấm Stop thì lò cũng **tắt** (cùng một công tắc: huỷ việc collect → `awaitClose` → radio dừng), nhưng **không có "ting"**: dòng sau `withTimeoutOrNull` không chạy. Nên `stopScan()` phải tự ghi `Finished`.

Chương trình dưới đây là ViewModel thu nhỏ của m08, với timeout rút còn 1 s cho dễ đọc.

```kotlin title="stop.kt"
// Mô hình của DeviceListViewModel m08: timeout và Stop cùng huỷ việc collect.
// Timeout rút ngắn còn 1 s cho dễ đọc (app thật: 10 s). Thời gian là thời gian ảo của runTest.
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*

sealed interface ScanState {
    data object Idle : ScanState
    data class Scanning(val found: List<String>) : ScanState
    data class Finished(val found: List<String>) : ScanState
}

class MiniViewModel(private val scope: TestScope) {
    val state = MutableStateFlow<ScanState>(ScanState.Idle)
    private var scanJob: Job? = null

    // Radio như callbackFlow: cứ 300 ms nghe một thiết bị mới, awaitClose = dừng radio.
    private fun radio(): Flow<String> = callbackFlow {
        val names = listOf("OBD-II Adapter", "Heart Rate Monitor", "Smart Scale", "Thermometer")
        val feeder = launch { names.forEach { delay(300); trySend(it) } }
        awaitClose { feeder.cancel(); println("t=${scope.currentTime}ms  awaitClose: radio dừng") }
    }

    fun startScan() {
        state.value = ScanState.Scanning(emptyList())
        scanJob = scope.launch {
            val found = mutableListOf<String>()
            withTimeoutOrNull(1_000) {
                radio().collect { found += it; state.value = ScanState.Scanning(found.toList()) }
            }
            println("t=${scope.currentTime}ms  dòng sau withTimeoutOrNull chạy")
            state.value = ScanState.Finished(found.toList())
        }
    }

    fun stopScan() {
        val job = scanJob ?: return
        if (!job.isActive) return
        job.cancel()
        val s = state.value
        if (s is ScanState.Scanning) state.value = ScanState.Finished(s.found)
    }
}

fun main() = runTest {
    println("— A. Để timeout (1 s) tự kết thúc")
    val a = MiniViewModel(this)
    a.startScan()
    advanceTimeBy(1_500); runCurrent()
    println("t=${currentTime}ms  state = ${a.state.value}")

    println("— B. Bấm Stop ở giây thứ 0,7")
    val b = MiniViewModel(this)
    b.startScan()
    advanceTimeBy(700); runCurrent()
    b.stopScan(); runCurrent()
    println("t=${currentTime}ms  state = ${b.state.value}")
    advanceTimeBy(2_000); runCurrent()
    println("t=${currentTime}ms  (2 s sau: không còn dòng nào chạy thêm)")
}
```

```text title="Output"
— A. Để timeout (1 s) tự kết thúc
t=1000ms  awaitClose: radio dừng
t=1000ms  dòng sau withTimeoutOrNull chạy
t=1500ms  state = Finished(found=[OBD-II Adapter, Heart Rate Monitor, Smart Scale])
— B. Bấm Stop ở giây thứ 0,7
t=2200ms  awaitClose: radio dừng
t=2200ms  state = Finished(found=[OBD-II Adapter, Heart Rate Monitor])
t=4200ms  (2 s sau: không còn dòng nào chạy thêm)
```

- **A (timeout)**: ở 1000 ms, `awaitClose` dừng radio, **rồi** "dòng sau withTimeoutOrNull chạy" và ghi `Finished` với 3 thiết bị (300, 600, 900 ms).
- **B (Stop ở 0,7 s của lần quét thứ hai)**: `awaitClose` vẫn dừng radio, nhưng dòng "sau withTimeoutOrNull" **không xuất hiện**: coroutine đã bị huỷ. State vẫn là `Finished` với 2 thiết bị nhờ `stopScan()` tự ghi. Hai giây sau cũng không có gì chạy thêm.
- Thiếu dòng `state.copy(scan = ScanState.Finished(scan.found))` trong `stopScan`, màn hình sẽ kẹt ở `Scanning` (nút vẫn ghi "Stop") dù radio đã dừng.

**"Quét quá thường xuyên".** Ví dụ đời thường: tổng đài chặn số gọi quá nhiều lần liên tục, và chặn **mà không báo** gì. Theo bài: 5 lần Scan/Stop trong khoảng 10 giây thì lần thứ 6 bị Android lờ đi, logcat ghi `App 'com.example.devicemonitor' is scanning too frequently`, màn hình vẫn "Scanning…" 10 giây rồi "No devices found"; chờ 31 giây thì lại quét được. (Trong source Android, giới hạn này là số lần bắt đầu quét trong một cửa sổ 30 giây; con số chính xác mình chưa kiểm chứng.)

| Triệu chứng khi test | Nghi gì trước |
|---|---|
| "No devices found" ngay sau khi bấm Scan/Stop liên tục | tìm chữ `frequently` trong `adb logcat`; chờ 30 giây |
| "Scanning…" mãi tới timeout dù đã tắt Bluetooth | thiếu receiver `ACTION_STATE_CHANGED` ([A8](#a8-android-tat-bluetooth-giua-chung-bang-trang-thai)) |
| iOS quét mà không thiết bị nào hiện | delegate bị giải phóng ([A6](#a6-radio-ios-hai-nua-mot-adapter-va-delegate-weak-chay-that-bang-swift)) |
| iOS: "This phone has no Bluetooth LE radio." | bạn đang ở Simulator, không phải lỗi |

### A8. Android tắt Bluetooth giữa chừng: bảng trạng thái

Giải thích thêm cho phần receiver và các ý 3, 4 ở [mục 5](#5-radio-android-callbackflow).

Ví dụ đời thường: `isEnabled` hỏi "**đèn chính** có đang sáng không". `stopScan` thì hỏi "**nhà còn điện không**". Lúc đang tắt đèn, hay khi chỉ còn đèn ngủ (chế độ chỉ-BLE cho "Bluetooth scanning" của dịch vụ vị trí), đèn chính đã tắt nhưng nhà vẫn có điện, và vẫn còn thứ cần tắt. Chỉ khi cúp điện hẳn thì `stopScan` mới ném lỗi, và lúc đó Android đã tự dọn mọi lần quét.

Bảng dưới gom lại những gì bài đo trên emulator API 36 và đọc trong source Android:

| Trạng thái Bluetooth | `isEnabled` | `stopScan(callback)` | Nếu chặn bằng `if (isEnabled)` | Adapter m08 làm gì |
|---|---|---|---|---|
| `STATE_ON` (bật hẳn) | `true` | dừng lần quét | gọi, đúng | gọi, đúng |
| `STATE_TURNING_OFF` (đang tắt) | `false` | dừng lần quét, không ném | **bỏ qua**: quét có thể còn chạy | receiver `close(...)` → `awaitClose` gọi `stopScan` |
| chế độ chỉ-BLE (`BLE_ON`) | `false` | dừng lần quét, không ném | **bỏ qua**: emulator vẫn liệt kê lần quét đang chạy | gọi, lần quét dừng |
| `STATE_OFF` (tắt hẳn) | `false` | ném `IllegalStateException("BT Adapter is not turned ON")` | bỏ qua, vô hại | `catch` đúng exception đó; Android đã bỏ mọi lần quét |

- Hàng thứ hai là trường hợp thường gặp nhất: receiver đóng flow ở trạng thái đầu tiên không phải `STATE_ON`, nên `awaitClose` thường chạy khi Bluetooth **đang tắt** (bài đo 4 trên 4 lần).
- Không có receiver, Android **không** gọi `onScanFailed` khi Bluetooth tắt; màn hình chờ tới timeout rồi báo sai "No devices found". iOS không cần mẹo này: `centralManagerDidUpdateState` báo luôn.
- Chỉ bắt `IllegalStateException`, không bắt `Exception`: mọi lỗi khác vẫn phải tới flow.

### A9. Phòng thí nghiệm: radar quét, ba cửa, và một cách để dừng

Ba mô phỏng bấm được. Chúng là mô hình dựng theo bài, không phải radio hay app thật; chuỗi trên màn hình và log giữ tiếng Anh như app.

#### 1. Radar quét

Bấm **Scan** để bắt đầu nghe. Năm "đài" quanh bạn phát quảng cáo với nhịp và độ to khác nhau (một đài không có tên). Log bên dưới là thứ radio nghe; danh sách là thứ service cho lên màn hình. Thử gõ bộ lọc trước khi Scan, tắt **lọc trùng theo id** để thấy danh sách sẽ thế nào nếu service không có `seen.add`, và đổi sang **iOS** để thấy iOS gộp trùng ngay từ radio ([A2](#a2-hinh-tuong-ble-ai-phat-thanh-nho-va-may-do-song), [A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that)).

<div class="lab" id="l13-radar"></div>

!!! tip "Điều cần thấy ở mô phỏng 1"
    Log radio dài ra liên tục (Android) nhưng danh sách chỉ có mỗi thiết bị một hàng, và "Beacon không tên" không bao giờ lên màn hình. Tắt lọc trùng thì danh sách phình ra với cùng một thiết bị lặp lại. Sau 10 giây (hoặc Stop) radio im hẳn và danh sách giữ nguyên.

#### 2. Ba cửa trước khi quét

Bật/tắt ba điều kiện (quyền, có radio, Bluetooth bật) rồi bấm **Scan**. Xem cửa nào chặn, thông báo nào hiện, và `scansStarted` có tăng không. Tick **Đảo thứ tự** để thấy vì sao trên iOS phải kiểm tra quyền trước `isAvailable()` ([A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that)).

<div class="lab" id="l13-gates"></div>

!!! tip "Điều cần thấy ở mô phỏng 2"
    Thiếu bất kỳ điều kiện nào thì `scansStarted` đứng yên: radio không bao giờ bật. Với thứ tự đúng, khi chưa có quyền thì `CBCentralManager` không được tạo; đảo thứ tự thì nó được tạo trước và iOS hiện hộp hỏi quyền khi người dùng chưa bấm gì.

#### 3. Một cách để dừng

Chọn nền tảng, bấm **Scan**, rồi kết thúc lần quét theo một trong ba cách: **Stop**, **chờ timeout** (tua nhanh), hoặc **tắt Bluetooth**. Bốn làn cho thấy việc huỷ đi từ ViewModel xuống radio, và lỗi đi ngược lên. Với Android, bỏ tick **receiver ACTION_STATE_CHANGED** để thấy chuyện gì xảy ra khi thiếu nó; bấm Scan/Stop liên tục để gặp "scanning too frequently" ([A7](#a7-stop-timeout-va-quet-qua-thuong-xuyen-chay-that), [A8](#a8-android-tat-bluetooth-giua-chung-bang-trang-thai)).

<div class="lab" id="l13-stop"></div>

!!! tip "Điều cần thấy ở mô phỏng 3"
    Stop, timeout và tắt Bluetooth đều làm làn radio tắt qua cùng một chỗ, `awaitClose`. Timeout ghi `Finished` qua "dòng sau withTimeoutOrNull", Stop thì do `stopScan()` tự ghi. Android không có receiver thì tắt Bluetooth chỉ cho "Scanning…" kéo dài tới timeout rồi "No devices found". Lần Scan thứ 6 trong 30 giây trên Android không làm radio bật, và không có lỗi nào.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang [bài 14](14-ble-ket-noi.md).

- [ ] Giải thích central, peripheral, quảng cáo và RSSI bằng hình tượng của mình, và nói được quét khác kết nối ở đâu (xem [A2](#a2-hinh-tuong-ble-ai-phat-thanh-nho-va-may-do-song)).
- [ ] Vẽ được cây GATT (service → characteristic → descriptor, UUID) và phân biệt read, write, notify, indicate (xem [A2](#a2-hinh-tuong-ble-ai-phat-thanh-nho-va-may-do-song)).
- [ ] Nói được vì sao phần lớn bài cần điện thoại thật, emulator/Simulator kiểm được gì, và cài LightBlue làm peripheral (xem [A3](#a3-so-voi-web-bluetooth-va-vi-sao-phai-dung-may-that)).
- [ ] Giải thích vì sao `isAvailable()` và `isEnabled()` là `suspend`, và vì sao port chỉ hứa "có thể tới lần nữa".
- [ ] Viết luật ba cửa theo đúng thứ tự trong `ScanningService`, và giải thích vì sao thứ tự quan trọng trên iOS (xem [A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that), thử [Ba cửa trước khi quét](#2-ba-cua-truoc-khi-quet)).
- [ ] Lọc trùng theo id bằng một tập đã thấy, và biết vì sao `distinctUntilChanged` không đủ (xem [A4](#a4-ba-cua-truoc-khi-quet-va-loc-trung-chay-that), thử [Radar quét](#1-radar-quet)).
- [ ] Bọc một API callback thành `Flow` bằng `callbackFlow`, `trySend`, `close` và `awaitClose`, và nói được chuyện gì xảy ra khi quên `awaitClose` (xem [A5](#a5-callbackflow-cay-cau-tu-callback-sang-flow-chay-that)).
- [ ] Lần theo một quảng cáo trên iOS từ `didDiscover` tới một hàng trên màn hình, và giải thích vì sao cần `ScanFlow.kt` (xem [A6](#a6-radio-ios-hai-nua-mot-adapter-va-delegate-weak-chay-that-bang-swift)).
- [ ] Giữ delegate của `CBCentralManager` sống đúng cách, và nhận ra triệu chứng khi nó bị giải phóng (xem [A6](#a6-radio-ios-hai-nua-mot-adapter-va-delegate-weak-chay-that-bang-swift)).
- [ ] Giải thích Stop và timeout dùng chung một cơ chế, và vì sao `stopScan()` phải tự ghi `Finished` (xem [A7](#a7-stop-timeout-va-quet-qua-thuong-xuyen-chay-that), thử [Một cách để dừng](#3-mot-cach-e-dung)).
- [ ] Xử lý Bluetooth bị tắt giữa chừng trên Android bằng receiver, và giải thích `try`/`catch` quanh `stopScan` (xem [A8](#a8-android-tat-bluetooth-giua-chung-bang-trang-thai)).
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.

