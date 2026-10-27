---
source: lessons/16-ble-notify-disconnect-errors.html
source_ref: live
source_sha: 6f30c7a
---

<p class="kicker">Bài 16 · Tuần 4 · Ngày 16 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/16-ble-notify-disconnect-errors.html">Bản gốc tiếng Anh</a></p>

# BLE: notify, ngắt kết nối, lỗi

<div class="meta">
  <span class="tag">~2,5 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m11 luồng BLE đầy đủ, phục hồi được sau một lần mất kết nối bất ngờ</span>
  <span class="tag">Cần trước: <a href="../15-ble-kham-pha-va-doc/">15</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Ở m10 app hỏi thiết bị một giá trị và nhận một câu trả lời. Phần lớn thiết bị thật làm theo chiều ngược lại: một dây đo nhịp tim hay một adapter xe hơi gửi giá trị mới mỗi khi có, và app lắng nghe. Hôm nay app đăng ký nhận các notification đó và hiện mỗi giá trị ngay khi nó tới, dọc cả đường đi từ radio tới màn hình. Rồi nó xử lý chuyện kia mà thiết bị thật hay làm: biến mất. Một liên kết do người dùng kết thúc và một liên kết bị rớt phải để app ở cùng một trạng thái sạch sẽ, với mọi đăng ký và mọi request đang chờ đều được kết thúc, và lý do được báo một lần. Session service có một máy trạng thái duy nhất mà mọi lối ra đều đi qua, được test với radio giả. Đó là milestone **m11**: luồng BLE đầy đủ, và một app phục hồi được khi thiết bị biến mất.

!!! info "Nguồn chính"
    Trang [Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data) của Android (phần "Receive GATT notifications") trước mục 5. Với iOS, các trang [setNotifyValue(_:for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/setnotifyvalue(_:for:)) và [peripheral(_:didUpdateNotificationStateFor:error:)](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatenotificationstatefor:error:)) của Apple trước mục 6. Về coroutine, trang [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) của Kotlin (phần "Run non-cancelable blocks") trước mục 3. Mục 1 của bài 13 (notify và indicate) và mục 3 của bài 14 (`connect` kết thúc ra sao) trước khi bắt đầu.

!!! info "Track"
    Các khái niệm, các port, service, cả hai radio và các test (mục 1–6 và 9) giống nhau trên mọi track. Các track khác nhau ở màn hình chi tiết (mục 7), nơi XML Views và UIKit gặp một cái bẫy mà Compose và SwiftUI không gặp. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m10

| Cái gì | m10 | m11 |
|---|---|---|
| app core | khám phá và đọc trên liên kết đang mở | `BleConnection` có thêm `subscribe`, `unsubscribe` và `notifications`; `DeviceSession` có thêm `subscribe(characteristic): Flow<String>`; `Characteristic` có thêm `notifies`. `SessionService` kết thúc mọi đăng ký cùng liên kết của nó, và báo vì sao một kết nối kết thúc ở một chỗ duy nhất, `connect()` |
| adapter Android | kết nối, khám phá, đọc | còn bật và tắt notification (ghi descriptor CCCD) và chuyển tiếp mỗi `onCharacteristicChanged` |
| adapter iOS | nửa Swift trả lời lần đọc trong `didUpdateValueFor` và bỏ qua mọi giá trị khác | `setNotifyValue(_:for:)`, được trả lời trong `didUpdateNotificationStateFor`; mọi giá trị không phải câu trả lời của một lần đọc đi sang Kotlin dưới dạng notification |
| `SimulatedBleConnection` | bốn service, sáu characteristic đọc được | một giá trị mới mỗi giây cho mỗi characteristic được đăng ký; liên kết của Tire Pressure Sensor rớt 15 s sau khi kết nối |
| màn hình chi tiết | một nút Read ở chỗ được phép đọc | thêm Subscribe / Unsubscribe ở chỗ characteristic có notify, và mỗi giá trị hiện dưới nó ngay khi tới. Một lần khám phá thất bại không còn mở alert riêng |
| XML Views and UIKit | dựng lại các hàng service ở mỗi state | chỉ dựng lại khi các service hoặc các đăng ký đổi (gotcha của mục 7) |
| test | 54 mỗi nền tảng | 68 mỗi nền tảng: thêm 9 cho session service, thêm 4 cho ViewModel chi tiết, thêm 1 cho các model |

## 1. Notification: thiết bị nói trước

Một lần đọc là câu hỏi của app và một câu trả lời của thiết bị. Bảng của bài 13 có thêm hai property, **notify** và **indicate**: thiết bị tự gửi giá trị, mỗi lần nó đổi, tới một central đã xin. Hướng dẫn của Android: "Các app BLE thường xin được báo khi một characteristic cụ thể đổi trên thiết bị" ([Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data)).

Xin là một lần ghi. Một characteristic có thể notify có gắn kèm một attribute nhỏ, một **descriptor**, tên là **Client Characteristic Configuration** descriptor (CCCD), UUID `0x2902` trong [assigned numbers](https://bitbucket.org/bluetooth-SIG/public/src/main/assigned_numbers/uuids/descriptors.yaml) của SIG. Central ghi hai byte vào nó: `BluetoothGattDescriptor` của Android đặt tên chúng là `ENABLE_NOTIFICATION_VALUE` (`01 00`), `ENABLE_INDICATION_VALUE` (`02 00`) và `DISABLE_NOTIFICATION_VALUE` (`00 00`). Trên iOS bạn không tự ghi descriptor: `setNotifyValue(_:for:)` nhận "characteristic chứa client characteristic configuration descriptor" (`CBPeripheral.h`) và ghi hộ bạn, và header nói một CCCD không ghi được bằng `writeValue(_:for:)` trên descriptor: hãy dùng `setNotifyValue` thay vào.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 340" role="img" aria-labelledby="l16-time-title">
      <title id="l16-time-title">Một lần đọc và một lần đăng ký theo thời gian, từ trái sang phải, giữa app ở làn trên và thiết bị ở làn dưới. Một lần đọc: app gửi một request và thiết bị gửi một câu trả lời. Một lần đăng ký: app ghi 01 00 vào descriptor CCCD của characteristic và thiết bị trả lời lần ghi đó; từ đó thiết bị gửi một giá trị mỗi khi nó đổi, ba lần trong hình, không cần request nào từ app. Huỷ đăng ký là ghi 00 00 vào descriptor; thiết bị trả lời và không gửi giá trị nào nữa. Nếu liên kết rớt thay vào đó, không câu trả lời hay giá trị nào tới nữa, và app phải tự nhận ra và tự dọn dẹp.</title>
      <defs><marker id="l16-time-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <line class="axis" x1="90" y1="70" x2="740" y2="70"></line>
      <line class="axis" x1="90" y1="200" x2="740" y2="200"></line>
      <rect class="box" x="10" y="50" width="70" height="40" rx="6"></rect>
      <text class="title" x="22" y="75">app</text>
      <rect class="box" x="10" y="180" width="70" height="40" rx="6"></rect>
      <text class="title" x="18" y="205">thiết bị</text>
      <path class="edge" d="M110,70 L120,198" marker-end="url(#l16-time-arrow)"></path>
      <path class="edge dashed" d="M140,200 L150,72" marker-end="url(#l16-time-arrow)"></path>
      <text class="small" x="100" y="40">đọc:</text>
      <text class="small muted" x="100" y="56">một câu hỏi</text>
      <text class="small muted" x="100" y="232">một câu trả lời</text>
      <path class="edge" d="M230,70 L240,198" marker-end="url(#l16-time-arrow)"></path>
      <text class="mono small" x="200" y="40">CCCD ← 01 00</text>
      <path class="edge dashed" d="M260,200 L270,72" marker-end="url(#l16-time-arrow)"></path>
      <text class="small muted" x="236" y="232">trả lời: bật</text>
      <path class="edge dashed" d="M330,200 L340,72" marker-end="url(#l16-time-arrow)"></path>
      <path class="edge dashed" d="M390,200 L400,72" marker-end="url(#l16-time-arrow)"></path>
      <path class="edge dashed" d="M470,200 L480,72" marker-end="url(#l16-time-arrow)"></path>
      <circle class="dot" cx="340" cy="70" r="5"></circle>
      <circle class="dot" cx="400" cy="70" r="5"></circle>
      <circle class="dot" cx="480" cy="70" r="5"></circle>
      <text class="small" x="318" y="252">các giá trị, khi thiết bị muốn</text>
      <path class="edge" d="M540,70 L550,198" marker-end="url(#l16-time-arrow)"></path>
      <text class="mono small" x="510" y="40">CCCD ← 00 00</text>
      <path class="edge dashed" d="M570,200 L580,72" marker-end="url(#l16-time-arrow)"></path>
      <text class="small muted" x="550" y="232">trả lời: tắt</text>
      <text class="small" x="610" y="140">rồi im lặng</text>
      <text class="small muted" x="20" y="295">Liền: app ghi. Đứt: thiết bị gửi. Chấm: một notification tới app.</text>
      <text class="small muted" x="20" y="318">Một liên kết rớt kết thúc tất cả mà không nói một lời: không câu trả lời, không giá trị, không "tắt".</text>
    </svg>
    <figcaption>Một lần đọc là một vòng hỏi-đáp. Một lần đăng ký là một vòng hỏi-đáp để bật, rồi các giá trị theo nhịp của thiết bị, cho tới khi app tắt nó hoặc liên kết kết thúc.</figcaption>
  </figure>

1. **Notify hay indicate.** Bài 13: một notification đi "không cần phản hồi từ central để báo đã nhận"; một indication đi "kèm phản hồi từ central để báo đã nhận". App đăng ký cả hai theo cùng một cách, và nhận giá trị qua cùng một callback. Apple: "Nếu cấu hình của characteristic cho phép cả notification lẫn indication, gọi method này chỉ bật notification" ([setNotifyValue(_:for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/setnotifyvalue(_:for:))). Adapter Android chọn y như vậy.
2. **Bật là một request có câu trả lời**, giống một lần đọc: Android trả lời lần ghi descriptor trong `onDescriptorWrite`, iOS trong `peripheral(_:didUpdateNotificationStateFor:error:)`. Các giá trị sau đó không phải câu trả lời cho cái gì cả.
3. **Trong app này, một đăng ký thuộc về liên kết nó được tạo trên đó.** Khi liên kết kết thúc, session service kết thúc đăng ký, và sau khi kết nối lại người dùng đăng ký lại. Tự kết nối lại, và khôi phục các đăng ký, được để ngoài: Appendix A.3 đòi phát hiện lần rớt, dọn dẹp và cập nhật UI.

## 2. Các port lớn thêm, theo hai hình dạng

Outbound port có thêm hai công tắc và dòng chảy. Các công tắc là request trên liên kết, như lần đọc của bài 15; các giá trị là một dòng chảy, và bài 15 đã hứa nó sẽ là một `Flow`:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/BleConnection.kt" hl_lines="5 8 11 12 13"
⋯ connect, discoverServices and read, as in Lesson 15, then:
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

1. **Vì sao các công tắc là `suspend fun`.** Chúng nằm dưới quy tắc "mỗi lần một" của port. Trên Android, `BluetoothGatt.writeDescriptor` kiểm tra cùng cờ bận với các lần đọc của bài 15, và trả về `ERROR_GATT_WRITE_REQUEST_BUSY` khi một lần đọc hay ghi khác đang chờ câu trả lời (mã nguồn Android, API 35). Nên session service phải gửi chúng dưới `Mutex` của nó, việc cần một lời gọi treo cho tới khi có câu trả lời.
2. **Vì sao dòng chảy tách riêng.** Appendix A.3 gợi ý `subscribe(characteristic): Flow<ByteArray>` cạnh `unsubscribe(characteristic)`. Một `subscribe` trả về các giá trị sẽ bật khi `Flow` của nó được collect, và lúc đó service không biết request bật xong khi nào, nên không giữ khoá được đúng cho request đó. Hai hình dạng giữ mỗi bên trung thực: một request là một `suspend fun`, một dòng chảy là một `Flow` (bài 15, mục 2).
3. **"Collect trước, rồi mới đăng ký"** là một phần của hợp đồng, vì cả hai adapter giao giá trị qua một `SharedFlow`, một flow *nóng*: nó tồn tại dù có ai collect hay không. Không có replay cache thì nó không giữ gì để dành: "Mỗi subscriber mới trước hết nhận các giá trị từ replay cache rồi mới nhận các giá trị mới được phát" ([SharedFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/)). Mục 3 cho thấy thứ tự đó trong service.

Inbound port có thêm một thành viên. ViewModel muốn chữ, không muốn byte, nên service giải mã mỗi giá trị bằng bộ giải mã của bài 15, và lần đăng ký là một dòng chảy mà ViewModel collect:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt" hl_lines="3 4 6"
⋯ connectionState, connect, disconnect, services and read, as in Lesson 15, then:
    // The characteristic's values as text for the user, each time the device sends one.
    // Collecting subscribes, and cancelling the collection unsubscribes. The Flow ends when the
    // connection ends. Throws ConnectionException: not connected, a characteristic that doesn't
    // notify, or the device refused.
    fun subscribe(characteristic: Characteristic): Flow<String>
}
```

1. **Huỷ là huỷ đăng ký**, quy tắc app đã có cho các dòng chảy: huỷ việc collect `DeviceScanning.scan` thì dừng quét (bài 10), và huỷ bên collect `BleConnection.connect` thì đóng liên kết (bài 14). Nên inbound port không có `unsubscribe()`: một ViewModel bị clear, hay một màn hình huỷ job của nó, tự huỷ đăng ký mà không cần nhớ.
2. **Kết nối kết thúc thì Flow kết thúc bình thường**, không có exception. Vì sao kết nối kết thúc là việc `connect()` nói: comment của nó giờ kết thúc bằng "Đó là chỗ duy nhất báo lý do một kết nối kết thúc" (mục 4).
3. **Characteristic nào notify** là một quy tắc, nên nó nằm trên model: `Characteristic` có thêm `val notifies: Boolean`, mà getter là `CharacteristicProperty.Notify in properties || CharacteristicProperty.Indicate in properties`. Một property có getter trong thân class không thuộc `equals` của data class; Swift thấy nó là `characteristic.notifies`.

## 3. Session service: một lần đăng ký

Service biến một lần collect thành một lần đăng ký: kiểm tra quy tắc, lắng nghe, bật trong khoá, chờ, và tắt khi bên collect đi mất.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="1 4 8 10 14 15 16 18 21"
    override fun subscribe(characteristic: Characteristic): Flow<String> = channelFlow {
        connectedDevice()
        val current = link ?: throw ConnectionException("Connect to the device first.")
        if (!characteristic.notifies) {
            throw ConnectionException("This characteristic doesn't notify: it has no Notify or Indicate property.")
        }
⋯ a comment: listen first, then ask
        val values = launch(start = CoroutineStart.UNDISPATCHED) {
            connection.notifications(characteristic).collect { bytes ->
                send(ValueDecoder.decode(characteristic.uuid, bytes))
            }
        }
        try {
            requests.withLock { connection.subscribe(characteristic) }
            current.join() // a subscription lasts as long as the link it was made on
        } catch (e: CancellationException) {
⋯ a comment: the collector went away while the link is up
            if (current.isActive) withContext(NonCancellable) { stopNotifications(characteristic) }
            throw e
        }
        values.cancel() // the link ended: so does this Flow
    }
```

1. **`channelFlow`**, vì các giá trị được gửi từ một coroutine mà khối launch: nó "cho phép phần tử được tạo bởi code chạy trong context khác hoặc chạy đồng thời", và "kết thúc ngay khi code trong khối và mọi con của nó kết thúc" ([channelFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/channel-flow.html)). `callbackFlow` của bài 13 là một `channelFlow` làm cho callback. Như mọi `flow { }`, không gì chạy cho tới khi có ai collect.
2. **Nghe trước, rồi mới xin.** `CoroutineStart.UNDISPATCHED` "Chạy coroutine ngay lập tức cho tới điểm treo đầu tiên trên thread hiện tại" ([UNDISPATCHED](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-coroutine-start/-u-n-d-i-s-p-a-t-c-h-e-d/)): bên collect được đăng ký trên `SharedFlow` của adapter trước khi dòng tiếp theo gửi request bật. Một `launch` thường chỉ xếp nó vào hàng. Nói thật: với một `launch` thường mọi test vẫn pass (chúng tôi đã thử), vì request treo trước khi có câu trả lời nào tới được và bên collect trong hàng chạy lúc đó. `UNDISPATCHED` biến thứ tự đó thành một đảm bảo thay vì một đặc điểm của dispatcher.
3. **`current.join()`** chờ `Job` của liên kết từ bài 14. `join` "tiếp tục bình thường (không có exception) khi job kết thúc vì bất kỳ lý do gì" ([Job.join](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-job/join.html)): Disconnect, rớt kết nối, hết giờ, khám phá thất bại. Một dòng đó là cách mọi đăng ký kết thúc cùng liên kết của nó.
4. **`values.cancel()`** là cần thiết vì "Shared flow không bao giờ kết thúc. Một lời gọi Flow.collect trên shared flow không bao giờ kết thúc bình thường" ([SharedFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/)): thiếu nó, coroutine con sẽ giữ `channelFlow` mở mãi. Chúng tôi đã gỡ nó ra để kiểm tra: hai test kết thúc một liên kết khi đang đăng ký bị treo cho tới khi `runTest` bỏ cuộc.
5. **Một lần huỷ đăng ký tới dưới dạng một lần huỷ.** Khi ViewModel huỷ việc collect, coroutine chạy khối này bị huỷ, và `CancellationException` thoát ra từ `join()` (hoặc từ request, nếu nó vẫn đang chờ). Khối bắt nó, gửi request tắt, và ném lại, như việc huỷ bắt buộc phải làm.
6. **`NonCancellable`.** Trong một coroutine đã bị huỷ, lời gọi tiếp theo thật sự treo sẽ ném lỗi thay vì treo: "Nếu coroutine treo ở đó, hàm suspend kiểm tra xem nó đã bị huỷ chưa. Nếu rồi, coroutine dừng và ném `CancellationException`." Request chờ câu trả lời của thiết bị, nên nó sẽ không bao giờ xong. Lại hướng dẫn của Kotlin: "truyền `NonCancellable` làm tham số cho hàm builder coroutine `withContext()`", thứ "hữu ích khi bạn cần đảm bảo một số thao tác … hoàn tất kể cả khi coroutine bị huỷ" ([Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html)). Thiếu nó, `cancellingTheCollectionUnsubscribes` fail: lần chờ 100 ms của fake ném lỗi, và không lần huỷ đăng ký nào được ghi lại.
7. **`current.isActive`**: chỉ khi liên kết còn lên. Nếu màn hình đang đóng, ViewModel của nó huỷ cả kết nối lẫn đăng ký cùng lúc; không còn liên kết nào để gửi tới.

`stopNotifications` gửi `connection.unsubscribe` trong cùng khoá và nuốt một `ConnectionException`: tắt là dọn dẹp, bên collect đã đi mất, và nếu liên kết đang đóng hay thiết bị từ chối thì không còn gì để làm.

## 4. Một máy trạng thái, mọi lối ra

Bài 14 đã cho service là bên duy nhất ghi `ConnectionState`. Với các request và đăng ký trên liên kết, "nhất quán" giờ nghĩa là nhiều hơn state: kết nối kết thúc bằng cách nào thì cũng phải xảy ra cùng những việc, một lần.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 380" role="img" aria-labelledby="l16-states-title">
      <title id="l16-states-title">Máy trạng thái kết nối của session service. Disconnected sang Connecting khi connect() được gọi. Connecting sang Connected khi liên kết lên. Năm lối dẫn về Disconnected, vẽ thành ba mũi tên: từ Connecting, hết giờ hoặc một lần thử thất bại; từ Connected, Disconnect hoặc bên gọi bị huỷ; và, cũng từ Connected, một liên kết bị rớt hoặc một lần khám phá thất bại. Cả năm đều đi qua một khối finally trong connect(), khối đặt state về Disconnected, hoàn tất Job của liên kết để mọi đăng ký kết thúc, và để adapter đóng liên kết của radio và làm thất bại mọi request còn đang chờ. Chỉ Disconnect và bên gọi bị huỷ là trả về bình thường từ connect(); ba lối kia ném một ConnectionException kèm lý do, báo một lần.</title>
      <defs><marker id="l16-states-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="core">
        <rect class="box" x="20" y="40" width="160" height="50" rx="6"></rect>
        <text class="title" x="34" y="70">Disconnected</text>
        <rect class="box" x="300" y="40" width="160" height="50" rx="6"></rect>
        <text class="title" x="314" y="70">Connecting</text>
        <rect class="box" x="580" y="40" width="160" height="50" rx="6"></rect>
        <text class="title" x="594" y="70">Connected</text>
        <rect class="box" x="140" y="250" width="480" height="100" rx="6"></rect>
        <text class="title" x="156" y="274">finally, trong connect(): cùng một việc dọn dẹp trên mọi đường</text>
        <text class="small" x="156" y="296">state = Disconnected · link = null</text>
        <text class="small" x="156" y="316">Job của liên kết đã xong: join() của mọi đăng ký trả về</text>
        <text class="small" x="156" y="336">adapter đã đóng liên kết của radio và làm thất bại mọi request đang chờ</text>
      </g>
      <path class="edge" d="M180,58 L298,58" marker-end="url(#l16-states-arrow)"></path>
      <text class="mono small" x="196" y="50">connect()</text>
      <path class="edge" d="M460,58 L578,58" marker-end="url(#l16-states-arrow)"></path>
      <text class="small" x="484" y="50">liên kết lên</text>
      <path class="edge dashed" d="M380,90 L360,248" marker-end="url(#l16-states-arrow)"></path>
      <text class="small" x="384" y="130">hết giờ · lần thử thất bại</text>
      <text class="small muted" x="384" y="146">connect() ném lỗi</text>
      <path class="edge" d="M600,90 L520,248" marker-end="url(#l16-states-arrow)"></path>
      <text class="small" x="566" y="170">Disconnect · bên gọi bị huỷ</text>
      <text class="small muted" x="566" y="186">connect() trả về</text>
      <path class="edge dashed" d="M660,90 L600,248" marker-end="url(#l16-states-arrow)"></path>
      <text class="small" x="636" y="120">bị rớt</text>
      <text class="small" x="636" y="136">khám phá thất bại</text>
      <text class="small muted" x="636" y="152">connect() ném lỗi</text>
      <path class="edge" d="M140,300 L100,300 L100,92" marker-end="url(#l16-states-arrow)"></path>
      <text class="small muted" x="20" y="372">Liền: app đã xin. Đứt: nó xảy ra với app; lý do tới màn hình một lần, từ connect().</text>
    </svg>
    <figcaption>Ba trạng thái, năm lối về Disconnected, và một <code>finally</code> mà tất cả đều đi qua.
<ul class="legend">
    <li data-part="core">App core (<code>SessionService</code>)</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="1 8 13"
    private var endedBy: ConnectionException? = null // why the service itself ended the link
⋯ in connect(device), after the checks:
        try {
            coroutineScope {
⋯ link = launch { … }, as in Lesson 14
            }
            // The link was cancelled: by disconnect(), or by the service for a reason of its own.
            endedBy?.let { throw it }
        } finally {
            // Every way out ends here: the link's Job is complete, so its subscriptions end, and
            // the adapter has closed the radio's link and failed any request still waiting.
            link = null
            endedBy = null
            state.value = ConnectionState.Disconnected
        }
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt" hl_lines="8 9 10"
    override suspend fun services(): List<DeviceService> {
        val device = connectedDevice()
        return try {
            requests.withLock { connection.discoverServices() }
        } catch (e: ConnectionException) {
            val failure = ConnectionException("Couldn't discover the services of ${device.name}. ${e.message}")
            // Only a link that is still up: after a drop or a Disconnect, that is what ended it.
            link?.takeIf { it.isActive }?.let { current ->
                endedBy = failure
                current.cancel()
            }
            throw failure
        }
    }
```

1. **Thủ công hay bất ngờ.** Disconnect huỷ liên kết; một con bị huỷ không làm cha của nó thất bại, nên `coroutineScope` trả về và `connect()` trả về bình thường (bài 14). Một lần rớt tới dưới dạng `ConnectionException` của adapter ("The link to … was lost"), thứ làm `coroutineScope` thất bại, và `connect()` ném nó. Cả hai rồi chạy cùng một `finally`.
2. **Lý do riêng của service.** Ở m10, một lần khám phá thất bại gọi `disconnect()`, nên `connect()` trả về như thể người dùng đã xin, và ViewModel phải tự hiện thông báo của lần khám phá. Giờ service ghi lý do vào `endedBy` và huỷ liên kết; `connect()` ném nó sau khi `coroutineScope` trả về.
3. **Báo một lần.** Khi liên kết rớt trong lúc khám phá, cả hai lời gọi thất bại: `connect()` với lần rớt, và `services()` với "Couldn't discover the services of … The link closed before the device answered." Ở m10 ViewModel phải tung hứng cả hai: `discover()` chỉ đặt thông báo của nó nếu chưa có cái nào đang chờ, và `connect()` ghi đè bất cứ thứ gì đang có. Quy tắc giờ là: việc một kết nối kết thúc chỉ được báo bởi `connect()`, nên người dùng đọc thấy nguyên nhân (lần rớt), không phải một hệ quả. ViewModel bỏ qua lỗi của `services()` (mục 7).
4. **`takeIf { it.isActive }`** là quy tắc đó viết thành code. Sau một Disconnect hay một lần rớt, `Job` của liên kết không còn active, dù `link` có thể vẫn trỏ tới nó trong chốc lát. Không có kiểm tra này, một Disconnect trong lúc khám phá làm `connect()` ném "Couldn't discover the services…" cho một lần ngắt kết nối mà chính người dùng đã xin: `aDisconnectDuringDiscoveryIsNotAnError` fail khi chúng tôi gỡ nó ra.

| Kết nối kết thúc ra sao | `connect()` | Các đăng ký | Một request còn đang chờ | Màn hình |
|---|---|---|---|---|
| Disconnect, hoặc màn hình đã đóng | trả về | kết thúc bình thường | thất bại: "The link closed before the device answered." | "not connected", không có alert |
| liên kết bị rớt | ném "was lost" của adapter | kết thúc bình thường | thất bại theo cùng cách | một alert: lần rớt |
| khám phá thất bại trên một liên kết còn sống | ném "Couldn't discover…" | chưa có | không có | một alert: lần khám phá |
| hết giờ, hoặc lần thử thất bại | ném lỗi, như ở bài 14 | không có | không có | một alert |

Phục hồi, trong app này, là điều bảng đó đảm bảo: dù chuyện gì đã xảy ra, state đã về Disconnected, không gì từ liên kết cũ còn chạy hay còn chờ, và Connect bắt đầu một liên kết mới (`connectsAgainAfterADrop` kiểm tra điều đó, cả phần khám phá).

## 5. Android: hai công tắc và một dòng chảy

Hướng dẫn của Android làm theo hai bước: `setCharacteristicNotification()`, rồi ghi descriptor; và "Khi notification đã được bật cho một characteristic, callback `onCharacteristicChanged()` được kích hoạt nếu characteristic đổi trên thiết bị ở xa" ([Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data)).

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="5 7 12 13 17"
    @SuppressLint("MissingPermission")
    override suspend fun subscribe(characteristic: Characteristic) {
        val gatt = openGatt()
        val target = gatt.find(characteristic)
        val cccd = target.getDescriptor(CCCD)
            ?: throw ConnectionException("This characteristic has no notification switch (no CCCD).")
        if (!gatt.setCharacteristicNotification(target, true)) {
            throw ConnectionException("Android couldn't turn on notifications.")
        }
        // Notify if the characteristic has it, otherwise Indicate: the value says which.
        val notify = target.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0
        val on = if (notify) BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
        writeCccd(gatt, cccd, on)
    }
⋯ unsubscribe(characteristic): setCharacteristicNotification(target, false), then writeCccd(…, DISABLE_NOTIFICATION_VALUE)
⋯ in the companion object:
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
```

1. **Hai công tắc, hai phía.** `setCharacteristicNotification` làm việc bên trong điện thoại: trong mã nguồn Android nó đăng ký app này với Bluetooth stack (`registerForNotification`), và tài liệu của nó nói khi notification đã được bật, một callback `onCharacteristicChanged` "sẽ được kích hoạt nếu thiết bị ở xa báo characteristic đã đổi". Lần ghi descriptor là thứ xin thiết bị gửi. Hướng dẫn của Android làm cả hai, và adapter cần cả hai.
2. **UUID của CCCD** là `0x2902` ở dạng 128-bit mà Android cần (bài 13: SDK public của Android không có hằng nào cho base UUID, và cũng không có cho descriptor này). `find` là việc tra service rồi characteristic của bài 15, dời vào một hàm phụ mà giờ `read` cũng dùng.
3. **Một thiết bị không có descriptor** thì không đăng ký được, dù property của nó nói gì, nên adapter nói rõ điều đó thay vì thất bại ở chỗ nào đó sâu hơn.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="3 4 5 7 19"
    // A descriptor write is a request like a read: one at a time, answered in onDescriptorWrite.
    private suspend fun writeCccd(gatt: BluetoothGatt, cccd: BluetoothGattDescriptor, value: ByteArray) {
        val answer = request {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeDescriptor(cccd, value) == BluetoothStatusCodes.SUCCESS
            } else {
                writeDescriptorBefore33(gatt, cccd, value)
            }
        }
        if (answer.status != BluetoothGatt.GATT_SUCCESS) {
            throw ConnectionException("The device refused to change its notifications (Android status ${answer.status}).")
        }
    }

    // Android 12 and earlier: the value goes into the descriptor object, then the write sends it.
    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private fun writeDescriptorBefore33(gatt: BluetoothGatt, cccd: BluetoothGattDescriptor, value: ByteArray): Boolean {
        cccd.value = value
        return gatt.writeDescriptor(cccd)
    }
```

1. **Hai `writeDescriptor`.** API 33 thêm `writeDescriptor(descriptor, value)`, trả về một mã status, và deprecate cái cũ, cái gửi bất cứ thứ gì nằm trong object descriptor (`api-versions.xml`: cái cũ `deprecated="33"`, cái mới `since="33"`; `BluetoothGattDescriptor.setValue` cũng bị deprecate ở 33). Tài liệu của cái cũ nói lý do: nó "không an toàn bộ nhớ vì dựa vào một object `BluetoothGattDescriptor` mà các trường bên dưới có thể bị đổi ngoài method này". App chạy từ API 26, nên nó kiểm tra `SDK_INT`, cùng mốc `TIRAMISU` với hai `onCharacteristicRead` của bài 15.
2. **Câu trả lời tới qua `request` của bài 15**: một ô `answer` duy nhất, được hoàn tất bởi một callback mới, `onDescriptorWrite(gatt, descriptor, status)`. Nó an toàn chỉ vì service gửi mỗi lần một request (mục 2, ý 1).
3. **Mẫu trong hướng dẫn của Android** gán `descriptor.value`, gọi `writeDescriptor` cũ và trả về, không chờ `onDescriptorWrite`. Chép vào adapter này, một lần đọc gửi ngay sau đó có thể bị từ chối vì bận, vì lần ghi giữ cờ bận cho tới khi có câu trả lời.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt" hl_lines="2 6 11 17"
⋯ in the class:
    private val notified = MutableSharedFlow<Notified>(extraBufferCapacity = 64)
⋯ in the callback object:
            // A notification (or indication): not an answer to any request. Android 13 (API 33)
            // and later call this one, with the value.
            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
            ) {
                notified.tryEmit(characteristic.notified(value))
            }
⋯ Android 12 and earlier call onCharacteristicChanged(gatt, characteristic): the value is in characteristic.value
⋯ further down:
    override fun notifications(characteristic: Characteristic): Flow<ByteArray> =
        notified
            .filter { it.serviceUuid == characteristic.serviceUuid && it.uuid == characteristic.uuid }
            .map { it.value }
```

1. **`tryEmit` từ một background thread.** Các callback chạy trên background thread (bài 15). "Mọi method của shared flow đều thread-safe và có thể gọi an toàn từ các coroutine đồng thời mà không cần đồng bộ bên ngoài" ([MutableSharedFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-shared-flow/)), và `tryEmit` không treo, thứ một callback không làm được. `extraBufferCapacity = 64` cho một bên collect chậm chút chỗ trống; khi đầy, `tryEmit` trả `false` và giá trị đó bị bỏ.
2. **Hai `onCharacteristicChanged`**, như với lần đọc của bài 15. Trong mã nguồn Android, thân mặc định của cái mới gọi cái cũ; override của chúng ta cho cái mới không gọi, nên mỗi giá trị chỉ được chuyển tiếp một lần. Tài liệu của cái mới nói vì sao nó tồn tại: "giá trị bên trong object characteristic có thể đã đổi kể từ lúc nhận notification từ xa, nên hãy xem tham số value để có giá trị tại thời điểm notification".
3. **Một dòng chảy cho mọi characteristic**, được lọc theo từng bên gọi. `notified(value)` dựng khoá bằng `fullUuid` trên cả hai UUID, cùng cách viết mà `Characteristic` của app core dùng (bài 15).
4. **Không có gì để dọn ở đây.** `awaitClose` của bài 14 đóng GATT client, sau đó không callback nào tới nữa, và `completeExceptionally` của bài 15 làm thất bại một request bật/tắt còn đang chờ.

!!! warning "Gotcha · emulator vẫn không cho thấy được nó với một thiết bị thật"
    Như ở bài 15, một lần đăng ký thật cần điện thoại Android của bạn và LightBlue với một characteristic có notify: nó nằm trong danh sách kiểm tra trên thiết bị. Trên emulator, adapter thật vẫn cho thấy lần hết giờ của bài 14 (mục 10), và adapter giả lập cho thấy màn hình.

## 6. iOS: một công tắc, và một callback cho hai việc

Nửa Kotlin có thêm cùng ba thành viên, và nửa Swift có thêm một lời gọi mới trên `IosLink`, đặt theo tên của chính CoreBluetooth:

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/LinkedBleConnection.kt" hl_lines="2 5 10 13 16"
⋯ in LinkedBleConnection:
    private val notified = MutableSharedFlow<Notified>(extraBufferCapacity = 64)

    override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
        link.open(device, LinkFeed(this, notified))
        awaitClose { link.close() }
    }
⋯ discoverServices, read: as in Lesson 15
    override suspend fun subscribe(characteristic: Characteristic) =
        suspendCancellableCoroutine { link.setNotify(characteristic, true, NotifyReply(it)) }
⋯ unsubscribe: the same with false; notifications: filtered as on Android
⋯ in IosLink:
    fun setNotify(characteristic: Characteristic, on: Boolean, reply: NotifyReply)
⋯ in LinkFeed:
    // iOS can report a standard UUID in its short form: fullUuid makes it match the app's.
    fun notified(serviceUuid: String, characteristicUuid: String, value: NSData) {
        notifications.tryEmit(Notified(fullUuid(serviceUuid), fullUuid(characteristicUuid), value.toByteArray()))
    }
```

1. **`NotifyReply`** có `done()` và `failed(message)`: các object reply của bài 15, cho một request mà câu trả lời chỉ là "được rồi". Kotlin tạo `ConnectionException`, như trước.
2. **Các giá trị đi qua `LinkFeed`**, object mà Swift đã báo các state của liên kết tới, nên một giá trị chỉ có thể tới từ liên kết đang mở. `fullUuid` chạy trong Kotlin, một lần, cho cách viết của cả hai nền tảng.

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="7 8 12 19"
    // On or off. CoreBluetooth writes the characteristic's CCCD descriptor itself.
    func setNotify(characteristic: Characteristic, on: Bool, reply: NotifyReply) {
        guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
        guard let target = target(for: characteristic, on: peripheral) else {
            return reply.failed(message: "This device has no such characteristic. Discover its services again.")
        }
        switching = (target, reply)
        peripheral.setNotifyValue(on, for: target)
    }
⋯ in the peripheral delegate:
    // The answer to setNotifyValue(_:for:): notifications are now on or off, or the device refused.
    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic,
                    error: Error?) {
        guard peripheral === self.peripheral, let switching, switching.characteristic === characteristic else { return }
        self.switching = nil
        if let error {
            switching.reply.failed(message: "The device refused to change its notifications: \(error.localizedDescription)")
        } else {
            switching.reply.done()
        }
    }
```

1. **Callback riêng của câu trả lời.** Apple: "Core Bluetooth gọi method này khi app gọi method `setNotifyValue(_:for:)`. Nếu thành công, tham số error là nil" ([didUpdateNotificationStateFor](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatenotificationstatefor:error:))). Nó tới delegate của peripheral, kèm cả cái bẫy của bài 15: không có delegate, không có câu trả lời, và request cứ chờ.
2. **`target(for:on:)`** là việc tra theo `CBUUID` của bài 15, dời vào một hàm phụ mà `read` cũng dùng. `close()` làm thất bại một request `switching` còn đang chờ, như với một lần khám phá hay đọc.

```swift title="iosApp/iosApp/IosBleConnection.swift" hl_lines="6 8 9"
    // Called after readValue(for:), and for each notification. The read waiting for this
    // characteristic takes the first value; any other value is a notification.
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
                    error: Error?) {
        guard peripheral === self.peripheral else { return }
        if let reading, reading.characteristic === characteristic {
⋯ the read's answer, as in Lesson 15
        } else if error == nil, let value = characteristic.value, let service = characteristic.service {
            feed?.notified(serviceUuid: service.uuid.uuidString, characteristicUuid: characteristic.uuid.uuidString,
                           value: value)
        }
    }
```

1. **Lời hứa của bài 15 được giữ.** Apple: "Nếu thành công, sau đó peripheral gọi method `peripheral(_:didUpdateValueFor:error:)` của object delegate mỗi khi giá trị characteristic đổi" ([setNotifyValue(_:for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/setnotifyvalue(_:for:))). Cùng method đó trả lời các lần đọc, nên adapter phân loại: một giá trị cho characteristic mà một lần đọc đang chờ là câu trả lời của lần đọc đó; mọi giá trị khác là notification.
2. **`characteristic.service`** là một con trỏ ngược `weak` (`CBCharacteristic.h`), nên Swift thấy nó là optional.

!!! warning "Gotcha · trên iOS, một lần đọc và một notification trông y hệt nhau"
    `didUpdateValueFor` không mang cờ nào nói "đây là notification". Đọc một characteristic bạn đang đăng ký, và giá trị đầu tiên tới cho nó sẽ trả lời lần đọc, dù thiết bị gửi nó làm phản hồi cho lần đọc hay làm một notification ngay trước đó. Cách nào thì nó cũng là giá trị hiện tại và màn hình hiện nó dưới characteristic, nhưng giá trị đó đi tới lần đọc, không tới `Flow` của lần đăng ký. Android tách hai cái ra, trong `onCharacteristicRead` và `onCharacteristicChanged`.

## 7. Màn hình chi tiết

ViewModel giữ một lần collect cho mỗi characteristic được đăng ký, và UI state có thêm `subscribed`, tập quyết định một nút ghi Subscribe hay Unsubscribe. Mỗi giá trị notify nằm đúng chỗ giá trị của một lần đọc nằm, dưới characteristic của nó.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceDetailViewModel.kt" hl_lines="1 5 8 12 19"
    private val subscriptions = mutableMapOf<Characteristic, Job>()
⋯ init, connect, disconnect and read, as in Lesson 15
    fun subscribe(characteristic: Characteristic) {
        if (subscriptions[characteristic]?.isActive == true) return
        subscriptions[characteristic] = viewModelScope.launch {
            _uiState.update { it.copy(subscribed = it.subscribed + characteristic) }
            try {
                session.subscribe(characteristic).collect { value -> showUnder(characteristic, value) }
            } catch (e: ConnectionException) {
                showUnder(characteristic, "Subscribe failed: ${e.message}")
            } finally {
                _uiState.update { it.copy(subscribed = it.subscribed - characteristic) }
            }
        }
    }

    // Cancelling the collection is the unsubscribe: the session asks the device to stop.
    fun unsubscribe(characteristic: Characteristic) {
        subscriptions.remove(characteristic)?.cancel()
    }
⋯ showUnder(characteristic, text): only while connected, as Lesson 15's read did
```

1. **`finally` giữ `subscribed` đúng với thực tế.** Lần collect kết thúc bằng cách nào (Unsubscribe, kết nối kết thúc, bị từ chối), nút cũng quay về Subscribe.
2. **Trong `viewModelScope`**, nên một lần đăng ký sống qua một lần xoay, như kết nối (bài 14), và kết thúc khi màn hình đi hẳn: clear ViewModel thì huỷ lần collect, và cả kết nối (bài 14), nên không còn liên kết nào để gửi request.
3. **Một lần đăng ký bị từ chối nằm cạnh characteristic của nó**, như một lần đọc bị từ chối: kết nối vẫn ổn.
4. **`discover()` không còn đặt `errorMessage`.** `catch` của nó để trống kèm một comment, "connect() shows the reason": quy tắc của mục 4, nhìn từ màn hình. `aFailedDiscoveryOpensNoAlertOfItsOwn` kiểm tra điều đó.

Mọi track thêm, sau nút Read, một nút Subscribe cho characteristic có notify, nút này ghi Unsubscribe khi đang đăng ký. Dòng giá trị dưới characteristic hiện giá trị mới nhất, đọc được hay được notify.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailScreen.kt" hl_lines="2 3 10"
    ⋯ in ServiceSection, which now takes the whole state, onRead, onSubscribe and onUnsubscribe, after the Read button:
                        if (characteristic.notifies) {
                            if (characteristic in state.subscribed) {
                                OutlinedButton(onClick = { onUnsubscribe(characteristic) }) { Text("Unsubscribe") }
                            } else {
                                OutlinedButton(onClick = { onSubscribe(characteristic) }) { Text("Subscribe") }
                            }
                        }
                    }
                    state.values[characteristic]?.let { Text(it) }
    ```

    `DeviceDetailScreen` truyền `onSubscribe = viewModel::subscribe` và `onUnsubscribe = viewModel::unsubscribe`, và hàng có thêm `horizontalArrangement = Arrangement.spacedBy(8.dp)` để hai nút không dính nhau. Một giá trị tới mỗi giây thì recompose đoạn chữ, và các nút vẫn là các node cũ: một lần nhấn giữ 1,5 s trên nút Subscribe của một hàng khác, trong lúc giá trị đang tới, vẫn đăng ký được (chúng tôi đã kiểm tra trên emulator API 36).

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceDetailFragment.kt" hl_lines="3 4 7 9"
    ⋯ two new properties: builtFor, a Pair of the services and the subscribed set, and valueViews, a map from Characteristic to TextView
        private fun renderServices(container: LinearLayout, state: DeviceDetailUiState) {
            if (builtFor != state.services to state.subscribed) {
                buildServices(container, state)
                builtFor = state.services to state.subscribed
            }
            for ((characteristic, view) in valueViews) {
                val value = state.values[characteristic]
                view.text = value.orEmpty()
                view.visibility = if (value == null) View.GONE else View.VISIBLE
            }
        }
    ⋯ buildServices: Lesson 15's rows, plus a Subscribe / Unsubscribe Button and an empty value TextView per characteristic, kept in valueViews
    ```

    `onDestroyView` đặt `builtFor` về `null` và làm rỗng `valueViews`, để các view tạo ra sau một lần xoay có hàng riêng của chúng. `a to b` dựng một `Pair`, một data class, nên `!=` so sánh cả list lẫn set.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Compose giữ các node nút khi chỉ một giá trị đổi, vì nó so thứ bạn mô tả với thứ nó đã vẽ. Fragment ở bài 15 dựng lại mọi hàng ở mỗi state, việc đó ổn cho một giá trị chỉ đổi khi bạn bấm Read. Với một giá trị tới mỗi giây, nó thay mất cái nút dưới ngón tay bạn: trên emulator API 36, một lần nhấn giữ 1,5 s trên nút Subscribe trong lúc giá trị pin đang tới không làm gì cả. Chỉ dựng lại khi các hàng đổi, và cập nhật các dòng giá trị tại chỗ, đã sửa được (cùng lần nhấn đó sau đó đăng ký được).

!!! warning "Gotcha · một view dựng lại ở mỗi giá trị nuốt mất lần bấm (XML Views, UIKit)"
    Một lần bấm là một lần nhấn và một lần nhả trên cùng một view. Gỡ view đó đi giữa hai lần và lần nhả rơi vào một view mới chưa từng thấy lần nhấn: không có click, không có lỗi. Thói quen "dựng lại từ state mỗi lần" của bài 15 ổn với state đổi khi người dùng hành động; với state tự đổi, mỗi giây, hãy cập nhật tại chỗ thứ đã đổi, hoặc dùng một list biết so khác biệt (`RecyclerView` với `DiffUtil`, một diffable data source trên iOS). Chúng tôi thấy nó trên cả XML và UIKit (mục 10); Compose và SwiftUI tự so khác biệt cho bạn.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceDetailView.swift" hl_lines="2 3 12"
    ⋯ in ServiceSection, which now takes the whole state, onRead, onSubscribe and onUnsubscribe, after the Read button:
                            if characteristic.notifies {
                                if state.subscribed.contains(characteristic) {
                                    Button("Unsubscribe") { onUnsubscribe(characteristic) }
                                        .buttonStyle(.bordered)
                                } else {
                                    Button("Subscribe") { onSubscribe(characteristic) }
                                        .buttonStyle(.bordered)
                                }
                            }
                        }
                        if let value = state.values[characteristic] {
    ```

    `state.subscribed` tới dưới dạng một `Set<Characteristic>` của Swift; `contains` chạy được vì một data class Kotlin là `Hashable` qua `equals` và `hashCode` của nó (bài 15). `DeviceDetailView` truyền `onSubscribe: { viewModel.subscribe(characteristic: $0) }` và tương tự cho `unsubscribe`.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceDetailViewController.swift" hl_lines="3 4 8 10"
    ⋯ three new properties: builtServices, builtSubscribed and valueLabels, a dictionary from Characteristic to UILabel
        private func renderServices(_ state: DeviceDetailUiState) {
            if builtServices != state.services || builtSubscribed != state.subscribed {
                buildServices(state)
                builtServices = state.services
                builtSubscribed = state.subscribed
            }
            for (characteristic, label) in valueLabels {
                let value = state.values[characteristic]
                label.text = value
                label.isHidden = value == nil
            }
        }
    ⋯ buildServices: Lesson 15's rows, plus a Subscribe / Unsubscribe button and a value label per characteristic, kept in valueLabels
    ```

    Một arranged subview bị ẩn không chiếm chỗ trong `UIStackView`, nên một dòng giá trị rỗng không tốn gì. Một lần xoay không tạo lại view controller hay các view của nó, nên, khác với Fragment, không có gì cần đặt lại.


!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    `ForEach` của SwiftUI định danh mỗi hàng và giữ nút của nó khi chỉ có chữ đổi. `render(_:)` của UIKit ở bài 15 gỡ rồi thêm lại mọi hàng, và trong XCUITest của chúng tôi một lần nhấn giữ 1,5 s trên nút Subscribe, trong lúc giá trị pin đang tới, không làm gì cả; khi các hàng chỉ được dựng lúc chúng đổi, cùng lần nhấn đó đăng ký được.

## 8. Một thiết bị bị rớt, giả lập

Thiết bị giả lập giờ gửi giá trị, và một thiết bị mẫu tự biến mất, để bạn xem được việc phục hồi trên emulator và Simulator:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/outbound/SimulatedBleConnection.kt" hl_lines="2 3 4 9 15 16"
⋯ in connect(device), once connected:
            if (device.name == "Tire Pressure Sensor") {
                delay(DROP_AFTER)
                throw ConnectionException("The link to ${device.name} was lost (simulated).")
            }
            awaitCancellation()
        } finally {
            linked = false
            subscribed.clear() // a new link starts with every notification off
        }
⋯ subscribe and unsubscribe add and remove the UUID after 200 ms; then:
    override fun notifications(characteristic: Characteristic): Flow<ByteArray> = flow {
        var tick = 0
        while (true) {
            delay(1000)
            if (linked && characteristic.uuid in subscribed) emit(valueAt(characteristic.uuid, tick++))
        }
    }
```

`DROP_AFTER` là 15 giây, đủ để đăng ký và xem vài giá trị trước. `valueAt` đếm pin lùi từ 81 %, tăng nhiệt độ thêm 0,05 °C từ 21,55 °C, và gửi `00 00`, `00 01`, … cho characteristic chỉ-notify. Khác với adapter thật, `notifications` giả lập là một `flow { }` lạnh: mỗi bên collect nhận giá trị riêng của nó, chừng đó là đủ cho một thiết bị giả vờ. Phần nối dây không đổi trên cả hai nền tảng; để xem màn hình mà không cần radio, truyền cả hai adapter giả lập, như ở bài 15.

## 9. Test: radio giả làm rớt liên kết

`FakeBleConnection` học các lời gọi mới, và một hành vi của adapter thật mà fake của bài 15 bỏ qua: một request đang chờ khi liên kết đóng thì thất bại ngay.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeBleConnection.kt" hl_lines="8 9 14"
⋯ subscribeFailure, notifying (what the device is notifying for), unsubscribes, and notified: a MutableSharedFlow
    private suspend fun <T> request(answer: () -> T): T {
        if (!isLinked) throw ConnectionException("Not connected.")
        val closed = linkClosed
⋯ inProgress and mostAtOnce, as in Lesson 15
        try {
            // null: 100 ms went by and the link is still up
            if (withTimeoutOrNull(100) { closed.await() } != null) {
                throw ConnectionException("The link closed before the device answered.")
            }
            return answer()
⋯ finally { inProgress-- }; connect()'s finally completes linkClosed
    // The device sends a new value for characteristic, if its notifications are on.
    fun notifyValue(characteristic: Characteristic, vararg bytes: Int) {
        if (characteristic in notifying) {
            notified.tryEmit(characteristic to ByteArray(bytes.size) { bytes[it].toByte() })
        }
    }
```

1. **`withTimeoutOrNull(100) { closed.await() }`** là một cuộc đua: nó trả `null` nếu 100 ms thời gian ảo trôi qua, hoặc `Unit` nếu liên kết đóng trước. Ở bản đầu, fake chờ đủ 100 ms rồi mới nhận ra; lúc đó service đã dọn dẹp xong, và điều kiện chặn `isActive` của mục 4 có thể bị xoá mà không test nào fail (chúng tôi đã thử). Thất bại ngay, như `awaitClose` và `close()` làm, giúp `aDisconnectDuringDiscoveryIsNotAnError` bắt được nó.
2. **`notifyValue` chỉ gửi khi đang `notifying`**, nên một test quên đăng ký sẽ không nhận được gì, như với một thiết bị thật.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/SessionServiceTest.kt" hl_lines="2 7 9 12 14 16"
    @Test
    fun aDroppedLinkEndsEverythingOnIt() = runTest {
        radio.values[batteryLevel] = byteArrayOf(0x52)
        val call = async { assertFailsWith<ConnectionException> { session.connect(obd) } }
        radio.answer()
        testScheduler.runCurrent()
        val subscription = launch { session.subscribe(batteryLevel).collect() }
        testScheduler.advanceUntilIdle()
        val read = async { assertFailsWith<ConnectionException> { session.read(batteryLevel) } }
        testScheduler.runCurrent() // the read is waiting for its answer

        radio.fail("The link to OBD-II Adapter was lost (Android status 8).")

        assertEquals("The link to OBD-II Adapter was lost (Android status 8).", call.await().message)
        assertEquals("The link closed before the device answered.", read.await().message)
        subscription.join() // ended, without an error of its own
        assertFalse(radio.isLinked)
        assertEquals(ConnectionState.Disconnected, session.connectionState.value)
    }
```

1. **`async { assertFailsWith { … } }`**: một `async` thất bại sẽ làm cha của nó, tức test, thất bại, dù sau đó bạn có `await` nó, nên phép khẳng định nằm bên trong và `await()` trả về exception.
2. **Các test service mới khác**: giá trị notify tới đã được giải mã, theo thứ tự ("81 %", "80 %"); huỷ lần collect gửi một lần huỷ đăng ký và giữ kết nối; một characteristic không notify không bao giờ được gửi tới radio; một lần đăng ký bị từ chối tới được bên gọi và giữ kết nối; Disconnect kết thúc các đăng ký mà không có lỗi và không gửi request nào trên liên kết đã chết; một lần rớt trong lúc khám phá được báo một lần, dưới dạng lần rớt; một Disconnect trong lúc khám phá không phải là lỗi; và `connectsAgainAfterADrop`. Test khám phá-thất-bại của bài 15 giờ kỳ vọng `connect()` ném thông báo của lần khám phá, và `sendsOneRequestAtATime` thêm một lần đăng ký vào hai lần đọc.
3. **Kiểm tra đột biến**: gỡ khối `NonCancellable` (hoặc cả việc tắt), lần ném `endedBy`, điều kiện chặn `isActive` hay `values.cancel()`, mỗi cái đều làm ít nhất một test fail. Bốn test ViewModel mới dùng `TestDeviceSession`, mà `subscribe()` phát ra thứ test gửi vào một `Channel`: mỗi giá trị nằm dưới characteristic của nó; Unsubscribe dừng lần collect; một lần đăng ký bị từ chối hiện "Subscribe failed: …" và không có alert; một lần khám phá thất bại không mở alert. `DeviceServiceTest` kiểm tra `notifies`.

## 10. Thực tế xảy ra gì

Chúng tôi build m11 trên cả bốn track (Kotlin 2.4.20, SKIE 0.10.15, Xcode 26.2). `allTests` pass 68 trên 68 trên JVM và 68 trên 68 trên iOS simulator, không có cảnh báo compiler nào từ code của chúng ta. Adapter thật vẫn chẳng có gì để kết nối trên emulator và Simulator, nên phần lớn các lần chạy thay vào adapter giả lập:

| Lần chạy | Thứ chúng tôi thấy |
|---|---|
| Emulator Android API 36, `SimulatedBleScanner` với `AndroidBleConnection` thật, Compose: OBD-II Adapter, Connect | sau 10 s "Connection failed: OBD-II Adapter didn't answer within 10 seconds."; logcat: `registerApp()`, rồi `cancelOpen()`, `close()`, `unregisterApp()`. Không nút Subscribe nào hiện ra |
| API 36, cả hai giả lập, Compose và XML: OBD-II Adapter, Connect | ba nút Subscribe: Battery Level, Temperature, và characteristic chỉ-notify. Subscribe trên Battery Level: nút thành Unsubscribe và một giá trị dưới nó đếm lùi (81 %, 80 %, …) khoảng mỗi giây một lần. Unsubscribe: nó dừng |
| như trên, Subscribe, xoay ngang | giá trị vẫn tới khi nằm ngang; Disconnect khi đang đăng ký: "Status: not connected", không alert, không service, không Unsubscribe |
| như trên, Tire Pressure Sensor: Connect, Subscribe | giá trị trong khoảng 15 s, rồi alert "Connection failed" / "The link to Tire Pressure Sensor was lost (simulated)."; OK: "Status: not connected", không service. Connect lại: đã kết nối, các service được liệt kê, Subscribe chạy được |
| như trên, nhấn giữ 1,5 s trên Subscribe của Temperature trong lúc giá trị pin đang tới | Compose: đã đăng ký. XML với `render` dựng-lại-hết của bài 15: không có gì xảy ra. XML như trong file đầy đủ: đã đăng ký |
| Simulator iOS 26.2, `SimulatedBleScanner` với `LinkedBleConnection` thật, SwiftUI và UIKit (XCUITest) | Connect: "Connection failed: This phone has no Bluetooth LE radio."; không có nút Subscribe |
| Simulator, cả hai giả lập, SwiftUI và UIKit (XCUITest) | giống trên Android: ba nút Subscribe, giá trị đang tới (79 %, rồi 77 % hai giây sau), Unsubscribe dừng chúng, nằm ngang giữ chúng, Disconnect xoá hết không có alert; lần rớt của Tire Pressure Sensor, alert, và một lần kết nối lại chạy được. Lần nhấn giữ đăng ký được trên cả hai; UIKit với `render` dựng-lại-hết thì bỏ lỡ nó |

Một lần đăng ký thật và một lần rớt thật cần điện thoại của bạn và LightBlue (bài 13 đã bảo bạn cho thiết bị ảo của nó một characteristic có notify); brief cho agent liệt kê chúng là các kiểm tra trên thiết bị. **m11 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng, các lần chạy ở trên diễn ra giống vậy với bạn, và trên ít nhất một điện thoại, giá trị của một characteristic trong LightBlue hiện ra khi bạn đổi chúng trong LightBlue, và app phục hồi khi bạn dừng thiết bị ảo. Hãy commit nó. Bài 17 thêm trạng thái riêng của máy và một kho log.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một giá trị notify trên track iOS của bạn, từ `didUpdateValueFor` tới dòng chữ trên màn hình: nó đi qua object nào trong Swift, thành byte Kotlin ở đâu, đi qua những toán tử `Flow` nào, được giải mã ở đâu, và `update` nào đưa nó vào UI state. Rồi làm tương tự cho một lần bấm Unsubscribe: coroutine nào bị huỷ, `CancellationException` bị bắt ở đâu, và dòng nào gửi request.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Đăng ký một characteristic gửi gì tới thiết bị?</p>
<div class="opts">
<button class="opt">một request đọc mà thiết bị lặp lại mỗi giây</button>
<button class="opt" data-correct>một lần ghi <code>01 00</code> (hoặc <code>02 00</code> cho indication) vào Client Characteristic Configuration descriptor của characteristic</button>
<button class="opt">không gì cả: điện thoại chỉ bắt đầu lắng nghe</button>
</div>
<p class="feedback"></p>
<p class="why">CCCD (<code>0x2902</code>) là công tắc của thiết bị. Android ghi nó tường minh sau <code>setCharacteristicNotification</code>, thứ đăng ký app với Bluetooth stack của chính Android; trên iOS, <code>setNotifyValue(_:for:)</code> ghi hộ bạn.</p>
</div>

<div class="quiz">
<p class="q">Người dùng bấm Unsubscribe. Request dừng tới thiết bị bằng cách nào?</p>
<div class="opts">
<button class="opt">ViewModel gọi <code>session.unsubscribe()</code></button>
<button class="opt" data-correct>ViewModel huỷ lần collect của nó; trong service, <code>CancellationException</code> bị bắt và <code>connection.unsubscribe</code> chạy bên trong <code>withContext(NonCancellable)</code></button>
<button class="opt"><code>SharedFlow</code> nhận ra nó không còn subscriber và báo cho adapter</button>
</div>
<p class="feedback"></p>
<p class="why">Huỷ là huỷ đăng ký, như với lần quét và liên kết. Trong một coroutine đã bị huỷ, việc chờ của request sẽ ném lỗi ngay, nên nó chạy dưới dạng <code>NonCancellable</code>; thiếu nó, <code>cancellingTheCollectionUnsubscribes</code> fail. Một <code>SharedFlow</code> không báo cho ai cả.</p>
</div>

<div class="quiz">
<p class="q">Liên kết rớt khi một lần khám phá đang chờ câu trả lời. Người dùng thấy gì?</p>
<div class="opts">
<button class="opt">hai alert: lần rớt, rồi lần khám phá thất bại</button>
<button class="opt">"Couldn't discover the services of …", vì lần khám phá thất bại sau cùng</button>
<button class="opt" data-correct>một alert với thông báo của lần rớt, từ <code>connect()</code>; lỗi của lần khám phá bị ViewModel bỏ qua</button>
</div>
<p class="feedback"></p>
<p class="why">Việc một kết nối kết thúc được báo một lần, bởi <code>connect()</code>. Service chỉ đổ lỗi cho lần khám phá nếu liên kết vẫn còn lên (<code>isActive</code>); <code>aDropDuringDiscoveryIsReportedOnceAsTheDrop</code> kiểm tra điều đó.</p>
</div>

<div class="quiz">
<p class="q">Vì sao <code>subscribe</code> của service gọi <code>values.cancel()</code> sau khi <code>current.join()</code> trả về?</p>
<div class="opts">
<button class="opt" data-correct>collect một <code>SharedFlow</code> không bao giờ kết thúc, và một <code>channelFlow</code> chỉ kết thúc khi khối và mọi con của nó đã kết thúc</button>
<button class="opt">để gửi request huỷ đăng ký tới thiết bị</button>
<button class="opt">để giải phóng bộ giải mã</button>
</div>
<p class="feedback"></p>
<p class="why">"Shared flow không bao giờ kết thúc", và coroutine con đang collect nó sẽ giữ Flow của lần đăng ký mở mãi. Lúc đó liên kết đã mất, nên không gì được gửi đi.</p>
</div>

<div class="quiz">
<p class="q">Trên track XML, một nút Subscribe đôi khi bỏ qua một lần bấm khi giá trị tới mỗi giây. Vì sao?</p>
<div class="opts">
<button class="opt">main thread bị các notification chặn</button>
<button class="opt" data-correct>các hàng bị gỡ và dựng lại ở mỗi giá trị, nên cái nút được nhấn đã biến mất lúc nhả tay</button>
<button class="opt">Android bỏ qua lần bấm trong lúc có một GATT callback</button>
</div>
<p class="feedback"></p>
<p class="why">Một click cần lần nhấn và lần nhả trên cùng một view. Fragment giờ chỉ dựng lại các hàng khi các service hoặc các đăng ký đổi, và cập nhật các dòng giá trị tại chỗ. UIKit cũng gặp vấn đề tương tự; Compose và SwiftUI giữ các node của chúng.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Vì sao một request đăng ký đi qua <code>Mutex</code> của service, giống một lần đọc? (Bài 15)</p>
<div class="opts">
<button class="opt">CoreBluetooth crash khi có hai request cùng lúc</button>
<button class="opt" data-correct>port nhận mỗi lần một request: <code>BluetoothGatt</code> của Android từ chối một lần ghi descriptor khi một lần đọc hay ghi khác đang chờ, và mỗi adapter giữ một ô chờ (Android một ô cho mọi request, iOS một ô cho mỗi loại request)</button>
<button class="opt">để notification tới theo thứ tự</button>
</div>
<p class="feedback"></p>
<p class="why">Bài 15 đặt hợp đồng trong port và cái khoá trong service. Trong mã nguồn Android, một lần ghi descriptor bật cùng cờ bận với một lần đọc; <code>sendsOneRequestAtATime</code> giờ trộn một lần đăng ký với hai lần đọc.</p>
</div>

<div class="quiz">
<p class="q">Một màn hình có một lần đăng ký bị pop. Cái gì kết thúc lần đăng ký? (Bài 14)</p>
<div class="opts">
<button class="opt">không gì cả: nó cứ chạy cho tới khi app bị kill</button>
<button class="opt" data-correct>clear ViewModel thì huỷ <code>viewModelScope</code>, việc đó huỷ lần collect (và cả kết nối)</button>
<button class="opt"><code>onDisappear</code> / <code>onStop</code> của view gọi unsubscribe</button>
</div>
<p class="feedback"></p>
<p class="why">Bài 14 buộc kết nối vào đời của ViewModel, không vào đời của view: một lần xoay giữ nó, rời màn hình thì kết thúc nó. Lần đăng ký chạy trong cùng scope đó.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m11 của bạn)"
    1. **Đoán, rồi xem.** Truyền cả hai adapter giả lập. Mở Tire Pressure Sensor, Connect, đăng ký Battery Level và characteristic chỉ-notify, và bắt đầu một lần Read `92FFE234-…` (characteristic tự định nghĩa mà lần đọc thành công) ngay trước khi hết 15 s. Trước khi chạy, ghi ra mỗi dòng dưới mỗi characteristic sẽ hiện gì, bạn sẽ nhận alert nào, và câu trả lời của lần Read có hiện ra không. Rồi chạy. Dòng nào của `SessionService` giải thích mỗi thứ bạn đã thấy?
    2. **Test trước: mỗi characteristic một lần đăng ký.** Hiện giờ hai lần collect `session.subscribe(c)` đều bật thiết bị, và lần đầu tiên bị huỷ sẽ tắt nó cho cả hai. Viết `aSecondSubscriptionToTheSameCharacteristicFails` trong `SessionServiceTest`: collect một lần, rồi kỳ vọng lần collect thứ hai ném "Already subscribed to this characteristic." mà không có request thứ hai (`radio.mostAtOnce`, hoặc đếm request trong fake). Xem nó fail, rồi cho service giữ một tập các characteristic đã đăng ký. Tập đó phải được làm rỗng ở đâu để một liên kết bị rớt không để sót characteristic nào trong đó?
    3. **Cố tình phá việc dọn dẹp.** Trong service, thay `withContext(NonCancellable) { stopNotifications(characteristic) }` bằng `stopNotifications(characteristic)` trơn. Đoán xem test nào fail và nó báo gì, chạy nó trên cả hai nền tảng, và giải thích lỗi đó trong một câu. Hoàn tác.
    4. **Trên điện thoại của bạn**, với LightBlue quảng bá một thiết bị ảo có characteristic notify: đăng ký, rồi đổi giá trị của characteristic trong LightBlue vài lần (tìm chỗ thiết bị ảo của nó cho bạn sửa một giá trị), và xem nó tới. Unsubscribe rồi đổi lần nữa: có gì tới không? Rồi đăng ký lại và dừng thiết bị ảo (hoặc thoát LightBlue): bao lâu thì có alert, và nó nói gì trên mỗi nền tảng? Kết nối lại.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/16-ble-notify-disconnect-errors.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/16-ble-notify-disconnect-errors.html" -o .course/lesson-16.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html" -o .course/ref-ble-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 14 and 15, which this lesson builds on; skipped if they're already there:
  [ -f .course/lesson-14.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/14-ble-connect.html" -o .course/lesson-14.html
  [ -f .course/lesson-15.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/15-ble-discovery-and-read.html" -o .course/lesson-15.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 16 (BLE: notify, disconnect, errors): build milestone m11 on top of m10: subscribe to a
characteristic's notifications through the DeviceSession inbound port (subscribe(characteristic):
Flow<String>; cancelling the collection unsubscribes), over BleConnection.subscribe(),
unsubscribe() and notifications(); show each value under its characteristic, with a Subscribe /
Unsubscribe button where the characteristic notifies. SessionService ends every subscription with
its link, fails every request still waiting, and reports why a connection ended once, from connect().
Android: setCharacteristicNotification + the CCCD descriptor write, onCharacteristicChanged.
iOS: setNotifyValue(_:for:) in the Swift IosBleConnection, values passed to Kotlin through LinkFeed.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m10 project in demo/ (Lesson 15). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks. Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     replaced: core/DeviceService.kt, core/SessionService.kt, core/inbound/DeviceSession.kt,
       core/outbound/BleConnection.kt, adapter/inbound/DeviceDetailUiState.kt,
       adapter/inbound/DeviceDetailViewModel.kt, adapter/outbound/SimulatedBleConnection.kt
     replaced: shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidBleConnection.kt
     replaced: shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/LinkedBleConnection.kt
     under shared/src/commonTest/kotlin/com/example/devicemonitor/, replaced:
       doubles/FakeBleConnection.kt, doubles/TestDeviceSession.kt, core/SessionServiceTest.kt,
       core/DeviceServiceTest.kt, adapter/inbound/DeviceDetailViewModelTest.kt
   shared/build.gradle.kts, di/AppModule.kt and every other file in shared/ stay as in m10.

2. Android: androidApp/src/main/java/com/example/devicemonitor/android/
     Compose: DeviceDetailScreen.kt: replaced.
     XML: DeviceDetailFragment.kt: replaced (the layout file stays as in m10).
   DeviceMonitorApplication.kt, androidApp/build.gradle.kts and the manifest stay as in m10.
   iOS, both tracks: iosApp/iosApp/IosBleConnection.swift: replaced. No Swift file is added or
   removed, so don't run xcodegen; don't edit Info.plist, project.yml or the .xcodeproj.
     SwiftUI: DeviceDetailView.swift: replaced.
     UIKit: DeviceDetailViewController.swift: replaced.
   iOSApp.swift, AppDelegate.swift and every other Android and iOS file stay as in m10.

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
  the task lines), and all 68 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 8 in ValueDecoderTest, 3 in DeviceServiceTest, 8 in
  ScanningServiceTest, 7 in DeviceListViewModelTest, 4 in PermissionServiceTest, 1 in
  AppModuleTest. Show the counts from the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: the same lines as in Lesson 15's brief (SKIE's "Configuration '…' was
  resolved during configuration time", SLF4J "Failed to load class", Gradle's "Deprecated
  Gradle features … Gradle 10", "Unable to strip the following libraries", Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", xcodebuild's
  "WARNING: Using the first of multiple matching destinations", and Gradle's "The Daemon will
  expire …"). Xcode "note:" lines are not warnings.
- The app core stays platform-free:
    grep -rn 'import android\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing. The exported header has the new iOS call (build that framework first with
  ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64):
    grep -c 'setNotifyCharacteristic:(SharedCharacteristic \*)characteristic on:(BOOL)on reply:(SharedNotifyReply \*)reply' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'Koin_core' on the same file prints 0.
- The emulator and the Simulator can't reach a real device, so the runs swap adapters for a
  while. Make each swap in the app-start file only (Android: DeviceMonitorApplication.kt; iOS:
  iOSApp.swift or AppDelegate.swift), rebuild, and put the file back exactly as in m10
  afterwards (diff it). The simulated classes are in com.example.devicemonitor.adapter.outbound.
  Run A: SimulatedBleScanner() in place of the real scanner, the real connection kept.
  Run B: SimulatedBleScanner() and SimulatedBleConnection() in place of both.
- Android emulator (API 31+), my track (the XML buttons show their text in capitals, so match
  case-insensitively; find nodes with `adb shell uiautomator dump`; scroll with
  `adb shell input swipe`). While values arrive every second, uiautomator can fail with
  "could not get idle state" and leave the previous dump in place: delete the dump file before
  each dump, and if it keeps failing, use `adb exec-out screencap -p` and tap by coordinates.
  Run A:
  1. Scan, tap "OBD-II Adapter", adb logcat -c, Connect: after about 10 s the alert
     "Connection failed" / "OBD-II Adapter didn't answer within 10 seconds.", and no Subscribe
     button. `adb logcat -d -s BluetoothGatt` shows registerApp(), then about 10 s later
     cancelOpen(), close() and unregisterApp().
  Run B:
  2. Scan, tap "OBD-II Adapter", Connect: "Status: connected", the four services, and three
     Subscribe buttons (Battery Level 00002A19-…, Temperature 00002A6E-… and the notify-only
     89E2E7AE-…), each after its Read button where there is one.
  3. Tap the first Subscribe: it turns to Unsubscribe, and within 2 s a value like "81 %"
     appears under Battery Level and goes down by 1 about every second. Tap Unsubscribe: the
     button says Subscribe again and the value stops changing (compare two dumps 3 s apart).
  4. Subscribe to Battery Level again, then hold Temperature's Subscribe for 1.5 s:
     adb shell input motionevent DOWN x y, sleep 1.5, adb shell input motionevent UP x y.
     Temperature's button then says Unsubscribe and a value like "21.60 °C" appears.
  5. Rotate (adb shell settings put system accelerometer_rotation 0, then
     adb shell settings put system user_rotation 1), scroll down just far enough to see the
     battery value (one swipe of about 400 px on a 1080 x 2400 screen, such as
     adb shell input swipe 1200 900 1200 500 300; a shorter one may leave the value below the
     fold, a long one scrolls the row away): the battery value is still changing. Rotate back
     (user_rotation 0), scroll back to the top, and tap Disconnect: "Status: not connected", no
     alert, no "Service …" text, no Unsubscribe.
  6. Back, open "Tire Pressure Sensor", Connect, Subscribe to Battery Level: values arrive,
     then about 15 s after connecting the alert "Connection failed" / "The link to Tire
     Pressure Sensor was lost (simulated)." OK: "Status: not connected", no services. Connect
     again: "Status: connected" and the services again; Subscribe works. Disconnect.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events.
  Run A: Scan, tap "OBD-II Adapter", Connect: an alert "Connection failed" with "This phone has
  no Bluetooth LE radio." OK: "Status: not connected" and no Subscribe button.
  Run B: steps 2–6 above: app.buttons matching "Subscribe": count 3; a static text ending in
  " %" that differs 2 s later; press(forDuration: 1.5) on Temperature's Subscribe gives two
  Unsubscribe buttons; set XCUIDevice.shared.orientation to .landscapeLeft and the value keeps
  changing; Disconnect with no alert; the Tire Pressure Sensor's alert within 20 s, then a
  working Connect.
- Device checks (list them for me, don't try to run them): with LightBlue advertising a
  virtual device that has a notifying characteristic, on a physical Android phone and an
  iPhone on my track, using the real adapters: Subscribe, then change the value in LightBlue:
  each new value appears under the characteristic; Unsubscribe: changes no longer arrive;
  subscribed, stop the virtual device (or quit LightBlue): one "Connection failed" alert with
  a "was lost" message, then "Status: not connected" with no services, and Connect works again
  once LightBlue advertises.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me which line runs for each of the five ways into Disconnected in the
lesson's state diagram.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Transfer BLE data](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data) (nguồn chính: "Receive GATT notifications"; mẫu của nó dùng `descriptor.value` đã bị deprecate và không chờ `onDescriptorWrite`), và các trang reference của [BluetoothGatt](https://developer.android.com/reference/android/bluetooth/BluetoothGatt) (`setCharacteristicNotification`, cả hai `writeDescriptor`), [BluetoothGattCallback](https://developer.android.com/reference/android/bluetooth/BluetoothGattCallback) (`onDescriptorWrite`, cả hai `onCharacteristicChanged`) và [BluetoothGattDescriptor](https://developer.android.com/reference/android/bluetooth/BluetoothGattDescriptor) (`ENABLE_NOTIFICATION_VALUE` và các hằng anh em). Việc một lần ghi descriptor bị từ chối khi một lần đọc hay ghi khác đang chờ nằm trong mã nguồn (`mDeviceBusy` trong `BluetoothGatt.java`).
- iOS: [setNotifyValue(_:for:)](https://developer.apple.com/documentation/corebluetooth/cbperipheral/setnotifyvalue(_:for:)) (nguồn chính), [peripheral(_:didUpdateNotificationStateFor:error:)](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatenotificationstatefor:error:)), [peripheral(_:didUpdateValueFor:error:)](https://developer.apple.com/documentation/corebluetooth/cbperipheraldelegate/peripheral(_:didupdatevaluefor:error:)-1xyna) và [CBCharacteristic.isNotifying](https://developer.apple.com/documentation/corebluetooth/cbcharacteristic/isnotifying). UIKit: [UIStackView](https://developer.apple.com/documentation/uikit/uistackview) (arranged subview bị ẩn).
- Bluetooth: [UUID của descriptor](https://bitbucket.org/bluetooth-SIG/public/src/main/assigned_numbers/uuids/descriptors.yaml) của SIG (`0x2902`, Client Characteristic Configuration).
- Coroutine: [Cancellation and timeouts](https://kotlinlang.org/docs/coroutines-cancellation.html) (điểm treo, "Run non-cancelable blocks"), [channelFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/channel-flow.html), [SharedFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/) và [MutableSharedFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-shared-flow/) (nóng, không bao giờ kết thúc, `tryEmit`), [CoroutineStart.UNDISPATCHED](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-coroutine-start/-u-n-d-i-s-p-a-t-c-h-e-d/), [Job.join](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-job/join.html) và [withTimeoutOrNull](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout-or-null.html).
- [Cheatsheet: BLE](https://phongna-inn.github.io/carmd-kmp-course/reference/ble-cheatsheet.html): giờ có thêm notification trên cả hai nền tảng, các cách một kết nối kết thúc, và các cái bẫy của bài này.
- Kinh nghiệm thực tế: các tag [android-bluetooth](https://stackoverflow.com/questions/tagged/android-bluetooth) và [core-bluetooth](https://stackoverflow.com/questions/tagged/core-bluetooth) của Stack Overflow; tìm "onCharacteristicChanged not called" và "setNotifyValue didUpdateValueFor not called".

## File đầy đủ

Mọi file bài này sửa, đầy đủ. Không file nào được thêm hay xoá, và layout XML, các file khởi động app và Koin module giữ như ở m10, nên project Xcode không cần `xcodegen generate`. File chỉ một track có nằm trong tab của track đó; file mọi track dùng chung ghi rõ điều đó trong tiêu đề.

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
    ) {
        // Whether the device can send this value each time it changes: as a notification (no
        // acknowledgement) or an indication (acknowledged). The app subscribes to either the same way.
        val notifies: Boolean
            get() = CharacteristicProperty.Notify in properties || CharacteristicProperty.Indicate in properties
    }

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

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/DeviceSession.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Characteristic
    import com.example.devicemonitor.core.ConnectionState
    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.DeviceService
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.StateFlow

    // Inbound port: what the app offers for talking to one device. Inbound adapters (the shared
    // ViewModels) call it, and SessionService implements it.
    interface DeviceSession {
        // Where the connection stands now. Every screen that shows it reads this one state.
        val connectionState: StateFlow<ConnectionState>

        // Connects to device and holds the connection for as long as the call runs. Returns after
        // disconnect(); cancelling the caller's coroutine also disconnects. Throws ConnectionException
        // when the connection ends any other way: no permission, another connection open, no answer,
        // the link failed or dropped, or a failed discovery ended it. That is the one place the
        // reason for an ended connection is reported.
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

        // The characteristic's values as text for the user, each time the device sends one.
        // Collecting subscribes, and cancelling the collection unsubscribes. The Flow ends when the
        // connection ends. Throws ConnectionException: not connected, a characteristic that doesn't
        // notify, or the device refused.
        fun subscribe(characteristic: Characteristic): Flow<String>
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/SessionService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import kotlinx.coroutines.CancellationException
    import kotlinx.coroutines.CoroutineStart
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.NonCancellable
    import kotlinx.coroutines.coroutineScope
    import kotlinx.coroutines.delay
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.channelFlow
    import kotlinx.coroutines.launch
    import kotlinx.coroutines.sync.Mutex
    import kotlinx.coroutines.sync.withLock
    import kotlinx.coroutines.withContext
    import kotlin.time.Duration.Companion.seconds

    // Service: the app's connection rules. Connect only with the Bluetooth permission and to one
    // device at a time, and give up on a device that doesn't answer within CONNECT_TIMEOUT. It owns
    // the connection state that the screens show, and everything that lives on the link: one
    // request at a time, reads only of what can be read, subscriptions only to what notifies, and
    // the decoding. However the link ends, the same cleanup runs, and the reason is reported once.
    class SessionService(
        private val connection: BleConnection,
        private val permissions: PermissionChecker,
    ) : DeviceSession {
        private val state = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
        override val connectionState: StateFlow<ConnectionState> = state.asStateFlow()
        private var link: Job? = null
        private var endedBy: ConnectionException? = null // why the service itself ended the link
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
                // The link was cancelled: by disconnect(), or by the service for a reason of its own.
                endedBy?.let { throw it }
            } finally {
                // Every way out ends here: the link's Job is complete, so its subscriptions end, and
                // the adapter has closed the radio's link and failed any request still waiting.
                link = null
                endedBy = null
                state.value = ConnectionState.Disconnected
            }
        }

        // Cancelling the link ends its collection, and the adapter closes the radio's link.
        override fun disconnect() {
            link?.cancel()
        }

        // A device whose services can't be discovered is of no use to the app: end the connection,
        // and let connect() report why. If the link had already dropped, that drop is the reason.
        override suspend fun services(): List<DeviceService> {
            val device = connectedDevice()
            return try {
                requests.withLock { connection.discoverServices() }
            } catch (e: ConnectionException) {
                val failure = ConnectionException("Couldn't discover the services of ${device.name}. ${e.message}")
                // Only a link that is still up: after a drop or a Disconnect, that is what ended it.
                link?.takeIf { it.isActive }?.let { current ->
                    endedBy = failure
                    current.cancel()
                }
                throw failure
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

        override fun subscribe(characteristic: Characteristic): Flow<String> = channelFlow {
            connectedDevice()
            val current = link ?: throw ConnectionException("Connect to the device first.")
            if (!characteristic.notifies) {
                throw ConnectionException("This characteristic doesn't notify: it has no Notify or Indicate property.")
            }
            // Listen first, then ask: UNDISPATCHED starts collecting here and now, so not even the
            // device's first value can arrive before someone is listening.
            val values = launch(start = CoroutineStart.UNDISPATCHED) {
                connection.notifications(characteristic).collect { bytes ->
                    send(ValueDecoder.decode(characteristic.uuid, bytes))
                }
            }
            try {
                requests.withLock { connection.subscribe(characteristic) }
                current.join() // a subscription lasts as long as the link it was made on
            } catch (e: CancellationException) {
                // The collector went away (an unsubscribe) while the link is up: ask the device to
                // stop. This coroutine is cancelled, so the request runs as NonCancellable.
                if (current.isActive) withContext(NonCancellable) { stopNotifications(characteristic) }
                throw e
            }
            values.cancel() // the link ended: so does this Flow
        }

        // Unsubscribing is tidying up: if the device refuses, or the link is closing, there is
        // nothing more to do, and the values have no collector any more anyway.
        private suspend fun stopNotifications(characteristic: Characteristic) {
            try {
                requests.withLock { connection.unsubscribe(characteristic) }
            } catch (e: ConnectionException) {
                // nothing to do
            }
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
        // What to show under each characteristic: the last value read or notified, or why the read
        // or the subscription failed.
        val values: Map<Characteristic, String> = emptyMap(),
        // The characteristics this screen is subscribed to, from the tap until the subscription ends.
        val subscribed: Set<Characteristic> = emptySet(),
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

    // Inbound adapter: turns the detail screen's Connect, Disconnect, Read, Subscribe and
    // Unsubscribe into calls on the DeviceSession port, and the session's state and answers into
    // UI state. It knows the port only.
    class DeviceDetailViewModel(private val session: DeviceSession) : ViewModel() {
        private val _uiState = MutableStateFlow(DeviceDetailUiState(connection = session.connectionState.value))
        val uiState: StateFlow<DeviceDetailUiState> = _uiState.asStateFlow()

        private var connectJob: Job? = null
        private val subscriptions = mutableMapOf<Characteristic, Job>()

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
        // Whatever ends it other than Disconnect (a failed attempt, a dropped link, a failed
        // discovery) arrives here, once, as the message to show.
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
                showUnder(characteristic, text)
            }
        }

        // Each value the device sends lands under the characteristic, until Unsubscribe, the end of
        // the connection, or the end of this ViewModel.
        fun subscribe(characteristic: Characteristic) {
            if (subscriptions[characteristic]?.isActive == true) return
            subscriptions[characteristic] = viewModelScope.launch {
                _uiState.update { it.copy(subscribed = it.subscribed + characteristic) }
                try {
                    session.subscribe(characteristic).collect { value -> showUnder(characteristic, value) }
                } catch (e: ConnectionException) {
                    showUnder(characteristic, "Subscribe failed: ${e.message}")
                } finally {
                    _uiState.update { it.copy(subscribed = it.subscribed - characteristic) }
                }
            }
        }

        // Cancelling the collection is the unsubscribe: the session asks the device to stop.
        fun unsubscribe(characteristic: Characteristic) {
            subscriptions.remove(characteristic)?.cancel()
        }

        fun errorShown() {
            _uiState.update { it.copy(errorMessage = null) }
        }

        private fun showUnder(characteristic: Characteristic, text: String) {
            _uiState.update {
                if (it.connection is ConnectionState.Connected) it.copy(values = it.values + (characteristic to text)) else it
            }
        }

        // A failed discovery ends the connection, and connect() reports why: nothing to show here.
        private fun discover() {
            viewModelScope.launch {
                _uiState.update { it.copy(discovering = true) }
                try {
                    val services = session.services()
                    _uiState.update { if (it.connection is ConnectionState.Connected) it.copy(services = services) else it }
                } catch (e: ConnectionException) {
                    // connect() shows the reason
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
    import kotlin.time.Duration.Companion.seconds

    // Outbound adapter: a pretend link behind the BleConnection port, for the sample devices of
    // SimulatedBleScanner. Each one connects after 1 s and stays connected until the collector
    // cancels, except the Smart Scale, which never answers, and the Tire Pressure Sensor, whose link
    // drops DROP_AFTER after it connects, as a device going out of range would. Every connected
    // device has the services below, and sends a new value every second for each subscribed
    // characteristic. The app doesn't bind it; bind it with SimulatedBleScanner in place of the real
    // radio to run without one.
    class SimulatedBleConnection : BleConnection {
        private var linked = false
        private val subscribed = mutableSetOf<String>() // characteristic UUIDs

        override fun connect(device: Device): Flow<ConnectionState> = flow {
            emit(ConnectionState.Connecting(device))
            if (device.name == "Smart Scale") awaitCancellation() // never answers
            delay(1000)
            linked = true
            try {
                emit(ConnectionState.Connected(device))
                if (device.name == "Tire Pressure Sensor") {
                    delay(DROP_AFTER)
                    throw ConnectionException("The link to ${device.name} was lost (simulated).")
                }
                awaitCancellation()
            } finally {
                linked = false
                subscribed.clear() // a new link starts with every notification off
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

        override suspend fun subscribe(characteristic: Characteristic) {
            delay(200)
            if (!linked) throw ConnectionException("Not connected.")
            subscribed += characteristic.uuid
        }

        override suspend fun unsubscribe(characteristic: Characteristic) {
            delay(200)
            if (!linked) throw ConnectionException("Not connected.")
            subscribed -= characteristic.uuid
        }

        // A new value every second while subscribed: the battery runs down, the temperature
        // drifts, and the stream counts.
        override fun notifications(characteristic: Characteristic): Flow<ByteArray> = flow {
            var tick = 0
            while (true) {
                delay(1000)
                if (linked && characteristic.uuid in subscribed) emit(valueAt(characteristic.uuid, tick++))
            }
        }

        private fun valueAt(uuid: String, tick: Int): ByteArray = when (uuid) {
            fullUuid("2A19") -> byteArrayOf((81 - tick % 82).toByte()) // 81 %, 80 %, …
            fullUuid("2A6E") -> (2150 + 5 * (tick + 1)).let { byteArrayOf(it.toByte(), (it shr 8).toByte()) } // 21.55 °C, 21.60 °C, …
            else -> byteArrayOf(0x00, tick.toByte()) // 00 00, 00 01, …
        }

        private companion object {
            val DROP_AFTER = 15.seconds
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
    import android.bluetooth.BluetoothGattDescriptor
    import android.bluetooth.BluetoothGattService
    import android.bluetooth.BluetoothManager
    import android.bluetooth.BluetoothProfile
    import android.bluetooth.BluetoothStatusCodes
    import android.content.Context
    import android.os.Build
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
    import kotlinx.coroutines.flow.MutableSharedFlow
    import kotlinx.coroutines.flow.callbackFlow
    import kotlinx.coroutines.flow.filter
    import kotlinx.coroutines.flow.map
    import java.util.UUID

    // Outbound adapter: a GATT connection over the phone's Bluetooth LE radio, behind the
    // BleConnection port. BluetoothGatt reports to a callback object; callbackFlow turns the link's
    // calls into a Flow, and closes the GATT client when the collector cancels. Each request on the
    // open link waits for its own callback in a CompletableDeferred; notifications go out through a
    // SharedFlow.
    class AndroidBleConnection(private val context: Context) : BleConnection {
        private val adapter: BluetoothAdapter? =
            context.getSystemService(BluetoothManager::class.java)?.adapter

        // The open link, from the moment it's up until it closes. Callbacks run on a background thread.
        @Volatile private var gatt: BluetoothGatt? = null

        // The request waiting for its callback. The port takes one request at a time, so one is enough.
        @Volatile private var answer: CompletableDeferred<Answer>? = null

        private class Answer(val status: Int, val value: ByteArray)

        // Every value a subscribed characteristic sends on the link. tryEmit is safe from the
        // callbacks' thread; a value that arrives while nobody collects is dropped.
        private val notified = MutableSharedFlow<Notified>(extraBufferCapacity = 64)

        private class Notified(val serviceUuid: String, val uuid: String, val value: ByteArray)

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

                // The answer to a descriptor write: here, notifications turned on or off.
                override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
                    answer?.complete(Answer(status, ByteArray(0)))
                }

                // A notification (or indication): not an answer to any request. Android 13 (API 33)
                // and later call this one, with the value.
                override fun onCharacteristicChanged(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic,
                    value: ByteArray,
                ) {
                    notified.tryEmit(characteristic.notified(value))
                }

                // Android 12 and earlier call this one: the value is in the characteristic.
                @Deprecated("Replaced at API 33 by the overload with the value")
                @Suppress("DEPRECATION")
                override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
                    notified.tryEmit(characteristic.notified(characteristic.value ?: ByteArray(0)))
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
            val target = gatt.find(characteristic)
            val answer = request { gatt.readCharacteristic(target) }
            if (answer.status != BluetoothGatt.GATT_SUCCESS) {
                throw ConnectionException("The device refused the read (Android status ${answer.status}).")
            }
            return answer.value
        }

        // Two steps: setCharacteristicNotification tells Android to pass this characteristic's
        // notifications to the app, and writing its CCCD descriptor asks the device to send them.
        @SuppressLint("MissingPermission")
        override suspend fun subscribe(characteristic: Characteristic) {
            val gatt = openGatt()
            val target = gatt.find(characteristic)
            val cccd = target.getDescriptor(CCCD)
                ?: throw ConnectionException("This characteristic has no notification switch (no CCCD).")
            if (!gatt.setCharacteristicNotification(target, true)) {
                throw ConnectionException("Android couldn't turn on notifications.")
            }
            // Notify if the characteristic has it, otherwise Indicate: the value says which.
            val notify = target.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0
            val on = if (notify) BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            writeCccd(gatt, cccd, on)
        }

        @SuppressLint("MissingPermission")
        override suspend fun unsubscribe(characteristic: Characteristic) {
            val gatt = openGatt()
            val target = gatt.find(characteristic)
            gatt.setCharacteristicNotification(target, false)
            val cccd = target.getDescriptor(CCCD) ?: return
            writeCccd(gatt, cccd, BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE)
        }

        override fun notifications(characteristic: Characteristic): Flow<ByteArray> =
            notified
                .filter { it.serviceUuid == characteristic.serviceUuid && it.uuid == characteristic.uuid }
                .map { it.value }

        // A descriptor write is a request like a read: one at a time, answered in onDescriptorWrite.
        private suspend fun writeCccd(gatt: BluetoothGatt, cccd: BluetoothGattDescriptor, value: ByteArray) {
            val answer = request {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    gatt.writeDescriptor(cccd, value) == BluetoothStatusCodes.SUCCESS
                } else {
                    writeDescriptorBefore33(gatt, cccd, value)
                }
            }
            if (answer.status != BluetoothGatt.GATT_SUCCESS) {
                throw ConnectionException("The device refused to change its notifications (Android status ${answer.status}).")
            }
        }

        // Android 12 and earlier: the value goes into the descriptor object, then the write sends it.
        @SuppressLint("MissingPermission")
        @Suppress("DEPRECATION")
        private fun writeDescriptorBefore33(gatt: BluetoothGatt, cccd: BluetoothGattDescriptor, value: ByteArray): Boolean {
            cccd.value = value
            return gatt.writeDescriptor(cccd)
        }

        private fun BluetoothGatt.find(characteristic: Characteristic): BluetoothGattCharacteristic =
            getService(UUID.fromString(characteristic.serviceUuid))
                ?.getCharacteristic(UUID.fromString(characteristic.uuid))
                ?: throw ConnectionException("This device has no such characteristic. Discover its services again.")

        private fun BluetoothGattCharacteristic.notified(value: ByteArray) =
            Notified(fullUuid(service.uuid.toString()), fullUuid(uuid.toString()), value)

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

        private companion object {
            // The Client Characteristic Configuration descriptor: the device's switch for its notifications.
            val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
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
    import com.example.devicemonitor.core.fullUuid
    import com.example.devicemonitor.core.outbound.BleConnection
    import kotlinx.cinterop.ExperimentalForeignApi
    import kotlinx.cinterop.addressOf
    import kotlinx.cinterop.usePinned
    import kotlinx.coroutines.CancellableContinuation
    import kotlinx.coroutines.channels.ProducerScope
    import kotlinx.coroutines.channels.awaitClose
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableSharedFlow
    import kotlinx.coroutines.flow.callbackFlow
    import kotlinx.coroutines.flow.filter
    import kotlinx.coroutines.flow.map
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
        // Every value a subscribed characteristic sends, as the Swift half reports it.
        private val notified = MutableSharedFlow<Notified>(extraBufferCapacity = 64)

        // Collecting the Flow calls the link's open; cancelling the collector calls its close.
        override fun connect(device: Device): Flow<ConnectionState> = callbackFlow {
            link.open(device, LinkFeed(this, notified))
            awaitClose { link.close() }
        }

        override suspend fun discoverServices(): List<DeviceService> =
            suspendCancellableCoroutine { link.discover(ServicesReply(it)) }

        override suspend fun read(characteristic: Characteristic): ByteArray =
            suspendCancellableCoroutine { link.read(characteristic, ValueReply(it)) }

        override suspend fun subscribe(characteristic: Characteristic) =
            suspendCancellableCoroutine { link.setNotify(characteristic, true, NotifyReply(it)) }

        override suspend fun unsubscribe(characteristic: Characteristic) =
            suspendCancellableCoroutine { link.setNotify(characteristic, false, NotifyReply(it)) }

        override fun notifications(characteristic: Characteristic): Flow<ByteArray> =
            notified
                .filter { it.serviceUuid == characteristic.serviceUuid && it.uuid == characteristic.uuid }
                .map { it.value }
    }

    internal class Notified(val serviceUuid: String, val uuid: String, val value: ByteArray)

    // What the Swift connection implements: open and close the real link, and the requests on it.
    interface IosLink {
        fun open(device: Device, feed: LinkFeed)
        fun close()
        fun discover(reply: ServicesReply)
        fun read(characteristic: Characteristic, reply: ValueReply)
        fun setNotify(characteristic: Characteristic, on: Boolean, reply: NotifyReply)
    }

    // Where the Swift connection reports: each state of the link, the failure that ends it, and
    // each value a subscribed characteristic sends.
    class LinkFeed internal constructor(
        private val scope: ProducerScope<ConnectionState>,
        private val notifications: MutableSharedFlow<Notified>,
    ) {
        fun changed(state: ConnectionState) {
            scope.trySend(state)
        }

        fun failed(message: String) {
            scope.close(ConnectionException(message))
        }

        // iOS can report a standard UUID in its short form: fullUuid makes it match the app's.
        fun notified(serviceUuid: String, characteristicUuid: String, value: NSData) {
            notifications.tryEmit(Notified(fullUuid(serviceUuid), fullUuid(characteristicUuid), value.toByteArray()))
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

    // Where the Swift connection answers a change of notifications: done, or the failure.
    class NotifyReply internal constructor(private val waiting: CancellableContinuation<Unit>) {
        fun done() {
            if (waiting.isActive) waiting.resume(Unit)
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
    import kotlinx.coroutines.CompletableDeferred
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableSharedFlow
    import kotlinx.coroutines.flow.filter
    import kotlinx.coroutines.flow.flow
    import kotlinx.coroutines.flow.map
    import kotlinx.coroutines.withTimeoutOrNull

    // Fake: an outbound adapter written for tests, behind the BleConnection port. The test plays
    // the radio and the device: whether and when the device answers, whether the link fails or
    // drops, what services the device has, what each characteristic holds, which requests fail,
    // and when a notification arrives.
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
        var subscribeFailure: String? = null
        val notifying = mutableSetOf<Characteristic>() // what the device is sending notifications for
        val unsubscribes = mutableListOf<Characteristic>() // one entry per unsubscribe() call
        private val notified = MutableSharedFlow<Pair<Characteristic, ByteArray>>(extraBufferCapacity = 16)
        var mostAtOnce = 0 // the most requests that were in progress at the same time
            private set
        private var inProgress = 0
        private var linkClosed = CompletableDeferred<Unit>()

        override fun connect(device: Device): Flow<ConnectionState> = flow {
            attempts++
            isLinked = true
            linkClosed = CompletableDeferred()
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
                linkClosed.complete(Unit) // fails the request still waiting, at once
                notifying.clear() // a link that ends takes the device's notifications with it
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

        override suspend fun subscribe(characteristic: Characteristic) = request {
            subscribeFailure?.let { throw ConnectionException(it) }
            notifying += characteristic
        }

        override suspend fun unsubscribe(characteristic: Characteristic) = request {
            unsubscribes += characteristic
            notifying -= characteristic
        }

        override fun notifications(characteristic: Characteristic): Flow<ByteArray> =
            notified.filter { it.first == characteristic }.map { it.second }

        // Each request takes 100 ms of virtual time, so a test can see whether two overlap. Like the
        // real adapters, it fails at once if the link closes while it waits.
        private suspend fun <T> request(answer: () -> T): T {
            if (!isLinked) throw ConnectionException("Not connected.")
            val closed = linkClosed
            inProgress++
            mostAtOnce = maxOf(mostAtOnce, inProgress)
            try {
                // null: 100 ms went by and the link is still up
                if (withTimeoutOrNull(100) { closed.await() } != null) {
                    throw ConnectionException("The link closed before the device answered.")
                }
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

        // The device sends a new value for characteristic, if its notifications are on.
        fun notifyValue(characteristic: Characteristic, vararg bytes: Int) {
            if (characteristic in notifying) {
                notified.tryEmit(characteristic to ByteArray(bytes.size) { bytes[it].toByte() })
            }
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
    import kotlinx.coroutines.channels.Channel
    import kotlinx.coroutines.flow.Flow
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.flow

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
        var discoveryFailure: ConnectionException? = null

        // What subscribe() hands out: the test sends values (and closes it to end the subscription).
        val notifications = Channel<String>(Channel.UNLIMITED)
        var subscribeFailure: ConnectionException? = null
        var isSubscribed = false // true while a subscribe() Flow is being collected
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
            discoveryFailure?.let { throw it }
            return services
        }

        override suspend fun read(characteristic: Characteristic): String =
            values[characteristic] ?: throw ConnectionException("The device refused the read (Android status 2).")

        override fun subscribe(characteristic: Characteristic): Flow<String> = flow {
            subscribeFailure?.let { throw it }
            isSubscribed = true
            try {
                for (value in notifications) emit(value)
            } finally {
                isSubscribed = false
            }
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/DeviceServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertTrue

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

        @Test
        fun aCharacteristicNotifiesWithNotifyOrIndicate() {
            fun characteristic(vararg properties: CharacteristicProperty) = Characteristic("S", "C", properties.toList())
            assertTrue(characteristic(CharacteristicProperty.Read, CharacteristicProperty.Notify).notifies)
            assertTrue(characteristic(CharacteristicProperty.Indicate).notifies)
            assertFalse(characteristic(CharacteristicProperty.Read, CharacteristicProperty.Write).notifies)
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
    import kotlinx.coroutines.flow.collect
    import kotlinx.coroutines.flow.toList
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
        fun aFailedDiscoveryEndsTheConnectionAndConnectSaysWhy() = runTest {
            radio.discoveryFailure = "Discovery failed (Android status 129)."
            val call = async { assertFailsWith<ConnectionException> { session.connect(obd) } }
            radio.answer()
            testScheduler.runCurrent()

            assertFailsWith<ConnectionException> { session.services() }

            assertEquals("Couldn't discover the services of OBD-II Adapter. Discovery failed (Android status 129).", call.await().message)
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
            val subscription = launch { session.subscribe(batteryLevel).collect() }
            first.await()
            second.await()
            testScheduler.advanceUntilIdle()

            assertEquals(2, radio.reads.size)
            assertEquals(setOf(batteryLevel), radio.notifying)
            assertEquals(1, radio.mostAtOnce)
            subscription.cancelAndJoin()
            call.cancelAndJoin()
        }

        // Notifications. Each test connects first, then collects session.subscribe().

        @Test
        fun notificationsArriveDecoded() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val values = mutableListOf<String>()
            val subscription = launch { session.subscribe(batteryLevel).toList(values) }
            testScheduler.advanceUntilIdle() // the subscribe request
            radio.notifyValue(batteryLevel, 0x51)
            radio.notifyValue(batteryLevel, 0x50)
            testScheduler.runCurrent()

            assertEquals(listOf("81 %", "80 %"), values)
            subscription.cancelAndJoin()
            call.cancelAndJoin()
        }

        @Test
        fun cancellingTheCollectionUnsubscribes() = runTest {
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()
            val subscription = launch { session.subscribe(batteryLevel).collect() }
            testScheduler.advanceUntilIdle()
            assertEquals(setOf(batteryLevel), radio.notifying)

            subscription.cancelAndJoin() // what the ViewModel's Unsubscribe does

            assertEquals(listOf(batteryLevel), radio.unsubscribes)
            assertEquals(emptySet(), radio.notifying)
            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            call.cancelAndJoin()
        }

        @Test
        fun neverSubscribesToACharacteristicThatDoesNotNotify() = runTest {
            val name = Characteristic(fullUuid("180A"), fullUuid("2A29"), listOf(Read))
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.subscribe(name).toList() }

            assertEquals("This characteristic doesn't notify: it has no Notify or Indicate property.", error.message)
            assertEquals(0, radio.mostAtOnce) // no request was sent
            call.cancelAndJoin()
        }

        @Test
        fun aRefusedSubscriptionReachesTheCallerAndKeepsTheConnection() = runTest {
            radio.subscribeFailure = "The device refused to change its notifications (Android status 3)."
            val call = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            val error = assertFailsWith<ConnectionException> { session.subscribe(batteryLevel).toList() }

            assertEquals("The device refused to change its notifications (Android status 3).", error.message)
            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            call.cancelAndJoin()
        }

        // How a connection ends: asked for, or not. Either way, everything on the link ends with it.

        @Test
        fun disconnectEndsTheSubscriptionsWithoutAnError() = runTest {
            val call = async { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()
            val subscription = launch { session.subscribe(batteryLevel).collect() }
            testScheduler.advanceUntilIdle()

            session.disconnect()
            call.await() // returns normally
            subscription.join() // ends normally too

            assertFalse(radio.isLinked)
            assertEquals(emptyList(), radio.unsubscribes) // no request on a link that's gone
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun aDroppedLinkEndsEverythingOnIt() = runTest {
            radio.values[batteryLevel] = byteArrayOf(0x52)
            val call = async { assertFailsWith<ConnectionException> { session.connect(obd) } }
            radio.answer()
            testScheduler.runCurrent()
            val subscription = launch { session.subscribe(batteryLevel).collect() }
            testScheduler.advanceUntilIdle()
            val read = async { assertFailsWith<ConnectionException> { session.read(batteryLevel) } }
            testScheduler.runCurrent() // the read is waiting for its answer

            radio.fail("The link to OBD-II Adapter was lost (Android status 8).")

            assertEquals("The link to OBD-II Adapter was lost (Android status 8).", call.await().message)
            assertEquals("The link closed before the device answered.", read.await().message)
            subscription.join() // ended, without an error of its own
            assertFalse(radio.isLinked)
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun aDropDuringDiscoveryIsReportedOnceAsTheDrop() = runTest {
            val call = async { assertFailsWith<ConnectionException> { session.connect(obd) } }
            radio.answer()
            testScheduler.runCurrent()
            val discovery = async { assertFailsWith<ConnectionException> { session.services() } }
            testScheduler.runCurrent() // the discovery is waiting for its answer

            radio.fail("The link to OBD-II Adapter was lost (Android status 8).")

            assertEquals("The link to OBD-II Adapter was lost (Android status 8).", call.await().message)
            discovery.await() // failed too, but connect() is the one that says why
        }

        @Test
        fun aDisconnectDuringDiscoveryIsNotAnError() = runTest {
            val call = async { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()
            val discovery = async { assertFailsWith<ConnectionException> { session.services() } }
            testScheduler.runCurrent()

            session.disconnect()

            call.await() // returns normally: the user asked for it
            discovery.await()
            assertEquals(ConnectionState.Disconnected, session.connectionState.value)
        }

        @Test
        fun connectsAgainAfterADrop() = runTest {
            radio.services = listOf(DeviceService(batteryService, listOf(batteryLevel)))
            val first = async { assertFailsWith<ConnectionException> { session.connect(obd) } }
            radio.answer()
            testScheduler.runCurrent()
            radio.fail("The link to OBD-II Adapter was lost (Android status 8).")
            first.await()

            val second = launch { session.connect(obd) }
            radio.answer()
            testScheduler.runCurrent()

            assertEquals(ConnectionState.Connected(obd), session.connectionState.value)
            assertEquals(radio.services, session.services())
            assertEquals(2, radio.attempts)
            second.cancelAndJoin()
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

        @Test
        fun aFailedDiscoveryOpensNoAlertOfItsOwn() = runTest {
            session.discoveryFailure = ConnectionException("Couldn't discover the services of OBD-II Adapter.")
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            assertNull(viewModel.uiState.value.errorMessage) // connect() reports why the connection ended
            assertFalse(viewModel.uiState.value.discovering)
        }

        @Test
        fun eachNotifiedValueLandsUnderItsCharacteristic() = runTest {
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            viewModel.subscribe(batteryLevel)
            testScheduler.runCurrent()
            assertEquals(setOf(batteryLevel), viewModel.uiState.value.subscribed)

            session.notifications.send("81 %")
            testScheduler.runCurrent()
            assertEquals("81 %", viewModel.uiState.value.values[batteryLevel])

            session.notifications.send("80 %")
            testScheduler.runCurrent()
            assertEquals("80 %", viewModel.uiState.value.values[batteryLevel])
        }

        @Test
        fun unsubscribeStopsCollecting() = runTest {
            session.connectionState.value = ConnectionState.Connected(obd)
            viewModel.subscribe(batteryLevel)
            testScheduler.runCurrent()
            assertTrue(session.isSubscribed)

            viewModel.unsubscribe(batteryLevel)
            testScheduler.runCurrent()

            assertFalse(session.isSubscribed)
            assertEquals(emptySet(), viewModel.uiState.value.subscribed)
        }

        @Test
        fun aFailedSubscriptionShowsWhyUnderTheCharacteristic() = runTest {
            session.subscribeFailure = ConnectionException("The device refused to change its notifications (Android status 3).")
            session.connectionState.value = ConnectionState.Connected(obd)
            testScheduler.runCurrent()

            viewModel.subscribe(batteryLevel)
            testScheduler.runCurrent()

            assertEquals(
                "Subscribe failed: The device refused to change its notifications (Android status 3).",
                viewModel.uiState.value.values[batteryLevel],
            )
            assertEquals(emptySet(), viewModel.uiState.value.subscribed)
            assertNull(viewModel.uiState.value.errorMessage)
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
                onSubscribe = viewModel::subscribe,
                onUnsubscribe = viewModel::unsubscribe,
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
            onSubscribe: (Characteristic) -> Unit,
            onUnsubscribe: (Characteristic) -> Unit,
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
                    ServiceSection(service, state, onRead, onSubscribe, onUnsubscribe)
                }
            }
        }

        // One service: its UUID, then each characteristic with its properties, a Read button if it has
        // the Read property, Subscribe or Unsubscribe if it notifies, and the last value read or
        // notified, or why the read or the subscription failed.
        @Composable
        private fun ServiceSection(
            service: DeviceService,
            state: DeviceDetailUiState,
            onRead: (Characteristic) -> Unit,
            onSubscribe: (Characteristic) -> Unit,
            onUnsubscribe: (Characteristic) -> Unit,
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
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                characteristic.properties.joinToString(" · ") { it.label },
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.weight(1f),
                            )
                            if (CharacteristicProperty.Read in characteristic.properties) {
                                OutlinedButton(onClick = { onRead(characteristic) }) { Text("Read") }
                            }
                            if (characteristic.notifies) {
                                if (characteristic in state.subscribed) {
                                    OutlinedButton(onClick = { onUnsubscribe(characteristic) }) { Text("Unsubscribe") }
                                } else {
                                    OutlinedButton(onClick = { onSubscribe(characteristic) }) { Text("Subscribe") }
                                }
                            }
                        }
                        state.values[characteristic]?.let { Text(it) }
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
            // What the service rows were last built from, and the value line under each characteristic.
            private var builtFor: Pair<List<DeviceService>, Set<Characteristic>>? = null
            private val valueViews = mutableMapOf<Characteristic, TextView>()

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
                builtFor = null // the next view gets its own rows
                valueViews.clear()
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
                renderServices(b.servicesContainer, state)
                renderError(state.errorMessage)
            }

            // A handful of rows, so no RecyclerView. They are rebuilt only when the services or the
            // subscriptions change; a new value only changes the text of its line. Rebuilding on every
            // notification would replace a button under the user's finger, and the tap would be lost.
            private fun renderServices(container: LinearLayout, state: DeviceDetailUiState) {
                if (builtFor != state.services to state.subscribed) {
                    buildServices(container, state)
                    builtFor = state.services to state.subscribed
                }
                for ((characteristic, view) in valueViews) {
                    val value = state.values[characteristic]
                    view.text = value.orEmpty()
                    view.visibility = if (value == null) View.GONE else View.VISIBLE
                }
            }

            // One block per service: its UUID, then each characteristic with its properties, a Read
            // button if it has the Read property, Subscribe or Unsubscribe if it notifies, and a line for
            // the last value read or notified, or why the read or the subscription failed.
            private fun buildServices(container: LinearLayout, state: DeviceDetailUiState) {
                container.removeAllViews()
                valueViews.clear()
                val context = container.context
                for (service in state.services) {
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
                        if (characteristic.notifies) {
                            val subscribed = characteristic in state.subscribed
                            row.addView(Button(context).apply {
                                text = if (subscribed) "Unsubscribe" else "Subscribe"
                                setOnClickListener {
                                    if (subscribed) viewModel.unsubscribe(characteristic) else viewModel.subscribe(characteristic)
                                }
                            })
                        }
                        container.addView(row)
                        val valueView = TextView(context).apply { setPadding(32, 0, 0, 0) }
                        valueViews[characteristic] = valueView
                        container.addView(valueView)
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
    // answers to discovery, reads and subscriptions, and every notification.
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
        private var switching: (characteristic: CBCharacteristic, reply: NotifyReply)?

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
            switching?.reply.failed(message: "The link closed before the device answered.")
            switching = nil
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
            guard let target = target(for: characteristic, on: peripheral) else {
                return reply.failed(message: "This device has no such characteristic. Discover its services again.")
            }
            reading = (target, reply)
            peripheral.readValue(for: target)
        }

        // On or off. CoreBluetooth writes the characteristic's CCCD descriptor itself.
        func setNotify(characteristic: Characteristic, on: Bool, reply: NotifyReply) {
            guard let peripheral, peripheral.state == .connected else { return reply.failed(message: "Not connected.") }
            guard let target = target(for: characteristic, on: peripheral) else {
                return reply.failed(message: "This device has no such characteristic. Discover its services again.")
            }
            switching = (target, reply)
            peripheral.setNotifyValue(on, for: target)
        }

        // CBUUID compares by value, so the full form finds a characteristic iOS reported as "2A19".
        private func target(for characteristic: Characteristic, on peripheral: CBPeripheral) -> CBCharacteristic? {
            let serviceUuid = CBUUID(string: characteristic.serviceUuid)
            let uuid = CBUUID(string: characteristic.uuid)
            return peripheral.services?.first(where: { $0.uuid == serviceUuid })?
                .characteristics?.first(where: { $0.uuid == uuid })
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

        // Called after readValue(for:), and for each notification. The read waiting for this
        // characteristic takes the first value; any other value is a notification.
        func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
                        error: Error?) {
            guard peripheral === self.peripheral else { return }
            if let reading, reading.characteristic === characteristic {
                self.reading = nil
                if let error {
                    reading.reply.failed(message: "The device refused the read: \(error.localizedDescription)")
                } else {
                    reading.reply.read(value: characteristic.value ?? Data())
                }
            } else if error == nil, let value = characteristic.value, let service = characteristic.service {
                feed?.notified(serviceUuid: service.uuid.uuidString, characteristicUuid: characteristic.uuid.uuidString,
                               value: value)
            }
        }

        // The answer to setNotifyValue(_:for:): notifications are now on or off, or the device refused.
        func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic,
                        error: Error?) {
            guard peripheral === self.peripheral, let switching, switching.characteristic === characteristic else { return }
            self.switching = nil
            if let error {
                switching.reply.failed(message: "The device refused to change its notifications: \(error.localizedDescription)")
            } else {
                switching.reply.done()
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
                    onRead: { viewModel.read(characteristic: $0) },
                    onSubscribe: { viewModel.subscribe(characteristic: $0) },
                    onUnsubscribe: { viewModel.unsubscribe(characteristic: $0) }
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
            let onSubscribe: (Characteristic) -> Void
            let onUnsubscribe: (Characteristic) -> Void

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
                            ServiceSection(service: service, state: state, onRead: onRead,
                                           onSubscribe: onSubscribe, onUnsubscribe: onUnsubscribe)
                        }
                    }
                    .padding()
                }
                .navigationTitle("Device")
                .navigationBarTitleDisplayMode(.inline)
            }
        }

        // One service: its UUID, then each characteristic with its properties, a Read button if it has
        // the Read property, Subscribe or Unsubscribe if it notifies, and the last value read or
        // notified, or why the read or the subscription failed.
        private struct ServiceSection: View {
            let service: DeviceService
            let state: DeviceDetailUiState
            let onRead: (Characteristic) -> Void
            let onSubscribe: (Characteristic) -> Void
            let onUnsubscribe: (Characteristic) -> Void

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
                                if characteristic.notifies {
                                    if state.subscribed.contains(characteristic) {
                                        Button("Unsubscribe") { onUnsubscribe(characteristic) }
                                            .buttonStyle(.bordered)
                                    } else {
                                        Button("Subscribe") { onSubscribe(characteristic) }
                                            .buttonStyle(.bordered)
                                    }
                                }
                            }
                            if let value = state.values[characteristic] {
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
            // What the service rows were last built from, and the value line under each characteristic.
            private var builtServices: [DeviceService]?
            private var builtSubscribed: Set<Characteristic> = []
            private var valueLabels: [Characteristic: UILabel] = [:]

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
                renderServices(state)
                renderError(state.errorMessage)
            }

            // A handful of rows, so no table. They are rebuilt only when the services or the
            // subscriptions change; a new value only changes the text of its line. Rebuilding on every
            // notification would replace a button under the user's finger, and the tap would be lost.
            private func renderServices(_ state: DeviceDetailUiState) {
                if builtServices != state.services || builtSubscribed != state.subscribed {
                    buildServices(state)
                    builtServices = state.services
                    builtSubscribed = state.subscribed
                }
                for (characteristic, label) in valueLabels {
                    let value = state.values[characteristic]
                    label.text = value
                    label.isHidden = value == nil
                }
            }

            // One block per service: its UUID, then each characteristic with its properties, a Read
            // button if it has the Read property, Subscribe or Unsubscribe if it notifies, and a line for
            // the last value read or notified, or why the read or the subscription failed.
            private func buildServices(_ state: DeviceDetailUiState) {
                servicesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
                valueLabels = [:]
                for service in state.services {
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
                        row.spacing = 8
                        if characteristic.properties.contains(.read) {
                            let readButton = UIButton(configuration: .bordered())
                            readButton.configuration?.title = "Read"
                            readButton.addAction(UIAction { [weak self] _ in
                                self?.viewModel.read(characteristic: characteristic)
                            }, for: .touchUpInside)
                            readButton.setContentHuggingPriority(.required, for: .horizontal) // the label takes the room
                            row.addArrangedSubview(readButton)
                        }
                        if characteristic.notifies {
                            let subscribed = state.subscribed.contains(characteristic)
                            let notifyButton = UIButton(configuration: .bordered())
                            notifyButton.configuration?.title = subscribed ? "Unsubscribe" : "Subscribe"
                            notifyButton.addAction(UIAction { [weak self] _ in
                                if subscribed {
                                    self?.viewModel.unsubscribe(characteristic: characteristic)
                                } else {
                                    self?.viewModel.subscribe(characteristic: characteristic)
                                }
                            }, for: .touchUpInside)
                            notifyButton.setContentHuggingPriority(.required, for: .horizontal)
                            row.addArrangedSubview(notifyButton)
                        }
                        let valueLabel = UILabel()
                        valueLabel.numberOfLines = 0
                        valueLabels[characteristic] = valueLabel
                        let block = UIStackView(arrangedSubviews: [uuidLabel, row, valueLabel])
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
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0, thời gian ảo của `kotlinx-coroutines-test`). Nó là **mô hình**: radio là giả, nhưng hàm `subscription` có cùng hình dạng với `SessionService.subscribe` của bài.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-notification-nhu-ang-ky-nhan-tin-nhan): notification như đăng ký nhận tin nhắn, và vì sao port có hai hình dạng (mục 1, 2).
    3. [A3](#a3-mot-lan-ang-ky-tu-au-toi-cuoi-chay-that): một lần đăng ký từ đầu tới cuối, có và không có `NonCancellable`, chạy thật (mục 3).
    4. [A4](#a4-nam-loi-ra-mot-finally): năm lối ra, một `finally`, và "báo một lần" (mục 4).
    5. [A5](#a5-mot-callback-hai-viec-tren-ios): một callback hai việc trên iOS (mục 6).
    6. [A6](#a6-vi-sao-nut-nuot-mat-lan-bam): vì sao nút nuốt mất lần bấm trên XML và UIKit (mục 7).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. **Notification**: thiết bị tự gửi giá trị mỗi khi nó đổi, sau khi app **bật** bằng cách ghi `01 00` vào descriptor CCCD (`0x2902`); tắt là ghi `00 00`.
    2. Port có hai hình dạng: **bật / tắt** là `suspend fun` (một request, đi qua `Mutex`), **các giá trị** là `Flow` (một dòng chảy).
    3. `SessionService.subscribe` trả về một `Flow<String>`: collect là đăng ký, **huỷ collect là huỷ đăng ký**; lệnh tắt chạy trong `NonCancellable` vì coroutine đã bị huỷ.
    4. Một đăng ký **sống bằng liên kết**: `current.join()` trả về khi liên kết kết thúc vì bất cứ lý do gì, và Flow kết thúc bình thường.
    5. Mọi cách kết thúc kết nối đều đi qua **một `finally`** trong `connect()`, và lý do chỉ được báo **một lần**, từ `connect()`.

Ví dụ đời thường cho cả bài: **đăng ký nhận tin nhắn khuyến mãi của một cửa hàng.** Đọc (read) là gọi điện hỏi giá: hỏi một lần, trả lời một lần. Đăng ký (subscribe) là nhắn "ĐK" tới tổng đài (ghi CCCD); từ đó cửa hàng tự nhắn mỗi khi có giá mới. Nhắn "HUY" là huỷ. Nếu cửa hàng đóng cửa (liên kết rớt), tin nhắn ngừng mà chẳng ai báo; bạn phải tự nhận ra.

| Chữ trong bài | Nói đơn giản | Trong m11 là |
|---|---|---|
| notify / indicate | thiết bị tự gửi giá trị; indicate thì chờ app xác nhận đã nhận | Battery Level, Temperature, characteristic chỉ-notify |
| descriptor | một attribute nhỏ gắn vào characteristic | CCCD, UUID `0x2902` |
| CCCD | công tắc notification của thiết bị | `01 00` bật, `00 00` tắt |
| `SharedFlow` | flow **nóng**: có sẵn dù không ai nghe, không giữ gì cho người tới sau | `notifications` của cả hai adapter |
| `channelFlow` | flow mà khối có thể `launch` coroutine con để `send` | `SessionService.subscribe` |
| `CoroutineStart.UNDISPATCHED` | chạy ngay, không xếp hàng | nghe trước khi bật |
| `Job.join()` | chờ một job kết thúc vì bất cứ lý do gì | chờ liên kết kết thúc |
| `NonCancellable` | cho một đoạn code chạy xong dù coroutine đã bị huỷ | gửi lệnh tắt khi Unsubscribe |
| `endedBy` | lý do service tự kết thúc liên kết | lần khám phá thất bại |

### A2. Notification như đăng ký nhận tin nhắn

Giải thích thêm cho [mục 1](#1-notification-thiet-bi-noi-truoc) và [mục 2](#2-cac-port-lon-them-theo-hai-hinh-dang).

| | Read (bài 15) | Subscribe (bài 16) |
|---|---|---|
| Ai nói trước | app hỏi | app bật một lần, rồi **thiết bị** nói |
| Bao nhiêu giá trị | một | nhiều, theo nhịp của thiết bị |
| Android gửi | `readCharacteristic` | `setCharacteristicNotification` + `writeDescriptor(CCCD, 01 00)` |
| Android nhận | `onCharacteristicRead` | `onDescriptorWrite` (đã bật), rồi `onCharacteristicChanged` (mỗi giá trị) |
| iOS gửi | `readValue(for:)` | `setNotifyValue(true, for:)` |
| iOS nhận | `didUpdateValueFor` | `didUpdateNotificationStateFor` (đã bật), rồi `didUpdateValueFor` (mỗi giá trị) |
| Hình dạng trên port | `suspend fun read` | `suspend fun subscribe` / `unsubscribe` + `fun notifications(): Flow` |

Vì sao không gộp thành một `subscribe(): Flow<ByteArray>`? Vì service cần giữ `Mutex` **đúng trong lúc** request bật đang chờ câu trả lời, không lâu hơn. Nếu bật nằm ẩn bên trong việc collect một `Flow`, service không biết lúc nào request đó xong để nhả khoá, và một lần đọc ngay sau có thể đụng cờ bận của Android.

So với TS/JS: giống WebSocket. `ws.send({ type: "subscribe" })` là một request có trả lời ("subscribed"); `ws.onmessage` là dòng chảy giá trị. Hai thứ khác hình dạng, nên viết thành hai API.

### A3. Một lần đăng ký từ đầu tới cuối, chạy thật

Giải thích thêm cho [mục 3](#3-session-service-mot-lan-ang-ky). Hàm `subscription` dưới đây có cùng hình dạng với `SessionService.subscribe`: nghe bằng `UNDISPATCHED`, bật, `join()` liên kết, bắt `CancellationException` để tắt, `values.cancel()` khi liên kết kết thúc. Radio giả gửi một giá trị pin mỗi giây sau khi được bật. Ba lần chạy: Unsubscribe có `NonCancellable`, Unsubscribe **không** có `NonCancellable`, và liên kết bị rớt.

```kotlin title="L16Subscribe.kt (mô hình, không có trong app)"
fun subscription(radio: Radio, link: Job, nonCancellable: Boolean): Flow<String> = channelFlow {
    val values = launch(start = CoroutineStart.UNDISPATCHED) {
        radio.notifications().collect { send("$it %") }
    }
    try {
        radio.subscribe()
        link.join()
    } catch (e: CancellationException) {
        if (link.isActive) {
            if (nonCancellable) withContext(NonCancellable) { radio.unsubscribe() }
            else try { radio.unsubscribe() } catch (c: CancellationException) { radio.log += "tắt: KHÔNG gửi được (${c::class.simpleName})" }
        }
        throw e
    }
    values.cancel()
}

fun main() = runTest {
    for (nc in listOf(true, false)) {
        val t0 = currentTime
        val radio = Radio(backgroundScope)
        val link = Job()
        val job = launch { subscription(radio, link, nc).collect { println("  t=${currentTime - t0} ms nhận $it") } }
        delay(2500)
        job.cancel(); job.join()
        println("Unsubscribe, NonCancellable=$nc: ${radio.log}")
        link.cancel()
    }
    val t0 = currentTime
    val radio = Radio(backgroundScope)
    val link = Job()
    val job = launch {
        subscription(radio, link, true).collect { println("  t=${currentTime - t0} ms nhận $it") }
        println("  Flow kết thúc bình thường khi liên kết kết thúc")
    }
    delay(1500)
    radio.drop(); link.cancel()
    job.join()
    println("Liên kết rớt: ${radio.log}")
}
```

Output thật:

```text
  t=1100 ms nhận 81 %
  t=2100 ms nhận 80 %
Unsubscribe, NonCancellable=true: [bật (ghi 01 00), tắt (ghi 00 00)]
  t=1100 ms nhận 81 %
  t=2100 ms nhận 80 %
Unsubscribe, NonCancellable=false: [bật (ghi 01 00), tắt: KHÔNG gửi được (JobCancellationException)]
  t=1100 ms nhận 81 %
  Flow kết thúc bình thường khi liên kết kết thúc
Liên kết rớt: [bật (ghi 01 00)]
```

1. **Giá trị đầu tới ở 1100 ms**: 100 ms để bật, rồi 1 giây tới giá trị đầu. Thời gian là ảo, chạy xong trong tích tắc.
2. **Có `NonCancellable`**: Unsubscribe huỷ việc collect, khối bắt `CancellationException`, gửi lệnh tắt và **chờ được** 100 ms câu trả lời, nên thiết bị nhận "tắt".
3. **Không có `NonCancellable`**: coroutine đã bị huỷ, nên `delay` bên trong lệnh tắt ném `JobCancellationException` ngay. Lệnh tắt không bao giờ tới thiết bị; thiết bị sẽ cứ gửi giá trị cho một app không còn nghe. Đó là lý do test `cancellingTheCollectionUnsubscribes` fail khi gỡ khối này.
4. **Liên kết rớt**: `link.join()` trả về, `values.cancel()` dừng coroutine con, và Flow **kết thúc bình thường**, không exception. Không có lệnh tắt nào được gửi, vì không còn liên kết để gửi. Lý do rớt là việc của `connect()` báo.

So với TS/JS: huỷ việc collect giống `AbortController.abort()`. Nhưng trong JS, `await` sau khi abort vẫn chạy được bình thường; trong Kotlin, mọi lời gọi treo trong coroutine đã bị huỷ đều ném lỗi, nên dọn dẹp cần treo phải bọc `withContext(NonCancellable)`.

### A4. Năm lối ra, một `finally`

Giải thích thêm cho [mục 4](#4-mot-may-trang-thai-moi-loi-ra).

Ví dụ đời thường: một **cuộc gọi video nhóm**. Bạn tự cúp (Disconnect), đóng app (màn hình đóng), mất mạng (rớt), cuộc gọi không kết nối được (hết giờ, lần thử thất bại), hay phòng họp bị lỗi không tải được danh sách người (khám phá thất bại). Cách nào thì cuối cùng cũng như nhau: tắt camera, tắt micro, rời phòng, màn hình về trang chủ. Và bạn chỉ nhận **một** thông báo lỗi, về nguyên nhân thật, không phải năm thông báo cho năm hệ quả.

| Lối ra | Ai bắt đầu | `connect()` | Lý do tới màn hình |
|---|---|---|---|
| Disconnect | người dùng | trả về | không có alert |
| Màn hình đóng | ViewModel bị clear | bị huỷ | không có alert |
| Liên kết rớt | thiết bị / radio | ném "was lost" | một alert |
| Khám phá thất bại | service (`endedBy`) | ném "Couldn't discover…" | một alert |
| Hết giờ / thử thất bại | service / radio | ném, như bài 14 | một alert |

Cả năm đều đi qua cùng `finally`: `link = null`, `endedBy = null`, state về `Disconnected`. Vì `Job` của liên kết đã xong, `join()` của mọi lần đăng ký trả về; vì adapter đã đóng radio, mọi request đang chờ thất bại.

Cái khó là "báo một lần". Khi liên kết rớt lúc đang khám phá, có **hai** lỗi cùng lúc: `connect()` ném lần rớt, và `services()` ném "Couldn't discover…". Bài chọn: chỉ `connect()` báo, ViewModel bỏ qua lỗi của `services()`. Và `services()` chỉ ghi `endedBy` nếu liên kết **vẫn còn sống** (`takeIf { it.isActive }`), để một Disconnect người dùng tự bấm không biến thành lỗi.

### A5. Một callback, hai việc trên iOS

Giải thích thêm cho [mục 6](#6-ios-mot-cong-tac-va-mot-callback-cho-hai-viec).

Trên iOS, `peripheral(_:didUpdateValueFor:error:)` nhận **cả** câu trả lời của lần đọc **lẫn** mọi notification, và không có cờ nào phân biệt. Adapter tự phân loại:

| Giá trị tới cho characteristic… | Adapter coi là | Đi tới |
|---|---|---|
| đang có một lần đọc chờ (`reading`) | câu trả lời của lần đọc | `reading.reply.read(value:)` |
| không có lần đọc nào chờ | notification | `feed.notified(…)` sang Kotlin, rồi `SharedFlow` |

Hệ quả (gotcha của mục 6): nếu bạn bấm Read trên một characteristic đang đăng ký, giá trị tới **đầu tiên** đi vào lần đọc, kể cả khi thiết bị gửi nó như một notification. Màn hình vẫn hiện đúng giá trị hiện tại, nhưng `Flow` của lần đăng ký bỏ lỡ đúng một giá trị đó. Android không gặp chuyện này vì có hai callback riêng.

### A6. Vì sao nút nuốt mất lần bấm

Giải thích thêm cho [mục 7](#7-man-hinh-chi-tiet).

Ví dụ đời thường: bạn đặt ngón tay lên một **tờ giấy** để ký, và đúng lúc đó có người rút tờ giấy ra thay bằng một tờ y hệt. Bạn nhấc tay lên ký xong, nhưng chữ ký không nằm trên tờ nào cả.

Một click = nhấn (down) + nhả (up) **trên cùng một view**. Ở bài 15, XML và UIKit gỡ rồi dựng lại mọi hàng mỗi khi state đổi. State chỉ đổi khi bạn bấm Read thì không sao. Nhưng giờ một giá trị tới **mỗi giây**: nếu bạn nhấn giữ hơn 1 giây, cái nút dưới ngón tay bị thay bằng một nút mới giữa lúc nhấn và lúc nhả, và click biến mất.

| Track | Bài 15 | Bài 16 | Vì sao |
|---|---|---|---|
| Compose | recompose | recompose | tự so khác biệt, giữ node nút, chỉ đổi chữ |
| SwiftUI | `ForEach` | `ForEach` | định danh hàng, giữ nút |
| XML | dựng lại mọi hàng ở mỗi state | chỉ dựng lại khi `services to subscribed` đổi; cập nhật dòng giá trị tại chỗ | `builtFor` nhớ lần dựng trước |
| UIKit | dựng lại mọi hàng ở mỗi state | như XML | cùng ý |

So với TS/JS: React giữ DOM node nhờ reconciliation và `key`; nếu bạn tự viết `container.innerHTML = render(state)` mỗi giây, bạn sẽ gặp đúng lỗi này.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 17.

- [ ] Giải thích notify và indicate khác read ra sao, và việc đăng ký thật ra là ghi `01 00` vào CCCD `0x2902` (xem [A2](#a2-notification-nhu-ang-ky-nhan-tin-nhan)).
- [ ] Nói vì sao bật / tắt là `suspend fun` còn các giá trị là `Flow`, và vì sao phải "collect trước, rồi mới đăng ký".
- [ ] Đọc `SessionService.subscribe` và chỉ ra: chỗ nghe trước (`UNDISPATCHED`), chỗ bật trong khoá, chỗ chờ liên kết (`join`), chỗ tắt (`NonCancellable`), chỗ kết thúc (`values.cancel()`) (xem [A3](#a3-mot-lan-ang-ky-tu-au-toi-cuoi-chay-that)).
- [ ] Giải thích vì sao lệnh tắt phải chạy trong `withContext(NonCancellable)`, và chuyện gì xảy ra nếu bỏ nó.
- [ ] Kể năm cách một kết nối kết thúc, cái nào trả về và cái nào ném lỗi, và vì sao lý do chỉ được báo một lần từ `connect()` (xem [A4](#a4-nam-loi-ra-mot-finally)).
- [ ] Bật notification trên Android đủ hai bước (`setCharacteristicNotification` + ghi descriptor, chờ `onDescriptorWrite`), kể cả nhánh `TIRAMISU`.
- [ ] Bật notification trên iOS bằng `setNotifyValue` và phân loại `didUpdateValueFor` thành câu trả lời đọc hay notification (xem [A5](#a5-mot-callback-hai-viec-tren-ios)).
- [ ] Giải thích và sửa lỗi nút nuốt lần bấm trên XML / UIKit khi giá trị tới liên tục (xem [A6](#a6-vi-sao-nut-nuot-mat-lan-bam)).
- [ ] Xem app phục hồi sau lần rớt của Tire Pressure Sensor giả lập: alert một lần, về `not connected`, Connect lại chạy được.
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.
