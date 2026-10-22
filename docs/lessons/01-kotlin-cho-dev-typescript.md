# Kotlin cho dev TypeScript

<p class="kicker">Bài 01 · Tuần 1 · Ngày 1 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/01-kotlin-for-typescript-devs.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2 giờ</span>
  <span class="tag">Milestone: chương trình nháp (Kotlin)</span>
  <span class="tag">Cần trước: TypeScript</span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Code dùng chung của app là Kotlin. Hết bài này, bạn sẽ viết xong một chương trình Kotlin nhỏ: một bản quét BLE giả, đẩy các thiết bị vào một state có thể theo dõi được.
    Đúng khuôn đó là thứ app thật làm từ bài 08, và từ bài 13 thì sau lưng là sóng radio thật. Bài 02 viết lại chính chương trình này bằng Swift.

!!! info "Nguồn chính"
    [Coroutines basics](https://kotlinlang.org/docs/coroutines-basics.html) và [Asynchronous Flow](https://kotlinlang.org/docs/flow.html) của Kotlin.
    Coroutine là chỗ trực giác TypeScript giúp ít nhất, nên đọc hai trang đó song song với mục 4 và 5.

## Bản đồ: thứ bạn đã biết

Phần lớn cú pháp chuyển gần như một-một. Lướt bảng này bây giờ, lát quay lại tra sau.
Những dòng ghi **(mới)** không có thứ tương đương thật sự trong TypeScript, và bài này dành thời gian cho chúng.

| Ý tưởng | TypeScript | Kotlin |
|---|---|---|
| Hằng / biến | `const` / `let` | `val` / `var` |
| Kiểu có thể null | `string \| null` | `String?` |
| Truy cập an toàn / giá trị dự phòng | `a?.b ?? x` | `a?.b ?: x` |
| "Tin tôi đi, không null đâu" | `a!` (không kiểm tra) | `a!!` (ném lỗi) |
| Hợp đồng | `interface` | `interface` |
| Object giữ giá trị, có so sánh bằng và copy **(mới)** | không có (object so theo tham chiếu) | `data class` |
| Discriminated union | `{kind:'a'} \| {kind:'b'}` | `sealed interface` |
| Arrow function | `(x) => x * 2` | `{ x -> x * 2 }`, hoặc `it` |
| Thêm method cho một kiểu có sẵn | (hack prototype) | extension function |
| Hàm bất đồng bộ **(nghĩa mới)** | `async` / `await`, `Promise` | `suspend fun`, không có Promise |
| Luồng giá trị bất đồng bộ | RxJS `Observable`, async generator | `Flow` |
| Chỗ giữ "giá trị hiện tại" | RxJS `BehaviorSubject` | `StateFlow` |
| "Chỉ chạy trên luồng UI" **(mới)** | không có (chỉ một luồng) | `Dispatchers.Main` |

## 1. Khai báo và null safety

`val` là `const` của TypeScript; mặc định hãy dùng nó. Kiểu đứng sau tên, như trong TS.
Nâng cấp thật sự là null safety nằm trong hệ thống kiểu và được áp dụng **ở mọi nơi**, không có công tắc `strictNullChecks`, cũng không có cửa thoát `any`
([Kotlin docs: Null safety](https://kotlinlang.org/docs/null-safety.html)).

<div class="compare" markdown>
<div markdown>

```ts title="TypeScript"
const name: string | null = scan();
const label = name ?? "Unknown";
const len = name?.length;
```

</div>
<div markdown>

```kotlin title="Kotlin"
val name: String? = scan()
val label = name ?: "Unknown"
val len = name?.length
```

</div>
</div>

Toán tử dự phòng của Kotlin là `?:` (toán tử "Elvis"), không phải `??`.
Và `name!!` ném `NullPointerException` **thật** nếu `name` là null. Trong TS, `name!` chỉ làm trình biên dịch im lặng.

## 2. Data class và sealed interface

`data class` là class có nhiệm vụ giữ giá trị. Kotlin tự sinh `equals()`, `hashCode()`, `toString()` và `copy()` từ các thuộc tính trong constructor
([docs](https://kotlinlang.org/docs/data-classes.html)).
Hai thiết bị có cùng field thì `==` nhau, điều không bao giờ xảy ra với object thường của TS.

```kotlin
data class Device(val name: String?, val address: String, val rssi: Int)

val a = Device("OBD-II Dongle", "AA:01", -48)
a == a.copy()             // true: so sánh theo cấu trúc
a.copy(rssi = -50)        // một Device mới; `a` không bị đụng tới
```

`sealed interface` là một tập kiểu con **đóng**, tất cả đều biết được lúc biên dịch
([docs](https://kotlinlang.org/docs/sealed-classes.html)).
Nó là discriminated union của TypeScript, nhưng không cần field `kind` viết tay:

<div class="compare" markdown>
<div markdown>

```ts title="TypeScript"
type ScanState =
  | { kind: "idle" }
  | { kind: "scanning"; found: number }
  | { kind: "done"; devices: Device[] };
```

</div>
<div markdown>

```kotlin title="Kotlin"
sealed interface ScanState {
    data object Idle : ScanState
    data class Scanning(val found: Int) : ScanState
    data class Done(val devices: List<Device>) : ScanState
}
```

</div>
</div>

Vì tập này đóng, biểu thức `when` trên nó phải xử lý mọi trường hợp, và trình biên dịch kiểm tra điều đó giùm bạn. TypeScript cần mẹo `never` mới có được đảm bảo tương tự.
Bạn sẽ dựa vào nó liên tục: danh sách thiết bị của app giữ một `ScanState` sealed rất giống cái này bên trong UI state, và mọi màn hình hiện kết quả quét đều `when` trên nó.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 200" role="img" aria-labelledby="l01-sealed-title">
<title id="l01-sealed-title">Sealed interface là một tập đóng gồm ba kiểu con; biểu thức when có đúng một nhánh cho mỗi kiểu con, nên không cần else.</title>
<defs><marker id="l01-sealed-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="edge dashed" x="20" y="20" width="230" height="150" rx="10"/>
<text class="mono" x="35" y="42">sealed interface ScanState</text>
<rect class="box" x="40" y="56" width="190" height="28" rx="5"/><text class="mono small" x="135" y="74" text-anchor="middle">data object Idle</text>
<rect class="box" x="40" y="94" width="190" height="28" rx="5"/><text class="mono small" x="135" y="112" text-anchor="middle">data class Scanning(found)</text>
<rect class="box" x="40" y="132" width="190" height="28" rx="5"/><text class="mono small" x="135" y="150" text-anchor="middle">data class Done(devices)</text>
<rect class="box" x="390" y="20" width="230" height="150" rx="10"/>
<text class="mono" x="405" y="42">when (state) {</text>
<rect class="box" x="410" y="56" width="190" height="28" rx="5"/><text class="mono small" x="505" y="74" text-anchor="middle">Idle -&gt; …</text>
<rect class="box" x="410" y="94" width="190" height="28" rx="5"/><text class="mono small" x="505" y="112" text-anchor="middle">is Scanning -&gt; …</text>
<rect class="box" x="410" y="132" width="190" height="28" rx="5"/><text class="mono small" x="505" y="150" text-anchor="middle">is Done -&gt; …</text>
<path class="edge" d="M230,70 L408,70" marker-end="url(#l01-sealed-arrow)"/>
<path class="edge" d="M230,108 L408,108" marker-end="url(#l01-sealed-arrow)"/>
<path class="edge" d="M230,146 L408,146" marker-end="url(#l01-sealed-arrow)"/>
<text class="small muted" x="320" y="62" text-anchor="middle">mỗi kiểu một nhánh</text>
<text class="small muted" x="320" y="192" text-anchor="middle">Không cần else: trình biên dịch biết mọi kiểu con. Thêm kiểu thứ tư là when hết biên dịch được.</text>
</svg>
<figcaption>Sealed interface là một tập đóng, nên trình biên dịch kiểm tra được <code>when</code> đã phủ hết nó chưa.</figcaption>
</figure>

## 3. Lambda, collection, extension function

Collection đọc giống mảng JS: `filter`, `map`, `joinToString`. Lambda có một tham số thì tham số đó ngầm tên là `it`.
Khi đối số cuối cùng là lambda, nó được đưa ra ngoài dấu ngoặc (gọi là "trailing lambda")
([docs](https://kotlinlang.org/docs/lambdas.html)).

```kotlin
devices.filter { it.rssi > -80 }.map { it.name ?: "Unknown" }
```

Extension function thêm một method cho kiểu bạn không sở hữu, không cần kế thừa hay đụng tới prototype.
Nó được phân giải tĩnh, nên thật ra chỉ là một hàm bình thường với cú pháp đẹp hơn
([docs](https://kotlinlang.org/docs/extensions.html)):

```kotlin
fun Device.label(): String = "${name ?: "Unknown"} ($address) $rssi dBm"
```

## 4. Coroutine: `suspend` không phải `async`

Đây là chỗ trực giác TS dẫn sai. Trong JS, gọi một hàm `async` là nó chạy ngay và trả về một `Promise`, Promise đó có thể sống lâu hơn người đã gọi nó.
Phiên bản của Kotlin khác ở hai điểm ([docs](https://kotlinlang.org/docs/coroutines-basics.html)):

1. **`suspend fun` chỉ gọi được từ một hàm suspend khác hoặc từ một coroutine.** Không có object Promise nào.
   Nó tạm dừng ở `delay()` hay ở một lời gọi suspend khác mà **không chặn luồng**, rồi chạy tiếp.
2. **Coroutine được khởi động bằng một builder (`launch`) bên trong một `CoroutineScope`.** Scope sở hữu chúng: huỷ scope là mọi coroutine trong đó bị huỷ.
   Cái này gọi là *structured concurrency*, và nó là lý do đóng một màn hình sẽ tự dừng bản quét BLE của màn đó, khi bản quét nằm trong ViewModel (bài 08).

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 215" role="img" aria-labelledby="l01-scope-title">
<title id="l01-scope-title">Hai cây scope cạnh nhau. Ở bài này, scope của runBlocking sở hữu coroutine do Scanner.start launch. Trong app, scope của ViewModel sở hữu coroutine chạy bản quét BLE. Huỷ một scope là huỷ mọi coroutine nó sở hữu.</title>
<defs><marker id="l01-scope-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text x="160" y="20" text-anchor="middle" font-weight="600">Bài này</text>
<rect class="box" x="40" y="34" width="240" height="46" rx="6"/>
<text class="mono" x="160" y="54" text-anchor="middle">runBlocking { }</text>
<text class="small muted" x="160" y="71" text-anchor="middle">scope của main; collect state</text>
<path class="edge" d="M160,80 L160,124" marker-end="url(#l01-scope-arrow)"/>
<text class="small muted" x="168" y="106">sở hữu</text>
<rect class="box" x="40" y="126" width="240" height="46" rx="6"/>
<text class="mono" x="160" y="146" text-anchor="middle">launch { }</text>
<text class="small muted" x="160" y="163" text-anchor="middle">Scanner.start: chạy bản quét</text>
<g data-part="inbound">
<text class="title" x="480" y="20" text-anchor="middle">App thật, từ bài 08</text>
<rect class="box" x="360" y="34" width="240" height="46" rx="6"/>
<text class="mono" x="480" y="54" text-anchor="middle">viewModelScope</text>
<text class="small muted" x="480" y="71" text-anchor="middle">sống bằng ViewModel của màn hình</text>
<rect class="box" x="360" y="126" width="240" height="46" rx="6"/>
<text class="mono" x="480" y="146" text-anchor="middle">launch { }</text>
<text class="small muted" x="480" y="163" text-anchor="middle">bản quét BLE</text>
</g>
<path class="edge" d="M480,80 L480,124" marker-end="url(#l01-scope-arrow)"/>
<text class="small muted" x="488" y="106">sở hữu</text>
<text class="small muted" x="320" y="200" text-anchor="middle">Huỷ scope là huỷ mọi coroutine nó sở hữu. Scope cũng chờ các coroutine của nó chạy xong.</text>
</svg>
<figcaption>Structured concurrency: coroutine luôn thuộc về một scope, và scope quyết định nó được sống bao lâu.</figcaption>
</figure>

`runBlocking { }` nối code thường vào coroutine bằng cách **chặn** luồng hiện tại cho tới khi mọi thứ bên trong chạy xong.
Chỉ dùng nó trong `main()` và test, không bao giờ dùng trong code app.

## 5. Flow và StateFlow

`Flow` là một luồng giá trị bất đồng bộ. Nó **lạnh** (cold), giống RxJS `Observable`: thân `flow { }` không chạy cho tới khi có ai đó gọi `collect`,
và chạy lại cho mỗi người collect ([docs](https://kotlinlang.org/docs/flow.html)).
`StateFlow` thì **nóng** (hot) và luôn giữ đúng một giá trị hiện tại, giống `BehaviorSubject`.
Mọi ViewModel trong khoá này đưa UI state ra ngoài bằng nó ([Android docs: StateFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)).

Chương trình của bài này là một bản quét BLE giả: thiết bị chảy vào dần, thiết bị yếu bị lọc bỏ, và một `StateFlow` theo dõi trạng thái quét trong khi `main` in ra mỗi state nó thấy.
Đây là đường đi của các giá trị:

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 190" role="img" aria-labelledby="l01-flow-title">
<title id="l01-flow-title">Đường ống của chương trình. Một Flow lạnh: fakeScan emit thiết bị, filter bỏ thiết bị yếu, collect trong Scanner.start nhận chúng; collect là thứ khởi động thân fakeScan. Rồi một StateFlow nóng: khối collect ghi _state, và main đọc state bằng onEach và first.</title>
<defs><marker id="l01-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<path class="edge" d="M12,30 L12,22 L368,22 L368,30"/>
<text class="small muted" x="190" y="15" text-anchor="middle">Flow lạnh: chưa chạy gì cho tới khi collect</text>
<path class="edge" d="M388,30 L388,22 L628,22 L628,30"/>
<text class="small muted" x="508" y="15" text-anchor="middle">StateFlow nóng: một giá trị hiện tại</text>
<rect class="box" x="12" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="67" y="61" text-anchor="middle">fakeScan()</text>
<text class="small muted" x="67" y="78" text-anchor="middle">emit(device)</text>
<rect class="box" x="135" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="190" y="61" text-anchor="middle">filter { }</text>
<text class="small muted" x="190" y="78" text-anchor="middle">rssi &gt; -80</text>
<rect class="box" x="258" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="313" y="61" text-anchor="middle">collect { }</text>
<text class="small muted" x="313" y="78" text-anchor="middle">trong Scanner.start</text>
<rect class="box" x="388" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="443" y="61" text-anchor="middle">_state</text>
<text class="small muted" x="443" y="78" text-anchor="middle">.value = …</text>
<rect class="box" x="518" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="573" y="61" text-anchor="middle">state</text>
<text class="small muted" x="573" y="78" text-anchor="middle">main: onEach, first</text>
<path class="edge" d="M122,65 L133,65" marker-end="url(#l01-flow-arrow)"/>
<path class="edge" d="M245,65 L256,65" marker-end="url(#l01-flow-arrow)"/>
<path class="edge" d="M368,65 L386,65" marker-end="url(#l01-flow-arrow)"/>
<path class="edge" d="M498,65 L516,65" marker-end="url(#l01-flow-arrow)"/>
<path class="edge dashed" d="M313,90 C313,140 67,140 67,92" marker-end="url(#l01-flow-arrow)"/>
<text class="small muted" x="190" y="152" text-anchor="middle">gọi collect() mới khởi động thân fakeScan()</text>
<text class="small muted" x="508" y="115" text-anchor="middle">private, ghi được  →  public, chỉ đọc</text>
<text class="small muted" x="320" y="182" text-anchor="middle">Giá trị chảy từ trái sang phải. Phía trước chưa chạy gì cho tới khi phía sau collect.</text>
</svg>
<figcaption>Một chương trình, hai loại luồng: một <code>Flow</code> lạnh sinh ra thiết bị, và một <code>StateFlow</code> nóng giữ trạng thái hiện tại của bản quét.</figcaption>
</figure>

Cả chương trình là một file. Mỗi đoạn trích dưới đây chỉ hiện những dòng nó bàn tới; các dòng tô đậm là những dòng phần ghi chú giải thích, và file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

### Model

```kotlin title="src/main/kotlin/Main.kt" hl_lines="2 4 7"
⋯ import từ kotlinx.coroutines
data class Device(val name: String?, val address: String, val rssi: Int)

fun Device.label(): String = "${name ?: "Unknown"} ($address) $rssi dBm"

sealed interface ScanState {
    data object Idle : ScanState
    data class Scanning(val found: Int) : ScanState
    data class Done(val devices: List<Device>) : ScanState
}
⋯ fakeScan(), Scanner, render(), main()
```

1. Model thiết bị là bất biến (chỉ có `val`). Kết quả quét là một bức ảnh chụp, nên không ai nên sửa nó tại chỗ.
2. Extension function cho mọi `Device` một nhãn hiển thị, dùng `?:` cho những thiết bị không có tên.
3. `ScanState` có ba trạng thái. `Idle` không mang dữ liệu, nên nó là một `data object` (singleton có `toString` dễ đọc).

### Bản quét giả: một Flow lạnh

```kotlin title="src/main/kotlin/Main.kt" hl_lines="2 9 10"
⋯ Device, label(), ScanState
fun fakeScan(): Flow<Device> = flow {
    val nearby = listOf(
        Device("OBD-II Dongle", "AA:01", -48),
        Device(null, "BB:02", -91),
        Device("Heart Rate", "CC:03", -67),
    )
    for (device in nearby) {
        delay(300)
        emit(device)
    }
}
⋯ Scanner, render(), main()
```

1. `fakeScan()` là một hàm thường trả về `Flow`. Gọi nó chưa làm gì cả, vì flow lạnh.
2. Bên trong `flow { }` là bạn đang ở trong một coroutine, nên gọi được hàm suspend. `delay(300)` tạm dừng mà không chặn luồng, đóng vai độ trễ của sóng radio.
3. `emit(device)` đẩy một giá trị tới người đang collect. Ở bài 13, callback quét Bluetooth thật sẽ thay chỗ dòng này.

### Scanner: một StateFlow sau backing property

```kotlin title="src/main/kotlin/Main.kt" hl_lines="2 3 4 7 10 11 13"
⋯ fakeScan()
class Scanner(private val scope: CoroutineScope) {
    private val _state = MutableStateFlow<ScanState>(ScanState.Idle)
    val state: StateFlow<ScanState> = _state.asStateFlow()

    fun start() {
        scope.launch {
            val found = mutableListOf<Device>()
            fakeScan()
                .filter { it.rssi > -80 }
                .collect { device ->
                    found += device
                    _state.value = ScanState.Scanning(found.size)
                }
            _state.value = ScanState.Done(found.toList())
        }
    }
}
⋯ render(), main()
```

1. Scanner không tự tạo scope; nó được đưa một scope. Ai sở hữu scope thì người đó điều khiển vòng đời của nó. Đó là hạt giống của dependency injection (bài 10).
2. Mẫu backing property: một `MutableStateFlow` private mà chỉ class này ghi được, đưa ra ngoài công khai dưới dạng `StateFlow` chỉ đọc. Mọi ViewModel dùng chung trong khoá này làm đúng như vậy.
3. `start()` **không** phải suspend. Nó launch một coroutine trong scope rồi trả về ngay, nên nó là kiểu "bắn rồi theo dõi".
4. `filter` là một toán tử của Flow. Nó tạo ra một flow lạnh mới và chưa chạy gì. `collect` là lời gọi cuối thật sự khởi động thân của `fakeScan()`, và nó tạm dừng cho tới khi flow chạy xong.
5. Ghi `_state.value` là phát một state mới tới mọi người collect. Sau khi flow xong, `Done` cuối cùng mang một bản sao chỉ đọc của danh sách.

### Render và main

```kotlin title="src/main/kotlin/Main.kt" hl_lines="2 4 8 13"
⋯ Scanner
fun render(state: ScanState): String = when (state) {
    ScanState.Idle -> "Idle"
    is ScanState.Scanning -> "Scanning… ${state.found} found"
    is ScanState.Done -> "Done: " + state.devices.joinToString { it.label() }
}

fun main(): Unit = runBlocking {
    val scanner = Scanner(scope = this)
    scanner.start()
    scanner.state
        .onEach { println(render(it)) }
        .first { it is ScanState.Done }
}
```

1. `when` đủ nhánh, không có `else`. Sau `is ScanState.Scanning`, `state` được smart-cast, nên `state.found` qua được kiểm tra kiểu.
2. `runBlocking` cung cấp scope (`this`) để scanner launch vào. `: Unit` nói với Kotlin rằng `main` không trả về gì, bất kể biểu thức cuối của khối là gì.
3. `StateFlow` không bao giờ kết thúc, nên collect nó mãi sẽ bị treo. `first { … }` collect cho tới khi điều kiện khớp rồi dừng, và `onEach` in ra mọi state trên đường đi.

Chạy lên, bạn được:

```text
Idle
Scanning… 1 found
Done: OBD-II Dongle (AA:01) -48 dBm, Heart Rate (CC:03) -67 dBm
```

!!! warning "Bẫy · \"Scanning… 2 found\" đi đâu mất?"
    Hai thiết bị qua được bộ lọc, nên state **đã** được gán `Scanning(2)`. Nhưng ngay sau đó flow kết thúc, và cùng coroutine đó gán `Done` trước khi người collect kịp chạy.
    `StateFlow` là *conflated*: người collect chỉ thấy giá trị mới nhất, không bao giờ thấy hàng tồn.
    Như vậy là đúng cho UI state, vì màn hình nên vẽ cái đang đúng **bây giờ**. Nhưng sai cho những sự kiện bạn không được bỏ lỡ, như "hiện lỗi này một lần". Bài 08 xử lý chúng bằng cách đưa chúng vào trong state.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 210" role="img" aria-labelledby="l01-conflation-title">
<title id="l01-conflation-title">Dòng thời gian một lần chạy. fakeScan emit AA:01 lúc 300 ms, BB:02 lúc 600 ms bị filter bỏ, và CC:03 lúc 900 ms. State đi từ Idle, Scanning(1), rồi Scanning(2) và Done liền nhau lúc 900 ms. Người collect in Idle, Scanning(1) và Done; không bao giờ thấy Scanning(2).</title>
<text class="small muted" x="10" y="39">fakeScan emit</text>
<text class="small muted" x="10" y="94">giá trị _state</text>
<text class="small muted" x="10" y="149">main in ra</text>
<path class="axis" d="M130,35 L630,35 M130,90 L630,90 M130,145 L630,145"/>
<circle class="dot" cx="300" cy="35" r="5"/><text class="mono small" x="300" y="23" text-anchor="middle">AA:01</text>
<circle class="dot dropped" cx="450" cy="35" r="5"/><text class="mono small muted" x="450" y="23" text-anchor="middle">BB:02 (bị lọc)</text>
<circle class="dot" cx="600" cy="35" r="5"/><text class="mono small" x="600" y="23" text-anchor="middle">CC:03</text>
<circle class="dot" cx="150" cy="90" r="5"/><text class="mono small" x="150" y="78" text-anchor="middle">Idle</text>
<circle class="dot" cx="300" cy="90" r="5"/><text class="mono small" x="300" y="78" text-anchor="middle">Scanning(1)</text>
<circle class="dot" cx="595" cy="90" r="5"/><text class="mono small" x="588" y="78" text-anchor="end">Scanning(2)</text>
<circle class="dot" cx="612" cy="90" r="5"/><text class="mono small" x="616" y="78">Done</text>
<path class="edge dashed" d="M150,96 L150,139 M300,96 L300,139 M612,96 L612,139"/>
<circle class="dot" cx="150" cy="145" r="5"/>
<circle class="dot" cx="300" cy="145" r="5"/>
<circle class="dot dropped" cx="595" cy="145" r="5"/><text class="small muted" x="588" y="162" text-anchor="end">không ai thấy</text>
<circle class="dot" cx="612" cy="145" r="5"/>
<path class="axis" d="M150,185 L630,185"/>
<text class="small muted" x="150" y="202" text-anchor="middle">0 ms</text>
<text class="small muted" x="300" y="202" text-anchor="middle">300</text>
<text class="small muted" x="450" y="202" text-anchor="middle">600</text>
<text class="small muted" x="600" y="202" text-anchor="middle">900 ms</text>
</svg>
<figcaption>Conflation: <code>Scanning(2)</code> và <code>Done</code> được cùng một coroutine ghi liền nhau, nên tới lúc người collect chạy thì chỉ còn <code>Done</code> để thấy.</figcaption>
</figure>

## Chương trình này đi đâu trong app

Mỗi mảnh của file nháp này đều có một bản thật trong Native Device Monitor. Màu sắc là **mã màu** của khoá: từ đây trở đi, mọi sơ đồ và mọi đoạn trích code đều dùng chúng để cho biết nó thuộc phần nào của app.
Bài 10 giải thích kỹ các phần; giờ chỉ cần để ý rằng model, bản quét và màn hình rốt cuộc nằm ở những chỗ khác nhau.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 245" role="img" aria-labelledby="l01-map-title">
<title id="l01-map-title">Mỗi mảnh của Main.kt đi đâu. Device thành model trong app core. fakeScan thành outbound adapter: máy quét giả lập, rồi sóng BLE thật. Scanner và ScanState thành ViewModel dùng chung và UI state của nó, một inbound adapter. render và main thành các màn hình native: Compose trên Android và SwiftUI trên iOS.</title>
<defs><marker id="l01-map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="120" y="14" text-anchor="middle">Main.kt, bài này</text>
<text class="small muted" x="460" y="14" text-anchor="middle">Native Device Monitor</text>
<rect class="box" x="20" y="24" width="200" height="44" rx="6"/><text class="mono" x="120" y="51" text-anchor="middle">Device</text>
<rect class="box" x="20" y="80" width="200" height="44" rx="6"/><text class="mono" x="120" y="107" text-anchor="middle">fakeScan()</text>
<rect class="box" x="20" y="136" width="200" height="44" rx="6"/><text class="mono" x="120" y="163" text-anchor="middle">Scanner, ScanState</text>
<rect class="box" x="20" y="192" width="200" height="44" rx="6"/><text class="mono" x="120" y="219" text-anchor="middle">render(), main()</text>
<path class="edge" d="M220,46 L298,46" marker-end="url(#l01-map-arrow)"/>
<path class="edge" d="M220,102 L298,102" marker-end="url(#l01-map-arrow)"/>
<path class="edge" d="M220,158 L298,158" marker-end="url(#l01-map-arrow)"/>
<path class="edge" d="M220,214 L298,214" marker-end="url(#l01-map-arrow)"/>
<g data-part="core">
<rect class="box" x="300" y="24" width="320" height="44" rx="6"/>
<text class="title" x="314" y="42">App core</text>
<text class="small muted" x="314" y="59">model mà mọi phần của app đều dùng</text>
</g>
<g data-part="outbound">
<rect class="box" x="300" y="80" width="320" height="44" rx="6"/>
<text class="title" x="314" y="98">Outbound adapter</text>
<text class="small muted" x="314" y="115">máy quét giả lập, rồi sóng BLE thật</text>
</g>
<g data-part="inbound">
<rect class="box" x="300" y="136" width="320" height="44" rx="6"/>
<text class="title" x="314" y="154">Inbound adapter</text>
<text class="small muted" x="314" y="171">ViewModel dùng chung, đưa ra StateFlow&lt;UiState&gt;</text>
</g>
<g data-part="android">
<rect class="box" x="300" y="192" width="155" height="44" rx="6"/>
<text class="title" x="314" y="210">Android</text>
<text class="small muted" x="314" y="227">màn hình Compose</text>
</g>
<g data-part="ios">
<rect class="box" x="465" y="192" width="155" height="44" rx="6"/>
<text class="title" x="479" y="210">iOS</text>
<text class="small muted" x="479" y="227">màn hình SwiftUI</text>
</g>
</svg>
<figcaption>Cùng một khuôn, nhưng đã lớn: một model, một nguồn thiết bị, một chỗ giữ state, và một màn hình vẽ state đó.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound</li><li data-part="outbound">Outbound</li><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

!!! question "Hỏi agent của bạn"
    Kẹt ở dòng nào? Nhờ agent (thầy của bạn) giải thích, hoặc bảo nó đổi một chỗ rồi đoán output **trước khi** chạy.
    Ví dụ: *"Nếu `fakeScan()` thêm `delay(300)` sau vòng lặp thì có gì thay đổi?"*

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Đoạn TypeScript <code>user?.name ?? "Guest"</code> viết bằng Kotlin là:</p>
<div class="opts">
<button class="opt">user?.name ?? "Guest"</button>
<button class="opt" data-correct>user?.name ?: "Guest"</button>
<button class="opt">user?.name || "Guest"</button>
</div>
<p class="feedback"></p>
<p class="why">Toán tử dự phòng của Kotlin là Elvis <code>?:</code>. (Swift thì giữ <code>??</code>, bạn sẽ thấy ở bài 02.)</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>when</code> trong <code>render()</code> biên dịch được mà không có <code>else</code>?</p>
<div class="opts">
<button class="opt">Kotlin ngầm thêm một nhánh else mặc định</button>
<button class="opt" data-correct>Sealed nghĩa là trình biên dịch biết mọi kiểu con</button>
<button class="opt">Biểu thức trong Kotlin không bao giờ cần else</button>
</div>
<p class="feedback"></p>
<p class="why">Thêm một kiểu con thứ tư là <code>render()</code> hết biên dịch được cho tới khi bạn xử lý nó. Đó chính là tính năng bạn muốn.</p>
</div>

<div class="quiz">
<p class="q">Thân <code>flow { … }</code> trong <code>fakeScan()</code> bắt đầu chạy lúc nào?</p>
<div class="opts">
<button class="opt">Ngay khi gọi fakeScan()</button>
<button class="opt" data-correct>Khi có ai đó gọi collect trên nó</button>
<button class="opt">Khi gắn toán tử filter vào</button>
</div>
<p class="feedback"></p>
<p class="why"><code>Flow</code> là lạnh. Gọi <code>fakeScan()</code> và <code>filter</code> chỉ mô tả đường ống; <code>collect</code> mới chạy nó.</p>
</div>

<div class="quiz">
<p class="q">Output không bao giờ có <code>Scanning… 2 found</code>. Vì sao?</p>
<div class="opts">
<button class="opt">Bộ lọc đã bỏ thiết bị thứ hai</button>
<button class="opt">Người collect bị crash ở lần cập nhật đó</button>
<button class="opt" data-correct>StateFlow chỉ giữ giá trị mới nhất</button>
</div>
<p class="feedback"></p>
<p class="why">Conflation: <code>Done</code> đã ghi đè <code>Scanning(2)</code> trước khi người collect chạy tiếp.</p>
</div>

<div class="quiz">
<p class="q">Bạn gọi một <code>suspend fun</code> từ một hàm thường (không suspend). Chuyện gì xảy ra?</p>
<div class="opts">
<button class="opt">Nó trả về một object Deferred giống Promise</button>
<button class="opt">Nó lặng lẽ khởi động một luồng nền mới</button>
<button class="opt" data-correct>Không biên dịch được khi ở ngoài coroutine</button>
</div>
<p class="feedback"></p>
<p class="why">Hàm suspend cần một coroutine để chạy. Bạn tạo coroutine bằng <code>launch</code> trong một scope, hoặc <code>runBlocking</code> trong <code>main</code>.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent)"
    1. Thêm một state thứ tư, `data class Failed(val reason: String) : ScanState`. Build, đọc lỗi biên dịch trong `render()`, rồi sửa.
    2. Cho `start()` một tham số `minRssi: Int = -80` và dùng nó trong `filter`. Gọi `start(minRssi = -95)` và đoán output trước khi chạy.
       Có hiện `Scanning… 3 found` không? Vì sao có, hoặc vì sao không?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn để nó dựng và chạy chương trình. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/01-kotlin-for-typescript-devs.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/01-kotlin-for-typescript-devs.html" -o .course/lesson-01.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/kotlin-swift-typescript-cheatsheet.html" -o .course/ref-kotlin-swift-typescript-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" exactly,
except where the brief below says otherwise.

Lesson 01 (Kotlin for TypeScript developers): set up a Kotlin scratch program.
Starting point: nothing. Create the folder scratch/lesson-01/kotlin/ in my workspace.

1. A Gradle Kotlin/JVM console project in scratch/lesson-01/kotlin/, with exactly the
   three files in the lesson's "Full files" section:
   - settings.gradle.kts
   - build.gradle.kts (Kotlin 2.4.21 JVM plugin, application plugin,
     kotlinx-coroutines-core 1.11.0, JVM toolchain 17, main class MainKt)
   - src/main/kotlin/Main.kt (the whole program, with its imports)
   Newer Kotlin/coroutines versions are fine if those are unavailable.
2. Generate a Gradle wrapper: `gradle wrapper --gradle-version 9.8.2` (install Gradle
   with `brew install gradle` if there is none; needs JDK 17+).
3. Run `./gradlew run -q`.

Acceptance checks:
- It prints exactly 3 lines: "Idle", "Scanning… 1 found",
  "Done: OBD-II Dongle (AA:01) -48 dBm, Heart Rate (CC:03) -67 dBm".
- It builds with no compiler warnings.
Then walk me through the code line by line. Do NOT do the lesson's unaided exercise;
I do that myself.
```

## Đọc thêm

- [Cheatsheet: Kotlin ↔ Swift ↔ TypeScript](https://phongna-inn.github.io/carmd-kmp-course/reference/kotlin-swift-typescript-cheatsheet.html), bản một trang của bài này và bài sau.
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html): coroutine, scope, cold/hot, conflation…
- [Kotlin Playground](https://play.kotlinlang.org/): chạy Kotlin trên trình duyệt để thử nhanh, không cần cài gì.
- Kinh nghiệm thực tế: [r/Kotlin](https://www.reddit.com/r/Kotlin/) khi bạn muốn nghe ý kiến của người làm thật.

## File đầy đủ

Mọi file bài này tạo ra, đầy đủ. Mở một file để đối chiếu với bài làm của bạn; các file Gradle wrapper là sinh ra, không viết tay.

??? example "settings.gradle.kts"
    ```kotlin
    rootProject.name = "lesson01-kotlin"
    ```

??? example "build.gradle.kts"
    ```kotlin
    plugins {
        kotlin("jvm") version "2.4.21"
        application
    }

    repositories { mavenCentral() }

    dependencies {
        implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
    }

    kotlin { jvmToolchain(17) }

    application { mainClass.set("MainKt") }
    ```

??? example "src/main/kotlin/Main.kt"
    ```kotlin
    import kotlinx.coroutines.CoroutineScope
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.filter
    import kotlinx.coroutines.flow.first
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.flow.onEach
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.runBlocking

    data class Device(val name: String?, val address: String, val rssi: Int)

    fun Device.label(): String = "${name ?: "Unknown"} ($address) $rssi dBm"

    sealed interface ScanState {
        data object Idle : ScanState
        data class Scanning(val found: Int) : ScanState
        data class Done(val devices: List<Device>) : ScanState
    }

    fun fakeScan(): Flow<Device> = flow {
        val nearby = listOf(
            Device("OBD-II Dongle", "AA:01", -48),
            Device(null, "BB:02", -91),
            Device("Heart Rate", "CC:03", -67),
        )
        for (device in nearby) {
            delay(300)
            emit(device)
        }
    }

    class Scanner(private val scope: CoroutineScope) {
        private val _state = MutableStateFlow<ScanState>(ScanState.Idle)
        val state: StateFlow<ScanState> = _state.asStateFlow()

        fun start() {
            scope.launch {
                val found = mutableListOf<Device>()
                fakeScan()
                    .filter { it.rssi > -80 }
                    .collect { device ->
                        found += device
                        _state.value = ScanState.Scanning(found.size)
                    }
                _state.value = ScanState.Done(found.toList())
            }
        }
    }

    fun render(state: ScanState): String = when (state) {
        ScanState.Idle -> "Idle"
        is ScanState.Scanning -> "Scanning… ${state.found} found"
        is ScanState.Done -> "Done: " + state.devices.joinToString { it.label() }
    }

    fun main(): Unit = runBlocking {
        val scanner = Scanner(scope = this)
        scanner.start()
        scanner.state
            .onEach { println(render(it)) }
            .first { it is ScanState.Done }
    }
    ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Mọi ví dụ Kotlin ở đây đều đã chạy thật (Kotlin 2.4.21, kotlinx-coroutines 1.11.0), output in ra là output thật.

### A1. Coroutine: `suspend` không phải `async`

Giải thích thêm cho [mục 4](#4-coroutine-suspend-khong-phai-async), qua một ví dụ đời thường: **gọi món ở quán cà phê**.

!!! abstract "Một câu để nhớ"
    **TypeScript:** gọi hàm `async` là việc **chạy ngay**, bạn cầm một **tờ biên nhận** (`Promise`), muốn bỏ đi lúc nào cũng được, việc vẫn chạy tiếp.

    **Kotlin:** gọi hàm `suspend` là bạn **đứng chờ tại chỗ** cho tới khi xong (nhưng không làm ai bị kẹt). Muốn làm nhiều việc cùng lúc thì phải **gọi món cho một bàn** (`scope`), và **bàn về là mọi món của bàn bị huỷ**.

#### Câu chuyện quán cà phê

Bạn và nhóm bạn vào quán, ngồi **bàn số 5**, gọi cà phê, bánh mì và phở.

| Ngoài đời | TypeScript | Kotlin |
|---|---|---|
| Gọi một món | Gọi hàm `async` | Gọi hàm `suspend` |
| Tờ biên nhận cầm trên tay | `Promise` | Không có, bạn đứng chờ luôn. Muốn có "biên nhận" thì dùng `async { }` → `Deferred` |
| Đứng chờ ở quầy, nhân viên vẫn phục vụ khách khác | `await` | Hàm suspend tạm dừng, **luồng được nhả ra** cho việc khác |
| Bàn số 5, mọi món ghi vào hoá đơn của bàn | Không có khái niệm này | `CoroutineScope` |
| Gọi món rồi đi làm việc khác, không chờ | Gọi hàm `async` mà không `await` | `launch { }` **trong một scope** |
| Cả bàn đứng dậy về | Món vẫn được làm, không ai lấy | `scope.cancel()` → **mọi món chưa xong bị huỷ** |
| Một món hỏng (hết sữa) | Promise đó reject, các món khác vẫn làm, dễ bị "unhandled rejection" | Lỗi báo lên bàn, **các món khác của bàn cũng huỷ**, bắt lỗi ở một chỗ |
| Quầy thu ngân / bếp / kho | Một nhân viên làm tất cả (event loop) | `Dispatchers.Main` (UI) / `Default` (tính toán) / `IO` (file, mạng) |

Ba điều rút ra:

1. **Kotlin không có "biên nhận ngầm".** Gọi `suspend fun` là chờ kết quả luôn, giống viết `await` trước mọi lời gọi. Muốn chạy song song thì **phải nói rõ** bằng `launch` / `async`.
2. **Không có món "mồ côi".** Coroutine nào cũng thuộc một scope. Ở TS, Promise có thể sống lâu hơn người gọi.
3. **Huỷ là mặc định, không phải tự làm.** TS phải truyền `AbortController` vào từng hàm và tự kiểm tra. Kotlin huỷ scope là xong.

#### Bảng so sánh TypeScript ↔ Kotlin coroutine

| Việc | TypeScript | Kotlin |
|---|---|---|
| Khai báo hàm bất đồng bộ | `async function f(): Promise<T>` | `suspend fun f(): T` |
| Gọi và chờ kết quả | `const x = await f()` | `val x = f()` (không có chữ `await`) |
| Gọi được ở đâu | Mọi nơi (không `await` thì nhận Promise) | Chỉ trong `suspend fun` khác hoặc trong coroutine |
| Chờ một lúc | `await new Promise(r => setTimeout(r, 300))` | `delay(300)` |
| Chạy song song, lấy cả hai kết quả | `await Promise.all([a(), b()])` | `coroutineScope { val x = async { a() }; val y = async { b() }; x.await() to y.await() }` |
| "Biên nhận" cho một việc | `Promise<T>` | `Deferred<T>` (từ `async { }`) |
| Bắn rồi quên | `f()` không `await` | `scope.launch { f() }` → trả về `Job` |
| Huỷ | `AbortController` + tự kiểm tra `signal` trong từng hàm | `job.cancel()` / `scope.cancel()`, mọi `delay` và hàm suspend tự dừng |
| Huỷ khi rời màn hình | Tự dọn trong cleanup của `useEffect` | `viewModelScope` tự huỷ khi ViewModel bị huỷ |
| Lỗi khi chạy song song | Một Promise reject, các cái khác **vẫn chạy** | Một con lỗi → **anh em bị huỷ**, lỗi ném lên scope cha |
| Không muốn một con lỗi kéo cả nhóm | `Promise.allSettled` | `supervisorScope { }` |
| Giới hạn thời gian | `Promise.race([f(), timeout(1000)])` | `withTimeout(1000) { f() }` |
| Chạy ở luồng nào | Luôn một luồng (event loop) | Chọn bằng `withContext(Dispatchers.IO) { … }` |
| Điểm vào ở `main` / script | Top-level `await` | `runBlocking { }` (chỉ trong `main` và test) |

#### Ví dụ 1: ăn sáng lần lượt và cùng lúc

Pha cà phê mất 300 ms, nướng bánh mất 200 ms. Làm **lần lượt** mất 500 ms, làm **cùng lúc** chỉ 300 ms.

=== "TypeScript"

    ```ts
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    async function brewCoffee() { await sleep(300); return "cà phê"; }
    async function toastBread() { await sleep(200); return "bánh mì"; }

    // Lần lượt: phải nhớ viết await, quên là nhận Promise
    const coffee = await brewCoffee();
    const bread = await toastBread();

    // Cùng lúc: gọi cả hai trước, rồi chờ
    const [c, b] = await Promise.all([brewCoffee(), toastBread()]);
    ```

=== "Kotlin"

    ```kotlin
    suspend fun brewCoffee(): String {
        delay(300)              // pha cà phê mất 300 ms
        return "cà phê"
    }

    suspend fun toastBread(): String {
        delay(200)              // nướng bánh mất 200 ms
        return "bánh mì"
    }

    suspend fun breakfastOneByOne(): String {
        val coffee = brewCoffee()   // chờ xong cà phê…
        val bread = toastBread()    // …rồi mới nướng bánh
        return "$coffee + $bread"
    }

    suspend fun breakfastTogether(): String = coroutineScope { // (1)!
        val coffee = async { brewCoffee() }   // bắt đầu pha
        val bread = async { toastBread() }    // cùng lúc nướng
        "${coffee.await()} + ${bread.await()}" // (2)!
    }
    ```

    1. `coroutineScope` mở một "bàn" tạm. Hàm chỉ trả về khi **mọi món trong bàn** đã xong.
    2. `async` cho ra `Deferred`, chính là "tờ biên nhận". `await()` là chờ lấy món.

Output thật:

```text
Lần lượt: cà phê + bánh mì
Cùng lúc: cà phê + bánh mì
Lần lượt ≈ 500 ms, cùng lúc ≈ 300 ms
```

!!! tip "Khác biệt chính"
    Ở TS, gọi hàm là việc chạy luôn, muốn lần lượt thì phải nhớ `await`. Ở Kotlin, **mặc định là lần lượt**, muốn song song thì phải nói rõ bằng `async`.
    Nhờ vậy code Kotlin đọc từ trên xuống đúng như thứ tự nó chạy.

#### Ví dụ 2: cả bàn đứng dậy về (huỷ)

Bếp ra 5 món, mỗi món cách nhau 100 ms. Quầy nước làm sinh tố mất 1 giây. Tới 250 ms thì nhóm bạn có việc, phải về.

=== "TypeScript"

    ```ts
    async function kitchen() {
      for (let i = 1; i <= 5; i++) {
        console.log(`Bếp: xong món ${i}`);
        await sleep(100);
      }
    }

    kitchen();          // bắn rồi quên
    await sleep(250);
    // Nhóm về… nhưng không có cách nào dừng kitchen().
    // Bếp vẫn in đủ 5 món. Muốn dừng phải tự truyền AbortController vào.
    ```

=== "Kotlin"

    ```kotlin
    fun main(): Unit = runBlocking {
        val table = launch {                       // bàn số 5: mọi món ghi vào đây
            launch {
                repeat(5) {
                    println("Bếp: xong món ${it + 1}")
                    delay(100)
                }
            }
            launch {
                delay(1_000)
                println("Quầy nước: xong sinh tố")     // không bao giờ in
            }
        }
        delay(250)
        table.cancel()                             // cả bàn đứng dậy về
        table.join()
        println("Bàn 5 về rồi, bếp và quầy nước dừng hết")
    }
    ```

Output thật của bản Kotlin:

```text
Bếp: xong món 1
Bếp: xong món 2
Bếp: xong món 3
Bàn 5 về rồi, bếp và quầy nước dừng hết
```

Chỉ **một** lệnh `table.cancel()` mà cả hai coroutine con dừng, không cần truyền gì vào từng hàm. `delay` tự biết mình bị huỷ.

#### Ví dụ 3: một món hỏng (lỗi)

Quầy nước báo **hết sữa**. Trong Kotlin, lỗi này báo lên bàn, món phở đang nấu cũng bị huỷ theo, và bạn bắt lỗi **ở một chỗ**.

```kotlin
suspend fun orderForTable() = coroutineScope {
    launch {
        delay(100)
        error("hết sữa")                       // món này hỏng
    }
    launch {
        delay(500)
        println("Bếp: xong phở")               // không bao giờ in: bị huỷ theo
    }
}

fun main(): Unit = runBlocking {
    try {
        orderForTable()
    } catch (e: IllegalStateException) {
        println("Báo bàn 5: ${e.message}, các món còn lại đã huỷ")
    }
}
```

Output thật:

```text
Báo bàn 5: hết sữa, các món còn lại đã huỷ
```

Ở TS, `Promise.all` cũng reject khi một món hỏng, **nhưng món phở vẫn nấu tiếp** ở phía sau, chỉ là không ai nhận.
Muốn các món độc lập (hỏng món này vẫn giữ món kia) thì Kotlin dùng `supervisorScope { }`, giống `Promise.allSettled`.

#### Áp vào app Native Device Monitor

Màn **Device** vừa quét BLE vừa đọc pin. Người dùng bấm Back thì phải dừng cả hai, không thì Bluetooth vẫn quét, tốn pin.

=== "TypeScript (React)"

    ```ts
    useEffect(() => {
      const ac = new AbortController();
      scanBle(ac.signal);        // mỗi hàm phải tự nhận signal
      watchBattery(ac.signal);   // và tự kiểm tra signal.aborted
      return () => ac.abort();   // nhớ dọn, quên là rò
    }, []);
    ```

=== "Kotlin (ViewModel, bài 08)"

    ```kotlin
    class DeviceViewModel(/* … */) : ViewModel() {
        fun start() {
            viewModelScope.launch { scanner.scan().collect { /* … */ } }
            viewModelScope.launch { battery.observe().collect { /* … */ } }
        }
        // Không cần dọn: rời màn hình → ViewModel bị huỷ → viewModelScope huỷ → cả hai dừng.
    }
    ```

Đây là ý của câu trong mục 4: *"đóng một màn hình sẽ tự dừng bản quét BLE của màn đó, khi bản quét nằm trong ViewModel"*. `viewModelScope` chính là **bàn số 5** của màn hình đó (giống ô bên phải của sơ đồ structured concurrency).

#### Bẫy hay gặp khi từ TS sang

!!! warning "4 bẫy"
    1. **Tìm chữ `await` trước hàm suspend.** Không có. `val x = f()` đã là chờ rồi.
    2. **Nghĩ `async { }` của Kotlin giống `async function` của TS.** Không. `async { }` là **builder** tạo coroutine và trả về `Deferred` (biên nhận). Chữ khoá tương ứng với `async function` là `suspend`.
    3. **Dùng `GlobalScope.launch` cho tiện.** Đó là gọi món không ghi vào bàn nào, đúng kiểu "món mồ côi" của TS. Luôn launch trong một scope có chủ.
    4. **Dùng `runBlocking` trong app.** Nó chặn luồng thật; trên luồng UI là app đứng hình. Chỉ dùng ở `main` và test.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 02.

- [ ] Đọc một đoạn Kotlin và "dịch nhẩm" sang TypeScript: `val`/`var`, `String?`, `?.`, `?:`, `!!`, lambda `it`, trailing lambda.
- [ ] Biết lúc nào dùng `?:` và vì sao **tránh** `!!` (nó ném lỗi thật, khác `!` của TS).
- [ ] Viết một `data class` cho dữ liệu, dùng `copy()` để đổi một field mà không sửa bản gốc.
- [ ] Mô hình hoá các trạng thái màn hình bằng `sealed interface` + `when` đủ nhánh, không cần `else`.
- [ ] Viết extension function để thêm hàm hiển thị cho một kiểu có sẵn.
- [ ] Giải thích được `suspend fun` khác `async` của JS chỗ nào, và vì sao coroutine phải nằm trong một **scope** (xem [A1](#a1-coroutine-suspend-khong-phai-async)).
- [ ] Đổi một đoạn `await Promise.all([...])` sang `coroutineScope { async {…}; async {…} }`, và huỷ một nhóm coroutine bằng một lệnh `cancel()`.
- [ ] Viết một `Flow` lạnh bằng `flow { emit(...) }`, nối `filter` / `map`, chạy nó bằng `collect`.
- [ ] Dùng mẫu backing property: `MutableStateFlow` private + `StateFlow` public chỉ đọc. Đây là khung của mọi ViewModel sau này.
- [ ] Giải thích được vì sao `StateFlow` "nuốt" giá trị trung gian (conflation), và vì sao collect `StateFlow` mãi thì treo (dùng `first { }`).
- [ ] Tự dựng một project Gradle Kotlin/JVM console và chạy bằng `./gradlew run`.
- [ ] Làm xong 2 bài tự làm ở trên mà không cần agent.
