#!/usr/bin/env bash
# m02 · Android checks that Maestro can't do (lesson 07, sections 5 and 6).
#   A. Rotation: results + filter survive; rotating during a scan returns to the idle text.
#   B. Fast double tap on the detail's Back (two parallel adb taps): list shows, a row still opens.
#   C. Fast double tap on a row: one detail screen, no crash.
# Usage: ANDROID_SERIAL=emulator-5554 ./android-checks.sh
# Tap coordinates are for a 1080x2400 portrait screen (Pixel 8 class); adjust for other sizes
# from `adb exec-out uiautomator dump /dev/tty`.
set -euo pipefail
PKG=com.example.devicemonitor
FIELD="540 374"; SCAN="540 553"; ROW1="540 837"; ROW3="540 1221"; BACK="540 828"

texts() { sleep "$1"; adb exec-out uiautomator dump /dev/tty 2>/dev/null | grep -o 'text="[^"]*"' | grep -v 'text=""' | grep -v -E 'text="[0-9]+:[0-9]+' | tr '\n' ' '; echo; }
expect() { if grep -q -- "$2" <<<"$1"; then echo "PASS  $3"; else echo "FAIL  $3"; echo "      saw: $1"; FAILED=1; fi; }
expect_not() { if grep -q -- "$2" <<<"$1"; then echo "FAIL  $3"; echo "      saw: $1"; FAILED=1; else echo "PASS  $3"; fi; }
tap2() { adb shell input tap $1 & adb shell input tap $1 & wait; }
crashed() { adb logcat -d -b crash | grep -q "$PKG"; }
restore() { adb shell settings put system user_rotation 0; adb shell settings put system accelerometer_rotation 1; }
trap restore EXIT
FAILED=0

start() {
  adb shell am force-stop $PKG
  adb shell am start -n $PKG/$PKG.android.MainActivity >/dev/null
  sleep 4
}

adb logcat -c -b crash
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0

echo "== A. rotation"
start
adb shell input tap $FIELD; adb shell input text sens
adb shell input tap $SCAN
s=$(texts 3)
expect "$s" 'Tire Pressure Sensor' "portrait: filter sens -> one row"
adb shell settings put system user_rotation 1
s=$(texts 3)
expect "$s" 'text="sens"' "landscape: filter survives rotation"
expect "$s" 'Devices found: 1' "landscape: status survives rotation"
expect "$s" 'Tire Pressure Sensor' "landscape: row survives rotation"
adb shell settings put system user_rotation 0
sleep 3
adb shell input tap $SCAN
sleep 0.4
adb shell settings put system user_rotation 1
s=$(texts 4)
expect "$s" 'Tap Scan to look for devices.' "rotate during scan: back to idle text"
expect "$s" 'text="sens"' "rotate during scan: filter kept"
adb shell settings put system user_rotation 0
sleep 3

echo "== B. double tap on the detail's Back"
start
adb shell input tap $SCAN
sleep 3
adb shell input tap $ROW1
s=$(texts 2)
expect "$s" 'ID: C4:7C:8D:6A:01:10' "row opens the detail"
tap2 "$BACK"
s=$(texts 2)
expect "$s" 'Devices found: 5' "after double Back: list shows (not blank)"
expect "$s" 'OBD-II Adapter' "after double Back: rows still there"
adb shell input tap $ROW3
s=$(texts 2)
expect "$s" 'ID: C4:7C:8D:6A:01:12' "after double Back: a row still opens"
if crashed; then echo "FAIL  no crash after double Back"; FAILED=1; else echo "PASS  no crash after double Back"; fi

echo "== C. double tap on a row"
adb shell input tap $BACK
sleep 2
tap2 "$ROW1"
s=$(texts 2)
expect "$s" 'ID: C4:7C:8D:6A:01:10' "double row tap: detail shows"
adb shell input tap $BACK
s=$(texts 2)
expect "$s" 'Devices found: 5' "one Back returns to the list (only one detail was pushed)"
if crashed; then echo "FAIL  no crash after double row tap"; FAILED=1; else echo "PASS  no crash after double row tap"; fi
expect "$(adb shell pidof $PKG)" '[0-9]' "app process still alive"

restore; trap - EXIT
exit $FAILED
