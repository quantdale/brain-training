#!/usr/bin/env bash
# screenshot.sh — capture the AVD framebuffer into qa-artifacts/.
#
#   scripts/android/screenshot.sh                save qa-artifacts/screen-<ts>.png
#   scripts/android/screenshot.sh --name FOO     save qa-artifacts/FOO.png
#   scripts/android/screenshot.sh --dir DIR      override output directory
#
# Uses `adb exec-out screencap -p` (binary-safe, unlike `adb shell`).

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

BT_NAME=""
BT_DIR="$BT_ARTIFACTS_DIR"

while [ $# -gt 0 ]; do
  case "$1" in
    --name) BT_NAME="${2:?--name requires a value}"; shift ;;
    --dir) BT_DIR="${2:?--dir requires a value}"; shift ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) bt_die "unknown option '$1' (see screenshot.sh --help)" ;;
  esac
  shift
done

serial="$(bt_require_device)"
bt_ensure_artifacts
mkdir -p "$BT_DIR"

if [ -n "$BT_NAME" ]; then
  case "$BT_NAME" in
    *.png) out="$BT_DIR/$BT_NAME" ;;
    *) out="$BT_DIR/$BT_NAME.png" ;;
  esac
else
  out="$BT_DIR/screen-$BT_TIMESTAMP.png"
fi

bt_log "capturing screenshot to $out"
bt_adb -s "$serial" exec-out screencap -p >"$out"

# Sanity-check the PNG magic bytes; a 0-byte or non-PNG result usually means
# the framebuffer was unavailable (still booting / display off).
if [ ! -s "$out" ]; then
  bt_die "screencap produced an empty file (is the display on? try 'input.sh key KEYCODE_WAKEUP')"
fi
magic="$(head -c 8 "$out" | od -An -tx1 | tr -d ' \n')"
case "$magic" in
  89504e470d0a1a0a) bt_log "OK: $out ($(wc -c <"$out") bytes, valid PNG)" ;;
  *)
    bt_warn "output does not start with the PNG signature (got $magic) — screenshot may be corrupt"
    exit 1
    ;;
esac
