---
source: lessons/e2-camera-and-media.html
source_ref: live
source_sha: ce1ea35
---

<p class="kicker">Phần mở rộng E2 · tuỳ chọn, sau các bài lõi · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/e2-camera-and-media.html">Bản gốc tiếng Anh</a></p>

# Camera và media

<div class="meta">
  <span class="tag">~2,5 giờ · +1 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: e2 chụp + chọn + hiển thị</span>
  <span class="tag">Cần trước: <a href="../20-tich-hop-va-kiem-tra-cuoi/">20</a> (m15)</span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Một app điện thoại kiểm tra thứ gì đó ngoài đời thật sớm muộn cũng muốn có ảnh của nó: một đầu nối bị hỏng, một đèn báo trên bảng đồng hồ, một nhãn có số serial. Phần mở rộng này cho Native Device Monitor một **màn hình ảnh**: chụp ảnh bằng camera, hoặc chọn một ảnh từ thư viện, và xem nó kèm thông tin media (Appendix A.4 của kế hoạch khoá học). Phần thú vị không phải là bức ảnh. Mà là camera và thư viện ảnh là *màn hình của chính hệ thống*, thứ chỉ một màn hình của bạn mở được, trong khi quyết định mở chúng thuộc về app. Phần mở rộng cho thấy một outbound adapter **MediaPicker** và màn hình hợp tác ra sao, quyền camera nhập vào code quyền của bài 12 thế nào, và những cái bẫy trên đường: file mà app camera ghi hộ bạn, và ảnh được lưu ở phía chúng. Điều đó cho milestone **e2**: chụp, chọn và hiển thị, trên cả hai nền tảng.

!!! info "Nguồn chính"
    Android: [Photo picker](https://developer.android.com/training/data-storage/shared/photo-picker) và [TakePicture](https://developer.android.com/reference/androidx/activity/result/contract/ActivityResultContracts.TakePicture) trước mục 3, [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider) và [MediaStore.ACTION_IMAGE_CAPTURE](https://developer.android.com/reference/android/provider/MediaStore#ACTION_IMAGE_CAPTURE) trước mục 4. Apple: [Requesting authorization to capture and save media](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media) trước mục 2, [PhotosPicker](https://developer.apple.com/documentation/photosui/photospicker), [PHPickerViewController](https://developer.apple.com/documentation/photosui/phpickerviewcontroller) và [UIImagePickerController](https://developer.apple.com/documentation/uikit/uiimagepickercontroller) trước mục 5.

!!! info "Track"
    Các port, service, ViewModel và mọi test là code dùng chung, giống nhau trên mọi track. Adapter Android nằm trong `androidMain` và adapter iOS trong app iOS, nên cả hai track của một nền tảng dùng chung chúng. Các track khác nhau ở màn hình ảnh, ở việc ai cho adapter mượn đường tới màn hình của hệ thống, và ở nút mở màn hình đó (mục 3, 5 và 7); giờ thêm cho mỗi track là những phần đó trên XML hoặc UIKit. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

!!! info "Đã làm E1 trước?"
    Mọi phần mở rộng bắt đầu từ m15, và các file đầy đủ ở đây là m15 cộng E2. Nếu project của bạn đã có e1, vài file có dòng của cả hai phần mở rộng: giữ dòng của E1 và thêm dòng của E2. Các file đó là `shared/build.gradle.kts` (dependency của Ktor và ExifInterface), `di/AppModule.kt` (cả hai binding, cả hai ViewModel), màn hình chính (nút "API test" và "Photo" cạnh nhau), manifest Android và `docs/checklists.md`. Trên Compose, `DeviceMonitorApp.kt` cũng có cả hai route; trên XML, `nav_graph.xml` có cả hai destination. `AppModuleTest` cũng dựng cả hai ViewModel. Code của trang này được dựng từ m15 không có e1, nên hãy kiểm tra các file đã gộp bằng test và cả hai app.

## Thay đổi so với m15

| Cái gì | m15 | e2 |
|---|---|---|
| app core | năm khả năng: quét, session, quyền, trạng thái, monitor | khả năng thứ sáu: inbound port `MediaCapture` và `MediaCaptureService`; outbound port `MediaPicker`; các model `MediaInfo`, `MediaSource` và `PickedMedia`, và `MediaException`; `Permission` có thêm `Camera` |
| outbound adapter | mỗi nền tảng một `PermissionChecker`, cho Bluetooth | cùng hai cái đó, giờ cho cả camera; thêm `AndroidMediaPicker` (`androidMain`) và `IosMediaPicker` (Swift, app iOS) |
| inbound adapter dùng chung | ba ViewModel | thêm `MediaViewModel` và `MediaUiState` |
| Koin | chín adapter truyền vào `initKoin` | mười: thêm `mediaPicker`; `MediaCapture` và `MediaViewModel` được bind |
| màn hình | màn hình chính và màn hình thiết bị | thêm màn hình ảnh, mở bằng một nút "Photo" trên màn hình chính |
| Android | quyền Bluetooth và trạng thái | thêm `CAMERA`, một tính năng camera tuỳ chọn, một `FileProvider` cho thư mục ảnh, và AndroidX ExifInterface 1.4.2 trong `androidMain` và app |
| iOS | chuỗi giải thích việc dùng Bluetooth | thêm `NSCameraUsageDescription`; không có khoá thư viện ảnh |
| test | 105 mỗi nền tảng | 117 mỗi nền tảng: 6 cho service, 6 cho ViewModel |
| `docs/checklists.md` | "Camera: chỉ phần mở rộng E2" | bốn hàng camera: xin quyền, chụp, chọn, đóng mà không có ảnh |

## 1. Hai chuyến đi tới hệ thống, một port

Appendix A.4 đưa hình dạng: một inbound port `MediaCapture` với `capturePhoto()` và `pickMedia()`, mỗi cái trả về một `MediaInfo`, và một outbound port `MediaPicker` với "cùng hai lời gọi, mỗi nền tảng một adapter". Điều làm khả năng này khác các khả năng khác là chỗ công việc diễn ra. Một app có thể tự vẽ màn hình camera (CameraX trên Android, AVFoundation trên iOS) hoặc tự đọc thư viện; app này không làm vậy. Nó *nhờ hệ thống* hiện camera hay bộ chọn ảnh của hệ thống, chờ trong lúc người dùng ở đó, và nhận lại một câu trả lời. Nên mỗi lời gọi là một chuyến đi: ra khỏi app, và quay về với một bức ảnh hoặc không có gì.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 340" role="img" aria-labelledby="le2-path-title">
      <title id="le2-path-title">Đường đi của một bức ảnh trong e2. Màn hình ảnh, trên bất kỳ track nào trong bốn, gọi MediaViewModel, một inbound adapter. ViewModel gọi inbound port MediaCapture, do MediaCaptureService implement trong app core. Service kiểm tra quyền camera qua outbound port PermissionChecker và gọi outbound port MediaPicker. AndroidMediaPicker trong androidMain và IosMediaPicker trong app iOS implement MediaPicker; mỗi cái mở camera hay bộ chọn ảnh của hệ thống và chép ảnh vào bộ nhớ của app.</title>
      <defs><marker id="le2-path-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="20" y="30" width="150" height="56" rx="6"></rect>
      <text class="title" x="32" y="54">Màn hình ảnh</text>
      <text class="small muted" x="32" y="74">bốn track</text>
      <g data-part="inbound">
        <rect class="box" x="200" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="212" y="54">MediaViewModel</text>
        <text class="small" x="212" y="74">inbound adapter</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="390" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="402" y="54">MediaCapture</text>
        <text class="small" x="402" y="74">inbound port</text>
      </g>
      <g data-part="core">
        <rect class="box" x="580" y="30" width="160" height="56" rx="6"></rect>
        <text class="title" x="592" y="54">MediaCaptureService</text>
        <text class="small" x="592" y="74">các quy tắc về ảnh</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="390" y="150" width="160" height="56" rx="6"></rect>
        <text class="title" x="402" y="174">PermissionChecker</text>
        <text class="small" x="402" y="194">outbound port · Camera</text>
        <rect class="box" x="580" y="150" width="160" height="56" rx="6"></rect>
        <text class="title" x="592" y="174">MediaPicker</text>
        <text class="small" x="592" y="194">outbound port</text>
      </g>
      <g data-part="android">
        <rect class="box" x="370" y="260" width="180" height="56" rx="6"></rect>
        <text class="title" x="382" y="284">AndroidMediaPicker</text>
        <text class="small" x="382" y="304">androidMain (Kotlin)</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="580" y="260" width="160" height="56" rx="6"></rect>
        <text class="title" x="592" y="284">IosMediaPicker</text>
        <text class="small" x="592" y="304">app iOS (Swift)</text>
      </g>
      <rect class="box" x="20" y="260" width="200" height="56" rx="6"></rect>
      <text class="title" x="32" y="284">màn hình của hệ thống</text>
      <text class="small muted" x="32" y="304">camera · bộ chọn ảnh</text>
      <path class="edge" d="M170,58 L198,58" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge" d="M360,58 L388,58" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge" d="M550,58 L578,58" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge" d="M660,86 L660,148" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge" d="M620,86 L520,148" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge dashed" d="M480,258 L620,208" marker-end="url(#le2-path-arrow)"></path>
      <path class="edge dashed" d="M660,258 L660,208" marker-end="url(#le2-path-arrow)"></path>
      <text class="small muted" x="672" y="240">implements</text>
      <path class="edge" d="M370,288 L222,288" marker-end="url(#le2-path-arrow)"></path>
      <text class="small muted" x="236" y="278">mở, chờ</text>
      <text class="small muted" x="20" y="130">màn hình cho adapter mượn đường</text>
      <text class="small muted" x="20" y="146">tới màn hình của hệ thống (mục 3)</text>
    </svg>
    <figcaption>Đường đi của một bức ảnh. Các quy tắc nằm trong service; camera và bộ chọn của nền tảng nằm sau <code>MediaPicker</code>, mỗi nền tảng một adapter.
<ul class="legend">
    <li data-part="inbound">inbound port và adapter</li>
    <li data-part="core">app core</li>
    <li data-part="outbound">outbound port</li>
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MediaPicker.kt" hl_lines="4 7 11"
⋯ package, import, and the comment: one adapter per platform; neither call throws
interface MediaPicker {
    // Whether this device has a camera. Never shows anything.
    fun hasCamera(): Boolean

    // Opens the system camera and waits until the user takes a photo or closes it.
    suspend fun capturePhoto(): PickedMedia

    // Opens the system photo picker, images only, and waits until the user picks one or
    // closes it.
    suspend fun pickMedia(): PickedMedia
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/PickedMedia.kt" hl_lines="3 6 10"
sealed interface PickedMedia {
    // The user took or chose a photo, and the adapter copied it into the app's storage.
    data class Photo(val info: MediaInfo) : PickedMedia

    // The user closed the camera or the picker without a photo. Not an error.
    data object Cancelled : PickedMedia

    // Something went wrong on the way, in the platform's words: no camera app, a file that
    // couldn't be copied, an image the platform can't read.
    data class Failed(val reason: String) : PickedMedia
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MediaInfo.kt" hl_lines="2 4 5"
data class MediaInfo(
    val path: String,      // the copy's file path, which the screens show
    val source: MediaSource,
    val type: String,      // its MIME type, such as "image/jpeg" or "image/heic"
    val width: Int,        // in pixels, the way up the photo is shown
    val height: Int,
    val sizeBytes: Long,   // the copy's size on disk
)

enum class MediaSource { Camera, Library }
```

1. **Một chuyến đi có ba kết cục, và chỉ một cái là ảnh.** Đóng camera là việc người dùng làm suốt; nó không phải lỗi, nên nó là một giá trị riêng, `Cancelled`. Một lần thất bại mang lý do của nền tảng. Vì mọi kết cục đều là giá trị, port không có exception nào phải ghi chú, và adapter Swift trả về object Kotlin trơn (mục 5).
2. **`hasCamera()`** là cùng loại câu hỏi với `BleScanner.isAvailable()` của bài 13: một sự thật về thiết bị mà service cần trước khi bắt đầu bất cứ việc gì.
3. **App giữ bản sao của riêng nó.** Thứ hệ thống trao lại không phải là một file app sở hữu: trên Android, câu trả lời của photo picker là một content URI mà app đọc được trong một thời gian (tới khi "thiết bị khởi động lại hoặc tới khi app dừng", hướng dẫn photo picker nói); trên iOS, bộ chọn trao byte của ảnh. Mỗi adapter ghi một file vào cache của app, và `MediaInfo.path` trỏ tới đó, một chuỗi trơn mà core giữ được mà không cần biết gì về URI.
4. **Thông tin media, đo một lần.** Loại, kích thước pixel và kích thước file được adapter đọc, nơi có API ảnh của nền tảng. Chiều rộng và chiều cao là của ảnh theo chiều nó được hiện (mục 8 nói vì sao điều đó không giống với số pixel được lưu).

## 2. Service và quyền camera

Service giữ các quy tắc, và có hai: camera chỉ mở trên thiết bị có camera và khi quyền camera đã được cấp; và thư viện hoàn toàn không cần quyền.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/MediaCaptureService.kt" hl_lines="3 6 7 14 18"
class MediaCaptureService(
    private val picker: MediaPicker,
    private val permissions: PermissionChecker,
) : MediaCapture {
    override suspend fun capturePhoto(): MediaInfo? {
        if (!picker.hasCamera()) throw MediaException("This device has no camera.")
        if (permissions.check(Permission.Camera) != PermissionStatus.Granted) {
            throw MediaException("Taking a photo needs the camera permission.")
        }
        return outcome(picker.capturePhoto(), "The photo couldn't be saved")
    }

    override suspend fun pickMedia(): MediaInfo? =
        outcome(picker.pickMedia(), "The photo couldn't be loaded")

    private fun outcome(picked: PickedMedia, failure: String): MediaInfo? = when (picked) {
        is PickedMedia.Photo -> picked.info
        PickedMedia.Cancelled -> null
        is PickedMedia.Failed -> throw MediaException("$failure: ${picked.reason}")
    }
}
```

1. **Quyền camera đi qua port mà Bluetooth đã dùng.** `ScanningService` kiểm tra `PermissionChecker` trước khi bật radio (bài 13); `MediaCaptureService` làm y vậy trước khi mở camera. Một port không phải một service khác, nên điều này được phép theo mục "các service không biết nhau" của checklist refactor. Service chỉ kiểm tra: xin là lựa chọn của màn hình, qua `PermissionAccess`, y như với Bluetooth.
2. **Không cần quyền cho thư viện, trên cả hai nền tảng.** Photo picker của Android cho người dùng "chỉ cấp cho app quyền truy cập những ảnh và video đã chọn, thay vì cả thư viện media", và app của chúng ta không khai báo quyền media nào. `PHPickerViewController` của Apple chạy trong một process riêng, nên "nó riêng tư mặc định. Người dùng không cần cấp quyền tường minh để app chọn ảnh". `PhotosPicker` của SwiftUI là bộ chọn của cùng framework đó, thứ "hiện trong một view hệ thống và chỉ cho app truy cập những ảnh người dùng chọn" (trang tổng quan PhotosUI); trên Simulator cả hai bộ chọn đều mở mà không có hộp thoại và không cần khoá thư viện. Một app tự đọc cả thư viện thì cần quyền thư viện; app này không bao giờ cần.
3. **Inbound port nói với ViewModel theo cách `DeviceScanning` nói:** một `MediaInfo`, `null` cho "đóng mà không có ảnh", hoặc một `MediaException` kèm câu chữ cho người dùng, như `ScanException`. Ba giá trị của outbound port thành ba cái đó.

`Permission` có thêm trường hợp thứ hai, `Camera`, và `PermissionChecker` của mỗi nền tảng ánh xạ nó. Không gì khác trong code quyền của bài 12 đổi: quy tắc của `PermissionService` (chỉ hiện hộp thoại khi hệ thống còn hiện được) và năm trạng thái chạy được với mọi quyền.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt" hl_lines="3"
    private fun Permission.androidNames(): List<String> = when (this) {
⋯ Permission.Bluetooth as in m15
        Permission.Camera -> listOf(Manifest.permission.CAMERA)
    }
```

```swift title="iosApp/iosApp/IosPermissionChecker.swift · both iOS tracks" hl_lines="2 4 11 18"
    func check(permission: Permission) -> PermissionStatus {
        switch permission {
        case .bluetooth: Self.bluetoothStatus()
        case .camera: Self.cameraStatus()
        }
    }
⋯ __request asks for each permission in turn, then reads its status
    // Shows the camera prompt the first time; after that it returns the user's answer at once.
    private func requestCamera() async {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined else { return }
        _ = await AVCaptureDevice.requestAccess(for: .video)
    }
⋯ requestBluetooth and bluetoothStatus as in m15, then:
    private static func cameraStatus() -> PermissionStatus {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .notDetermined: .notRequested
        case .restricted: .restricted
        case .denied: .permanentlyDenied // as for Bluetooth: no second prompt
        case .authorized: .granted
        @unknown default: .restricted
        }
    }
```

1. **Checker iOS của m15 trả lời mọi quyền bằng trạng thái của Bluetooth**: khi đó chỉ có một. Giờ nó switch theo quyền, và SKIE biến enum Kotlin thành enum Swift, nên một trường hợp thứ ba sẽ là lỗi compile ở đây, không phải một câu trả lời sai.
2. **iOS hỏi một lần.** "Hệ thống nhớ câu trả lời của người dùng với mỗi alert truy cập, nên các lần dùng thiết bị thu tương ứng sau đó không làm alert hiện lại" (hướng dẫn cấp quyền của Apple). Nên `.denied` là `PermanentlyDenied`, và màn hình đưa ra Open Settings, như với Bluetooth. Android cho app xin lại sau lần từ chối đầu, như ở bài 12.
3. **Câu chữ của hộp thoại là bắt buộc.** iOS hiện `NSCameraUsageDescription` trong hộp thoại, và một app thiếu nó mà "xin quyền hoặc cố dùng một thiết bị thu" sẽ bị kết thúc. Cả hai track iOS thêm nó vào `project.yml`, và `xcodegen generate` ghi nó vào `Info.plist`.

## 3. Chỉ một màn hình mới mở được màn hình của hệ thống

Đây là vấn đề port phải giải. Service quyết định khi nào camera mở, và adapter làm việc mở, nhưng không cái nào là màn hình. Trên Android, chỉ một Activity hay một Fragment đăng ký nhận kết quả được, "và chỉ khi nó đang được tạo", như `MainActivity` của bài 12 nói. Trên iOS, chỉ một view (SwiftUI) hay một view controller (UIKit) present được một màn hình khác. Nên màn hình **cho adapter mượn** đường tới màn hình của hệ thống, và chuyển câu trả lời của hệ thống đi tiếp. Bài 12 đã làm đúng như vậy cho hộp thoại quyền; e2 làm thêm hai lần, cho camera và cho bộ chọn.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 360" role="img" aria-labelledby="le2-lend-title">
      <title id="le2-lend-title">Một chuyến đi, từng bước. Trước tiên, khi được tạo hay hiện ra, màn hình cho adapter mượn các launcher của nó trên Android hoặc chính nó làm presenter trên iOS. Rồi ViewModel gọi service, service gọi capturePhoto của adapter. Adapter mở hoặc present camera của hệ thống và chờ. Hệ thống trả lời màn hình: một callback của launcher hay một lời gọi delegate. Màn hình chuyển câu trả lời cho adapter, adapter chép ảnh vào cache của app, đọc thông tin media, và trả một PickedMedia cho service.</title>
      <defs><marker id="le2-lend-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="40" y="20" width="180" height="50" rx="6"></rect>
      <text class="title" x="52" y="42">màn hình</text>
      <text class="small muted" x="52" y="60">Activity · Fragment · View · VC</text>
      <g data-part="outbound">
        <rect class="box" x="290" y="20" width="180" height="50" rx="6"></rect>
        <text class="title" x="302" y="42">adapter MediaPicker</text>
        <text class="small" x="302" y="60">chờ câu trả lời</text>
      </g>
      <rect class="box" x="540" y="20" width="180" height="50" rx="6"></rect>
      <text class="title" x="552" y="42">hệ thống</text>
      <text class="small muted" x="552" y="60">camera · bộ chọn ảnh</text>
      <path class="edge dashed" d="M130,70 L130,340"></path>
      <path class="edge dashed" d="M380,70 L380,340"></path>
      <path class="edge dashed" d="M630,70 L630,340"></path>
      <path class="edge" d="M130,100 L378,100" marker-end="url(#le2-lend-arrow)"></path>
      <text class="small" x="140" y="94">1. cho mượn launcher / presenter</text>
      <text class="small" x="390" y="140">2. capturePhoto(), từ service</text>
      <path class="edge" d="M380,170 L628,170" marker-end="url(#le2-lend-arrow)"></path>
      <text class="small" x="390" y="164">3. mở / present</text>
      <path class="edge" d="M630,220 L132,220" marker-end="url(#le2-lend-arrow)"></path>
      <text class="small" x="300" y="214">4. trả lời: callback / delegate</text>
      <path class="edge" d="M130,260 L378,260" marker-end="url(#le2-lend-arrow)"></path>
      <text class="small" x="140" y="254">5. chuyển câu trả lời đi tiếp</text>
      <text class="small" x="390" y="300">6. chép ảnh, đọc thông tin,</text>
      <text class="small" x="390" y="318">trả về một PickedMedia</text>
    </svg>
    <figcaption>Màn hình không quyết định gì: nó không tự mở gì và không đọc gì từ câu trả lời. Nó chỉ mang câu trả lời từ hệ thống tới adapter.</figcaption>
  </figure>

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMediaPicker.kt" hl_lines="1 7 15 19"
    fun attach(camera: ActivityResultLauncher<Uri>, library: ActivityResultLauncher<PickVisualMediaRequest>) {
        this.camera = camera
        this.library = library
    }
⋯ detach(camera): only if it's still the attached one, as for permissions
    // The TakePicture launcher's callback: true if the camera app saved a photo into the file.
    fun onPhotoTaken(saved: Boolean) {
        photoTaken?.complete(saved)
        photoTaken = null
    }
⋯ onImageChosen(uri) the same way; hasCamera(): FEATURE_CAMERA_ANY
    override suspend fun capturePhoto(): PickedMedia {
        val launcher = camera ?: return PickedMedia.Failed("no screen has attached a camera launcher")
        val file = newFile("jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        val answer = CompletableDeferred<Boolean>()
        photoTaken = answer
⋯ launcher.launch(uri), or Failed("no camera app on this phone") on ActivityNotFoundException
        if (!answer.await()) {
            file.delete()
            return PickedMedia.Cancelled
        }
        return describe(file, MediaSource.Camera)
    }
```

1. **Cùng ba bước như `AndroidPermissionChecker`:** `attach` nhận các launcher, các callback hoàn tất một `CompletableDeferred`, và lời gọi đang treo tiếp tục. Coroutine của ViewModel chờ suốt thời gian app camera ở phía trước.
2. **Câu trả lời gần như không nói gì.** `TakePicture` "trả về true nếu ảnh đã được lưu vào Uri đã cho", và photo picker trả về một `Uri` hoặc `null`. Mọi thứ khác (file ở đâu, nó là gì) adapter đã biết sẵn hoặc đọc sau.
3. **Một lần huỷ camera thì xoá file của nó.** Adapter đặt tên file trước khi camera mở (mục 4), nên khi huỷ nó xoá file đó, phòng khi app camera đã ghi gì vào. (App camera của emulator không ghi gì cho tới khi bạn chấp nhận ảnh: sau một lần huỷ, `media/` chỉ chứa ảnh trước đó.)

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt" hl_lines="6 9 13"
    ⋯ the permission launcher as in m15, then:
        // The same for photos (Extension E2): the system camera app and the system photo picker.
        private val mediaPicker by lazy {
            (application as DeviceMonitorApplication).mediaPicker
        }
        private val cameraLauncher = registerForActivityResult(TakePicture()) { saved ->
            mediaPicker.onPhotoTaken(saved)
        }
        private val libraryLauncher = registerForActivityResult(PickVisualMedia()) { uri ->
            mediaPicker.onImageChosen(uri)
        }
    ⋯ in onCreate, after the permission checker's attach:
            mediaPicker.attach(cameraLauncher, libraryLauncher)
    ⋯ in onDestroy:
            mediaPicker.detach(cameraLauncher)
    ```

    Compose có một Activity, nên nó cho mượn các launcher cho cả app, như nó làm với launcher quyền. `DeviceMonitorApplication` (cùng một file trên cả hai track Android) dựng một `AndroidMediaPicker` cho process, giữ nó trong một property cạnh `permissionChecker`, và truyền nó vào `initKoin`.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/PhotoFragment.kt" hl_lines="5 8 14 15"
        private val app by lazy { requireActivity().application as DeviceMonitorApplication }
        private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
            app.permissionChecker.onResult(requireActivity())
        }
        private val cameraLauncher = registerForActivityResult(TakePicture()) { saved ->
            app.mediaPicker.onPhotoTaken(saved)
        }
        private val libraryLauncher = registerForActivityResult(PickVisualMedia()) { uri ->
            app.mediaPicker.onImageChosen(uri)
        }
    ⋯ binding, onCreateView, onViewCreated, then:
        override fun onStart() {
            super.onStart()
            app.permissionChecker.attach(requireActivity(), permissionLauncher)
            app.mediaPicker.attach(cameraLauncher, libraryLauncher)
        }
    ⋯ onResume refreshes the permission; onStop detaches both
    ```

    Trên track XML, mỗi Fragment đăng ký launcher riêng, như `DeviceListFragment` làm từ bài 12, nên màn hình ảnh cũng cho mượn một launcher quyền: khi nó ở trên màn hình, hộp thoại camera tới từ nó. `detach` bỏ qua một launcher không còn là cái đang gắn, nên thứ tự một Fragment dừng và Fragment tiếp theo bắt đầu không quan trọng.


## 4. Android: một file cho app camera, một bản sao từ bộ chọn

`TakePicture` không trao lại một bức ảnh: nó nhờ app camera của điện thoại (app nào trả lời `MediaStore.ACTION_IMAGE_CAPTURE`; trên emulator là app Camera có sẵn) ghi "ảnh kích thước đầy đủ" vào một URI mà app cung cấp. Một app khác không ghi thẳng được vào file riêng của chúng ta, nên app chia sẻ một thư mục qua một `FileProvider`, thứ biến một file thành một URI `content://`:

```xml title="androidApp/src/main/AndroidManifest.xml" hl_lines="2 3 7 8 13"
⋯ the Bluetooth and status permissions as in m15, then:
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
⋯ in <application>, after the activity:
        <provider
            android:name=".MediaFileProvider"
            android:authorities="${applicationId}.files"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/media_paths" />
        </provider>
```

```xml title="androidApp/src/main/res/xml/media_paths.xml · both Android tracks" hl_lines="2"
<paths>
    <cache-path name="media" path="media/" />
</paths>
```

1. **Chỉ `media/` trong cache được chia sẻ.** `cache-path` "đại diện cho các file trong thư mục con cache của vùng bộ nhớ trong của app", thư mục mà `getCacheDir()` trả về. Adapter không ghi ở đâu khác, và provider không tạo được URI cho gì khác.
2. **Authority** là ID của app cộng `.files`; adapter dựng cùng chuỗi đó từ `context.packageName`, thứ là application ID lúc chạy.
3. **`MediaFileProvider` là một subclass rỗng.** Reference FileProvider của AndroidX bảo hãy kế thừa `FileProvider`, và dùng nó trực tiếp "không đáng tin cậy" và crash trên một số thiết bị. Một dòng trong app của mỗi track Android.
4. **App camera chỉ được quyền ghi cho đúng URI này.** Chúng tôi không thêm cờ cấp quyền nào: nền tảng làm. Reference của `ACTION_IMAGE_CAPTURE` nói URI được chép vào `ClipData` của intent "hộ bạn khi gọi `Context.startActivity`", và log của emulator cho thấy intent đi ra với `flg=0x3` (cấp quyền đọc và ghi) và một `ClipData` chứa URI của chúng ta.
5. **Hai feature, cả hai `required="false"`.** Với Google Play, xin `CAMERA` ngầm định các feature `android.hardware.camera` và `android.hardware.camera.autofocus`, và Play ẩn app khỏi các thiết bị không có chúng. Cách sửa của hướng dẫn `<uses-feature>` là khai báo cả hai với `required="false"`, như chúng ta làm. (Bản thân Android không kiểm tra feature lúc cài; chúng "chỉ mang tính thông tin".) `hasCamera()` của adapter kiểm tra `FEATURE_CAMERA_ANY` lúc chạy thay vào, như bài 13 làm với Bluetooth LE.

!!! warning "Gotcha · quyền bạn không cần, cho tới khi bạn khai báo nó"
    Một app chỉ nhờ app camera chụp ảnh thì hoàn toàn không cần `CAMERA`: app camera giữ quyền đó. Appendix A.4 đòi app xin quyền camera, nên chúng ta khai báo nó, và điều đó đổi luật chơi. Reference của `ACTION_IMAGE_CAPTURE`: "nếu app nhắm M trở lên và khai báo dùng quyền `CAMERA` mà chưa được cấp, thì cố dùng action này sẽ gây ra một `SecurityException`." Chúng tôi đã thử: một bản build không có kiểm tra quyền của service, quyền bị thu hồi bằng `adb shell pm revoke`, Take photo, và app crash với `java.lang.SecurityException: Permission Denial: starting Intent { act=android.media.action.IMAGE_CAPTURE … } … with revoked permission android.permission.CAMERA`. Kiểm tra của service là thứ ngăn điều đó xảy ra. Nó còn quan trọng về sau: một app mọc thêm màn hình CameraX sẽ cần `CAMERA`, và từ lúc đó intent chụp cũ của nó cũng cần.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMediaPicker.kt" hl_lines="3 4 8 17"
    override suspend fun pickMedia(): PickedMedia {
⋯ the library launcher, or Failed; a CompletableDeferred<Uri?>
        launcher.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly))
        val uri = answer.await() ?: return PickedMedia.Cancelled
        val type = context.contentResolver.getType(uri)
        val file = newFile(MimeTypeMap.getSingleton().getExtensionFromMimeType(type) ?: "img")
        return try {
            withContext(Dispatchers.IO) {
                val input = context.contentResolver.openInputStream(uri) ?: throw IOException("the photo can't be opened")
                input.use { from -> file.outputStream().use { to -> from.copyTo(to) } }
            }
            describe(file, MediaSource.Library)
⋯ on an IOException: delete the file, Failed with its message
    // A fresh name for every photo, so a screen never shows an old picture under a new path.
    private fun newFile(extension: String): File {
        folder.mkdirs()
        return File(folder, "photo-${System.currentTimeMillis()}.$extension")
    }
```

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMediaPicker.kt" hl_lines="2 6 7 12"
    private suspend fun describe(file: File, source: MediaSource): PickedMedia = withContext(Dispatchers.IO) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
⋯ no size: delete the file, Failed("Android can't read this file as an image")
        // A camera often stores a portrait photo as landscape pixels plus an EXIF orientation tag.
        val turned = ExifInterface(file.path).rotationDegrees % 180 != 0
        folder.listFiles()?.filter { it != file }?.forEach { it.delete() }
        PickedMedia.Photo(
            MediaInfo(
                path = file.path,
                source = source,
                type = bounds.outMimeType ?: "image/*",
                width = if (turned) bounds.outHeight else bounds.outWidth,
                height = if (turned) bounds.outWidth else bounds.outHeight,
                sizeBytes = file.length(),
            ),
        )
    }
```

1. **Photo picker, chỉ ảnh.** `PickVisualMedia` hiện photo picker của hệ thống trên Android 11 trở lên (và trên điện thoại cũ hơn đã nhận nó qua Google Play); ở chỗ không có, "thư viện tự động gọi intent action `ACTION_OPEN_DOCUMENT` thay vào". Cách nào thì câu trả lời cũng là một URI app đọc được trong một thời gian, nên adapter chép byte, không đổi, vào file của riêng nó. Chép là việc file, nên nó chạy trên `Dispatchers.IO`.
2. **Thông tin media mà không giải mã ảnh.** `inJustDecodeBounds` làm `BitmapFactory` chỉ đọc phần header: kích thước và `outMimeType`, không có pixel nào trong bộ nhớ. Một file nó không đọc được thì không có kích thước, và thành `Failed`.
3. **Chỉ bản sao mới nhất được giữ.** Sau một chuyến đi thành công, adapter xoá mọi file khác trong `media/`. Một chuyến đi bị huỷ không xoá file nào khác, nên ảnh trên màn hình vẫn giữ file của nó.

## 5. iOS: adapter và presenter của nó

Adapter iOS là Swift, trong app iOS, như các adapter nền tảng khác. Nó làm cùng việc với cái Android: xin presenter một chuyến đi, ghi câu trả lời vào một file trong Caches, đọc thông tin media, chỉ giữ bản sao mới nhất.

```swift title="iosApp/iosApp/IosMediaPicker.swift · both iOS tracks" hl_lines="2 4 7 13 15 18"
@MainActor
protocol MediaPresenter: AnyObject {
    // Shows the camera. The photo, or nil if the user closed the camera.
    func takePhoto() async -> UIImage?
    // Shows the photo picker, images only. The chosen image's bytes, or nil if the user
    // closed the picker; throws if the image couldn't be loaded.
    func chooseImage() async throws -> Data?
}
⋯
@MainActor
final class IosMediaPicker: @preconcurrency MediaPicker {
    // One for the app: the app start hands it to Koin, and the photo screen lends it a presenter.
    static let shared = IosMediaPicker()

    weak var presenter: MediaPresenter?
⋯ the media/ folder in Caches
    // Whether UIKit can show a camera here. False when the camera is in use, too.
    func hasCamera() -> Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }
```

```swift title="iosApp/iosApp/IosMediaPicker.swift · both iOS tracks" hl_lines="1 3 5 13 21 23"
    func __capturePhoto() async throws -> PickedMedia {
        guard let presenter else { return PickedMediaFailed(reason: "no screen can show the camera") }
        guard let image = await presenter.takePhoto() else { return PickedMediaCancelled.shared }
        // The camera hands over pixels, not a file: JPEG is how the copy is stored.
        guard let data = image.jpegData(compressionQuality: 0.9) else {
            return PickedMediaFailed(reason: "the photo couldn't be turned into a JPEG")
        }
        return save(data, from: .camera)
    }
⋯ __pickMedia: chooseImage(), Cancelled on nil, Failed on a thrown error
    private func save(_ data: Data, from source: MediaSource) -> PickedMedia {
        guard let image = UIImage(data: data),
              let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
              let typeId = CGImageSourceGetType(imageSource) as String?,
              let type = UTType(typeId) else {
            return PickedMediaFailed(reason: "iOS can't read this file as an image")
        }
⋯ write the bytes to Caches/media/photo-<UUID>.<extension>, delete the others
        // UIImage's size already allows for the EXIF orientation: it's the photo the way up.
⋯ MediaInfo(path:source:type:width:height:sizeBytes:), with
            width: Int32(image.size.width * image.scale),
⋯ then:
        return PickedMediaPhoto(info: info)
    }
```

1. **`MediaPresenter` là bản iOS của các launcher được cho mượn.** Adapter giữ nó `weak`: màn hình tự sở hữu mình, và khi nó đi, adapter không còn presenter và báo `Failed` thay vì present từ một màn hình không còn ở đó.
2. **Một adapter, hai track, hai presenter.** Adapter không bao giờ chạm vào view: presenter của SwiftUI bật state mà các modifier của view đọc; presenter của UIKit chính là view controller (mục 7). Đó là cách "mỗi nền tảng một adapter" của A.4 chạy với hai bộ công cụ UI trên iOS.
3. **`shared`, vì màn hình phải tìm thấy nó.** Màn hình Android với tới adapter của nó qua `Application`. Trên iOS, cách tương đương đơn giản nhất chạy được trên cả hai track là một instance tĩnh: phần khởi động app truyền nó vào `initKoin`, và màn hình ảnh cho nó mượn chính mình.
4. **Swift trả về object Kotlin.** SKIE giữ tên Kotlin cho các hàm async mà Swift gọi, nên những cái Swift implement là `__capturePhoto` và `__pickMedia`, như `__request` ở bài 12. Một data class Kotlin là `PickedMediaPhoto(info:)` trong Swift, một `data object` là `PickedMediaCancelled.shared`, và `Int` cùng `Long` là `Int32` và `Int64`.
5. **Pixel từ camera thành JPEG; byte từ thư viện giữ nguyên.** Camera cho một `UIImage`, thứ phải được mã hoá mới thành file. Bộ chọn cho byte của chính file đó, có thể là HEIC, JPEG hay PNG; `CGImageSourceGetType` của ImageIO nói là cái nào, và `UTType` biến nó thành MIME type và đuôi file.

## 6. Koin và ViewModel

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="4 6 8"
⋯ in appModule, after the monitor:
    // Photos (Extension E2): the platform's MediaPicker, and the camera permission through the
    // same PermissionChecker as Bluetooth.
    single<MediaCapture> { MediaCaptureService(get(), get()) }
⋯ the three ViewModels, then:
    viewModelOf(::MediaViewModel)
⋯ platformModule and initKoin each gain a tenth parameter:
    mediaPicker: MediaPicker,
```

Mỗi nền tảng dựng adapter của mình và truyền vào, như chín cái trước: Android với `mediaPicker = mediaPicker` trong `DeviceMonitorApplication.onCreate`, iOS với `mediaPicker: IosMediaPicker.shared` trong phần khởi động app. Thay bộ chọn bằng một cái khác vẫn là một dòng.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MediaViewModel.kt" hl_lines="1 7 13 24"
    fun takePhoto() = fetch { media.capturePhoto() }

    fun choosePhoto() = fetch { media.pickMedia() }

    // One trip at a time: the system shows one camera or picker.
    private fun fetch(call: suspend () -> MediaInfo?) {
        if (mediaJob?.isActive == true) return
        _uiState.update { it.copy(busy = true, errorMessage = null) }
        mediaJob = viewModelScope.launch {
            try {
                val photo = call()
                // Null: the user closed the camera or the picker, and the last photo stays.
                if (photo != null) _uiState.update { it.copy(photo = photo, details = describe(photo)) }
            } catch (e: MediaException) {
                _uiState.update { it.copy(errorMessage = e.message) }
            } finally {
                _uiState.update { it.copy(busy = false) }
            }
        }
    }
⋯ refreshPermission, requestPermission, openSettings: as DeviceListViewModel's, for Permission.Camera
    private fun describe(photo: MediaInfo): String {
⋯ "From the camera" or "From the library", then:
        return "$source · ${photo.width} × ${photo.height} px · ${photo.type} · ${size(photo.sizeBytes)}"
    }
```

1. **ViewModel gọi hai inbound port**: `MediaCapture` cho ảnh và `PermissionAccess` cho quyền camera, như `DeviceListViewModel` gọi `DeviceScanning` và `PermissionAccess`. Các hàm quyền của nó là của màn hình danh sách, với `Permission.Camera`.
2. **Chuyến đi đầu tiên thắng.** Bấm lần hai khi camera hay bộ chọn đang mở không làm gì. (Màn hình API của E1 để request mới nhất thắng; ở đây một chuyến đi thứ hai thậm chí không bắt đầu được, vì hệ thống chỉ hiện một bộ chọn mỗi lúc.)
3. **Câu chữ là của ViewModel**, giống nhau trên mọi track: "From the camera · 1440 × 1920 px · image/jpeg · 62 KB". Kích thước dùng 1 KB = 1.024 byte và một chữ số thập phân cho megabyte, tính bằng số nguyên, vì `commonMain` không có `String.format`.
4. **`MediaUiState.canTakePhoto`** là `!busy && camera == Granted`, một property tính toán mà mọi màn hình dùng cho nút Take photo, để nút và quy tắc của service không thể nói khác nhau về quyền.

## 7. Màn hình

Mỗi track một màn hình, tất cả hiện cùng một `MediaUiState`: hàng quyền camera (một thông báo và tối đa một hành động cho mỗi trạng thái, câu chữ như hàng Bluetooth của bài 12), Take photo và Choose from library, "Waiting for the photo…" khi đang có một chuyến đi, lỗi màu đỏ, và bức ảnh kèm thông tin media của nó. Một nút "Photo" trên đầu màn hình chính mở nó.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/PhotoScreen.kt" hl_lines="4 8 12 18"
        val state by viewModel.uiState.collectAsStateWithLifecycle()

        // Back from Settings (or anywhere else): the camera permission may have changed.
        LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
            viewModel.refreshPermission()
        }
    ⋯ PhotoContent(state, …): in a scrolling Column, the title, CameraPermissionRow, then:
                Button(onClick = onTakePhoto, enabled = state.canTakePhoto) { Text("Take photo") }
                OutlinedButton(onClick = onChoosePhoto, enabled = !state.busy) { Text("Choose from library") }
    ⋯ the busy row, the error, then:
            state.photo?.let { photo ->
                PhotoImage(path = photo.path)
                Text(state.details.orEmpty(), style = MaterialTheme.typography.bodySmall)
            }
    ⋯ Back; then:
    @Composable
    private fun PhotoImage(path: String) {
        val bitmap by produceState<Bitmap?>(initialValue = null, path) {
            value = withContext(Dispatchers.IO) { loadPhoto(path) }
        }
    ⋯ Image(bitmap.asImageBitmap(), contentScale = ContentScale.Fit, at most 360 dp high)
    ```

    Màn hình không tự mở gì: các launcher của Activity làm, qua adapter. `produceState` giải mã file ngoài main thread, một lần mỗi đường dẫn, và mỗi bức ảnh có một đường dẫn mới. Route là một `data object Photo` trong `DeviceMonitorApp.kt`, và `DeviceListScreen` cùng `DeviceListContent` không state của nó mỗi cái có thêm tham số `onPhoto`: tiêu đề thành một `Row` có một `TextButton("Photo")`, bọc trong `dropUnlessResumed` để bấm đúp chỉ điều hướng một lần.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/PhotoFragment.kt" hl_lines="4 6 12 16"
        private fun render(state: MediaUiState) {
            val b = binding ?: return
            renderPermission(b, state.camera)
            b.takePhotoButton.isEnabled = state.canTakePhoto
            b.choosePhotoButton.isEnabled = !state.busy
            b.busyRow.visibility = if (state.busy) View.VISIBLE else View.GONE
    ⋯ the error and the details, then:
            showPhoto(b, state.photo?.path)
        }
    ⋯
        private fun showPhoto(b: FragmentPhotoBinding, path: String?) {
            if (path == shownPath) return
            shownPath = path
    ⋯ no photo: hide the ImageView; otherwise:
            viewLifecycleOwner.lifecycleScope.launch {
                val bitmap = withContext(Dispatchers.IO) { loadPhoto(path) }
                if (shownPath != path) return@launch // a newer photo arrived meanwhile
                b.photoView.setImageBitmap(bitmap)
    ⋯ and show it
    ```

    `render` chạy với mỗi state mới, nên `showPhoto` chỉ giải mã khi đường dẫn đổi. Layout, `fragment_photo.xml`, là một `ScrollView` bọc một `LinearLayout` dọc: tiêu đề, chữ và nút quyền, hai nút, hàng đang bận (ẩn tới khi cần), lỗi, một `ImageView` cao 360 dp với `fitCenter`, và phần chi tiết. `nav_graph.xml` có thêm destination `photo` và một action `toPhoto` từ danh sách; `fragment_device_list.xml` có thêm một `photoButton` ở cuối tiêu đề, và `DeviceListFragment` chỉ điều hướng khi danh sách đang là destination hiện tại.


=== "SwiftUI"

    ```swift title="iosApp/iosApp/PhotoView.swift" hl_lines="2 5 9 14 18"
    ⋯ in PhotoView's body, after PhotoContent(…) and its title:
            .photosPicker(isPresented: $presenter.showingLibrary, selection: $presenter.chosen, matching: .images)
            .onChange(of: presenter.chosen) { presenter.libraryChanged() }
            .onChange(of: presenter.showingLibrary) { presenter.libraryChanged() }
            .fullScreenCover(isPresented: $presenter.showingCamera) {
                CameraPicker { image in presenter.cameraClosed(image) }
                    .ignoresSafeArea()
            }
            .onAppear { IosMediaPicker.shared.presenter = presenter }
    ⋯ then SwiftUIMediaPresenter, an @Observable class:
        func takePhoto() async -> UIImage? {
            await withCheckedContinuation { continuation in
                photoTaken = continuation
                showingCamera = true
            }
        }
    ⋯ cameraClosed(image) sets it back to false and resumes; chooseImage the same way, then:
            return try await item?.loadTransferable(type: Data.self)
    ```

    ```swift title="iosApp/iosApp/PhotoView.swift" hl_lines="1 6 13"
    struct CameraPicker: UIViewControllerRepresentable {
        let onFinish: (UIImage?) -> Void

        func makeUIViewController(context: Context) -> UIImagePickerController {
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.delegate = context.coordinator
            return picker
        }
    ⋯ updateUIViewController does nothing; makeCoordinator builds the delegate:
            func imagePickerController(_ picker: UIImagePickerController,
                                       didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
                onFinish(info[.originalImage] as? UIImage)
            }
    ⋯ imagePickerControllerDidCancel: onFinish(nil)
    ```

    1. **SwiftUI present qua state.** Không có lời gọi "present ngay": `.photosPicker(isPresented:selection:)` và `.fullScreenCover(isPresented:)` hiện màn hình của chúng khi một `Bool` là true. Nên `takePhoto()` của presenter lưu một continuation và đặt `showingCamera`; callback của cover đặt nó lại và resume continuation bằng ảnh hoặc `nil`.
    2. **Chuyến đi tới thư viện kết thúc theo một trong hai cách.** Một lựa chọn đặt `chosen`; đóng bộ chọn đặt `showingLibrary` thành false. `libraryChanged()` chạy ở cả hai thay đổi và resume một lần: bằng item nếu có, bằng `nil` nếu bộ chọn đóng mà trống. Các lần chạy của chúng tôi trên Simulator chọn một ảnh, rồi đóng bộ chọn bằng Cancel, và mỗi lần kết thúc đúng như nó nên.
    3. **Bộ chọn trao một chỗ giữ chỗ.** Một `PhotosPickerItem` không phải là ảnh; `loadTransferable(type: Data.self)` tải byte của nó, và có thể thất bại ("ví dụ, nếu bộ chọn cố tải dữ liệu từ iCloud Photos khi không có mạng", trang PhotosPicker của Apple). Chúng tôi tải `Data`, không tải `Image` của SwiftUI, vì `Transferable` của `Image` "chỉ hỗ trợ PNG và JPEG".
    4. **SwiftUI không có view camera**, nên `CameraPicker` bọc `UIImagePickerController` của UIKit trong một `UIViewControllerRepresentable`, với một coordinator làm delegate. Đó là cách chung của SwiftUI để chứa một view controller UIKit: `makeUIViewController` dựng nó một lần, và coordinator nhận các lời gọi delegate của nó.

    `ContentView` thêm `NavigationLink("Photo") { PhotoView() }` vào toolbar của màn hình chính. Ảnh là `UIImage(contentsOfFile:)` trong một view nhỏ `PhotoImage`, tải trong `.task(id: path)`; nó hiện một `ProgressView` cho tới lúc đó, thứ cũng cho `.task` một view để chạy trên, điều mà một `Group` rỗng không làm được (bản build đầu của chúng tôi hoàn toàn không hiện ảnh vì lý do đó).

=== "UIKit"

    ```swift title="iosApp/iosApp/PhotoViewController.swift" hl_lines="1 4 10 14 21"
    final class PhotoViewController: UIViewController, MediaPresenter,
        UIImagePickerControllerDelegate, UINavigationControllerDelegate, PHPickerViewControllerDelegate {
    ⋯ the owner, the ViewModel, the views; in viewWillAppear:
            IosMediaPicker.shared.presenter = self
    ⋯ takePhoto presents a UIImagePickerController with sourceType .camera; then:
        func chooseImage() async throws -> Data? {
            try await withCheckedThrowingContinuation { continuation in
                imageChosen = continuation
                var configuration = PHPickerConfiguration()
                configuration.filter = .images
                configuration.selectionLimit = 1
                let picker = PHPickerViewController(configuration: configuration)
                picker.delegate = self
                present(picker, animated: true)
            }
        }
    ⋯
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
    ⋯ take the waiting continuation; no result (Cancel): resume with nil; otherwise:
            provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, error in
    ⋯ resume with the data, or throw the error
    ```

    1. **View controller là presenter.** UIKit present bằng một lời gọi, `present(_:animated:)`, và trả lời qua delegate; mỗi method delegate dismiss bộ chọn và resume continuation đang chờ.
    2. **Cancel là một kết quả rỗng.** `PHPickerViewController` gọi cùng `didFinishPicking` cho một lần chọn và cho Cancel; Cancel không cho kết quả nào.
    3. **Byte được tải trong delegate.** `PHPickerResult` không phải `Sendable`, và bản đầu của chúng tôi, bản trao các kết quả qua một continuation, không compile được ở chế độ Swift 6 ("sending 'results' risks causing data races"). Lỗi đó có xuất hiện hay không phụ thuộc vào cách các kết quả được dùng quanh lời gọi, nên delegate tránh hẳn việc trao chúng đi: nó tự bắt đầu `loadDataRepresentation` và resume bằng `Data`, thứ là `Sendable`.

    `DeviceListViewController.viewDidLoad` có thêm một `rightBarButtonItem` tên "Photo" push một `PhotoViewController`. Pop nó thì giải phóng controller và owner của nó, việc đó clear ViewModel, và presenter `weak` của adapter thành `nil`.


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Cùng ViewModel, cùng adapter và cùng `loadPhoto`. Compose cho mượn các launcher từ một Activity của nó cho cả app; màn hình ảnh XML đăng ký launcher riêng (quyền, camera, bộ chọn) và cho mượn chúng khi nó đã start. Compose giải mã trong `produceState` có khoá là đường dẫn; Fragment nhớ đường dẫn nó hiện lần trước. Compose có một route trong `NavHost`; XML có một destination và một action trong graph.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Cùng ViewModel và cùng adapter. Presenter của SwiftUI là một object `@Observable` mà các cờ của nó điều khiển `.photosPicker` và `.fullScreenCover`, với item của `PhotosPicker` được tải dưới dạng `Data` và camera được bọc trong một `UIViewControllerRepresentable`; presenter của UIKit là view controller, thứ tự present `PHPickerViewController` và `UIImagePickerController` và nhận câu trả lời của chúng qua delegate.

## 8. Hiện ảnh, đúng chiều

Một JPEG có thể lưu pixel theo một chiều và nói, trong một tag EXIF orientation, phải xoay chúng ra sao khi hiển thị; nhiều camera lưu một ảnh dọc thành pixel ngang cộng tag đó. Trình xem đọc tag thì hiện ảnh đứng thẳng; code bỏ qua nó thì hiện ảnh nằm nghiêng, và báo chiều rộng và chiều cao bị đảo.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 260" role="img" aria-labelledby="le2-exif-title">
      <title id="le2-exif-title">Một JPEG, đọc theo ba cách. File lưu 800 x 600 pixel ngang và EXIF orientation 6, nghĩa là xoay 90 độ theo chiều kim đồng hồ để hiện. BitmapFactory.decodeFile bỏ qua tag và hiện nó nằm nghiêng, 800 x 600. Với rotationDegrees 90 của ExifInterface, app Android xoay bitmap và báo 600 x 800, đứng thẳng. Trên iOS, UIImage tự đọc tag: size của nó đã là 600 x 800.</title>
      <defs><marker id="le2-exif-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <rect class="box" x="20" y="60" width="160" height="120" rx="4"></rect>
      <text class="title" x="64" y="126" transform="rotate(-90 100 120)">UP</text>
      <text class="small" x="20" y="200">file: 800 × 600 pixel</text>
      <text class="small" x="20" y="216">+ EXIF orientation 6</text>
      <g data-part="android">
        <rect class="box" x="260" y="20" width="120" height="90" rx="4"></rect>
        <text class="title" x="294" y="72" transform="rotate(-90 320 65)">UP</text>
        <text class="small" x="400" y="52">Chỉ BitmapFactory:</text>
        <text class="small" x="400" y="70">800 × 600, nằm nghiêng</text>
        <rect class="box" x="290" y="130" width="70" height="94" rx="4"></rect>
        <text class="title" x="305" y="160">UP</text>
        <text class="small" x="400" y="162">+ rotationDegrees (90):</text>
        <text class="small" x="400" y="180">600 × 800, đứng thẳng</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="600" y="130" width="70" height="94" rx="4"></rect>
        <text class="title" x="615" y="160">UP</text>
        <text class="small" x="590" y="246">UIImage: 600 × 800</text>
      </g>
      <path class="edge" d="M182,100 L256,66" marker-end="url(#le2-exif-arrow)"></path>
      <path class="edge" d="M182,140 L286,176" marker-end="url(#le2-exif-arrow)"></path>
      <path class="edge dashed" d="M182,170 L596,200" marker-end="url(#le2-exif-arrow)"></path>
    </svg>
    <figcaption>Ảnh test từ các lần chạy của chúng tôi: lưu nằm nghiêng với orientation 6. Bộ giải mã của Android cần được bảo; <code>UIImage</code> của iOS tự đọc tag.
<ul class="legend">
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/PhotoBitmap.kt · both Android tracks" hl_lines="1 5 6 8 11"
fun loadPhoto(path: String, maxSide: Int = 1024): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    val bitmap = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: return null
    val degrees = ExifInterface(path).rotationDegrees
    if (degrees == 0) return bitmap
    val turn = Matrix().apply { postRotate(degrees.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, turn, true)
}
```

1. **Kích thước trước.** Một bitmap đã giải mã tốn 4 byte mỗi pixel (`ARGB_8888`), nên một ảnh 12 megapixel là 48 MB trong bộ nhớ, cho một view rộng vài trăm pixel. `inSampleSize` giải mã cứ mỗi 2, 4, … pixel một; vòng lặp chọn luỹ thừa của hai lớn nhất mà vẫn giữ cạnh dài ít nhất `maxSide`. Đó là vòng lặp chia đôi trong "Loading large bitmaps efficiently" của Android, áp lên cạnh dài; bản của hướng dẫn kiểm tra cả hai cạnh với một chiều rộng và chiều cao mục tiêu.
2. **Rồi tới chiều.** `ExifInterface.rotationDegrees` của AndroidX đọc tag thành 0, 90, 180 hoặc 270; một `Matrix` xoay bitmap. Adapter đọc cùng tag đó để báo chiều rộng và chiều cao như khi hiện (mục 4).
3. **Nó là code màn hình, nên nó nằm trong app, không trong module dùng chung.** `PhotoBitmap.kt` là cùng một file trên cả hai track Android, và `androidApp/build.gradle.kts` thêm `androidx.exifinterface:exifinterface:1.4.2` cạnh cái của module dùng chung.

!!! warning "Gotcha · ảnh nằm nghiêng"
    App camera của emulator ghi pixel đứng thẳng không có tag orientation (1440 × 1920), nên chỉ ảnh camera thì không bao giờ lộ ra bug. Chúng tôi làm một ảnh test có lộ: pixel ngang và orientation 6 (brief cho agent có công thức). Với một bản build bỏ qua việc xoay, Android hiện nó nằm nghiêng; với `loadPhoto` như trên, đứng thẳng và "600 × 800 px". Trên iOS, không phải làm gì: `size` của `UIImage` "tính tới orientation hiện tại của ảnh", và cả hai track iOS hiện nó đứng thẳng. App camera của các điện thoại khác nhau ở cách chúng lưu ảnh, nên kiểm tra trên thiết bị chụp một ảnh dọc trên điện thoại thật.

## 9. Test

117 test mỗi nền tảng, tăng từ 105. Test của service dùng `FakeMediaPicker` và `FakePermissionChecker` của bài 12; test của ViewModel dùng `TestMediaCapture` và `TestPermissionAccess`. Không cái nào cần camera.

| Class | Test | Nó cho thấy gì |
|---|---|---|
| `MediaCaptureServiceTest` | 6 (mới) | một bức ảnh khi có camera và có quyền; không bao giờ mở camera khi không có quyền (mọi trạng thái khác), và service không hiện hộp thoại; không có camera; một camera hay bộ chọn bị đóng là `null`, không phải lỗi; thư viện không cần quyền và không cần camera; một lỗi giữa đường là một `MediaException` kèm lý do của nền tảng |
| `MediaViewModelTest` | 6 (mới) | bận khi camera đang mở, rồi bức ảnh và câu chữ của nó; một bộ chọn bị đóng giữ ảnh cuối; một lỗi được hiện và chuyến đi sau xoá nó; mỗi lần một chuyến đi; Take photo chờ quyền; kích thước dưới 1 MB tính bằng KB |
| `AppModuleTest` | 3 | `buildsEveryViewModel` cũng dựng `MediaViewModel`, với một `FakeMediaPicker` làm adapter nền tảng thứ mười |

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/MediaCaptureServiceTest.kt" hl_lines="3 10"
    @Test
    fun neverOpensTheCameraWithoutThePermission() = runTest {
        for (status in PermissionStatus.entries - PermissionStatus.Granted) {
            os.statuses[Permission.Camera] = status

            val error = assertFailsWith<MediaException> { media.capturePhoto() }

            assertEquals("Taking a photo needs the camera permission.", error.message)
        }
        assertEquals(0, picker.cameraOpened)
        assertEquals(emptyList(), os.prompts) // the service checks; asking is the screen's choice
    }
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestMediaCapture.kt" hl_lines="3 9"
    private suspend fun open(): MediaInfo? {
        trips++
        val waiting = CompletableDeferred<MediaInfo?>()
        trip = waiting
        return waiting.await()
    }

    fun give(photo: MediaInfo) {
        trip?.complete(photo)
    }
⋯ close(): complete(null); fail(message): completeExceptionally(MediaException(message))
```

1. **Test adapter Android không có ở đây.** `AndroidMediaPicker` cần launcher, một app camera và một content resolver: các màn hình của chính Android. Như các adapter BLE, nó được kiểm tra bằng cách chạy, trên emulator, trong brief cho agent.
2. **Một chuyến đi biết chờ.** `TestMediaCapture` không trả lời cho tới khi test bảo, như một camera thật vẫn mở cho tới khi người dùng hành động. Đó là thứ cho phép một test nhìn state của màn hình *trong lúc* một chuyến đi (`busy`, Take photo bị tắt) rồi kết thúc nó bằng một bức ảnh, một lần đóng hay một lỗi.

## 10. Thực tế xảy ra gì: các lần chạy đứng sau trang này

Chúng tôi build e2 trên cả bốn track (Kotlin 2.4.20, Koin 4.2.2, AndroidX ExifInterface 1.4.2, Xcode 26.2). `allTests` pass 117 trên 117 trên JVM và 117 trên 117 trên iOS simulator, và không bản build nào in cảnh báo compiler từ code của chúng ta. Compose và XML chạy trên emulator API 36, SwiftUI và UIKit trên Simulator iOS 26.2 (điều khiển bằng một XCUITest tạm). Thư viện chứa hai ảnh test: một PNG 640 × 480, và một JPEG lưu thành 800 × 600 pixel với EXIF orientation 6 (đứng thẳng thì là 600 × 800). Mỗi track cho cùng các dòng:

| Bước | Emulator Android (Compose, XML) | Simulator iOS (SwiftUI, UIKit) |
|---|---|---|
| Mở Photo, cài mới | "Device Monitor needs the camera permission to take photos.", Allow camera; Take photo bị tắt |
| Allow camera, rồi từ chối | "Allow Device Monitor to take pictures and record video?" (While using the app, Only this time, Don't allow); Don't allow: "Camera permission was denied. Taking photos needs it." và Ask again | "“Device Monitor” would like to access the Camera." kèm câu giải thích của chúng ta (Don't Allow, Allow); Don't Allow: "Camera permission is off. You can turn it on in Settings." và Open Settings |
| Đã cho phép | Ask again, While using the app: "Camera permission: allowed" | sau `xcrun simctl privacy booted grant camera …`: "Camera permission: allowed" |
| Take photo | app Camera của emulator, quay cảnh ảo của nó; chụp, rồi ✓: bức ảnh, và "From the camera · 1440 × 1920 px · image/jpeg · 62 KB" | một màn hình camera mở ra (cả trên Simulator iOS 18.5), nhưng nút chụp không cho ảnh nào; ✕ (Dismiss): quay lại, không gì đổi |
| Choose from library, ảnh JPEG | đứng thẳng, và "From the library · 600 × 800 px · image/jpeg · 18 KB"; bản sao trong cache là file gốc, giống từng byte (18.722 byte) |
| Choose from library, ảnh PNG | "From the library · 640 × 480 px · image/png · 20 KB"; bản sao của JPEG đã biến khỏi `media/` |
| Mở bộ chọn hoặc camera, đóng nó | ảnh cuối vẫn còn, không có lỗi |
| Xoay điện thoại trên màn hình ảnh | bức ảnh và dòng của nó vẫn còn (XML; ViewModel sống qua Activity mới) | — |

Photo picker của Android mở kèm ghi chú riêng ở trên cùng: "Device Monitor will only have access to the photos you select". Không nền tảng nào xin quyền thư viện, và không app nào khai báo nó.

!!! warning "Gotcha · Android dừng app khi camera ở phía trước"
    Khi app camera ở phía trước, app của chúng ta ở nền, và Android có thể kết thúc process của nó để giải phóng bộ nhớ. Chúng tôi ép điều đó bằng `adb shell am kill com.example.devicemonitor` khi camera đang mở, rồi chụp ảnh. Android khởi động một process mới và đưa màn hình ảnh trở lại, nhưng không hiện ảnh nào: `CompletableDeferred` của chuyến đi và coroutine của ViewModel đã chết cùng process cũ, nên process mới không có gì đang chờ câu trả lời. App camera vẫn đã ghi file của nó vào `media/`, nơi nó ở lại cho tới khi ảnh tiếp theo thay nó. Một app production sẽ lưu đường dẫn của file đang chờ (ví dụ trong một `SavedStateHandle`) và nhặt nó lại sau khi khởi động lại; phần mở rộng này bỏ qua điều đó.

Các hàng này giờ nằm trong `docs/checklists.md`: bốn hàng camera (xin quyền, chụp, chọn, đóng mà không có ảnh) thay cho "chỉ phần mở rộng E2". **Bản thân camera là một kiểm tra trên thiết bị.** App camera của emulator quay một cảnh ảo và màn hình camera của Simulator không chụp được ảnh, nên một camera thật, và cách một app camera thật lưu ảnh dọc, chỉ thấy được trên điện thoại. Chúng tôi chờ cùng các dòng đó ở đó: code không đổi, chỉ có bức ảnh đổi. Các kiểm tra trên thiết bị nằm trong brief cho agent.

**e2 là một điểm dừng tự nhiên** khi test pass trên cả hai nền tảng, các lệnh grep về chỗ đặt code tìm thấy đúng những gì brief nói, và các hàng camera của `docs/checklists.md` khớp với những gì bạn thấy trên các track của mình. Hãy commit nó, và gắn tag.

!!! question "Hỏi agent của bạn"
    Hỏi agent app sẽ đổi ra sao nếu một tính năng cần màn hình camera riêng, có xem trước trực tiếp và một nút chụp (CameraX trên Android, AVFoundation trên iOS), thay vì camera của hệ thống: port nào giữ nguyên, adapter nào đổi, màn hình có còn cho mượn gì không, và gotcha về quyền `CAMERA` ở mục 4 khi đó nghĩa là gì. Đối chiếu câu trả lời với mục 1 tới 4.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Vì sao màn hình ảnh cho <code>AndroidMediaPicker</code> mượn launcher (hoặc cho <code>IosMediaPicker</code> một presenter), thay vì adapter tự mở camera?</p>
<div class="opts">
<button class="opt">adapter nằm trong module dùng chung, thứ không gọi được API Android hay iOS</button>
<button class="opt" data-correct>chỉ một Activity hay Fragment đăng ký nhận kết quả được, và chỉ một view hay view controller present được; adapter không phải màn hình, nên một màn hình cho nó mượn đường vào và mang câu trả lời về</button>
<button class="opt">ViewModel phải quyết định khi nào camera mở, nên nó giữ các launcher</button>
</div>
<p class="feedback"></p>
<p class="why">Adapter trong <code>androidMain</code> dùng API Android thoải mái; thứ nó thiếu là một màn hình. Checker quyền của bài 12 mượn launcher theo cùng cách.</p>
</div>

<div class="quiz">
<p class="q">Người dùng mở camera rồi đóng mà không chụp. Mỗi tầng báo gì?</p>
<div class="opts">
<button class="opt">adapter ném lỗi, service bọc nó trong một <code>MediaException</code>, và màn hình hiện "No photo"</button>
<button class="opt" data-correct>adapter trả <code>Cancelled</code>, service trả <code>null</code>, và ViewModel giữ ảnh cuối, không có lỗi</button>
<button class="opt">adapter trả một <code>MediaInfo</code> rỗng, thứ màn hình ẩn đi</button>
</div>
<p class="feedback"></p>
<p class="why">Đóng camera là một kết cục bình thường, không phải lỗi, nên nó là một giá trị trên cả hai port. Chỉ <code>Failed</code> mới thành <code>MediaException</code>.</p>
</div>

<div class="quiz">
<p class="q">App Android khai báo <code>CAMERA</code>, người dùng đã thu hồi nó, và code vẫn mở <code>TakePicture</code>. Chuyện gì xảy ra?</p>
<div class="opts">
<button class="opt">app camera mở ra: nó giữ quyền camera, không phải app của chúng ta</button>
<button class="opt">Android hiện hộp thoại quyền trước</button>
<button class="opt" data-correct>một <code>SecurityException</code>: một app khai báo <code>CAMERA</code> mà chưa được cấp thì không dùng được <code>ACTION_IMAGE_CAPTURE</code></button>
</div>
<p class="feedback"></p>
<p class="why">Câu trả lời đầu chỉ đúng với một app không khai báo <code>CAMERA</code>. Một khi đã khai báo, kiểm tra quyền của service là thứ đứng giữa nút bấm và lần crash.</p>
</div>

<div class="quiz">
<p class="q">Chọn ảnh từ thư viện cần quyền nào?</p>
<div class="opts">
<button class="opt" data-correct>không quyền nào, trên cả hai nền tảng: bộ chọn của hệ thống chạy ngoài app, và app chỉ nhận ảnh người dùng chọn</button>
<button class="opt"><code>READ_MEDIA_IMAGES</code> trên Android và <code>NSPhotoLibraryUsageDescription</code> trên iOS</button>
<button class="opt">quyền camera, thứ bao cả thư viện</button>
</div>
<p class="feedback"></p>
<p class="why">Apple: bộ chọn "riêng tư mặc định"; bộ chọn của Android cấp "quyền truy cập chỉ những ảnh và video đã chọn". Một app tự đọc cả thư viện là trường hợp khác.</p>
</div>

<div class="quiz">
<p class="q">Một JPEG lưu 800 × 600 pixel với EXIF orientation 6. <code>BitmapFactory.decodeFile</code> và <code>UIImage</code> của iOS cho bạn gì?</p>
<div class="opts">
<button class="opt">cả hai 600 × 800, đứng thẳng: mọi bộ giải mã đều áp tag</button>
<button class="opt" data-correct><code>BitmapFactory</code>: 800 × 600, nằm nghiêng, cho tới khi app xoay nó theo <code>rotationDegrees</code>; <code>UIImage</code>: kích thước đã là 600 × 800</button>
<button class="opt">cả hai 800 × 600 nằm nghiêng: tag chỉ dành cho app ảnh</button>
</div>
<p class="feedback"></p>
<p class="why">Đó là lý do adapter Android đảo chiều rộng và chiều cao khi tag nói 90 hay 270, và các màn hình Android xoay bitmap, trong khi code iOS chỉ đọc <code>size</code>.</p>
</div>

<div class="quiz">
<p class="q">Vì sao cả hai adapter chép ảnh vào cache của app thay vì trao cho core URI hay item của bộ chọn?</p>
<div class="opts">
<button class="opt">core không lưu được chuỗi dài hơn một URI</button>
<button class="opt" data-correct>thứ bộ chọn trao không phải của app để giữ (một content URI đọc được trong một thời gian, hoặc byte trong bộ nhớ); một file app sở hữu cho core một đường dẫn trơn, và loại, kích thước, kích thước pixel đo một lần</button>
<button class="opt">hệ thống xoá ảnh gốc sau khi chọn</button>
</div>
<p class="feedback"></p>
<p class="why"><code>MediaInfo</code> chỉ giữ từ ngữ của app: một đường dẫn và các con số trơn. Một <code>Uri</code> hay một <code>PhotosPickerItem</code> sẽ đưa một nền tảng vào app core.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Trên iPhone, người dùng bấm Don't Allow trên hộp thoại camera. Vì sao màn hình đưa ra Open Settings mà không phải Ask again? (Bài 12)</p>
<div class="opts">
<button class="opt">app chọn không làm phiền người dùng</button>
<button class="opt" data-correct>iOS nhớ câu trả lời và không bao giờ hiện lại hộp thoại đó, nên adapter ánh xạ <code>.denied</code> sang <code>PermanentlyDenied</code>, và <code>PermissionService</code> không bao giờ hiện hộp thoại cho nó</button>
<button class="opt">Ask again sẽ crash nếu thiếu <code>NSCameraUsageDescription</code></button>
</div>
<p class="feedback"></p>
<p class="why">Cùng cách ánh xạ như của Bluetooth ở bài 12. Trên Android lần từ chối đầu là <code>Denied</code>, và app được xin thêm một lần.</p>
</div>

<div class="quiz">
<p class="q">Bạn thêm <code>MediaViewModel</code> nhưng quên <code>viewModelOf(::MediaViewModel)</code>. Test nào fail? (Bài 11)</p>
<div class="opts">
<button class="opt"><code>MediaViewModelTest</code>, thứ dựng ViewModel qua Koin</button>
<button class="opt" data-correct><code>AppModuleTest.buildsEveryViewModel</code>, thứ xin Koin mọi ViewModel</button>
<button class="opt">không cái nào cho tới khi app mở màn hình ảnh</button>
</div>
<p class="feedback"></p>
<p class="why"><code>MediaViewModelTest</code> dựng nó bằng tay trên <code>TestMediaCapture</code>; chỉ test graph đi qua Koin.</p>
</div>

<div class="quiz">
<p class="q">Quy tắc "chỉ mở camera khi có quyền camera" nằm ở đâu, và một quy tắc "từ chối ảnh trên 10 MB" sẽ nằm ở đâu? (Bài 10)</p>
<div class="opts">
<button class="opt">cả hai trong adapter, thứ biết camera và file của nền tảng</button>
<button class="opt">cái đầu trong màn hình, thứ tắt nút; cái thứ hai trong ViewModel</button>
<button class="opt" data-correct>cả hai trong <code>MediaCaptureService</code>: chúng là quy tắc của app; <code>canTakePhoto</code> của nút chỉ phản chiếu cái đầu cho người dùng</button>
</div>
<p class="feedback"></p>
<p class="why">Mục "mọi quy tắc của app nằm trong một service" của checklist refactor. Adapter đo kích thước; quyết định thế nào là quá lớn là việc của app.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên project e2 của bạn)"
    1. **Một quy tắc của riêng bạn.** Cho service từ chối ảnh trên 10 MB với "That photo is too large: N MB (at most 10 MB)". Quyết định giới hạn nằm ở đâu, kiểm tra đặt ở đâu, và chuyện gì xảy ra với bản sao adapter đã tạo. Ghim nó bằng một test service dùng `FakeMediaPicker`, không cần file 10 MB thật.
    2. **Đoán, rồi chạy.** Khi màn hình ảnh đang mở và camera đã được phép, lấy quyền đi: trên Android, Settings → Apps → Device Monitor → Permissions; trên Simulator, `xcrun simctl privacy booted revoke camera com.example.devicemonitor`. Ghi ra màn hình sẽ hiện gì khi bạn quay lại, và hàm nào đọc nó; rồi kiểm tra. Ảnh trên màn hình có còn không?
    3. **Thêm một dòng thông tin media.** Thêm số megapixel của ảnh vào phần chi tiết ("· 2.8 MP", một chữ số thập phân), chỉ trong ViewModel, kèm một test. Vì sao các adapter, hay `MediaInfo`, không cần đổi?

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, đi qua các hàng camera của `docs/checklists.md`, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/e2-camera-and-media.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/e2-camera-and-media.html" -o .course/lesson-e2.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 12 and 20, which this extension builds on; skipped if they're already there:
  [ -f .course/lesson-12.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html" -o .course/lesson-12.html
  [ -f .course/lesson-20.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/20-integration-and-end-to-end-check.html" -o .course/lesson-20.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Extension E2 (camera and media): build milestone e2 on top of m15: a photo screen (the camera
permission row, Take photo, Choose from library, "Waiting for the photo…", the error, and the
newest photo with its media info) opened from a "Photo" button on the main screen;
MediaViewModel over a new inbound port, MediaCapture, implemented by MediaCaptureService (the
camera opens only on a device with a camera and with Permission.Camera granted, checked through
PermissionChecker; the library needs no permission; a closed camera or picker is null; a
failure is a MediaException); a new outbound port, MediaPicker (hasCamera, capturePhoto,
pickMedia, each trip a PickedMedia: Photo, Cancelled or Failed), implemented by
AndroidMediaPicker in androidMain (TakePicture into a FileProvider URI, PickVisualMedia copied
into the cache, EXIF-aware media info) and IosMediaPicker in the iOS app (a MediaPresenter the
screen lends: PhotosPicker and a UIViewControllerRepresentable camera on SwiftUI,
PHPickerViewController and UIImagePickerController on UIKit); Permission.Camera in both
PermissionChecker adapters; service tests over FakeMediaPicker, ViewModel tests over
TestMediaCapture; and four camera rows in docs/checklists.md.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m15 project in demo/ (Lesson 20). If it already has e1, keep E1's lines in
the files both extensions change (the lesson's "Did E1 first?" note lists them) and add E2's.
Use exactly the file contents shown in the lesson's "Full files" section for my tracks,
including package lines, imports and comments. All paths are relative to demo/. Touch no file
that isn't listed here.

1. Shared code, all tracks: shared/build.gradle.kts: replaced (adds ExifInterface to androidMain).
   Under shared/src/commonMain/kotlin/com/example/devicemonitor/:
     add: core/MediaInfo.kt, core/PickedMedia.kt, core/MediaException.kt,
       core/outbound/MediaPicker.kt, core/inbound/MediaCapture.kt, core/MediaCaptureService.kt,
       adapter/inbound/MediaUiState.kt, adapter/inbound/MediaViewModel.kt
     replaced: core/Permission.kt, di/AppModule.kt
   Under shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/:
     add: AndroidMediaPicker.kt; replaced: AndroidPermissionChecker.kt
   Under shared/src/commonTest/kotlin/com/example/devicemonitor/:
     add: doubles/FakeMediaPicker.kt, doubles/TestMediaCapture.kt, core/MediaCaptureServiceTest.kt,
       adapter/inbound/MediaViewModelTest.kt
     replaced: di/AppModuleTest.kt
   docs/checklists.md: replaced.
   Every other file in shared/ and docs/ stays as in m15.

2. Android, both tracks: replaced with my track's: androidApp/src/main/AndroidManifest.xml and
   androidApp/build.gradle.kts (each adds CAMERA, two optional camera features, the provider,
   and ExifInterface). Under androidApp/src/main/java/com/example/devicemonitor/android/:
   DeviceMonitorApplication.kt: replaced; add PhotoBitmap.kt and MediaFileProvider.kt. Add
   androidApp/src/main/res/xml/media_paths.xml. (These four are the same on both tracks.)
     Compose: under androidApp/src/main/java/com/example/devicemonitor/android/:
       MainActivity.kt, DeviceMonitorApp.kt and DeviceListScreen.kt: replaced; add PhotoScreen.kt.
     XML: androidApp/src/main/res/navigation/nav_graph.xml,
       androidApp/src/main/res/layout/fragment_device_list.xml and
       androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt: replaced;
       add androidApp/src/main/res/layout/fragment_photo.xml and
       androidApp/src/main/java/com/example/devicemonitor/android/PhotoFragment.kt.
   iOS, both tracks: iosApp/project.yml: replaced with my track's (adds NSCameraUsageDescription);
   iosApp/iosApp/IosPermissionChecker.swift: replaced; add iosApp/iosApp/IosMediaPicker.swift.
   Then run `xcodegen generate` in iosApp/: it rewrites iosApp/iosApp/Info.plist from
   project.yml (compare it with my track's Info.plist in the lesson) and adds the new Swift files
   to the Xcode project. Do NOT edit the .xcodeproj by hand.
     SwiftUI: iosApp/iosApp/iOSApp.swift and ContentView.swift: replaced; add PhotoView.swift.
     UIKit: iosApp/iosApp/AppDelegate.swift and DeviceListViewController.swift: replaced; add
       PhotoViewController.swift.
   Every other Android and iOS file stays as in m15.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Android: run on an emulator with Android 12 or newer (API 31+) that has a camera (the
   default AVDs do: its camera app films a virtual scene):
     adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk
     adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`,
     then `xcrun simctl launch booted com.example.devicemonitor`.

4. Two test photos, made with macOS's own tools (no ImageMagick needed), with the Simulator booted:
     mkdir -p /tmp/e2-photos && cd /tmp/e2-photos
     xcrun simctl io booted screenshot shot.png                   # any portrait screenshot
     sips -Z 800 shot.png --out portrait.png                      # a portrait PNG
     sips -s format jpeg -r 270 portrait.png --out sideways.jpg   # its pixels turned on their side
   Then give sideways.jpg EXIF orientation 6 ("turn 90° clockwise to show"), so it displays
   upright again, with this script (save it as exif6.py and run: python3 exif6.py sideways.jpg):
     import struct, sys
     path = sys.argv[1]
     data = open(path, 'rb').read()
     out, i = data[:2], 2
     while data[i] == 0xFF and data[i + 1] != 0xDA:
         length = int.from_bytes(data[i + 2:i + 4], 'big')
         if not (data[i + 1] == 0xE1 and data[i + 4:i + 8] == b'Exif'):
             out += data[i:i + 2 + length]
         i += 2 + length
     tiff = b'MM\x00\x2a' + struct.pack('>IH', 8, 1) + struct.pack('>HHIHH', 0x0112, 3, 1, 6, 0) + struct.pack('>I', 0)
     exif = b'Exif\x00\x00' + tiff
     open(path, 'wb').write(out[:2] + b'\xff\xe1' + struct.pack('>H', len(exif) + 2) + exif + out[2:] + data[i:])
   `sips -g pixelWidth -g pixelHeight sideways.jpg` shows landscape pixels (W > H). Put both
   photos in each library:
     adb push portrait.png sideways.jpg /sdcard/Pictures/
     adb shell content call --method scan_volume --uri content://media --arg external_primary
     xcrun simctl addmedia booted portrait.png sideways.jpg

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 117 tests pass on each: 24 in SessionServiceTest, 13 in
  DeviceDetailViewModelTest, 10 in DeviceListViewModelTest, 10 in MonitoringServiceTest, 9 in
  ScanningServiceTest, 8 in ValueDecoderTest, 6 in MediaCaptureServiceTest, 6 in
  MediaViewModelTest, 6 in MonitorViewModelTest, 5 in StatusServiceTest, 4 in JsonLinesTest,
  4 in PermissionServiceTest, 3 in DeviceServiceTest, 3 in AppModuleTest, 1 in
  SessionConnectionStatusTest, and 5 in AndroidLogStoreTest (JVM results) or 5 in
  IosLogStoreTest (iOS results). Show the counts from the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: SKIE's "Configuration '…' was resolved during configuration time",
  SLF4J "Failed to load class", Gradle's "Deprecated Gradle features … Gradle 10", "Unable to
  strip the following libraries", Xcode's "appintentsmetadataprocessor … warning: Metadata
  extraction skipped", xcodebuild's "WARNING: Using the first of multiple matching
  destinations", and Gradle's "The Daemon will expire …". Xcode "note:" lines are not warnings.
- Placement, each from demo/:
    grep -rn 'import android\.\|import platform\.\|import org.koin\|import io.ktor\|import kotlinx.serialization' shared/src/commonMain/kotlin/com/example/devicemonitor/core
    grep -n 'core.outbound\|adapter.outbound\|import android\.\|import platform\.' shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/*.kt
  each find nothing; grep -n 'core.inbound' shared/src/commonMain/kotlin/com/example/devicemonitor/core/*Service.kt
  prints exactly six lines, each service importing only its own port;
    grep -rln 'TakePicture\|PickVisualMedia' shared/src androidApp/src
  lists AndroidMediaPicker.kt and MainActivity.kt (Compose) or PhotoFragment.kt (XML); and
    grep -rln 'UIImagePickerController\|PHPicker\|photosPicker' iosApp/iosApp
  lists IosMediaPicker.swift and PhotoView.swift (SwiftUI) or PhotoViewController.swift (UIKit).
- Android emulator (API 31+), my track. Find text with `adb shell uiautomator dump`, and take a
  screenshot (adb exec-out screencap -p) to see the photo. The XML buttons show their text in
  capitals, so match case-insensitively. Start from a fresh install (adb uninstall first).
  1. The main screen shows a "Photo" button next to the title. Tap it: "Device Monitor needs
     the camera permission to take photos.", Allow camera, Take photo (disabled) and Choose
     from library. In a Compose uiautomator dump the "Take photo" label node still reads
     enabled="true": the flag is on the clickable android.view.View around it (enabled="false"),
     or look at a screenshot, where the button is greyed.
  2. Allow camera, then Don't allow: "Camera permission was denied. Taking photos needs it."
     and Ask again. Ask again, then While using the app: "Camera permission: allowed".
  3. Take photo: the emulator's camera app opens. Take the picture (the shutter button) and
     accept it (✓): the photo, and "From the camera · W × H px · image/jpeg · N KB".
     adb shell run-as com.example.devicemonitor ls cache/media shows exactly one file.
  4. Choose from library, pick sideways.jpg. The picker labels photos only by date, so you can't
     tell the two test photos apart by name: pick one and read the line, and pick the other if it
     says image/png (that is portrait.png, check 5). Expect the photo upright (the screenshot's
     status bar at the top), and "From the library · W × H px · image/jpeg · N KB" with H greater than W.
  5. Choose from library, pick portrait.png: "From the library · … · image/png · …"; cache/media
     still holds one file.
  6. Choose from library, then the system Back key: the last photo and its line stay, no error.
     Take photo, then Back (or the camera app's ✕): the same.
  7. XML only: rotate the emulator (adb shell settings put system accelerometer_rotation 0, then
     adb shell settings put system user_rotation 1, then 0): the photo stays, and so does its
     line. In landscape the line is below the visible part of the screen, so a dump lacks it
     until you scroll up (adb shell input swipe 1200 800 1200 200 300); then it reads the same.
     Put accelerometer_rotation back to 1 afterwards.
- iOS Simulator, my track. Drive it with a throwaway XCUITest that launches the installed app
  by bundle ID (or idb); don't script the Simulator window with System Events. System alerts
  belong to com.apple.springboard. In the photo picker, tap a photo by its label ("Photo, …"; the cells are app.images
  elements, and, as on Android, only dates tell the test photos apart: pick one and read the line),
  with element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(): the cells
  report "not hittable" to a plain tap(). Start with
  `xcrun simctl privacy booted reset camera com.example.devicemonitor`.
  1. Tap "Photo" in the navigation bar: "Device Monitor needs the camera permission to take
     photos.", Allow camera; Take photo disabled.
  2. Allow camera: the alert "“Device Monitor” would like to access the Camera." with our
     usage text. Don't Allow: "Camera permission is off. You can turn it on in Settings." and
     Open Settings; Take photo still disabled.
  3. xcrun simctl privacy booted grant camera com.example.devicemonitor, then relaunch the app
     and open Photo again: "Camera permission: allowed".
  4. Repeat Android checks 4–6 (Cancel closes the picker). For the camera: Take photo opens a
     camera screen on the Simulator; don't expect a photo from its shutter. Close it with its ✕
     (identifier DismissImagePickerButton): the last photo stays, no error.
- Device checks (record them, don't run them): on a physical Android phone (Compose, then XML)
  and an iPhone (SwiftUI, then UIKit): (1) hold the phone upright, Take photo, take and accept
  a picture: the photo upright, "From the camera · W × H px · image/jpeg · N KB" with H greater
  than W; then Take photo and close the camera: the photo stays. (2) iPhone: from Don't Allow,
  Open Settings, turn the camera on, come back: "Camera permission: allowed". (3) Choose from
  library, pick a photo the phone's own Camera app took: upright, with the type it has in the
  library (write it down). Expected: the same lines as on the emulator and the Simulator.
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me the placement greps' output.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Appendix A.4](https://phongna-inn.github.io/carmd-kmp-course/COURSE_PLAN.md) của kế hoạch khoá học (yêu cầu về camera và media) và A.2 (luồng quyền mà camera nhập vào).
- Android: [Photo picker](https://developer.android.com/training/data-storage/shared/photo-picker) (nguồn chính: `PickVisualMedia`, thiết bị nào có nó, phương án dự phòng `ACTION_OPEN_DOCUMENT`, một URI đã chọn đọc được bao lâu), [ActivityResultContracts.TakePicture](https://developer.android.com/reference/androidx/activity/result/contract/ActivityResultContracts.TakePicture) và [MediaStore.ACTION_IMAGE_CAPTURE](https://developer.android.com/reference/android/provider/MediaStore#ACTION_IMAGE_CAPTURE) (ảnh kích thước đầy đủ ghi vào URI của bạn, bản sao `ClipData`, và `SecurityException` khi `CAMERA` được khai báo mà chưa được cấp), [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider) (kế thừa nó; `cache-path`; `grantUriPermissions`), [&lt;uses-feature>](https://developer.android.com/guide/topics/manifest/uses-feature-element) (các feature mà `CAMERA` ngầm định, và `required="false"`), [Loading large bitmaps efficiently](https://developer.android.com/topic/performance/graphics/load-bitmap) (`inJustDecodeBounds`, `inSampleSize`) và [ExifInterface](https://developer.android.com/reference/androidx/exifinterface/media/ExifInterface) (`rotationDegrees`).
- Apple: [Requesting authorization to capture and save media](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media) (nguồn chính: `NSCameraUsageDescription`, `authorizationStatus(for:)`, `requestAccess(for:)`, một alert hệ thống hiện một lần và nhớ câu trả lời), [Delivering an enhanced privacy experience in your photos app](https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app) (vì sao `PHPickerViewController` không cần quyền thư viện), [PhotosPicker](https://developer.apple.com/documentation/photosui/photospicker) (item giữ chỗ, `loadTransferable`, các lỗi của nó), [PHPickerViewController](https://developer.apple.com/documentation/photosui/phpickerviewcontroller), [UIImagePickerController](https://developer.apple.com/documentation/uikit/uiimagepickercontroller) và [isSourceTypeAvailable(_:)](https://developer.apple.com/documentation/uikit/uiimagepickercontroller/issourcetypeavailable(_:)), và [UIImage.size](https://developer.apple.com/documentation/uikit/uiimage/size) ("tính tới orientation hiện tại của ảnh").
- Các nguồn về quyền của bài 12 ([Request runtime permissions](https://developer.android.com/training/permissions/requesting) của Android, Activity Result API), thứ quyền camera dùng lại không đổi.
- [Cheatsheet: architecture, DI and testing](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): port, service và adapter nằm đâu, fake, và test graph của Koin.
- Kinh nghiệm thực tế: kênh #multiplatform của Kotlin Slack, cho câu hỏi về interop Swift–Kotlin; các tag [android-camera-intent](https://stackoverflow.com/questions/tagged/android-camera-intent), [android-fileprovider](https://stackoverflow.com/questions/tagged/android-fileprovider), [uiimagepickercontroller](https://stackoverflow.com/questions/tagged/uiimagepickercontroller) và [phpickerviewcontroller](https://stackoverflow.com/questions/tagged/phpickerviewcontroller) của Stack Overflow.

## File đầy đủ

Mọi file phần mở rộng này thêm hoặc sửa, đầy đủ, dưới dạng m15 cộng E2. `iosApp/iosApp.xcodeproj` được sinh lại bởi `xcodegen generate`, lệnh cũng ghi `Info.plist` từ `project.yml`; các build file gốc giữ như ở m15. File chỉ một track có nằm trong tab của track đó; một file giống nhau trên cả hai track của một nền tảng ghi rõ trong tiêu đề, và khi hai track cùng sửa một file cùng đường dẫn, tiêu đề của nó ghi tên track.

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
            }
            androidMain.dependencies {
                implementation("androidx.activity:activity:1.13.0")
                implementation("androidx.work:work-runtime:2.12.0")
                implementation("androidx.exifinterface:exifinterface:1.4.2")
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/MediaInfo.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A photo the user took or chose, as the app keeps it: a copy in the app's own storage, and what
    // the app knows about it. Each platform's adapter makes the copy and reads these facts.
    data class MediaInfo(
        val path: String,      // the copy's file path, which the screens show
        val source: MediaSource,
        val type: String,      // its MIME type, such as "image/jpeg" or "image/heic"
        val width: Int,        // in pixels, the way up the photo is shown
        val height: Int,
        val sizeBytes: Long,   // the copy's size on disk
    )

    enum class MediaSource { Camera, Library }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/PickedMedia.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // How a trip to the system camera or photo picker ended, as a MediaPicker adapter reports it.
    sealed interface PickedMedia {
        // The user took or chose a photo, and the adapter copied it into the app's storage.
        data class Photo(val info: MediaInfo) : PickedMedia

        // The user closed the camera or the picker without a photo. Not an error.
        data object Cancelled : PickedMedia

        // Something went wrong on the way, in the platform's words: no camera app, a file that
        // couldn't be copied, an image the platform can't read.
        data class Failed(val reason: String) : PickedMedia
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/MediaException.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A photo the app couldn't get: no camera, no camera permission, or a failure on the way. The
    // message is for the user. MediaCaptureService throws it, and it reaches inbound adapters
    // through MediaCapture.
    class MediaException(message: String) : Exception(message)
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/Permission.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A permission the app needs, in the app's terms. Each platform's adapter maps it to its
    // own: Bluetooth is two runtime permissions on Android 12 and later, one on iOS. The camera
    // (Extension E2) is one on each.
    enum class Permission { Bluetooth, Camera }

    // Where a permission stands, in terms of what the user can do next.
    enum class PermissionStatus {
        NotRequested,      // not asked yet: a request shows the system prompt
        Denied,            // refused, and the app may ask again (Android only)
        PermanentlyDenied, // refused, and the system won't ask again: only Settings can change it
        Restricted,        // blocked by a policy the user can't change, such as parental controls (iOS)
        Granted,
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/MediaPicker.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.PickedMedia

    // Outbound port: what the app needs from the platform's camera and photo picker, in the app's
    // terms. One adapter per platform: Kotlin in androidMain, Swift in the iOS app. Neither call
    // throws; every way a trip can end is a PickedMedia.
    interface MediaPicker {
        // Whether this device has a camera. Never shows anything.
        fun hasCamera(): Boolean

        // Opens the system camera and waits until the user takes a photo or closes it.
        suspend fun capturePhoto(): PickedMedia

        // Opens the system photo picker, images only, and waits until the user picks one or
        // closes it.
        suspend fun pickMedia(): PickedMedia
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/MediaCapture.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.MediaInfo

    // Inbound port: what the app offers for photos (Extension E2). The shared ViewModels call it,
    // and MediaCaptureService implements it.
    interface MediaCapture {
        // Takes a photo with the system camera. Null if the user closed the camera without one.
        // Throws MediaException when there is no camera, no camera permission, or a failure.
        suspend fun capturePhoto(): MediaInfo?

        // Lets the user choose a photo from the library. Null if the user closed the picker
        // without one. Throws MediaException on a failure.
        suspend fun pickMedia(): MediaInfo?
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/MediaCaptureService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.MediaCapture
    import com.example.devicemonitor.core.outbound.MediaPicker
    import com.example.devicemonitor.core.outbound.PermissionChecker

    // Service: the app's photo rules. Open the camera only when the device has one and the camera
    // permission is granted. Choosing from the library needs no permission: the system picker shows
    // the library, and the app receives only the photo the user picks. A closed camera or picker
    // is nothing; a failure is a MediaException with words for the user.
    class MediaCaptureService(
        private val picker: MediaPicker,
        private val permissions: PermissionChecker,
    ) : MediaCapture {
        override suspend fun capturePhoto(): MediaInfo? {
            if (!picker.hasCamera()) throw MediaException("This device has no camera.")
            if (permissions.check(Permission.Camera) != PermissionStatus.Granted) {
                throw MediaException("Taking a photo needs the camera permission.")
            }
            return outcome(picker.capturePhoto(), "The photo couldn't be saved")
        }

        override suspend fun pickMedia(): MediaInfo? =
            outcome(picker.pickMedia(), "The photo couldn't be loaded")

        private fun outcome(picked: PickedMedia, failure: String): MediaInfo? = when (picked) {
            is PickedMedia.Photo -> picked.info
            PickedMedia.Cancelled -> null
            is PickedMedia.Failed -> throw MediaException("$failure: ${picked.reason}")
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMediaPicker.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.content.ActivityNotFoundException
    import android.content.Context
    import android.content.pm.PackageManager
    import android.graphics.BitmapFactory
    import android.net.Uri
    import android.webkit.MimeTypeMap
    import androidx.activity.result.ActivityResultLauncher
    import androidx.activity.result.PickVisualMediaRequest
    import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
    import androidx.core.content.FileProvider
    import androidx.exifinterface.media.ExifInterface
    import com.example.devicemonitor.core.MediaInfo
    import com.example.devicemonitor.core.MediaSource
    import com.example.devicemonitor.core.PickedMedia
    import com.example.devicemonitor.core.outbound.MediaPicker
    import kotlinx.coroutines.CompletableDeferred
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.withContext
    import java.io.File
    import java.io.IOException

    // Outbound adapter: the system camera app and photo picker behind the MediaPicker port. As with
    // permissions, only an Activity or a Fragment can register for a result, so one of them lends
    // this adapter its two launchers (attach) and passes each answer on (onPhotoTaken, onImageChosen).
    // The camera writes into a file the adapter names; a picked photo is copied into one. Both live
    // in the app's cache, under media/, which the FileProvider in the manifest shares.
    class AndroidMediaPicker(private val context: Context) : MediaPicker {
        private var camera: ActivityResultLauncher<Uri>? = null
        private var library: ActivityResultLauncher<PickVisualMediaRequest>? = null
        private var photoTaken: CompletableDeferred<Boolean>? = null
        private var imageChosen: CompletableDeferred<Uri?>? = null

        private val folder = File(context.cacheDir, "media")

        fun attach(camera: ActivityResultLauncher<Uri>, library: ActivityResultLauncher<PickVisualMediaRequest>) {
            this.camera = camera
            this.library = library
        }

        fun detach(camera: ActivityResultLauncher<Uri>) {
            if (this.camera !== camera) return
            this.camera = null
            this.library = null
        }

        // The TakePicture launcher's callback: true if the camera app saved a photo into the file.
        fun onPhotoTaken(saved: Boolean) {
            photoTaken?.complete(saved)
            photoTaken = null
        }

        // The PickVisualMedia launcher's callback: the photo's content URI, or null if none was picked.
        fun onImageChosen(uri: Uri?) {
            imageChosen?.complete(uri)
            imageChosen = null
        }

        override fun hasCamera(): Boolean =
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)

        override suspend fun capturePhoto(): PickedMedia {
            val launcher = camera ?: return PickedMedia.Failed("no screen has attached a camera launcher")
            val file = newFile("jpg")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            val answer = CompletableDeferred<Boolean>()
            photoTaken = answer
            try {
                launcher.launch(uri)
            } catch (e: ActivityNotFoundException) {
                photoTaken = null
                return PickedMedia.Failed("no camera app on this phone")
            }
            if (!answer.await()) {
                file.delete()
                return PickedMedia.Cancelled
            }
            return describe(file, MediaSource.Camera)
        }

        override suspend fun pickMedia(): PickedMedia {
            val launcher = library ?: return PickedMedia.Failed("no screen has attached a photo picker launcher")
            val answer = CompletableDeferred<Uri?>()
            imageChosen = answer
            launcher.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly))
            val uri = answer.await() ?: return PickedMedia.Cancelled
            val type = context.contentResolver.getType(uri)
            val file = newFile(MimeTypeMap.getSingleton().getExtensionFromMimeType(type) ?: "img")
            return try {
                withContext(Dispatchers.IO) {
                    val input = context.contentResolver.openInputStream(uri) ?: throw IOException("the photo can't be opened")
                    input.use { from -> file.outputStream().use { to -> from.copyTo(to) } }
                }
                describe(file, MediaSource.Library)
            } catch (e: IOException) {
                file.delete()
                PickedMedia.Failed(e.message ?: "the copy failed")
            }
        }

        // A fresh name for every photo, so a screen never shows an old picture under a new path.
        private fun newFile(extension: String): File {
            folder.mkdirs()
            return File(folder, "photo-${System.currentTimeMillis()}.$extension")
        }

        // Reads the copy's size and type without decoding its pixels, then keeps only this copy.
        private suspend fun describe(file: File, source: MediaSource): PickedMedia = withContext(Dispatchers.IO) {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                file.delete()
                return@withContext PickedMedia.Failed("Android can't read this file as an image")
            }
            // A camera often stores a portrait photo as landscape pixels plus an EXIF orientation tag.
            val turned = ExifInterface(file.path).rotationDegrees % 180 != 0
            folder.listFiles()?.filter { it != file }?.forEach { it.delete() }
            PickedMedia.Photo(
                MediaInfo(
                    path = file.path,
                    source = source,
                    type = bounds.outMimeType ?: "image/*",
                    width = if (turned) bounds.outHeight else bounds.outWidth,
                    height = if (turned) bounds.outWidth else bounds.outHeight,
                    sizeBytes = file.length(),
                ),
            )
        }
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.outbound

    import android.Manifest
    import android.app.Activity
    import android.content.Context
    import android.content.Intent
    import android.content.pm.PackageManager
    import android.net.Uri
    import android.os.Build
    import android.provider.Settings
    import androidx.activity.result.ActivityResultLauncher
    import androidx.core.app.ActivityCompat
    import androidx.core.content.ContextCompat
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.outbound.PermissionChecker
    import kotlinx.coroutines.CompletableDeferred

    // Outbound adapter: Android's runtime permissions behind the PermissionChecker port.
    // Android lets only an Activity or a Fragment register for a result, so one of them lends
    // this adapter its launcher (attach), and tells it when the user answered (onResult).
    class AndroidPermissionChecker(private val context: Context) : PermissionChecker {
        private var activity: Activity? = null
        private var launcher: ActivityResultLauncher<Array<String>>? = null
        private var answer: CompletableDeferred<Unit>? = null

        // Android has no "refused for good" status to read back, so the adapter remembers, across
        // launches, which permissions the user has refused.
        private val refusals = context.getSharedPreferences("permission-refusals", Context.MODE_PRIVATE)

        fun attach(activity: Activity, launcher: ActivityResultLauncher<Array<String>>) {
            this.activity = activity
            this.launcher = launcher
        }

        fun detach(launcher: ActivityResultLauncher<Array<String>>) {
            if (this.launcher !== launcher) return
            this.activity = null
            this.launcher = null
        }

        // The launcher's callback. It passes its own Activity too, so that whichever of attach and
        // onResult runs first after a rotation, the answer is read through the new Activity.
        fun onResult(activity: Activity) {
            this.activity = activity
            answer?.complete(Unit)
            answer = null
        }

        override fun check(permission: Permission): PermissionStatus {
            val names = permission.androidNames()
            return when {
                names.all { isGranted(it) } -> {
                    refusals.edit().remove(permission.name).apply()
                    PermissionStatus.Granted
                }
                // Refused before, and Android suggests explaining why: its dialog still shows.
                shouldShowRationale(names) -> {
                    refusals.edit().putBoolean(permission.name, true).apply()
                    PermissionStatus.Denied
                }
                // Refused before, and no explanation suggested any more: no dialog either.
                refusals.getBoolean(permission.name, false) -> PermissionStatus.PermanentlyDenied
                else -> PermissionStatus.NotRequested
            }
        }

        override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
            val launcher = checkNotNull(launcher) { "No Activity or Fragment has attached a permission launcher." }
            val answered = CompletableDeferred<Unit>()
            answer = answered
            launcher.launch(permissions.flatMap { it.androidNames() }.toTypedArray())
            answered.await()
            return permissions.associateWith { check(it) }
        }

        override fun openSettings() {
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", context.packageName, null),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }

        private fun isGranted(name: String) =
            ContextCompat.checkSelfPermission(context, name) == PackageManager.PERMISSION_GRANTED

        private fun shouldShowRationale(names: List<String>): Boolean {
            val activity = activity ?: return false
            return names.any { ActivityCompat.shouldShowRequestPermissionRationale(activity, it) }
        }

        // Android 12 (API 31) gave Bluetooth its own runtime permissions. Before that, a BLE scan
        // needed fine location instead. The camera is one runtime permission on every version.
        private fun Permission.androidNames(): List<String> = when (this) {
            Permission.Bluetooth ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
                } else {
                    listOf(Manifest.permission.ACCESS_FINE_LOCATION)
                }
            Permission.Camera -> listOf(Manifest.permission.CAMERA)
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MediaUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.MediaInfo
    import com.example.devicemonitor.core.PermissionStatus

    // Everything the photo screen shows (Extension E2).
    data class MediaUiState(
        val camera: PermissionStatus = PermissionStatus.NotRequested,
        val busy: Boolean = false,           // the camera or the picker is open, or a copy is being made
        val photo: MediaInfo? = null,        // the newest photo; it stays until another one replaces it
        val details: String? = null,         // the photo's media info, worded for the screen
        val errorMessage: String? = null,
    ) {
        val canTakePhoto: Boolean get() = !busy && camera == PermissionStatus.Granted
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/MediaViewModel.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import androidx.lifecycle.ViewModel
    import androidx.lifecycle.viewModelScope
    import com.example.devicemonitor.core.MediaException
    import com.example.devicemonitor.core.MediaInfo
    import com.example.devicemonitor.core.MediaSource
    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.inbound.MediaCapture
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import kotlinx.coroutines.Job
    import kotlinx.coroutines.flow.MutableStateFlow
    import kotlinx.coroutines.flow.StateFlow
    import kotlinx.coroutines.flow.asStateFlow
    import kotlinx.coroutines.flow.update
    import kotlinx.coroutines.launch

    // Inbound adapter: turns the photo screen's events into calls on the MediaCapture and
    // PermissionAccess ports, and the results into UI state. It knows the ports only.
    class MediaViewModel(
        private val media: MediaCapture,
        private val permissions: PermissionAccess,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(MediaUiState(camera = permissions.status(Permission.Camera)))
        val uiState: StateFlow<MediaUiState> = _uiState.asStateFlow()

        private var mediaJob: Job? = null
        private var permissionJob: Job? = null

        fun takePhoto() = fetch { media.capturePhoto() }

        fun choosePhoto() = fetch { media.pickMedia() }

        // One trip at a time: the system shows one camera or picker.
        private fun fetch(call: suspend () -> MediaInfo?) {
            if (mediaJob?.isActive == true) return
            _uiState.update { it.copy(busy = true, errorMessage = null) }
            mediaJob = viewModelScope.launch {
                try {
                    val photo = call()
                    // Null: the user closed the camera or the picker, and the last photo stays.
                    if (photo != null) _uiState.update { it.copy(photo = photo, details = describe(photo)) }
                } catch (e: MediaException) {
                    _uiState.update { it.copy(errorMessage = e.message) }
                } finally {
                    _uiState.update { it.copy(busy = false) }
                }
            }
        }

        // The screen calls this each time it comes back to the foreground: the user may have
        // changed the permission in Settings meanwhile.
        fun refreshPermission() {
            if (permissionJob?.isActive == true) return
            _uiState.update { it.copy(camera = permissions.status(Permission.Camera)) }
        }

        fun requestPermission() {
            if (permissionJob?.isActive == true) return
            permissionJob = viewModelScope.launch {
                val result = permissions.request(listOf(Permission.Camera))
                _uiState.update { it.copy(camera = result.getValue(Permission.Camera)) }
            }
        }

        fun openSettings() {
            permissions.openSettings()
        }

        // The media info as one line, the same on every track.
        private fun describe(photo: MediaInfo): String {
            val source = when (photo.source) {
                MediaSource.Camera -> "From the camera"
                MediaSource.Library -> "From the library"
            }
            return "$source · ${photo.width} × ${photo.height} px · ${photo.type} · ${size(photo.sizeBytes)}"
        }

        // 1 KB is 1,024 bytes here; one decimal for megabytes, without platform number formatting.
        private fun size(bytes: Long): String {
            val kb = 1024L
            val mb = kb * kb
            if (bytes < mb) return "${(bytes + kb / 2) / kb} KB"
            val tenths = (bytes * 10 + mb / 2) / mb
            return "${tenths / 10}.${tenths % 10} MB"
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MediaViewModel
    import com.example.devicemonitor.adapter.inbound.MonitorViewModel
    import com.example.devicemonitor.adapter.outbound.SessionConnectionStatus
    import com.example.devicemonitor.core.MediaCaptureService
    import com.example.devicemonitor.core.MonitoringService
    import com.example.devicemonitor.core.PermissionService
    import com.example.devicemonitor.core.ScanningService
    import com.example.devicemonitor.core.SessionService
    import com.example.devicemonitor.core.StatusService
    import com.example.devicemonitor.core.inbound.DeviceMonitoring
    import com.example.devicemonitor.core.inbound.DeviceScanning
    import com.example.devicemonitor.core.inbound.DeviceSession
    import com.example.devicemonitor.core.inbound.MediaCapture
    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.inbound.StatusReport
    import com.example.devicemonitor.core.outbound.BatteryProvider
    import com.example.devicemonitor.core.outbound.BleConnection
    import com.example.devicemonitor.core.outbound.BleScanner
    import com.example.devicemonitor.core.outbound.BluetoothProvider
    import com.example.devicemonitor.core.outbound.ConnectionStatus
    import com.example.devicemonitor.core.outbound.LogStore
    import com.example.devicemonitor.core.outbound.MediaPicker
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
        // Photos (Extension E2): the platform's MediaPicker, and the camera permission through the
        // same PermissionChecker as Bluetooth.
        single<MediaCapture> { MediaCaptureService(get(), get()) }
        viewModelOf(::DeviceListViewModel)
        viewModelOf(::DeviceDetailViewModel)
        viewModelOf(::MonitorViewModel)
        viewModelOf(::MediaViewModel)
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
        mediaPicker: MediaPicker,
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
        single { mediaPicker }
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
        mediaPicker: MediaPicker,
    ) {
        startKoin {
            modules(
                appModule,
                platformModule(
                    permissionChecker, bleScanner, bleConnection, batteryProvider, networkProvider, bluetoothProvider,
                    logStore, monitorScheduler, monitorSettings, mediaPicker,
                ),
            )
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakeMediaPicker.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.PickedMedia
    import com.example.devicemonitor.core.outbound.MediaPicker

    // Fake: an outbound adapter written for tests, behind the MediaPicker port. The test plays the
    // platform and the user: whether there is a camera, and how each trip ends.
    class FakeMediaPicker : MediaPicker {
        var camera = true
        var photoTaken: PickedMedia = PickedMedia.Cancelled
        var imageChosen: PickedMedia = PickedMedia.Cancelled
        var cameraOpened = 0
        var libraryOpened = 0

        override fun hasCamera(): Boolean = camera

        override suspend fun capturePhoto(): PickedMedia {
            cameraOpened++
            return photoTaken
        }

        override suspend fun pickMedia(): PickedMedia {
            libraryOpened++
            return imageChosen
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestMediaCapture.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.MediaException
    import com.example.devicemonitor.core.MediaInfo
    import com.example.devicemonitor.core.inbound.MediaCapture
    import kotlinx.coroutines.CompletableDeferred

    // Test implementation of the MediaCapture inbound port, for ViewModel tests. Each call waits
    // until the test ends the trip, so the test can look at the screen while the camera is open.
    class TestMediaCapture : MediaCapture {
        private var trip: CompletableDeferred<MediaInfo?>? = null
        var trips = 0

        override suspend fun capturePhoto(): MediaInfo? = open()

        override suspend fun pickMedia(): MediaInfo? = open()

        private suspend fun open(): MediaInfo? {
            trips++
            val waiting = CompletableDeferred<MediaInfo?>()
            trip = waiting
            return waiting.await()
        }

        fun give(photo: MediaInfo) {
            trip?.complete(photo)
        }

        fun close() {
            trip?.complete(null)
        }

        fun fail(message: String) {
            trip?.completeExceptionally(MediaException(message))
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/MediaCaptureServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.MediaCapture
    import com.example.devicemonitor.doubles.FakeMediaPicker
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFailsWith
    import kotlin.test.assertNull

    class MediaCaptureServiceTest {
        private val picker = FakeMediaPicker()
        private val os = FakePermissionChecker()
        private val photo = MediaInfo(
            path = "/cache/media/photo-1.jpg", source = MediaSource.Camera,
            type = "image/jpeg", width = 3024, height = 4032, sizeBytes = 2_400_000,
        )

        // Through the inbound port, as the ViewModel calls it.
        private val media: MediaCapture = MediaCaptureService(picker, os)

        @Test
        fun takesAPhotoWhenThereIsACameraAndThePermission() = runTest {
            os.statuses[Permission.Camera] = PermissionStatus.Granted
            picker.photoTaken = PickedMedia.Photo(photo)

            assertEquals(photo, media.capturePhoto())
            assertEquals(1, picker.cameraOpened)
        }

        @Test
        fun neverOpensTheCameraWithoutThePermission() = runTest {
            for (status in PermissionStatus.entries - PermissionStatus.Granted) {
                os.statuses[Permission.Camera] = status

                val error = assertFailsWith<MediaException> { media.capturePhoto() }

                assertEquals("Taking a photo needs the camera permission.", error.message)
            }
            assertEquals(0, picker.cameraOpened)
            assertEquals(emptyList(), os.prompts) // the service checks; asking is the screen's choice
        }

        @Test
        fun saysSoWhenThereIsNoCamera() = runTest {
            picker.camera = false
            os.statuses[Permission.Camera] = PermissionStatus.Granted

            val error = assertFailsWith<MediaException> { media.capturePhoto() }

            assertEquals("This device has no camera.", error.message)
            assertEquals(0, picker.cameraOpened)
        }

        @Test
        fun aClosedCameraOrPickerIsNoPhotoAndNoError() = runTest {
            os.statuses[Permission.Camera] = PermissionStatus.Granted

            assertNull(media.capturePhoto())
            assertNull(media.pickMedia())
        }

        @Test
        fun choosingFromTheLibraryNeedsNoPermission() = runTest {
            picker.camera = false // and no camera either
            val chosen = photo.copy(source = MediaSource.Library, type = "image/heic")
            picker.imageChosen = PickedMedia.Photo(chosen)

            assertEquals(chosen, media.pickMedia())
            assertEquals(emptyList(), os.prompts)
        }

        @Test
        fun aFailureOnTheWayIsAMediaExceptionWithThePlatformsReason() = runTest {
            os.statuses[Permission.Camera] = PermissionStatus.Granted
            picker.photoTaken = PickedMedia.Failed("no camera app on this phone")
            picker.imageChosen = PickedMedia.Failed("Android can't read this file as an image")

            val taking = assertFailsWith<MediaException> { media.capturePhoto() }
            val choosing = assertFailsWith<MediaException> { media.pickMedia() }

            assertEquals("The photo couldn't be saved: no camera app on this phone", taking.message)
            assertEquals("The photo couldn't be loaded: Android can't read this file as an image", choosing.message)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/adapter/inbound/MediaViewModelTest.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.MediaInfo
    import com.example.devicemonitor.core.MediaSource
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.doubles.TestMediaCapture
    import com.example.devicemonitor.doubles.TestPermissionAccess
    import kotlinx.coroutines.Dispatchers
    import kotlinx.coroutines.ExperimentalCoroutinesApi
    import kotlinx.coroutines.test.StandardTestDispatcher
    import kotlinx.coroutines.test.TestScope
    import kotlinx.coroutines.test.resetMain
    import kotlinx.coroutines.test.runCurrent
    import kotlinx.coroutines.test.runTest
    import kotlinx.coroutines.test.setMain
    import kotlin.test.AfterTest
    import kotlin.test.BeforeTest
    import kotlin.test.Test
    import kotlin.test.assertEquals
    import kotlin.test.assertFalse
    import kotlin.test.assertNull
    import kotlin.test.assertTrue

    @OptIn(ExperimentalCoroutinesApi::class) // setMain, resetMain, runCurrent
    class MediaViewModelTest {
        private val media = TestMediaCapture()
        private val permissions = TestPermissionAccess()
        private val photo = MediaInfo(
            path = "/cache/media/photo-1.jpg", source = MediaSource.Camera,
            type = "image/jpeg", width = 3024, height = 4032, sizeBytes = 2_516_582,
        )
        private lateinit var viewModel: MediaViewModel

        @BeforeTest
        fun setUp() {
            Dispatchers.setMain(StandardTestDispatcher())
        }

        @AfterTest
        fun tearDown() {
            Dispatchers.resetMain()
        }

        private fun TestScope.start(camera: PermissionStatus = PermissionStatus.Granted) {
            permissions.current = camera
            viewModel = MediaViewModel(media, permissions)
            runCurrent()
        }

        @Test
        fun busyWhileTheCameraIsOpenThenShowsThePhotoAndItsInfo() = runTest {
            start()
            viewModel.takePhoto()
            runCurrent()
            assertTrue(viewModel.uiState.value.busy)
            assertFalse(viewModel.uiState.value.canTakePhoto)

            media.give(photo)
            runCurrent()

            val state = viewModel.uiState.value
            assertFalse(state.busy)
            assertEquals(photo, state.photo)
            assertEquals("From the camera · 3024 × 4032 px · image/jpeg · 2.4 MB", state.details)
        }

        @Test
        fun aClosedPickerKeepsTheLastPhoto() = runTest {
            start()
            viewModel.takePhoto()
            runCurrent()
            media.give(photo)
            runCurrent()

            viewModel.choosePhoto()
            runCurrent()
            media.close()
            runCurrent()

            assertEquals(photo, viewModel.uiState.value.photo)
            assertNull(viewModel.uiState.value.errorMessage)
        }

        @Test
        fun aFailureIsShownAndTheNextTripClearsIt() = runTest {
            start()
            viewModel.takePhoto()
            runCurrent()
            media.fail("This device has no camera.")
            runCurrent()
            assertEquals("This device has no camera.", viewModel.uiState.value.errorMessage)
            assertFalse(viewModel.uiState.value.busy)

            viewModel.choosePhoto()
            runCurrent()

            assertNull(viewModel.uiState.value.errorMessage)
        }

        @Test
        fun oneTripAtATime() = runTest {
            start()
            viewModel.takePhoto()
            runCurrent()

            viewModel.choosePhoto()
            viewModel.takePhoto()
            runCurrent()

            assertEquals(1, media.trips)
        }

        @Test
        fun takingAPhotoWaitsForTheCameraPermission() = runTest {
            start(camera = PermissionStatus.NotRequested)
            assertFalse(viewModel.uiState.value.canTakePhoto)

            permissions.answer = PermissionStatus.Granted
            viewModel.requestPermission()
            runCurrent()

            assertEquals(PermissionStatus.Granted, viewModel.uiState.value.camera)
            assertTrue(viewModel.uiState.value.canTakePhoto)
        }

        @Test
        fun sizesUnderOneMegabyteAreInKilobytes() = runTest {
            start()
            viewModel.choosePhoto()
            runCurrent()
            media.give(photo.copy(source = MediaSource.Library, type = "image/png", width = 640, height = 480, sizeBytes = 123_456))
            runCurrent()

            assertEquals("From the library · 640 × 480 px · image/png · 121 KB", viewModel.uiState.value.details)
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceDetailViewModel
    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.inbound.MediaViewModel
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
    import com.example.devicemonitor.doubles.FakeMediaPicker
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
                    log, timer, FakeMonitorSettings(), FakeMediaPicker(),
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
            assertNotNull(koin.get<MediaViewModel>())
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
    | Camera: request permission | Main screen → Photo. Allow camera, then Don't allow. Android: Ask again, then While using the app. iPhone: Open Settings, allow Camera, come back | Android: "Camera permission was denied…" and Ask again, then "Camera permission: allowed". iPhone: "Camera permission is off…" and Open Settings (iOS never asks twice), then "Camera permission: allowed" | emulator; Simulator up to Open Settings; iPhone: phone, not yet run |
    | Camera: capture | Take photo, take a picture, accept it | The photo, upright, and "From the camera · W × H px · image/jpeg · N KB" | emulator (its camera app films a virtual scene); iPhone: phone, not yet run (the Simulator's camera screen opens, but its shutter gave no photo) |
    | Camera: select | Choose from library, pick a photo | The photo, upright, and "From the library · W × H px · its type · N KB" | emulator, Simulator; phone, not yet run |
    | Camera: close without a photo | Open the camera or the picker, then close it | The last photo stays, with no error | emulator, Simulator; phone, not yet run |
    | API | Extension E1 only | | not in the core app |
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

??? example "androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.app.Application
    import com.example.devicemonitor.adapter.inbound.onAppLaunch
    import com.example.devicemonitor.adapter.outbound.AndroidBatteryProvider
    import com.example.devicemonitor.adapter.outbound.AndroidBleConnection
    import com.example.devicemonitor.adapter.outbound.AndroidBleScanner
    import com.example.devicemonitor.adapter.outbound.AndroidBluetoothProvider
    import com.example.devicemonitor.adapter.outbound.AndroidLogStore
    import com.example.devicemonitor.adapter.outbound.AndroidMediaPicker
    import com.example.devicemonitor.adapter.outbound.AndroidMonitorScheduler
    import com.example.devicemonitor.adapter.outbound.AndroidMonitorSettings
    import com.example.devicemonitor.adapter.outbound.AndroidNetworkProvider
    import com.example.devicemonitor.adapter.outbound.AndroidPermissionChecker
    import com.example.devicemonitor.di.initKoin
    import java.io.File

    // Runs once per process, before any Activity, and before any background work WorkManager runs
    // in it: the place to start Koin and to put the monitor back as the user left it.
    class DeviceMonitorApplication : Application() {
        // The Android permission adapter, one for the process. Koin hands it to the app core as
        // its PermissionChecker, and an Activity or a Fragment lends it a result launcher.
        lateinit var permissionChecker: AndroidPermissionChecker
            private set

        // The camera and photo picker adapter (Extension E2), one for the process, lent launchers
        // the same way.
        lateinit var mediaPicker: AndroidMediaPicker
            private set

        override fun onCreate() {
            super.onCreate()
            permissionChecker = AndroidPermissionChecker(this)
            mediaPicker = AndroidMediaPicker(this)
            initKoin(
                permissionChecker = permissionChecker,
                bleScanner = AndroidBleScanner(this),
                bleConnection = AndroidBleConnection(this),
                batteryProvider = AndroidBatteryProvider(this),
                networkProvider = AndroidNetworkProvider(this),
                bluetoothProvider = AndroidBluetoothProvider(this),
                logStore = AndroidLogStore(File(filesDir, "status-log.jsonl")),
                monitorScheduler = AndroidMonitorScheduler(this),
                monitorSettings = AndroidMonitorSettings(this),
                mediaPicker = mediaPicker,
            )
            onAppLaunch()
        }
    }
    ```

??? example "androidApp/src/main/java/com/example/devicemonitor/android/MediaFileProvider.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import androidx.core.content.FileProvider

    // The app's own FileProvider, named in the manifest. AndroidX's FileProvider reference says to
    // extend it, and that using FileProvider directly "is not reliable" and crashes on some devices.
    // It needs nothing more: media_paths.xml says which folder it shares.
    class MediaFileProvider : FileProvider()
    ```

??? example "androidApp/src/main/java/com/example/devicemonitor/android/PhotoBitmap.kt · both Android tracks"
    ```kotlin
    package com.example.devicemonitor.android

    import android.graphics.Bitmap
    import android.graphics.BitmapFactory
    import android.graphics.Matrix
    import androidx.exifinterface.media.ExifInterface

    // Decodes a photo for the screen, off the main thread. Two things a plain decode gets wrong:
    // size (a 12-megapixel photo is 48 MB as a bitmap, so it's decoded at a power-of-two fraction
    // that keeps its longer side at least maxSide pixels) and the way up (a camera often stores a
    // portrait photo as landscape pixels plus an EXIF orientation tag, which BitmapFactory ignores).
    fun loadPhoto(path: String, maxSide: Int = 1024): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val bitmap = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        val degrees = ExifInterface(path).rotationDegrees
        if (degrees == 0) return bitmap
        val turn = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, turn, true)
    }
    ```

??? example "androidApp/src/main/res/xml/media_paths.xml · both Android tracks"
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <!-- What the FileProvider may share: only the media/ folder in the app's cache, where
         AndroidMediaPicker keeps its photos. The camera app writes there through a content URI. -->
    <paths>
        <cache-path name="media" path="media/" />
    </paths>
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
            implementation("androidx.activity:activity-compose:1.13.0")
            implementation("androidx.compose.material3:material3")
            implementation("androidx.navigation:navigation-compose:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
            implementation("io.insert-koin:koin-compose-viewmodel:4.2.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.12.0")
            implementation("androidx.exifinterface:exifinterface:1.4.2")
        }
        ```

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
            <!-- Photos (Extension E2): the camera permission. CAMERA implies these two features for
                 Google Play's filtering; the app works without them, and checks at run time. -->
            <uses-permission android:name="android.permission.CAMERA" />
            <uses-feature android:name="android.hardware.camera" android:required="false" />
            <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

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
                <!-- Shares the photos' folder with the camera app, as content URIs (Extension E2). -->
                <provider
                    android:name=".MediaFileProvider"
                    android:authorities="${applicationId}.files"
                    android:exported="false"
                    android:grantUriPermissions="true">
                    <meta-data
                        android:name="android.support.FILE_PROVIDER_PATHS"
                        android:resource="@xml/media_paths" />
                </provider>
            </application>
        </manifest>
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.os.Bundle
        import androidx.activity.ComponentActivity
        import androidx.activity.compose.setContent
        import androidx.activity.enableEdgeToEdge
        import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
        import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
        import androidx.activity.result.contract.ActivityResultContracts.TakePicture
        import androidx.compose.material3.MaterialTheme

        class MainActivity : ComponentActivity() {
            // Android lets only an Activity or a Fragment register for a result, and only while it is
            // being created, so the Activity registers here and lends the launcher to the adapter.
            // It decides nothing: the adapter reads the answer.
            private val permissionChecker by lazy {
                (application as DeviceMonitorApplication).permissionChecker
            }
            private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
                permissionChecker.onResult(this)
            }

            // The same for photos (Extension E2): the system camera app and the system photo picker.
            private val mediaPicker by lazy {
                (application as DeviceMonitorApplication).mediaPicker
            }
            private val cameraLauncher = registerForActivityResult(TakePicture()) { saved ->
                mediaPicker.onPhotoTaken(saved)
            }
            private val libraryLauncher = registerForActivityResult(PickVisualMedia()) { uri ->
                mediaPicker.onImageChosen(uri)
            }

            override fun onCreate(savedInstanceState: Bundle?) {
                enableEdgeToEdge()
                super.onCreate(savedInstanceState)
                // Before setContent: the list screen's ViewModel reads the permission as soon as the
                // screen is composed, and the adapter needs this Activity to read it right.
                permissionChecker.attach(this, permissionLauncher)
                mediaPicker.attach(cameraLauncher, libraryLauncher)
                setContent {
                    MaterialTheme {
                        DeviceMonitorApp()
                    }
                }
            }

            override fun onDestroy() {
                permissionChecker.detach(permissionLauncher)
                mediaPicker.detach(cameraLauncher)
                super.onDestroy()
            }
        }
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

        // The selected device travels in the route: the detail screen needs all of it to connect.
        @Serializable
        data class DeviceDetail(val id: String, val name: String, val rssi: Int)

        // The photo screen (Extension E2): nothing to carry.
        @Serializable
        data object Photo

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
                            onPhoto = { navController.navigate(Photo) },
                        )
                    }
                    composable<DeviceDetail> { entry ->
                        val route: DeviceDetail = entry.toRoute()
                        DeviceDetailScreen(
                            device = Device(id = route.id, name = route.name, rssi = route.rssi),
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable<Photo> {
                        PhotoScreen(onBack = { navController.popBackStack() })
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
            onPhoto: () -> Unit,
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
                onPhoto = onPhoto,
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
            onPhoto: () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Device Monitor", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                    // The photo screen (Extension E2), one tap from the main screen.
                    TextButton(onClick = dropUnlessResumed { onPhoto() }) { Text("Photo") }
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/PhotoScreen.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Bitmap
        import androidx.compose.foundation.Image
        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.Row
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.fillMaxWidth
        import androidx.compose.foundation.layout.heightIn
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.size
        import androidx.compose.foundation.rememberScrollState
        import androidx.compose.foundation.verticalScroll
        import androidx.compose.material3.Button
        import androidx.compose.material3.CircularProgressIndicator
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.OutlinedButton
        import androidx.compose.material3.Text
        import androidx.compose.material3.TextButton
        import androidx.compose.runtime.Composable
        import androidx.compose.runtime.getValue
        import androidx.compose.runtime.produceState
        import androidx.compose.ui.Alignment
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.graphics.asImageBitmap
        import androidx.compose.ui.layout.ContentScale
        import androidx.compose.ui.unit.dp
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.compose.LifecycleEventEffect
        import androidx.lifecycle.compose.collectAsStateWithLifecycle
        import androidx.lifecycle.compose.dropUnlessResumed
        import com.example.devicemonitor.adapter.inbound.MediaUiState
        import com.example.devicemonitor.adapter.inbound.MediaViewModel
        import com.example.devicemonitor.core.PermissionStatus
        import kotlinx.coroutines.Dispatchers
        import kotlinx.coroutines.withContext
        import org.koin.compose.viewmodel.koinViewModel

        // Stateful: connects the shared ViewModel to the content below. The camera and the picker are
        // the system's own screens, opened by the adapter through the launchers MainActivity lends it.
        @Composable
        fun PhotoScreen(
            onBack: () -> Unit,
            viewModel: MediaViewModel = koinViewModel(),
        ) {
            val state by viewModel.uiState.collectAsStateWithLifecycle()

            // Back from Settings (or anywhere else): the camera permission may have changed.
            LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
                viewModel.refreshPermission()
            }

            PhotoContent(
                state = state,
                onAllow = viewModel::requestPermission,
                onOpenSettings = viewModel::openSettings,
                onTakePhoto = viewModel::takePhoto,
                onChoosePhoto = viewModel::choosePhoto,
                onBack = onBack,
            )
        }

        // Stateless: renders whatever it's given, reports events up.
        @Composable
        fun PhotoContent(
            state: MediaUiState,
            onAllow: () -> Unit,
            onOpenSettings: () -> Unit,
            onTakePhoto: () -> Unit,
            onChoosePhoto: () -> Unit,
            onBack: () -> Unit,
        ) {
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Photo", style = MaterialTheme.typography.headlineSmall)
                CameraPermissionRow(status = state.camera, onAllow = onAllow, onOpenSettings = onOpenSettings)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onTakePhoto, enabled = state.canTakePhoto) { Text("Take photo") }
                    OutlinedButton(onClick = onChoosePhoto, enabled = !state.busy) { Text("Choose from library") }
                }
                if (state.busy) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Waiting for the photo…")
                    }
                }
                state.errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                state.photo?.let { photo ->
                    PhotoImage(path = photo.path)
                    Text(state.details.orEmpty(), style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = dropUnlessResumed { onBack() }) {
                    Text("Back")
                }
            }
        }

        // Decoding a photo takes a moment, so it runs off the main thread, once per path: every new
        // photo has a new path.
        @Composable
        private fun PhotoImage(path: String) {
            val bitmap by produceState<Bitmap?>(initialValue = null, path) {
                value = withContext(Dispatchers.IO) { loadPhoto(path) }
            }
            bitmap?.let {
                Image(
                    bitmap = it.asImageBitmap(),
                    contentDescription = "The photo",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                )
            }
        }

        // One message and at most one action per permission status, as for Bluetooth on the main screen.
        @Composable
        private fun CameraPermissionRow(status: PermissionStatus, onAllow: () -> Unit, onOpenSettings: () -> Unit) {
            val error = MaterialTheme.colorScheme.error
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                when (status) {
                    PermissionStatus.Granted -> Text(
                        "Camera permission: allowed",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    PermissionStatus.NotRequested -> {
                        Text("Device Monitor needs the camera permission to take photos.")
                        TextButton(onClick = onAllow) { Text("Allow camera") }
                    }
                    PermissionStatus.Denied -> {
                        Text("Camera permission was denied. Taking photos needs it.", color = error)
                        TextButton(onClick = onAllow) { Text("Ask again") }
                    }
                    PermissionStatus.PermanentlyDenied -> {
                        Text("Camera permission is off. You can turn it on in Settings.", color = error)
                        TextButton(onClick = onOpenSettings) { Text("Open Settings") }
                    }
                    PermissionStatus.Restricted ->
                        Text("The camera is restricted on this device.", color = error)
                }
            }
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
            implementation("androidx.appcompat:appcompat:1.8.0")
            implementation("androidx.fragment:fragment-ktx:1.9.1")
            implementation("androidx.constraintlayout:constraintlayout:2.2.2")
            implementation("androidx.recyclerview:recyclerview:1.4.0")
            implementation("androidx.navigation:navigation-fragment:2.10.2")
            implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.11.0")
            implementation("io.insert-koin:koin-android:4.2.2")
            implementation("androidx.exifinterface:exifinterface:1.4.2")
        }
        ```

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
            <!-- Photos (Extension E2): the camera permission. CAMERA implies these two features for
                 Google Play's filtering; the app works without them, and checks at run time. -->
            <uses-permission android:name="android.permission.CAMERA" />
            <uses-feature android:name="android.hardware.camera" android:required="false" />
            <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

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
                <!-- Shares the photos' folder with the camera app, as content URIs (Extension E2). -->
                <provider
                    android:name=".MediaFileProvider"
                    android:authorities="${applicationId}.files"
                    android:exported="false"
                    android:grantUriPermissions="true">
                    <meta-data
                        android:name="android.support.FILE_PROVIDER_PATHS"
                        android:resource="@xml/media_paths" />
                </provider>
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
                    android:id="@+id/toPhoto"
                    app:destination="@id/photo" />
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

            <!-- The photo screen (Extension E2). -->
            <fragment
                android:id="@+id/photo"
                android:name="com.example.devicemonitor.android.PhotoFragment" />
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
                app:layout_constraintEnd_toStartOf="@id/photoButton"
                app:layout_constraintTop_toTopOf="parent" />

            <!-- The photo screen (Extension E2), one tap from the main screen. -->
            <Button
                android:id="@+id/photoButton"
                style="?attr/borderlessButtonStyle"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Photo"
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
                b.photoButton.setOnClickListener {
                    val nav = findNavController()
                    // A fast double tap delivers two clicks; only navigate from the list itself.
                    if (nav.currentDestination?.id == R.id.deviceList) nav.navigate(R.id.toPhoto)
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

    ??? example "androidApp/src/main/res/layout/fragment_photo.xml"
        ```xml
        <ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
            android:layout_width="match_parent"
            android:layout_height="match_parent">

            <!-- The photo screen (Extension E2): the camera permission, the two buttons, and the newest
                 photo with its media info. -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:padding="16dp">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Photo"
                    android:textAppearance="@style/TextAppearance.AppCompat.Headline" />

                <TextView
                    android:id="@+id/permissionText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="12dp" />

                <Button
                    android:id="@+id/permissionButton"
                    style="?attr/borderlessButtonStyle"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content" />

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="8dp"
                    android:orientation="horizontal">

                    <Button
                        android:id="@+id/takePhotoButton"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="Take photo" />

                    <Button
                        android:id="@+id/choosePhotoButton"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginStart="8dp"
                        android:text="Choose from library" />
                </LinearLayout>

                <!-- Shown only while the camera or the picker is open, or a copy is being made. -->
                <LinearLayout
                    android:id="@+id/busyRow"
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
                        android:text="Waiting for the photo…" />
                </LinearLayout>

                <TextView
                    android:id="@+id/errorText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="8dp"
                    android:textColor="@android:color/holo_red_dark"
                    android:visibility="gone" />

                <ImageView
                    android:id="@+id/photoView"
                    android:layout_width="match_parent"
                    android:layout_height="360dp"
                    android:layout_marginTop="12dp"
                    android:adjustViewBounds="true"
                    android:contentDescription="The photo"
                    android:scaleType="fitCenter"
                    android:visibility="gone" />

                <TextView
                    android:id="@+id/detailsText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="8dp"
                    android:textAppearance="@style/TextAppearance.AppCompat.Small" />

                <Button
                    android:id="@+id/backButton"
                    style="?attr/borderlessButtonStyle"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="12dp"
                    android:text="Back" />
            </LinearLayout>
        </ScrollView>
        ```

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/PhotoFragment.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.graphics.Color
        import android.os.Bundle
        import android.view.LayoutInflater
        import android.view.View
        import android.view.ViewGroup
        import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
        import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
        import androidx.activity.result.contract.ActivityResultContracts.TakePicture
        import androidx.fragment.app.Fragment
        import androidx.lifecycle.Lifecycle
        import androidx.lifecycle.lifecycleScope
        import androidx.lifecycle.repeatOnLifecycle
        import androidx.navigation.fragment.findNavController
        import com.example.devicemonitor.adapter.inbound.MediaUiState
        import com.example.devicemonitor.adapter.inbound.MediaViewModel
        import com.example.devicemonitor.android.databinding.FragmentPhotoBinding
        import com.example.devicemonitor.core.PermissionStatus
        import kotlinx.coroutines.Dispatchers
        import kotlinx.coroutines.launch
        import kotlinx.coroutines.withContext
        import org.koin.androidx.viewmodel.ext.android.viewModel

        // The photo screen (Extension E2). Like the main screen, it registers its launchers while it is
        // being created and lends them to the adapters: the permission prompt, the camera app and the
        // photo picker. It decides nothing: the adapters read the answers.
        class PhotoFragment : Fragment() {
            private val viewModel: MediaViewModel by viewModel()

            private val app by lazy { requireActivity().application as DeviceMonitorApplication }
            private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
                app.permissionChecker.onResult(requireActivity())
            }
            private val cameraLauncher = registerForActivityResult(TakePicture()) { saved ->
                app.mediaPicker.onPhotoTaken(saved)
            }
            private val libraryLauncher = registerForActivityResult(PickVisualMedia()) { uri ->
                app.mediaPicker.onImageChosen(uri)
            }

            private var binding: FragmentPhotoBinding? = null
            private var shownPath: String? = null

            override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
                val b = FragmentPhotoBinding.inflate(inflater, container, false)
                binding = b
                b.takePhotoButton.setOnClickListener { viewModel.takePhoto() }
                b.choosePhotoButton.setOnClickListener { viewModel.choosePhoto() }
                b.backButton.setOnClickListener {
                    val nav = findNavController()
                    // Only pop from this screen: a fast double tap would otherwise pop the list too.
                    if (nav.currentDestination?.id == R.id.photo) nav.popBackStack()
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
                app.permissionChecker.attach(requireActivity(), permissionLauncher)
                app.mediaPicker.attach(cameraLauncher, libraryLauncher)
            }

            // Back from Settings (or anywhere else): the camera permission may have changed.
            override fun onResume() {
                super.onResume()
                viewModel.refreshPermission()
            }

            override fun onStop() {
                app.permissionChecker.detach(permissionLauncher)
                app.mediaPicker.detach(cameraLauncher)
                super.onStop()
            }

            override fun onDestroyView() {
                super.onDestroyView()
                binding = null
                shownPath = null
            }

            // The one place that touches views: every new state ends here.
            private fun render(state: MediaUiState) {
                val b = binding ?: return
                renderPermission(b, state.camera)
                b.takePhotoButton.isEnabled = state.canTakePhoto
                b.choosePhotoButton.isEnabled = !state.busy
                b.busyRow.visibility = if (state.busy) View.VISIBLE else View.GONE
                b.errorText.text = state.errorMessage
                b.errorText.visibility = if (state.errorMessage == null) View.GONE else View.VISIBLE
                b.detailsText.text = state.details
                showPhoto(b, state.photo?.path)
            }

            // Decoding a photo takes a moment, so it runs off the main thread, once per path: every new
            // photo has a new path.
            private fun showPhoto(b: FragmentPhotoBinding, path: String?) {
                if (path == shownPath) return
                shownPath = path
                if (path == null) {
                    b.photoView.visibility = View.GONE
                    return
                }
                viewLifecycleOwner.lifecycleScope.launch {
                    val bitmap = withContext(Dispatchers.IO) { loadPhoto(path) }
                    if (shownPath != path) return@launch // a newer photo arrived meanwhile
                    b.photoView.setImageBitmap(bitmap)
                    b.photoView.visibility = if (bitmap == null) View.GONE else View.VISIBLE
                }
            }

            // One message and at most one action per permission status, as for Bluetooth on the main screen.
            private fun renderPermission(b: FragmentPhotoBinding, status: PermissionStatus) {
                val (message, action) = when (status) {
                    PermissionStatus.Granted -> "Camera permission: allowed" to null
                    PermissionStatus.NotRequested ->
                        "Device Monitor needs the camera permission to take photos." to "Allow camera"
                    PermissionStatus.Denied -> "Camera permission was denied. Taking photos needs it." to "Ask again"
                    PermissionStatus.PermanentlyDenied ->
                        "Camera permission is off. You can turn it on in Settings." to "Open Settings"
                    PermissionStatus.Restricted -> "The camera is restricted on this device." to null
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
        }
        ```

**iOS**

??? example "iosApp/iosApp/IosPermissionChecker.swift · both iOS tracks"
    ```swift
    import AVFoundation
    import CoreBluetooth
    import Shared
    import UIKit

    // Outbound adapter: the app's permissions on iOS, behind the Kotlin PermissionChecker port.
    // iOS has one Bluetooth permission. Reading CBManager.authorization never prompts; the
    // prompt appears when the app first uses Bluetooth, here by creating a CBCentralManager.
    // The camera (Extension E2) has an API of its own: AVCaptureDevice reads and requests it.
    @MainActor
    final class IosPermissionChecker: NSObject, @preconcurrency PermissionChecker,
        @preconcurrency CBCentralManagerDelegate {
        private var manager: CBCentralManager?
        private var waiting: [CheckedContinuation<Void, Never>] = []

        func check(permission: Permission) -> PermissionStatus {
            switch permission {
            case .bluetooth: Self.bluetoothStatus()
            case .camera: Self.cameraStatus()
            }
        }

        // The Kotlin suspend fun. SKIE keeps the name `request` for the async function Swift
        // calls, so the one Swift implements is `__request`.
        func __request(permissions: [Permission]) async throws -> [Permission: PermissionStatus] {
            var result: [Permission: PermissionStatus] = [:]
            for permission in permissions {
                switch permission {
                case .bluetooth: await requestBluetooth()
                case .camera: await requestCamera()
                }
                result[permission] = check(permission: permission)
            }
            return result
        }

        func openSettings() {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
            UIApplication.shared.open(url)
        }

        private func requestBluetooth() async {
            guard CBManager.authorization == .notDetermined else { return }
            await withCheckedContinuation { continuation in
                waiting.append(continuation)
                if manager == nil {
                    manager = CBCentralManager(
                        delegate: self, queue: nil,
                        options: [CBCentralManagerOptionShowPowerAlertKey: false]
                    )
                }
            }
        }

        // Shows the camera prompt the first time; after that it returns the user's answer at once.
        private func requestCamera() async {
            guard AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined else { return }
            _ = await AVCaptureDevice.requestAccess(for: .video)
        }

        // Called on the main queue (queue: nil) whenever the manager's state changes, including
        // once the user has answered the prompt.
        func centralManagerDidUpdateState(_ central: CBCentralManager) {
            guard CBManager.authorization != .notDetermined else { return }
            manager = nil
            let answered = waiting
            waiting = []
            answered.forEach { $0.resume() }
        }

        private static func bluetoothStatus() -> PermissionStatus {
            switch CBManager.authorization {
            case .notDetermined: .notRequested
            case .restricted: .restricted
            case .denied: .permanentlyDenied // iOS never shows the prompt again
            case .allowedAlways: .granted
            @unknown default: .restricted
            }
        }

        private static func cameraStatus() -> PermissionStatus {
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .notDetermined: .notRequested
            case .restricted: .restricted
            case .denied: .permanentlyDenied // as for Bluetooth: no second prompt
            case .authorized: .granted
            @unknown default: .restricted
            }
        }
    }
    ```

??? example "iosApp/iosApp/IosMediaPicker.swift · both iOS tracks"
    ```swift
    import ImageIO
    import Shared
    import UIKit
    import UniformTypeIdentifiers

    // What a screen lends the adapter: the power to show the system camera and photo picker. Only a
    // view or a view controller can present them, so the photo screen is the presenter, as an Android
    // Activity or Fragment lends its launchers. It hands back what the system gave it.
    @MainActor
    protocol MediaPresenter: AnyObject {
        // Shows the camera. The photo, or nil if the user closed the camera.
        func takePhoto() async -> UIImage?
        // Shows the photo picker, images only. The chosen image's bytes, or nil if the user
        // closed the picker; throws if the image couldn't be loaded.
        func chooseImage() async throws -> Data?
    }

    // Outbound adapter: the system camera and photo picker behind the Kotlin MediaPicker port. The
    // photo screen sets `presenter` while it's on screen. Every photo becomes a file in the app's
    // Caches folder, under media/, and only the newest is kept.
    @MainActor
    final class IosMediaPicker: @preconcurrency MediaPicker {
        // One for the app: the app start hands it to Koin, and the photo screen lends it a presenter.
        static let shared = IosMediaPicker()

        weak var presenter: MediaPresenter?

        private let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("media", isDirectory: true)

        // Whether UIKit can show a camera here. False when the camera is in use, too.
        func hasCamera() -> Bool {
            UIImagePickerController.isSourceTypeAvailable(.camera)
        }

        // The Kotlin suspend funs. SKIE keeps their names for the async functions Swift calls, so
        // the ones Swift implements are `__capturePhoto` and `__pickMedia`.
        func __capturePhoto() async throws -> PickedMedia {
            guard let presenter else { return PickedMediaFailed(reason: "no screen can show the camera") }
            guard let image = await presenter.takePhoto() else { return PickedMediaCancelled.shared }
            // The camera hands over pixels, not a file: JPEG is how the copy is stored.
            guard let data = image.jpegData(compressionQuality: 0.9) else {
                return PickedMediaFailed(reason: "the photo couldn't be turned into a JPEG")
            }
            return save(data, from: .camera)
        }

        func __pickMedia() async throws -> PickedMedia {
            guard let presenter else { return PickedMediaFailed(reason: "no screen can show the photo picker") }
            do {
                guard let data = try await presenter.chooseImage() else { return PickedMediaCancelled.shared }
                return save(data, from: .library)
            } catch {
                return PickedMediaFailed(reason: error.localizedDescription)
            }
        }

        // Writes the bytes as they are, reads their type and size, then keeps only this copy.
        private func save(_ data: Data, from source: MediaSource) -> PickedMedia {
            guard let image = UIImage(data: data),
                  let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
                  let typeId = CGImageSourceGetType(imageSource) as String?,
                  let type = UTType(typeId) else {
                return PickedMediaFailed(reason: "iOS can't read this file as an image")
            }
            let file = folder.appendingPathComponent("photo-\(UUID().uuidString)")
                .appendingPathExtension(type.preferredFilenameExtension ?? "img")
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try data.write(to: file)
                let others = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
                for other in others where other.lastPathComponent != file.lastPathComponent {
                    try? FileManager.default.removeItem(at: other)
                }
            } catch {
                return PickedMediaFailed(reason: error.localizedDescription)
            }
            // UIImage's size already allows for the EXIF orientation: it's the photo the way up.
            let info = MediaInfo(
                path: file.path,
                source: source,
                type: type.preferredMIMEType ?? typeId,
                width: Int32(image.size.width * image.scale),
                height: Int32(image.size.height * image.scale),
                sizeBytes: Int64(data.count)
            )
            return PickedMediaPhoto(info: info)
        }
    }
    ```

=== "SwiftUI"

    ??? example "iosApp/project.yml · SwiftUI track"
        ```yaml
        name: iosApp
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          iosApp:
            type: application
            platform: iOS
            sources: [iosApp]
            info:
              path: iosApp/Info.plist
              properties:
                CFBundleDisplayName: Device Monitor
                UILaunchScreen: {}
                NSBluetoothAlwaysUsageDescription: Device Monitor uses Bluetooth to find and connect to nearby devices.
                # Photos (Extension E2): the camera prompt's text. The photo pickers need no entry.
                NSCameraUsageDescription: Device Monitor uses the camera to take a photo you choose to show.
                # The monitor (Lesson 18): background refresh, and the one task identifier it uses.
                UIBackgroundModes: [fetch]
                BGTaskSchedulerPermittedIdentifiers: [com.example.devicemonitor.monitor]
            settings:
              base:
                PRODUCT_BUNDLE_IDENTIFIER: com.example.devicemonitor
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
                ENABLE_USER_SCRIPT_SANDBOXING: NO
            preBuildScripts:
              - name: Compile Kotlin Framework
                basedOnDependencyAnalysis: false
                script: |
                  if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                    echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                    exit 0
                  fi
                  cd "$SRCROOT/.."
                  ./gradlew :shared:embedAndSignAppleFrameworkForXcode
        ```

    ??? example "iosApp/iosApp/Info.plist · SwiftUI track"
        ```xml
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        	<key>BGTaskSchedulerPermittedIdentifiers</key>
        	<array>
        		<string>com.example.devicemonitor.monitor</string>
        	</array>
        	<key>CFBundleDevelopmentRegion</key>
        	<string>$(DEVELOPMENT_LANGUAGE)</string>
        	<key>CFBundleDisplayName</key>
        	<string>Device Monitor</string>
        	<key>CFBundleExecutable</key>
        	<string>$(EXECUTABLE_NAME)</string>
        	<key>CFBundleIdentifier</key>
        	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
        	<key>CFBundleInfoDictionaryVersion</key>
        	<string>6.0</string>
        	<key>CFBundleName</key>
        	<string>$(PRODUCT_NAME)</string>
        	<key>CFBundlePackageType</key>
        	<string>APPL</string>
        	<key>CFBundleShortVersionString</key>
        	<string>1.0</string>
        	<key>CFBundleVersion</key>
        	<string>1</string>
        	<key>NSBluetoothAlwaysUsageDescription</key>
        	<string>Device Monitor uses Bluetooth to find and connect to nearby devices.</string>
        	<key>NSCameraUsageDescription</key>
        	<string>Device Monitor uses the camera to take a photo you choose to show.</string>
        	<key>UIBackgroundModes</key>
        	<array>
        		<string>fetch</string>
        	</array>
        	<key>UILaunchScreen</key>
        	<dict/>
        </dict>
        </plist>
        ```

    ??? example "iosApp/iosApp/iOSApp.swift"
        ```swift
        import SwiftUI
        import Shared

        @main
        struct iOSApp: App {
            // Runs once per launch, before the app finishes launching, whether the user opened it or
            // iOS launched it in the background for the monitor: the place for app-level work.
            init() {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider(),
                    logStore: IosLogStore(),
                    monitorScheduler: IosMonitorScheduler(),
                    monitorSettings: IosMonitorSettings(),
                    mediaPicker: IosMediaPicker.shared
                )
                AppLaunchKt.onAppLaunch()
            }

            var body: some Scene {
                WindowGroup {
                    ContentView()
                }
            }
        }
        ```

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
                        // The photo screen (Extension E2), one tap from the main screen.
                        .toolbar {
                            NavigationLink("Photo") { PhotoView() }
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

    ??? example "iosApp/iosApp/PhotoView.swift"
        ```swift
        import PhotosUI
        import Shared
        import SwiftUI

        // Stateful: connects the shared ViewModel to the content below, and lends IosMediaPicker a
        // presenter while the screen is shown. SwiftUI presents through state: the presenter flips a
        // Bool, and the modifiers below show the system picker or the camera.
        struct PhotoView: View {
            @Environment(\.scenePhase) private var scenePhase
            @State private var owner = ViewModelOwner()
            @State private var presenter = SwiftUIMediaPresenter()
            @State private var state: MediaUiState?

            var body: some View {
                let viewModel: MediaViewModel = owner.viewModel()
                let state = self.state ?? viewModel.uiState.value
                PhotoContent(
                    state: state,
                    onAllow: { viewModel.requestPermission() },
                    onOpenSettings: { viewModel.openSettings() },
                    onTakePhoto: { viewModel.takePhoto() },
                    onChoosePhoto: { viewModel.choosePhoto() }
                )
                .navigationTitle("Photo")
                .photosPicker(isPresented: $presenter.showingLibrary, selection: $presenter.chosen, matching: .images)
                .onChange(of: presenter.chosen) { presenter.libraryChanged() }
                .onChange(of: presenter.showingLibrary) { presenter.libraryChanged() }
                .fullScreenCover(isPresented: $presenter.showingCamera) {
                    CameraPicker { image in presenter.cameraClosed(image) }
                        .ignoresSafeArea()
                }
                .onAppear { IosMediaPicker.shared.presenter = presenter }
                .task {
                    for await newState in viewModel.uiState {
                        self.state = newState
                    }
                }
                // Back from Settings (or anywhere else): the camera permission may have changed.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { viewModel.refreshPermission() }
                }
            }
        }

        // The presenter SwiftUI needs: state the view's modifiers read, and a continuation per trip that
        // the view's callbacks resume.
        @MainActor
        @Observable
        final class SwiftUIMediaPresenter: MediaPresenter {
            var showingCamera = false
            var showingLibrary = false
            var chosen: PhotosPickerItem?
            @ObservationIgnored private var photoTaken: CheckedContinuation<UIImage?, Never>?
            @ObservationIgnored private var imageChosen: CheckedContinuation<PhotosPickerItem?, Never>?

            func takePhoto() async -> UIImage? {
                await withCheckedContinuation { continuation in
                    photoTaken = continuation
                    showingCamera = true
                }
            }

            func cameraClosed(_ image: UIImage?) {
                showingCamera = false
                photoTaken?.resume(returning: image)
                photoTaken = nil
            }

            func chooseImage() async throws -> Data? {
                chosen = nil
                let item = await withCheckedContinuation { continuation in
                    imageChosen = continuation
                    showingLibrary = true
                }
                // The picker hands over an item, not the bytes: loading them can take a moment.
                return try await item?.loadTransferable(type: Data.self)
            }

            // Called when the selection changes and when the picker closes: a selection ends the trip
            // with a photo, a picker closed without one ends it with nothing.
            func libraryChanged() {
                guard let waiting = imageChosen else { return }
                if let chosen {
                    imageChosen = nil
                    waiting.resume(returning: chosen)
                } else if !showingLibrary {
                    imageChosen = nil
                    waiting.resume(returning: nil)
                }
            }
        }

        // The camera, which SwiftUI has no view for: UIKit's UIImagePickerController, wrapped.
        struct CameraPicker: UIViewControllerRepresentable {
            let onFinish: (UIImage?) -> Void

            func makeUIViewController(context: Context) -> UIImagePickerController {
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                picker.delegate = context.coordinator
                return picker
            }

            func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}

            func makeCoordinator() -> Coordinator {
                Coordinator(onFinish: onFinish)
            }

            // The delegate UIKit calls: it passes the photo, or nil, to onFinish.
            final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
                let onFinish: (UIImage?) -> Void

                init(onFinish: @escaping (UIImage?) -> Void) {
                    self.onFinish = onFinish
                }

                func imagePickerController(_ picker: UIImagePickerController,
                                           didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
                    onFinish(info[.originalImage] as? UIImage)
                }

                func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
                    onFinish(nil)
                }
            }
        }

        // Stateless: renders whatever it's given, reports events up.
        struct PhotoContent: View {
            let state: MediaUiState
            let onAllow: () -> Void
            let onOpenSettings: () -> Void
            let onTakePhoto: () -> Void
            let onChoosePhoto: () -> Void

            var body: some View {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        CameraPermissionRow(status: state.camera, onAllow: onAllow, onOpenSettings: onOpenSettings)
                        HStack {
                            Button("Take photo", action: onTakePhoto)
                                .buttonStyle(.borderedProminent)
                                .disabled(!state.canTakePhoto)
                            Button("Choose from library", action: onChoosePhoto)
                                .buttonStyle(.bordered)
                                .disabled(state.busy)
                        }
                        if state.busy {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Waiting for the photo…")
                            }
                        }
                        if let message = state.errorMessage {
                            Text(message)
                                .foregroundStyle(.red)
                        }
                        if let photo = state.photo {
                            PhotoImage(path: photo.path)
                            Text(state.details ?? "")
                                .font(.footnote)
                        }
                    }
                    .padding()
                }
            }
        }

        // Loads the file once per path: every new photo has a new path. The spinner is there until
        // then; it also gives .task a view to run on, which an empty Group isn't.
        private struct PhotoImage: View {
            let path: String
            @State private var image: UIImage?

            var body: some View {
                Group {
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, maxHeight: 360)
                            .accessibilityLabel("The photo")
                    } else {
                        ProgressView()
                    }
                }
                .task(id: path) {
                    image = UIImage(contentsOfFile: path)
                }
            }
        }

        // One message and at most one action per permission status, as for Bluetooth on the main screen.
        private struct CameraPermissionRow: View {
            let status: PermissionStatus
            let onAllow: () -> Void
            let onOpenSettings: () -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 6) {
                    switch status {
                    case .granted:
                        Text("Camera permission: allowed")
                            .foregroundStyle(.secondary)
                    case .notRequested:
                        Text("Device Monitor needs the camera permission to take photos.")
                        Button("Allow camera", action: onAllow)
                    case .denied:
                        Text("Camera permission was denied. Taking photos needs it.")
                            .foregroundStyle(.red)
                        Button("Ask again", action: onAllow)
                    case .permanentlyDenied:
                        Text("Camera permission is off. You can turn it on in Settings.")
                            .foregroundStyle(.red)
                        Button("Open Settings", action: onOpenSettings)
                    case .restricted:
                        Text("The camera is restricted on this device.")
                            .foregroundStyle(.red)
                    }
                }
            }
        }
        ```

=== "UIKit"

    ??? example "iosApp/project.yml · UIKit track"
        ```yaml
        name: iosApp
        options:
          bundleIdPrefix: com.example
          deploymentTarget:
            iOS: "17.0"
        targets:
          iosApp:
            type: application
            platform: iOS
            sources: [iosApp]
            info:
              path: iosApp/Info.plist
              properties:
                CFBundleDisplayName: "Device Monitor"
                UILaunchScreen: {}
                NSBluetoothAlwaysUsageDescription: "Device Monitor uses Bluetooth to find and connect to nearby devices."
                # Photos (Extension E2): the camera prompt's text. The photo pickers need no entry.
                NSCameraUsageDescription: "Device Monitor uses the camera to take a photo you choose to show."
                # The monitor (Lesson 18): background refresh, and the one task identifier it uses.
                UIBackgroundModes: [fetch]
                BGTaskSchedulerPermittedIdentifiers: [com.example.devicemonitor.monitor]
                UIApplicationSceneManifest:
                  UIApplicationSupportsMultipleScenes: false
                  UISceneConfigurations:
                    UIWindowSceneSessionRoleApplication:
                      - UISceneConfigurationName: "Default Configuration"
                        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate"
            settings:
              base:
                PRODUCT_BUNDLE_IDENTIFIER: com.example.devicemonitor
                SWIFT_VERSION: "6.0"
                MARKETING_VERSION: "1.0"
                CURRENT_PROJECT_VERSION: "1"
                ENABLE_USER_SCRIPT_SANDBOXING: NO
            preBuildScripts:
              - name: "Compile Kotlin Framework"
                basedOnDependencyAnalysis: false
                script: |
                  if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                    echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                    exit 0
                  fi
                  cd "$SRCROOT/.."
                  ./gradlew :shared:embedAndSignAppleFrameworkForXcode
        ```

    ??? example "iosApp/iosApp/Info.plist · UIKit track"
        ```xml
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        	<key>BGTaskSchedulerPermittedIdentifiers</key>
        	<array>
        		<string>com.example.devicemonitor.monitor</string>
        	</array>
        	<key>CFBundleDevelopmentRegion</key>
        	<string>$(DEVELOPMENT_LANGUAGE)</string>
        	<key>CFBundleDisplayName</key>
        	<string>Device Monitor</string>
        	<key>CFBundleExecutable</key>
        	<string>$(EXECUTABLE_NAME)</string>
        	<key>CFBundleIdentifier</key>
        	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
        	<key>CFBundleInfoDictionaryVersion</key>
        	<string>6.0</string>
        	<key>CFBundleName</key>
        	<string>$(PRODUCT_NAME)</string>
        	<key>CFBundlePackageType</key>
        	<string>APPL</string>
        	<key>CFBundleShortVersionString</key>
        	<string>1.0</string>
        	<key>CFBundleVersion</key>
        	<string>1</string>
        	<key>NSBluetoothAlwaysUsageDescription</key>
        	<string>Device Monitor uses Bluetooth to find and connect to nearby devices.</string>
        	<key>NSCameraUsageDescription</key>
        	<string>Device Monitor uses the camera to take a photo you choose to show.</string>
        	<key>UIApplicationSceneManifest</key>
        	<dict>
        		<key>UIApplicationSupportsMultipleScenes</key>
        		<false/>
        		<key>UISceneConfigurations</key>
        		<dict>
        			<key>UIWindowSceneSessionRoleApplication</key>
        			<array>
        				<dict>
        					<key>UISceneConfigurationName</key>
        					<string>Default Configuration</string>
        					<key>UISceneDelegateClassName</key>
        					<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
        				</dict>
        			</array>
        		</dict>
        	</dict>
        	<key>UIBackgroundModes</key>
        	<array>
        		<string>fetch</string>
        	</array>
        	<key>UILaunchScreen</key>
        	<dict/>
        </dict>
        </plist>
        ```

    ??? example "iosApp/iosApp/AppDelegate.swift"
        ```swift
        import UIKit
        import Shared

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            // Runs once per launch, whether the user opened the app or iOS launched it in the background
            // for the monitor, and the launch isn't finished until it returns: the place for app-level
            // work, and the last moment to register a background task.
            func application(_ application: UIApplication,
                             didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
                AppModuleKt.doInitKoin(
                    permissionChecker: IosPermissionChecker(),
                    bleScanner: IosBleScanner(),
                    bleConnection: LinkedBleConnection(link: IosBleConnection()),
                    batteryProvider: IosBatteryProvider(),
                    networkProvider: IosNetworkProvider(),
                    bluetoothProvider: IosBluetoothProvider(),
                    logStore: IosLogStore(),
                    monitorScheduler: IosMonitorScheduler(),
                    monitorSettings: IosMonitorSettings(),
                    mediaPicker: IosMediaPicker.shared
                )
                AppLaunchKt.onAppLaunch()
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
                // The photo screen (Extension E2), one tap from the main screen.
                navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Photo", primaryAction: UIAction { [weak self] _ in
                    self?.navigationController?.pushViewController(PhotoViewController(), animated: true)
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

    ??? example "iosApp/iosApp/PhotoViewController.swift"
        ```swift
        import PhotosUI
        import Shared
        import UIKit
        import UniformTypeIdentifiers

        // The photo screen (Extension E2). It is also IosMediaPicker's presenter while it is on screen:
        // UIKit presents the system camera and photo picker from a view controller, and each answers
        // through its delegate.
        final class PhotoViewController: UIViewController, MediaPresenter,
            UIImagePickerControllerDelegate, UINavigationControllerDelegate, PHPickerViewControllerDelegate {
            private let owner = ViewModelOwner()
            private lazy var viewModel: MediaViewModel = owner.viewModel()
            private var observation: Task<Void, Never>?
            private var photoTaken: CheckedContinuation<UIImage?, Never>?
            private var imageChosen: CheckedContinuation<Data?, Error>?
            private var shownPath: String?

            private let permissionLabel = UILabel()
            private let permissionButton = UIButton(configuration: .plain())
            private let takePhotoButton = UIButton(configuration: .filled())
            private let choosePhotoButton = UIButton(configuration: .bordered())
            private let busyRow = UIStackView()
            private let errorLabel = UILabel()
            private let photoView = UIImageView()
            private let detailsLabel = UILabel()

            override func viewDidLoad() {
                super.viewDidLoad()
                title = "Photo"
                navigationItem.largeTitleDisplayMode = .never
                view.backgroundColor = .systemBackground

                permissionLabel.numberOfLines = 0
                permissionButton.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    if viewModel.uiState.value.camera == .permanentlyDenied {
                        viewModel.openSettings()
                    } else {
                        viewModel.requestPermission()
                    }
                }, for: .touchUpInside)
                takePhotoButton.configuration?.title = "Take photo"
                takePhotoButton.addAction(UIAction { [weak self] _ in self?.viewModel.takePhoto() }, for: .touchUpInside)
                choosePhotoButton.configuration?.title = "Choose from library"
                choosePhotoButton.addAction(UIAction { [weak self] _ in self?.viewModel.choosePhoto() }, for: .touchUpInside)
                let buttons = UIStackView(arrangedSubviews: [takePhotoButton, choosePhotoButton])
                buttons.spacing = 8

                let spinner = UIActivityIndicatorView(style: .medium)
                spinner.startAnimating()
                let busyLabel = UILabel()
                busyLabel.text = "Waiting for the photo…"
                busyRow.addArrangedSubview(spinner)
                busyRow.addArrangedSubview(busyLabel)
                busyRow.spacing = 8
                errorLabel.numberOfLines = 0
                errorLabel.textColor = .systemRed
                photoView.contentMode = .scaleAspectFit
                photoView.accessibilityLabel = "The photo"
                photoView.isAccessibilityElement = true
                detailsLabel.numberOfLines = 0
                detailsLabel.font = .preferredFont(forTextStyle: .footnote)

                let stack = UIStackView(arrangedSubviews: [
                    permissionLabel, permissionButton, buttons, busyRow, errorLabel, photoView, detailsLabel,
                ])
                stack.axis = .vertical
                stack.alignment = .leading
                stack.spacing = 12
                stack.translatesAutoresizingMaskIntoConstraints = false
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
                    photoView.widthAnchor.constraint(equalTo: stack.widthAnchor),
                    photoView.heightAnchor.constraint(equalToConstant: 360),
                    detailsLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
                ])
                render(viewModel.uiState.value)
                // Back from Settings (or anywhere else): the camera permission may have changed.
                NotificationCenter.default.addObserver(
                    self, selector: #selector(sceneDidActivate),
                    name: UIScene.didActivateNotification, object: nil
                )
            }

            @objc private func sceneDidActivate() {
                viewModel.refreshPermission()
            }

            // Collect only while on screen, like repeatOnLifecycle(STARTED) on Android. On screen, this
            // controller is the one that presents the camera and the picker.
            override func viewWillAppear(_ animated: Bool) {
                super.viewWillAppear(animated)
                IosMediaPicker.shared.presenter = self
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

            // MediaPresenter: show the camera, and wait for its delegate.
            func takePhoto() async -> UIImage? {
                await withCheckedContinuation { continuation in
                    photoTaken = continuation
                    let picker = UIImagePickerController()
                    picker.sourceType = .camera
                    picker.delegate = self
                    present(picker, animated: true)
                }
            }

            func imagePickerController(_ picker: UIImagePickerController,
                                       didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
                picker.dismiss(animated: true)
                photoTaken?.resume(returning: info[.originalImage] as? UIImage)
                photoTaken = nil
            }

            func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
                picker.dismiss(animated: true)
                photoTaken?.resume(returning: nil)
                photoTaken = nil
            }

            // MediaPresenter: show the photo picker, and wait for its delegate to load the bytes.
            func chooseImage() async throws -> Data? {
                try await withCheckedThrowingContinuation { continuation in
                    imageChosen = continuation
                    var configuration = PHPickerConfiguration()
                    configuration.filter = .images
                    configuration.selectionLimit = 1
                    let picker = PHPickerViewController(configuration: configuration)
                    picker.delegate = self
                    present(picker, animated: true)
                }
            }

            // Called for a pick and for Cancel alike: Cancel gives no results. The picker hands over an
            // item provider, not the bytes, and loading them can take a moment.
            func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
                picker.dismiss(animated: true)
                guard let continuation = imageChosen else { return }
                imageChosen = nil
                guard let provider = results.first?.itemProvider else { return continuation.resume(returning: nil) }
                provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, error in
                    if let data {
                        continuation.resume(returning: data)
                    } else {
                        continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
                    }
                }
            }

            // The one place that touches views: every new state ends here.
            private func render(_ state: MediaUiState) {
                renderPermission(state.camera)
                takePhotoButton.isEnabled = state.canTakePhoto
                choosePhotoButton.isEnabled = !state.busy
                busyRow.isHidden = !state.busy
                errorLabel.text = state.errorMessage
                errorLabel.isHidden = state.errorMessage == nil
                detailsLabel.text = state.details
                // Loads the file once per path: every new photo has a new path.
                if state.photo?.path != shownPath {
                    shownPath = state.photo?.path
                    photoView.image = shownPath.flatMap { UIImage(contentsOfFile: $0) }
                }
                photoView.isHidden = photoView.image == nil
            }

            // One message and at most one action per permission status, as for Bluetooth on the main screen.
            private func renderPermission(_ status: PermissionStatus) {
                let (message, action): (String, String?) = switch status {
                case .granted: ("Camera permission: allowed", nil)
                case .notRequested: ("Device Monitor needs the camera permission to take photos.", "Allow camera")
                case .denied: ("Camera permission was denied. Taking photos needs it.", "Ask again")
                case .permanentlyDenied: ("Camera permission is off. You can turn it on in Settings.", "Open Settings")
                case .restricted: ("The camera is restricted on this device.", nil)
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
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A3 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0). Nó chạy **đúng code** `MediaCaptureService.kt` và các model của E2 (chỉ gom về một package), cùng nguyên văn hai hàm `describe` và `size` của `MediaViewModel`; picker và checker là fake viết tay, không có camera thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-chuyen-i-toi-he-thong-nhu-nho-le-tan-goi-taxi): chuyến đi tới hệ thống, như nhờ lễ tân gọi taxi (mục 1, 3).
    3. [A3](#a3-quy-tac-cua-service-chay-that-bang-code-cua-bai): quy tắc của service, chạy thật bằng code của bài (mục 2, 6).
    4. [A4](#a4-android-va-ios-canh-nhau): Android và iOS cạnh nhau: camera, bộ chọn, quyền, file (mục 4, 5).
    5. [A5](#a5-exif-orientation-anh-nam-nghieng): EXIF orientation: vì sao ảnh nằm nghiêng (mục 8).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Phần mở rộng thêm **màn hình ảnh**: chụp bằng camera hoặc chọn từ thư viện, rồi hiện ảnh cùng thông tin media.
    2. App không tự vẽ camera: nó **nhờ hệ thống** mở camera / bộ chọn ảnh, chờ, và nhận về một trong ba kết cục: `Photo`, `Cancelled`, `Failed`.
    3. Chỉ **một màn hình** mở được màn hình hệ thống, nên màn hình **cho adapter mượn** launcher (Android) hay chính nó làm presenter (iOS), rồi chuyển câu trả lời cho adapter.
    4. `MediaCaptureService` giữ quy tắc: camera chỉ mở khi máy có camera **và** quyền camera đã cấp; thư viện **không cần quyền nào** trên cả hai nền tảng.
    5. Adapter **chép ảnh vào cache của app** và đo loại, kích thước pixel (đúng chiều hiển thị), kích thước file một lần; ảnh có tag EXIF orientation phải được xoay trên Android.

Ví dụ đời thường cho cả bài: bạn ở khách sạn muốn gọi taxi. Bạn (app) không tự lái xe; bạn **nhờ lễ tân** (hệ thống) gọi. Nhưng chỉ khách đang đứng ở quầy (một màn hình) mới nhờ được, nên khách đứng đó, đưa phiếu cho lễ tân (cho mượn launcher), chờ, và chuyển lại tin cho trợ lý của mình (adapter). Kết quả: có xe (`Photo`), đổi ý không đi nữa (`Cancelled`, không phải lỗi), hoặc hết xe (`Failed`, kèm lý do).

| Chữ trong bài | Nói đơn giản | Trong e2 là |
|---|---|---|
| `MediaCapture` / `MediaPicker` | inbound / outbound port cho ảnh | `capturePhoto()`, `pickMedia()` |
| `PickedMedia` | ba kết cục của một chuyến đi | `Photo`, `Cancelled`, `Failed` |
| cho mượn launcher | màn hình đăng ký, adapter dùng | `attach` / `detach` (Android), `presenter` (iOS) |
| `TakePicture` | nhờ app camera ghi ảnh vào URI của bạn | cần `FileProvider` |
| `FileProvider` | biến một file riêng thành `content://` cho app khác ghi | thư mục `media/` trong cache |
| `PickVisualMedia` / `PhotosPicker` / `PHPickerViewController` | bộ chọn ảnh của hệ thống | không cần quyền thư viện |
| `UIImagePickerController` | camera hệ thống trên iOS | SwiftUI bọc bằng `UIViewControllerRepresentable` |
| EXIF orientation | tag nói phải xoay pixel ra sao khi hiện | orientation 6 = xoay 90° |
| `inSampleSize` | giải mã bỏ bớt pixel để tiết kiệm bộ nhớ | ảnh 12 MP → vài trăm pixel |

### A2. Chuyến đi tới hệ thống, như nhờ lễ tân gọi taxi

Giải thích thêm cho [mục 1](#1-hai-chuyen-i-toi-he-thong-mot-port) và [mục 3](#3-chi-mot-man-hinh-moi-mo-uoc-man-hinh-cua-he-thong).

| Bước | Ai làm | Android | iOS |
|---|---|---|---|
| 0. cho mượn đường | màn hình | `attach(camera, library)` khi Activity / Fragment được tạo | `IosMediaPicker.shared.presenter = …` (SwiftUI: một presenter riêng; UIKit: `self`) |
| 1. quyết định mở | service | `capturePhoto()` sau khi kiểm quyền | như vậy |
| 2. mở và chờ | adapter | `launcher.launch(uri)` + `CompletableDeferred.await()` | `presenter.takePhoto()` + continuation |
| 3. hệ thống trả lời | hệ thống → màn hình | callback của launcher | delegate / binding của state |
| 4. chuyển câu trả lời | màn hình → adapter | `onPhotoTaken(saved)`, `onImageChosen(uri)` | presenter resume continuation đang chờ |
| 5. chép, đo | adapter | file trong `cacheDir/media/` | file trong Caches |
| 6. trả kết quả | adapter → service | `PickedMedia` | `PickedMedia` (object Kotlin tạo từ Swift) |

Màn hình **không quyết định gì**: nó không tự mở camera, không đọc ảnh. Nó chỉ là "người đứng ở quầy". Đó là lý do quy tắc quyền vẫn nằm trong service, và test của service không cần màn hình nào.

So với TS/JS: giống `<input type="file" accept="image/*" capture>` trên web: chỉ một cú click thật của người dùng (một màn hình) mới mở được bộ chọn; code của bạn chỉ nhận `change` event với một `File` hoặc không có gì.

### A3. Quy tắc của service, chạy thật bằng code của bài

Giải thích thêm cho [mục 2](#2-service-va-quyen-camera) và [mục 6](#6-koin-va-viewmodel). `MediaCaptureService` thật với một picker giả (đếm số lần "mở hệ thống") và một checker giả, qua mọi trạng thái quyền:

```kotlin title="le2/Main.kt (chạy code của bài, không có trong app)"
fun main() = runBlocking {
    val photo = MediaInfo("/cache/media/a.jpg", MediaSource.Camera, "image/jpeg", 1440, 1920, 63_488)
    val picker = FakePicker(hasCam = true, answer = PickedMedia.Photo(photo))
    val checker = FakeChecker(PermissionStatus.NotRequested)
    val service = MediaCaptureService(picker, checker)
    for (s in PermissionStatus.entries) {
        checker.status = s
        tryIt("capturePhoto, quyền $s") { service.capturePhoto() }
    }
    checker.status = PermissionStatus.Denied
    picker.answer = PickedMedia.Photo(photo.copy(source = MediaSource.Library, type = "image/png", width = 640, height = 480, sizeBytes = 20_480))
    tryIt("pickMedia, quyền camera Denied") { service.pickMedia() }
    picker.answer = PickedMedia.Cancelled
    tryIt("pickMedia, người dùng đóng") { service.pickMedia() }
    picker.answer = PickedMedia.Failed("No space left on device")
    tryIt("pickMedia, lỗi giữa đường") { service.pickMedia() }
    picker.hasCam = false; checker.status = PermissionStatus.Granted
    tryIt("capturePhoto, máy không có camera") { service.capturePhoto() }
    println(listOf(18_722L, 1_048_575L, 1_048_576L, 2_936_013L).joinToString("  |  ") { "$it B = ${size(it)}" })
}
```

Output thật:

```text
capturePhoto, quyền NotRequested   -> MediaException: Taking a photo needs the camera permission.   [mở hệ thống: không]
capturePhoto, quyền Denied         -> MediaException: Taking a photo needs the camera permission.   [mở hệ thống: không]
capturePhoto, quyền PermanentlyDenied -> MediaException: Taking a photo needs the camera permission.   [mở hệ thống: không]
capturePhoto, quyền Restricted     -> MediaException: Taking a photo needs the camera permission.   [mở hệ thống: không]
capturePhoto, quyền Granted        -> From the camera · 1440 × 1920 px · image/jpeg · 62 KB   [mở hệ thống: có]
pickMedia, quyền camera Denied     -> From the library · 640 × 480 px · image/png · 20 KB   [mở hệ thống: có]
pickMedia, người dùng đóng         -> null (đóng, không có ảnh)   [mở hệ thống: có]
pickMedia, lỗi giữa đường          -> MediaException: The photo couldn't be loaded: No space left on device   [mở hệ thống: có]
capturePhoto, máy không có camera  -> MediaException: This device has no camera.   [mở hệ thống: không]
18722 B = 18 KB  |  1048575 B = 1024 KB  |  1048576 B = 1.0 MB  |  2936013 B = 2.8 MB
```

1. **Bốn trạng thái chưa cấp đều không mở camera.** Service chỉ kiểm tra, không tự xin; xin là việc của màn hình qua `PermissionAccess`. Đó chính là thứ ngăn `SecurityException` ở gotcha mục 4.
2. **Thư viện mở được dù camera bị từ chối**: hai việc không dính nhau.
3. **Đóng bộ chọn là `null`**, không phải exception, nên ViewModel giữ ảnh cũ và không hiện lỗi.
4. **Lỗi giữa đường** mang lý do của nền tảng, bọc trong câu chữ của app.
5. **Kích thước**: 1 KB = 1.024 byte, làm tròn bằng số nguyên. Chỗ rìa thú vị: 1.048.575 byte (thiếu 1 byte là 1 MB) hiện "1024 KB", vì hàm chỉ chuyển sang MB từ đúng 1.048.576 byte.

### A4. Android và iOS cạnh nhau

Giải thích thêm cho [mục 4](#4-android-mot-file-cho-app-camera-mot-ban-sao-tu-bo-chon) và [mục 5](#5-ios-adapter-va-presenter-cua-no).

| | Android (`AndroidMediaPicker`, Kotlin) | iOS (`IosMediaPicker`, Swift) |
|---|---|---|
| Camera hệ thống | `TakePicture` → app camera ghi vào URI của bạn | `UIImagePickerController(.camera)` → trả `UIImage` |
| File của camera | app tạo trước, chia sẻ qua `FileProvider` | app mã hoá `UIImage` thành JPEG rồi ghi |
| Bộ chọn ảnh | `PickVisualMedia(ImageOnly)` → `Uri` đọc được tạm thời | `PhotosPicker` (SwiftUI) / `PHPickerViewController` (UIKit) → byte |
| Quyền camera | `CAMERA` runtime; từ chối lần đầu còn hỏi lại được | `NSCameraUsageDescription`; hỏi một lần, từ chối là `PermanentlyDenied` |
| Quyền thư viện | không | không |
| Đo kích thước | `BitmapFactory` + `inJustDecodeBounds`, đảo nếu EXIF 90/270 | `UIImage.size` (đã tính orientation) |
| Đóng không chụp | `TakePicture` trả `false`, adapter xoá file đã đặt tên | delegate `imagePickerControllerDidCancel` |
| Simulator / emulator | camera ảo quay một cảnh giả | màn hình camera mở nhưng không chụp được |

Bẫy chỉ có trên Android: **khai báo `CAMERA` làm thay đổi luật**. App không khai báo thì nhờ app camera chụp thoải mái; app đã khai báo mà chưa được cấp thì `ACTION_IMAGE_CAPTURE` ném `SecurityException`. Kiểm tra quyền trong service là thứ giữ app không crash.

### A5. EXIF orientation: ảnh nằm nghiêng

Giải thích thêm cho [mục 8](#8-hien-anh-ung-chieu).

Ví dụ đời thường: bạn chụp một tờ giấy theo chiều dọc, nhưng máy scan lưu nó **nằm ngang**, kèm một tờ ghi chú "xoay 90° khi xem". Người đọc ghi chú (trình xem ảnh, `UIImage`) thấy tờ giấy đứng; người bỏ qua ghi chú (`BitmapFactory.decodeFile`) thấy nó nằm nghiêng, và đo chiều rộng thành chiều cao.

| Giá trị EXIF orientation | Nghĩa | `rotationDegrees` | Chiều rộng × cao báo ra |
|---|---|---|---|
| 1 | đúng chiều | 0 | như pixel |
| 6 | xoay 90° theo chiều kim đồng hồ | 90 | **đảo** |
| 3 | xoay 180° | 180 | như pixel |
| 8 | xoay 90° ngược chiều kim đồng hồ | 270 | **đảo** |

Trên Android, `loadPhoto` làm hai việc theo thứ tự: chọn `inSampleSize` để không giải mã 48 MB pixel cho một view nhỏ, rồi xoay bitmap theo `rotationDegrees`. Trên iOS không cần làm gì. App camera của emulator không ghi tag này, nên bug chỉ lộ với một ảnh test được làm sẵn hoặc với camera của một số điện thoại thật.

So với TS/JS: trình duyệt hiện đại áp EXIF orientation cho `<img>` mặc định (`image-orientation: from-image`), nhưng khi bạn vẽ lên `<canvas>` bằng code cũ thì có thể phải tự xoay, cùng cái bẫy.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là xong E2.

- [ ] Giải thích vì sao app nhờ hệ thống mở camera và bộ chọn thay vì tự vẽ, và ba kết cục của một chuyến đi.
- [ ] Giải thích vì sao màn hình phải cho adapter mượn launcher / presenter, và vì sao màn hình vẫn không quyết định gì (xem [A2](#a2-chuyen-i-toi-he-thong-nhu-nho-le-tan-goi-taxi)).
- [ ] Đọc `MediaCaptureService` và nói hai quy tắc: camera cần camera + quyền; thư viện không cần quyền (xem [A3](#a3-quy-tac-cua-service-chay-that-bang-code-cua-bai)).
- [ ] Thêm `Permission.Camera` vào code quyền của bài 12 trên cả hai nền tảng, kể cả `NSCameraUsageDescription`.
- [ ] Cấu hình `FileProvider` với `cache-path` và một subclass rỗng, và khai báo hai feature camera `required="false"`.
- [ ] Giải thích gotcha `SecurityException` khi khai báo `CAMERA` mà chưa được cấp (xem [A4](#a4-android-va-ios-canh-nhau)).
- [ ] Chép ảnh vào cache của app, đo thông tin media không cần giải mã pixel, và chỉ giữ bản sao mới nhất.
- [ ] Viết presenter iOS cho track của mình: state + `.photosPicker` / `.fullScreenCover` (SwiftUI), hoặc `present` + delegate (UIKit).
- [ ] Hiện ảnh đúng chiều trên Android bằng `inSampleSize` và `ExifInterface.rotationDegrees` (xem [A5](#a5-exif-orientation-anh-nam-nghieng)).
- [ ] Mở màn hình ảnh từ màn hình chính trên track của mình.
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
