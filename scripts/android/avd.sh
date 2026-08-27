#!/usr/bin/env bash
# avd.sh — create / boot / manage the dedicated headless Android AVD.
#
#   scripts/android/avd.sh create            create AVD if missing (API 35 x86_64)
#   scripts/android/avd.sh boot              boot headless + wait for sys.boot_completed
#   scripts/android/avd.sh wait              wait for boot (device must be running)
#   scripts/android/avd.sh status            print running state of our AVD
#   scripts/android/avd.sh stop              kill the emulator
#   scripts/android/avd.sh reset             cold-boot reset (kill, drop snapshot, boot, wait)
#   scripts/android/avd.sh snapshot-save N   save a quickboot snapshot via emulator console
#   scripts/android/avd.sh snapshot-load N   load a quickboot snapshot
#   scripts/android/avd.sh snapshot-list     list quickboot snapshots
#   scripts/android/avd.sh snapshot-delete N delete a quickboot snapshot
#
# Boot options: --no-snapshot (deterministic cold boot), --wipe-data.
# Default: quickboot (emulator resumes the last snapshot when available) —
# on this host a cold google_apis boot is unstable, snapshot resume is not.
# With no subcommand, runs: create + boot + wait.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  echo
  echo "Options:"
  echo "  --no-snapshot  deterministic cold boot (no quickboot resume)"
  echo "  --wipe-data    wipe userdata before booting"
  echo "  --no-wait      boot without waiting for sys.boot_completed"
  echo "  --retry N      retry boot up to N times if the emulator crashes (default 1)"
}

bt_avd_exists() {
  # Fast path: check AVD directory directly (avoids slow emulator -list-avds and CRLF issues in WSL)
  if [ -d "$HOME/.android/avd/$BT_AVD_NAME.avd" ] || [ -d "/mnt/c/Users/palac/.android/avd/$BT_AVD_NAME.avd" ] || [ -d "C:/Users/palac/.android/avd/$BT_AVD_NAME.avd" ]; then
    return 0
  fi
  bt_emulator -list-avds 2>/dev/null | tr -d '\r' | grep -qx "$BT_AVD_NAME"
}

# Pick the system image: prefer the lightweight aosp_atd (headless test
# device), fall back to google_apis. Both are API 35 x86_64.
bt_pick_image() {
  local sysimg="$BT_SDK/system-images/android-35"
  if [ -d "$sysimg/aosp_atd/x86_64" ]; then
    echo "system-images;android-35;aosp_atd;x86_64"
  elif [ -d "$sysimg/google_apis/x86_64" ]; then
    echo "system-images;android-35;google_apis;x86_64"
  else
    return 1
  fi
}

cmd_create() {
  bt_require_sdk
  if bt_avd_exists; then
    bt_log "AVD '$BT_AVD_NAME' already exists"
    return 0
  fi
  local image
  image="$(bt_pick_image)" || {
    bt_die "No API 35 x86_64 system image installed under $BT_SDK/system-images/android-35.
Install one first (aosp_atd is preferred for headless automation):
  scripts/android/avd.sh sdk-install-image"
  }
  bt_log "creating AVD '$BT_AVD_NAME' from image $image (device: pixel_7)"
  # "no" answers avdmanager's "create a custom hardware profile?" prompt.
  if ! printf 'no\n' | bt_run_cmdline_tool avdmanager create avd -n "$BT_AVD_NAME" -k "$image" -d pixel_7 --force; then
    bt_die "avdmanager failed to create AVD '$BT_AVD_NAME' (see output above)"
  fi
  bt_log "AVD '$BT_AVD_NAME' created. Boot it with: scripts/android/avd.sh boot"
}

# Headless flags applied to every boot. --no-window keeps the emulator off the
# host desktop; swiftshader_indirect renders in software (no host GPU needed).
#
# `-feature -Wifi` disables the netsim WiFi daemon: on this host, emulator
# 37.1.x + WHPX, the netsim WiFi channel ("Netsim Wifi ... gone due to
# CANCELLED") intermittently segfaults the emulator with both aosp_atd and
# google_apis images. The app is offline-first, so emulator WiFi is never
# needed. Set BT_EMULATOR_NO_WIFI=0 to re-enable.
bt_boot_flags() {
  local flags=(-no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-metrics)
  if [ "${BT_EMULATOR_NO_WIFI:-1}" = "1" ]; then
    flags+=(-feature -Wifi)
  fi
  printf '%s\n' "${flags[@]}"
}

cmd_boot() {
  bt_require_sdk
  local wait=1 snapshot=1 wipe=0 retry=1
  while [ $# -gt 0 ]; do
    case "$1" in
      --no-snapshot) snapshot=0 ;;
      --wipe-data) wipe=1 ;;
      --no-wait) wait=0 ;;
      --retry) retry="${2:?--retry requires a number}"; shift ;;
      *) bt_die "unknown boot option: $1 (see avd.sh --help)" ;;
    esac
    shift
  done

  if [ "$(bt_our_serial)" ]; then
    bt_log "AVD '$BT_AVD_NAME' is already running ($(bt_our_serial))"
    [ "$wait" -eq 1 ] && bt_wait_for_boot
    return 0
  fi

  # Fast path: if AVD directory exists, skip cmd_create (which would otherwise
  # try to run avdmanager and may hang on WSL path handling). The directory
  # existence is sufficient proof that the AVD was created.
  if [ -d "$HOME/.android/avd/$BT_AVD_NAME.avd" ] || [ -d "/mnt/c/Users/palac/.android/avd/$BT_AVD_NAME.avd" ]; then
    bt_log "AVD '$BT_AVD_NAME' already exists (directory check)"
  else
    cmd_create
  fi
  local attempt=1
  while :; do
    local flags
    # bt_boot_flags prints one flag per line; read them into an array.
    mapfile -t flags < <(bt_boot_flags)
    [ "$snapshot" -eq 0 ] && flags+=(-no-snapshot)
    [ "$wipe" -eq 1 ] && flags+=(-wipe-data)
    if [ -n "$BT_EMULATOR_EXTRA_ARGS" ]; then
      # shellcheck disable=SC2206
      flags+=($BT_EMULATOR_EXTRA_ARGS)
    fi

    bt_log "booting '$BT_AVD_NAME' headless (attempt $attempt): emulator ${flags[*]}"
    # Launch detached so the harness process does not block on emulator stdout.
    # NOTE: ephemeral shells (CI, agent tool shells) may reap background
    # children — keep the emulator as a persistent background process there and
    # use `avd.sh wait` (see docs/ANDROID_AUTOMATION.md).
    nohup bt_emulator -avd "$BT_AVD_NAME" "${flags[@]}" >/dev/null 2>&1 &
    disown || true

    if [ "$wait" -eq 1 ]; then
      # bt_wait_for_boot exits non-zero if the emulator crashes or never
      # reaches sys.boot_completed; retry a few times before giving up.
      if bt_wait_for_boot 600; then
        bt_log "AVD '$BT_AVD_NAME' is up (sys.boot_completed=1)"
        return 0
      fi
      attempt=$((attempt + 1))
      if [ "$attempt" -gt "$retry" ]; then
        bt_die "AVD '$BT_AVD_NAME' failed to boot after $retry attempt(s). Known on this host: emulator 37.1.x intermittently segfaults; free RAM (guest needs ~2.5 GB) and retry (avd.sh boot --retry 3)."
      fi
      bt_warn "boot attempt $((attempt - 1)) failed; stopping emulator and retrying ..."
      cmd_stop
      sleep 3
    else
      bt_log "emulator launched; use 'scripts/android/avd.sh wait' to wait for boot"
      return 0
    fi
  done
}

cmd_wait() {
  local serial
  serial="$(bt_require_device)"
  bt_wait_for_boot 600
  bt_log "AVD '$BT_AVD_NAME' ($serial) is booted"
}

cmd_status() {
  local serial
  serial="$(bt_our_serial || true)"
  if [ -n "$serial" ]; then
    local boot
    boot="$(bt_adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    echo "RUNNING  serial=$serial boot_completed=${boot:-unknown}"
  else
    echo "STOPPED  avd=$BT_AVD_NAME"
  fi
}

cmd_stop() {
  local serial any=0
  serial="$(bt_our_serial || true)"
  if [ -n "$serial" ]; then
    bt_log "stopping $serial"
    bt_adb -s "$serial" emu kill || true
    any=1
  fi
  # Wait for the process to actually exit.
  local waited=0
  while [ -n "$(bt_our_serial || true)" ] && [ "$waited" -lt 30 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  [ "$any" -eq 1 ] && bt_log "emulator stopped" || bt_log "no running emulator for '$BT_AVD_NAME'"
}

cmd_reset() {
  cmd_stop
  # Drop any quickboot snapshot files so the next boot is a deterministic cold
  # boot. The AVD itself is never deleted.
  local snapdir="$HOME/.android/avd/$BT_AVD_NAME.avd/snapshots"
  if [ -d "$snapdir" ]; then
    bt_log "removing snapshots under $snapdir"
    rm -rf "$snapdir"
  fi
  cmd_boot --no-wait
  bt_wait_for_boot
  bt_log "AVD '$BT_AVD_NAME' cold-boot reset complete"
}

# Emulator-console snapshot commands (all pure adb, no host interaction).
cmd_snapshot_save() {
  [ $# -eq 1 ] || bt_die "usage: avd.sh snapshot-save <name>"
  local serial
  serial="$(bt_require_device)"
  bt_adb -s "$serial" emu avd snapshot save "$1"
  bt_log "snapshot '$1' saved"
}

cmd_snapshot_load() {
  [ $# -eq 1 ] || bt_die "usage: avd.sh snapshot-load <name>"
  local serial
  serial="$(bt_require_device)"
  bt_adb -s "$serial" emu avd snapshot load "$1"
  bt_log "snapshot '$1' load requested; re-run 'scripts/android/avd.sh wait' after reboot"
}

cmd_snapshot_list() {
  local serial
  serial="$(bt_require_device)"
  bt_adb -s "$serial" emu avd snapshot list
}

cmd_snapshot_delete() {
  [ $# -eq 1 ] || bt_die "usage: avd.sh snapshot-delete <name>"
  local serial
  serial="$(bt_require_device)"
  bt_adb -s "$serial" emu avd snapshot delete "$1"
  bt_log "snapshot '$1' deleted"
}

# Install the API 35 aosp_atd image (documented fallback when missing).
cmd_sdk_install_image() {
  bt_require_sdk
  bt_log "installing system image 'system-images;android-35;aosp_atd;x86_64' (this downloads ~1GB)"
  bt_run_cmdline_tool sdkmanager "system-images;android-35;aosp_atd;x86_64"
  bt_log "done; re-run: scripts/android/avd.sh create"
}

case "${1:-}" in
  -h|--help) usage ;;
  create) shift; cmd_create ;;
  boot) shift; cmd_boot "$@" ;;
  wait) shift; cmd_wait ;;
  status) shift; cmd_status ;;
  stop) shift; cmd_stop ;;
  reset) shift; cmd_reset ;;
  snapshot-save) shift; cmd_snapshot_save "$@" ;;
  snapshot-load) shift; cmd_snapshot_load "$@" ;;
  snapshot-list) shift; cmd_snapshot_list ;;
  snapshot-delete) shift; cmd_snapshot_delete "$@" ;;
  sdk-install-image) shift; cmd_sdk_install_image ;;
  "") cmd_boot --no-wait; bt_wait_for_boot ;;
  *) bt_die "unknown subcommand '$1' (try 'avd.sh --help')" ;;
esac
