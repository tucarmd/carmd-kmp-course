# Lesson 07 · m02 test plan (for agents)

Instructions for a coding agent (or a person) to verify milestone **m02**, the Device Monitor shell
with a list screen and a detail screen (Lesson 07), on an Android emulator and an iOS simulator.
Follow the steps in order and report every check as PASS / FAIL / NOT RUN with its evidence.

Everything here was run on 2026-10-27 (Pixel 8 emulator, Android 14, booted with `-gpu host`;
iPhone 17 simulator, iOS 26.5): Maestro 5/5 on Android, Maestro 5/5 on iOS, XCUITest 5/5,
`android-checks.sh` 15/15.

## 0. What m02 must do

List screen:

| State | Status line | Rows | Scan button |
|---|---|---|---|
| launch | `Tap Scan to look for devices.` | none | enabled |
| during a scan (~1.5 s) | `Scanning…` (one `…`, U+2026) + spinner | none | disabled |
| empty filter, after scan | `Devices found: 5` | 5, in `SampleDevices` order | enabled |
| filter `sens` | `Devices found: 1` | Tire Pressure Sensor | enabled |
| filter `zzz` | `No devices found. Try another filter.` in **red** | none | enabled |

Rows, in order: OBD-II Adapter (`C4:7C:8D:6A:01:10`, `-48 dBm`), Heart Rate Monitor (`…:11`,
`-61 dBm`), Tire Pressure Sensor (`…:12`, `-67 dBm`), Thermometer (`…:13`, `-74 dBm`),
Smart Scale (`…:14`, `-85 dBm`).

The list screen has the title `Device Monitor` and no header icon (the icon moved to the detail).

Detail screen (tap a row): the Bluetooth icon (Android) or antenna SF Symbol (iOS), the device
name, `ID: <id>`, `Signal: <rssi> dBm`. Android has an on-screen `Back` button; iOS has the
navigation bar back button with the title `Device`.

Back (every path) returns to the list with the **filter and the results still shown**.

Android only:
- Rotate with results showing: filter and results survive.
- Rotate during a scan: the screen returns to `Tap Scan to look for devices.` and the filter
  stays (expected for m02, Lesson 07 section 5).
- Two simultaneous taps on the detail's `Back`: the list shows (never blank), and a row still
  opens. Two simultaneous taps on a row: exactly one detail screen, no crash.

## 1. Inputs

- `APP_DIR`: the m02 project, default `demo/`. The same code is at git tag `m02` under `app/`.
- App id / bundle id: `com.example.devicemonitor` on both platforms.
- Test files (this folder, `scratch/lesson-07/`):
  - `maestro/01-launch.yaml` … `maestro/05-detail-back.yaml`: cross-platform Maestro flows.
  - `android-checks.sh`: rotation and parallel double-tap checks through `adb`.
  - `xcuitest/`: a throwaway XCUITest project that drives the installed iOS app by bundle id.
- Tools: Android SDK (`adb`, `emulator`), Xcode + `xcrun simctl`, `xcodegen`, Maestro ≥ 2.10.

## 2. Build and install

```bash
cd "$APP_DIR"
./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
# No `w:` lines from our Kotlin. Expected and fine: "Deprecated Gradle features … Gradle 10",
# "Unable to strip the following libraries".

cd iosApp && xcodegen generate
xcodebuild -project iosApp.xcodeproj -scheme iosApp \
  -destination 'platform=iOS Simulator,id=<UDID of an iPhone on iOS 17+>' \
  -derivedDataPath build build
# No Swift warnings from our files. Expected and fine: "Using the first of multiple matching
# destinations" (even with id=), "appintentsmetadataprocessor … Metadata extraction skipped".
```

Boot the emulator **with the host GPU** (see pitfall 1):

```bash
emulator -avd <name> -gpu host -no-snapshot-load -no-snapshot-save
adb shell cat /proc/loadavg      # wait until the first number is below ~4
```

Install and launch:

```bash
export ANDROID_SERIAL=emulator-5554    # needed when a phone is also connected
adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk
adb shell am start -n com.example.devicemonitor/com.example.devicemonitor.android.MainActivity

xcrun simctl boot <UDID>; open -a Simulator
xcrun simctl install <UDID> iosApp/build/Build/Products/Debug-iphonesimulator/iosApp.app
xcrun simctl launch <UDID> com.example.devicemonitor
```

## 3. Run the automated checks

From the repo root:

```bash
maestro --device emulator-5554 test --test-output-dir /tmp/m02-android scratch/lesson-07/maestro/
maestro --device <UDID>        test --test-output-dir /tmp/m02-ios     scratch/lesson-07/maestro/

ANDROID_SERIAL=emulator-5554 scratch/lesson-07/android-checks.sh   # restores rotation settings

cd scratch/lesson-07/xcuitest && xcodegen generate
xcodebuild test -project Probe.xcodeproj -scheme Probe \
  -destination 'platform=iOS Simulator,id=<UDID>' -derivedDataPath build \
  -resultBundlePath r.xcresult
```

What each check covers:

| Check | Android | iOS |
|---|---|---|
| launch: title, field, Scan, idle text, no rows | Maestro `01` | Maestro `01`, XCUITest `testLaunchHasNoRows` |
| `Scanning…` (single `…`), disabled button, spinner | Maestro `02` + screenshot `02-scanning` | XCUITest `testScanAllShowsFiveRowsInOrder` |
| 5 rows in order, id and dBm shown | Maestro `02` (`below:` chain) | Maestro `02`, XCUITest (row y positions sorted) |
| filter `sens` → 1 row | Maestro `03` | Maestro `03`, XCUITest |
| filter `zzz` → error, no rows | Maestro `04` | Maestro `04`, XCUITest |
| error is red | screenshot `04-not-found` | screenshot `04-not-found` |
| row → detail (name, ID, Signal) | Maestro `05` | Maestro `05`, XCUITest |
| Back keeps filter + results | Maestro `05`: on-screen Back, then system back | XCUITest: nav-bar back button, then edge swipe |
| rotation (results, during scan) | `android-checks.sh` part A | not applicable |
| parallel double tap on Back / on a row | `android-checks.sh` parts B and C | not applicable |

## 4. Checks that need eyes

Open the screenshots (Maestro `takeScreenshot` files, the XCUITest `scanning` attachment) and
confirm:

- Android: nothing under the status bar; dark, readable status-bar icons.
- List: no header icon; the Scan button spans the full width; each row shows name, id, dBm
  (iOS rows also show a chevron).
- During a scan: the button is greyed out and a spinner sits left of `Scanning…`.
- The `zzz` error line is red.
- Detail: a large icon above the name.

Pull the iOS attachment with
`xcrun xcresulttool export attachments --path r.xcresult --output-path att`.

## 5. Known pitfalls (all hit while writing this plan)

1. **Software-rendered emulator deadlocks on rotation.** With `hw.gpu.enabled=no` the AVD
   renders with lavapipe/SwANGLE. Rotating m02 went black and raised "isn't responding"
   (`Application does not have a focused window`). The ANR trace showed the main thread in
   `HardwareRenderer.setStopped` waiting for a RenderThread stuck in
   `FrameCommitWrapper::onFrameCommit`, with no app frames; the stock Settings app also rendered
   blank in landscape. Booting with `-gpu host` fixed it, and every check then passed.
2. **Maestro on iOS can't see the 1.5 s scanning window** (one `tapOn` takes ~4 s). Flow `02`
   checks it on Android only; the XCUITest covers it on iOS.
3. **Maestro has no reliable iOS back**, so flow `05` runs the back steps on Android only and the
   XCUITest does the nav-bar back button and the edge swipe.
4. **Compose hides `enabled` from Maestro** (the `Scan` text node is always enabled), so the flows
   don't assert it; use the screenshot on Android and `isEnabled` in the XCUITest on iOS.
5. **The double-tap bug only shows with truly simultaneous taps.** `android-checks.sh` starts two
   `adb shell input tap` processes in parallel (`tap2`). Sequential taps from one adb session
   never reproduce it.
6. **`uiautomator dump` waits for idle**, so it can't read the scanning state; use a screenshot.
7. **Two Android targets connected** (phone + emulator): always pass `--device` / set
   `ANDROID_SERIAL`, or rotation settings and taps land on the phone.
8. **Fixed coordinates.** `android-checks.sh` taps positions for a 1080×2400 portrait screen
   (`FIELD`, `SCAN`, `ROW1`, `ROW3`, `BACK` at the top). On another screen size, read bounds from
   `adb exec-out uiautomator dump /dev/tty` and edit them.
9. **Text matching:** status text uses `…` (U+2026). Maestro text is a full-match regex, so
   `"Scan"` does not match `Tap Scan to look for devices.`.

## 6. Report format

```text
m02 test report · <date> · Android <AVD / API, GPU mode> · iOS <device / version>
Builds: Android <ok/fail> (warnings: …) · iOS <ok/fail> (warnings: …)
Maestro Android: n/5 · Maestro iOS: n/5 · XCUITest: n/5 · android-checks: n/15
Visual: status bar <ok>, no list icon <ok>, rows <ok>, scanning state <ok>, red error <ok>, detail icon <ok>
NOT RUN: <list, with the reason>
```
