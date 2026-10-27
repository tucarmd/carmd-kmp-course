# Lesson 06 · m01 test plan (for agents)

Instructions for a coding agent (or a person) to verify milestone **m01**, the first Device Monitor
screen from Lesson 06, on an Android emulator and an iOS simulator. Follow the steps in order and
report every check as PASS / FAIL / NOT RUN with the evidence named in the step.

Everything here was run on 2026-10-27 with these results: Maestro 4/4 on Android, Maestro 4/4 on
iOS (end states), XCUITest 3/3 on iOS, rotation script 5/5 on Android.

## 0. What m01 must do

| State | Status line | Scan button | Spinner |
|---|---|---|---|
| launch | `Tap Scan to look for devices.` | enabled | no |
| during a scan (~1.5 s) | `Scanning…` (one `…` character, U+2026) | disabled | yes |
| empty filter, after scan | `Devices found: 5` | enabled | no |
| filter `sens`, after scan | `Devices found: 1` | enabled | no |
| filter `zzz`, after scan | `No devices found. Try another filter.` in **red** | enabled | no |

The header shows an icon (Bluetooth on Android, antenna SF Symbol on iOS) with `Device Monitor`
next to it, then a `Device name filter` field and a full-width `Scan` button.

Android rotation (Compose): with a result showing, rotating keeps the filter and the result.
Rotating **during** a scan cancels it: the screen shows `Tap Scan to look for devices.` and the
filter stays. This is expected for m01 (Lesson 06, section 6); Lesson 08 fixes it with a ViewModel.

## 1. Inputs

- `APP_DIR`: the m01 project. Default `demo/` (built by the Lesson 06 agent brief). The same code
  is at git tag `m01` under `app/`.
- App id / bundle id: `com.example.devicemonitor` on both platforms.
- Test files (this folder, `scratch/lesson-06/`):
  - `maestro/01-launch.yaml` … `maestro/04-filter-zzz.yaml`: cross-platform Maestro flows.
  - `android-rotation.sh`: Android rotation check through `adb`.
  - `xcuitest/`: a throwaway XCUITest project that drives the installed iOS app by bundle id.
- Tools: Android SDK (`adb`, `emulator`), Xcode + `xcrun simctl`, `xcodegen`, Maestro ≥ 2.10.

## 2. Build and install

```bash
cd "$APP_DIR"
./gradlew :shared:compileCommonMainKotlinMetadata :androidApp:assembleDebug
# Read the output: there must be no `w:` lines from our Kotlin. Expected and fine:
# "Deprecated Gradle features … Gradle 10", "Unable to strip the following libraries".

cd iosApp
xcodegen generate
xcodebuild -project iosApp.xcodeproj -scheme iosApp \
  -destination 'platform=iOS Simulator,id=<UDID of an iPhone on iOS 17+>' \
  -derivedDataPath build build
# No Swift warnings from our files. Expected and fine: "Using the first of multiple matching
# destinations", "appintentsmetadataprocessor … Metadata extraction skipped".
```

Pick devices:

```bash
emulator -list-avds                    # boot one: emulator -avd <name> -no-snapshot-save
xcrun simctl list devices available    # use the UDID, names can repeat
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

Run from the repo root.

```bash
# Maestro, both platforms (same flows, same app id)
maestro --device emulator-5554 test --test-output-dir /tmp/m01-android scratch/lesson-06/maestro/
maestro --device <UDID>        test --test-output-dir /tmp/m01-ios     scratch/lesson-06/maestro/

# Android rotation (restores user_rotation 0 / accelerometer_rotation 1 at the end)
ANDROID_SERIAL=emulator-5554 scratch/lesson-06/android-rotation.sh

# iOS during-scan checks (app must already be installed on the booted simulator)
cd scratch/lesson-06/xcuitest
xcodegen generate
xcodebuild test -project Probe.xcodeproj -scheme Probe \
  -destination 'platform=iOS Simulator,id=<UDID>' -derivedDataPath build
```

What each automated check covers:

| Check | Android | iOS |
|---|---|---|
| launch screen texts | Maestro `01` | Maestro `01` |
| `Scanning…` (single `…`) + disabled button during scan | Maestro `02` (+ screenshot `02-scanning`) | XCUITest `testScanAll` (asserts `isEnabled == false`, spinner exists, and that `Scanning...` with three dots does **not** exist) |
| `Devices found: 5` | Maestro `02` | Maestro `02`, XCUITest |
| filter `sens` → `Devices found: 1` | Maestro `03` | Maestro `03`, XCUITest |
| filter `zzz` → error text | Maestro `04` | Maestro `04`, XCUITest |
| error is red | look at screenshot `04-not-found` | look at screenshot `04-not-found` |
| rotation | `android-rotation.sh` | not applicable (iOS does not recreate screens) |

## 4. Checks that need eyes (screenshots)

Take a screenshot (`adb exec-out screencap -p > a.png`, `xcrun simctl io <UDID> screenshot i.png`)
or open the Maestro `takeScreenshot` files, and confirm:

- Android: nothing is drawn under the status bar, and the status-bar icons are dark and readable.
- Both: the icon is small and the title sits right next to it (not pushed to the far edge).
- Both: the Scan button spans the full width.
- Both: the `zzz` error line is red.
- During a scan (Maestro `02-scanning` on Android, the `scanning` attachment of the XCUITest
  result on iOS): the button is greyed out and a spinner sits left of `Scanning…`.

To pull the iOS attachment: add `-resultBundlePath r.xcresult` to the `xcodebuild test` command,
then `xcrun xcresulttool export attachments --path r.xcresult --output-path att`.

## 5. Known pitfalls (all hit while writing this plan)

1. **Maestro on iOS cannot see the 1.5 s scanning window.** One `tapOn` takes about 4 s on iOS
   (element lookup plus settle checks), even with a point tap. That is why flow `02` checks
   `Scanning…` on Android only and the XCUITest covers it on iOS. Don't "fix" this by asserting
   faster; it is the tool, not the app.
2. **Compose hides `enabled` from Maestro.** The `Scan` text is a child `TextView` that always
   reports `enabled=true`; the clickable parent `View` has no text. `containsChild` + `enabled` did
   not match in Maestro 2.10. The flows therefore don't assert `enabled`; use the screenshot on
   Android and the XCUITest on iOS.
3. **`uiautomator dump` waits for idle**, so while the spinner animates it returns only after the
   scan. Use a screenshot right after the tap to see the scanning state.
4. **Blank first frame / ANR on a busy emulator.** A cold-booted emulator (especially with
   `hw.gpu.enabled=no`) right after `clearState` can stay blank for seconds or raise
   "isn't responding" with `Waited 5000ms for FocusEvent`. Check `adb shell cat /proc/loadavg`;
   wait until the 1-minute load is below ~5 and rerun. It is not an app bug: m01 never blocks the
   main thread (`delay` suspends).
5. **Emulator out of space** (`Requested internal only, but not enough space`): use another AVD
   rather than uninstalling the user's apps.
6. **`hideKeyboard` fails on the SwiftUI field.** The flows don't need it: the keyboard does not
   cover the Scan button.
7. **Two Android targets connected** (phone + emulator): always pass `--device` to Maestro and set
   `ANDROID_SERIAL` for `adb`, or rotation settings land on the phone.
8. **Text matching:** status text uses `…` (U+2026), never three dots. Maestro text is a full-match
   regex, so `"Scan"` does not match `Tap Scan to look for devices.`.
9. `android-rotation.sh` taps fixed coordinates for a 1080×2400 portrait screen. On another screen
   size, read the bounds from `maestro hierarchy` and edit `FIELD` / `SCAN` at the top.

## 6. Report format

```text
m01 test report · <date> · Android <AVD / API> · iOS <device / version>
Builds: Android <ok/fail> (warnings: …) · iOS <ok/fail> (warnings: …)
Maestro Android: n/4 · Maestro iOS: n/4 · XCUITest: n/3 · rotation: n/5
Visual: status bar <ok>, header <ok>, full-width button <ok>, red error <ok>, scanning state <ok>
NOT RUN: <list, with the reason>
```
