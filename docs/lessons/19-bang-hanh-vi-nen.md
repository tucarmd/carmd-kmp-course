---
source: lessons/19-background-behaviour-table.html
source_ref: live
source_sha: d233c25
---

<p class="kicker">Bài 19 · Tuần 4 · Ngày 19 · Khoá Native Device Monitor · <a href="https://phongna-inn.github.io/carmd-kmp-course/lessons/19-background-behaviour-table.html">Bản gốc tiếng Anh</a></p>

# Giám sát nền: bảng hành vi theo nền tảng

<div class="meta">
  <span class="tag">~1,5 giờ · +0,25 giờ cho mỗi track UI thêm</span>
  <span class="tag">Milestone: m14 bảng hành vi viết từ các lần chạy quan sát được</span>
  <span class="tag">Cần trước: <a href="../18-giam-sat-nen/">18</a></span>
</div>

!!! abstract "Vì sao bài này quan trọng"
    Bài 18 dựng một monitor xin mỗi nền tảng một lần đọc mỗi 15 phút. Nó nhận được gì phụ thuộc vào nền tảng và vào việc người dùng làm: để app mở, chuyển sang app khác, quay lại, để điện thoại yên cho tới khi hệ thống thu hồi bộ nhớ của app, hay tự tay kill app. Một team hứa "mỗi 15 phút một lần đọc" mà không biết điều này sẽ phát hành kèm một báo cáo bug mỗi lần. Hôm nay bạn chạy monitor trong năm tình huống đó trên cả hai nền tảng, ghi lại chuyện đã xảy ra, và đặt nó ở chỗ team sẽ tìm thấy: `docs/monitor-behaviour.md`, **bảng hành vi** của monitor. Không đổi code nào: monitor m13 đã dùng cơ chế được hỗ trợ của mỗi nền tảng, và việc bây giờ là biết, và nói ra, cơ chế đó hứa gì. Đó là milestone **m14**. Những hàng chỉ một chiếc điện thoại cho thấy được vẫn được đánh dấu như vậy cho tới khi bạn chạy chúng trên máy của mình.

!!! info "Nguồn chính"
    Các trang [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) và [Power management restrictions](https://developer.android.com/topic/performance/power/power-details) của Android trước mục 2. Trang [Choosing background strategies for your app](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app) của Apple trước mục 4. Các nguồn của bài 18 ([Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work) của WorkManager, [Using background tasks](https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app) của Apple và `BGTaskRequest.h`) vẫn áp dụng.

!!! info "Track"
    Monitor là code dùng chung, giống nhau trên mọi track: các adapter scheduler là Kotlin trong `androidMain` và `iosMain`, và các track iOS chỉ khác ở chỗ phần khởi động app gọi `onAppLaunch()`. Nên bảng hành vi đúng cho mọi track. Chúng tôi chạy mọi hàng bằng app Compose và SwiftUI; trên track thứ hai, lặp lại các lần chạy nhanh với app của track đó (thêm 0,25 giờ). Hôm nay không đổi màn hình nào và không đổi code nào. Các đoạn trích hiện code của m13, để giải thích những gì bạn sẽ thấy; file mới duy nhất nằm ở mục [File đầy đủ](#file-ay-u) cuối trang.

## Thay đổi so với m13

| Cái gì | m13 | m14 |
|---|---|---|
| code dùng chung, adapter, màn hình | không đổi |
| test | không đổi: 95 mỗi nền tảng |
| `docs/monitor-behaviour.md` | — | mới: bảng hành vi, theo nền tảng và tình huống, kèm cách biết mỗi hàng (thấy trên emulator hay Simulator, hay đang chờ một chiếc điện thoại) |

## 1. Năm tình huống, và cách tạo ra mỗi cái

Appendix A.7 của kế hoạch khoá học gọi tên năm tình huống: ở foreground, ở nền, khi quay lại foreground, sau khi hệ điều hành kết thúc app, và sau khi người dùng force-kill nó. Mỗi cái có một lệnh tạo ra nó trên emulator hay simulator, hoặc thứ gần nó nhất:

| Tình huống | Android emulator | iOS Simulator |
|---|---|---|
| **Foreground**: app trên màn hình | `am start` rồi để yên; `adb shell svc power stayon true` giữ màn hình sáng | `xcrun simctl launch` rồi để yên |
| **Nền**: người dùng đã chuyển đi; process vẫn còn | `adb shell input keyevent KEYCODE_HOME` | mở một app khác: `xcrun simctl launch booted com.apple.Preferences` |
| **Quay lại** foreground | `am start` lần nữa | `xcrun simctl launch` app lần nữa |
| **Hệ điều hành kết thúc app** để thu hồi bộ nhớ | Home, rồi `adb shell am kill`: "chỉ kill các process an toàn để kill và không ảnh hưởng trải nghiệm người dùng" | vào nền, rồi `xcrun simctl terminate`: process kết thúc; Simulator không chạy background task nào, nên không gì mở lại nó |
| **Force-kill** bởi người dùng | `adb shell am force-stop`: "Force-stop mọi thứ gắn với package" (Settings → Apps → Force stop trên điện thoại) | app switcher của điện thoại (vuốt app lên); chỉ điện thoại cho thấy chuyện gì xảy ra sau đó |

Hai mô tả `am` lấy từ bảng activity manager của trang [Android Debug Bridge](https://developer.android.com/tools/adb). `am kill` là thứ gần nhất emulator có với lần kill của chính hệ thống, nhưng không giống hệt: mục 2 cho thấy khác biệt mà Android ghi lại. Phần help của `terminate` trên Simulator chỉ nói "Terminate an application by identifier on a device", và không nói nó giống force quit hay giống lần kill của hệ thống. Trên Simulator điều đó không quan trọng: đằng nào thì không gì của app chạy cho tới khi có người mở nó.

**Cách quan sát.** File log là bản ghi những gì đã xảy ra: mỗi nhịp một dòng, kèm giờ. Quanh nó, mỗi nền tảng cho bạn biết process nào đã làm gì:

- **Android:** `adb shell run-as com.example.devicemonitor cat files/status-log.jsonl` (các bản ghi), `adb logcat -v time -s DeviceMonitor:I ActivityManager:I WM-ForceStopRunnable:D` ("Monitor tick" kèm process id, process khởi động và bị kill, phản ứng của WorkManager), `adb shell pidof com.example.devicemonitor`, và `adb shell dumpsys jobscheduler | grep 'JobStatus{.*devicemonitor'` (`TIME=` của lần chạy tiếp theo).
- **iOS:** console của `xcrun simctl launch --console-pty` (các dòng `println` của adapter) và `Library/Application Support/status-log.jsonl` trong data container của app (`xcrun simctl get_app_container booted com.example.devicemonitor data`).

## 2. Android: những gì chúng tôi thấy

Chúng tôi chạy app Compose của m13 trên emulator API 36, lần lượt từng tình huống trên một lần cài mới, và đọc log, logcat và `dumpsys` ở mỗi bước. Giờ là đồng hồ của emulator, như logcat và các bản ghi hiện ra:

| Tình huống | Chúng tôi đã làm gì | Chúng tôi thấy gì |
|---|---|---|
| foreground | cài mới, mở app, để app trên màn hình | bản ghi 1 lúc 23:18:31, 6 s sau khi process khởi động; bản ghi 2 lúc 23:33:33 (15 phút 2 s sau), từ cùng process (pid 11085), khi app vẫn trên màn hình |
| nền | Home | bản ghi 3 lúc 23:50:33 (16 phút 59 s sau), từ cùng process |
| quay lại | `am start` | không có bản ghi mới; một phút sau `TIME=+13m48s`: lần chạy tiếp theo giữ nguyên giờ của nó |
| hệ điều hành kết thúc app | Home, `am kill` lúc 23:51:48 | `pidof` rỗng. Lúc 00:06:29 Android khởi động một process mới (11710) "for service {…/androidx.work.impl.background.systemjob.SystemJobService}", và bản ghi 4 tới lúc 00:06:32 (15 phút 59 s sau bản ghi 3) |
| force-kill | `am force-stop` lúc 00:06:37 | job của chúng tôi biến mất khỏi `dumpsys jobscheduler` ngay lập tức; không process và không bản ghi nào trong 30 phút tiếp theo, dù lần chạy tiếp theo lẽ ra tới hạn khoảng 00:21 |
| mở lại | `am start` lúc 00:36:42 | một process mới (11902) và `WM-ForceStopRunnable` "Application was force-stopped, rescheduling."; bản ghi 5 lúc 00:36:47, khi app mở (ở hai lần chạy sau, với app được mở lại khoảng 16 và 20 phút sau bản ghi trước, app ghi hai bản ghi cách nhau 1 tới 2 s, và logcat hiện `WM-Processor` "WorkerWrapper interrupted" sau `Monitor tick` đầu tiên, rồi việc bắt đầu lại: hãy chờ một hoặc hai bản ghi); job của chúng tôi quay lại trong `dumpsys jobscheduler`, với một id mới; bản ghi 6 lúc 00:53:53, 17 phút 6 s sau, khi app ở nền |
| vuốt bỏ trong Recents | app trên màn hình, rồi Recents, vuốt thẻ của nó lên (00:54:54) | process kết thúc; exit-info: `reason=10 (USER REQUESTED) subreason=22 (REMOVE TASK)`; `dumpsys package`: `stopped=false`, và job của chúng tôi vẫn đếm lùi. Lúc 01:09:21 có một process mới cho job, bản ghi 7 lúc 01:09:23 (15 phút 31 s sau bản ghi 6), lại kèm "Application was force-stopped, rescheduling." |

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt" hl_lines="6"
    override fun schedule(interval: Duration, tick: suspend () -> Unit) {
        currentTick = tick
⋯ the period, never under 15 minutes, and the periodic request
        // One schedule however many launches call this: UPDATE keeps the work that is already
        // scheduled, with its timing, and only changes its period.
        workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }
```

1. **Foreground và nền là một hàng trên Android.** WorkManager không nhìn màn hình: bản ghi 2 và 3 tới từ cùng một process, một khi app trên màn hình và một khi nằm sau launcher. Các khoảng cách, 15 phút 2 s và 16 phút 59 s, là ý nghĩa của "tối thiểu": "Khoảng thời gian được định nghĩa là thời gian tối thiểu giữa các lần lặp" ([Define work requests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)).
2. **Quay lại không ghi gì.** Process vẫn đang chạy, nên `Application.onCreate` không chạy lại, và `onAppLaunch()` cũng không: chúng chạy một lần mỗi process, và `am start` chỉ đưa Activity trở lại. Không gì chạm vào việc định kỳ, và việc đếm lùi tiếp tục từ chỗ cũ. Một process mới thì có gọi lại `schedule`, và đó là lúc `UPDATE` giữ việc và thời điểm của nó (bài 18, mục 4).
3. **Một process bị kill được khởi động lại cho việc định kỳ.** Lịch sống trong cơ sở dữ liệu của WorkManager và trong JobScheduler, không trong process. Khi tới giờ, Android khởi động một process mới cho `JobService` của WorkManager; `Application.onCreate` trao nhịp, và worker chạy nó 2,6 s sau khi process khởi động, đọc thấy Wi-Fi đã kết nối.

```kotlin title="shared/src/androidMain/kotlin/com/example/devicemonitor/adapter/outbound/AndroidMonitorScheduler.kt" hl_lines="3 4"
⋯ class MonitorWorker(…) : CoroutineWorker(…) {
    override suspend fun doWork(): Result {
        val tick = AndroidMonitorScheduler.currentTick
        Log.i("DeviceMonitor", if (tick == null) "Monitor work ran, but the monitor is stopped" else "Monitor tick")
        tick?.invoke()
        return Result.success()
    }
```

1. **Logcat gọi tên process.** Mỗi dòng "Monitor tick" mang process id của nó, nên `I/DeviceMonitor(11085)` và `I/DeviceMonitor(11710)` cho bạn biết process nào chạy nhịp nào, và "Start proc … for service" của `ActivityManager` cho bạn biết vì sao process thứ hai tồn tại.
2. **`am kill` không phải low-memory killer.** `adb shell dumpsys activity exit-info com.example.devicemonitor` ghi lần kill của chúng tôi là `reason=10 (USER REQUESTED) subreason=24 (KILL BACKGROUND)`. Lần kill của chính hệ thống khi thiếu bộ nhớ là `REASON_LOW_MEMORY`: "Process của app bị low memory killer của hệ thống kill" ([ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo)). Đó là lý do, trong process mới, WorkManager ghi `WM-ForceStopRunnable` "Application was force-stopped, rescheduling.": từ Android 11 (API 30), `ForceStopRunnable` của WorkManager đọc các lý do thoát của app, coi mọi lần thoát "user requested" kể từ lần cuối nó xử lý là một force stop, và lên lịch lại việc của nó: ở đây vô hại, vì việc vẫn còn và giữ thời điểm của nó. Một lần kill thiếu bộ nhớ thật là một kiểm tra trên thiết bị.
3. **Force stop khác hẳn về bản chất.** Force stop đưa app vào trạng thái stopped: Android gỡ job JobScheduler của chúng tôi ngay tại chỗ, và không gì chạy trong 30 phút. Trạng thái đó nhằm "giữ app ở trạng thái này cho tới khi người dùng chủ động đưa app ra khỏi nó bằng cách trực tiếp mở app hoặc gián tiếp tương tác với app" ([Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all)), và reference của Android nói cái gì bị mất: `ApplicationStartInfo.wasForceStopped()` giúp app "biết có nên đăng ký lại các alarm, job và callback khác đã bị xoá khi app bị force-stop không" ([ApplicationStartInfo](https://developer.android.com/reference/android/app/ApplicationStartInfo)). WorkManager tự làm việc đó: khi người dùng mở app, nó tìm thấy lần thoát "user requested" (lần này subreason là `FORCE STOP`), đặt việc trở lại, và chạy ngay lần chạy đã trễ hạn. Chỉ người dùng mở app mới khởi động lại monitor.
4. **Recents không phải Force stop.** Vuốt bỏ app trong Recents kết thúc process, và reference của Android liệt kê nó cùng Force stop dưới cùng một lý do: "người dùng bấm nút "Force stop" của app trong Settings, hoặc gỡ app khỏi Recents" (`REASON_USER_REQUESTED`, [ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo)). Nhưng trên emulator app không bị stopped: job vẫn còn và lần chạy tiếp theo tới như sau `am kill`. Người dùng vuốt bỏ app nhiều hơn force-stop rất nhiều, và Android của một hãng điện thoại có thể xử lý khác: đó là một hàng phải kiểm tra trên điện thoại của bạn.

**Thứ chỉ điện thoại cho thấy được: Doze và App Standby.** Emulator đang cắm sạc và thức. Một điện thoại dùng pin, đã khoá và để yên, sẽ vào Doze, thứ "trì hoãn job, sync và các alarm thường" và "Không cho JobScheduler chạy. WorkManager dùng JobScheduler bên trong, nên các tác vụ WorkManager không chạy"; việc chờ một maintenance window, và "Theo thời gian, hệ thống lên lịch maintenance window thưa dần" ([Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)). Các App Standby bucket cũng giới hạn số lần job của một app chạy khi dùng pin, xếp theo "app được dùng gần đây và thường xuyên tới mức nào" ([App Standby Buckets](https://developer.android.com/topic/performance/appstandby)): từ "Tối đa 20 phút trong mỗi khoảng 60 phút trượt" thời gian job cho một app active tới "Mỗi ngày một lần, tối đa 10 phút" cho một app bị hạn chế, và "WorkManager dùng JobScheduler để lên lịch tác vụ khi app không hiển thị, nên các worker chịu giới hạn tài nguyên job" ([Power management restrictions](https://developer.android.com/topic/performance/power/power-details)). Vậy trên điện thoại, hãy chờ 15 phút giãn ra, điện thoại để yên càng lâu càng giãn.

## 3. iOS: những gì chúng tôi thấy trên Simulator

Cùng chuỗi đó với app SwiftUI của m13 trên Simulator iOS 26.2, console được bắt bằng `--console-pty`:

| Tình huống | Chúng tôi đã làm gì | Chúng tôi thấy gì |
|---|---|---|
| foreground | cài mới, mở app lúc 23:19:07, để app trên màn hình | không có bản ghi lúc mở; "Monitor tick (foreground)" và bản ghi 1 lúc 23:34:08, 15 phút sau khi mở |
| nền | mở app Settings lúc 23:35:19 | ngay lập tức: "Monitor: no background refresh: The operation couldn’t be completed. (BGTaskSchedulerErrorDomain error 1.)"; rồi không gì trong 5 phút |
| quay lại | mở lại app lúc 23:40:30 | không có bản ghi lúc quay lại, cũng không có 10 phút sau; bản ghi 2 lúc 23:55:31, 15 phút sau khi quay lại (21 phút 23 s sau bản ghi 1) |
| hệ điều hành kết thúc app | Settings lúc 23:56:32, rồi `simctl terminate` 10 s sau | process mất; không gì trong 5 phút |
| mở lại | mở lúc 00:01:47 (một process mới) | không có bản ghi lúc mở, cũng không có 10 phút sau; bản ghi 3 lúc 00:16:48, 15 phút sau khi mở. Cả ba bản ghi đều có trong file |

```kotlin title="shared/src/iosMain/kotlin/com/example/devicemonitor/adapter/outbound/IosMonitorScheduler.kt" hl_lines="2 4 10 13"
⋯ in init: app-level notifications
        center.addObserverForName(UIApplicationDidBecomeActiveNotification, null, NSOperationQueue.mainQueue) { _ ->
            scheduler.cancelTaskRequestWithIdentifier(TASK_ID) // the timer takes over
            startTimer()
        }
⋯ didEnterBackground: cancel the timer, submit() a refresh request

    private fun startTimer() {
        val tick = tick ?: return
        timer?.cancel()
        timer = scope.launch {
            while (true) {
                delay(interval)
                println("Monitor tick (foreground)")
                tick()
            }
        }
    }
```

1. **Mỗi lần active đều khởi động lại bộ hẹn giờ.** Trở nên active thì huỷ bộ hẹn giờ cũ và chờ cả một chu kỳ trước nhịp đầu tiên. Đó là lý do bản ghi thứ hai tới 15 phút sau khi quay lại, không phải 15 phút sau bản ghi đầu. Hệ quả này phải có trong bảng: **một người dùng mở app mỗi lần dưới 15 phút sẽ không có bản ghi foreground nào.** Đổi điều đó (chẳng hạn, một nhịp khi quay lại nếu bản ghi cuối cũ hơn một chu kỳ) sẽ là một quy tắc của app, nên nó nằm trong `MonitoringService` kèm một test, không nằm trong adapter; m14 ghi lại hành vi và không đổi gì.
2. **Ở nền, Simulator không chạy gì.** Adapter giao cho `BGTaskScheduler`, và Simulator từ chối request với lỗi 1, `Unavailable`, được ghi cho trường hợp "App đang chạy trên Simulator, thứ không hỗ trợ xử lý nền" (`BGTaskScheduler.h`). Các lệnh debugger của Apple để chạy một task theo yêu cầu không giúp được gì ở đây: "Các hàm debug chỉ chạy trên thiết bị" ([Starting and terminating tasks during development](https://developer.apple.com/documentation/backgroundtasks/starting-and-terminating-tasks-during-development)). Nên iOS làm gì cho app ở nền luôn là một hàng của điện thoại.
3. **Log sống lâu hơn process; bộ hẹn giờ thì không.** Sau `terminate`, hai bản ghi vẫn trong file, và process mới bắt đầu không có bộ hẹn giờ và không có nhịp nào cho tới cả một chu kỳ sau khi nó thành active.

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 300" role="img" aria-labelledby="l19-runs-title">
      <title id="l19-runs-title">Các lần chạy của mục 2 và 3 trên một trục thời gian, 0 tới 80 phút. Android, từ bản ghi đầu: app trên màn hình tới phút 15, có bản ghi ở 0 và 15; ở nền tới 32, có bản ghi ở 32 từ cùng process; trên màn hình lại một phút, không bản ghi; rồi bị kill bằng am kill, và ở phút 48 có bản ghi từ một process mới Android khởi động cho việc định kỳ; rồi bị force-stop, và không gì trong 30 phút; mở lại ở 78, có bản ghi ngay. iOS, từ lúc mở: trên màn hình tới phút 16, bản ghi đầu ở 15; ở nền 5 phút, lỗi 1 và không bản ghi; trên màn hình lại từ 21, bản ghi tiếp theo ở 36, 15 phút sau khi quay lại; rồi ở nền và bị terminate, không gì; mở lại ở 43, bản ghi tiếp theo ở 58, 15 phút sau khi mở.</title>
      <g data-part="android">
        <text class="title" x="20" y="64">Android</text>
        <rect class="box" x="130" y="46" width="115" height="28" rx="4"></rect>
        <text class="small" x="138" y="65">trên màn hình</text>
        <rect class="box" x="371" y="46" width="9" height="28" rx="2"></rect>
        <rect class="box" x="716" y="46" width="14" height="28" rx="2"></rect>
      </g>
      <path class="edge dashed" d="M246,60 L370,60"></path>
      <text class="small muted" x="262" y="40">nền</text>
      <text class="small muted" x="384" y="65">am kill: process mất</text>
      <text class="small muted" x="510" y="65">force-stop: không gì chạy</text>
      <text class="small muted" x="350" y="40">quay lại</text>
      <text class="small muted" x="676" y="40">mở</text>
      <circle class="dot" cx="130" cy="92" r="5"></circle>
      <circle class="dot" cx="242" cy="92" r="5"></circle>
      <circle class="dot" cx="370" cy="92" r="5"></circle>
      <circle class="dot" cx="490" cy="92" r="5"></circle>
      <circle class="dot" cx="717" cy="92" r="5"></circle>
      <text class="small muted" x="440" y="112">process mới</text>
      <g data-part="ios">
        <text class="title" x="20" y="164">iOS</text>
        <rect class="box" x="130" y="146" width="121" height="28" rx="4"></rect>
        <text class="small" x="138" y="165">trên màn hình</text>
        <rect class="box" x="290" y="146" width="120" height="28" rx="4"></rect>
        <text class="small" x="298" y="165">trên màn hình</text>
        <rect class="box" x="450" y="146" width="280" height="28" rx="4"></rect>
        <text class="small" x="458" y="165">trên màn hình (process mới)</text>
      </g>
      <path class="edge dashed" d="M252,160 L289,160"></path>
      <text class="small muted" x="246" y="140">lỗi 1</text>
      <text class="small muted" x="412" y="140">kết thúc</text>
      <circle class="dot" cx="242" cy="192" r="5"></circle>
      <circle class="dot" cx="403" cy="192" r="5"></circle>
      <circle class="dot" cx="563" cy="192" r="5"></circle>
      <line class="axis" x1="130" y1="232" x2="730" y2="232"></line>
      <text class="small muted" x="126" y="250">0</text>
      <text class="small muted" x="236" y="250">15</text>
      <text class="small muted" x="349" y="250">30</text>
      <text class="small muted" x="461" y="250">45</text>
      <text class="small muted" x="574" y="250">60</text>
      <text class="small muted" x="686" y="250">75 phút</text>
      <text class="small muted" x="20" y="284">Chấm: bản ghi. Hộp: app trên màn hình. Đứt: ở nền, process còn sống.</text>
    </svg>
    <figcaption>Bản ghi của Android theo lịch của việc định kỳ, dù người dùng làm gì, cho tới một lần force stop. Bản ghi của iOS theo việc app có trên màn hình không, và mỗi lần quay lại bắt đầu lại 15 phút.
<ul class="legend">
    <li data-part="android">Android (emulator)</li>
    <li data-part="ios">iOS (Simulator)</li>
  </ul>
</figcaption>
  </figure>

**Thứ chỉ điện thoại cho thấy được.** Trên iPhone, request nền thành công (trừ khi Background App Refresh bị tắt), và iOS có thể mở hoặc đánh thức app cho nó. Khi hệ thống kết thúc một app đang tạm dừng để thu hồi bộ nhớ ("hệ thống kết thúc các app nền khi cần để có tài nguyên đó", [Preparing your UI to run in the background](https://developer.apple.com/documentation/uikit/preparing-your-ui-to-run-in-the-background)), một request đang chờ vẫn có thể đưa nó trở lại: "Nếu app không chạy khi một sự kiện tới, hệ thống mở app và chuyển nó thẳng vào nền" ([About the background execution sequence](https://developer.apple.com/documentation/uikit/about-the-background-execution-sequence)). Force quit thì khác. Không trang hay header BackgroundTasks nào nhắc tới nó, nhưng tài liệu của Apple nói vậy về các cách khác iOS mở app ở nền: "hệ thống không tự mở app nếu người dùng đã force-quit nó. Trong trường hợp đó, người dùng phải mở lại app hoặc khởi động lại thiết bị thì hệ thống mới thử tự mở app lần nữa" ([application(_:didReceiveRemoteNotification:fetchCompletionHandler:)](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/application(_:didreceiveremotenotification:fetchcompletionhandler:))), và "hệ thống không tự mở lại các app bị người dùng force quit" ([background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:))). Developer Technical Support của Apple nói tương tự về việc mở app ở nền nói chung, kèm một lưu ý: "iOS còn đặt một cờ ngăn app được mở ở nền. Cờ đó được xoá khi người dùng tự mở app lần tới", và "Trong một số trường hợp iOS sẽ không tôn trọng cờ này" ([iOS Background Execution Limits](https://developer.apple.com/forums/thread/685525), Apple Developer Forums). Bảng ghi "dự kiến: không có bản ghi cho tới khi người dùng mở app" và đánh dấu nó cho điện thoại.

## 4. Vì sao iOS không cho một chu kỳ cố định

15 phút của Android là một mức sàn, và việc cuối cùng vẫn chạy: WorkManager "dành cho việc cần chạy đáng tin cậy" (bài 18), và Doze chỉ trì hoãn nó. 15 phút của iOS là một mức sàn mà phía sau không có lời hứa nào cả:

<figure class="diagram">
    <svg class="dg" viewbox="0 0 760 370" role="img" aria-labelledby="l19-why-title">
      <title id="l19-why-title">Mỗi nền tảng quyết định khi nào nhịp nền của monitor chạy. Trên Android, periodic work request của app, ít nhất 15 phút, đi tới WorkManager, thứ giao nó cho JobScheduler; Doze và standby bucket của app có thể trì hoãn nó, nhưng nó chạy, ít nhất 15 phút sau lần chạy trước. Trên iOS, refresh request của app chỉ nói "không trước 15 phút kể từ bây giờ". Rồi hệ thống quyết định từ những điều kiện app không kiểm soát: người dùng đã dùng app ra sao, mức pin và Low Power Mode, mạng, cài đặt Background App Refresh, và người dùng có force-quit app không. Kết quả là một lần mở vào lúc iOS chọn, có thể nhiều giờ sau, hoặc không có; và mỗi request là một lần mở, nên handler phải gửi request tiếp theo.</title>
      <defs><marker id="l19-why-arrow" viewbox="0 0 10 10" refx="9" refy="5" markerwidth="7" markerheight="7" orient="auto-start-reverse"><path class="arrowhead" d="M0,0 L10,5 L0,10 z"></path></marker></defs>
      <g data-part="android">
        <text class="title" x="20" y="34">Android</text>
        <rect class="box" x="20" y="48" width="170" height="56" rx="6"></rect>
        <text class="small" x="30" y="72">periodic work request</text>
        <text class="small muted" x="30" y="92">ít nhất 15 phút</text>
        <rect class="box" x="250" y="48" width="230" height="56" rx="6"></rect>
        <text class="small" x="260" y="72">WorkManager → JobScheduler</text>
        <text class="small muted" x="260" y="92">Doze, standby bucket: muộn hơn</text>
        <rect class="box" x="540" y="48" width="200" height="56" rx="6"></rect>
        <text class="small" x="550" y="72">chạy, 15 phút trở lên</text>
        <text class="small muted" x="550" y="92">sau lần chạy trước</text>
      </g>
      <path class="edge" d="M190,76 L248,76" marker-end="url(#l19-why-arrow)"></path>
      <path class="edge" d="M480,76 L538,76" marker-end="url(#l19-why-arrow)"></path>
      <g data-part="ios">
        <text class="title" x="20" y="150">iOS</text>
        <rect class="box" x="20" y="164" width="170" height="56" rx="6"></rect>
        <text class="small" x="30" y="188">refresh request</text>
        <text class="small muted" x="30" y="208">"không trước" 15 phút</text>
        <rect class="box" x="250" y="164" width="230" height="130" rx="6"></rect>
        <text class="small" x="260" y="188">hệ thống quyết định, dựa trên:</text>
        <text class="small muted" x="260" y="210">người dùng dùng app ra sao</text>
        <text class="small muted" x="260" y="230">pin, Low Power Mode</text>
        <text class="small muted" x="260" y="250">mạng</text>
        <text class="small muted" x="260" y="270">cài đặt Background App Refresh</text>
        <text class="small muted" x="260" y="290">một lần force quit</text>
        <rect class="box" x="540" y="164" width="200" height="56" rx="6"></rect>
        <text class="small" x="550" y="188">một lần mở, khi iOS</text>
        <text class="small muted" x="550" y="208">chọn: có thể nhiều giờ; hoặc không có</text>
      </g>
      <path class="edge" d="M190,192 L248,192" marker-end="url(#l19-why-arrow)"></path>
      <path class="edge" d="M480,192 L538,192" marker-end="url(#l19-why-arrow)"></path>
      <path class="edge dashed" d="M640,222 C640,360 105,360 105,224" marker-end="url(#l19-why-arrow)"></path>
      <text class="small muted" x="290" y="352">handler gửi request tiếp theo</text>
    </svg>
    <figcaption>Cả hai nền tảng đặt một mức sàn. Android cuối cùng vẫn chạy việc; iOS quyết định có chạy hay không.
<ul class="legend">
    <li data-part="android">Android</li>
    <li data-part="ios">iOS</li>
  </ul>
</figcaption>
  </figure>

1. **"Không sớm hơn", không bao giờ là "đúng lúc".** `earliestBeginDate`: "hệ thống không đảm bảo mở task vào đúng ngày giờ chỉ định, mà chỉ đảm bảo nó sẽ không bắt đầu sớm hơn", và một refresh request được đáp ứng "một cách thông minh dựa trên điều kiện hệ thống và cách dùng app" (`BGTaskRequest.h`). Hướng dẫn chiến lược của Apple: "Hệ thống quyết định thời điểm tốt nhất để mở background task, và cho app tối đa 30 giây chạy nền" ([Choosing background strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app)).
2. **Nó quyết định dựa vào gì.** Phiên WWDC19 của Apple về chạy nền: "App được mở thường xuyên thế nào và vào những lúc nào phụ thuộc vào cách người dùng đã dùng app trong quá khứ", và hệ thống "theo dõi nhiều điều kiện hệ thống gồm mức pin, cách dùng app, kết nối mạng, và hơn nữa" ([Advances in App Background Execution](https://developer.apple.com/videos/play/wwdc2019/707/)). Người dùng có thể tắt nó: `backgroundRefreshStatus` cho biết "Background App Refresh, khả năng một app mở ở nền để làm refresh task, có được bật không", và "Background App Refresh tự động bị tắt khi thiết bị chạy ở chế độ năng lượng thấp" ([backgroundRefreshStatus](https://developer.apple.com/documentation/uikit/uiapplication/backgroundrefreshstatus)).
3. **Có thể là nhiều giờ.** Apple cảnh báo lập trình viên khi test: "Độ trễ giữa lúc bạn lên lịch một background task và lúc hệ thống mở app để chạy task có thể là nhiều giờ" ([Starting and terminating tasks during development](https://developer.apple.com/documentation/backgroundtasks/starting-and-terminating-tasks-during-development)).
4. **Một request, một lần mở.** "Có thể có tổng cộng 1 refresh task và 10 processing task được lên lịch bất cứ lúc nào" ([submit(_:)](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler/submit(_:))), nên chuỗi chỉ sống chừng nào mỗi lần mở còn gửi lần tiếp theo, đó là lý do handler của bài 18 gọi `submit()` trước.

Lý do nó được làm như vậy giống lý do mức sàn của Android: pin và dữ liệu của điện thoại thuộc về người dùng, và hệ thống chi chúng cho những app người dùng thật sự dùng. Một app không mua được đường thoát bằng một bộ hẹn giờ khéo hơn. Nó chỉ có thể dùng cơ chế làm ra cho đúng việc nó làm, đó là chuyện của mục tiếp theo.

## 5. Mỗi nền tảng cho phép gì

Bảng hành vi nói monitor nhận được gì. Team còn cần biết nó *có thể* xin gì, và không được xin gì:

| App cần | Android | iOS |
|---|---|---|
| một lần đọc khi app trên màn hình | bộ hẹn giờ nào cũng được, chu kỳ nào cũng được: app đang chạy (bộ hẹn giờ foreground của adapter iOS) |
| một lần đọc mỗi N phút ở nền | periodic work của WorkManager, N ≥ 15, "thời gian tối thiểu giữa các lần lặp": thứ m13 làm | không có cơ chế như vậy. Một refresh task chạy "tối đa 30 giây", khi hệ thống quyết định: thứ m13 làm |
| việc liên tục mà người dùng biết | một foreground service, kèm thông báo và type được khai báo (bài 18) | chỉ đúng mục đích của các background mode: "VoIP, phát audio, vị trí, hoàn tất tác vụ, thông báo cục bộ, v.v." (App Review Guideline 2.5.4) |
| nghe từ một thiết bị BLE đã kết nối khi ở nền | một foreground service, cho một tác vụ người dùng nhận thấy (bài 18) | background mode `bluetooth-central`: "hệ thống đánh thức app khi bất kỳ method delegate `CBCentralManagerDelegate` hay `CBPeripheralDelegate` nào được gọi", nhưng "App không nên dùng việc được đánh thức làm cơ hội để làm các việc không liên quan" ([Core Bluetooth background processing](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html)) |
| chạy tiếp sau khi người dùng force-kill nó | không gì cả: cả hai nền tảng coi force-kill là người dùng nói không cho tới khi người dùng mở app lại. Trạng thái stopped của Android nhằm "giữ app ở trạng thái này cho tới khi người dùng chủ động đưa app ra khỏi nó bằng cách trực tiếp mở app hoặc gián tiếp tương tác với app" ([Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all)); iOS: mục 3 |

Quy tắc của bài 18 vẫn đứng: dùng cơ chế được nền tảng hỗ trợ, và không bao giờ lách giới hạn của hệ điều hành. Ở chỗ một nền tảng không làm được điều gì, bảng nói rõ điều đó; đó là ý của Appendix A.7 khi nói "ghi lại điều đó".

## 6. Ghi bảng vào project

Bảng vào repository, cạnh code mà nó mô tả, để người tiếp theo nghe "monitor bỏ lỡ một giờ" tìm thấy câu trả lời trước khi báo bug:

```markdown title="docs/monitor-behaviour.md" hl_lines="6 7 9"
⋯ title, what the monitor asks for, and how to read "Seen on"
## iOS: a timer in the foreground, a BGAppRefreshTask request in the background

| Situation | What happens | Seen on |
|---|---|---|
| Foreground | The app's own timer: the first record one interval after the app becomes active, then one per interval while it stays active. | Simulator |
| Return to foreground | The timer starts over: the next record one full interval after the return. Visits shorter than 15 minutes write nothing. | Simulator |
⋯ Background, on the Simulator: error 1, no records until the app is active again
| Background, on a phone | iOS may launch or wake the app for the refresh task: not before 15 minutes, at a time iOS chooses (it can be hours), or not at all. Each run asks for the next. | phone, not yet run |
⋯ the other iOS rows, and "What neither platform promises"
```

1. **Một cột "Seen on".** Mỗi hàng nói nó được biết bằng cách nào: *emulator* hay *Simulator* cho những gì chúng tôi đã chạy, *phone, not yet run* cho những gì chỉ điện thoại cho thấy được, viết từ tài liệu của nền tảng. Người đọc phân biệt được một quan sát với một dự đoán, và bạn biết hàng nào phải chạy trên điện thoại của mình.
2. **Hành vi, không phải số đo thời gian.** Bảng ghi "15 phút trở lên", không ghi "15 phút 59 s": khoảng cách chính xác khác nhau ở mỗi lần chạy và mỗi thiết bị, và thuộc về ghi chép của bạn. Một hàng đổi khi một lần chạy mâu thuẫn với nó.
3. **Markdown, trong `docs/`.** Nó được đọc trên GitHub và trong IDE, và không bị đóng gói vào app nào. Build file của Android và iOS không bao giờ nhìn vào `docs/`.

!!! warning "Gotcha · "monitor ngừng chạy" sau một lần force stop"
    Một tester force-stop app Android, hay vuốt bỏ nó trên iPhone, rồi chờ bản ghi, sẽ báo "monitor ngừng hoạt động". Nó đúng là đã dừng, như cả hai nền tảng chủ ý, và đó là hàng force-kill của bảng. Xem hàng đó trước khi đi tìm bug. Trên Android điều ngược lại cũng xảy ra: một tester dùng `am kill` để "giả lập" force stop thấy monitor vẫn chạy tiếp, vì `am kill` không đưa app vào trạng thái stopped.

!!! warning "Gotcha · JobScheduler của emulator có thể ngồi yên trên một job đã tới hạn"
    Trong lần chạy kiểm chứng của bài 18, một emulator để job đã tới hạn của chúng tôi không chạy hơn 35 phút (`TIME=` âm, "Ready: true"), trong khi cùng emulator đó đã chạy nó đúng giờ một tiếng trước. Nếu một lần chạy ở đây chờ lâu hơn 15 phút nhiều, đó là chuyện đang xảy ra; `adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler -u 0 com.example.devicemonitor <job id>` chạy nó khi chu kỳ đã qua. Ghi trong ghi chép của bạn rằng bạn đã làm vậy, vì khi đó khoảng cách của hàng đó không phải của riêng Android.

## 7. Thực tế xảy ra gì: các lần chạy đứng sau trang này

Chúng tôi chạy m13 không đổi (Kotlin 2.4.20, WorkManager 2.12.0, Xcode 26.2): `allTests` pass 95 trên 95 trên JVM và 95 trên 95 trên iOS simulator. Các lần chạy Android là bảng của mục 2 (emulator API 36, app Compose, một lần cài mới), các lần chạy iOS là bảng của mục 3 (Simulator iOS 26.2, app SwiftUI). Thêm hai lần chạy nữa: app UIKit, build từ bản sao XML/UIKit của bài 18, cho cùng các hàng foreground, nền và quay lại trên cùng Simulator (bản ghi đầu 15 phút sau khi mở, lỗi 1 ở nền, bản ghi tiếp theo 15 phút sau khi quay lại); app XML chạy cùng code monitor với app Compose (bài 18), và chúng tôi không lặp lại các lần chạy của nó.

**m14 là một điểm dừng tự nhiên** khi `docs/monitor-behaviour.md` có trong project của bạn, mọi hàng emulator và Simulator trong đó khớp với những gì bạn thấy, và mọi hàng điện thoại hoặc đã được chạy trên điện thoại của bạn và cập nhật, hoặc vẫn ghi "phone, not yet run". Hãy commit nó.

!!! question "Hỏi agent của bạn"
    Nhờ agent giải thích, từng hàng một, dòng code nào của m13 tạo ra mỗi hàng emulator và Simulator trong bảng của bạn, và quy tắc nền tảng nào tạo ra mỗi hàng điện thoại. Rồi hỏi nó bảng sẽ đổi gì nếu `onAppLaunch()` được gọi từ `onAppear` của màn hình danh sách thay vì phần khởi động app.

## Câu hỏi ôn

Trả lời bằng trí nhớ, đừng kéo lên xem. Bấm vào đáp án bạn chọn.

<div class="quiz">
<p class="q">Trên Android, app ở trên màn hình 40 phút sau một lần cài mới. Bạn chờ bao nhiêu bản ghi?</p>
<div class="opts">
<button class="opt">không có cho tới khi app vào nền</button>
<button class="opt" data-correct>một ngay lập tức, rồi mỗi chu kỳ một, cách nhau 15 phút trở lên: thường là ba</button>
<button class="opt">mỗi phút một, vì app ở foreground</button>
</div>
<p class="feedback"></p>
<p class="why">WorkManager không nhìn màn hình. Một periodic request mới chạy ngay, rồi cách nhau ít nhất một chu kỳ; chúng tôi thấy 15 phút 2 s khi app trên màn hình.</p>
</div>

<div class="quiz">
<p class="q">Một người dùng iPhone mở app 5 phút mỗi 10 phút suốt buổi chiều. m13 ghi bao nhiêu bản ghi foreground?</p>
<div class="opts">
<button class="opt">mỗi 15 phút một, như đã cấu hình</button>
<button class="opt">mỗi lần app mở một bản ghi</button>
<button class="opt" data-correct>không bản ghi nào: mỗi lần active đều khởi động lại bộ hẹn giờ, và nhịp đầu là cả một chu kỳ sau</button>
</div>
<p class="feedback"></p>
<p class="why">Trên Simulator, bản ghi sau một lần quay lại tới 15 phút sau khi quay lại, không phải 15 phút sau bản ghi trước. Bản ghi nền, trên điện thoại, là do iOS quyết định.</p>
</div>

<div class="quiz">
<p class="q">Trên emulator, bạn nhấn Home và chạy <code>am kill</code>. Chuyện gì xảy ra với monitor?</p>
<div class="opts">
<button class="opt">không gì cho tới khi người dùng mở app lại</button>
<button class="opt" data-correct>ở lần chạy tiếp theo Android khởi động một process mới cho job của WorkManager; <code>Application.onCreate</code> trao nhịp và một bản ghi được ghi</button>
<button class="opt">bản ghi được ghi bởi process cũ, thứ Android khôi phục lại</button>
</div>
<p class="feedback"></p>
<p class="why">Lịch sống trong cơ sở dữ liệu của WorkManager và JobScheduler, không trong process. Chúng tôi thấy "Start proc 11710 … for service {…SystemJobService}" và một bản ghi 2,6 s sau.</p>
</div>

<div class="quiz">
<p class="q">Sau <code>am kill</code>, WorkManager ghi "Application was force-stopped, rescheduling." App có bị force-stop không?</p>
<div class="opts">
<button class="opt">có: <code>am kill</code> và <code>am force-stop</code> làm cùng một việc</button>
<button class="opt" data-correct>không: Android ghi lần kill là "user requested · kill background", và WorkManager lên lịch lại sau mọi lần thoát như vậy cho chắc; job vẫn còn đó</button>
<button class="opt">có, và đó là lý do bản ghi tiếp theo tới muộn</button>
</div>
<p class="feedback"></p>
<p class="why"><code>dumpsys activity exit-info</code> cho thấy lý do. Một force stop thật gỡ job khỏi JobScheduler ngay; <code>am kill</code> để nó tiếp tục đếm lùi.</p>
</div>

<div class="quiz">
<p class="q">Vì sao adapter iOS không hứa được một lần đọc mỗi 15 phút ở nền?</p>
<div class="opts">
<button class="opt">vì bộ hẹn giờ Kotlin/Native dừng ở nền, còn một bộ hẹn giờ Swift sẽ chạy</button>
<button class="opt">vì 15 phút dưới mức tối thiểu của iOS</button>
<button class="opt" data-correct>một refresh request chỉ đặt "không trước"; hệ thống quyết định khi nào, hay có chạy không, dựa trên cách dùng app, pin, mạng và cài đặt của người dùng, và mỗi request là một lần mở</button>
</div>
<p class="feedback"></p>
<p class="why">Không bộ hẹn giờ nào chạy trong một app đang tạm dừng, ở bất kỳ ngôn ngữ nào. <code>BGTaskRequest.h</code>: hệ thống "không đảm bảo mở task vào đúng ngày giờ chỉ định, mà chỉ đảm bảo nó sẽ không bắt đầu sớm hơn".</p>
</div>

<div class="quiz">
<p class="q">Những hàng nào của bảng không điền được trên emulator hay Simulator?</p>
<div class="opts">
<button class="opt">không hàng nào: emulator và Simulator chạy cùng code với điện thoại</button>
<button class="opt" data-correct>mọi hàng nền của iOS, hàng điện thoại-đã-khoá (Doze) của Android, một lần kill thiếu bộ nhớ thật, và force quit trên iPhone: chúng được đánh dấu "phone, not yet run"</button>
<button class="opt">chỉ các hàng force-kill</button>
</div>
<p class="feedback"></p>
<p class="why">Simulator từ chối mọi refresh request (lỗi 1), và lần mở debug của nó "chỉ chạy trên thiết bị". Emulator đang cắm sạc và thức, và <code>am kill</code> không phải low-memory killer.</p>
</div>

### Ôn xen kẽ

<div class="quiz">
<p class="q">Sau <code>simctl terminate</code> và mở lại, file log vẫn có cả hai bản ghi, nhưng <code>MonitorStatus</code> của process mới không có <code>lastRecord</code>. Vì sao? (Bài 17–18)</p>
<div class="opts">
<button class="opt">lần mở lại cố tình xoá trạng thái</button>
<button class="opt" data-correct>các bản ghi nằm trong file của kho log, thứ sống lâu hơn process; <code>MonitorStatus</code> là một <code>StateFlow</code> trong bộ nhớ, mỗi process một cái</button>
<button class="opt">kho log iOS chỉ ghi khi thoát sạch sẽ</button>
</div>
<p class="feedback"></p>
<p class="why">Bài 18 đã nói: "File log là thứ còn lại lâu dài." Hãy hiện log, không hiện <code>lastRecord</code>, cho lịch sử.</p>
</div>

<div class="quiz">
<p class="q">Adapter iOS khởi động lại bộ hẹn giờ ở <code>UIApplicationDidBecomeActiveNotification</code>. Vì sao là cái đó, không phải <code>onAppear</code> của một màn hình? (Bài 04 và 18)</p>
<div class="opts">
<button class="opt"><code>onAppear</code> không có trong UIKit</button>
<button class="opt" data-correct>nó là mức app: nó chạy dù màn hình nào đang hiện, trên cả hai track iOS, còn các callback của một màn hình chỉ theo màn hình đó</button>
<button class="opt">notification chạy trên một background thread, thứ bộ hẹn giờ cần</button>
</div>
<p class="feedback"></p>
<p class="why">Nhấn Home không cho callback view nào cả; mức app và mức scene là chỗ việc nền móc vào (quy tắc của cheatsheet platform lifecycles).</p>
</div>

<div class="quiz">
<p class="q">Một đồng đội đề xuất một nhịp ở mỗi lần quay lại foreground khi bản ghi cuối cũ hơn một chu kỳ. Nó sẽ nằm ở đâu? (Bài 10 và 18)</p>
<div class="opts">
<button class="opt">trong <code>IosMonitorScheduler</code>, thứ đã thấy được lần quay lại</button>
<button class="opt" data-correct>trong <code>MonitoringService</code>, kèm một test dùng scheduler và đồng hồ giả: "cũ hơn một chu kỳ" là một quy tắc của app, và cả hai nền tảng đều có được nó</button>
<button class="opt">trong ViewModel của màn hình danh sách, thứ biết khi nào người dùng đang nhìn</button>
</div>
<p class="feedback"></p>
<p class="why">Adapter là bộ hẹn giờ; quy tắc nằm trong service. Service sẽ cần nghe về lần quay lại, đó là một câu hỏi về port phải giải quyết trước.</p>
</div>

## Bài tự làm

!!! example "Bài tự làm (không dùng agent, trên project m14 của bạn)"
    1. **Doze trên emulator.** Đoán, từ mục 2, chuyện gì xảy ra với bản ghi tiếp theo nếu emulator vào Doze ngay trước khi nó tới hạn. Rồi chạy: `adb shell dumpsys battery unplug`, `adb shell dumpsys deviceidle force-idle`, chờ qua `TIME=`, đọc log; rồi `adb shell dumpsys deviceidle unforce` và `adb shell dumpsys battery reset`, và đọc lại. Câu nào trong trang Doze giải thích những gì bạn thấy?
    2. **Một standby bucket.** `adb shell am set-standby-bucket com.example.devicemonitor rare` với emulator rút sạc như trên, và `am get-standby-bucket` để kiểm tra. Dùng các giới hạn job trong [Power management restrictions](https://developer.android.com/topic/performance/power/power-details), đoán các bản ghi trong một giờ tới, rồi xem. Đặt bucket lại bằng `active`.
    3. **Ghé thăm ngắn trên iOS.** Trước khi thử, ghi ra một bản build chu kỳ 1 phút của app iOS ghi bao nhiêu bản ghi nếu bạn chuyển sang Settings mỗi 50 giây rồi quay lại ngay, trong 5 phút. Rồi build nó (đổi `MONITOR_INTERVAL` trong một bản sao tạm, không bao giờ trong project của bạn) và kiểm tra.
    4. **Trên điện thoại của bạn**: chạy các hàng "phone, not yet run" của bảng (brief cho agent liệt kê chúng là các kiểm tra trên thiết bị). Với mỗi hàng, đổi "phone, not yet run" thành tên điện thoại và phiên bản hệ điều hành, và sửa đoạn "What happens" nếu điện thoại của bạn nói khác. Dùng các con số từ bước cuối bài tự làm của bài 18.
    5. **Một đoạn cho product owner.** Dưới bảng, viết monitor có thể hứa gì trên mỗi nền tảng, bằng lời mà người không phải lập trình viên hiểu được, không có "WorkManager" hay "BGTaskScheduler".

## Brief cho agent

Đưa đoạn này cho coding agent của bạn, kèm các track bạn chọn. Các lần chạy mất khoảng 70 phút chờ trên Android và 55 trên iOS; chúng chạy song song được. Sau đó đọc bảng đối chiếu với mục 2–3, tự chạy vài hàng, và tự làm bài tự làm.

!!! note "Brief giữ nguyên tiếng Anh"
    Đây là prompt để copy nguyên văn cho agent, nên không dịch.

```text
Lesson source: https://phongna-inn.github.io/carmd-kmp-course/lessons/19-background-behaviour-table.html
Before anything else, download the lesson and the reference pages it links, then read
them in full. Don't use a summarising web fetch; it can leave out code.
  mkdir -p .course    # in my workspace root, not inside demo/
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/19-background-behaviour-table.html" -o .course/lesson-19.html
  curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html" -o .course/ref-platform-lifecycles-cheatsheet.html
Lesson 18, which this lesson builds on; skipped if it's already there:
  [ -f .course/lesson-18.html ] || curl -fsSL "https://phongna-inn.github.io/carmd-kmp-course/lessons/18-background-monitor.html" -o .course/lesson-18.html
Use these files to answer my questions about this lesson without asking me for context.

Lesson 19 (Background monitor: platform behaviour table): milestone m14 on top of m13. No code
changes. Add the behaviour table, then run the monitor in each situation on an emulator and a
simulator and check that every "emulator" and "Simulator" row matches what you see.
My tracks: Android = [Compose | XML], iOS = [SwiftUI | UIKit]  (default Compose + SwiftUI).
Starting point: my m13 project in demo/ (Lesson 18). All paths are relative to demo/.

1. add: docs/monitor-behaviour.md, exactly as in the lesson's "Full files" section. Touch no
   other file. Do NOT edit a row because a run disagrees: report the disagreement to me with
   your evidence, and I decide.

2. Build both apps for my tracks as in Lesson 18's brief, step 3 (./gradlew :shared:allTests,
   then the Android APK and the iOS app). Keep evidence of every run below in a folder outside
   demo/ (logs, the log file, dumpsys lines, console output), with the host clock time of each step.

Acceptance checks (run every one you can; the Android and iOS runs can go side by side):
- ./gradlew :shared:allTests still passes 95 tests on testAndroidHostTest and 95 on
  iosSimulatorArm64Test (show the counts from shared/build/test-results/), and no file outside
  docs/ changed since m13.
- Android emulator (API 31+), my track's APK. Fresh install as in Lesson 18's brief, then
  adb shell svc power stayon true, start adb logcat -v time -s DeviceMonitor:I ActivityManager:I WM-ForceStopRunnable:D
  into a file, and launch with am start. Read the log with
  adb shell run-as com.example.devicemonitor cat files/status-log.jsonl
  and the next run with adb shell dumpsys jobscheduler | grep 'JobStatus{.*devicemonitor'.
  A1 foreground: one record within 10 s of launch. Leave the app on screen until the next run:
     a second record 15 minutes or more after the first, logged by the same process id.
  A2 background: adb shell input keyevent KEYCODE_HOME. At the next run: a third record, 15
     minutes or more after the second, from the same process id.
  A3 return: am start again. 60 s later: still three records, and TIME= has kept counting down
     (it did not jump back to about 15 minutes).
  A4 OS kill: Home, wait 3 s, adb shell am kill com.example.devicemonitor; adb shell pidof
     com.example.devicemonitor prints nothing (if it prints a number, run am kill again).
     adb shell dumpsys activity exit-info com.example.devicemonitor shows reason=10 (USER
     REQUESTED) subreason=24 (KILL BACKGROUND). At the next run: logcat shows "Start proc …
     for service {com.example.devicemonitor/androidx.work.impl.background.systemjob.SystemJobService}",
     WM-ForceStopRunnable "Application was force-stopped, rescheduling.", and "Monitor tick"
     from the new process id; the log has a fourth record.
  A5 force-kill: adb shell am force-stop com.example.devicemonitor. At once: the grep on
     dumpsys jobscheduler prints nothing, and exit-info shows subreason=21 (FORCE STOP).
     Wait until 20 minutes after the fourth record: still four records, and no "Start proc" for
     our package in logcat. Then am start: within 10 s a fifth record (sometimes a sixth 1 to
     2 s after it: WorkManager's log shows the first run interrupted and started again; say
     which you saw); logcat shows WM-ForceStopRunnable "Application was force-stopped,
     rescheduling." from the new process id; the dumpsys grep shows our job again, with
     TIME=+14m… or a little less.
  If TIME= is negative (the job is due) and no record comes for five more minutes, the emulator's
  JobScheduler is slow to start it: run it once by hand, as in Lesson 18's brief
  (adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler -u 0 com.example.devicemonitor <id>),
  and say in your report which run needed it.
- iOS Simulator, my track's app. Fresh install as in Lesson 18's brief, then launch with
  xcrun simctl launch --console-pty booted com.example.devicemonitor, its output to a file.
  The log file is "$(xcrun simctl get_app_container booted com.example.devicemonitor data)/Library/Application Support/status-log.jsonl".
  I1 foreground: no log file (or no record) 10 s after launch; 15 to 16 minutes after launch,
     "Monitor tick (foreground)" in the console and one record.
  I2 background: xcrun simctl launch booted com.apple.Preferences. At once the console shows
     "Monitor: no background refresh: The operation couldn’t be completed.
     (BGTaskSchedulerErrorDomain error 1.)". Five minutes later: still one record.
  I3 return: xcrun simctl launch booted com.example.devicemonitor. Ten minutes later: still one
     record. 15 to 16 minutes after the return: a second "Monitor tick (foreground)" and a
     second record.
  I4 process ended: xcrun simctl launch booted com.apple.Preferences, wait 10 s, then
     xcrun simctl terminate booted com.example.devicemonitor. Five minutes later: still two
     records. Launch the app again (with --console-pty, a second file): 10 s later still two
     records; 15 to 16 minutes later a third.
- Device checks (list them for me, don't try to run them), on a physical Android phone and an
  iPhone on my track. Each is a "phone, not yet run" row of docs/monitor-behaviour.md:
  1. Android, Doze: install, open the app once, unplug, lock the phone and leave it still for
     2 hours: record times; expect gaps of 15 minutes or more, growing while the phone is still.
  2. Android, a real low-memory kill: open the app, press Home, open many heavy apps until
     adb shell dumpsys activity exit-info com.example.devicemonitor shows reason LOW_MEMORY;
     expect the next record from a new process, as in A4.
  3. Android, swipe the app away in Recents: expect what the table's Recents row says, and
     write down what your phone does (some phone makers stop apps more aggressively).
  4. iPhone, background: open the app, press Home, leave it for a few hours on Wi-Fi with
     Background App Refresh on: count the log's records written while the app was in the
     background (read the log from the app's container); zero is allowed.
  5. iPhone, force quit: open the app, swipe it away in the app switcher, leave it for a few
     hours: expect no records until you open it again.
  6. iPhone, Background App Refresh off (Settings → General → Background App Refresh), or Low
     Power Mode on: press Home with Xcode attached; expect error 1 in the console.
Then walk me through docs/monitor-behaviour.md row by row, tied to the lesson's sections, and
show me the evidence for each row you ran.
Do NOT do the unaided exercise for me.
```

## Đọc thêm

- Android, giới hạn nền: [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) (nguồn chính: Doze trì hoãn gì, maintenance window, và các lệnh test `dumpsys deviceidle`), [App Standby Buckets](https://developer.android.com/topic/performance/appstandby), [Power management restrictions](https://developer.android.com/topic/performance/power/power-details) (giới hạn job theo từng standby bucket; WorkManager bị ảnh hưởng) và [Test power-related issues](https://developer.android.com/topic/performance/power/test-power) (`am set-standby-bucket`).
- Android, kết thúc một process: trang [Android Debug Bridge](https://developer.android.com/tools/adb) (`am kill`, `am force-stop`), [Processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle) (process cached "có thể bị hệ thống kill bất cứ lúc nào"), [ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo) (lý do thoát: user requested, low memory), và [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all) ("Changes to package stopped state"). Phản ứng của WorkManager nằm trong mã nguồn của nó, [ForceStopRunnable.java](https://android.googlesource.com/platform/frameworks/support/+/androidx-main/work/work-runtime/src/main/java/androidx/work/impl/utils/ForceStopRunnable.java).
- iOS: [Choosing background strategies for your app](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app) (nguồn chính), [earliestBeginDate](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate), [submit(_:)](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler/submit(_:)), [backgroundRefreshStatus](https://developer.apple.com/documentation/uikit/uiapplication/backgroundrefreshstatus) (và Low Power Mode), [Starting and terminating tasks during development](https://developer.apple.com/documentation/backgroundtasks/starting-and-terminating-tasks-during-development) ("có thể là nhiều giờ"; chỉ trên thiết bị), [Preparing your UI to run in the background](https://developer.apple.com/documentation/uikit/preparing-your-ui-to-run-in-the-background), và [About the background execution sequence](https://developer.apple.com/documentation/uikit/about-the-background-execution-sequence). Phiên WWDC19 [Advances in App Background Execution](https://developer.apple.com/videos/play/wwdc2019/707/) của Apple giải thích hệ thống chọn thời điểm mở app ra sao.
- iOS, force quit: Apple ghi nó cho việc mở bằng push ([application(_:didReceiveRemoteNotification:fetchCompletionHandler:)](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/application(_:didreceiveremotenotification:fetchcompletionhandler:))) và cho background session ([background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:))); với việc mở ở nền nói chung, bài [iOS Background Execution Limits](https://developer.apple.com/forums/thread/685525) của Apple DTS (một bài forum, không phải tài liệu).
- iOS, BLE ở nền: [Core Bluetooth background processing for iOS apps](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html) (mode `bluetooth-central`; kho lưu trữ của Apple).
- [Cheatsheet: platform lifecycles](https://phongna-inn.github.io/carmd-kmp-course/reference/platform-lifecycles-cheatsheet.html): việc mức app móc vào mức app hay scene, và "Một app đang tạm dừng *không* nhận callback nào khi nó bị kill".
- Kinh nghiệm thực tế: Developer Forums của Apple, tag [Background Tasks](https://developer.apple.com/forums/tags/backgroundtasks); tag [android-workmanager](https://stackoverflow.com/questions/tagged/android-workmanager) của Stack Overflow. Coi những gì bạn đọc ở đó là một hàng cần chạy, không phải một hàng để chép.

## File đầy đủ

File duy nhất bài này thêm, đầy đủ. Không gì khác đổi: mọi file giữ như ở m13, trên mọi track.

??? example "docs/monitor-behaviour.md"
    ```markdown
    # Background monitor: what each platform does

    The status monitor (Lessons 18-19) asks for a reading of the phone's status every 15 minutes and
    appends it to the log (status-log.jsonl). This table says what each platform gives it, in each
    situation. Written from runs on the Android emulator and the iOS Simulator (Lesson 19), and from
    each platform's documentation for what only a phone can show.

    "Seen on" says how a row is known:
    - emulator / Simulator: we ran it and saw this.
    - phone, not yet run: only a physical phone can show it. The row says what the platform's
      documentation says. When you run it, write the phone and OS version here, and correct the row
      if the phone disagrees.

    ## Android: WorkManager periodic work, 15 minutes

    | Situation | What happens | Seen on |
    |---|---|---|
    | Foreground | A record a moment after the first launch, then one per period, 15 minutes or more apart, from the same process. Being on screen changes nothing. | emulator |
    | Background (Home, process alive) | The same: WorkManager runs the work in the running process. | emulator |
    | Background, phone locked and still, on battery | Doze defers the work to maintenance windows, which come less often the longer the phone is still; standby buckets limit how often jobs run. Expect gaps longer than 15 minutes. | phone, not yet run |
    | Return to foreground | No extra record. The next run keeps its time: the process is still running, so nothing schedules the work again. | emulator |
    | OS ends the process | At the next run Android starts a new process for the work; Application.onCreate hands over the tick, and the record is written. The schedule is kept. | emulator (am kill) |
    | OS ends the process under real memory pressure | Expected the same as the row above; Android records the exit as LOW_MEMORY. | phone, not yet run |
    | Force stop (Settings > Apps > Force stop) | No records until the user opens the app again: Android removes the work's job at once. When the app opens, WorkManager reschedules and runs the overdue work: a record at once (sometimes two, a second or two apart: the first run is interrupted and started again), then one per period. | emulator |
    | Swipe away in Recents | The process ends, but the app isn't stopped: the job stays, and the next run starts a new process, as when the OS ends it. A phone maker's Android can differ: check yours. | emulator; phone, not yet run |

    ## iOS: a timer in the foreground, a BGAppRefreshTask request in the background

    | Situation | What happens | Seen on |
    |---|---|---|
    | Foreground | The app's own timer: the first record one interval after the app becomes active, then one per interval while it stays active. | Simulator |
    | Return to foreground | The timer starts over: the next record one full interval after the return. Visits shorter than 15 minutes write nothing. | Simulator |
    | Background, on the Simulator | iOS suspends the app. The refresh request fails with error 1 (the Simulator doesn't support background tasks): no records until the app is active again. | Simulator |
    | Background, on a phone | iOS may launch or wake the app for the refresh task: not before 15 minutes, at a time iOS chooses (it can be hours), or not at all. Each run asks for the next. | phone, not yet run |
    | Process ended (Simulator: simctl terminate) | Nothing runs until the user opens the app. The log keeps its records; the new process writes its first record one interval after it becomes active. | Simulator |
    | OS ends the app, on a phone | A pending refresh request can still launch the app in the background, when iOS chooses. | phone, not yet run |
    | Force quit (swipe up in the app switcher) | Expected: no background launches, so no records, until the user opens the app again. | phone, not yet run |
    | Background App Refresh off, or Low Power Mode | No refresh tasks: the request fails with error 1 when Background App Refresh is off; Low Power Mode turns Background App Refresh off. | phone, not yet run |

    ## What neither platform promises

    - An exact interval. Android's 15 minutes is the least time between runs; iOS's is the earliest
      time a run may start, and in the background iOS decides whether it starts at all.
    - Records after the user force-kills the app, until the user opens it again.
    - A record the moment the app opens. Android writes on the work's schedule (at once only when a
      run is due, as on the first launch or after a force stop); iOS writes one interval after each
      activation.

    ## Sources

    - Android: Define work requests (periodic work), Optimize for Doze and App Standby, Power
      management restrictions, Android 15 behavior changes (package stopped state).
    - iOS: BGTaskRequest.h (earliestBeginDate), Choosing background strategies for your app,
      BGTaskScheduler.h (error 1 on the Simulator), backgroundRefreshStatus.
    - Lesson 19 lists the links and the commands for every run.
    ```

---

## Appendix

Phần này **không có trong bản gốc**. Đây là giải thích thêm cho những chỗ khó hiểu của bài.
Ví dụ có output ở A4 là chương trình Kotlin console đã chạy thật (Kotlin 2.4.21, JVM 17, kotlinx-coroutines 1.11.0, thời gian ảo của `kotlinx-coroutines-test`). Nó là **mô hình** của `startTimer()` trong `IosMonitorScheduler` (bài 18): cùng thứ tự huỷ, chờ, nhịp; không có iOS thật.

!!! tip "Thấy bài khó? Đọc theo thứ tự này"
    1. [A1](#a1-bai-nay-noi-on-gian-trong-5-cau-tu-ien-nhanh): bài này nói gì trong 5 câu, kèm từ điển các chữ mới.
    2. [A2](#a2-bang-hanh-vi-tom-tat-trong-mot-trang): bảng hành vi tóm tắt trong một trang (mục 2, 3).
    3. [A3](#a3-ba-cach-ket-thuc-app-tren-android-khong-giong-nhau): ba cách kết thúc app trên Android không giống nhau (mục 1, 2).
    4. [A4](#a4-ios-mo-app-ngan-thi-khong-co-ban-ghi-chay-that): iOS: mở app ngắn thì không có bản ghi, chạy thật (mục 3).
    5. [A5](#a5-oc-va-viet-mot-hang-phone-not-yet-run): đọc và viết một hàng "phone, not yet run" (mục 6).

### A1. Bài này nói đơn giản trong 5 câu, từ điển nhanh

!!! abstract "5 câu"
    1. Bài này **không đổi code**: chạy monitor m13 trong năm tình huống (foreground, nền, quay lại, hệ điều hành kết thúc app, người dùng force-kill) và ghi kết quả vào `docs/monitor-behaviour.md`.
    2. **Android**: WorkManager không nhìn màn hình; bản ghi tới khoảng mỗi 15 phút **dù app mở, ở nền hay process đã chết**, cho tới khi người dùng force stop.
    3. **iOS**: ở foreground, mỗi lần app thành active là bộ hẹn giờ **bắt đầu lại từ 0**; ở nền, iOS quyết định có chạy hay không, và Simulator **không bao giờ** chạy.
    4. Force-kill trên cả hai là người dùng **nói không**: không bản ghi nào cho tới khi người dùng tự mở app lại.
    5. Mỗi hàng của bảng ghi rõ **thấy ở đâu**: emulator, Simulator, hay "phone, not yet run" (dự đoán từ tài liệu, chờ chạy trên máy thật).

Ví dụ đời thường cho cả bài: **giao báo buổi sáng.** Ở Android, công ty phát hành (WorkManager) giữ danh sách thuê bao; dù bạn ở nhà hay đi vắng, báo vẫn tới mỗi sáng, có hôm muộn. Chỉ khi bạn **gọi huỷ** (force stop) thì họ ngừng, cho tới khi bạn gọi đăng ký lại (mở app). Ở iOS, khi bạn ở nhà (foreground) bạn tự ra sạp mua; khi đi vắng, **bưu điện** (iOS) quyết định có giao không, giao lúc nào, dựa vào việc bạn hay đọc báo không, nhà có điện không. Và nếu bạn treo biển "đừng giao" (force quit), họ không giao tới khi bạn gỡ biển.

| Chữ trong bài | Nói đơn giản | Trong m14 là |
|---|---|---|
| behaviour table | bảng "monitor làm gì trong từng tình huống, trên từng nền tảng" | `docs/monitor-behaviour.md` |
| "Seen on" | cột ghi hàng này được biết bằng cách nào | emulator / Simulator / phone, not yet run |
| `am kill` | kill process "an toàn để kill"; không phải force stop | job vẫn còn, lần sau chạy tiếp |
| `am force-stop` | đưa app vào trạng thái **stopped** | job bị gỡ ngay, không gì chạy |
| stopped state | Android ngừng mọi alarm, job của app cho tới khi người dùng mở lại | sau Force stop trong Settings |
| exit-info | lý do Android ghi cho mỗi lần process thoát | `USER REQUESTED`, `LOW_MEMORY` |
| Doze | chế độ ngủ sâu khi máy khoá, để yên, dùng pin; dồn job vào maintenance window | chỉ thấy trên điện thoại |
| App Standby Bucket | hạng của app theo mức người dùng dùng nó; hạng thấp thì job chạy ít | `active` → `rare` → `restricted` |
| Background App Refresh | công tắc iOS cho phép app mở ở nền | tắt thì lỗi 1 trên điện thoại |
| force quit (iOS) | vuốt app lên trong app switcher | không mở ở nền cho tới khi người dùng mở lại |

### A2. Bảng hành vi tóm tắt trong một trang

Giải thích thêm cho [mục 2](#2-android-nhung-gi-chung-toi-thay) và [mục 3](#3-ios-nhung-gi-chung-toi-thay-tren-simulator). Đây là tóm tắt của hai bảng quan sát, không thay thế file `docs/monitor-behaviour.md`:

| Tình huống | Android | iOS |
|---|---|---|
| Foreground | bản ghi ngay khi cài, rồi ~15 phút một lần | bản ghi đầu **15 phút sau khi active**, rồi mỗi 15 phút |
| Nền | vẫn ~15 phút một lần, cùng process | Simulator: lỗi 1, không gì; điện thoại: khi iOS quyết định |
| Quay lại | không bản ghi thêm; lịch giữ nguyên | bộ hẹn giờ **bắt đầu lại**: bản ghi 15 phút sau khi quay lại |
| Hệ điều hành kết thúc app | lần chạy sau Android khởi động process mới, bản ghi đúng lịch | Simulator: không gì; điện thoại: một request đang chờ vẫn có thể mở app |
| Force-kill | Force stop: không gì cho tới khi mở app; vuốt Recents trên emulator: như `am kill` | dự kiến: không gì cho tới khi mở app (phone, not yet run) |
| Máy khoá lâu, dùng pin | Doze, standby bucket: giãn ra (phone, not yet run) | iOS quyết định, có thể nhiều giờ (phone, not yet run) |

Điểm khác lớn nhất: **Android theo lịch, iOS theo màn hình**. Trên Android, việc người dùng làm gần như không ảnh hưởng (trừ force stop). Trên iOS, bản ghi foreground phụ thuộc hoàn toàn vào việc app có ở trên màn hình đủ 15 phút liền không.

### A3. Ba cách kết thúc app trên Android không giống nhau

Giải thích thêm cho [mục 1](#1-nam-tinh-huong-va-cach-tao-ra-moi-cai) và [mục 2](#2-android-nhung-gi-chung-toi-thay).

| | `am kill` (sau Home) | Vuốt bỏ trong Recents | `am force-stop` / Settings → Force stop |
|---|---|---|---|
| Process | kết thúc | kết thúc | kết thúc |
| exit-info | `USER REQUESTED` · `KILL BACKGROUND` | `USER REQUESTED` · `REMOVE TASK` | `USER REQUESTED` · `FORCE STOP` |
| Trạng thái stopped | không | không (trên emulator) | **có** |
| Job của WorkManager | vẫn còn, đếm lùi tiếp | vẫn còn | **bị gỡ ngay** |
| Bản ghi tiếp theo | đúng lịch, từ process mới | đúng lịch, từ process mới | chỉ khi người dùng mở app (và chạy ngay lần trễ hạn) |
| `WM-ForceStopRunnable` khi process mới khởi động | "Application was force-stopped, rescheduling." (vô hại) | như vậy | như vậy, và lần này nó thật sự đặt lại job |

Ví dụ đời thường: `am kill` là **nhân viên tạm nghỉ ca**, lịch trực vẫn treo trên bảng nên tới giờ quản lý gọi người khác vào làm. Force stop là **nhân viên nộp đơn nghỉ**: quản lý xoá tên khỏi bảng trực, chỉ khi người đó tự quay lại công ty (mở app) thì mới được xếp lịch lại.

Bẫy khi test: dùng `am kill` để "giả lập" force stop sẽ thấy monitor chạy tiếp và kết luận sai rằng "force stop không ảnh hưởng". Và WorkManager ghi "force-stopped" cả khi không phải force stop, vì từ API 30 nó coi mọi lần thoát `USER REQUESTED` là force stop cho chắc.

### A4. iOS: mở app ngắn thì không có bản ghi, chạy thật

Giải thích thêm cho [mục 3](#3-ios-nhung-gi-chung-toi-thay-tren-simulator). Mô hình của `startTimer()` (bài 18): mỗi lần active thì huỷ timer cũ và chờ trọn một chu kỳ trước nhịp đầu; vào nền thì huỷ timer. Ba kiểu dùng app, chu kỳ 15 phút, chạy trên thời gian ảo:

```kotlin title="l19/Main.kt (mô hình, không có trong app)"
class ForegroundTimer(private val scope: CoroutineScope, private val interval: Duration, private val tick: () -> Unit) {
    private var timer: Job? = null
    fun becameActive() {
        timer?.cancel()
        timer = scope.launch { while (true) { delay(interval); tick() } }
    }
    fun enteredBackground() { timer?.cancel(); timer = null }
}

fun main() = runTest {
    run("mở liền 60 phút", 60.minutes, Duration.ZERO, 60.minutes)
    run("mở 20 phút, nghỉ 10 phút", 20.minutes, 10.minutes, 120.minutes)
    run("mở 10 phút, nghỉ 5 phút", 10.minutes, 5.minutes, 120.minutes)
}
```

Output thật:

```text
mở liền 60 phút              -> 3 bản ghi, ở phút [15, 30, 45]
mở 20 phút, nghỉ 10 phút     -> 4 bản ghi, ở phút [15, 45, 75, 105]
mở 10 phút, nghỉ 5 phút      -> 0 bản ghi, ở phút []
```

1. **Mở liền 60 phút**: bản ghi ở 15, 30, 45; ở phút 60 app vừa vào nền nên nhịp đó bị huỷ.
2. **Mở 20, nghỉ 10**: mỗi lần mở chỉ đủ một nhịp (phút thứ 15 của lần mở), nên khoảng cách giữa các bản ghi là 30 phút, không phải 15.
3. **Mở 10, nghỉ 5**: không lần mở nào đủ 15 phút, nên **không có bản ghi nào** trong 2 giờ, dù app được mở 8 lần.

Đó là hàng "quay lại" của bảng iOS. Nếu muốn đổi (ví dụ: ghi ngay khi quay lại nếu bản ghi cuối đã cũ hơn một chu kỳ), đó là một **quy tắc của app**: nó thuộc về `MonitoringService` kèm test với đồng hồ giả, không thuộc về adapter (câu ôn xen kẽ thứ ba).

So với TS/JS: giống `document.addEventListener("visibilitychange", …)` gọi `clearInterval` rồi `setInterval` lại mỗi khi tab hiện ra: `setInterval` không bao giờ chạy lần đầu ngay, nên tab chỉ mở ngắn sẽ không bao giờ thấy lần chạy nào.

### A5. Đọc và viết một hàng "phone, not yet run"

Giải thích thêm cho [mục 6](#6-ghi-bang-vao-project).

Một hàng tốt trả lời được ba câu: **tình huống gì**, **chuyện gì xảy ra** (hành vi, không phải số giây), và **biết bằng cách nào**.

| Kiểu hàng | "Seen on" ghi | "What happens" viết từ | Khi nào sửa |
|---|---|---|---|
| quan sát | `emulator (API 36)`, `Simulator (iOS 26.2)` | log, logcat, `dumpsys`, console | khi một lần chạy khác cho kết quả khác |
| dự đoán | `phone, not yet run` | tài liệu nền tảng (trích dẫn) | khi bạn chạy trên điện thoại: đổi thành tên máy + phiên bản OS |
| đã kiểm trên máy | `Pixel 8, Android 16` / `iPhone 15, iOS 26.1` | lần chạy của bạn | khi một máy khác nói khác: thêm một hàng, đừng ghi đè |

Ví dụ đời thường: giống ghi chú trong sổ tay nấu ăn. "Đã nấu thử" khác "theo công thức trên mạng". Người đọc sau cần biết dòng nào bạn đã tự làm.

Vì sao **không** ghi số đo chính xác (15 phút 59 s) vào bảng? Vì mỗi lần chạy, mỗi máy mỗi khác; một con số chính xác sẽ bị coi là lời hứa. Bảng ghi "15 phút trở lên"; con số cụ thể để trong ghi chép của bạn.

---

## Sau bài này tự làm được gì

Tự kiểm tra: đánh dấu được hết là qua bài, sang bài 20.

- [ ] Kể năm tình huống của Appendix A.7 và lệnh tạo ra mỗi cái trên emulator và Simulator.
- [ ] Đọc log, logcat (process id), `pidof` và `dumpsys jobscheduler` để biết process nào ghi bản ghi nào và lần chạy sau là khi nào.
- [ ] Giải thích vì sao trên Android foreground và nền là một hàng, và vì sao quay lại không ghi thêm (xem [A2](#a2-bang-hanh-vi-tom-tat-trong-mot-trang)).
- [ ] Phân biệt `am kill`, vuốt bỏ trong Recents và force stop: exit-info, trạng thái stopped, và chuyện gì xảy ra với job (xem [A3](#a3-ba-cach-ket-thuc-app-tren-android-khong-giong-nhau)).
- [ ] Giải thích vì sao trên iOS mở app dưới 15 phút mỗi lần thì không có bản ghi foreground nào (xem [A4](#a4-ios-mo-app-ngan-thi-khong-co-ban-ghi-chay-that)).
- [ ] Giải thích vì sao iOS không cho chu kỳ cố định ở nền: "không sớm hơn", hệ thống quyết định, một request một lần mở.
- [ ] Nói Doze và App Standby Bucket làm gì với WorkManager trên điện thoại, và vì sao emulator không cho thấy được.
- [ ] Nói mỗi nền tảng cho phép gì cho từng nhu cầu (foreground, nền, việc liên tục, BLE ở nền, sau force-kill).
- [ ] Viết `docs/monitor-behaviour.md` với cột "Seen on", tách quan sát khỏi dự đoán (xem [A5](#a5-oc-va-viet-mot-hang-phone-not-yet-run)).
- [ ] Viết một đoạn cho product owner nói monitor hứa được gì trên mỗi nền tảng, không dùng thuật ngữ kỹ thuật.
- [ ] Làm xong 5 bài tự làm ở trên mà không cần agent.
