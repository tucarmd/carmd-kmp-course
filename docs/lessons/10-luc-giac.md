---
source: lessons/10-the-hexagon.html
source_ref: live
source_sha: c29f8c5
---

# Lục giác: app core, port, adapter, DI viết tay

<p class="kicker">Bài 10 · Tuần 2 · Ngày 10 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/10-the-hexagon.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m05 code dùng chung được tổ chức lại thành app core + adapter, nối bằng tay</span>
  <span class="tag">Cần trước: <a href="../09-kotlin-swift-voi-skie/">09</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Ở m04, ViewModel dùng chung tự tạo scanner của nó: factory của nó ghi `DeviceListViewModel(FakeDeviceScanner())`. Từ bài 13, app cần hai radio thật thay vào: một bằng Kotlin chỉ có trên Android, và một bằng Swift chỉ có trên iOS, và code dùng chung không gọi tên được cái nào.
    Hôm nay bạn tổ chức lại code dùng chung thành một **lục giác** (hexagon): một **app core** giữ các luật của app và không import gì từ Android, iOS hay bất kỳ framework nào, với các **port** trên các cạnh của nó và các **adapter** cắm vào đó. ViewModel chỉ tới được việc quét qua một port, radio nằm sau một port khác, và một file nối chúng lại với nhau.
    Đó là milestone **m05**. Nó cũng là câu trả lời cho một câu hỏi bạn sẽ hỏi mỗi ngày trên app của team: code này đặt ở đâu?

!!! info "Nguồn chính"
    Bài [Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) của Alistair Cockburn, bài viết đã đặt tên cho pattern này. Đọc hai mục "Intent" và "Nature of the Solution" của nó sau mục 2.

!!! info "Track"
    Gần như mọi thứ hôm nay nằm trong `shared/`, giống nhau trên mọi track. Trên mỗi track UI, màn hình đổi một dòng, dòng lấy ViewModel (mục 6), và các file Android đổi import theo các package mới.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## Thay đổi so với m04

Các màn hình trông vẫn vậy, và việc quét chạy vẫn vậy, trừ một chỗ: chuỗi lọc `fail` không còn giả lập lỗi radio nữa (mục 1 nói vì sao, và mục 6 hiện dialog lỗi theo một cách khác). Cái đổi là hình dạng của code dùng chung:

<table>
<tr><th>Cái gì</th><th>m04</th><th>m05</th></tr>
<tr><td>ViewModel lấy scanner từ đâu</td><td>factory của chính nó tạo một <code>FakeDeviceScanner</code></td><td>nó nhận một port <code>DeviceScanning</code> qua constructor</td></tr>
<tr><td>luật quét</td><td>lọc theo tên, trong <code>SampleDevices.matching</code></td><td>lọc theo tên <em>và</em> "mỗi thiết bị một lần", trong <code>ScanningService</code></td></tr>
<tr><td>radio giả</td><td><code>FakeDeviceScanner</code>: mỗi thiết bị khớp một lần, rồi chờ</td><td><code>SimulatedBleScanner</code>: mọi thiết bị, lặp đi lặp lại, như một radio thật</td></tr>
<tr><td>ai chọn scanner</td><td>ViewModel</td><td><code>AppContainer</code>, composition root</td></tr>
<tr><td>file</td><td colspan="2">shared: xoá năm file trong package gốc, thêm mười file trong các package <code>core</code>, <code>adapter</code> và <code>di</code>; mỗi track UI: dòng lấy ViewModel của màn hình danh sách; các track Android: import trong các màn hình dùng kiểu dùng chung</td></tr>
</table>

## 1. Vấn đề: một ViewModel tự tạo scanner của nó

[Bài 08](08-viewmodel-dung-chung.md) để lại ghi chú này trên factory của m03: factory của chính ViewModel chọn một scanner cụ thể, nên không có gì khác truyền vào được. Đây là nó ở m04:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/DeviceListViewModel.kt (m04)" hl_lines="2 9"
class DeviceListViewModel(
    private val scanner: FakeDeviceScanner,
) : ViewModel() {
⋯ uiState, startScan(filter), errorShown()
    companion object {
        val SCAN_TIMEOUT = 3.seconds

        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { DeviceListViewModel(FakeDeviceScanner()) }
        }
    }
}
```

Và `FakeDeviceScanner` làm ba việc khác nhau trong một hàm:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/FakeDeviceScanner.kt (m04)" hl_lines="4 8 9 10"
class FakeDeviceScanner {
    fun scan(filter: String): Flow<Device> = flow {
        // Test hook for now: the filter "fail" simulates a radio error.
        if (filter.trim().equals("fail", ignoreCase = true)) {
            delay(500)
            throw ScanException("Bluetooth adapter not responding (simulated).")
        }
        for (device in SampleDevices.matching(filter)) {
            delay(300)
            emit(device)
        }
        awaitCancellation()
    }
}
```

<figure class="diagram">
<svg class="dg" viewBox="0 0 700 250" role="img" aria-labelledby="l10-problem-title">
<title id="l10-problem-title">Vấn đề ở m04. Factory của chính DeviceListViewModel tạo một FakeDeviceScanner, nên ViewModel gọi tên class của scanner. FakeDeviceScanner trộn ba việc: một test hook báo lỗi khi chuỗi lọc là "fail", luật của app giữ các tên chứa chuỗi lọc, và một radio giả phát thiết bị mỗi 0,3 giây. Từ bài 13 app cần một radio Android viết bằng Kotlin trong androidMain và một radio iOS viết bằng Swift trong app iOS. Code dùng chung trong commonMain không import được cái nào, nên ViewModel không tạo được chúng.</title>
<defs><marker id="l10-problem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small" x="14" y="20" font-weight="600">m04: code dùng chung (commonMain)</text>
<rect class="box" x="14" y="34" width="170" height="64" rx="6"/>
<text class="mono small" x="24" y="56">DeviceListViewModel</text>
<text class="small muted" x="24" y="74">factory của chính nó gọi</text>
<text class="mono small" x="24" y="89">FakeDeviceScanner()</text>
<rect class="box" x="220" y="34" width="210" height="110" rx="6"/>
<text class="mono small" x="230" y="56">FakeDeviceScanner</text>
<text class="small" x="230" y="78">1. test hook: "fail" → lỗi</text>
<text class="small" x="230" y="98">2. luật app: tên chứa chuỗi lọc</text>
<text class="small" x="230" y="118">3. radio giả: một thiết bị</text>
<text class="small" x="244" y="132">mỗi 0,3 s</text>
<path class="edge" d="M186,66 L218,66" marker-end="url(#l10-problem-arrow)"/>
<text class="small" x="470" y="20" font-weight="600">từ bài 13</text>
<g data-part="android">
<rect class="box" x="470" y="34" width="216" height="50" rx="6"/>
<text class="title small" x="480" y="54">Radio Android</text>
<text class="small muted" x="480" y="72">Kotlin, trong androidMain</text>
</g>
<g data-part="ios">
<rect class="box" x="470" y="100" width="216" height="50" rx="6"/>
<text class="title small" x="480" y="120">Radio iOS</text>
<text class="small muted" x="480" y="138">Swift, trong app iOS</text>
</g>
<path class="edge dashed" d="M120,100 L120,190 L466,190 L466,152" />
<text class="small" x="300" y="183">✗ không tạo được</text>
<text class="small muted" x="140" y="210">commonMain không import được cái nào: code dùng chung không thấy class</text>
<text class="small muted" x="140" y="226">Android hay class Swift. ViewModel tự tạo scanner thì không dùng được chúng.</text>
</svg>
<figcaption>Một class quyết định ViewModel nói chuyện với cái gì, và nó trộn một luật của app với một radio giả và một test hook.
<ul class="legend"><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

Ba vấn đề, mỗi cái tệ hơn khi app lớn lên:

1. **Không đưa được cho ViewModel một scanner khác.** Bài 13 cần mỗi nền tảng một scanner khác nhau, và test của bài 11 cần một scanner mà chúng điều khiển được. Một class Swift implement được một interface Kotlin, nhưng `commonMain` không bao giờ import được một class Swift. Vậy ViewModel phải xin một *interface*, và ai đó bên ngoài nó phải chọn truyền vào cái gì.
2. **Luật của app bị giấu trong một thứ giả.** "Hiện các thiết bị có tên chứa chuỗi lọc" là một luật của app, đúng trên cả hai nền tảng bất kể radio nào. Ở m04 nó sống trong `SampleDevices.matching`, bên trong radio giả, nên nó sẽ biến mất khi radio thật tới.
   Radio thật còn mang theo luật thứ hai: nó có thể báo cùng một thiết bị lần này qua lần khác (scanner của Android có thể gọi lại cho mỗi gói quảng bá (advertisement) nó nghe được, [`CALLBACK_TYPE_ALL_MATCHES`](https://developer.android.com/reference/android/bluetooth/le/ScanSettings#CALLBACK_TYPE_ALL_MATCHES), và CoreBluetooth cũng vậy khi bạn tắt lọc trùng của nó, [`CBCentralManagerScanOptionAllowDuplicatesKey`](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerscanoptionallowduplicateskey)), nên ai đó phải báo mỗi thiết bị chỉ một lần.
3. **Một test hook nằm trong dữ liệu người dùng nhập.** Gõ `fail` vào ô lọc thì giả lập lỗi radio. Tiện khi app chưa có test, nhưng nó trộn thứ người dùng gõ với thứ radio đã làm. Từ hôm nay, lỗi là thứ một radio adapter ném ra; test của bài 11 dùng một radio giả lỗi theo lệnh, và mục 6 hiện dialog bằng cách cắm vào một radio luôn lỗi.

## 2. Lục giác trong năm chữ

Pattern này có trước cả mobile. Alistair Cockburn đặt tên nó là **hexagonal architecture** (kiến trúc lục giác), còn gọi là **ports and adapters**, với mục đích này: "Cho phép một ứng dụng được điều khiển như nhau bởi người dùng, chương trình, test tự động hay script chạy lô, và được phát triển và test tách biệt khỏi các thiết bị và cơ sở dữ liệu mà nó sẽ chạy cùng" ([Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/)). Thay "thiết bị và cơ sở dữ liệu" bằng "radio Bluetooth", và đó là thứ app cần. Khoá học dùng năm chữ cho nó, giống nhau trong mọi bài từ giờ trở đi:

| Chữ | Nó là gì | Trong m05 |
|---|---|---|
| **app core** | phần code dùng chung giữ model, port và service của app, và không import gì từ Android, iOS hay bất kỳ framework nào | package `core` |
| **inbound port** | một interface cho thứ app *cung cấp*, mỗi năng lực (capability) một cái. Một service implement nó; inbound adapter gọi nó | `DeviceScanning` |
| **outbound port** | một interface cho thứ app *cần* từ thế giới bên ngoài, đặt tên theo ngôn ngữ của app. Outbound adapter implement nó | `BleScanner` |
| **service** | một class trong app core implement một inbound port bằng cách áp các luật của app và gọi các outbound port | `ScanningService` |
| **adapter** | *inbound*: code điều khiển app qua các inbound port (các ViewModel dùng chung, và test từ bài 11). *Outbound*: một implementation cụ thể của một outbound port cho một nền tảng hay một công nghệ | `DeviceListViewModel` (inbound), `SimulatedBleScanner` (outbound) |

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 345" role="img" aria-labelledby="l10-m05-title">
<title id="l10-m05-title">Lục giác ở m05. Bên trái, màn hình Android và màn hình iOS gọi DeviceListViewModel, inbound adapter. Nó gọi inbound port DeviceScanning trên cạnh trái của app core. Bên trong app core, một hình lục giác, ScanningService implement DeviceScanning và gọi outbound port BleScanner trên cạnh phải; các model là Device và ScanException. Bên phải, outbound adapter SimulatedBleScanner, cùng SampleDevices của nó, implement BleScanner. Bên dưới, di/AppContainer, composition root, tạo adapter, service và ViewModel và nối chúng với nhau. Mũi tên liền là lời gọi; mũi tên đứt nghĩa là implement.</title>
<defs><marker id="l10-m05-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="android">
<rect class="box" x="10" y="80" width="110" height="50" rx="6"/>
<text class="title small" x="20" y="100">Màn Android</text>
<text class="small muted" x="20" y="118">Compose · XML</text>
</g>
<g data-part="ios">
<rect class="box" x="10" y="170" width="110" height="50" rx="6"/>
<text class="title small" x="20" y="190">Màn iOS</text>
<text class="small muted" x="20" y="208">SwiftUI · UIKit</text>
</g>
<g data-part="inbound">
<rect class="box" x="140" y="105" width="130" height="90" rx="6"/>
<text class="title small" x="150" y="125">inbound adapter</text>
<text class="mono small" x="150" y="145">DeviceList</text>
<text class="mono small" x="150" y="160">ViewModel</text>
<text class="small muted" x="150" y="182">adapter.inbound</text>
</g>
<g data-part="core">
<polygon class="box" points="290,165 335,55 545,55 590,165 545,275 335,275"/>
<text class="title" x="440" y="82" text-anchor="middle">App core</text>
<text class="small muted" x="440" y="98" text-anchor="middle">package core</text>
<rect class="box" x="380" y="185" width="120" height="40" rx="6"/>
<text class="mono small" x="390" y="202">ScanningService</text>
<text class="small muted" x="390" y="218">service</text>
<text class="small muted" x="440" y="252" text-anchor="middle">model: Device · ScanException</text>
</g>
<g data-part="inbound">
<rect class="box" x="318" y="118" width="104" height="44" rx="6"/>
<text class="mono small" x="326" y="136">DeviceScanning</text>
<text class="small muted" x="326" y="153">inbound port</text>
</g>
<g data-part="outbound">
<rect class="box" x="458" y="118" width="104" height="44" rx="6"/>
<text class="mono small" x="466" y="136">BleScanner</text>
<text class="small muted" x="466" y="153">outbound port</text>
</g>
<g data-part="outbound">
<rect class="box" x="610" y="105" width="140" height="90" rx="6"/>
<text class="title small" x="620" y="125">outbound adapter</text>
<text class="mono small" x="620" y="145">SimulatedBle</text>
<text class="mono small" x="620" y="160">Scanner</text>
<text class="small muted" x="620" y="182">+ SampleDevices</text>
</g>
<path class="edge" d="M120,105 L138,128" marker-end="url(#l10-m05-arrow)"/>
<path class="edge" d="M120,195 L138,172" marker-end="url(#l10-m05-arrow)"/>
<path class="edge" d="M270,140 L316,140" marker-end="url(#l10-m05-arrow)"/>
<path class="edge dashed" d="M400,185 L385,164" marker-end="url(#l10-m05-arrow)"/>
<path class="edge" d="M480,185 L495,164" marker-end="url(#l10-m05-arrow)"/>
<path class="edge dashed" d="M608,140 L564,140" marker-end="url(#l10-m05-arrow)"/>
<rect class="box" x="140" y="295" width="610" height="40" rx="6"/>
<text class="mono small" x="150" y="313">di/AppContainer</text>
<text class="small muted" x="260" y="313">composition root: tạo adapter, service và ViewModel,</text>
<text class="small muted" x="260" y="327">và đưa mỗi cái thứ nó cần. File duy nhất gọi tên tất cả.</text>
</svg>
<figcaption>m05. Mũi tên liền là lời gọi; mũi tên đứt nghĩa là "implement". Không gì bên trong lục giác biết bên ngoài có gì.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound (port và adapter)</li><li data-part="outbound">Outbound (port và adapter)</li><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

**Sao lại là lục giác?** Không phải vì con số sáu. Cockburn viết: "Lục giác không phải lục giác vì con số sáu quan trọng, mà để người vẽ có chỗ chèn port và adapter khi họ cần". Ý của hình vẽ là có một bên trong, app core, và một bên ngoài, và bên ngoài chỉ nói chuyện với bên trong qua các port.
**Inbound** và **outbound** là tên khoá học dùng cho hai phía của Cockburn: một primary actor "điều khiển ứng dụng", và ứng dụng điều khiển một secondary actor. "Chúng cũng có thể được gọi là driving adapter và driven adapter." Bạn sẽ gặp *driving/driven* và *primary/secondary* trong các codebase khác; chúng nghĩa là inbound và outbound.

**Một luật cho chuyện code đặt ở đâu.** Code UI nằm trong màn hình. Một luật của app nằm trong một service. Bất cứ thứ gì nói chuyện với một nền tảng, một thư viện hay mạng nằm trong một outbound adapter, sau một outbound port. ViewModel chỉ nói chuyện với inbound port.
Và app core không import gì từ Android, iOS hay bất kỳ framework nào: chỉ thư viện chuẩn của Kotlin và kotlinx.coroutines, thứ có `Flow` là cách các port mô tả một luồng, cộng các package của chính core. Không `androidx`, không `platform.*`, không Koin hay Ktor.

Thử luật này. Mỗi thứ dưới đây thuộc về đâu?

<div class="sorter" data-buckets="màn hình|inbound adapter|app core|outbound adapter|composition root">
<div class="sort-item" data-answer="app core">
<span class="sort-label"><code>interface BleScanner { fun scan(): Flow&lt;Device&gt; }</code></span>
<p class="why">Một outbound port: thứ app cần, nói bằng ngôn ngữ của chính nó. Nó nằm trong core, ở <code>core.outbound</code>, vì mọi radio và mọi fake trong test đều implement nó, và core không được import cái nào trong số đó.</p>
</div>
<div class="sort-item" data-answer="outbound adapter">
<span class="sort-label"><code>class SimulatedBleScanner : BleScanner</code></span>
<p class="why">Một cách cụ thể để cung cấp thứ port hứa. Các radio thật của bài 13 cũng là outbound adapter, mỗi nền tảng một cái.</p>
</div>
<div class="sort-item" data-answer="app core">
<span class="sort-label">"Hiện mỗi thiết bị một lần, và chỉ những tên chứa chuỗi lọc"</span>
<p class="why">Một luật của app, giống nhau trên mọi màn hình và cả hai nền tảng, bất kể radio nào: một service, <code>ScanningService</code>.</p>
</div>
<div class="sort-item" data-answer="inbound adapter">
<span class="sort-label">"Sau 3 s, dừng quét và hiện những gì đã tìm thấy"</span>
<p class="why">Hành vi của màn hình này, với các state riêng của nó (<code>Scanning</code> → <code>Finished</code>): ViewModel. Một màn hình khác có thể quét với timeout khác, hoặc cho tới khi người dùng bấm Stop.</p>
</div>
<div class="sort-item" data-answer="màn hình">
<span class="sort-label">"Hiện dòng trạng thái màu đỏ khi không tìm thấy gì"</span>
<p class="why">State trông thế nào. ViewModel nói <code>Finished(emptyList())</code>, và mỗi nền tảng vẽ nó theo kiểu riêng.</p>
</div>
<div class="sort-item" data-answer="composition root">
<span class="sort-label">"Trong app này, <code>BleScanner</code> nghĩa là <code>SimulatedBleScanner</code>"</span>
<p class="why">Quyết định nối dây. Nó chỉ sống trong composition root: <code>AppContainer</code> hôm nay, module Koin của bài 11 sau đó. Đó là phép gắn (binding) mà bài 13 đổi sang các radio thật.</p>
</div>
<div class="sort-item" data-answer="outbound adapter">
<span class="sort-label">Class Swift của bài 13 điều khiển <code>CBCentralManager</code></span>
<p class="why">Một outbound adapter như cái giả lập, viết bằng Swift. Nó conform interface Kotlin <code>BleScanner</code>, thứ Swift thấy là một protocol trong header của framework.</p>
</div>
<p class="sort-score"></p>
</div>

!!! info "Từ TypeScript"
    Nếu bạn đã dùng Angular, bạn biết hình dạng này. Một port là một abstract class hay một `InjectionToken`; một adapter là `@Injectable` implement nó; constructor injection là `constructor(private scanning: DeviceScanning)`; và composition root là mảng `providers: [{ provide: BleScanner, useClass: SimulatedBleScanner }]`.
    Khác biệt là injector của Angular có sẵn, còn Kotlin không có: hôm nay bạn nối mọi thứ bằng tay, và bài 11 thêm Koin làm injector.

!!! note "Sidebar · đọc code kiểu Clean"
    Rất nhiều code Android, và rất nhiều thứ bạn sẽ đọc trên mạng, dùng các chữ của Clean Architecture. Chúng ứng gần đúng với lục giác:

    | Chữ của Clean | Lục giác (khoá này) | Khác biệt |
    |---|---|---|
    | **use case** (`ScanForDevicesUseCase`, mỗi hành động một class) | một **method của service** (`ScanningService.scan`) | mỗi năng lực một service giữ mọi hành động của nó, thay vì mỗi hành động một class |
    | **repository** (`DeviceRepository`) | một **outbound port**, cùng adapter của nó | repository thường là một class trong data layer; outbound port là một interface do app core sở hữu |
    | **input boundary** | một **inbound port** | cùng một ý: interface mà bên ngoài gọi, được implement bên trong |
    | domain layer · data layer · presentation layer | app core · outbound adapter · inbound adapter | lục giác có một bên trong và một bên ngoài, thay vì một chồng các tầng |

    Khi bạn đọc một class `…UseCase` trong code của team, hãy nghĩ "một method của service". Khi bạn đọc `…Repository`, hãy hỏi nó là outbound port nào.

## 3. Package: `core`, `inbound`, `outbound`

Các file chuyển vào những package đặt tên theo phần của chúng trong lục giác, nên mỗi dòng `import` cho thấy nó với vào phần nào. Năm file m04 trong package gốc (`Device.kt`, `DeviceListUiState.kt`, `DeviceListViewModel.kt`, `FakeDeviceScanner.kt`, `SampleDevices.kt`) bị xoá. `Greeting.kt` và các file `Platform*.kt` từ bài 05 ở nguyên chỗ cũ. Dưới `shared/src/commonMain/kotlin/com/example/devicemonitor/`:

<table>
<tr><th>Package</th><th>Phần</th><th>File</th></tr>
<tr data-part="core"><td><code>core</code></td><td>app core: model và service</td><td><code>Device.kt</code> · <code>ScanException.kt</code> · <code>ScanningService.kt</code></td></tr>
<tr data-part="inbound"><td><code>core.inbound</code></td><td>app core: inbound port</td><td><code>DeviceScanning.kt</code></td></tr>
<tr data-part="outbound"><td><code>core.outbound</code></td><td>app core: outbound port</td><td><code>BleScanner.kt</code></td></tr>
<tr data-part="inbound"><td><code>adapter.inbound</code></td><td>inbound adapter</td><td><code>DeviceListUiState.kt</code> · <code>DeviceListViewModel.kt</code></td></tr>
<tr data-part="outbound"><td><code>adapter.outbound</code></td><td>outbound adapter dùng chung</td><td><code>SimulatedBleScanner.kt</code> · <code>SampleDevices.kt</code></td></tr>
<tr><td><code>di</code></td><td>composition root</td><td><code>AppContainer.kt</code></td></tr>
</table>

**Sao lại là `inbound`/`outbound` mà không phải `in`/`out`?** Một số code lục giác bằng Java dùng `in` và `out`: ví dụ ứng dụng mẫu [BuckPal](https://github.com/thombergs/buckpal) có các package `application.port.in` và `adapter.out`. Trong Kotlin, `in` là một **hard keyword**: danh sách keyword của Kotlin nói hard keyword "luôn được hiểu là keyword và không dùng làm định danh được" ([Keywords and operators](https://kotlinlang.org/docs/keyword-reference.html)). Một package tên `core.in` không compile được:

```text
e: …/DeviceScanning.kt:1:40 Syntax error: Package name must be a '.'-separated identifier list.
```

Bạn có thể viết `` core.`in` `` trong dấu backtick, ở mọi dòng package và import. (`out` đứng riêng thì compile được: nó là một *modifier* keyword, thứ "dùng làm định danh được trong ngữ cảnh khác".) `inbound` và `outbound` không cần backtick, đọc lên đúng là những chữ khoá học dùng, và giữ hai cái tên cân xứng.

## 4. App core

Bắt đầu với model và lỗi. Cả hai là những chữ mà các port nói, nên chúng sống trong `core` và không phụ thuộc gì:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/Device.kt · ScanException.kt" hl_lines="1 7"
package com.example.devicemonitor.core

data class Device(val id: String, val name: String, val rssi: Int)
⋯ ScanException.kt, same package:
// A scan that failed, for example because the radio stopped responding. Outbound adapters
// throw it, and it reaches inbound adapters through DeviceScanning.
class ScanException(message: String) : Exception(message)
```

1. `Device` không đổi gì ngoài package của nó: một **model**, được mọi phần của app dùng.
2. `ScanException` chuyển ra khỏi radio giả. Adapter ném nó và ViewModel bắt nó, nên nó không thuộc về bên nào trong hai bên: nó là một phần của thứ cả hai port hứa.

Inbound port là thứ ViewModel cần từ app. Nhìn method duy nhất của nó: nó có đúng hình dạng của `FakeDeviceScanner.scan(filter)` ở m04. ViewModel vốn đã dùng hình dạng đó; giờ nó là một lời hứa thay vì một class.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceScanning.kt" hl_lines="5 8"
package com.example.devicemonitor.core.inbound
⋯ imports: core.Device, kotlinx.coroutines.flow.Flow
// Inbound port: what the app offers for finding devices. Inbound adapters (the shared
// ViewModels) call it, and ScanningService implements it.
interface DeviceScanning {
    // Devices whose name contains nameFilter, each reported once, as they are found.
    // Collecting starts a scan, and cancelling the collector stops it. Throws ScanException.
    fun scan(nameFilter: String): Flow<Device>
}
```

1. **Mỗi năng lực một inbound port, không phải mỗi hành động một port.** "Quét thiết bị" là một năng lực. Nếu sau này app cần dừng một lần quét từ một nút bấm hay kiểm tra radio có bật không, chúng thành method trên `DeviceScanning`, không phải port mới. App hoàn chỉnh có khoảng năm inbound port (mục 7).
2. **Bắt đầu và dừng là collect và cancel.** Một `Flow` là cold (bài 01): collect nó thì bắt đầu quét, và huỷ collector thì dừng. Nên lần quét không thể bị bỏ chạy mãi vì quên gọi `stopScan()`.
3. **Comment là hợp đồng.** Một interface không ép được "mỗi cái báo một lần"; service implement nó phải làm việc đó. Bài 11 biến comment này thành test.

Outbound port là thứ app cần từ một radio, và nó chỉ hứa những gì mọi radio làm được:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleScanner.kt" hl_lines="5 8"
package com.example.devicemonitor.core.outbound
⋯ imports: core.Device, kotlinx.coroutines.flow.Flow
// Outbound port: what the app needs from a Bluetooth radio, in the app's own terms.
// Outbound adapters implement it: a simulated radio for now, real ones from Lesson 13.
interface BleScanner {
    // Every device the radio hears, again with each advertisement it hears. Collecting
    // starts the radio scan, and cancelling the collector stops it. Throws ScanException.
    fun scan(): Flow<Device>
}
```

1. **Đặt tên theo ngôn ngữ của app.** `Flow<Device>`, không phải `ScanResult` của Android hay `CBPeripheral` của iOS. Mỗi adapter dịch kiểu của nền tảng nó sang kiểu của ta, nên core không bao giờ nhắc tới một nền tảng.
2. **Không có tham số lọc.** Bộ lọc quét có sẵn của các radio không làm được "tên chứa chuỗi này, không phân biệt hoa thường", nên port không hứa điều đó. Lọc là luật của app, và nó chuyển vào service. Bài 13 thêm những gì radio thật cần, như Bluetooth có đang bật không.
3. **Sao là interface mà không phải `expect`/`actual`?** `expect fun platformName()` của bài 05 cho đúng một implementation mỗi nền tảng, chọn lúc compile, và cái của iOS phải là Kotlin. Port này sẽ có nhiều cái: giả lập, một fake trong test, và các radio thật, một trong số đó bằng Swift.
   JetBrains cũng nói vậy: "Với interface, bạn không giới hạn thiết kế ở một implementation cho mỗi nền tảng đích. Hơn nữa, thay bằng một implementation giả trong test hay cung cấp nhiều implementation trên cùng một nền tảng dễ hơn nhiều" ([Expected and actual declarations](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)).

Service implement inbound port, giữ luật, và gọi outbound port:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanningService.kt" hl_lines="5 7 8 9 10"
package com.example.devicemonitor.core
⋯ imports: core.inbound.DeviceScanning, core.outbound.BleScanner, Flow, flow
// Service: the app's scan rule on top of a raw radio scan. Keep the devices whose name
// contains the filter (ignoring case and surrounding spaces), and report each device once.
class ScanningService(private val scanner: BleScanner) : DeviceScanning {
    override fun scan(nameFilter: String): Flow<Device> = flow {
        val wanted = nameFilter.trim()
        val seen = mutableSetOf<String>()
        scanner.scan().collect { device ->
            if (device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                emit(device)
            }
        }
    }
}
```

1. **`(private val scanner: BleScanner) : DeviceScanning`**: service nhận một outbound port qua constructor, và implement một inbound port. Nó không bao giờ tự tạo scanner. Đó là **constructor injection**, thứ mà hướng dẫn của Android định nghĩa là: "bạn lấy các dependency của một class và cung cấp chúng, thay vì để instance của class tự lấy" ([Dependency injection in Android](https://developer.android.com/training/dependency-injection)).
2. **`seen` được tạo bên trong `flow { }`**, nên mỗi lần collect, mỗi lần quét, bắt đầu với một set rỗng. Nếu là property của class, nó sẽ nhớ các thiết bị của lần quét trước và giấu hết chúng ở lần quét sau. Service không giữ state nào giữa các lần gọi.
3. **`seen.add(device.id)`** trả `true` chỉ ở lần đầu một id được thêm: một lời gọi vừa kiểm tra vừa ghi lại. Bộ lọc là luật của m04, trim một lần mỗi lần quét và không phân biệt hoa thường.
4. **Các import là bằng chứng.** File này import hai package của core và kotlinx.coroutines. Không gì trong nó phân biệt được một radio Android với một radio Swift hay một fake trong test.

## 5. Các adapter

Outbound adapter là radio giả, giờ thành thật rằng nó là một radio: nó nghe mọi thiết bị lặp đi lặp lại, như một radio thật có thể:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleScanner.kt" hl_lines="5 7"
package com.example.devicemonitor.adapter.outbound
⋯ imports: core.Device, core.outbound.BleScanner, delay, Flow, flow
// Outbound adapter: a pretend radio behind the BleScanner port. Like a real one, it hears
// every device over and over, one advertisement every 0.3 s, until the collector cancels.
class SimulatedBleScanner : BleScanner {
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

1. **`: BleScanner`** và `override`: một adapter cắm vào một port bằng cách implement nó. Không gì trong app core gọi tên class này, và ngoài package của nó chỉ composition root gọi.
2. **`while (true)`**: sau thiết bị thứ năm, ở 1,5 s, nó bắt đầu lại từ cái đầu tiên. Các hàng trên màn hình vẫn trông y như m04, năm hàng, vì service bỏ các lần lặp. Bài tự làm 3 cho thấy chuyện gì xảy ra khi không có luật đó.
3. `SampleDevices` chuyển vào cùng package, bỏ `matching`: bộ lọc giờ sống trong service. Danh sách `all` và `find(id)` của nó không đổi.

Inbound adapter là ViewModel. Chỉ hai thứ đổi: constructor của nó xin port, và `startScan` gọi port. Timeout, các bản copy và phần xử lý lỗi là của bài 08, từng dòng một.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt" hl_lines="6 13 20"
package com.example.devicemonitor.adapter.inbound
⋯ imports: androidx.lifecycle, core.Device, core.ScanException, core.inbound.DeviceScanning, coroutines
// Inbound adapter: turns the screen's events into calls on the DeviceScanning port, and
// the results into UI state. It knows the port only, never the service or a scanner.
class DeviceListViewModel(
    private val scanning: DeviceScanning,
) : ViewModel() {
⋯ _uiState, uiState, scanJob: as in m04
    fun startScan(filter: String) {
⋯ ignore while a scan runs; Scanning(emptyList()); launch; found
            try {
                withTimeoutOrNull(SCAN_TIMEOUT) {
                    scanning.scan(filter).collect { device ->
⋯ found += device; Scanning(found.toList())
                }
⋯ Finished(found.toList()); catch (e: ScanException) → Idle + errorMessage
    }
⋯ errorShown(): as in m04
    companion object {
        val SCAN_TIMEOUT = 3.seconds
    }
}
```

1. **`private val scanning: DeviceScanning`**: kiểu là inbound port. ViewModel có thể được đưa `ScanningService`, hoặc ở bài 11 một class riêng của test implement port đó, và nó không phân biệt được. Nó không import gì từ `core.outbound` hay `adapter.outbound`.
2. **`Factory` đã biến khỏi companion object.** Nó buộc phải gọi tên một scanner cụ thể, đúng thứ hiểu biết mà bài này chuyển ra ngoài. `SCAN_TIMEOUT` ở lại.
3. **Timeout 3 giây ở lại đây**, không phải trong service: đó là hành vi của màn hình này (trò phân loại ở mục 2). Luật quét đúng cho mọi màn hình thì nằm trong service.
4. `DeviceListUiState.kt` cũng chuyển vào `adapter.inbound`: UI state thuộc về ViewModel. Chỉ dòng package và import `Device` của nó đổi.

Đây là một lần quét, từ cú bấm tới radio và quay về:

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 270" role="img" aria-labelledby="l10-path-title">
<title id="l10-path-title">Một đường gọi ở m05, từ màn hình tới adapter và quay về. Hàng trên, các lời gọi, từ trái sang phải: người dùng bấm Scan trên màn hình; màn hình gọi DeviceListViewModel.startScan với chuỗi lọc; ViewModel collect DeviceScanning.scan với chuỗi lọc, một inbound port, chính là ScanningService.scan; service collect BleScanner.scan, một outbound port, chính là SimulatedBleScanner.scan. Hàng dưới, các thiết bị quay về, từ phải sang trái: radio giả lập phát mọi thiết bị mẫu, lặp đi lặp lại, mỗi 0,3 giây một cái; service giữ các tên chứa chuỗi lọc và bỏ các thiết bị nó đã thấy; ViewModel thêm từng thiết bị vào found và cập nhật uiState thành Scanning; màn hình vẽ lại danh sách. Sau 3 giây timeout của ViewModel huỷ việc collect, thứ dừng việc collect của service và radio giả lập, và state thành Finished.</title>
<defs><marker id="l10-path-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small" x="10" y="18" font-weight="600">lời gọi →</text>
<rect class="box" x="10" y="28" width="113" height="62" rx="6"/>
<text class="small" x="18" y="48">màn hình</text>
<text class="small muted" x="18" y="64">bấm Scan</text>
<g data-part="inbound">
<rect class="box" x="135" y="28" width="113" height="62" rx="6"/>
<text class="mono small" x="143" y="46">DeviceList</text>
<text class="mono small" x="143" y="60">ViewModel</text>
<text class="mono small" x="143" y="78">startScan(f)</text>
<rect class="box" x="260" y="28" width="113" height="62" rx="6"/>
<text class="mono small" x="268" y="46">DeviceScanning</text>
<text class="mono small" x="268" y="62">.scan(f)</text>
<text class="small muted" x="268" y="80">inbound port</text>
</g>
<g data-part="core">
<rect class="box" x="385" y="28" width="113" height="62" rx="6"/>
<text class="mono small" x="393" y="46">Scanning</text>
<text class="mono small" x="393" y="60">Service</text>
<text class="mono small" x="393" y="78">.scan(f)</text>
</g>
<g data-part="outbound">
<rect class="box" x="510" y="28" width="113" height="62" rx="6"/>
<text class="mono small" x="518" y="46">BleScanner</text>
<text class="mono small" x="518" y="62">.scan()</text>
<text class="small muted" x="518" y="80">outbound port</text>
<rect class="box" x="635" y="28" width="113" height="62" rx="6"/>
<text class="mono small" x="643" y="46">SimulatedBle</text>
<text class="mono small" x="643" y="60">Scanner</text>
<text class="mono small" x="643" y="78">.scan()</text>
</g>
<path class="edge" d="M123,59 L133,59" marker-end="url(#l10-path-arrow)"/>
<path class="edge" d="M248,59 L258,59" marker-end="url(#l10-path-arrow)"/>
<path class="edge" d="M373,59 L383,59" marker-end="url(#l10-path-arrow)"/>
<path class="edge" d="M498,59 L508,59" marker-end="url(#l10-path-arrow)"/>
<path class="edge" d="M623,59 L633,59" marker-end="url(#l10-path-arrow)"/>
<text class="small muted" x="268" y="106">port là một interface: lời gọi</text>
<text class="small muted" x="268" y="120">rơi vào thứ implement nó</text>
<text class="small" x="10" y="146" font-weight="600">← thiết bị</text>
<path class="edge" d="M748,160 L12,160" marker-end="url(#l10-path-arrow)"/>
<text class="small" x="635" y="180">phát mọi thiết bị</text>
<text class="small" x="635" y="194">mẫu, lặp đi lặp</text>
<text class="small" x="635" y="208">lại, mỗi 0,3 s</text>
<text class="small" x="385" y="180">giữ tên có chuỗi lọc,</text>
<text class="small" x="385" y="194">bỏ thiết bị đã</text>
<text class="small" x="385" y="208">thấy rồi</text>
<text class="small" x="135" y="180">thêm từng cái vào found,</text>
<text class="small" x="135" y="194">uiState = Scanning</text>
<text class="small" x="10" y="180">vẽ lại</text>
<text class="small" x="10" y="194">danh sách</text>
<text class="small muted" x="10" y="240">Ở 3 s, timeout của ViewModel huỷ việc collect của nó. Việc huỷ lan sang phải: việc collect của service và radio</text>
<text class="small muted" x="10" y="254">cũng dừng, và uiState thành Finished. Không ai gọi một hàm stop nào.</text>
</svg>
<figcaption>Lời gọi đi sang phải, qua hai port; thiết bị quay về bên trái. ViewModel chỉ biết <code>DeviceScanning</code>, và service chỉ biết <code>BleScanner</code>.
<ul class="legend"><li data-part="inbound">Inbound</li><li data-part="core">App core</li><li data-part="outbound">Outbound</li></ul>
</figcaption>
</figure>

## 6. Nối bằng tay

Vẫn phải có ai đó chọn adapter và gọi các constructor. Hướng dẫn [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual) của Android gọi ai đó là một *dependencies container*, một class "mà bạn dùng để lấy các dependency". Chỗ duy nhất nơi cả đồ thị object được dựng lên gọi là **composition root**. Của ta là một `object` Kotlin trong code dùng chung, nên cả hai nền tảng có cùng cách nối:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppContainer.kt" hl_lines="6 7 10"
package com.example.devicemonitor.di
⋯ imports: the ViewModel, SimulatedBleScanner, ScanningService, both ports, and the factory helpers
// The composition root, wired by hand: the one place that knows which service implements
// each inbound port and which adapter implements each outbound port.
object AppContainer {
    private val bleScanner: BleScanner by lazy { SimulatedBleScanner() }
    private val deviceScanning: DeviceScanning by lazy { ScanningService(bleScanner) }

    val deviceListViewModelFactory: ViewModelProvider.Factory = viewModelFactory {
        initializer { DeviceListViewModel(deviceScanning) }
    }
}
```

1. **File duy nhất có code gọi tên `SimulatedBleScanner` và `ScanningService`**, ngoài file của chính chúng. Từ bài 11 cách nối này chuyển vào một module Koin, và ở bài 13 phép gắn scanner ở đó thành "radio Android trên Android, radio Swift trên iOS". Một quyết định, chỉ đưa ra trong composition root.
2. **Kiểu của mỗi property là port** (`BleScanner`, `DeviceScanning`), và giá trị của nó là thứ implement port đó. Đọc mỗi dòng như một phép gắn: "port này nghĩa là class này".
3. **`by lazy`** tạo mỗi cái ở lần dùng đầu rồi dùng lại, nên cả app dùng chung một radio và một service. Một màn hình mở hai lần không được quét bằng hai radio. Dùng chung service là an toàn vì nó không giữ state giữa các lần quét (mục 4).
4. **Factory** là cái mà companion object của bài 08 từng có, chuyển về đây. ViewModel store vẫn giữ ViewModel; factory chỉ chạy khi store chưa có cái nào. Bạn tự viết thứ tự: scanner, rồi service, rồi ViewModel.
   Android liệt kê đó là cái giá đầu tiên của việc nối bằng tay: "Dependency phải được khai báo theo thứ tự". Đổi lại, thiếu một dependency là lỗi compile. Bài 11 đổi cái đó lấy Koin.

Mỗi màn hình đổi dòng lấy ViewModel:

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="2 3 4 5 11"
    ⋯ package and the androidx imports, as in m04
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.ScanState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.di.AppContainer

    // Stateful: owns the filter text and connects the shared ViewModel to the content below.
    @Composable
    fun DeviceListScreen(
        onDeviceClick: (Device) -> Unit,
        viewModel: DeviceListViewModel = viewModel(factory = AppContainer.deviceListViewModelFactory),
    ) {
    ⋯ the rest of the file: unchanged from m04
    ```

    `DeviceDetailScreen.kt` đổi một import, thành `com.example.devicemonitor.adapter.outbound.SampleDevices` (xem gotcha bên dưới).

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="2 3 4 6 12"
    ⋯ package, android and androidx imports, as in m04
    import com.example.devicemonitor.adapter.inbound.DeviceListUiState
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.ScanState
    import com.example.devicemonitor.android.databinding.FragmentDeviceListBinding
    import com.example.devicemonitor.di.AppContainer
    import kotlinx.coroutines.launch

    class DeviceListFragment : Fragment() {
        // Survives rotation and the trip to the detail screen; cleared when this
        // Fragment leaves the back stack for good.
        private val viewModel: DeviceListViewModel by viewModels { AppContainer.deviceListViewModelFactory }
    ⋯ the rest of the file: unchanged from m04
    ```

    Hai file nữa đổi mỗi file một import, giữ cho import được sắp xếp: `DeviceAdapter.kt` import `com.example.devicemonitor.core.Device` (sau import `…android.databinding`), và `DeviceDetailFragment.kt` import `com.example.devicemonitor.adapter.outbound.SampleDevices` (trước nó).

<!-- iOS -->

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="3"
    ⋯ imports and properties, as in m04
        var body: some View {
            let viewModel: DeviceListViewModel = owner.viewModel(factory: AppContainer.shared.deviceListViewModelFactory)
    ⋯ the rest of the file: unchanged from m04
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="4"
    ⋯ imports
    final class DeviceListViewController: UIViewController, UITableViewDelegate {
        private let owner = ViewModelOwner()
        private lazy var viewModel: DeviceListViewModel = owner.viewModel(factory: AppContainer.shared.deviceListViewModelFactory)
    ⋯ the rest of the file: unchanged from m04
    ```

Swift không cần đổi import nào. Package Kotlin không tới được header Objective-C, nên `Device`, `SampleDevices` và `ScanState` giữ nguyên tên Swift của chúng, và một `object` Kotlin được truy cập qua `.shared` (bài 05). Các port cũng ở đó: header khai báo `BleScanner` và `DeviceScanning` là các protocol Objective-C, thứ Swift thấy là protocol. Đó là thứ cho phép radio Swift của bài 13 implement `BleScanner`.

**Đổi adapter.** Đây là thứ cấu trúc này mua được. Để thấy lại dialog lỗi, thay radio bằng một dòng, chạy một trong hai app, bấm Scan, rồi đặt dòng cũ trở lại:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppContainer.kt (temporary)" hl_lines="2 3 4 5"
    private val bleScanner: BleScanner by lazy {
        object : BleScanner {
            override fun scan(): Flow<Device> = flow {
                delay(500)
                throw ScanException("Bluetooth adapter not responding (simulated).")
            }
        }
    }
```

(Nó cần import cho `Flow`, `flow`, `delay`, `Device` và `ScanException`, và import `SimulatedBleScanner` không được dùng cho tới khi bạn đặt dòng cũ lại.) Sau 0,5 s dialog "Scan failed" hiện ra, như chuỗi lọc `fail` của m04. Không file nào khác đổi: không service, không ViewModel, không màn hình. Exception đi sang trái theo đường ở mục 5, qua service, tới `catch` của ViewModel.

!!! warning "Gotcha · một lối tắt đã biết, cố ý giữ lại cho tới các bài BLE"
    Các màn hình chi tiết vẫn tra thiết bị bằng `SampleDevices.find(id)`, và cell provider của danh sách UIKit cũng vậy. Trên Android bạn thấy nó trong import, `com.example.devicemonitor.adapter.outbound.SampleDevices`: một màn hình với thẳng vào một outbound adapter, vượt qua mọi port. Swift không cho manh mối như vậy, vì package Kotlin không tới được header.
    Nó chỉ chạy được vì các thiết bị của radio giả lập là một danh sách cố định. Khi màn hình chi tiết thành màn hình kết nối trong các bài BLE, nó có ViewModel và port riêng, và lối tắt biến mất.
    Package làm cho một lối tắt như vậy hiện ra, nhưng không cấm được nó: Kotlin không có visibility package-private ([Visibility modifiers](https://kotlinlang.org/docs/visibility-modifiers.html)), nên file nào cũng import được bất kỳ class public nào.

## 7. App hoàn chỉnh, và cách thêm thứ mới

m05 có một port ở mỗi phía. Kế hoạch cho app hoàn chỉnh (m15) có năm inbound port, mỗi năng lực một cái, và tám outbound port. Các tên lấy từ kế hoạch khoá học và có thể được chỉnh lại trong các bài dựng chúng, nhưng hình dạng sẽ không đổi:

<figure class="diagram">
<svg class="dg" viewBox="0 0 760 380" role="img" aria-labelledby="l10-final-title">
<title id="l10-final-title">Lục giác của app hoàn chỉnh, theo kế hoạch. Bên trái, các inbound adapter: các ViewModel dùng chung, mỗi màn hình một cái, và test từ bài 11. Chúng gọi năm inbound port của app core: DeviceScanning, DeviceSession, PermissionAccess, StatusReport và DeviceMonitoring. Mỗi port được một service implement, và các model gồm Device, ConnectionState, DeviceStatus và LogRecord. Các service gọi tám outbound port: BleScanner, BleConnection, PermissionChecker, BatteryProvider, NetworkProvider, BluetoothProvider, LogStore và MonitorScheduler. Bên phải, các outbound adapter implement chúng: trên Android, Kotlin trong androidMain cho radio BLE, quyền và WorkManager; dùng chung trong commonMain, scanner giả lập và ở bài mở rộng E1 một HTTP client Ktor; trên iOS, Swift trong app iOS cho CoreBluetooth và BGTaskScheduler, cộng một adapter Kotlin/Native trong iosMain, kho log. Mọi thứ được nối ở một chỗ: bằng tay hôm nay, bằng Koin từ bài 11.</title>
<defs><marker id="l10-final-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="inbound">
<rect class="box" x="10" y="110" width="160" height="140" rx="6"/>
<text class="title small" x="20" y="132">inbound adapter</text>
<text class="small" x="20" y="156">ViewModel dùng chung,</text>
<text class="small" x="20" y="172">mỗi màn hình một cái</text>
<text class="small" x="20" y="200">test (bài 11)</text>
</g>
<g data-part="core">
<polygon class="box" points="190,180 240,30 520,30 570,180 520,330 240,330"/>
<text class="title" x="380" y="55" text-anchor="middle">App core</text>
</g>
<g data-part="inbound">
<text class="title small" x="236" y="88">inbound port</text>
</g>
<text class="mono small" x="236" y="106">DeviceScanning</text>
<text class="mono small" x="236" y="122">DeviceSession</text>
<text class="mono small" x="236" y="138">PermissionAccess</text>
<text class="mono small" x="236" y="154">StatusReport</text>
<text class="mono small" x="236" y="170">DeviceMonitoring</text>
<g data-part="outbound">
<text class="title small" x="400" y="88">outbound port</text>
</g>
<text class="mono small" x="400" y="106">BleScanner</text>
<text class="mono small" x="400" y="122">BleConnection</text>
<text class="mono small" x="400" y="138">PermissionChecker</text>
<text class="mono small" x="400" y="154">BatteryProvider</text>
<text class="mono small" x="400" y="170">NetworkProvider</text>
<text class="mono small" x="400" y="186">BluetoothProvider</text>
<text class="mono small" x="400" y="202">LogStore</text>
<text class="mono small" x="400" y="218">MonitorScheduler</text>
<g data-part="core">
<text class="title small" x="236" y="208">service</text>
</g>
<text class="small" x="236" y="224">mỗi inbound port một cái</text>
<text class="small muted" x="380" y="270" text-anchor="middle">model: Device · ConnectionState ·</text>
<text class="small muted" x="380" y="285" text-anchor="middle">DeviceStatus · LogRecord …</text>
<g data-part="android">
<rect class="box" x="590" y="30" width="160" height="90" rx="6"/>
<text class="title small" x="600" y="50">Android, Kotlin</text>
<text class="small muted" x="600" y="66">androidMain</text>
<text class="small" x="600" y="86">radio BLE · quyền</text>
<text class="small" x="600" y="102">WorkManager</text>
</g>
<g data-part="outbound">
<rect class="box" x="590" y="135" width="160" height="80" rx="6"/>
<text class="title small" x="600" y="155">dùng chung, Kotlin</text>
<text class="small muted" x="600" y="171">commonMain</text>
<text class="small" x="600" y="189">scanner giả lập</text>
<text class="small" x="600" y="205">HTTP client Ktor (E1)</text>
</g>
<g data-part="ios">
<rect class="box" x="590" y="230" width="160" height="100" rx="6"/>
<text class="title small" x="600" y="250">iOS, Swift</text>
<text class="small muted" x="600" y="266">app iOS</text>
<text class="small" x="600" y="284">CoreBluetooth</text>
<text class="small" x="600" y="300">BGTaskScheduler</text>
<text class="small muted" x="600" y="320">+ kho log: Kotlin, iosMain</text>
</g>
<path class="edge" d="M170,180 L190,180" marker-end="url(#l10-final-arrow)"/>
<path class="edge dashed" d="M588,75 L548,110" marker-end="url(#l10-final-arrow)"/>
<path class="edge dashed" d="M588,175 L572,175" marker-end="url(#l10-final-arrow)"/>
<path class="edge dashed" d="M588,280 L548,250" marker-end="url(#l10-final-arrow)"/>
<text class="small muted" x="10" y="360">Outbound adapter implement outbound port (nét đứt). Mọi thứ được nối ở một chỗ: bằng tay trong AppContainer</text>
<text class="small muted" x="10" y="374">hôm nay, và bằng Koin từ bài 11, thứ gắn mỗi inbound port với service của nó, mỗi outbound port với adapter của nó.</text>
</svg>
<figcaption>App hoàn chỉnh, theo kế hoạch. Outbound adapter mang màu của nơi chúng được viết: Android, dùng chung, hoặc iOS.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound</li><li data-part="outbound">Outbound (adapter dùng chung)</li><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

Mọi thay đổi bạn sẽ làm cho app sau khoá học thuộc một trong bốn loại. Mỗi loại có một công thức cố định:

| Bạn đang thêm… | Bạn viết gì | Bạn không đụng vào gì |
|---|---|---|
| **một màn hình mới** (ví dụ, danh sách các lần quét gần đây) | một **inbound adapter**: một ViewModel và UI state của nó trong `adapter.inbound`, gọi các inbound port đã có; một factory cho nó trong composition root; màn hình trên mỗi track UI | app core |
| **một luật nghiệp vụ mới** (ví dụ, giấu các thiết bị yếu hơn −80 dBm) | **service** sở hữu năng lực đó, và từ bài 11 một test qua inbound port của nó | port, adapter, ViewModel, màn hình |
| **một năng lực nền tảng mới** (ví dụ, mức pin của điện thoại) | **cả hai loại port**: một outbound port theo ngôn ngữ của app (`BatteryProvider`) với một adapter cho mỗi nền tảng (Kotlin trong `androidMain`, Swift trong app iOS); một method của inbound port và một service dùng nó (port mới chỉ khi là năng lực mới); các phép gắn trong composition root | các service đã có mà không cần nó |
| **một request API mới** (ví dụ, upload log) | một **outbound port đặt tên theo thứ app cần** (`LogUploader`, không bao giờ là `ApiClient` hay `HttpClient`), một HTTP adapter dùng chung trong `adapter.outbound` giữ HTTP client, và phép gắn | app core không bao giờ nhắc tới HTTP, JSON hay URL |

Dòng cuối là dòng hay bị làm sai nhất. Nếu port tên là `ApiClient` với `get(url)`, app core bắt đầu dựng URL và parse JSON, và luật "core không import framework nào" lặng lẽ bị phá. Đặt tên port theo công việc, và chi tiết HTTP ở lại trong adapter.

## 8. Thực tế xảy ra gì

Chúng tôi build m05 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, Lifecycle 2.11.0, coroutines 1.11.0, AGP 9.4.1, Xcode 26.2) và chạy nó trên emulator Android 16 và simulator iOS 26.2.
Cả hai app hoạt động như m04: các hàng tới từng cái một dưới "Scanning…", và dòng trạng thái ghi "Devices found: 5" ở 3 s, dù lúc đó radio giả lập đã bắt đầu lặp lại mọi thiết bị. Chuỗi lọc `sens` tìm thấy Tire Pressure Sensor; `fail` giờ không tìm thấy gì và hiện "No devices found. Try another filter."; adapter luôn lỗi ở mục 6 hiện dialog "Scan failed". Các bản build không in warning compiler nào từ code của ta.

**m05 là một điểm dừng tự nhiên.** Nó xong khi cả hai app build được và hoạt động như mô tả, và các import của app core chỉ là các package `core` và kotlinx.coroutines. Hãy commit nó trước bài tiếp theo, bài test app core qua inbound port của nó.

!!! question "Hỏi agent của bạn"
    Nhờ agent liệt kê mọi dòng `import` trong `shared/src/commonMain/kotlin/com/example/devicemonitor/core/` và giải thích vì sao mỗi dòng được phép.
    Rồi hỏi: *"If I wanted the scan to stop after 10 devices on every screen, which file would change, and why not the ViewModel?"* (Nếu tôi muốn lần quét dừng sau 10 thiết bị trên mọi màn hình, file nào sẽ đổi, và vì sao không phải ViewModel?) Kiểm tra câu trả lời của nó với công thức ở mục 7.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao <code>BleScanner</code> sống trong app core, chứ không ở cùng các adapter của nó?</p>
<div class="opts">
<button class="opt">để Android và iOS mỗi bên định nghĩa phiên bản riêng của nó</button>
<button class="opt">vì SKIE chỉ export interface từ package core</button>
<button class="opt" data-correct>service gọi nó, và app core không import gì bên ngoài nó</button>
</div>
<p class="feedback"></p>
<p class="why">Core dùng port, nên port phải hiện ra với core. Các adapter, kể cả class Swift của bài 13, phụ thuộc vào port, không bao giờ theo chiều ngược lại.</p>
</div>

<div class="quiz">
<p class="q">Constructor của <code>DeviceListViewModel</code> xin gì?</p>
<div class="opts">
<button class="opt" data-correct>DeviceScanning, inbound port</button>
<button class="opt">ScanningService, class giữ luật</button>
<button class="opt">BleScanner, để nó chọn một radio</button>
</div>
<p class="feedback"></p>
<p class="why">ViewModel chỉ nói chuyện với inbound port. Chúng không biết service nào implement port, và không bao giờ thấy một outbound port.</p>
</div>

<div class="quiz">
<p class="q">Vì sao các package tên là <code>inbound</code> và <code>outbound</code> chứ không phải <code>in</code> và <code>out</code>?</p>
<div class="opts">
<button class="opt">tên package Kotlin phải dài ít nhất ba ký tự</button>
<button class="opt" data-correct><code>in</code> là hard keyword, nên <code>core.in</code> là lỗi cú pháp</button>
<button class="opt">Swift giữ chỗ <code>in</code> và <code>out</code> trong header của framework</button>
</div>
<p class="feedback"></p>
<p class="why">Hard keyword không làm định danh được; bạn sẽ cần backtick ở mọi dòng package và import. <code>out</code> đứng riêng thì compile được (một modifier keyword), nhưng cặp tên được giữ cân xứng.</p>
</div>

<div class="quiz">
<p class="q">Team muốn giấu các thiết bị yếu hơn −80 dBm trên mọi màn hình. File nào đổi?</p>
<div class="opts">
<button class="opt">SimulatedBleScanner, thứ biết tín hiệu của mỗi thiết bị</button>
<button class="opt">DeviceListViewModel, thứ dựng danh sách</button>
<button class="opt" data-correct>ScanningService, thứ sở hữu luật quét</button>
</div>
<p class="feedback"></p>
<p class="why">Đó là một luật của app, đúng cho mọi màn hình và mọi radio: service. Trong adapter nó sẽ biến mất khi bài 13 đổi radio; trong ViewModel, mỗi màn hình mới lại cần nó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>seen</code> được tạo bên trong <code>flow { }</code> chứ không phải là property của <code>ScanningService</code>?</p>
<div class="opts">
<button class="opt">không sửa được một property bên trong một flow</button>
<button class="opt" data-correct>mỗi lần quét phải bắt đầu với một set rỗng</button>
<button class="opt">set không thread-safe khi là thành viên của class</button>
</div>
<p class="feedback"></p>
<p class="why">Service được dùng chung toàn app. Là property, <code>seen</code> sẽ sống lâu hơn lần quét, và lần quét thứ hai sẽ coi mọi thiết bị của lần đầu là đã thấy và không hiện gì.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q"><code>expect</code>/<code>actual</code> cho bạn điều gì khiến nó bị loại cho <code>BleScanner</code>? (Bài 05)</p>
<div class="opts">
<button class="opt" data-correct>một implementation Kotlin cho mỗi nền tảng, chọn lúc compile</button>
<button class="opt">một implementation được chọn lúc chạy từ một registry</button>
<button class="opt">một protocol Swift mà iOS phải implement bằng Swift</button>
</div>
<p class="feedback"></p>
<p class="why">Scanner cần nhiều implementation cùng lúc (giả lập, một fake trong test, các radio thật), và cái của iOS là Swift. Một interface cho phép cả hai.</p>
</div>

<div class="quiz">
<p class="q"><code>viewModel(factory = AppContainer.deviceListViewModelFactory)</code> chạy ở mỗi lần recompose. Nó tạo bao nhiêu ViewModel trong lúc danh sách còn trên back stack? (Bài 08)</p>
<div class="opts">
<button class="opt">mỗi lần recompose một cái, rồi các cái cũ bị clear</button>
<button class="opt" data-correct>một: sau đó store trả về cùng instance</button>
<button class="opt">mỗi lần xoay máy một cái, vì Activity được tạo lại</button>
</div>
<p class="feedback"></p>
<p class="why"><code>ViewModelStore</code> của mục điều hướng giữ ViewModel. Factory chỉ chạy khi store chưa có cái nào, nên chuyển factory vào <code>AppContainer</code> không đổi gì về vòng đời.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m05 của bạn)"
    1. **Một luật nghiệp vụ mới.** Làm cho app giấu các thiết bị yếu hơn −80 dBm. Trước khi viết code, ghi ra những file bạn nghĩ sẽ đổi, dùng công thức ở mục 7. Làm thay đổi đó, chạy cả hai app (thiết bị nào biến mất?), và kiểm tra bằng `git diff --stat` rằng chỉ những file bạn đoán là đổi. Rồi hoàn tác nó.
    2. **Nó đặt ở đâu?** Trên giấy, với mỗi tính năng dưới đây, gọi tên phần của lục giác, package, và các file bạn sẽ thêm hay đổi trên mỗi nền tảng: (a) một màn hình hiện năm thiết bị được thấy gần đây nhất; (b) "không bao giờ hiện thiết bị có tên rỗng"; (c) hiện Bluetooth của điện thoại có đang bật không; (d) gửi kết quả mỗi lần quét lên server của team. Rồi kiểm tra từng câu trả lời với bảng công thức, và ghi ra một thứ bạn đã đặt sai chỗ.
    3. **App không có luật.** Trong `ScanningService`, xoá `&& seen.add(device.id)`. Trước khi chạy, đoán mỗi app của bạn hiện gì khi bạn bấm Scan và chờ 3 s: bao nhiêu hàng, và có gì crash không? (Nghĩ về stable key của bài 07.) Chạy cả hai app, ghi ra chuyện gì thật sự xảy ra trên mỗi nền tảng và vì sao, rồi đặt luật lại.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/10-the-hexagon.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/10-the-hexagon.html" -o .course/lesson-10.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Lesson 09, which this brief's warning list points to; skipped if it's already there:
  [ -f .course/lesson-09.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html" -o .course/lesson-09.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 10 (The hexagon): build milestone m05, the shared code restructured as an app core with
ports, plus adapters, wired by hand, on top of m04.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m04 project in demo/ (Lesson 09). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. In shared/src/commonMain/kotlin/com/example/devicemonitor/:
     delete: Device.kt, DeviceListUiState.kt, DeviceListViewModel.kt, FakeDeviceScanner.kt,
       SampleDevices.kt (the root package's copies)
     add (app core):      core/Device.kt, core/ScanException.kt, core/ScanningService.kt,
                          core/inbound/DeviceScanning.kt, core/outbound/BleScanner.kt
     add (adapters):      adapter/inbound/DeviceListUiState.kt, adapter/inbound/DeviceListViewModel.kt,
                          adapter/outbound/SimulatedBleScanner.kt, adapter/outbound/SampleDevices.kt
     add (wiring):        di/AppContainer.kt
   Greeting.kt and Platform.kt (commonMain), the Platform files in androidMain and iosMain,
   ViewModelResolver.kt (iosMain) and both build files stay as in m04.

2. Screens, one line each to get the ViewModel from AppContainer, plus imports on Android:
     Compose: androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt and
       DeviceDetailScreen.kt: replaced.
     XML: androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt,
       DeviceAdapter.kt and DeviceDetailFragment.kt: replaced.
     SwiftUI: iosApp/iosApp/DeviceListView.swift: replaced.
     UIKit: iosApp/iosApp/DeviceListViewController.swift: replaced.
   Every other Android and iOS file stays as in m04.

3. Build both apps.
   Android, from demo/:
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
- Both builds succeed with no compiler warnings from our own Kotlin or Swift code, including
  the Kotlin/Native link step that runs inside the Xcode build (don't use -q to check warnings;
  read the build output). Not from our code, and expected: SKIE's "Configuration '…' was
  resolved during configuration time" lines and the SLF4J "Failed to load class" lines
  (Lesson 09, section 2); Gradle's "Deprecated Gradle features … Gradle 10" line, "Unable to
  strip the following libraries" from the Android build, Xcode's "appintentsmetadataprocessor
  … warning: Metadata extraction skipped", and xcodebuild's "WARNING: Using the first of
  multiple matching destinations". Xcode "note:" lines are not warnings. The SLF4J lines
  appear only when the framework is rebuilt, so a build may have none.
- The app core imports nothing from Android, iOS or any framework:
    grep -rh "^import" shared/src/commonMain/kotlin/com/example/devicemonitor/core | sort -u
  prints only com.example.devicemonitor.core… and kotlinx.coroutines… lines.
- Only the composition root names the service and the adapter: outside build/ folders,
    grep -rn "SimulatedBleScanner\|ScanningService" --include='*.kt' --include='*.swift' .
  finds them only in their own files, in di/AppContainer.kt, and in the comment at the top of
  core/inbound/DeviceScanning.kt (quote the --include patterns: zsh expands them otherwise).
  The ViewModel file imports
  nothing from core.outbound or adapter.outbound. Nothing is left of m04's wiring:
    grep -rn 'FakeDeviceScanner\|DeviceListViewModel\.\(companion\.\)\?Factory' --include='*.kt' --include='*.swift' .
  finds nothing (ViewModelProvider.Factory and deviceListViewModelFactory are fine).
- Launch: as m04 (the title "Device Monitor", a "Device name filter" field, a full-width Scan
  button, "Tap Scan to look for devices." and an empty list). The XML button shows "SCAN" in
  capitals (Material's style), so match that text when automating.
- Tap Scan: the button is disabled, a spinner + "Scanning…" show in the normal (not red)
  colour, and rows appear one at a time (~0.3 s apart) in SampleDevices order. After ~3 s the
  status reads "Devices found: 5" (not more: the simulated radio repeats devices from about
  1.8 s on, and the service drops the repeats) and the button is enabled again.
- Filter "sens" + Scan: one row (Tire Pressure Sensor). Filter "zzz" + Scan: "Scanning…" for
  ~3 s, then the red "No devices found. Try another filter."
- Filter "fail" + Scan: no dialog any more; it behaves like "zzz" (the m04 test hook is gone).
- Error path, temporary: copy di/AppContainer.kt aside first (or rely on git). In it, replace SimulatedBleScanner() with the failing
  object from the lesson's section 6 ("Swap the adapter"), with the imports it needs. Rebuild
  both apps and tap Scan: after ~0.5 s (allow ~1 s when an XCUITest drives it) a "Scan failed" dialog/alert with "Bluetooth adapter not
  responding (simulated)."; OK closes it, and the status reads "Tap Scan to look for devices."
  Then restore the file exactly as in Full files, rebuild, and check that Scan finds 5 again.
- Rows open the detail screen (name, ID, signal); Back returns to the list with the results
  still shown.
- Android, driving the emulator: after launching, wait until a uiautomator dump shows the Scan
  button before the first tap. Tap the filter field and use `adb shell input text`; find
  coordinates with `adb shell uiautomator dump`. A dump takes about 2 s, so judge mid-scan
  states (rows arriving, "Scanning…") from `adb exec-out screencap -p` screenshots instead. A
  screencap takes up to ~0.9 s, so for rows arriving 0.3 s apart use `adb shell screenrecord`.
- iOS timing: an XCUITest query also takes about 0.3 s, so judge the rows arriving one at a
  time from a sequence of screenshots (XCUIScreen.main.screenshot() in a loop), not by polling.
- iOS: if you can drive the simulator (xcrun simctl has no tap command; idb or a throwaway
  XCUITest that launches the installed app by bundle ID can. Don't script the Simulator window
  with System Events: its clicks and keystrokes are unreliable), run the Scan, filter, error
  and row-tap checks above. In automation, the status text ends in the single character "…",
  not three dots. If you can't, say so and list which iOS checks you didn't run.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each part of the lesson's m05 hexagon diagram is in the code. Do NOT
do the unaided exercise for me.
```

## Đọc thêm

- Alistair Cockburn, [Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) (nguồn chính): mục đích, port, adapter, và primary/secondary actor.
- JetBrains: [Expected and actual declarations](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html), mục về interface và các khuyến nghị về dependency injection của nó.
- Android: [Dependency injection in Android](https://developer.android.com/training/dependency-injection) và [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual), trang dựng một `AppContainer` từng bước và liệt kê những gì hỏng khi nó lớn lên (vấn đề mà Koin của bài 11 giải quyết).
- Kotlin: [Keywords and operators](https://kotlinlang.org/docs/keyword-reference.html), hard keyword so với modifier keyword.
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html): các thuật ngữ lục giác của bài này được đánh dấu (10).

## File đầy đủ

Mọi file bài này thêm hay đổi, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Năm file bị xoá, tất cả trong `shared/src/commonMain/kotlin/com/example/devicemonitor/`: `Device.kt`, `DeviceListUiState.kt`, `DeviceListViewModel.kt`, `FakeDeviceScanner.kt` và `SampleDevices.kt`. Mọi thứ khác giữ như ở m04, kể cả cả hai file build. Ở bản gốc mỗi file mang màu của phần app chứa nó; composition root không mang màu nào.

**Dùng chung cho mọi track**

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/Device.kt"
    ```kotlin
    package com.example.devicemonitor.core

    data class Device(val id: String, val name: String, val rssi: Int)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A scan that failed, for example because the radio stopped responding. Outbound adapters
    // throw it, and it reaches inbound adapters through DeviceScanning.
    class ScanException(message: String) : Exception(message)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceScanning.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Inbound port: what the app offers for finding devices. Inbound adapters (the shared
    // ViewModels) call it, and ScanningService implements it.
    interface DeviceScanning {
        // Devices whose name contains nameFilter, each reported once, as they are found.
        // Collecting starts a scan, and cancelling the collector stops it. Throws ScanException.
        fun scan(nameFilter: String): Flow<Device>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleScanner.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.Device
    import kotlinx.coroutines.flow.Flow

    // Outbound port: what the app needs from a Bluetooth radio, in the app's own terms.
    // Outbound adapters implement it: a simulated radio for now, real ones from Lesson 13.
    interface BleScanner {
        // Every device the radio hears, again with each advertisement it hears. Collecting
        // starts the radio scan, and cancelling the collector stops it. Throws ScanException.
        fun scan(): Flow<Device>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ScanningService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.outbound.BleScanner
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.flow

    // Service: the app's scan rule on top of a raw radio scan. Keep the devices whose name
    // contains the filter (ignoring case and surrounding spaces), and report each device once.
    class ScanningService(private val scanner: BleScanner) : DeviceScanning {
        override fun scan(nameFilter: String): Flow<Device> = flow {
            val wanted = nameFilter.trim()
            val seen = mutableSetOf<String>()
            scanner.scan().collect { device ->
                if (device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) {
                    emit(device)
                }
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.Device

    // Everything the device list shows that the user didn't type.
    data class DeviceListUiState(
        val scan: ScanState = ScanState.Idle,
        val errorMessage: String? = null,
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
    import com.example.devicemonitor.core.ScanException
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.withTimeoutOrNull
    import kotlin.time.Duration.Companion.seconds

    // Inbound adapter: turns the screen's events into calls on the DeviceScanning port, and
    // the results into UI state. It knows the port only, never the service or a scanner.
    class DeviceListViewModel(
        private val scanning: DeviceScanning,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(DeviceListUiState())
        val uiState: StateFlow<DeviceListUiState> = _uiState.asStateFlow()

        private var scanJob: Job? = null

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

        fun errorShown() {
            _uiState.update { it.copy(errorMessage = null) }
        }

        companion object {
            val SCAN_TIMEOUT = 3.seconds
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
    class SimulatedBleScanner : BleScanner {
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

    // The devices the simulated radio "hears", until Lesson 13 brings a real one.
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

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppContainer.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import androidx.lifecycle.ViewModelProvider
    import androidx.lifecycle.viewmodel.initializer
    import androidx.lifecycle.viewmodel.viewModelFactory
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.outbound.SimulatedBleScanner
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.outbound.BleScanner

    // The composition root, wired by hand: the one place that knows which service implements
    // each inbound port and which adapter implements each outbound port.
    object AppContainer {
        private val bleScanner: BleScanner by lazy { SimulatedBleScanner() }
        private val deviceScanning: DeviceScanning by lazy { ScanningService(bleScanner) }

        val deviceListViewModelFactory: ViewModelProvider.Factory = viewModelFactory {
            initializer { DeviceListViewModel(deviceScanning) }
        }
    }
    ```

**Android**

=== "Compose"

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
        import androidx.lifecycle.viewmodel.compose.viewModel
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.core.Device
        import com.example.devicemonitor.di.AppContainer

        // Stateful: owns the filter text and connects the shared ViewModel to the content below.
        @Composable
        fun DeviceListScreen(
            onDeviceClick: (Device) -> Unit,
            viewModel: DeviceListViewModel = viewModel(factory = AppContainer.deviceListViewModelFactory),
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailScreen.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.Image
        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.size
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.graphics.ColorFilter
        import androidx.compose.ui.res.painterResource
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.outbound.SampleDevices

        @Composable
        fun DeviceDetailScreen(deviceId: String, onBack: () -> Unit) {
            val device = SampleDevices.find(deviceId)
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
                if (device == null) {
                    Text("Unknown device", color = MaterialTheme.colorScheme.error)
                } else {
                    Text(device.name, style = MaterialTheme.typography.headlineSmall)
                    Text("ID: ${device.id}")
                    Text("Signal: ${device.rssi} dBm")
                }
                TextButton(onClick = dropUnlessResumed { onBack() }) {
                    Text("Back")
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
        import androidx.appcompat.app.AlertDialog
        import androidx.fragment.app.Fragment
        import androidx.fragment.app.viewModels
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import androidx.recyclerview.widget.DividerItemDecoration
        import com.example.devicemonitor.adapter.inbound.DeviceListUiState
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.android.databinding.FragmentDeviceListBinding
        import com.example.devicemonitor.di.AppContainer
        import kotlinx.coroutines.launch

        class DeviceListFragment : Fragment() {
            // Survives rotation and the trip to the detail screen; cleared when this
            // Fragment leaves the back stack for good.
            private val viewModel: DeviceListViewModel by viewModels { AppContainer.deviceListViewModelFactory }

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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceAdapter.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.view.LayoutInflater
        import android.view.ViewGroup
        import androidx.recyclerview.widget.DiffUtil
        import androidx.recyclerview.widget.ListAdapter
        import androidx.recyclerview.widget.RecyclerView
        import com.example.devicemonitor.android.databinding.ItemDeviceBinding
        import com.example.devicemonitor.core.Device

        class DeviceAdapter(
            private val onClick: (Device) -> Unit,
        ) : ListAdapter<Device, DeviceAdapter.Holder>(DeviceDiff) {

            class Holder(val binding: ItemDeviceBinding) : RecyclerView.ViewHolder(binding.root)

            override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
                Holder(ItemDeviceBinding.inflate(LayoutInflater.from(parent.context), parent, false))

            override fun onBindViewHolder(holder: Holder, position: Int) {
                val device = getItem(position)
                holder.binding.deviceName.text = device.name
                holder.binding.deviceId.text = device.id
                holder.binding.deviceRssi.text = "${device.rssi} dBm"
                holder.itemView.setOnClickListener { onClick(device) }
            }
        }

        private object DeviceDiff : DiffUtil.ItemCallback<Device>() {
            override fun areItemsTheSame(oldItem: Device, newItem: Device) = oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: Device, newItem: Device) = oldItem == newItem
        }
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import androidx.fragment.app.Fragment
        import androidx.navigation.fragment.findNavController
        import com.example.devicemonitor.adapter.outbound.SampleDevices
        import com.example.devicemonitor.android.databinding.FragmentDeviceDetailBinding

        class DeviceDetailFragment : Fragment() {
            override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
                val b = FragmentDeviceDetailBinding.inflate(inflater, container, false)
                val deviceId = requireArguments().getString("deviceId").orEmpty()
                val device = SampleDevices.find(deviceId)
                if (device == null) {
                    b.deviceName.text = "Unknown device"
                } else {
                    b.deviceName.text = device.name
                    b.deviceId.text = "ID: ${device.id}"
                    b.deviceRssi.text = "Signal: ${device.rssi} dBm"
                }
                b.backButton.setOnClickListener {
                    val nav = findNavController()
                    // A fast double tap would otherwise pop the list too and empty the back stack.
                    if (nav.currentDestination?.id == R.id.deviceDetail) nav.popBackStack()
                }
                return b.root
            }
        }
        ```

**iOS**

=== "SwiftUI"

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
                let viewModel: DeviceListViewModel = owner.viewModel(factory: AppContainer.shared.deviceListViewModelFactory)
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

    ??? example "iosApp/iosApp/DeviceListViewController.swift"
        ```swift
        import UIKit
        import Shared

        final class DeviceListViewController: UIViewController, UITableViewDelegate {
            private let owner = ViewModelOwner()
            private lazy var viewModel: DeviceListViewModel = owner.viewModel(factory: AppContainer.shared.deviceListViewModelFactory)
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
Ví dụ có output (A3, A4, A5) là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0 kèm kotlinx-coroutines-test để chạy trên thời gian ảo). Chúng là **mô hình** của m05: cùng tên, cùng luật, nhưng không có `androidx` hay app thật. A7 là mô phỏng bấm được, cũng không phải app thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-luc-giac-la-cai-may-co-nut-bam-va-o-cam): hình tượng cái máy có nút bấm và ổ cắm, cho năm chữ ở mục 2.
    3. [A7](#a7-phong-thi-nghiem-i-theo-loi-goi-cam-adapter-gac-cong-import): **bấm thử** đường đi của một lần quét, cắm thử các adapter, và gác cổng import của app core.
    4. [A3](#a3-di-bang-tay-chay-that-bang-kotlin): composition root và đổi adapter, chạy thật (mục 6).
    5. [A4](#a4-seen-trong-flow-va-viec-huy-lan-sang-phai-chay-that): vì sao `seen` nằm trong `flow { }`, và ai dừng radio (mục 4, 5).
    6. [A5](#a5-interface-hay-expectactual-va-chuyen-chu-in): interface thay vì `expect`/`actual`, và lỗi của `core.in` (mục 3, 4).
    7. [A6](#a6-code-nay-at-o-au-bang-tra-nhanh): bảng tra "code này đặt ở đâu" (mục 2, 7).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Ở m04, ViewModel **tự tạo** scanner giả của nó, nên không ai đưa cho nó được radio khác, kể cả radio thật của bài 13 hay radio giả của test bài 11.
    2. m05 chia code dùng chung thành **bên trong** (app core: model, port, service; không import Android, iOS hay framework) và **bên ngoài** (adapter).
    3. Bên ngoài chỉ nói chuyện với bên trong qua **port** (interface): **inbound port** là thứ app *cung cấp* (`DeviceScanning`), **outbound port** là thứ app *cần* (`BleScanner`).
    4. Luật của app ("tên chứa chuỗi lọc", "mỗi thiết bị một lần") nằm trong **service** (`ScanningService`); radio, dù giả hay thật, chỉ là một **outbound adapter** cắm vào `BleScanner`.
    5. Ai cắm adapter nào vào port nào được quyết định ở **một chỗ duy nhất**, composition root (`AppContainer`): đổi radio là đổi một dòng ở đó, không đụng service, ViewModel hay màn hình.

Ví dụ đời thường cho cả bài: **cái máy pha cà phê trong quán**. Phía trước máy có bảng nút ("pha một ly latte"): ai bấm cũng được, nhân viên, app giao hàng, hay robot kiểm tra. Phía sau máy có ổ cắm điện và ống nước theo chuẩn của **máy**: cắm điện lưới, máy phát hay nguồn giả trong phòng thử đều được, miễn đúng chuẩn. Công thức pha nằm trong máy. Người lắp đặt quyết định cắm nguồn nào. [A2](#a2-luc-giac-la-cai-may-co-nut-bam-va-o-cam) đi sâu vào hình tượng này.

| Chữ trong bài | Nói đơn giản | Trong m05 là |
|---|---|---|
| hexagon (lục giác), ports and adapters | cách chia app thành bên trong (luật) và bên ngoài (UI, radio, mạng), nối qua interface | cả `shared/` sau bài này |
| app core | bên trong: model, port, service; chỉ import Kotlin chuẩn + kotlinx.coroutines | package `core`, `core.inbound`, `core.outbound` |
| inbound port | interface cho thứ app **cung cấp**; bên ngoài gọi vào | `DeviceScanning.scan(nameFilter)` |
| outbound port | interface cho thứ app **cần**; bên ngoài implement | `BleScanner.scan()` |
| service | class trong core implement inbound port, giữ luật, gọi outbound port | `ScanningService` |
| inbound adapter | code **gọi vào** app qua inbound port (driving, primary) | `DeviceListViewModel`, test bài 11 |
| outbound adapter | code **bị app gọi** qua outbound port, một cho mỗi nền tảng/công nghệ (driven, secondary) | `SimulatedBleScanner`, radio thật bài 13 |
| constructor injection | class nhận dependency qua constructor thay vì tự tạo | `ScanningService(scanner)`, `DeviceListViewModel(scanning)` |
| composition root | chỗ duy nhất dựng cả đồ thị object và chọn class cụ thể | `di/AppContainer` |
| binding (phép gắn) | một dòng "port này nghĩa là class này" | `bleScanner: BleScanner by lazy { SimulatedBleScanner() }` |
| DI viết tay | tự gọi constructor theo đúng thứ tự, không dùng thư viện | m05; bài 11 thay bằng Koin |

### A2. Lục giác là cái máy có nút bấm và ổ cắm

Giải thích thêm cho [mục 2](#2-luc-giac-trong-nam-chu) và hình lục giác m05.

Quay lại cái máy pha cà phê. Có ba ý quan trọng, và mỗi ý ứng với một chỗ trong code:

1. **Hình dạng ổ cắm do máy quy định, không do nhà cung cấp điện.** Đó là lý do `BleScanner` nằm **trong** core (`core.outbound`), dù chỉ adapter implement nó. Nhà cung cấp (adapter) phải làm phích vừa ổ, không phải máy phải đổi ổ cho vừa từng phích. Nếu port nằm cạnh adapter, core sẽ phải import adapter, và luật "core không import gì bên ngoài" bị phá (câu ôn đầu tiên).
2. **Máy không biết đang cắm nguồn nào.** Điện lưới, máy phát, hay nguồn giả trong phòng thử đều trông như nhau từ bên trong. `ScanningService` cũng vậy: nó chỉ thấy `BleScanner`, không phân biệt `SimulatedBleScanner`, radio Swift hay fake trong test.
3. **Người lắp đặt quyết định, một lần, ở một chỗ.** Thợ lắp đặt là `AppContainer`. Đổi nguồn là việc của thợ, không phải của công thức pha hay của bảng nút.

Hai phía của lục giác, theo hình tượng đó:

| | Phía trước: nút bấm | Phía sau: ổ cắm |
|---|---|---|
| tên trong khoá | **inbound** | **outbound** |
| tên ở chỗ khác | driving, primary | driven, secondary |
| ai bắt đầu | bên ngoài bấm vào máy | máy đòi bên ngoài làm việc |
| port trong m05 | `DeviceScanning` | `BleScanner` |
| ai implement port | service (`ScanningService`) | adapter (`SimulatedBleScanner`) |
| ai gọi port | adapter (`DeviceListViewModel`) | service (`ScanningService`) |
| ví dụ app thật sau này | ViewModel mỗi màn hình, test của bài 11 | radio BLE, quyền, kho log, HTTP client |

Mẹo nhớ chiều mũi tên trong hình m05: **inbound: adapter gọi port, service implement port. Outbound: service gọi port, adapter implement port.** Ở cả hai phía, mũi tên phụ thuộc đều chỉ **vào** lục giác: adapter biết core, core không biết adapter.

So với thứ bạn đã biết bên web:

| Ý | Angular / TS | Kotlin m05 | Swift (bài 13) |
|---|---|---|---|
| port | abstract class hoặc `InjectionToken` | `interface BleScanner` | protocol `BleScanner` trong `Shared.h` |
| adapter | `@Injectable() class X implements Port` | `class SimulatedBleScanner : BleScanner` | `class … : NSObject, BleScanner` (chưa kiểm chứng: bài 13 viết nó) |
| nhận dependency | `constructor(private s: DeviceScanning)` | `class DeviceListViewModel(private val scanning: DeviceScanning)` | không cần: Swift chỉ truyền adapter cho Kotlin |
| composition root | mảng `providers: [...]` | `object AppContainer` | (bài 13) |
| injector | có sẵn trong framework | không có: tự gọi constructor | — |

Áp vào app Native Device Monitor: từ bài 13, lục giác không đổi hình dạng. Chỉ có thêm phích cắm (radio Android, radio Swift) và một dòng gắn đổi trong composition root.

### A3. DI bằng tay, chạy thật bằng Kotlin

Giải thích thêm cho [mục 6](#6-noi-bang-tay) và đoạn "Đổi adapter".

Chương trình dưới đây là m05 thu nhỏ trong một file: core, ba outbound adapter, một inbound adapter rút gọn (thay `DeviceListViewModel` vì console không có `androidx`), và một composition root dạng hàm `compose(radio)`. App thật dùng `object AppContainer` với `by lazy`; ở đây mình đổi thành hàm nhận radio để **cắm ba radio khác nhau vào cùng một core** trong một lần chạy. `runTest` chạy trên thời gian ảo, nên `delay(300)` không chờ thật và giờ in ra luôn giống nhau.

```kotlin title="hexagon.kt (mô hình m05)"
// Mô hình m05 trong một file console: app core, hai port, adapter, và một composition root.
// runTest chạy trên thời gian ảo: delay(300) không chờ thật, nên output luôn giống nhau.
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.seconds

// ===== core: chỉ Kotlin + kotlinx.coroutines, không Android, không iOS =====
data class Device(val id: String, val name: String, val rssi: Int)
class ScanException(message: String) : Exception(message)

interface DeviceScanning { fun scan(nameFilter: String): Flow<Device> } // inbound port
interface BleScanner { fun scan(): Flow<Device> }                       // outbound port

class ScanningService(private val scanner: BleScanner) : DeviceScanning {
    override fun scan(nameFilter: String): Flow<Device> = flow {
        val wanted = nameFilter.trim()
        val seen = mutableSetOf<String>()
        scanner.scan().collect { device ->
            if (device.name.contains(wanted, ignoreCase = true) && seen.add(device.id)) emit(device)
        }
    }
}

// ===== adapter.outbound: ba "phích cắm" cho cùng ổ cắm BleScanner =====
val sample = listOf(
    Device("C4:7C:8D:6A:01:10", "OBD-II Adapter", -48),
    Device("C4:7C:8D:6A:01:11", "Heart Rate Monitor", -61),
    Device("C4:7C:8D:6A:01:12", "Tire Pressure Sensor", -67),
    Device("C4:7C:8D:6A:01:13", "Thermometer", -74),
    Device("C4:7C:8D:6A:01:14", "Smart Scale", -85),
)
class SimulatedBleScanner : BleScanner {
    override fun scan() = flow { while (true) for (d in sample) { delay(300); emit(d) } }
}
class FailingBleScanner : BleScanner {
    override fun scan() = flow<Device> { delay(500); throw ScanException("Bluetooth adapter not responding (simulated).") }
}
class OneDeviceRadio : BleScanner { // kiểu radio giả mà bài 11 dùng trong test
    override fun scan() = flow { while (true) { delay(1000); emit(sample[3]) } }
}

// ===== adapter.inbound: DeviceListViewModel rút gọn (không androidx) =====
class DeviceListModel(private val scanning: DeviceScanning) {
    suspend fun startScan(filter: String, log: (String) -> Unit) {
        val found = mutableListOf<Device>()
        try {
            withTimeoutOrNull(3.seconds) {
                scanning.scan(filter).collect { found += it; log("Scanning(${found.size})  + ${it.name}") }
            }
            log("Finished(${found.size})")
        } catch (e: ScanException) {
            log("Idle, errorMessage = \"${e.message}\"")
        }
    }
}

// ===== di: composition root. Nơi DUY NHẤT gọi tên class cụ thể =====
fun compose(radio: BleScanner): DeviceListModel = DeviceListModel(ScanningService(radio))

suspend fun TestScope.run(title: String, radio: BleScanner, filter: String) {
    println("— $title, filter = \"$filter\"")
    val start = testScheduler.currentTime
    compose(radio).startScan(filter) { println("  t=%4d ms  %s".format(testScheduler.currentTime - start, it)) }
}

fun main() = runTest {
    run("SimulatedBleScanner", SimulatedBleScanner(), "")
    run("SimulatedBleScanner", SimulatedBleScanner(), "  SENS ")
    run("FailingBleScanner", FailingBleScanner(), "")
    run("OneDeviceRadio", OneDeviceRadio(), "")
}
```

```text title="Output"
— SimulatedBleScanner, filter = ""
  t= 300 ms  Scanning(1)  + OBD-II Adapter
  t= 600 ms  Scanning(2)  + Heart Rate Monitor
  t= 900 ms  Scanning(3)  + Tire Pressure Sensor
  t=1200 ms  Scanning(4)  + Thermometer
  t=1500 ms  Scanning(5)  + Smart Scale
  t=3000 ms  Finished(5)
— SimulatedBleScanner, filter = "  SENS "
  t= 900 ms  Scanning(1)  + Tire Pressure Sensor
  t=3000 ms  Finished(1)
— FailingBleScanner, filter = ""
  t= 500 ms  Idle, errorMessage = "Bluetooth adapter not responding (simulated)."
— OneDeviceRadio, filter = ""
  t=1000 ms  Scanning(1)  + Thermometer
  t=3000 ms  Finished(1)
```

Đọc output:

- **Bốn lần chạy, cùng `ScanningService`, cùng `DeviceListModel`.** Chỉ dòng gọi `compose(...)` đổi. Đó là "đổi adapter" của mục 6, thu nhỏ.
- Lần 1: radio giả lập lặp mọi thiết bị mãi mãi, nhưng chỉ **5** dòng `Scanning`: service đã bỏ các lần lặp từ 1,8 s trở đi. Đến 3 s, timeout của inbound adapter cho ra `Finished(5)`, như "Devices found: 5" ở mục 8.
- Lần 2: chuỗi lọc `"  SENS "` được trim và so không phân biệt hoa thường, nên chỉ `Tire Pressure Sensor` qua, ở 900 ms (nó là thiết bị thứ ba).
- Lần 3: `FailingBleScanner` ném `ScanException` ở 500 ms. Exception đi ngược qua service tới `catch` của inbound adapter: `Idle` + `errorMessage`, đúng thứ làm dialog "Scan failed" hiện ra.
- Lần 4: `OneDeviceRadio` là kiểu radio giả mà test bài 11 sẽ dùng: nó lặp một thiết bị mỗi giây, và service vẫn chỉ báo một lần.

Ba cách lấy dependency, cạnh nhau:

| | Tự tạo (m04) | DI viết tay (m05) | Container DI (bài 11) |
|---|---|---|---|
| ai gọi constructor | chính class đó | composition root, theo thứ tự bạn viết | thư viện (Koin) |
| đổi radio | sửa ViewModel | sửa một dòng trong `AppContainer` | sửa một dòng trong module Koin |
| thiếu dependency | — | **lỗi compile** | lỗi lúc chạy (khi resolve) |
| bên web giống | `new HttpClient()` trong component | tự `new Service(new Repo())` trong `main.ts` | `providers` của Angular |

Áp vào app: mỗi lần bạn thấy một class gọi `SomeThing()` bên trong nó (không phải model hay giá trị đơn giản), hãy hỏi "cái này có nên nhận qua constructor không?". Nếu nó nói chuyện với nền tảng, mạng hay thư viện, câu trả lời gần như luôn là có.

### A4. `seen` trong `flow { }` và việc huỷ lan sang phải, chạy thật

Giải thích thêm cho ý 2 của `ScanningService` ở [mục 4](#4-app-core), câu ôn thứ năm, và câu "Không ai gọi một hàm stop nào" trong sơ đồ đường gọi ở [mục 5](#5-cac-adapter).

Ví dụ đời thường: `seen` là **tờ giấy đánh dấu khách đã chào** của nhân viên lễ tân. Mỗi ca làm (mỗi lần quét) phải bắt đầu bằng tờ giấy mới. Nếu cả quán dùng chung một tờ giấy dán trên tường (property của service dùng chung), ca thứ hai sẽ thấy mọi khách quen "đã chào rồi" và không chào ai.

Chương trình dưới đây so `ScanningService` đúng như bài với một bản sai, `ForgetfulService`, giữ `seen` làm property. Radio `LoudRadio` in ra khi nó bắt đầu và khi nó bị dừng. Mỗi lần quét kéo dài 2 s rồi hết giờ, như timeout của ViewModel.

```kotlin title="seen.kt (mô hình)"
// Hai câu hỏi về ScanningService, chạy trên thời gian ảo (runTest):
// 1) vì sao `seen` phải nằm TRONG flow { }, 2) ai dừng radio khi ViewModel hết giờ.
package seen

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.seconds

data class Device(val id: String, val name: String)
interface DeviceScanning { fun scan(nameFilter: String): Flow<Device> }
interface BleScanner { fun scan(): Flow<Device> }

val sample = listOf(Device("01:10", "OBD-II Adapter"), Device("01:11", "Heart Rate Monitor"), Device("01:12", "Thermometer"))

// Radio "biết nói": in ra lúc bắt đầu và lúc bị dừng.
class LoudRadio : BleScanner {
    override fun scan() = flow {
        println("    [radio] bắt đầu quét")
        try {
            while (true) for (d in sample) { delay(300); emit(d) }
        } finally {
            println("    [radio] dừng (collector đã huỷ)")
        }
    }
}

// Đúng như bài: seen tạo mới ở MỖI lần collect.
class ScanningService(private val scanner: BleScanner) : DeviceScanning {
    override fun scan(nameFilter: String): Flow<Device> = flow {
        val seen = mutableSetOf<String>()
        scanner.scan().collect { if (it.name.contains(nameFilter.trim(), true) && seen.add(it.id)) emit(it) }
    }
}

// Bản SAI: seen là property, sống lâu hơn một lần quét.
class ForgetfulService(private val scanner: BleScanner) : DeviceScanning {
    private val seen = mutableSetOf<String>()
    override fun scan(nameFilter: String): Flow<Device> = flow {
        scanner.scan().collect { if (it.name.contains(nameFilter.trim(), true) && seen.add(it.id)) emit(it) }
    }
}

// Inbound adapter rút gọn: quét 2 giây rồi thôi, như timeout của ViewModel.
suspend fun scanFor2s(scanning: DeviceScanning): List<String> {
    val found = mutableListOf<String>()
    withTimeoutOrNull(2.seconds) { scanning.scan("").collect { found += it.name } }
    return found
}

fun main() = runTest {
    for ((label, service) in listOf("ScanningService (seen trong flow)" to ScanningService(LoudRadio()),
                                     "ForgetfulService (seen là property)" to ForgetfulService(LoudRadio()))) {
        println("— $label")
        println("  lần quét 1: ${scanFor2s(service)}")
        println("  lần quét 2: ${scanFor2s(service)}")
    }
}
```

```text title="Output"
— ScanningService (seen trong flow)
    [radio] bắt đầu quét
    [radio] dừng (collector đã huỷ)
  lần quét 1: [OBD-II Adapter, Heart Rate Monitor, Thermometer]
    [radio] bắt đầu quét
    [radio] dừng (collector đã huỷ)
  lần quét 2: [OBD-II Adapter, Heart Rate Monitor, Thermometer]
— ForgetfulService (seen là property)
    [radio] bắt đầu quét
    [radio] dừng (collector đã huỷ)
  lần quét 1: [OBD-II Adapter, Heart Rate Monitor, Thermometer]
    [radio] bắt đầu quét
    [radio] dừng (collector đã huỷ)
  lần quét 2: []
```

Đọc output:

- **`ForgetfulService`, lần quét 2: `[]`.** Đúng như `.why` của câu ôn: set sống lâu hơn lần quét, nên mọi thiết bị của lần 1 bị coi là "đã thấy". Vì `AppContainer` dùng `by lazy` (một service cho cả app), lỗi này sẽ hiện ra trên app thật ngay lần bấm Scan thứ hai.
- **`[radio] dừng (collector đã huỷ)` in ra mà không ai gọi `stop`.** `withTimeoutOrNull` huỷ việc collect của inbound adapter; việc huỷ lan vào `flow { }` của service, rồi vào `flow { }` của radio, và khối `finally` chạy. Đó là "bắt đầu và dừng là collect và cancel" (ý 2 của `DeviceScanning`).
- Thứ tự in: radio dừng **trước** khi dòng "lần quét 1" in ra, vì `scanFor2s` chỉ trả về sau khi mọi thứ bên dưới đã dừng xong.

| | TS / RxJS | Kotlin Flow (m05) |
|---|---|---|
| bắt đầu quét | `subscribe()` trên Observable lạnh | `collect { }` trên flow lạnh |
| dừng quét | `unsubscribe()`, hoặc `takeUntil(timer(3000))` | huỷ coroutine, hoặc `withTimeoutOrNull(3.seconds)` |
| dọn dẹp nguồn | hàm teardown trả về từ `new Observable(...)` | khối `finally` (hoặc `awaitClose`) trong `flow { }` |
| state cho mỗi lần subscribe | tạo trong hàm `defer(() => ...)` | tạo bên trong `flow { }` |

Mình không xoá `seen.add(device.id)` trong ví dụ này: đó là bài tự làm 3, và câu hỏi của nó là về app thật (bao nhiêu hàng, có crash không), nên hãy tự chạy trên cả hai app.

### A5. Interface hay `expect`/`actual`, và chuyện chữ `in`

Giải thích thêm cho ý 3 của `BleScanner` ở [mục 4](#4-app-core) và phần đặt tên package ở [mục 3](#3-package-core-inbound-outbound).

Ví dụ đời thường: `expect`/`actual` như **ổ cắm hàn chết vào tường lúc xây nhà**: mỗi căn (mỗi nền tảng) đúng một cái, chọn lúc xây (compile), và phải là đồ của cùng một hãng (Kotlin). Interface như **ổ cắm thường**: rút ra cắm vào lúc nào cũng được, cùng lúc có nhiều thiết bị khác hãng, kể cả đồ Swift.

| | `expect`/`actual` (bài 05) | `interface` (m05) |
|---|---|---|
| số implementation mỗi nền tảng | đúng một | bao nhiêu cũng được |
| chọn khi nào | lúc compile, theo source set | lúc chạy, trong composition root |
| iOS viết bằng | Kotlin (`iosMain`) | Kotlin **hoặc Swift** |
| fake trong test | khó: `actual` đã cố định | dễ: một class implement interface |
| hợp với | `platformName()`, hằng số nền tảng | radio, quyền, kho log, HTTP |

Về tên package: mình thử compile thật ba dòng `package`. `core.out` và `` core.`in` `` (backtick) compile được; `core.in` thì không:

```text title="./gradlew compileKotlin (package com.example.devicemonitor.core.in)"
e: src/main/kotlin/kw/A.kt:1:40 Syntax error: Package name must be a '.'-separated identifier list.
```

Đó đúng là lỗi bài trích ở mục 3, đến cột 40 (chữ `in`). Bên TS không có chuyện này: `in` chỉ là từ khoá trong biểu thức, còn tên thư mục và đường dẫn import là chuỗi, đặt gì cũng được.

### A6. Code này đặt ở đâu: bảng tra nhanh

Giải thích thêm cho "Một luật cho chuyện code đặt ở đâu" ở [mục 2](#2-luc-giac-trong-nam-chu) và bảng công thức ở [mục 7](#7-app-hoan-chinh-va-cach-them-thu-moi). Hỏi lần lượt ba câu này, dừng ở câu đầu tiên trả lời "có":

1. **Nó nói chuyện với nền tảng, thư viện hay mạng?** (`android.*`, `platform.*`, Ktor, file, đồng hồ hệ thống…) → **outbound adapter**, sau một outbound port đặt tên theo việc app cần.
2. **Nó đúng cho mọi màn hình và cả hai nền tảng, bất kể radio nào?** → **service** trong app core.
3. **Nó chỉ là hành vi hay hình thức của một màn hình?** Hành vi có state (timeout, đang quét / xong) → **ViewModel** (inbound adapter). Màu, chữ, bố cục → **màn hình**.

Và một câu riêng: **nó chọn class cụ thể nào được dùng?** → **composition root**.

Ví dụ áp vào app, khác các ví dụ của bài tự làm 2 để bạn tự làm bài đó:

| Yêu cầu | Đặt ở đâu | Vì sao |
|---|---|---|
| "Sắp xếp danh sách theo tín hiệu mạnh nhất trước, trên mọi màn hình" | service (`ScanningService`, hoặc một service mới nếu là năng lực khác) | luật của app, không phụ thuộc radio |
| "Nút Scan có chữ đậm hơn trên iOS" | màn hình iOS | chỉ là hình thức |
| "Màn hình này quét 10 s thay vì 3 s" | ViewModel của màn hình đó | hành vi riêng của một màn hình |
| "Đọc độ sáng màn hình điện thoại" | outbound port `ScreenBrightnessProvider` + adapter mỗi nền tảng | nói chuyện với nền tảng |
| "Tải danh sách firmware mới nhất từ server" | outbound port `FirmwareCatalog` + HTTP adapter trong `adapter.outbound` | mạng; port đặt theo việc, không phải `ApiClient` |
| "Chạy app với radio giả để demo cho khách" | một dòng trong composition root | quyết định nối dây |

Hai lỗi hay gặp, và dấu hiệu nhận ra chúng trong code review:

- **Port đặt tên theo công nghệ** (`ApiClient.get(url)`, `BluetoothManagerWrapper`): app core bắt đầu có chữ `url`, `json`, `uuid`. Đặt lại tên theo việc app cần (`LogUploader`, `BleScanner`).
- **Màn hình với thẳng vào adapter**: dòng `import com.example.devicemonitor.adapter.outbound.…` trong một file màn hình. Bài đã chỉ ra một chỗ như vậy (`SampleDevices.find(id)`) và giữ nó có chủ đích tới các bài BLE. Kotlin không có package-private nên compiler không chặn; chỉ có review của bạn chặn được.

### A7. Phòng thí nghiệm: đi theo lời gọi, cắm adapter, gác cổng import

Ba mô phỏng bấm được. Chúng là mô hình dựng theo bài (cùng tên class, cùng thời gian 0,3 s và 3 s), không phải app hay compiler thật.

#### 1. Đi theo một lần quét

Gõ chuỗi lọc, chọn radio đang cắm vào `BleScanner`, rồi bấm **Scan**. Mỗi làn là một trạm trên đường gọi ở [mục 5](#5-cac-adapter); làn sáng lên khi lời gọi hoặc thiết bị đi qua nó. Bật **Chạy chậm** để kịp nhìn.

<div class="lab" id="l10-path"></div>

!!! tip "Điều cần thấy ở mô phỏng 1"
    Từ 1,8 s radio bắt đầu phát lại thiết bị cũ, làn service ghi "bỏ: đã thấy", và làn ViewModel **không** nhận thêm gì. Ở 3 s chỉ làn ViewModel ra lệnh huỷ, và việc dừng lan sang phải tới tận radio. Đổi sang radio luôn lỗi: không làn nào trong core hay ViewModel đổi code, chỉ có exception đi ngược về trái.

#### 2. Cắm adapter vào port `BleScanner`

Chọn một "phích cắm" để cắm vào ổ `BleScanner` trong `AppContainer`. Xem dòng binding đổi thế nào, file nào phải sửa, và màn hình sẽ hiện gì. Hai phích cuối không vừa ổ: xem compiler nói gì (lỗi lấy từ lần compile thật trên JVM, Kotlin 2.4.21).

<div class="lab" id="l10-plug"></div>

!!! tip "Điều cần thấy ở mô phỏng 2"
    Với mọi phích vừa ổ, danh sách "file phải sửa" luôn chỉ có **một** dòng: `di/AppContainer.kt`. Phích không vừa ổ bị chặn **lúc compile**, trước khi app chạy: đó là cái lợi của DI viết tay mà bài 11 đổi lấy sự tiện của Koin.

#### 3. Gác cổng import của app core

Bạn là người review file `core/ScanningService.kt`. Với mỗi dòng `import`, quyết định cho vào hay chặn. Chặn đúng thì xem nó nên chuyển sang phần nào của lục giác.

<div class="lab" id="l10-imports"></div>

!!! tip "Điều cần thấy ở mô phỏng 3"
    Chỉ ba loại import được vào core: thư viện chuẩn Kotlin (`kotlin.*`), `kotlinx.coroutines.*`, và chính các package `core…`. Mọi thứ khác, kể cả code của chính app trong `adapter.*` hay `di`, đều bị chặn: đó chính là lệnh `grep -rh "^import"` trong brief cho agent.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang [bài 11](11-kiem-thu-va-koin.md).

- [ ] Nói được ba vấn đề của một ViewModel tự tạo scanner, và vì sao `commonMain` không bao giờ tạo được radio Swift (xem [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh)).
- [ ] Giải thích năm chữ: app core, inbound port, outbound port, service, adapter, kèm ví dụ trong m05 (xem [A2](#a2-luc-giac-la-cai-may-co-nut-bam-va-o-cam)).
- [ ] Nói được vì sao outbound port nằm **trong** core dù adapter mới implement nó (xem [A2](#a2-luc-giac-la-cai-may-co-nut-bam-va-o-cam)).
- [ ] Viết một service nhận outbound port qua constructor và implement một inbound port, không giữ state giữa các lần quét (xem [A4](#a4-seen-trong-flow-va-viec-huy-lan-sang-phai-chay-that)).
- [ ] Đi theo một lần quét từ màn hình qua hai port tới radio và quay về, và nói ai dừng radio ở 3 s (thử [Đi theo một lần quét](#1-i-theo-mot-lan-quet)).
- [ ] Viết composition root bằng tay với `by lazy`, đọc mỗi dòng như một binding, và đổi adapter chỉ bằng một dòng (xem [A3](#a3-di-bang-tay-chay-that-bang-kotlin), thử [Cắm adapter](#2-cam-adapter-vao-port-blescanner)).
- [ ] Giải thích vì sao `BleScanner` là interface chứ không phải `expect`/`actual`, và vì sao package không tên `in` (xem [A5](#a5-interface-hay-expectactual-va-chuyen-chu-in)).
- [ ] Liệt kê được những import nào được phép trong app core (thử [Gác cổng import](#3-gac-cong-import-cua-app-core)).
- [ ] Với một yêu cầu mới, chọn đúng chỗ đặt code theo bốn công thức ở mục 7 (xem [A6](#a6-code-nay-at-o-au-bang-tra-nhanh)).
- [ ] Đọc code kiểu Clean (use case, repository) và dịch được sang chữ của lục giác.
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.

