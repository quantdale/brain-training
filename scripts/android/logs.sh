#!/usr/bin/env bash
# logs.sh — capture logcat into qa-artifacts/.
#
#   scripts/android/logs.sh                         full buffer dump -> qa-artifacts/logcat-<ts>.log
#   scripts/android/logs.sh --filter 'RE'           only lines matching extended regex (e.g. ReactNative|AndroidRuntime)
#   scripts/android/logs.sh --tail N                last N lines of the dump
#   scripts/android/logs.sh --clear                 clear the logcat buffer before capturing
#   scripts/android/logs.sh --crash                 capture only the crash buffer
#   scripts/android/logs.sh --name FOO              output file name (default logcat-<ts>.log)

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

BT_FILTER=""
BT_TAIL=""
BT_CLEAR=0
BT_CRASH=0
BT_NAME="logcat-$BT_TIMESTAMP.log"

while [ $# -gt 0 ]; do
  case "$1" in
    --filter) BT_FILTER="${2:?--filter requires a regex}"; shift ;;
    --tail) BT_TAIL="${2:?--tail requires a value}"; shift ;;
    --clear) BT_CLEAR=1 ;;
    --crash) BT_CRASH=1 ;;
    --name) BT_NAME="${2:?--name requires a value}"; shift ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) bt_die "unknown option '$1' (see logs.sh --help)" ;;
  esac
  shift
done

serial="$(bt_require_device)"
adb_bin="$(bt_adb_bin)"
bt_ensure_artifacts
out="$BT_ARTIFACTS_DIR/$BT_NAME"

if [ "$BT_CLEAR" -eq 1 ]; then
  timeout 30 "$adb_bin" -s "$serial" logcat -c
  bt_log "logcat buffer cleared"
fi

buffers="main"
[ "$BT_CRASH" -eq 1 ] && buffers="crash"

{
  echo "# logcat capture: serial=$serial avd=$BT_AVD_NAME time=$(date -Is) buffer=$buffers filter=${BT_FILTER:-none}"
} >"$out"

if [ "$BT_CRASH" -eq 1 ]; then
  if ! timeout 60 "$adb_bin" -s "$serial" logcat -d -b crash >>"$out"; then
    bt_die "crash-buffer logcat capture failed or timed out"
  fi
else
  if ! timeout 60 "$adb_bin" -s "$serial" logcat -d >>"$out"; then
    bt_die "logcat capture failed or timed out"
  fi
fi

if [ ! -s "$out" ]; then
  bt_die "logcat capture produced an empty artifact: $out"
fi

if [ -n "$BT_TAIL" ]; then
  tmp="$out.tail"
  tail -n "$BT_TAIL" "$out" >"$tmp" && mv "$tmp" "$out"
fi

if [ -n "$BT_FILTER" ]; then
  tmp="$out.filter"
  grep -E "$BT_FILTER" "$out" >"$tmp" && mv "$tmp" "$out"
fi

lines="$(wc -l <"$out")"
bt_log "OK: $out ($lines lines)"
