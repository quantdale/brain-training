#!/usr/bin/env bash
# install.sh — build the debug APK (expo run:android) and install it on the AVD.
#
#   scripts/android/install.sh                 build + install (npx expo run:android)
#   scripts/android/install.sh --skip-build    install an existing APK (BT_APK_PATH or --apk)
#   scripts/android/install.sh --apk PATH      install a specific APK
#
# The full expo build may fail until the native android/ project has been
# prebuilt in an earlier wave; failures are reported as NOT VALIDATED with a
# clear message instead of a hard harness error.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$DIR/common.sh"

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

BT_SKIP_BUILD=0
BT_APK_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) BT_SKIP_BUILD=1 ;;
    --apk) BT_APK_OVERRIDE="${2:?--apk requires a path}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) bt_die "unknown option '$1' (see install.sh --help)" ;;
  esac
  shift
done

serial="$(bt_require_device)"  # clear error if AVD is not running

if [ "$BT_SKIP_BUILD" -eq 1 ] || [ -n "$BT_APK_OVERRIDE" ]; then
  apk_path="${BT_APK_OVERRIDE:-$BT_REPO_ROOT/$BT_APK_PATH}"
  if [ ! -f "$apk_path" ]; then
    bt_die "APK not found at $apk_path.
Build it first (scripts/android/install.sh) or pass --apk / set BT_APK_PATH."
  fi
  bt_log "installing $apk_path on AVD '$BT_AVD_NAME'"
  bt_adb -s "$serial" install -r "$apk_path"
else
  if [ ! -d "$BT_REPO_ROOT/apps/mobile" ]; then
    bt_die "apps/mobile not found under $BT_REPO_ROOT (expected Expo app)"
  fi
  bt_log "building debug APK and installing via 'npx expo run:android --no-bundler' (this may take several minutes on first run)"
  if ! (cd "$BT_REPO_ROOT/apps/mobile" && CI=1 npx expo run:android --no-bundler); then
    echo
    echo "[bt] NOT VALIDATED: 'npx expo run:android' failed (exit $?)."
    echo "[bt] This is expected until the native android/ project has been prebuilt"
    echo "[bt] successfully. Once it builds, retry install.sh or use --skip-build"
    echo "[bt] with a manually built APK at $BT_REPO_ROOT/$BT_APK_PATH."
    exit 2
  fi
fi

# Verify the install landed.
if bt_shell "$serial" 30 pm path "$BT_APP_ID" | grep -q "$BT_APP_ID"; then
  bt_log "INSTALLED: $BT_APP_ID is present on AVD '$BT_AVD_NAME'"
else
  bt_warn "pm path reports no package for $BT_APP_ID after install — check app.json android.package and the build output"
fi
