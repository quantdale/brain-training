#!/usr/bin/env bash
# Shared helpers for the Android automation harness (scripts/android/*).
#
# Everything in this harness is emulator-local and pure adb / emulator console —
# no host mouse, keyboard, or desktop coordinates are ever used. See
# docs/ANDROID_AUTOMATION.md for the full no-host-input workflow.

# Guard against sourcing twice.
if [ -n "${BT_COMMON_SOURCED:-}" ]; then
  return 0
fi
BT_COMMON_SOURCED=1

# --- configuration (env-overridable) ---------------------------------------

# Dedicated AVD created by avd.sh.
BT_AVD_NAME="${BT_AVD_NAME:-braintraining35}"
# Android application id (matches apps/mobile/app.json -> android.package).
BT_APP_ID="${BT_APP_ID:-com.braintraining.app}"
# Default launch activity relative to the application id.
BT_APP_ACTIVITY="${BT_APP_ACTIVITY:-.MainActivity}"
# Default debug APK produced by `npx expo run:android` (relative to repo root).
BT_APK_PATH="${BT_APK_PATH:-apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk}"
# Extra flags appended to every emulator invocation (e.g. "-memory 4096").
BT_EMULATOR_EXTRA_ARGS="${BT_EMULATOR_EXTRA_ARGS:-}"

# Repo root = parent of the scripts/ directory that contains this file.
BT_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Runtime QA artifacts (gitignored at repo root).
BT_ARTIFACTS_DIR="${BT_ARTIFACTS_DIR:-$BT_REPO_ROOT/qa-artifacts}"
BT_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# --- output helpers ----------------------------------------------------------

bt_log() { echo "[bt] $*"; }
bt_warn() { echo "[bt][WARN] $*" >&2; }
bt_die() {
  echo "[bt][ERROR] $*" >&2
  exit 1
}

# --- SDK / tool discovery ----------------------------------------------------

# Locate the Android SDK. Honors ANDROID_SDK_ROOT / ANDROID_HOME, then falls
# back to well-known install locations per OS. Sets BT_SDK.
bt_find_sdk() {
  if [ -n "${BT_SDK:-}" ] && [ -d "$BT_SDK/platform-tools" ]; then
    return 0
  fi
  local candidate
  for candidate in \
    "${ANDROID_SDK_ROOT:-}" \
    "${ANDROID_HOME:-}" \
    "${LOCALAPPDATA:-}/Android/Sdk" \
    "${USERPROFILE:-}/AppData/Local/Android/Sdk" \
    "${HOME:-}/Android/Sdk" \
    "${HOME:-}/Library/Android/sdk" \
    "/opt/android-sdk" \
    "/usr/local/share/android-sdk"; do
    if [ -n "$candidate" ] && [ -d "$candidate/platform-tools" ] && [ -d "$candidate/emulator" ]; then
      BT_SDK="$candidate"
      export BT_SDK
      return 0
    fi
  done
  return 1
}

bt_require_sdk() {
  bt_find_sdk || bt_die "Android SDK not found. Set ANDROID_SDK_ROOT to the SDK root (must contain platform-tools/ and emulator/)."
}

# Run a binary that may be a Windows .bat (cmdline-tools on Windows).
bt_run_cmdline_tool() {
  local name="$1"
  shift
  bt_require_sdk
  local bin="$BT_SDK/cmdline-tools/latest/bin"
  if [ -f "$bin/$name" ]; then
    "$bin/$name" "$@"
  elif [ -f "$bin/$name.bat" ]; then
    if command -v cygpath >/dev/null 2>&1; then
      cmd //c "$(cygpath -w "$bin/$name.bat")" "$@"
    else
      cmd //c "$bin/$name.bat" "$@"
    fi
  else
    bt_die "SDK tool '$name' not found under $bin (install Android SDK cmdline-tools: 'sdkmanager \"cmdline-tools;latest\"')."
  fi
}

# Resolve a binary that may be suffixed .exe on Windows.
bt_bin() {
  local base="$1"
  if [ -e "$base" ]; then echo "$base"
  elif [ -e "$base.exe" ]; then echo "$base.exe"
  else return 1; fi
}

bt_adb() {
  bt_require_sdk
  local adb
  adb="$(bt_bin "$BT_SDK/platform-tools/adb")" || bt_die "platform-tools/adb not found in $BT_SDK (run 'sdkmanager \"platform-tools\"')."
  "$adb" "$@"
}

# Absolute path to the adb binary. `timeout` is an external program and cannot
# exec a bash function, so any time-guarded adb call must invoke the binary
# path directly: `timeout N "$(bt_adb_bin)" -s "$serial" shell ...`.
bt_adb_bin() {
  bt_require_sdk
  local p
  p="$(bt_bin "$BT_SDK/platform-tools/adb")" || bt_die "platform-tools/adb not found in $BT_SDK (run 'sdkmanager \"platform-tools\"')."
  printf '%s' "$p"
}

# Run `adb shell <cmd>` with a hard timeout so a slow or wedged guest cannot
# block the harness forever. Kills the local client on timeout (the guest
# transport may then need `adb kill-server && adb start-server` to recover —
# see docs/ANDROID_AUTOMATION.md troubleshooting).
#
# MSYS_NO_PATHCONV=1: without it, MSYS rewrites device paths like /sdcard/x
# into Windows paths ("C:/Program Files/Git/sdcard/x") before adb sees them,
# silently breaking every command that names a guest file.
bt_shell() { # bt_shell <serial> <timeout_seconds> <cmd...>
  local serial="$1" tmo="$2"
  shift 2
  MSYS_NO_PATHCONV=1 timeout "$tmo" "$(bt_adb_bin)" -s "$serial" shell "$@"
}

# `adb pull` from a guest path: the remote path must NOT be MSYS-converted and
# the local path MUST be a Windows path for the Windows adb binary.
bt_pull() { # bt_pull <serial> <remote> <local>
  local serial="$1" remote="$2" local_path="$3"
  local local_win
  local_win="$(cygpath -w "$local_path" 2>/dev/null || printf '%s' "$local_path")"
  MSYS_NO_PATHCONV=1 timeout 60 "$(bt_adb_bin)" -s "$serial" pull "$remote" "$local_win"
}

bt_emulator() {
  bt_require_sdk
  local emu
  emu="$(bt_bin "$BT_SDK/emulator/emulator")" || bt_die "emulator/emulator not found in $BT_SDK (run 'sdkmanager \"emulator\"')."
  "$emu" "$@"
}

# --- device helpers -----------------------------------------------------------

# Print the serial of the running emulator that belongs to BT_AVD_NAME, or
# nothing if it is not running. Only this AVD's emulator is ever touched.
bt_our_serial() {
  bt_adb start-server >/dev/null 2>&1 || true
  local serial name
  while IFS= read -r serial; do
    name="$(bt_adb -s "$serial" emu avd name 2>/dev/null | head -1)"
    if [ -n "$name" ] && [ "$(printf '%s' "$name" | tr -d '\r')" = "$BT_AVD_NAME" ]; then
      echo "$serial"
      return 0
    fi
  done < <(bt_adb devices | sed -n 's/^\(emulator-[0-9]*\)[[:space:]].*/\1/p')
  return 1
}

bt_require_device() {
  local serial
  serial="$(bt_our_serial)" || bt_die "AVD '$BT_AVD_NAME' is not running. Boot it first: scripts/android/avd.sh boot"
  echo "$serial"
}

# Poll up to `timeout` seconds for our emulator to register with the adb
# server (it lags a few seconds behind process start).
bt_wait_for_device() {
  local timeout="${1:-60}"
  local waited=0 serial=""
  while [ "$waited" -lt "$timeout" ]; do
    serial="$(bt_our_serial || true)"
    if [ -n "$serial" ]; then
      echo "$serial"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

# Wait until sys.boot_completed=1 and the package manager answers.
# Cold boots (especially first boot with dexopt) can take several minutes on
# busy dev machines, so the default is generous (600 s).
# Returns 0 on success, 1 on timeout (does not exit the script — callers may
# retry).
bt_wait_for_boot() {
  local timeout="${1:-600}"
  local waited=0 serial
  serial="$(bt_wait_for_device 60)" || {
    bt_warn "AVD '$BT_AVD_NAME' did not register with adb within 60s of launch (acceleration? RAM? see docs/ANDROID_AUTOMATION.md)"
    return 1
  }
  bt_log "waiting for device $serial ..."
  bt_adb -s "$serial" wait-for-device
  local adb
  adb="$(bt_adb_bin)"
  until [ "$(timeout 20 "$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    waited=$((waited + 1))
    if [ "$waited" -ge "$timeout" ]; then
      bt_warn "Timed out after ${timeout}s waiting for sys.boot_completed on $serial (try 'scripts/android/avd.sh reset' or check docs/ANDROID_AUTOMATION.md)"
      return 1
    fi
    if [ $((waited % 30)) -eq 0 ]; then
      bt_log "still waiting for sys.boot_completed ... (${waited}s)"
    fi
    sleep 1
  done
  # Package manager may lag a few seconds behind boot_completed.
  waited=0
  until timeout 20 "$adb" -s "$serial" shell pm path android >/dev/null 2>&1; do
    waited=$((waited + 1))
    if [ "$waited" -ge 60 ]; then
      bt_warn "package manager did not answer within 60s after boot_completed; continuing anyway"
      break
    fi
    sleep 1
  done
  bt_log "device $serial is booted"
}

# --- artifacts ---------------------------------------------------------------

bt_ensure_artifacts() {
  mkdir -p "$BT_ARTIFACTS_DIR" || bt_die "cannot create artifacts dir $BT_ARTIFACTS_DIR"
}
