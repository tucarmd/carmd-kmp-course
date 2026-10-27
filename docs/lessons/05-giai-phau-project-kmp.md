---
source: lessons/05-anatomy-of-a-kmp-project.html
source_ref: live
source_sha: a14043e
---

# Giải phẫu một project KMP

<p class="kicker">Bài 05 · Tuần 1 · Ngày 5 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/05-anatomy-of-a-kmp-project.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~2,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m00 bộ khung</span>
  <span class="tag">Cần trước: <a href="../04-ios-co-ban/">04</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Mọi bài sau đều thêm code vào một project có ba phần: một module Kotlin `shared`, một app Android và một app iOS. Hôm nay bạn dựng bộ khung của project đó, milestone **m00**.
    Cả hai app hiện một lời chào đến từ Kotlin dùng chung, và một phần của lời chào được tính khác nhau trên mỗi nền tảng.
    Một khi bạn lần theo được lời chào đó từ một file `.kt` tới màn hình iPhone, bạn sẽ tìm đường được trong bất kỳ codebase KMP nào, kể cả của team.

!!! info "Nguồn chính"
    [The basics of Kotlin Multiplatform project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html) của JetBrains. Trang này ngắn, và định nghĩa target và source set đúng như cách bài này dùng. Đọc nó sau mục 1.

!!! info "Track"
    Module shared giống hệt nhau trên mọi track. Chỉ vài dòng đưa lời chào lên màn hình là khác.
    Bài này có hai nhóm tab: **Compose** / **XML** cho Android và **SwiftUI** / **UIKit** cho iOS; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Mỗi đoạn trích dưới đây chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## 1. Hai chữ: target và source set

**Target** là một nền tảng mà trình biên dịch Kotlin build code của bạn cho nó: ở đây là `android`, `iosArm64` (iPhone thật) và `iosSimulatorArm64` (simulator trên Mac chip Apple).
Không có một target "iOS" duy nhất. Máy thật và simulator cần hai binary riêng ([JetBrains: project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html)).

**Source set** là một folder file Kotlin cộng với danh sách các target mà nó được biên dịch vào. Danh sách đó quyết định code được phép gọi API nào:

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 262" role="img" aria-labelledby="l05-sets-title">
<title id="l05-sets-title">Source set nào được biên dịch vào target nào. commonMain được biên dịch vào cả ba target: android, iosArm64 và iosSimulatorArm64, và chỉ được gọi thư viện chuẩn Kotlin và các thư viện multiplatform. androidMain chỉ được biên dịch vào android và được gọi thêm Android SDK. iosMain được biên dịch vào iosArm64 và iosSimulatorArm64 và được gọi thêm các framework của Apple như platform.UIKit và platform.Foundation.</title>
<defs><marker id="l05-sets-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="20" y="14">Source set (folder)</text>
<text class="small muted" x="440" y="14">Target (binary)</text>
<g data-part="android">
<rect class="box" x="20" y="24" width="240" height="56" rx="6"/>
<text class="mono title" x="32" y="46">androidMain</text>
<text class="small" x="32" y="66">+ Android SDK</text>
</g>
<rect class="box" x="20" y="102" width="240" height="56" rx="6"/>
<text class="mono" x="32" y="124" font-weight="600">commonMain</text>
<text class="small" x="32" y="144">chỉ Kotlin stdlib + thư viện multiplatform</text>
<g data-part="ios">
<rect class="box" x="20" y="180" width="240" height="56" rx="6"/>
<text class="mono title" x="32" y="202">iosMain</text>
<text class="small" x="32" y="222">+ framework của Apple (platform.UIKit, …)</text>
</g>
<g data-part="android">
<rect class="box" x="440" y="24" width="180" height="40" rx="6"/>
<text class="mono title" x="452" y="49">android</text>
</g>
<g data-part="ios">
<rect class="box" x="440" y="136" width="180" height="40" rx="6"/>
<text class="mono title" x="452" y="161">iosArm64</text>
<rect class="box" x="440" y="196" width="180" height="40" rx="6"/>
<text class="mono title" x="452" y="221">iosSimulatorArm64</text>
</g>
<path class="edge" d="M262,52 L438,44" marker-end="url(#l05-sets-arrow)"/>
<path class="edge" d="M262,126 L438,50" marker-end="url(#l05-sets-arrow)"/>
<path class="edge" d="M262,134 L438,152" marker-end="url(#l05-sets-arrow)"/>
<path class="edge" d="M262,142 L438,212" marker-end="url(#l05-sets-arrow)"/>
<path class="edge" d="M262,206 L438,164" marker-end="url(#l05-sets-arrow)"/>
<path class="edge" d="M262,214 L438,222" marker-end="url(#l05-sets-arrow)"/>
</svg>
<figcaption>Một mũi tên nghĩa là "được biên dịch vào". <code>commonMain</code> đi vào mọi binary, nên nó chỉ được dùng thứ mà mọi target đều có.
<ul class="legend"><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

Để biên dịch một target, Kotlin lấy *mọi* source set có gắn nhãn target đó và biên dịch chúng cùng nhau. Binary Android là `commonMain` + `androidMain`; binary simulator là `commonMain` + `iosMain`.
`iosMain` là một source set **trung gian** (intermediate): nó phục vụ hai target, nên bạn viết code iOS một lần thay vì một lần cho mỗi kiến trúc chip.
Kotlin tự tạo nó (cùng `appleMain`, `nativeMain`) qua hệ phân cấp mặc định ([JetBrains: hierarchical project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-hierarchy.html)).

!!! info "Từ TypeScript"
    Hãy nghĩ tới một monorepo có một package `core` mà cả app web lẫn app mobile cùng import. Khác biệt là: `core` ở đây được biên dịch ra *mã máy khác nhau* cho mỗi nền tảng (JVM bytecode cho Android, một binary native cho iOS), và trình biên dịch từ chối API nền tảng trong folder dùng chung thay vì để crash lúc chạy.

## 2. Project trên ổ đĩa

Project có ba phần. Gradle build `shared` và `androidApp`. Xcode build `iosApp`, và nhờ Gradle lấy code dùng chung trước khi biên dịch bất kỳ dòng Swift nào (mục 7).

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 372" role="img" aria-labelledby="l05-tree-title">
<title id="l05-tree-title">Các file của project DeviceMonitor và việc của từng file. Gốc Gradle: settings.gradle.kts nói Gradle build có các module :shared và :androidApp; build.gradle.kts giữ phiên bản plugin cho mọi module; gradle.properties giữ bộ nhớ cho build và công tắc AndroidX. Module shared: shared/build.gradle.kts đặt các target và framework iOS; source set commonMain giữ Platform.kt và Greeting.kt và được biên dịch vào mọi target; source set androidMain giữ Platform.android.kt và được biên dịch vào Android; source set iosMain giữ Platform.ios.kt và được biên dịch vào hai target iOS. androidApp là một module app Android bình thường, phụ thuộc vào :shared và do Gradle build. iosApp là một project Xcode bình thường, do Xcode build và không thuộc Gradle build.</title>
<text class="mono" x="20" y="16">DeviceMonitor/</text>
<rect class="box" x="20" y="28" width="270" height="28" rx="6"/><text class="mono small" x="30" y="46">settings.gradle.kts</text>
<text class="small muted" x="310" y="46">Gradle build: các module :shared, :androidApp</text>
<rect class="box" x="20" y="64" width="270" height="28" rx="6"/><text class="mono small" x="30" y="82">build.gradle.kts</text>
<text class="small muted" x="310" y="82">phiên bản plugin cho mọi module</text>
<rect class="box" x="20" y="100" width="270" height="28" rx="6"/><text class="mono small" x="30" y="118">gradle.properties</text>
<text class="small muted" x="310" y="118">bộ nhớ cho build, công tắc AndroidX</text>
<rect class="box" x="20" y="136" width="270" height="28" rx="6"/><text class="mono small" x="30" y="154">shared/build.gradle.kts</text>
<text class="small muted" x="310" y="154">module KMP: các target + framework iOS</text>
<rect class="box" x="20" y="172" width="270" height="28" rx="6"/><text class="mono small" x="30" y="190">shared/src/commonMain/kotlin/…</text>
<text class="small muted" x="310" y="190">Platform.kt, Greeting.kt · mọi target</text>
<g data-part="android">
<rect class="box" x="20" y="208" width="270" height="28" rx="6"/><text class="mono small" x="30" y="226">shared/src/androidMain/kotlin/…</text>
<text class="small muted" x="310" y="226">Platform.android.kt · android</text>
</g>
<g data-part="ios">
<rect class="box" x="20" y="244" width="270" height="28" rx="6"/><text class="mono small" x="30" y="262">shared/src/iosMain/kotlin/…</text>
<text class="small muted" x="310" y="262">Platform.ios.kt · hai target iOS</text>
</g>
<g data-part="android">
<rect class="box" x="20" y="280" width="270" height="28" rx="6"/><text class="mono small" x="30" y="298">androidApp/</text>
<text class="small muted" x="310" y="298">một module app Android bình thường; dùng :shared</text>
</g>
<g data-part="ios">
<rect class="box" x="20" y="316" width="270" height="28" rx="6"/><text class="mono small" x="30" y="334">iosApp/</text>
<text class="small muted" x="310" y="334">một project Xcode, KHÔNG thuộc Gradle build</text>
</g>
<text class="small muted" x="20" y="362">Không tô màu: dùng chung cho mọi target, hoặc là phần của chính việc build.</text>
</svg>
<figcaption>Project ở thời điểm m00. <code>androidApp/</code> giữ file build của nó, một manifest và <code>MainActivity.kt</code> (cộng một layout ở track XML); <code>iosApp/</code> giữ một <code>project.yml</code> (spec <a href="https://github.com/yonaskolb/XcodeGen">XcodeGen</a> sinh ra <code>iosApp.xcodeproj</code>) và các file Swift. Từ bài 10, code trong <code>commonMain</code> tách thành app core và các shared adapter, và được tô các màu đó.
<ul class="legend"><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

Wizard tạo project của JetBrains sinh ra cùng bố cục này; các bản wizard mới hơn đặt tên module là `sharedLogic` thay cho `shared` ([JetBrains: share more logic](https://kotlinlang.org/docs/multiplatform/multiplatform-upgrade-app.html)).

## 3. File build của module shared

```kotlin title="shared/build.gradle.kts" hl_lines="2 3 7"
plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library")
}

kotlin {
    android {
        namespace = "com.example.devicemonitor.shared"
        compileSdk = 37
        minSdk = 26
    }
⋯ the iOS targets
}
```

```kotlin title="shared/build.gradle.kts" hl_lines="2 3 4 5"
⋯ plugins { } and android { }
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }
```

1. **Hai plugin.** `kotlin.multiplatform` cung cấp khối `kotlin { }`, các target và source set. `com.android.kotlin.multiplatform.library` là plugin của Google cho target Android của một thư viện KMP. Con đường cũ `com.android.library` bị deprecated từ AGP 9 ([Android: KMP library plugin](https://developer.android.com/kotlin/multiplatform/plugin)).
2. **`android { }` nằm *bên trong* `kotlin { }`.** Từ AGP 8.12, target Android được cấu hình ở đó. Tutorial nào dùng `androidLibrary { }` là cũ, và tên đó đã bị deprecated. `compileSdk` và `minSdk` mang nghĩa như ở bài 03. `targetSdk` chỉ đặt trong module app (mục 5).
3. **Khai báo một target chỉ là một lời gọi:** `iosArm64()` và `iosSimulatorArm64()` mỗi hàm thêm một target và trả nó về. Ta lặp qua cả hai để cho mỗi cái cùng một kiểu output.
4. **`binaries.framework`** làm mỗi target iOS sinh ra một *framework* của Apple, một gói chứa binary đã biên dịch cộng một header mà Swift import được. `baseName = "Shared"` là tên Swift dùng: `import Shared`. `isStatic = true` link code Kotlin thẳng vào binary của app.
5. Không có khối `sourceSets { }`: các folder ở mục 2 theo cách đặt tên mặc định, nên Gradle tự tìm ra chúng. Bạn thêm khối đó ở bài 08, khi `commonMain` có thư viện đầu tiên.

## 4. expect / actual: một cái tên, mỗi nền tảng một thân hàm

Code dùng chung đôi khi cần một thông tin nhỏ mà chỉ nền tảng biết, như phiên bản hệ điều hành. `commonMain` không gọi được `android.os.Build`, nên nó **khai báo** thứ nó cần bằng `expect`, và mỗi source set của nền tảng **cung cấp** nó bằng `actual` ([JetBrains: expected and actual declarations](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)):

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 238" role="img" aria-labelledby="l05-expect-title">
<title id="l05-expect-title">Một lời gọi tới được một thân hàm khác nhau trên mỗi nền tảng như thế nào. Trong commonMain, Greeting.greet() gọi platformName(), hàm được khai báo bằng expect và không có thân. Khi binary Android được biên dịch, platformName() trỏ tới actual trong androidMain, trả về Android cộng Build.VERSION.RELEASE. Khi một binary iOS được biên dịch, nó trỏ tới actual trong iosMain, trả về systemName và systemVersion của UIDevice. Lựa chọn được làm lúc biên dịch, theo từng target.</title>
<defs><marker id="l05-expect-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="20" y="14">commonMain</text>
<rect class="box" x="20" y="24" width="190" height="46" rx="6"/>
<text class="mono" x="32" y="45">Greeting.greet()</text>
<text class="small muted" x="32" y="60">code dùng chung bình thường</text>
<rect class="box" x="20" y="130" width="190" height="62" rx="6"/>
<text class="mono" x="32" y="150">expect fun</text>
<text class="mono" x="32" y="167">platformName()</text>
<text class="small muted" x="32" y="183">một lời hứa, không có thân</text>
<path class="edge" d="M115,72 L115,128" marker-end="url(#l05-expect-arrow)"/>
<text class="small muted" x="125" y="106">gọi</text>
<text class="small muted" x="410" y="14">mỗi target một thân hàm</text>
<g data-part="android">
<rect class="box" x="410" y="24" width="220" height="82" rx="6"/>
<text class="mono title" x="422" y="44">androidMain</text>
<text class="mono small" x="422" y="64">actual fun platformName()</text>
<text class="small" x="422" y="84">"Android " + VERSION.RELEASE</text>
<text class="small muted" x="422" y="99">binary Android</text>
</g>
<g data-part="ios">
<rect class="box" x="410" y="124" width="220" height="82" rx="6"/>
<text class="mono title" x="422" y="144">iosMain</text>
<text class="mono small" x="422" y="164">actual fun platformName()</text>
<text class="small" x="422" y="184">systemName + systemVersion</text>
<text class="small muted" x="422" y="199">cả hai binary iOS</text>
</g>
<path class="edge" d="M212,150 L408,70" marker-end="url(#l05-expect-arrow)"/>
<path class="edge" d="M212,166 L408,166" marker-end="url(#l05-expect-arrow)"/>
<text class="small muted" x="236" y="228">Lúc biên dịch, mỗi target chọn actual trong source set của chính nó.</text>
</svg>
<figcaption>Bên gọi không bao giờ biết thân hàm nào chạy. Trình biên dịch kiểm tra rằng target nào cũng có một thân hàm.
<ul class="legend"><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/Platform.kt" hl_lines="2"
⋯ package
expect fun platformName(): String
```

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/Platform.android.kt" hl_lines="4"
⋯ package
import android.os.Build

actual fun platformName(): String = "Android ${Build.VERSION.RELEASE}"
```

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/Platform.ios.kt" hl_lines="2 4"
⋯ package
import platform.UIKit.UIDevice

actual fun platformName(): String =
    UIDevice.currentDevice.systemName() + " " + UIDevice.currentDevice.systemVersion
```

```kotlin title="shared/src/commonMain/kotlin/com/example/devicemonitor/Greeting.kt" hl_lines="3"
⋯ package
class Greeting {
    fun greet(): String = "Hello from shared Kotlin, running on ${platformName()}"
}
```

1. `expect` không có thân hàm. Nó là một lời hứa, và trình biên dịch kiểm tra rằng *mọi* target đều giữ lời. Cùng package, cùng tên, cùng chữ ký.
2. `actual` đánh dấu phần cài đặt của nền tảng. Tên file (`Platform.android.kt`, `Platform.ios.kt`) chỉ là quy ước. Package và folder mới quyết định cái gì khớp với cái gì.
3. `import platform.UIKit.UIDevice` là **Kotlin gọi thẳng UIKit của Apple**. Kotlin/Native kèm sẵn binding cho các framework Apple dưới `platform.*`, nên `iosMain` gọi được chúng mà không cần Swift. Kho log ở bài 17 dùng kiểu này.
   Để ý `systemName()` được gọi như một method còn `systemVersion` là một property. Binding đưa hai thứ này ra như vậy; cứ để autocomplete của IDE cho bạn biết mỗi API có dạng nào.
4. `Greeting` là code dùng chung bình thường. Nó gọi `platformName()` mà không biết thân hàm nào chạy. Quyết định đó được làm lúc biên dịch, theo từng target.

!!! note "Khi nào *không* dùng expect/actual"
    Lời khuyên của chính JetBrains là ưu tiên các tính năng ngôn ngữ thông thường: một **interface** dùng chung với mỗi nền tảng một cài đặt, được inject vào chỗ cần ([cùng trang](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)).
    Interface có thể có cài đặt giả trong test, và cài đặt iOS có thể viết bằng Swift. Đó chính xác là các **outbound port** của khoá từ bài 10 trở đi (`BleScanner`, `PermissionChecker`, …).
    Giữ `expect`/`actual` cho những thông tin nhỏ như thế này. *Class* expect vẫn đang Beta và in ra cảnh báo của trình biên dịch.

## 5. Android: shared chỉ là một module nữa

Với app Android, `:shared` là một module thư viện bình thường. Một dòng dependency làm `Greeting` import được, và Gradle biên dịch `commonMain` + `androidMain` vào APK:

=== "Compose"

    ```kotlin title="androidApp/build.gradle.kts" hl_lines="2 8"
    android {
        namespace = "com.example.devicemonitor.android"
        compileSdk = 37
    ⋯ defaultConfig { }, buildFeatures { }
    }

    dependencies {
        implementation(project(":shared"))
        implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    ⋯ core-ktx, activity-compose, material3
    }
    ```

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt" hl_lines="2 6 8 12"
    ⋯ package and the other imports
    import com.example.devicemonitor.Greeting

    class MainActivity : ComponentActivity() {
        override fun onCreate(savedInstanceState: Bundle?) {
            enableEdgeToEdge()
            super.onCreate(savedInstanceState)
            val greeting = Greeting().greet()
            setContent {
                Text(
                    text = greeting,
                    modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
                )
            }
        }
    }
    ```

    ```xml title="androidApp/src/main/AndroidManifest.xml" hl_lines="5"
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application
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

=== "XML"

    ```kotlin title="androidApp/build.gradle.kts" hl_lines="2 8"
    android {
        namespace = "com.example.devicemonitor.android"
        compileSdk = 37
    ⋯ defaultConfig { }
    }

    dependencies {
        implementation(project(":shared"))
    ⋯ core-ktx, appcompat
    }
    ```

    ```xml title="androidApp/src/main/res/layout/activity_main.xml" hl_lines="4 10"
    <FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:fitsSystemWindows="true">

        <TextView
            android:id="@+id/greetingText"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_margin="24dp" />
    </FrameLayout>
    ```

    ```kotlin title="androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt" hl_lines="2 6 9"
    ⋯ package and the other imports
    import com.example.devicemonitor.Greeting

    class MainActivity : AppCompatActivity() {
        override fun onCreate(savedInstanceState: Bundle?) {
            enableEdgeToEdge()
            super.onCreate(savedInstanceState)
            setContentView(R.layout.activity_main)
            findViewById<TextView>(R.id.greetingText).text = Greeting().greet()
        }
    }
    ```

    ```xml title="androidApp/src/main/AndroidManifest.xml" hl_lines="5"
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application
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

1. `implementation(project(":shared"))` là toàn bộ phần tích hợp. Gradle build biến thể Android của module shared trước. Không có framework, không có chép file.
2. `namespace` của app (`…devicemonitor.android`) khác với của module shared (`…devicemonitor.shared`). Mỗi module Android cần namespace riêng, vì mỗi module sinh ra class `R` riêng của nó.
3. `import com.example.devicemonitor.Greeting` là package từ `commonMain`. App Android không phân biệt được code dùng chung với code của chính nó.
4. `.MainActivity` trong manifest được hiểu theo namespace của app, nên nó nghĩa là `com.example.devicemonitor.android.MainActivity`. `exported="true"` là bắt buộc với mọi activity có intent filter (targetSdk 31+).
5. **Edge-to-edge, hai nửa.** Với targetSdk 35 trở lên, app mặc định vẽ đè ra sau các thanh hệ thống ([Android: edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge)). `enableEdgeToEdge()` làm các thanh trong suốt và chọn màu icon status bar hợp với theme; thiếu nó, lần build đầu của chúng tôi hiện icon trắng trên nền sáng.
   **Compose:** sau đó `safeDrawingPadding()` giữ chữ không bị nằm dưới các thanh.
   **XML:** sau đó `fitsSystemWindows="true"` trên view gốc đệm layout tránh khỏi các thanh. Khoảng cách riêng của chữ là margin, vì `fitsSystemWindows` thay thế padding của view gốc.

!!! info "XML vs Compose · cái gì đổi và vì sao"
    Chỉ dòng cuối của `onCreate` là khác: một `TextView` tìm theo id rồi gán, so với một composable `Text` được đưa chuỗi vào.
    Dependency vào `:shared` và lời gọi `Greeting().greet()` y hệt nhau. Đó chính là ý của kiến trúc này: code dùng chung không bao giờ biết track UI nào hiển thị nó.

## 6. iOS: Swift nhìn Kotlin qua một header

Xcode không đọc được file `.kt`. Kotlin/Native biên dịch `commonMain` + `iosMain` thành framework `Shared`, và sinh ra một **header Objective-C** mô tả API của nó.
Swift import header đó như mọi framework Apple khác ([JetBrains: interop with Swift/Objective-C](https://kotlinlang.org/docs/native-objc-interop.html)). Phần lớn tên đi qua không đổi, với vài mẫu cần biết:

| Kotlin | Swift thấy |
|---|---|
| `class Greeting` có `fun greet(): String` | `Greeting().greet()` → `String` |
| một hàm **top-level** trong `Platform.ios.kt` | `Platform_iosKt.platformName()`: một class đặt theo tên *file* |
| `object Foo` | `Foo.shared` |
| `interface` · `List` · `Unit` | `protocol` · `Array` · `Void` |
| `suspend fun`, `Flow`, kiểu `sealed` | dùng được nhưng vụng về: **bài 09** sửa chuyện này bằng SKIE |

Chúng tôi đã xác nhận hai dòng đầu bằng cách đọc header được sinh ra: `shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h`. Hãy tự đọc nó sau lần build đầu tiên. Khi Swift không tìm thấy một tên Kotlin, câu trả lời nằm trong file đó.

=== "SwiftUI"

    ```swift title="iosApp/iosApp/ContentView.swift" hl_lines="2 5"
    ⋯ import SwiftUI
    import Shared

    struct ContentView: View {
        private let greeting = Greeting().greet()

        var body: some View {
            Text(greeting)
                .multilineTextAlignment(.center)
                .padding()
        }
    }
    ```

=== "UIKit"

    ```swift title="iosApp/iosApp/ViewController.swift" hl_lines="2 10 11"
    ⋯ import UIKit
    import Shared

    final class ViewController: UIViewController {
        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .systemBackground

            let label = UILabel()
            label.text = Greeting().greet()
            label.numberOfLines = 0
            label.textAlignment = .center
    ⋯ add the label and constrain it to the layout margins
        }
    }
    ```

1. `import Shared` là `baseName` của framework ở mục 3. Không cần gì thêm để thấy `Greeting`.
2. `Greeting()` tạo một object Kotlin từ Swift. Kotlin/Native quản lý bộ nhớ của nó, và bạn không phải giải phóng nó.
3. `greet()` trả về một `String` của Swift; việc chuyển đổi xảy ra ở ranh giới hai ngôn ngữ.
4. **SwiftUI:** chuỗi được tính một lần, khi struct view được tạo, và cất trong một `let`. Bài 06 giới thiệu state thay đổi theo thời gian.
   **UIKit:** label trải theo layout margin với `numberOfLines = 0`, nên lời chào dài sẽ xuống dòng thay vì bị cắt.
5. **SwiftUI:** `iOSApp.swift` là đúng `@main App` bạn viết ở bài 04, bỏ phần log. Nó hiện `ContentView()` trong một `WindowGroup` và không bao giờ đụng tới code dùng chung.
   **UIKit:** `AppDelegate.swift` và `SceneDelegate.swift` là của bài 04 đã bỏ phần log, trừ việc gốc của scene delegate là chính `ViewController()`, không phải một navigation controller bọc nó. Không file nào đụng tới code dùng chung. `project.yml` giữ `UIApplicationSceneManifest` của bài 04, nếu không scene delegate sẽ không bao giờ chạy.

!!! info "UIKit vs SwiftUI · cái gì đổi và vì sao"
    UIKit cần ba file để hiện một label (app delegate, scene delegate, view controller) vì bạn tự dựng cửa sổ và cây view. SwiftUI cần hai.
    Ở cả hai, dòng đụng tới code dùng chung là một: `import Shared` và `Greeting().greet()`.

## 7. Xcode lấy framework bằng cách nào

Chúng ta dùng **direct integration** của JetBrains: một build phase dạng script trong Xcode target chạy Gradle ở mỗi lần build ([JetBrains: direct integration](https://kotlinlang.org/docs/multiplatform/multiplatform-direct-integration.html)):

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 410" role="img" aria-labelledby="l05-build-title">
<title id="l05-build-title">Chuyện gì xảy ra khi bạn bấm Run trong Xcode cho simulator ở bản build Debug. Bước 1: phase Run Script tên Compile Kotlin Framework, đặt trước Compile Sources, chạy ./gradlew :shared:embedAndSignAppleFrameworkForXcode. Gradle đọc môi trường của Xcode, SDK nào và cấu hình nào, rồi chạy các task: downloadKotlinNativeDistribution, chỉ tải bộ công cụ Kotlin/Native nếu chưa cài; compileKotlinIosSimulatorArm64, biên dịch commonMain và iosMain thành một klib; linkDebugFrameworkIosSimulatorArm64, biến klib thành Shared.framework và Shared.h; một task symbolic link đặt framework vào folder build products của Xcode; và chính embedAndSignAppleFrameworkForXcode, bị bỏ qua vì framework tĩnh không có gì để nhúng. Bước 2: Compile Sources, Swift biên dịch và import Shared giờ tìm thấy được. Bước 3: Link, code Kotlin được link vào code riêng của app, rồi ký, ra iosApp.app.</title>
<defs><marker id="l05-build-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="ios">
<rect class="box" x="20" y="10" width="600" height="46" rx="6"/>
<text class="title" x="34" y="30">1. Run Script "Compile Kotlin Framework"</text>
<text class="small" x="34" y="47">đặt trước Compile Sources · chạy ./gradlew :shared:embedAndSignAppleFrameworkForXcode</text>
</g>
<path class="edge" d="M320,58 L320,72" marker-end="url(#l05-build-arrow)"/>
<rect class="edge" x="40" y="74" width="560" height="214" rx="8"/>
<text x="56" y="96" font-weight="600">Gradle</text>
<text class="small muted" x="110" y="96">đọc môi trường của Xcode (SDK nào? cấu hình nào?), rồi chạy:</text>
<rect class="box" x="60" y="108" width="330" height="30" rx="6"/><text class="mono small" x="72" y="127">downloadKotlinNativeDistribution</text>
<text class="small muted" x="402" y="127">tải bộ công cụ một lần</text>
<rect class="box" x="60" y="144" width="330" height="30" rx="6"/><text class="mono small" x="72" y="163">compileKotlinIosSimulatorArm64</text>
<text class="small muted" x="402" y="163">commonMain + iosMain → klib</text>
<rect class="box" x="60" y="180" width="330" height="30" rx="6"/><text class="mono small" x="72" y="199">linkDebugFrameworkIosSimulatorArm64</text>
<text class="small muted" x="402" y="199">klib → Shared.framework + Shared.h</text>
<rect class="box" x="60" y="216" width="330" height="30" rx="6"/><text class="mono small" x="72" y="235">symbolicLink…ForXcode…</text>
<text class="small muted" x="402" y="235">framework → folder products của Xcode</text>
<rect class="box" x="60" y="252" width="330" height="30" rx="6" stroke-dasharray="5 4"/><text class="mono small" x="72" y="271">embedAndSignAppleFrameworkForXcode</text>
<text class="small muted" x="402" y="271">SKIPPED: không có gì để nhúng</text>
<path class="edge" d="M320,290 L320,304" marker-end="url(#l05-build-arrow)"/>
<g data-part="ios">
<rect class="box" x="20" y="306" width="600" height="38" rx="6"/>
<text class="title" x="34" y="330">2. Compile Sources</text>
<text class="small" x="170" y="330">Swift biên dịch; import Shared giờ tìm thấy được</text>
</g>
<path class="edge" d="M320,346 L320,360" marker-end="url(#l05-build-arrow)"/>
<g data-part="ios">
<rect class="box" x="20" y="362" width="600" height="38" rx="6"/>
<text class="title" x="34" y="386">3. Link</text>
<text class="small" x="170" y="386">code Kotlin được link vào code của app → ký → iosApp.app</text>
</g>
</svg>
<figcaption>Danh sách task lấy từ build log của chúng tôi, đã rút gọn. Ô có màu là các bước của Xcode; ô không màu là các task Gradle.
<ul class="legend"><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

Vì framework là tĩnh, `iosApp.app` sau cùng không có folder `Frameworks/`: Kotlin và Swift được link vào cùng một binary. (Ở bản build Debug, Xcode đặt code đó trong `iosApp.debug.dylib` cạnh một stub khởi động nhỏ; bản build Release ra một file thực thi duy nhất.)

```yaml title="iosApp/project.yml" hl_lines="4 7 11"
    settings:
      base:
⋯ bundle ID, Swift version, version numbers
        ENABLE_USER_SCRIPT_SANDBOXING: NO
    preBuildScripts:
      - name: Compile Kotlin Framework
        basedOnDependencyAnalysis: false
        script: |
⋯ an early exit when the IDE sets OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED
          cd "$SRCROOT/.."
          ./gradlew :shared:embedAndSignAppleFrameworkForXcode
```

Trong XcodeGen, build phase là một mục `preBuildScripts`. Cần `ENABLE_USER_SCRIPT_SANDBOXING: NO` vì script phải đọc và ghi ra ngoài sandbox của Xcode (folder `shared/` và `~/.gradle`).
`basedOnDependencyAnalysis: false` tắt ô "Based on dependency analysis" của Xcode, nên script chạy ở mọi lần build và Gradle tự quyết thứ gì đã cập nhật rồi.
Các cách khác để đưa Kotlin sang iOS là một Swift package hoặc CocoaPods. Chúng quan trọng khi một team khác dùng framework, không phải cho một repo như của chúng ta.

## 8. Thực tế xảy ra gì

Chúng tôi build m00 bằng brief bên dưới (Kotlin 2.4.21, AGP 9.4.1, Gradle 9.8.2, Xcode 26.2) và chạy nó:

| Chạy trên | Màn hình hiện | `actual` nào đã chạy |
|---|---|---|
| Emulator Android 16 | `Hello from shared Kotlin, running on Android 16` | `androidMain` → `Build.VERSION.RELEASE` |
| Simulator iOS 26.2 | `Hello from shared Kotlin, running on iOS 26.2` | `iosMain` → `UIDevice` |

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 214" role="img" aria-labelledby="l05-trace-title">
<title id="l05-trace-title">Đường đi của lời chào từ Kotlin dùng chung tới từng màn hình. Trên Android: MainActivity trong androidApp gọi Greeting().greet() từ commonMain, hàm này gọi platformName(); actual trong androidMain trả lời, và màn hình hiện Hello from shared Kotlin, running on Android 16. Trên iOS: ContentView hoặc ViewController trong iosApp gọi Greeting().greet() qua framework Shared, thứ Kotlin/Native build từ commonMain và iosMain; platformName() trỏ tới actual trong iosMain, và màn hình hiện Hello from shared Kotlin, running on iOS 26.2.</title>
<defs><marker id="l05-trace-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<g data-part="android">
<rect class="box" x="10" y="14" width="136" height="62" rx="6"/>
<text class="title" x="20" y="34">androidApp</text>
<text class="mono small" x="20" y="52">MainActivity</text>
<text class="small muted" x="20" y="67">gọi greet()</text>
</g>
<rect class="box" x="186" y="14" width="136" height="62" rx="6"/>
<text class="mono small" x="196" y="34" font-weight="600">commonMain</text>
<text class="mono small" x="196" y="52">Greeting.greet()</text>
<text class="small muted" x="196" y="67">gọi platformName()</text>
<g data-part="android">
<rect class="box" x="362" y="14" width="136" height="62" rx="6"/>
<text class="title" x="372" y="34">androidMain</text>
<text class="mono small" x="372" y="52">actual</text>
<text class="small muted" x="372" y="67">VERSION.RELEASE</text>
</g>
<rect class="box" x="522" y="14" width="108" height="62" rx="6"/>
<text class="small" x="532" y="36" font-weight="600">Màn hình</text>
<text class="small muted" x="532" y="52">"… running on</text>
<text class="small muted" x="532" y="66">Android 16"</text>
<path class="edge" d="M148,45 L184,45" marker-end="url(#l05-trace-arrow)"/>
<path class="edge" d="M324,45 L360,45" marker-end="url(#l05-trace-arrow)"/>
<path class="edge" d="M500,45 L520,45" marker-end="url(#l05-trace-arrow)"/>
<g data-part="ios">
<rect class="box" x="10" y="130" width="136" height="62" rx="6"/>
<text class="title" x="20" y="150">iosApp</text>
<text class="mono small" x="20" y="168">ContentView /</text>
<text class="mono small" x="20" y="183">ViewController</text>
</g>
<rect class="box" x="186" y="130" width="136" height="62" rx="6"/>
<text class="mono small" x="196" y="150" font-weight="600">Shared.framework</text>
<text class="mono small" x="196" y="168">Greeting.greet()</text>
<text class="small muted" x="196" y="183">qua Shared.h</text>
<g data-part="ios">
<rect class="box" x="362" y="130" width="136" height="62" rx="6"/>
<text class="title" x="372" y="150">iosMain</text>
<text class="mono small" x="372" y="168">actual</text>
<text class="small muted" x="372" y="183">UIDevice</text>
</g>
<rect class="box" x="522" y="130" width="108" height="62" rx="6"/>
<text class="small" x="532" y="152" font-weight="600">Màn hình</text>
<text class="small muted" x="532" y="168">"… running on</text>
<text class="small muted" x="532" y="182">iOS 26.2"</text>
<path class="edge" d="M148,161 L184,161" marker-end="url(#l05-trace-arrow)"/>
<path class="edge" d="M324,161 L360,161" marker-end="url(#l05-trace-arrow)"/>
<path class="edge" d="M500,161 L520,161" marker-end="url(#l05-trace-arrow)"/>
</svg>
<figcaption>Cùng một <code>Greeting.greet()</code> trên cả hai nền tảng. Ô framework bên iOS là <code>commonMain</code> + <code>iosMain</code> đã biên dịch.
<ul class="legend"><li data-part="android">Android</li><li data-part="ios">iOS</li></ul>
</figcaption>
</figure>

!!! warning "Gotcha · build Android xanh không chứng minh commonMain là dùng chung"
    Chúng tôi cố tình đặt `android.os.Build.MODEL` vào `Greeting.kt` (commonMain). `./gradlew :androidApp:assembleDebug` **vẫn thành công**: bản biên dịch Android của commonMain nhìn thấy Android SDK.
    Chỉ một lần build iOS, hoặc `./gradlew :shared:compileCommonMainKotlinMetadata`, mới thất bại với `Unresolved reference 'android'`. IDE cũng tô đỏ chỗ đó, nhưng nếu bạn chỉ build Android, bạn sẽ phát hiện ra ở phía iOS, muộn hơn.
    Hãy chạy bản biên dịch metadata (vài giây) sau khi đụng vào `commonMain`.

!!! warning "Gotcha · các lỗi khi dựng build"
    - **Gradle daemon chết với "out of JVM Metaspace"**: một lần build Android + Kotlin/Native cần nhiều bộ nhớ hơn mặc định của Gradle. Đặt `org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g` trong `gradle.properties`. Chúng tôi dính đúng lỗi này ở lần build đầu.
    - **Script Xcode thất bại với `⛔ User Script Sandboxing Enabled in Xcode Project`** (từ task Gradle `checkSandboxAndWriteProtection`): user script sandboxing đang bật. Đặt `ENABLE_USER_SCRIPT_SANDBOXING` thành `NO` cho target, chạy `./gradlew --stop`, rồi build lại ([JetBrains](https://kotlinlang.org/docs/multiplatform/multiplatform-direct-integration.html)). Chúng tôi tái hiện lỗi này bằng cách bật lại thiết lập đó.
    - **Lần build iOS đầu tiên mất vài phút**: Gradle tải bộ công cụ Kotlin/Native (vài trăm MB, vào `~/.konan`) một lần. Các lần build sau là build tăng dần.
    - **"No such module 'Shared'"**: phase script không chạy, hoặc chạy *sau* Compile Sources. Kiểm tra thứ tự build phase trong Xcode.

!!! warning "Gotcha · tên Swift cho hàm của bạn đến từ tên file"
    Đổi tên `Platform.ios.kt` là mọi chỗ Swift gọi `Platform_iosKt.platformName()` đều hỏng, dù không dòng Kotlin nào đổi. Nên đưa ra cho Swift các class (như `Greeting`) hơn là hàm top-level.

!!! question "Hỏi agent của bạn"
    Nhờ agent mở `Shared.h` cùng bạn và giải thích ba khai báo trong đó.
    Ví dụ: *"Why is the Objective-C class called `SharedGreeting` while Swift calls it `Greeting`?"* (Vì sao class Objective-C tên là `SharedGreeting` mà Swift lại gọi nó là `Greeting`?)

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Source set nào được gọi <code>platform.UIKit.UIDevice</code>?</p>
<div class="opts">
<button class="opt">commonMain</button>
<button class="opt" data-correct>iosMain</button>
<button class="opt">androidMain</button>
</div>
<p class="feedback"></p>
<p class="why">Chỉ những source set chỉ biên dịch vào target của Apple mới thấy các binding <code>platform.*</code>.</p>
</div>

<div class="quiz">
<p class="q">Bạn thêm một <code>expect fun</code> thứ hai nhưng chỉ viết <code>actual</code> cho Android. Chuyện gì xảy ra?</p>
<div class="opts">
<button class="opt">bản build iOS crash lúc chạy</button>
<button class="opt" data-correct>bản biên dịch iOS build thất bại</button>
<button class="opt">iOS lặng lẽ trả về giá trị rỗng</button>
</div>
<p class="feedback"></p>
<p class="why">Trình biên dịch kiểm tra mọi target: <code>The 'expect' declaration … has no 'actual' declaration in module '&lt;commonMain&gt; for Native'</code>.</p>
</div>

<div class="quiz">
<p class="q"><code>baseName = "Shared"</code> điều khiển cái gì?</p>
<div class="opts">
<button class="opt">đường dẫn module Gradle</button>
<button class="opt">tên package Kotlin</button>
<button class="opt" data-correct>tên import trong Swift</button>
</div>
<p class="feedback"></p>
<p class="why">Nó đặt tên cho framework, nên Swift viết <code>import Shared</code>. Module Gradle vẫn là <code>:shared</code> và package vẫn là <code>com.example.devicemonitor</code>.</p>
</div>

<div class="quiz">
<p class="q">App Android cần gì để dùng <code>Greeting</code>?</p>
<div class="opts">
<button class="opt" data-correct>một dependency project(":shared")</button>
<button class="opt">một file Shared.framework chép sang</button>
<button class="opt">một build phase chạy Gradle</button>
</div>
<p class="feedback"></p>
<p class="why">Trên Android, shared là một module Gradle bình thường. Framework và build phase là cơ chế của iOS.</p>
</div>

<div class="quiz">
<p class="q">Swift không tìm thấy một hàm Kotlin bạn đã viết. Bạn tìm ở đâu trước tiên?</p>
<div class="opts">
<button class="opt">project.yml của Xcode</button>
<button class="opt" data-correct>Shared.h được sinh ra</button>
<button class="opt">file settings của Gradle</button>
</div>
<p class="feedback"></p>
<p class="why">Header chính là thứ Swift nhìn thấy, kể cả những thứ bị đổi tên như <code>Platform_iosKt</code>.</p>
</div>

<div class="quiz">
<p class="q">Lệnh nào bắt nhanh nhất một API Android bị dùng trong commonMain?</p>
<div class="opts">
<button class="opt">assembleDebug</button>
<button class="opt" data-correct>compileCommonMainKotlinMetadata</button>
<button class="opt">compileAndroidMain</button>
</div>
<p class="feedback"></p>
<p class="why">Cả hai task Android đều biên dịch commonMain <em>cùng với</em> Android SDK, nên chúng chấp nhận nó.</p>
</div>

<div class="quiz">
<p class="q"><code>interface</code> của Kotlin ứng với <code>protocol</code> của Swift, vậy <code>object</code> của Kotlin ứng với gì của Swift:</p>
<div class="opts">
<button class="opt">Foo()</button>
<button class="opt" data-correct>Foo.shared</button>
<button class="opt">Foo.self</button>
</div>
<p class="feedback"></p>
<p class="why">Header Objective-C đưa instance duy nhất của một <code>object</code> Kotlin ra dưới tên <code>shared</code>.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Trên Android, một object kết nối BLE đang sống nên nằm ở đâu? (Bài 03)</p>
<div class="opts">
<button class="opt">trong Activity</button>
<button class="opt" data-correct>trong một outbound BLE adapter</button>
<button class="opt">trong Manifest</button>
</div>
<p class="feedback"></p>
<p class="why">Activity bị huỷ khi xoay máy. Bài 03 đặt kết nối vào một Android BLE adapter đứng sau một outbound port (bài 14), và state màn hình vào một ViewModel, thứ từ bài 08 sống trong <code>commonMain</code>.</p>
</div>

<div class="quiz">
<p class="q">Tầng vòng đời iOS nào báo cho monitor chạy nền biết app đã rời màn hình? (Bài 04)</p>
<div class="opts">
<button class="opt">các callback disappear của một view</button>
<button class="opt" data-correct>cấp app/scene</button>
<button class="opt">Info.plist</button>
</div>
<p class="feedback"></p>
<p class="why">Bấm Home không gọi callback nào ở cấp view. Chỉ cấp scene/app đổi.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent)"
    1. Không nhìn, vẽ cây ở mục 2 ra giấy: ba source set, và mỗi cái được biên dịch vào target nào.
    2. Đọc [trang project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html) của JetBrains. Rồi trả lời trong một câu: vì sao `iosArm64Main` thường để trống?
    3. **Một expect thứ hai.** Thêm `expect fun deviceModel(): String` cạnh `platformName()`. *Chỉ* viết actual cho Android (`Build.MODEL`) và dùng nó trong `greet()`. Đoán bản build nào thất bại, và với message gì, rồi chạy cả hai bản build. Sau đó thêm actual cho iOS (`UIDevice.currentDevice.model`) và xem cả hai màn hình đổi.
    4. **Tìm một tên Swift.** Tạo `commonMain/…/Strings.kt` với một hàm top-level `fun shout(text: String): String = text.uppercase() + "!"`. Build, tìm nó trong `Shared.h`, và gọi nó từ Swift để hét lời chào lên. Viết ra tên Swift trước khi bạn nhìn.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy cả hai app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/05-anatomy-of-a-kmp-project.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/05-anatomy-of-a-kmp-project.html" -o .course/lesson-05.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/kmp-anatomy-cheatsheet.html" -o .course/ref-kmp-anatomy-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my tracks exactly,
except where the brief below says otherwise.

Lesson 05 (Anatomy of a KMP project): build milestone m00, the KMP skeleton of the
Native Device Monitor. Both apps show a greeting computed in shared Kotlin.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: nothing. Create the project in demo/ in my workspace; later lessons build on it.
Prereqs: JDK 17+, Android SDK (ANDROID_HOME, or sdk.dir in local.properties), Xcode,
XcodeGen (`brew install xcodegen`), any Gradle install to bootstrap the wrapper once
(`brew install gradle`), or copy the wrapper files from the Lesson 03 Android project.

1. Create exactly these files, complete, as in the lesson's "Full files" section for my
   tracks (paths relative to demo/). Use the file contents shown there, including package
   lines and imports:
     settings.gradle.kts
     build.gradle.kts                (differs per Android track)
     gradle.properties
     shared/build.gradle.kts
     shared/src/commonMain/kotlin/com/example/devicemonitor/Platform.kt
     shared/src/commonMain/kotlin/com/example/devicemonitor/Greeting.kt
     shared/src/androidMain/kotlin/com/example/devicemonitor/Platform.android.kt
     shared/src/iosMain/kotlin/com/example/devicemonitor/Platform.ios.kt
     androidApp/build.gradle.kts     (differs per Android track)
     androidApp/src/main/AndroidManifest.xml     (theme differs per Android track)
     androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt
     XML track only: androidApp/src/main/res/layout/activity_main.xml
     iosApp/project.yml              (differs per iOS track)
     iosApp/iosApp/: SwiftUI = iOSApp.swift, ContentView.swift;
                     UIKit = AppDelegate.swift, SceneDelegate.swift, ViewController.swift
   Do NOT write iosApp/iosApp/Info.plist: XcodeGen generates it from project.yml. Do NOT
   apply org.jetbrains.kotlin.android anywhere (AGP 9 has built-in Kotlin).
2. In demo/: `gradle wrapper --gradle-version 9.8.2` (creates gradlew, gradlew.bat and
   gradle/wrapper/). Add a .gitignore if `git check-ignore` shows the workspace doesn't
   already ignore build/, .gradle/, .kotlin/, local.properties and xcuserdata/. If ANDROID_HOME isn't set, put
   sdk.dir=<path to the Android SDK> in local.properties.
3. Android: from demo/, run
     ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
   Then install androidApp/build/outputs/apk/debug/androidApp-debug.apk on a running
   emulator, start com.example.devicemonitor/com.example.devicemonitor.android.MainActivity
   (`adb shell am start -n …`), and look at the screen (`adb exec-out screencap -p`).
4. iOS: from demo/iosApp/, run `xcodegen generate`. Pick an iPhone simulator on iOS 17 or
   newer (the deployment target) from `xcrun simctl list devices available`, then build for
   it (if two simulators share a name, use id=<UDID> instead of name=), as one command:
     xcodebuild -project iosApp.xcodeproj -scheme iosApp \
       -destination 'platform=iOS Simulator,name=<that iPhone>' \
       -derivedDataPath build build
   The first iOS build downloads the Kotlin/Native toolchain and takes minutes. Then boot
   that simulator, install build/Build/Products/Debug-iphonesimulator/iosApp.app with
   `xcrun simctl install booted …`, launch bundle ID com.example.devicemonitor with
   `xcrun simctl launch booted …`, and look at the screen
   (`xcrun simctl io booted screenshot <file>.png`).

Acceptance checks:
- ./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug succeeds.
- The iOS build succeeds, and its log shows the "Compile Kotlin Framework" phase running
  Gradle (:shared:compileKotlinIosSimulatorArm64, :shared:linkDebugFrameworkIosSimulatorArm64)
  before Swift compiles. embedAndSignAppleFrameworkForXcode itself reports SKIPPED; that's
  expected for a static framework.
- No compiler warnings from our own Kotlin or Swift code (don't use -q to check warnings;
  read the build output). Not from our code, and expected: Gradle's "Deprecated Gradle
  features … Gradle 10" line, "Unable to strip the following libraries" from the Android
  build, Xcode's "appintentsmetadataprocessor … warning: Metadata extraction skipped", and
  xcodebuild's "WARNING: Using the first of multiple matching destinations".
- Installed and launched: Android shows "Hello from shared Kotlin, running on Android <version>"
  below the status bar (not under it), with dark, readable status-bar icons on the light
  background; iOS shows "… running on iOS <version>" (the simulator may be in dark mode).
Then walk me through each file line by line, and show me where Greeting appears in
shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework/Headers/Shared.h
(run ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 if that folder doesn't exist).
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- [Cheatsheet: giải phẫu project KMP](https://phongna-inn.github.io/carmd-kmp-course/reference/kmp-anatomy-cheatsheet.html): source set, bảng tên Kotlin → Swift, và các lệnh build trên một trang.
- JetBrains: [project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html) (nguồn chính), [expect/actual](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html), [hierarchical structure](https://kotlinlang.org/docs/multiplatform/multiplatform-hierarchy.html), [Swift/Objective-C interop](https://kotlinlang.org/docs/native-objc-interop.html), [direct integration](https://kotlinlang.org/docs/multiplatform/multiplatform-direct-integration.html).
- Android: [plugin thư viện Android-KMP](https://developer.android.com/kotlin/multiplatform/plugin), và codelab của Google [Get started with Kotlin Multiplatform](https://developer.android.com/codelabs/kmp-get-started) (thêm một module shared vào app có sẵn; nó dùng SKIE, thứ bạn gặp ở bài 09).
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html)
- Kinh nghiệm thực tế: kênh `#multiplatform` trên Kotlin Slack ([đăng ký](https://surveys.jetbrains.com/s3/kotlin-slack-sign-up); kỹ sư JetBrains trả lời ở đó) và [r/Kotlin](https://reddit.com/r/Kotlin).

## File đầy đủ

Mọi file bài này tạo ra, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. `iosApp/iosApp/Info.plist` do `xcodegen generate` sinh ra từ `project.yml`, và các file Gradle wrapper do `gradle wrapper` sinh ra.

**Dùng chung cho mọi track**

??? example "settings.gradle.kts"
    ```kotlin
    pluginManagement {
        repositories {
            google()
            mavenCentral()
            gradlePluginPortal()
        }
    }

    dependencyResolutionManagement {
        repositories {
            google()
            mavenCentral()
        }
    }

    rootProject.name = "DeviceMonitor"
    include(":shared")
    include(":androidApp")
    ```

??? example "gradle.properties"
    ```properties
    org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g
    android.useAndroidX=true
    ```

??? example "shared/build.gradle.kts"
    ```kotlin
    plugins {
        id("org.jetbrains.kotlin.multiplatform")
        id("com.android.kotlin.multiplatform.library")
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
            }
        }
    }
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/Platform.kt"
    ```kotlin
    package com.example.devicemonitor

    expect fun platformName(): String
    ```

??? example "shared/src/commonMain/kotlin/com/example/devicemonitor/Greeting.kt"
    ```kotlin
    package com.example.devicemonitor

    class Greeting {
        fun greet(): String = "Hello from shared Kotlin, running on ${platformName()}"
    }
    ```

??? example "shared/src/androidMain/kotlin/com/example/devicemonitor/Platform.android.kt"
    ```kotlin
    package com.example.devicemonitor

    import android.os.Build

    actual fun platformName(): String = "Android ${Build.VERSION.RELEASE}"
    ```

??? example "shared/src/iosMain/kotlin/com/example/devicemonitor/Platform.ios.kt"
    ```kotlin
    package com.example.devicemonitor

    import platform.UIKit.UIDevice

    actual fun platformName(): String =
        UIDevice.currentDevice.systemName() + " " + UIDevice.currentDevice.systemVersion
    ```

**Android**

=== "Compose"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
            id("org.jetbrains.kotlin.multiplatform") version "2.4.21" apply false
            id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
        }
        ```

    ??? example "androidApp/build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application")
            id("org.jetbrains.kotlin.plugin.compose")
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
        }
        ```

    ??? example "androidApp/src/main/AndroidManifest.xml"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <application
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.os.Bundle
        import androidx.activity.ComponentActivity
        import androidx.activity.compose.setContent
        import androidx.activity.enableEdgeToEdge
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.padding
        import androidx.compose.foundation.layout.safeDrawingPadding
        import androidx.compose.material3.Text
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.unit.dp
        import com.example.devicemonitor.Greeting

        class MainActivity : ComponentActivity() {
            override fun onCreate(savedInstanceState: Bundle?) {
                enableEdgeToEdge()
                super.onCreate(savedInstanceState)
                val greeting = Greeting().greet()
                setContent {
                    Text(
                        text = greeting,
                        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
                    )
                }
            }
        }
        ```

=== "XML"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("com.android.kotlin.multiplatform.library") version "9.4.1" apply false
            id("org.jetbrains.kotlin.multiplatform") version "2.4.21" apply false
        }
        ```

    ??? example "androidApp/build.gradle.kts"
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
        }

        dependencies {
            implementation(project(":shared"))
            implementation("androidx.core:core-ktx:1.19.1")
            implementation("androidx.appcompat:appcompat:1.8.0")
        }
        ```

    ??? example "androidApp/src/main/AndroidManifest.xml"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <application
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

    ??? example "androidApp/src/main/java/com/example/devicemonitor/android/MainActivity.kt"
        ```kotlin
        package com.example.devicemonitor.android

        import android.os.Bundle
        import android.widget.TextView
        import androidx.activity.enableEdgeToEdge
        import androidx.appcompat.app.AppCompatActivity
        import com.example.devicemonitor.Greeting

        class MainActivity : AppCompatActivity() {
            override fun onCreate(savedInstanceState: Bundle?) {
                enableEdgeToEdge()
                super.onCreate(savedInstanceState)
                setContentView(R.layout.activity_main)
                findViewById<TextView>(R.id.greetingText).text = Greeting().greet()
            }
        }
        ```

    ??? example "androidApp/src/main/res/layout/activity_main.xml"
        ```xml
        <FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:fitsSystemWindows="true">

            <TextView
                android:id="@+id/greetingText"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_margin="24dp" />
        </FrameLayout>
        ```

**iOS**

=== "SwiftUI"

    ??? example "iosApp/project.yml"
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

        @main
        struct iOSApp: App {
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
            private let greeting = Greeting().greet()

            var body: some View {
                Text(greeting)
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
        ```

=== "UIKit"

    ??? example "iosApp/project.yml"
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

        @main
        final class AppDelegate: UIResponder, UIApplicationDelegate {
            func application(_ application: UIApplication,
                             configurationForConnecting connectingSceneSession: UISceneSession,
                             options: UIScene.ConnectionOptions) -> UISceneConfiguration {
                UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
            }
        }
        ```

    ??? example "iosApp/iosApp/SceneDelegate.swift"
        ```swift
        import UIKit

        final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
            var window: UIWindow?

            func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
                       options connectionOptions: UIScene.ConnectionOptions) {
                guard let windowScene = scene as? UIWindowScene else { return }
                let window = UIWindow(windowScene: windowScene)
                window.rootViewController = ViewController()
                window.makeKeyAndVisible()
                self.window = window
            }
        }
        ```

    ??? example "iosApp/iosApp/ViewController.swift"
        ```swift
        import UIKit
        import Shared

        final class ViewController: UIViewController {
            override func viewDidLoad() {
                super.viewDidLoad()
                view.backgroundColor = .systemBackground

                let label = UILabel()
                label.text = Greeting().greet()
                label.numberOfLines = 0
                label.textAlignment = .center
                label.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(label)
                NSLayoutConstraint.activate([
                    label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
                    label.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
                    label.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
                ])
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Code KMP / Swift trong phần này chỉ để minh hoạ, không kèm output. Ví dụ có output (A2) là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17).

### A1. Target và source set, nói bằng chuyện đời thường

Giải thích thêm cho [mục 1](#1-hai-chu-target-va-source-set).

!!! abstract "Một câu để nhớ"
    **Target** là **chi nhánh** nhận hàng: chi nhánh Android, chi nhánh iPhone thật, chi nhánh simulator.
    **Source set** là **thùng hàng** có dán nhãn "giao cho chi nhánh nào". Thùng `commonMain` dán nhãn cả ba, nên trong đó chỉ được bỏ thứ chi nhánh nào cũng dùng được.
    Thùng `iosMain` dán nhãn hai chi nhánh iOS, nên được bỏ đồ của Apple. Khi một chi nhánh nhận hàng (biên dịch), nó mở **mọi** thùng có nhãn của mình.

Dev React Native đã gặp đúng ý tưởng này: file `Button.ios.tsx` và `Button.android.tsx` được bundler chọn theo nền tảng. KMP làm việc đó ở cấp **folder** và kiểm tra lúc **biên dịch**:

| | Monorepo TS | React Native | KMP |
|---|---|---|---|
| Code dùng chung | `packages/core/` | `Button.tsx` | `commonMain/` |
| Code riêng nền tảng | package riêng, hoặc `if (isBrowser)` | `Button.ios.tsx`, `Button.android.tsx` | `iosMain/`, `androidMain/` |
| Ai chọn bản nào | runtime (`if`) hoặc bundler | bundler (Metro) theo đuôi file | trình biên dịch, theo target |
| Lỡ gọi API sai nền tảng | crash lúc chạy | crash lúc chạy | **không biên dịch được** (trừ gotcha ở mục 8) |
| Kết quả build | một bundle JS | một bundle JS mỗi nền tảng | JVM bytecode cho Android, binary native cho iOS |

Vì sao `iosArm64Main` thường để trống (gợi ý cho bài tự làm 2): code iOS gần như không bao giờ khác nhau giữa iPhone thật và simulator, nên viết một lần ở `iosMain` là đủ.

### A2. expect/actual hay interface: cùng việc, hai cách

Giải thích thêm cho [mục 4](#4-expect-actual-mot-cai-ten-moi-nen-tang-mot-than-ham) và khung "Khi nào không dùng expect/actual".

Hai cách cho `commonMain` hỏi một thông tin của nền tảng:

```kotlin
// cách 1: expect/actual (bài này) — trình biên dịch chọn theo target
expect fun platformName(): String               // commonMain
actual fun platformName(): String = "Android …" // androidMain

// cách 2: interface + inject (từ bài 10) — bên gọi đưa cài đặt vào
interface PlatformInfo { fun name(): String }    // commonMain
class Greeting(private val platform: PlatformInfo) { … }
```

Cách 2 chạy được ngay trên JVM thường, nên đây là bản chạy thật. `FakePlatform` đóng vai cài đặt giả trong test:

```kotlin
interface PlatformInfo {
    fun name(): String
}

class Greeting(private val platform: PlatformInfo) {
    fun greet(): String = "Hello from shared Kotlin, running on ${platform.name()}"
}

class FakePlatform(private val fixed: String) : PlatformInfo {
    override fun name() = fixed
}

object JvmPlatform : PlatformInfo {
    override fun name() = "JVM ${System.getProperty("java.specification.version")}"
}

fun main() {
    println(Greeting(FakePlatform("Android 16")).greet())
    println(Greeting(FakePlatform("iOS 26.2")).greet())
    println(Greeting(JvmPlatform).greet())

    val g = Greeting(FakePlatform("TestOS 1")).greet()
    check(g.endsWith("TestOS 1")) { "unexpected: $g" }
    println("test passed: $g")
}
```

Output:

```text
Hello from shared Kotlin, running on Android 16
Hello from shared Kotlin, running on iOS 26.2
Hello from shared Kotlin, running on JVM 17
test passed: Hello from shared Kotlin, running on TestOS 1
```

Với `expect fun platformName()` thì không làm được dòng "TestOS 1": mỗi target chỉ có đúng một `actual`, không thay bằng bản giả được.

| | `expect` / `actual` | interface + inject |
|---|---|---|
| Ai chọn cài đặt | trình biên dịch, theo target | code của bạn, lúc chạy |
| Thay bằng bản giả khi test | không | có |
| Cài đặt iOS viết bằng Swift | không, phải là Kotlin trong `iosMain` | có (Swift conform protocol) |
| Hợp với | thông tin nhỏ, cố định: tên OS, phiên bản | thứ có hành vi: quét BLE, xin quyền, đọc pin |
| Bên TS giống | `.ios.ts` / `.android.ts` của React Native | truyền dependency vào constructor |

!!! tip "Áp vào app"
    `platformName()` ở m00 dùng `expect`/`actual` là hợp. Từ bài 10, `BleScanner` và `PermissionChecker` là interface trong `commonMain`; Android cài đặt bằng Kotlin, iOS cài đặt bằng Swift (bài 13), và test dùng bản giả.

### A3. Vì sao Swift thấy `Platform_iosKt` và `SharedGreeting`

Giải thích thêm cho [mục 6](#6-ios-swift-nhin-kotlin-qua-mot-header) và gotcha về tên file.

Swift không đọc Kotlin trực tiếp. Đường đi là: Kotlin → **header Objective-C** (`Shared.h`) → Swift. Hai luật của Objective-C tạo ra những cái tên lạ:

1. **Objective-C không có hàm top-level thuộc package.** Nên Kotlin gom các hàm top-level của một file vào một class đặt theo tên file: `Platform.ios.kt` → `Platform_iosKt`. Dấu `.` thành `_`, thêm `Kt`.
2. **Objective-C không có namespace.** Mọi class của mọi framework nằm chung một không gian tên, nên Kotlin thêm tiền tố là tên framework: `Greeting` → `SharedGreeting`. Header đồng thời gắn tên Swift gọn hơn (`Greeting`), nên trong Swift bạn viết `Greeting()`.

| Kotlin | Trong `Shared.h` (Objective-C) | Swift viết |
|---|---|---|
| `class Greeting` | `SharedGreeting` | `Greeting()` |
| hàm top-level trong `Platform.ios.kt` | class `SharedPlatform_iosKt` | `Platform_iosKt.platformName()` |
| hàm top-level trong `Strings.kt` (bài tự làm 4) | class `SharedStringsKt` | `StringsKt.shout(text:)` |
| `object Foo` | `SharedFoo` + `shared` | `Foo.shared` |

Dòng `Strings.kt` theo đúng luật trên; bạn kiểm tra lại trong `Shared.h` khi làm bài tự làm 4.

Bên TS gần nhất là file `.d.ts` sinh ra từ code đã biên dịch: nó là "thứ bên ngoài nhìn thấy", và khi import báo không tìm thấy thì mở nó ra xem.

### A4. Hai đường build: Android kéo module, iOS chạy script

Giải thích thêm cho [mục 5](#5-android-shared-chi-la-mot-module-nua) và [mục 7](#7-xcode-lay-framework-bang-cach-nao).

| | Android | iOS |
|---|---|---|
| Ai build app | Gradle | Xcode |
| Ai build code dùng chung | cùng Gradle đó | Gradle, do script của Xcode gọi |
| Cách nối | `implementation(project(":shared"))` | build phase "Compile Kotlin Framework" chạy trước Compile Sources |
| Code dùng chung thành gì | class JVM trong APK | `Shared.framework` (tĩnh) + `Shared.h` |
| Bên ngoài nhìn thấy gì | chính các class Kotlin | header Objective-C |
| Lỗi hay gặp | quên dependency | script không chạy / chạy sau Compile Sources → "No such module 'Shared'" |
| Bên npm giống | import một package trong workspace | script `prebuild` build thư viện ra `dist/` + `.d.ts` rồi app mới build |

Vì sao không có folder `Frameworks/` trong app: framework **tĩnh** (`isStatic = true`) được link thẳng vào file chạy của app, giống bundler gộp thư viện vào một file `bundle.js` thay vì để nó thành file riêng.

### A5. Lệnh nào bắt được lỗi gì

Giải thích thêm cho [gotcha build Android xanh](#8-thuc-te-xay-ra-gi).

Chỗ bất ngờ: `commonMain` **không được biên dịch một mình** khi bạn build Android. Gradle biên dịch `commonMain` *cùng với* `androidMain` và Android SDK, nên lỡ gọi `android.os.Build` trong `commonMain` vẫn qua.

| Lệnh | Biên dịch `commonMain` cùng với | Bắt được `android.*` trong `commonMain`? | Thời gian |
|---|---|---|---|
| `./gradlew :androidApp:assembleDebug` | Android SDK | **không** | trung bình |
| `./gradlew :shared:compileCommonMainKotlinMetadata` | không gì cả (chỉ phần chung) | có | vài giây |
| Build iOS trong Xcode | framework Apple | có (`Unresolved reference 'android'`) | lâu nhất |

Bên TS giống: chạy `tsc` với `"lib": ["dom"]` thì `window` hợp lệ khắp nơi, kể cả trong code bạn định chạy trên Node; muốn bắt lỗi phải kiểm tra riêng phần chung với `lib` hẹp hơn.

Thói quen: sửa `commonMain` xong → chạy `compileCommonMainKotlinMetadata` trước khi tin bản build Android.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 06.

- [ ] Giải thích target và source set bằng lời của mình, và vẽ lại được ba source set cùng target của chúng (xem [A1](#a1-target-va-source-set-noi-bang-chuyen-oi-thuong)).
- [ ] Biết vì sao iOS có hai target (`iosArm64`, `iosSimulatorArm64`) và `iosMain` là source set trung gian.
- [ ] Đọc được `shared/build.gradle.kts`: hai plugin, `android { }` trong `kotlin { }`, `binaries.framework`, `baseName`, `isStatic`.
- [ ] Viết một cặp `expect`/`actual`, và đoán đúng lỗi khi thiếu một `actual`.
- [ ] Chọn được giữa `expect`/`actual` và interface + inject cho một nhu cầu mới (xem [A2](#a2-expectactual-hay-interface-cung-viec-hai-cach)).
- [ ] Nối app Android vào `:shared` bằng một dòng dependency, và giải thích vì sao mỗi module cần namespace riêng.
- [ ] Biết `enableEdgeToEdge()` cùng `safeDrawingPadding()` (Compose) hoặc `fitsSystemWindows` (XML) để làm gì.
- [ ] Gọi Kotlin từ Swift bằng `import Shared`, và tìm được tên Swift của một khai báo trong `Shared.h` (xem [A3](#a3-vi-sao-swift-thay-platform_ioskt-va-sharedgreeting)).
- [ ] Kể được Xcode lấy framework thế nào: script phase → các task Gradle → Compile Sources → Link (xem [A4](#a4-hai-uong-build-android-keo-module-ios-chay-script)).
- [ ] Sửa được bốn lỗi dựng build: Metaspace, script sandboxing, lần build đầu chậm, "No such module 'Shared'".
- [ ] Có thói quen chạy `compileCommonMainKotlinMetadata` sau khi sửa `commonMain` (xem [A5](#a5-lenh-nao-bat-uoc-loi-gi)).
- [ ] Làm xong 4 bài tự làm ở trên mà không cần agent.
