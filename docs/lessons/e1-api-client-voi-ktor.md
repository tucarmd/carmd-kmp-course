---
source: lessons/e1-api-client-with-ktor.html
source_ref: live
source_sha: 59bb0b8
---

<p class="kicker">Phần mở rộng E1 · tuỳ chọn, sau các bài lõi · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/e1-api-client-with-ktor.html">Bản gốc tiếng Anh</a></p>

# API client với Ktor

<div class="meta">
  <span class="tag">~2,5 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: e1 màn hình API: thành công / lỗi / hết giờ</span>
  <span class="tag">Cần trước: <a href="../20-tich-hop-va-kiem-tra-cuoi/">20</a> (m15)</span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Gần như mọi app team phát hành đều nói chuyện với một server, và mạng là chỗ app hỏng nhiều nhất: mất sóng, một host không trả lời, một lỗi 404, một server chậm mãi. Native Device Monitor không có server, nên phần mở rộng này cho nó một chỗ để thử: một **màn hình test API** với một ô URL, GET và POST, và hiện câu trả lời hoặc lỗi (Appendix A.5 của kế hoạch khoá học). Mục đích không phải là màn hình. Mà là code HTTP nằm đâu: trong một **outbound adapter** duy nhất trong code dùng chung, dựa trên Ktor, sau một port đặt tên theo thứ app cần. Không gì khác trong app biết nó dùng thư viện HTTP nào, và các test chạy không cần mạng. Điều đó cho milestone **e1**: thành công, lỗi và hết giờ, trên cả hai nền tảng.

!!! info "Nguồn chính"
    Tài liệu client của Ktor: [Client engines](https://ktor.io/docs/client-engines.html) trước mục 3, [Content negotiation and serialization](https://ktor.io/docs/client-serialization.html) trước mục 4, [Timeout](https://ktor.io/docs/client-timeout.html) và [Response validation](https://ktor.io/docs/client-response-validation.html) trước mục 5, và [Testing](https://ktor.io/docs/client-testing.html) trước mục 9. Cho mục 8: [Network security configuration](https://developer.android.com/privacy-and-security/security-config) của Android và [Preventing insecure network connections](https://developer.apple.com/documentation/security/preventing-insecure-network-connections) của Apple.

!!! info "Track"
    Các port, service, adapter Ktor, ViewModel và mọi test là code dùng chung, giống nhau trên mọi track. Các engine nằm trong `androidMain` và `iosMain`, nên cả hai track của một nền tảng dùng chung chúng. Các track khác nhau ở màn hình test API và nút mở nó (mục 7); 0,5 giờ thêm cho mỗi track là hai thứ đó trên XML hoặc UIKit. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m15

| Cái gì | m15 | e1 |
|---|---|---|
| app core | năm khả năng: quét, session, quyền, trạng thái, monitor | khả năng thứ sáu: inbound port `ApiTesting` và `ApiTestingService`; outbound port `EndpointProbe`; các model `ProbeResult`, `ProbeMessage` và `ApiTestResult` |
| outbound adapter | — | `KtorEndpointProbe` (dùng chung, `commonMain`) với `httpEngine()`: OkHttp trong `androidMain`, Darwin trong `iosMain` |
| inbound adapter dùng chung | ba ViewModel | thêm `ApiTestViewModel` và `ApiTestUiState` |
| Koin | chín adapter truyền vào `initKoin` | vẫn chín: probe là code dùng chung, nên `appModule` bind nó; `ApiTestViewModel` được bind |
| màn hình | màn hình chính và màn hình thiết bị | thêm màn hình test API, mở bằng một nút "API test" trên màn hình chính |
| `shared/build.gradle.kts` | không có HTTP | Ktor 3.6.0: core, content negotiation và JSON trong `commonMain`, mỗi nền tảng một engine, `ktor-client-mock` trong `commonTest` |
| manifest Android | quyền Bluetooth và trạng thái | thêm `INTERNET` |
| test | 105 mỗi nền tảng | 122 mỗi nền tảng: 6 cho service, 7 cho adapter trên một `MockEngine`, 4 cho ViewModel |
| `docs/checklists.md` | "API: chỉ phần mở rộng E1" | bốn hàng API: GET, POST, lỗi, hết giờ |

## 1. Một port đặt tên theo thứ app cần

Ý tưởng đầu tiên của đa số người là một interface `ApiClient` trong app core có `get` và `post`. Kế hoạch khoá học nói không (ADR 0001): một outbound port được đặt tên theo cách nói của app, không bao giờ theo cách nói của HTTP. Một port `ApiClient` sẽ đặt tầng truyền tải vào giữa app, và mọi tính năng cần server sẽ phụ thuộc vào cùng một interface rộng. Thay vào đó, mỗi nhu cầu có port riêng. Một tính năng thật sẽ có một port đặt theo việc của nó, chẳng hạn `LogUploader` cho các bản ghi của monitor, và core sẽ không bao giờ nghe tới URL. Việc của màn hình test thì khác: thử một endpoint bằng tay. Nên port của nó là `EndpointProbe`, và nó có nói về URL, vì URL chính là thứ màn hình đó xoay quanh.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 290" role="img" aria-labelledby="le1-path-title">
      <title id="le1-path-title">Đường đi của một request trong e1. Màn hình, trên bất kỳ track nào trong bốn, gọi ApiTestViewModel, một inbound adapter. ViewModel gọi inbound port ApiTesting, do ApiTestingService implement trong app core. Service gọi outbound port EndpointProbe. KtorEndpointProbe, một outbound adapter dùng chung trong commonMain, implement nó dựa trên Ktor, với engine của nền tảng từ httpEngine(): OkHttp trong androidMain, Darwin trong iosMain. Engine nói chuyện với mạng. Ktor chỉ xuất hiện trong adapter và engine của nó.</title>
      <defs><marker id="le1-path-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="20" y="30" width="150" height="56" rx="6"></rect>
      <text class="title" x="32" y="54">Màn hình test API</text>
      <text class="small muted" x="32" y="74">bốn track</text>
      <g data-part="inbound">
        <rect class="box" x="200" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="212" y="54">ApiTestViewModel</text>
        <text class="small" x="212" y="74">inbound adapter</text>
      </g>
      <g data-part="core">
        <rect class="box" x="390" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="402" y="54">ApiTesting</text>
        <text class="small" x="402" y="74">inbound port</text>
        <rect class="box" x="580" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="592" y="54">ApiTestingService</text>
        <text class="small" x="592" y="74">các quy tắc của màn hình</text>
        <rect class="box" x="580" y="150" width="160" height="56" rx="6"></rect>
        <text class="title" x="592" y="174">EndpointProbe</text>
        <text class="small" x="592" y="194">outbound port</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="370" y="150" width="180" height="56" rx="6"></rect>
        <text class="title" x="382" y="174">KtorEndpointProbe</text>
        <text class="small" x="382" y="194">commonMain · Ktor ở đây</text>
      </g>
      <g data-part="android">
        <rect class="box" x="200" y="130" width="140" height="44" rx="6"></rect>
        <text class="small" x="212" y="157">OkHttp (androidMain)</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="200" y="186" width="140" height="44" rx="6"></rect>
        <text class="small" x="212" y="213">Darwin (iosMain)</text>
      </g>
      <rect class="box" x="20" y="150" width="140" height="56" rx="6"></rect>
      <text class="title" x="32" y="174">mạng</text>
      <text class="small muted" x="32" y="194">một server, hoặc không gì cả</text>
      <path class="edge" d="M170,58 L198,58" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M360,58 L388,58" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M550,58 L578,58" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M660,86 L660,148" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge dashed" d="M580,178 L552,178" marker-end="url(#le1-path-arrow)"></path>
      <text class="small muted" x="556" y="226">implements</text>
      <path class="edge" d="M370,178 L342,160" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M370,178 L342,206" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M200,152 L162,170" marker-end="url(#le1-path-arrow)"></path>
      <path class="edge" d="M200,208 L162,186" marker-end="url(#le1-path-arrow)"></path>
      <text class="small muted" x="200" y="262">httpEngine(): mỗi nền tảng một actual</text>
      <text class="small muted" x="390" y="262">không kiểu Ktor nào đi vào app core</text>
    </svg>
    <figcaption>Đường đi của một request. Ktor sống trong adapter và engine của nó; app core chỉ thấy <code>EndpointProbe</code> và <code>ProbeResult</code>.
<ul class="legend">
    <li data-part="inbound">inbound adapter</li>
    <li data-part="core">app core</li>
    <li data-part="outbound">outbound adapter</li>
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/EndpointProbe.kt" hl_lines="8 9 14"
⋯ package, imports, and the comment: one shared adapter implements it
interface EndpointProbe {
    // GET url with the query parameters and headers. Never throws; every outcome is a ProbeResult.
    suspend fun get(
        url: String,
        params: Map<String, String>,
        headers: Map<String, String>,
        timeLimit: Duration,
    ): ProbeResult

    // POST the message to url as JSON, with the headers. Never throws, like get.
    suspend fun post(
        url: String,
        message: ProbeMessage,
        headers: Map<String, String>,
        timeLimit: Duration,
    ): ProbeResult
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ProbeResult.kt" hl_lines="4 7 11"
sealed interface ProbeResult {
    // The server answered, with any status: 200, 404 and 500 are all answers. The body is text;
    // a JSON body comes indented, ready to show.
    data class Answered(val status: Int, val body: String) : ProbeResult

    // No full answer within the time limit.
    data object TimedOut : ProbeResult

    // No answer at all: no network, a host that doesn't exist, a refused or broken connection,
    // or a request the platform won't send. The reason is the platform's own words.
    data class Unreachable(val reason: String) : ProbeResult
}
```

1. **Chỉ các kiểu của chính app.** Chuỗi, map, một `Duration`, `ProbeMessage` và `ProbeResult`, tất cả trong app core. Không `HttpResponse`, không `HttpStatusCode`, không exception nào của Ktor. Lệnh `grep` của checklist refactor (bài 20) vẫn không tìm thấy import `io.ktor` nào dưới `core/`.
2. **"Không bao giờ ném lỗi" là một phần của port.** Mạng hỏng thường xuyên và theo nhiều cách; mỗi cách là một giá trị mà service suy luận được. Việc của adapter là biến mọi lỗi nó gặp thành một trong ba kết quả (mục 5), nên không exception nào của Ktor hay của nền tảng tới được core.
3. **Giới hạn thời gian là một tham số.** Màn hình chờ bao lâu là một quy tắc của app, và quy tắc sống trong service, như 10 s của lần quét ở bài 20. Adapter chỉ áp con số được đưa.
4. **POST gửi một `ProbeMessage`, không phải JSON.** Core nói gửi gì (một lời chào và lúc nó được gửi); adapter quyết định nó đi dưới dạng JSON. Đó là cùng cách chia như kho log của bài 17, mà các bản ghi không biết gì về JSON Lines.

## 2. Service: các quy tắc của màn hình

Inbound port là thứ ViewModel của màn hình gọi: `get(url, params)` và `post(url)`, mỗi cái trả về một `ApiTestResult`, không bao giờ ném lỗi. Service quyết định gửi gì và câu trả lời nghĩa là gì:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/ApiTestingService.kt" hl_lines="3 9 15 17 22"
    override suspend fun get(url: String, params: Map<String, String>): ApiTestResult {
        val target = url.trim()
        if (!isWebUrl(target)) return ApiTestResult.InvalidUrl(target)
        return judge(probe.get(target, params, ASK_FOR_JSON, TIME_LIMIT))
    }

    override suspend fun post(url: String): ApiTestResult {
⋯ the same check
        val message = ProbeMessage(GREETING, clock.now())
        return judge(probe.post(target, message, ASK_FOR_JSON, TIME_LIMIT))
    }

    private fun judge(result: ProbeResult): ApiTestResult = when (result) {
        is ProbeResult.Answered ->
            if (result.status in 200..299) ApiTestResult.Success(result.status, result.body)
            else ApiTestResult.HttpError(result.status, result.body)
        ProbeResult.TimedOut -> ApiTestResult.TimedOut(TIME_LIMIT)
        is ProbeResult.Unreachable -> ApiTestResult.Unreachable(result.reason)
    }
⋯ isWebUrl: "http://" or "https://" in any case, a host, and no spaces
    companion object {
        val TIME_LIMIT = 10.seconds
        const val GREETING = "Hello from the Native Device Monitor"
        private val ASK_FOR_JSON = mapOf("Accept" to "application/json")
    }
```

1. **Một chuỗi không phải URL web thì không bao giờ được gửi.** "example.com" hay "ftp://…" thành `InvalidUrl` trước khi port được gọi, và màn hình nói phải gõ gì. Kiểm tra cố tình nhỏ: một scheme, một host, không có dấu cách. Mọi thứ tinh tế hơn là việc của adapter bắt (mục 5).
2. **2xx là thành công; mọi status khác là lỗi HTTP.** Đó là một quy tắc của app, nên nó ở đây, không trong cài đặt của Ktor. Server đã trả lời, nên body vẫn tới màn hình: một trang 404 thường nói lý do.
3. **Hết giờ thì nói màn hình đã chờ bao lâu.** `TimedOut(TIME_LIMIT)` mang con số của chính service, nên câu chữ trên màn hình ("no answer within 10 s") không lệch được khỏi giới hạn đã đưa cho adapter.
4. **Đồng hồ là một tham số constructor**, mặc định `Clock.System`, như trong `MonitoringService`: một test ghim `sentAt` vào một thời điểm biết trước.

`ApiTestResult` có năm trường hợp: `Success`, `HttpError`, `TimedOut`, `Unreachable` và `InvalidUrl`. Đó là ý của A.5 khi nói "service của nó biến timeout và lỗi mạng thành kết quả mà UI hiện được": các kết quả có kiểu, mà ViewModel diễn thành lời (mục 6).

## 3. Ktor bên trong một adapter

Ktor là framework Kotlin của JetBrains cho HTTP server và client, và client của nó là Kotlin Multiplatform. API của client giống nhau trên mọi nền tảng; thứ thật sự mở socket là một **engine**, và mỗi nền tảng có engine riêng. Module dùng chung nhận core của Ktor, plugin JSON và định dạng JSON của nó trong `commonMain`, mỗi nền tảng một engine, và mock engine cho test:

```kotlin title="shared/build.gradle.kts" hl_lines="3 9 12 16"
        commonMain.dependencies {
⋯ as in m15
            implementation("io.ktor:ktor-client-core:3.6.0")
            implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
            implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
        }
        androidMain.dependencies {
⋯ as in m15
            implementation("io.ktor:ktor-client-okhttp:3.6.0")
        }
        iosMain.dependencies {
            implementation("io.ktor:ktor-client-darwin:3.6.0")
        }
        commonTest.dependencies {
⋯ as in m15
            implementation("io.ktor:ktor-client-mock:3.6.0")
        }
```

Plugin kotlinx.serialization, thứ JSON của Ktor cần, đã có trong module dùng chung từ bài 17. Adapter nhận engine từ bên ngoài, mẫu mà hướng dẫn test của Ktor chỉ ra (`ApiClient(engine)` của nó nhận `CIO.create()` trong app và một `MockEngine` trong test):

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbe.kt" hl_lines="1 4 6"
internal class KtorEndpointProbe(engine: HttpClientEngine) : EndpointProbe {
    private val client = HttpClient(engine) {
        // JSON both ways: setBody(@Serializable object) sends it, body<T>() reads it.
        install(ContentNegotiation) { json() }
        // Lets each request set its own time limit (timeout { … } below).
        install(HttpTimeout)
        // expectSuccess stays false, the default: a 404 or a 500 is an answer, not an exception.
    }
⋯ get, post, probe, readBody
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.kt" hl_lines="1"
internal expect fun httpEngine(): HttpClientEngine
```

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.android.kt" hl_lines="1"
internal actual fun httpEngine(): HttpClientEngine = OkHttp.create()
```

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.ios.kt" hl_lines="1"
internal actual fun httpEngine(): HttpClientEngine = Darwin.create()
```

1. **Engine là một tham số.** Trong app nó là của nền tảng; trong test nó là một `MockEngine` trả lời không cần mạng (mục 9). Mọi thứ khác, kể cả các plugin, là cùng code ở cả hai.
2. **Mỗi nền tảng một engine, bằng `expect`/`actual`.** Cơ chế của bài 05, quay lại vì một lý do thật: `commonMain` khai báo rằng có một engine, và source set của mỗi nền tảng nói là cái nào. OkHttp là engine mà ví dụ Android của Ktor dùng; Darwin "dùng `NSURLSession` bên dưới". Tài liệu Ktor còn có `ktor-client-engine-defaults`, một artifact tự chọn engine cho từng target; khoá học viết rõ các engine ra để bạn thấy chúng.
3. **`internal`.** Adapter và `httpEngine()` chỉ thấy được bên trong module dùng chung. Koin dựng adapter trong code dùng chung (mục 6), và Swift không có lý do gì để thấy một kiểu Ktor, nên không cái nào tới header của framework.
4. **Không gì ngoài bốn file này import Ktor**: `KtorEndpointProbe.kt` và ba file `HttpEngine`. Đó là "Không gì ngoài adapter đó import Ktor" của A.5, với hàm engine được tính là một phần của adapter. Brief cho agent kiểm tra điều đó bằng một `grep`.

## 4. GET, POST và JSON

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbe.kt" hl_lines="3 4 5 13 14 19"
    ): ProbeResult = probe {
        client.get(url) {
            params.forEach { (name, value) -> parameter(name, value) } // encoded into the query
            headers.forEach { (name, value) -> header(name, value) }
            timeout { requestTimeoutMillis = timeLimit.inWholeMilliseconds }
        }
    }
⋯ post's parameters
    ): ProbeResult = probe {
        client.post(url) {
            headers.forEach { (name, value) -> header(name, value) }
            timeout { requestTimeoutMillis = timeLimit.inWholeMilliseconds }
            contentType(ContentType.Application.Json)
            setBody(MessageBody(message.text, message.sentAt.toString()))
        }
    }
⋯ probe, readBody
    @Serializable
    private class MessageBody(val text: String, val sentAt: String)
```

1. **Tham số đi qua `parameter()`, không qua nối chuỗi.** Ktor mã hoá chúng: test adapter gửi `name` = "OBD II" và URL thành `?name=OBD+II&max=5`. Dán `"?name=$name"` vào URL sẽ vỡ ở dấu cách hay `&` đầu tiên.
2. **Timeout cho từng request.** `install(HttpTimeout)` một lần, rồi `timeout { … }` trên mỗi request: "timeout chỉ định cho một request cụ thể ghi đè timeout chung trong khối install" (trang Timeout của Ktor). Request timeout là cả lời gọi, "từ lúc gửi request tới lúc nhận response".
3. **JSON đi ra: một class `@Serializable` và một content type.** `setBody` trao object cho ContentNegotiation, thứ serialize nó theo content type bạn đặt. Class sống trong adapter, nên `ProbeMessage` của core không mang annotation nào; `sentAt` đi dưới dạng chuỗi ISO mà `Instant.toString()` in ra, như trong log của bài 17.
4. **Header Accept của service tới một lần.** ContentNegotiation tự thêm `Accept: application/json` khi một request không có nó. Test adapter đầu tiên của chúng tôi, có và không có header của service, thấy đúng một `application/json` cả hai lần, và httpbin phản hồi lại một. Service vẫn đặt nó: quy tắc "xin JSON" thuộc về app, không thuộc về một plugin mà ta có thể thay.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbe.kt" hl_lines="2 5 6"
    private suspend fun readBody(response: HttpResponse): String {
        val isJson = response.contentType()?.match(ContentType.Application.Json) == true
        if (!isJson) return response.bodyAsText()
        return try {
            indented.encodeToString(JsonElement.serializer(), response.body<JsonElement>())
        } catch (e: ContentConvertException) {
            response.bodyAsText()
        }
    }
⋯ MessageBody, then:
    private companion object {
        val indented = Json { prettyPrint = true }
    }
```

1. **JSON đi vào: `body<T>()`.** Một màn hình nhận URL bất kỳ không thể biết hình dạng câu trả lời, nên `T` là `JsonElement`, kiểu "JSON bất kỳ" của kotlinx.serialization. Một tính năng thật sẽ xin class `@Serializable` riêng của nó ở đây, vẫn bên trong adapter của nó.
2. **Thụt lề cho người đọc.** Mã hoá lại bằng `prettyPrint` biến `{"id":1,"done":false}` thành mỗi trường một dòng, đó là thứ màn hình hiện. Mọi content type khác tới đúng như server gửi.
3. **Một server nói là JSON mà gửi thứ khác** làm `body<JsonElement>()` ném một `ContentConvertException` (`JsonConvertException` của Ktor kế thừa nó). Adapter hiện chữ thô thay vào: câu trả lời vẫn là một câu trả lời. Đọc body lần thứ hai chạy được vì một response từ `client.get` hay `client.post` được đọc vào bộ nhớ trước khi trả về cho bạn.

## 5. Những gì có thể hỏng: status, timeout, lỗi mạng

Mỗi request kết thúc theo một trong vài cách. Adapter, service và ViewModel mỗi bên đẩy chúng thêm một bước, từ thứ Ktor báo tới thứ một con người đọc:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="le1-outcomes-title">
      <title id="le1-outcomes-title">Mỗi kết cục của một request đi qua đâu. Một server trả lời status 2xx thành ProbeResult.Answered trong adapter, ApiTestResult.Success trong service, và "GET · 200 · success" trên màn hình. Mọi status khác cũng là Answered, rồi HttpError, rồi "GET · HTTP error 404". Một request timeout, connect timeout hay socket timeout thành TimedOut, rồi TimedOut kèm giới hạn 10 giây, rồi "no answer within 10 s". Mọi IOException khác, như host không tồn tại, không có mạng, kết nối bị từ chối hay một request cleartext bị nền tảng chặn, hoặc một URL mà Ktor hay engine từ chối, thành Unreachable kèm lý do của nền tảng, rồi Unreachable, rồi "couldn't reach the server" kèm lý do. Một chuỗi không phải URL http hay https bị service chặn trước khi adapter được gọi: InvalidUrl, rồi "Enter a URL that starts with http:// or https://".</title>
      <defs><marker id="le1-out-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <text class="small muted" x="20" y="20">chuyện gì đã xảy ra</text>
      <text class="small muted" x="230" y="20">adapter: ProbeResult</text>
      <text class="small muted" x="410" y="20">service: ApiTestResult</text>
      <text class="small muted" x="590" y="20">ViewModel: dòng chữ</text>
      <text class="small" x="20" y="54">đã trả lời, 2xx</text>
      <text class="small" x="20" y="112">đã trả lời, 404 · 500 · …</text>
      <text class="small" x="20" y="170">request · connect · socket timeout</text>
      <text class="small" x="20" y="228">IOException khác: không có host,</text>
      <text class="small" x="20" y="244">offline, bị từ chối, cleartext;</text>
      <text class="small" x="20" y="260">một URL mà engine từ chối</text>
      <text class="small" x="20" y="296">không phải URL http(s)</text>
      <g data-part="outbound">
        <rect class="box" x="230" y="34" width="150" height="88" rx="6"></rect>
        <text class="small mono" x="242" y="82">Answered</text>
        <rect class="box" x="230" y="150" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="242" y="172">TimedOut</text>
        <rect class="box" x="230" y="214" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="242" y="236">Unreachable</text>
      </g>
      <g data-part="core">
        <rect class="box" x="410" y="34" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="422" y="56">Success</text>
        <rect class="box" x="410" y="92" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="422" y="114">HttpError</text>
        <rect class="box" x="410" y="150" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="422" y="172">TimedOut(10 s)</text>
        <rect class="box" x="410" y="214" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="422" y="236">Unreachable</text>
        <rect class="box" x="410" y="278" width="150" height="34" rx="6"></rect>
        <text class="small mono" x="422" y="300">InvalidUrl</text>
      </g>
      <g data-part="inbound">
        <text class="small" x="590" y="56">GET · 200 · success</text>
        <text class="small" x="590" y="114">GET · HTTP error 404</text>
        <text class="small" x="590" y="172">no answer within 10 s</text>
        <text class="small" x="590" y="236">couldn't reach the server</text>
        <text class="small" x="590" y="296">Enter a URL that starts</text>
        <text class="small" x="590" y="312">with http:// or https://</text>
      </g>
      <path class="edge" d="M200,50 L228,60" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M200,108 L228,96" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M200,166 L228,166" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M200,232 L228,231" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M380,64 L408,52" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M380,92 L408,108" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M380,167 L408,167" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M380,231 L408,231" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge dashed" d="M200,292 L408,295" marker-end="url(#le1-out-arrow)"></path>
      <text class="small muted" x="240" y="286">không bao giờ được gửi</text>
      <path class="edge" d="M560,51 L586,51" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M560,109 L586,109" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M560,167 L586,167" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M560,231 L586,231" marker-end="url(#le1-out-arrow)"></path>
      <path class="edge" d="M560,295 L586,295" marker-end="url(#le1-out-arrow)"></path>
    </svg>
    <figcaption>Ba kết quả ở adapter, năm ở service, mỗi cái một dòng trên màn hình. Exception của Ktor và của engine dừng ở adapter; chỉ việc huỷ là đi qua.</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbe.kt" hl_lines="3 4 11 13 15"
    private suspend fun probe(send: suspend () -> HttpResponse): ProbeResult = try {
        val response = send()
        ProbeResult.Answered(response.status.value, readBody(response))
    } catch (e: HttpRequestTimeoutException) { // the whole request took too long; like the next
        // two, it's an IOException too, so the timeouts come before the IOException below
        ProbeResult.TimedOut
    } catch (e: ConnectTimeoutException) { // no connection in time
        ProbeResult.TimedOut
    } catch (e: SocketTimeoutException) { // the server went quiet mid-answer
        ProbeResult.TimedOut
    } catch (e: IOException) { // everything else the network does: no host, refused, offline
        ProbeResult.Unreachable(e.message ?: e.toString())
    } catch (e: CancellationException) { // the screen went away: let the coroutine end
        throw e
    } catch (e: Exception) { // a URL the service let through, but Ktor or the engine refuses
        ProbeResult.Unreachable(e.message ?: e.toString())
    }
```

1. **Ở đây một status không bao giờ là exception.** Client của Ktor "không kiểm tra response dựa trên HTTP status code" trừ khi bạn đặt `expectSuccess = true`, thứ sẽ ném `ClientRequestException` cho 4xx và `ServerResponseException` cho 5xx. Adapter để nó tắt: đánh giá một status là quy tắc của service (mục 2), và một 404 nên tới đó dưới dạng một câu trả lời.
2. **Ba timeout, một kết quả.** Ktor có request timeout (cả lời gọi), connect timeout và socket timeout ("thời gian không hoạt động tối đa giữa hai gói dữ liệu"), mỗi cái có exception riêng. Với màn hình, cả ba đều nghĩa là "không trả lời kịp". Không phải engine nào cũng có đủ ba: bảng của Ktor nói Darwin hỗ trợ request timeout và socket timeout nhưng không có connect timeout. Đó là một lý do adapter đặt request timeout, thứ mọi engine chúng ta dùng đều tôn trọng.
3. **Thứ tự các `catch` quan trọng.** Cả ba exception timeout cũng là `IOException`, trên Android và trên iOS. Kotlin thử các mệnh đề `catch` từ trên xuống, nên nếu `IOException` đứng đầu, một lần timeout sẽ hiện thành "couldn't reach the server".
4. **`IOException` là nơi hứng mọi lỗi mạng.** Nó là `kotlinx.io.IOException`, mà trên Android chính là `java.io.IOException`. "Unable to resolve host" của OkHttp và lỗi `NSURLErrorDomain` của Darwin đều tới dưới dạng nó (mục 10 cho thấy mỗi cái nói gì).
5. **Một URL có thể hỏng trước khi gửi gì, và không phải bằng `IOException`.** "https://example.com:99999/" qua được kiểm tra của service, và parser của chính Ktor ném `URLParserException`, "Fail to parse url". Các engine còn khắt khe hơn, mỗi cái theo cách riêng: với "https://[::1/" OkHttp ném `IllegalArgumentException` ("Invalid URL host"), còn Darwin ném `IllegalStateException` ("Invalid url") với "https://a&lt;b.com/" và thậm chí một `NullPointerException` với "https://[::1/". Không cái nào là lỗi mạng, nhưng mỗi cái thoát khỏi một `catch` cho `IOException`, và một exception thoát khỏi adapter sẽ đi lên qua coroutine của ViewModel: adapter đầu tiên của chúng tôi chỉ bắt lỗi IO và lỗi parser, và một GET với "https://[::1/" làm crash app trên emulator Android. Nên mệnh đề cuối bắt mọi `Exception` khác, và màn hình nói "couldn't reach the server" kèm thông báo của exception.
6. **Trừ việc huỷ, thứ cố tình được cho đi qua.** Rời màn hình thì huỷ request bằng một `CancellationException`, thứ phải tới được bộ máy coroutine (bài 08). Nó cũng là một `Exception`, nên mệnh đề ngay trước mệnh đề bắt-tất-cả ném lại nó; thiếu điều đó, mệnh đề bắt-tất-cả sẽ biến một request bị huỷ thành `Unreachable` và coroutine bị huỷ sẽ chạy tiếp. Hướng dẫn [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) của Kotlin: "Nếu phải bắt nó, hãy ném lại nó". Quy tắc của bài 08, chỉ bắt thứ bạn xử lý được, vẫn đúng: ở đây adapter xử lý được mọi lỗi, vì mỗi cái thành một kết quả.

## 6. Koin và ViewModel

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="4 5 7"
⋯ in appModule, after the monitor
    // The API test screen (Extension E1). Its adapter is shared code, so it's bound here and
    // not passed in by the platforms; only the engine inside it is each platform's own.
    single<ApiTesting> { ApiTestingService(get()) }
    single<EndpointProbe> { KtorEndpointProbe(httpEngine()) }
⋯ the three ViewModels, then:
    viewModelOf(::ApiTestViewModel)
```

Platform module và chín tham số của `initKoin` không đổi: một adapter viết bằng Kotlin trong `commonMain` không cần gì từ phần khởi động app, như `SessionConnectionStatus` của bài 17. Thay probe bằng một cái khác vẫn là một dòng.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/ApiTestViewModel.kt" hl_lines="8 9 17 20"
    fun get(url: String) = send("GET") { api.get(url) }

    fun post(url: String) = send("POST") { api.post(url) }

    // Leaving the screen clears the ViewModel, which cancels viewModelScope, and with it the
    // request on its way.
    private fun send(method: String, call: suspend () -> ApiTestResult) {
        request?.cancel() // the newest request wins
        _uiState.value = ApiTestUiState(sending = true) // the last answer goes: it was for another request
        request = viewModelScope.launch {
            _uiState.value = shown(method, call())
        }
    }

    private fun shown(method: String, result: ApiTestResult): ApiTestUiState = when (result) {
        is ApiTestResult.Success ->
            ApiTestUiState(outcome = "$method · ${result.status} · success", detail = shortened(result.body))
⋯ HttpError: "· HTTP error 404" and the body; TimedOut: "· no answer within 10 s"
        is ApiTestResult.Unreachable ->
            ApiTestUiState(outcome = "$method · couldn't reach the server", failed = true, detail = result.reason)
⋯ InvalidUrl: "Enter a URL that starts with http:// or https://"
    }
```

1. **Câu chữ là của ViewModel.** Service nói chuyện gì đã xảy ra, dưới dạng kiểu; inbound adapter nói nó với một con người, như `StatusText` của bài 20. Một màn hình thứ hai có thể diễn đạt cùng kết quả khác đi mà không đụng tới core.
2. **Request mới nhất thắng.** GET và POST bị tắt khi đang có một request trên đường, nhưng ViewModel không dựa vào màn hình: nó huỷ request trước, nên một câu trả lời cũ không bao giờ tới sau một câu trả lời mới hơn (cùng quy tắc với các lần đọc log của monitor ở bài 20).
3. **Huỷ một request không tốn gì.** `viewModelScope` bị huỷ khi ViewModel bị clear (bài 08), và các lời gọi của Ktor là hàm suspend dừng lại khi coroutine của chúng bị huỷ. Rời màn hình giữa lúc chờ 10 giây và request kết thúc cùng nó. Các lần chạy của chúng tôi làm đúng như vậy trên cả bốn track, không crash và không cập nhật muộn.
4. **Một body dài được rút ngắn** còn 4.000 ký tự đầu, kèm "… and N more characters": một trang web có thể nặng nhiều megabyte, và một text view không phải trình duyệt. Ô URL bắt đầu bằng `SUGGESTED_URL`, `https://httpbin.org/anything`, một dịch vụ phản hồi lại, trả lời GET và POST bằng JSON mô tả request nó nhận được.

## 7. Màn hình

Mỗi track một màn hình, tất cả hiện cùng một `ApiTestUiState`: ô URL (chữ của nó là của riêng màn hình, như bộ lọc trên màn hình chính), GET và POST, một vòng quay khi đang gửi, dòng kết quả (đỏ khi `failed`) và phần chi tiết bằng font đơn cách. Một nút "API test" trên đầu màn hình chính mở nó.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/ApiTestScreen.kt" hl_lines="6 13 21"
    @Composable
    fun ApiTestScreen(
        onBack: () -> Unit,
        viewModel: ApiTestViewModel = koinViewModel(),
    ) {
        var url by rememberSaveable { mutableStateOf(ApiTestViewModel.SUGGESTED_URL) }
        val state by viewModel.uiState.collectAsStateWithLifecycle()

        ApiTestContent(
            url = url,
            onUrlChange = { url = it },
            state = state,
            onGet = { viewModel.get(url) },
            onPost = { viewModel.post(url) },
            onBack = onBack,
        )
    }
    ⋯ ApiTestContent: in a scrolling Column, the title, then:
            OutlinedTextField(
    ⋯ value, onValueChange, label "URL", singleLine
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, autoCorrectEnabled = false),
                modifier = Modifier.fillMaxWidth(),
            )
    ⋯ GET and POST (enabled = !state.sending), the spinner, the outcome, the detail, Back
    ```

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApp.kt" hl_lines="2 4 7"
    @Serializable
    data object ApiTest
    ⋯ in the NavHost: composable<DeviceList> passes DeviceListScreen
                        onApiTest = { navController.navigate(ApiTest) },
    ⋯ composable<DeviceDetail> as in m15, then:
                composable<ApiTest> {
                    ApiTestScreen(onBack = { navController.popBackStack() })
                }
    ```

    Một route type-safe mới không mang gì, dưới dạng một `data object` (bài 07). `DeviceListScreen` và `DeviceListContent` không state của nó mỗi cái có thêm tham số `onApiTest`, và tiêu đề thành một `Row` gồm tiêu đề và một `TextButton("API test")`, bọc trong `dropUnlessResumed` như nút Back của màn hình thiết bị, để bấm đúp chỉ điều hướng một lần.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/ApiTestFragment.kt" hl_lines="1 7 8 14"
        private val viewModel: ApiTestViewModel by viewModel()
    ⋯ binding
        override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
            val b = FragmentApiTestBinding.inflate(inflater, container, false)
            binding = b
            // The first time only: after a rotation, the EditText restores what the user typed.
            if (savedInstanceState == null) b.urlInput.setText(ApiTestViewModel.SUGGESTED_URL)
            b.getButton.setOnClickListener { viewModel.get(b.urlInput.text.toString()) }
            b.postButton.setOnClickListener { viewModel.post(b.urlInput.text.toString()) }
    ⋯ backButton pops only from apiTest; onViewCreated collects uiState in repeatOnLifecycle(STARTED)
        }
    ⋯ render(state):
            b.getButton.isEnabled = !state.sending
            b.sendingRow.visibility = if (state.sending) View.VISIBLE else View.GONE
            b.outcomeText.text = state.outcome.orEmpty()
            b.outcomeText.setTextColor(if (state.failed) Color.RED else Color.DKGRAY)
            b.detailText.text = state.detail
    ```

    Layout, `fragment_api_test.xml`, là một `ScrollView` bọc một `LinearLayout` dọc: tiêu đề, một `EditText` với `android:inputType="textUri"`, hai nút, hàng đang gửi (ẩn tới khi cần), kết quả và một phần chi tiết đơn cách, chọn được. `nav_graph.xml` có thêm destination `apiTest` và một action `toApiTest` từ danh sách; `fragment_device_list.xml` có thêm một `apiTestButton` ở cuối tiêu đề, và `DeviceListFragment` chỉ điều hướng khi danh sách đang là destination hiện tại, như với màn hình thiết bị.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/ApiTestView.swift" hl_lines="3 12 20 22"
    struct ApiTestView: View {
        @State private var owner = ViewModelOwner()
        @State private var url = ApiTestViewModel.companion.SUGGESTED_URL
        @State private var state: ApiTestUiState?

        var body: some View {
            let viewModel: ApiTestViewModel = owner.viewModel()
            let state = self.state ?? viewModel.uiState.value
            ApiTestContent(
                url: $url,
                state: state,
                onGet: { viewModel.get(url: url) },
                onPost: { viewModel.post(url: url) }
            )
            .navigationTitle("API test")
    ⋯ .task { for await newState in viewModel.uiState { self.state = newState } }
        }
    }
    ⋯ ApiTestContent: in a ScrollView, the TextField with
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
    ```

    ```swift title="iosApp/iosApp/ContentView.swift" hl_lines="5"
                DeviceListView()
    ⋯ .navigationDestination(for: DeviceRoute.self) as in m15
                    // The API test screen (Extension E1), one tap from the main screen.
                    .toolbar {
                        NavigationLink("API test") { ApiTestView() }
                    }
    ```

    Một `const val` Kotlin trong companion object tới Swift thành `ApiTestViewModel.companion.SUGGESTED_URL`. Link trên toolbar của màn hình chính dựng destination trong một closure; các hàng thiết bị giữ link dựa trên giá trị của chúng. Pop màn hình thì kết thúc owner `@State` của view, việc đó clear ViewModel và huỷ request đang đi.

=== "UIKit"

    ```swift title="iosApp/iosApp/ApiTestViewController.swift" hl_lines="2 4 7 11 18"
        private let owner = ViewModelOwner()
        private lazy var viewModel: ApiTestViewModel = owner.viewModel()
    ⋯ the views; in viewDidLoad:
            urlField.text = ApiTestViewModel.companion.SUGGESTED_URL
            urlField.keyboardType = .URL
            urlField.autocapitalizationType = .none
            urlField.autocorrectionType = .no
            getButton.configuration?.title = "GET"
            getButton.addAction(UIAction { [weak self] _ in
                guard let self else { return }
                viewModel.get(url: urlField.text ?? "")
            }, for: .touchUpInside)
    ⋯ POST the same; a vertical stack in a scroll view; render(viewModel.uiState.value)
        // The one place that touches views: every new state ends here. It never sets the URL text.
        private func render(_ state: ApiTestUiState) {
            getButton.isEnabled = !state.sending
            postButton.isEnabled = !state.sending
            sendingRow.isHidden = !state.sending
    ⋯ the outcome in .systemRed when failed, the detail
        }
    ```

    `viewWillAppear` và `viewDidDisappear` bắt đầu và huỷ task quan sát, như trên màn hình thiết bị. `DeviceListViewController.viewDidLoad` có thêm một `rightBarButtonItem` tên "API test" push một `ApiTestViewController`; pop nó thì giải phóng controller và owner của nó, việc đó clear ViewModel.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Cùng ViewModel và cùng các state. Compose giữ URL trong `rememberSaveable` và truyền nó vào; `EditText` của XML tự giữ chữ của nó, nên Fragment chỉ đặt URL gợi ý ở lần tạo đầu tiên và đọc ô khi một nút được bấm. Compose có một route mới trong `NavHost`; XML có một destination và một action trong graph.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    SwiftUI bind ô với `@State` và đặt link trên toolbar của màn hình chính; UIKit đọc `urlField.text` khi bấm và thêm một bar button item push controller. Cả hai tắt tự sửa chính tả, và cả hai kết thúc request khi màn hình đi, qua owner của chúng.

## 8. Các quy tắc riêng của nền tảng

Code dùng chung giống nhau trên cả hai nền tảng; thứ mỗi nền tảng cho app gửi thì không.

1. **`http://` trơn bị chặn trên cả hai, mặc định.** Trên Android, "từ Android 9 (API 28), hỗ trợ cleartext mặc định bị tắt": GET của chúng tôi tới `http://httpbin.org/get` quay về thành "couldn't reach the server" kèm "CLEARTEXT communication to httpbin.org not permitted by network security policy" của OkHttp. Trên iOS, App Transport Security đòi app "dùng URL bảo mật, như URL bắt đầu bằng https", và "nếu không, ATS từ chối kết nối": Darwin báo `NSURLErrorDomain Code=-1022`, "the App Transport Security policy requires the use of a secure connection". Cả hai tới dưới dạng một `IOException`, nên màn hình hiện chúng như hiện bất kỳ server nào không với tới được. Mỗi nền tảng cho phép bật cleartext cho các domain được nêu tên (một network security config, các ngoại lệ ATS trong `Info.plist`); màn hình API không làm vậy, và một app thật hiếm khi nên làm.
2. **Quyền `INTERNET`.** App Android cần nó để mở socket; nó là quyền cấp lúc cài, không hộp thoại. Trong bản build này, manifest thư viện của chính OkHttp khai báo nó, và manifest merger thêm nó vào app (manifest đã gộp ghi "ADDED from [com.squareup.okhttp3:okhttp-android:5.5.0]"), nên app chạy được cả trước khi chúng tôi thêm dòng đó. App vẫn khai báo nó: thứ một app dùng thuộc về manifest của chính nó, không thuộc về engine nào mà nó tình cờ phụ thuộc hôm nay. iOS không có quyền như vậy cho HTTPS.
3. **Một bàn phím làm cho URL.** `KeyboardType.Uri`, `textUri` và `.URL` đặt `/` và `.` lên trang chữ cái (Gboard của emulator hiện cả hai cạnh phím cách; bàn phím `.URL` của Apple còn có ".com"), và các ô iOS tắt tự viết hoa, để "https" không thành "Https".

!!! warning "Gotcha · tự sửa chính tả trong ô URL"
    Tự sửa chính tả làm việc trên từ ngữ, mà URL không phải từ ngữ: một bàn phím "sửa" một host hay một path là đổi request, và một kiểm tra như kiểm tra cleartext ở trên có thể pass vì lý do sai. Compose để việc tự sửa cho bàn phím trừ khi bạn nói khác (`autoCorrectEnabled` mặc định là `null`, "áp dụng cấu hình mặc định của bàn phím ảo", và điều đó áp cho `KeyboardType.Uri`), nên ô đặt `autoCorrectEnabled = false`. Trên emulator của chúng tôi, gõ qua adb giữ nguyên `http://httpbin.org/get` có hay không có dòng đó, trong khi Gboard vẫn gợi ý từ khi thiếu nó; kiểm tra 7 của brief cho agent vẫn đọc ô trước khi tin kết quả cleartext. Input type `textUri` của XML không có cờ tự sửa (`textAutoCorrect` là một cờ riêng, và "không có cờ này, IME sẽ không cố sửa lỗi gõ"), và các track iOS dùng `.autocorrectionDisabled()` và `.autocorrectionType = .no`.

!!! warning "Gotcha · câu chữ riêng của nền tảng"
    `Unreachable(reason)` mang thông báo của exception, và hai engine diễn đạt rất khác nhau. OkHttp trên emulator: "Unable to resolve host "no-such-host.invalid": No address associated with hostname". Darwin trên Simulator: "Exception in http request: Error Domain=NSURLErrorDomain Code=-1003 "A server with the specified hostname could not be found." UserInfo={…}", dài vài dòng. Với một màn hình test, người dùng là lập trình viên, điều đó ổn. Một tính năng thật sẽ gọi tên các lỗi của nó theo cách nói của app (offline, không tìm thấy host, bị từ chối) và diễn đạt chúng trong ViewModel của nó, như `ProbeResult` đã làm cho timeout.

## 9. Test

122 test mỗi nền tảng, tăng từ 105. Không cái nào cần mạng: test của service dùng một port giả, và test của adapter dùng `MockEngine` của Ktor.

| Class | Test | Nó cho thấy gì |
|---|---|---|
| `ApiTestingServiceTest` | 6 (mới) | một GET xin JSON trong giới hạn 10 s, kèm tham số của nó; một POST gửi lời chào đóng dấu bằng đồng hồ; 2xx là thành công còn 404 hay 500 là lỗi HTTP; một lần timeout mang theo giới hạn; không có mạng là một kết quả; chuỗi không phải URL web không bao giờ được gửi, và URL được cắt khoảng trắng |
| `KtorEndpointProbeTest` | 7 (mới) | tham số được mã hoá vào query và header được gửi (Accept một lần); body JSON và content type của một POST; một câu trả lời JSON được thụt lề; HTML và JSON giả tới đúng như chúng là; một 404 là một câu trả lời; một server chậm là `TimedOut`; một `IOException`, và một URL engine từ chối, là `Unreachable` |
| `ApiTestViewModelTest` | 4 (mới) | đang gửi, rồi câu chữ của câu trả lời; mọi lỗi được diễn đạt thành lỗi; một body dài được rút ngắn; request mới nhất thắng |
| `AppModuleTest` | 3 | `buildsEveryViewModel` cũng dựng `ApiTestViewModel`, với adapter Ktor thật trên engine của nền tảng |

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbeTest.kt" hl_lines="4 9 13 20"
    private var sent: HttpRequestData? = null

    private fun probe(answer: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        KtorEndpointProbe(MockEngine { request -> sent = request; answer(request) })
⋯
    @Test
    fun aServerSlowerThanTheLimitIsATimeout() = runTest {
        val probe = probe {
            delay(5.seconds)
            respond("{}", HttpStatusCode.OK, json)
        }

        val result = probe.get("https://example.com/slow", emptyMap(), emptyMap(), 100.milliseconds)

        assertEquals(ProbeResult.TimedOut, result)
    }

    @Test
    fun aNetworkErrorIsUnreachable() = runTest {
        val probe = probe { throw IOException("Unable to resolve host \"example.invalid\"") }
⋯ get, then: Unreachable, with that message; then the same for an IllegalArgumentException, as OkHttp throws for a host like "[::1"
```

1. **Một `MockEngine` là một engine giả, không phải một adapter giả.** Code thật của adapter chạy: ContentNegotiation serialize POST, `HttpTimeout` tính giờ request, `parameter()` mã hoá query. Chỉ mạng bị thay. Handler thấy request mà adapter dựng (`sent`), và trả lời bằng `respond(content, status, headers)`, hoặc ném lỗi như một mạng bị hỏng.
2. **Test timeout chạy trong thời gian thật.** `runTest` chỉ bỏ qua các `delay` trên test dispatcher của nó; timeout của Ktor và handler của mock chạy trên dispatcher riêng của chúng. Nên giới hạn là 100 ms, không phải 10 s: trên JVM test mất khoảng 0,1 s, và `delay` 5 giây không bao giờ xong.
3. **Test của service không biết gì về HTTP.** `FakeEndpointProbe` trả về bất cứ `ProbeResult` nào test đặt và ghi lại nó được hỏi gì: method, URL, tham số, header, message, giới hạn thời gian. Mỗi quy tắc của mục 2 là một test, không thấy bóng Ktor.

## 10. Thực tế xảy ra gì: các lần chạy đứng sau trang này

Chúng tôi build e1 trên cả bốn track (Kotlin 2.4.20, Ktor 3.6.0, Koin 4.2.2, Xcode 26.2). `allTests` pass 122 trên 122 trên JVM và 122 trên 122 trên iOS simulator, và không bản build nào in cảnh báo compiler từ code của chúng ta. Rồi mỗi track chạy cùng các request: Compose và XML trên emulator API 36, SwiftUI và UIKit trên Simulator iOS 26.2 (điều khiển bằng một XCUITest tạm). Những gì chúng tôi thấy giống nhau trên mọi track, trừ câu chữ của lý do:

| Request | Màn hình | Chi tiết |
|---|---|---|
| GET `https://httpbin.org/anything` | GET · 200 · success | phần phản hồi của httpbin, đã thụt lề: `"Accept": "application/json"`, `"method": "GET"` |
| POST, cùng URL | POST · 200 · success | `"json": { "sentAt": "…Z", "text": "Hello from the Native Device Monitor" }`, và `"Content-Type": "application/json"` |
| GET `https://httpbin.org/status/404` | GET · HTTP error 404 (đỏ) | không có: 404 của httpbin có body rỗng |
| GET `https://10.255.255.1/` (một địa chỉ không bao giờ trả lời) | "Sending…", rồi khoảng 10 s sau GET · no answer within 10 s | không có |
| GET `https://no-such-host.invalid/` | GET · couldn't reach the server | Android: "Unable to resolve host …". iOS: "Exception in http request: Error Domain=NSURLErrorDomain Code=-1003 …" |
| GET `http://httpbin.org/get` | GET · couldn't reach the server | Android: "CLEARTEXT communication to httpbin.org not permitted by network security policy". iOS: "… Code=-1022 … App Transport Security policy requires the use of a secure connection …" |
| GET `example.com` | Enter a URL that starts with http:// or https:// | không có; không gì được gửi |
| GET `https://[::1/` (qua kiểm tra của service; engine không đọc được host) | GET · couldn't reach the server | Android: "Invalid URL host: "[::1"". iOS: "kotlin.NullPointerException", lỗi riêng của engine Darwin |
| Android, bật chế độ máy bay, GET `https://httpbin.org/get` | GET · couldn't reach the server | "Unable to resolve host "httpbin.org": No address associated with hostname" |
| GET địa chỉ không bao giờ trả lời, rồi Back ngay | màn hình chính, không crash, không gì hiện ra sau đó | request kết thúc cùng ViewModel của nó |

Các hàng này giờ nằm trong `docs/checklists.md`: bốn hàng API (GET, POST, lỗi, hết giờ) thay cho "chỉ phần mở rộng E1", mỗi hàng "Seen on" emulator và Simulator. Cả hai đi ra mạng qua máy Mac, nên các lần chạy này không nói gì về Wi-Fi hay dữ liệu di động của chính điện thoại. Code và engine giống nhau trên điện thoại, nên chúng tôi chờ cùng các dòng đó ở đó; một kiểm tra trên thiết bị, trong brief cho agent, xác nhận điều đó. httpbin.org là một dịch vụ công khai: nếu nó sập, dịch vụ phản hồi HTTPS nào cũng dùng được.

**e1 là một điểm dừng tự nhiên** khi test pass trên cả hai nền tảng, `grep` tìm `io.ktor` chỉ thấy bốn file của adapter, và các hàng API của `docs/checklists.md` khớp với những gì bạn thấy trên các track của mình. Hãy commit nó, và gắn tag.

!!! question "Hỏi agent của bạn"
    Hỏi agent nó sẽ đặt code HTTP ở đâu cho một tính năng thật tải các bản ghi của monitor lên, đặt tên theo thứ app cần: tên và các method của port, service gọi nó, file của adapter, và test của nó sẽ thay cái gì bằng fake hay `MockEngine`. Đối chiếu câu trả lời với mục 1 và 3.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao app core có port <code>EndpointProbe</code> thay vì port <code>ApiClient</code> với <code>get</code> và <code>post</code>?</p>
<div class="opts">
<button class="opt">interface Kotlin không khai báo được các method HTTP chung chung</button>
<button class="opt" data-correct>outbound port được đặt tên theo thứ app cần; một tính năng thật sẽ có port riêng, như <code>LogUploader</code>, và HTTP ở yên trong một adapter</button>
<button class="opt">Ktor đã có một class tên <code>ApiClient</code></button>
</div>
<p class="feedback"></p>
<p class="why">ADR 0001: "<code>ApiClient</code> trong phần mở rộng E1 không còn là một port." Nhu cầu của màn hình test tình cờ là "thử một URL", nên port của nó nói về URL.</p>
</div>

<div class="quiz">
<p class="q">Server trả lời 404. <code>KtorEndpointProbe</code> trả về gì, và ai quyết định đó là lỗi?</p>
<div class="opts">
<button class="opt">nó ném <code>ClientRequestException</code>, và ViewModel bắt nó</button>
<button class="opt" data-correct><code>Answered(404, body)</code>; quy tắc của service biến mọi thứ ngoài 200–299 thành <code>HttpError</code></button>
<button class="opt"><code>Unreachable("404")</code>; adapter quyết định</button>
</div>
<p class="feedback"></p>
<p class="why">Với <code>expectSuccess</code> tắt (mặc định của Ktor), một status là một câu trả lời. Đánh giá nó là một quy tắc của app, nên nó sống trong service.</p>
</div>

<div class="quiz">
<p class="q">Vì sao ba mệnh đề <code>catch</code> timeout đứng trước <code>catch (e: IOException)</code>?</p>
<div class="opts">
<button class="opt">Kotlin bắt exception cụ thể nhất phải đứng trước, không thì code không compile</button>
<button class="opt" data-correct>các exception timeout cũng là <code>IOException</code>; mệnh đề khớp đầu tiên thắng, nên nếu không, một lần timeout sẽ hiện thành "couldn't reach the server"</button>
<button class="opt">timeout là một <code>CancellationException</code>, thứ <code>IOException</code> sẽ nuốt mất</button>
</div>
<p class="feedback"></p>
<p class="why">Các mệnh đề được thử từ trên xuống. Kotlin, khác Java, không từ chối một mệnh đề rộng hơn đặt trước một mệnh đề hẹp hơn; nó chỉ không bao giờ tới được mệnh đề hẹp hơn.</p>
</div>

<div class="quiz">
<p class="q">Người dùng bấm GET tới một server không bao giờ trả lời, rồi Back sau một giây. Request ra sao?</p>
<div class="opts">
<button class="opt">nó chạy tiếp 9 giây còn lại, rồi cập nhật một ViewModel không ai hiện</button>
<button class="opt" data-correct>nó bị huỷ: ViewModel bị clear, <code>viewModelScope</code> bị huỷ, và lời gọi Ktor đang treo kết thúc theo</button>
<button class="opt">adapter bắt việc huỷ và trả về <code>Unreachable</code></button>
</div>
<p class="feedback"></p>
<p class="why">Đó là lý do adapter ném lại một <code>CancellationException</code> trước mệnh đề cuối, <code>catch (e: Exception)</code>: việc huỷ phải đi qua, và chỉ lỗi thật mới thành <code>Unreachable</code>.</p>
</div>

<div class="quiz">
<p class="q">Trong <code>KtorEndpointProbeTest</code>, <code>MockEngine</code> thay cho cái gì?</p>
<div class="opts">
<button class="opt">cả adapter, như <code>FakeEndpointProbe</code></button>
<button class="opt">các plugin của Ktor, để test kiểm tra được request thô</button>
<button class="opt" data-correct>chỉ mạng: code của chính adapter và các plugin của Ktor chạy thật, và handler trả lời hoặc ném lỗi</button>
</div>
<p class="feedback"></p>
<p class="why"><code>FakeEndpointProbe</code> thay adapter cho test của service; <code>MockEngine</code> thay engine cho test của adapter. Mỗi test chỉ thay thứ nằm bên dưới thứ nó test.</p>
</div>

<div class="quiz">
<p class="q">Một GET tới <code>http://httpbin.org/get</code>, không cấu hình gì, trên Android 9+ và trên iOS. Màn hình hiện gì?</p>
<div class="opts">
<button class="opt">200 trên cả hai: code dùng chung giống nhau</button>
<button class="opt">crash trên iOS: ATS ném một exception Objective-C</button>
<button class="opt" data-correct>"couldn't reach the server" trên cả hai: network security policy của Android và App Transport Security của iOS chặn cleartext mặc định</button>
</div>
<p class="feedback"></p>
<p class="why">Mỗi engine báo việc bị chặn dưới dạng một <code>IOException</code>, nên adapter trả về <code>Unreachable</code> kèm lý do của nền tảng.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q"><code>httpEngine()</code> được khai báo bằng <code>expect</code> trong <code>commonMain</code>. Chuyện gì xảy ra nếu <code>iosMain</code> không có <code>actual</code> cho nó? (Bài 05)</p>
<div class="opts">
<button class="opt">app iOS compile và crash ở request đầu tiên</button>
<button class="opt" data-correct>phần compile iOS fail: mỗi <code>expect</code> cần một <code>actual</code> trong mỗi target compile <code>commonMain</code></button>
<button class="opt">Ktor rơi về một engine mặc định</button>
</div>
<p class="feedback"></p>
<p class="why">Compiler kiểm tra các cặp <code>expect</code>/<code>actual</code> theo từng target, đó là lý do chúng hợp với một lựa chọn theo nền tảng như engine.</p>
</div>

<div class="quiz">
<p class="q">Bạn quên <code>viewModelOf(::ApiTestViewModel)</code>. Test nào fail? (Bài 11)</p>
<div class="opts">
<button class="opt"><code>ApiTestViewModelTest</code>, thứ dựng ViewModel qua Koin</button>
<button class="opt" data-correct><code>AppModuleTest.buildsEveryViewModel</code>, thứ xin Koin mọi ViewModel</button>
<button class="opt">không cái nào: Koin dựng ViewModel bằng reflection</button>
</div>
<p class="feedback"></p>
<p class="why"><code>ApiTestViewModelTest</code> dựng ViewModel bằng tay trên <code>TestApiTesting</code>; chỉ test graph đi qua Koin.</p>
</div>

<div class="quiz">
<p class="q">Quy tắc "màn hình chờ nhiều nhất 10 giây" nằm ở đâu, và vì sao ở đó? (Bài 20)</p>
<div class="opts">
<button class="opt">trong khối <code>install(HttpTimeout)</code> của adapter: timeout là cài đặt HTTP</button>
<button class="opt">trong ViewModel, thứ hiện vòng quay</button>
<button class="opt" data-correct>trong <code>ApiTestingService.TIME_LIMIT</code>: đó là một quy tắc của app, như giới hạn thời gian quét đã dời vào <code>ScanningService</code>; adapter áp con số nó được truyền</button>
</div>
<p class="feedback"></p>
<p class="why">Mục "mọi quy tắc của app nằm trong một service" của checklist refactor. Port nhận giới hạn làm tham số nên adapter không giữ cái nào.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên project e1 của bạn)"
    1. **Đoán, rồi chạy.** Đổi `TIME_LIMIT` thành 3 giây và GET `https://httpbin.org/delay/5` (httpbin chờ 5 s trước khi trả lời). Ghi ra dòng của màn hình trước khi bấm; rồi kiểm tra. Giờ test nào fail, và vì sao đó là những test đúng ra phải fail?
    2. **Tham số trên màn hình.** `ApiTesting.get` đã nhận `params`, và màn hình chưa bao giờ truyền cái nào. Thêm một ô chữ thứ hai trên các track của bạn, "Query", nơi người dùng gõ các cặp `name=value` cách nhau bằng `&`; biến nó thành một map trong ViewModel và truyền vào `get`. GET `https://httpbin.org/anything` với `q=OBD II` và tìm tham số của bạn, đã mã hoá, trong `"url"` của phần phản hồi. Ghim việc tách chuỗi bằng một test ViewModel.
    3. **Thêm một kết cục.** Cho status 3xx thành kết quả riêng: thêm `Redirected(status)` vào `ApiTestResult` và một test service cho nó. Trước hết kiểm tra Ktor mặc định làm gì với `https://httpbin.org/redirect/1`: test của bạn có tới được service với một 302 không?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, đi qua các hàng API của `docs/checklists.md`, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/e1-api-client-with-ktor.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/e1-api-client-with-ktor.html" -o .course/lesson-e1.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lesson 20, which this extension builds on; skipped if it's already there:
  [ -f .course/lesson-20.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html" -o .course/lesson-20.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Extension E1 (API client with Ktor): build milestone e1 on top of m15: an API test screen (a
URL field, GET and POST, a spinner while sending, the outcome line and the answer's body or the
error) opened from an "API test" button on the main screen; ApiTestViewModel over a new inbound
port, ApiTesting, implemented by ApiTestingService (only http/https URLs are sent, every
request asks for JSON with a 10-second limit, 2xx is a success and any other status an HTTP
error); a new outbound port, EndpointProbe, implemented by KtorEndpointProbe in commonMain over
Ktor 3.6.0 (ContentNegotiation with kotlinx.serialization JSON, HttpTimeout, expectSuccess off),
with its engine from httpEngine(): OkHttp in androidMain, Darwin in iosMain; the INTERNET
permission; adapter tests over Ktor's MockEngine, service tests over FakeEndpointProbe,
ViewModel tests over TestApiTesting; and four API rows in docs/checklists.md.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m15 project in demo/ (Lesson 20). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks: shared/build.gradle.kts: replaced (adds the Ktor dependencies).
   Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/outbound/EndpointProbe.kt, core/ProbeResult.kt, core/ProbeMessage.kt,
       core/inbound/ApiTesting.kt, core/ApiTestResult.kt, core/ApiTestingService.kt,
       adapter/outbound/KtorEndpointProbe.kt, adapter/outbound/HttpEngine.kt,
       adapter/inbound/ApiTestUiState.kt, adapter/inbound/ApiTestViewModel.kt
     replaced: di/AppModule.kt
   add: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.android.kt
   add: shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.ios.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: doubles/FakeEndpointProbe.kt, doubles/TestApiTesting.kt, core/ApiTestingServiceTest.kt,
       adapter/outbound/KtorEndpointProbeTest.kt, adapter/inbound/ApiTestViewModelTest.kt
     replaced: di/AppModuleTest.kt
   docs/checklists.md: replaced.
   Every other file in shared/ and docs/ stays as in m15.

2. Android, both tracks: androidApp/src/main/AndroidManifest.xml: replaced with my track's
   (each adds only the INTERNET permission). androidApp/build.gradle.kts stays as in m15.
     Compose: under androidApp/src/main/java/com/example/devicemonitor/android/:
       DeviceMonitorApp.kt and DeviceListScreen.kt: replaced; add ApiTestScreen.kt.
     XML: androidApp/src/main/res/navigation/nav_graph.xml,
       androidApp/src/main/res/layout/fragment_device_list.xml and
       androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt: replaced;
       add androidApp/src/main/res/layout/fragment_api_test.xml and
       androidApp/src/main/java/com/example/devicemonitor/android/ApiTestFragment.kt.
   iOS: after adding the new Swift file, run `xcodegen generate` in iosApp/ so the Xcode project
   includes it. project.yml and Info.plist stay as in m15. Do NOT edit the .xcodeproj by hand.
     SwiftUI: iosApp/iosApp/ContentView.swift: replaced; add iosApp/iosApp/ApiTestView.swift.
     UIKit: iosApp/iosApp/DeviceListViewController.swift: replaced; add
       iosApp/iosApp/ApiTestViewController.swift.
   Every other Android and iOS file stays as in m15.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+), with network access:
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
  the task lines), and all 122 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 10 in MonitoringServiceTest, 9 in
  ScanningServiceTest, 8 in ValueDecoderTest, 7 in KtorEndpointProbeTest, 6 in
  MonitorViewModelTest, 6 in ApiTestingServiceTest, 5 in StatusServiceTest, 4 in
  ApiTestViewModelTest, 4 in JsonLinesTest, 4 in PermissionServiceTest, 3 in DeviceServiceTest,
  3 in AppModuleTest, 1 in SessionConnectionStatusTest, and 5 in AndroidLogStoreTest (JVM
  results) or 5 in IosLogStoreTest (iOS results). Show the counts from the XML files in
  shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- Placement, each from demo/:
    grep -rln 'import io.ktor' shared/src/*Main androidApp/src iosApp/iosApp
  lists exactly KtorEndpointProbe.kt, HttpEngine.kt, HttpEngine.android.kt and HttpEngine.ios.kt;
    grep -rn 'import android\.\|import platform\.\|import org.koin\|import io.ktor\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core
    grep -n 'core.outbound\|adapter.outbound\|import io.ktor' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/*.kt
  each find nothing; and grep -n 'core.inbound' shared/src/commonMain/kotlin/com/example/devicemonitor/core/*Service.kt
  prints exactly six lines, each service importing only its own port.
- Android emulator (API 31+), my track. Find text with `adb shell uiautomator dump`, and take a
  screenshot (adb exec-out screencap -p) where a long body may be missing from the dump. To
  type a URL: tap the field, `adb shell input keyevent KEYCODE_MOVE_END`, delete with
  KEYCODE_DEL (67) as many times as there are characters, `adb shell input text '<url>'`.
  The XML buttons show their text in capitals, so match case-insensitively.
  1. The main screen shows an "API test" button next to the title. Tap it: the API test screen,
     its URL field reading https://httpbin.org/anything, GET and POST.
  2. Tap GET: within a few seconds "GET · 200 · success" and indented JSON with
     "Accept": "application/json" and "method": "GET".
  3. Tap POST: "POST · 200 · success"; the echo's "json" holds "text": "Hello from the Native
     Device Monitor" and a "sentAt" ending in Z.
  4. GET https://httpbin.org/status/404: "GET · HTTP error 404", in red.
  5. GET https://10.255.255.1/: "Sending…" with GET and POST disabled, then about 10 s later
     "GET · no answer within 10 s". (In the Compose track's uiautomator dump the GET and POST
     label text always reads enabled="true"; the disabled flag is on the clickable
     android.view.View around each, so read that node's enabled attribute, or look at a
     screenshot: both buttons are greyed.)
  6. GET https://no-such-host.invalid/: "GET · couldn't reach the server" and "Unable to resolve
     host "no-such-host.invalid"…".
  7. Type http://httpbin.org/get and check the field still says http:// (not https://), then GET:
     "GET · couldn't reach the server" and "CLEARTEXT communication to httpbin.org not permitted
     by network security policy".
  8. GET example.com: "Enter a URL that starts with http:// or https://".
  9. adb shell cmd connectivity airplane-mode enable; GET https://httpbin.org/get: "GET ·
     couldn't reach the server" and "Unable to resolve host "httpbin.org"…"; then
     adb shell cmd connectivity airplane-mode disable.
  10. GET https://10.255.255.1/, then Back within a second (tap the screen's own Back button;
     with the keyboard open the system Back key only closes the keyboard first): the main screen; wait 12 s:
     adb shell pidof com.example.devicemonitor still prints a pid and adb logcat -d shows no
     FATAL EXCEPTION.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  1. Tap "API test" in the navigation bar: the field reads https://httpbin.org/anything.
  2. Repeat Android checks 2–8 (clearing the field before each URL). Expect the same lines, but
     check 6's detail starts "Exception in http request: Error Domain=NSURLErrorDomain
     Code=-1003", and check 7's says "Code=-1022" and "App Transport Security".
  3. GET https://10.255.255.1/, then the back button within a second: the main screen; 12 s
     later the app is still running in the foreground.
- Device check (record it, don't run it): the four API rows on a physical Android phone and an
  iPhone, on Wi-Fi and on mobile data; expected the same lines as on the emulator and the
  Simulator.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me the placement greps' output.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Appendix A.5](https://phongna-inn.github.io/carmd-kmp-course/COURSE_PLAN.md) của kế hoạch khoá học (yêu cầu cho API client) và hệ quả của ADR 0001 cho E1 ("`ApiClient` … không còn là một port").
- Ktor: [Client engines](https://ktor.io/docs/client-engines.html) (nguồn chính: engine theo nền tảng, Darwin dựa trên `NSURLSession`, `ktor-client-engine-defaults`), [Content negotiation and serialization](https://ktor.io/docs/client-serialization.html) (`install(ContentNegotiation) { json() }`, `setBody`, `body()`), [Timeout](https://ktor.io/docs/client-timeout.html) (ba loại timeout, `timeout { }` cho từng request, bảng engine với việc Darwin thiếu connect timeout), [Response validation](https://ktor.io/docs/client-response-validation.html) (không kiểm tra status trừ khi `expectSuccess`) và [Testing](https://ktor.io/docs/client-testing.html) (`MockEngine`, và truyền engine vào class của client).
- Android: [Network security configuration](https://developer.android.com/privacy-and-security/security-config) (nguồn chính: cleartext "mặc định bị tắt" từ Android 9, và cách cho phép nó với một domain) và [Manage manifest files](https://developer.android.com/build/manage-manifests) (manifest của một thư viện, ở đây là của OkHttp, gộp vào của app ra sao).
- Apple: [Preventing insecure network connections](https://developer.apple.com/documentation/security/preventing-insecure-network-connections) (nguồn chính: App Transport Security, "dùng URL bảo mật, như URL bắt đầu bằng https").
- Kotlin: [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) (vì sao một `CancellationException` bị bắt phải được ném lại, như `catch` cuối của adapter cần).
- kotlinx.serialization: [Serialization](https://kotlinlang.org/docs/serialization.html) và [JSON guide](https://github.com/Kotlin/kotlinx.serialization/blob/master/docs/json.md) (`JsonElement`, `prettyPrint`).
- [httpbin.org](https://httpbin.org/): dịch vụ phản hồi mà màn hình bắt đầu bằng (`/anything`, `/status/404`, `/delay/5`).
- [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): port, service và adapter nằm đâu, fake, và test graph của Koin.
- Kinh nghiệm thực tế: kênh #ktor của Kotlin Slack, cho câu hỏi về Ktor client; tag [ktor](https://stackoverflow.com/questions/tagged/ktor) của Stack Overflow.

## File đầy đủ

Mọi file phần mở rộng này thêm hoặc sửa, đầy đủ. `iosApp/iosApp.xcodeproj` được sinh lại bởi `xcodegen generate`; `project.yml`, `Info.plist`, cả hai file `androidApp/build.gradle.kts`, các build file gốc và cả hai phần khởi động app giữ như ở m15. File chỉ một track có nằm trong tab của track đó; khi hai track cùng sửa một file cùng đường dẫn, tiêu đề của nó ghi tên track.

**Dùng chung cho mọi track**

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
                // Extension E1: the HTTP client, its JSON plugin and its JSON format. Only the
                // KtorEndpointProbe adapter imports them.
                implementation("io.ktor:ktor-client-core:3.6.0")
                implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
                implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
            }
            androidMain.dependencies {
                implementation("androidx.activity:activity:1.13.0")
                implementation("androidx.work:work-runtime:2.12.0")
                // The HTTP engine on Android: OkHttp.
                implementation("io.ktor:ktor-client-okhttp:3.6.0")
            }
            iosMain.dependencies {
                // The HTTP engine on iOS: Darwin, over Apple's URLSession.
                implementation("io.ktor:ktor-client-darwin:3.6.0")
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
                // A fake HTTP engine: answers the adapter's requests without a network.
                implementation("io.ktor:ktor-client-mock:3.6.0")
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/EndpointProbe.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.ProbeMessage
    import com.example.devicemonitor.core.ProbeResult
    import kotlin.time.Duration

    // Outbound port: what the app needs to try an endpoint, in the app's terms: send one request and
    // report what came back, within a time limit. One shared adapter implements it, KtorEndpointProbe
    // in commonMain; nothing else in the app knows which HTTP library that is. A real feature would
    // get a port of its own, named for what it needs (for example a LogUploader), not this one.
    interface EndpointProbe {
        // GET url with the query parameters and headers. Never throws; every outcome is a ProbeResult.
        suspend fun get(
            url: String,
            params: Map<String, String>,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult

        // POST the message to url as JSON, with the headers. Never throws, like get.
        suspend fun post(
            url: String,
            message: ProbeMessage,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ProbeResult.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // What one request to an endpoint came back with, in the app's terms: no HTTP library's types.
    // The EndpointProbe adapters return it and never throw.
    sealed interface ProbeResult {
        // The server answered, with any status: 200, 404 and 500 are all answers. The body is text;
        // a JSON body comes indented, ready to show.
        data class Answered(val status: Int, val body: String) : ProbeResult

        // No full answer within the time limit.
        data object TimedOut : ProbeResult

        // No answer at all: no network, a host that doesn't exist, a refused or broken connection,
        // or a request the platform won't send. The reason is the platform's own words.
        data class Unreachable(val reason: String) : ProbeResult
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ProbeMessage.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.time.Instant

    // What a POST from the API test screen sends: a greeting, and when it was sent. The adapter
    // turns it into JSON; the app core doesn't know the format.
    data class ProbeMessage(val text: String, val sentAt: Instant)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/ApiTesting.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.ApiTestResult

    // Inbound port: what the app offers for trying an HTTP endpoint by hand. The API test screen's
    // ViewModel calls it, and ApiTestingService implements it. Neither call throws: every outcome,
    // a timeout or no network included, is an ApiTestResult.
    interface ApiTesting {
        // GET the URL, with these query parameters added to it.
        suspend fun get(url: String, params: Map<String, String> = emptyMap()): ApiTestResult

        // POST a small JSON message to the URL.
        suspend fun post(url: String): ApiTestResult
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ApiTestResult.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.time.Duration

    // What the API test screen shows for one request: the service's verdict on the probe's result.
    sealed interface ApiTestResult {
        // A 2xx status: the request worked.
        data class Success(val status: Int, val body: String) : ApiTestResult

        // The server answered with any other status: the request reached it, and it said no.
        data class HttpError(val status: Int, val body: String) : ApiTestResult

        // No answer within the service's time limit.
        data class TimedOut(val limit: Duration) : ApiTestResult

        // The request never got an answer: no network, an unknown host, a refused connection.
        data class Unreachable(val reason: String) : ApiTestResult

        // The text isn't an http:// or https:// URL, so nothing was sent.
        data class InvalidUrl(val url: String) : ApiTestResult
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/ApiTestingService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.ApiTesting
    import com.example.devicemonitor.core.outbound.EndpointProbe
    import kotlin.time.Clock
    import kotlin.time.Duration.Companion.seconds

    // Service: the API test screen's rules. Only http:// and https:// URLs are sent; every request
    // asks for JSON and gets the same time limit; a 2xx status is a success and any other an HTTP
    // error; and a timeout or a missing network becomes a result the screen can show.
    class ApiTestingService(
        private val probe: EndpointProbe,
        private val clock: Clock = Clock.System,
    ) : ApiTesting {
        override suspend fun get(url: String, params: Map<String, String>): ApiTestResult {
            val target = url.trim()
            if (!isWebUrl(target)) return ApiTestResult.InvalidUrl(target)
            return judge(probe.get(target, params, ASK_FOR_JSON, TIME_LIMIT))
        }

        override suspend fun post(url: String): ApiTestResult {
            val target = url.trim()
            if (!isWebUrl(target)) return ApiTestResult.InvalidUrl(target)
            val message = ProbeMessage(GREETING, clock.now())
            return judge(probe.post(target, message, ASK_FOR_JSON, TIME_LIMIT))
        }

        private fun judge(result: ProbeResult): ApiTestResult = when (result) {
            is ProbeResult.Answered ->
                if (result.status in 200..299) ApiTestResult.Success(result.status, result.body)
                else ApiTestResult.HttpError(result.status, result.body)
            ProbeResult.TimedOut -> ApiTestResult.TimedOut(TIME_LIMIT)
            is ProbeResult.Unreachable -> ApiTestResult.Unreachable(result.reason)
        }

        // "https://host…" or "http://host…", with a host and no spaces. The adapter checks the rest.
        private fun isWebUrl(url: String): Boolean {
            val rest = when {
                url.startsWith("https://", ignoreCase = true) -> url.substring(8)
                url.startsWith("http://", ignoreCase = true) -> url.substring(7)
                else -> return false
            }
            val host = rest.substringBefore('/').substringBefore('?').substringBefore('#')
            return host.isNotEmpty() && url.none { it.isWhitespace() }
        }

        companion object {
            // How long the screen waits for a whole answer before it says "no answer".
            val TIME_LIMIT = 10.seconds
            const val GREETING = "Hello from the Native Device Monitor"
            private val ASK_FOR_JSON = mapOf("Accept" to "application/json")
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbe.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ProbeMessage
    import com.example.devicemonitor.core.ProbeResult
    import com.example.devicemonitor.core.outbound.EndpointProbe
    import io.ktor.client.HttpClient
    import io.ktor.client.call.body
    import io.ktor.client.engine.HttpClientEngine
    import io.ktor.client.network.sockets.ConnectTimeoutException
    import io.ktor.client.network.sockets.SocketTimeoutException
    import io.ktor.client.plugins.HttpRequestTimeoutException
    import io.ktor.client.plugins.HttpTimeout
    import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
    import io.ktor.client.plugins.timeout
    import io.ktor.client.request.get
    import io.ktor.client.request.header
    import io.ktor.client.request.parameter
    import io.ktor.client.request.post
    import io.ktor.client.request.setBody
    import io.ktor.client.statement.HttpResponse
    import io.ktor.client.statement.bodyAsText
    import io.ktor.http.ContentType
    import io.ktor.http.contentType
    import io.ktor.serialization.ContentConvertException
    import io.ktor.serialization.kotlinx.json.json
    import kotlinx.io.IOException
    import kotlinx.serialization.Serializable
    import kotlinx.serialization.json.Json
    import kotlinx.serialization.json.JsonElement
    import kotlin.coroutines.cancellation.CancellationException
    import kotlin.time.Duration

    // Outbound adapter: the EndpointProbe port over Ktor, shared by both platforms. With its engine
    // function (HttpEngine.kt), the only code in the app that imports Ktor. The engine comes from
    // outside: the platform's (httpEngine()) in the app, a MockEngine in the tests.
    internal class KtorEndpointProbe(engine: HttpClientEngine) : EndpointProbe {
        private val client = HttpClient(engine) {
            // JSON both ways: setBody(@Serializable object) sends it, body<T>() reads it.
            install(ContentNegotiation) { json() }
            // Lets each request set its own time limit (timeout { … } below).
            install(HttpTimeout)
            // expectSuccess stays false, the default: a 404 or a 500 is an answer, not an exception.
        }

        override suspend fun get(
            url: String,
            params: Map<String, String>,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult = probe {
            client.get(url) {
                params.forEach { (name, value) -> parameter(name, value) } // encoded into the query
                headers.forEach { (name, value) -> header(name, value) }
                timeout { requestTimeoutMillis = timeLimit.inWholeMilliseconds }
            }
        }

        override suspend fun post(
            url: String,
            message: ProbeMessage,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult = probe {
            client.post(url) {
                headers.forEach { (name, value) -> header(name, value) }
                timeout { requestTimeoutMillis = timeLimit.inWholeMilliseconds }
                contentType(ContentType.Application.Json)
                setBody(MessageBody(message.text, message.sentAt.toString()))
            }
        }

        // Sends the request and turns everything that can happen into a ProbeResult. The one
        // exception that passes through is a CancellationException: the screen went away.
        private suspend fun probe(send: suspend () -> HttpResponse): ProbeResult = try {
            val response = send()
            ProbeResult.Answered(response.status.value, readBody(response))
        } catch (e: HttpRequestTimeoutException) { // the whole request took too long; like the next
            // two, it's an IOException too, so the timeouts come before the IOException below
            ProbeResult.TimedOut
        } catch (e: ConnectTimeoutException) { // no connection in time
            ProbeResult.TimedOut
        } catch (e: SocketTimeoutException) { // the server went quiet mid-answer
            ProbeResult.TimedOut
        } catch (e: IOException) { // everything else the network does: no host, refused, offline
            ProbeResult.Unreachable(e.message ?: e.toString())
        } catch (e: CancellationException) { // the screen went away: let the coroutine end
            throw e
        } catch (e: Exception) { // a URL the service let through, but Ktor or the engine refuses
            ProbeResult.Unreachable(e.message ?: e.toString())
        }

        // A JSON body, indented for the screen; any other body as it came. A body that says it's
        // JSON but isn't comes as it came, too.
        private suspend fun readBody(response: HttpResponse): String {
            val isJson = response.contentType()?.match(ContentType.Application.Json) == true
            if (!isJson) return response.bodyAsText()
            return try {
                indented.encodeToString(JsonElement.serializer(), response.body<JsonElement>())
            } catch (e: ContentConvertException) {
                response.bodyAsText()
            }
        }

        // The JSON a POST sends. It lives here, in the adapter, so ProbeMessage carries no JSON
        // annotations (as JsonLines does for the log).
        @Serializable
        private class MessageBody(val text: String, val sentAt: String)

        private companion object {
            val indented = Json { prettyPrint = true }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import io.ktor.client.engine.HttpClientEngine

    // The platform's HTTP engine for KtorEndpointProbe: OkHttp on Android, Darwin on iOS. Each
    // platform's source set has the actual function, and the engine library it needs.
    internal expect fun httpEngine(): HttpClientEngine
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.android.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import io.ktor.client.engine.HttpClientEngine
    import io.ktor.client.engine.okhttp.OkHttp

    // Android's HTTP engine: OkHttp.
    internal actual fun httpEngine(): HttpClientEngine = OkHttp.create()
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/HttpEngine.ios.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import io.ktor.client.engine.HttpClientEngine
    import io.ktor.client.engine.darwin.Darwin

    // iOS's HTTP engine: Darwin, which sends requests through Apple's URLSession.
    internal actual fun httpEngine(): HttpClientEngine = Darwin.create()
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/ApiTestUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    // Everything the API test screen shows. The URL field's text is the screen's own.
    data class ApiTestUiState(
        // A request is on its way: the screen shows a spinner and disables GET and POST.
        val sending: Boolean = false,
        // One line about the last request: "GET · 200 · success", "POST · HTTP error 404", …
        // null before the first one.
        val outcome: String? = null,
        // Whether that line is an error, shown in the error colour.
        val failed: Boolean = false,
        // The answer's body, or what went wrong in the platform's words. Empty if there's neither.
        val detail: String = "",
    )
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/ApiTestViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.ApiTestResult
    import com.example.devicemonitor.core.inbound.ApiTesting
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the API test screen's GET and POST into calls on the ApiTesting port,
    // and each result into words for the screen. It knows the port only: no HTTP, no Ktor.
    class ApiTestViewModel(private val api: ApiTesting) : ViewModel() {
        private val _uiState = MutableStateFlow(ApiTestUiState())
        val uiState: StateFlow<ApiTestUiState> = _uiState.asStateFlow()

        private var request: Job? = null

        fun get(url: String) = send("GET") { api.get(url) }

        fun post(url: String) = send("POST") { api.post(url) }

        // Leaving the screen clears the ViewModel, which cancels viewModelScope, and with it the
        // request on its way.
        private fun send(method: String, call: suspend () -> ApiTestResult) {
            request?.cancel() // the newest request wins
            _uiState.value = ApiTestUiState(sending = true) // the last answer goes: it was for another request
            request = viewModelScope.launch {
                _uiState.value = shown(method, call())
            }
        }

        private fun shown(method: String, result: ApiTestResult): ApiTestUiState = when (result) {
            is ApiTestResult.Success ->
                ApiTestUiState(outcome = "$method · ${result.status} · success", detail = shortened(result.body))
            is ApiTestResult.HttpError ->
                ApiTestUiState(outcome = "$method · HTTP error ${result.status}", failed = true, detail = shortened(result.body))
            is ApiTestResult.TimedOut ->
                ApiTestUiState(outcome = "$method · no answer within ${result.limit.inWholeSeconds} s", failed = true)
            is ApiTestResult.Unreachable ->
                ApiTestUiState(outcome = "$method · couldn't reach the server", failed = true, detail = result.reason)
            is ApiTestResult.InvalidUrl ->
                ApiTestUiState(outcome = "Enter a URL that starts with http:// or https://", failed = true)
        }

        // A web page can be megabytes long; the screen shows the start of it.
        private fun shortened(body: String): String =
            if (body.length <= SHOWN_CHARS) body
            else body.take(SHOWN_CHARS) + "\n… and ${body.length - SHOWN_CHARS} more characters"

        companion object {
            // What the URL field starts with: an echo service that answers GET and POST with JSON
            // describing the request it got, headers and body included.
            const val SUGGESTED_URL = "https://httpbin.org/anything"
            const val SHOWN_CHARS = 4000
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.ApiTestViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
    import com.example.devicemonitor.adapter.outbound.KtorEndpointProbe
    import com.example.devicemonitor.adapter.outbound.SessionConnectionStatus
    import com.example.devicemonitor.adapter.outbound.httpEngine
    import com.example.devicemonitor.core.ApiTestingService
    import com.example.devicemonitor.core.MonitoringService
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.SessionService
    import com.example.devicemonitor.core.StatusService
    import com.example.devicemonitor.core.inbound.ApiTesting
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
    import com.example.devicemonitor.core.outbound.EndpointProbe
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
        // The API test screen (Extension E1). Its adapter is shared code, so it's bound here and
        // not passed in by the platforms; only the engine inside it is each platform's own.
        single<ApiTesting> { ApiTestingService(get()) }
        single<EndpointProbe> { KtorEndpointProbe(httpEngine()) }
        viewModelOf(::DeviceListViewModel)
        viewModelOf(::DeviceDetailViewModel)
        viewModelOf(::MonitorViewModel)
        viewModelOf(::ApiTestViewModel)
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
            )
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeEndpointProbe.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.ProbeMessage
    import com.example.devicemonitor.core.ProbeResult
    import com.example.devicemonitor.core.outbound.EndpointProbe
    import kotlin.time.Duration

    // Fake: an outbound adapter written for tests, behind the EndpointProbe port. The test sets what
    // the next request comes back with, and reads what the service asked for. No network, no Ktor.
    class FakeEndpointProbe : EndpointProbe {
        var answer: ProbeResult = ProbeResult.Answered(200, "{}")

        // The last request: its method, URL, parameters, headers, message and time limit.
        var method: String? = null
        var url: String? = null
        var params: Map<String, String>? = null
        var headers: Map<String, String>? = null
        var message: ProbeMessage? = null
        var timeLimit: Duration? = null
        var requests = 0
            private set

        override suspend fun get(
            url: String,
            params: Map<String, String>,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult {
            record("GET", url, headers, timeLimit)
            this.params = params
            return answer
        }

        override suspend fun post(
            url: String,
            message: ProbeMessage,
            headers: Map<String, String>,
            timeLimit: Duration,
        ): ProbeResult {
            record("POST", url, headers, timeLimit)
            this.message = message
            return answer
        }

        private fun record(method: String, url: String, headers: Map<String, String>, timeLimit: Duration) {
            requests++
            this.method = method
            this.url = url
            this.headers = headers
            this.timeLimit = timeLimit
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestApiTesting.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.ApiTestResult
    import com.example.devicemonitor.core.inbound.ApiTesting
    import kotlinx.coroutines.CompletableDeferred

    // Test implementation of the ApiTesting inbound port, for ViewModel tests. Each request waits
    // until the test answers it, so the test can look at the screen while a request is on its way.
    class TestApiTesting : ApiTesting {
        private var pending = CompletableDeferred<ApiTestResult>()
        val urls = mutableListOf<String>()

        override suspend fun get(url: String, params: Map<String, String>): ApiTestResult {
            urls += "GET $url"
            return pending.await()
        }

        override suspend fun post(url: String): ApiTestResult {
            urls += "POST $url"
            return pending.await()
        }

        // Answers the request on its way; the next one waits for the next answer.
        fun answer(result: ApiTestResult) {
            pending.complete(result)
            pending = CompletableDeferred()
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/ApiTestingServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.ApiTesting
    import com.example.devicemonitor.doubles.FakeEndpointProbe
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.time.Clock
    import kotlin.time.Duration.Companion.seconds
    import kotlin.time.Instant

    class ApiTestingServiceTest {
        private val probe = FakeEndpointProbe()
        private val now = Instant.parse("2026-09-11T10:30:00Z")
        private val clock = object : Clock {
            override fun now() = this@ApiTestingServiceTest.now
        }
        private val api: ApiTesting = ApiTestingService(probe, clock)

        @Test
        fun aGetAsksForJsonWithinTheTimeLimit() = runTest {
            api.get("https://example.com/items", mapOf("q" to "obd"))

            assertEquals("GET", probe.method)
            assertEquals("https://example.com/items", probe.url)
            assertEquals(mapOf("q" to "obd"), probe.params)
            assertEquals(mapOf("Accept" to "application/json"), probe.headers)
            assertEquals(10.seconds, probe.timeLimit)
        }

        @Test
        fun aPostSendsTheGreetingStampedWithTheClock() = runTest {
            api.post("https://example.com/notes")

            assertEquals("POST", probe.method)
            assertEquals(ProbeMessage("Hello from the Native Device Monitor", now), probe.message)
            assertEquals(mapOf("Accept" to "application/json"), probe.headers)
        }

        @Test
        fun a2xxStatusIsASuccessAndAnyOtherAnHttpError() = runTest {
            probe.answer = ProbeResult.Answered(201, "{\"id\": 1}")
            assertEquals(ApiTestResult.Success(201, "{\"id\": 1}"), api.post("https://example.com/notes"))

            probe.answer = ProbeResult.Answered(404, "Not Found")
            assertEquals(ApiTestResult.HttpError(404, "Not Found"), api.get("https://example.com/nothing"))

            probe.answer = ProbeResult.Answered(500, "")
            assertEquals(ApiTestResult.HttpError(500, ""), api.get("https://example.com/broken"))
        }

        @Test
        fun aTimeoutSaysHowLongTheScreenWaited() = runTest {
            probe.answer = ProbeResult.TimedOut

            assertEquals(ApiTestResult.TimedOut(10.seconds), api.get("https://example.com/slow"))
        }

        @Test
        fun noNetworkIsAResultNotAnException() = runTest {
            probe.answer = ProbeResult.Unreachable("Unable to resolve host \"example.invalid\"")

            assertEquals(
                ApiTestResult.Unreachable("Unable to resolve host \"example.invalid\""),
                api.get("https://example.invalid/"),
            )
        }

        @Test
        fun onlyWebUrlsAreSent() = runTest {
            for (text in listOf("", "example.com", "ftp://example.com", "https://", "https:///path", "https://exa mple.com")) {
                assertEquals(ApiTestResult.InvalidUrl(text), api.get(text), "for \"$text\"")
            }
            assertEquals(0, probe.requests)

            api.get("  HTTPS://example.com/a?b=c  ")
            assertEquals("HTTPS://example.com/a?b=c", probe.url) // trimmed, and the scheme in any case
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/outbound/KtorEndpointProbeTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import com.example.devicemonitor.core.ProbeMessage
    import com.example.devicemonitor.core.ProbeResult
    import io.ktor.client.engine.mock.MockEngine
    import io.ktor.client.engine.mock.MockRequestHandleScope
    import io.ktor.client.engine.mock.respond
    import io.ktor.client.engine.mock.toByteArray
    import io.ktor.client.request.HttpRequestData
    import io.ktor.client.request.HttpResponseData
    import io.ktor.http.HttpHeaders
    import io.ktor.http.HttpMethod
    import io.ktor.http.HttpStatusCode
    import io.ktor.http.headersOf
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.test.runTest
    import kotlinx.io.IOException
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.milliseconds
    import kotlin.time.Duration.Companion.seconds
    import kotlin.time.Instant

    // The adapter against a MockEngine: Ktor runs for real, its plugins included, and the engine
    // answers without a network. Each test checks the request the adapter built, or what it made
    // of an answer.
    class KtorEndpointProbeTest {
        private val json = headersOf(HttpHeaders.ContentType, "application/json")
        private var sent: HttpRequestData? = null

        private fun probe(answer: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
            KtorEndpointProbe(MockEngine { request -> sent = request; answer(request) })

        @Test
        fun aGetEncodesTheParametersIntoTheQueryAndSendsTheHeaders() = runTest {
            val probe = probe { respond("{}", HttpStatusCode.OK, json) }

            probe.get(
                "https://example.com/items",
                params = mapOf("name" to "OBD II", "max" to "5"),
                headers = mapOf("Accept" to "application/json"),
                timeLimit = 10.seconds,
            )

            val request = sent!!
            assertEquals(HttpMethod.Get, request.method)
            assertEquals("https://example.com/items?name=OBD+II&max=5", request.url.toString())
            // Once: ContentNegotiation adds this Accept value itself only when the request lacks it.
            assertEquals(listOf("application/json"), request.headers.getAll(HttpHeaders.Accept))
        }

        @Test
        fun aPostSendsTheMessageAsJson() = runTest {
            val probe = probe { respond("{}", HttpStatusCode.Created, json) }
            val message = ProbeMessage("Hello", Instant.parse("2026-09-11T10:30:00Z"))

            probe.post("https://example.com/notes", message, headers = emptyMap(), timeLimit = 10.seconds)

            val request = sent!!
            assertEquals(HttpMethod.Post, request.method)
            assertEquals("application/json", request.body.contentType.toString())
            assertEquals(
                """{"text":"Hello","sentAt":"2026-09-11T10:30:00Z"}""",
                request.body.toByteArray().decodeToString(),
            )
        }

        @Test
        fun aJsonAnswerComesIndented() = runTest {
            val probe = probe { respond("""{"id":1,"done":false}""", HttpStatusCode.OK, json) }

            val result = probe.get("https://example.com/todos/1", emptyMap(), emptyMap(), 10.seconds)

            assertEquals(ProbeResult.Answered(200, "{\n    \"id\": 1,\n    \"done\": false\n}"), result)
        }

        @Test
        fun aBodyThatIsntJsonComesAsItCame() = runTest {
            val html = headersOf(HttpHeaders.ContentType, "text/html")
            assertEquals(
                ProbeResult.Answered(200, "<h1>Hi</h1>"),
                probe { respond("<h1>Hi</h1>", HttpStatusCode.OK, html) }
                    .get("https://example.com/", emptyMap(), emptyMap(), 10.seconds),
            )
            // The server says JSON, but it isn't.
            assertEquals(
                ProbeResult.Answered(200, "{not json"),
                probe { respond("{not json", HttpStatusCode.OK, json) }
                    .get("https://example.com/", emptyMap(), emptyMap(), 10.seconds),
            )
        }

        @Test
        fun aNotFoundIsAnAnswerNotAnException() = runTest {
            val probe = probe { respond("Not Found", HttpStatusCode.NotFound) }

            val result = probe.get("https://example.com/nothing", emptyMap(), emptyMap(), 10.seconds)

            assertEquals(ProbeResult.Answered(404, "Not Found"), result)
        }

        @Test
        fun aServerSlowerThanTheLimitIsATimeout() = runTest {
            val probe = probe {
                delay(5.seconds)
                respond("{}", HttpStatusCode.OK, json)
            }

            val result = probe.get("https://example.com/slow", emptyMap(), emptyMap(), 100.milliseconds)

            assertEquals(ProbeResult.TimedOut, result)
        }

        @Test
        fun aNetworkErrorIsUnreachable() = runTest {
            val probe = probe { throw IOException("Unable to resolve host \"example.invalid\"") }

            val result = probe.get("https://example.invalid/", emptyMap(), emptyMap(), 10.seconds)

            assertTrue(result is ProbeResult.Unreachable)
            assertEquals("Unable to resolve host \"example.invalid\"", result.reason)

            // A URL the engine refuses is no answer either: OkHttp throws this for a host like "[::1".
            assertEquals(
                ProbeResult.Unreachable("Invalid URL host: \"[::1\""),
                probe { throw IllegalArgumentException("Invalid URL host: \"[::1\"") }
                    .get("https://[::1/", emptyMap(), emptyMap(), 10.seconds),
            )
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/ApiTestViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.ApiTestResult
    import com.example.devicemonitor.doubles.TestApiTesting
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
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.seconds

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain
    class ApiTestViewModelTest {
        private val api = TestApiTesting()
        private lateinit var viewModel: ApiTestViewModel

        @BeforeTest
        fun setUp() {
            Dispatchers.setMain(StandardTestDispatcher())
            viewModel = ApiTestViewModel(api)
        }

        @AfterTest
        fun tearDown() {
            Dispatchers.resetMain()
        }

        @Test
        fun aRequestOnItsWayShowsSendingThenTheAnswer() = runTest {
            viewModel.get("https://example.com/")
            testScheduler.runCurrent()
            assertTrue(viewModel.uiState.value.sending)
            assertEquals(listOf("GET https://example.com/"), api.urls)

            api.answer(ApiTestResult.Success(200, "{}"))
            testScheduler.runCurrent()

            assertEquals(ApiTestUiState(outcome = "GET · 200 · success", detail = "{}"), viewModel.uiState.value)
        }

        @Test
        fun everyFailureIsWordedAsAnError() = runTest {
            val cases = listOf(
                ApiTestResult.HttpError(404, "Not Found") to ApiTestUiState(outcome = "POST · HTTP error 404", failed = true, detail = "Not Found"),
                ApiTestResult.TimedOut(10.seconds) to ApiTestUiState(outcome = "POST · no answer within 10 s", failed = true),
                ApiTestResult.Unreachable("offline") to ApiTestUiState(outcome = "POST · couldn't reach the server", failed = true, detail = "offline"),
                ApiTestResult.InvalidUrl("example.com") to ApiTestUiState(outcome = "Enter a URL that starts with http:// or https://", failed = true),
            )
            for ((result, shown) in cases) {
                viewModel.post("https://example.com/")
                testScheduler.runCurrent()
                api.answer(result)
                testScheduler.runCurrent()
                assertEquals(shown, viewModel.uiState.value)
            }
        }

        @Test
        fun aLongBodyIsShortened() = runTest {
            viewModel.get("https://example.com/")
            testScheduler.runCurrent()
            api.answer(ApiTestResult.Success(200, "x".repeat(4100)))
            testScheduler.runCurrent()

            val detail = viewModel.uiState.value.detail
            assertTrue(detail.startsWith("x".repeat(4000) + "\n"))
            assertTrue(detail.endsWith("… and 100 more characters"))
        }

        @Test
        fun theNewestRequestWins() = runTest {
            viewModel.get("https://example.com/slow")
            testScheduler.runCurrent()
            viewModel.post("https://example.com/fast") // the GET is cancelled
            testScheduler.runCurrent()
            api.answer(ApiTestResult.Success(201, "created"))
            testScheduler.runCurrent()

            assertEquals("POST · 201 · success", viewModel.uiState.value.outcome)
            assertFalse(viewModel.uiState.value.sending)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.ApiTestViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.StatusReport
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
    import org.koin.dsl.koinApplication
    import kotlin.test.AfterTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertNotNull
    import kotlin.test.assertTrue
    import kotlin.time.Duration.Companion.minutes

    class AppModuleTest {
        // Fakes stand in for the adapters each platform passes to initKoin.
        private val radio = FakeBleConnection()
        private val os = FakePermissionChecker()
        private val log = FakeLogStore()
        private val timer = FakeMonitorScheduler()
        private val app = koinApplication {
            modules(
                appModule,
                platformModule(
                    os, FakeBleScanner(), radio,
                    FakeBatteryProvider(), FakeNetworkProvider(), FakeBluetoothProvider(),
                    log, timer, FakeMonitorSettings(),
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
            assertNotNull(koin.get<MonitorViewModel>())
            assertNotNull(koin.get<ApiTestViewModel>())
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
    }
    ```

??? example "docs/checklists.md"
    ```markdown
    # Release checklists

    The two checklists of the course plan's Appendix B (Lesson 20), as this app runs them. Run both
    before each release, and after any change that touches more than one part of the app.

    "Seen on" says how a row is known, as in monitor-behaviour.md:
    - emulator / Simulator: we ran it and saw this.
    - phone, not yet run: only a physical phone can show it. When you run it, write the phone and OS
      version here, and correct the row if the phone disagrees.

    ## End-to-end

    The BLE rows run twice. On the emulator and the Simulator, pass SimulatedBleScanner() and
    SimulatedBleConnection() to initKoin in the app start in place of the real adapters (two lines;
    put them back afterwards). On phones, use the real adapters and LightBlue (Lesson 13).

    | Row | What to do | Expect | Seen on |
    |---|---|---|---|
    | Permission: check | Fresh install, open the app | "Device Monitor needs Bluetooth permission…" and Allow Bluetooth | emulator; iPhone: phone, not yet run (the Simulator always says allowed) |
    | Permission: request, deny | Allow Bluetooth, then Don't allow | Android: "Bluetooth permission was denied…" and Ask again. iPhone: "Bluetooth permission is off…" and Open Settings (iOS never asks twice) | emulator; iPhone: phone, not yet run |
    | Permission: retry | Android: Ask again, then Don't allow again. iPhone: Open Settings, allow Bluetooth, come back | Android: "Bluetooth permission is off…" and Open Settings. iPhone: "Bluetooth permission: allowed" | emulator; iPhone: phone, not yet run |
    | BLE: scan | Scan | Devices appear as they are found; after 10 s, "Devices found: N" | emulator, Simulator (simulated); phone, not yet run |
    | BLE: connect, discover | Tap a device, Connect | "Status: connected", then its services and characteristics | emulator, Simulator (simulated); phone, not yet run |
    | BLE: read | Read on a readable characteristic | Its value under it (simulated battery: "82 %") | emulator, Simulator (simulated); phone, not yet run |
    | BLE: subscribe, receive | Subscribe on a notifying characteristic | A new value under it as the device sends one | emulator, Simulator (simulated); phone, not yet run |
    | BLE: disconnect, reconnect | Unsubscribe, Disconnect, Connect | "Status: not connected", services gone; then connected again | emulator, Simulator (simulated); phone, not yet run |
    | BLE: unexpected disconnect | Simulated: connect to Tire Pressure Sensor and wait 20 s. Phone: stop the peripheral | "Connection failed" with the reason, once; "Status: not connected" | emulator, Simulator (simulated); phone, not yet run |
    | Camera | Extension E2 only | | not in the core app |
    | API: GET, success | Main screen, API test, GET on https://httpbin.org/anything | "GET · 200 · success" and the request as httpbin saw it, as indented JSON, with "Accept": "application/json" | emulator, Simulator |
    | API: POST | POST on the same URL | "POST · 200 · success"; the echo's "json" holds the greeting and its "sentAt" | emulator, Simulator |
    | API: error | GET on https://httpbin.org/status/404, then on https://no-such-host.invalid/ | "GET · HTTP error 404"; then "GET · couldn't reach the server" and the platform's reason | emulator, Simulator |
    | API: timeout | GET on https://10.255.255.1/ (an address that never answers) | "Sending…" for 10 s, then "GET · no answer within 10 s" | emulator, Simulator |
    | Monitor: start | Start | "Monitor running, about every 15 min". Android: a record within seconds. iOS: the first record one interval after Start | emulator, Simulator |
    | Monitor: stop | Stop | "Monitor stopped"; Android: no job left (adb shell dumpsys jobscheduler); no more records | emulator, Simulator |
    | Monitor: restart | After Stop, end the process and open the app again | Still "Monitor stopped". Start: running again | emulator, Simulator |
    | Monitor: background, return, OS termination, force-kill | As in monitor-behaviour.md | The rows of monitor-behaviour.md | emulator, Simulator; phone rows: phone, not yet run |

    ## Refactor

    | Item | How to check | m15 |
    |---|---|---|
    | The UI has no device logic | Read each screen: it renders state and calls its ViewModel | yes |
    | ViewModels call only inbound ports | grep -n 'core.outbound\|adapter.outbound\|import android\.\|import platform\.' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/*.kt finds nothing | yes |
    | The app core imports no framework | grep -rn 'import android\.\|import platform\.\|import org.koin\|import io.ktor\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core finds nothing | yes |
    | One capability per inbound port; outbound ports named in the app's terms | Read core/inbound and core/outbound | yes |
    | Rules live in services | Read the ViewModels and adapters for decisions that aren't about the screen or the platform | yes, after moving the scan's time limit into ScanningService |
    | Services don't know each other | grep -n 'core.inbound' shared/src/commonMain/kotlin/com/example/devicemonitor/core/*Service.kt: one line per service, its own port; the bridge (SessionConnectionStatus) holds no rule | yes |
    | Koin binds ports to services and adapters; the graph test is green | AppModuleTest | yes |
    | Async work is scoped; errors reach the UI as state | Read the ViewModels: viewModelScope, and every exception caught into UI state | yes, after the monitor section showed the monitor's errors |
    | Resources are released | GATT closed and subscriptions cancelled (Lesson 16 tests); the monitor stops | yes, after Stop |
    | BLE connection state is consistent | SessionServiceTest, DeviceDetailViewModelTest | yes |
    | Service tests through inbound ports, with fakes, on JVM and iOS | ./gradlew :shared:allTests | yes |
    | No unused dependencies | For each dependency in a build file, grep its package in that module's sources; also look for code nothing calls | yes, after removing core-ktx from androidApp and the m00 greeting (Greeting, platformName). SimulatedBleScanner and SimulatedBleConnection stay: the end-to-end rows above use them |
    ```

**Android**

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
            <!-- The API test screen (Extension E1): network access, an install-time permission too.
                 OkHttp's own manifest also declares it, but the app states what it uses itself. -->
            <uses-permission android:name="android.permission.INTERNET" />

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

        // The API test screen (Extension E1): nothing to pass.
        @Serializable
        data object ApiTest

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
                            onApiTest = { navController.navigate(ApiTest) },
                        )
                    }
                    composable<DeviceDetail> { entry ->
                        val route: DeviceDetail = entry.toRoute()
                        DeviceDetailScreen(
                            device = Device(id = route.id, name = route.name, rssi = route.rssi),
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable<ApiTest> {
                        ApiTestScreen(onBack = { navController.popBackStack() })
                    }
                }
            }
        }
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
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.core.Device
        import com.example.devicemonitor.core.PermissionStatus
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: owns the filter text and connects the shared ViewModel to the content below. The
        // main screen: every feature starts here, and the device screen is one tap away.
        @Composable
        fun DeviceListScreen(
            onDeviceClick: (Device) -> Unit,
            onApiTest: () -> Unit,
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
                monitor = { MonitorSection() },
                onApiTest = onApiTest,
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
            // A slot: the screen passes the stateful MonitorSection, so this function stays stateless.
            monitor: @Composable () -> Unit,
            onApiTest: () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Device Monitor", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                    TextButton(onClick = dropUnlessResumed { onApiTest() }) { Text("API test") }
                }
                PhoneStatusRow(text = phoneStatus, onRefresh = onRefreshStatus)
                monitor()
                HorizontalDivider()
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/ApiTestScreen.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.Row
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.fillMaxWidth
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.size
        import androidx.compose.foundation.rememberScrollState
        import androidx.compose.foundation.text.KeyboardOptions
        import androidx.compose.foundation.verticalScroll
        import androidx.compose.material3.Button
        import androidx.compose.material3.CircularProgressIndicator
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.OutlinedButton
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
        import androidx.compose.ui.text.font.FontFamily
        import androidx.compose.ui.text.input.KeyboardType
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.inbound.ApiTestUiState
        import com.example.devicemonitor.adapter.inbound.ApiTestViewModel
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: owns the URL text and connects the shared ViewModel to the content below. Popping the
        // screen clears the ViewModel, which cancels a request still on its way.
        @Composable
        fun ApiTestScreen(
            onBack: () -> Unit,
            viewModel: ApiTestViewModel = koinViewModel(),
        ) {
            var url by rememberSaveable { mutableStateOf(ApiTestViewModel.SUGGESTED_URL) }
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            ApiTestContent(
                url = url,
                onUrlChange = { url = it },
                state = state,
                onGet = { viewModel.get(url) },
                onPost = { viewModel.post(url) },
                onBack = onBack,
            )
        }

        // Stateless: renders whatever it's given, reports events up.
        @Composable
        fun ApiTestContent(
            url: String,
            onUrlChange: (String) -> Unit,
            state: ApiTestUiState,
            onGet: () -> Unit,
            onPost: () -> Unit,
            onBack: () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("API test", style = MaterialTheme.typography.headlineSmall)
                OutlinedTextField(
                    value = url,
                    onValueChange = onUrlChange,
                    label = { Text("URL") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onGet, enabled = !state.sending) { Text("GET") }
                    OutlinedButton(onClick = onPost, enabled = !state.sending) { Text("POST") }
                }
                if (state.sending) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Sending…")
                    }
                }
                state.outcome?.let {
                    Text(it, color = if (state.failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                }
                if (state.detail.isNotEmpty()) {
                    Text(state.detail, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = dropUnlessResumed { onBack() }) {
                    Text("Back")
                }
            }
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
            <!-- The API test screen (Extension E1): network access, an install-time permission too.
                 OkHttp's own manifest also declares it, but the app states what it uses itself. -->
            <uses-permission android:name="android.permission.INTERNET" />

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
                <action
                    android:id="@+id/toApiTest"
                    app:destination="@id/apiTest" />
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

            <!-- The API test screen (Extension E1): no arguments. -->
            <fragment
                android:id="@+id/apiTest"
                android:name="com.example.devicemonitor.android.ApiTestFragment" />
        </navigation>
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
                app:layout_constraintEnd_toStartOf="@id/apiTestButton"
                app:layout_constraintTop_toTopOf="parent" />

            <!-- The API test screen (Extension E1), one tap from the main screen. -->
            <Button
                android:id="@+id/apiTestButton"
                style="?attr/borderlessButtonStyle"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="API test"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintBaseline_toBaselineOf="@id/title" />

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

            <!-- The monitor: its state, Start or Stop, and the log's newest records with Clear. -->
            <LinearLayout
                android:id="@+id/monitorSection"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="vertical"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/phoneStatusRow">

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:gravity="center_vertical"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/monitorSummary"
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1" />

                    <Button
                        android:id="@+id/monitorButton"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:gravity="center_vertical"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/recordCountText"
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1"
                        android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                    <Button
                        android:id="@+id/clearLogButton"
                        style="?attr/borderlessButtonStyle"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="Clear" />
                </LinearLayout>

                <!-- The newest records, one per line, newest first. -->
                <TextView
                    android:id="@+id/newestRecordsText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                <TextView
                    android:id="@+id/monitorProblemText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small"
                    android:textColor="#D32F2F"
                    android:visibility="gone" />
            </LinearLayout>

            <View
                android:id="@+id/monitorDivider"
                android:layout_width="0dp"
                android:layout_height="1dp"
                android:layout_marginTop="8dp"
                android:background="?android:attr/listDivider"
                app:layout_constraintStart_toStartOf="parent"
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toBottomOf="@id/monitorSection" />

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
                app:layout_constraintTop_toBottomOf="@id/monitorDivider" />

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
        import com.example.devicemonitor.adapter.inbound.MonitorUiState
        import com.example.devicemonitor.adapter.inbound.MonitorViewModel
        import com.example.devicemonitor.adapter.inbound.ScanState
        import com.example.devicemonitor.android.databinding.FragmentDeviceListBinding
        import com.example.devicemonitor.core.PermissionStatus
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        // The main screen: every feature starts here, and the device screen is one tap away.
        class DeviceListFragment : Fragment() {
            // Survives rotation and the trip to the detail screen; cleared when this
            // Fragment leaves the back stack for good.
            private val viewModel: DeviceListViewModel by viewModel()
            private val monitorViewModel: MonitorViewModel by viewModel()

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
                // One button: Stop while running, Start while stopped.
                b.monitorButton.setOnClickListener {
                    if (monitorViewModel.uiState.value.running) monitorViewModel.stop() else monitorViewModel.start()
                }
                b.clearLogButton.setOnClickListener { monitorViewModel.clearLog() }
                b.apiTestButton.setOnClickListener {
                    val nav = findNavController()
                    // A fast double tap delivers two clicks; only navigate from the list itself.
                    if (nav.currentDestination?.id == R.id.deviceList) nav.navigate(R.id.toApiTest)
                }
                return b.root
            }

            override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
                super.onViewCreated(view, savedInstanceState)
                viewLifecycleOwner.lifecycleScope.launch {
                    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                        launch { viewModel.uiState.collect { render(it) } }
                        launch { monitorViewModel.uiState.collect { renderMonitor(it) } }
                    }
                }
            }

            override fun onStart() {
                super.onStart()
                permissionChecker.attach(requireActivity(), permissionLauncher)
            }

            // Back from Settings (or anywhere else): the permission and the status may have changed, and
            // a tick may have written records while the screen was away.
            override fun onResume() {
                super.onResume()
                viewModel.refreshPermission()
                viewModel.refreshStatus()
                monitorViewModel.refreshLog()
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

            // The monitor section: every new monitor state ends here.
            private fun renderMonitor(state: MonitorUiState) {
                val b = binding ?: return
                b.monitorSummary.text = state.summary
                b.monitorButton.text = if (state.running) "Stop" else "Start"
                b.recordCountText.text = "Records in the log: ${state.recordCount}"
                b.clearLogButton.isEnabled = state.recordCount > 0
                b.newestRecordsText.text = state.newest.joinToString("\n")
                b.newestRecordsText.visibility = if (state.newest.isEmpty()) View.GONE else View.VISIBLE
                b.monitorProblemText.text = state.problem
                b.monitorProblemText.visibility = if (state.problem == null) View.GONE else View.VISIBLE
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

    ??? example "androidApp/src/main/res/layout/fragment_api_test.xml"
        ```xml
        <!-- Scrolls: an answer's body can be long. -->
        <ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
            android:layout_width="match_parent"
            android:layout_height="match_parent">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="API test"
                android:textAppearance="@style/TextAppearance.AppCompat.Headline" />

            <!-- textUri: a keyboard for URLs, with no autocorrect to turn http:// into something else. -->
            <EditText
                android:id="@+id/urlInput"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:hint="URL"
                android:importantForAutofill="no"
                android:inputType="textUri" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="horizontal">

                <Button
                    android:id="@+id/getButton"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="GET" />

                <Button
                    android:id="@+id/postButton"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="8dp"
                    android:text="POST" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/sendingRow"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:gravity="center_vertical"
                android:orientation="horizontal"
                android:visibility="gone">

                <ProgressBar
                    android:layout_width="20dp"
                    android:layout_height="20dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="8dp"
                    android:text="Sending…" />
            </LinearLayout>

            <TextView
                android:id="@+id/outcomeText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:textAppearance="@style/TextAppearance.AppCompat.Medium" />

            <TextView
                android:id="@+id/detailText"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:fontFamily="monospace"
                android:textIsSelectable="true"
                android:textSize="12sp" />

            <Button
                android:id="@+id/backButton"
                style="@style/Widget.AppCompat.Button.Borderless.Colored"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:text="Back" />
        </LinearLayout>
        </ScrollView>
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/ApiTestFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Color
        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import androidx.fragment.app.Fragment
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import com.example.devicemonitor.adapter.inbound.ApiTestUiState
        import com.example.devicemonitor.adapter.inbound.ApiTestViewModel
        import com.example.devicemonitor.android.databinding.FragmentApiTestBinding
        import kotlinx.coroutines.launch
        import org.koin.androidx.viewmodel.ext.android.viewModel

        // The API test screen (Extension E1). Leaving it for good clears the ViewModel, which cancels a
        // request still on its way.
        class ApiTestFragment : Fragment() {
            private val viewModel: ApiTestViewModel by viewModel()
            private var binding: FragmentApiTestBinding? = null

            override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
                val b = FragmentApiTestBinding.inflate(inflater, container, false)
                binding = b
                // The first time only: after a rotation, the EditText restores what the user typed.
                if (savedInstanceState == null) b.urlInput.setText(ApiTestViewModel.SUGGESTED_URL)
                b.getButton.setOnClickListener { viewModel.get(b.urlInput.text.toString()) }
                b.postButton.setOnClickListener { viewModel.post(b.urlInput.text.toString()) }
                b.backButton.setOnClickListener {
                    val nav = findNavController()
                    // A fast double tap would otherwise pop the list too and empty the back stack.
                    if (nav.currentDestination?.id == R.id.apiTest) nav.popBackStack()
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
                binding = null
            }

            // The one place that touches views: every new state ends here. It never sets the URL text.
            private fun render(state: ApiTestUiState) {
                val b = binding ?: return
                b.getButton.isEnabled = !state.sending
                b.postButton.isEnabled = !state.sending
                b.sendingRow.visibility = if (state.sending) View.VISIBLE else View.GONE
                b.outcomeText.text = state.outcome.orEmpty()
                b.outcomeText.setTextColor(if (state.failed) Color.RED else Color.DKGRAY)
                b.detailText.text = state.detail
            }
        }
        ```

**iOS**

=== "SwiftUI"

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
                        // The API test screen (Extension E1), one tap from the main screen.
                        .toolbar {
                            NavigationLink("API test") { ApiTestView() }
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

    ??? example "iosApp/iosApp/ApiTestView.swift"
        ```swift
        import SwiftUI
        import Shared

        // Stateful: owns the URL text and connects the shared ViewModel to the content below. Popping the
        // screen deinitialises the owner, which clears the ViewModel and cancels a request on its way.
        struct ApiTestView: View {
            @State private var owner = ViewModelOwner()
            @State private var url = ApiTestViewModel.companion.SUGGESTED_URL
            @State private var state: ApiTestUiState?

            var body: some View {
                let viewModel: ApiTestViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                ApiTestContent(
                    url: $url,
                    state: state,
                    onGet: { viewModel.get(url: url) },
                    onPost: { viewModel.post(url: url) }
                )
                .navigationTitle("API test")
                .task {
                    for await newState in viewModel.uiState {
                        self.state = newState
                    }
                }
            }
        }

        // Stateless: renders whatever it's given, reports events up.
        struct ApiTestContent: View {
            @Binding var url: String
            let state: ApiTestUiState
            let onGet: () -> Void
            let onPost: () -> Void

            var body: some View {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        TextField("URL", text: $url)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        HStack {
                            Button("GET", action: onGet)
                                .buttonStyle(.borderedProminent)
                            Button("POST", action: onPost)
                                .buttonStyle(.bordered)
                        }
                        .disabled(state.sending)
                        if state.sending {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Sending…")
                            }
                        }
                        if let outcome = state.outcome {
                            Text(outcome)
                                .foregroundStyle(state.failed ? .red : .primary)
                        }
                        if !state.detail.isEmpty {
                            Text(state.detail)
                                .font(.system(.footnote, design: .monospaced))
                                .textSelection(.enabled)
                        }
                    }
                    .padding()
                }
            }
        }
        ```

=== "UIKit"

    ??? example "iosApp/iosApp/DeviceListViewController.swift"
        ```swift
        import UIKit
        import Shared

        // The main screen: every feature starts here, and the device screen is one tap away.
        final class DeviceListViewController: UIViewController, UITableViewDelegate {
            private let owner = ViewModelOwner()
            private lazy var viewModel: DeviceListViewModel = owner.viewModel()
            // The same store holds one ViewModel per class: the monitor section's is a second one.
            private lazy var monitorViewModel: MonitorViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?
            private var monitorObservation: Task<Void, Never>?

            private let phoneStatusLabel = UILabel()
            private let refreshStatusButton = UIButton(configuration: .plain())
            private let monitorSummaryLabel = UILabel()
            private let monitorButton = UIButton(configuration: .gray())
            private let recordCountLabel = UILabel()
            private let clearLogButton = UIButton(configuration: .plain())
            private let newestRecordsLabel = UILabel()
            private let monitorProblemLabel = UILabel()
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
                // The API test screen (Extension E1), one tap from the main screen.
                navigationItem.rightBarButtonItem = UIBarButtonItem(title: "API test", primaryAction: UIAction { [weak self] _ in
                    self?.navigationController?.pushViewController(ApiTestViewController(), animated: true)
                })
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
                // One button: Stop while running, Start while stopped.
                monitorButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if monitorViewModel.uiState.value.running {
                        monitorViewModel.stop()
                    } else {
                        monitorViewModel.start()
                    }
                }, for: .touchUpInside)
                clearLogButton.configuration?.title = "Clear"
                clearLogButton.addAction(UIAction { [weak self] _ in
                    self?.monitorViewModel.clearLog()
                }, for: .touchUpInside)
                monitorSummaryLabel.numberOfLines = 0
                recordCountLabel.font = .preferredFont(forTextStyle: .footnote)
                newestRecordsLabel.numberOfLines = 0
                newestRecordsLabel.font = .preferredFont(forTextStyle: .caption1)
                newestRecordsLabel.textColor = .secondaryLabel
                monitorProblemLabel.numberOfLines = 0
                monitorProblemLabel.font = .preferredFont(forTextStyle: .caption1)
                monitorProblemLabel.textColor = .systemRed
                for button in [monitorButton, clearLogButton] {
                    button.setContentHuggingPriority(.required, for: .horizontal)
                    button.setContentCompressionResistancePriority(.required, for: .horizontal)
                }
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
                let monitorRow = UIStackView(arrangedSubviews: [monitorSummaryLabel, monitorButton])
                monitorRow.spacing = 8
                monitorRow.alignment = .center
                let logRow = UIStackView(arrangedSubviews: [recordCountLabel, clearLogButton])
                logRow.spacing = 8
                logRow.alignment = .center
                let monitorSection = UIStackView(arrangedSubviews: [
                    monitorRow, logRow, newestRecordsLabel, monitorProblemLabel,
                ])
                monitorSection.axis = .vertical
                monitorSection.spacing = 4
                let divider = UIView()
                divider.backgroundColor = .separator
                divider.heightAnchor.constraint(equalToConstant: 1).isActive = true
                let stack = UIStackView(arrangedSubviews: [
                    phoneStatusRow, monitorSection, divider, filterField, permissionRow, scanButton, statusRow, tableView,
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
                renderMonitor(monitorViewModel.uiState.value)
                // Back from Settings (or anywhere else): the permission and the status may have changed.
                NotificationCenter.default.addObserver(
                    self, selector: #selector(sceneDidActivate),
                    name: UIScene.didActivateNotification, object: nil
                )
            }

            // Back in the foreground: a tick may also have written records while the screen was away.
            @objc private func sceneDidActivate() {
                viewModel.refreshPermission()
                viewModel.refreshStatus()
                monitorViewModel.refreshLog()
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
                monitorObservation?.cancel()
                monitorObservation = Task {
                    for await state in monitorViewModel.uiState {
                        renderMonitor(state)
                    }
                }
            }

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                observation?.cancel()
                observation = nil
                monitorObservation?.cancel()
                monitorObservation = nil
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

            // The monitor section: every new monitor state ends here.
            private func renderMonitor(_ state: MonitorUiState) {
                monitorSummaryLabel.text = state.summary
                monitorButton.configuration?.title = state.running ? "Stop" : "Start"
                recordCountLabel.text = "Records in the log: \(state.recordCount)"
                clearLogButton.isEnabled = state.recordCount > 0
                newestRecordsLabel.text = state.newest.joined(separator: "\n")
                newestRecordsLabel.isHidden = state.newest.isEmpty
                monitorProblemLabel.text = state.problem
                monitorProblemLabel.isHidden = state.problem == nil
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

    ??? example "iosApp/iosApp/ApiTestViewController.swift"
        ```swift
        import UIKit
        import Shared

        // The API test screen (Extension E1). Popping it deinitialises the owner, which clears the
        // ViewModel and cancels a request still on its way.
        final class ApiTestViewController: UIViewController {
            private let owner = ViewModelOwner()
            private lazy var viewModel: ApiTestViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?

            private let urlField = UITextField()
            private let getButton = UIButton(configuration: .filled())
            private let postButton = UIButton(configuration: .bordered())
            private let sendingRow = UIStackView()
            private let outcomeLabel = UILabel()
            private let detailLabel = UILabel()

            override func viewDidLoad() {
                super.viewDidLoad()
                title = "API test"
                navigationItem.largeTitleDisplayMode = .never
                view.backgroundColor = .systemBackground

                urlField.borderStyle = .roundedRect
                urlField.placeholder = "URL"
                urlField.text = ApiTestViewModel.companion.SUGGESTED_URL
                urlField.keyboardType = .URL
                urlField.autocapitalizationType = .none
                urlField.autocorrectionType = .no
                getButton.configuration?.title = "GET"
                getButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    viewModel.get(url: urlField.text ?? "")
                }, for: .touchUpInside)
                postButton.configuration?.title = "POST"
                postButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    viewModel.post(url: urlField.text ?? "")
                }, for: .touchUpInside)
                let buttons = UIStackView(arrangedSubviews: [getButton, postButton])
                buttons.spacing = 8

                let spinner = UIActivityIndicatorView(style: .medium)
                spinner.startAnimating()
                let sendingLabel = UILabel()
                sendingLabel.text = "Sending…"
                sendingRow.addArrangedSubview(spinner)
                sendingRow.addArrangedSubview(sendingLabel)
                sendingRow.spacing = 8
                outcomeLabel.numberOfLines = 0
                detailLabel.numberOfLines = 0
                detailLabel.font = .monospacedSystemFont(ofSize: 12, weight: .regular)

                let stack = UIStackView(arrangedSubviews: [urlField, buttons, sendingRow, outcomeLabel, detailLabel])
                stack.axis = .vertical
                stack.alignment = .leading
                stack.spacing = 12
                stack.translatesAutoresizingMaskIntoConstraints = false
                // Scrolls: an answer's body can be long.
                let scrollView = UIScrollView()
                scrollView.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(scrollView)
                scrollView.addSubview(stack)
                let content = scrollView.contentLayoutGuide
                NSLayoutConstraint.activate([
                    scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
                    scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                    scrollView.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
                    scrollView.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
                    stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 12),
                    stack.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -12),
                    stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
                    stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
                    stack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
                    urlField.widthAnchor.constraint(equalTo: stack.widthAnchor),
                    detailLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
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

            // The one place that touches views: every new state ends here. It never sets the URL text.
            private func render(_ state: ApiTestUiState) {
                getButton.isEnabled = !state.sending
                postButton.isEnabled = !state.sending
                sendingRow.isHidden = !state.sending
                outcomeLabel.text = state.outcome
                outcomeLabel.textColor = state.failed ? .systemRed : .label
                detailLabel.text = state.detail
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 và A4 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, Ktor 3.6.0, kotlinx.serialization 1.12.0). A3 chạy **đúng code** `ApiTestingService.kt`, `KtorEndpointProbe.kt` và các model của bài (chỉ gom về một package), trên một `MockEngine` thay cho mạng.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-port-hep-thay-vi-apiclient-rong): port hẹp thay vì `ApiClient` rộng (mục 1).
    3. [A3](#a3-sau-ket-cuc-chay-that-bang-code-cua-bai): sáu kết cục của một request, chạy thật bằng code của bài (mục 2, 4, 5).
    4. [A4](#a4-thu-tu-catch-chay-that): vì sao thứ tự `catch` quan trọng, chạy thật (mục 5).
    5. [A5](#a5-ktor-nhin-tu-phia-typescript): Ktor nhìn từ phía TypeScript (mục 3, 4, 9).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Phần mở rộng thêm một **màn hình test API**: ô URL, GET, POST, hiện câu trả lời hoặc lỗi.
    2. Port là `EndpointProbe`, đặt tên theo **việc của màn hình** (thử một endpoint), không phải `ApiClient`; nó trả `ProbeResult` và **không bao giờ ném lỗi**.
    3. Mọi code Ktor nằm trong **một adapter** (`KtorEndpointProbe`) cùng hàm `httpEngine()` (`expect`/`actual`: OkHttp trên Android, Darwin trên iOS); `grep io.ktor` chỉ ra bốn file đó.
    4. `ApiTestingService` giữ quy tắc: chỉ gửi URL http(s), 2xx là thành công, giới hạn **10 giây**; năm kết quả (`Success`, `HttpError`, `TimedOut`, `Unreachable`, `InvalidUrl`), ViewModel diễn thành lời.
    5. Test không cần mạng: service dùng `FakeEndpointProbe`, adapter dùng **`MockEngine`** của Ktor (code thật của adapter vẫn chạy, chỉ mạng bị thay).

Ví dụ đời thường cho cả bài: **gọi điện cho một cửa hàng.** Bạn (ViewModel) nhờ thư ký (service) gọi. Thư ký kiểm tra số có hợp lệ không (`InvalidUrl`), đặt quy tắc "chờ tối đa 10 giây". Tổng đài viên (adapter Ktor) bấm số qua đường dây của nhà mạng (engine: OkHttp hay Darwin). Kết quả: có người nghe và trả lời (2xx), có người nghe nhưng nói "không có" (404), chuông mãi không ai nghe (timeout), số không tồn tại / mất sóng (`Unreachable`). Tổng đài viên **không bao giờ hoảng loạn ném máy**: chuyện gì cũng ghi thành một tờ giấy báo cho thư ký.

| Chữ trong bài | Nói đơn giản | Trong e1 là |
|---|---|---|
| Ktor | thư viện HTTP đa nền tảng của JetBrains | `HttpClient(engine) { … }` |
| engine | phần thật sự mở socket, mỗi nền tảng một cái | OkHttp (Android), Darwin (iOS) |
| `expect` / `actual` | khai báo trong `commonMain`, cài đặt riêng từng nền tảng | `httpEngine()` |
| ContentNegotiation | plugin tự đổi object ↔ JSON | `setBody(MessageBody)`, `body<JsonElement>()` |
| `HttpTimeout` | plugin giới hạn thời gian request | `timeout { requestTimeoutMillis = … }` |
| `expectSuccess` | bật thì 4xx/5xx thành exception | để tắt: status là câu trả lời |
| `JsonElement` | "JSON bất kỳ" của kotlinx.serialization | màn hình không biết hình dạng câu trả lời |
| `MockEngine` | engine giả trả lời theo handler bạn viết | `KtorEndpointProbeTest` |
| cleartext | `http://` không mã hoá | Android 9+ và iOS (ATS) chặn mặc định |

### A2. Port hẹp thay vì `ApiClient` rộng

Giải thích thêm cho [mục 1](#1-mot-port-at-ten-theo-thu-app-can).

| | `ApiClient` (không dùng) | `EndpointProbe` (e1) | `LogUploader` (tính năng thật, ví dụ) |
|---|---|---|---|
| Tên theo | HTTP | việc của màn hình test | việc của tính năng |
| Method | `get(url)`, `post(url, body)` | `get(url, params, headers, timeLimit)`, `post(url, message, …)` | `upload(records): UploadResult` |
| Core có biết URL? | có, ở mọi nơi | có, vì URL là thứ màn hình xoay quanh | **không** |
| Đổi sang gRPC / Bluetooth | sửa mọi bên gọi | sửa adapter | sửa adapter |
| Fake trong test | phải giả lập HTTP | trả `ProbeResult` | trả `UploadResult` |

So với TS/JS: thay vì mọi service gọi `axios.get(...)` hay một `apiClient` chung, mỗi nhu cầu có một interface nhỏ (`interface LogUploader { upload(records): Promise<UploadResult> }`), và chỉ một file `httpLogUploader.ts` biết tới `axios`.

### A3. Sáu kết cục, chạy thật bằng code của bài

Giải thích thêm cho [mục 2](#2-service-cac-quy-tac-cua-man-hinh), [mục 4](#4-get-post-va-json) và [mục 5](#5-nhung-gi-co-the-hong-status-timeout-loi-mang). `ApiTestingService` thật trên `KtorEndpointProbe` thật, nhưng engine là một `MockEngine` trả lời theo đường dẫn:

```kotlin title="le1/Main.kt (chạy code của bài, không có trong app)"
val engine = MockEngine { request ->
    val path = request.url.encodedPath
    when {
        path == "/json" -> respond("""{"id":1,"query":"${request.url.encodedQuery}","done":false}""",
            HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        path == "/missing" -> respond("not here", HttpStatusCode.NotFound)
        path == "/slow" -> { delay(30_000); respond("late") }
        else -> throw IOException("Unable to resolve host \"${request.url.host}\"")
    }
}

fun main() = runBlocking {
    val service = ApiTestingService(KtorEndpointProbe(engine))
    // show(...) in kết quả, mỗi trường một dòng
    show("GET 200 JSON, tham số") { service.get("https://api.test/json", mapOf("name" to "OBD II", "max" to "5")) }
    show("GET 404") { service.get("https://api.test/missing") }
    show("không có host") { service.get("https://no-such-host.invalid/") }
    show("không phải URL web") { service.get("example.com") }
    show("URL mà Ktor không đọc được") { service.get("https://example.com:99999/") }
    show("server chậm (30 s), giới hạn của service") { service.get("https://api.test/slow") }
}
```

Output thật:

```text
== GET 200 JSON, tham số
Success(status=200,
   body={
    "id": 1,
    "query": "name=OBD+II&max=5",
    "done": false
})
== GET 404
HttpError(status=404,
   body=not here)
== không có host
Unreachable(reason=Unable to resolve host "no-such-host.invalid")
== không phải URL web
InvalidUrl(url=example.com)
== URL mà Ktor không đọc được
Unreachable(reason=Fail to parse url: https://example.com:99999/)
== server chậm (30 s), giới hạn của service
TimedOut(limit=10s)
   (chờ thật: 10 s)
```

1. **Tham số được mã hoá**: "OBD II" thành `OBD+II` trong query, nhờ `parameter()`; JSON trả về được thụt lề bằng `prettyPrint`.
2. **404 là một câu trả lời**, không phải exception (`expectSuccess` tắt); service mới quyết định đó là `HttpError`, và body vẫn tới màn hình.
3. **Mất host** là `IOException` → `Unreachable` kèm lý do.
4. **"example.com"** không bao giờ tới adapter: service chặn thành `InvalidUrl`.
5. **Cổng 99999** qua được kiểm tra nhỏ của service, nhưng parser của Ktor từ chối; mệnh đề `catch (e: Exception)` cuối cùng biến nó thành `Unreachable` thay vì làm crash app.
6. **Server chậm**: `HttpTimeout` cắt request đúng ở 10 giây của service (thời gian **thật**, vì timeout của Ktor không chạy trên test dispatcher), và kết quả mang theo con số đó.

### A4. Thứ tự `catch`, chạy thật

Giải thích thêm cho [mục 5](#5-nhung-gi-co-the-hong-status-timeout-loi-mang).

```kotlin title="le1/Order.kt (không có trong app)"
val timeouts: List<Throwable> = listOf(
    HttpRequestTimeoutException("https://x", 100),
    ConnectTimeoutException("connect"),
    SocketTimeoutException("socket"),
)
for (e in timeouts) println("%-28s là IOException? %s".format(e::class.simpleName, e is IOException))
val e: Throwable = timeouts[0]
val wrongOrder = try { throw e } catch (x: IOException) { "Unreachable" } catch (x: HttpRequestTimeoutException) { "TimedOut" }
val rightOrder = try { throw e } catch (x: HttpRequestTimeoutException) { "TimedOut" } catch (x: IOException) { "Unreachable" }
println("IOException trước -> $wrongOrder;  timeout trước -> $rightOrder")
```

Output thật:

```text
HttpRequestTimeoutException  là IOException? true
ConnectTimeoutException      là IOException? true
SocketTimeoutException       là IOException? true
IOException trước -> Unreachable;  timeout trước -> TimedOut
```

Kotlin **compile cả hai thứ tự** mà không báo gì (Java thì từ chối mệnh đề không bao giờ tới được). Nên sai thứ tự là một bug lặng lẽ: màn hình nói "couldn't reach the server" khi thật ra là "no answer within 10 s". Thứ tự đúng trong adapter: ba timeout → `IOException` → `CancellationException` (ném lại) → `Exception`.

So với TS/JS: JS chỉ có một `catch`, nên bạn tự viết `if (e instanceof TimeoutError) … else if (e instanceof NetworkError) …`; cùng cái bẫy nếu kiểm tra lớp cha trước.

### A5. Ktor nhìn từ phía TypeScript

Giải thích thêm cho [mục 3](#3-ktor-ben-trong-mot-adapter), [mục 4](#4-get-post-va-json) và [mục 9](#9-test).

| Ktor (Kotlin) | TypeScript (fetch / axios) | Ghi chú |
|---|---|---|
| `HttpClient(engine) { install(…) }` | `axios.create({ … })` | engine = chỗ mở socket thật |
| `client.get(url) { parameter("q", v) }` | `axios.get(url, { params: { q: v } })` | cả hai tự mã hoá query |
| `setBody(obj)` + `contentType(Json)` | `axios.post(url, obj)` | Ktor cần ContentNegotiation để biết đổi sang JSON |
| `response.body<JsonElement>()` | `await res.json()` | Kotlin có kiểu; "JSON bất kỳ" là `JsonElement` |
| `timeout { requestTimeoutMillis = … }` | `AbortSignal.timeout(ms)` | Ktor ném `HttpRequestTimeoutException` |
| `expectSuccess = false` (mặc định) | `fetch` (không ném với 404) | axios mặc định **ném** với 4xx/5xx |
| `MockEngine { request -> respond(…) }` | `msw` / `nock` | chặn ở tầng mạng, code client vẫn chạy thật |
| huỷ coroutine → request dừng | `AbortController.abort()` | trong Kotlin là tự động khi `viewModelScope` bị huỷ |

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là xong E1.

- [ ] Giải thích vì sao port là `EndpointProbe` chứ không phải `ApiClient`, và một tính năng thật sẽ có port tên gì (xem [A2](#a2-port-hep-thay-vi-apiclient-rong)).
- [ ] Đặt Ktor trong một adapter dùng chung với engine truyền từ ngoài, và chọn engine theo nền tảng bằng `expect`/`actual`.
- [ ] Kiểm bằng `grep io.ktor` rằng không gì ngoài adapter và các file `HttpEngine` import Ktor.
- [ ] Gửi GET có tham số và POST có body JSON, đọc câu trả lời JSON bất kỳ bằng `JsonElement`.
- [ ] Kể năm `ApiTestResult` và nói mỗi cái tới từ đâu: service hay adapter (xem [A3](#a3-sau-ket-cuc-chay-that-bang-code-cua-bai)).
- [ ] Viết đúng thứ tự `catch` trong adapter và giải thích vì sao (xem [A4](#a4-thu-tu-catch-chay-that)).
- [ ] Giải thích vì sao một `CancellationException` phải được ném lại, và chuyện gì xảy ra khi rời màn hình giữa request.
- [ ] Test service bằng fake port và test adapter bằng `MockEngine`, và nói mỗi cái thay cái gì.
- [ ] Giải thích vì sao `http://` bị chặn trên cả hai nền tảng, và vì sao ô URL tắt tự sửa chính tả.
- [ ] Mở màn hình test API từ màn hình chính trên track của mình.
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
