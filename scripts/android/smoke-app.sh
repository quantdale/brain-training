#!/usr/bin/env bash
# App smoke — launch the installed app, capture screenshot + hierarchy + logcat
# into a fresh qa-artifacts run directory (docs/QA_ARTIFACTS.md), and verify the
# app reaches the foreground. Emulator-local only (pure adb; no host input).
#
# Usage: scripts/android/smoke-app.sh [--wait-seconds N] [--purpose NAME]
# Requires: dedicated AVD booted, debug APK installed, Metro running (debug).

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

PURPOSE="${BT_SMOKE_PURPOSE:-app-smoke}"
WAIT_SECONDS="${BT_SMOKE_WAIT:-45}"
APP_ID="${BT_APP_ID:-com.braintraining.app}"
ACTIVITY="${BT_APP_ACTIVITY:-.MainActivity}"

RUN_ID="$(date -u +%Y%m%d-%H%M%S)-${PURPOSE}"
RUN_DIR="${BT_REPO_ROOT:-${REPO_ROOT:-$PWD}}/qa-artifacts/$RUN_ID"
mkdir -p "$RUN_DIR/screenshots" "$RUN_DIR/logcat" "$RUN_DIR/hierarchy"

bt_log "run id: $RUN_ID (dir: $RUN_DIR)"
echo "runId: $RUN_ID" > "$RUN_DIR/run-id.txt"

step() {
  local name="$1" status="$2" code="$3"
  echo "$name -> $code" >> "$RUN_DIR/exit-codes.txt"
  bt_log "step $name: $status (exit $code)"
}

# 1. App installed?
if ! bt_adb shell pm list packages | grep -q "^package:${APP_ID}$"; then
  step "installed" "FAIL" 1
  bt_log "ERROR: $APP_ID is not installed — run scripts/android/install.sh first"
  exit 1
fi
step "installed" "PASS" 0

# 2. Launch
bt_adb shell am force-stop "$APP_ID"
bt_adb shell am start -W -n "${APP_ID}/${ACTIVITY}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  step "launch" "FAIL" 1
  bt_log "ERROR: am start failed"
  exit 1
fi

# 3. Wait for foreground
FOREGROUND=""
for i in $(seq 1 "$WAIT_SECONDS"); do
  sleep 1
  FOREGROUND="$(bt_adb shell dumpsys window 2>/dev/null | grep -o "mCurrentFocus=.*" | head -1)"
  if echo "$FOREGROUND" | grep -q "${APP_ID}"; then
    break
  fi
done
if ! echo "$FOREGROUND" | grep -q "${APP_ID}"; then
  bt_adb exec-out screencap -p > "$RUN_DIR/screenshots/launch-fail-01.png" 2>/dev/null
  bt_adb logcat -d > "$RUN_DIR/logcat/logcat.txt" 2>/dev/null
  step "foreground" "FAIL" 1
  bt_log "ERROR: app did not reach foreground (last focus: $FOREGROUND)"
  exit 1
fi
step "foreground" "PASS" 0

# 4. Stable-frame wait (JS bundle load), then capture
sleep 8
bt_adb exec-out screencap -p > "$RUN_DIR/screenshots/home-01.png"
step "screenshot-home" "PASS" 0

bt_shell "$(bt_require_device)" 120 uiautomator dump /sdcard/smoke-home.xml >/dev/null 2>&1
bt_pull "$(bt_require_device)" /sdcard/smoke-home.xml "$RUN_DIR/hierarchy/home-hierarchy.xml" >/dev/null 2>&1
if [ -s "$RUN_DIR/hierarchy/home-hierarchy.xml" ]; then
  step "hierarchy-home" "PASS" 0
else
  step "hierarchy-home" "FAIL" 1
fi

bt_adb logcat -d > "$RUN_DIR/logcat/logcat.txt"
bt_adb logcat -d -v brief "*:W" > "$RUN_DIR/logcat/logcat-filtered.txt" 2>/dev/null || true
step "logcat" "PASS" 0

echo "run-dir=$RUN_DIR"
bt_log "smoke capture complete: $RUN_DIR"
exit 0
