---
source: lessons/09-kotlin-swift-with-skie.html
source_ref: live
source_sha: a14043e
---

# Kotlin↔Swift với SKIE

<p class="kicker">Bài 09 · Tuần 2 · Ngày 9 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~1,5 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m04 iOS quan sát ViewModel qua SKIE</span>
  <span class="tag">Cần trước: <a href="../08-viewmodel-dung-chung/">08</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Ở m03, iOS tới được ViewModel dùng chung qua một cầu nối bạn viết tay: một watcher Kotlin 23 dòng, một observer 29 dòng trên SwiftUI, và các phép ép kiểu `as?` không nói gì khi Kotlin thêm một trường hợp.
    App của team sẽ có nhiều flow và nhiều kiểu sealed, và mỗi cái lại cần thêm chừng ấy code. Hôm nay một compiler plugin, **SKIE**, viết cầu nối giúp bạn: Swift duyệt `StateFlow` bằng `for await`, và rẽ nhánh trên state sealed bằng một `switch` được compiler kiểm tra. Các file cầu nối bị xoá.
    Đó là milestone **m04**. Nó có một cái giá, mà hôm nay bạn cũng học: SKIE buộc project vào những phiên bản Kotlin mà nó hỗ trợ.

!!! info "Nguồn chính"
    Trang [Flows](https://skie.touchlab.co/features/flows) của SKIE, rồi trang [Sealed classes](https://skie.touchlab.co/features/sealed) của nó. Cả hai đều ngắn. Đọc chúng sau mục 1.

!!! info "Track"
    Bài này chỉ đổi code iOS. Trên cả hai track Android thay đổi duy nhất là file build gốc (phiên bản Kotlin), và source Android giữ nguyên. Màn hình SwiftUI và UIKit đổi ở mục 3.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## Thay đổi so với m03

Các màn hình trông và hoạt động y hệt m03. Cái đổi là code nằm giữa Kotlin và Swift:

<table>
<tr><th>Cái gì</th><th>m03</th><th>m04</th></tr>
<tr><td>iOS quan sát <code>uiState</code> thế nào</td><td><code>StateFlowWatcher</code> và <code>Watch</code> (Kotlin), cộng <code>DeviceListObserver</code> trên SwiftUI</td><td>một vòng <code>for await</code> trên <code>uiState</code>, bên trong một <code>Task</code> Swift</td></tr>
<tr><td>Swift đọc <code>ScanState</code> thế nào</td><td>ép kiểu <code>as?</code></td><td><code>switch onEnum(of:)</code>, được compiler kiểm tra</td></tr>
<tr><td>phiên bản Kotlin</td><td>2.4.21</td><td><strong>2.4.20</strong>, bản mới nhất mà SKIE 0.10.15 hỗ trợ</td></tr>
<tr><td>file</td><td colspan="2">cả hai file build, trên mọi track; xoá <code>StateFlowWatcher.kt</code>; trên SwiftUI, xoá <code>DeviceListObserver.swift</code> và thay <code>DeviceListView.swift</code>; trên UIKit, thay <code>DeviceListViewController.swift</code>. <code>ViewModelOwner.swift</code>, <code>ViewModelResolver.kt</code> và mọi source Android giữ nguyên.</td></tr>
</table>

## 1. SKIE sinh ra gì

[SKIE](https://skie.touchlab.co/) (của Touchlab) là một compiler plugin của Kotlin. Bài 05 cho thấy Swift nhìn Kotlin qua header Objective-C mà Kotlin/Native ghi vào `Shared.framework`, và bài 08 cho thấy header đó làm mất gì: tham số kiểu của một `StateFlow`, và việc một sealed interface có đúng ba trường hợp.
SKIE chạy trong lúc Gradle build framework. Nó để nguyên các khai báo của header, và thêm code Swift vào cùng framework đó để trả lại những gì header đã làm mất:

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 300" role="img" aria-labelledby="l09-gen-title">
<title id="l09-gen-title">SKIE sinh ra gì giữa Kotlin và Swift, theo bốn cột: Kotlin của bạn, header Objective-C Shared.h, thứ SKIE thêm vào framework, và Swift của bạn. Hàng trên, flow: Kotlin khai báo uiState là một StateFlow của DeviceListUiState. Trong Shared.h nó vẫn là một protocol StateFlow không kiểu: tham số kiểu bị mất và Swift không duyệt được nó. SKIE thêm Shared.apinotes, thứ gán lại kiểu cho uiState thành SkieKotlinStateFlow của DeviceListUiState, một class, nên tham số kiểu còn nguyên, và Swift được sinh ra, SkieSwiftStateFlow của T, một AsyncSequence có value đúng kiểu. Swift của bạn viết for await state in viewModel.uiState và nhận một DeviceListUiState. Hàng dưới, kiểu sealed: Kotlin khai báo sealed interface ScanState với Idle, Scanning và Finished. Shared.h có một protocol ScanState và ba class, nên Swift phải ép kiểu bằng as. SKIE sinh một enum Swift có một case cho mỗi lớp con, và một hàm onEnum of làm các phép ép kiểu một lần. Swift của bạn viết switch onEnum of scan, và compiler kiểm tra nó đủ nhánh.</title>
<defs><marker id="l09-gen-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small" x="12" y="18" font-weight="600">Kotlin của bạn (commonMain)</text>
<text class="small" x="162" y="18" font-weight="600">Shared.h, như ở m03</text>
<text class="small" x="306" y="18" font-weight="600">SKIE thêm vào</text>
<text class="small" x="494" y="18" font-weight="600">Swift của bạn</text>
<g data-part="inbound">
<rect class="box" x="10" y="30" width="136" height="100" rx="6"/>
<text class="mono small" x="20" y="52">val uiState:</text>
<text class="mono small" x="20" y="68">StateFlow&lt;</text>
<text class="mono small" x="20" y="84"> DeviceListUiState&gt;</text>
<rect class="box" x="10" y="160" width="136" height="100" rx="6"/>
<text class="mono small" x="20" y="182">sealed interface</text>
<text class="mono small" x="20" y="198"> ScanState</text>
<text class="small muted" x="20" y="218">Idle · Scanning ·</text>
<text class="small muted" x="20" y="232">Finished</text>
</g>
<rect class="box" x="160" y="30" width="132" height="100" rx="6"/>
<text class="mono small" x="170" y="52">id&lt;StateFlow&gt;</text>
<text class="mono small" x="170" y="68"> uiState</text>
<text class="small muted" x="170" y="90">mất tham số kiểu,</text>
<text class="small muted" x="170" y="104">không duyệt được</text>
<rect class="box" x="160" y="160" width="132" height="100" rx="6"/>
<text class="small" x="170" y="182">protocol ScanState</text>
<text class="small" x="170" y="198">+ 3 class</text>
<text class="small muted" x="170" y="220">Swift ép kiểu bằng as?</text>
<rect class="box" x="306" y="30" width="174" height="100" rx="6"/>
<text class="small" x="316" y="48">Shared.apinotes:</text>
<text class="mono small" x="316" y="63">SkieKotlinStateFlow&lt;…&gt;</text>
<text class="small muted" x="316" y="77">một class: kiểu còn nguyên</text>
<text class="small" x="316" y="97">Swift được sinh ra:</text>
<text class="mono small" x="316" y="112">SkieSwiftStateFlow&lt;T&gt;</text>
<text class="small muted" x="316" y="125">AsyncSequence, value có kiểu</text>
<rect class="box" x="306" y="160" width="174" height="100" rx="6"/>
<text class="small" x="316" y="180">Swift được sinh ra:</text>
<text class="mono small" x="316" y="196">enum __Sealed</text>
<text class="small muted" x="316" y="210">mỗi lớp con một case</text>
<text class="mono small" x="316" y="230">onEnum(of:)</text>
<text class="small muted" x="316" y="244">làm các phép ép kiểu, một lần</text>
<g data-part="ios">
<rect class="box" x="494" y="30" width="136" height="100" rx="6"/>
<text class="mono small" x="504" y="52">for await state</text>
<text class="mono small" x="504" y="68"> in vm.uiState</text>
<text class="small muted" x="504" y="90">state là một</text>
<text class="small muted" x="504" y="104">DeviceListUiState</text>
<rect class="box" x="494" y="160" width="136" height="100" rx="6"/>
<text class="mono small" x="504" y="182">switch onEnum(</text>
<text class="mono small" x="504" y="198"> of: scan) {…}</text>
<text class="small muted" x="504" y="220">đủ nhánh: compiler</text>
<text class="small muted" x="504" y="234">kiểm tra</text>
</g>
<path class="edge" d="M148,80 L158,80" marker-end="url(#l09-gen-arrow)"/>
<path class="edge" d="M294,80 L304,80" marker-end="url(#l09-gen-arrow)"/>
<path class="edge" d="M482,80 L492,80" marker-end="url(#l09-gen-arrow)"/>
<path class="edge" d="M148,210 L158,210" marker-end="url(#l09-gen-arrow)"/>
<path class="edge" d="M294,210 L304,210" marker-end="url(#l09-gen-arrow)"/>
<path class="edge" d="M482,210 L492,210" marker-end="url(#l09-gen-arrow)"/>
<text class="small muted" x="12" y="284">Kotlin/Native viết header; SKIE thêm phần còn lại vào cùng Shared.framework trong lúc Gradle build nó.</text>
</svg>
<figcaption>Hàng trên: flow. Hàng dưới: state sealed. Cột header là thứ bài 08 làm việc cùng; SKIE thêm cột thứ ba, và Swift của bạn chỉ dùng cột đó.
<ul class="legend"><li data-part="inbound">ViewModel dùng chung và UI state của nó</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

<table>
<tr><th>Kotlin</th><th>Không có SKIE (m03)</th><th>Có SKIE (m04)</th></tr>
<tr><td><code>Flow&lt;T&gt;</code>, <code>StateFlow&lt;T&gt;</code></td><td>một protocol không kiểu; không <code>for await</code> được</td><td><code>SkieSwiftStateFlow&lt;T&gt;</code>: một <code>AsyncSequence</code> của <code>T</code>, có <code>value</code> đúng kiểu. "SKIE tự động chuyển Flow thành các class Swift tự viết, implement <code>AsyncSequence</code>" (<a href="https://skie.touchlab.co/features/flows">Flows</a>)</td></tr>
<tr><td>sealed class hoặc interface</td><td>một protocol cộng các class; ép kiểu bằng <code>as?</code></td><td><code>onEnum(of:)</code> trả về một enum Swift được sinh ra, nên một <code>switch</code> trên nó phải đủ nhánh (<a href="https://skie.touchlab.co/features/sealed">Sealed classes</a>)</td></tr>
<tr><td><code>suspend fun</code></td><td>một completion handler, hoặc một hàm <code>async</code> mà trang interop gọi là thử nghiệm</td><td>một hàm <code>async</code> của Swift có hỗ trợ huỷ (app chưa có hàm nào như vậy)</td></tr>
</table>

**Huỷ hoạt động theo cả hai chiều.** Khi `Task` Swift đang chạy một vòng `for await` bị huỷ, SKIE huỷ việc collect bên Kotlin phía sau nó. Theo chiều ngược lại, "nếu Flow bị huỷ từ Kotlin, SKIE tự động huỷ task Swift đang collect Flow đó" ([Flows](https://skie.touchlab.co/features/flows)). Đó là tất cả những gì `StateFlowWatcher` và `Watch` làm bằng tay.

!!! info "Từ TypeScript"
    SKIE là một bước sinh code gắn sẵn trong compiler, hơi giống GraphQL Codegen viết TypeScript có kiểu từ một schema ở mỗi lần build. Kotlin bạn viết không đổi: chỉ thứ ngôn ngữ kia nhìn thấy là đổi. `for await (const s of stream)` trong JS là `for await s in stream` trong Swift.

## 2. Cài nó, và ghim Kotlin

SKIE là một plugin Gradle. Bạn khai báo nó một lần trong file build gốc, kèm phiên bản, và áp dụng nó trong module shared. Trên Kotlin 2.4.21 của m03, việc đó thất bại trước khi kịp compile gì:

!!! warning "Gotcha · SKIE hỗ trợ một danh sách phiên bản Kotlin cố định"
    Với SKIE 0.10.15 (phiên bản khoá học dùng) thêm vào project m03, mọi lệnh Gradle đều thất bại trong lúc cấu hình `:shared`:

    ```text
    Error: SKIE 0.10.15 does not support Kotlin 2.4.21.
      Supported versions are: [2.0.0, 2.0.10, …, 2.4.0, 2.4.10, 2.4.20].
      Check if you have the most recent version of SKIE and if so, please wait for the SKIE developers to add support for this Kotlin version.
      New Kotlin versions are usually supported within a few days after they are released.
      …
      To proceed with the compilation, please remove or explicitly disable SKIE by adding 'skie { isEnabled = false }' to your Gradle configuration.
    ```

    Một compiler plugin móc vào phần bên trong của compiler, thứ có thể đổi ở bất kỳ bản Kotlin nào, nên mỗi bản SKIE hỗ trợ một danh sách phiên bản Kotlin chính xác, chính là danh sách mà lỗi in ra. Từ m04, khoá học dùng **Kotlin 2.4.20**.
    Quy tắc cho app của team: **kiểm tra các phiên bản SKIE hỗ trợ trước khi nâng Kotlin**, và nâng hai thứ cùng nhau. Nếu có lúc bị chặn, thông báo lỗi chỉ sẵn lối thoát: `skie { isEnabled = false }` build mà không có SKIE (và không có gì nó sinh ra, nên code Swift dùng những thứ đó sẽ không compile được nữa).

Vậy file build gốc đổi theo hai cách: mọi plugin Kotlin đi từ 2.4.21 xuống 2.4.20, và SKIE được khai báo. Track Android của bạn quyết định file có những plugin Kotlin nào:

=== "Compose"

    ```kotlin title="build.gradle.kts (root)" hl_lines="4 5 6 7"
    plugins {
        id("com.android.application") version "9.4.1" apply false
        id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
        id("org.jetbrains.kotlin.multiplatform") version "2.4.20" apply false
        id("org.jetbrains.kotlin.plugin.compose") version "2.4.20" apply false
        id("org.jetbrains.kotlin.plugin.serialization") version "2.4.20" apply false
        id("co.touchlab.skie") version "0.10.15" apply false
    }
    ```

=== "XML"

    ```kotlin title="build.gradle.kts (root)" hl_lines="4 5"
    plugins {
        id("com.android.application") version "9.4.1" apply false
        id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
        id("org.jetbrains.kotlin.multiplatform") version "2.4.20" apply false
        id("co.touchlab.skie") version "0.10.15" apply false
    }
    ```

```kotlin title="shared/build.gradle.kts" hl_lines="4"
plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library")
    id("co.touchlab.skie")
}
⋯ kotlin { … }, as in m03
```

1. **Mọi plugin Kotlin đi cùng nhau.** Plugin Compose compiler và serialization được phát hành cùng Kotlin và mang số phiên bản của nó, nên chúng xuống 2.4.20 cùng với nó.
2. **`apply false` ở gốc, `id` trơn ở module**: file gốc khai báo plugin và phiên bản của nó cho cả bản build mà không áp dụng nó ở đó, còn `shared` áp dụng nó, lấy phiên bản từ gốc. Đó là cùng cách chia mà mọi plugin khác trong project đã dùng. `androidApp` không áp dụng SKIE: nó chỉ đụng tới framework iOS.
3. **Lần build đầu sau khi đổi chậm hơn**: Gradle tải plugin SKIE, và Kotlin/Native tải toolchain 2.4.20 của nó nếu chưa có (đường build của bài 05).

**Rồi xoá cầu nối:** `shared/src/iosMain/…/StateFlowWatcher.kt` trên cả hai track iOS, và `iosApp/iosApp/DeviceListObserver.swift` trên SwiftUI. `ViewModelResolver.kt` và `ViewModelOwner.swift` ở lại, vì SKIE chuyển đổi kiểu chứ không sở hữu gì cả: clear ViewModel vẫn là việc của bạn trên iOS (bài 08, mục 5).

**Tiếng ồn build bình thường.** Khi có SKIE, mỗi lần build Gradle còn in tám hoặc chín dòng dạng `Configuration '…' was resolved during configuration time`. Trong build Xcode chúng gọi tên `skieSubPlugin`, `skieCompilerPlugin` và vài cái khác; trong build Android chúng gọi tên các configuration của Kotlin và Android, nhưng vẫn đến từ SKIE (cùng bản build đó trên Kotlin 2.4.20 không có SKIE thì không in dòng nào).
Khi framework được build lại, build Xcode còn in `SLF4J: Failed to load class "org.slf4j.impl.StaticLoggerBinder"`. Không dòng nào trong số này đến từ code của chúng ta, và chúng không phải warning của compiler. Luật "không warning" của khoá học là về các dòng `w:` và `warning:` từ Kotlin và Swift của chúng ta.

**Analytics.** Mỗi lần build framework iOS còn chạy một task `skieUploadAnalytics…`. SKIE thu thập thống kê build mà tài liệu của nó gọi là "không định danh" (phiên bản, thời gian, phần cứng, cấu trúc project, thống kê git, và các thiết lập của chính nó) và gửi chúng về Touchlab ([SKIE Analytics](https://skie.touchlab.co/Analytics)).
Nếu chính sách của team không cho phép, `skie { analytics { enabled.set(false) } }` trong `shared/build.gradle.kts` tắt cả việc thu thập lẫn gửi. Khoá học để mặc định là bật.

## 3. Màn hình iOS: `for await` và `onEnum`

Bài 08 chia việc phía iOS thành hai: **sở hữu** ViewModel, và **quan sát** state của nó. SKIE chỉ thay nửa quan sát. Sơ đồ là sơ đồ của bài 08, sau khi đổi:

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 292" role="img" aria-labelledby="l09-obs-title">
<title id="l09-obs-title">Hai việc phía iOS trong m04. Sở hữu, hàng trên, không đổi so với bài 08: màn hình giữ một ViewModelOwner, owner giữ một ViewModelStore, store giữ DeviceListViewModel; deinit của owner clear chúng. Quan sát, hàng dưới: uiState giờ là một AsyncSequence có kiểu. Một Task Swift duyệt nó bằng for await: trên SwiftUI là modifier task của view, trên UIKit là một Task mà view controller cất giữ. Mỗi state đi tới màn hình: SwiftUI gán nó vào một property State, UIKit gọi render. Khi màn hình biến mất, task bị huỷ, vòng lặp kết thúc, và SKIE huỷ việc collect bên Kotlin. ViewModel và lần quét của nó không bị dừng bởi việc đó.</title>
<defs><marker id="l09-obs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text x="14" y="22" font-weight="600">Sở hữu: không đổi so với bài 08</text>
<g data-part="ios">
<rect class="box" x="14" y="34" width="140" height="40" rx="6"/>
<text class="title small" x="24" y="58">màn hình</text>
<rect class="box" x="178" y="34" width="172" height="40" rx="6"/>
<text class="title small" x="188" y="52">ViewModelOwner</text>
<text class="mono small" x="188" y="67">deinit: store.clear()</text>
</g>
<rect class="box" x="374" y="34" width="110" height="40" rx="6"/>
<text class="small" x="384" y="58">ViewModelStore</text>
<g data-part="inbound">
<rect class="box" x="508" y="34" width="118" height="40" rx="6"/>
<text class="title small" x="518" y="58">ViewModel</text>
</g>
<path class="edge" d="M156,54 L176,54" marker-end="url(#l09-obs-arrow)"/>
<path class="edge" d="M352,54 L372,54" marker-end="url(#l09-obs-arrow)"/>
<path class="edge" d="M486,54 L506,54" marker-end="url(#l09-obs-arrow)"/>
<text x="14" y="112" font-weight="600">Quan sát: một task Swift duyệt flow</text>
<g data-part="inbound">
<rect class="box" x="14" y="126" width="140" height="64" rx="6"/>
<text class="mono small" x="24" y="148">uiState</text>
<text class="small muted" x="24" y="164">AsyncSequence có kiểu,</text>
<text class="small muted" x="24" y="178">nhờ SKIE</text>
</g>
<g data-part="ios">
<rect class="box" x="178" y="126" width="196" height="64" rx="6"/>
<text class="mono small" x="188" y="146">for await state in uiState</text>
<text class="small muted" x="188" y="164">SwiftUI: bên trong .task { }</text>
<text class="small muted" x="188" y="178">UIKit: trong một Task cất giữ</text>
<rect class="box" x="398" y="120" width="228" height="32" rx="6"/>
<text class="small" x="408" y="140">SwiftUI: self.state = newState</text>
<rect class="box" x="398" y="164" width="228" height="32" rx="6"/>
<text class="small" x="408" y="184">UIKit: render(state)</text>
</g>
<path class="edge" d="M156,158 L176,158" marker-end="url(#l09-obs-arrow)"/>
<path class="edge" d="M376,150 L396,138" marker-end="url(#l09-obs-arrow)"/>
<path class="edge" d="M376,166 L396,178" marker-end="url(#l09-obs-arrow)"/>
<path class="edge dashed" d="M276,192 L276,214 L84,214 L84,194" marker-end="url(#l09-obs-arrow)"/>
<text class="small muted" x="96" y="232">Màn hình biến mất: task bị huỷ, vòng lặp kết thúc, và SKIE huỷ việc</text>
<text class="small muted" x="96" y="246">collect bên Kotlin. ViewModel và lần quét của nó vẫn chạy tiếp: chỉ deinit</text>
<text class="small muted" x="96" y="260">của owner dừng được chúng.</text>
<text class="small muted" x="14" y="280">Đã biến mất từ bài 08: StateFlowWatcher, Watch, và trên SwiftUI là DeviceListObserver.</text>
</svg>
<figcaption>Sở hữu vẫn viết tay; quan sát giờ là concurrency Swift thông thường trên một sequence do SKIE sinh ra.
<ul class="legend"><li data-part="inbound">ViewModel dùng chung</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="3 5 8 9 16 17 18"
    ⋯ imports, and a comment: the stateful half of the screen
    struct DeviceListView: View {
        @State private var owner = ViewModelOwner()
        @State private var filter = ""
        @State private var state: DeviceListUiState?

        var body: some View {
            let viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
            let state = self.state ?? viewModel.uiState.value
            DeviceListContent(
    ⋯ filter, isScanning, devices(in: state.scan), onScan: as in m03
            )
            .alert(
    ⋯ "Scan failed", bound to state.errorMessage: as in m03
            )
            .task {
                for await newState in viewModel.uiState {
                    self.state = newState
                }
            }
        }
    ⋯ devices(in:), in the next excerpt
    ```

    1. **`@State private var owner = ViewModelOwner()`**: giờ màn hình tự giữ owner, và `DeviceListObserver` đã biến mất. Tạo một owner rất rẻ (một store rỗng), đúng thứ Apple yêu cầu ở giá trị mặc định của `@State`. Điều đó sửa lối tắt mà bài 08 đã chỉ ra, khi `init` của observer tạo ViewModel và bắt đầu theo dõi.
    2. **`owner.viewModel(…)` trong `body`** chạy ở mỗi lần render, và luôn trả về cùng một instance: store tạo ViewModel ở lần gọi đầu và trả lại nó sau đó (bài 08, mục 5). Một ViewModel cho mỗi màn hình, tạo ở lần render đầu, bị clear khi owner đi.
    3. **`.task { for await newState in viewModel.uiState { … } }`**: với SKIE, `uiState` là một `AsyncSequence` của `DeviceListUiState`, nên vòng lặp không cần ép kiểu. SwiftUI bắt đầu task trước khi view hiện ra và huỷ nó "vào một lúc nào đó sau khi view biến mất" ([task(name:priority:file:line:_:)](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:))).
       Huỷ nó kết thúc vòng lặp, thứ huỷ việc collect bên Kotlin. Đó là `collectAsStateWithLifecycle` của SwiftUI.
    4. **`.task` chạy lại khi bạn quay về** từ màn hình chi tiết (gotcha của [bài 07](07-ui-declarative-danh-sach.md)). Ở đây điều đó vô hại, vì task chỉ *quan sát*. Lần quét sống trong ViewModel, và một vòng lặp mới nhận state mới nhất trước tiên.
    5. **`self.state ?? viewModel.uiState.value`**: cho tới khi vòng lặp giao giá trị đầu tiên, `body` đọc giá trị hiện tại của flow, giờ được SKIE gán kiểu `DeviceListUiState`. Một `StateFlow` luôn có giá trị. Property `@State` là thứ làm SwiftUI vẽ lại: mỗi lần gán trong vòng lặp cập nhật view.
    6. Compile ở chế độ Swift 6 **không có warning nào**. Các lỗi `Sendable` trong gotcha của bài 08 không xuất hiện với các kiểu của SKIE.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="5 13 14 15 22"
    ⋯ imports
    final class DeviceListViewController: UIViewController, UITableViewDelegate {
        private let owner = ViewModelOwner()
        private lazy var viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
        private var observation: Task<Void, Never>?
    ⋯ views and the data source, as in m03
    ⋯ viewDidLoad(): layout and the Scan action as in m03, then render(viewModel.uiState.value)

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
    ⋯ render(_:), in the next excerpt
    ```

    1. **`observation = Task { for await state in viewModel.uiState { render(state) } }`** thay cho watch. Một `UIViewController` là `@MainActor`, và một `Task` thừa hưởng actor của nơi gọi ([bài 07](07-ui-declarative-danh-sach.md), mục 3), nên `render` chạy trên main thread.
    2. **Huỷ trong `viewDidDisappear`**: huỷ task kết thúc vòng lặp và việc collect bên Kotlin, như `watch?.cancel()` ở m03. Trong lúc màn hình chi tiết được push, không gì render vào view đang ẩn; ViewModel vẫn quét tiếp, và khi danh sách hiện lại, vòng lặp mới nhận state mới nhất trước tiên.
    3. **`Task` giữ `self` mạnh**, khác callback `[weak self]` của m03. Ở đây ổn, vì `viewDidDisappear` luôn huỷ nó, thứ kết thúc vòng lặp và thả `self` ra. Không có lần huỷ đó, vòng lặp sẽ giữ view controller sống, và ViewModel của nó sẽ không bao giờ bị clear.
       `observation?.cancel()` trước mỗi `Task` mới đảm bảo không bao giờ còn một vòng lặp cũ đang chạy.
    4. **`render(viewModel.uiState.value)`** ở cuối `viewDidLoad`: SKIE gán kiểu cho `value`, nên frame đầu tiên cũng không cần watcher.

Nửa thứ hai của thay đổi là state sealed. Trước đây Swift thấy `ScanState` là một protocol, nên m03 ép kiểu bằng `as?` và có một nhánh dự phòng cho "không cái nào". Với SKIE, `onEnum(of:)` biến một `ScanState` thành một enum Swift, và một `switch` trên nó phải gọi tên mọi case:

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="4 5 6 7"
    ⋯ DeviceListView's properties and body
        // SKIE turns the sealed interface into a Swift enum, so this switch is exhaustive.
        private func devices(in scan: ScanState) -> [Device]? {
            switch onEnum(of: scan) {
            case .idle: nil
            case .scanning(let scanning): scanning.found
            case .finished(let finished): finished.found
            }
        }
    }
    ⋯ DeviceListContent, ScanStatus and DeviceRow: unchanged from m03
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="5 6 7 8"
    ⋯ properties and view lifecycle
        private func render(_ state: DeviceListUiState) {
            let isScanning = state.scan is ScanStateScanning
            // SKIE turns the sealed interface into a Swift enum, so this switch is exhaustive.
            let devices: [Device]? = switch onEnum(of: state.scan) {
            case .idle: nil
            case .scanning(let scanning): scanning.found
            case .finished(let finished): finished.found
            }
    ⋯ the rest of render(_:), renderError(_:) and the table delegate: unchanged from m03
    ```

Đây là thứ SKIE sinh ra cho `ScanState`. Bạn không bao giờ sửa file này, và nó không nằm trong source của bạn: nó được build lại cùng framework.

```swift title="shared/build/skie/…/swift/generated/DeviceMonitor__shared/DeviceMonitor__shared.ScanState.swift" hl_lines="4 11 12 19"
⋯ a "Generated by Touchlab SKIE 0.10.15" comment and an import
extension Shared.Skie.DeviceMonitor__shared.ScanState {
    @frozen
    public enum __Sealed : Swift.Hashable {
        case finished(Shared.ScanStateFinished)
        case idle(Shared.ScanStateIdle)
        case scanning(Shared.ScanStateScanning)
    }
}

public func onEnum<__Sealed : Shared.ScanState>(of sealed: __Sealed) -> Shared.Skie.DeviceMonitor__shared.ScanState.__Sealed {
    if let sealed = sealed as? Shared.ScanStateFinished {
        return Shared.Skie.DeviceMonitor__shared.ScanState.__Sealed.finished(sealed)
    } else if let sealed = sealed as? Shared.ScanStateIdle {
        return Shared.Skie.DeviceMonitor__shared.ScanState.__Sealed.idle(sealed)
    } else if let sealed = sealed as? Shared.ScanStateScanning {
        return Shared.Skie.DeviceMonitor__shared.ScanState.__Sealed.scanning(sealed)
    } else {
        fatalError("Unknown subtype \(sealed). This error should not happen under normal circumstances since SirClass: Shared.ScanState is sealed.")
    }
}
⋯ a second onEnum(of:) for an optional ScanState
```

1. **Các phép ép kiểu không biến mất; chúng chuyển vào code được sinh ra.** `onEnum(of:)` là cùng chuỗi `as?` mà m03 viết tay, được sinh từ sealed interface của Kotlin ở mỗi lần build. Nên nó luôn liệt kê đúng các lớp con mà Kotlin khai báo.
2. **Enum là thứ làm cho `switch` của bạn được kiểm tra.** Nó có một case cho mỗi lớp con, mỗi case mang object Kotlin có kiểu (`case .scanning(let scanning)` gắn một `ScanStateScanning`, nên `scanning.found` dùng được).
   Thêm một trường hợp Kotlin thứ tư thì enum có thêm case thứ tư ở lần build kế tiếp, nên mọi `switch` thiếu nó sẽ không compile được nữa. Chuỗi `as?` của m03 trả `nil` cho trường hợp mới và không nói gì.
3. **`fatalError`** bao trường hợp một lớp con không có trong danh sách. Như thông báo nói, chuyện đó không nên xảy ra trong điều kiện bình thường, vì danh sách được sinh từ kiểu sealed. (Nếu một số lớp con bị ẩn khỏi Swift, SKIE sẽ sinh một case `.else` thay vào: [Sealed classes](https://skie.touchlab.co/features/sealed).)
4. `isScanning` vẫn dùng `is ScanStateScanning`: một câu hỏi có/không không cần switch, và tên class từ `Shared.h` vẫn dùng được.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Cả hai làm cùng một việc trong vòng đời riêng của mình: bắt đầu một `for await` trên `uiState` khi màn hình hiện ra, huỷ nó khi màn hình biến mất. `.task` của SwiftUI tự huỷ giúp bạn, còn UIKit cất `Task` và huỷ nó trong `viewDidDisappear`.
    Cả hai track mất watcher Kotlin 23 dòng, SwiftUI còn mất observer 29 dòng, và cả hai chuyển từ ép kiểu sang một `switch` đủ nhánh.

## 4. Kotlin↔Swift đang đi về đâu

JetBrains đang xây **Swift export**: Kotlin được biên dịch thẳng thành một API Swift, thay vì qua một header Objective-C. Nó xuất flow "dưới dạng `AsyncSequence` của Swift" và ánh xạ các cây sealed sang enum Swift. Hiện nó đang ở Alpha: "vẫn chưa hoàn chỉnh, nên sẽ có những thay đổi phá vỡ tương thích" ([Swift export](https://kotlinlang.org/docs/native-swift-export.html)).
Khi nó chín, nó sẽ cho bạn thứ SKIE cho hôm nay mà không cần một compiler plugin bên thứ ba, và cùng với đó việc ghim phiên bản sẽ không còn. Cho tới lúc đó, khoá học dùng SKIE.

Những lựa chọn khác bạn sẽ gặp trong các codebase KMP: [KMP-NativeCoroutines](https://github.com/rickclephas/KMP-NativeCoroutines) (đánh dấu một flow hoặc một hàm suspend, và plugin của nó sinh một "bản native" bằng Kotlin mà các package Swift của nó biến thành một hàm `async`, một `AsyncSequence`, một Combine publisher hoặc một RxSwift observable) và [KMP-ObservableViewModel](https://github.com/rickclephas/KMP-ObservableViewModel), thứ mà [trang Compose Multiplatform ViewModel](https://kotlinlang.org/docs/multiplatform/compose-viewmodel.html) của JetBrains khuyên dùng để xài ViewModel dùng chung từ SwiftUI. Gộp lại chúng bao cùng hai việc như bài 08: sở hữu và quan sát.

## 5. Thực tế xảy ra gì

Chúng tôi build m04 (Kotlin 2.4.20, SKIE 0.10.15, Lifecycle 2.11.0, coroutines 1.11.0, AGP 9.4.1, Xcode 26.2) và chạy nó trên emulator Android 16 và simulator iOS 26.2.
Cả hai app hoạt động y hệt m03: các hàng tới từng cái một dưới "Scanning…", dòng trạng thái ghi "Devices found: 5" ở 3 s, chuỗi lọc `fail` hiện dialog "Scan failed", và rời màn hình danh sách iOS thì ViewModel của nó bị clear. Ảnh chụp ở [bài 08](08-viewmodel-dung-chung.md), mục 6, là những gì bạn nên thấy.

**m04 là một điểm dừng tự nhiên.** Nó xong khi cả hai app build được và hoạt động như ở m03. Hãy commit nó trước bài tiếp theo, bài bắt đầu từ trạng thái này.

!!! warning "Gotcha · `Shared.h` trông như không đổi"
    Tìm các kiểu của SKIE trong `Shared.h`, bạn sẽ thấy `uiState` được khai báo y như trước: `id<SharedKotlinx_coroutines_coreStateFlow>`. SKIE có thêm các class riêng của nó vào header (`SkieKotlinStateFlow` và các bạn của nó), nhưng property có kiểu nằm trong `Shared.framework/Headers/Shared.apinotes`, một file mà compiler Swift đọc cạnh header, nơi kiểu của `uiState` là `SharedSkieKotlinStateFlow<SharedDeviceListUiState *>`.
    Swift được sinh ra (`onEnum`, `SkieSwiftStateFlow`) nằm dưới `shared/build/skie/…/swift/generated/`. Khi Swift và header nói khác nhau, hãy tìm ở đó.

!!! question "Hỏi agent của bạn"
    Nhờ agent chỉ cho bạn, trong bản build của bạn, mục `uiState` trong `Shared.apinotes` và class `SkieSwiftStateFlow` được sinh ra, và trỏ vào dòng làm nó thành một `AsyncSequence`.
    Rồi hỏi: *"What would break, and where, if we bumped Kotlin to 2.4.21 tomorrow?"* (Cái gì sẽ hỏng, và ở đâu, nếu ngày mai ta nâng Kotlin lên 2.4.21?)

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">SKIE biến một <code>StateFlow&lt;T&gt;</code> của Kotlin thành gì?</p>
<div class="opts">
<button class="opt">một Combine publisher của các giá trị T</button>
<button class="opt" data-correct>một AsyncSequence Swift có kiểu của T</button>
<button class="opt">một class Swift @Observable giữ T</button>
</div>
<p class="feedback"></p>
<p class="why"><code>SkieSwiftStateFlow&lt;T&gt;</code> conform <code>AsyncSequence</code>, có <code>value</code> đúng kiểu. Bạn duyệt nó bằng <code>for await</code>, bên trong <code>.task</code> hoặc một <code>Task</code> cất giữ.</p>
</div>

<div class="quiz">
<p class="q">Team nâng Kotlin lên một bản vừa ra hôm qua. Lỗi đầu tiên nhiều khả năng là gì?</p>
<div class="opts">
<button class="opt" data-correct>Gradle cấu hình thất bại ở plugin SKIE</button>
<button class="opt">code Swift duyệt flow không compile được nữa</button>
<button class="opt">app Android crash lúc khởi động</button>
</div>
<p class="feedback"></p>
<p class="why">SKIE kiểm tra phiên bản Kotlin khi Gradle cấu hình <code>:shared</code>, và từ chối một phiên bản không có trong danh sách, trước khi compile gì. Chuyện đó xảy ra ở mọi lệnh Gradle, nên build Android cũng dừng.</p>
</div>

<div class="quiz">
<p class="q">Khi đã có SKIE, iOS vẫn cần file nào?</p>
<div class="opts">
<button class="opt">StateFlowWatcher, để collect trên main</button>
<button class="opt">DeviceListObserver, để phản chiếu state</button>
<button class="opt" data-correct>ViewModelOwner, để clear ViewModel</button>
</div>
<p class="feedback"></p>
<p class="why">SKIE chuyển đổi kiểu; nó không sở hữu gì cả. Clear ViewModel vẫn là việc của bạn trên iOS.</p>
</div>

<div class="quiz">
<p class="q">Bạn thêm một trường hợp thứ tư vào <code>ScanState</code> của Kotlin. <code>switch onEnum(of:)</code> Swift của m04 ra sao?</p>
<div class="opts">
<button class="opt">nó compile được, và trường hợp mới rơi về nil</button>
<button class="opt" data-correct>nó không compile được cho tới khi xử lý trường hợp đó</button>
<button class="opt">nó crash ở fatalError của onEnum lúc chạy</button>
</div>
<p class="feedback"></p>
<p class="why">SKIE sinh lại enum với case thứ tư, và một <code>switch</code> Swift phải đủ nhánh. Lặng lẽ rơi về <code>nil</code> là thứ chuỗi <code>as?</code> của m03 làm. <code>fatalError</code> của <code>onEnum</code> không bị chạm tới: trường hợp mới có trong danh sách được sinh ra của nó.</p>
</div>

<div class="quiz">
<p class="q">Danh sách SwiftUI biến mất sau màn hình chi tiết. Cái gì dừng lại?</p>
<div class="opts">
<button class="opt" data-correct>vòng for await và việc collect bên Kotlin của nó</button>
<button class="opt">lần quét, vì ViewModel bị clear</button>
<button class="opt">không gì cả: .task vẫn chạy bên dưới</button>
</div>
<p class="feedback"></p>
<p class="why">SwiftUI huỷ <code>.task</code>, thứ kết thúc vòng lặp, và SKIE huỷ việc collect bên Kotlin. ViewModel sống tiếp trong owner của nó, nên lần quét chạy tiếp, và <code>.task</code> kế tiếp nhận state mới nhất.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Swift của SKIE được biên dịch vào <code>Shared.framework</code>. Khi bạn build trong Xcode, cái gì tạo ra framework? (Bài 05)</p>
<div class="opts">
<button class="opt">Xcode tự compile các source Kotlin</button>
<button class="opt">một framework bạn build một lần rồi commit</button>
<button class="opt" data-correct>một build script chạy Gradle, trước phần Swift</button>
</div>
<p class="feedback"></p>
<p class="why">Build phase đầu tiên của target chạy <code>./gradlew :shared:embedAndSignAppleFrameworkForXcode</code>, thứ build framework (và, khi có SKIE, cả Swift được sinh ra của nó) trước khi Xcode compile Swift của bạn.</p>
</div>

<div class="quiz">
<p class="q">Vì sao lần quét không bao giờ được bắt đầu trong <code>.task</code> của danh sách? (Bài 07)</p>
<div class="opts">
<button class="opt" data-correct>.task chạy lại mỗi lần danh sách hiện lại</button>
<button class="opt">.task chạy trên một background thread</button>
<button class="opt">.task không gọi được code Kotlin</button>
</div>
<p class="feedback"></p>
<p class="why">Quay về từ màn hình chi tiết chạy lại <code>.task</code>. Quan sát trong đó thì vô hại, vì một vòng lặp mới chỉ đọc state mới nhất. Bắt đầu việc ở đó thì sẽ quét lại mỗi lần quay về.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m04 của bạn)"
    1. **Để compiler tìm các màn hình.** Thêm một trường hợp thứ tư, `data class Stopped(val found: List<Device>) : ScanState`, và build cả hai app mà không đổi gì khác. Liệt kê mọi lỗi, kèm file và dòng, trên mỗi nền tảng.
       Rồi checkout commit m03 của bạn (nơi Swift dùng `as?`) và làm lại: mỗi compiler nói gì lần này, và người dùng sẽ thấy gì trong một trạng thái `Stopped`? Quay lại m04 và bỏ trường hợp đó.
    2. **Một nút Stop.** Thêm `fun stopScan()` vào ViewModel: nó huỷ lần quét, và màn hình kết thúc bằng việc hiện những gì đã tìm thấy tới lúc đó. Trước khi viết, đoán xem dòng `_uiState.update { … Finished … }` sau `withTimeoutOrNull` có chạy khi job bị huỷ không, và kiểm tra lời đoán của bạn.
       Rồi làm cho nút Scan ghi "Stop" trong lúc quét (một nhãn suy ra) trên cả hai track của bạn.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html" -o .course/lesson-09.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/shared-viewmodel-cheatsheet.html" -o .course/ref-shared-viewmodel-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 09 (Kotlin↔Swift with SKIE): build milestone m04, iOS observing the shared ViewModel
through SKIE, on top of m03.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m03 project in demo/ (Lesson 08). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines and imports. All paths
are relative to demo/. Touch no file that isn't listed here.

1. Gradle (all tracks):
     build.gradle.kts (root): replaced. Every Kotlin plugin goes from 2.4.21 to 2.4.20, and
       id("co.touchlab.skie") version "0.10.15" apply false is added. Use the file for my
       Android track (Compose and XML differ).
     shared/build.gradle.kts: replaced (adds id("co.touchlab.skie") to plugins).

2. Delete the hand-written bridge:
     shared/src/iosMain/kotlin/com/example/devicemonitor/StateFlowWatcher.kt (all tracks)
     iosApp/iosApp/DeviceListObserver.swift (SwiftUI only)
   Keep ViewModelResolver.kt and ViewModelOwner.swift.

3. iOS screens:
     SwiftUI: iosApp/iosApp/DeviceListView.swift: replaced.
     UIKit: iosApp/iosApp/DeviceListViewController.swift: replaced.
   Every Android source and every other iOS file stays as in m03. After deleting files, run
   `xcodegen generate` in iosApp/ so the target's file list is refreshed.

4. Build both apps.
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
   The first build after the change downloads the SKIE plugin and, if it isn't installed yet,
   the Kotlin/Native 2.4.20 toolchain.

Acceptance checks (run every one you can, on an emulator and a simulator):
- Both builds succeed with no compiler warnings from our own Kotlin or Swift code, including
  the Kotlin/Native link step that runs inside the Xcode build (don't use -q to check warnings;
  read the build output). Not from our code, and expected: SKIE's eight or nine Gradle lines
  "Configuration '…' was resolved during configuration time" in each build, and the SLF4J
  "Failed to load class" lines whenever the framework is rebuilt (lesson section 2); Gradle's "Deprecated Gradle features …
  Gradle 10" line, "Unable to strip the following libraries" from the Android build, Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", and xcodebuild's
  "WARNING: Using the first of multiple matching destinations" (it can appear even with
  id=<UDID>).
- No reference to the bridge is left: grep the project for StateFlowWatcher, Watch( and
  DeviceListObserver (outside build/ folders) and find none.
- The pin: temporarily set the root file's Kotlin multiplatform plugin back to 2.4.21, run
  ./gradlew help, and see it fail with "SKIE 0.10.15 does not support Kotlin 2.4.21".
  Restore 2.4.20 and check ./gradlew help succeeds.
- Launch: as m03 (the title "Device Monitor", a "Device name filter" field, a full-width Scan
  button, "Tap Scan to look for devices." and an empty list).
- Tap Scan: the button is disabled, a spinner + "Scanning…" show in the normal (not red)
  colour, and rows appear one at a time (~0.3 s apart) in SampleDevices order. After ~3 s the
  status reads "Devices found: 5" and the button is enabled again.
- Filter "sens" + Scan: one row (Tire Pressure Sensor). Filter "zzz" + Scan: "Scanning…" for
  ~3 s, then the red "No devices found. Try another filter."
- Filter "fail" + Scan: a "Scan failed" dialog/alert with "Bluetooth adapter not responding
  (simulated)."; OK closes it, and the status reads "Tap Scan to look for devices."
- Rows open the detail screen; Back returns to the list with the results still shown. iOS: open
  a device during a scan, wait 3 s, come back: the list shows the finished scan.
- Android, driving the emulator: tap the filter field and use `adb shell input text`; find
  coordinates with `adb shell uiautomator dump`. A dump takes about 2 s, so judge mid-scan
  states (rows arriving, "Scanning…") from `adb exec-out screencap -p` screenshots instead.
  Android code didn't change, so the m03 rotation checks are optional.
- iOS timing: an XCUITest query also takes about 0.3 s, so judge the rows arriving one at a
  time from a sequence of screenshots (XCUIScreen.main.screenshot() in a loop), not by polling.
- iOS: confirm the ViewModel is cleared with its screen. Temporarily add printlns to the
  ViewModel: in an init block, in an onCleared() override, and in the collect block, each
  printing this@DeviceListViewModel.hashCode() (a bare hashCode() inside launch is the
  coroutine's). During a scan, replace the list screen with a new one, for example from a
  temporary toolbar or navigation-bar button: SwiftUI: give DeviceListView() in ContentView an
  .id(counter) and increment a @State counter; UIKit: set view.window?.rootViewController =
  UINavigationController(rootViewController: DeviceListViewController()). Check the console:
  the old ViewModel prints one "cleared", and finds no device after its cleared line. (The new
  ViewModel's init may print before the old one's "cleared": in our run, the old owner was
  released after the new view was built.) Remove the temporary code and rebuild. (Kotlin's println goes to the app's stdout. To capture it,
  launch with `xcrun simctl launch --stdout=<file> --stderr=<file> booted
  com.example.devicemonitor`; an XCUITest can then drive that running app with app.activate()
  instead of relaunching it.)
- iOS: if you can drive the simulator (xcrun simctl has no tap command; idb or a throwaway
  XCUITest that launches the installed app by bundle ID can. Don't script the Simulator window
  with System Events: its clicks and keystrokes are unreliable), run the Scan, filter, "fail"
  and row-tap checks above. In automation, the status text ends in the single character "…",
  not three dots. If you can't, say so and list which iOS checks you didn't run.
Then walk me through each changed file line by line, tied to the lesson's walkthrough numbers,
and show me, from the iOS simulator framework build
(shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/; run
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 if that folder doesn't exist): uiState's
line in Shared.h, its entry in Shared.apinotes, and the generated ScanState Swift file under
shared/build/skie/. Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Cheatsheet: ViewModel dùng chung trên bốn track](https://phongna-inn.github.io/carmd-kmp-course/reference/shared-viewmodel-cheatsheet.html): sở hữu và quan sát theo từng track, và Swift thấy gì khi có và không có SKIE.
- SKIE: [Flows](https://skie.touchlab.co/features/flows) (nguồn chính), [Sealed classes](https://skie.touchlab.co/features/sealed), [Analytics](https://skie.touchlab.co/Analytics), và changelog ([0.10.15](https://skie.touchlab.co/changelog/0.10.15)), nơi mỗi bản phát hành ghi phiên bản Kotlin mà nó thêm hỗ trợ.
- Kotlin↔Swift: [Swift/Objective-C interop](https://kotlinlang.org/docs/native-objc-interop.html), [Swift export (Alpha)](https://kotlinlang.org/docs/native-swift-export.html).
- Apple: [task(name:priority:file:line:_:)](https://developer.apple.com/documentation/swiftui/view/task(name:priority:file:line:_:)), [AsyncSequence](https://developer.apple.com/documentation/swift/asyncsequence).
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html): các thuật ngữ mới của bài này được đánh dấu (09).
- Kinh nghiệm thực tế: [Kotlin Slack](https://surveys.jetbrains.com/s3/kotlin-slack-sign-up), kênh #multiplatform, và [r/Kotlin](https://reddit.com/r/Kotlin). Tìm "SKIE Kotlin version" để xem các team khác lên lịch nâng Kotlin quanh các compiler plugin của họ thế nào.

## File đầy đủ

Mọi file bài này đổi, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Hai file bị xoá: `shared/src/iosMain/kotlin/com/example/devicemonitor/StateFlowWatcher.kt` trên mọi track, và `iosApp/iosApp/DeviceListObserver.swift` trên SwiftUI. Mọi thứ khác giữ như ở m03, kể cả mọi source Android.

**File build gốc**

=== "Compose"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
            id("org.jetbrains.kotlin.multiplatform") version "2.4.20" apply false
            id("org.jetbrains.kotlin.plugin.compose") version "2.4.20" apply false
            id("org.jetbrains.kotlin.plugin.serialization") version "2.4.20" apply false
            id("co.touchlab.skie") version "0.10.15" apply false
        }
        ```

=== "XML"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
            id("org.jetbrains.kotlin.multiplatform") version "2.4.20" apply false
            id("co.touchlab.skie") version "0.10.15" apply false
        }
        ```

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
            }
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
                let viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
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
            private lazy var viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
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
Ví dụ có output (A3, A4) là chương trình Swift đã compile và chạy thật (Swift 6.3.2, chế độ Swift 6). Tên file, kiểu và thông báo lỗi ở A2, A5, A6 lấy từ bản build m04 thật của repo này (Kotlin 2.4.20, SKIE 0.10.15). A7 là mô phỏng bấm được, không phải app thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A7](#a7-phong-thi-nghiem-battat-skie-oi-phien-ban-xem-ai-dung): **bấm thử** trước: bật/tắt SKIE, đổi phiên bản Kotlin, xem cái gì dừng khi màn hình ẩn.
    3. [A2](#a2-skie-la-phien-dich-vien-ung-sau-header): SKIE thật ra làm gì với framework (mục 1).
    4. [A3](#a3-ep-kieu-as-va-switch-onenum-chay-that-bang-swift) và [A4](#a4-for-await-va-huy-hai-chieu-chay-that-bang-swift): hai thứ SKIE cho Swift, chạy thật (mục 1 và 3).
    5. [A5](#a5-vi-sao-skie-ghim-phien-ban-kotlin): cái giá phải trả (mục 2).
    6. [A6](#a6-truoc-va-sau-file-nao-i-file-nao-o-lai-tim-o-au): file nào đi, file nào ở lại, và tìm code sinh ra ở đâu.

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Swift không đọc Kotlin trực tiếp; nó đọc **header Objective-C** (`Shared.h`). Header đó làm mất hai thứ: kiểu bên trong `StateFlow<…>`, và việc `ScanState` chỉ có đúng ba trường hợp.
    2. **SKIE** là một plugin chạy lúc build framework, **thêm** code Swift để trả lại hai thứ đó. Kotlin bạn viết không đổi một dòng.
    3. Nhờ vậy Swift viết được `for await state in viewModel.uiState` (không cần watcher) và `switch onEnum(of: scan)` (compiler bắt thiếu case).
    4. Việc **sở hữu** ViewModel (`ViewModelOwner`) vẫn là của bạn; SKIE chỉ thay việc **quan sát**.
    5. Cái giá: mỗi bản SKIE chỉ chạy với **một danh sách phiên bản Kotlin cố định**, nên Kotlin bị ghim ở 2.4.20 và phải nâng cùng SKIE.

| Chữ trong bài | Nói đơn giản | Trong m04 là |
|---|---|---|
| compiler plugin | đoạn code cắm vào trình biên dịch Kotlin, chạy ở mỗi lần build | SKIE (`co.touchlab.skie`) |
| header Objective-C | "bản mô tả" Kotlin mà Swift đọc được; hiểu được ít kiểu | `Shared.h` |
| `.apinotes` | file ghi chú Swift đọc kèm header, sửa lại tên/kiểu mà không đổi header | `Shared.apinotes` (`uiState` có kiểu) |
| `AsyncSequence` | thứ Swift duyệt được bằng `for await`, như async iterable bên JS | `SkieSwiftStateFlow<DeviceListUiState>` |
| `for await` | vòng lặp chờ từng giá trị mới, không chặn thread | trong `.task` (SwiftUI) / `Task` (UIKit) |
| `.task { }` | việc async gắn với view: bắt đầu khi hiện, huỷ khi biến mất | quan sát `uiState` trên SwiftUI |
| `onEnum(of:)` | hàm SKIE sinh ra, đổi sealed Kotlin thành enum Swift | `switch onEnum(of: state.scan)` |
| exhaustive (đủ nhánh) | `switch` phải xử lý mọi case, thiếu là lỗi compile | 3 case `idle/scanning/finished` |
| ghim phiên bản | dùng đúng một phiên bản vì công cụ khác chỉ chạy với nó | Kotlin 2.4.20 cho SKIE 0.10.15 |
| Swift export | cách mới của JetBrains: Kotlin → Swift trực tiếp, không qua Objective-C (Alpha) | chưa dùng |

### A2. SKIE là "phiên dịch viên" đứng sau header

Giải thích thêm cho [mục 1](#1-skie-sinh-ra-gi) và gotcha "`Shared.h` trông như không đổi" ở [mục 5](#5-thuc-te-xay-ra-gi).

Ví dụ đời thường: Kotlin nói tiếng Việt, Swift nói tiếng Anh, và **Objective-C là một phiên dịch viên vốn từ ít**. Nghe "danh sách các thiết bị" thì người này chỉ dịch được "một danh sách gì đó" (mất kiểu). Nghe "trạng thái chỉ có thể là Chờ, Đang quét hoặc Xong" thì dịch thành "có một loại trạng thái, và có ba thứ trông giống trạng thái" (mất chữ "chỉ").

SKIE **không đuổi** phiên dịch viên đó. Nó đứng cạnh và đưa thêm hai tờ giấy:

1. **Tờ ghi chú** (`Shared.apinotes`): "chỗ nãy anh dịch là *một danh sách gì đó*, thật ra là *danh sách `DeviceListUiState`*". Swift đọc tờ ghi chú cùng lúc với header.
2. **Cuốn sổ tay mẫu câu** (Swift được sinh ra): `SkieSwiftStateFlow` để duyệt flow bằng `for await`, và `onEnum` + enum `__Sealed` để `switch` trên state.

Đây là những gì ba tờ đó thật sự ghi, đọc từ bản build m04 của repo này:

| Ở đâu | Ghi gì về `uiState` / `ScanState` |
|---|---|
| `Shared.framework/Headers/Shared.h` | `@property (readonly) id<SharedKotlinx_coroutines_coreStateFlow> uiState` (y như m03) |
| `Shared.framework/Headers/Shared.apinotes` | `Name: "uiState"` … `Type: "SharedSkieKotlinStateFlow<SharedDeviceListUiState *> * _Nonnull"` |
| `shared/build/skie/…/Skie/Skie.SkieSwiftStateFlow.swift` | `public final class SkieSwiftStateFlow<T> : Shared.SkieSwiftFlowProtocol` … `public var value: T` |
| `shared/build/skie/…/Skie/Skie.SkieSwiftFlowProtocol.swift` | `public protocol SkieSwiftFlowProtocol<Element> : _Concurrency.AsyncSequence` ← **dòng làm nó thành `AsyncSequence`** |
| `shared/build/skie/…/DeviceMonitor__shared.ScanState.swift` | `enum __Sealed` với `case finished`, `case idle`, `case scanning`, và `onEnum(of:)` |

Dòng thứ tư là câu trả lời cho nửa đầu phần "Hỏi agent" ở mục 5: `SkieSwiftStateFlow` conform `SkieSwiftFlowProtocol`, và protocol đó kế thừa `AsyncSequence`.

### A3. Ép kiểu `as?` và `switch onEnum`, chạy thật bằng Swift

Giải thích thêm cho phần `onEnum` ở [mục 3](#3-man-hinh-ios-for-await-va-onenum) và câu ôn thứ tư.

Chương trình dưới đây dựng lại đúng thứ Swift thấy (một protocol cộng các class, như `Shared.h`), rồi giả sử Kotlin vừa thêm trường hợp thứ tư `Paused`. Nó so hai cách đọc: chuỗi `as?` của m03 và `switch` trên enum kiểu SKIE.

```swift title="cast.swift"
// Mô hình những gì Swift thấy từ Kotlin: một protocol + các class (như Shared.h).
protocol ScanState {}
final class ScanStateIdle: ScanState {}
final class ScanStateScanning: ScanState { let found: [String]; init(_ f: [String]) { found = f } }
final class ScanStateFinished: ScanState { let found: [String]; init(_ f: [String]) { found = f } }
// Kotlin vừa thêm trường hợp thứ tư, Swift được build lại:
final class ScanStatePaused: ScanState { let found: [String]; init(_ f: [String]) { found = f } }

// Cách m03: chuỗi as?. Thiếu Paused nhưng compiler không nói gì.
func devicesByCasting(_ scan: ScanState) -> [String]? {
    if let s = scan as? ScanStateScanning { return s.found }
    if let f = scan as? ScanStateFinished { return f.found }
    return nil
}

// Cách SKIE: một enum, switch phải đủ mọi case.
enum Sealed { case idle(ScanStateIdle), scanning(ScanStateScanning), finished(ScanStateFinished), paused(ScanStatePaused) }
func onEnum(of scan: ScanState) -> Sealed {
    if let s = scan as? ScanStateScanning { return .scanning(s) }
    if let s = scan as? ScanStateFinished { return .finished(s) }
    if let s = scan as? ScanStatePaused { return .paused(s) }
    if let s = scan as? ScanStateIdle { return .idle(s) }
    fatalError("Unknown subtype")
}
func devicesBySwitch(_ scan: ScanState) -> [String]? {
    switch onEnum(of: scan) {
    case .idle: nil
    case .scanning(let s): s.found
    case .finished(let f): f.found
    case .paused(let p): p.found
    }
}

let paused = ScanStatePaused(["OBD-II Adapter", "Heart Rate Monitor"])
print("as? chain  :", devicesByCasting(paused).map { "\($0)" } ?? "nil", "← mất 2 thiết bị, không ai cảnh báo")
print("switch enum:", devicesBySwitch(paused).map { "\($0)" } ?? "nil")
```

```text title="Output"
as? chain  : nil ← mất 2 thiết bị, không ai cảnh báo
switch enum: ["OBD-II Adapter", "Heart Rate Monitor"]
```

Giờ xoá đúng một dòng `case .paused(let p): p.found` khỏi `devicesBySwitch` (giống việc Kotlin thêm case mà Swift chưa cập nhật) và compile lại:

```text title="swiftc -swift-version 6 forgot.swift"
forgot.swift:26:5: error: switch must be exhaustive
24 | }
25 | func devicesBySwitch(_ scan: ScanState) -> [String]? {
26 |     switch onEnum(of: scan) {
   |     |- error: switch must be exhaustive
   |     `- note: add missing case: '.paused(_)'
```

- Chuỗi `as?` **compile được và chạy được**, nhưng `Paused` rơi xuống `return nil`: hai thiết bị đã tìm thấy biến mất khỏi màn hình, không ai được báo.
- `switch` trên enum **không compile được**, và compiler còn gợi ý đúng case còn thiếu. Lỗi xảy ra trên máy dev, không phải trên máy người dùng.
- Bản thân `onEnum` vẫn là một chuỗi `as?` (như file SKIE sinh ra ở mục 3). Khác biệt là chuỗi đó **được sinh lại từ Kotlin ở mỗi lần build**, nên không bao giờ thiếu case.

Mình dùng `Paused` thay vì `Stopped` của bài tự làm 1 để không làm hộ bài đó; hãy tự chạy với `Stopped` trên app thật.

### A4. `for await` và huỷ hai chiều, chạy thật bằng Swift

Giải thích thêm cho đoạn "Huỷ hoạt động theo cả hai chiều" ở [mục 1](#1-skie-sinh-ra-gi) và ý 3 (SwiftUI) / ý 2 (UIKit) ở [mục 3](#3-man-hinh-ios-for-await-va-onenum).

Ví dụ đời thường: `for await` là **xem livestream**. Bạn ngồi xem, mỗi khi có khung hình mới thì thấy ngay. Tắt app xem (huỷ `Task`) thì nền tảng **ngắt luồng phát cho riêng bạn** (SKIE huỷ việc collect bên Kotlin). Nhưng người đang livestream (ViewModel) vẫn tiếp tục phát.

Chương trình dưới đây dùng `AsyncStream` thay cho `SkieSwiftStateFlow` (cùng là `AsyncSequence`). `onTermination` đóng vai "SKIE huỷ việc collect bên Kotlin".

```swift title="await.swift"
// Mô hình của SkieSwiftStateFlow: một AsyncSequence. Ở đây dùng AsyncStream,
// và onTermination đóng vai "SKIE huỷ việc collect bên Kotlin".
func uiStates() -> AsyncStream<String> {
    AsyncStream { continuation in
        let producer = Task {
            for state in ["Idle", "Scanning(1)", "Scanning(2)", "Scanning(3)", "Finished(5)"] {
                continuation.yield(state)
                try? await Task.sleep(for: .milliseconds(300))
            }
        }
        continuation.onTermination = { _ in
            producer.cancel()
            print("  [Kotlin] việc collect bị huỷ")
        }
    }
}

@main struct Demo {
    static func main() async {
        print("— Màn hình hiện: .task bắt đầu vòng for await")
        let observation = Task {
            for await state in uiStates() {      // không cần ép kiểu: state là String
                print("  render(\(state))")
            }
            print("  vòng lặp kết thúc")
        }
        try? await Task.sleep(for: .milliseconds(750))
        print("— Màn hình biến mất: huỷ task")
        observation.cancel()
        await observation.value
    }
}
```

```text title="Output"
— Màn hình hiện: .task bắt đầu vòng for await
  render(Idle)
  render(Scanning(1))
  render(Scanning(2))
— Màn hình biến mất: huỷ task
  [Kotlin] việc collect bị huỷ
  vòng lặp kết thúc
```

- `state` trong vòng lặp có kiểu `String` ngay, không ép kiểu. Trong app, nó là `DeviceListUiState`, cũng nhờ SKIE.
- Huỷ `observation` (như `.task` bị huỷ khi view biến mất, hay `observation?.cancel()` trong `viewDidDisappear`) làm `onTermination` chạy **trước**, rồi vòng lặp mới kết thúc. Bên Kotlin, đó là lúc `collect` bị huỷ.
- Chương trình compile ở chế độ Swift 6 không có warning `Sendable` nào, giống điều bài nói về các kiểu của SKIE (ý 6 SwiftUI).

So với những thứ bạn đã biết:

| | JS / TS | Kotlin (Android) | Swift + SKIE (iOS) |
|---|---|---|---|
| duyệt luồng giá trị | `for await (const s of stream)` | `flow.collect { s -> }` | `for await s in flow` |
| tự dừng khi màn hình ẩn | `AbortController` tự viết | `collectAsStateWithLifecycle` / `repeatOnLifecycle` | `.task { }` / huỷ `Task` trong `viewDidDisappear` |
| dừng xem có dừng nguồn không | tuỳ nguồn | không: ViewModel vẫn chạy | không: ViewModel vẫn chạy |

### A5. Vì sao SKIE ghim phiên bản Kotlin

Giải thích thêm cho gotcha ở [mục 2](#2-cai-no-va-ghim-kotlin).

Ví dụ đời thường: SKIE là **phụ tùng độ xe** gắn thẳng vào bên trong động cơ (compiler). Mỗi đời động cơ mới có thể dời một con ốc, nên nhà làm phụ tùng phải thử lại rồi mới ghi "lắp vừa đời X". Một plugin bình thường (như thư viện) chỉ gắn vào "bên ngoài" nên ít khi bị vậy.

Đây là lỗi thật khi mình tạm đổi Kotlin lên 2.4.21 trong repo này rồi chạy `./gradlew help`:

```text
> Error: SKIE 0.10.15 does not support Kotlin 2.4.21.
  Supported versions are: [2.0.0, 2.0.10, 2.0.20, 2.0.21, 2.1.0, 2.1.10, 2.1.20, 2.1.21, 2.2.0, 2.2.10, 2.2.20, 2.2.21, 2.3.0, 2.3.10, 2.3.20, 2.3.21, 2.4.0, 2.4.10, 2.4.20].
BUILD FAILED in 6s
```

Đổi về 2.4.20 thì `./gradlew help` lại `BUILD SUCCESSFUL`. Danh sách đầy đủ cho thấy 2.4.20 là bản mới nhất mà SKIE 0.10.15 nhận.

Áp vào team, một quy trình nâng Kotlin an toàn:

1. Xem changelog SKIE: bản nào đã thêm hỗ trợ Kotlin mới?
2. Nâng **cả hai** trong cùng một commit: plugin Kotlin (cả `compose`, `serialization` đi kèm) và `co.touchlab.skie`.
3. Build cả Android lẫn iOS. Nhớ rằng lỗi SKIE chặn **mọi** lệnh Gradle, kể cả build Android.
4. Kẹt gấp thì `skie { isEnabled = false }` cho Gradle chạy, nhưng Swift dùng `for await` trên `uiState` và `onEnum` sẽ hỏng: đó chỉ là cách mở khoá tạm để làm việc khác.

Đây cũng là câu trả lời cho nửa sau phần "Hỏi agent" ở mục 5 ("cái gì hỏng nếu nâng lên 2.4.21?"): hỏng ngay ở bước cấu hình Gradle của `:shared`, trên cả hai app, trước khi compile dòng nào.

### A6. Trước và sau: file nào đi, file nào ở lại, tìm ở đâu

Gom các thay đổi rải rác của bài vào một bảng, theo đúng hai việc của bài 08.

| Việc | m03 (bài 08) | m04 (bài 09) | Vì sao |
|---|---|---|---|
| **sở hữu** ViewModel | `ViewModelOwner.swift` + `ViewModelResolver.kt` | **giữ nguyên** | SKIE chuyển kiểu, không sở hữu gì |
| **quan sát** (Kotlin) | `StateFlowWatcher.kt` + `Watch` | **xoá** | `uiState` đã là `AsyncSequence` |
| **quan sát** (SwiftUI) | `DeviceListObserver.swift` (`@Observable`) | **xoá**; `@State var state` + `.task { for await }` | `.task` tự huỷ theo view |
| **quan sát** (UIKit) | `watch` trong `viewWillAppear` / `viewDidDisappear` | `observation: Task` ở đúng hai chỗ đó | cùng vòng đời, khác công cụ |
| đọc `ScanState` | `as?` + nhánh dự phòng `nil` | `switch onEnum(of:)` đủ nhánh | enum được sinh ra |
| đọc `value` lúc đầu | `StateFlowWatcher(…).value` | `viewModel.uiState.value` | `value` đã có kiểu |
| Android | không đổi | không đổi (chỉ Kotlin 2.4.20) | SKIE chỉ chạm framework iOS |

Khi Swift báo lỗi kiểu mà bạn không hiểu, tìm theo thứ tự:

1. `Shared.h`: Kotlin trông thế nào **trước** SKIE.
2. `Shared.apinotes`: SKIE **đổi kiểu** gì cho Swift.
3. `shared/build/skie/…/swift/generated/`: SKIE **thêm** hàm/kiểu Swift gì (`onEnum`, `SkieSwiftStateFlow`…).

Mẹo: chạy `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64` nếu thư mục `shared/build/bin/…/Headers/` chưa có.

### A7. Phòng thí nghiệm: bật/tắt SKIE, đổi phiên bản, xem ai dừng

Ba mô phỏng bấm được. Chúng là mô hình dựng theo bài và theo bản build m04 thật, không phải compiler hay app thật.

#### 1. Swift thấy gì?

Tắt/bật SKIE để so ba cột: Kotlin bạn viết, thứ Swift thấy, và Swift bạn phải viết. Rồi tick **Kotlin thêm case Paused** để xem build Xcode phản ứng thế nào ở mỗi chế độ ([A3](#a3-ep-kieu-as-va-switch-onenum-chay-that-bang-swift)).

<div class="lab" id="l09-lens"></div>

#### 2. Cổng phiên bản Kotlin

Chọn phiên bản Kotlin trong file build gốc và xem SKIE 0.10.15 cho qua hay chặn. Bỏ tick "SKIE đang bật" để thấy lối thoát `skie { isEnabled = false }` đổi được gì và mất gì ([A5](#a5-vi-sao-skie-ghim-phien-ban-kotlin)).

<div class="lab" id="l09-gate"></div>

#### 3. Ai dừng cái gì?

Bấm Scan, rồi mở một thiết bị giữa lúc quét, chờ vài giây, rồi Back. Cuối cùng thử gỡ hẳn màn hình. Bốn làn cho thấy cái gì còn chạy: màn hình, `Task` Swift, việc collect bên Kotlin, và ViewModel ([A4](#a4-for-await-va-huy-hai-chieu-chay-that-bang-swift), [A6](#a6-truoc-va-sau-file-nao-i-file-nao-o-lai-tim-o-au)).

<div class="lab" id="l09-lanes"></div>

!!! tip "Điều cần thấy ở mô phỏng 3"
    Mở thiết bị làm **hai làn giữa tắt** (Task, collect) nhưng **làn ViewModel vẫn sáng** và vẫn đếm. Back thì Task mới hiện ngay state mới nhất. Chỉ "Gỡ hẳn màn hình" mới tắt làn ViewModel: đó là việc của `ViewModelOwner`, không phải của SKIE.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 10.

- [ ] Giải thích header Objective-C làm mất gì, và SKIE trả lại gì, bằng lời của mình (xem [A2](#a2-skie-la-phien-dich-vien-ung-sau-header)).
- [ ] Cài SKIE: khai báo ở file build gốc với `apply false`, áp dụng ở `shared`, và hạ mọi plugin Kotlin về cùng một phiên bản được hỗ trợ.
- [ ] Nói được vì sao một compiler plugin ghim phiên bản Kotlin, và quy trình nâng Kotlin an toàn cho team (xem [A5](#a5-vi-sao-skie-ghim-phien-ban-kotlin), thử [cổng phiên bản](#2-cong-phien-ban-kotlin)).
- [ ] Xoá cầu nối viết tay và giữ đúng phần sở hữu (`ViewModelOwner`, `ViewModelResolver`) (xem [A6](#a6-truoc-va-sau-file-nao-i-file-nao-o-lai-tim-o-au)).
- [ ] Quan sát `uiState` bằng `for await` trong `.task` (SwiftUI) hoặc một `Task` cất giữ và huỷ đúng lúc (UIKit) (xem [A4](#a4-for-await-va-huy-hai-chieu-chay-that-bang-swift)).
- [ ] Đọc state sealed bằng `switch onEnum(of:)`, và giải thích vì sao nó an toàn hơn chuỗi `as?` (xem [A3](#a3-ep-kieu-as-va-switch-onenum-chay-that-bang-swift), thử [Swift thấy gì?](#1-swift-thay-gi)).
- [ ] Phân biệt cái gì dừng khi màn hình ẩn (task, collect) và cái gì chỉ dừng khi owner đi (ViewModel, lần quét) (thử [Ai dừng cái gì?](#3-ai-dung-cai-gi)).
- [ ] Tìm được `uiState` trong `Shared.h`, `Shared.apinotes` và Swift được sinh ra dưới `shared/build/skie/`.
- [ ] Biết Swift export, KMP-NativeCoroutines và KMP-ObservableViewModel là gì, ở mức một câu mỗi cái.
- [ ] Làm xong 2 bài tự làm ở trên mà không cần agent.

