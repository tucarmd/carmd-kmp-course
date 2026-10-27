---
source: lessons/15-ble-discovery-and-read.html
source_ref: live
source_sha: ce66ef8
---

<p class="kicker">Bài 15 · Tuần 3 · Ngày 15 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/15-ble-discovery-and-read.html">Bản gốc tiếng Anh</a></p>

# BLE: khám phá và đọc

<div class="meta">
  <span class="tag">~2,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m10 liệt kê service và characteristic, đọc và giải mã một giá trị</span>
  <span class="tag">Cần trước: <a href="../14-ble-ket-noi/">14</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Ở m09 app giữ một liên kết tới thiết bị mà không làm gì với nó. Hôm nay nó hỏi thiết bị có những gì (các service và characteristic của chúng), kiểm tra mỗi characteristic cho phép gì, và đọc một giá trị. Một giá trị tới dưới dạng byte, và byte chẳng có nghĩa gì cho tới khi có thứ giải mã chúng: đó là một quy tắc của app, nên nó nằm trong app core, được test trên JVM và iOS, không bao giờ trong màn hình hay adapter. Trên iOS bạn gặp cái bẫy làm một lần khám phá hay một lần đọc biến mất mà không báo lỗi: delegate riêng của peripheral. Đó là milestone **m10**, và bài 16 dựng notification trên cùng liên kết này.

!!! info "Nguồn chính"
    Trang [Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data) của Android (phần "Discover services" và "Read BLE characteristics") trước mục 5. Với iOS, các trang [CBPeripheral](https://developer.apple.com/documentation/corebluetooth/cbperipheral) và [CBPeripheralDelegate](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate) của Apple trước mục 6. Về byte, [GATT Specification Supplement](https://www.bluetooth.com/specifications/gss/) của Bluetooth SIG (mục 2.4 và bốn characteristic ở mục 3) trước mục 3. Mục 1 của bài 13 (service, characteristic, UUID, property) trước khi bắt đầu.

!!! info "Track"
    Các khái niệm, các port, service, bộ giải mã, cả hai radio và các test (mục 1–7 và 10) giống nhau trên mọi track. Các track khác nhau ở màn hình chi tiết (mục 8) và phần khởi động app iOS (mục 9). Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m09

| Cái gì | m09 | m10 |
|---|---|---|
| app core | quét, quyền, kết nối | thêm `DeviceService`, `Characteristic`, `CharacteristicProperty` và `propertiesOf`; `fullUuid`; `ValueDecoder`. `BleConnection` có thêm `discoverServices()` và `read(characteristic)`; `DeviceSession` có thêm `services()` và `read(characteristic)`, do `SessionService` implement |
| adapter Android | `AndroidBleConnection` kết nối | nó còn khám phá và đọc, mỗi request chờ callback của nó |
| adapter iOS | Swift `IosBleConnection` implement `BleConnection`, với `connectFlow` trong `ConnectFlow.kt` | Kotlin `LinkedBleConnection` (trong `iosMain`, thay `ConnectFlow.kt`) implement `BleConnection`; Swift `IosBleConnection` implement `IosLink` và giờ còn là delegate của peripheral |
| `SimulatedBleConnection` | kết nối | mỗi thiết bị mẫu đã kết nối có bốn service và sáu characteristic đọc được, một trong số đó từ chối lần đọc |
| màn hình chi tiết | dòng trạng thái, Connect / Disconnect | thêm "Discovering services…", rồi mỗi service với các characteristic của nó, property của chúng, một nút Read ở chỗ được phép đọc, và giá trị đã đọc |
| khởi động app iOS | `bleConnection: IosBleConnection()` | `bleConnection: LinkedBleConnection(link: IosBleConnection())` |
| test | 33 mỗi nền tảng | 54 mỗi nền tảng: thêm 7 cho session service, thêm 4 cho ViewModel chi tiết, 8 cho bộ giải mã, 2 cho UUID và property |

## 1. Trên một thiết bị đã kết nối có gì

Bài 13 vẽ dữ liệu của một peripheral như một cái cây: các **service**, mỗi service chứa các **characteristic**, mỗi characteristic có một UUID, một giá trị và một tập **property**. Một điện thoại đã kết nối chưa biết cái cây đó. Nó phải hỏi: hướng dẫn của Android nói "Việc đầu tiên cần làm khi đã kết nối tới GATT Server trên thiết bị BLE là thực hiện khám phá service" ([Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data)). Chỉ sau đó nó mới đọc được: "Khi app đã kết nối tới một GATT server và khám phá xong service, nó có thể đọc và ghi các attribute, ở chỗ được hỗ trợ."

Hai nền tảng hỏi theo cách khác nhau. `discoverServices()` của Android "Khám phá các service mà thiết bị ở xa cung cấp cùng với characteristic và descriptor của chúng" trong một request (`BluetoothGatt`, mã nguồn Android). CoreBluetooth chia làm hai: `discoverServices(_:)` tìm các service, rồi `discoverCharacteristics(_:for:)` "Khám phá các characteristic được chỉ định của một service", mỗi lần gọi một service ([Apple](https://developer.apple.com/documentation/corebluetooth/cbperipheral/discovercharacteristics(_:for:))). Mỗi câu trả lời tới sau, trong một callback. Nên trên iOS, lần khám phá thứ hai chỉ bắt đầu được bên trong câu trả lời của lần đầu: hai lần khám phá bất đồng bộ lồng nhau.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="l15-disc-title">
      <title id="l15-disc-title">Khám phá service trên hai nền tảng, theo thời gian từ trái sang phải. Android, làn trên: adapter gọi discoverServices một lần; sau đó onServicesDiscovered báo một status, và gatt.services lúc đó chứa mọi service cùng characteristic của chúng. Một request, một câu trả lời. iOS, làn dưới: adapter gọi discoverServices(nil); sau đó peripheral didDiscoverServices báo các service, chưa có characteristic; bên trong callback đó adapter gọi discoverCharacteristics(nil, for: service) một lần cho mỗi service; sau đó didDiscoverCharacteristicsFor tới một lần cho mỗi service; khi mọi service đã trả lời, việc khám phá xong. Với một thiết bị có bốn service, đó là năm request và năm câu trả lời.</title>
      <defs><marker id="l15-disc-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="title" x="20" y="28">Android: một request</text>
      <g data-part="android">
        <rect class="box" x="20" y="44" width="190" height="50" rx="6"></rect>
        <text class="mono small" x="30" y="66">discoverServices()</text>
        <text class="small muted" x="30" y="84">app hỏi một lần</text>
        <rect class="box" x="290" y="44" width="200" height="50" rx="6"></rect>
        <text class="mono small" x="300" y="66">onServicesDiscovered</text>
        <text class="small muted" x="300" y="84">(gatt, status)</text>
        <rect class="box" x="560" y="44" width="180" height="50" rx="6"></rect>
        <text class="mono small" x="570" y="66">gatt.services</text>
        <text class="small muted" x="570" y="84">mọi service + characteristic</text>
      </g>
      <path class="edge dashed" d="M210,69 L288,69" marker-end="url(#l15-disc-arrow)"></path>
      <path class="edge" d="M490,69 L558,69" marker-end="url(#l15-disc-arrow)"></path>
      <text class="title" x="20" y="140">iOS: hai lần khám phá lồng nhau</text>
      <g data-part="ios">
        <rect class="box" x="20" y="156" width="170" height="50" rx="6"></rect>
        <text class="mono small" x="30" y="178">discoverServices(nil)</text>
        <text class="small muted" x="30" y="196">lần khám phá đầu</text>
        <rect class="box" x="210" y="156" width="160" height="50" rx="6"></rect>
        <text class="mono small" x="220" y="178">didDiscoverServices</text>
        <text class="small muted" x="220" y="196">các service, chưa có characteristic</text>
        <rect class="box" x="390" y="156" width="170" height="64" rx="6"></rect>
        <text class="mono small" x="400" y="178">discoverCharacteristics</text>
        <text class="mono small" x="400" y="194">(nil, for: service)</text>
        <text class="small muted" x="400" y="212">một lần cho mỗi service</text>
        <rect class="box" x="580" y="156" width="160" height="64" rx="6"></rect>
        <text class="mono small" x="590" y="178">didDiscover…For</text>
        <text class="mono small" x="590" y="194">service</text>
        <text class="small muted" x="590" y="212">một lần cho mỗi service</text>
      </g>
      <path class="edge dashed" d="M190,181 L208,181" marker-end="url(#l15-disc-arrow)"></path>
      <path class="edge" d="M370,181 L388,181" marker-end="url(#l15-disc-arrow)"></path>
      <path class="edge dashed" d="M560,188 L578,188" marker-end="url(#l15-disc-arrow)"></path>
      <text class="small" x="390" y="250">xong khi mọi service đã trả lời:</text>
      <text class="small" x="390" y="268">adapter đếm lùi chúng</text>
      <text class="small muted" x="20" y="300">Mũi tên liền: app gọi. Mũi tên đứt: radio trả lời sau, trong một callback.</text>
      <text class="small muted" x="20" y="318">Bốn service: một request trên Android, năm trên iOS (một cho các service, một cho mỗi service).</text>
    </svg>
    <figcaption>Cùng một kết quả, các service và characteristic của chúng, trong một vòng hỏi-đáp trên Android và hai vòng lồng nhau trên iOS.
<ul class="legend">
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

1. **Khám phá theo từng kết nối.** Cái cây mà điện thoại biết được thuộc về liên kết này. Trong app này, màn hình chi tiết khám phá ngay sau "Status: connected", và quên cái cây khi liên kết kết thúc.
2. **Property quyết định một central được làm gì** (bảng của bài 13): read, write, notify, indicate. Apple: "Không phải characteristic nào cũng có giá trị đọc được. Bạn biết giá trị của một characteristic có đọc được không bằng cách xem các property liên quan của enum `CBCharacteristicProperties`" ([readValue(for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/readvalue(for:)-6u2kr)). App kiểm tra trước khi đọc.
3. **Một lần đọc là thêm một request có callback**: `readCharacteristic()` của Android "là một lời gọi bất đồng bộ. Kết quả được gửi tới hàm `onCharacteristicRead()` của `BluetoothGattCallback`"; trên iOS, `readValue(for:)` trả lời trong `peripheral(_:didUpdateValueFor:error:)` của delegate của peripheral. Thứ quay về là byte.

## 2. Từ ngữ của app, và port lớn thêm

Trước hết là cái cây, theo cách nói của app core:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/DeviceService.kt" hl_lines="5 8 9 11 15 24 25"
⋯ package
// A service on a connected device, in the app's terms: a UUID and the characteristics it groups.
// Not to be confused with the app core's services, such as SessionService: this one is the
// device's.
data class DeviceService(val uuid: String, val characteristics: List<Characteristic>)

⋯ a comment: serviceUuid says which service it belongs to; every UUID is in the full form
data class Characteristic(
    val serviceUuid: String,
    val uuid: String,
    val properties: List<CharacteristicProperty>,
)

⋯ a comment: bit is the property's bit in the Characteristic Properties field, the same number on Android and iOS
enum class CharacteristicProperty(val bit: Int, val label: String) {
    Read(0x02, "read"),
    WriteWithoutResponse(0x04, "write without response"),
    Write(0x08, "write"),
    Notify(0x10, "notify"),
    Indicate(0x20, "indicate"),
}

⋯ a comment: bits the app has no use for (broadcast, signed writes, …) are left out
fun propertiesOf(bits: Int): List<CharacteristicProperty> =
    CharacteristicProperty.entries.filter { bits and it.bit != 0 }
```

1. **Hai nghĩa của "service".** Trong kiến trúc của app, service là một class trong app core implement một inbound port (`SessionService`). Trong Bluetooth, service là một nhóm characteristic trên thiết bị. Model được đặt tên `DeviceService` để hai nghĩa không bao giờ gặp nhau trong một cái tên.
2. **`serviceUuid` đi kèm mỗi characteristic**, vì cùng một UUID characteristic có thể xuất hiện trong nhiều service: muốn đọc nó, cả hai adapter phải tìm service trước, rồi tới characteristic trong đó.
3. **Cùng các bit trên cả hai nền tảng.** `BluetoothGattCharacteristic.PROPERTY_READ` của Android là `0x02`, `PROPERTY_WRITE_NO_RESPONSE` là `0x04`, `PROPERTY_WRITE` là `0x08`, `PROPERTY_NOTIFY` là `0x10`, `PROPERTY_INDICATE` là `0x20` (mã nguồn Android), và `CBCharacteristicProperties` của iOS dùng cùng các giá trị đó (`CBCharacteristic.h`). Nên mỗi adapter trao con số của nền tảng mình cho `propertiesOf`, và quy tắc biến bit thành property được viết và test một lần, trong app core. `bits and it.bit != 0` là `(bits & bit) !== 0` của TypeScript: Kotlin viết phép AND bit bằng hàm infix `and`.
4. **Một `List`, không phải `Set`**: theo thứ tự của trường bit, để mọi màn hình hiện "read · notify" theo cùng một thứ tự. Một list Kotlin tới Swift thành một array; một set sẽ tới thành `Set` của Swift, không có thứ tự.

UUID cũng cần một quy tắc. Android báo mọi UUID ở dạng 128-bit, chữ thường. CoreBluetooth có thể báo một UUID chuẩn ở dạng ngắn: một `CBUUID` tạo từ `"2A19"` có `uuidString` là `"2A19"`, và một cái tạo từ dạng đầy đủ thì giữ dạng đầy đủ, vậy mà hai cái so ra bằng nhau (chúng tôi đã kiểm tra bằng một đoạn Swift trên macOS). Bài 13 đã giải thích các dạng ngắn: chúng đại diện cho một UUID đầy đủ dựng trên Bluetooth base UUID. App core chọn một cách viết:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/Uuids.kt" hl_lines="4 7 10 11"
⋯ package
// The Bluetooth base UUID, after its first 8 hex digits: a 16- or 32-bit UUID stands for the full
// UUID that puts it in front of this.
private const val BASE_UUID_TAIL = "-0000-1000-8000-00805F9B34FB"

⋯ a comment: Android reports the full form in lower case; iOS can report a standard UUID in its short form
fun fullUuid(uuid: String): String {
    val upper = uuid.uppercase()
    return when (upper.length) {
        4 -> "0000$upper$BASE_UUID_TAIL"
        8 -> "$upper$BASE_UUID_TAIL"
        else -> upper
    }
}
```

Outbound port lớn thêm hai request trên liên kết mà `connect` giữ mở. Nó giữ hình dạng của bài 14: `connect` vẫn là cách duy nhất để mở và đóng liên kết.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleConnection.kt" hl_lines="5 6 10 13"
⋯ package and imports; the comment on the port
interface BleConnection {
⋯ fun connect(device: Device): Flow<ConnectionState>, as in Lesson 14

    // The requests below go over the link that connect() holds open, one at a time: callers wait
    // for each to finish before sending the next. Each throws ConnectionException when there's
    // no link, when the link closes first, or when the device or the radio reports an error.

    // Every service on the device with its characteristics, all UUIDs in the full form (fullUuid).
    suspend fun discoverServices(): List<DeviceService>

    // The characteristic's value, as the bytes the device sent. Only after discoverServices().
    suspend fun read(characteristic: Characteristic): ByteArray
}
```

1. **`suspend`, không phải `Flow`**: một lần khám phá hay một lần đọc là một request với một câu trả lời, đúng hình dạng của một `suspend fun` (bài 01). Notification của bài 16 là một dòng chảy, và sẽ là một `Flow`.
2. **Port trả về byte.** Chúng nghĩa là gì là việc của app, không phải của radio: các adapter chép chúng ra và app core giải mã (mục 3).
3. **"Mỗi lần một request" là một phần của hợp đồng**, viết ở chỗ mọi người viết adapter đều đọc. Mục 4 cho thấy ai giữ nó, và mục 5 cho thấy vì sao Android cần nó.
4. **Không có exception mới.** Comment của `ConnectionException` giờ bao luôn "một request trên nó bị lỗi": thông báo vẫn dành cho người dùng, và ViewModel vẫn chỉ bắt một kiểu.

Inbound port nhận hai lời gọi của kế hoạch, theo cách nói của app: các service, và một giá trị đã được giải mã.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt" hl_lines="4 9"
⋯ package, imports, and Lesson 14's three members: connectionState, connect(device), disconnect()
    // The connected device's services and their characteristics. Throws ConnectionException:
    // not connected, or the discovery failed, which also ends the connection.
    suspend fun services(): List<DeviceService>

    // Reads the characteristic and returns its value as text for the user. Throws
    // ConnectionException: not connected, a characteristic without the Read property, or the
    // read failed.
    suspend fun read(characteristic: Characteristic): String
}
```

## 3. Byte, được giải mã trong app core

Giá trị của một characteristic là một mảng byte ngắn, và thiết bị không nói chúng nghĩa là gì. Định dạng của mỗi characteristic chuẩn được Bluetooth SIG công bố, trong [GATT Specification Supplement](https://www.bluetooth.com/specifications/gss/) (GSS; SIG cũng công bố nó dưới dạng file YAML trong [kho public](https://bitbucket.org/bluetooth-SIG/public/src/main/gss/) của mình). App biết bốn cái:

| Characteristic (UUID) | GSS nói | App hiện |
|---|---|---|
| Battery Level (`0x2A19`) | `uint8`, một phần trăm: "Khoảng cho phép là 0 tới 100 … Mọi giá trị khác được dành cho tương lai." | `82 %` |
| Temperature (`0x2A6E`) | `sint16`, "độ C với độ phân giải 0,01 độ C"; "Giá trị 0x8000 biểu diễn 'không biết giá trị'." | `21.50 °C` |
| Manufacturer Name String (`0x2A29`), Model Number String (`0x2A24`) | `utf8s`, "chuỗi UTF-8" | đoạn chữ |

Mọi thứ khác được hiện dưới dạng byte hex: `01 02 03 04`, dòng "Received data" trong bản phác của kế hoạch khoá học. Tên và UUID là [assigned numbers](https://bitbucket.org/bluetooth-SIG/public/src/main/assigned_numbers/uuids/) của SIG.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ValueDecoder.kt" hl_lines="3 6 9 11 15 19 20 21"
⋯ package, import kotlin.math.abs, and a comment: the formats come from the GATT Specification Supplement
object ValueDecoder {
    const val BATTERY_LEVEL = "00002A19-0000-1000-8000-00805F9B34FB"
⋯ TEMPERATURE, MODEL_NUMBER and MANUFACTURER_NAME: 2A6E, 2A24 and 2A29 in the same full form

    fun decode(characteristicUuid: String, bytes: ByteArray): String = when (characteristicUuid) {
        BATTERY_LEVEL -> batteryLevel(bytes)
        TEMPERATURE -> temperature(bytes)
        MODEL_NUMBER, MANUFACTURER_NAME -> bytes.decodeToString()
        else -> hex(bytes)
    } ?: hex(bytes)

    // "01 02 03 04". A Kotlin Byte is signed (-128..127): and 0xFF gives the 0..255 the device sent.
    fun hex(bytes: ByteArray): String =
        bytes.joinToString(" ") { (it.toInt() and 0xFF).toString(16).uppercase().padStart(2, '0') }

    // uint8, a percentage from 0 to 100; other values are reserved.
    private fun batteryLevel(bytes: ByteArray): String? {
        if (bytes.size != 1) return null
        val percent = bytes[0].toInt() and 0xFF
        return if (percent <= 100) "$percent %" else null
    }
⋯ temperature(bytes): below
```

1. **Một `Byte` của Kotlin có dấu.** Nó chứa −128 tới 127, và byte `0xC8` (200) của thiết bị tới thành −56. `toInt()` giữ dấu; `and 0xFF` chỉ giữ 8 bit thấp, trả lại 200. `Uint8Array` của TypeScript giấu chuyện này, và `Data` của Swift làm từ `UInt8` không dấu, nên đây là cái bẫy mà bộ giải mã Kotlin bước vào. Test `aReservedBatteryLevelIsShownInHex` đưa vào `0xC8`: không có `and 0xFF`, bộ giải mã in "-56 %" và test fail (chúng tôi đã thử).
2. **Một hàm private trả `null` khi byte không khớp**: sai độ dài, hoặc một giá trị dành riêng. `?: hex(bytes)` khi đó hiện byte như chúng tới, nên một thiết bị bất ngờ hiện dữ liệu của nó thay vì làm sập màn hình.
3. **`decodeToString()`** giải mã UTF-8 trong Kotlin chung, trên mọi nền tảng.
4. **Sao lại là app core, và sao không phải adapter?** Việc của adapter là trao lại byte radio đã nhận. 0x52 nghĩa là gì với một pin thì giống nhau trên cả hai nền tảng, nên nó được viết một lần, trong một hàm thuần, và test một lần, trên JVM và iOS simulator (mục 10). Đó là quy tắc refactor của kế hoạch khoá học: không logic tính năng nào bị lặp giữa các nền tảng.

Nhiệt độ cho thấy hai thứ còn lại mà mọi bộ giải mã BLE đều gặp: thứ tự byte và dấu.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ValueDecoder.kt" hl_lines="4 5 6 7 9 10"
    // sint16, little endian, in hundredths of a degree Celsius; 0x8000 means "not known".
    private fun temperature(bytes: ByteArray): String? {
        if (bytes.size != 2) return null
        val low = bytes[0].toInt() and 0xFF
        val high = bytes[1].toInt() // keeps its sign: the high byte carries it
        val hundredths = (high shl 8) or low
        if (hundredths == -0x8000) return "not known"
        val sign = if (hundredths < 0) "-" else ""
        val magnitude = abs(hundredths)
        return "$sign${magnitude / 100}.${(magnitude % 100).toString().padStart(2, '0')} °C"
    }
```

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 250" role="img" aria-labelledby="l15-bytes-title">
      <title id="l15-bytes-title">Giải mã một giá trị Temperature hai byte, F3 rồi FD. Octet 0, byte thấp F3, được che bằng 0xFF thành 243. Octet 1, byte cao FD, giữ dấu thành âm 3. Dịch byte cao sang trái 8 bit rồi OR với byte thấp ra 0xFDF3, mà ở dạng số 16-bit có dấu là âm 525. Âm 525 phần trăm độ là âm 5,25 độ C. Little endian nghĩa là octet 0 là byte ít quan trọng nhất.</title>
      <defs><marker id="l15-bytes-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="outbound">
        <rect class="box" x="20" y="30" width="110" height="50" rx="6"></rect>
        <text class="mono small" x="30" y="52">octet 0: F3</text>
        <text class="small muted" x="30" y="70">byte thấp</text>
        <rect class="box" x="20" y="100" width="110" height="50" rx="6"></rect>
        <text class="mono small" x="30" y="122">octet 1: FD</text>
        <text class="small muted" x="30" y="140">byte cao</text>
      </g>
      <g data-part="core">
        <rect class="box" x="180" y="30" width="150" height="50" rx="6"></rect>
        <text class="mono small" x="190" y="52">and 0xFF → 243</text>
        <text class="small muted" x="190" y="70">bỏ dấu</text>
        <rect class="box" x="180" y="100" width="150" height="50" rx="6"></rect>
        <text class="mono small" x="190" y="122">toInt() → -3</text>
        <text class="small muted" x="190" y="140">giữ dấu</text>
        <rect class="box" x="380" y="64" width="170" height="54" rx="6"></rect>
        <text class="mono small" x="390" y="86">(-3 shl 8) or 243</text>
        <text class="mono small" x="390" y="104">= 0xFDF3 = -525</text>
        <rect class="box" x="600" y="64" width="140" height="54" rx="6"></rect>
        <text class="mono small" x="610" y="86">-525 × 0.01</text>
        <text class="mono small" x="610" y="104">= -5.25 °C</text>
      </g>
      <path class="edge" d="M130,55 L178,55" marker-end="url(#l15-bytes-arrow)"></path>
      <path class="edge" d="M130,125 L178,125" marker-end="url(#l15-bytes-arrow)"></path>
      <path class="edge" d="M330,55 L378,82" marker-end="url(#l15-bytes-arrow)"></path>
      <path class="edge" d="M330,125 L378,100" marker-end="url(#l15-bytes-arrow)"></path>
      <path class="edge" d="M550,91 L598,91" marker-end="url(#l15-bytes-arrow)"></path>
      <text class="small" x="20" y="190">Little endian: octet 0, byte đầu tiên thiết bị gửi, là byte ít quan trọng nhất.</text>
      <text class="small" x="20" y="210">Byte tới từ adapter (outbound); mọi bước sau đó là của app core.</text>
      <text class="small muted" x="20" y="235">Cùng các byte đó đọc theo big endian, FD rồi F3, sẽ là 0xF3FD: một con số khác.</text>
    </svg>
    <figcaption>F3 FD là −5,25 °C: che byte thấp, giữ dấu của byte cao, ghép lại, nhân tỉ lệ.
<ul class="legend">
    <li data-part="outbound">Outbound (byte như adapter trao lại)</li>
    <li data-part="core">App core (việc giải mã)</li>
  </ul>
</figcaption>
  </figure>

1. **Little endian.** GSS mục 2.4: "Mọi trường trong một characteristic hay descriptor đều là little endian trừ khi có ghi khác", và các trường bắt đầu từ "Octet ít quan trọng nhất (LSO, octet 0) của giá trị". Nên `bytes[0]` là byte thấp. `66 08` của thiết bị giả lập là `0x0866`, 2150, nên là 21,50 °C.
2. **Dấu nằm ở byte cao.** `bytes[1].toInt()` không có `and 0xFF` thì giữ dấu: `0xFD` thành −3, và `(-3 shl 8) or 243` là −525. `shl` và `or` là `<<` và `|` của Kotlin. 0x8000 tới thành −32768, mà code viết là `-0x8000`.
3. **Tự định dạng bằng tay.** Kotlin chung không có `String.format`, nên bộ giải mã tự in phần độ nguyên và phần trăm. Dấu được lấy trước: −25 phần trăm độ có 0 độ nguyên, và `-25 / 100` là `0`, nên chỉ in thương sẽ mất dấu. `negativeTemperaturesKeepTheirSign` kiểm tra "-0.25 °C".

## 4. Session service giữ các quy tắc

`SessionService` đã sở hữu kết nối. Trên liên kết đang mở, nó thêm bốn quy tắc, mỗi quy tắc được test ở mục 10:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="2 5 7 9 16 19 20 24"
⋯ class SessionService(connection, permissions) : DeviceSession, its state and link
    private val requests = Mutex() // the port takes one request at a time
⋯ connect(device) and disconnect(): as in Lesson 14
    override suspend fun services(): List<DeviceService> {
        val device = connectedDevice()
        return try {
            requests.withLock { connection.discoverServices() }
        } catch (e: ConnectionException) {
            disconnect()
            throw ConnectionException("Couldn't discover the services of ${device.name}. ${e.message}")
        }
    }

    override suspend fun read(characteristic: Characteristic): String {
        connectedDevice()
        if (CharacteristicProperty.Read !in characteristic.properties) {
            throw ConnectionException("This characteristic can't be read: it has no Read property.")
        }
        val bytes = requests.withLock { connection.read(characteristic) }
        return ValueDecoder.decode(characteristic.uuid, bytes)
    }

    private fun connectedDevice(): Device =
        (state.value as? ConnectionState.Connected)?.device
            ?: throw ConnectionException("Connect to the device first.")
```

1. **Chỉ trên một liên kết đã kết nối.** `connectedDevice()` đọc state mà service đã sở hữu; trước "connected", không gì được gửi đi.
2. **Chỉ thứ đọc được.** Màn hình ẩn Read cho một characteristic không có property Read, nhưng đó là phần trình bày; quy tắc nằm ở chỗ mọi bên gọi đều đi qua (lại là lập luận của bài 13). `readCharacteristic` của chính Android cũng trả `false` cho trường hợp đó (mã nguồn của nó kiểm tra `PROPERTY_READ` trước), nhưng thông báo của app rõ hơn "không gửi được".
3. **Mỗi lần một request.** Một `Mutex` (của kotlinx.coroutines) là một cái khoá cho coroutine: `withLock` treo, không chặn thread nào, cho tới khi người giữ trước xong việc. Hai lần bấm nhanh vào hai nút Read thành hai lần đọc, lần lượt từng cái. Test `sendsOneRequestAtATime` fail khi thiếu nó (chúng tôi đã gỡ nó ra để kiểm tra).
4. **Một lần khám phá thất bại thì kết thúc kết nối.** Màn hình này vô dụng khi không có cái cây, nên service ngắt kết nối và nói lý do; Connect khi đó là cách thử lại. Thông báo bắt đầu bằng việc app đang làm và kết thúc bằng lý do của adapter.
5. **Giải mã là bước cuối**, sau khi đã nhả khoá: bộ giải mã là một hàm thuần và không bắt ai phải chờ.

## 5. Android: một lần khám phá, mỗi lần một request

Hướng dẫn của Android: "Service cần override hàm `onServicesDiscovered()` trong `BluetoothGattCallback`. Hàm này được gọi khi thiết bị báo các service nó có. … Khi các service đã được khám phá, service có thể gọi `getServices()` để lấy dữ liệu được báo" ([Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data)). Object callback là cái bài 14 đã viết cho kết nối; nó có thêm ba method.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="3 6 11 12 16 19 22"
⋯ the class and its BluetoothAdapter, as in Lesson 14
    // The open link, from the moment it's up until it closes. Callbacks run on a background thread.
    @Volatile private var gatt: BluetoothGatt? = null

    // The request waiting for its callback. The port takes one request at a time, so one is enough.
    @Volatile private var answer: CompletableDeferred<Answer>? = null

    private class Answer(val status: Int, val value: ByteArray)
⋯ in connect(device), the callback object: onConnectionStateChange also sets gatt once the link is up
            // Discovery found every service, characteristic and descriptor, or failed.
            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                answer?.complete(Answer(status, ByteArray(0)))
            }

            // Android 13 (API 33) and later call this one, with the value.
            override fun onCharacteristicRead(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
                status: Int,
            ) {
                answer?.complete(Answer(status, value))
            }
⋯ Android 12 and earlier call the older onCharacteristicRead(gatt, characteristic, status): the value is in characteristic.value
```

1. **Một `CompletableDeferred`**, như trong lần xin quyền của bài 12, là một giá trị mà người khác hoàn tất: request treo trong `await()`, và callback, trên một background thread, gọi `complete`. Nó đóng vai một `Promise` của JavaScript mà bạn giữ lại `resolve`. Hoàn tất nó từ thread nào cũng an toàn.
2. **Hai `onCharacteristicRead`.** API 33 thêm một cái mang theo giá trị và deprecate cái cũ, cái để giá trị trong object characteristic (`api-versions.xml`: cái cũ `deprecated="33"`, cái mới `since="33"`). App chạy từ API 26, nên nó override cả hai. Trong mã nguồn Android, thân mặc định của cái mới gọi cái cũ, và từ API 33 hệ thống chỉ gọi cái mới; override của chúng ta cho cái mới không gọi cái cũ, nên mỗi lần đọc chỉ hoàn tất một lần. Override cũ mang `@Deprecated` và `@Suppress("DEPRECATION")`, nên build vẫn không có cảnh báo.
3. **`@Volatile`**: mỗi field được ghi trên một thread và đọc trên thread khác. Các callback, trên background thread, gán `gatt` và đọc `answer`; các request, trên main thread, gán `answer` và đọc `gatt`. `@Volatile` làm mỗi lần ghi hiện ra ngay với thread kia.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="5 9 14 16 18 19"
    // One call discovers it all: Android explores the services and their characteristics together.
    @SuppressLint("MissingPermission")
    override suspend fun discoverServices(): List<DeviceService> {
        val gatt = openGatt()
        val answer = request { gatt.discoverServices() }
        if (answer.status != BluetoothGatt.GATT_SUCCESS) {
            throw ConnectionException("Discovery failed (Android status ${answer.status}).")
        }
        return gatt.services.map { it.toDeviceService() }
    }
⋯ read(characteristic): gatt.getService(…)?.getCharacteristic(…), then request { gatt.readCharacteristic(target) }
    // Sends one request and waits for its callback. send returns false when Android won't send it,
    // for example while a read or write on this link is still waiting for its answer.
    private suspend fun request(send: () -> Boolean): Answer {
        val pending = CompletableDeferred<Answer>()
        answer = pending
        try {
            if (!send()) throw ConnectionException("Android couldn't send the request.")
            return pending.await()
        } finally {
            answer = null
        }
    }
```

1. **Vì sao Android phải mỗi lần một request.** `BluetoothGatt.readCharacteristic` kiểm tra property Read, rồi, trong một khoá, chạy `if (mDeviceBusy) return false; mDeviceBusy = true;`, và callback của câu trả lời xoá cờ đó (mã nguồn Android, API 35). Đọc và ghi characteristic và descriptor đều bật cờ đó; `discoverServices()` thì không. Một lần đọc thứ hai gửi đi trước câu trả lời của lần đầu đơn giản là bị từ chối. Hướng dẫn không nhắc tới, và giá trị trả về của method cũng không nói gì hơn "true, nếu thao tác đọc được khởi tạo thành công". `Mutex` của service (mục 4) là thứ giữ các request của chúng ta tách nhau, và một ô `answer` là đủ.
2. **`answer` được gán trước `send()`**, nên một callback quay về nhanh vẫn tìm thấy nó.
3. **Các service lấy từ `gatt.services`**, như hướng dẫn nói, một khi callback đã báo `GATT_SUCCESS`. `toDeviceService()` ánh xạ từng cái bằng `fullUuid(uuid.toString())` và `propertiesOf(it.properties)`.
4. **Tìm characteristic để đọc**: `getService(uuid)` rồi `getCharacteristic(uuid)`, với `UUID.fromString` trên dạng đầy đủ. Nếu một thiết bị có hai instance của cùng một service, "instance đầu tiên của service được trả về" (tài liệu của `BluetoothGatt.getService`); app đọc cái đó.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="3 4"
        awaitClose {
            // A request still waiting would never get its callback now.
            this@AndroidBleConnection.gatt = null
            answer?.completeExceptionally(ConnectionException("The link closed before the device answered."))
            // Whatever ended the link, close the GATT client, or Android keeps it registered.
            gatt.disconnect()
            gatt.close()
        }
```

Sau `close()` không callback nào tới, nên một lần đọc đang chờ sẽ chờ mãi. `completeExceptionally` kết thúc nó bằng một thông báo, bất kể cái gì đã đóng liên kết: rớt kết nối, Disconnect, hay rời màn hình.

!!! warning "Gotcha · emulator không cho thấy được gì trong số này với một thiết bị thật"
    Như bài 14 đã thấy, các beacon giả lập của emulator (bài 13) không bao giờ trả lời một lần kết nối trên image API 30 của chúng tôi, nên một lần khám phá thật và một lần đọc thật cần điện thoại Android của bạn và LightBlue: chúng nằm trong danh sách kiểm tra trên thiết bị. Trên emulator, adapter thật vẫn cho thấy những gì nó làm ở bài 14 (chúng tôi đã chạy: "didn't answer within 10 seconds", rồi `cancelOpen()`, `close()`, `unregisterApp()`), và các adapter giả lập cho thấy màn hình (mục 9).

## 6. iOS: một cách chia mới, và hai lần khám phá lồng nhau

Ở bài 14, class Swift implement `BleConnection` và lấy `Flow` của nó từ Kotlin. Giờ port còn có hai `suspend fun`, và implement chúng bằng Swift có hai vấn đề, cả hai chúng tôi đều vấp phải:

- **Một lỗi Swift không phải là `ConnectionException`.** Chúng tôi cho một class Swift implement một `suspend fun` của Kotlin và ném lỗi. Kotlin bắt được một `kotlin.native.internal.ObjCErrorException` mang thông báo của Swift. `SessionService` và ViewModel chỉ bắt `ConnectionException`, nên một lần đọc thất bại sẽ thoát ra thành một exception không được xử lý.
- **Gọi ngược vào Kotlin là băng qua actor.** Cách sửa đầu tiên chúng tôi thử, một `__read` bằng Swift chờ một `suspend fun` của Kotlin ném `ConnectionException`, chạy được trong một class thường: exception đi qua Swift và quay về Kotlin nguyên vẹn. Trong `IosBleConnection`, thứ là `@MainActor`, Swift 6 từ chối compile nó: "sending 'characteristic' risks causing data races". Swift coi `suspend fun` của Kotlin là chạy ngoài main actor, và các object Kotlin truyền vào nó không phải `Sendable`.

Nên hai nửa đổi vai cho nhau. Nửa Kotlin trong `iosMain` thành class implement port, và nửa Swift chỉ làm việc của radio, qua các lời gọi thường đều chạy trên main thread:

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/LinkedBleConnection.kt" hl_lines="2 10 13 17 20 21"
⋯ package and imports, then a comment: the Kotlin half of the iOS adapter
class LinkedBleConnection(private val link: IosLink) : BleConnection {
    // Collecting the Flow calls the link's open; cancelling the collector calls its close.
    override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
        link.open(device, LinkFeed(this))
        awaitClose { link.close() }
    }

    override suspend fun discoverServices(): List<DeviceService> =
        suspendCancellableCoroutine { link.discover(ServicesReply(it)) }

    override suspend fun read(characteristic: Characteristic): ByteArray =
        suspendCancellableCoroutine { link.read(characteristic, ValueReply(it)) }
}

⋯ a comment: what the Swift connection implements
interface IosLink {
    fun open(device: Device, feed: LinkFeed)
    fun close()
    fun discover(reply: ServicesReply)
    fun read(characteristic: Characteristic, reply: ValueReply)
}
⋯ LinkFeed: as in Lesson 14's ConnectFlow.kt
```

1. **`connect` là `connectFlow` của bài 14**, được dời vào class. `ConnectFlow.kt` không còn; `IosLink` và `LinkFeed` giờ sống ở đây.
2. **`suspendCancellableCoroutine`** trao cho khối của nó một continuation (phần còn lại của coroutine này, đang chờ) và treo cho tới khi có ai resume nó. Khối chuyển nó cho Swift, bọc trong một object reply, và trả về ngay.
3. **Ai gọi cái gì.** `SessionService` gọi port từ các coroutine của ViewModel, trên main thread, nên `link.discover` và `link.read` tới class Swift `@MainActor` trên main thread. CoreBluetooth trả lời trên main queue (`queue: nil`), nên Swift cũng resume reply ở đó.

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/LinkedBleConnection.kt" hl_lines="3 4 8 9 17"
⋯ ServicesReply: the same shape, with found(services) and failed(message)
// Where the Swift connection answers a read: the value's bytes, or the failure.
class ValueReply internal constructor(private val waiting: CancellableContinuation<ByteArray>) {
    fun read(value: NSData) {
        if (waiting.isActive) waiting.resume(value.toByteArray())
    }

    fun failed(message: String) {
        if (waiting.isActive) waiting.resumeWithException(ConnectionException(message))
    }
}

// Swift's Data arrives as NSData; copy its bytes into a Kotlin ByteArray.
@OptIn(ExperimentalForeignApi::class)
private fun NSData.toByteArray(): ByteArray {
    val bytes = ByteArray(length.toInt())
    if (bytes.isNotEmpty()) bytes.usePinned { memcpy(it.addressOf(0), this.bytes, length) }
    return bytes
}
```

1. **Kotlin tạo exception**, nên một lần đọc thất bại tới app core dưới dạng `ConnectionException`, như mọi lỗi khác.
2. **`isActive`** là false một khi continuation đã được resume hoặc bị huỷ. Resume hai lần sẽ ném lỗi, và một câu trả lời muộn cho một coroutine đã đi mất phải bị bỏ qua.
3. **Byte đi qua dưới dạng `NSData`**, thứ Swift thấy là `Data`, nên nửa Swift truyền `characteristic.value` nguyên như vậy. `usePinned` giữ mảng Kotlin đứng yên trong bộ nhớ trong lúc `memcpy` chép vào nó: chỗ duy nhất trong bài này Kotlin chạm vào bộ nhớ thô. Kho log của bài 17 là chỗ khoá học dùng API của Apple từ Kotlin một cách nghiêm túc.
4. **Vẫn là một outbound adapter**, chia hai nửa: ADR 0001 đặt outbound adapter bằng Kotlin và bằng Swift, và cái này là cả hai. Giống `IosRadio`, `IosLink` không phải port: app core không bao giờ thấy nó.

Nửa Swift bắt đầu lần khám phá đầu, và callback delegate của nó bắt đầu lần thứ hai:

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="3 4 10 17 20"
⋯ @MainActor final class IosBleConnection: NSObject, IosLink, CBCentralManagerDelegate, CBPeripheralDelegate
    // The request waiting for the peripheral's delegate: the port takes one at a time.
    private var discovery: ServicesReply?
    private var servicesLeft = 0
⋯ reading, the manager and the other properties
    // The first of two discoveries: the services. didDiscoverServices starts the second.
    func discover(reply: ServicesReply) {
        guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
        discovery = reply
        peripheral.discoverServices(nil)
    }
⋯ in the peripheral delegate:
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral === self.peripheral, discovery != nil else { return }
        if let error { return endDiscovery(failure: "Discovery failed: \(error.localizedDescription)") }
        let services = peripheral.services ?? []
        servicesLeft = services.count
        if services.isEmpty { return endDiscovery(failure: nil) }
        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }
```

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="2 6 7 12 17"
    // One call per service. The discovery is done when every service has answered.
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService,
                    error: Error?) {
        guard peripheral === self.peripheral, discovery != nil else { return }
        if let error { return endDiscovery(failure: "Discovery failed: \(error.localizedDescription)") }
        servicesLeft -= 1
        if servicesLeft == 0 { endDiscovery(failure: nil) }
    }
⋯ endDiscovery: found(services: peripheral.services mapped by appService), or failed(message:)
    // A CBService in the app's terms: full UUIDs, and the properties as the app core names them.
    private func appService(_ service: CBService) -> DeviceService {
        let serviceUuid = UuidsKt.fullUuid(uuid: service.uuid.uuidString)
        let characteristics = (service.characteristics ?? []).map { characteristic in
            Characteristic(
                serviceUuid: serviceUuid,
                uuid: UuidsKt.fullUuid(uuid: characteristic.uuid.uuidString),
                properties: DeviceServiceKt.propertiesOf(bits: Int32(characteristic.properties.rawValue))
            )
        }
        return DeviceService(uuid: serviceUuid, characteristics: characteristics)
    }
```

1. **`nil` nghĩa là "tất cả"**: với `discoverCharacteristics`, "Nếu tham số characteristicUUIDs là nil, method này trả về mọi characteristic của service"; `CBPeripheral.h` nói y vậy về `discoverServices:`. Trang `discoverServices(_:)` của Apple nói thêm rằng với một danh sách UUID "peripheral chỉ trả về các service của nó khớp với danh sách": một app production biết thiết bị của mình thì chỉ hỏi đúng những cái đó.
2. **Câu trả lời quay về dưới dạng property.** `didDiscoverServices` chỉ mang một error; các service nằm trong `peripheral.services`, và characteristic của mỗi service trong `service.characteristics`, thứ là `nil` cho tới khi lần khám phá riêng của nó trả lời (cả hai đều `nullable` trong header).
3. **`servicesLeft` đếm lùi vòng thứ hai**, một `didDiscoverCharacteristicsFor` cho mỗi service. Chỉ khi nó về 0 thì reply mới nhận cả cái cây; lỗi đầu tiên kết thúc việc khám phá kèm một thông báo.
4. **Các hàm phụ của Kotlin gọi từ Swift**: hàm top-level xuất hiện trên một class đặt theo tên file của chúng, nên `fullUuid` trong `Uuids.kt` là `UuidsKt.fullUuid(uuid:)` (bài 05).

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="4 6 10 11 15 17 22"
    func read(characteristic: Characteristic, reply: ValueReply) {
        guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
        // CBUUID compares by value, so the full form finds a characteristic iOS reported as "2A19".
        let serviceUuid = CBUUID(string: characteristic.serviceUuid)
        let uuid = CBUUID(string: characteristic.uuid)
        guard let target = peripheral.services?.first(where: { $0.uuid == serviceUuid })?
            .characteristics?.first(where: { $0.uuid == uuid }) else {
            return reply.failed(message: "This device has no such characteristic. Discover its services again.")
        }
        reading = (target, reply)
        peripheral.readValue(for: target)
    }
⋯ in the peripheral delegate:
    // Called after readValue(for:), and in Lesson 16 for each notification.
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
                    error: Error?) {
        guard peripheral === self.peripheral, let reading, reading.characteristic === characteristic else { return }
        self.reading = nil
        if let error {
            reading.reply.failed(message: "The device refused the read: \(error.localizedDescription)")
        } else {
            reading.reply.read(value: characteristic.value ?? Data())
        }
    }
```

1. **Giá trị cũng là một property**: "Nếu peripheral đọc thành công giá trị của characteristic, bạn truy cập nó qua property `value` của characteristic" ([readValue(for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/readvalue(for:)-6u2kr)).
2. **Cùng callback đó phục vụ cả notification.** Apple: "Một peripheral cũng gọi method này để báo cho app một thay đổi giá trị của characteristic mà app đã bật notification trước đó" ([peripheral(_:didUpdateValueFor:error:)](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatevaluefor:error:)-1xyna)). Đó là lý do adapter kiểm tra characteristic có đúng là cái nó đã xin đọc không: ở bài 16 những cái khác sẽ là notification.
3. **`close()` làm thất bại thứ đang chờ**, như `awaitClose` của Android: một lần khám phá hay đọc đang diễn ra nhận "The link closed before the device answered.", và delegate của peripheral được đặt lại về `nil`.

## 7. Cái bẫy: delegate của peripheral

Cái bẫy của bài 13 là delegate của central manager: một tham chiếu weak, nên một adapter không ai giữ sống thì không nghe được gì. Một peripheral đã kết nối có delegate của riêng nó, tách khỏi delegate của manager, và đó là nơi mọi câu trả lời của bài này tới:

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="6"
    private func start(on manager: CBCentralManager) {
⋯ the checks and retrievePeripherals(withIdentifiers:), as in Lesson 14
        peripheral = found
        // Without this, discovery and reads are sent and their answers go nowhere. The property
        // is weak: this adapter, kept alive by Koin, is what keeps the delegate alive.
        found.delegate = self
        feed.changed(state: ConnectionStateConnecting(device: device))
        manager.connect(found)
    }
```

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 300" role="img" aria-labelledby="l15-dlg-title">
      <title id="l15-dlg-title">Hai delegate trên iOS. CBCentralManager báo các sự kiện kết nối (didConnect, didFailToConnect, didDisconnectPeripheral) cho delegate của nó. Mỗi CBPeripheral báo các câu trả lời khám phá và đọc (didDiscoverServices, didDiscoverCharacteristicsFor, didUpdateValueFor) cho delegate riêng của nó. Trong app cả hai trỏ tới IosBleConnection, thứ Koin giữ sống qua LinkedBleConnection. Cả hai tham chiếu đều weak. Một đường đứt cho thấy cái bẫy: một peripheral mà delegate chưa bao giờ được gán, hoặc object delegate đã bị giải phóng, gửi câu trả lời của nó tới nil, và request của app chờ mãi mà không có lỗi.</title>
      <defs><marker id="l15-dlg-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="ios">
        <rect class="box" x="20" y="30" width="230" height="64" rx="6"></rect>
        <text class="mono small" x="30" y="52">CBCentralManager</text>
        <text class="small muted" x="30" y="70">didConnect, didFailToConnect,</text>
        <text class="small muted" x="30" y="86">didDisconnectPeripheral</text>
        <rect class="box" x="20" y="130" width="230" height="64" rx="6"></rect>
        <text class="mono small" x="30" y="152">CBPeripheral</text>
        <text class="small muted" x="30" y="170">didDiscoverServices, …Characteristics,</text>
        <text class="small muted" x="30" y="186">didUpdateValueFor</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="340" y="70" width="190" height="64" rx="6"></rect>
        <text class="mono small" x="350" y="92">IosBleConnection</text>
        <text class="small muted" x="350" y="110">nửa Swift: cả hai delegate</text>
        <text class="small muted" x="350" y="126">và IosLink</text>
        <rect class="box" x="580" y="70" width="160" height="64" rx="6"></rect>
        <text class="mono small" x="590" y="92">LinkedBleConnection</text>
        <text class="small muted" x="590" y="110">nửa Kotlin, một Koin</text>
        <text class="small muted" x="590" y="126">single: giữ liên kết</text>
      </g>
      <path class="edge dashed" d="M250,62 L338,92" marker-end="url(#l15-dlg-arrow)"></path>
      <text class="small" x="262" y="58">delegate (weak)</text>
      <path class="edge dashed" d="M250,162 L338,114" marker-end="url(#l15-dlg-arrow)"></path>
      <text class="small" x="262" y="160">delegate (weak)</text>
      <path class="edge" d="M580,102 L532,102" marker-end="url(#l15-dlg-arrow)"></path>
      <text class="small" x="540" y="150">strong</text>
      <path class="edge dashed" d="M135,194 L135,240" marker-end="url(#l15-dlg-arrow)"></path>
      <text class="mono small" x="120" y="258">nil</text>
      <text class="small" x="160" y="240">cái bẫy: delegate chưa gán, hoặc đã bị giải phóng:</text>
      <text class="small" x="160" y="258">câu trả lời đi đâu mất, không lỗi, request cứ chờ</text>
      <text class="small muted" x="20" y="290">Đứt: tham chiếu weak. Liền: tham chiếu strong. Kotlin giữ object Swift sống; ngoài ra không gì giữ nó.</text>
    </svg>
    <figcaption>Hai tham chiếu delegate weak, một object đứng sau cả hai, và Koin ở cuối chuỗi giữ nó sống.
<ul class="legend">
    <li data-part="ios">iOS (các object của CoreBluetooth)</li>
    <li data-part="outbound">Outbound adapter (cả hai nửa)</li>
  </ul>
</figcaption>
  </figure>

!!! warning "Gotcha · CBPeripheralDelegate: im lặng, không phải lỗi"
    **Quên gán nó**, thì `discoverServices(nil)` vẫn được gửi và peripheral vẫn trả lời, nhưng không có ai để báo: màn hình nằm mãi ở "Discovering services…". **Nó là weak**: `@property(weak, nonatomic, nullable) id<CBPeripheralDelegate> delegate` (`CBPeripheral.h`), nên một object delegate không ai khác giữ, như một helper tạo trong một hàm, bị giải phóng và câu trả lời dừng lại. **Chỉ có một**: một object thứ hai tự gán mình làm delegate (một view controller "chỉ muốn lấy giá trị") lặng lẽ lấy mất mọi câu trả lời của adapter. **Compiler không giúp được**: trang của Apple nói protocol "không có method bắt buộc nào", nên bỏ sót một method vẫn compile. Một method viết sai tên chỉ nhận một cảnh báo: chúng tôi viết `didDiscoverService` thiếu chữ `s` và swiftc nói "instance method … nearly matches optional requirement". Ở đây adapter tự gán mình làm delegate ngay lúc có peripheral, Koin giữ nó sống qua `LinkedBleConnection`, và `close()` đặt delegate về lại `nil`. Thiếu delegate trên điện thoại có trông y hệt vậy không thì nằm trong danh sách kiểm tra trên thiết bị.

!!! warning "Gotcha · service và characteristic rỗng cho tới khi được khám phá (iOS)"
    `services` của một peripheral chỉ chứa các service đã được khám phá tới lúc đó (`CBPeripheral.h`: "Danh sách các object `CBService` đã được khám phá trên peripheral"), và `characteristics` của mỗi service chỉ chứa những gì lần khám phá riêng của nó đã tìm thấy. Code đọc `peripheral.services` ngay sau khi kết nối, hay đọc một characteristic trước khi vòng thứ hai xong, sẽ không thấy gì. Một lần khám phá duy nhất của Android giấu bước đó; iOS bắt bạn chờ cả hai vòng, nên adapter phải đếm.

## 8. Màn hình chi tiết

ViewModel quyết định khi nào khám phá và mỗi câu trả lời đặt ở đâu. UI state thêm ba trường: `discovering`, `services` (rỗng khi chưa kết nối) và `values`, thứ để hiện dưới mỗi characteristic đã được đọc.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModel.kt" hl_lines="5 6 7 14 17 19 22"
    init {
        viewModelScope.launch {
            session.connectionState.collect { connection ->
                _uiState.update { it.copy(connection = connection) }
                when (connection) {
                    is ConnectionState.Connected -> discover()
                    ConnectionState.Disconnected -> _uiState.update { it.copy(services = emptyList(), values = emptyMap()) }
                    is ConnectionState.Connecting -> Unit
                }
            }
        }
    }
⋯ connect(device), disconnect(): as in Lesson 14
    fun read(characteristic: Characteristic) {
        viewModelScope.launch {
            val text = try {
                session.read(characteristic)
            } catch (e: ConnectionException) {
                "Read failed: ${e.message}"
            }
            _uiState.update {
                if (it.connection is ConnectionState.Connected) it.copy(values = it.values + (characteristic to text)) else it
            }
        }
    }
```

1. **Khám phá khi "connected" là lựa chọn của màn hình này**, không phải quy tắc của app, nên nó nằm trong ViewModel; timeout quét của bài 13 nằm ở đó vì cùng lý do. `discover()` bật `discovering`, gọi `session.services()`, lưu danh sách, và biến lỗi thành `errorMessage`: alert "Connection failed", hợp lý, vì service vừa kết thúc kết nối.
2. **Xoay màn hình không khám phá lại.** ViewModel sống qua nó (bài 14), bên collect của nó vẫn chạy, và `Connected` không được phát lần thứ hai: danh sách và các giá trị đã đọc vẫn còn đó khi nằm ngang (chúng tôi đã kiểm tra trên emulator API 36, Compose và XML).
3. **Một lần đọc thất bại nằm cạnh characteristic của nó** thay vì mở một alert: kết nối vẫn ổn, và người dùng thấy characteristic nào đã từ chối. `Map` dùng `Characteristic` làm khoá; `equals` và `hashCode` của một data class lấy từ các property của nó, nên các characteristic bằng nhau tìm thấy cùng một mục.
4. **Điều kiện chặn trên `Connected`** bỏ một câu trả lời tới sau Disconnect, nên một giá trị cũ không bao giờ xuất hiện ở kết nối sau.

Mọi track hiện cùng một thứ dưới nút Connect: "Discovering services…" với một vòng quay, rồi mỗi service một khối với UUID đầy đủ của nó, và mỗi characteristic có UUID, các property ("read · notify"), một nút Read chỉ khi nó có property Read, và câu trả lời. Danh sách chỉ vài hàng, nên mỗi track vẽ nó trong một container cuộn được thay vì một lazy list.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailScreen.kt" hl_lines="3 6 11 15 16 19"
    ⋯ in DeviceDetailContent, which now takes the whole state and onRead:
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
    ⋯ the device, the status, Connect / Disconnect, Back, then "Discovering services…" while state.discovering
            state.services.forEach { service ->
                ServiceSection(service, state.values, onRead)
            }
    ⋯ in ServiceSection, for each characteristic of the service:
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            characteristic.properties.joinToString(" · ") { it.label },
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        if (CharacteristicProperty.Read in characteristic.properties) {
                            OutlinedButton(onClick = { onRead(characteristic) }) { Text("Read") }
                        }
                    }
                    values[characteristic]?.let { Text(it) }
    ```

    `verticalScroll(rememberScrollState())` làm `Column` cuộn được; vị trí cuộn là state của màn hình, giữ bằng `remember`. `DeviceDetailScreen` truyền `onRead = viewModel::read`. Một danh sách dài sẽ là một `LazyColumn` có key (bài 07).

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt" hl_lines="2 3 5 9 11 14"
    ⋯ at the end of render(state):
            b.discoveringRow.visibility = if (state.discovering) View.VISIBLE else View.GONE
            renderServices(b.servicesContainer, state.services, state.values)
    ⋯ renderServices(container, services, values): rebuilt from the state each time
            container.removeAllViews()
    ⋯ for each service, a bold monospace TextView; for each characteristic, its UUID, then a row:
                    row.addView(
                        TextView(context).apply { text = characteristic.properties.joinToString(" · ") { it.label } },
                        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
                    )
                    if (CharacteristicProperty.Read in characteristic.properties) {
                        row.addView(Button(context).apply {
                            text = "Read"
                            setOnClickListener { viewModel.read(characteristic) }
                        })
                    }
                    container.addView(row)
    ⋯ and, if values[characteristic] is there, a TextView with it
    ```

    Root của layout thành một `ScrollView` bọc `LinearLayout` cũ, cái có thêm `discoveringRow` (một `ProgressBar` nhỏ và "Discovering services…", ban đầu `gone`) và một `servicesContainer` dọc rỗng dưới nút Back. `render()` vẫn là chỗ duy nhất chạm vào view: nó làm rỗng container và dựng lại từ state, việc mà với vài hàng thì chẳng tốn gì đáng để dùng `RecyclerView`.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Compose mô tả danh sách và để recomposition tự tính cái gì đã đổi; Fragment gỡ mọi hàng và thêm lại chúng ở mỗi state. Cả hai đọc cùng một `DeviceDetailUiState`, và cả hai quyết định "có nút Read không?" bằng cùng `CharacteristicProperty.Read in characteristic.properties`.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceDetailView.swift" hl_lines="3 6 10 14 19"
    ⋯ DeviceDetailContent now takes the whole state and onRead; its VStack sits in a ScrollView, and ends with:
                    ForEach(state.services, id: \.uuid) { service in
                        ServiceSection(service: service, values: state.values, onRead: onRead)
                    }
    ⋯ in ServiceSection:
                ForEach(service.characteristics, id: \.self) { characteristic in
                    VStack(alignment: .leading, spacing: 4) {
    ⋯ the characteristic's UUID, in a monospaced caption
                        HStack {
                            Text(characteristic.properties.map(\.label).joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            if characteristic.properties.contains(.read) {
                                Button("Read") { onRead(characteristic) }
                                    .buttonStyle(.bordered)
                            }
                        }
                        if let value = values[characteristic] {
                            Text(value)
                        }
    ```

    `characteristic.properties` tới dưới dạng một array Swift chứa enum `CharacteristicProperty` của SKIE, nên `.contains(.read)` đọc như Swift, và `\.label` với tới property Kotlin. `id: \.self` chạy được vì một class Kotlin là một `NSObject`, `Hashable` qua `equals` và `hashCode` của data class (`DeviceRoute` của bài 14 dùng cùng sự thật này); cũng nhờ vậy `[Characteristic: String]` là một dictionary hợp lệ. `DeviceDetailView` truyền `onRead: { viewModel.read(characteristic: $0) }`.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceDetailViewController.swift" hl_lines="2 3 5 9 13 15"
    ⋯ at the end of render(_:):
            discoveringRow.isHidden = !state.discovering
            renderServices(state.services, values: state.values)
    ⋯ renderServices(_:values:): rebuilt from the state each time
            servicesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    ⋯ for each service, a header label; for each characteristic, its UUID label and:
                    let row = UIStackView(arrangedSubviews: [propertiesLabel])
                    row.alignment = .center
                    if characteristic.properties.contains(.read) {
                        let readButton = UIButton(configuration: .bordered())
                        readButton.configuration?.title = "Read"
                        readButton.addAction(UIAction { [weak self] _ in
                            self?.viewModel.read(characteristic: characteristic)
                        }, for: .touchUpInside)
                        readButton.setContentHuggingPriority(.required, for: .horizontal) // the label takes the room
                        row.addArrangedSubview(readButton)
                    }
    ```

    Stack của controller giờ nằm trong một `UIScrollView`, ghim vào `contentLayoutGuide` của nó và rộng bằng `frameLayoutGuide`, công thức Auto Layout quen thuộc cho một cột cuộn được. `discoveringRow` và `servicesStack` vào stack dưới nút. Không có hugging priority, nút Read bị kéo giãn ngang cả hàng (ảnh chụp Simulator đầu tiên của chúng tôi).


!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    `ForEach` của SwiftUI định danh mỗi hàng (`\.uuid`, `\.self`) để so sánh khác biệt; `render(_:)` của UIKit gỡ các subview đã sắp xếp và thêm cái mới. Hành động của nút capture `[weak self]`, như nút Connect của bài 14, để các hàng không giữ sống một controller đã bị pop.

## 9. Một thiết bị giả lập để đọc, và phần nối dây

Emulator và Simulator không với tới được thiết bị thật, nên `SimulatedBleConnection` có thêm một bảng GATT: mọi thiết bị mẫu kết nối vào đều có cùng bốn service.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleConnection.kt" hl_lines="5 11 12 15"
⋯ connect(device): as in Lesson 14, and it sets linked while the link is up
    override suspend fun read(characteristic: Characteristic): ByteArray {
        delay(200)
        if (!linked) throw ConnectionException("Not connected.")
        return VALUES[characteristic.uuid]
            ?: throw ConnectionException("The device refused the read (simulated).")
    }
⋯ in the companion object, SERVICES: Battery (180F), Environmental Sensing (181A), Device Information (180A) and a custom one
        // What each readable characteristic holds. LOCKED has none: its reads fail.
        val VALUES = mapOf(
            fullUuid("2A19") to byteArrayOf(0x52), // 82 %
            fullUuid("2A6E") to byteArrayOf(0x66, 0x08), // 0x0866 = 2150: 21.50 °C
            fullUuid("2A29") to "Simulated Devices".encodeToByteArray(),
            fullUuid("2A24") to "SIM-01".encodeToByteArray(),
            RAW to byteArrayOf(0x01, 0x02, 0x03, 0x04),
        )
```

Service tự định nghĩa có ba characteristic với UUID 128-bit bịa ra: một cái đọc được (`01 02 03 04`, hiện dạng hex), một cái mà lần đọc luôn thất bại, và một cái chỉ có Notify, không có nút Read. Khám phá mất 500 ms và một lần đọc mất 200 ms, nên "Discovering services…" ở trên màn hình đủ lâu để thấy.

Trên Android không gì trong phần nối dây đổi: `initKoin(permissionChecker, AndroidBleScanner(this), AndroidBleConnection(this))`. Trên iOS, phần khởi động app giờ dựng hai nửa của adapter:

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="4"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: LinkedBleConnection(link: IosBleConnection())
            )
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="4"
            AppModuleKt.doInitKoin(
                permissionChecker: IosPermissionChecker(),
                bleScanner: IosBleScanner(),
                bleConnection: LinkedBleConnection(link: IosBleConnection())
            )
    ```


`appModule` và `initKoin` không đổi: Koin vẫn nhận một `BleConnection`, và chỉ phần khởi động app iOS biết nó được làm từ hai object. Muốn chạy với thiết bị giả lập, truyền `SimulatedBleScanner()` và `SimulatedBleConnection()` thay vào, như ở bài 14.

## 10. Test

Bộ giải mã là một hàm thuần, nên test của nó không cần fake và không cần coroutine: byte vào, chữ ra.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/ValueDecoderTest.kt" hl_lines="2 5 6 10 12 16"
    private fun decode(uuid: String, vararg bytes: Int) =
        ValueDecoder.decode(uuid, ByteArray(bytes.size) { bytes[it].toByte() })
⋯ batteryLevelIsOneUnsignedByte, aReservedBatteryLevelIsShownInHex
    @Test
    fun temperatureIsLittleEndianHundredthsOfADegree() {
        assertEquals("21.50 °C", decode(ValueDecoder.TEMPERATURE, 0x66, 0x08)) // 0x0866 = 2150
    }

    @Test
    fun negativeTemperaturesKeepTheirSign() {
        assertEquals("-5.25 °C", decode(ValueDecoder.TEMPERATURE, 0xF3, 0xFD)) // 0xFDF3 = -525
        assertEquals("-0.25 °C", decode(ValueDecoder.TEMPERATURE, 0xE7, 0xFF)) // 0xFFE7 = -25
    }
⋯ aTemperatureCanBeNotKnown, textCharacteristicsAreUtf8, anyOtherValueIsShownInHex
    @Test
    fun bytesThatDontFitTheFormatAreShownInHex() {
        assertEquals("66 08 00", decode(ValueDecoder.TEMPERATURE, 0x66, 0x08, 0x00))
        assertEquals("", decode(ValueDecoder.BATTERY_LEVEL))
    }
```

1. **`vararg bytes: Int`** cho phép test viết `0xF3`: một literal `Byte` của Kotlin không vượt quá 127 được, nên hàm phụ nhận `Int` và `toByte()` giữ 8 bit thấp của chúng.
2. **Tám test cho bộ giải mã và thêm hai cho các model** (`DeviceServiceTest`: `fullUuid` trên dạng 16-, 32- và 128-bit ở cả chữ hoa và chữ thường, và `propertiesOf` bỏ qua các bit app không dùng). Chúng chạy trên JVM và iOS simulator, nên phần giải mã iPhone dùng chính là phần được test.

Radio giả học thêm các request mới. Test quyết định thiết bị có gì và giữ gì, và fake ghi lại những gì đã được gửi:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleConnection.kt" hl_lines="2 3 6 12 13 15"
⋯ attempts, isLinked and connect(device): as in Lesson 14
    var services: List<DeviceService> = emptyList()
    val values = mutableMapOf<Characteristic, ByteArray>() // a read of anything else fails
    var discoveryFailure: String? = null
    val reads = mutableListOf<Characteristic>() // one entry per read() call
    var mostAtOnce = 0 // the most requests that were in progress at the same time
        private set
⋯ discoverServices() and read() both go through request { … }
    // Each request takes 100 ms of virtual time, so a test can see whether two overlap.
    private suspend fun <T> request(answer: () -> T): T {
        if (!isLinked) throw ConnectionException("Not connected.")
        inProgress++
        mostAtOnce = maxOf(mostAtOnce, inProgress)
        try {
            delay(100)
            return answer()
        } finally {
            inProgress--
        }
    }
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/SessionServiceTest.kt" hl_lines="2 8 9 14"
    @Test
    fun sendsOneRequestAtATime() = runTest {
        radio.values[batteryLevel] = byteArrayOf(0x52)
        val call = launch { session.connect(obd) }
        radio.answer()
        testScheduler.runCurrent()

        val first = async { session.read(batteryLevel) }
        val second = async { session.read(batteryLevel) }
        first.await()
        second.await()

        assertEquals(2, radio.reads.size)
        assertEquals(1, radio.mostAtOnce)
        call.cancelAndJoin()
    }
```

1. **Chồng lấn cần thời gian.** Không có `delay(100)` trong fake, mỗi lần đọc sẽ xong trước khi `async` thứ hai kịp bắt đầu, và test không thể fail. Có nó, và không có `Mutex` của service, cả hai lần đọc cùng đang diễn ra một lúc và `mostAtOnce` là 2 (chúng tôi đã gỡ khoá ra để kiểm tra). `runTest` bỏ qua 100 ms đó (bài 11).
2. **Sáu test service mới còn lại**: các service của thiết bị đã kết nối quay về đúng như radio báo; một lần đọc trả về giá trị đã giải mã ("82 %"); không gì được gửi trước khi kết nối; một characteristic không có Read không bao giờ được gửi tới radio; một lần đọc bị từ chối tới được bên gọi và kết nối vẫn còn; một lần khám phá thất bại kết thúc kết nối, nên `connect` trả về và `isLinked` là false.
3. **Bốn test ViewModel mới**, với `TestDeviceSession` giờ trả lời `services()` và `read()`: nó khám phá khi state là `Connected` (và không trước đó); giá trị của một lần đọc nằm dưới characteristic của nó; một lần đọc thất bại hiện "Read failed: …" ở đó và không mở alert; Disconnected xoá các service và giá trị.

## 11. Thực tế xảy ra gì

Chúng tôi build m10 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, Xcode 26.2). `allTests` pass 54 trên 54 trên JVM và 54 trên 54 trên iOS simulator, không có cảnh báo compiler nào từ code của chúng ta. Với adapter thật, trên emulator và Simulator vẫn chẳng có gì để kết nối, nên phần lớn các lần chạy thay vào adapter giả lập:

| Lần chạy | Thứ chúng tôi thấy |
|---|---|
| Emulator Android API 36, `SimulatedBleScanner` với `AndroidBleConnection` thật, Compose: OBD-II Adapter, Connect | "Status: connecting…", rồi sau 10 s "Connection failed: OBD-II Adapter didn't answer within 10 seconds."; logcat: `registerApp()`, rồi 10 s sau `cancelOpen()`, `close()`, `unregisterApp()`. Không có liên kết thì không lần khám phá nào bắt đầu |
| API 36, cả hai adapter giả lập, Compose và XML: Connect | "Status: connected", rồi bốn khối "Service …": `0000180F-…`, `0000181A-…`, `0000180A-…` và `DB7A0105-…`; sáu nút Read; characteristic chỉ-notify không có nút nào |
| như trên, Read trên từng cái | "82 %", "21.50 °C", "Simulated Devices", "SIM-01", "01 02 03 04", và "Read failed: The device refused the read (simulated)." |
| như trên, xoay ngang rồi xoay lại, rồi Disconnect | các service và giá trị đã đọc vẫn còn qua lần xoay; sau Disconnect, "Status: not connected" và không còn service nào |
| Simulator iOS 26.2, `SimulatedBleScanner` với `LinkedBleConnection(link: IosBleConnection())` thật, SwiftUI và UIKit | Connect: "Connection failed: This phone has no Bluetooth LE radio."; sau OK, "Status: not connected" và không có "Discovering services…" |
| Simulator, cả hai adapter giả lập, SwiftUI và UIKit (XCUITest) | cùng các service, sáu nút Read và sáu câu trả lời như trên Android; nằm ngang vẫn giữ chúng; Disconnect xoá chúng |

Lần chạy iOS đầu tiên quan trọng hơn vẻ ngoài của nó: đó là `LinkedBleConnection` thật và nửa Swift thật làm việc cùng nhau qua `IosLink`, cách chia mới, cho tới điểm mà việc Simulator thiếu radio chặn nó lại. Một lần khám phá thật và một lần đọc thật cần điện thoại của bạn và LightBlue (bài 13 đã bảo bạn cho thiết bị ảo của nó một characteristic Read); brief cho agent liệt kê chúng là các kiểm tra trên thiết bị. **m10 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng, các lần chạy ở trên diễn ra giống vậy với bạn, và ít nhất một điện thoại của bạn liệt kê được các service của LightBlue và đọc được một giá trị. Hãy commit nó. Bài 16 đăng ký nhận notification trên cùng liên kết và xử lý một liên kết bị rớt.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một lần bấm Read, trên track iOS của bạn, từ nút tới dòng chữ dưới characteristic: những lời gọi Kotlin nào chạy, coroutine treo ở đâu, method Swift nào gửi request, method delegate nào trả lời, và dòng nào biến byte thành "82 %". Rồi làm tương tự trên Android, từ `readCharacteristic` tới `onCharacteristicRead`.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Một thiết bị đã kết nối có bốn service. Adapter của mỗi nền tảng gửi bao nhiêu request khám phá để biết hết mọi characteristic?</p>
<div class="opts">
<button class="opt">một trên mỗi nền tảng</button>
<button class="opt" data-correct>một trên Android; năm trên iOS: một cho các service, rồi một cho mỗi service</button>
<button class="opt">bốn trên Android, bốn trên iOS</button>
</div>
<p class="feedback"></p>
<p class="why"><code>discoverServices()</code> của Android khám phá các service "cùng với characteristic và descriptor của chúng". Trên iOS, <code>discoverCharacteristics(_:for:)</code> nhận một service, và chỉ bắt đầu được khi <code>didDiscoverServices</code> đã trả lời: hai lần khám phá lồng nhau.</p>
</div>

<div class="quiz">
<p class="q">Vì sao bộ giải mã viết <code>bytes[0].toInt() and 0xFF</code> cho Battery Level?</p>
<div class="opts">
<button class="opt" data-correct>một <code>Byte</code> của Kotlin có dấu, nên số 200 của thiết bị tới thành −56; <code>and 0xFF</code> trả lại 0..255</button>
<button class="opt">để đổi little endian sang big endian</button>
<button class="opt">một mình <code>toInt()</code> không compile được</button>
</div>
<p class="feedback"></p>
<p class="why"><code>Byte</code> là −128..127. <code>toInt()</code> giữ dấu; che bằng <code>0xFF</code> chỉ giữ 8 bit thiết bị đã gửi. Test với <code>0xC8</code> fail khi thiếu nó.</p>
</div>

<div class="quiz">
<p class="q">Một characteristic Temperature (<code>sint16</code>, phần trăm độ) gửi các byte <code>66 08</code>. App hiện gì?</p>
<div class="opts">
<button class="opt">262.16 °C</button>
<button class="opt" data-correct>21.50 °C</button>
<button class="opt">không biết</button>
</div>
<p class="feedback"></p>
<p class="why">GSS: "Mọi trường trong một characteristic hay descriptor đều là little endian trừ khi có ghi khác." Octet 0 là byte thấp: <code>0x0866</code> = 2150, nên là 21.50 °C.</p>
</div>

<div class="quiz">
<p class="q">Trên một iPhone, màn hình nằm mãi ở "Discovering services…", không có lỗi nào. Nguyên nhân khả dĩ nhất là gì?</p>
<div class="opts">
<button class="opt">thiết bị không có service nào</button>
<button class="opt"><code>suspendCancellableCoroutine</code> của Kotlin bị hết giờ</button>
<button class="opt" data-correct>delegate của <code>CBPeripheral</code> chưa bao giờ được gán, hoặc object nó trỏ tới đã bị giải phóng, nên câu trả lời đi đâu mất</button>
</div>
<p class="feedback"></p>
<p class="why">Delegate của peripheral là một property riêng, <code>weak</code>, và protocol không có method bắt buộc nào. Một thiết bị không có service sẽ trả lời bằng một danh sách rỗng, và không gì trong adapter hết giờ.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>SessionService</code> gửi mỗi lần một request trên liên kết?</p>
<div class="opts">
<button class="opt">để UI hiện mỗi lần một giá trị</button>
<button class="opt" data-correct><code>BluetoothGatt</code> của Android từ chối một lần đọc khi một lần đọc hay ghi khác đang chờ câu trả lời, và hợp đồng của port (mỗi lần một) cho mỗi adapter giữ một ô chờ duy nhất</button>
<button class="opt">CoreBluetooth crash khi có hai lần đọc</button>
</div>
<p class="feedback"></p>
<p class="why"><code>readCharacteristic</code> trả <code>false</code> khi <code>mDeviceBusy</code> đang bật, thứ một lần đọc hay ghi bật cho tới khi câu trả lời của nó tới (mã nguồn Android). <code>Mutex</code> trong service giữ hợp đồng cho mọi adapter, và <code>sendsOneRequestAtATime</code> kiểm tra nó.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q"><code>fullUuid("180F")</code> trả về <code>0000180F-0000-1000-8000-00805F9B34FB</code>. Vì sao lại có các chữ số kia? (Bài 13)</p>
<div class="opts">
<button class="opt">chúng ngẫu nhiên, do điện thoại điền vào</button>
<button class="opt" data-correct>một UUID 16-bit đại diện cho một UUID đầy đủ dựng trên Bluetooth base UUID</button>
<button class="opt">chúng mã hoá địa chỉ của thiết bị</button>
</div>
<p class="feedback"></p>
<p class="why">Bài 13: các UUID hay dùng có dạng ngắn 16 hoặc 32 bit, và "Core Bluetooth điền sẵn phần còn lại của UUID 128-bit bằng Bluetooth base UUID". Android báo dạng đầy đủ, nên app core chọn nó.</p>
</div>

<div class="quiz">
<p class="q">Mỗi request của fake đều <code>delay(100)</code>. Vì sao bộ test không chạy lâu hơn? (Bài 11)</p>
<div class="opts">
<button class="opt" data-correct><code>runTest</code> chạy trên thời gian ảo: nó bỏ qua <code>delay</code> và dời đồng hồ của nó thay vào</button>
<button class="opt">delay của fake chỉ chạy trên Android</button>
<button class="opt"><code>delay</code> bị bỏ qua bên trong một <code>flow</code></button>
</div>
<p class="feedback"></p>
<p class="why">Scheduler của <code>runTest</code> đẩy thời gian ảo khi mọi coroutine đều đang chờ, nên một delay 100 ms không tốn gì, trong khi thứ tự các sự kiện vẫn như với thời gian thật.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m10 của bạn)"
    1. **Đoán, rồi xem.** Truyền cả hai adapter giả lập vào `initKoin` (hoặc `doInitKoin`). Trước khi bấm Connect, ghi ra characteristic nào sẽ có nút Read và mỗi cái sẽ hiện gì. Rồi Connect, đọc hết, xoay (Android) hoặc xoay Simulator sang ngang, và Disconnect. Dự đoán nào của bạn sai, và vì sao?
    2. **Test trước, rồi mới giải mã.** Humidity (`0x2A6F`) trong GSS là một `uint16` theo phần trăm của phần trăm, 0.00 tới 100.00, trong đó `0xFFFF` "biểu diễn 'không biết giá trị'". Viết `humidityIsUnsignedHundredthsOfAPercent` trước: `0x1A 0x13` hiện "48.90 %", và `0xFF 0xFF` hiện "not known". Chạy nó và xem nó fail. Rồi thêm `HUMIDITY` và `humidity(bytes)` vào `ValueDecoder`. Trong hai quy tắc byte của nhiệt độ, `uint16` cần quy tắc nào, và không được dùng quy tắc nào?
    3. **Cố tình đảo thứ tự.** Trong `temperature`, đổi chỗ `bytes[0]` và `bytes[1]`. Đoán xem test nào fail và chúng in gì, rồi chạy chúng trên cả hai nền tảng. Hoàn tác.
    4. **Trên điện thoại của bạn**, với LightBlue đang quảng bá: kết nối tới hàng của máy Mac, và so các service app liệt kê với các service LightBlue hiện cho thiết bị ảo của nó. Đọc mọi characteristic đọc được. App giải mã được cái nào, và cái nào tới dạng hex? Trên iPhone, comment dòng `found.delegate = self`, chạy lại, và Connect: màn hình hiện gì, và trong bao lâu? Đặt lại dòng đó.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/15-ble-discovery-and-read.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/15-ble-discovery-and-read.html" -o .course/lesson-15.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html" -o .course/ref-ble-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 11, 13 and 14, which this lesson builds on; skipped if they're already there:
  [ -f .course/lesson-11.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html" -o .course/lesson-11.html
  [ -f .course/lesson-13.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/13-ble-concepts-and-scan.html" -o .course/lesson-13.html
  [ -f .course/lesson-14.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/14-ble-connect.html" -o .course/lesson-14.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 15 (BLE: discovery and read): build milestone m10 on top of m09: discover the connected
device's services and characteristics and read a characteristic's value through the DeviceSession
inbound port (services(), read()), over BleConnection.discoverServices() and read(); decode the
bytes in the app core (ValueDecoder); show the services, a Read button for readable
characteristics and the decoded value on the detail screen. Android: discoverServices +
readCharacteristic. iOS: the Kotlin LinkedBleConnection in iosMain implements the port, and the
Swift IosBleConnection does the CoreBluetooth work as the peripheral's delegate.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m09 project in demo/ (Lesson 14). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/DeviceService.kt, core/Uuids.kt, core/ValueDecoder.kt
     replaced: core/ConnectionException.kt, core/SessionService.kt, core/inbound/DeviceSession.kt,
       core/outbound/BleConnection.kt, adapter/inbound/DeviceDetailUiState.kt,
       adapter/inbound/DeviceDetailViewModel.kt, adapter/outbound/SimulatedBleConnection.kt
     replaced: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt
     under shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/:
       delete ConnectFlow.kt; add LinkedBleConnection.kt
     under shared/src/commonTest/kotlin/com/example/devicemonitor/:
       add: core/ValueDecoderTest.kt, core/DeviceServiceTest.kt
       replaced: doubles/FakeBleConnection.kt, doubles/TestDeviceSession.kt,
         core/SessionServiceTest.kt, adapter/inbound/DeviceDetailViewModelTest.kt
   shared/build.gradle.kts, di/AppModule.kt and every other file in shared/ stay as in m09.

2. Android: androidApp/src/main/java/com/example/devicemonitor/android/
     Compose: DeviceDetailScreen.kt: replaced.
     XML: DeviceDetailFragment.kt and res/layout/fragment_device_detail.xml: replaced.
   DeviceMonitorApplication.kt, androidApp/build.gradle.kts and the manifest stay as in m09.
   iOS, both tracks: iosApp/iosApp/IosBleConnection.swift: replaced. No Swift file is added or
   removed, so don't run xcodegen; don't edit Info.plist, project.yml or the .xcodeproj.
     SwiftUI: iOSApp.swift and DeviceDetailView.swift: replaced.
     UIKit: AppDelegate.swift and DeviceDetailViewController.swift: replaced.
   Every other Android and iOS file stays as in m09.

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
  the task lines), and all 54 tests pass on each: 15 in SessionServiceTest, 9 in
  DeviceDetailViewModelTest, 8 in ValueDecoderTest, 2 in DeviceServiceTest, 8 in
  ScanningServiceTest, 7 in DeviceListViewModelTest, 4 in PermissionServiceTest, 1 in
  AppModuleTest. Show the counts from the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: the same lines as in Lesson 14's brief (SKIE's "Configuration '…' was
  resolved during configuration time", SLF4J "Failed to load class", Gradle's "Deprecated
  Gradle features … Gradle 10", "Unable to strip the following libraries", Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", xcodebuild's
  "WARNING: Using the first of multiple matching destinations", and Gradle's "The Daemon will
  expire …"). Xcode "note:" lines are not warnings.
- The app core stays platform-free:
    grep -rn 'import android\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing. The exported header has the new iOS adapter and no ConnectFlow any more:
    grep -c 'initWithLink:(id<SharedIosLink>)link' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'ConnectFlowKt' and grep -c 'Koin_core' on the same file print 0 (build
  that framework first with ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64).
- The emulator and the Simulator can't reach a real device, so two runs swap adapters for a
  while. Make each swap in the app-start file only (Android: DeviceMonitorApplication.kt; iOS:
  iOSApp.swift or AppDelegate.swift), rebuild, and put the file back exactly as in Full files
  afterwards (diff it). The simulated classes are in com.example.devicemonitor.adapter.outbound.
  Run A: SimulatedBleScanner() in place of the real scanner, the real connection kept.
  Run B: SimulatedBleScanner() and SimulatedBleConnection() in place of both.
- Android emulator (API 31+), my track (the XML buttons show their text in capitals, so match
  case-insensitively; find nodes with `adb shell uiautomator dump`; scroll with
  `adb shell input swipe` to reach rows below the screen):
  Run A:
  1. Scan, tap "OBD-II Adapter", adb logcat -c, Connect: "Status: connecting…", then after
     about 10 s the alert "Connection failed" / "OBD-II Adapter didn't answer within 10 seconds.",
     and never "Discovering services…". `adb logcat -d -s BluetoothGatt` shows registerApp(),
     then about 10 s later cancelOpen(), close() and unregisterApp().
  Run B:
  2. Scan, tap "OBD-II Adapter", Connect: "Status: connected", then within 3 s four blocks
     starting "Service 0000180F-0000-1000-8000-00805F9B34FB", "Service 0000181A-…",
     "Service 0000180A-…" and "Service DB7A0105-DE5C-472A-9613-A1F48A12A05D"; the first
     characteristic shows "00002A19-0000-1000-8000-00805F9B34FB" and "read · notify".
  3. Six Read buttons in all; the last characteristic, "89E2E7AE-…", shows "notify" and no Read.
     Tap each Read, top to bottom: "82 %", "21.50 °C", "Simulated Devices", "SIM-01",
     "01 02 03 04", "Read failed: The device refused the read (simulated).", each under its
     characteristic, and no alert.
  4. Rotate: adb shell settings put system accelerometer_rotation 0, then
     adb shell settings put system user_rotation 1. Still "Status: connected", and scrolling
     down shows "82 %" still there. Rotate back (user_rotation 0). Tap Disconnect: "Status: not
     connected" and no "Service …" text.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  Run A: Scan, tap "OBD-II Adapter", Connect: an alert "Connection failed" with "This phone has
  no Bluetooth LE radio." OK: "Status: not connected" and no "Discovering services…".
  Run B: steps 2 and 3 above (app.buttons matching "Read": count 6; tap each by index), then
  set XCUIDevice.shared.orientation to .landscapeLeft: "82 %" still there; back to .portrait,
  Disconnect: "Status: not connected", and no "82 %" or "Service 0000180F-…" any more.
- Device checks (list them for me, don't try to run them): with LightBlue advertising a
  virtual device that has a readable characteristic, on a physical Android phone and an iPhone
  on my track, using the real adapters: Connect lists the virtual device's services and
  characteristics with the properties LightBlue shows; Read on a readable characteristic shows
  a value (decoded if it's one of the four the app knows, hex otherwise) that matches
  LightBlue's; a read LightBlue refuses shows "Read failed: …"; on the iPhone, with
  found.delegate = self commented out, the screen stays on "Discovering services…" (put it
  back).
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each box of the lesson's two-delegates diagram is in the code.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data) (nguồn chính: "Discover services", "Read BLE characteristics"), và các trang reference của [BluetoothGatt](https://developer.android.com/reference/android/bluetooth/BluetoothGatt) (`discoverServices`, `getService`, `readCharacteristic`), [BluetoothGattCallback](https://developer.android.com/reference/android/bluetooth/BluetoothGattCallback) (`onServicesDiscovered`, cả hai `onCharacteristicRead`) và [BluetoothGattCharacteristic](https://developer.android.com/reference/android/bluetooth/BluetoothGattCharacteristic) (các bit `PROPERTY_*`). Quy tắc một lần đọc hay ghi bị từ chối khi một lần khác đang chờ câu trả lời chỉ có trong mã nguồn (`mDeviceBusy` trong `BluetoothGatt.java`).
- iOS: [CBPeripheral](https://developer.apple.com/documentation/corebluetooth/cbperipheral) (nguồn chính: [discoverServices(_:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/discoverservices(_:)), [discoverCharacteristics(_:for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/discovercharacteristics(_:for:)), [readValue(for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/readvalue(for:)-6u2kr)), [CBPeripheralDelegate](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate) ([didDiscoverServices](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:diddiscoverservices:)), [didDiscoverCharacteristicsFor](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:diddiscovercharacteristicsfor:error:)), [didUpdateValueFor](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatevaluefor:error:)-1xyna)), [CBCharacteristicProperties](https://developer.apple.com/documentation/corebluetooth/cbcharacteristicproperties) và [CBUUID](https://developer.apple.com/documentation/corebluetooth/cbuuid). `CBPeripheral.h`, thứ Xcode mở bằng Jump to Definition, cho thấy delegate là `weak`.
- Byte: [GATT Specification Supplement](https://www.bluetooth.com/specifications/gss/) của Bluetooth SIG (mục 2.4, thứ tự byte; mục 3, định dạng của từng characteristic) và [kho public](https://bitbucket.org/bluetooth-SIG/public/src/main/) của nó (cùng các định nghĩa dưới dạng YAML trong `gss/`, và các UUID trong `assigned_numbers/uuids/`). Kotlin: [Numbers](https://kotlinlang.org/docs/numbers.html) (`Byte` có dấu, phép bit `and`, `shl`, `or`) và [decodeToString](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/decode-to-string.html).
- Coroutine: [CompletableDeferred](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-completable-deferred/), [suspendCancellableCoroutine](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/suspend-cancellable-coroutine.html) và [Mutex](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.sync/-mutex/). Kotlin/Native: [Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html) (lỗi và exception, hàm top-level).
- [Cheatsheet: BLE](https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html): giờ có thêm khám phá và đọc đặt cạnh nhau, giải mã, và cái bẫy delegate.
- Kinh nghiệm thực tế: các tag [android-bluetooth](https://stackoverflow.com/questions/tagged/android-bluetooth) và [core-bluetooth](https://stackoverflow.com/questions/tagged/core-bluetooth) của Stack Overflow; tìm "readCharacteristic returns false" và "didDiscoverServices not called".

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Một file bị xoá: `shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/ConnectFlow.kt`, nội dung của nó được dời vào `LinkedBleConnection.kt`. Mọi thứ khác giữ như ở m09. Không thêm file Swift nào, nên project Xcode không cần `xcodegen generate`. File chỉ một track có nằm trong tab của track đó; file mọi track dùng chung ghi rõ điều đó trong tiêu đề.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/DeviceService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A service on a connected device, in the app's terms: a UUID and the characteristics it groups.
    // Not to be confused with the app core's services, such as SessionService: this one is the
    // device's.
    data class DeviceService(val uuid: String, val characteristics: List<Characteristic>)

    // One value on the device. serviceUuid says which service it belongs to, because two services
    // can each have a characteristic with the same UUID. Every UUID is in the full form (fullUuid).
    data class Characteristic(
        val serviceUuid: String,
        val uuid: String,
        val properties: List<CharacteristicProperty>,
    )

    // What a central may do with a characteristic's value. bit is the property's bit in the
    // Characteristic Properties field, the same number on Android and iOS.
    enum class CharacteristicProperty(val bit: Int, val label: String) {
        Read(0x02, "read"),
        WriteWithoutResponse(0x04, "write without response"),
        Write(0x08, "write"),
        Notify(0x10, "notify"),
        Indicate(0x20, "indicate"),
    }

    // The properties set in bits, the Characteristic Properties field both platforms report, in
    // the field's order. Bits the app has no use for (broadcast, signed writes, …) are left out.
    fun propertiesOf(bits: Int): List<CharacteristicProperty> =
        CharacteristicProperty.entries.filter { bits and it.bit != 0 }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/Uuids.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // The Bluetooth base UUID, after its first 8 hex digits: a 16- or 32-bit UUID stands for the full
    // UUID that puts it in front of this.
    private const val BASE_UUID_TAIL = "-0000-1000-8000-00805F9B34FB"

    // A UUID in the one form the app core uses: all 128 bits, upper case. Android reports the full
    // form in lower case ("0000180f-0000-1000-8000-00805f9b34fb"); iOS can report a standard UUID in
    // its short form ("180F"). Both become "0000180F-0000-1000-8000-00805F9B34FB".
    fun fullUuid(uuid: String): String {
        val upper = uuid.uppercase()
        return when (upper.length) {
            4 -> "0000$upper$BASE_UUID_TAIL"
            8 -> "$upper$BASE_UUID_TAIL"
            else -> upper
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ValueDecoder.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.math.abs

    // Turns a characteristic's bytes into text for the user. The app knows the format of a few
    // standard characteristics, from the Bluetooth SIG's GATT Specification Supplement; any other
    // value is shown as its bytes in hex. Bytes that don't fit the format are shown in hex too.
    object ValueDecoder {
        const val BATTERY_LEVEL = "00002A19-0000-1000-8000-00805F9B34FB"
        const val TEMPERATURE = "00002A6E-0000-1000-8000-00805F9B34FB"
        const val MODEL_NUMBER = "00002A24-0000-1000-8000-00805F9B34FB"
        const val MANUFACTURER_NAME = "00002A29-0000-1000-8000-00805F9B34FB"

        fun decode(characteristicUuid: String, bytes: ByteArray): String = when (characteristicUuid) {
            BATTERY_LEVEL -> batteryLevel(bytes)
            TEMPERATURE -> temperature(bytes)
            MODEL_NUMBER, MANUFACTURER_NAME -> bytes.decodeToString()
            else -> hex(bytes)
        } ?: hex(bytes)

        // "01 02 03 04". A Kotlin Byte is signed (-128..127): and 0xFF gives the 0..255 the device sent.
        fun hex(bytes: ByteArray): String =
            bytes.joinToString(" ") { (it.toInt() and 0xFF).toString(16).uppercase().padStart(2, '0') }

        // uint8, a percentage from 0 to 100; other values are reserved.
        private fun batteryLevel(bytes: ByteArray): String? {
            if (bytes.size != 1) return null
            val percent = bytes[0].toInt() and 0xFF
            return if (percent <= 100) "$percent %" else null
        }

        // sint16, little endian, in hundredths of a degree Celsius; 0x8000 means "not known".
        private fun temperature(bytes: ByteArray): String? {
            if (bytes.size != 2) return null
            val low = bytes[0].toInt() and 0xFF
            val high = bytes[1].toInt() // keeps its sign: the high byte carries it
            val hundredths = (high shl 8) or low
            if (hundredths == -0x8000) return "not known"
            val sign = if (hundredths < 0) "-" else ""
            val magnitude = abs(hundredths)
            return "$sign${magnitude / 100}.${(magnitude % 100).toString().padStart(2, '0')} °C"
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ConnectionException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A connection that couldn't start, failed, or dropped, or a request on it that failed: no
    // permission, Bluetooth off, no answer, or an error from the radio or the device. The message is
    // for the user. The service and outbound adapters throw it, and it reaches inbound adapters
    // through DeviceSession.
    class ConnectionException(message: String) : Exception(message)
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
    // iosMain (LinkedBleConnection) over a Swift half in the iOS app.
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
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
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

        // The connected device's services and their characteristics. Throws ConnectionException:
        // not connected, or the discovery failed, which also ends the connection.
        suspend fun services(): List<DeviceService>

        // Reads the characteristic and returns its value as text for the user. Throws
        // ConnectionException: not connected, a characteristic without the Read property, or the
        // read failed.
        suspend fun read(characteristic: Characteristic): String
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
    import kotlinx.coroutines.sync.Mutex
    import kotlinx.coroutines.sync.withLock
    import kotlin.time.Duration.Companion.seconds

    // Service: the app's connection rules. Connect only with the Bluetooth permission and to one
    // device at a time, and give up on a device that doesn't answer within CONNECT_TIMEOUT. It owns
    // the connection state that the screens show. On the open link, it sends one request at a time,
    // reads only what can be read, and decodes what it reads.
    class SessionService(
        private val connection: BleConnection,
        private val permissions: PermissionChecker,
    ) : DeviceSession {
        private val state = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
        override val connectionState: StateFlow<ConnectionState> = state.asStateFlow()
        private var link: Job? = null
        private val requests = Mutex() // the port takes one request at a time

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

        // A device whose services can't be discovered is of no use to the app: end the connection.
        override suspend fun services(): List<DeviceService> {
            val device = connectedDevice()
            return try {
                requests.withLock { connection.discoverServices() }
            } catch (e: ConnectionException) {
                disconnect()
                throw ConnectionException("Couldn't discover the services of ${device.name}. ${e.message}")
            }
        }

        override suspend fun read(characteristic: Characteristic): String {
            connectedDevice()
            if (CharacteristicProperty.Read !in characteristic.properties) {
                throw ConnectionException("This characteristic can't be read: it has no Read property.")
            }
            val bytes = requests.withLock { connection.read(characteristic) }
            return ValueDecoder.decode(characteristic.uuid, bytes)
        }

        private fun connectedDevice(): Device =
            (state.value as? ConnectionState.Connected)?.device
                ?: throw ConnectionException("Connect to the device first.")

        companion object {
            val CONNECT_TIMEOUT = 10.seconds
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.DeviceService

    // Everything the detail screen shows about the connection. The device itself comes from the
    // list, through navigation.
    data class DeviceDetailUiState(
        val connection: ConnectionState = ConnectionState.Disconnected,
        val errorMessage: String? = null,
        // True while the services are being discovered, right after connecting.
        val discovering: Boolean = false,
        // The device's services once discovered; empty while not connected.
        val services: List<DeviceService> = emptyList(),
        // What to show under each characteristic that was read: its value, or why the read failed.
        val values: Map<Characteristic, String> = emptyMap(),
    )
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.inbound.DeviceSession
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the detail screen's Connect, Disconnect and Read into calls on the
    // DeviceSession port, and the session's state and answers into UI state. It knows the port only.
    class DeviceDetailViewModel(private val session: DeviceSession) : ViewModel() {
        private val _uiState = MutableStateFlow(DeviceDetailUiState(connection = session.connectionState.value))
        val uiState: StateFlow<DeviceDetailUiState> = _uiState.asStateFlow()

        private var connectJob: Job? = null

        init {
            viewModelScope.launch {
                session.connectionState.collect { connection ->
                    _uiState.update { it.copy(connection = connection) }
                    when (connection) {
                        // This screen lists the services as soon as the link is up.
                        is ConnectionState.Connected -> discover()
                        ConnectionState.Disconnected -> _uiState.update { it.copy(services = emptyList(), values = emptyMap()) }
                        is ConnectionState.Connecting -> Unit
                    }
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

        // The answer lands under the characteristic: its value, or why the read failed. A read that
        // ends after the link has gone shows nothing.
        fun read(characteristic: Characteristic) {
            viewModelScope.launch {
                val text = try {
                    session.read(characteristic)
                } catch (e: ConnectionException) {
                    "Read failed: ${e.message}"
                }
                _uiState.update {
                    if (it.connection is ConnectionState.Connected) it.copy(values = it.values + (characteristic to text)) else it
                }
            }
        }

        fun errorShown() {
            _uiState.update { it.copy(errorMessage = null) }
        }

        private fun discover() {
            viewModelScope.launch {
                _uiState.update { it.copy(discovering = true) }
                try {
                    val services = session.services()
                    _uiState.update { if (it.connection is ConnectionState.Connected) it.copy(services = services) else it }
                } catch (e: ConnectionException) {
                    // A message already waiting (from connect(), when the link dropped) stays.
                    _uiState.update { it.copy(errorMessage = it.errorMessage ?: e.message) }
                } finally {
                    _uiState.update { it.copy(discovering = false) }
                }
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.CharacteristicProperty.Notify
    import com.example.devicemonitor.core.CharacteristicProperty.Read
    import com.example.devicemonitor.core.CharacteristicProperty.Write
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.fullUuid
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.coroutines.awaitCancellation
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Outbound adapter: a pretend link behind the BleConnection port, for the sample devices of
    // SimulatedBleScanner. Each one connects after 1 s and stays connected until the collector
    // cancels, except the Smart Scale, which never answers. Every connected device has the services
    // below. The app doesn't bind it; bind it with SimulatedBleScanner in place of the real radio to
    // run without one.
    class SimulatedBleConnection : BleConnection {
        private var linked = false

        override fun connect(device: Device): Flow<ConnectionState> = flow {
            emit(ConnectionState.Connecting(device))
            if (device.name == "Smart Scale") awaitCancellation() // never answers
            delay(1000)
            linked = true
            try {
                emit(ConnectionState.Connected(device))
                awaitCancellation()
            } finally {
                linked = false
            }
        }

        override suspend fun discoverServices(): List<DeviceService> {
            delay(500)
            if (!linked) throw ConnectionException("Not connected.")
            return SERVICES
        }

        override suspend fun read(characteristic: Characteristic): ByteArray {
            delay(200)
            if (!linked) throw ConnectionException("Not connected.")
            return VALUES[characteristic.uuid]
                ?: throw ConnectionException("The device refused the read (simulated).")
        }

        private companion object {
            val BATTERY = fullUuid("180F")
            val ENVIRONMENT = fullUuid("181A")
            val DEVICE_INFORMATION = fullUuid("180A")
            const val CUSTOM = "DB7A0105-DE5C-472A-9613-A1F48A12A05D"
            const val RAW = "92FFE234-1451-4C7D-AD34-4FB55D30006A"
            const val LOCKED = "FC41CAF8-D3EF-4946-A616-413A35AC62B7"
            const val STREAM = "89E2E7AE-83B7-4056-B7DD-FE9A80C82334"

            val SERVICES = listOf(
                DeviceService(BATTERY, listOf(Characteristic(BATTERY, fullUuid("2A19"), listOf(Read, Notify)))),
                DeviceService(ENVIRONMENT, listOf(Characteristic(ENVIRONMENT, fullUuid("2A6E"), listOf(Read, Notify)))),
                DeviceService(
                    DEVICE_INFORMATION,
                    listOf(
                        Characteristic(DEVICE_INFORMATION, fullUuid("2A29"), listOf(Read)),
                        Characteristic(DEVICE_INFORMATION, fullUuid("2A24"), listOf(Read)),
                    ),
                ),
                DeviceService(
                    CUSTOM,
                    listOf(
                        Characteristic(CUSTOM, RAW, listOf(Read, Write)),
                        Characteristic(CUSTOM, LOCKED, listOf(Read)),
                        Characteristic(CUSTOM, STREAM, listOf(Notify)),
                    ),
                ),
            )

            // What each readable characteristic holds. LOCKED has none: its reads fail.
            val VALUES = mapOf(
                fullUuid("2A19") to byteArrayOf(0x52), // 82 %
                fullUuid("2A6E") to byteArrayOf(0x66, 0x08), // 0x0866 = 2150: 21.50 °C
                fullUuid("2A29") to "Simulated Devices".encodeToByteArray(),
                fullUuid("2A24") to "SIM-01".encodeToByteArray(),
                RAW to byteArrayOf(0x01, 0x02, 0x03, 0x04),
            )
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
    import android.bluetooth.BluetoothGattCharacteristic
    import android.bluetooth.BluetoothGattService
    import android.bluetooth.BluetoothManager
    import android.bluetooth.BluetoothProfile
    import android.content.Context
    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.fullUuid
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.propertiesOf
    import kotlinx.coroutines.CompletableDeferred
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow
    import java.util.UUID

    // Outbound adapter: a GATT connection over the phone's Bluetooth LE radio, behind the
    // BleConnection port. BluetoothGatt reports to a callback object; callbackFlow turns the link's
    // calls into a Flow, and closes the GATT client when the collector cancels. Each request on the
    // open link waits for its own callback in a CompletableDeferred.
    class AndroidBleConnection(private val context: Context) : BleConnection {
        private val adapter: BluetoothAdapter? =
            context.getSystemService(BluetoothManager::class.java)?.adapter

        // The open link, from the moment it's up until it closes. Callbacks run on a background thread.
        @Volatile private var gatt: BluetoothGatt? = null

        // The request waiting for its callback. The port takes one request at a time, so one is enough.
        @Volatile private var answer: CompletableDeferred<Answer>? = null

        private class Answer(val status: Int, val value: ByteArray)

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
                            this@AndroidBleConnection.gatt = gatt
                            trySend(ConnectionState.Connected(device))
                        }
                        linked -> close(ConnectionException("The link to ${device.name} was lost (Android status $status)."))
                        else -> close(ConnectionException("The connection failed (Android status $status)."))
                    }
                }

                // Discovery found every service, characteristic and descriptor, or failed.
                override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                    answer?.complete(Answer(status, ByteArray(0)))
                }

                // Android 13 (API 33) and later call this one, with the value.
                override fun onCharacteristicRead(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic,
                    value: ByteArray,
                    status: Int,
                ) {
                    answer?.complete(Answer(status, value))
                }

                // Android 12 and earlier call this one: the value is in the characteristic.
                @Deprecated("Replaced at API 33 by the overload with the value")
                @Suppress("DEPRECATION")
                override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
                    answer?.complete(Answer(status, characteristic.value ?: ByteArray(0)))
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
                // A request still waiting would never get its callback now.
                this@AndroidBleConnection.gatt = null
                answer?.completeExceptionally(ConnectionException("The link closed before the device answered."))
                // Whatever ended the link, close the GATT client, or Android keeps it registered.
                gatt.disconnect()
                gatt.close()
            }
        }

        // One call discovers it all: Android explores the services and their characteristics together.
        @SuppressLint("MissingPermission")
        override suspend fun discoverServices(): List<DeviceService> {
            val gatt = openGatt()
            val answer = request { gatt.discoverServices() }
            if (answer.status != BluetoothGatt.GATT_SUCCESS) {
                throw ConnectionException("Discovery failed (Android status ${answer.status}).")
            }
            return gatt.services.map { it.toDeviceService() }
        }

        @SuppressLint("MissingPermission")
        override suspend fun read(characteristic: Characteristic): ByteArray {
            val gatt = openGatt()
            val target = gatt.getService(UUID.fromString(characteristic.serviceUuid))
                ?.getCharacteristic(UUID.fromString(characteristic.uuid))
                ?: throw ConnectionException("This device has no such characteristic. Discover its services again.")
            val answer = request { gatt.readCharacteristic(target) }
            if (answer.status != BluetoothGatt.GATT_SUCCESS) {
                throw ConnectionException("The device refused the read (Android status ${answer.status}).")
            }
            return answer.value
        }

        private fun openGatt(): BluetoothGatt = gatt ?: throw ConnectionException("Not connected.")

        // Sends one request and waits for its callback. send returns false when Android won't send it,
        // for example while a read or write on this link is still waiting for its answer.
        private suspend fun request(send: () -> Boolean): Answer {
            val pending = CompletableDeferred<Answer>()
            answer = pending
            try {
                if (!send()) throw ConnectionException("Android couldn't send the request.")
                return pending.await()
            } finally {
                answer = null
            }
        }

        private fun BluetoothGattService.toDeviceService(): DeviceService {
            val serviceUuid = fullUuid(uuid.toString())
            return DeviceService(
                uuid = serviceUuid,
                characteristics = characteristics.map {
                    Characteristic(serviceUuid, fullUuid(it.uuid.toString()), propertiesOf(it.properties))
                },
            )
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/LinkedBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.cinterop.ExperimentalForeignApi
    import kotlinx.cinterop.addressOf
    import kotlinx.cinterop.usePinned
    import kotlinx.coroutines.CancellableContinuation
    import kotlinx.coroutines.channels.ProducerScope
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.callbackFlow
    import kotlinx.coroutines.suspendCancellableCoroutine
    import platform.Foundation.NSData
    import platform.posix.memcpy
    import kotlin.coroutines.resume
    import kotlin.coroutines.resumeWithException

    // The Kotlin half of the iOS adapter: it implements the BleConnection port, and the Swift half,
    // IosBleConnection, does the radio work behind IosLink. Kotlin builds the Flow and waits for each
    // answer, so every failure reaches the app core as a ConnectionException; Swift only makes plain
    // calls, on the main thread. Bind LinkedBleConnection(link: IosBleConnection()).
    class LinkedBleConnection(private val link: IosLink) : BleConnection {
        // Collecting the Flow calls the link's open; cancelling the collector calls its close.
        override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
            link.open(device, LinkFeed(this))
            awaitClose { link.close() }
        }

        override suspend fun discoverServices(): List<DeviceService> =
            suspendCancellableCoroutine { link.discover(ServicesReply(it)) }

        override suspend fun read(characteristic: Characteristic): ByteArray =
            suspendCancellableCoroutine { link.read(characteristic, ValueReply(it)) }
    }

    // What the Swift connection implements: open and close the real link, and the requests on it.
    interface IosLink {
        fun open(device: Device, feed: LinkFeed)
        fun close()
        fun discover(reply: ServicesReply)
        fun read(characteristic: Characteristic, reply: ValueReply)
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

    // Where the Swift connection answers a discovery: every service, or the failure.
    class ServicesReply internal constructor(private val waiting: CancellableContinuation<List<DeviceService>>) {
        fun found(services: List<DeviceService>) {
            if (waiting.isActive) waiting.resume(services)
        }

        fun failed(message: String) {
            if (waiting.isActive) waiting.resumeWithException(ConnectionException(message))
        }
    }

    // Where the Swift connection answers a read: the value's bytes, or the failure.
    class ValueReply internal constructor(private val waiting: CancellableContinuation<ByteArray>) {
        fun read(value: NSData) {
            if (waiting.isActive) waiting.resume(value.toByteArray())
        }

        fun failed(message: String) {
            if (waiting.isActive) waiting.resumeWithException(ConnectionException(message))
        }
    }

    // Swift's Data arrives as NSData; copy its bytes into a Kotlin ByteArray.
    @OptIn(ExperimentalForeignApi::class)
    private fun NSData.toByteArray(): ByteArray {
        val bytes = ByteArray(length.toInt())
        if (bytes.isNotEmpty()) bytes.usePinned { memcpy(it.addressOf(0), this.bytes, length) }
        return bytes
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleConnection.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Fake: an outbound adapter written for tests, behind the BleConnection port. The test plays
    // the radio and the device: whether and when the device answers, whether the link fails, what
    // services the device has, what each characteristic holds, and which requests fail.
    class FakeBleConnection : BleConnection {
        private val events = Channel<Event>(Channel.UNLIMITED)
        var attempts = 0
            private set
        var isLinked = false // true while a collector holds the link
            private set

        var services: List<DeviceService> = emptyList()
        val values = mutableMapOf<Characteristic, ByteArray>() // a read of anything else fails
        var discoveryFailure: String? = null
        val reads = mutableListOf<Characteristic>() // one entry per read() call
        var mostAtOnce = 0 // the most requests that were in progress at the same time
            private set
        private var inProgress = 0

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

        override suspend fun discoverServices(): List<DeviceService> = request {
            discoveryFailure?.let { throw ConnectionException(it) }
            services
        }

        override suspend fun read(characteristic: Characteristic): ByteArray = request {
            reads += characteristic
            values[characteristic] ?: throw ConnectionException("The device refused the read (Android status 2).")
        }

        // Each request takes 100 ms of virtual time, so a test can see whether two overlap.
        private suspend fun <T> request(answer: () -> T): T {
            if (!isLinked) throw ConnectionException("Not connected.")
            inProgress++
            mostAtOnce = maxOf(mostAtOnce, inProgress)
            try {
                delay(100)
                return answer()
            } finally {
                inProgress--
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

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import com.example.devicemonitor.core.inbound.DeviceSession
    import kotlinx.coroutines.awaitCancellation
    import kotlinx.coroutines.flow.MutableStateFlow

    // Test implementation of the DeviceSession inbound port. It stands in for the whole app core,
    // so a ViewModel test tests the ViewModel only. The test sets the state, the answers and the
    // failures.
    class TestDeviceSession : DeviceSession {
        override val connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
        var failure: ConnectionException? = null
        val connected = mutableListOf<Device>() // one entry per connect() call
        var isHolding = false // true while a connect() call is running
            private set
        var disconnects = 0
            private set

        var services: List<DeviceService> = emptyList()
        val values = mutableMapOf<Characteristic, String>() // a read of anything else fails
        var discoveries = 0
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

        override suspend fun services(): List<DeviceService> {
            discoveries++
            return services
        }

        override suspend fun read(characteristic: Characteristic): String =
            values[characteristic] ?: throw ConnectionException("The device refused the read (Android status 2).")
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/ValueDecoderTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.test.Test
    import kotlin.test.assertEquals

    class ValueDecoderTest {
        private fun decode(uuid: String, vararg bytes: Int) =
            ValueDecoder.decode(uuid, ByteArray(bytes.size) { bytes[it].toByte() })

        @Test
        fun batteryLevelIsOneUnsignedByte() {
            assertEquals("82 %", decode(ValueDecoder.BATTERY_LEVEL, 0x52))
            assertEquals("100 %", decode(ValueDecoder.BATTERY_LEVEL, 0x64))
        }

        @Test
        fun aReservedBatteryLevelIsShownInHex() {
            // 200 is reserved. Read as a signed Kotlin Byte it would be -56.
            assertEquals("C8", decode(ValueDecoder.BATTERY_LEVEL, 0xC8))
        }

        @Test
        fun temperatureIsLittleEndianHundredthsOfADegree() {
            assertEquals("21.50 °C", decode(ValueDecoder.TEMPERATURE, 0x66, 0x08)) // 0x0866 = 2150
        }

        @Test
        fun negativeTemperaturesKeepTheirSign() {
            assertEquals("-5.25 °C", decode(ValueDecoder.TEMPERATURE, 0xF3, 0xFD)) // 0xFDF3 = -525
            assertEquals("-0.25 °C", decode(ValueDecoder.TEMPERATURE, 0xE7, 0xFF)) // 0xFFE7 = -25
        }

        @Test
        fun aTemperatureCanBeNotKnown() {
            assertEquals("not known", decode(ValueDecoder.TEMPERATURE, 0x00, 0x80)) // 0x8000
        }

        @Test
        fun textCharacteristicsAreUtf8() {
            val bytes = "Thermomètre".encodeToByteArray()
            assertEquals("Thermomètre", ValueDecoder.decode(ValueDecoder.MANUFACTURER_NAME, bytes))
        }

        @Test
        fun anyOtherValueIsShownInHex() {
            assertEquals("01 02 03 04", decode("DB7A0105-DE5C-472A-9613-A1F48A12A05D", 0x01, 0x02, 0x03, 0x04))
            assertEquals("FF 00 0A", decode("DB7A0105-DE5C-472A-9613-A1F48A12A05D", 0xFF, 0x00, 0x0A))
        }

        @Test
        fun bytesThatDontFitTheFormatAreShownInHex() {
            assertEquals("66 08 00", decode(ValueDecoder.TEMPERATURE, 0x66, 0x08, 0x00))
            assertEquals("", decode(ValueDecoder.BATTERY_LEVEL))
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/DeviceServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.test.Test
    import kotlin.test.assertEquals

    class DeviceServiceTest {
        @Test
        fun everyUuidBecomesTheFullUpperCaseForm() {
            val battery = "0000180F-0000-1000-8000-00805F9B34FB"
            assertEquals(battery, fullUuid("180F")) // iOS: a standard UUID in its 16-bit form
            assertEquals(battery, fullUuid("0000180f-0000-1000-8000-00805f9b34fb")) // Android
            assertEquals("12345678-0000-1000-8000-00805F9B34FB", fullUuid("12345678")) // 32-bit
            assertEquals("DB7A0105-DE5C-472A-9613-A1F48A12A05D", fullUuid("db7a0105-de5c-472a-9613-a1f48a12a05d"))
        }

        @Test
        fun propertiesComeFromTheirBits() {
            assertEquals(listOf(CharacteristicProperty.Read, CharacteristicProperty.Notify), propertiesOf(0x12))
            // 0x01 broadcast and 0x80 extended properties are bits the app doesn't use.
            assertEquals(listOf(CharacteristicProperty.Write), propertiesOf(0x89))
            assertEquals(emptyList(), propertiesOf(0))
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/SessionServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import app.cash.turbine.test
    import com.example.devicemonitor.core.CharacteristicProperty.Notify
    import com.example.devicemonitor.core.CharacteristicProperty.Read
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

        private val batteryService = fullUuid("180F")
        private val batteryLevel = Characteristic(batteryService, ValueDecoder.BATTERY_LEVEL, listOf(Read, Notify))
        private val alerts = Characteristic(batteryService, fullUuid("2A06"), listOf(Notify))

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

        // On the open link: discovery and reads. Each test connects first, as the screen does.

        @Test
        fun listsTheServicesOfTheConnectedDevice() = runTest {
            radio.services = listOf(DeviceService(batteryService, listOf(batteryLevel, alerts)))
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            assertEquals(radio.services, session.services())
            call.cancelAndJoin()
        }

        @Test
        fun readReturnsTheDecodedValue() = runTest {
            radio.values[batteryLevel] = byteArrayOf(0x52)
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            assertEquals("82 %", session.read(batteryLevel))
            call.cancelAndJoin()
        }

        @Test
        fun nothingIsSentBeforeConnecting() = runTest {
            val error = assertFailsWith<ConnectionException> { session.read(batteryLevel) }

            assertEquals("Connect to the device first.", error.message)
            assertEquals(emptyList(), radio.reads)
        }

        @Test
        fun neverReadsACharacteristicWithoutTheReadProperty() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.read(alerts) }

            assertEquals("This characteristic can't be read: it has no Read property.", error.message)
            assertEquals(emptyList(), radio.reads)
            call.cancelAndJoin()
        }

        @Test
        fun aFailedReadReachesTheCallerAndKeepsTheConnection() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.read(batteryLevel) }

            assertEquals("The device refused the read (Android status 2).", error.message)
            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            call.cancelAndJoin()
        }

        @Test
        fun aFailedDiscoveryEndsTheConnection() = runTest {
            radio.discoveryFailure = "Discovery failed (Android status 129)."
            val call = async { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.services() }

            assertEquals("Couldn't discover the services of OBD-II Adapter. Discovery failed (Android status 129).", error.message)
            call.await() // connect returns: the service disconnected
            assertFalse(radio.isLinked)
        }

        @Test
        fun sendsOneRequestAtATime() = runTest {
            radio.values[batteryLevel] = byteArrayOf(0x52)
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val first = async { session.read(batteryLevel) }
            val second = async { session.read(batteryLevel) }
            first.await()
            second.await()

            assertEquals(2, radio.reads.size)
            assertEquals(1, radio.mostAtOnce)
            call.cancelAndJoin()
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
    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.CharacteristicProperty
    import com.example.devicemonitor.core.ConnectionException
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
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
        private val batteryLevel = Characteristic(
            serviceUuid = "0000180F-0000-1000-8000-00805F9B34FB",
            uuid = "00002A19-0000-1000-8000-00805F9B34FB",
            properties = listOf(CharacteristicProperty.Read),
        )
        private val battery = DeviceService(batteryLevel.serviceUuid, listOf(batteryLevel))

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

        @Test
        fun discoversTheServicesOnceConnected() = runTest {
            session.services = listOf(battery)
            testScheduler.runCurrent()
            assertEquals(0, session.discoveries)

            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            assertEquals(1, session.discoveries)
            assertEquals(listOf(battery), viewModel.uiState.value.services)
            assertFalse(viewModel.uiState.value.discovering)
        }

        @Test
        fun aReadShowsItsValueUnderTheCharacteristic() = runTest {
            session.values[batteryLevel] = "82 %"
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            viewModel.read(batteryLevel)
            testScheduler.runCurrent()

            assertEquals(mapOf(batteryLevel to "82 %"), viewModel.uiState.value.values)
        }

        @Test
        fun aFailedReadShowsWhyUnderTheCharacteristic() = runTest {
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            viewModel.read(batteryLevel)
            testScheduler.runCurrent()

            assertEquals("Read failed: The device refused the read (Android status 2).", viewModel.uiState.value.values[batteryLevel])
            assertNull(viewModel.uiState.value.errorMessage)
        }

        @Test
        fun disconnectingClearsTheServicesAndValues() = runTest {
            session.services = listOf(battery)
            session.values[batteryLevel] = "82 %"
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()
            viewModel.read(batteryLevel)
            testScheduler.runCurrent()

            session.connectionState.value = ConnectionState.Disconnected
            testScheduler.runCurrent()

            assertEquals(emptyList(), viewModel.uiState.value.services)
            assertEquals(emptyMap(), viewModel.uiState.value.values)
        }
    }
    ```

**Android**

=== "Compose"

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
        import androidx.compose.foundation.rememberScrollState
        import androidx.compose.foundation.verticalScroll
        import androidx.compose.material3.AlertDialog
        import androidx.compose.material3.Button
        import androidx.compose.material3.CircularProgressIndicator
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.OutlinedButton
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.runtime.getValue
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.graphics.ColorFilter
        import androidx.compose.ui.res.painterResource
        import androidx.compose.ui.text.font.FontFamily
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.inbound.DeviceDetailUiState
        import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
        import com.example.devicemonitor.core.Characteristic
        import com.example.devicemonitor.core.CharacteristicProperty
        import com.example.devicemonitor.core.ConnectionState
        import com.example.devicemonitor.core.Device
        import com.example.devicemonitor.core.DeviceService
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
                state = state,
                onConnect = { viewModel.connect(device) },
                onDisconnect = viewModel::disconnect,
                onRead = viewModel::read,
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
            state: DeviceDetailUiState,
            onConnect: () -> Unit,
            onDisconnect: () -> Unit,
            onRead: (Characteristic) -> Unit,
            onBack: () -> Unit,
        ) {
            val connection = state.connection
            // Scrolls once the services are listed: they don't fit on one screen. A handful of rows,
            // so a scrolling Column is enough; a long list would be a LazyColumn (Lesson 07).
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
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
                if (state.discovering) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Discovering services…")
                    }
                }
                state.services.forEach { service ->
                    ServiceSection(service, state.values, onRead)
                }
            }
        }

        // One service: its UUID, then each characteristic with its properties, a Read button if it has
        // the Read property, and what the last read gave: the value, or why it failed.
        @Composable
        private fun ServiceSection(
            service: DeviceService,
            values: Map<Characteristic, String>,
            onRead: (Characteristic) -> Unit,
        ) {
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Service ${service.uuid}",
                    style = MaterialTheme.typography.labelMedium,
                    fontFamily = FontFamily.Monospace,
                )
                service.characteristics.forEach { characteristic ->
                    Column(modifier = Modifier.padding(start = 12.dp)) {
                        Text(characteristic.uuid, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                characteristic.properties.joinToString(" · ") { it.label },
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.weight(1f),
                            )
                            if (CharacteristicProperty.Read in characteristic.properties) {
                                OutlinedButton(onClick = { onRead(characteristic) }) { Text("Read") }
                            }
                        }
                        values[characteristic]?.let { Text(it) }
                    }
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Color
        import android.graphics.Typeface
        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import android.widget.Button
        import android.widget.LinearLayout
        import android.widget.TextView
        import androidx.appcompat.app.AlertDialog
        import androidx.fragment.app.Fragment
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import com.example.devicemonitor.adapter.inbound.DeviceDetailUiState
        import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
        import com.example.devicemonitor.android.databinding.FragmentDeviceDetailBinding
        import com.example.devicemonitor.core.Characteristic
        import com.example.devicemonitor.core.CharacteristicProperty
        import com.example.devicemonitor.core.ConnectionState
        import com.example.devicemonitor.core.Device
        import com.example.devicemonitor.core.DeviceService
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
                b.discoveringRow.visibility = if (state.discovering) View.VISIBLE else View.GONE
                renderServices(b.servicesContainer, state.services, state.values)
                renderError(state.errorMessage)
            }

            // Rebuilt from the state each time: a handful of rows, so no RecyclerView. One block per
            // service: its UUID, then each characteristic with its properties, a Read button if it has
            // the Read property, and what the last read gave: the value, or why it failed.
            private fun renderServices(container: LinearLayout, services: List<DeviceService>, values: Map<Characteristic, String>) {
                container.removeAllViews()
                val context = container.context
                for (service in services) {
                    container.addView(TextView(context).apply {
                        text = "Service ${service.uuid}"
                        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                        setPadding(0, 24, 0, 8)
                    })
                    for (characteristic in service.characteristics) {
                        container.addView(TextView(context).apply {
                            text = characteristic.uuid
                            typeface = Typeface.MONOSPACE
                            setPadding(32, 8, 0, 0)
                        })
                        val row = LinearLayout(context).apply {
                            orientation = LinearLayout.HORIZONTAL
                            setPadding(32, 0, 0, 0)
                        }
                        row.addView(
                            TextView(context).apply { text = characteristic.properties.joinToString(" · ") { it.label } },
                            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
                        )
                        if (CharacteristicProperty.Read in characteristic.properties) {
                            row.addView(Button(context).apply {
                                text = "Read"
                                setOnClickListener { viewModel.read(characteristic) }
                            })
                        }
                        container.addView(row)
                        values[characteristic]?.let { value ->
                            container.addView(TextView(context).apply {
                                text = value
                                setPadding(32, 0, 0, 0)
                            })
                        }
                    }
                }
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
        <!-- Scrolls once the services are listed: they don't fit on one screen. -->
        <ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
            xmlns:app="http://schemas.android.com/apk/res-auto"
            android:layout_width="match_parent"
            android:layout_height="match_parent">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
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

            <LinearLayout
                android:id="@+id/discoveringRow"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:gravity="center_vertical"
                android:orientation="horizontal"
                android:visibility="gone">

                <ProgressBar
                    android:layout_width="20dp"
                    android:layout_height="20dp"
                    android:layout_marginEnd="8dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Discovering services…" />
            </LinearLayout>

            <!-- Filled in code by render(): one block per service. -->
            <LinearLayout
                android:id="@+id/servicesContainer"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical" />
        </LinearLayout>
        </ScrollView>
        ```

**iOS**

??? example "iosApp/iosApp/IosBleConnection.swift · both iOS tracks"
    ```swift
    import CoreBluetooth
    import Shared

    // Outbound adapter, the Swift half: the radio work for a link to one peripheral, behind IosLink.
    // LinkedBleConnection, its Kotlin half in iosMain, implements the BleConnection port on top. Like
    // the scanner, it is its own manager's delegate and Koin keeps it alive (through the Kotlin half).
    // It keeps the CBPeripheral while the link lasts: CoreBluetooth cancels a pending connection
    // when its peripheral is deallocated. And it is the peripheral's delegate, which hears the
    // answers to discovery and reads.
    @MainActor
    final class IosBleConnection: NSObject, @preconcurrency IosLink,
        @preconcurrency CBCentralManagerDelegate, @preconcurrency CBPeripheralDelegate {
        private var manager: CBCentralManager?
        private var peripheral: CBPeripheral?
        private var device: Device?
        private var feed: LinkFeed?
        // The request waiting for the peripheral's delegate: the port takes one at a time.
        private var discovery: ServicesReply?
        private var servicesLeft = 0
        private var reading: (characteristic: CBCharacteristic, reply: ValueReply)?

        // IosLink: LinkedBleConnection calls these when its Flow is collected and when it is cancelled.
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
            peripheral?.delegate = nil
            peripheral = nil
            device = nil
            feed = nil
            // A request still waiting would never get its answer now.
            discovery?.failed(message: "The link closed before the device answered.")
            discovery = nil
            reading?.reply.failed(message: "The link closed before the device answered.")
            reading = nil
        }

        // IosLink: the port's requests, on the open link.
        // The first of two discoveries: the services. didDiscoverServices starts the second.
        func discover(reply: ServicesReply) {
            guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
            discovery = reply
            peripheral.discoverServices(nil)
        }

        func read(characteristic: Characteristic, reply: ValueReply) {
            guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
            // CBUUID compares by value, so the full form finds a characteristic iOS reported as "2A19".
            let serviceUuid = CBUUID(string: characteristic.serviceUuid)
            let uuid = CBUUID(string: characteristic.uuid)
            guard let target = peripheral.services?.first(where: { $0.uuid == serviceUuid })?
                .characteristics?.first(where: { $0.uuid == uuid }) else {
                return reply.failed(message: "This device has no such characteristic. Discover its services again.")
            }
            reading = (target, reply)
            peripheral.readValue(for: target)
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
            // Without this, discovery and reads are sent and their answers go nowhere. The property
            // is weak: this adapter, kept alive by Koin, is what keeps the delegate alive.
            found.delegate = self
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

        // CBPeripheralDelegate, on the main queue like the manager's calls.
        // The services are known; now each one's characteristics: one more request per service.
        func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
            guard peripheral === self.peripheral, discovery != nil else { return }
            if let error { return endDiscovery(failure: "Discovery failed: \(error.localizedDescription)") }
            let services = peripheral.services ?? []
            servicesLeft = services.count
            if services.isEmpty { return endDiscovery(failure: nil) }
            for service in services {
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }

        // One call per service. The discovery is done when every service has answered.
        func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService,
                        error: Error?) {
            guard peripheral === self.peripheral, discovery != nil else { return }
            if let error { return endDiscovery(failure: "Discovery failed: \(error.localizedDescription)") }
            servicesLeft -= 1
            if servicesLeft == 0 { endDiscovery(failure: nil) }
        }

        // Called after readValue(for:), and in Lesson 16 for each notification.
        func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
                        error: Error?) {
            guard peripheral === self.peripheral, let reading, reading.characteristic === characteristic else { return }
            self.reading = nil
            if let error {
                reading.reply.failed(message: "The device refused the read: \(error.localizedDescription)")
            } else {
                reading.reply.read(value: characteristic.value ?? Data())
            }
        }

        private func endDiscovery(failure: String?) {
            guard let discovery, let peripheral else { return }
            self.discovery = nil
            if let failure {
                discovery.failed(message: failure)
            } else {
                discovery.found(services: (peripheral.services ?? []).map(appService))
            }
        }

        // A CBService in the app's terms: full UUIDs, and the properties as the app core names them.
        private func appService(_ service: CBService) -> DeviceService {
            let serviceUuid = UuidsKt.fullUuid(uuid: service.uuid.uuidString)
            let characteristics = (service.characteristics ?? []).map { characteristic in
                Characteristic(
                    serviceUuid: serviceUuid,
                    uuid: UuidsKt.fullUuid(uuid: characteristic.uuid.uuidString),
                    properties: DeviceServiceKt.propertiesOf(bits: Int32(characteristic.properties.rawValue))
                )
            }
            return DeviceService(uuid: serviceUuid, characteristics: characteristics)
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
                    bleConnection: LinkedBleConnection(link: IosBleConnection())
                )
            }

            var body: some Scene {
                WindowGroup {
                    ContentView()
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
                    state: state,
                    onConnect: { viewModel.connect(device: device) },
                    onDisconnect: { viewModel.disconnect() },
                    onRead: { viewModel.read(characteristic: $0) }
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
            let state: DeviceDetailUiState
            let onConnect: () -> Void
            let onDisconnect: () -> Void
            let onRead: (Characteristic) -> Void

            var body: some View {
                let disconnected = state.connection is ConnectionStateDisconnected
                // Scrolls once the services are listed: they don't fit on one screen.
                ScrollView {
                    VStack(spacing: 12) {
                        Image(systemName: "antenna.radiowaves.left.and.right")
                            .font(.system(size: 64))
                            .foregroundStyle(.tint)
                        Text(device.name)
                            .font(.title2)
                        Text("ID: \(device.id)")
                        Text("Signal: \(device.rssi) dBm")
                        ConnectionStatus(connection: state.connection)
                        // One button: Connect while disconnected, Disconnect while connecting or connected.
                        Button(action: disconnected ? onConnect : onDisconnect) {
                            Text(disconnected ? "Connect" : "Disconnect")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        if state.discovering {
                            HStack {
                                ProgressView()
                                Text("Discovering services…")
                            }
                        }
                        ForEach(state.services, id: \.uuid) { service in
                            ServiceSection(service: service, values: state.values, onRead: onRead)
                        }
                    }
                    .padding()
                }
                .navigationTitle("Device")
                .navigationBarTitleDisplayMode(.inline)
            }
        }

        // One service: its UUID, then each characteristic with its properties, a Read button if it has
        // the Read property, and what the last read gave: the value, or why it failed.
        private struct ServiceSection: View {
            let service: DeviceService
            let values: [Characteristic: String]
            let onRead: (Characteristic) -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Service \(service.uuid)")
                        .font(.caption.monospaced().bold())
                    ForEach(service.characteristics, id: \.self) { characteristic in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(characteristic.uuid)
                                .font(.caption.monospaced())
                            HStack {
                                Text(characteristic.properties.map(\.label).joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                if characteristic.properties.contains(.read) {
                                    Button("Read") { onRead(characteristic) }
                                        .buttonStyle(.bordered)
                                }
                            }
                            if let value = values[characteristic] {
                                Text(value)
                            }
                        }
                        .padding(.leading, 12)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
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
                    bleConnection: LinkedBleConnection(link: IosBleConnection())
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
            private let discoveringRow = UIStackView()
            private let servicesStack = UIStackView()

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
                let discoveringSpinner = UIActivityIndicatorView(style: .medium)
                discoveringSpinner.startAnimating()
                let discoveringLabel = UILabel()
                discoveringLabel.text = "Discovering services…"
                discoveringRow.addArrangedSubview(discoveringSpinner)
                discoveringRow.addArrangedSubview(discoveringLabel)
                discoveringRow.spacing = 8
                servicesStack.axis = .vertical
                servicesStack.spacing = 8
                let stack = UIStackView(arrangedSubviews: [
                    icon, nameLabel, idLabel, rssiLabel, statusRow, connectButton, discoveringRow, servicesStack,
                ])
                stack.axis = .vertical
                stack.alignment = .center
                stack.spacing = 12
                stack.translatesAutoresizingMaskIntoConstraints = false
                // Scrolls once the services are listed: they don't fit on one screen.
                let scrollView = UIScrollView()
                scrollView.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(scrollView)
                scrollView.addSubview(stack)
                let content = scrollView.contentLayoutGuide
                NSLayoutConstraint.activate([
                    scrollView.topAnchor.constraint(equalTo: view.topAnchor),
                    scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                    scrollView.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
                    scrollView.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
                    stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 12),
                    stack.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -12),
                    stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
                    stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
                    stack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
                    connectButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
                    servicesStack.widthAnchor.constraint(equalTo: stack.widthAnchor),
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
                discoveringRow.isHidden = !state.discovering
                renderServices(state.services, values: state.values)
                renderError(state.errorMessage)
            }

            // Rebuilt from the state each time: a handful of rows, so no table. One block per service:
            // its UUID, then each characteristic with its properties, a Read button if it has the Read
            // property, and what the last read gave: the value, or why it failed.
            private func renderServices(_ services: [DeviceService], values: [Characteristic: String]) {
                servicesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
                for service in services {
                    let header = UILabel()
                    header.text = "Service \(service.uuid)"
                    header.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
                    header.numberOfLines = 0
                    servicesStack.addArrangedSubview(header)
                    for characteristic in service.characteristics {
                        let uuidLabel = UILabel()
                        uuidLabel.text = characteristic.uuid
                        uuidLabel.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
                        uuidLabel.numberOfLines = 0
                        let propertiesLabel = UILabel()
                        propertiesLabel.text = characteristic.properties.map(\.label).joined(separator: " · ")
                        propertiesLabel.font = .preferredFont(forTextStyle: .caption1)
                        propertiesLabel.textColor = .secondaryLabel
                        let row = UIStackView(arrangedSubviews: [propertiesLabel])
                        row.alignment = .center
                        if characteristic.properties.contains(.read) {
                            let readButton = UIButton(configuration: .bordered())
                            readButton.configuration?.title = "Read"
                            readButton.addAction(UIAction { [weak self] _ in
                                self?.viewModel.read(characteristic: characteristic)
                            }, for: .touchUpInside)
                            readButton.setContentHuggingPriority(.required, for: .horizontal) // the label takes the room
                            row.addArrangedSubview(readButton)
                        }
                        var lines: [UIView] = [uuidLabel, row]
                        if let value = values[characteristic] {
                            let valueLabel = UILabel()
                            valueLabel.text = value
                            valueLabel.numberOfLines = 0
                            lines.append(valueLabel)
                        }
                        let block = UIStackView(arrangedSubviews: lines)
                        block.axis = .vertical
                        block.spacing = 4
                        block.isLayoutMarginsRelativeArrangement = true
                        block.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 0)
                        servicesStack.addArrangedSubview(block)
                    }
                }
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
Ví dụ có output ở A3 và A4 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0). A3 chạy **đúng code** `ValueDecoder.kt`, `Uuids.kt` và `DeviceService.kt` của bài (chỉ đổi tên package). A4 là mô hình: radio là giả, không có Bluetooth thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-kham-pha-nhu-hoi-muc-luc-mot-cuon-sach): khám phá service như hỏi mục lục một cuốn sách, Android cạnh iOS (mục 1, 6).
    3. [A3](#a3-giai-ma-byte-chay-that-bang-code-cua-bai): giải mã byte, chạy thật bằng code của bài: byte có dấu, little endian, UUID, bit property (mục 2, 3).
    4. [A4](#a4-moi-lan-mot-request-mutex-chay-that): mỗi lần một request, `Mutex` chạy thật (mục 4, 5).
    5. [A5](#a5-ios-hai-nua-cua-mot-adapter): iOS: vì sao adapter chia hai nửa Kotlin + Swift (mục 6).
    6. [A6](#a6-hai-delegate-va-cai-bay-im-lang): hai delegate và cái bẫy im lặng (mục 7).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Kết nối xong, điện thoại vẫn chưa biết thiết bị có gì: nó phải **khám phá** (discover) các service và characteristic. Android hỏi một lần; iOS hỏi hai vòng lồng nhau.
    2. Mỗi characteristic có **property** (read, write, notify…); app chỉ đọc cái có Read.
    3. Đọc trả về **byte**. Byte nghĩa là gì là quy tắc của app, nên `ValueDecoder` nằm trong app core: pin là `uint8` phần trăm, nhiệt độ là `sint16` little endian theo phần trăm độ.
    4. `SessionService` giữ bốn luật: chỉ trên liên kết đã kết nối, chỉ thứ đọc được, **mỗi lần một request** (`Mutex`), khám phá thất bại thì ngắt kết nối.
    5. iOS: adapter chia đôi, nửa Kotlin implement port, nửa Swift làm việc radio; và **delegate của peripheral** là một tham chiếu weak riêng, quên gán là request chờ mãi không báo lỗi.

Ví dụ đời thường cho cả bài: thiết bị BLE là **một cuốn sách lạ**. Kết nối là mở bìa. Khám phá là đọc **mục lục**: các chương (service), các mục trong chương (characteristic), và mỗi mục ghi "được đọc / được viết / báo khi có thay đổi" (property). Đọc một mục cho bạn một dãy ký hiệu (byte); bạn cần **bảng tra** (GSS) để biết "52" ở mục Pin nghĩa là 82 %. Và chỉ một người được lật sách một lúc (mỗi lần một request).

| Chữ trong bài | Nói đơn giản | Trong m10 là |
|---|---|---|
| service discovery | hỏi thiết bị nó có những service nào | `discoverServices()` / `discoverServices(nil)` |
| characteristic | một giá trị trên thiết bị, có UUID và property | `Characteristic(serviceUuid, uuid, properties)` |
| property | thứ central được làm với giá trị | `CharacteristicProperty.Read`, `Notify`… |
| `DeviceService` | service **của thiết bị**, khác service của app core | 4 service trên thiết bị giả lập |
| GSS | bảng tra định dạng byte của Bluetooth SIG | Battery Level, Temperature, các chuỗi |
| little endian | byte đầu tiên là byte thấp | `66 08` = `0x0866` |
| `and 0xFF` | bỏ dấu, giữ 8 bit thiết bị gửi | `0xC8` → 200, không phải −56 |
| `Mutex` | khoá cho coroutine, treo chứ không chặn thread | `requests.withLock { … }` |
| `suspendCancellableCoroutine` | biến một callback thành một hàm suspend | `LinkedBleConnection.discoverServices` |
| `CBPeripheralDelegate` | nơi iOS gửi câu trả lời khám phá và đọc; **weak** | `IosBleConnection` |

### A2. Khám phá như hỏi mục lục một cuốn sách

Giải thích thêm cho [mục 1](#1-tren-mot-thiet-bi-a-ket-noi-co-gi) và [mục 6](#6-ios-mot-cach-chia-moi-va-hai-lan-kham-pha-long-nhau).

| | Android | iOS |
|---|---|---|
| Hỏi mục lục | `gatt.discoverServices()`: **một** lần, ra cả chương lẫn mục | `peripheral.discoverServices(nil)`: chỉ ra các **chương** |
| Câu trả lời tới ở | `onServicesDiscovered(gatt, status)` | `peripheral(_:didDiscoverServices:)` |
| Lấy kết quả từ | `gatt.services` | `peripheral.services` |
| Hỏi các mục | (đã có sẵn) | `discoverCharacteristics(nil, for: service)` **mỗi chương một lần** |
| Biết khi nào xong | khi `onServicesDiscovered` tới | khi `didDiscoverCharacteristicsFor` tới đủ số chương (`servicesLeft` về 0) |
| 4 service tốn | 1 request | 5 request |
| Đọc một giá trị | `readCharacteristic(c)` → `onCharacteristicRead` | `readValue(for: c)` → `didUpdateValueFor` |

So với TS/JS: Android giống `await fetch("/toc?depth=all")`; iOS giống `const chapters = await fetch("/toc")` rồi `await Promise.all(chapters.map(c => fetch(`/toc/${c}`)))`. Chỉ khác ở chỗ iOS không trả `Promise`, mà gọi lại delegate, nên adapter phải tự đếm khi nào xong.

### A3. Giải mã byte, chạy thật bằng code của bài

Giải thích thêm cho [mục 2](#2-tu-ngu-cua-app-va-port-lon-them) và [mục 3](#3-byte-uoc-giai-ma-trong-app-core). Chương trình dưới gọi đúng `ValueDecoder.decode`, `fullUuid` và `propertiesOf` của bài với vài dãy byte:

```kotlin title="l15/Main.kt (chạy code của bài, không có trong app)"
fun bytes(vararg b: Int) = ByteArray(b.size) { b[it].toByte() }

fun main() {
    val b = 0xC8.toByte()
    println("0xC8.toByte()            = $b")
    println("b.toInt()                = ${b.toInt()}")
    println("b.toInt() and 0xFF       = ${b.toInt() and 0xFF}")

    val t = ValueDecoder.TEMPERATURE
    val cases = listOf(
        "Battery 52" to (ValueDecoder.BATTERY_LEVEL to bytes(0x52)),
        "Battery C8" to (ValueDecoder.BATTERY_LEVEL to bytes(0xC8)),
        "Temp 66 08" to (t to bytes(0x66, 0x08)),
        "Temp F3 FD" to (t to bytes(0xF3, 0xFD)),
        "Temp FD F3" to (t to bytes(0xFD, 0xF3)),
        "Temp E7 FF" to (t to bytes(0xE7, 0xFF)),
        "Temp 00 80" to (t to bytes(0x00, 0x80)),
        "Model SIM-01" to (ValueDecoder.MODEL_NUMBER to "SIM-01".encodeToByteArray()),
        "Custom" to ("DB7A0105-0000-0000-0000-000000000001" to bytes(1, 2, 3, 4)),
    )
    for ((name, c) in cases) println("%-13s -> %s".format(name, ValueDecoder.decode(c.first, c.second)))

    listOf("180f", "2A19", "0000180f-0000-1000-8000-00805f9b34fb").forEach { println("%-38s -> %s".format(it, fullUuid(it))) }

    listOf(0x02, 0x12, 0x1A, 0x40 or 0x02).forEach { bits ->
        println("0x%02X -> %s".format(bits, propertiesOf(bits).joinToString(" · ") { it.label }))
    }
}
```

Output thật (đã bỏ các dòng tiêu đề):

```text
0xC8.toByte()            = -56
b.toInt()                = -56
b.toInt() and 0xFF       = 200
Battery 52    -> 82 %
Battery C8    -> C8
Temp 66 08    -> 21.50 °C
Temp F3 FD    -> -5.25 °C
Temp FD F3    -> -30.75 °C
Temp E7 FF    -> -0.25 °C
Temp 00 80    -> not known
Model SIM-01  -> SIM-01
Custom        -> 01 02 03 04
180f                                   -> 0000180F-0000-1000-8000-00805F9B34FB
2A19                                   -> 00002A19-0000-1000-8000-00805F9B34FB
0000180f-0000-1000-8000-00805f9b34fb   -> 0000180F-0000-1000-8000-00805F9B34FB
0x02 -> read
0x12 -> read · notify
0x1A -> read · write · notify
0x42 -> read
```

1. **Byte có dấu.** `0xC8` (200) vào Kotlin thành −56; `and 0xFF` lấy lại 200. Pin 200 % nằm ngoài 0–100 nên bộ giải mã trả `null` và hiện hex `C8`, không crash.
2. **Little endian.** `66 08` là 21,50 °C, nhưng đảo thành `FD F3` thì ra −30,75 °C thay vì −5,25 °C: cùng byte, khác thứ tự, khác hẳn con số.
3. **Dấu của số âm nhỏ.** `E7 FF` là −25 phần trăm độ; code lấy dấu trước nên in "-0.25 °C", không mất dấu như `-25 / 100 = 0`.
4. **UUID.** Dạng ngắn của iOS và dạng dài chữ thường của Android đều thành cùng một chuỗi dài chữ hoa, nên so sánh trong app core luôn đúng.
5. **Bit property.** `0x40` (signed write) không có trong enum nên bị bỏ qua: `0x42` chỉ còn "read".

So với TS/JS: `new Uint8Array([0xC8])[0]` là 200 sẵn, và `new DataView(buf).getInt16(0, true)` đọc `sint16` little endian. Kotlin không có `DataView` trong code chung, nên bài tự ghép `(high shl 8) or low`.

### A4. Mỗi lần một request, `Mutex` chạy thật

Giải thích thêm cho [mục 4](#4-session-service-giu-cac-quy-tac) và [mục 5](#5-android-mot-lan-kham-pha-moi-lan-mot-request). Mô hình radio Android: một cờ `busy` như `mDeviceBusy`, từ chối request thứ hai khi request đầu chưa có câu trả lời. Hai lần đọc gửi cùng lúc, không khoá và có `Mutex`:

```kotlin title="L15Mutex.kt (mô hình, không có trong app)"
class BusyRadio {
    private var busy = false
    suspend fun read(name: String): String {
        if (busy) return "$name: bị từ chối (đang bận)"
        busy = true
        delay(100)
        busy = false
        return "$name: OK"
    }
}

suspend fun twoReads(lock: Mutex?): List<String> = coroutineScope {
    val radio = BusyRadio()
    suspend fun send(name: String) = if (lock == null) radio.read(name) else lock.withLock { radio.read(name) }
    listOf(async { send("Battery") }, async { send("Temperature") }).awaitAll()
}

fun main() = runTest {
    println("không khoá: ${twoReads(null)}   t=${currentTime} ms")
    val start = currentTime
    println("có Mutex:   ${twoReads(Mutex())}   +${currentTime - start} ms")
}
```

Output thật:

```text
không khoá: [Battery: OK, Temperature: bị từ chối (đang bận)]   t=100 ms
có Mutex:   [Battery: OK, Temperature: OK]   +200 ms
```

1. **Không khoá**: lần đọc thứ hai đụng cờ bận và bị từ chối, đúng chuyện `readCharacteristic` trả `false` trên Android thật.
2. **Có `Mutex`**: lần thứ hai **treo** ở `withLock` cho tới khi lần đầu xong, rồi mới gửi. Tổng thời gian 200 ms (ảo) thay vì 100 ms: đổi một chút thời gian lấy việc không bao giờ bị từ chối.
3. **Treo, không chặn.** `withLock` không giữ thread nào; main thread vẫn vẽ UI trong lúc chờ.

So với TS/JS: giống một hàng đợi promise `queue = queue.then(() => read(c))`, chỉ cho một việc chạy một lúc.

### A5. iOS: hai nửa của một adapter

Giải thích thêm cho [mục 6](#6-ios-mot-cach-chia-moi-va-hai-lan-kham-pha-long-nhau).

| | Bài 14 | Bài 15 |
|---|---|---|
| Ai implement `BleConnection` | class Swift `IosBleConnection` | class Kotlin `LinkedBleConnection` (trong `iosMain`) |
| Swift làm gì | mọi thứ | chỉ việc radio, qua interface Kotlin `IosLink` |
| Lỗi tới app core dưới dạng | (chưa có request nào ném lỗi) | `ConnectionException`, vì **Kotlin** tạo ra nó |
| Vì sao đổi | | Swift ném lỗi thì Kotlin nhận `ObjCErrorException`; và Swift 6 không cho `@MainActor` gọi `suspend fun` của Kotlin với object không `Sendable` |

Ví dụ đời thường: trước đây **người phiên dịch** (Swift) vừa dịch vừa tự quyết lỗi nào báo ra sao, và báo bằng tiếng của mình nên văn phòng (app core) không hiểu. Giờ **trưởng văn phòng** (nửa Kotlin) cầm hồ sơ, và chỉ nhờ phiên dịch đi hỏi thiết bị rồi chuyển lại câu trả lời; còn câu báo lỗi do trưởng văn phòng tự viết, bằng tiếng của văn phòng.

Đường đi của một lần đọc trên iOS:

1. ViewModel gọi `session.read(c)` → `SessionService` khoá `Mutex` → `LinkedBleConnection.read(c)`.
2. `suspendCancellableCoroutine` treo coroutine, bọc continuation vào một `ValueReply`, gọi `link.read(characteristic, reply)` sang Swift rồi trả về ngay.
3. Swift gọi `peripheral.readValue(for:)`. Sau đó CoreBluetooth gọi `didUpdateValueFor` trên main queue.
4. Swift gọi `reply.read(value:)` hoặc `reply.failed(message:)`. `ValueReply` của nửa Kotlin `resume` coroutine bằng `ByteArray` (chép từ `NSData`) hoặc bằng một `ConnectionException`.
5. `SessionService` nhả khoá, gọi `ValueDecoder.decode`, trả "82 %" về ViewModel.

### A6. Hai delegate và cái bẫy im lặng

Giải thích thêm cho [mục 7](#7-cai-bay-delegate-cua-peripheral).

| | Delegate của `CBCentralManager` | Delegate của `CBPeripheral` |
|---|---|---|
| Nghe gì | kết nối: `didConnect`, `didFailToConnect`, `didDisconnectPeripheral` | khám phá và đọc: `didDiscoverServices`, `didDiscoverCharacteristicsFor`, `didUpdateValueFor` |
| Gán ở đâu | `CBCentralManager(delegate: self, …)` | `peripheral.delegate = self`, ngay khi có peripheral |
| Kiểu tham chiếu | weak | weak |
| Quên gán thì | không nghe được kết nối (bẫy của bài 13) | request **chờ mãi**, không lỗi |

Ví dụ đời thường: delegate là **số điện thoại để gọi lại** bạn ghi trên phiếu. Ghi thiếu số (quên gán), cửa hàng vẫn làm xong việc nhưng không biết gọi ai. Số của một máy đã bị thu hồi (object bị giải phóng, vì weak) cũng vậy. Và mỗi phiếu chỉ có **một** số: ai ghi đè số của mình lên (một view controller tự gán làm delegate) là lấy mất mọi cuộc gọi lại.

So với TS/JS: giống truyền một callback vào một thư viện, nhưng thư viện chỉ giữ `WeakRef` tới object chứa callback. Trong JS hiếm khi gặp; trong CoreBluetooth thì đó là mặc định.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 16.

- [ ] Nói được Android và iOS khám phá service khác nhau ra sao, và một thiết bị 4 service tốn bao nhiêu request trên mỗi nền tảng (xem [A2](#a2-kham-pha-nhu-hoi-muc-luc-mot-cuon-sach)).
- [ ] Phân biệt `DeviceService` (service của thiết bị) với service của app core như `SessionService`.
- [ ] Đổi một UUID ngắn hoặc chữ thường sang dạng `fullUuid`, và biến một số bit thành danh sách property bằng `propertiesOf` (xem [A3](#a3-giai-ma-byte-chay-that-bang-code-cua-bai)).
- [ ] Giải mã bằng tay một Battery Level và một Temperature từ byte hex, kể cả số âm và giá trị `0x8000` (xem [A3](#a3-giai-ma-byte-chay-that-bang-code-cua-bai)).
- [ ] Giải thích vì sao `ValueDecoder` nằm trong app core, không trong adapter hay màn hình.
- [ ] Giải thích bốn luật của `SessionService` trên liên kết đang mở, và vì sao Android cần "mỗi lần một request" (xem [A4](#a4-moi-lan-mot-request-mutex-chay-that)).
- [ ] Biến một callback thành hàm suspend bằng `CompletableDeferred` (Android) và `suspendCancellableCoroutine` (iOS).
- [ ] Giải thích vì sao adapter iOS chia hai nửa, và nửa nào tạo `ConnectionException` (xem [A5](#a5-ios-hai-nua-cua-mot-adapter)).
- [ ] Gán delegate của `CBPeripheral` đúng chỗ, và nói được ba cách cái bẫy delegate làm request chờ mãi (xem [A6](#a6-hai-delegate-va-cai-bay-im-lang)).
- [ ] Hiện danh sách service, property và nút Read trên track của mình, và giữ được chúng qua một lần xoay màn hình.
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.
