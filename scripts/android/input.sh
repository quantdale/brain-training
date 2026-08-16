#!/usr/bin/env bash
# input.sh — emulator-local input injection via `adb shell input`.
# No host mouse/keyboard is ever used; coordinates come from uiautomator
# hierarchy dumps (see hierarchy.sh).
#
#   scripts/android/input.sh tap X Y
#   scripts/android/input.sh swipe X1 Y1 X2 Y2 [DURATION_MS]
#   scripts/android/input.sh text "STRING"          (note: spaces/& need quotes)
#   scripts/android/input.sh key KEYCODE [KEYCODE...]   e.g. BACK HOME ENTER 4
#   scripts/android/input.sh shell <raw input args>     passthrough to `input`
#
# Tip: get tap coordinates from a node's bounds attribute:
#   scripts/android/hierarchy.sh --find "my-test-id"

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

[ $# -ge 1 ] || { usage; exit 1; }

case "$1" in
  -h|--help) usage; exit 0 ;;
esac

serial="$(bt_require_device)"
sub="${1:?usage: input.sh tap|swipe|text|key|shell ...}"
shift

case "$sub" in
  tap)
    [ $# -eq 2 ] || bt_die "usage: input.sh tap X Y"
    bt_log "tap $1 $2"
    bt_shell "$serial" 30 input tap "$1" "$2"
    ;;
  swipe)
    [ $# -eq 4 ] || [ $# -eq 5 ] || bt_die "usage: input.sh swipe X1 Y1 X2 Y2 [DURATION_MS]"
    bt_log "swipe $*"
    bt_shell "$serial" 30 input swipe "$@"
    ;;
  text)
    [ $# -eq 1 ] || bt_die "usage: input.sh text \"STRING\" (quote the string)"
    bt_log "text \"$1\""
    # %s is the safe format for `input text` on modern Android (spaces ok).
    bt_shell "$serial" 30 input text "%s" "$1"
    ;;
  key)
    [ $# -ge 1 ] || bt_die "usage: input.sh key KEYCODE [KEYCODE...]"
    bt_log "key $*"
    bt_shell "$serial" 30 input keyevent "$@"
    ;;
  shell)
    [ $# -ge 1 ] || bt_die "usage: input.sh shell <raw input args>"
    bt_log "input $*"
    bt_shell "$serial" 30 input "$@"
    ;;
  -h|--help) usage ;;
  *) bt_die "unknown input type '$sub' (tap|swipe|text|key|shell)" ;;
esac
