---
source: lessons/03-android-fundamentals.html
source_sha: 94097e8
---

# Android cơ bản

<p class="kicker">Bài 03 · Tuần 1 · Ngày 3 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/03-android-fundamentals.html">Bản gốc tiếng Anh</a></p>

<div class="meta">
  <span class="tag">~1,75 giờ · +0,5 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: app nháp (Android)</span>
  <span class="tag">Cần trước: <a href="../02-swift-cho-dev-typescript/">02</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Hệ điều hành, không phải code của bạn, quyết định khi nào các màn hình của app được tạo, bị ẩn và bị huỷ. Một kết nối BLE giữ trong sai object sẽ lặng lẽ biến mất khi điện thoại xoay.
    Hôm nay bạn dựng một app Android nhỏ xíu ghi log các callback vòng đời của nó, rồi xem log trong lúc bạn chọc vào app.

!!! info "Nguồn chính"
    [The activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle) của Android, và [Handle configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes) cho cái bẫy khi xoay máy.

!!! info "Track"
    Bản gốc có nút chọn track UI. Ở đây, chỗ nào hai track khác nhau thì có hai tab **Compose** / **XML**; chọn một tab là mọi tab cùng tên trên trang đổi theo.
    Phần lớn ý tưởng hôm nay giống nhau trên cả hai track. Chỉ đoạn code đưa thứ gì đó lên màn hình là khác.

## 1. Trong một project Android có gì

Project Gradle hôm nay gồm vài file build cộng một module, `app`. Code của bạn, manifest và resource nằm dưới `app/src/main/`.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 330" role="img" aria-labelledby="l03-tree-title">
<title id="l03-tree-title">Các file của project Android nháp và việc của từng file. Ở gốc project: settings.gradle.kts nói có những module nào và lấy thư viện từ đâu; build.gradle.kts giữ phiên bản plugin cho cả project; gradle.properties giữ các thiết lập Gradle chung cho project; gradle/wrapper chốt phiên bản Gradle. Trong app: build.gradle.kts giữ các mức SDK, tính năng và dependency của module; src/main/AndroidManifest.xml khai báo các thành phần và quyền của app với hệ điều hành; src/main/java/…/MainActivity.kt là Activity duy nhất của app; src/main/res giữ resource như layout, chuỗi và hình.</title>
<text class="mono" x="20" y="16">Lesson03Android/</text>
<rect class="box" x="20" y="28" width="260" height="28" rx="6"/><text class="mono small" x="30" y="46">settings.gradle.kts</text>
<text class="small muted" x="300" y="46">có những module nào, lấy thư viện từ đâu</text>
<rect class="box" x="20" y="64" width="260" height="28" rx="6"/><text class="mono small" x="30" y="82">build.gradle.kts</text>
<text class="small muted" x="300" y="82">phiên bản plugin cho cả project</text>
<rect class="box" x="20" y="100" width="260" height="28" rx="6"/><text class="mono small" x="30" y="118">gradle.properties</text>
<text class="small muted" x="300" y="118">thiết lập Gradle chung cho project</text>
<rect class="box" x="20" y="136" width="260" height="28" rx="6"/><text class="mono small" x="30" y="154">gradle/wrapper/</text>
<text class="small muted" x="300" y="154">chốt phiên bản Gradle; build bằng ./gradlew</text>
<rect class="box" x="20" y="172" width="260" height="28" rx="6"/><text class="mono small" x="30" y="190">app/build.gradle.kts</text>
<text class="small muted" x="300" y="190">module này: mức SDK, tính năng, dependency</text>
<rect class="box" x="20" y="208" width="260" height="28" rx="6"/><text class="mono small" x="30" y="226">app/src/main/AndroidManifest.xml</text>
<text class="small muted" x="300" y="226">thành phần và quyền, khai báo với hệ điều hành</text>
<rect class="box" x="20" y="244" width="260" height="28" rx="6"/><text class="mono small" x="30" y="262">app/src/main/java/…/MainActivity.kt</text>
<text class="small muted" x="300" y="262">Activity duy nhất của app</text>
<rect class="box" x="20" y="280" width="260" height="28" rx="6"/><text class="mono small" x="30" y="298">app/src/main/res/</text>
<text class="small muted" x="300" y="298">resource: layout (track XML), chuỗi, hình</text>
</svg>
<figcaption>Những file quan trọng hôm nay. Các folder sinh ra khác của project (<code>build/</code>, <code>.gradle/</code>) không phải source của bạn.</figcaption>
</figure>

File build của module là nơi bạn sẽ ở lâu nhất khi đụng tới Gradle ([Android: Gradle build overview](https://developer.android.com/build/gradle-build-overview)).
Mỗi đoạn trích dưới đây chỉ hiện những dòng mà phần ghi chú giải thích; các file đầy đủ nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

=== "Compose"

    ```kotlin title="app/build.gradle.kts" hl_lines="3 8 12 13"
    plugins {
        id("com.android.application")
        id("org.jetbrains.kotlin.plugin.compose")
    }

    android {
        namespace = "com.example.lesson03"
        compileSdk = 37

        defaultConfig {
            applicationId = "com.example.lesson03"
            minSdk = 26
            targetSdk = 36
            versionCode = 1
            versionName = "1.0"
        }

        buildFeatures { compose = true }
    }
    ⋯ dependencies { }
    ```

    ```kotlin title="app/build.gradle.kts" hl_lines="3 4 6"
    ⋯ plugins { } and android { }
    dependencies {
        implementation(platform("androidx.compose:compose-bom:2026.09.00"))
        implementation("androidx.core:core-ktx:1.19.1")
        implementation("androidx.activity:activity-compose:1.13.0")
        implementation("androidx.compose.material3:material3")
    }
    ```

=== "XML"

    ```kotlin title="app/build.gradle.kts" hl_lines="7 11 12 19 20"
    plugins {
        id("com.android.application")
    }

    android {
        namespace = "com.example.lesson03"
        compileSdk = 37

        defaultConfig {
            applicationId = "com.example.lesson03"
            minSdk = 26
            targetSdk = 36
            versionCode = 1
            versionName = "1.0"
        }
    }

    dependencies {
        implementation("androidx.core:core-ktx:1.19.1")
        implementation("androidx.appcompat:appcompat:1.8.0")
    }
    ```

1. **Không có plugin Kotlin.** Từ Android Gradle Plugin 9, hỗ trợ Kotlin được dựng sẵn bên trong. Áp plugin cũ `org.jetbrains.kotlin.android` giờ sẽ *làm build thất bại*, nên hãy xoá nó đi nếu tutorial cũ bảo bạn thêm vào ([Android: Migrate to built-in Kotlin](https://developer.android.com/build/migrate-to-built-in-kotlin)).
   **Compose:** track Compose vẫn áp plugin *compiler* của Compose. **XML:** track XML không cần plugin nào khác.
2. **Ba con số SDK, ba việc khác nhau.** `compileSdk` là những API Android nào code của bạn *nhìn thấy* được (các thư viện Compose hiện tại đòi 37). `minSdk` là bản Android cũ nhất *cài* được app. `targetSdk` là bạn chọn theo *hành vi lúc chạy* của phiên bản nào.
3. **Compose:** **BOM** (bill of materials) chốt một bộ phiên bản thư viện Compose đã được test cùng nhau, đó là lý do `material3` không có phiên bản riêng. **XML:** `appcompat` cung cấp `AppCompatActivity` và các theme tương thích ngược cho hệ View.
   `core-ktx` cung cấp các hàm tiện ích Kotlin như `String.toUri()`. Hãy khai báo nó rõ ràng, đừng trông vào một thư viện khác kéo nó vào giùm bạn.

## 2. Activity, Context, Intent, Manifest

**Activity** là một cửa vào có cửa sổ và có vòng đời. App của chúng ta có đúng một cái, Native Device Monitor cũng vậy.
**Context** là tay cầm của bạn để nói chuyện với hệ thống: resource, system service (sau này là Bluetooth service), và khởi động các thành phần khác ([reference](https://developer.android.com/reference/android/content/Context)). Một Activity *là* một Context.
**Intent** là một thông điệp nhờ hệ điều hành khởi động một thứ gì đó. Nó có thể *explicit* (một class bạn sở hữu) hoặc *implicit* ("ai mở được trang web thì mở") ([Android: Intents](https://developer.android.com/guide/components/intents-filters)).

**Manifest** khai báo các thành phần với hệ điều hành. Intent filter `MAIN` + `LAUNCHER` là thứ đặt icon của app vào launcher ([Android: App manifest](https://developer.android.com/guide/topics/manifest/manifest-intro)). Quyền cũng được khai báo ở đây, từ bài 12.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 200" role="img" aria-labelledby="l03-intent-title">
<title id="l03-intent-title">Hai đường đi qua hệ điều hành Android. Trên: launcher hiện icon cho MainActivity vì manifest của nó có intent filter MAIN và LAUNCHER; bạn bấm icon, launcher nhờ hệ điều hành khởi động Activity đó, và MainActivity được tạo. Dưới: MainActivity gọi startActivity với một implicit intent, hệ điều hành tìm app có intent filter khớp, và ví dụ Activity của trình duyệt mở đè lên Activity của bạn.</title>
<defs><marker id="l03-intent-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="20" y="14">Khởi động app của bạn</text>
<rect class="box" x="20" y="24" width="170" height="54" rx="6"/>
<text class="mono" x="105" y="46" text-anchor="middle">Launcher</text>
<text class="small muted" x="105" y="64" text-anchor="middle">bạn bấm icon</text>
<rect class="box" x="235" y="24" width="170" height="54" rx="6"/>
<text class="mono" x="320" y="46" text-anchor="middle">Android OS</text>
<text class="small muted" x="320" y="64" text-anchor="middle">khởi động Activity của icon</text>
<rect class="box" x="450" y="24" width="170" height="54" rx="6"/>
<text class="mono" x="535" y="46" text-anchor="middle">MainActivity</text>
<text class="small muted" x="535" y="64" text-anchor="middle">được tạo, rồi được start</text>
<path class="edge" d="M190,51 L233,51" marker-end="url(#l03-intent-arrow)"/>
<path class="edge" d="M405,51 L448,51" marker-end="url(#l03-intent-arrow)"/>
<text class="small muted" x="20" y="116">App của bạn khởi động một app khác</text>
<rect class="box" x="20" y="126" width="170" height="54" rx="6"/>
<text class="mono" x="105" y="148" text-anchor="middle">MainActivity</text>
<text class="small muted" x="105" y="166" text-anchor="middle">startActivity(intent)</text>
<rect class="box" x="235" y="126" width="170" height="54" rx="6"/>
<text class="mono" x="320" y="148" text-anchor="middle">Android OS</text>
<text class="small muted" x="320" y="166" text-anchor="middle">tìm filter khớp</text>
<rect class="box" x="450" y="126" width="170" height="54" rx="6"/>
<text class="mono" x="535" y="148" text-anchor="middle">Activity của trình duyệt</text>
<text class="small muted" x="535" y="166" text-anchor="middle">mở đè lên Activity của bạn</text>
<path class="edge" d="M190,153 L233,153" marker-end="url(#l03-intent-arrow)"/>
<path class="edge" d="M405,153 L448,153" marker-end="url(#l03-intent-arrow)"/>
</svg>
<figcaption>Launcher hiện một icon cho mỗi Activity mà mục manifest của nó có intent filter <code>MAIN</code> + <code>LAUNCHER</code>. Intent là thông điệp nhờ hệ điều hành khởi động một Activity.</figcaption>
</figure>

=== "Compose"

    ```xml title="app/src/main/AndroidManifest.xml" hl_lines="10 12 13"
    <?xml version="1.0" encoding="utf-8"?>
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">

        <application
            android:label="Lesson 03"
            android:theme="@android:style/Theme.Material.Light.NoActionBar">

            <activity
                android:name=".MainActivity"
                android:exported="true">
                <intent-filter>
                    <action android:name="android.intent.action.MAIN" />
                    <category android:name="android.intent.category.LAUNCHER" />
                </intent-filter>
            </activity>
        </application>
    </manifest>
    ```

=== "XML"

    ```xml title="app/src/main/AndroidManifest.xml" hl_lines="4 5 7 8"
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application
            android:label="Lesson 03"
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

1. Action `MAIN` và category `LAUNCHER` là thứ làm cho Activity này thành cái mà launcher khởi động. `android:exported="true"` cho phép một app khác, ở đây là launcher, khởi động nó.
   Nếu app target Android 12 (API 31) trở lên, như app của chúng ta, bạn phải ghi rõ thuộc tính này trên mọi Activity có intent filter, nếu không app sẽ không cài được ([Android 12 behaviour changes](https://developer.android.com/about/versions/12/behavior-changes-12#exported), [reference `<activity>`](https://developer.android.com/guide/topics/manifest/activity-element#exported)).
2. **Chỉ track XML:** `AppCompatActivity` của track XML sẽ crash lúc mở app nếu theme không phải theme AppCompat.

Intent trong app là cái mà nút bấm gửi đi. Mở một trang web là một intent *implicit*: bạn nêu action và dữ liệu, không nêu class, và hệ điều hành tìm một app xử lý được nó.

```kotlin title="app/src/main/java/com/example/lesson03/MainActivity.kt" hl_lines="3 4"
⋯ onCreate(), the lifecycle callbacks
    private fun openWebPage() {
        val intent = Intent(Intent.ACTION_VIEW, "https://developer.android.com".toUri())
        startActivity(intent)
    }
⋯ onStart(), onResume(), onPause(), onStop(), onDestroy()
```

## 3. Vòng đời Activity, ghi ra log

Hệ điều hành gọi một callback trên Activity của bạn ở mỗi bước trong đời nó ([Android: Activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)).
App này ghi log sáu callback với tag `Lifecycle`: `onCreate → onStart → onResume` trên đường vào, và `onPause → onStop → onDestroy` trên đường ra.
Cái thứ bảy, `onRestart`, chạy khi một Activity đã bị stop quay lại. Bạn sẽ thêm nó trong bài tự làm.
Trong Logcat của Android Studio, lọc theo `tag:Lifecycle` ([tài liệu Logcat](https://developer.android.com/studio/debug/logcat)).

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 200" role="img" aria-labelledby="l03-life-title">
<title id="l03-life-title">Các callback vòng đời Activity theo thứ tự: onCreate, onStart, onResume, onPause, onStop, onDestroy. Một mũi tên đứt từ onStop quay về onStart có nhãn onRestart, cho Activity quay lại sau khi đã bị stop. Ba ngoặc bên dưới: Activity ở phía trước và tương tác được từ onResume tới onPause, nhìn thấy được từ onStart tới onStop, và tồn tại từ onCreate tới onDestroy.</title>
<defs><marker id="l03-life-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="box" x="10" y="50" width="90" height="40" rx="6"/><text class="mono" x="55" y="75" text-anchor="middle">onCreate</text>
<rect class="box" x="116" y="50" width="90" height="40" rx="6"/><text class="mono" x="161" y="75" text-anchor="middle">onStart</text>
<rect class="box" x="222" y="50" width="90" height="40" rx="6"/><text class="mono" x="267" y="75" text-anchor="middle">onResume</text>
<rect class="box" x="328" y="50" width="90" height="40" rx="6"/><text class="mono" x="373" y="75" text-anchor="middle">onPause</text>
<rect class="box" x="434" y="50" width="90" height="40" rx="6"/><text class="mono" x="479" y="75" text-anchor="middle">onStop</text>
<rect class="box" x="540" y="50" width="90" height="40" rx="6"/><text class="mono" x="585" y="75" text-anchor="middle">onDestroy</text>
<path class="edge" d="M100,70 L114,70" marker-end="url(#l03-life-arrow)"/>
<path class="edge" d="M206,70 L220,70" marker-end="url(#l03-life-arrow)"/>
<path class="edge" d="M312,70 L326,70" marker-end="url(#l03-life-arrow)"/>
<path class="edge" d="M418,70 L432,70" marker-end="url(#l03-life-arrow)"/>
<path class="edge" d="M524,70 L538,70" marker-end="url(#l03-life-arrow)"/>
<path class="edge dashed" d="M479,50 L479,28 L161,28 L161,48" marker-end="url(#l03-life-arrow)"/>
<text class="small muted" x="320" y="20" text-anchor="middle">onRestart: quay lại sau khi Activity đã bị stop</text>
<path class="edge" d="M222,112 L222,118 L418,118 L418,112"/>
<text class="small muted" x="320" y="133" text-anchor="middle">ở phía trước, tương tác được</text>
<path class="edge" d="M116,142 L116,148 L524,148 L524,142"/>
<text class="small muted" x="320" y="163" text-anchor="middle">nhìn thấy được</text>
<path class="edge" d="M10,172 L10,178 L630,178 L630,172"/>
<text class="small muted" x="320" y="190" text-anchor="middle">tồn tại</text>
</svg>
<figcaption>Sáu callback được ghi log, cùng khoảng đời mà mỗi cặp callback bao lấy.</figcaption>
</figure>

=== "Compose"

    ```kotlin title="app/src/main/java/com/example/lesson03/MainActivity.kt" hl_lines="6 7 8 9"
    ⋯ package, imports
    private const val TAG = "Lifecycle"

    class MainActivity : ComponentActivity() {

        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            Log.d(TAG, "onCreate (restored=${savedInstanceState != null})")
            setContent {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text("Lesson 03: watch Logcat, filter tag:Lifecycle")
                    Button(onClick = { openWebPage() }) {
                        Text("Open a web page")
                    }
                }
            }
        }
    ⋯ openWebPage(), the other lifecycle callbacks
    ```

=== "XML"

    ```xml title="app/src/main/res/layout/activity_main.xml" hl_lines="13"
    <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="24dp">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Lesson 03: watch Logcat, filter tag:Lifecycle" />

        <Button
            android:id="@+id/openWebButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Open a web page" />
    </LinearLayout>
    ```

    ```kotlin title="app/src/main/java/com/example/lesson03/MainActivity.kt" hl_lines="6 7 8 9 10"
    ⋯ package, imports
    private const val TAG = "Lifecycle"

    class MainActivity : AppCompatActivity() {

        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            Log.d(TAG, "onCreate (restored=${savedInstanceState != null})")
            setContentView(R.layout.activity_main)
            findViewById<Button>(R.id.openWebButton).setOnClickListener { openWebPage() }
        }
    ⋯ openWebPage(), the other lifecycle callbacks
    ```

```kotlin title="app/src/main/java/com/example/lesson03/MainActivity.kt" hl_lines="3 11"
⋯ onCreate(), openWebPage()
    override fun onStart() {
        super.onStart()
        Log.d(TAG, "onStart")
    }

⋯ onResume(), onPause(), onStop(): identical shape, one Log.d each

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy (changingConfigurations=$isChangingConfigurations)")
    }
}
```

1. Mọi override đều gọi `super` trước. Framework tự làm việc của nó trong các method này, và bỏ `super` sẽ ném lỗi lúc chạy.
2. `savedInstanceState` khác null khi hệ điều hành đang *tạo lại* Activity này sau khi đã huỷ một instance trước đó. Ghi log `restored=` làm cho việc tạo lại hiện ra trước mắt.
3. **Compose:** `setContent { }` giao cửa sổ cho Compose. UI là một cây lời gọi hàm, không phải một file XML. Bài 06 giải thích kỹ.
   **XML:** `setContentView` inflate layout XML thành các object View, và `findViewById` lấy một View theo `@+id` của nó. Bài 06 thay cách này bằng ViewBinding.
4. `isChangingConfigurations` trong `onDestroy` cho bạn biết *vì sao* Activity đang chết: `true` nghĩa là một thay đổi cấu hình như xoay máy (nó sẽ quay lại ngay), còn `false` nghĩa là nó thật sự kết thúc.

!!! info "XML vs Compose · cái gì đổi và vì sao"
    Chỉ những dòng đưa UI lên màn hình là khác: `setContentView` + `findViewById` + một listener, so với `setContent { … }` có click handler viết ngay bên trong.
    Activity, vòng đời của nó, Manifest và Intent thì y hệt nhau, đó là lý do vòng đời bạn học hôm nay đúng cho cả hai track.

## 4. Thực tế xảy ra gì

Chúng tôi chạy app này trên emulator Android 16 (targetSdk 36) và điều khiển nó từng bước. Log, rút gọn:

| Bạn làm | Logcat hiện | Ý nghĩa |
|---|---|---|
| Mở app | `onCreate (restored=false) · onStart · onResume` | Instance mới, giờ tương tác được |
| Bấm Home | `onPause · onStop` | Bị ẩn nhưng **còn sống**: không có `onDestroy` |
| Mở lại | `onStart · onResume` | Cùng instance; `onCreate` không chạy lại |
| Mở một trang web | `onPause · onStop` | App khác che app của bạn, y như Home |
| **Xoay máy** | `onPause · onStop · onDestroy (changingConfigurations=true) · onCreate (restored=true) · onStart · onResume` | **Bị huỷ và dựng lại**, trong chưa tới một giây |
| Back ở màn hình chính | `onPause · onStop · onDestroy (changingConfigurations=false)` | Kết thúc; lần mở sau bắt đầu bằng `onCreate` |

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 200" role="img" aria-labelledby="l03-inst-title">
<title id="l03-inst-title">So sánh hai lần chạy. Trên: mở app, bấm Home, rồi mở lại. Cùng một instance ghi onCreate, onStart, onResume; rồi onPause, onStop; rồi onStart, onResume. Dưới: xoay điện thoại. Instance cũ ghi onPause, onStop, onDestroy với changingConfigurations true, và một instance mới ghi onCreate với restored true, rồi onStart, onResume.</title>
<defs><marker id="l03-inst-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="title" x="8" y="14" font-weight="600">Home, rồi mở lại</text>
<rect class="edge dashed" x="8" y="22" width="592" height="64" rx="8"/>
<text class="small muted" x="16" y="36">một instance suốt từ đầu tới cuối</text>
<rect class="box" x="15" y="44" width="210" height="32" rx="6"/><text class="mono small" x="120" y="64" text-anchor="middle">onCreate · onStart · onResume</text>
<rect class="box" x="270" y="44" width="130" height="32" rx="6"/><text class="mono small" x="335" y="64" text-anchor="middle">onPause · onStop</text>
<rect class="box" x="445" y="44" width="145" height="32" rx="6"/><text class="mono small" x="517" y="64" text-anchor="middle">onStart · onResume</text>
<path class="edge" d="M225,60 L268,60" marker-end="url(#l03-inst-arrow)"/>
<text class="small muted" x="247" y="54" text-anchor="middle">Home</text>
<path class="edge" d="M400,60 L443,60" marker-end="url(#l03-inst-arrow)"/>
<text class="small muted" x="422" y="54" text-anchor="middle">mở lại</text>
<text class="title" x="8" y="114" font-weight="600">Xoay máy</text>
<rect class="edge dashed" x="8" y="122" width="232" height="64" rx="8"/>
<text class="small muted" x="16" y="136">instance cũ</text>
<rect class="box" x="15" y="144" width="218" height="32" rx="6"/><text class="mono small" x="124" y="164" text-anchor="middle">onPause · onStop · onDestroy</text>
<rect class="edge dashed" x="272" y="122" width="232" height="64" rx="8"/>
<text class="small muted" x="280" y="136">instance mới (đã khôi phục)</text>
<rect class="box" x="279" y="144" width="218" height="32" rx="6"/><text class="mono small" x="388" y="164" text-anchor="middle">onCreate · onStart · onResume</text>
<path class="edge" d="M233,160 L277,160" marker-end="url(#l03-inst-arrow)"/>
</svg>
<figcaption>Home giữ nguyên instance. Xoay máy thay instance khác, nên mọi thứ cất trong field của instance cũ đều mất.</figcaption>
</figure>

!!! warning "Gotcha · xoay máy huỷ Activity"
    Mặc định, một thay đổi cấu hình như xoay máy, bật/tắt dark mode, hay đổi cỡ chữ sẽ huỷ Activity và tạo một instance mới ([Android: Handle configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes)).
    Mọi thứ cất trong field của instance cũ đều mất. Một object kết nối BLE giữ trong Activity sẽ bị đánh rơi giữa chừng trong khi đường kết nối radio có thể vẫn còn mở.
    Vì vậy, từ bài 08, state sống trong một **ViewModel**, thứ sống sót qua thay đổi cấu hình, không bao giờ nằm trong Activity.

!!! warning "Gotcha · Back không ổn định như Home"
    Android 12 có ghi trong tài liệu rằng bấm Back trên một launcher activity ở gốc task của nó sẽ đưa task xuống nền thay vì kết thúc nó ([Android 12 behaviour changes](https://developer.android.com/about/versions/12/behavior-changes-all)).
    Trong lần test của chúng tôi trên Android 16 / targetSdk 36, nó *đã* bị kết thúc (`onDestroy`, `changingConfigurations=false`), và lần mở sau là một `onCreate` lạnh.
    Cách xử lý Back vẫn liên tục thay đổi ([predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture)). Đừng xây thứ gì dựa vào việc Back giữ app của bạn còn sống, và hãy kiểm tra Logcat trên chính máy của bạn.

!!! warning "Gotcha · track XML: đúng file layout"
    Các template nhiều màn hình của Android Studio đặt layout của Activity (chứa một nav host) và layout của từng màn hình (`fragment_*.xml`) ở các file riêng.
    Thêm widget vào layout của Activity có thể đẩy mất container đang chứa các màn hình của bạn, và rồi màn hình bạn mong đợi không bao giờ hiện ra. Luôn sửa đúng file mà bài nêu tên.

## Chương trình này đi đâu trong app

Trong Native Device Monitor, Activity là một lớp vỏ Android mỏng mà hệ điều hành có thể dựng lại bất cứ lúc nào, nên nó không sở hữu thứ gì cần sống qua một lần xoay máy.
Mỗi thứ bạn có thể bị cám dỗ giữ trong nó đều có chỗ ở khác. Màu sắc là **mã màu** của khoá, giống bài 00–02.

<figure class="diagram">
<svg class="dg" viewBox="0 0 640 190" role="img" aria-labelledby="l03-map-title">
<title id="l03-map-title">Mỗi việc thuộc về đâu. Hiển thị màn hình ở lại Android, trong Activity, một lớp vỏ mỏng có thể dựng lại khi xoay máy. Giữ state của màn hình thuộc về một ViewModel Kotlin dùng chung, một inbound adapter, thứ sống sót qua xoay máy (bài 08). Giữ một kết nối BLE thuộc về một Android BLE adapter, một outbound adapter đứng sau một outbound port, nằm ngoài Activity (bài 14).</title>
<defs><marker id="l03-map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<text class="small muted" x="120" y="14" text-anchor="middle">Các việc trong app</text>
<text class="small muted" x="460" y="14" text-anchor="middle">Mỗi việc thuộc về đâu</text>
<rect class="box" x="20" y="24" width="200" height="44" rx="6"/><text class="mono" x="120" y="51" text-anchor="middle">Hiển thị màn hình</text>
<rect class="box" x="20" y="80" width="200" height="44" rx="6"/><text class="mono" x="120" y="107" text-anchor="middle">Giữ state màn hình</text>
<rect class="box" x="20" y="136" width="200" height="44" rx="6"/><text class="mono" x="120" y="163" text-anchor="middle">Giữ một kết nối BLE</text>
<path class="edge" d="M220,46 L298,46" marker-end="url(#l03-map-arrow)"/>
<path class="edge" d="M220,102 L298,102" marker-end="url(#l03-map-arrow)"/>
<path class="edge" d="M220,158 L298,158" marker-end="url(#l03-map-arrow)"/>
<g data-part="android">
<rect class="box" x="300" y="24" width="320" height="44" rx="6"/>
<text class="title" x="314" y="42">Android</text>
<text class="small muted" x="314" y="59">ở lại, như một lớp vỏ mỏng dựng lại được</text>
</g>
<g data-part="inbound">
<rect class="box" x="300" y="80" width="320" height="44" rx="6"/>
<text class="title" x="314" y="98">Inbound adapter (Kotlin)</text>
<text class="small muted" x="314" y="115">một ViewModel dùng chung, sống sót qua xoay máy</text>
</g>
<g data-part="outbound">
<rect class="box" x="300" y="136" width="320" height="44" rx="6"/>
<text class="title" x="314" y="154">Outbound adapter (Kotlin, Android)</text>
<text class="small muted" x="314" y="171">đứng sau một outbound port, nằm ngoài Activity</text>
</g>
</svg>
<figcaption>Activity hiển thị màn hình và chuyển tiếp input. Bài 08 thêm ViewModel, bài 14 thêm adapter kết nối BLE. Bài 10 giải thích port và adapter.
<ul class="legend"><li data-part="android">Android</li><li data-part="inbound">Inbound</li><li data-part="outbound">Outbound</li></ul>
</figcaption>
</figure>

## 5. Đọc Java

Những phần cũ hơn trong code Android của team có thể vẫn là Java. Bạn chỉ cần *đọc* được, không cần viết: class, constructor, field, interface, `@Override`, generics, callback.
Làm hết [Java reading cheatsheet](https://phongna-inn.github.io/carmd-kmp-course/reference/java-reading-cheatsheet.html), trong đó có một ví dụ được chú thích và một phần tự kiểm tra.

!!! question "Hỏi agent của bạn"
    Nhờ agent giải thích bất cứ thứ gì làm bạn bất ngờ trong log. Bất ngờ chính là mục đích của bài này.
    Ví dụ: *"What would change in the log if the Activity declared `android:configChanges="orientation"`?"* (Nếu Activity khai báo `android:configChanges="orientation"` thì log sẽ đổi gì?)

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Bạn bấm Home, rồi mở lại app. Callback nào <em>không</em> chạy lại?</p>
<div class="opts">
<button class="opt">onStart</button>
<button class="opt" data-correct>onCreate</button>
<button class="opt">onResume</button>
</div>
<p class="feedback"></p>
<p class="why">Home chỉ stop Activity. Cùng instance đó resume lại, nên phần setup một lần trong <code>onCreate</code> được bỏ qua.</p>
</div>

<div class="quiz">
<p class="q">Sau một lần xoay máy, <code>savedInstanceState</code> trong <code>onCreate</code> là gì?</p>
<div class="opts">
<button class="opt">luôn là null</button>
<button class="opt" data-correct>khác null</button>
<button class="opt">UI cũ</button>
</div>
<p class="feedback"></p>
<p class="why">Hệ điều hành đang tạo lại một instance đã bị huỷ, nên nó truyền vào bundle state đã lưu.</p>
</div>

<div class="quiz">
<p class="q">Con số SDK nào quyết định bản Android cũ nhất cài được app của bạn?</p>
<div class="opts">
<button class="opt" data-correct>minSdk</button>
<button class="opt">maxSdk</button>
<button class="opt">tgtSdk</button>
</div>
<p class="feedback"></p>
<p class="why"><code>compileSdk</code> = những API bạn nhìn thấy được; <code>targetSdk</code> = hành vi lúc chạy mà bạn chọn theo.</p>
</div>

<div class="quiz">
<p class="q">File nào báo cho hệ điều hành biết <code>MainActivity</code> là cái mà launcher khởi động?</p>
<div class="opts">
<button class="opt">app/build.gradle.kts</button>
<button class="opt" data-correct>AndroidManifest.xml</button>
<button class="opt">settings.gradle.kts</button>
</div>
<p class="feedback"></p>
<p class="why">Intent filter <code>MAIN</code> + <code>LAUNCHER</code> trong manifest đánh dấu cửa vào của launcher. Các file Gradle cấu hình việc build, không phải các thành phần của app đã cài.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Trong <code>onCreate(savedInstanceState: Bundle?)</code>, dấu <code>?</code> nghĩa là gì? (Bài 01)</p>
<div class="opts">
<button class="opt" data-correct>Giá trị có thể là null</button>
<button class="opt">Tham số có thể bỏ trống khi gọi</button>
<button class="opt">Kiểu được kiểm tra lúc chạy</button>
</div>
<p class="feedback"></p>
<p class="why">Đó là kiểu nullable của Kotlin, giống <code>Bundle | null</code> trong TypeScript. Lần mở đầu tiên truyền vào null.</p>
</div>

<div class="quiz">
<p class="q">Trong Swift (bài 02), <code>var b = a</code> cho <code>b</code> một bản copy riêng khi <code>a</code> là:</p>
<div class="opts">
<button class="opt" data-correct>struct</button>
<button class="opt">class</button>
<button class="opt">protocol</button>
</div>
<p class="feedback"></p>
<p class="why">Struct là value type. Instance của class được dùng chung theo tham chiếu.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent)"
    1. Trước khi đụng vào app, viết ra các dòng Logcat bạn *đoán* sẽ thấy cho chuỗi: mở app → Home → mở lại → xoay máy → mở một trang web → quay lại → Back. Rồi làm thật và so dự đoán với thực tế.
    2. Thêm một override `onRestart()` ghi log `"onRestart"`. Đoán xem bước nào của bạn sẽ in ra nó, rồi kiểm tra.

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm track bạn chọn. Sau đó đọc code của nó đối chiếu với các phần giải thích ở trên, tự chạy app, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/03-android-fundamentals.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/03-android-fundamentals.html" -o .course/lesson-03.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html" -o .course/ref-platform-lifecycles-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/java-reading-cheatsheet.html" -o .course/ref-java-reading-cheatsheet.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html" -o .course/ref-glossary.html
Use these files to answer my questions about this lesson without asking me for context.
Then build what follows, using the lesson's "Full files" for my track exactly,
except where the brief below says otherwise.

Lesson 03 (Android fundamentals): build a scratch Android app that logs lifecycle events.
My track: Android = [Compose | XML]  (default Compose).
Starting point: nothing. Work in scratch/lesson-03/android/ in my workspace.
Prereqs: JDK 17+, Android SDK (ANDROID_HOME, or sdk.dir in local.properties), any Gradle
install to bootstrap the wrapper once (`brew install gradle`, or let Android Studio open the
project).

1. Gradle wrapper: run `gradle wrapper --gradle-version 9.8.2` in the folder. It writes
   gradlew, gradlew.bat, gradle/wrapper/gradle-wrapper.jar and
   gradle/wrapper/gradle-wrapper.properties. AGP 9.4 needs Gradle 9.6 or newer.
2. Create exactly these files, complete, as in the lesson's "Full files" section for my
   track:
     settings.gradle.kts
     build.gradle.kts            (Compose track has the extra Compose compiler plugin line)
     gradle.properties
     app/build.gradle.kts
     app/src/main/AndroidManifest.xml
     app/src/main/java/com/example/lesson03/MainActivity.kt
     XML track only: app/src/main/res/layout/activity_main.xml
   Do NOT apply org.jetbrains.kotlin.android (AGP 9 has built-in Kotlin; it fails the
   build). compileSdk 37 is required by current Compose/AndroidX libs.
3. Build: ./gradlew :app:assembleDebug

Acceptance checks:
- The build succeeds with no compiler warnings from our own code (lint suggestions such as
  hard-coded strings are fine for a scratch app; don't use -q to check warnings). Gradle's
  "Deprecated Gradle features ... incompatible with Gradle 10" line, which comes from a
  plugin, and the packaging note "Unable to strip the following libraries" are expected.
- Launch logs (tag Lifecycle), read with `adb logcat -d -s Lifecycle:D` after installing
  and launching on an emulator or device: "onCreate (restored=false)", "onStart",
  "onResume".
Then walk me through each file line by line. Do NOT run the lifecycle experiments or the
unaided exercise for me; I do those myself.
```

## Đọc thêm

- [Cheatsheet: vòng đời các nền tảng](https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html), cả hai nền tảng và mọi track trên một trang.
- [Java reading cheatsheet](https://phongna-inn.github.io/carmd-kmp-course/reference/java-reading-cheatsheet.html)
- [Từ điển của khoá](https://phongna-inn.github.io/carmd-kmp-course/reference/glossary.html)
- Kinh nghiệm thực tế: [r/androiddev](https://reddit.com/r/androiddev) cho những câu hỏi kiểu "hành vi vòng đời này có bình thường không?".

## File đầy đủ

Mọi file bài này tạo ra, đầy đủ. Mở một file để đối chiếu với bài làm của bạn. Các file Gradle wrapper do `gradle wrapper` sinh ra.

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

    rootProject.name = "Lesson03Android"
    include(":app")
    ```

??? example "gradle.properties"
    ```properties
    android.useAndroidX=true
    ```

=== "Compose"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
            id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
        }
        ```

    ??? example "app/build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application")
            id("org.jetbrains.kotlin.plugin.compose")
        }

        android {
            namespace = "com.example.lesson03"
            compileSdk = 37

            defaultConfig {
                applicationId = "com.example.lesson03"
                minSdk = 26
                targetSdk = 36
                versionCode = 1
                versionName = "1.0"
            }

            buildFeatures { compose = true }
        }

        dependencies {
            implementation(platform("androidx.compose:compose-bom:2026.09.00"))
            implementation("androidx.core:core-ktx:1.19.1")
            implementation("androidx.activity:activity-compose:1.13.0")
            implementation("androidx.compose.material3:material3")
        }
        ```

    ??? example "app/src/main/AndroidManifest.xml"
        ```xml
        <?xml version="1.0" encoding="utf-8"?>
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">

            <application
                android:label="Lesson 03"
                android:theme="@android:style/Theme.Material.Light.NoActionBar">

                <activity
                    android:name=".MainActivity"
                    android:exported="true">
                    <intent-filter>
                        <action android:name="android.intent.action.MAIN" />
                        <category android:name="android.intent.category.LAUNCHER" />
                    </intent-filter>
                </activity>
            </application>
        </manifest>
        ```

    ??? example "app/src/main/java/com/example/lesson03/MainActivity.kt"
        ```kotlin
        package com.example.lesson03

        import android.content.Intent
        import android.os.Bundle
        import android.util.Log
        import androidx.activity.ComponentActivity
        import androidx.activity.compose.setContent
        import androidx.compose.foundation.layout.Arrangement
        import androidx.compose.foundation.layout.Column
        import androidx.compose.foundation.layout.fillMaxSize
        import androidx.compose.foundation.layout.padding
        import androidx.compose.material3.Button
        import androidx.compose.material3.Text
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.unit.dp
        import androidx.core.net.toUri

        private const val TAG = "Lifecycle"

        class MainActivity : ComponentActivity() {

            override fun onCreate(savedInstanceState: Bundle?) {
                super.onCreate(savedInstanceState)
                Log.d(TAG, "onCreate (restored=${savedInstanceState != null})")
                setContent {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Text("Lesson 03: watch Logcat, filter tag:Lifecycle")
                        Button(onClick = { openWebPage() }) {
                            Text("Open a web page")
                        }
                    }
                }
            }

            private fun openWebPage() {
                val intent = Intent(Intent.ACTION_VIEW, "https://developer.android.com".toUri())
                startActivity(intent)
            }

            override fun onStart() {
                super.onStart()
                Log.d(TAG, "onStart")
            }

            override fun onResume() {
                super.onResume()
                Log.d(TAG, "onResume")
            }

            override fun onPause() {
                super.onPause()
                Log.d(TAG, "onPause")
            }

            override fun onStop() {
                super.onStop()
                Log.d(TAG, "onStop")
            }

            override fun onDestroy() {
                super.onDestroy()
                Log.d(TAG, "onDestroy (changingConfigurations=$isChangingConfigurations)")
            }
        }
        ```

=== "XML"

    ??? example "build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application") version "9.4.1" apply false
        }
        ```

    ??? example "app/build.gradle.kts"
        ```kotlin
        plugins {
            id("com.android.application")
        }

        android {
            namespace = "com.example.lesson03"
            compileSdk = 37

            defaultConfig {
                applicationId = "com.example.lesson03"
                minSdk = 26
                targetSdk = 36
                versionCode = 1
                versionName = "1.0"
            }
        }

        dependencies {
            implementation("androidx.core:core-ktx:1.19.1")
            implementation("androidx.appcompat:appcompat:1.8.0")
        }
        ```

    ??? example "app/src/main/AndroidManifest.xml"
        ```xml
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <application
                android:label="Lesson 03"
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

    ??? example "app/src/main/res/layout/activity_main.xml"
        ```xml
        <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:padding="24dp">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Lesson 03: watch Logcat, filter tag:Lifecycle" />

            <Button
                android:id="@+id/openWebButton"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="16dp"
                android:text="Open a web page" />
        </LinearLayout>
        ```

    ??? example "app/src/main/java/com/example/lesson03/MainActivity.kt"
        ```kotlin
        package com.example.lesson03

        import android.content.Intent
        import android.os.Bundle
        import android.util.Log
        import android.widget.Button
        import androidx.appcompat.app.AppCompatActivity
        import androidx.core.net.toUri

        private const val TAG = "Lifecycle"

        class MainActivity : AppCompatActivity() {

            override fun onCreate(savedInstanceState: Bundle?) {
                super.onCreate(savedInstanceState)
                Log.d(TAG, "onCreate (restored=${savedInstanceState != null})")
                setContentView(R.layout.activity_main)
                findViewById<Button>(R.id.openWebButton).setOnClickListener { openWebPage() }
            }

            private fun openWebPage() {
                val intent = Intent(Intent.ACTION_VIEW, "https://developer.android.com".toUri())
                startActivity(intent)
            }

            override fun onStart() {
                super.onStart()
                Log.d(TAG, "onStart")
            }

            override fun onResume() {
                super.onResume()
                Log.d(TAG, "onResume")
            }

            override fun onPause() {
                super.onPause()
                Log.d(TAG, "onPause")
            }

            override fun onStop() {
                super.onStop()
                Log.d(TAG, "onStop")
            }

            override fun onDestroy() {
                super.onDestroy()
                Log.d(TAG, "onDestroy (changingConfigurations=$isChangingConfigurations)")
            }
        }
        ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Code Android trong phần này chỉ để minh hoạ, không kèm output. Ví dụ Kotlin có output (A5, A9) là chương trình console đã chạy thật (Kotlin 2.4.21, JVM 17). Log Logcat ở A7 và A10 đo thật bằng app của bài trên emulator Android 14.

### A1. Các file Gradle, nhìn bằng mắt dev npm

Giải thích thêm cho [mục 1](#1-trong-mot-project-android-co-gi).

Project Android gần giống một **monorepo npm**: gốc repo khai báo các package con, mỗi package con có file cấu hình riêng.

| Việc | Thế giới TS / npm | Android / Gradle |
|---|---|---|
| Liệt kê các package con | `pnpm-workspace.yaml` / `"workspaces"` | `settings.gradle.kts` (`include(":app")`) |
| Lấy thư viện từ đâu | registry trong `.npmrc` | `repositories { google(); mavenCentral() }` |
| Cấu hình + dependency của một package | `package.json` của package đó | `app/build.gradle.kts` |
| Chốt phiên bản công cụ build | `"packageManager": "pnpm@9…"`, `.nvmrc` | `gradle/wrapper/` + chạy `./gradlew` thay vì `gradle` |
| Cài thư viện | `"dependencies": { "x": "1.2.3" }` | `implementation("group:name:1.2.3")` |
| Một bộ phiên bản đi chung | peer deps / một meta-package | BOM: `implementation(platform("…-bom:…"))` |
| Cấu hình chung | `.npmrc`, biến môi trường | `gradle.properties` |
| Thư mục sinh ra, không commit | `node_modules/`, `dist/` | `.gradle/`, `build/` |
| Chạy build | `npm run build` | `./gradlew :app:assembleDebug` |

Hai chỗ khác npm đáng nhớ:

- File build là **code Kotlin** (`.kts`), không phải JSON. IDE gợi ý và báo lỗi được ngay trong file build.
- `build.gradle.kts` ở gốc chỉ **khai báo** plugin với phiên bản (`apply false`), module `app` mới **dùng** chúng, không cần ghi lại phiên bản.

### A2. Ba con số SDK: nhìn thấy, cài được, chạy theo

Giải thích thêm cho ghi chú 2 của [mục 1](#1-trong-mot-project-android-co-gi).

!!! abstract "Một câu để nhớ"
    Hình dung app là một **cuốn sách hướng dẫn nấu ăn**.
    `compileSdk` là **bộ dụng cụ bếp bạn biết tên** lúc viết sách (biết nồi chiên không dầu thì mới viết được món dùng nó).
    `minSdk` là **căn bếp cũ nhất** mà sách vẫn dùng được.
    `targetSdk` là **"sách này đã được nấu thử ở bếp đời X"**: bếp mới thấy dòng đó thì áp quy tắc an toàn mới nhất cho bạn.

| Con số | Bài này | Ảnh hưởng tới | Gần nhất bên web |
|---|---|---|---|
| `compileSdk` | 37 | Code thấy được API nào lúc **biên dịch**. Không đổi gì lúc chạy | Phiên bản `lib` / `@types` trong `tsconfig` |
| `minSdk` | 26 (Android 8.0) | Máy cũ hơn **không cài được** app | `browserslist` (trình duyệt cũ nhất hỗ trợ) |
| `targetSdk` | 36 (Android 16) | Máy mới bật **hành vi mới** cho app (quyền, nền, bảo mật…) | Không có thứ tương đương thật |

Ví dụ thật ngay trong bài: vì `targetSdk` ≥ 31 nên Android bắt ghi `android:exported` (ghi chú 1 của mục 2). Hạ `targetSdk` xuống 30 thì quy tắc đó không áp, nhưng Google Play không nhận app target quá thấp, nên đừng làm vậy.

Quy luật luôn đúng: `minSdk` ≤ `targetSdk` ≤ `compileSdk`.

### A3. Explicit và implicit Intent

Giải thích thêm cho [mục 2](#2-activity-context-intent-manifest).

!!! abstract "Một câu để nhớ"
    **Explicit intent** là gọi điện cho **đích danh một người**: "cho tôi gặp `SettingsActivity`".
    **Implicit intent** là **đăng lên nhóm chat**: "ai mở được link này không?", rồi hệ điều hành chọn người trả lời (hoặc hỏi bạn chọn app nào).

Dev web đã quen kiểu implicit mà không biết: link `mailto:` hay `tel:` để hệ điều hành chọn app mail / app gọi điện.

```kotlin
// explicit: nêu class, chỉ dùng cho Activity trong app của mình
startActivity(Intent(this, SettingsActivity::class.java))

// implicit: nêu action + dữ liệu, hệ điều hành tìm app có intent filter khớp
startActivity(Intent(Intent.ACTION_VIEW, "https://developer.android.com".toUri()))
```

| | Explicit | Implicit |
|---|---|---|
| Nêu gì | class đích | action (+ dữ liệu) |
| Ai xử lý | đúng class đó | app nào có intent filter khớp |
| Bên web giống | `router.push('/settings')` | `<a href="mailto:…">`, `window.open(url)` |
| Dùng trong bài | không | nút "Open a web page" |

`this` truyền vào `Intent(this, …)` chính là **Context** (Activity *là* một Context): Android cần biết ai đang nhờ để mở đúng chỗ.

### A4. Vòng đời Activity so với một tab trình duyệt

Giải thích thêm cho [mục 3](#3-vong-oi-activity-ghi-ra-log) và [mục 4](#4-thuc-te-xay-ra-gi).

Gần nhất với một Activity bên web là **một tab trình duyệt đang mở trang của bạn**. Phép so sánh không khớp hoàn toàn, nhưng đủ để nhớ thứ tự:

| Android | Khi nào | Gần giống bên web |
|---|---|---|
| `onCreate` | instance mới được tạo | trang load lần đầu, component mount |
| `onStart` | bắt đầu nhìn thấy | `visibilitychange` → `visible` |
| `onResume` | ở phía trước, nhận được chạm | cửa sổ nhận `focus` |
| `onPause` | mất quyền nhận chạm (sắp bị che) | `blur` |
| `onStop` | không còn nhìn thấy (Home, app khác che) | `visibilitychange` → `hidden` (chuyển tab) |
| `onRestart` | quay lại sau `onStop` | quay lại tab cũ |
| `onDestroy` | instance bị huỷ | `pagehide` / đóng tab, component unmount |

Chỗ khác web lớn nhất: **xoay máy giống bấm F5**. Trang bị dựng lại từ đầu, mọi biến JS trong trang mất. Còn Home chỉ giống chuyển sang tab khác: trang vẫn còn nguyên.

!!! tip "Áp vào app"
    `onResume` / `onPause` là cặp hợp để bật / tắt thứ chỉ cần khi người dùng đang nhìn (ví dụ cập nhật vạch sóng RSSI liên tục). Thứ phải chạy tiếp khi màn hình xoay hay bị che (kết nối BLE, log nền) thì không được gắn vào Activity, như mục "Chương trình này đi đâu trong app" đã nói.

### A5. Vì sao xoay máy làm mất field

Giải thích thêm cho [gotcha xoay máy](#4-thuc-te-xay-ra-gi).

Chương trình console dưới đây **giả lập** việc hệ điều hành thay Activity bằng một instance mới. Nó không phải code Android, chỉ để thấy cơ chế:

- field nằm trong `FakeActivity` → mất khi "xoay";
- `Holder` sống bên ngoài Activity (vai trò ViewModel ở bài 08) → còn nguyên;
- `onSaveInstanceState` cất một con số nhỏ vào "bundle" → instance mới đọc lại được, nhưng kết nối thì không cất kiểu này được.

```kotlin
class Holder { var connected = false; var taps = 0 }

class FakeActivity(private val holder: Holder, saved: Map<String, Int>?) {
    var tapsInField = saved?.get("taps") ?: 0
    var connectionInField: String? = null
    init { println("onCreate (restored=${saved != null})  field taps=$tapsInField  holder taps=${holder.taps}  conn=$connectionInField") }
    fun tap() { tapsInField++; holder.taps++ }
    fun connect() { connectionInField = "BLE AA:01"; holder.connected = true }
    fun onSaveInstanceState(): Map<String, Int> = mapOf("taps" to tapsInField)
}

fun main() {
    val holder = Holder()               // sống ngoài Activity, như ViewModel
    var activity = FakeActivity(holder, saved = null)
    activity.tap(); activity.tap(); activity.connect()
    println("before rotate: field taps=${activity.tapsInField}  conn=${activity.connectionInField}")

    println("-- rotate, no saved state --")
    activity = FakeActivity(holder, saved = null)
    println("after: field taps=${activity.tapsInField}  conn=${activity.connectionInField}  holder.connected=${holder.connected}")

    activity.tap()
    println("-- rotate, with saved state --")
    val bundle = activity.onSaveInstanceState()
    activity = FakeActivity(holder, saved = bundle)
    println("after: field taps=${activity.tapsInField}  conn=${activity.connectionInField}  holder taps=${holder.taps}")
}
```

Output:

```text
onCreate (restored=false)  field taps=0  holder taps=0  conn=null
before rotate: field taps=2  conn=BLE AA:01
-- rotate, no saved state --
onCreate (restored=false)  field taps=0  holder taps=2  conn=null
after: field taps=0  conn=null  holder.connected=true
-- rotate, with saved state --
onCreate (restored=true)  field taps=1  holder taps=3  conn=null
after: field taps=1  conn=null  holder taps=3
```

| Cách giữ | Sống qua xoay máy? | Sống qua app bị kill nền? | Hợp để giữ |
|---|---|---|---|
| Field trong Activity | không | không | thứ tính lại được ngay |
| `savedInstanceState` (Bundle) | có | có | vài giá trị nhỏ: id, vị trí cuộn, chữ đang gõ |
| ViewModel (bài 08) | có | không | state màn hình, danh sách thiết bị |
| Adapter ngoài Activity (bài 14) | có | tuỳ cách chạy nền | kết nối BLE |

Bên web: field trong Activity ≈ biến trong component; Bundle ≈ `sessionStorage`; ViewModel ≈ store (Redux/Zustand) sống ngoài component.

### A6. Vòng đời là chuyện một quán cà phê

Giải thích thêm cho [mục 3](#3-vong-oi-activity-ghi-ra-log). Nếu chỉ nhớ được một mục trong Appendix về vòng đời, hãy nhớ mục này.

Hình dung Activity là **một quán cà phê**, còn hệ điều hành là **ông chủ** quyết định lúc nào mở, lúc nào đóng. Quán không tự quyết; nó chỉ được *báo* qua từng callback.

| Callback | Ở quán cà phê | Trạng thái sau callback |
|---|---|---|
| `onCreate` | Xây quán, kê bàn ghế, treo menu (làm **một lần**) | tồn tại, chưa ai thấy |
| `onStart` | Kéo cửa cuốn lên: người đi đường **nhìn thấy** quán | nhìn thấy được |
| `onResume` | Mở quầy, bắt đầu **nhận order** | ở phía trước, tương tác được |
| `onPause` | Đóng quầy tạm (có xe đỗ chắn trước cửa). Trên điện thoại: bảng chia sẻ trồi lên che nửa màn hình (A7) | vẫn thấy, nhưng không nhận order |
| `onStop` | Kéo cửa cuốn xuống, đi về. Quán **vẫn còn đó** | không ai thấy, nhưng còn tồn tại |
| `onDestroy` | Dỡ quán | hết |

**Quy tắc quan trọng nhất: callback đi theo cặp đối xứng, lồng vào nhau như búp bê Nga.**

```text
onCreate ┌──────────────────── tồn tại ────────────────────┐ onDestroy
 onStart   ┌────────────── nhìn thấy được ──────────────┐   onStop
  onResume   ┌──────── tương tác được ────────┐   onPause
```

- Muốn vào lớp trong cùng (tương tác được), phải đi qua mọi lớp ngoài: **luôn** `onCreate → onStart → onResume`, không bao giờ nhảy cóc.
- Đi ra cũng vậy, theo thứ tự ngược: **luôn** `onPause → onStop → onDestroy`.
- Ra tới lớp nào thì vào lại từ lớp đó. Home chỉ ra tới `onStop`, nên mở lại chỉ cần `onStart → onResume`: quán không xây lại.

!!! abstract "Một câu để nhớ"
    **Mở ở callback nào thì đóng ở callback đối xứng của nó**: `onCreate` ↔ `onDestroy`, `onStart` ↔ `onStop`, `onResume` ↔ `onPause`.

### A7. Đo thật trên emulator: thêm các tình huống ngoài bài

Giải thích thêm cho [mục 4](#4-thuc-te-xay-ra-gi). Bảng ở mục 4 chỉ có sáu thao tác. Dưới đây là log **đo thật** bằng đúng app của bài (track Compose, file ở mục [File đầy đủ](#file-ay-u)) trên emulator Pixel 8 Android 14 (API 34), mỗi tình huống chạy bằng một lệnh `adb` để bạn tự lặp lại được.

| Bạn làm | Lệnh adb để tự thử | Logcat hiện | Vì sao |
|---|---|---|---|
| Kéo thanh thông báo xuống | `adb shell cmd statusbar expand-notifications` | *(không có gì)* | App vẫn nằm phía sau, vẫn là Activity ở trên cùng |
| Mở Quick Settings | `adb shell cmd statusbar expand-settings` | *(không có gì)* | Giống trên |
| Bảng chia sẻ (share sheet) trồi lên che nửa dưới | `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT hi` | chỉ `onPause` | App **vẫn nhìn thấy** phía sau (bị làm mờ) nhưng không chạm được: đứng giữa hai lớp |
| Đóng bảng chia sẻ (Back) | `adb shell input keyevent KEYCODE_BACK` | chỉ `onResume` | Quay lại lớp trong cùng, không cần `onStart` |
| Bấm nút nguồn (khoá máy) | `adb shell input keyevent KEYCODE_SLEEP` | `onPause · onStop` | Màn hình tắt = không ai nhìn thấy, y như Home |
| Mở khoá lại | `adb shell input keyevent KEYCODE_WAKEUP` rồi `adb shell wm dismiss-keyguard` | `onStart · onResume` | Cùng instance quay lại |
| Bật / tắt dark mode | `adb shell cmd uimode night yes` | `onPause · onStop · onDestroy (changingConfigurations=true) · onCreate (restored=true) · onStart · onResume` | Đổi cấu hình, **y như xoay máy** |
| Đổi cỡ chữ hệ thống | `adb shell settings put system font_scale 1.3` | giống dark mode | Đổi cấu hình |
| Xoay máy | `adb shell wm user-rotation lock 1` | giống dark mode | Đổi cấu hình |
| Home, rồi **hệ điều hành kill tiến trình** (thiếu RAM) | `adb shell input keyevent KEYCODE_HOME` rồi `adb shell am kill com.example.lesson03` | Home: `onPause · onStop`. Lúc kill: ***không có gì***, **không có `onDestroy`** | Tiến trình bị giết thẳng, không ai kịp gọi callback |
| Mở lại sau khi bị kill | bấm icon app | `onCreate (restored=true) · onStart · onResume` | Tiến trình mới, nhưng hệ điều hành trả lại Bundle đã cất |
| Buộc dừng (Settings → Force stop) khi app đang mở | `adb shell am force-stop com.example.lesson03` | *(không có gì)* | Cũng giết thẳng, không callback |
| Mở lại sau Force stop | bấm icon app | `onCreate (restored=false) · onStart · onResume` | Force stop xoá luôn state đã cất, bắt đầu lạnh |

Xem log trong terminal thay vì Android Studio: `adb logcat -s Lifecycle:D` (giữ cửa sổ này mở trong lúc thử).

Ba bài học rút ra từ bảng:

1. **`onDestroy` không chắc được gọi.** Khi app ở nền, hệ điều hành có thể giết tiến trình mà không báo gì. Đừng bao giờ đợi tới `onDestroy` mới lưu thứ quan trọng (bản nháp, cài đặt); hãy lưu ở `onPause` / `onStop`, hai callback mà app ở nền chắc chắn đã đi qua.
2. **`restored=true` không có nghĩa là "cùng tiến trình".** Sau xoay máy hay sau khi bị kill nền, đều là `restored=true`. Field trong Activity và trong ViewModel đều mất khi tiến trình chết, chỉ Bundle (`savedInstanceState`) còn (xem bảng ở [A5](#a5-vi-sao-xoay-may-lam-mat-field)).
3. **Không phải mọi thứ che lên app đều làm nó pause.** Thanh thông báo không gây callback nào. Còn màn Recents (đa nhiệm) thì tuỳ máy và tuỳ bản Android: trên emulator này, mở Recents bằng `adb shell input keyevent KEYCODE_APP_SWITCH` không gây callback nào. Đừng xây logic dựa vào việc Recents phải gọi `onPause`; hãy tự đo trên máy của bạn.

!!! tip "Áp vào app"
    Dark mode và cỡ chữ là hai thứ người dùng thật đổi thường xuyên, nhiều hơn xoay máy. Nếu Native Device Monitor giữ danh sách thiết bị trong field của Activity, chỉ cần người dùng bật dark mode lúc 6 giờ tối là danh sách biến mất. Đó là lý do bài 08 đưa state vào ViewModel.

### A8. Mở ở đâu, đóng ở đâu: ví dụ áp vào app

Giải thích thêm cho quy tắc cặp đối xứng ở [A6](#a6-vong-oi-la-chuyen-mot-quan-ca-phe).

Câu hỏi đúng khi cầm một việc trong tay không phải "đặt ở callback nào?" mà là **"việc này cần sống trong khoảng nào?"**: tồn tại, nhìn thấy được, hay tương tác được. Chọn khoảng rồi, mở ở đầu khoảng và đóng ở cuối khoảng.

| Việc | Cần sống khi | Mở ở | Đóng ở | Quên đóng thì sao |
|---|---|---|---|---|
| Dựng UI (`setContent { }`) | Activity tồn tại | `onCreate` | (tự dọn) | — |
| Cập nhật vạch sóng RSSI mỗi giây | người dùng đang nhìn và chạm được | `onResume` | `onPause` | Tốn pin khi app đã ở nền |
| Camera preview | đang ở phía trước | `onResume` | `onPause` | App khác không mở được camera |
| Lắng nghe trạng thái Bluetooth bật/tắt để đổi chữ trên màn hình | màn hình nhìn thấy được | `onStart` | `onStop` | Cập nhật UI không ai thấy, có thể rò bộ nhớ |
| Lưu chữ người dùng đang gõ dở | trước khi có thể bị kill | `onPause` hoặc `onStop` | — | Mất bản nháp khi bị kill nền (A7) |
| Kết nối BLE tới thiết bị | **lâu hơn một màn hình** | không phải Activity | không phải Activity | Đứt kết nối mỗi lần xoay máy |

Ví dụ minh hoạ (không phải code của bài) cho dòng RSSI, viết theo kiểu callback của bài:

```kotlin
private var ticker: Job? = null

override fun onResume() {
    super.onResume()
    ticker = lifecycleScope.launch {          // bắt đầu khi tương tác được
        while (isActive) { refreshRssi(); delay(1_000) }
    }
}

override fun onPause() {
    ticker?.cancel()                          // dừng ở callback đối xứng
    ticker = null
    super.onPause()
}
```

Tìm cặp: `launch` ở `onResume`, `cancel` ở `onPause`. Mỗi lần bạn viết code mở một thứ trong một callback, hãy tự hỏi ngay "callback đối xứng của nó đâu?".

!!! info "Sau này bạn ít viết override hơn"
    Trong code Compose hiện đại, thay vì override từng callback, người ta dùng các API "lifecycle-aware" (tự biết vòng đời) để đăng ký một việc với đúng một khoảng. Ý tưởng vẫn y hệt: chọn khoảng, mở ở đầu, đóng ở cuối. Khoá dùng cách này từ bài 08.

### A9. Mô phỏng vòng đời bằng chương trình console

Giải thích thêm cho [mục 4](#4-thuc-te-xay-ra-gi) và [A7](#a7-o-that-tren-emulator-them-cac-tinh-huong-ngoai-bai).

Chương trình dưới đây **không phải code Android**. Nó giả lập hệ điều hành đẩy một Activity lên/xuống qua các trạng thái, mỗi bậc gọi đúng một callback, và đánh số mỗi **instance** (`#1`, `#2`…) để bạn thấy lúc nào là cùng một object, lúc nào là object mới. Output của nó khớp với log đo thật trên emulator ở mục 4 và A7.

```kotlin
enum class State { NONE, CREATED, STARTED, RESUMED }

class FakeActivity(private val id: Int, private val restored: Boolean) {
    var state = State.NONE
        private set

    private fun log(msg: String) = println("  #$id $msg")

    // Đi từng bậc lên/xuống, mỗi bậc gọi đúng một callback
    fun moveTo(target: State, changingConfigurations: Boolean = false) {
        while (state < target) {
            state = State.entries[state.ordinal + 1]
            when (state) {
                State.CREATED -> log("onCreate (restored=$restored)")
                State.STARTED -> log("onStart")
                State.RESUMED -> log("onResume")
                State.NONE -> Unit
            }
        }
        while (state > target) {
            when (state) {
                State.RESUMED -> log("onPause")
                State.STARTED -> log("onStop")
                State.CREATED -> log("onDestroy (changingConfigurations=$changingConfigurations)")
                State.NONE -> Unit
            }
            state = State.entries[state.ordinal - 1]
        }
    }
}

class Phone {
    private var nextId = 1
    private var activity: FakeActivity? = null
    private var hasSavedState = false

    private fun step(title: String, action: () -> Unit) {
        println("== $title ==")
        action()
    }

    private fun newActivity(restored: Boolean) =
        FakeActivity(nextId++, restored).also { activity = it }

    fun open() = step("Mở app") {
        val current = activity
        if (current == null) newActivity(restored = hasSavedState).moveTo(State.RESUMED)
        else current.moveTo(State.RESUMED)
    }

    fun home() = step("Bấm Home") { activity?.moveTo(State.CREATED) }

    fun rotate() = step("Xoay máy") {
        activity?.moveTo(State.NONE, changingConfigurations = true)
        newActivity(restored = true).moveTo(State.RESUMED)
    }

    fun killInBackground() = step("Hệ điều hành kill tiến trình (app đang ở nền)") {
        println("  (không callback nào: tiến trình chết luôn)")
        activity = null
        hasSavedState = true
    }

    fun back() = step("Bấm Back") {
        activity?.moveTo(State.NONE)
        activity = null
        hasSavedState = false
    }
}

fun main() {
    val phone = Phone()
    phone.open()
    phone.home()
    phone.open()
    phone.rotate()
    phone.home()
    phone.killInBackground()
    phone.open()
    phone.back()
    phone.open()
}
```

Output (Kotlin 2.4.21, JVM 17):

```text
== Mở app ==
  #1 onCreate (restored=false)
  #1 onStart
  #1 onResume
== Bấm Home ==
  #1 onPause
  #1 onStop
== Mở app ==
  #1 onStart
  #1 onResume
== Xoay máy ==
  #1 onPause
  #1 onStop
  #1 onDestroy (changingConfigurations=true)
  #2 onCreate (restored=true)
  #2 onStart
  #2 onResume
== Bấm Home ==
  #2 onPause
  #2 onStop
== Hệ điều hành kill tiến trình (app đang ở nền) ==
  (không callback nào: tiến trình chết luôn)
== Mở app ==
  #3 onCreate (restored=true)
  #3 onStart
  #3 onResume
== Bấm Back ==
  #3 onPause
  #3 onStop
  #3 onDestroy (changingConfigurations=false)
== Mở app ==
  #4 onCreate (restored=false)
  #4 onStart
  #4 onResume
```

Cách đọc:

- **Đếm số `#`**: chín thao tác nhưng chỉ có bốn instance. Home rồi mở lại vẫn là `#1`; xoay máy sinh `#2`; kill nền sinh `#3`; Back rồi mở sinh `#4`.
- Mọi field bạn cất trong `#1` không tồn tại trong `#2`. Đó chính là [gotcha xoay máy](#4-thuc-te-xay-ra-gi), nhìn bằng con số.
- `moveTo` đi **từng bậc** một: không có đường nào từ `RESUMED` xuống thẳng `NONE` mà bỏ qua `onPause`, `onStop`. Đó là quy tắc búp bê Nga của [A6](#a6-vong-oi-la-chuyen-mot-quan-ca-phe).

Bản giả lập này cố ý chỉ in sáu callback giống app của bài. `onRestart` để dành cho bài tự làm: sau khi thêm nó vào app thật, hãy tự đoán nó sẽ chen vào chỗ nào trong output trên rồi so với Logcat.

### A10. Đoán log trước, xem đáp án sau

Luyện cho mục "Đoán đúng Logcat" trong checklist cuối trang. Đọc tình huống, tự viết ra log, rồi mới mở đáp án. Tất cả đáp án đều lấy từ log đo thật ở mục 4 và A7.

??? question "1. App đang mở. Bạn kéo thanh thông báo xuống đọc tin nhắn, rồi kéo lên."
    **Không có dòng log nào.** Thanh thông báo nằm đè lên nhưng app vẫn là Activity ở trên cùng, nên hệ điều hành không gọi `onPause`.

??? question "2. App đang mở. Bạn bấm nút nguồn tắt màn hình, rồi mở khoá lại."
    Tắt màn hình: `onPause · onStop`. Mở khoá: `onStart · onResume`.
    Cùng một instance, không có `onCreate` lần hai, giống Home rồi mở lại.

??? question "3. App đang mở. Bạn vào Quick Settings bật dark mode."
    `onPause · onStop · onDestroy (changingConfigurations=true) · onCreate (restored=true) · onStart · onResume`.
    Dark mode là thay đổi cấu hình, xử lý y như xoay máy: instance cũ bị huỷ, instance mới được tạo.

??? question "4. Bạn bấm Home, đi chơi game nặng 30 phút. Hệ điều hành thiếu RAM nên giết tiến trình app. Bạn bấm icon mở lại. Có `onDestroy` không? Dòng `onCreate` ghi gì?"
    **Không có `onDestroy`.** Lúc bị giết, log im lặng hoàn toàn.
    Khi mở lại: `onCreate (restored=true) · onStart · onResume`. `restored=true` vì hệ điều hành đã cất Bundle trước khi giết tiến trình, dù đây là một tiến trình hoàn toàn mới.

??? question "5. Bạn muốn lưu chữ người dùng gõ dở. Đặt code lưu vào `onDestroy` có ổn không?"
    **Không.** Câu 4 cho thấy `onDestroy` có thể không bao giờ chạy. Lưu ở `onPause` hoặc `onStop`, hai callback app luôn đi qua trước khi rời màn hình.

??? question "6. Một bạn viết code bắt đầu quét BLE trong `onStart` và dừng quét trong `onPause`. Có vấn đề gì?"
    Hai callback **không phải một cặp đối xứng**. Với Home thì tình cờ vẫn chạy đúng (`onPause` dừng, `onStart` bật lại). Nhưng mở bảng chia sẻ rồi đóng lại chỉ gây `onPause` rồi `onResume`, không có `onStart` (A7), nên quét đã dừng mà không ai bật lại.
    Sửa: `onStart` ↔ `onStop`, hoặc `onResume` ↔ `onPause` (xem [A8](#a8-mo-o-au-ong-o-au-vi-du-ap-vao-app)).

### A11. Đọc nhanh: callback nào, nhớ gì

Bảng tóm tắt để ghim lại, gom từ A4 tới A10.

| Callback | Được gọi khi | Thường làm gì | Nhớ |
|---|---|---|---|
| `onCreate` | instance mới | dựng UI, đọc `savedInstanceState` | Chạy lại sau xoay máy, dark mode, cỡ chữ, kill nền |
| `onStart` | bắt đầu nhìn thấy | bắt đầu thứ chỉ cần khi nhìn thấy | Cặp với `onStop` |
| `onResume` | tương tác được | bật thứ chỉ cần khi đang dùng (RSSI, camera) | Cặp với `onPause` |
| `onPause` | mất quyền tương tác | tắt thứ đã bật ở `onResume`, lưu nhanh | Phải nhanh: màn hình kế tiếp chờ nó |
| `onStop` | không còn nhìn thấy | tắt thứ đã bật ở `onStart`, lưu dữ liệu | Callback cuối **chắc chắn** chạy trước khi app có thể bị kill |
| `onDestroy` | instance bị huỷ | dọn dẹp cuối | **Có thể không chạy**; đọc `isChangingConfigurations` để biết vì sao chết |


### A12. Phòng thí nghiệm: bấm để thấy Android chạy

Bốn mô phỏng bấm được, mỗi cái ứng với một nhóm mục trong checklist bên dưới. Chúng là **mô hình** dựng theo đúng log đo thật ở [mục 4](#4-thuc-te-xay-ra-gi), [A7](#a7-o-that-tren-emulator-them-cac-tinh-huong-ngoai-bai) và [A10](#a10-oan-log-truoc-xem-ap-an-sau), không phải Android thật. Chạy app của bài trên emulator vẫn là cách kiểm chứng cuối cùng.

#### 1. Vòng đời: bấm thao tác, xem callback chạy

Bấm icon app, bấm **+1 tap** vài lần, rồi thử lần lượt Home, xoay máy, dark mode, giết app ở nền, Back. Nhìn ba chỗ cùng lúc:

- **Điện thoại**: instance số mấy, và ba bộ đếm. *field* là biến trong Activity, *Bundle* là thứ cất ở `onSaveInstanceState`, *ViewModel* là thứ sống ngoài Activity (bài 08).
- **Ba vùng lồng nhau**: tồn tại ⊃ nhìn thấy ⊃ tương tác, giống búp bê Nga ở [A6](#a6-vong-oi-la-chuyen-mot-quan-ca-phe). Callback đang chạy sáng lên ở hàng chip bên dưới.
- **Logcat**: đúng các dòng app của bài sẽ in.

<div class="lab" id="l03-life-lab"></div>

!!! tip "Thử ba thí nghiệm này"
    1. **Home rồi mở lại** và **Xoay máy**: cùng là "rời màn hình rồi quay lại", nhưng chỉ xoay máy làm số instance tăng và *field taps* về 0.
    2. Bấm Home, rồi **Hệ thống giết app ở nền**, rồi bấm icon: không có `onDestroy`, `onCreate` ghi `restored=true`, *Bundle* còn nhưng *ViewModel* mất.
    3. **Back**: mọi bộ đếm về 0. Đó là kết thúc thật, khác hẳn Home.

#### 2. Game ghép log

Đọc tình huống, bấm các callback theo đúng thứ tự Logcat sẽ in, rồi bấm **Kiểm tra**. Không bấm gì nghĩa là "không có dòng log nào". Bản này chỉ tính 6 callback mà app của bài ghi log (không có `onRestart`).

<div class="lab" id="l03-log-game"></div>

#### 3. Intent này mở Activity nào?

Mỗi lượt là một Intent. Bấm vào Activity mà hệ điều hành sẽ mở, hoặc ô cuối nếu không ai mở được. Các ô hiện đúng thứ manifest của mỗi app khai báo: intent filter và `exported`. Đáp án giải thích vì sao khớp hay không khớp ([A3](#a3-explicit-va-implicit-intent)).

<div class="lab" id="l03-intent-game"></div>

#### 4. Thước SDK: kéo máy người dùng qua các đời Android

Đổi ba con số của `build.gradle.kts` và kéo thanh "Máy người dùng". Vạch đỏ là đời Android không cài được app. Bỏ tick ô `SDK_INT` để xem chuyện gì xảy ra khi gọi một API mới trên máy cũ ([A2](#a2-ba-con-so-sdk-nhin-thay-cai-uoc-chay-theo)).

<div class="lab" id="l03-sdk-lab"></div>

API "có từ API 37" trong mô phỏng này là giả định, chỉ để minh hoạ quy tắc; tên lỗi `INSTALL_FAILED_OLDER_SDK` và `NoSuchMethodError` là lỗi Android thật cho hai trường hợp đó.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 04.

- [ ] Nói được mỗi file trong project Android làm gì, và so được với một monorepo npm (xem [A1](#a1-cac-file-gradle-nhin-bang-mat-dev-npm)).
- [ ] Biết vì sao **không** thêm plugin `org.jetbrains.kotlin.android` khi dùng AGP 9.
- [ ] Phân biệt `compileSdk`, `minSdk`, `targetSdk` (xem [A2](#a2-ba-con-so-sdk-nhin-thay-cai-uoc-chay-theo), thử [thước SDK](#4-thuoc-sdk-keo-may-nguoi-dung-qua-cac-oi-android)).
- [ ] Giải thích Activity, Context, Intent, Manifest bằng lời của mình; phân biệt explicit và implicit intent (xem [A3](#a3-explicit-va-implicit-intent), chơi [Intent này mở Activity nào?](#3-intent-nay-mo-activity-nao)).
- [ ] Biết intent filter `MAIN` + `LAUNCHER` và `android:exported="true"` để làm gì.
- [ ] Kể đúng thứ tự sáu callback vòng đời và khoảng "tồn tại / nhìn thấy / tương tác được" của chúng (xem [A4](#a4-vong-oi-activity-so-voi-mot-tab-trinh-duyet), [A6](#a6-vong-oi-la-chuyen-mot-quan-ca-phe)).
- [ ] Đoán đúng Logcat cho: mở app, Home, mở lại, xoay máy, mở trang web, Back (luyện thêm ở [A10](#a10-oan-log-truoc-xem-ap-an-sau) và [game ghép log](#2-game-ghep-log)).
- [ ] Biết `onDestroy` có thể không chạy, và chọn đúng cặp callback để mở / đóng một việc (xem [A7](#a7-o-that-tren-emulator-them-cac-tinh-huong-ngoai-bai), [A8](#a8-mo-o-au-ong-o-au-vi-du-ap-vao-app)).
- [ ] Đọc được `restored=` và `changingConfigurations=` trong log để biết Activity đang được tạo lại hay kết thúc thật.
- [ ] Giải thích vì sao kết nối BLE hay state màn hình không được giữ trong Activity (xem [A5](#a5-vi-sao-xoay-may-lam-mat-field), thử ba bộ đếm trong [phòng thí nghiệm vòng đời](#1-vong-oi-bam-thao-tac-xem-callback-chay)).
- [ ] Chỉ ra chỗ khác nhau giữa track Compose và track XML (chỉ phần đưa UI lên màn hình).
- [ ] Đọc hiểu một đoạn Java cơ bản nhờ Java reading cheatsheet.
- [ ] Làm xong 2 bài tự làm ở trên mà không cần agent.
