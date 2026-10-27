---
source: lessons/02-swift-for-typescript-devs.html
source_ref: live
source_sha: a14043e
---

# Swift cho dev TypeScript

<p class="kicker">Bài 02 · Tuần 1 · Ngày 2 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/02-swift-for-typescript-devs.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2 giờ</span>
  <span class="tag">Milestone: chương trình nháp (Swift)</span>
  <span class="tag">Cần trước: <a href="../01-kotlin-cho-dev-typescript/">01</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Phần rìa iOS của app là Swift: các màn hình, và đoạn code nói chuyện với sóng Bluetooth của iPhone. Hết bài này, bạn sẽ viết lại chương trình của bài 01, lần này bằng Swift: một bản quét BLE giả, đẩy các thiết bị vào một state có thể theo dõi được.
    Chạy hai bản cạnh nhau cho bạn thấy chỗ nào giống, chỗ nào không, và vì sao phía iOS của app cần một cây cầu sang phần Kotlin dùng chung.

!!! info "Nguồn chính"
    Chương [Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/) trong sách Swift.
    Concurrency của Swift là chỗ trực giác TypeScript giúp ít nhất, nên đọc chương đó song song với mục 4 và 5.

## Bản đồ: thứ bạn đã biết

Phần lớn cú pháp chuyển gần như một-một, và bạn đã gặp cột Kotlin ở bài 01. Lướt bảng này bây giờ, lát quay lại tra sau.
Những dòng ghi **(mới)** không có thứ tương đương thật sự trong TypeScript, và bài này dành thời gian cho chúng.

| Ý tưởng | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Hằng / biến | `const` / `let` | `val` / `var` | `let` / `var` |
| Kiểu có thể null | `string \| null` | `String?` | `String?` |
| Truy cập an toàn / giá trị dự phòng | `a?.b ?? x` | `a?.b ?: x` | `a?.b ?? x` |
| "Tin tôi đi, không null đâu" | `a!` (không kiểm tra) | `a!!` (ném lỗi) | `a!` (crash) |
| Hợp đồng | `interface` | `interface` | `protocol` |
| Object giữ giá trị, có so sánh bằng và copy **(mới)** | không có (object so theo tham chiếu) | `data class` | `struct` (một value type) |
| Discriminated union | `{kind:'a'} \| {kind:'b'}` | `sealed interface` | `enum` có associated value |
| Arrow function | `(x) => x * 2` | `{ x -> x * 2 }`, hoặc `it` | `{ x in x * 2 }`, hoặc `$0` |
| Thêm method cho một kiểu có sẵn | (hack prototype) | extension function | `extension` |
| Hàm bất đồng bộ | `async` / `await`, `Promise` | `suspend fun`, không có Promise | `async` / `await` |
| Luồng giá trị bất đồng bộ | RxJS `Observable`, async generator | `Flow` | `AsyncSequence` / `AsyncStream` |
| Chỗ giữ "giá trị hiện tại" | RxJS `BehaviorSubject` | `StateFlow` | một property (sau này: `@Observable`) |
| "Chỉ chạy trên luồng UI" **(mới)** | không có (chỉ một luồng) | `Dispatchers.Main` | `@MainActor` |

## 1. Struct là giá trị; class là tham chiếu

Đây là ý duy nhất không có thứ tương đương trong TypeScript. Trong TS, mọi object đều là tham chiếu.
Trong Swift, `struct` là một **value type**: gán nó hay truyền nó đi là *copy* nó. `class` là reference type, giống object của TS
([sách Swift: Structures and Classes](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/classesandstructures/)).

```swift
struct Counter { var count = 0 }
var a = Counter()
var b = a          // b is a full copy
b.count += 1
print(a.count)     // 0: a was never touched
```

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 190" role="img" aria-labelledby="l02-value-title">
<title id="l02-value-title">Bên trái: với struct, gán a cho b tạo ra hai hộp riêng, nên đổi b.count thì a.count vẫn là 0. Bên phải: với class, gán a cho b tạo ra hai cái tên trỏ vào một object, nên đổi b.count là đổi luôn thứ a nhìn thấy.</title>
<defs><marker id="l02-value-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="title" x="160" y="18" text-anchor="middle" font-weight="600">struct: var b = a</text>
<text class="mono small" x="50" y="64" text-anchor="middle">a</text>
<rect class="box" x="75" y="44" width="150" height="30" rx="6"/><text class="mono small" x="150" y="64" text-anchor="middle">Counter(count: 0)</text>
<text class="mono small" x="50" y="114" text-anchor="middle">b</text>
<rect class="box" x="75" y="94" width="150" height="30" rx="6"/><text class="mono small" x="150" y="114" text-anchor="middle">Counter(count: 1)</text>
<text class="small muted" x="160" y="152" text-anchor="middle">Hai hộp. b.count += 1 chỉ đổi hộp của b.</text>
<text class="title" x="480" y="18" text-anchor="middle" font-weight="600">class: let b = a</text>
<text class="mono small" x="370" y="64" text-anchor="middle">a</text>
<text class="mono small" x="370" y="114" text-anchor="middle">b</text>
<rect class="box" x="480" y="64" width="150" height="30" rx="6"/><text class="mono small" x="555" y="84" text-anchor="middle">Counter(count: 1)</text>
<path class="edge" d="M385,60 L478,76" marker-end="url(#l02-value-arrow)"/>
<path class="edge" d="M385,110 L478,86" marker-end="url(#l02-value-arrow)"/>
<text class="small muted" x="480" y="152" text-anchor="middle">Một object, hai cái tên. b.count += 1 nhìn thấy được qua a.</text>
</svg>
<figcaption>Gán một struct là bạn được một bản copy. Gán một instance của class là bạn được thêm một cái tên cho cùng object đó.</figcaption>
</figure>

Để ý chữ `let b` ở phía class. Với class, `let` đóng băng *tham chiếu* (`b` luôn chỉ cùng một object), không đóng băng object, nên `b.count += 1` vẫn biên dịch được.
Với struct, `let` đóng băng cả giá trị, đó là lý do phía struct cần `var b`.

Quy tắc khoá này theo: **dữ liệu là `struct`** (một thiết bị quét được, một lần đọc) và **những thứ sống lâu, có danh tính là `class`** (một scanner, một BLE adapter).
Ai đang giữ scanner cũng phải thấy *cùng một* scanner. `let` là `const` của Swift. Trên struct, `let` còn đóng băng mọi field.

## 2. Optional

Optional hoạt động giống kiểu nullable của Kotlin (`String?`, `?.`), nhưng Swift giữ `??` của TypeScript.
Swift còn thêm hai cách mở optional mà bạn sẽ gặp ở khắp nơi
([sách Swift: The Basics](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/thebasics/)):

```swift
if let name = device.name { print(name) }       // name is non-optional inside
guard let name = device.name else { return }    // ...or exit early; name is usable below
```

## 3. Enum có associated value, protocol, extension

`enum` của Swift mang được dữ liệu riêng cho từng case. Nó là cách Swift viết `sealed interface` của Kotlin, và `switch` trên nó phải đủ nhánh
([sách Swift: Enumerations](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/)).

<div class="compare" markdown>
<div markdown>

```kotlin title="Kotlin"
sealed interface ScanState {
    data object Idle : ScanState
    data class Scanning(val found: Int) : ScanState
    data class Done(val devices: List<Device>) : ScanState
}
```

</div>
<div markdown>

```swift title="Swift"
enum ScanState {
    case idle
    case scanning(found: Int)
    case done([Device])
}
```

</div>
</div>

`protocol` là interface ([sách Swift: Protocols](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/)).
Bài 10 giới thiệu `interface BleScanner` của Kotlin, một outbound port, và ở bài 13 Swift adapter của bạn conform với nó dưới dạng một protocol.
`extension` thêm thành viên vào một kiểu có sẵn, cùng ý tưởng với extension function của Kotlin.

## 4. Closure

Closure là `{ params in body }`. Tham số viết tắt là `$0`, `$1`, và trailing closure được đưa ra ngoài dấu ngoặc, y như Kotlin
([sách Swift: Closures](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/closures/)).
Một key path như `\.label` có thể đứng thay cho `{ $0.label }`.

## 5. async/await, AsyncStream và `@MainActor`

`async`/`await` của Swift đọc giống của TypeScript. Một `AsyncSequence` được đọc bằng `for await`, cùng cặp chữ khoá với async iterator của JS.
`AsyncStream` là cách dễ để tạo một cái như vậy, bằng cách đẩy giá trị vào một *continuation*
([Apple: AsyncStream](https://developer.apple.com/documentation/swift/asyncstream)).
`@MainActor` đánh dấu code chỉ được chạy trên main actor, nơi mọi việc UI diễn ra
([Apple: MainActor](https://developer.apple.com/documentation/swift/mainactor)).

Chương trình của bài này là chương trình bài 01 viết bằng Swift: thiết bị chảy vào dần, thiết bị yếu bị lọc bỏ, và một property theo dõi trạng thái quét trong khi code top-level in ra mỗi state nó thấy.
Đây là đường đi của các giá trị:

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 215" role="img" aria-labelledby="l02-flow-title">
<title id="l02-flow-title">Đường ống của chương trình. Task của fakeScan yield thiết bị vào một AsyncStream. Scanner.start lặp trên stream bằng for await kèm bộ lọc where, và mỗi vòng gán state. didSet chạy sau mỗi lần gán và gọi onChange, onChange in ra. Khác Flow lạnh của Kotlin, stream bắt đầu sinh giá trị ngay khi gọi fakeScan(); giá trị nằm chờ trong buffer cho tới khi vòng lặp đọc chúng.</title>
<defs><marker id="l02-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<path class="edge" d="M12,30 L12,22 L368,22 L368,30"/>
<text class="small muted" x="190" y="15" text-anchor="middle">AsyncStream: giá trị được đẩy vào</text>
<path class="edge" d="M388,30 L388,22 L628,22 L628,30"/>
<text class="small muted" x="508" y="15" text-anchor="middle">một property: callback mỗi lần đổi</text>
<rect class="box" x="12" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="67" y="61" text-anchor="middle">fakeScan()</text>
<text class="small muted" x="67" y="78" text-anchor="middle">yield(device)</text>
<rect class="box" x="135" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="190" y="61" text-anchor="middle">for await</text>
<text class="small muted" x="190" y="78" text-anchor="middle">where rssi &gt; -80</text>
<rect class="box" x="258" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="313" y="61" text-anchor="middle">state = …</text>
<text class="small muted" x="313" y="78" text-anchor="middle">trong Scanner.start</text>
<rect class="box" x="388" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="443" y="61" text-anchor="middle">didSet</text>
<text class="small muted" x="443" y="78" text-anchor="middle">sau mỗi lần ghi</text>
<rect class="box" x="518" y="40" width="110" height="50" rx="6"/>
<text class="mono" x="573" y="61" text-anchor="middle">onChange</text>
<text class="small muted" x="573" y="78" text-anchor="middle">print(render($0))</text>
<path class="edge" d="M122,65 L133,65" marker-end="url(#l02-flow-arrow)"/>
<path class="edge" d="M245,65 L256,65" marker-end="url(#l02-flow-arrow)"/>
<path class="edge" d="M368,65 L386,65" marker-end="url(#l02-flow-arrow)"/>
<path class="edge" d="M498,65 L516,65" marker-end="url(#l02-flow-arrow)"/>
<text class="small muted" x="190" y="112" text-anchor="middle">bắt đầu sinh giá trị khi gọi fakeScan();</text>
<text class="small muted" x="190" y="127" text-anchor="middle">giá trị nằm chờ trong buffer tới khi for await đọc</text>
<text class="small muted" x="508" y="115" text-anchor="middle">chạy đồng bộ, nên thấy mọi state</text>
<text class="small muted" x="320" y="200" text-anchor="middle">So với bài 01: ở đó người collect StateFlow đọc giá trị mới nhất về sau, trong coroutine riêng của nó.</text>
</svg>
<figcaption>Một chương trình, hai nửa: một <code>AsyncStream</code> sinh ra thiết bị, và một property có <code>didSet</code> báo lại mọi thay đổi.</figcaption>
</figure>

Cả chương trình là một file. Mỗi đoạn trích dưới đây chỉ hiện những dòng nó bàn tới; các dòng tô đậm là những dòng phần ghi chú giải thích, và file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

### Model

```swift title="Sources/Lesson02/main.swift" hl_lines="1 7 8 13"
struct Device {
    let name: String?
    let address: String
    let rssi: Int
}

extension Device {
    var label: String { "\(name ?? "Unknown") (\(address)) \(rssi) dBm" }
}

enum ScanState {
    case idle
    case scanning(found: Int)
    case done([Device])
}
⋯ fakeScan(), Scanner, render(), code top-level
```

1. `Device` là một struct có các field `let`, cùng quyết định "ảnh chụp bất biến" như data class của Kotlin.
2. Extension thêm một *computed property*. `\(…)` là string interpolation, tức `${…}` của Swift.
3. `ScanState` là cách Swift viết sealed interface. `scanning(found:)` mang một `Int`; `.idle` không mang gì, nên không cần thứ gì tương đương `data object`.

### Bản quét giả: một AsyncStream

```swift title="Sources/Lesson02/main.swift" hl_lines="2 3 4 11 12 14"
⋯ Device, ScanState
func fakeScan() -> AsyncStream<Device> {
    AsyncStream { continuation in
        Task {
            let nearby = [
                Device(name: "OBD-II Dongle", address: "AA:01", rssi: -48),
                Device(name: nil, address: "BB:02", rssi: -91),
                Device(name: "Heart Rate", address: "CC:03", rssi: -67),
            ]
            for device in nearby {
                try? await Task.sleep(for: .milliseconds(300))
                continuation.yield(device)
            }
            continuation.finish()
        }
    }
}
⋯ Scanner, render(), code top-level
```

1. Closure nhận một `continuation`, một tay cầm để đẩy giá trị vào từ bên ngoài.
2. `Task { }` khởi động một việc bất đồng bộ, khá giống `launch`. Khác `launch`, nó không gắn với scope nào, nên không có gì tự huỷ nó. Hãy nhớ khác biệt này.
3. `Task.sleep` có thể ném lỗi nếu task bị huỷ, và `try?` bỏ qua lỗi đó ở đây. `yield` là `emit` của Kotlin, và `finish()` kết thúc stream. Ở bài 13, callback delegate của CoreBluetooth sẽ gọi `yield` thay cho đoạn này.
4. **Không lạnh, khác `flow { }` của Kotlin.** Closure chạy ngay khi gọi `fakeScan()`, nên `Task` bắt đầu sinh giá trị luôn, dù có ai nghe hay không. Giá trị nằm chờ trong buffer của stream (mặc định không giới hạn) cho tới khi một `for await` đọc chúng. Ở bài 01, không có gì chạy cho tới khi `collect`.

### Scanner: một class tự canh state của nó

```swift title="Sources/Lesson02/main.swift" hl_lines="2 3 6 7 12"
⋯ Device, ScanState, fakeScan()
@MainActor
final class Scanner {
    var onChange: ((ScanState) -> Void)?

    private(set) var state: ScanState = .idle {
        didSet { onChange?(state) }
    }

    func start() async {
        var found: [Device] = []
        for await device in fakeScan() where device.rssi > -80 {
            found.append(device)
            state = .scanning(found: found.count)
        }
        state = .done(found)
    }
}
⋯ render(), code top-level
```

1. Là `class`, vì scanner có danh tính. `final` nghĩa là không ai kế thừa được nó. `@MainActor` nghĩa là mọi state của nó chỉ được đọc và ghi trên main actor, nên dùng nó để điều khiển UI là an toàn.
2. `private(set)` là mẫu backing property của Swift trong một dòng: ai cũng đọc được `state`, nhưng chỉ `Scanner` ghi được. Kotlin cần hai property cho cùng việc này.
3. `didSet` chạy sau mỗi lần gán và gọi callback optional. Ở đây nó đóng vai người collect StateFlow. Bài 08–09 thay callback tự làm này bằng việc SwiftUI quan sát ViewModel dùng chung.
4. `for await … where` lặp trên async stream, kèm bộ lọc viết ngay trong dòng.

### Render và code top-level

```swift title="Sources/Lesson02/main.swift" hl_lines="2 6 16"
⋯ Scanner
func render(_ state: ScanState) -> String {
    switch state {
    case .idle:
        return "Idle"
    case .scanning(let found):
        return "Scanning… \(found) found"
    case .done(let devices):
        return "Done: " + devices.map(\.label).joined(separator: ", ")
    }
}

let scanner = Scanner()
scanner.onChange = { print(render($0)) }
print(render(scanner.state))
await scanner.start()
```

1. `case .scanning(let found)` lấy associated value ra. `switch` đủ nhánh, không có `default`.
2. Dấu `_` trước tên tham số nghĩa là người gọi viết `render(x)`, không phải `render(state: x)`.
3. Code top-level trong `main.swift` được dùng `await` trực tiếp, và nó chạy trên main actor, đó là lý do nó đụng được vào scanner `@MainActor`
   ([SE-0343](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0343-top-level-concurrency.md)).

Chạy lên, bạn được nhiều hơn Kotlin một dòng:

```text
Idle
Scanning… 1 found
Scanning… 2 found
Done: OBD-II Dongle (AA:01) -48 dBm, Heart Rate (CC:03) -67 dBm
```

!!! info "Kotlin vs Swift · cái gì đổi và vì sao"
    Callback `didSet` chạy *đồng bộ sau mỗi lần gán*, nên nó thấy mọi state. Người collect `StateFlow` của Kotlin chạy *sau đó*, như một coroutine riêng, và chỉ đọc giá trị mới nhất.
    Không bên nào là bug. Đó là hai công cụ khác nhau: callback là một dòng các thay đổi, còn StateFlow là "sự thật hiện tại".
    Khi bài 08–09 nối SwiftUI vào `StateFlow` Kotlin dùng chung, UI iOS sẽ thừa hưởng hành vi của Kotlin.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 210" role="img" aria-labelledby="l02-sync-title">
<title id="l02-sync-title">Dòng thời gian một lần chạy, Swift so với Kotlin. fakeScan yield AA:01 lúc 300 ms, BB:02 lúc 600 ms bị bộ lọc bỏ, và CC:03 lúc 900 ms. State đi từ idle, scanning(1), rồi scanning(2) và done liền nhau lúc 900 ms. Ở Swift, didSet in ra mọi state. Ở Kotlin, người collect StateFlow đã bỏ lỡ scanning(2).</title>
<text class="small muted" x="10" y="39">fakeScan yield</text>
<text class="small muted" x="10" y="94">giá trị state</text>
<text class="small muted" x="10" y="149">Swift in ra</text>
<path class="axis" d="M130,35 L630,35 M130,90 L630,90 M130,145 L630,145"/>
<circle class="dot" cx="300" cy="35" r="5"/><text class="mono small" x="300" y="23" text-anchor="middle">AA:01</text>
<circle class="dot dropped" cx="450" cy="35" r="5"/><text class="mono small muted" x="450" y="23" text-anchor="middle">BB:02 (bị lọc)</text>
<circle class="dot" cx="600" cy="35" r="5"/><text class="mono small" x="600" y="23" text-anchor="middle">CC:03</text>
<circle class="dot" cx="150" cy="90" r="5"/><text class="mono small" x="150" y="78" text-anchor="middle">idle</text>
<circle class="dot" cx="300" cy="90" r="5"/><text class="mono small" x="300" y="78" text-anchor="middle">scanning(1)</text>
<circle class="dot" cx="595" cy="90" r="5"/><text class="mono small" x="588" y="78" text-anchor="end">scanning(2)</text>
<circle class="dot" cx="612" cy="90" r="5"/><text class="mono small" x="616" y="78">done</text>
<path class="edge dashed" d="M150,96 L150,139 M300,96 L300,139 M595,96 L595,139 M612,96 L612,139"/>
<circle class="dot" cx="150" cy="145" r="5"/>
<circle class="dot" cx="300" cy="145" r="5"/>
<circle class="dot" cx="595" cy="145" r="5"/>
<circle class="dot" cx="612" cy="145" r="5"/>
<text class="small muted" x="620" y="165" text-anchor="end">in đủ cả bốn; người collect của Kotlin bỏ lỡ scanning(2)</text>
<path class="axis" d="M150,185 L630,185"/>
<text class="small muted" x="150" y="202" text-anchor="middle">0 ms</text>
<text class="small muted" x="300" y="202" text-anchor="middle">300</text>
<text class="small muted" x="450" y="202" text-anchor="middle">600</text>
<text class="small muted" x="600" y="202" text-anchor="middle">900 ms</text>
</svg>
<figcaption>Cùng lần chạy với sơ đồ conflation của bài 01. Callback <code>didSet</code> báo lại từng lần ghi, nên không có gì bị bỏ qua.</figcaption>
</figure>

## Chương trình này đi đâu trong app

Swift là nửa iOS của app, nhưng không phải bản copy của code dùng chung. Model thiết bị chỉ sống một chỗ, trong app core Kotlin, và scan state chỉ sống một chỗ, trong một ViewModel Kotlin dùng chung; Swift chỉ cần đọc chúng (bài 08–09 chỉ cách).
Phần Swift sở hữu là phần đụng tới iPhone: màn hình, và đoạn code nói chuyện với CoreBluetooth. Màu sắc là **mã màu** của khoá, giống bài 01.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 245" role="img" aria-labelledby="l02-map-title">
<title id="l02-map-title">Mỗi mảnh của main.swift đi đâu. Device không được viết lại bằng Swift: app core có một model Kotlin mà Swift đọc. fakeScan thành outbound adapter viết bằng Swift, bọc CoreBluetooth và conform với outbound port Kotlin. Scanner và ScanState, cùng callback didSet, được thay bằng ViewModel Kotlin dùng chung và UI state của nó, một inbound adapter mà Swift quan sát. render và code top-level thành màn hình SwiftUI.</title>
<defs><marker id="l02-map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="120" y="14" text-anchor="middle">main.swift, bài này</text>
<text class="small muted" x="460" y="14" text-anchor="middle">Native Device Monitor</text>
<rect class="box" x="20" y="24" width="200" height="44" rx="6"/><text class="mono" x="120" y="51" text-anchor="middle">Device</text>
<rect class="box" x="20" y="80" width="200" height="44" rx="6"/><text class="mono" x="120" y="107" text-anchor="middle">fakeScan()</text>
<rect class="box" x="20" y="136" width="200" height="44" rx="6"/><text class="mono" x="120" y="163" text-anchor="middle">Scanner, ScanState</text>
<rect class="box" x="20" y="192" width="200" height="44" rx="6"/><text class="mono" x="120" y="219" text-anchor="middle">render(), code top-level</text>
<path class="edge" d="M220,46 L298,46" marker-end="url(#l02-map-arrow)"/>
<path class="edge" d="M220,102 L298,102" marker-end="url(#l02-map-arrow)"/>
<path class="edge" d="M220,158 L298,158" marker-end="url(#l02-map-arrow)"/>
<path class="edge" d="M220,214 L298,214" marker-end="url(#l02-map-arrow)"/>
<g data-part="core">
<rect class="box" x="300" y="24" width="320" height="44" rx="6"/>
<text class="title" x="314" y="42">App core (Kotlin)</text>
<text class="small muted" x="314" y="59">một model cho cả hai nền tảng; Swift đọc nó</text>
</g>
<g data-part="outbound">
<rect class="box" x="300" y="80" width="320" height="44" rx="6"/>
<text class="title" x="314" y="98">Outbound adapter (Swift)</text>
<text class="small muted" x="314" y="115">bọc CoreBluetooth sau một port Kotlin</text>
</g>
<g data-part="inbound">
<rect class="box" x="300" y="136" width="320" height="44" rx="6"/>
<text class="title" x="314" y="154">Inbound adapter (Kotlin)</text>
<text class="small muted" x="314" y="171">ViewModel dùng chung và UI state của nó</text>
</g>
<g data-part="ios">
<rect class="box" x="300" y="192" width="320" height="44" rx="6"/>
<text class="title" x="314" y="210">iOS</text>
<text class="small muted" x="314" y="227">màn hình SwiftUI quan sát ViewModel</text>
</g>
</svg>
<figcaption>Swift trong app phần lớn là phần rìa: một màn hình và một Bluetooth adapter. Khuôn của chương trình bài này còn giữ lại; model và scanner Swift thì không.
<ul class="legend"><li data-part="core">App core</li><li data-part="inbound">Inbound</li><li data-part="outbound">Outbound</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

!!! question "Hỏi agent của bạn"
    Kẹt ở dòng nào? Nhờ agent (thầy của bạn) giải thích, hoặc bảo nó đổi một chỗ rồi đoán output **trước khi** chạy.
    Ví dụ: *"Nếu `Scanner` là struct thì có gì thay đổi?"*

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q"><code>var a = Counter(); var b = a; b.count += 1</code>. <code>a.count</code> bằng bao nhiêu? (<code>Counter</code> là struct.)</p>
<div class="opts">
<button class="opt" data-correct>0</button>
<button class="opt">1</button>
<button class="opt">2</button>
</div>
<p class="feedback"></p>
<p class="why">Struct là giá trị: <code>b</code> là một bản copy. Nếu <code>Counter</code> là class thì đáp án là 1.</p>
</div>

<div class="quiz">
<p class="q">Vì sao Swift in ra <code>Scanning… 2 found</code> còn Kotlin thì không?</p>
<div class="opts">
<button class="opt">AsyncStream giữ giá trị lại cho tới cuối</button>
<button class="opt" data-correct>didSet chạy đồng bộ sau mỗi lần gán</button>
<button class="opt">Swift ngủ lâu hơn giữa mỗi thiết bị</button>
</div>
<p class="feedback"></p>
<p class="why">Callback chạy một lần cho mỗi thay đổi. Người collect StateFlow đọc giá trị mới nhất vào lần tới nó được chạy.</p>
</div>

<div class="quiz">
<p class="q"><code>@MainActor</code> trên <code>Scanner</code> đảm bảo điều gì?</p>
<div class="opts">
<button class="opt">Mọi method của nó chạy trên luồng nền</button>
<button class="opt" data-correct>State của nó chỉ bị đụng tới trên main actor</button>
<button class="opt">Nó không bao giờ gọi được hàm async nào</button>
</div>
<p class="feedback"></p>
<p class="why">Trình biên dịch ép điều này: code nằm ngoài main actor phải <code>await</code> mới với tới được nó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>Device</code> là struct còn <code>Scanner</code> là class?</p>
<div class="opts">
<button class="opt">Struct không giữ được field optional</button>
<button class="opt" data-correct>Device là một ảnh chụp copy được; scanner là một thứ dùng chung, có danh tính</button>
<button class="opt">Chỉ class mới được dùng async</button>
</div>
<p class="feedback"></p>
<p class="why">Nếu <code>Scanner</code> là struct, mỗi người giữ nó sẽ có bản copy riêng, và không ai thấy thay đổi state của người khác.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q"><code>val</code> của Kotlin là chữ nào của Swift:</p>
<div class="opts">
<button class="opt">var</button>
<button class="opt" data-correct>let</button>
<button class="opt">def</button>
</div>
<p class="feedback"></p>
</div>

<div class="quiz">
<p class="q"><code>for await (const d of scan())</code> của TypeScript viết bằng Swift là:</p>
<div class="opts">
<button class="opt">for d in await scan()</button>
<button class="opt">await for d in scan()</button>
<button class="opt" data-correct>for await d in scan()</button>
</div>
<p class="feedback"></p>
</div>

<div class="quiz">
<p class="q"><code>sealed interface</code> của Kotlin là thứ gì của Swift:</p>
<div class="opts">
<button class="opt">protocol có method mặc định</button>
<button class="opt" data-correct>enum có associated value</button>
<button class="opt">struct có field optional</button>
</div>
<p class="feedback"></p>
</div>

<div class="quiz">
<p class="q"><code>name ?: "Unknown"</code> của Kotlin viết bằng Swift là:</p>
<div class="opts">
<button class="opt" data-correct>name ?? "Unknown"</button>
<button class="opt">name ?: "Unknown"</button>
<button class="opt">name || "Unknown"</button>
</div>
<p class="feedback"></p>
<p class="why">Swift giữ <code>??</code> của TypeScript. Chỉ Kotlin có toán tử Elvis.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent)"
    1. Thêm `case failed(reason: String)` vào `ScanState`, rồi sửa bất cứ chỗ nào trình biên dịch báo.
    2. Cho `.done` liệt kê thiết bị mạnh nhất trước, dùng `sorted { $0.rssi > $1.rssi }`.
    3. Giải thích thành tiếng, hoặc cho agent nghe, vì sao `Device` là struct còn `Scanner` là class. Nếu `Scanner` là struct thì cái gì hỏng?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn để nó dựng và chạy chương trình. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/02-swift-for-typescript-devs.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/02-swift-for-typescript-devs.html" -o .course/lesson-02.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/kotlin-swift-typescript-cheatsheet.html" -o .course/ref-kotlin-swift-typescript-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" exactly,
except where the brief below says otherwise.

Lesson 02 (Swift for TypeScript developers): set up a Swift scratch program.
Starting point: nothing. Create the folder scratch/lesson-02/swift/ in my workspace.

1. A SwiftPM executable package in scratch/lesson-02/swift/, with exactly the two files
   in the lesson's "Full files" section:
   - Package.swift (swift-tools-version 6.0, platforms: [.macOS(.v13)], which the async
     APIs and Task.sleep(for:) need, and a single .executableTarget(name: "Lesson02"))
   - Sources/Lesson02/main.swift (the whole program; top-level code must live in
     main.swift)
   Create the two files by hand rather than with `swift package init`, so no extra
   generated source file sits next to main.swift.
2. Run `swift run -q`.

Acceptance checks:
- It prints exactly 4 lines: "Idle", "Scanning… 1 found", "Scanning… 2 found",
  "Done: OBD-II Dongle (AA:01) -48 dBm, Heart Rate (CC:03) -67 dBm".
- It builds with no compiler warnings (don't use -q to check this; read the build output).
Then walk me through the code line by line. Do NOT do the lesson's unaided exercise;
I do that myself.
```

## Đọc thêm

- [Cheatsheet: Kotlin ↔ Swift ↔ TypeScript](https://phongna-inn.github.io/carmd-kmp-course/reference/kotlin-swift-typescript-cheatsheet.html), bản một trang của bài 01 và 02.
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html): value type, actor, continuation…
- [Sách Swift: Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/), nguồn chính cho mục 4 và 5.
- Kinh nghiệm thực tế: [r/swift](https://reddit.com/r/swift) khi bạn muốn nghe ý kiến của người làm thật.

## File đầy đủ

Mọi file bài này tạo ra, đầy đủ. Mở một file để đối chiếu với bài làm của bạn.

??? example "Package.swift"
    ```swift
    // swift-tools-version: 6.0
    import PackageDescription

    let package = Package(
        name: "Lesson02",
        platforms: [.macOS(.v13)],
        targets: [
            .executableTarget(name: "Lesson02")
        ]
    )
    ```

??? example "Sources/Lesson02/main.swift"
    ```swift
    struct Device {
        let name: String?
        let address: String
        let rssi: Int
    }

    extension Device {
        var label: String { "\(name ?? "Unknown") (\(address)) \(rssi) dBm" }
    }

    enum ScanState {
        case idle
        case scanning(found: Int)
        case done([Device])
    }

    func fakeScan() -> AsyncStream<Device> {
        AsyncStream { continuation in
            Task {
                let nearby = [
                    Device(name: "OBD-II Dongle", address: "AA:01", rssi: -48),
                    Device(name: nil, address: "BB:02", rssi: -91),
                    Device(name: "Heart Rate", address: "CC:03", rssi: -67),
                ]
                for device in nearby {
                    try? await Task.sleep(for: .milliseconds(300))
                    continuation.yield(device)
                }
                continuation.finish()
            }
        }
    }

    @MainActor
    final class Scanner {
        var onChange: ((ScanState) -> Void)?

        private(set) var state: ScanState = .idle {
            didSet { onChange?(state) }
        }

        func start() async {
            var found: [Device] = []
            for await device in fakeScan() where device.rssi > -80 {
                found.append(device)
                state = .scanning(found: found.count)
            }
            state = .done(found)
        }
    }

    func render(_ state: ScanState) -> String {
        switch state {
        case .idle:
            return "Idle"
        case .scanning(let found):
            return "Scanning… \(found) found"
        case .done(let devices):
            return "Done: " + devices.map(\.label).joined(separator: ", ")
        }
    }

    let scanner = Scanner()
    scanner.onChange = { print(render($0)) }
    print(render(scanner.state))
    await scanner.start()
    ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Mọi ví dụ Swift ở đây đều đã chạy thật (Swift 6.3.2, macOS, chế độ Swift 6), output in ra là output thật.
Chương trình của bài nằm sẵn trong repo này ở `scratch/lesson-02/swift/`, chạy bằng `swift run -q`.

### A1. Struct và class: "copy" hay "cùng một cái"

Giải thích thêm cho [mục 1](#1-struct-la-gia-tri-class-la-tham-chieu).

!!! abstract "Một câu để nhớ"
    **Struct** giống **photocopy một tờ giấy**: đưa cho người khác bản copy, họ viết gì lên đó thì tờ của bạn vẫn sạch.
    **Class** giống **một file Google Docs dùng chung**: gửi link cho ai, họ sửa là bạn thấy ngay.

Trong TypeScript, muốn có hành vi "photocopy" bạn phải tự làm (`{ ...obj }`, `structuredClone(obj)`), và quên là dính lỗi sửa nhầm object của người khác.
Swift làm việc đó **tự động** cho mọi struct, và điều làm dev TS bất ngờ nhất: **`Array`, `Dictionary`, `String` của Swift cũng là struct**.

```swift
struct Counter { var count = 0 }
final class CounterRef { var count = 0 }

var a = Counter()
var b = a
b.count += 1
print("struct:", a.count, b.count)

let c = CounterRef()
let d = c
d.count += 1
print("class:", c.count, d.count)

var list = ["AA:01"]
var list2 = list
list2.append("CC:03")
print("array:", list, list2)

func bump(_ x: Counter) -> Counter { var y = x; y.count += 10; return y }
let e = Counter()
let f = bump(e)
print("func:", e.count, f.count)
```

Output:

```text
struct: 0 1
class: 1 1
array: ["AA:01"] ["AA:01", "CC:03"]
func: 0 10
```

- Dòng `array`: trong TS, `const list2 = list; list2.push(...)` sẽ đổi luôn `list`. Ở Swift thì không, vì mảng là giá trị.
- Dòng `func`: truyền struct vào hàm là truyền bản copy. Hàm không bao giờ sửa được biến của người gọi (muốn vậy phải dùng `inout`, hiếm gặp).

Struct khai báo bằng `let` thì không sửa được field nào, kể cả field khai báo `var`. Trình biên dịch báo:

```text
error: left side of mutating operator isn't mutable: 'a' is a 'let' constant
```

| Việc | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Kiểu dữ liệu mặc định | object (tham chiếu) | `data class` (tham chiếu, nhưng thường bất biến) | `struct` (giá trị) |
| Gán `b = a` | cùng một object | cùng một object | `struct`: bản copy · `class`: cùng một object |
| Copy và đổi một field | `{ ...a, rssi: -50 }` | `a.copy(rssi = -50)` | `var b = a; b.rssi = -50` |
| So sánh bằng theo nội dung | tự viết | có sẵn (`==`) | thêm `: Equatable` là có `==` |
| Mảng có phải giá trị? | không | không | **có** |

!!! tip "Áp vào app"
    `Device` là struct: một kết quả quét là một bức ảnh chụp; màn hình nào giữ bản nào thì cứ giữ, không ai sửa được của ai.
    `Scanner` là class: cả màn hình danh sách lẫn màn hình chi tiết phải nói chuyện với **cùng một** scanner, nếu không thì một màn bấm "Dừng quét" mà màn kia vẫn quét.

### A2. `if let` và `guard let`: mở optional

Giải thích thêm cho [mục 2](#2-optional).

Trong TS, bạn viết `if (d.name) { ... }` và trình biên dịch tự thu hẹp kiểu `string | null` thành `string` bên trong khối.
Swift không thu hẹp ngầm như vậy. Thay vào đó bạn **đặt tên mới** cho giá trị đã mở:

- **`if let name = d.name { … }`**: có tên thì chạy khối, bên trong `name` là `String` (không còn `?`).
- **`guard let name = d.name else { return … }`**: không có tên thì **thoát sớm**. Qua được dòng này, `name` dùng được tới hết hàm. Giống viết `if (!d.name) return ...;` ở đầu hàm TS.
- Từ Swift 5.7 được viết tắt `if let name { … }` khi tên mới trùng tên cũ.

```swift
struct Device { let name: String?; let address: String }

func show(_ d: Device) {
    if let name = d.name {
        print("if let:", name.uppercased())
    } else {
        print("if let: no name for", d.address)
    }
}

func label(_ d: Device) -> String {
    guard let name = d.name else { return "Unknown (\(d.address))" }
    return "\(name) (\(d.address))"
}

let devices = [Device(name: "Heart Rate", address: "CC:03"), Device(name: nil, address: "BB:02")]
for d in devices {
    show(d)
    print("guard let:", label(d))
}
let name: String? = devices[0].name
if let name { print("Swift 5.7+:", name) }
```

Output:

```text
if let: HEART RATE
guard let: Heart Rate (CC:03)
if let: no name for BB:02
guard let: Unknown (BB:02)
Swift 5.7+: Heart Rate
```

| Việc | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Có giá trị thì làm | `if (name) { … }` | `name?.let { … }` hoặc `if (name != null)` | `if let name { … }` |
| Không có thì thoát sớm | `if (!name) return;` | `val n = name ?: return` | `guard let name else { return }` |
| Giá trị dự phòng | `name ?? "Unknown"` | `name ?: "Unknown"` | `name ?? "Unknown"` |
| Ép, sai thì chết | `name!` (không kiểm tra) | `name!!` (ném lỗi) | `name!` (crash app) |

Quy ước: khi điều kiện là "điều kiện để hàm làm tiếp" thì dùng `guard`, code chính không bị lồng sâu vào trong `if`.

### A3. `AsyncStream` chạy ngay, `Flow` thì chờ

Giải thích thêm cho [đoạn "Không lạnh"](#ban-quet-gia-mot-asyncstream) ở phần bản quét giả.

!!! abstract "Một câu để nhớ"
    **Kotlin `flow { }`** là **công thức nấu ăn**: chưa ai gọi `collect` thì chưa ai nấu.
    **Swift `AsyncStream` + `Task`** là **bếp đã nổi lửa**: gọi `fakeScan()` là món bắt đầu ra, nằm chờ trên quầy (buffer) cho tới khi có người tới lấy bằng `for await`.

Ví dụ: tạo stream, cố tình **chờ 500 ms rồi mới đọc**. In thời điểm từng bước:

```swift
import Foundation
let start = Date()
func t() -> String { String(format: "%4.0f ms", Date().timeIntervalSince(start) * 1000) }

func numbers() -> AsyncStream<Int> {
    AsyncStream { continuation in
        Task {
            for n in 1...3 {
                try? await Task.sleep(for: .milliseconds(100))
                print(t(), "yield", n)
                continuation.yield(n)
            }
            continuation.finish()
        }
    }
}

let stream = numbers()
print(t(), "stream created, nobody listening yet")
try? await Task.sleep(for: .milliseconds(500))
print(t(), "start for await")
for await n in stream { print(t(), "read", n) }
print(t(), "done")
```

Output (số ms lệch vài ms mỗi lần chạy):

```text
   0 ms stream created, nobody listening yet
 100 ms yield 1
 206 ms yield 2
 309 ms yield 3
 529 ms start for await
 530 ms read 1
 530 ms read 2
 530 ms read 3
 531 ms done
```

Cả ba giá trị đã được sinh ra **trước khi** có ai đọc, rồi được đọc một lượt từ buffer. Với `flow { }` của Kotlin, chưa có `collect` thì chưa có dòng `yield` nào.

| Việc | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Luồng giá trị bất đồng bộ | `async function*` (async generator) | `flow { }` | `AsyncStream { continuation in … }` |
| Đẩy một giá trị | `yield x` | `emit(x)` | `continuation.yield(x)` |
| Kết thúc | `return` | hết khối `flow { }` | `continuation.finish()` |
| Đọc | `for await (const x of s)` | `s.collect { x -> }` | `for await x in s` |
| Bắt đầu chạy khi nào | khi bắt đầu lặp (lạnh) | khi `collect` (lạnh) | **ngay khi tạo**, nếu bên trong có `Task` (nóng) |
| Bị huỷ theo ai | không ai | scope sở hữu coroutine | `Task { }` không thuộc scope nào |

Để ý: async generator của TS **lạnh giống `Flow`**, nên trực giác TS dẫn sai ở đúng chỗ này.

!!! tip "Áp vào app"
    Ở bài 13, CoreBluetooth gọi callback mỗi lần thấy một thiết bị. Sóng radio không chờ ai đọc, nên kiểu "đẩy vào buffer" của `AsyncStream` lại đúng là thứ cần: callback gọi `continuation.yield(device)`, phía dưới đọc bằng `for await`.

### A4. `@MainActor`: trình biên dịch canh luồng UI giùm bạn

Giải thích thêm cho [mục 5](#5-asyncawait-asyncstream-va-mainactor) và ghi chú 1 của phần Scanner.

Trong TS chỉ có một luồng, nên không bao giờ phải hỏi "dòng này đang chạy ở luồng nào". Ở app native, UI **chỉ** được đụng tới từ luồng chính; đụng từ luồng khác là UI lỗi hoặc crash.

- **Kotlin** chọn luồng lúc chạy: `withContext(Dispatchers.Main) { … }`. Quên là chỉ phát hiện khi app chạy.
- **Swift** đánh dấu lúc khai báo: `@MainActor` trên class nghĩa là mọi property và method của nó thuộc main actor. Code nằm ngoài main actor mà đụng vào **không biên dịch được**.

Ví dụ một hàm thường (không thuộc actor nào) đọc state của `Scanner`:

```swift
@MainActor
final class Scanner {
    var count = 0
}

func peek(_ s: Scanner) {
    print(s.count)
}
```

Trình biên dịch báo:

```text
error: main actor-isolated property 'count' can not be referenced from a nonisolated context
```

Hai cách sửa đúng: cho hàm chạy trên main actor (`@MainActor func`), hoặc cho hàm là `async` và `await` khi với tới (Swift tự chuyển sang main actor để đọc):

```swift
@MainActor
final class Scanner {
    var count = 0
}

func peek(_ s: Scanner) async {
    let n = await s.count
    print("read from outside:", n)
}

@MainActor
func bump(_ s: Scanner) {
    s.count += 1
    print("on main actor:", s.count)
}

let s = Scanner()
bump(s)
await peek(s)
```

Output:

```text
on main actor: 1
read from outside: 1
```

`bump(s)` gọi thẳng không cần `await` vì code top-level của `main.swift` đã chạy trên main actor (ghi chú 3 của phần Render).

| Việc | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Luồng UI | chỉ có một luồng | `Dispatchers.Main` | main actor |
| Đánh dấu "chỉ chạy trên UI" | không cần | không có, tự nhớ | `@MainActor` |
| Quên thì sao | không thể quên | lỗi lúc chạy | **lỗi lúc biên dịch** |
| Với tới từ chỗ khác | không áp dụng | `withContext(Dispatchers.Main) { … }` | `await` |

### A5. Nhãn tham số `_` và key path `\.label`

Giải thích thêm cho [mục 4](#4-closure) và ghi chú 2 của phần Render.

Hàm Swift có **hai tên cho mỗi tham số**: nhãn người gọi viết (argument label) và tên dùng bên trong hàm. Mặc định hai tên trùng nhau.

- `func connect(to device: Device)`: người gọi viết `connect(to: d)`, bên trong dùng `device`. Đọc như câu tiếng Anh.
- `func render(_ d: Device)`: `_` nghĩa là **không có nhãn**, người gọi viết `render(d)` như TS.

TS không có nhãn; gần nhất là truyền một object `connect({ to: d, timeout: 10 })`. Kotlin có named argument nhưng không bắt buộc và không đổi tên được.

Key path `\.label` là cách viết ngắn của closure `{ $0.label }`: "lấy property `label` của từng phần tử".

```swift
struct Device { let name: String; let rssi: Int }

func connect(to device: Device, timeout seconds: Int = 5) -> String {
    "connect \(device.name) in \(seconds)s"
}
func render(_ d: Device) -> String { "\(d.name) \(d.rssi) dBm" }

let devices = [Device(name: "OBD-II Dongle", rssi: -48), Device(name: "Heart Rate", rssi: -67)]
print(connect(to: devices[0]))
print(connect(to: devices[1], timeout: 10))
print(render(devices[0]))
print(devices.map(\.name))
print(devices.map { $0.name })
print(devices.map { d in d.rssi })
print(devices.sorted { $0.rssi < $1.rssi }.map(\.name))
```

Output:

```text
connect OBD-II Dongle in 5s
connect Heart Rate in 10s
OBD-II Dongle -48 dBm
["OBD-II Dongle", "Heart Rate"]
["OBD-II Dongle", "Heart Rate"]
[-48, -67]
["Heart Rate", "OBD-II Dongle"]
```

| Việc | TypeScript | Kotlin | Swift |
|---|---|---|---|
| Lấy một field của mỗi phần tử | `devices.map(d => d.name)` | `devices.map { it.name }` | `devices.map(\.name)` |
| Tham số viết tắt | không có | `it` | `$0`, `$1` |
| Closure có tên tham số | `(d) => d.rssi` | `{ d -> d.rssi }` | `{ d in d.rssi }` |
| Gọi hàm có nhãn | không có (dùng object) | `connect(to = d)` (không bắt buộc) | `connect(to: d)` (bắt buộc) |
| Bỏ nhãn | mặc định | mặc định | khai báo `_` |

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 03.

- [ ] Đọc một đoạn Swift và "dịch nhẩm" sang TypeScript và Kotlin: `let`/`var`, `String?`, `??`, `!`, closure `{ x in … }`, `$0`, `\.label`.
- [ ] Đoán đúng output khi gán hoặc truyền một struct so với một class, kể cả với `Array` (xem [A1](#a1-struct-va-class-copy-hay-cung-mot-cai)).
- [ ] Chọn được struct hay class cho một kiểu mới, và giải thích vì sao `Device` là struct còn `Scanner` là class.
- [ ] Mở optional bằng `if let` và `guard let`, biết lúc nào dùng cái nào (xem [A2](#a2-if-let-va-guard-let-mo-optional)).
- [ ] Viết `enum` có associated value, `switch` đủ nhánh và lấy giá trị ra bằng `case .x(let v)`.
- [ ] Viết một `AsyncStream` bằng `continuation.yield` / `finish()` và đọc bằng `for await … where`.
- [ ] Giải thích được vì sao `AsyncStream` có `Task` bên trong chạy ngay còn `flow { }` của Kotlin thì chờ `collect` (xem [A3](#a3-asyncstream-chay-ngay-flow-thi-cho)).
- [ ] Dùng `private(set)` và `didSet` để làm một property chỉ đọc từ bên ngoài, báo lại mỗi lần đổi.
- [ ] Giải thích được `@MainActor` bảo vệ gì, và sửa được lỗi "main actor-isolated … nonisolated context" (xem [A4](#a4-mainactor-trinh-bien-dich-canh-luong-ui-gium-ban)).
- [ ] Giải thích được vì sao Swift in `Scanning… 2 found` còn Kotlin thì không (`didSet` so với `StateFlow`).
- [ ] Dựng một SwiftPM executable package và chạy bằng `swift run -q`, build không có cảnh báo.
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
