# Campaign 064 — APK permission gate (deny-by-default)

**Change:** `064-dependency-security-validation-gates`
**Files:** `scripts/android/expected-apk-permissions.txt`,
`.github/workflows/android-build-smoke.yml`.

## Before

The Android build smoke step asserted only two *blocked* permissions:

```bash
grep -q 'android.permission.RECORD_AUDIO'      # fail if present
grep -q 'android.permission.SYSTEM_ALERT_WINDOW' # fail if present
```

Any other newly merged permission (via an Expo plugin, dependency, or
manifest edit) shipped silently.

## After

The step keeps the two blocked-permission assertions and adds a
deny-by-default comparison: the `uses-permission:` names extracted from
`aapt2 dump permissions` (sorted, comments/blank lines stripped from the
expected file) must equal the committed expected set exactly. Additions
and removals both fail until the file is reviewed and updated in the
same change.

Expected set (8 entries, matching the Campaign 063 certified artifact
`20e28c64…`, 109,598,957 bytes, built from `e627473`):

```
android.permission.ACCESS_NETWORK_STATE
android.permission.INTERNET
android.permission.MODIFY_AUDIO_SETTINGS
android.permission.READ_EXTERNAL_STORAGE
android.permission.VIBRATE
android.permission.WAKE_LOCK
android.permission.WRITE_EXTERNAL_STORAGE
com.braintraining.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

The 063 artifact is debug-signed local release; the expected set is
about the merged manifest, not signing. RECORD_AUDIO and
SYSTEM_ALERT_WINDOW are explicitly blocked in `app.json` and must never
appear.

## Local verification (2026-09-21)

Ran the same comparison logic against the 063 APK with build-tools
35.0.0 `aapt2`:

```
PERMISSION_SET_MATCH (8 permissions)
```

Raw `aapt2 dump permissions` output (7 platform permissions; the
dynamic-receiver permission is app-generated):

```
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.MODIFY_AUDIO_SETTINGS'
uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.VIBRATE'
uses-permission: name='android.permission.WRITE_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.ACCESS_NETWORK_STATE'
uses-permission: name='android.permission.WAKE_LOCK'
permission: com.braintraining.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
uses-permission: name='com.braintraining.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
```

## Boundaries

The workflow still builds `x86_64` only (hosted-runner cost). A
per-ABI device matrix is runtime-certification scope, not a static
permission gate; recorded as a 064 non-goal.
