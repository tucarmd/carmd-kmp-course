---
source: lessons/11-testing-and-koin.html
source_ref: live
source_sha: 8501d5a
---

<p class="kicker">Bài 11 · Tuần 3 · Ngày 11 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html">Bản gốc tiếng Anh</a></p>

# Kiểm thử app core + Koin

<div class="meta">
  <span class="tag">~2,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m06 nối dây bằng Koin, test xanh trên JVM + iOS</span>
  <span class="tag">Cần trước: <a href="../10-luc-giac/">10</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Bài 10 hứa rằng các port làm app core test được, và hôm nay bạn nhận lời hứa đó. Một test điều khiển scanning service qua inbound port của nó, `DeviceScanning`, đúng như ViewModel làm, với một radio **giả** (fake) nằm sau outbound port mà test điều khiển. Cùng các test đó chạy trên JVM và trên runtime iOS, trong vài mili giây, không cần thiết bị và không cần Bluetooth. Sau đó bạn thay `AppContainer` bằng **Koin**, một DI container cho Kotlin Multiplatform, để cùng một cách nối dây chạy trên Android và iOS. Nó bind mỗi inbound port với service của nó và mỗi outbound port với adapter của nó, nên ở bài 13, thay radio thật vào chỉ là một dòng. Viết theo cách khoá học viết, các binding đó chỉ được kiểm tra lúc chạy, nên có thêm một test kiểm tra cả graph. Đó là milestone **m06**.

!!! info "Nguồn chính"
    Trang [Testing Kotlin coroutines on Android](https://developer.android.com/kotlin/coroutines/test) của Android. Đọc nó trước mục 4: lời khuyên của nó về `runTest` và dispatcher `Main` cũng áp dụng cho `commonTest`, trừ `MainDispatcherRule` của nó. Đó là một rule của JUnit 4, mà JUnit chỉ có trên JVM, nên nó không compile được trong `commonTest`; mục 5 dùng `@BeforeTest` và `@AfterTest` thay vào. Với Koin, trang [Definitions](https://insert-koin.io/docs/reference/koin-core/definitions/) của nó, trước mục 6.

!!! info "Track"
    Mục 1–5 đều nằm trong `shared/`, giống nhau trên mọi track. Koin đổi vài dòng mỗi track: chỗ Koin khởi động và cách màn hình xin ViewModel của nó (mục 7 và 8). App trông và chạy y như m05. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m05

| Cái gì | m05 | m06 |
|---|---|---|
| test | không có | 9 mỗi nền tảng trong `commonTest`: 5 cho scanning service, 3 cho ViewModel, 1 cho graph của Koin; chạy trên JVM và trên iOS simulator |
| composition root | `di/AppContainer.kt`, nối bằng tay | `di/AppModule.kt`, một Koin module, cộng `initKoin()` |
| chỗ Koin khởi động | (không có Koin) | Android: một class `Application` mới; SwiftUI: `App.init`; UIKit: `AppDelegate` |
| cách một màn hình lấy ViewModel | `AppContainer.deviceListViewModelFactory` | `koinViewModel()` · `by viewModel()` · `owner.viewModel()` (iOS, với một factory dựa trên Koin) |
| file | shared: build file, `AppModule.kt` thay `AppContainer.kt`, `ViewModelResolver.kt`, năm file test mới; Android: build file, manifest, một `DeviceMonitorApplication.kt` mới, màn hình danh sách; iOS: `ViewModelOwner.swift`, điểm vào của app, màn hình danh sách |

## 1. Test cắm vào đâu

Bài 10 kể tên hai loại inbound adapter: các ViewModel dùng chung, và các test. Một test chỉ là một bên gọi nữa của inbound port. Nó gọi `DeviceScanning.scan(…)` như ViewModel gọi, nên nó test thứ app *cung cấp*, không phải cách service được viết bên trong. Sau outbound port, nó cắm vào một **fake**: một outbound adapter viết cho test, do test điều khiển. Hướng dẫn kiểm thử của Android định nghĩa fake là "Một test double có một bản cài đặt "chạy được" của class, nhưng được cài đặt theo cách hợp cho test mà không hợp cho production", và thêm: "Fake không cần framework mock và nhẹ. Chúng **được ưu tiên**." ([Use test doubles](https://developer.android.com/training/testing/fundamentals/test-doubles)). Một *test double* là bất kỳ object nào đứng thay một object thật trong test.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 385" role="img" aria-labelledby="l11-seam-title">
      <title id="l11-seam-title">Mỗi test cắm vào đâu. Hàng trên, test của service: ScanningServiceTest, một inbound adapter trong commonTest, gọi inbound port DeviceScanning ở mép app core. Bên trong app core, ScanningService implement DeviceScanning và gọi outbound port BleScanner. FakeBleScanner, một fake trong commonTest, implement BleScanner, và test điều khiển nó trực tiếp bằng hear và failure: test đóng vai radio. Service thật chạy; chỉ radio bị thay. Hàng dưới, test của ViewModel: DeviceListViewModelTest gọi DeviceListViewModel thật, thứ gọi inbound port DeviceScanning. TestDeviceScanning, một bản cài đặt test của inbound port, đứng thay cả app core, và test điều khiển nó bằng find và failure. Mũi tên liền là lời gọi; mũi tên đứt nghĩa là implement.</title>
      <defs><marker id="l11-seam-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small" x="10" y="20" font-weight="600">Test service: service thật, radio giả</text>
      <g data-part="inbound">
        <rect class="box" x="10" y="62" width="150" height="70" rx="6"></rect>
        <text class="mono small" x="20" y="84">ScanningService</text>
        <text class="mono small" x="20" y="99">Test</text>
        <text class="small muted" x="20" y="120">inbound adapter</text>
      </g>
      <g data-part="core">
        <polygon class="box" points="185,105 222,34 538,34 575,105 538,176 222,176"></polygon>
        <text class="title" x="380" y="56" text-anchor="middle">App core</text>
        <rect class="box" x="326" y="83" width="108" height="44" rx="6"></rect>
        <text class="mono small" x="334" y="101">Scanning</text>
        <text class="mono small" x="334" y="116">Service</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="196" y="83" width="112" height="44" rx="6"></rect>
        <text class="mono small" x="204" y="101">DeviceScanning</text>
        <text class="small muted" x="204" y="118">inbound port</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="452" y="83" width="108" height="44" rx="6"></rect>
        <text class="mono small" x="460" y="101">BleScanner</text>
        <text class="small muted" x="460" y="118">outbound port</text>
        <rect class="box" x="600" y="62" width="150" height="70" rx="6"></rect>
        <text class="mono small" x="610" y="84">FakeBleScanner</text>
        <text class="small muted" x="610" y="102">fake, trong commonTest</text>
        <text class="small muted" x="610" y="120">thay cho radio</text>
      </g>
      <path class="edge" d="M160,105 L194,105" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge dashed" d="M326,105 L310,105" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge" d="M434,105 L450,105" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge dashed" d="M600,105 L562,105" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge" d="M85,132 L85,196 L675,196 L675,134" marker-end="url(#l11-seam-arrow)"></path>
      <text class="small" x="230" y="214">hear(…) · failure: test đóng vai radio</text>
      <text class="small" x="10" y="248" font-weight="600">Test ViewModel: ViewModel thật, app core bị thay</text>
      <g data-part="inbound">
        <rect class="box" x="10" y="262" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="20" y="284">DeviceListViewModel</text>
        <text class="mono small" x="20" y="299">Test</text>
        <rect class="box" x="200" y="262" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="210" y="284">DeviceListViewModel</text>
        <text class="small muted" x="210" y="304">inbound adapter</text>
        <rect class="box" x="400" y="270" width="120" height="44" rx="6"></rect>
        <text class="mono small" x="408" y="288">DeviceScanning</text>
        <text class="small muted" x="408" y="305">inbound port</text>
      </g>
      <g data-part="core">
        <rect class="box" x="600" y="262" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="610" y="284">TestDeviceScanning</text>
        <text class="small muted" x="610" y="304">thay cho app core</text>
      </g>
      <path class="edge" d="M160,292 L198,292" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge" d="M350,292 L398,292" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge dashed" d="M600,292 L522,292" marker-end="url(#l11-seam-arrow)"></path>
      <path class="edge" d="M85,322 L85,350 L675,350 L675,324" marker-end="url(#l11-seam-arrow)"></path>
      <text class="small" x="290" y="368">find(…) · failure: test quyết định lần quét tìm thấy gì</text>
    </svg>
    <figcaption>Mỗi test chỉ thay thứ nằm ngoài đoạn code nó test, và với tới nó qua một port. Mũi tên liền là lời gọi; mũi tên đứt nghĩa là "implement".
<ul class="legend">
    <li data-part="core">App core</li>
    <li data-part="inbound">Inbound (port và adapter)</li>
    <li data-part="outbound">Outbound (port và adapter)</li>
  </ul>
</figcaption>
  </figure>

1. **Test service** giữ `ScanningService` thật và chỉ thay radio. Nó test quy tắc của app, "mỗi thiết bị một lần, tên chứa bộ lọc", phần mà bạn ghét làm hỏng nhất.
2. **Test ViewModel** giữ ViewModel thật và thay cả app core bằng `TestDeviceScanning`, một bản cài đặt test của inbound port. Khoá học gọi nó như vậy, không gọi là fake: một fake đứng thay thế giới bên ngoài sau một outbound port, còn cái này đứng thay phần bên trong. Nhờ vậy test ViewModel chỉ fail khi ViewModel sai, không bao giờ vì quy tắc của service.
3. **Không dùng thư viện mock.** Cả hai double là class bình thường implement một port, mỗi cái dưới hai mươi dòng, viết trong `commonTest`, nên chúng không bao giờ được đóng gói vào app nào.

## 2. Chuẩn bị `commonTest`

Test trong `commonTest` được viết một lần và chạy trên mọi target. Tài liệu Kotlin: "Với lựa chọn `android`, test được chạy bằng JUnit 4", và với `iosSimulatorArm64`, compiler "tạo một test binary được chạy bởi test runner riêng của Kotlin/Native" ([Test your multiplatform app](https://kotlinlang.org/docs/multiplatform/multiplatform-run-tests.html)). Build file của phần dùng chung thêm một dòng và ba dependency cho test:

```kotlin title="shared/build.gradle.kts" hl_lines="5 13 14 15"
kotlin {
    android {
        namespace = "com.example.devicemonitor.shared"
⋯ compileSdk, minSdk: as in m05
        withHostTest {}
    }
⋯ the iOS framework: as in m05
    sourceSets {
        commonMain.dependencies {
⋯ lifecycle-viewmodel, coroutines: as in m05; Koin, section 7
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
            implementation("app.cash.turbine:turbine:1.2.1")
        }
    }
}
```

1. **`withHostTest {}`** bật các host test (JVM) của Android: "Mặc định, plugin mới tắt các test phía host (unit) và phía thiết bị (instrumented) của Android" ([Android-KMP plugin](https://developer.android.com/kotlin/multiplatform/plugin)). Xem gotcha bên dưới để biết chuyện gì xảy ra khi thiếu nó.
2. **`kotlin("test")`** cho bạn `@Test`, `@BeforeTest` và `assertEquals`, ánh xạ sang JUnit trên JVM và sang runner của Kotlin/Native trên iOS.
3. **`kotlinx-coroutines-test`** (cùng version với coroutines) mang tới `runTest`, các test dispatcher và thời gian ảo. **Turbine** là "một thư viện test nhỏ cho `Flow` của kotlinx.coroutines" ([Turbine](https://github.com/cashapp/turbine)). Cả ba là dependency của `commonTest`, nên chúng không lọt vào app.

!!! warning "Gotcha · xanh, nhưng một nửa số test chưa từng chạy"
    Chúng tôi xoá `withHostTest {}` và chạy `./gradlew :shared:allTests`. Nó in `BUILD SUCCESSFUL`, và task test duy nhất nó chạy là `iosSimulatorArm64Test`. Task Android không tồn tại (`task 'testAndroidHostTest' not found` khi gọi đích danh). Dấu hiệu duy nhất là một dòng gần đầu output: `WARNING: The 'commonTest' source directory exists, but android host tests are not enabled.` Một build xanh cho bạn biết không có gì fail, không phải là có gì đó đã chạy. Kiểm tra danh sách task hoặc các report một lần, để biết chắc cả hai nền tảng thật sự chạy.

## 3. Radio giả

Fake implement outbound port, và test đóng vai radio:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleScanner.kt" hl_lines="5 6 12 15 21"
package com.example.devicemonitor.doubles
⋯ imports: core.Device, core.ScanException, core.outbound.BleScanner, Channel, Flow helpers
// Fake: an outbound adapter written for tests, behind the BleScanner port. The test plays
// the radio: it decides what is heard and when, and whether the radio fails.
class FakeBleScanner : BleScanner {
    private val heard = Channel<Device>(Channel.UNLIMITED)
    var failure: ScanException? = null
    var isScanning = false
        private set

    override fun scan(): Flow<Device> = flow {
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

1. **`hear(…)` đưa thiết bị vào một `Channel`**, và scan flow trao chúng cho bên đang collect, theo thứ tự. `UNLIMITED` nghĩa là `trySend` không bao giờ phải chờ và không bao giờ đánh rơi, nên một thiết bị được nghe thấy trước khi bên collect sẵn sàng sẽ không bị mất.
2. **Flow không bao giờ tự kết thúc**, giống của một radio thật: `emitAll` cứ chờ thiết bị tiếp theo cho tới khi bên collect huỷ. Đó là hợp đồng của `BleScanner` từ bài 10.
3. **`failure`** làm lần quét tiếp theo ném lỗi. Đây là chỗ bộ lọc `"fail"` của m04 chuyển tới: lỗi là thứ radio làm, nên radio giả làm nó theo lệnh.
4. **`isScanning`** là `true` khi một lần quét đang chạy. Khối `finally` chạy khi bên collect huỷ, nên một test kiểm tra được rằng huỷ lần quét thật sự dừng radio.
5. Nó nằm trong package `doubles` dưới `commonTest`, cạnh `TestDeviceScanning` (mục 5).

## 4. Test service qua inbound port của nó

Test dựng service với fake, và từ đó trở đi chỉ thấy port:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/ScanningServiceTest.kt" hl_lines="9 13 14 18"
class ScanningServiceTest {
    private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
    private val heart = Device(id = "02", name = "Heart Rate Monitor", rssi = -61)
    private val scale = Device(id = "03", name = "Smart Scale", rssi = -85)

    private val radio = FakeBleScanner()

    // The test drives the app core the way the ViewModel does: through the inbound port.
    private val scanning: DeviceScanning = ScanningService(radio)

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
⋯ four more tests, below
}
```

1. **`private val scanning: DeviceScanning`**: kiểu được khai báo là inbound port. Dòng duy nhất gọi tên `ScanningService` là dòng dựng nó; mọi test sau đó được viết dựa trên thứ app cung cấp. Nếu sau này bạn tách service làm hai, các test không đổi.
2. **`runTest`** chạy thân test kiểu suspend trên một test dispatcher có **đồng hồ ảo**: nó "sẽ tự động bỏ qua mọi delay" ([Testing coroutines](https://developer.android.com/kotlin/coroutines/test)).
3. **`flow.test { … }`** (Turbine) collect flow trong lúc khối chạy. `awaitItem()` treo cho tới khi thiết bị tiếp theo tới. Turbine áp "một timeout theo thời gian đồng hồ thật, bỏ qua thời gian ảo của `runTest`", mặc định ba giây, nên một thiết bị không bao giờ tới sẽ làm test fail thay vì treo nó.
4. **Cuối khối kiểm tra những gì bạn không nói.** "Khi khối kiểm tra xong, `test` huỷ coroutine và gọi `ensureAllEventsConsumed()`". Nên nếu service báo `obd` hai lần, item thừa sẽ làm test fail dù không dòng nào hỏi về nó. Huỷ cũng là cách lần quét kết thúc: flow không bao giờ tự xong, y như một lần quét thật.
5. **Tên test mô tả hành vi**, nên một lần fail đọc lên như một quy tắc bị phá: "reportsEachDeviceOnceAsSoonAsItIsHeard FAILED".

Bốn test còn lại, mỗi test giữ một lời hứa trong comment của port:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/ScanningServiceTest.kt" hl_lines="1 8 10 13 17 20"
    fun keepsOnlyNamesContainingTheFilterIgnoringCaseAndSpaces() = runTest {
        scanning.scan(nameFilter = "  MONITOR ").test {
            radio.hear(obd, heart, scale)
            assertEquals(heart, awaitItem())
        }
    }
⋯ eachScanStartsWithNothingSeen: two scans in a row, each hears obd and reports it
    fun scansUntilTheCollectorCancelsThenStopsTheRadio() = runTest {
        val collector = launch { scanning.scan(nameFilter = "").collect {} }
        testScheduler.advanceTimeBy(1.hours) // an hour of virtual time, with nothing heard
        assertTrue(radio.isScanning)

        collector.cancelAndJoin()
        assertFalse(radio.isScanning)
    }

    fun aRadioFailureReachesTheCaller() = runTest {
        radio.failure = ScanException("Bluetooth is off")
        scanning.scan(nameFilter = "").test {
            val error = awaitError()
            assertIs<ScanException>(error)
            assertEquals("Bluetooth is off", error.message)
        }
    }
```

1. **Test bộ lọc** truyền dấu cách và chữ hoa. Chỉ `heart` đi ra, và lần kiểm tra cuối khối của Turbine chứng minh không có gì khác đi ra.
2. **`eachScanStartsWithNothingSeen`** chạy hai lần quét trên cùng một service. Đó là câu hỏi ôn của bài 10 biến thành code: nếu `seen` là một property, lần quét thứ hai sẽ không báo gì.
3. **Một giờ trong chớp mắt.** `advanceTimeBy` "Tua thời gian ảo đi một lượng cho trước và chạy mọi coroutine được hẹn chạy trước thời điểm đó trong thời gian ảo". Một giờ radio im lặng trôi qua tức thì, và lần quét vẫn đang chạy: service không bao giờ tự dừng một lần quét. Sau đó huỷ bên collect thì chạy `finally` của fake, nên radio dừng. Đó là "huỷ bên collect thì dừng nó", đã được chứng minh.
4. **`awaitError()`** treo cho tới khi flow fail, và trả về exception. `ScanException` của radio đi qua service không đổi, đúng thứ mà `catch` của ViewModel dựa vào.

## 5. Test ViewModel dựa trên inbound port

Test ViewModel cần một thứ implement `DeviceScanning` và làm đúng điều test bảo:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestDeviceScanning.kt" hl_lines="4 7 15"
⋯ package com.example.devicemonitor.doubles and imports
// Test implementation of the DeviceScanning inbound port. It stands in for the whole app
// core, so a ViewModel test tests the ViewModel only. The test decides what a scan finds.
class TestDeviceScanning : DeviceScanning {
    private val found = Channel<Device>(Channel.UNLIMITED)
    var failure: ScanException? = null
    val filters = mutableListOf<String>() // one entry per scan started

    override fun scan(nameFilter: String): Flow<Device> = flow {
        filters += nameFilter
        failure?.let { throw it }
        emitAll(found.receiveAsFlow())
    }

    fun find(vararg devices: Device) {
        devices.forEach { found.trySend(it) }
    }
}
```

Nó trông giống radio giả, nhưng nó nói ngôn ngữ của inbound port: bất cứ thứ gì `find(…)` nhận được đã được lọc sẵn và đã duy nhất, vì đó là điều `DeviceScanning` hứa. `filters` ghi lại mỗi lần quét ViewModel bắt đầu và bộ lọc nó truyền. Giờ là test:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt" hl_lines="1 4 11 12 17"
@OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain, currentTime
class DeviceListViewModelTest {
⋯ obd, heart
    private val scanning = TestDeviceScanning()
    private lateinit var viewModel: DeviceListViewModel

    @BeforeTest
    fun setUp() {
        // viewModelScope runs on Dispatchers.Main. In a test, Main becomes a test
        // dispatcher whose clock runTest controls, so delays and timeouts take no real time.
        Dispatchers.setMain(StandardTestDispatcher())
        viewModel = DeviceListViewModel(scanning)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }
⋯ three tests, below
}
```

1. **`Dispatchers.setMain(StandardTestDispatcher())`**. `viewModelScope` chạy trên `Dispatchers.Main`, và trên một JVM cục bộ "dispatcher `Main` bọc UI thread của Android sẽ không có". Quy tắc của Android: "Dispatcher `Main` nên được thay bằng một `TestDispatcher` trong các unit test cục bộ" ([Testing coroutines](https://developer.android.com/kotlin/coroutines/test)). `resetMain()` trong `@AfterTest` trả nó về như cũ.
2. **Trong `@BeforeTest`, không phải trong một property.** "Nếu bạn tạo một `TestDispatcher` làm property của class test, nó sẽ không lấy scheduler từ dispatcher `Main`, vì dispatcher `Main` chỉ được thay trước khi mỗi hàm test chạy."
3. **Một đồng hồ cho mọi thứ.** "Nếu dispatcher `Main` đã được thay bằng một `TestDispatcher`, mọi `TestDispatcher` mới tạo sẽ tự động dùng scheduler của dispatcher `Main`, kể cả `StandardTestDispatcher` do `runTest` tạo". Nên coroutine của ViewModel, `withTimeoutOrNull(3.seconds)` của nó và thân test dùng chung một đồng hồ ảo.
4. **`@OptIn`**: `setMain`, `resetMain` và `currentTime` được đánh dấu experimental. Không có opt-in, mỗi lần dùng in một cảnh báo `w: This declaration needs opt-in`, phá luật không-cảnh-báo của khoá học. Nên class opt-in một lần, kèm comment nói vì sao.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt" hl_lines="6 9 16 17"
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

            // Nothing else is found: 3 s of virtual time pass, and the timeout ends the scan.
            assertEquals(ScanState.Finished(listOf(obd, heart)), awaitItem().scan)
            assertEquals(DeviceListViewModel.SCAN_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
        }
    }
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt" hl_lines="4 6 9"
⋯ aFailedScanBecomesAMessageUntilItIsShown: failure set, Idle + "Bluetooth is off", then errorShown() clears it
    @Test
    fun ignoresStartScanWhileAScanIsRunning() = runTest {
        viewModel.startScan(filter = "obd")
        testScheduler.runCurrent()
        viewModel.startScan(filter = "heart")
        testScheduler.runCurrent()

        assertEquals(listOf("obd"), scanning.filters)
    }
```

1. **Đọc test đầu tiên như một câu chuyện**: đứng yên; bấm Scan; app core tìm thấy `obd` (một hàng), rồi `heart` (hai hàng); rồi không gì nữa, cho tới khi timeout biến `Scanning` thành `Finished`.
2. **Timeout nổ ngay lập tức.** Khi mọi coroutine đều đang chờ, scheduler đẩy đồng hồ ảo thẳng tới bộ hẹn giờ tiếp theo, timeout 3 giây. Dòng cuối chứng minh nó nổ đúng ở 3000 ms thời gian ảo. Sơ đồ bên dưới cho thấy cú nhảy đó.
3. **`testScheduler.runCurrent()`** "Chạy các coroutine được hẹn ở thời điểm ảo hiện tại", không đẩy đồng hồ. Sau `startScan` đầu tiên, job quét đang chạy, nên lời gọi thứ hai phải bị bỏ qua: `filters` chỉ chứa `"obd"`. Nó cũng cho thấy ViewModel truyền bộ lọc đi nguyên như được gõ. Cắt khoảng trắng là quy tắc của service, đã test ở mục 4.
4. **Test lỗi** là quy tắc "lỗi là state" của bài 08: một lần quét thất bại trở thành `Idle` cộng một thông báo, và `errorShown()` xoá nó. Nó dùng `skipItems(1)` để bỏ qua các state nó không quan tâm.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 175" role="img" aria-labelledby="l11-clock-title">
      <title id="l11-clock-title">Test ViewModel đầu tiên trên đồng hồ ảo. Ở 0 mili giây thời gian ảo lần lượt có các state Idle, Scanning không có thiết bị, Scanning có obd, và Scanning có obd và heart. Rồi mọi coroutine đều đang chờ, nên test scheduler nhảy đồng hồ thẳng tới bộ hẹn giờ tiếp theo, timeout của lần quét ở 3000 mili giây, nơi state thành Finished có obd và heart. Cả test mất vài mili giây thời gian thật.</title>
      <defs><marker id="l11-clock-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small" x="20" y="20" font-weight="600">thời gian ảo</text>
      <line class="axis" x1="60" y1="110" x2="720" y2="110"></line>
      <text class="small muted" x="52" y="132">0 ms</text>
      <text class="small muted" x="690" y="132">3000 ms</text>
      <circle class="dot" cx="70" cy="110" r="6"></circle>
      <circle class="dot" cx="70" cy="92" r="6"></circle>
      <circle class="dot" cx="70" cy="74" r="6"></circle>
      <circle class="dot" cx="70" cy="56" r="6"></circle>
      <text class="mono small" x="84" y="114">Idle</text>
      <text class="mono small" x="84" y="96">Scanning([])</text>
      <text class="mono small" x="84" y="78">Scanning([obd])</text>
      <text class="mono small" x="84" y="60">Scanning([obd, heart])</text>
      <circle class="dot" cx="710" cy="110" r="6"></circle>
      <text class="mono small" x="696" y="104" text-anchor="end">Finished([obd, heart])</text>
      <path class="edge dashed" d="M250,48 Q560,0 708,100" marker-end="url(#l11-clock-arrow)"></path>
      <text class="small" x="330" y="22">không gì chạy được: đồng hồ nhảy tới timeout</text>
      <text class="small muted" x="20" y="162">Thời gian thật cho cả test: vài mili giây. Timeout 3 giây của riêng Turbine tính theo thời gian thật, nên nó không bao giờ nổ ở đây.</text>
    </svg>
    <figcaption>Mọi thứ xảy ra ở 0 ms cho tới khi không gì chạy được nữa; rồi scheduler nhảy tới bộ hẹn giờ tiếp theo.</figcaption>
  </figure>

### Chạy chúng ở mọi nơi

```text
./gradlew :shared:allTests
```

Lệnh đó chạy `testAndroidHostTest` (JVM) và `iosSimulatorArm64Test` (test binary của Kotlin/Native, cần runtime simulator của Xcode). Report nằm trong `shared/build/reports/tests/`, và kết quả thô, mỗi class test một file XML, trong `shared/build/test-results/`. Muốn chạy một nền tảng, gọi task của nó theo tên. Đừng bao giờ thêm `-q` khi kiểm tra cảnh báo: nó giấu các dòng `w:`.

Chúng tôi chạy nó, rồi cố tình làm hỏng code production, mỗi lần một thay đổi, để xem test có nhận ra không:

| Thay đổi trong code production | Test fail, trên JVM và iOS như nhau |
|---|---|
| không có | không có: 9 trên 9 pass trên mỗi nền tảng, dưới một giây |
| trong `ScanningService`, dời `seen` ra khỏi `flow { }` thành một property | `eachScanStartsWithNothingSeen`: "No value produced in 3s" |
| trong `startScan`, xoá `if (scanJob?.isActive == true) return` | `ignoresStartScanWhileAScanIsRunning`: kỳ vọng `[obd]`, thực tế `[obd, heart]` |
| ba thay đổi nữa, để dành cho bài tự làm | bạn sẽ tự biết |

Đây là một phiên bản làm tay của **mutation testing**: nếu bạn phá được một quy tắc mà mọi test vẫn xanh, thì không có gì bảo vệ quy tắc đó. Dòng "No value produced in 3s" là timeout theo đồng hồ thật của Turbine, chỗ duy nhất mà một test fail thật sự tốn vài giây thật.

## 6. Một DI container thêm được gì

`AppContainer` ổn với một màn hình. Trang [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual) của Android liệt kê những gì trục trặc khi app lớn lên: "Bạn phải tự quản lý `AppContainer`, tự tay tạo instance cho mọi dependency", "Vẫn còn rất nhiều code lặp", và bạn tự quản lý scope và vòng đời của mỗi container: "Làm sai có thể dẫn tới bug khó thấy và rò rỉ bộ nhớ trong app." Một **DI container** làm phần sổ sách đó: bạn khai báo một lần mỗi kiểu là gì và dựng ra sao, và container tự tính thứ tự. Lựa chọn của chính Android là Hilt, thứ chỉ có trên Android. [Koin](https://insert-koin.io/) là một thư viện Kotlin Multiplatform: `koin-core` được phát hành cho Android và iOS (và JVM, JS, Wasm cùng các target native khác), nên phần code dùng chung dùng nó. Koin có ba loại definition quan trọng hôm nay:

| Definition | Cho bạn | Của chúng ta |
|---|---|---|
| `single` | "Một instance, giữ suốt vòng đời của Koin container" | `BleScanner` (một radio cho cả app) và service `DeviceScanning` |
| `factory` | "Một instance mới mỗi lần được yêu cầu" | chưa có |
| `viewModel` | "một instance mới mỗi lần yêu cầu, như một `factory`", được giữ bởi `ViewModelStore` của nền tảng | `DeviceListViewModel` |

Trích dẫn: [Definitions](https://insert-koin.io/docs/reference/koin-core/definitions/) và [ViewModel](https://insert-koin.io/docs/reference/koin-core/viewmodel/) của Koin.

**Tiêm vào, không phải tra cứu.** Android đặt DI cạnh **service locator** để so sánh: "Với mẫu service locator, các class nắm quyền và xin object được tiêm vào; với dependency injection, app nắm quyền và chủ động tiêm các object cần thiết." Tra cứu còn giấu thứ một class cần: "Dependency được mã hoá trong phần cài đặt của class, không nằm trên bề mặt API" ([Dependency injection in Android](https://developer.android.com/training/dependency-injection)). Koin làm được cả hai. `KoinComponent` với `get()` là tra cứu, và tài liệu Koin nói "Giữ `KoinComponent` ở các mép", cho "một class mà Koin không tạo" ([KoinComponent](https://insert-koin.io/docs/reference/koin-core/koin-component/)). Quy tắc của khoá học: **constructor ở mọi nơi, tra cứu chỉ ở mép nền tảng.** App core, các ViewModel và các adapter không bao giờ import Koin, và các test ở mục 4–5 không bao giờ dùng nó: chúng gọi constructor.

## 7. Koin module, và chỗ Koin khởi động

Thêm hai thư viện Koin vào `commonMain` của phần code dùng chung, cạnh các thư viện của m05: `implementation("io.insert-koin:koin-core:4.2.2")`, container và DSL của nó, và `implementation("io.insert-koin:koin-core-viewmodel:4.2.2")`, thứ thêm `viewModelOf` cho `ViewModel` đa nền tảng. Rồi xoá `di/AppContainer.kt`, và thêm composition root dưới dạng một Koin module:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="5 6 7 8 12"
package com.example.devicemonitor.di
⋯ imports: the ViewModel, SimulatedBleScanner, ScanningService, both ports, Koin's startKoin, viewModelOf, module
// The composition root, as a Koin module: which service implements each inbound port,
// which adapter implements each outbound port, and how to build each ViewModel.
internal val appModule = module {
    single<BleScanner> { SimulatedBleScanner() }
    single<DeviceScanning> { ScanningService(get()) }
    viewModelOf(::DeviceListViewModel)
}

// Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
fun initKoin() {
    startKoin {
        modules(appModule)
    }
}
```

1. **Đọc mỗi dòng như một binding**, như trong `AppContainer`. `single<BleScanner> { SimulatedBleScanner() }`: "outbound port `BleScanner` nghĩa là adapter này, một cái cho cả app". Bài 13 đổi dòng này.
2. **`single<DeviceScanning> { ScanningService(get()) }`**: "inbound port nghĩa là service này". `get()` xin Koin thứ mà tham số constructor cần, ở đây là một `BleScanner`. Vì type argument là port, ai cũng xin Koin được một `DeviceScanning`, nhưng không ai xin được một `ScanningService`: class đó vẫn ẩn sau port của nó. Một service dùng chung là an toàn vì cùng lý do như ở bài 10: nó không giữ state giữa các lần quét.
3. **`viewModelOf(::DeviceListViewModel)`** nhận một tham chiếu constructor và điền mỗi tham số bằng `get()`, ở đây là port `DeviceScanning`. Bạn không còn phải viết thứ tự: Koin tự tính.
4. **`internal val appModule`**. Với một module public, header iOS phình từ 2.332 lên 3.364 dòng, 197 dòng trong đó gọi tên các class `Koin_core…`, vì Kotlin export mọi kiểu public mà một khai báo public nhắc tới. Swift chỉ cần *khởi động* Koin. `internal` giữ module nhìn thấy được với các test trong cùng Gradle module và ở ngoài header của Swift. Đó cũng là lý do `implementation` là đủ: không kiểu Koin nào nằm trong public API của phần code dùng chung.
5. **`initKoin()`** là điểm vào duy nhất cả hai nền tảng gọi. Chữ ký của nó không có kiểu Koin nào. Koin chỉ khởi động được một lần mỗi process: "Lần gọi thứ hai ném `KoinApplicationAlreadyStartedException`" ([Starting Koin](https://insert-koin.io/docs/reference/koin-core/starting-koin)).

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 335" role="img" aria-labelledby="l11-graph-title">
      <title id="l11-graph-title">Graph của Koin ở m06. Bên trái, các điểm khởi động của nền tảng: trên Android, DeviceMonitorApplication.onCreate; trên iOS, init của App SwiftUI hoặc didFinishLaunching của AppDelegate UIKit. Cả hai gọi initKoin, thứ khởi động Koin với appModule. Trong appModule có ba definition: single BleScanner, dựng thành SimulatedBleScanner, binding outbound; single DeviceScanning, dựng thành ScanningService với get, thứ xin Koin BleScanner; và viewModelOf DeviceListViewModel, mà tham số constructor được Koin điền bằng get, thứ xin DeviceScanning. Bên phải, các màn hình xin ViewModel: koinViewModel trên Compose, by viewModel trên XML, và trên iOS là ViewModelOwner với factory dựa trên Koin của nó. ViewModelStore của màn hình giữ ViewModel. Bên dưới, AppModuleTest xin mọi ViewModel từ một Koin riêng dựng từ cùng appModule, nên một binding bị thiếu làm fail một test thay vì làm hỏng app.</title>
      <defs><marker id="l11-graph-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small" x="10" y="18" font-weight="600">khởi động Koin, một lần</text>
      <g data-part="android">
        <rect class="box" x="10" y="28" width="160" height="50" rx="6"></rect>
        <text class="title small" x="20" y="47">Android</text>
        <text class="mono small" x="20" y="66">Application.onCreate</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="10" y="92" width="160" height="50" rx="6"></rect>
        <text class="title small" x="20" y="111">iOS</text>
        <text class="mono small" x="20" y="130">App.init · AppDelegate</text>
      </g>
      <rect class="box" x="190" y="62" width="82" height="46" rx="6"></rect>
      <text class="mono small" x="198" y="82">initKoin()</text>
      <text class="small muted" x="198" y="98">startKoin</text>
      <path class="edge" d="M170,60 L188,76" marker-end="url(#l11-graph-arrow)"></path>
      <path class="edge" d="M170,110 L188,96" marker-end="url(#l11-graph-arrow)"></path>
      <path class="edge" d="M272,85 L290,85" marker-end="url(#l11-graph-arrow)"></path>
      <rect class="box" x="292" y="20" width="300" height="214" rx="6"></rect>
      <text class="mono small" x="302" y="38">appModule · di/AppModule.kt</text>
      <g data-part="outbound">
        <rect class="box" x="306" y="50" width="272" height="44" rx="6"></rect>
        <text class="mono small" x="316" y="68">single&lt;BleScanner&gt;</text>
        <text class="mono small" x="316" y="84">  { SimulatedBleScanner() }</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="306" y="116" width="272" height="44" rx="6"></rect>
        <text class="mono small" x="316" y="134">single&lt;DeviceScanning&gt;</text>
        <text class="mono small" x="316" y="150">  { ScanningService(get()) }</text>
        <rect class="box" x="306" y="182" width="272" height="44" rx="6"></rect>
        <text class="mono small" x="316" y="200">viewModelOf(</text>
        <text class="mono small" x="316" y="216">  ::DeviceListViewModel)</text>
      </g>
      <path class="edge" d="M540,182 L540,162" marker-end="url(#l11-graph-arrow)"></path>
      <text class="mono small" x="546" y="176">get()</text>
      <path class="edge" d="M540,116 L540,96" marker-end="url(#l11-graph-arrow)"></path>
      <text class="mono small" x="546" y="110">get()</text>
      <text class="small" x="610" y="18" font-weight="600">xin ViewModel</text>
      <g data-part="android">
        <rect class="box" x="610" y="28" width="140" height="44" rx="6"></rect>
        <text class="title small" x="618" y="46">Compose</text>
        <text class="mono small" x="618" y="63">koinViewModel()</text>
        <rect class="box" x="610" y="80" width="140" height="44" rx="6"></rect>
        <text class="title small" x="618" y="98">XML</text>
        <text class="mono small" x="618" y="115">by viewModel()</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="610" y="132" width="140" height="58" rx="6"></rect>
        <text class="title small" x="618" y="150">iOS</text>
        <text class="mono small" x="618" y="166">ViewModelOwner</text>
        <text class="small muted" x="618" y="182">factory dựa trên Koin</text>
      </g>
      <path class="edge" d="M610,52 L580,198" marker-end="url(#l11-graph-arrow)"></path>
      <path class="edge" d="M610,104 L580,202" marker-end="url(#l11-graph-arrow)"></path>
      <path class="edge" d="M610,170 L580,206" marker-end="url(#l11-graph-arrow)"></path>
      <text class="small muted" x="610" y="212">ViewModelStore của màn hình</text>
      <text class="small muted" x="610" y="226">giữ thứ Koin dựng</text>
      <g data-part="inbound">
        <rect class="box" x="292" y="262" width="300" height="44" rx="6"></rect>
        <text class="mono small" x="302" y="280">AppModuleTest</text>
        <text class="small muted" x="302" y="297">một Koin riêng từ appModule: get mọi ViewModel</text>
      </g>
      <path class="edge" d="M442,262 L442,236" marker-end="url(#l11-graph-arrow)"></path>
      <text class="small muted" x="10" y="326">Mỗi get() được giải lúc chạy. Thiếu một dòng vẫn compile, và fail ở lần đầu có thứ xin kiểu đó.</text>
    </svg>
    <figcaption>Composition root của m06: ba binding, hai điểm khởi động, ba cách xin, và một test hỏi đúng câu hỏi mà các màn hình hỏi.
<ul class="legend">
    <li data-part="inbound">Inbound (binding port, ViewModel, test)</li>
    <li data-part="outbound">Outbound (binding port)</li>
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

**Khởi động Koin một lần, khi app khởi động.** Koin phải chạy trước khi màn hình đầu tiên xin ViewModel, và phải khởi động đúng một lần, nên không thể đặt trong màn hình. Tài liệu Koin: "Khởi động Koin ở nơi nền tảng của bạn khởi động: class `Application` trên Android, hàm `initKoin()` dùng chung trong một project KMP", và làm ở đó "khi code ngoài Compose (một `Service`, một worker của `WorkManager`, code Swift của iOS) cũng cần Koin" ([Koin for Compose](https://insert-koin.io/docs/reference/koin-compose/compose/)). Worker nền của bài 18 sẽ cần. Cả hai track Android có một class mới và một attribute trong manifest:

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · AndroidManifest.xml" hl_lines="2 5 10"
// Runs once per process, before any Activity: the place to start Koin.
class DeviceMonitorApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin()
    }
}
⋯ androidApp/src/main/AndroidManifest.xml, one attribute added:
    <application
        android:name=".DeviceMonitorApplication"
⋯ label, theme and the MainActivity entry: as in m05
```

**`android:name`** bảo hệ thống tạo class `Application` nào. Bỏ nó đi, class vẫn compile nhưng không bao giờ chạy. Chúng tôi đã thử: app crash lúc mở với `IllegalStateException: KoinApplication has not been started`.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="2 6 7"
    import SwiftUI
    import Shared

    @main
    struct iOSApp: App {
        init() {
            AppModuleKt.doInitKoin()
        }
    ⋯ body: as in m05
    ```

    `init()` trên `App` chạy một lần, trước khi scene đầu tiên được dựng: chỗ của SwiftUI tương ứng `Application.onCreate`. Thiếu `import Shared`, thứ file của m05 không cần, Swift không tìm thấy `AppModuleKt`.

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="2 6 7 8"
    import UIKit
    import Shared

    @main
    final class AppDelegate: UIResponder, UIApplicationDelegate {
        func application(_ application: UIApplication,
                         didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
            AppModuleKt.doInitKoin()
            return true
        }
    ⋯ configurationForConnecting: as in m05
    ```

    `didFinishLaunchingWithOptions` chạy một lần mỗi lần mở app, trước khi scene nào kết nối, nên Koin đã chạy trước khi `SceneDelegate` tạo view controller đầu tiên (vòng đời mức app của bài 04).


**Vì sao là `doInitKoin`?** Các hàm Kotlin top-level thành method của một class đặt theo tên file (`AppModule.kt` → `AppModuleKt`), như ở bài 05. Objective-C coi các tên bắt đầu bằng `init` là initializer, nên compiler Kotlin thêm tiền tố `do`. Bạn thấy được nó trong header được sinh ra: `+ (void)doInitKoin __attribute__((swift_name("doInitKoin()")));`.

## 8. Xin Koin ViewModel

Mỗi màn hình xin Koin thay vì `AppContainer`. ViewModel store vẫn giữ ViewModel và vẫn clear nó; chỉ factory đổi.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="2 8"
    ⋯ package, androidx imports, the shared types' imports: as in m05, minus …viewmodel.compose.viewModel and …di.AppContainer
    import org.koin.compose.viewmodel.koinViewModel

    // Stateful: owns the filter text and connects the shared ViewModel to the content below.
    @Composable
    fun DeviceListScreen(
        onDeviceClick: (Device) -> Unit,
        viewModel: DeviceListViewModel = koinViewModel(),
    ) {
    ⋯ the rest of the file: unchanged from m05
    ```

    `koinViewModel()` làm điều `viewModel(factory = …)` đã làm: nó tìm `ViewModelStoreOwner` gần nhất, tức navigation entry, và xin store của nó ViewModel, với một factory hỏi Koin. Kiểu lấy từ kiểu khai báo của tham số. Trong `androidApp/build.gradle.kts`, `implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")` được thay bằng `implementation("io.insert-koin:koin-compose-viewmodel:4.2.2")`: app không còn tự gọi `viewModel(…)`, và thư viện của Koin kéo theo `lifecycle-viewmodel-compose`.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="3 8"
    ⋯ package and imports: as in m05, minus androidx.fragment.app.viewModels and …di.AppContainer
    import kotlinx.coroutines.launch
    import org.koin.androidx.viewmodel.ext.android.viewModel

    class DeviceListFragment : Fragment() {
        // Survives rotation and the trip to the detail screen; cleared when this
        // Fragment leaves the back stack for good.
        private val viewModel: DeviceListViewModel by viewModel()
    ⋯ the rest of the file: unchanged from m05
    ```

    `by viewModel()` (số ít, của Koin) thay `by viewModels { … }` (số nhiều) của AndroidX: cùng owner (Fragment này), cùng vòng đời, cùng việc tạo ở lần truy cập đầu tiên; chỉ factory đổi. Để ý một chữ cái đó: dạng số nhiều là của AndroidX, thứ rơi về factory mặc định. Trong `androidApp/build.gradle.kts`, thêm `implementation("io.insert-koin:koin-android:4.2.2")` vào cuối `dependencies { }`. `fragment-ktx` không còn được dùng trực tiếp, nhưng `koin-android` dù sao cũng phụ thuộc vào nó, nên khoá học giữ dòng khai báo tường minh.


Tài liệu Koin không chỉ cách nào để lấp một `ViewModelStore` từ iOS, và chúng ta không cần: resolver của bài 08 đã nhận bất kỳ factory nào. Giờ nó dùng một factory hỏi Koin, và Swift thôi không truyền factory nữa:

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/ViewModelResolver.kt" hl_lines="4 6 10 12"
⋯ package and imports: as in m05, plus CreationExtras and org.koin.core.component.KoinComponent
@OptIn(BetaInteropApi::class)
@Throws(IllegalArgumentException::class)
fun ViewModelStore.resolveViewModel(modelClass: ObjCClass): ViewModel {
⋯ vmClass from modelClass: as in m05
    return ViewModelProvider.create(this, KoinViewModelFactory)[vmClass]
}

// The store calls this the first time it needs a ViewModel; Koin builds it from appModule.
private object KoinViewModelFactory : ViewModelProvider.Factory, KoinComponent {
    override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
        getKoin().get(modelClass)
}
```

1. **Tham số `factory` không còn.** Swift không còn chọn cách dựng một ViewModel: nó xin một class, và composition root quyết định.
2. **`KoinViewModelFactory` là một `KoinComponent`**: một lần tra cứu, ở mép, trong một class Koin không tạo (quy tắc của mục 6). Store chỉ gọi `create` lần đầu nó cần ViewModel đó, nên store vẫn sở hữu vòng đời của nó, và `deinit` của `ViewModelOwner` vẫn clear nó.
3. **Sao lại tự viết bốn dòng?** Tài liệu Koin nói về ViewModel trên Android và trong Compose, không nói về một `ViewModelStore` phía Swift. Code đa nền tảng của Koin có một class cùng tên, `org.koin.viewmodel.factory.KoinViewModelFactory`, nhưng nó nhận một Koin scope và một class ViewModel cho mỗi instance, và tài liệu không nhắc tới nó. `getKoin().get(modelClass)` là API public của Koin, và đường đi qua store là của bài 08, không đổi.

Trong `iosApp/iosApp/ViewModelOwner.swift` (cả hai track iOS), `viewModel` mất tham số: `func viewModel<VM: ViewModel>() -> VM` gọi `store.resolveViewModel(modelClass: VM.self)`. Dòng của mỗi màn hình ngắn lại:

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="2"
        var body: some View {
            let viewModel: DeviceListViewModel = owner.viewModel()
    ⋯ the rest of the file: unchanged from m05
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="2"
        private let owner = ViewModelOwner()
        private lazy var viewModel: DeviceListViewModel = owner.viewModel()
    ⋯ the rest of the file: unchanged from m05
    ```


Swift suy ra `VM` từ kiểu được khai báo, cùng mẹo với `koinViewModel()`. Khi `AppContainer` không còn, Koin được import ở đúng ba loại chỗ: `di/` (main và test), `ViewModelResolver.kt`, và trên Android là một màn hình xin ViewModel. Đó là các mép.

## 9. Test graph, vì compiler không còn làm thay

Đây là cái giá của một container. Với `AppContainer`, thiếu một dependency là một lỗi compile. Với DSL kiểu cổ điển của Koin, thứ khoá học này dùng, module là một danh sách công thức được đọc lúc chạy. (Koin 4.2 còn có một Compiler Plugin tuỳ chọn với DSL riêng, thứ "kiểm tra lúc build rằng mọi dependency đều được khai báo" ([Definitions](https://insert-koin.io/docs/reference/koin-core/definitions/)). Khoá học giữ Kotlin thuần và không dùng compiler plugin.) Chúng tôi xoá dòng `single<BleScanner>`, và app Android **compile không một cảnh báo**, rồi crash ngay lúc màn hình danh sách hiện ra:

```text
FATAL EXCEPTION: main
…
Caused by: …InstanceCreationException: Could not create instance for '[Factory: '…adapter.inbound.DeviceListViewModel']'
Caused by: …InstanceCreationException: Could not create instance for '[Singleton: '…core.inbound.DeviceScanning']'
Caused by: …NoDefinitionFoundException: No definition found for type '…core.outbound.BleScanner' on scope '['_root_']'.
```

Đọc chuỗi từ dưới lên: mảnh bị thiếu, rồi từng thứ cần nó. Để ý rằng Koin gọi tên binding bằng port của nó, `DeviceScanning`, không phải bằng service. Một test xin mọi ViewModel, nên lỗi này hiện ra trong `allTests` thay vì trên điện thoại:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt" hl_lines="6 8"
class AppModuleTest {
    // Koin checks the graph only when something asks for an instance, at run time. This
    // test asks for every screen's ViewModel, so a missing binding fails here, not in the app.
    @Test
    fun buildsEveryViewModel() {
        val koin = koinApplication { modules(appModule) }.koin

        assertNotNull(koin.get<DeviceListViewModel>())
    }
}
```

1. **`koinApplication { … }`** "tạo một container không được đăng ký trong `GlobalContext`" ([Starting Koin](https://insert-koin.io/docs/reference/koin-core/starting-koin)), khác với `startKoin`. Các test không rò sang nhau, và quy tắc một-lần-mỗi-process không gây chuyện.
2. **Nó thấy được `appModule`** vì `internal` nghĩa là "cùng Gradle module", và `commonTest` được compile cùng module của `commonMain`.
3. **Dựng ViewModel mà không cần `setMain` là an toàn**: không gì chạm vào `viewModelScope` cho tới `startScan`.
4. **Giữ nó luôn cập nhật.** Mỗi màn hình mới thêm một dòng `get<…ViewModel>()` ở đây. Khi xoá binding, test này fail trên JVM và trên iOS. Report của JVM hiện cùng chuỗi ba dòng như lúc crash. Report của iOS chỉ in dòng trên cùng, `Could not create instance for '[Factory: '…DeviceListViewModel']'`, và `NoDefinitionFoundException` chỉ xuất hiện ở đó như một frame trong stack trace, nên đọc report của JVM để tìm mảnh bị thiếu.

Tám test còn lại không dùng Koin: chúng gọi constructor với các test double. Đó là ý nghĩa của constructor injection: **container là cho app, không phải cho test.**

## 10. Thực tế xảy ra gì

Chúng tôi build m06 trên cả bốn track (Kotlin 2.4.20, Koin 4.2.2, coroutines 1.11.0, Turbine 1.2.1, AGP 9.4.1, Xcode 26.2). `allTests` pass 9 trên 9 test trên JVM và 9 trên 9 trên iOS simulator. Cả hai app trông và chạy như m05: năm hàng cách nhau khoảng 0,3 s, "Devices found: 5" ở 3 s, `sens` tìm thấy một hàng. Các bản build không in cảnh báo compiler nào từ code của chúng ta, và header iOS không chứa kiểu Koin nào.

**m06 là một điểm dừng tự nhiên.** Nó xong khi `allTests` chạy cả hai task test xanh, và cả hai app build được và chạy như m05. Hãy commit nó trước bài tiếp theo, bài thêm khả năng mới đầu tiên qua cả hai loại port: quyền truy cập.

!!! question "Hỏi agent của bạn"
    Nhờ agent dẫn bạn đi qua một lần chạy `showsDevicesAsTheyArriveThenFinishesAtTheTimeout` theo thứ tự thời gian: coroutine nào chạy ở mỗi bước, đồng hồ ảo chỉ bao nhiêu, và vì sao mỗi `awaitItem()` trả về. Rồi nhờ nó lần theo app của bạn từ lúc mở tới khung hình đầu tiên của danh sách: dòng nào khởi động Koin, dòng nào xin ViewModel, store nào giữ nó, và `SimulatedBleScanner` được tạo khi nào.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao <code>ScanningServiceTest</code> khai báo <code>scanning</code> là <code>DeviceScanning</code> thay vì <code>ScanningService</code>?</p>
<div class="opts">
<button class="opt">Kotlin không gọi được method của một class từ <code>commonTest</code></button>
<button class="opt" data-correct>test điều khiển app core qua inbound port của nó, như mọi inbound adapter</button>
<button class="opt">để Koin tiêm được service vào test</button>
</div>
<p class="feedback"></p>
<p class="why">Test kiểm tra thứ app cung cấp, qua đúng port mà ViewModel dùng, nên nó sống sót qua mọi lần viết lại phần bên trong của service. Koin không tham gia gì vào test của service.</p>
</div>

<div class="quiz">
<p class="q">Test ViewModel chờ một timeout 3 giây. Vì sao nó chỉ mất vài mili giây?</p>
<div class="opts">
<button class="opt">Turbine rút mọi timeout xuống vài ms</button>
<button class="opt">bản cài đặt test không bao giờ gọi <code>delay</code></button>
<button class="opt" data-correct>thời gian ảo nhảy thẳng tới timeout</button>
</div>
<p class="feedback"></p>
<p class="why"><code>Main</code> là một test dispatcher, và <code>runTest</code> dùng chung scheduler của nó. Khi mọi coroutine đều đang chờ, scheduler đẩy đồng hồ tới bộ hẹn giờ tiếp theo, timeout ở 3000 ms. Timeout riêng của Turbine tính theo đồng hồ thật.</p>
</div>

<div class="quiz">
<p class="q">Vì sao test ViewModel dùng <code>TestDeviceScanning</code> chứ không dùng service thật với <code>FakeBleScanner</code>?</p>
<div class="opts">
<button class="opt" data-correct>để nó chỉ fail khi ViewModel sai, không phải khi quy tắc quét sai</button>
<button class="opt">vì một ViewModel không nhận được service trong constructor</button>
<button class="opt">vì <code>FakeBleScanner</code> không chạy trên iOS</button>
</div>
<p class="feedback"></p>
<p class="why">ViewModel chỉ phụ thuộc vào inbound port, nên test của nó thay mọi thứ phía sau port đó. Quy tắc quét có test riêng trong <code>ScanningServiceTest</code>.</p>
</div>

<div class="quiz">
<p class="q">Bạn xoá một binding khỏi <code>appModule</code>. Khi nào bạn phát hiện ra?</p>
<div class="opts">
<button class="opt">khi Kotlin compile <code>AppModule.kt</code></button>
<button class="opt">khi Gradle sync, trước mọi lần compile</button>
<button class="opt" data-correct>khi có thứ đầu tiên xin một kiểu cần đến nó</button>
</div>
<p class="feedback"></p>
<p class="why">Koin giải lúc chạy. Đó là lý do có <code>AppModuleTest</code>: nó dời lỗi từ điện thoại vào <code>allTests</code>.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>appModule</code> được khai báo <code>internal</code>?</p>
<div class="opts">
<button class="opt">Koin từ chối các module khai báo public</button>
<button class="opt" data-correct>để các kiểu của Koin không lọt vào header của Swift</button>
<button class="opt">để test không với tới các adapter thật</button>
</div>
<p class="feedback"></p>
<p class="why">Một <code>Module</code> public kéo các class của Koin vào header được export (khoảng một nghìn dòng thừa). Test trong cùng Gradle module vẫn thấy các khai báo <code>internal</code>.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Giờ Koin dựng ViewModel. Trên iOS, cái gì vẫn clear nó? (Bài 08)</p>
<div class="opts">
<button class="opt">Koin, khi view SwiftUI bị gỡ</button>
<button class="opt" data-correct>store của ViewModelOwner, trong deinit của nó</button>
<button class="opt">SKIE, khi vòng <code>for await</code> kết thúc</button>
</div>
<p class="feedback"></p>
<p class="why">Một definition <code>viewModel</code> tạo instance mới mỗi lần yêu cầu. Giữ và clear nó là việc của store, và trên iOS <code>deinit</code> của owner gọi <code>store.clear()</code>.</p>
</div>

<div class="quiz">
<p class="q">Bài 13 thay <code>SimulatedBleScanner</code> bằng radio thật. File nào đổi cho phần nối dây? (Bài 10)</p>
<div class="opts">
<button class="opt">ScanningService.kt, thứ gọi radio</button>
<button class="opt" data-correct>composition root, giờ là di/AppModule.kt</button>
<button class="opt">mỗi màn hình lấy ViewModel</button>
</div>
<p class="feedback"></p>
<p class="why">Adapter nào implement <code>BleScanner</code> là một quyết định nối dây, chỉ được đưa ra ở composition root. Service, ViewModel và các màn hình chỉ biết port.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m06 của bạn)"
    1. **Phá, đoán, chạy.** Làm từng thay đổi dưới đây riêng lẻ. *Trước khi chạy*, ghi ra test nào sẽ fail, với thông báo gì, và JVM với iOS có khác nhau không. Rồi chạy `./gradlew :shared:allTests`, so sánh, và hoàn tác.

       1. Trong `ScanningService`, xoá `&& seen.add(device.id)`.
       2. Trong `ScanningService`, xoá `.trim()`.
       3. Trong `startScan`, truyền `found` thay vì `found.toList()` vào `Scanning(…)` (bài 08). Đọc thông báo lỗi: test nhận được state nào thay vào, và vì sao?
       4. Đổi `catch (e: ScanException)` thành `catch (e: Exception)`. Bài 08 gọi đây là một bug thật. Giải thích thứ bạn thấy, và một test sẽ phải làm gì để bắt được nó.
    2. **Viết một test.** Thêm `aScanThatFindsNothingFinishesEmpty` vào `DeviceListViewModelTest`: bắt đầu một lần quét, để app core không tìm thấy gì, và khẳng định lần quét kết thúc là `Finished(emptyList())` đúng ở 3000 ms thời gian ảo. Rồi thêm một test service cho một quy tắc bạn tự chọn, qua `DeviceScanning`. Chạy cả hai trên cả hai nền tảng.
    3. **Thay adapter, theo cách của Koin.** Viết `BrokenBleScanner` trong `adapter.outbound`: lần quét của nó chờ 500 ms, rồi ném `ScanException("Bluetooth adapter not responding (simulated).")`. Bind nó thay cho cái giả lập và chạy cả hai app: hộp thoại "Scan failed" phải quay lại. Đếm số file bạn đã động vào; nếu nhiều hơn hai, tìm ra cái gì đã rò. Rồi thay vào đó xoá `single<DeviceScanning> …`, và đoán ba điều trước khi kiểm tra: cả hai app có compile không, test nào fail với dòng cuối nào, và mỗi app làm gì lúc mở? Hoàn tác cả hai.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html" -o .course/lesson-11.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Lesson 09, which this brief's warning list points to; skipped if it's already there:
  [ -f .course/lesson-09.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html" -o .course/lesson-09.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 11 (Testing the app core + Koin): build milestone m06, tests for the app core and the
ViewModel, and Koin instead of hand wiring, on top of m05.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m05 project in demo/ (Lesson 10). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks:
     shared/build.gradle.kts: replaced (withHostTest {}, Koin in commonMain, commonTest deps).
     shared/src/commonMain/kotlin/com/example/devicemonitor/di/: delete AppContainer.kt,
       add AppModule.kt.
     shared/src/iosMain/kotlin/com/example/devicemonitor/ViewModelResolver.kt: replaced.
     add, under shared/src/commonTest/kotlin/com/example/devicemonitor/:
       doubles/FakeBleScanner.kt, doubles/TestDeviceScanning.kt, core/ScanningServiceTest.kt,
       adapter/inbound/DeviceListViewModelTest.kt, di/AppModuleTest.kt
   Every other file in shared/ stays as in m05.

2. Android, both tracks: add androidApp/src/main/java/com/example/devicemonitor/android/
   DeviceMonitorApplication.kt; androidApp/src/main/AndroidManifest.xml: replaced (my track's).
     Compose: androidApp/build.gradle.kts and DeviceListScreen.kt: replaced.
     XML: androidApp/build.gradle.kts and DeviceListFragment.kt: replaced.
   iOS, both tracks: iosApp/iosApp/ViewModelOwner.swift: replaced.
     SwiftUI: iosApp/iosApp/iOSApp.swift and DeviceListView.swift: replaced.
     UIKit: iosApp/iosApp/AppDelegate.swift and DeviceListViewController.swift: replaced.
   No Swift file is added or removed, so the Xcode project needs no change. Every other
   Android and iOS file stays as in m05.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Run: `adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk`, then
     `adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity`.
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`, then
     `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 9 tests pass on each: 5 in ScanningServiceTest, 3 in
  DeviceListViewModelTest, 1 in AppModuleTest. Show the counts from the XML files in
  shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time" lines
  and the SLF4J "Failed to load class" lines (Lesson 09, section 2; SLF4J can appear only when
  the framework is rebuilt, and may not appear at all); Gradle's "Deprecated Gradle features …
  Gradle 10" line, "Unable to strip the following libraries" from the Android build (not
  every build prints it), Xcode's "appintentsmetadataprocessor … warning: Metadata extraction
  skipped", and xcodebuild's "WARNING: Using the first of multiple matching destinations"
  (printed even with id=, because one simulator matches two architectures). Gradle may also
  print "The Daemon will expire after the build after running out of JVM Metaspace"; the build
  still succeeds, and the next command starts a fresh daemon. Xcode "note:" lines are not
  warnings.
- Mutation check: in shared/src/commonMain/kotlin/com/example/devicemonitor/core/
  ScanningService.kt, move `val seen = mutableSetOf()` out of flow { } to a
  `private val` property of the class. allTests must fail exactly eachScanStartsWithNothingSeen
  on both platforms. This file isn't in this lesson's Full files (it's m05's, unchanged), so copy
  it aside before the change, or restore it with git afterwards (git diff on it must be empty).
  Rerun: 9 of 9 again.
- Koin stays at the edges: outside build/ folders,
    grep -rln 'org.koin' --include='*.kt' --include='*.swift' --exclude-dir=build .
  lists only shared/…/di/AppModule.kt, shared/…/commonTest/…/di/AppModuleTest.kt,
  shared/src/iosMain/…/ViewModelResolver.kt, and the Android screen that gets the ViewModel
  (DeviceListScreen.kt or DeviceListFragment.kt). Quote the --include patterns: zsh expands
  them otherwise. Nothing is left of the hand wiring:
    grep -rn 'AppContainer' --include='*.kt' --include='*.swift' --exclude-dir=build .
  finds nothing. The exported header has no Koin types:
    grep -c 'Koin_core' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 0 (build that framework first with ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
  if it isn't there), and the same header declares doInitKoin.
- Launch: as m05 (the title "Device Monitor", a "Device name filter" field, a full-width Scan
  button, "Tap Scan to look for devices." and an empty list), with no crash. The XML button
  shows "SCAN" in capitals (Material's style), so match that text when automating.
- Tap Scan: the button is disabled, a spinner + "Scanning…" show, rows appear one at a time
  (~0.3 s apart) in SampleDevices order, and after ~3 s the status reads "Devices found: 5" and
  the button is enabled again. Filter "sens" + Scan: one row (Tire Pressure Sensor). Filter
  "zzz" + Scan: the red "No devices found. Try another filter." Rows open the detail screen;
  Back returns to the list with the results still shown.
- Android: rotate DURING a scan: the scan carries on and ends with "Devices found: 5" (one
  ViewModel survived the rotation, now built by Koin).
- Android, driving the emulator: after launching, wait until a uiautomator dump shows the Scan
  button before the first tap. Tap the filter field and use `adb shell input text`; find
  coordinates with `adb shell uiautomator dump` (on Compose, the Scan node's bounds cover only
  its text; tap their centre, not a corner). A dump takes about 2 s, so judge mid-scan
  states from `adb exec-out screencap -p` screenshots (about 1 s each), or `adb shell
  screenrecord` for rows arriving 0.3 s apart: pull the .mp4 and step through it, for example
  as frames with `ffmpeg -i scan.mp4 -vf fps=10 frame%03d.png`.
- iOS: if you can drive the simulator (xcrun simctl has no tap command; idb or a throwaway
  XCUITest that launches the installed app by bundle ID can. Don't script the Simulator window
  with System Events: its clicks and keystrokes are unreliable), run the Scan, filter and
  row-tap checks above; an XCUITest query takes about 0.3 s, so judge rows arriving one at a
  time from a sequence of screenshots. In automation, the status text ends in the single
  character "…", not three dots. If you can't, say so and list which iOS checks you didn't run.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each box of the lesson's Koin graph diagram is in the code. Do NOT
do the unaided exercise for me.
```

## Đọc thêm

- [Cheatsheet: the hexagon, Koin and tests](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): code để đâu, các binding, cách nối dây theo từng track, công thức viết test.
- Kiểm thử: [Testing Kotlin coroutines on Android](https://developer.android.com/kotlin/coroutines/test) (nguồn chính) và [Use test doubles](https://developer.android.com/training/testing/fundamentals/test-doubles) của Android; README của [Turbine](https://github.com/cashapp/turbine); [Test your multiplatform app](https://kotlinlang.org/docs/multiplatform/multiplatform-run-tests.html) của Kotlin; mục về host test và device test của [Android-KMP plugin](https://developer.android.com/kotlin/multiplatform/plugin).
- DI: [Dependency injection in Android](https://developer.android.com/training/dependency-injection) và [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual); các trang [Definitions](https://insert-koin.io/docs/reference/koin-core/definitions/), [ViewModel](https://insert-koin.io/docs/reference/koin-core/viewmodel/), [KoinComponent](https://insert-koin.io/docs/reference/koin-core/koin-component/), [Starting Koin](https://insert-koin.io/docs/reference/koin-core/starting-koin) và [Koin for Compose](https://insert-koin.io/docs/reference/koin-compose/compose/) của Koin.
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html): các thuật ngữ của bài này được đánh dấu (11).
- Kinh nghiệm thực tế: những người bảo trì Koin trả lời trong kênh #koin của [Kotlin Slack](https://surveys.jetbrains.com/s3/kotlin-slack-sign-up), và câu hỏi KMP thì vào #multiplatform. Trên [r/androiddev](https://reddit.com/r/androiddev), tìm "Koin vs Hilt" và "fakes vs mocks" để thấy các đánh đổi mà các team tranh luận.

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Một file bị xoá: `shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppContainer.kt`. Mọi thứ khác giữ như ở m05.

**Dùng chung cho mọi track**

??? example "shared/build.gradle.kts"
    ```kotlin
    plugins {
        id("org.jetbrains.kotlin.multiplatform")
        id("com.android.kotlin.multiplatform.library")
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
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.outbound.SimulatedBleScanner
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.outbound.BleScanner
    import org.koin.core.context.startKoin
    import org.koin.core.module.dsl.viewModelOf
    import org.koin.dsl.module

    // The composition root, as a Koin module: which service implements each inbound port,
    // which adapter implements each outbound port, and how to build each ViewModel.
    internal val appModule = module {
        single<BleScanner> { SimulatedBleScanner() }
        single<DeviceScanning> { ScanningService(get()) }
        viewModelOf(::DeviceListViewModel)
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin() {
        startKoin {
            modules(appModule)
        }
    }
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/ViewModelResolver.kt"
    ```kotlin
    package com.example.devicemonitor

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.ViewModelProvider
    import androidx.lifecycle.ViewModelStore
    import androidx.lifecycle.viewmodel.CreationExtras
    import kotlinx.cinterop.BetaInteropApi
    import kotlinx.cinterop.ObjCClass
    import kotlinx.cinterop.getOriginalKotlinClass
    import org.koin.core.component.KoinComponent
    import kotlin.reflect.KClass

    // Swift can't pass a KClass, only its Objective-C class. This turns it back into the
    // KClass that ViewModelProvider needs. Adapted from Android's KMP ViewModel guide.
    @OptIn(BetaInteropApi::class)
    @Throws(IllegalArgumentException::class)
    fun ViewModelStore.resolveViewModel(modelClass: ObjCClass): ViewModel {
        @Suppress("UNCHECKED_CAST")
        val vmClass = getOriginalKotlinClass(modelClass) as? KClass<ViewModel>
        require(vmClass != null) { "The modelClass parameter must be a ViewModel type." }
        return ViewModelProvider.create(this, KoinViewModelFactory)[vmClass]
    }

    // The store calls this the first time it needs a ViewModel; Koin builds it from appModule.
    private object KoinViewModelFactory : ViewModelProvider.Factory, KoinComponent {
        override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
            getKoin().get(modelClass)
    }
    ```

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
    // the radio: it decides what is heard and when, and whether the radio fails.
    class FakeBleScanner : BleScanner {
        private val heard = Channel<Device>(Channel.UNLIMITED)
        var failure: ScanException? = null
        var isScanning = false
            private set

        override fun scan(): Flow<Device> = flow {
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

        override fun scan(nameFilter: String): Flow<Device> = flow {
            filters += nameFilter
            failure?.let { throw it }
            emitAll(found.receiveAsFlow())
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

        private val radio = FakeBleScanner()

        // The test drives the app core the way the ViewModel does: through the inbound port.
        private val scanning: DeviceScanning = ScanningService(radio)

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
            radio.failure = ScanException("Bluetooth is off")

            scanning.scan(nameFilter = "").test {
                val error = awaitError()
                assertIs<ScanException>(error)
                assertEquals("Bluetooth is off", error.message)
            }
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import app.cash.turbine.test
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.doubles.TestDeviceScanning
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
    import kotlin.test.assertNull

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain, currentTime
    class DeviceListViewModelTest {
        private val obd = Device(id = "01", name = "OBD-II Adapter", rssi = -48)
        private val heart = Device(id = "02", name = "Heart Rate Monitor", rssi = -61)

        private val scanning = TestDeviceScanning()
        private lateinit var viewModel: DeviceListViewModel

        @BeforeTest
        fun setUp() {
            // viewModelScope runs on Dispatchers.Main. In a test, Main becomes a test
            // dispatcher whose clock runTest controls, so delays and timeouts take no real time.
            Dispatchers.setMain(StandardTestDispatcher())
            viewModel = DeviceListViewModel(scanning)
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

                // Nothing else is found: 3 s of virtual time pass, and the timeout ends the scan.
                assertEquals(ScanState.Finished(listOf(obd, heart)), awaitItem().scan)
                assertEquals(DeviceListViewModel.SCAN_TIMEOUT.inWholeMilliseconds, testScheduler.currentTime)
            }
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
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import org.koin.dsl.koinApplication
    import kotlin.test.Test
    import kotlin.test.assertNotNull

    class AppModuleTest {
        // Koin checks the graph only when something asks for an instance, at run time. This
        // test asks for every screen's ViewModel, so a missing binding fails here, not in the app.
        @Test
        fun buildsEveryViewModel() {
            val koin = koinApplication { modules(appModule) }.koin

            assertNotNull(koin.get<DeviceListViewModel>())
        }
    }
    ```

**Android**

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
    import com.example.devicemonitor.di.initKoin

    // Runs once per process, before any Activity: the place to start Koin.
    class DeviceMonitorApplication : Application() {
        override fun onCreate() {
            super.onCreate()
            initKoin()
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
            implementation("androidx.core:core-ktx:1.19.1")
            implementation("androidx.activity:activity-compose:1.13.0")
            implementation("androidx.compose.material3:material3")
            implementation("androidx.navigation:navigation-compose:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
            implementation("io.insert-koin:koin-compose-viewmodel:4.2.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.12.0")
        }
        ```

    ??? example "androidApp/src/main/AndroidManifest.xml · Compose track"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
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
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.core.Device
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: owns the filter text and connects the shared ViewModel to the content below.
        @Composable
        fun DeviceListScreen(
            onDeviceClick: (Device) -> Unit,
            viewModel: DeviceListViewModel = koinViewModel(),
        ) {
            var filter by rememberSaveable { mutableStateOf("") }
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            DeviceListContent(
                filter = filter,
                onFilterChange = { filter = it },
                isScanning = state.scan is ScanState.Scanning,
                devices = when (val scan = state.scan) {
                    ScanState.Idle -> null
                    is ScanState.Scanning -> scan.found
                    is ScanState.Finished -> scan.found
                },
                onScan = { viewModel.startScan(filter) },
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
            isScanning: Boolean,
            devices: List<Device>?,
            onScan: () -> Unit,
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
                Button(onClick = onScan, enabled = !isScanning, modifier = Modifier.fillMaxWidth()) {
                    Text("Scan")
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
            implementation("androidx.core:core-ktx:1.19.1")
            implementation("androidx.appcompat:appcompat:1.8.0")
            implementation("androidx.fragment:fragment-ktx:1.9.1")
            implementation("androidx.constraintlayout:constraintlayout:2.2.2")
            implementation("androidx.recyclerview:recyclerview:1.4.0")
            implementation("androidx.navigation:navigation-fragment:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.11.0")
            implementation("io.insert-koin:koin-android:4.2.2")
        }
        ```

    ??? example "androidApp/src/main/AndroidManifest.xml · XML track"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
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
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        class DeviceListFragment : Fragment() {
            // Survives rotation and the trip to the detail screen; cleared when this
            // Fragment leaves the back stack for good.
            private val viewModel: DeviceListViewModel by viewModel()

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
                b.scanButton.setOnClickListener { viewModel.startScan(b.filterInput.text.toString()) }
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
                b.scanButton.isEnabled = !isScanning
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

??? example "iosApp/iosApp/ViewModelOwner.swift · both iOS tracks"
    ```swift
    import Shared

    // iOS has no ViewModelStoreOwner, so this class plays that role. Keep it in a view's
    // @State (or a view controller's property). When it is deinitialised, clearing the store
    // cancels every viewModelScope in it and calls onCleared().
    final class ViewModelOwner {
        private let store = ViewModelStore()

        // Returns the store's instance of VM; Koin creates it on first use.
        func viewModel<VM: ViewModel>() -> VM {
            do {
                return try store.resolveViewModel(modelClass: VM.self) as! VM
            } catch {
                fatalError("Couldn't create \(VM.self): \(error)")
            }
        }

        deinit {
            store.clear()
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
                AppModuleKt.doInitKoin()
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
            @State private var owner = ViewModelOwner()
            @State private var filter = ""
            @State private var state: DeviceListUiState?

            var body: some View {
                let viewModel: DeviceListViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                DeviceListContent(
                    filter: $filter,
                    isScanning: state.scan is ScanStateScanning,
                    devices: devices(in: state.scan),
                    onScan: { viewModel.startScan(filter: filter) }
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
            let isScanning: Bool
            let devices: [Device]?
            let onScan: () -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Device name filter", text: $filter)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    Button(action: onScan) {
                        Text("Scan")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isScanning)
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
                AppModuleKt.doInitKoin()
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
            private let scanButton = UIButton(configuration: .filled())
            private let spinner = UIActivityIndicatorView(style: .medium)
            private let statusLabel = UILabel()
            private let tableView = UITableView()
            private lazy var dataSource = UITableViewDiffableDataSource<Int, String>(tableView: tableView) {
                tableView, indexPath, deviceId in
                let cell = tableView.dequeueReusableCell(withIdentifier: "device", for: indexPath)
                var content = UIListContentConfiguration.subtitleCell()
                if let device = SampleDevices.shared.find(id: deviceId) {
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
                scanButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    viewModel.startScan(filter: filterField.text ?? "")
                }, for: .touchUpInside)
                statusLabel.numberOfLines = 0
                tableView.register(UITableViewCell.self, forCellReuseIdentifier: "device")
                tableView.delegate = self

                let statusRow = UIStackView(arrangedSubviews: [spinner, statusLabel])
                statusRow.spacing = 8
                let stack = UIStackView(arrangedSubviews: [filterField, scanButton, statusRow, tableView])
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
                scanButton.isEnabled = !isScanning
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

                var snapshot = NSDiffableDataSourceSnapshot<Int, String>()
                snapshot.appendSections([0])
                snapshot.appendItems((devices ?? []).map(\.id))
                dataSource.apply(snapshot, animatingDifferences: true)
                renderError(state.errorMessage)
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
Ví dụ có output ở A3 và A5 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0 kèm kotlinx-coroutines-test, Turbine 1.2.1, Koin 4.2.2). Chúng là **mô hình** rút gọn của m06: cùng ý, ít dòng hơn, không có `androidx`.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-fake-test-implementation-mock-ba-kieu-ong-the): fake, test implementation và mock khác nhau ra sao (mục 1, 3, 5).
    3. [A3](#a3-thoi-gian-ao-mot-gio-trong-chop-mat-chay-that): thời gian ảo, chạy thật bằng Kotlin (mục 4, 5).
    4. [A4](#a4-koin-nhin-tu-phia-typescript): Koin nhìn từ phía TypeScript, `single` / `factory` / `viewModel` (mục 6, 7).
    5. [A5](#a5-thieu-mot-binding-compile-van-xanh-chay-that): thiếu một binding thì compile vẫn xanh, chạy thật (mục 9).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Test chỉ là **một bên gọi nữa** của inbound port: nó gọi `DeviceScanning.scan(…)` y như ViewModel.
    2. Muốn test service mà không cần Bluetooth, cắm một **radio giả** (`FakeBleScanner`) vào sau outbound port; test bảo nó "nghe thấy" thiết bị nào, lúc nào.
    3. Muốn test ViewModel mà không dính quy tắc của service, thay **cả app core** bằng `TestDeviceScanning`.
    4. `runTest` chạy trên **đồng hồ ảo**: timeout 3 s hay một giờ im lặng trôi qua trong vài mili giây thật.
    5. **Koin** thay `AppContainer`: khai báo một lần "port này nghĩa là class kia", Koin tự dựng theo thứ tự. Đổi lại, thiếu binding chỉ lộ ra lúc chạy, nên có `AppModuleTest`.

Ví dụ đời thường cho cả bài: **diễn tập trong phòng tập lái.** Muốn chấm kỹ năng của người lái (service), bạn không cần đường phố thật: một màn hình giả lập (fake radio) chiếu ra "có xe cắt ngang" đúng lúc bạn muốn. Muốn chấm cái vô lăng (ViewModel), bạn thay cả người lái bằng một robot làm đúng điều bạn bảo (test implementation). Và đồng hồ phòng tập có nút tua nhanh (thời gian ảo). Koin là **bảng phân công**: "vị trí radio → người này, vị trí service → người kia"; thiếu một dòng thì sáng hôm khai trương mới biết.

| Chữ trong bài | Nói đơn giản | Trong m06 là |
|---|---|---|
| test double | bất kỳ thứ gì đóng thế cho đồ thật trong test | `FakeBleScanner`, `TestDeviceScanning` |
| fake | đồ giả **chạy được thật**, gọn, test điều khiển | `FakeBleScanner` (sau outbound port) |
| test implementation | bản cài đặt của **inbound** port, dành cho test | `TestDeviceScanning` |
| `commonTest` | test viết một lần, chạy trên JVM và iOS | `./gradlew :shared:allTests` |
| `runTest` | chạy thân test trên đồng hồ ảo | mọi test có coroutine |
| `setMain` / `resetMain` | thay dispatcher `Main` bằng test dispatcher, rồi trả lại | `@BeforeTest` / `@AfterTest` |
| Turbine `test { }` | collect một `Flow` và hỏi từng giá trị | `awaitItem()`, `awaitError()` |
| DI container | bảng phân công tự dựng object theo thứ tự | Koin, `appModule` |
| `single` / `factory` / `viewModel` | một cái cho cả app / mới mỗi lần / mới mỗi lần, store giữ | radio + service / chưa dùng / `DeviceListViewModel` |
| `KoinComponent` | tra cứu (`get()`) chỉ ở mép | `KoinViewModelFactory` |

### A2. Fake, test implementation, mock: ba kiểu đóng thế

Giải thích thêm cho [mục 1](#1-test-cam-vao-au), [mục 3](#3-radio-gia) và [mục 5](#5-test-viewmodel-dua-tren-inbound-port).

| | Fake (`FakeBleScanner`) | Test implementation (`TestDeviceScanning`) | Mock (khoá học không dùng) |
|---|---|---|---|
| Đứng thay cho | thế giới bên ngoài, sau **outbound** port | cả app core, sau **inbound** port | bất kỳ class nào |
| Viết thế nào | class thường, có logic thật nhưng đơn giản (`Channel`) | class thường, trả đúng thứ test đưa | thư viện sinh ra lúc chạy (`every { … } returns …`) |
| Test kiểm tra | **kết quả** (thiết bị nào ra, radio có dừng không) | **kết quả** (state của ViewModel) | thường là **lời gọi** (`verify { scan() }`) |
| Gãy khi | quy tắc bị phá | ViewModel sai | đổi cách viết bên trong, dù hành vi vẫn đúng |

So với TS/JS: fake giống một `class InMemoryRepo implements Repo` bạn tự viết cho Jest; mock giống `jest.fn().mockReturnValue(…)`. Android khuyên fake vì nó nhẹ và không trói test vào chi tiết bên trong.

Vì sao ViewModel test **không** dùng service thật + fake radio? Vì khi đó test ViewModel sẽ fail cả khi quy tắc lọc của service sai. Mỗi test chỉ nên có **một lý do để đỏ**.

### A3. Thời gian ảo: một giờ trong chớp mắt, chạy thật

Giải thích thêm cho [mục 4](#4-test-service-qua-inbound-port-cua-no) và [mục 5](#5-test-viewmodel-dua-tren-inbound-port). Mô hình rút gọn của `ScanningService`, `FakeBleScanner` và test `aScanRunsUntilCancelled`, chạy bằng `runTest` + Turbine:

```kotlin title="L11Time.kt (mô hình, không có trong app)"
class FakeBleScanner : BleScanner {
    private val heard = Channel<Device>(Channel.UNLIMITED)
    var isScanning = false; private set
    fun hear(vararg d: Device) = d.forEach { heard.trySend(it) }
    override fun scan(): Flow<Device> = flow {
        isScanning = true
        try { emitAll(heard) } finally { isScanning = false }
    }
}

fun main() = runTest {
    val radio = FakeBleScanner()
    val scanning: DeviceScanning = ScanningService(radio)
    val obd = Device("1", "OBD-II Adapter")
    val heart = Device("2", "Heart Rate Monitor")
    scanning.scan("  HEART ").test {
        radio.hear(obd, heart, heart)
        println("t=${currentTime} ms  nhận: ${awaitItem().name}")
        advanceTimeBy(1.hours)
        println("t=${currentTime} ms  sau 1 giờ ảo, radio vẫn quét: ${radio.isScanning}")
        cancelAndIgnoreRemainingEvents()
    }
    println("t=${currentTime} ms  huỷ xong, radio vẫn quét: ${radio.isScanning}")
}
```

Output thật:

```text
t=0 ms  nhận: Heart Rate Monitor
t=3600000 ms  sau 1 giờ ảo, radio vẫn quét: true
t=3600000 ms  huỷ xong, radio vẫn quét: false
```

1. **Bộ lọc `"  HEART "`** có dấu cách và chữ hoa: service `trim()` và so không phân biệt hoa thường, nên chỉ Heart Rate Monitor ra, và `heart` thứ hai bị `seen` chặn.
2. **`currentTime` nhảy từ 0 lên 3.600.000 ms** (một giờ) nhưng chương trình chạy xong trong chưa tới một giây thật: đó là đồng hồ ảo.
3. **Sau một giờ radio vẫn quét**: service không tự dừng. Chỉ khi Turbine huỷ việc collect thì `finally` của fake chạy và `isScanning` về `false`.

So với TS/JS: giống `jest.useFakeTimers()` rồi `jest.advanceTimersByTime(3_600_000)`. Khác ở chỗ `runTest` **tự** nhảy tới bộ hẹn giờ tiếp theo khi mọi coroutine đều chờ, nên test timeout 3 s của ViewModel không cần gọi tua tay.

### A4. Koin nhìn từ phía TypeScript

Giải thích thêm cho [mục 6](#6-mot-di-container-them-uoc-gi) và [mục 7](#7-koin-module-va-cho-koin-khoi-ong).

| Koin (Kotlin) | Tương đương bên TS (NestJS / InversifyJS) | Trong m06 |
|---|---|---|
| `module { … }` | `@Module({ providers: [...] })` / `new ContainerModule(...)` | `appModule` |
| `single<BleScanner> { SimulatedBleScanner() }` | `{ provide: BleScanner, useClass: Simulated… }` (mặc định singleton) | một radio cho cả app |
| `factory { … }` | `scope: Scope.TRANSIENT` | chưa dùng |
| `viewModelOf(::DeviceListViewModel)` | không có; gần nhất là một factory mà UI framework giữ instance | store của màn hình giữ |
| `get()` trong definition | tham số constructor được Nest tự điền | `ScanningService(get())` |
| `startKoin` / `initKoin()` | `NestFactory.create(AppModule)` | `Application.onCreate`, `App.init`, `AppDelegate` |
| `KoinComponent` + `get()` ở mép | `app.get(Service)` từ ngoài container | `KoinViewModelFactory` |

Ví dụ đời thường cho ba loại definition: **`single`** là cái máy pha cà phê của văn phòng, cả công ty dùng chung một cái. **`factory`** là cốc giấy, ai xin cũng được một cái mới. **`viewModel`** là cốc giấy nhưng **bàn làm việc** (store của màn hình) giữ nó: bạn xoay ghế (xoay màn hình) thì cốc vẫn ở đó; bạn dọn bàn đi hẳn (màn hình rời back stack) thì cốc bị bỏ.

Còn luật "constructor ở mọi nơi, tra cứu chỉ ở mép": `ScanningService` nhận `BleScanner` qua constructor nên test tự truyền `FakeBleScanner` vào, không cần Koin. Nếu nó tự gọi `get<BleScanner>()` bên trong, test sẽ phải dựng Koin chỉ để chạy một quy tắc lọc.

### A5. Thiếu một binding: compile vẫn xanh, chạy thật

Giải thích thêm cho [mục 9](#9-test-graph-vi-compiler-khong-con-lam-thay). Ba class nối nhau như radio → service → ViewModel, dựng bằng Koin thật với một module đủ và một module thiếu radio:

```kotlin title="L11Koin.kt (mô hình, không có trong app)"
class Radio
class Service(val radio: Radio)
class ListViewModel(val service: Service)

fun main() {
    val full = module {
        single { Radio() }
        single { Service(get()) }
        factory { ListViewModel(get()) }
    }
    val missing = module {
        single { Service(get()) }
        factory { ListViewModel(get()) }
    }
    val ok = koinApplication { modules(full) }.koin
    println("đủ binding: " + ok.get<ListViewModel>().service.radio::class.simpleName)
    val bad = koinApplication { modules(missing) }.koin
    println("thiếu Radio: module vẫn dựng xong, chưa ai hỏi gì")
    try {
        bad.get<ListViewModel>()
    } catch (e: Exception) {
        var c: Throwable? = e
        while (c != null) { println("  " + c::class.simpleName + ": " + c.message); c = c.cause }
    }
}
```

Output thật:

```text
đủ binding: Radio
thiếu Radio: module vẫn dựng xong, chưa ai hỏi gì
  InstanceCreationException: Could not create instance for '[Factory: 'ListViewModel']'
  InstanceCreationException: Could not create instance for '[Singleton: 'Service']'
  NoDefinitionFoundException: No definition found for type 'Radio' on scope '['_root_']'.. Check or add definition for type 'Radio' in scope '_root_'.
```

1. **Module thiếu vẫn compile và vẫn dựng được.** Lỗi chỉ nổ ở `get<ListViewModel>()`, tức lần đầu có thứ xin kiểu cần tới nó. Trong app, đó là lúc màn hình danh sách hiện ra.
2. **Đọc chuỗi từ dưới lên**: thiếu `Radio` → không dựng được `Service` → không dựng được `ListViewModel`. Đúng như chuỗi ba dòng trong bài.
3. **`koinApplication { }`** dựng một Koin riêng, không đụng `GlobalContext`, nên chạy hai lần trong cùng một process vẫn ổn. Đó là lý do `AppModuleTest` dùng nó chứ không dùng `startKoin`.

So với `AppContainer` của bài 10: thiếu `scanner` thì `ScanningService(scanner)` báo lỗi đỏ ngay trong IDE. Koin đổi sự an toàn lúc compile lấy sự gọn, và `AppModuleTest` là cách lấy lại phần an toàn đã mất.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 12.

- [ ] Nói được test cắm vào đâu trong lục giác: test service thay radio, test ViewModel thay cả app core (xem [A2](#a2-fake-test-implementation-mock-ba-kieu-ong-the)).
- [ ] Phân biệt fake, test implementation và mock, và nói vì sao khoá học không dùng thư viện mock.
- [ ] Bật `withHostTest {}` và chứng minh được cả `testAndroidHostTest` lẫn `iosSimulatorArm64Test` thật sự chạy, không chỉ "BUILD SUCCESSFUL".
- [ ] Viết một fake outbound adapter bằng `Channel` có `finally` báo radio đã dừng.
- [ ] Viết test service qua `DeviceScanning` bằng `runTest` + Turbine: `awaitItem()`, `awaitError()`, `advanceTimeBy` (xem [A3](#a3-thoi-gian-ao-mot-gio-trong-chop-mat-chay-that)).
- [ ] Thay dispatcher `Main` trong `@BeforeTest` / `@AfterTest` và giải thích vì sao không tạo test dispatcher trong property.
- [ ] Giải thích vì sao timeout 3 s của ViewModel nổ ngay ở 3000 ms thời gian ảo, còn timeout của Turbine thì tính theo giờ thật.
- [ ] Đọc `appModule` như ba binding, và nói `single`, `factory`, `viewModel` khác nhau ra sao (xem [A4](#a4-koin-nhin-tu-phia-typescript)).
- [ ] Khởi động Koin đúng một lần trên track của mình (`Application` + `android:name`, `App.init`, hoặc `AppDelegate`), và giải thích tên `doInitKoin`.
- [ ] Xin ViewModel từ Koin trên track của mình (`koinViewModel()`, `by viewModel()`, `owner.viewModel()`).
- [ ] Giải thích vì sao `appModule` là `internal`, và vì sao `AppModuleTest` phải tồn tại (xem [A5](#a5-thieu-mot-binding-compile-van-xanh-chay-that)).
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
