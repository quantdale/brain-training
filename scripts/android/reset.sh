#!/usr/bin/env bash
# reset.sh — reset app data / app install / emulator state on the dedicated AVD.
#
#   scripts/android/reset.sh data          pm clear (wipe app data) — DEFAULT
#   scripts/android/reset.sh uninstall     uninstall the app
#   scripts/android/reset.sh reinstall     uninstall + reinstall latest APK
#   scripts/android/reset.sh emulator      cold-boot reset of the AVD (drop snapshots)
#   scripts/android/reset.sh full          emulator cold reset + uninstall

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

cmd_data() {
  local serial
  serial="$(bt_require_device)"
  bt_log "clearing app data for $BT_APP_ID"
  bt_shell "$serial" 60 pm clear "$BT_APP_ID" || bt_die "pm clear failed (is $BT_APP_ID installed? try 'reset.sh uninstall' + 'install.sh')"
  bt_log "app data cleared"
}

cmd_uninstall() {
  local serial
  serial="$(bt_require_device)"
  if bt_shell "$serial" 30 pm path "$BT_APP_ID" >/dev/null 2>&1; then
    bt_log "uninstalling $BT_APP_ID"
    timeout 60 "$(bt_adb_bin)" -s "$serial" uninstall "$BT_APP_ID"
  else
    bt_log "$BT_APP_ID is not installed — nothing to do"
  fi
}

cmd_reinstall() {
  cmd_uninstall
  "$DIR/install.sh" --skip-build
}

cmd_emulator() {
  "$DIR/avd.sh" reset
}

cmd_full() {
  cmd_emulator
  cmd_uninstall
}

case "${1:-data}" in
  -h|--help) usage ;;
  data) cmd_data ;;
  uninstall) cmd_uninstall ;;
  reinstall) cmd_reinstall ;;
  emulator) cmd_emulator ;;
  full) cmd_full ;;
  *) bt_die "unknown subcommand '$1' (data|uninstall|reinstall|emulator|full)" ;;
esac
