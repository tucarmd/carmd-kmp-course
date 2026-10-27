---
source: lessons/12-permissions.html
source_ref: live
source_sha: 6eae9bc
---

<p class="kicker">Bài 12 · Tuần 3 · Ngày 12 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html">Bản gốc tiếng Anh</a></p>

# Quyền truy cập

<div class="meta">
  <span class="tag">~2 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m07 quyền BLE, mọi đường đi đều hiện trên UI</span>
  <span class="tag">Cần trước: <a href="../11-kiem-thu-va-koin/">11</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Từ bài 13, app nói chuyện với một radio Bluetooth thật, và không hệ điều hành nào cho phép điều đó cho tới khi người dùng đồng ý. Hôm nay app xin. Nó kiểm tra quyền Bluetooth đang ở đâu, xin khi hệ thống còn hỏi được, và cho người dùng thấy bước tiếp theo trên mọi đường đi: được cấp, bị từ chối, bị từ chối vĩnh viễn và bị hạn chế. Đây là khả năng đầu tiên đi qua **cả hai** loại port: ViewModel gọi một inbound port mới, `PermissionAccess`, service của nó áp quy tắc của app, và chỉ các outbound adapter phía sau `PermissionChecker` mới nói chuyện với hệ điều hành. Trên Android, adapter đó là Kotlin trong `androidMain`. Trên iOS, đó là **outbound adapter bằng Swift** đầu tiên của bạn: một class Swift implement một interface Kotlin, mẫu mà bài 13 dùng cho radio thật. Đó là milestone **m07**.

!!! info "Nguồn chính"
    Trang [Request runtime permissions](https://developer.android.com/training/permissions/requesting) của Android, trước mục 1, và trang [CBManagerAuthorization](https://developer.apple.com/documentation/corebluetooth/cbmanagerauthorization) của Apple (bốn case ngắn), trước mục 6.

!!! info "Track"
    App core, các test của nó và cả hai outbound adapter giống nhau trên mọi track (mục 1–4, 6 và 9). Các track khác nhau ở hai chỗ: nơi code Android cho adapter mượn result launcher của nó (mục 5), và cách mỗi màn hình hiện quyền và nhận ra người dùng vừa quay lại từ Settings (mục 8). Track XML Views và UIKit còn đổi mỗi track một layout. Mỗi đoạn trích chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.
    Bài này có các nhóm tab **Compose** / **XML** và **SwiftUI** / **UIKit**; chọn một tab là mọi tab cùng tên trên trang đổi theo.

## Thay đổi so với m06

| Cái gì | m06 | m07 |
|---|---|---|
| màn hình | bộ lọc, Scan, danh sách | thêm một hàng quyền: một thông báo và tối đa một nút cho mỗi trạng thái; Scan chỉ chạy khi Bluetooth được cho phép |
| app core | `DeviceScanning`, `BleScanner`, `ScanningService` | thêm `Permission` và `PermissionStatus`, inbound port `PermissionAccess`, outbound port `PermissionChecker`, `PermissionService` |
| outbound adapters | `SimulatedBleScanner` (dùng chung) | thêm `AndroidPermissionChecker` (Kotlin, `androidMain`) và `IosPermissionChecker` (Swift, app iOS) |
| khởi động Koin | `initKoin()` | `initKoin(permissionChecker)`: mỗi nền tảng dựng adapter của mình và truyền vào |
| khai báo | không có | manifest Android: các quyền Bluetooth; `project.yml` của iOS: chuỗi giải thích việc dùng Bluetooth |
| test | 9 mỗi nền tảng | 16 mỗi nền tảng: 4 mới cho permission service, 3 mới cho ViewModel |

## 1. Một quyền, hai hệ điều hành

Cả hai nền tảng theo cùng một vòng. Hướng dẫn của Android chia thành các bước: "Kiểm tra xem người dùng đã cấp quyền runtime mà app cần chưa", rồi nếu chưa, "Xin quyền runtime", rồi "Kiểm tra câu trả lời của người dùng", và "Nếu người dùng từ chối, hãy giảm trải nghiệm của app một cách nhẹ nhàng" ([Request runtime permissions](https://developer.android.com/training/permissions/requesting)). Nó thêm một quy tắc đáng nhớ: "Bạn phải kiểm tra xem mình có quyền hay không mỗi lần thực hiện một thao tác cần quyền đó", vì người dùng có thể đổi nó trong Settings bất cứ lúc nào. Apple nói y vậy: "Vì một người có thể đổi quyền bất cứ lúc nào trong Settings, luôn kiểm tra trạng thái quyền của một tính năng trước khi dùng nó" ([Requesting access to protected resources](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources)).

"Quyền Bluetooth" nghĩa là gì thì khác nhau rất nhiều:

|   | Android 12 trở lên (API 31+) | Android 11 trở xuống (API 26–30) | iOS |
|---|---|---|---|
| app xin cái gì | `BLUETOOTH_SCAN` và `BLUETOOTH_CONNECT`, hai quyền runtime hiện thành một hộp thoại "Nearby devices" | `ACCESS_FINE_LOCATION`, một quyền runtime, vì "một lần quét Bluetooth có thể được dùng để thu thập thông tin về vị trí của người dùng" | một quyền Bluetooth, `CBManager.authorization` |
| khai báo ở đâu | manifest (mục 3) | một chuỗi giải thích trong `Info.plist` (mục 3) |
| sau một lần từ chối | app có thể xin lại | không bao giờ được hỏi lại |
| sau hai lần từ chối | "người dùng không thấy hộp thoại quyền của hệ thống nếu app xin lại quyền đó" (Android 11 trở lên; các bản cũ hơn có ô "don't ask again") | — |
| trạng thái người dùng không đổi được | (không đề cập ở đây) | `restricted` |

Trích dẫn: [Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions) và [Android 11 permission updates](https://developer.android.com/about/versions/11/privacy/permissions) của Android; [CBManagerAuthorization](https://developer.apple.com/documentation/corebluetooth/cbmanagerauthorization) của Apple.

App core không thể nói bằng bất kỳ từ ngữ nào ở trên: chúng thuộc về các nền tảng. Nên nó có từ ngữ riêng, chọn theo **việc người dùng có thể làm tiếp theo**, và mỗi adapter dịch sang. Đó là quy tắc của bài 10: một outbound port được đặt tên theo cách nói của app.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="l12-paths-title">
      <title id="l12-paths-title">Năm trạng thái quyền của app core và các đường đi giữa chúng. NotRequested: xin thì hiện hộp thoại hệ thống. Từ NotRequested, câu trả lời của người dùng dẫn tới Granted hoặc, trên Android, tới Denied; trên iOS một lần từ chối dẫn thẳng tới PermanentlyDenied. Nếu người dùng đóng hộp thoại Android mà không trả lời, trạng thái vẫn là NotRequested. Từ Denied, thứ chỉ Android có, lần xin thứ hai dẫn tới Granted hoặc PermanentlyDenied. Từ PermanentlyDenied không hộp thoại nào hiện được nữa: chỉ người dùng, trong Settings, bật được quyền, dẫn tới Granted. Restricted, thứ chỉ iOS báo, là ngõ cụt người dùng không đổi được. Trên Android, Granted quay về Denied nếu người dùng tắt quyền trong Settings; trên iOS việc đó dẫn tới PermanentlyDenied.</title>
      <defs><marker id="l12-paths-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="core">
        <rect class="box" x="20" y="120" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="32" y="145">NotRequested</text>
        <text class="small muted" x="32" y="165">xin thì hiện hộp thoại</text>
        <rect class="box" x="300" y="30" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="312" y="55">Denied</text>
        <text class="small muted" x="312" y="75">được xin lại (Android)</text>
        <rect class="box" x="300" y="210" width="190" height="60" rx="6"></rect>
        <text class="mono small" x="312" y="235">PermanentlyDenied</text>
        <text class="small muted" x="312" y="255">không hộp thoại: chỉ Settings</text>
        <rect class="box" x="590" y="120" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="602" y="145">Granted</text>
        <text class="small muted" x="602" y="165">Scan được bật</text>
        <rect class="box" x="20" y="250" width="150" height="60" rx="6"></rect>
        <text class="mono small" x="32" y="275">Restricted</text>
        <text class="small muted" x="32" y="295">người dùng không đổi được (iOS)</text>
      </g>
      <path class="edge" d="M170,140 L298,68" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="176" y="92">từ chối (Android)</text>
      <path class="edge" d="M170,165 L298,232" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="160" y="222">từ chối (iOS)</text>
      <path class="edge" d="M170,150 L588,150" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="470" y="143">cho phép</text>
      <path class="edge" d="M450,60 L590,132" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="500" y="78">cho phép</text>
      <path class="edge" d="M375,90 L385,208" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="388" y="160">từ chối lần nữa</text>
      <path class="edge dashed" d="M490,240 L620,182" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="560" y="238">bật trong Settings</text>
      <path class="edge dashed" d="M60,120 C60,80 120,80 120,118" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="20" y="74">đóng hộp thoại (Android)</text>
      <path class="edge dashed" d="M665,120 C665,20 520,10 452,40" marker-end="url(#l12-paths-arrow)"></path>
      <text class="small" x="530" y="22">tắt trong Settings (Android)</text>
    </svg>
    <figcaption>Năm trạng thái của app core. Mũi tên liền là câu trả lời của người dùng cho hộp thoại hệ thống; mũi tên đứt xảy ra ngoài hộp thoại.</figcaption>
  </figure>

1. **`NotRequested`**: xin sẽ hiện hộp thoại hệ thống. Đó là `notDetermined` của iOS, "người dùng chưa cấp quyền Bluetooth cho app này".
2. **`Denied`**: đã từ chối, nhưng hệ thống vẫn sẽ hiện hộp thoại. Chỉ Android có. Hướng dẫn của Android bảo bạn giải thích lý do trước: "Nếu hàm này trả về true, hãy hiện một UI giải thích cho người dùng", trong đó "hàm này" là `shouldShowRequestPermissionRationale()`.
3. **`PermanentlyDenied`**: đã từ chối, và không hộp thoại nào hiện lại nữa. Trên Android đó là lần từ chối thứ hai ("Hành động của người dùng hàm ý "đừng hỏi lại", và được coi là từ chối vĩnh viễn"). Trên iOS đó là lần đầu: "Nếu người dùng từ chối, lần truy cập kích hoạt hộp thoại và mọi lần sau đều thất bại", và hệ thống "không hỏi lại" ([Requesting access to protected resources](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources)). Nên `denied` của iOS ánh xạ sang `PermanentlyDenied`, không phải sang `Denied`.
4. **`Restricted`**: `restricted` của iOS: "người dùng không đổi được trạng thái quyền Bluetooth, có thể vì đang có hạn chế như kiểm soát của phụ huynh". App chỉ nói được như vậy.
5. **`Granted`**: Scan được bật. Nó vẫn có thể đổi: người dùng có thể tắt quyền trong Settings (lúc đó Android báo `Denied`, iOS báo `PermanentlyDenied`), nên mọi màn hình đọc lại nó khi app quay lại foreground (mục 8).

## 2. Các port và service

Hai enum cho app core từ ngữ của nó:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/Permission.kt" hl_lines="5 8"
package com.example.devicemonitor.core

// A permission the app needs, in the app's terms. Each platform's adapter maps it to its
// own: Bluetooth is two runtime permissions on Android 12 and later, one on iOS.
enum class Permission { Bluetooth }

// Where a permission stands, in terms of what the user can do next.
enum class PermissionStatus {
    NotRequested,      // not asked yet: a request shows the system prompt
    Denied,            // refused, and the app may ask again (Android only)
    PermanentlyDenied, // refused, and the system won't ask again: only Settings can change it
    Restricted,        // blocked by a policy the user can't change, such as parental controls (iOS)
    Granted,
}
```

`Permission` hôm nay có một giá trị. Phần mở rộng E2 thêm camera, nên các port bên dưới nhận một danh sách và trả về một trạng thái cho mỗi quyền. Rồi đến hai port, đặt cạnh nhau:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/PermissionAccess.kt" hl_lines="4 6 10 13"
⋯ package and imports: core.Permission, core.PermissionStatus
// Inbound port: what the app offers for the permissions it needs. The shared ViewModels
// call it, and PermissionService implements it.
interface PermissionAccess {
    // Where the permission stands now. Never shows a prompt.
    fun status(permission: Permission): PermissionStatus

    // Asks the user for each permission the system can still prompt for, and returns where
    // every one of them stands afterwards. Suspends while the system prompt is on screen.
    suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus>

    // Opens this app's page in the system Settings: the only way back from PermanentlyDenied.
    fun openSettings()
}
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/PermissionChecker.kt" hl_lines="4 6 10 13"
⋯ package and imports: core.Permission, core.PermissionStatus
// Outbound port: what the app needs from the OS's permission system, in the app's terms.
// One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
interface PermissionChecker {
    // Reads the permission's status from the OS. Never shows a prompt.
    fun check(permission: Permission): PermissionStatus

    // Shows the system prompt for these permissions and returns each one's status after the
    // user answers.
    suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus>

    // Opens this app's page in the system Settings.
    fun openSettings()
}
```

1. **Trông giống nhau, nghĩa khác nhau.** `PermissionAccess` là thứ app *cung cấp* cho các ViewModel. `PermissionChecker` là thứ app *cần* từ hệ điều hành. Ở bài 10, `DeviceScanning` và `BleScanner` cũng trông giống nhau, và service ở giữa giữ quy tắc.
2. **`status` và `check` là hàm thường**: cả hai nền tảng trả lời ngay (`checkSelfPermission` của Android, `CBManager.authorization` của iOS). Chỉ `request` là suspend, vì nó chờ một con người.
3. **`openSettings` cũng nằm trên các port.** Mở app Settings là nói chuyện với hệ điều hành, nên nó đi qua adapter, như mọi thứ khác làm việc đó.

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/core/PermissionService.kt" hl_lines="4 8 9 11 17"
⋯ package and imports: PermissionAccess, PermissionChecker
// Service: the app's permission rules. Prompt only for what the system can still prompt
// for: never for a permission that is granted, permanently denied or restricted.
class PermissionService(private val checker: PermissionChecker) : PermissionAccess {
    override fun status(permission: Permission): PermissionStatus = checker.check(permission)

    override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
        val before = permissions.associateWith { checker.check(it) }
        val askable = before.filterValues { it in ASKABLE }.keys.toList()
        if (askable.isEmpty()) return before
        return before + checker.request(askable)
    }

    override fun openSettings() = checker.openSettings()

    private companion object {
        val ASKABLE = setOf(PermissionStatus.NotRequested, PermissionStatus.Denied)
    }
}
```

1. **Quy tắc: chỉ hiện hộp thoại khi hộp thoại hiện được.** Một quyền đã được cấp thì không cần hộp thoại. Một quyền bị từ chối vĩnh viễn hay bị hạn chế thì không có được hộp thoại. Chỉ `NotRequested` và `Denied` được chuyển cho adapter.
2. **`before + checker.request(askable)`**: `+` trên hai map giữ các mục của map bên trái và để map bên phải ghi đè. Nên kết quả có mọi quyền được hỏi tới: câu trả lời mới cho các quyền vừa hiện hộp thoại, và trạng thái cũ cho phần còn lại.
3. **Sao đây là quy tắc của service chứ không phải code của adapter?** Nó giống nhau trên cả hai nền tảng, không dính gì tới API của Android hay iOS, và test được trên JVM trong vài mili giây (mục 9). Đó là câu trả lời "cái này để đâu?" của bài 10 cho một quy tắc của app.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 330" role="img" aria-labelledby="l12-hex-title">
      <title id="l12-hex-title">Ai nói chuyện với ai cho một lần xin quyền. Màn hình gọi DeviceListViewModel dùng chung, một inbound adapter, thứ gọi inbound port PermissionAccess. PermissionService trong app core implement nó và gọi outbound port PermissionChecker. Hai outbound adapter implement port đó: AndroidPermissionChecker, Kotlin trong androidMain, với tới hộp thoại quyền của Android qua một result launcher; và IosPermissionChecker, Swift trong app iOS, đọc CBManager.authorization và tạo một CBCentralManager. Chỉ trên Android, một mũi tên đứt cho thấy code UI Android cho adapter mượn result launcher của nó, vì chỉ một Activity hoặc một Fragment đăng ký được launcher. Trong test, FakePermissionChecker thay cho cả hai adapter.</title>
      <defs><marker id="l12-hex-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="android">
        <rect class="box" x="10" y="30" width="130" height="50" rx="6"></rect>
        <text class="title small" x="20" y="50">Màn hình Android</text>
        <text class="small muted" x="20" y="68">Compose · XML</text>
      </g>
      <g data-part="ios">
        <rect class="box" x="10" y="100" width="130" height="50" rx="6"></rect>
        <text class="title small" x="20" y="120">Màn hình iOS</text>
        <text class="small muted" x="20" y="138">SwiftUI · UIKit</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="170" y="62" width="130" height="56" rx="6"></rect>
        <text class="mono small" x="180" y="84">DeviceList</text>
        <text class="mono small" x="180" y="100">ViewModel</text>
      </g>
      <g data-part="core">
        <polygon class="box" points="320,90 350,20 560,20 590,90 560,160 350,160"></polygon>
        <text class="title" x="455" y="40" text-anchor="middle">App core</text>
        <rect class="box" x="400" y="68" width="110" height="44" rx="6"></rect>
        <text class="mono small" x="408" y="86">Permission</text>
        <text class="mono small" x="408" y="102">Service</text>
      </g>
      <g data-part="inbound">
        <rect class="box" x="300" y="128" width="118" height="26" rx="6"></rect>
        <text class="mono small" x="306" y="146">PermissionAccess</text>
      </g>
      <g data-part="outbound">
        <rect class="box" x="490" y="128" width="130" height="26" rx="6"></rect>
        <text class="mono small" x="496" y="146">PermissionChecker</text>
        <rect class="box" x="520" y="200" width="230" height="50" rx="6"></rect>
        <text class="mono small" x="530" y="220">AndroidPermissionChecker</text>
        <text class="small muted" x="530" y="238">Kotlin, androidMain · result launcher</text>
        <rect class="box" x="520" y="265" width="230" height="50" rx="6"></rect>
        <text class="mono small" x="530" y="285">IosPermissionChecker</text>
        <text class="small muted" x="530" y="303">Swift, iOS app · CBManager</text>
        <rect class="box" x="300" y="265" width="190" height="50" rx="6"></rect>
        <text class="mono small" x="310" y="285">FakePermissionChecker</text>
        <text class="small muted" x="310" y="303">commonTest</text>
      </g>
      <path class="edge" d="M140,55 L168,80" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge" d="M140,125 L168,102" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge" d="M235,118 L300,140" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge dashed" d="M400,98 L380,126" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge" d="M510,98 L545,126" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge dashed" d="M600,200 L580,156" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge dashed" d="M640,265 L600,156" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge dashed" d="M400,265 L540,156" marker-end="url(#l12-hex-arrow)"></path>
      <path class="edge dashed" d="M75,30 L75,12 L740,12 L740,198" marker-end="url(#l12-hex-arrow)"></path>
      <text class="small" x="220" y="9">Chỉ Android: một Activity hoặc một Fragment cho mượn result launcher của nó</text>
    </svg>
    <figcaption>Mũi tên liền là lời gọi; mũi tên đứt đi vào một port nghĩa là "implement". Mũi tên trên cùng là ngoại lệ duy nhất chỉ có trên Android, giải thích ở mục 5.
<ul class="legend">
    <li data-part="core">App core</li>
    <li data-part="inbound">Inbound (port và adapter)</li>
    <li data-part="outbound">Outbound (port và adapter)</li>
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

## 3. Khai báo trước khi xin

Không hệ điều hành nào xin một quyền mà app chưa khai báo. Trên Android, khai báo nằm trong manifest, giống nhau trên cả hai track Android:

```xml title="androidApp/src/main/AndroidManifest.xml" hl_lines="3 4 5 8 9 10"
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
⋯ <application>: as in m06 (each Android track keeps its own theme)
```

1. **`maxSdkVersion="30"`** trên các quyền cũ: "Bước tương thích này giúp hệ thống chỉ cấp cho app những quyền Bluetooth nó cần khi được cài trên thiết bị chạy Android 12 trở lên" ([Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)). `BLUETOOTH` và `BLUETOOTH_ADMIN` được cấp lúc cài. `ACCESS_FINE_LOCATION` là quyền runtime mà adapter xin trên Android 11 trở xuống.
2. **`BLUETOOTH_SCAN` và `BLUETOOTH_CONNECT` là quyền runtime**: "Khi app xin ít nhất một trong các quyền này, hệ thống hỏi người dùng có cho app truy cập Nearby devices không". Quét cần quyền đầu (bài 13), và kết nối cần quyền thứ hai (bài 14). Một hộp thoại bao cả hai.
3. **`neverForLocation`** là một lời hứa rằng app không bao giờ suy ra người dùng đang ở đâu từ kết quả quét, nên Android 12+ không cần quyền vị trí. Nó có cái giá: "Nếu bạn thêm `neverForLocation` vào `android:usesPermissionFlags`, một số BLE beacon bị lọc khỏi kết quả quét." Device Monitor kết nối tới các peripheral và không theo dõi beacon, nên lời hứa là thật và cái giá không quan trọng.

Trên iOS, khai báo là một câu mà hộp thoại hiện cho người dùng. XcodeGen ghi nó vào `Info.plist` từ `project.yml` (thêm một dòng trên cả hai track iOS):

```yaml title="iosApp/project.yml" hl_lines="7"
⋯ name, options, target: as in m06
    info:
      path: iosApp/Info.plist
      properties:
        CFBundleDisplayName: Device Monitor
        UILaunchScreen: {}
        NSBluetoothAlwaysUsageDescription: Device Monitor uses Bluetooth to find and connect to nearby devices.
⋯ settings, preBuildScripts: as in m06 (the UIKit track also keeps its scene manifest)
```

!!! warning "Gotcha · thiếu chuỗi giải thích là crash, không phải cảnh báo"
    Trang tổng quan Core Bluetooth của Apple: "App của bạn sẽ crash nếu Info.plist của nó không có các khoá mô tả việc dùng cho những loại dữ liệu nó cần truy cập. Để dùng API Core Bluetooth trên app link với iOS 13 trở lên, hãy thêm khoá `NSBluetoothAlwaysUsageDescription`" ([Core Bluetooth](https://developer.apple.com/documentation/corebluetooth)). Nó vẫn build bình thường, và Simulator cũng không bắt được: khi xoá khoá đó khỏi `Info.plist` của bản build m07, app vẫn mở trên Simulator iOS 26.2, đọc `CBManager.authorization` và hiện "allowed", không crash. Chạy `xcodegen generate` sau khi sửa `project.yml`, và kiểm tra khoá đó có trong `Info.plist` được sinh ra.

## 4. Adapter Android

Adapter ánh xạ `Permission.Bluetooth` của app sang tên của Android, thứ phụ thuộc vào phiên bản Android:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt" hl_lines="6 7 9"
⋯ the rest of the class, below
    // Android 12 (API 31) gave Bluetooth its own runtime permissions. Before that, a BLE scan
    // needed fine location instead.
    private fun Permission.androidNames(): List<String> = when (this) {
        Permission.Bluetooth ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                listOf(Manifest.permission.ACCESS_FINE_LOCATION)
            }
    }
```

Rồi tới `check`. API của chính Android chỉ trả lời "được cấp hay không": "Hàm này trả về `PERMISSION_GRANTED` hoặc `PERMISSION_DENIED`". Muốn phân biệt `NotRequested`, `Denied` và `PermanentlyDenied` cần thêm hai manh mối:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt" hl_lines="3 8 13 18"
    // Android has no "refused for good" status to read back, so the adapter remembers, across
    // launches, which permissions the user has refused.
    private val refusals = context.getSharedPreferences("permission-refusals", Context.MODE_PRIVATE)
⋯ attach, detach, onResult: section 5
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
```

1. **`isGranted`** là `ContextCompat.checkSelfPermission(context, name) == PERMISSION_GRANTED`, cho mọi tên Android mà quyền của app ánh xạ tới.
2. **`shouldShowRationale`** hỏi `ActivityCompat.shouldShowRequestPermissionRationale(activity, name)`, thứ cần một `Activity`: mục 5 là nơi adapter có được nó. Không có thì ở đây nó trả `false`, và một quyền `Denied` sẽ đọc thành `PermanentlyDenied` (có nhớ lần từ chối) hoặc `NotRequested` (không nhớ gì). Nên cả hai track Android cho mượn `Activity` trước khi có gì đọc trạng thái (mục 5 và 8). Tài liệu của nó chỉ nói "Cho biết bạn có nên hiện UI giải thích trước khi xin một quyền không". Nó không nói khi nào nó trả `false`, nên chúng tôi đã quan sát (bảng bên dưới).
3. **`refusals`** là trí nhớ của adapter. "Chưa được cấp, và không cần giải thích" có hai nghĩa khác nhau: chưa bao giờ hỏi, hoặc đã bị từ chối hẳn. Android không phân biệt được chúng, nên adapter nhớ, trong `SharedPreferences`, mọi quyền nó từng thấy bị từ chối. Trí nhớ về các lần từ chối là việc của adapter, không phải quy tắc của app: iOS không cần.

Đây là những gì chúng tôi thấy. Trạng thái ở bốn hàng đầu giống nhau trên emulator Android 16 (API 36) và Android 11 (API 30); hàng cuối chạy trên API 36. Các cờ lấy từ `adb shell dumpsys package com.example.devicemonitor` trên API 36 (chỉ hiện `USER_SET` và `USER_FIXED`; "none" nghĩa là không có cờ nào):

| Người dùng đã làm gì | cờ | rationale? | trạng thái của adapter |
|---|---|---|---|
| chưa làm gì | none | false | `NotRequested` |
| đóng hộp thoại bằng Back | none | false | `NotRequested`: lần xin tiếp theo lại hiện hộp thoại |
| từ chối một lần | `USER_SET` | true | `Denied` (được nhớ) |
| từ chối hai lần | `USER_SET|USER_FIXED` | false | `PermanentlyDenied`; cả sau một lần khởi động nguội, nhờ trí nhớ |
| tắt nó trong Settings sau khi đã cấp | `USER_SET` | true | `Denied` |

Tài liệu Android gọi tên các cờ: "Quyền đã bị người dùng từ chối một lần được đánh cờ `USER_SET`. Quyền bị từ chối vĩnh viễn bằng cách chọn Deny hai lần được đánh cờ `USER_FIXED`" ([Android 11 permission updates](https://developer.android.com/about/versions/11/privacy/permissions)). App không đọc được các cờ, nên adapter suy ra cùng câu trả lời từ rationale và trí nhớ của nó.

!!! warning "Gotcha · "chưa cấp, không cần giải thích" không phải là "bị từ chối vĩnh viễn""
    Bản đầu tiên của adapter không có trí nhớ: sau một lần xin, "chưa cấp và không cần giải thích" nghĩa là `PermanentlyDenied`. Rồi chúng tôi đóng hộp thoại đầu tiên bằng Back. Android không ghi gì (không cờ nào), hộp thoại lẽ ra vẫn hiện lại được, và app bảo người dùng vào Settings. Tài liệu Android không nói việc đóng hộp thoại làm gì, nên chúng tôi kiểm tra: nó không phải một lần từ chối. Trí nhớ sửa cả hai lỗi. Một lần đóng hộp thoại vẫn là `NotRequested`, vì chưa có gì bị từ chối. Một lần từ chối vĩnh viễn vẫn còn sau khởi động nguội, thứ mà không có trí nhớ sẽ đọc thành `NotRequested`, và nút "Allow" của nó sẽ không hiện hộp thoại nào.

Việc xin dùng launcher được cho adapter mượn (mục 5) và chờ câu trả lời:

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt" hl_lines="3 5 6 7 12 13"
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
```

1. **`CompletableDeferred`** là một giá trị tới sau: `await()` treo coroutine của ViewModel cho tới khi `onResult` (mục 5) gọi `complete`. Main thread rảnh suốt thời gian hộp thoại hiện.
2. **Sau khi có câu trả lời, nó gọi lại `check`** thay vì tin `Map<String, Boolean>` của launcher. "Được cấp hay không" là chưa đủ: nó cần rationale và trí nhớ để phân biệt `Denied` với `PermanentlyDenied`.
3. **`ACTION_APPLICATION_DETAILS_SETTINGS`**: "Hiện màn hình chi tiết về một app cụ thể … Đầu vào: data URI của Intent chỉ tên package của app cần hiện, với scheme "package"" ([Settings](https://developer.android.com/reference/android/provider/Settings#ACTION_APPLICATION_DETAILS_SETTINGS)). `FLAG_ACTIVITY_NEW_TASK` có mặt vì adapter mở nó từ `Context` của application, không phải từ một `Activity`.

!!! warning "Gotcha · tôn trọng lời từ chối"
    Hướng dẫn của Android nói rõ về nhánh bị từ chối: "tôn trọng quyết định của người dùng. Đừng dẫn tới cài đặt hệ thống nhằm thuyết phục người dùng đổi ý." App hiện một dòng nói cái gì không dùng được, với một nút: "Ask again" khi hệ thống còn hiện được hộp thoại, và "Open Settings" chỉ khi nó không còn hiện được, vì lúc đó Settings là đường quay lại duy nhất. Nó không bao giờ tự bật hộp thoại hay tự xin lại. Bài 13 cho chính nút Scan phụ thuộc vào quyền, và phần còn lại của app vẫn chạy khi không có nó.

## 5. Android: cho adapter mượn một launcher

Đây là ngoại lệ duy nhất của "chỉ adapter nói chuyện với hệ điều hành". Android hiện hộp thoại qua Activity Result API, và chỉ một `Activity` hoặc một `Fragment` đăng ký nhận kết quả được: "Bạn phải gọi `registerForActivityResult()` trước khi fragment hoặc activity được tạo", và "callback phải được đăng ký vô điều kiện mỗi lần activity được tạo" ([Get a result from an activity](https://developer.android.com/training/basics/intents/result)). Adapter sống suốt process; activity và fragment thì đến rồi đi. Nên code UI đăng ký launcher và *cho adapter mượn* nó, kèm `Activity` mà rationale cần (mục 4). Nó không quyết định gì: nó không kiểm tra, không mở hộp thoại, không đọc câu trả lời.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidPermissionChecker.kt" hl_lines="1 6 11 19 21"
class AndroidPermissionChecker(private val context: Context) : PermissionChecker {
    private var activity: Activity? = null
    private var launcher: ActivityResultLauncher<Array<String>>? = null
    private var answer: CompletableDeferred<Unit>? = null
⋯ refusals: section 4
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
```

1. **`detach` kiểm tra đó có đúng là launcher cũ không.** Nếu trong lúc đó một `Activity` hay `Fragment` mới hơn đã gắn launcher của nó, `detach` của cái cũ để yên thay vì xoá nó đi.
2. **Không giữ `Activity` nào sau `detach`**: adapter sống bằng process, và giữ một `Activity` đã bị huỷ sẽ làm rò rỉ nó.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt" hl_lines="3 6 7 14 15 21"
    class MainActivity : ComponentActivity() {
    ⋯ a three-line comment: why the Activity registers and lends the launcher
        private val permissionChecker by lazy {
            (application as DeviceMonitorApplication).permissionChecker
        }
        private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
            permissionChecker.onResult(this)
        }

        override fun onCreate(savedInstanceState: Bundle?) {
            enableEdgeToEdge()
            super.onCreate(savedInstanceState)
    ⋯ a two-line comment: why attach comes before setContent
            permissionChecker.attach(this, permissionLauncher)
            setContent {
    ⋯ MaterialTheme { DeviceMonitorApp() }: as in m06
            }
        }

        override fun onDestroy() {
            permissionChecker.detach(permissionLauncher)
            super.onDestroy()
        }
    }
    ```

    1. **Một property initializer** là chỗ an toàn: "`registerForActivityResult()` gọi an toàn trước khi fragment hoặc activity được tạo, nên dùng được ngay khi khai báo biến thành viên" ([Get a result from an activity](https://developer.android.com/training/basics/intents/result)). Một lần xoay tạo `MainActivity` mới, cái đó đăng ký lại, đúng như quy tắc đòi, và callback của nó truyền `Activity` mới đó cho `onResult`.
    2. **`attach` đứng trước `setContent`**, vì lần đọc quyền đầu tiên xảy ra trong nội dung mà nó compose: `koinViewModel()` dựng ViewModel của màn hình danh sách khi màn hình được compose lần đầu, và constructor của ViewModel đọc trạng thái (mục 8). Gắn trước thì lần đọc đó đã có `Activity`, nên phân biệt được `Denied`.
    3. **`onCreate`/`onDestroy`** bao trọn đời của `Activity`, nên adapter không bao giờ giữ một cái đã bị huỷ. `application` của nó là `DeviceMonitorApplication` của chúng ta, thứ sở hữu adapter (mục 7); `by lazy` chỉ đọc nó khi `onCreate` cần lần đầu. Trang DI thủ công của Android cũng với tới container theo cách này: `(application as MyApplication).appContainer`.

    !!! warning "Gotcha · một composable cho mượn quá muộn so với lần đọc đầu"
        Compose có launcher riêng: "Cùng Activity Result API và `rememberLauncherForActivityResult()` ở trên có thể dùng để xin quyền runtime bằng … contract `RequestMultiplePermissions` cho nhiều quyền" ([Compose and other libraries](https://developer.android.com/develop/ui/compose/libraries)). Bản đầu tiên của chúng tôi dùng nó, trong một composable bên trong màn hình danh sách, gắn adapter trong một `DisposableEffect`. Effect đó chỉ chạy sau khi màn hình đã được compose, và việc compose đã dựng ViewModel, mà constructor đọc trạng thái khi chưa có `Activity` nào được gắn. Lần đọc đó trả `PermanentlyDenied` hoặc `NotRequested` cho một quyền `Denied` (mục 4), và màn hình hiện nó cho tới khi `ON_RESUME` đọc lại trạng thái. Đó là một cuộc đua: trên emulator API 36, hai trong bốn lần quay màn hình khởi động nguội sau một lần từ chối hiện "Bluetooth permission is off" + Open Settings ở những khung hình đầu, rồi mới "denied" + Ask again. Sau khi tắt quyền trong Settings, adapter không nhớ lần từ chối nào, nên hàng sai là "needs Bluetooth permission" + Allow Bluetooth. Với `MainActivity` cho mượn trước `setContent`, mọi lần khởi động nguội chúng tôi quay, sau một lần từ chối và sau khi tắt trong Settings, đều hiện "denied" + Ask again ngay từ khung hình đầu.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="2 5 6 11 15"
    ⋯ a three-line comment: why the Fragment registers and lends the launcher
        private val permissionChecker by lazy {
            (requireActivity().application as DeviceMonitorApplication).permissionChecker
        }
        private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) {
            permissionChecker.onResult(requireActivity())
        }
    ⋯ onCreateView, onViewCreated: as in m06
        override fun onStart() {
            super.onStart()
            permissionChecker.attach(requireActivity(), permissionLauncher)
        }
    ⋯ onResume: section 8
        override fun onStop() {
            permissionChecker.detach(permissionLauncher)
            super.onStop()
        }
    ```

    1. **Một property initializer** là chỗ an toàn: "`registerForActivityResult()` gọi an toàn trước khi fragment hoặc activity được tạo, nên dùng được ngay khi khai báo biến thành viên" ([Get a result from an activity](https://developer.android.com/training/basics/intents/result)). Mỗi instance `Fragment` mới lại đăng ký, đúng như quy tắc đòi.
    2. **`by lazy`** cho adapter, vì `requireActivity()` ném lỗi cho tới khi Fragment được gắn vào Activity của nó, mà property initializer chạy trước lúc đó.
    3. **`onStart`/`onStop`** bao khoảng thời gian màn hình hiện ra, cũng là lúc người dùng có thể bấm "Allow Bluetooth".


!!! info "XML vs Compose · cái gì đổi và vì sao"
    Cùng ba lời gọi, `attach`, `onResult` và `detach`, ở những chỗ khác nhau. Màn hình của track XML là một `Fragment`, thứ tự đăng ký được cho mình: nó đăng ký một lần mỗi instance, dưới dạng property, và bao khoảng thời gian hiện ra bằng `onStart`/`onStop`. Một màn hình Compose là một composable, thứ không cho mượn được trước khi được compose, nên `Activity` duy nhất đăng ký, cũng dưới dạng property, và bao trọn đời của nó bằng `onCreate`/`onDestroy`. Cách nào thì `Activity` cũng được gắn trước khi ViewModel của màn hình đọc trạng thái lần đầu (mục 8).

**Chúng tôi xoay emulator khi hộp thoại đang hiện**, trên cả hai track (API 36). `Activity` phía sau hộp thoại được tạo lại (logcat: `finishDrawing of relaunch: … MainActivity`). Câu trả lời vẫn được giao tới launcher mà `Activity` mới (Compose) hay `Fragment` mới (XML) đã đăng ký, và màn hình hiện "allowed" hoặc "denied" đúng như đã trả lời. ViewModel và adapter đều sống lâu hơn `Activity` cũ, nên coroutine đang chờ trong `request` nhận được câu trả lời.

## 6. Adapter iOS, bằng Swift

Adapter iOS là một class Swift trong app iOS implement interface Kotlin `PermissionChecker`. Swift thấy một interface Kotlin là một protocol, nên đây là việc tuân theo protocol, và Koin trao object đó cho app core như mọi adapter khác. Nó dùng chung cho cả hai track iOS:

```swift title="iosApp/iosApp/IosPermissionChecker.swift" hl_lines="5 6 7 11 16 19"
⋯ imports: CoreBluetooth, Shared, UIKit
// Outbound adapter: Bluetooth permission on iOS, behind the Kotlin PermissionChecker port.
// iOS has one Bluetooth permission. Reading CBManager.authorization never prompts; the
// prompt appears when the app first uses Bluetooth, here by creating a CBCentralManager.
@MainActor
final class IosPermissionChecker: NSObject, @preconcurrency PermissionChecker,
    @preconcurrency CBCentralManagerDelegate {
    private var manager: CBCentralManager?
    private var waiting: [CheckedContinuation<Void, Never>] = []

    func check(permission: Permission) -> PermissionStatus {
        Self.bluetoothStatus()
    }
⋯ __request, openSettings, centralManagerDidUpdateState: below
    private static func bluetoothStatus() -> PermissionStatus {
        switch CBManager.authorization {
        case .notDetermined: .notRequested
        case .restricted: .restricted
        case .denied: .permanentlyDenied // iOS never shows the prompt again
        case .allowedAlways: .granted
        @unknown default: .restricted
        }
    }
}
```

1. **`CBManager.authorization`** là một class property: "Trạng thái quyền hiện tại để dùng Bluetooth". Nó đọc được "trước khi tạo một instance CBManager", và "Giá trị ban đầu của property này là `notDetermined`" ([CBManager.authorization](https://developer.apple.com/documentation/corebluetooth/cbmanager/authorization-swift.type.property)). Đọc nó không bao giờ hiện hộp thoại.
2. **`Permission` và `PermissionStatus` tới dưới dạng enum Swift**, kể cả bên trong các yêu cầu của protocol: SKIE "sinh một enum Swift bọc cho một enum Kotlin" và "thêm lại việc kiểm tra đủ mọi case" ([SKIE: Enums](https://skie.touchlab.co/features/enums)). Nên `switch` trả thẳng `.granted` và các bạn của nó.
3. **`@unknown default`** xử lý một case mà iOS tương lai có thể thêm. `.restricted` là lựa chọn thận trọng: app hiện "not available" và không bao giờ hiện hộp thoại.
4. **`@MainActor` cộng `@preconcurrency`.** Adapter giữ state thay đổi được, và Core Bluetooth gọi delegate của nó trên main queue (`queue: nil`, bên dưới), nên class được cô lập trên main actor. Protocol Kotlin không nói gì về actor, và Swift 6 từ chối một method main-actor làm witness cho nó. `@preconcurrency` trên phần tuân theo protocol chấp nhận nó, và Swift kiểm tra lúc chạy thay vào: "Gọi một hàm đồng bộ bị cô lập từ ngoài vùng cô lập sẽ gây lỗi runtime làm dừng chương trình" ([SE-0423](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0423-dynamic-actor-isolation.md)). Các lời gọi của chúng ta tới từ ViewModel trên main thread, nên kiểm tra luôn đúng.

```swift title="iosApp/iosApp/IosPermissionChecker.swift" hl_lines="3 4 5 8 19 20 24"
    // The Kotlin suspend fun. SKIE keeps the name `request` for the async function Swift
    // calls, so the one Swift implements is `__request`.
    func __request(permissions: [Permission]) async throws -> [Permission: PermissionStatus] {
        if CBManager.authorization == .notDetermined {
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
        let status = Self.bluetoothStatus()
        return Dictionary(uniqueKeysWithValues: permissions.map { ($0, status) })
    }
⋯ openSettings: UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString))
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard CBManager.authorization != .notDetermined else { return }
        manager = nil
        let answered = waiting
        waiting = []
        answered.forEach { $0.resume() }
    }
```

1. **Vì sao là `__request`?** `suspend fun request` của Kotlin tới Objective-C dưới dạng một method có completion handler. SKIE rồi thêm một hàm Swift `async` tên `request(permissions:)` để *gọi* nó, và "đổi tên hàm suspend gốc bằng cách thêm tiền tố `__`. Việc này để tránh trùng tên với hàm bọc được sinh ra" ([SKIE: Suspend functions](https://skie.touchlab.co/features/suspend)). Để *implement* nó, viết bản gốc. Compiler chấp nhận nó như một hàm `async throws`, vì các hàm suspend "luôn có một tham số `NSError*`/`Error` trong completion handler" ([Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html)).
2. **Hộp thoại tới cùng lần dùng Bluetooth đầu tiên.** Apple: "Lần đầu app cố truy cập một tài nguyên được bảo vệ, hệ thống hỏi người dùng app có được phép không" ([Requesting access to protected resources](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources)). iOS không có lời gọi "xin quyền Bluetooth" nào, nên adapter tạo lần dùng đầu tiên đó bằng cách tạo một `CBCentralManager`.
3. **`withCheckedContinuation`** treo cho tới khi delegate nhận được hồi âm. Nó là họ hàng một-giá-trị của continuation `AsyncStream` ở bài 02: closure nhận một tay cầm, và một lần `resume()` kết thúc việc chờ ("Bạn phải gọi một hàm resume đúng một lần trên mọi nhánh chạy", [CheckedContinuation](https://developer.apple.com/documentation/swift/checkedcontinuation)). `centralManagerDidUpdateState` được gọi mỗi khi state của manager đổi, và Apple bảo "Kiểm tra property này [`authorization`] trong phần cài đặt các method delegate `centralManagerDidUpdateState(_:)`". Khi nó không còn là `notDetermined`, người dùng đã trả lời, nên mọi request đang chờ đều tiếp tục.
4. **`CBCentralManagerOptionShowPowerAlertKey: false`**: mặc định "hệ thống cảnh báo người dùng nếu app tạo central manager khi dịch vụ Bluetooth không sẵn sàng" ([tài liệu](https://developer.apple.com/documentation/corebluetooth/cbcentralmanageroptionshowpoweralertkey)). Manager này chỉ tồn tại để xin quyền, nên nó không nên nhắc chuyện Bluetooth đang tắt. Scanner của bài 13 tự tạo manager riêng.
5. **`openSettingsURLString`** là "Chuỗi URL bạn dùng để deep link tới phần cài đặt riêng của app trong app Settings" ([tài liệu](https://developer.apple.com/documentation/uikit/uiapplication/opensettingsurlstring)).

!!! warning "Gotcha · Simulator lúc nào cũng nói có"
    Chúng tôi cài mới app trên Simulator iOS 26.2 và đặt lại các cài đặt quyền riêng tư bằng `xcrun simctl privacy booted reset all`. `CBManager.authorization` vẫn đọc ra `.allowedAlways`: hàng hiện "allowed" và không hộp thoại nào hiện ra. `simctl privacy` liệt kê lịch, danh bạ, vị trí, ảnh, thư viện media, micro, chuyển động, nhắc việc và Siri, nhưng không có dịch vụ Bluetooth. Nên trên Simulator bạn chỉ test được đường được cấp. Hộp thoại, một lần từ chối và Settings cần một iPhone (brief cho agent liệt kê chúng là các kiểm tra trên thiết bị), và quy tắc của app core được các test ở mục 9 bao. Muốn xem UI của từng trạng thái, tạm cho `bluetoothStatus()` trả về trạng thái đó.

## 7. Nối dây: mỗi nền tảng tự dựng adapter của mình

`appModule` vẫn không dính nền tảng nào. Adapter của nền tảng đi vào qua tham số của `initKoin`:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt" hl_lines="4 9 10 14 16"
internal val appModule = module {
    single<BleScanner> { SimulatedBleScanner() }
    single<DeviceScanning> { ScanningService(get()) }
    single<PermissionAccess> { PermissionService(get()) }
    viewModelOf(::DeviceListViewModel)
}

// The outbound adapters that each platform builds itself and passes to initKoin.
internal fun platformModule(permissionChecker: PermissionChecker) = module {
    single { permissionChecker }
}

// Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
fun initKoin(permissionChecker: PermissionChecker) {
    startKoin {
        modules(appModule, platformModule(permissionChecker))
    }
}
```

1. **Sao lại là một tham số?** Adapter Android cần một `Context`, và adapter iOS là một object Swift mà Kotlin không dựng được. Mỗi nền tảng tự dựng của mình và trao vào. Chữ ký vẫn không có kiểu Koin nào, nên header của Swift vẫn sạch Koin (bài 11): giờ nó khai báo `doInitKoin(permissionChecker:)`.
2. **`single { permissionChecker }`** đăng ký object dưới kiểu của tham số, `PermissionChecker`, đúng thứ `PermissionService(get())` xin.
3. **`platformModule` là một hàm riêng** để test graph dùng được cái thật với một fake bên trong (mục 9).

```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt · both Android tracks" hl_lines="4 9 10"
class DeviceMonitorApplication : Application() {
    // The Android permission adapter, one for the process. Koin hands it to the app core as
    // its PermissionChecker, and an Activity or a Fragment lends it a result launcher.
    lateinit var permissionChecker: AndroidPermissionChecker
        private set

    override fun onCreate() {
        super.onCreate()
        permissionChecker = AndroidPermissionChecker(this)
        initKoin(permissionChecker)
    }
}
```

Adapter được dựng trong `onCreate`, nơi bài 11 khởi động Koin: nó chạy một lần, "khi application đang khởi động, trước khi bất kỳ object activity, service hay receiver nào (trừ content provider) được tạo" ([Application.onCreate](https://developer.android.com/reference/android/app/Application#onCreate())). Một property initializer sẽ chạy sớm hơn, trong constructor, trước khi Android gắn `Context` cho `Application`, mà adapter mở `SharedPreferences` của nó ngay khi được dựng.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/iOSApp.swift" hl_lines="2"
        init() {
            AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker())
        }
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/AppDelegate.swift" hl_lines="3"
        func application(_ application: UIApplication,
                         didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
            AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker())
            return true
        }
    ```


Koin giữ object Swift suốt đời process, dưới dạng một `single`. Phía Swift không có gì giữ tham chiếu, và cũng không cần: trên iOS không màn hình nào cho adapter mượn gì.

## 8. ViewModel và các màn hình

ViewModel nhận inbound port thứ hai và ba sự kiện mới. UI state thêm một trường, `bluetooth: PermissionStatus`:

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListViewModel.kt" hl_lines="3 6 11 16 19"
class DeviceListViewModel(
    private val scanning: DeviceScanning,
    private val permissions: PermissionAccess,
) : ViewModel() {
    private val _uiState = MutableStateFlow(
        DeviceListUiState(bluetooth = permissions.status(Permission.Bluetooth)),
    )
⋯ uiState, scanJob, startScan, errorShown: as in m06; a second Job, permissionJob
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
⋯ openSettings() calls permissions.openSettings()
```

1. **Constructor đọc trạng thái**, nên màn hình không bao giờ hiện chỗ trống tạm. Trên Android, lần đọc đó cần `Activity` được cho mượn (mục 4), và cả hai track đều đã có nó lúc đó. Trên Compose, `MainActivity` gắn trước `setContent`, và ViewModel được dựng khi màn hình được compose lần đầu. Trên XML, Fragment gắn trong `onStart` và lần đầu chạm vào property `by viewModel()` khi khối `repeatOnLifecycle(STARTED)` bắt đầu collect, tức sau `onStart`. Trên API 36, một lần khởi động nguội sau một lần từ chối, và một lần sau khi tắt quyền trong Settings, đều hiện "denied" + Ask again ngay từ khung hình đầu trên cả hai track (quay màn hình).
2. **`refreshPermission` đọc lại nó**, và mọi màn hình gọi nó khi app quay lại foreground: người dùng có thể đã đổi nó trong Settings. Nó không làm gì khi đang có một request chạy, nên nó không ghi đè được câu trả lời mà request đó sắp báo.
3. **Koin không cần đổi gì cho tham số mới**: `viewModelOf(::DeviceListViewModel)` điền cả hai bằng `get()`.

Mỗi màn hình hiện một thông báo và tối đa một nút cho mỗi trạng thái, chỉ bật Scan khi `Granted`, và đọc lại trạng thái khi app quay lại foreground.

=== "Compose"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListScreen.kt" hl_lines="2 8 15 22"
        // Back from Settings (or anywhere else): the permission may have changed.
        LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refreshPermission() }
    ⋯ DeviceListContent(…, bluetooth = state.bluetooth, onAllow = viewModel::requestPermission, onOpenSettings = viewModel::openSettings, …)
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
    ⋯ Denied: red text + "Ask again"; PermanentlyDenied: red text + "Open Settings" (onOpenSettings); Restricted: red text only
            }
        }
    }
    ⋯ in DeviceListContent, the Scan button:
                enabled = !isScanning && bluetooth == PermissionStatus.Granted,
    ```

    `LifecycleEventEffect` chạy khối của nó "khi một sự kiện cụ thể xảy ra" ([Lifecycle and Compose](https://developer.android.com/topic/libraries/architecture/compose)), ở đây là mỗi `ON_RESUME`. `when` trên một enum phải đủ mọi case, nên một trạng thái thứ sáu sẽ không compile được ở đây cho tới khi nó có một hàng.

=== "XML"

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/DeviceListFragment.kt" hl_lines="2 4 8 15 19 21"
        // Back from Settings (or anywhere else): the permission may have changed.
        override fun onResume() {
            super.onResume()
            viewModel.refreshPermission()
        }
    ⋯ render() calls renderPermission(b, state.bluetooth) and enables Scan only for Granted
        private fun renderPermission(b: FragmentDeviceListBinding, status: PermissionStatus) {
            val (message, action) = when (status) {
                PermissionStatus.Granted -> "Bluetooth permission: allowed" to null
                PermissionStatus.NotRequested ->
                    "Device Monitor needs Bluetooth permission to find nearby devices." to "Allow Bluetooth"
    ⋯ Denied → "Ask again"; PermanentlyDenied → "Open Settings"; Restricted → no action
            }
    ⋯ permissionText shows the message, in red unless Granted or NotRequested
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
    ```

    Layout thêm một `TextView` (`permissionText`) và một `Button` không viền (`permissionButton`) giữa bộ lọc và Scan, và đỉnh của Scan giờ treo dưới nút đó. Một view `GONE` trong `ConstraintLayout` co lại thành một điểm, nên Scan dịch lên khi không có hành động nào. `render()` vẫn là chỗ duy nhất chạm vào view (bài 08).


=== "SwiftUI"

    ```swift title="iosApp/iosApp/DeviceListView.swift" hl_lines="1 4 5 8 13 19"
        @Environment(\.scenePhase) private var scenePhase
    ⋯ body: DeviceListContent(…, bluetooth: state.bluetooth, onAllow: …, onOpenSettings: …), .alert, .task: as in m06
            // Back from Settings (or anywhere else): the permission may have changed.
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { viewModel.refreshPermission() }
            }
    ⋯ in DeviceListContent: PermissionRow above the Scan button, and
                .disabled(isScanning || bluetooth != .granted)
    ⋯
    ⋯ private struct PermissionRow: View, with status, onAllow, onOpenSettings
        var body: some View {
            VStack(alignment: .leading, spacing: 6) {
                switch status {
                case .granted:
                    Text("Bluetooth permission: allowed")
                        .foregroundStyle(.secondary)
                case .notRequested:
                    Text("Device Monitor needs Bluetooth permission to find nearby devices.")
                    Button("Allow Bluetooth", action: onAllow)
    ⋯ .denied: red + "Ask again"; .permanentlyDenied: red + "Open Settings"; .restricted: red text only
                }
            }
            .font(.callout)
        }
    }
    ```

    `scenePhase` là vòng đời mức app của bài 04 nhìn từ một view. Nó thành `.active` lại khi người dùng quay về từ Settings.

=== "UIKit"

    ```swift title="iosApp/iosApp/DeviceListViewController.swift" hl_lines="3 4 5 10 13 16 23"
    ⋯ end of viewDidLoad:
            // Back from Settings (or anywhere else): the permission may have changed.
            NotificationCenter.default.addObserver(
                self, selector: #selector(sceneDidActivate),
                name: UIScene.didActivateNotification, object: nil
            )
        }

        @objc private func sceneDidActivate() {
            viewModel.refreshPermission()
        }
    ⋯ in render(): renderPermission(state.bluetooth), and the Scan button:
            scanButton.isEnabled = !isScanning && state.bluetooth == .granted
    ⋯
        private func renderPermission(_ status: PermissionStatus) {
            let (message, action): (String, String?) = switch status {
            case .granted: ("Bluetooth permission: allowed", nil)
    ⋯ one case per status, as in the other tracks
            }
            permissionLabel.text = message
    ⋯ label colour per status
            permissionButton.configuration?.title = action
            permissionButton.isHidden = action == nil
        }
    ```

    `UIScene.didActivateNotification` "cho biết scene giờ đang trên màn hình và phản hồi sự kiện của người dùng", và Apple gợi ý dùng nó để "làm mới nội dung của các view" ([tài liệu](https://developer.apple.com/documentation/uikit/uiscene/didactivatenotification)). Hành động của nút đọc `viewModel.uiState.value.bluetooth` khi được bấm và gọi `openSettings()` với `.permanentlyDenied`, ngược lại thì `requestPermission()`. Nhãn và nút nằm trong một stack dọc giữa bộ lọc và Scan. Một view bị ẩn trong `UIStackView` không chiếm chỗ.


!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    Cùng thông báo, cùng quy tắc cho Scan, khác cách nghe "đã quay lại foreground". SwiftUI đọc `scenePhase` từ environment và phản ứng bằng `.onChange`. UIKit quan sát `UIScene.didActivateNotification` bằng một selector. Cả hai là sự kiện mức scene, vòng đời mức app của bài 04, vì `viewWillAppear` của một màn hình không chạy khi người dùng quay về từ một app khác.

## 9. Test

Service được test qua inbound port của nó với một fake phía sau outbound port, như ở bài 11. Fake đóng vai cả hệ điều hành lẫn người dùng:

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakePermissionChecker.kt" hl_lines="1 2 3 4"
class FakePermissionChecker : PermissionChecker {
    val statuses = mutableMapOf<Permission, PermissionStatus>()
    var answer = PermissionStatus.Granted
    val prompts = mutableListOf<List<Permission>>() // one entry per system prompt shown
    var settingsOpened = 0

    override fun check(permission: Permission): PermissionStatus =
        statuses[permission] ?: PermissionStatus.NotRequested

    override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
        prompts += permissions
        permissions.forEach { statuses[it] = answer }
        return permissions.associateWith { answer }
    }
⋯ openSettings counts calls
}
```

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/core/PermissionServiceTest.kt" hl_lines="4 7 15"
    private val os = FakePermissionChecker()

    // Through the inbound port, as the ViewModel calls it.
    private val permissions: PermissionAccess = PermissionService(os)
⋯ aGrantedPermissionNeedsNoPrompt, promptsWhenNotRequestedAndReturnsTheAnswer, promptsAgainAfterADenial
    @Test
    fun neverPromptsWhenOnlySettingsCanChangeIt() = runTest {
        for (blocked in listOf(PermissionStatus.PermanentlyDenied, PermissionStatus.Restricted)) {
            os.statuses[Permission.Bluetooth] = blocked

            val result = permissions.request(listOf(Permission.Bluetooth))

            assertEquals(blocked, result[Permission.Bluetooth])
        }
        assertEquals(emptyList(), os.prompts)
    }
```

1. **Bốn test, mỗi test một đường đi qua quy tắc**: được cấp (không hộp thoại), chưa xin (một hộp thoại, câu trả lời quay về), bị từ chối (xin lại), bị từ chối vĩnh viễn hoặc bị hạn chế (không hộp thoại, trạng thái không đổi).
2. **`prompts`** ghi lại mỗi hộp thoại "được hiện", nên một test chứng minh được một hộp thoại đã *không* xảy ra. Đó là toàn bộ ý nghĩa của quy tắc.

Test ViewModel có `TestPermissionAccess`, một bản cài đặt test của inbound port nằm cạnh `TestDeviceScanning`, với `current` (thứ `status` báo) và `answer` (thứ một request kết thúc bằng). Ba test mới: `startsWithThePermissionStatusThePortReports`, `showsTheAnswerToAPermissionRequest` và `rereadsThePermissionOnRefresh`. `setUp` có sẵn giờ dựng `DeviceListViewModel(scanning, permissions)`.

```kotlin title="shared/src/commonTest/kotlin/com/example/devicemonitor/di/AppModuleTest.kt" hl_lines="5"
    // A fake stands in for the adapter each platform passes to initKoin.
    @Test
    fun buildsEveryViewModel() {
        val koin = koinApplication {
            modules(appModule, platformModule(FakePermissionChecker()))
        }.koin

        assertNotNull(koin.get<DeviceListViewModel>())
    }
```

Không có platform module thì test graph fail, vì giờ ViewModel cần `PermissionAccess` và service của nó cần một `PermissionChecker`. Với `platformModule` thật và một fake bên trong, test kiểm tra đúng cách nối dây mà `initKoin` thật sự dùng.

Các adapter không có test tự động: chúng là lớp mỏng phủ trên hệ điều hành, được kiểm tra bằng cách chạy app. Bảng ở mục 10 là lần kiểm tra đó.

## 10. Thực tế xảy ra gì

Chúng tôi build m07 trên cả bốn track (Kotlin 2.4.20, Koin 4.2.2, activity 1.13.0, Xcode 26.2). `allTests` pass 16 trên 16 trên JVM và 16 trên 16 trên iOS simulator, và không bản build nào in cảnh báo compiler từ code của chúng ta. Rồi chúng tôi chạy mọi đường đi từ một lần cài mới, trên cả hai track Android. Để cho phép ở bước cuối, chúng tôi dùng `adb shell pm grant` khi app đang ở nền; trên API 36 chúng tôi còn làm bằng tay trong Settings → Permissions → Nearby devices, kết quả như nhau.

| Bước | Android 16 (API 36) | Android 11 (API 30) |
|---|---|---|
| mở app | "Device Monitor needs Bluetooth permission to find nearby devices." + Allow Bluetooth; Scan bị tắt |
| Allow Bluetooth | "Allow Device Monitor to find, connect to, and determine the relative position of nearby devices?" | "Allow Device Monitor to access this device's location?" (While using the app / Only this time / Deny) |
| Back trên hộp thoại | không đổi: vẫn xin |
| từ chối | "Bluetooth permission was denied…" màu đỏ + Ask again |
| Ask again, từ chối | "Bluetooth permission is off. You can turn it on in Settings." màu đỏ + Open Settings |
| force-stop, mở lại | vẫn "off" + Open Settings |
| Open Settings | Settings mở ra (trên API 36 chúng tôi đã xem trang: App info của app); Back quay về, vẫn "off" |
| cho phép khi app đang ở nền, quay lại | "Bluetooth permission: allowed", Scan được bật; Scan tìm thấy 5 thiết bị, như ở m06 |

Trên API 36, cho phép trong Settings vẫn giữ process của app (cùng pid). *Tắt* nó trong Settings thì kết thúc process, và quay lại app thì khởi động mới, hiện "denied" + Ask again ngay từ khung hình đầu trên cả hai track (gotcha của mục 5 cho thấy vì sao việc đó cần cho mượn trước lần đọc đầu). Hướng dẫn của Android nói y vậy về quyền một lần: "Như mọi quyền, nếu người dùng thu hồi quyền một lần của app, process của app kết thúc." Thêm một lý do nữa để trạng thái nằm trong hệ điều hành và trí nhớ của adapter, không bao giờ chỉ trong ViewModel. Trên iOS Simulator cả hai track iOS mở lên với "Bluetooth permission: allowed" và Scan được bật (gotcha của mục 6).

**m07 là một điểm dừng tự nhiên** khi `allTests` xanh trên cả hai nền tảng và emulator Android đi hết bảng trên. Hãy commit nó. Bài 13 thay radio giả lập bằng radio thật: scanner Android sẽ cần `BLUETOOTH_SCAN`, và scanner iOS sẽ cần quyền mà bài này đã xin.

!!! question "Hỏi agent của bạn"
    Nhờ agent lần theo một lần bấm "Allow Bluetooth" trên track Android của bạn, từ nút tới dòng chữ đỏ "denied": hàm nào chạy, trên object nào, và coroutine chờ ở đâu khi hộp thoại đang hiện. Rồi nhờ nó lần theo cùng lần bấm đó trên iOS, và chỉ ra một dòng nơi Kotlin gọi vào code Swift của bạn.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Người dùng bấm "Don't Allow" trên hộp thoại Bluetooth của iOS. App core nhận trạng thái nào?</p>
<div class="opts">
<button class="opt"><code>Denied</code>, để app có thể xin lại sau</button>
<button class="opt" data-correct><code>PermanentlyDenied</code>, vì iOS sẽ không hiện hộp thoại lại nữa</button>
<button class="opt"><code>Restricted</code>, vì người dùng không đổi được nó nữa</button>
</div>
<p class="feedback"></p>
<p class="why">iOS hỏi một lần: sau lần thử đầu "hệ thống nhớ lựa chọn của người dùng và không hỏi lại", nên đường quay lại duy nhất là Settings: đó là nghĩa của <code>PermanentlyDenied</code>. <code>Restricted</code> là một chính sách người dùng hoàn toàn không đổi được.</p>
</div>

<div class="quiz">
<p class="q">Vì sao adapter Android giữ trí nhớ về các lần từ chối trong <code>SharedPreferences</code>?</p>
<div class="opts">
<button class="opt">Android quên quyền runtime khi app bị force-stop</button>
<button class="opt" data-correct>"chưa cấp, không cần giải thích" có thể là "chưa bao giờ hỏi" hoặc "đã bị từ chối hẳn", và Android không nói là cái nào</button>
<button class="opt">để ViewModel sống sót qua process death</button>
</div>
<p class="feedback"></p>
<p class="why">Android giữ chính quyền đó. Thứ app không đọc lại được là người dùng đã từ chối hẳn hay chưa. Một hộp thoại bị đóng và một lần từ chối thứ hai trông như nhau từ API, và chỉ trí nhớ của adapter phân biệt được chúng.</p>
</div>

<div class="quiz">
<p class="q">Phần nào của app quyết định không hiện hộp thoại cho một quyền <code>Restricted</code>?</p>
<div class="opts">
<button class="opt">màn hình, bằng cách ẩn nút</button>
<button class="opt">adapter iOS, bằng cách trả về sớm</button>
<button class="opt" data-correct><code>PermissionService</code>, trong app core</button>
</div>
<p class="feedback"></p>
<p class="why">"Chỉ hiện hộp thoại khi hộp thoại hiện được" là một quy tắc của app, giống nhau trên cả hai nền tảng, nên nó nằm trong service, và <code>neverPromptsWhenOnlySettingsCanChangeIt</code> test nó. Các màn hình cũng ẩn nút, nhưng đó là phần trình bày.</p>
</div>

<div class="quiz">
<p class="q">Vì sao code UI Android lại đụng tới adapter quyền?</p>
<div class="opts">
<button class="opt" data-correct>chỉ một Activity hoặc một Fragment đăng ký nhận kết quả được, nên một trong số chúng cho adapter mượn launcher</button>
<button class="opt">màn hình đọc câu trả lời và báo cho ViewModel</button>
<button class="opt">Koin không tiêm được adapter vào ViewModel</button>
</div>
<p class="feedback"></p>
<p class="why">Việc đăng ký thuộc về Activity hoặc Fragment và phải xảy ra mỗi lần một cái được tạo. Nó đăng ký và cho mượn launcher; adapter mở launcher và đọc câu trả lời.</p>
</div>

<div class="quiz">
<p class="q">Trên track Compose, vì sao <code>MainActivity</code> gọi <code>attach</code> trước <code>setContent</code>?</p>
<div class="opts">
<button class="opt"><code>registerForActivityResult</code> ném lỗi một khi <code>setContent</code> đã chạy</button>
<button class="opt" data-correct>compose màn hình danh sách thì dựng ViewModel của nó, mà constructor đọc trạng thái, và chỉ một <code>Activity</code> đã gắn mới giúp adapter phân biệt được <code>Denied</code></button>
<button class="opt">Koin không khởi động được cho tới khi launcher được gắn</button>
</div>
<p class="feedback"></p>
<p class="why">Không có <code>Activity</code> thì adapter không hỏi được rationale, nên một quyền <code>Denied</code> đọc thành <code>PermanentlyDenied</code> hoặc <code>NotRequested</code>. Một composable gắn trong <code>DisposableEffect</code> chỉ gắn sau lần đọc đầu đó, và hàng sai có thể hiện trong những khung hình đầu.</p>
</div>

<div class="quiz">
<p class="q">Trong Swift, vì sao method tên là <code>__request</code> chứ không phải <code>request</code>?</p>
<div class="opts">
<button class="opt">Swift dành tên <code>request</code> cho việc tải URL</button>
<button class="opt" data-correct>SKIE đổi tên hàm suspend gốc để hàm bọc <code>async</code> của nó giữ được tên</button>
<button class="opt">hai dấu gạch dưới đánh dấu method là private trong module</button>
</div>
<p class="feedback"></p>
<p class="why">SKIE sinh <code>request(permissions:)</code> dưới dạng hàm <code>async</code> cho bên gọi, và "đổi tên hàm suspend gốc bằng cách thêm tiền tố <code>__</code>". Một class Swift implement interface Kotlin thì implement bản gốc.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Giờ ViewModel nhận hai port. Cái gì phải đổi trong <code>appModule</code> cho dòng ViewModel? (Bài 11)</p>
<div class="opts">
<button class="opt">một <code>get()</code> cho tham số mới trong <code>viewModelOf</code></button>
<button class="opt" data-correct>không gì cả: <code>viewModelOf(::DeviceListViewModel)</code> điền mọi tham số bằng <code>get()</code></button>
<button class="opt">một definition <code>factory</code> mới cho ViewModel</button>
</div>
<p class="feedback"></p>
<p class="why"><code>viewModelOf</code> nhận tham chiếu constructor. Thứ phải thêm là một binding cho mỗi kiểu mới nó xin: <code>PermissionAccess</code>, và <code>PermissionChecker</code> mà service của nó cần.</p>
</div>

<div class="quiz">
<p class="q">Khi quay về từ Settings, callback iOS nào báo một màn hình UIKit đọc lại quyền? (Bài 04)</p>
<div class="opts">
<button class="opt"><code>viewWillAppear</code>, vì màn hình hiện lại</button>
<button class="opt" data-correct>một sự kiện mức scene: scene active trở lại</button>
<button class="opt"><code>viewDidLoad</code>, vì iOS tải lại view</button>
</div>
<p class="feedback"></p>
<p class="why">Rời sang một app khác rồi quay lại là vòng đời mức app (scene). View controller ở trên màn hình suốt, nên các callback của view không chạy.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên bản build m07 của bạn)"
    1. **Đoán, rồi xem.** Trên emulator Android, gỡ app và cài lại. Trước mỗi bước, ghi ra thông báo và nút bạn đoán sẽ thấy, rồi làm: bấm Allow Bluetooth và nhấn Back; từ chối; từ chối lần nữa; force-stop và mở lại; cho phép trong Settings và quay lại. Rồi chạy `adb shell dumpsys package com.example.devicemonitor | grep BLUETOOTH_SCAN` sau mỗi lần từ chối và đối chiếu các cờ với bảng ở mục 4.
    2. **Viết một test.** Thêm `ignoresRequestPermissionWhileARequestIsRunning` vào `DeviceListViewModelTest`. Bạn sẽ cần `TestPermissionAccess` giữ một request mở cho tới khi test cho nó xong (một `CompletableDeferred` làm được), và đếm số request. Rồi cố tình phá quy tắc: xoá kiểm tra `isActive` trong `requestPermission`, và xem test của bạn fail trên cả hai nền tảng.
    3. **Thay adapter trên iOS.** Viết một class Swift `RestrictedPermissionChecker` implement `PermissionChecker` và luôn báo `.restricted`. Truyền nó vào `doInitKoin` thay cho cái thật, và chạy app trên Simulator. Đoán trước: nút "Allow Bluetooth" có hiện không? Có quét được không? Bạn đã động vào bao nhiêu file? Rồi hoàn tác.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy test và cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/12-permissions.html" -o .course/lesson-12.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html" -o .course/ref-architecture-di-testing-cheatsheet.html
Lessons 09 and 11, which this brief's warning list points to; skipped if they're already there:
  [ -f .course/lesson-09.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/09-kotlin-swift-with-skie.html" -o .course/lesson-09.html
  [ -f .course/lesson-11.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/11-testing-and-koin.html" -o .course/lesson-11.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 12 (Permissions): build milestone m07, the Bluetooth permission checked, requested
and shown on every path, through the PermissionAccess inbound port and PermissionChecker
outbound adapters, on top of m06.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m06 project in demo/ (Lesson 11). Use exactly the file contents shown in the
lesson's "Full files" section for my tracks, including package lines, imports and comments. All
paths are relative to demo/. Touch no file that isn't listed here.

1. Shared code, all tracks:
     shared/build.gradle.kts: replaced (androidMain gets androidx.activity).
     add, under shared/src/commonMain/kotlin/com/example/devicemonitor/:
       core/Permission.kt, core/PermissionService.kt, core/inbound/PermissionAccess.kt,
       core/outbound/PermissionChecker.kt
     replaced, same folder: adapter/inbound/DeviceListUiState.kt,
       adapter/inbound/DeviceListViewModel.kt, di/AppModule.kt
     add shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/
       AndroidPermissionChecker.kt
     under shared/src/commonTest/kotlin/com/example/devicemonitor/:
       add doubles/FakePermissionChecker.kt, doubles/TestPermissionAccess.kt,
       core/PermissionServiceTest.kt; replace adapter/inbound/DeviceListViewModelTest.kt and
       di/AppModuleTest.kt
   Every other file in shared/ stays as in m06.

2. Android, both tracks: androidApp/src/main/AndroidManifest.xml (my track's) and
   androidApp/src/main/java/com/example/devicemonitor/android/DeviceMonitorApplication.kt:
   replaced. androidApp/build.gradle.kts stays as in m06.
     Compose: MainActivity.kt and DeviceListScreen.kt: replaced.
     XML: DeviceListFragment.kt and res/layout/fragment_device_list.xml: replaced.
   iOS, both tracks: add iosApp/iosApp/IosPermissionChecker.swift; iosApp/project.yml:
   replaced (my track's). Then run `xcodegen generate` in iosApp/: it adds the new Swift file
   to the Xcode project and writes NSBluetoothAlwaysUsageDescription into iosApp/iosApp/Info.plist.
   Do NOT edit Info.plist or the .xcodeproj by hand.
     SwiftUI: iOSApp.swift and DeviceListView.swift: replaced.
     UIKit: AppDelegate.swift and DeviceListViewController.swift: replaced.
   Every other Android and iOS file stays as in m06.

3. Test, then build both apps. From demo/:
     ./gradlew :shared:allTests
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Run on an emulator with Android 12 or newer (API 31+). Install it fresh, so that no
   earlier answer is remembered:
     adb uninstall com.example.devicemonitor; adb install androidApp/build/outputs/apk/debug/androidApp-debug.apk
     adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   iOS, from demo/iosApp/ (pick an installed iPhone simulator on iOS 17 or newer; if two
   share a name, use id=<UDID>):
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' -derivedDataPath build build
   Run: `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/iosApp.app`, then
     `xcrun simctl launch booted com.example.devicemonitor`.

Acceptance checks (run every one you can, on an emulator and a simulator):
- ./gradlew :shared:allTests runs BOTH testAndroidHostTest and iosSimulatorArm64Test (show me
  the task lines), and all 16 tests pass on each: 5 in ScanningServiceTest, 6 in
  DeviceListViewModelTest, 4 in PermissionServiceTest, 1 in AppModuleTest. Show the counts from
  the XML files in shared/build/test-results/.
- All builds succeed with no compiler warnings (w: / warning:) from our own Kotlin or Swift
  code, test code included (never use -q: it hides w: lines; read the output). Not from our
  code, and expected: the same lines as in Lesson 11's brief (SKIE's "Configuration '…' was
  resolved during configuration time", SLF4J "Failed to load class", Gradle's "Deprecated
  Gradle features … Gradle 10", "Unable to strip the following libraries", Xcode's
  "appintentsmetadataprocessor … warning: Metadata extraction skipped", xcodebuild's
  "WARNING: Using the first of multiple matching destinations", and Gradle's "The Daemon will
  expire …"). Xcode "note:" lines are not warnings.
- The app core stays platform-free:
    grep -rn 'import android\|import platform\.\|import org.koin' shared/src/commonMain/kotlin/com/example/devicemonitor/core
  finds nothing. The exported header declares the new entry point and still no Koin types:
    grep -c 'doInitKoinPermissionChecker' shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
  prints 1, and grep -c 'Koin_core' on the same file prints 0 (build that framework first
  with ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 if it isn't there).
- Android, every path, in this order, from the fresh install above (the row's texts are the
  lesson's; the XML buttons show their text in capitals, so match case-insensitively):
  1. Launch: "Device Monitor needs Bluetooth permission to find nearby devices." with an
     "Allow Bluetooth" button, and Scan is disabled.
  2. Tap Allow Bluetooth: the system dialog "Allow Device Monitor to find, connect to, and
     determine the relative position of nearby devices?" appears. Press Back
     (adb shell input keyevent KEYCODE_BACK): the row is unchanged (still Allow Bluetooth).
  3. Tap Allow Bluetooth, then "Don't allow": red "Bluetooth permission was denied. Scanning
     needs it to find nearby devices." with "Ask again".
  4. Tap Ask again, then "Don't allow": red "Bluetooth permission is off. You can turn it on in
     Settings." with "Open Settings".
  5. adb shell am force-stop com.example.devicemonitor, then launch again: still "is off" +
     Open Settings.
  6. Tap Open Settings: Settings opens on the app's App info page. Press Back: still "is off".
  7. Press Home, then
       adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_SCAN
       adb shell pm grant com.example.devicemonitor android.permission.BLUETOOTH_CONNECT
     and bring the app back (the am start line above): "Bluetooth permission: allowed", Scan
     enabled. Tap Scan: rows appear one at a time and the status ends "Devices found: 5".
  8. Fresh install again, tap Allow Bluetooth, and while the dialog is up rotate the emulator
     (adb shell settings put system accelerometer_rotation 0; adb shell settings put system
     user_rotation 1). Tap "Allow" in the dialog: the row says "Bluetooth permission: allowed".
     Rotate back with user_rotation 0.
  9. The first frame: fresh install again, tap Allow Bluetooth, then "Don't allow". Record a
     cold start three times:
       adb shell am force-stop com.example.devicemonitor
       adb shell screenrecord --time-limit 6 /sdcard/rec.mp4 &   (wait a second)
       adb shell am start -W -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
     then adb pull /sdcard/rec.mp4 and extract every frame (ffmpeg -i rec.mp4 -vf setpts=N/TB
     -fps_mode passthrough f%03d.png). Show me the first frames in which the permission row is visible:
     in every recording, every such frame says "Bluetooth permission was denied…" with Ask
     again, never "is off" or "needs Bluetooth permission".
  After each refusal, show me the flags from
    adb shell dumpsys package com.example.devicemonitor | grep BLUETOOTH_SCAN
  (USER_SET after the first, USER_SET|USER_FIXED after the second).
- Android, driving the emulator: find buttons with `adb shell uiautomator dump`. The dialog's
  "Allow Device Monitor to …" title also starts with "Allow", so tap the node whose text is
  exactly "Allow". The refusing button is "Don’t allow" with a typographic apostrophe
  (U+2019), not a straight one: match it exactly, or by its prefix "Don".
  To read whether Scan is enabled in the Compose track's dump, look at the clickable node
  just before the "Scan" text (its enabled="false"): the text node itself always says true. A dump takes about 2 s: wait for the screen you expect before the next tap.
  Before step 6, close any Settings left open by an earlier session (adb shell am force-stop com.android.settings; adb shell am force-stop com.google.android.permissioncontroller): otherwise Open Settings can land inside that old Settings task, on another page, and Back then stays in Settings instead of returning to the app.
- Optional, if you have an emulator with Android 11 (API 30): the same steps ask for location
  instead ("Allow Device Monitor to access this device's location?", with "While using the
  app", "Only this time" and "Deny"), and every step's row matches. Grant with
  android.permission.ACCESS_FINE_LOCATION in step 7.
- iOS Simulator, both tracks: launch shows "Bluetooth permission: allowed" and Scan enabled
  (the Simulator always reports Bluetooth as allowed; lesson section 6). If you can drive the
  simulator (idb, or a throwaway XCUITest that launches the installed app by bundle ID; don't
  script the Simulator window with System Events), tap Scan: five rows, "Devices found: 5".
  Don't try to reach the other iOS paths on the Simulator. List them as device checks: the
  prompt on Allow Bluetooth, "Don't Allow" → "is off" + Open Settings, Settings → back →
  "allowed".
Then walk me through each new or changed file line by line, tied to the lesson's walkthrough
numbers, and show me where each box of the lesson's "who talks to whom" diagram is in the code.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android: [Request runtime permissions](https://developer.android.com/training/permissions/requesting) (nguồn chính), [Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions), [Android 11 permission updates](https://developer.android.com/about/versions/11/privacy/permissions) (thay đổi "don't ask again" và các cờ `USER_SET`/`USER_FIXED`), [Get a result from an activity](https://developer.android.com/training/basics/intents/result), và mục [requesting runtime permissions](https://developer.android.com/develop/ui/compose/libraries) của Compose.
- iOS: [CBManagerAuthorization](https://developer.apple.com/documentation/corebluetooth/cbmanagerauthorization) (nguồn chính), [CBManager.authorization](https://developer.apple.com/documentation/corebluetooth/cbmanager/authorization-swift.type.property), [Requesting access to protected resources](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources), [NSBluetoothAlwaysUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsbluetoothalwaysusagedescription), và Human Interface Guidelines về [quyền riêng tư](https://developer.apple.com/design/human-interface-guidelines/privacy).
- Kotlin và Swift: [Interoperability with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html) (hàm suspend, enum), [suspend functions](https://skie.touchlab.co/features/suspend) và [enums](https://skie.touchlab.co/features/enums) của SKIE, và [SE-0423](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0423-dynamic-actor-isolation.md) (tuân theo protocol với `@preconcurrency`).
- [Cheatsheet: the hexagon, Koin and tests](https://phongna-inn.github.io/carmd-kmp-course/reference/architecture-di-testing-cheatsheet.html): mỗi file mới của bài này thuộc về đâu.
- Kinh nghiệm thực tế: trên [r/androiddev](https://reddit.com/r/androiddev), tìm "shouldShowRequestPermissionRationale permanently denied" để xem các team khác phân biệt một lần từ chối vĩnh viễn với lần xin đầu tiên ra sao.

## File đầy đủ

Mọi file bài này thêm hoặc sửa, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Không file nào bị xoá, và mọi thứ khác giữ như ở m06. `iosApp/iosApp/Info.plist` và `iosApp/iosApp.xcodeproj` được sinh bởi `xcodegen generate` từ `project.yml`.

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
            androidMain.dependencies {
                implementation("androidx.activity:activity:1.13.0")
            }
            commonTest.dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
                implementation("app.cash.turbine:turbine:1.2.1")
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/Permission.kt"
    ```kotlin
    package com.example.devicemonitor.core

    // A permission the app needs, in the app's terms. Each platform's adapter maps it to its
    // own: Bluetooth is two runtime permissions on Android 12 and later, one on iOS.
    enum class Permission { Bluetooth }

    // Where a permission stands, in terms of what the user can do next.
    enum class PermissionStatus {
        NotRequested,      // not asked yet: a request shows the system prompt
        Denied,            // refused, and the app may ask again (Android only)
        PermanentlyDenied, // refused, and the system won't ask again: only Settings can change it
        Restricted,        // blocked by a policy the user can't change, such as parental controls (iOS)
        Granted,
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/inbound/PermissionAccess.kt"
    ```kotlin
    package com.example.devicemonitor.core.inbound

    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus

    // Inbound port: what the app offers for the permissions it needs. The shared ViewModels
    // call it, and PermissionService implements it.
    interface PermissionAccess {
        // Where the permission stands now. Never shows a prompt.
        fun status(permission: Permission): PermissionStatus

        // Asks the user for each permission the system can still prompt for, and returns where
        // every one of them stands afterwards. Suspends while the system prompt is on screen.
        suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus>

        // Opens this app's page in the system Settings: the only way back from PermanentlyDenied.
        fun openSettings()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/outbound/PermissionChecker.kt"
    ```kotlin
    package com.example.devicemonitor.core.outbound

    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus

    // Outbound port: what the app needs from the OS's permission system, in the app's terms.
    // One adapter per platform: Kotlin in androidMain, Swift in the iOS app.
    interface PermissionChecker {
        // Reads the permission's status from the OS. Never shows a prompt.
        fun check(permission: Permission): PermissionStatus

        // Shows the system prompt for these permissions and returns each one's status after the
        // user answers.
        suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus>

        // Opens this app's page in the system Settings.
        fun openSettings()
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/core/PermissionService.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.core.outbound.PermissionChecker

    // Service: the app's permission rules. Prompt only for what the system can still prompt
    // for: never for a permission that is granted, permanently denied or restricted.
    class PermissionService(private val checker: PermissionChecker) : PermissionAccess {
        override fun status(permission: Permission): PermissionStatus = checker.check(permission)

        override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
            val before = permissions.associateWith { checker.check(it) }
            val askable = before.filterValues { it in ASKABLE }.keys.toList()
            if (askable.isEmpty()) return before
            return before + checker.request(askable)
        }

        override fun openSettings() = checker.openSettings()

        private companion object {
            val ASKABLE = setOf(PermissionStatus.NotRequested, PermissionStatus.Denied)
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/adapter/inbound/DeviceListUiState.kt"
    ```kotlin
    package com.example.devicemonitor.adapter.inbound

    import com.example.devicemonitor.core.Device
    import com.example.devicemonitor.core.PermissionStatus

    // Everything the device list shows that the user didn't type.
    data class DeviceListUiState(
        val bluetooth: PermissionStatus = PermissionStatus.NotRequested,
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
            val SCAN_TIMEOUT = 3.seconds
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/di/AppModule.kt"
    ```kotlin
    package com.example.devicemonitor.di

    import com.example.devicemonitor.adapter.inbound.DeviceListViewModel
    import com.example.devicemonitor.adapter.outbound.SimulatedBleScanner
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
        single<BleScanner> { SimulatedBleScanner() }
        single<DeviceScanning> { ScanningService(get()) }
        single<PermissionAccess> { PermissionService(get()) }
        viewModelOf(::DeviceListViewModel)
    }

    // The outbound adapters that each platform builds itself and passes to initKoin.
    internal fun platformModule(permissionChecker: PermissionChecker) = module {
        single { permissionChecker }
    }

    // Call once, when the app process starts (Android: Application.onCreate; iOS: at launch).
    fun initKoin(permissionChecker: PermissionChecker) {
        startKoin {
            modules(appModule, platformModule(permissionChecker))
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
        // needed fine location instead.
        private fun Permission.androidNames(): List<String> = when (this) {
            Permission.Bluetooth ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
                } else {
                    listOf(Manifest.permission.ACCESS_FINE_LOCATION)
                }
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/FakePermissionChecker.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.outbound.PermissionChecker

    // Fake: an outbound adapter written for tests, behind the PermissionChecker port. The test
    // plays the OS and the user: it sets each status, and the answer the user gives a prompt.
    class FakePermissionChecker : PermissionChecker {
        val statuses = mutableMapOf<Permission, PermissionStatus>()
        var answer = PermissionStatus.Granted
        val prompts = mutableListOf<List<Permission>>() // one entry per system prompt shown
        var settingsOpened = 0

        override fun check(permission: Permission): PermissionStatus =
            statuses[permission] ?: PermissionStatus.NotRequested

        override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
            prompts += permissions
            permissions.forEach { statuses[it] = answer }
            return permissions.associateWith { answer }
        }

        override fun openSettings() {
            settingsOpened++
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/doubles/TestPermissionAccess.kt"
    ```kotlin
    package com.example.devicemonitor.doubles

    import com.example.devicemonitor.core.Permission
    import com.example.devicemonitor.core.PermissionStatus
    import com.example.devicemonitor.core.inbound.PermissionAccess

    // Test implementation of the PermissionAccess inbound port, for ViewModel tests. The test
    // decides what status() reports and what a request ends with.
    class TestPermissionAccess : PermissionAccess {
        var current = PermissionStatus.NotRequested
        var answer = PermissionStatus.Granted
        var settingsOpened = 0

        override fun status(permission: Permission): PermissionStatus = current

        override suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
            current = answer
            return permissions.associateWith { answer }
        }

        override fun openSettings() {
            settingsOpened++
        }
    }
    ```

??? example "shared/src/commonTest/kotlin/com/example/devicemonitor/core/PermissionServiceTest.kt"
    ```kotlin
    package com.example.devicemonitor.core

    import com.example.devicemonitor.core.inbound.PermissionAccess
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import kotlinx.coroutines.test.runTest
    import kotlin.test.Test
    import kotlin.test.assertEquals

    class PermissionServiceTest {
        private val os = FakePermissionChecker()

        // Through the inbound port, as the ViewModel calls it.
        private val permissions: PermissionAccess = PermissionService(os)

        @Test
        fun aGrantedPermissionNeedsNoPrompt() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Granted

            val result = permissions.request(listOf(Permission.Bluetooth))

            assertEquals(mapOf(Permission.Bluetooth to PermissionStatus.Granted), result)
            assertEquals(emptyList(), os.prompts)
        }

        @Test
        fun promptsWhenNotRequestedAndReturnsTheAnswer() = runTest {
            os.answer = PermissionStatus.Denied

            val result = permissions.request(listOf(Permission.Bluetooth))

            assertEquals(PermissionStatus.Denied, result[Permission.Bluetooth])
            assertEquals(listOf(listOf(Permission.Bluetooth)), os.prompts)
        }

        @Test
        fun promptsAgainAfterADenial() = runTest {
            os.statuses[Permission.Bluetooth] = PermissionStatus.Denied
            os.answer = PermissionStatus.Granted

            val result = permissions.request(listOf(Permission.Bluetooth))

            assertEquals(PermissionStatus.Granted, result[Permission.Bluetooth])
            assertEquals(1, os.prompts.size)
        }

        @Test
        fun neverPromptsWhenOnlySettingsCanChangeIt() = runTest {
            for (blocked in listOf(PermissionStatus.PermanentlyDenied, PermissionStatus.Restricted)) {
                os.statuses[Permission.Bluetooth] = blocked

                val result = permissions.request(listOf(Permission.Bluetooth))

                assertEquals(blocked, result[Permission.Bluetooth])
            }
            assertEquals(emptyList(), os.prompts)
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
    import com.example.devicemonitor.doubles.FakePermissionChecker
    import org.koin.dsl.koinApplication
    import kotlin.test.Test
    import kotlin.test.assertNotNull

    class AppModuleTest {
        // Koin checks the graph only when something asks for an instance, at run time. This
        // test asks for every screen's ViewModel, so a missing binding fails here, not in the app.
        // A fake stands in for the adapter each platform passes to initKoin.
        @Test
        fun buildsEveryViewModel() {
            val koin = koinApplication {
                modules(appModule, platformModule(FakePermissionChecker()))
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
            initKoin(permissionChecker)
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
                Button(
                    onClick = onScan,
                    enabled = !isScanning && bluetooth == PermissionStatus.Granted,
                    modifier = Modifier.fillMaxWidth(),
                ) {
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.os.Bundle
        import androidx.activity.ComponentActivity
        import androidx.activity.compose.setContent
        import androidx.activity.enableEdgeToEdge
        import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
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

            override fun onCreate(savedInstanceState: Bundle?) {
                enableEdgeToEdge()
                super.onCreate(savedInstanceState)
                // Before setContent: the list screen's ViewModel reads the permission as soon as the
                // screen is composed, and the adapter needs this Activity to read it right.
                permissionChecker.attach(this, permissionLauncher)
                setContent {
                    MaterialTheme {
                        DeviceMonitorApp()
                    }
                }
            }

            override fun onDestroy() {
                permissionChecker.detach(permissionLauncher)
                super.onDestroy()
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
                b.scanButton.isEnabled = !isScanning && state.bluetooth == PermissionStatus.Granted
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
                app:layout_constraintEnd_toEndOf="parent"
                app:layout_constraintTop_toTopOf="parent" />

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
                app:layout_constraintTop_toBottomOf="@id/title" />

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

**iOS**

??? example "iosApp/iosApp/IosPermissionChecker.swift · both iOS tracks"
    ```swift
    import CoreBluetooth
    import Shared
    import UIKit

    // Outbound adapter: Bluetooth permission on iOS, behind the Kotlin PermissionChecker port.
    // iOS has one Bluetooth permission. Reading CBManager.authorization never prompts; the
    // prompt appears when the app first uses Bluetooth, here by creating a CBCentralManager.
    @MainActor
    final class IosPermissionChecker: NSObject, @preconcurrency PermissionChecker,
        @preconcurrency CBCentralManagerDelegate {
        private var manager: CBCentralManager?
        private var waiting: [CheckedContinuation<Void, Never>] = []

        func check(permission: Permission) -> PermissionStatus {
            Self.bluetoothStatus()
        }

        // The Kotlin suspend fun. SKIE keeps the name `request` for the async function Swift
        // calls, so the one Swift implements is `__request`.
        func __request(permissions: [Permission]) async throws -> [Permission: PermissionStatus] {
            if CBManager.authorization == .notDetermined {
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
            let status = Self.bluetoothStatus()
            return Dictionary(uniqueKeysWithValues: permissions.map { ($0, status) })
        }

        func openSettings() {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
            UIApplication.shared.open(url)
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

    ??? example "iosApp/iosApp/iOSApp.swift"
        ```swift
        import SwiftUI
        import Shared

        @main
        struct iOSApp: App {
            init() {
                AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker())
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
            let onAllow: () -> Void
            let onOpenSettings: () -> Void

            var body: some View {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Device name filter", text: $filter)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    PermissionRow(status: bluetooth, onAllow: onAllow, onOpenSettings: onOpenSettings)
                    Button(action: onScan) {
                        Text("Scan")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isScanning || bluetooth != .granted)
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

    ??? example "iosApp/iosApp/AppDelegate.swift"
        ```swift
        import UIKit
        import Shared

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            func application(_ application: UIApplication,
                             didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
                AppModuleKt.doInitKoin(permissionChecker: IosPermissionChecker())
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
                scanButton.isEnabled = !isScanning && state.bluetooth == .granted
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
Ví dụ có output ở A3 và A5 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0). Chúng là **mô hình** rút gọn: không có Android, iOS hay hộp thoại thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-nam-trang-thai-nhu-chuyen-muon-o): năm trạng thái quyền như chuyện mượn đồ (mục 1).
    3. [A3](#a3-quy-tac-chi-hoi-khi-hoi-uoc-chay-that): quy tắc "chỉ hỏi khi hỏi được" và phép `+` trên map, chạy thật (mục 2).
    4. [A4](#a4-adapter-android-oan-trang-thai-tu-ba-manh-moi): adapter Android đoán trạng thái từ ba manh mối (mục 4).
    5. [A5](#a5-cho-mot-cau-tra-loi-toi-sau-completabledeferred-chay-that): chờ câu trả lời bằng `CompletableDeferred`, cạnh Swift và JS (mục 4, 6).
    6. [A6](#a6-vi-sao-phai-cho-muon-launcher): vì sao phải "cho mượn" launcher (mục 5).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Không hệ điều hành nào cho app dùng Bluetooth khi người dùng chưa đồng ý; app phải **khai báo** (manifest, `Info.plist`) rồi mới **xin**.
    2. App core có **năm từ của riêng nó** (`NotRequested`, `Denied`, `PermanentlyDenied`, `Restricted`, `Granted`), chọn theo việc người dùng làm được tiếp theo; mỗi adapter dịch từ của nền tảng sang.
    3. `PermissionService` giữ một quy tắc: **chỉ hiện hộp thoại khi hộp thoại hiện được** (`NotRequested`, `Denied`).
    4. Android không nói thẳng "đã từ chối vĩnh viễn", nên adapter đoán từ `checkSelfPermission`, `shouldShowRequestPermissionRationale` và **trí nhớ riêng** trong `SharedPreferences`; và nó cần một `Activity` cho mượn launcher.
    5. iOS: adapter là **class Swift implement interface Kotlin**, đọc `CBManager.authorization`, và tạo `CBCentralManager` để hộp thoại hiện ra.

Ví dụ đời thường cho cả bài: **mượn chìa khoá xe của bố.** Chưa hỏi lần nào là `NotRequested`. Hỏi, bố bảo "không" nhưng còn hỏi lại được là `Denied` (chỉ Android có kiểu bố dễ tính này). Bố bảo "đừng hỏi nữa" là `PermanentlyDenied`: muốn đổi thì phải tự vào "phòng bố" (Settings). Xe đang bị ông bà giữ, bố cũng không quyết được là `Restricted`. Bố đưa chìa là `Granted`. Và bố có thể lấy lại chìa bất cứ lúc nào, nên trước mỗi lần lái phải xem lại mình còn chìa không.

| Chữ trong bài | Nói đơn giản | Trong m07 là |
|---|---|---|
| runtime permission | quyền xin lúc app đang chạy, người dùng bấm đồng ý | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` |
| usage string | câu giải thích iOS hiện trong hộp thoại; thiếu là crash | `NSBluetoothAlwaysUsageDescription` |
| rationale | Android gợi ý "nên giải thích trước khi xin lại" | `shouldShowRequestPermissionRationale` |
| `USER_SET` / `USER_FIXED` | cờ Android đánh sau 1 / 2 lần từ chối; app không đọc được | xem bằng `adb shell dumpsys package` |
| `PermissionAccess` | inbound port: thứ ViewModel gọi | `PermissionService` implement |
| `PermissionChecker` | outbound port: thứ app cần từ hệ điều hành | `AndroidPermissionChecker`, `IosPermissionChecker` |
| result launcher | cái "nút bấm" mở hộp thoại hệ thống và nhận kết quả | `registerForActivityResult(RequestMultiplePermissions())` |
| `CompletableDeferred` | một giá trị sẽ tới sau, `await()` để chờ | chờ câu trả lời của hộp thoại |
| `withCheckedContinuation` | cách Swift chờ một callback trả lời đúng một lần | chờ `centralManagerDidUpdateState` |
| `__request` | tên gốc của hàm suspend sau khi SKIE đổi tên | method Swift implement `request` |

### A2. Năm trạng thái như chuyện mượn đồ

Giải thích thêm cho [mục 1](#1-mot-quyen-hai-he-ieu-hanh).

| Trạng thái của app | Android nói | iOS nói | Người dùng làm được gì tiếp | App hiện |
|---|---|---|---|---|
| `NotRequested` | chưa cấp, không rationale, adapter chưa nhớ lần từ chối nào | `notDetermined` | trả lời hộp thoại | Allow Bluetooth |
| `Denied` | chưa cấp, rationale `true` | (không có) | trả lời hộp thoại lần nữa | Ask again |
| `PermanentlyDenied` | chưa cấp, không rationale, adapter **nhớ** đã bị từ chối | `denied` | chỉ còn Settings | Open Settings |
| `Restricted` | (không có) | `restricted` | không gì cả | chỉ một dòng chữ |
| `Granted` | đã cấp | `allowedAlways` | không cần gì | Scan được bật |

Điểm dễ nhầm: `denied` của iOS **không** ánh xạ sang `Denied` của app. iOS chỉ hỏi một lần, nên một lần "Don't Allow" đã là `PermanentlyDenied`. App đặt tên theo **việc người dùng làm được tiếp theo**, không theo tên của nền tảng.

So với TS/JS: Web Permissions API có `navigator.permissions.query({ name: "geolocation" })` trả `"granted" | "denied" | "prompt"`. `"prompt"` gần với `NotRequested`; Web không có `Denied`-còn-hỏi-lại như Android.

### A3. Quy tắc "chỉ hỏi khi hỏi được", chạy thật

Giải thích thêm cho [mục 2](#2-cac-port-va-service). Mô hình dùng đúng thân hàm `request` của `PermissionService` trong bài, với một fake ghi lại mỗi lần hộp thoại "hiện" và người dùng luôn bấm cho phép. App xin hai quyền một lúc: Bluetooth (đổi trạng thái đầu qua từng dòng) và Camera (đã `Granted`):

```kotlin title="L12Rule.kt (mô hình, không có trong app)"
class PermissionService(private val checker: PermissionChecker) {
    suspend fun request(permissions: List<Permission>): Map<Permission, PermissionStatus> {
        val before = permissions.associateWith { checker.check(it) }
        val askable = before.filterValues { it in ASKABLE }.keys.toList()
        if (askable.isEmpty()) return before
        return before + checker.request(askable)
    }

    private companion object {
        val ASKABLE = setOf(PermissionStatus.NotRequested, PermissionStatus.Denied)
    }
}

fun main() = runBlocking {
    for (start in PermissionStatus.entries) {
        val fake = FakeChecker(mutableMapOf(Permission.Bluetooth to start, Permission.Camera to PermissionStatus.Granted), PermissionStatus.Granted)
        val result = PermissionService(fake).request(listOf(Permission.Bluetooth, Permission.Camera))
        println("%-18s hộp thoại: %-12s kết quả: %s".format(start, fake.prompts.firstOrNull() ?: "không", result))
    }
}
```

Output thật:

```text
NotRequested       hộp thoại: [Bluetooth]  kết quả: {Bluetooth=Granted, Camera=Granted}
Denied             hộp thoại: [Bluetooth]  kết quả: {Bluetooth=Granted, Camera=Granted}
PermanentlyDenied  hộp thoại: không        kết quả: {Bluetooth=PermanentlyDenied, Camera=Granted}
Restricted         hộp thoại: không        kết quả: {Bluetooth=Restricted, Camera=Granted}
Granted            hộp thoại: không        kết quả: {Bluetooth=Granted, Camera=Granted}
```

1. **Chỉ hai dòng đầu hiện hộp thoại**, và chỉ cho Bluetooth: Camera đã `Granted` nên không bao giờ được chuyển cho adapter.
2. **Kết quả luôn có đủ hai quyền.** `before + checker.request(askable)` giữ Camera từ `before`, và lấy Bluetooth mới từ câu trả lời (map bên phải ghi đè map bên trái).
3. **Ba dòng cuối trả nguyên `before`**: không hộp thoại, không đổi gì. Đó là điều test `neverPromptsWhenOnlySettingsCanChangeIt` kiểm tra bằng `prompts`.

So với TS/JS: `before + answers` giống `{ ...before, ...answers }`: cùng khoá thì bên phải thắng.

### A4. Adapter Android đoán trạng thái từ ba manh mối

Giải thích thêm cho [mục 4](#4-adapter-android). Android chỉ trả lời "cấp hay chưa". Adapter ghép thêm hai manh mối để ra năm chữ của app:

| `isGranted` | `shouldShowRationale` | Trí nhớ `refusals` | Trạng thái | Chuyện gì đã xảy ra |
|---|---|---|---|---|
| có | (không cần hỏi) | (không cần) | `Granted` | đã cho phép |
| không | có | (ghi nhớ lần từ chối) | `Denied` | từ chối một lần, hoặc tắt trong Settings |
| không | không | có nhớ | `PermanentlyDenied` | từ chối hai lần |
| không | không | không nhớ | `NotRequested` | chưa hỏi, hoặc mới đóng hộp thoại bằng Back |

Vì sao cần trí nhớ? Hai dòng cuối giống hệt nhau từ phía API: "chưa cấp, không rationale". Thiếu trí nhớ, adapter phải đoán bừa, và gotcha của mục 4 cho thấy cả hai cách đoán đều sai trong một trường hợp: đóng hộp thoại bằng Back bị đọc thành "vào Settings đi", hoặc từ chối vĩnh viễn sau khi khởi động nguội bị đọc thành "Allow" mà bấm không ra hộp thoại.

Vì sao cần `Activity`? `shouldShowRequestPermissionRationale` là hàm của `ActivityCompat`, nó cần một `Activity`. Không có thì cột thứ hai luôn là "không", và `Denied` sẽ rơi xuống một trong hai dòng dưới. Đó là lý do `MainActivity` gắn trước `setContent` (mục 5).

### A5. Chờ một câu trả lời tới sau: `CompletableDeferred`, chạy thật

Giải thích thêm cho [mục 4](#4-adapter-android) và [mục 6](#6-adapter-ios-bang-swift). Mô hình của `AndroidPermissionChecker.request`: hàm `ask()` treo ở `await()` cho tới khi "hộp thoại" gọi `onResult`:

```kotlin title="L12Deferred.kt (mô hình, không có trong app)"
class Dialog {
    private var pending: CompletableDeferred<Boolean>? = null
    suspend fun ask(): Boolean {
        val answer = CompletableDeferred<Boolean>()
        pending = answer
        println("  hộp thoại hiện, coroutine treo ở await()")
        return answer.await()
    }
    fun onResult(granted: Boolean) {
        println("  onResult($granted) gọi complete")
        pending?.complete(granted)
        pending = null
    }
}

fun main() = runBlocking {
    val dialog = Dialog()
    val job = launch { println("câu trả lời: ${dialog.ask()}") }
    delay(100)
    println("main thread vẫn rảnh: in được dòng này trong lúc chờ")
    dialog.onResult(false)
    job.join()
}
```

Output thật:

```text
  hộp thoại hiện, coroutine treo ở await()
main thread vẫn rảnh: in được dòng này trong lúc chờ
  onResult(false) gọi complete
câu trả lời: false
```

Ba ngôn ngữ, cùng một ý "một giá trị sẽ tới sau":

| Kotlin (Android adapter) | Swift (iOS adapter) | TypeScript |
|---|---|---|
| `val d = CompletableDeferred<T>()` | `withCheckedContinuation { cont in … }` | `new Promise<T>(resolve => …)` |
| `d.await()` | `await` trước `withCheckedContinuation` | `await promise` |
| `d.complete(value)` trong `onResult` | `cont.resume()` trong `centralManagerDidUpdateState` | `resolve(value)` trong callback |
| gọi `complete` lần hai: bị bỏ qua | gọi `resume` lần hai: **crash** | gọi `resolve` lần hai: bị bỏ qua |

Dòng cuối là chỗ Swift khắt khe nhất: "phải gọi resume đúng một lần trên mọi nhánh". Vì vậy adapter iOS giữ danh sách continuation đang chờ và xoá nó ngay sau khi resume.

### A6. Vì sao phải "cho mượn" launcher

Giải thích thêm cho [mục 5](#5-android-cho-adapter-muon-mot-launcher).

Ví dụ đời thường: adapter là **lễ tân khách sạn** làm việc suốt năm (sống bằng process). Hộp thoại quyền là **chuông cửa phòng khách**: chỉ khách đang ở phòng (một `Activity` hay `Fragment` đang sống) mới gắn được chuông, và phải gắn lại mỗi khi có khách mới vào phòng (mỗi lần Activity được tạo, kể cả sau khi xoay). Nên khách gắn chuông rồi **đưa dây chuông cho lễ tân** (`attach`), khi trả phòng thì lấy lại (`detach`). Lễ tân là người bấm chuông và nghe câu trả lời; khách không quyết định gì.

| | Compose | XML |
|---|---|---|
| Ai đăng ký launcher | `MainActivity`, một property | `DeviceListFragment`, một property |
| `attach` lúc nào | `onCreate`, **trước** `setContent` | `onStart` |
| `detach` lúc nào | `onDestroy` | `onStop` |
| Vì sao như vậy | composable không cho mượn được trước khi được compose, mà compose là lúc ViewModel đọc trạng thái | Fragment tự đăng ký được; ViewModel được chạm lần đầu sau `onStart` |

Xoay màn hình khi hộp thoại đang hiện: Activity cũ chết, Activity mới đăng ký launcher mới và cho mượn lại; câu trả lời vẫn tới launcher mới, và coroutine đang chờ trong adapter (sống lâu hơn Activity) nhận được nó.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 13.

- [ ] Kể được năm trạng thái quyền của app core và trạng thái nào chỉ Android hoặc chỉ iOS có (xem [A2](#a2-nam-trang-thai-nhu-chuyen-muon-o)).
- [ ] Giải thích vì sao `denied` của iOS ánh xạ sang `PermanentlyDenied` chứ không phải `Denied`.
- [ ] Khai báo đủ quyền Bluetooth trong manifest (cả `maxSdkVersion="30"` và `neverForLocation`) và chuỗi giải thích trong `project.yml` / `Info.plist`.
- [ ] Phân biệt `PermissionAccess` (inbound) và `PermissionChecker` (outbound), và nói vì sao quy tắc "chỉ hỏi khi hỏi được" nằm trong service (xem [A3](#a3-quy-tac-chi-hoi-khi-hoi-uoc-chay-that)).
- [ ] Đọc bảng ba manh mối và nói adapter Android trả trạng thái nào, kể cả sau khi đóng hộp thoại bằng Back (xem [A4](#a4-adapter-android-oan-trang-thai-tu-ba-manh-moi)).
- [ ] Viết một hàm suspend chờ callback bằng `CompletableDeferred` (Kotlin) và `withCheckedContinuation` (Swift) (xem [A5](#a5-cho-mot-cau-tra-loi-toi-sau-completabledeferred-chay-that)).
- [ ] Giải thích vì sao code UI Android phải cho adapter mượn launcher và `Activity`, và vì sao trên Compose phải gắn trước `setContent` (xem [A6](#a6-vi-sao-phai-cho-muon-launcher)).
- [ ] Viết một class Swift implement một interface Kotlin, kể cả `@MainActor`, `@preconcurrency` và tên `__request`.
- [ ] Truyền adapter của nền tảng vào `initKoin(permissionChecker)` / `doInitKoin(permissionChecker:)`.
- [ ] Đọc lại quyền khi app quay về foreground trên track của mình (`ON_RESUME`, `onStart`, `scenePhase`, `didActivateNotification`).
- [ ] Biết giới hạn của Simulator iOS với quyền Bluetooth và những gì phải kiểm tra trên iPhone thật.
- [ ] Làm xong 3 bài tự làm ở trên mà không cần agent.
