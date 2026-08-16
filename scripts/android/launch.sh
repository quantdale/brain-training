#!/usr/bin/env bash
# launch.sh — launch the app on the AVD via `am start` and wait for foreground.
#
#   scripts/android/launch.sh                     start $BT_APP_ID/.MainActivity, wait for focus
#   scripts/android/launch.sh --no-wait           start without waiting for foreground
#   scripts/android/launch.sh --package P         override app id
#   scripts/android/launch.sh --activity A        override activity (default .MainActivity)
#   scripts/android/launch.sh --component C       full component (overrides package/activity)
#   scripts/android/launch.sh --timeout SECONDS   foreground wait timeout (default 60)
#   scripts/android/launch.sh --args '...'        extra `am start` args (e.g. "--windowingMode 1")

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

BT_PACKAGE="$BT_APP_ID"
BT_ACTIVITY="$BT_APP_ACTIVITY"
BT_COMPONENT=""
BT_WAIT=1
BT_TIMEOUT=60
BT_EXTRA_ARGS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-wait) BT_WAIT=0 ;;
    --package) BT_PACKAGE="${2:?--package requires a value}"; shift ;;
    --activity) BT_ACTIVITY="${2:?--activity requires a value}"; shift ;;
    --component) BT_COMPONENT="${2:?--component requires a value}"; shift ;;
    --timeout) BT_TIMEOUT="${2:?--timeout requires a value}"; shift ;;
    --args) BT_EXTRA_ARGS="${2:?--args requires a value}"; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) bt_die "unknown option '$1' (see launch.sh --help)" ;;
  esac
  shift
done

serial="$(bt_require_device)"

if [ -n "$BT_COMPONENT" ]; then
  component="$BT_COMPONENT"
else
  component="$BT_PACKAGE/$BT_ACTIVITY"
fi

bt_log "starting $component on $serial"
# -W waits for the activity to be fully launched; --activity-clear-top keeps
# repeated launches idempotent.
if ! bt_adb -s "$serial" shell am start -W --activity-clear-top -n "$component" $BT_EXTRA_ARGS; then
  bt_die "am start failed for $component. Is the app installed? (scripts/android/install.sh)"
fi

if [ "$BT_WAIT" -eq 0 ]; then
  exit 0
fi

# Wait for the component to own the foreground focus (pure adb, no host input).
bt_log "waiting for $BT_PACKAGE to reach the foreground (timeout ${BT_TIMEOUT}s)"
waited=0
focus=""
while [ "$waited" -lt "$BT_TIMEOUT" ]; do
  focus="$(
    bt_shell "$serial" 30 dumpsys window 2>/dev/null |
      grep -m1 'mCurrentFocus' || true
  )"
  if printf '%s' "$focus" | grep -q "$BT_PACKAGE"; then
    bt_log "FOREGROUND: $(printf '%s' "$focus" | tr -d '\r')"
    exit 0
  fi
  # Fallback probe: resolved activity.
  resolved="$(
    bt_shell "$serial" 30 dumpsys activity activities 2>/dev/null |
      grep -m1 'ResumedActivity' || true
  )"
  if printf '%s' "$resolved" | grep -q "$BT_PACKAGE"; then
    bt_log "FOREGROUND: $(printf '%s' "$resolved" | tr -d '\r')"
    exit 0
  fi
  sleep 1
  waited=$((waited + 1))
done

bt_warn "app did not reach the foreground within ${BT_TIMEOUT}s.
Last focus: $(printf '%s' "$focus" | tr -d '\r')
If this is a debug build, Metro must be running (npx expo start) or the app
waits on the bundler. Logs: scripts/android/logs.sh --filter ReactNative|AndroidRuntime"
exit 3
