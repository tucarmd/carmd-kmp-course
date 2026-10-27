#!/usr/bin/env bash
# m01 · Android rotation check (lesson 06, section 6).
#   1. Result on screen + rotate  -> filter "sens" and "Devices found: 1" survive.
#   2. Rotate during a scan        -> "Tap Scan to look for devices." (scan cancelled), filter kept.
# Usage: ANDROID_SERIAL=emulator-5554 ./android-rotation.sh
# Tap coordinates are for a 1080x2400 portrait screen (Pixel 8 class); adjust for other sizes.
set -euo pipefail
PKG=com.example.devicemonitor
FIELD="540 374"; SCAN="540 554"

texts() { sleep "$1"; adb exec-out uiautomator dump /dev/tty 2>/dev/null | grep -o 'text="[^"]*"' | grep -v 'text=""' | grep -v -E 'text="[0-9]+:[0-9]+' | tr '\n' ' '; echo; }
expect() { if grep -q -- "$2" <<<"$1"; then echo "PASS  $3"; else echo "FAIL  $3"; echo "      saw: $1"; FAILED=1; fi; }
restore() { adb shell settings put system user_rotation 0; adb shell settings put system accelerometer_rotation 1; }
trap restore EXIT
FAILED=0

adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0
adb shell am force-stop $PKG
adb shell am start -n $PKG/$PKG.android.MainActivity >/dev/null
sleep 4
adb shell input tap $FIELD; adb shell input text sens
adb shell input tap $SCAN
before=$(texts 3)
expect "$before" 'Devices found: 1' "portrait: filter sens -> Devices found: 1"

adb shell settings put system user_rotation 1
after=$(texts 3)
expect "$after" 'text="sens"' "landscape: filter text survives rotation"
expect "$after" 'Devices found: 1' "landscape: result survives rotation"

adb shell settings put system user_rotation 0
sleep 3
adb shell input tap $SCAN
sleep 0.4
adb shell settings put system user_rotation 1
mid=$(texts 4)
expect "$mid" 'Tap Scan to look for devices.' "rotate during scan: scan cancelled, back to idle text"
expect "$mid" 'text="sens"' "rotate during scan: filter text kept"
restore; trap - EXIT
exit $FAILED
