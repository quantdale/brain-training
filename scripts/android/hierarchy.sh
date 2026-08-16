#!/usr/bin/env bash
# hierarchy.sh — dump the current UI hierarchy via uiautomator and pretty-print
# it, or search it for semantic testIDs (Android: resource-id).
#
#   scripts/android/hierarchy.sh                      dump to stdout (pretty XML)
#   scripts/android/hierarchy.sh --find SUBSTRING     print matching nodes with bounds
#   scripts/android/hierarchy.sh --save FILE          write XML to qa-artifacts/FILE
#   scripts/android/hierarchy.sh --raw                no pretty-print (raw XML)
#   scripts/android/hierarchy.sh --retry N            retries on empty dump (default 2)
#
# Matching nodes are printed one per line as:
#   resource-id text content-desc class bounds
# which is the input for input.sh tap/swipe (bounds = "[x1,y1][x2,y2]").

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
}

BT_FIND=""
BT_SAVE=""
BT_RAW=0
BT_RETRY=2

while [ $# -gt 0 ]; do
  case "$1" in
    --find) BT_FIND="${2:?--find requires a value}"; shift ;;
    --save) BT_SAVE="${2:?--save requires a value}"; shift ;;
    --raw) BT_RAW=1 ;;
    --retry) BT_RETRY="${2:?--retry requires a value}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) bt_die "unknown option '$1' (see hierarchy.sh --help)" ;;
  esac
  shift
done

serial="$(bt_require_device)"

# Dump to /sdcard then pull, so we never rely on stdout framing.
dump_remote="/sdcard/bt-window-dump.xml"
dump_local="$(mktemp -t bt-hierarchy.XXXXXX.xml || mktemp)"
trap 'rm -f "$dump_local"' EXIT

attempt=0
while :; do
  attempt=$((attempt + 1))
  rm -f "$dump_local"
  if bt_shell "$serial" 120 uiautomator dump "$dump_remote" >/dev/null 2>&1 &&
     bt_pull "$serial" "$dump_remote" "$dump_local" >/dev/null 2>&1 &&
     [ -s "$dump_local" ]; then
    break
  fi
  if [ "$attempt" -ge "$BT_RETRY" ]; then
    bt_die "uiautomator dump failed after $BT_RETRY attempts.
Common causes: screen is off (try 'scripts/android/input.sh key KEYCODE_WAKEUP'),
or an animation is in progress (wait 1-2s and retry)."
  fi
  bt_warn "dump attempt $attempt failed or was empty; retrying in 1s ..."
  sleep 1
done

if [ -n "$BT_SAVE" ]; then
  bt_ensure_artifacts
  dest="$BT_ARTIFACTS_DIR/$BT_SAVE"
  cp "$dump_local" "$dest"
  bt_log "hierarchy saved to $dest"
fi

# Search mode: print matching nodes with their attributes and bounds.
if [ -n "$BT_FIND" ]; then
  if command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
    PY="$(command -v python || command -v python3)"
    "$PY" - "$dump_local" "$BT_FIND" <<'PY'
import re, sys

path, needle = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8', errors='replace').read()
attr = re.compile(r'([a-zA-Z-]+)="([^"]*)"')
for m in re.finditer(r'<node\b[^>]*/?>', xml):
    node = m.group(0)
    if needle not in node:
        continue
    d = dict(attr.findall(node))
    print(f"resource-id={d.get('resource-id','')!r} text={d.get('text','')!r} "
          f"content-desc={d.get('content-desc','')!r} class={d.get('class','')!r} "
          f"bounds={d.get('bounds','')!r}")
PY
  else
    # grep fallback: one line per <node ...> element containing the needle.
    tr '>' '\n' <"$dump_local" | grep '<node' | grep -F "$BT_FIND"
  fi
  exit 0
fi

# Print mode: pretty XML to stdout.
if [ "$BT_RAW" -eq 1 ]; then
  cat "$dump_local"
elif command -v xmllint >/dev/null 2>&1; then
  xmllint --format "$dump_local"
elif command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
  PY="$(command -v python || command -v python3)"
  "$PY" - "$dump_local" <<'PY'
import sys, xml.dom.minidom as md
print(md.parse(sys.argv[1]).toprettyxml(indent='  '))
PY
else
  bt_warn "xmllint/python not available — printing raw XML"
  cat "$dump_local"
fi
