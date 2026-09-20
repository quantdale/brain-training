# Campaign 063 — Release Artifact Identity

**Source checkpoint:** `e627473` (post-056–062 tree; working tree clean at
build time — only untracked docs/agent tooling present, none bundled).
**Build:** `:app:assembleRelease --no-daemon`, `BUILD SUCCESSFUL` in
3m39s (60 executed / 471 up-to-date; toolchain warnings only:
cross-volume hard-link fallbacks, CMake object-path length advisories,
SDK-XML version notice — none fatal).

- File: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
  (NOT committed to Git — build output).
- SHA-256: `20e28c64ee1ad75a28286fe1bfee1b9af7032ccab849911b776af296c50a1da2`
- Size: 109,598,957 bytes.
- Package: `com.braintraining.app`, version 0.1.0 (`app.json`).
- Signing: local debug-signed release (NOT a store artifact — store
  signing remains MANUAL per program).
- Metro independence: installed and launched with no bundler running on
  the host; all launches below are Metro-free.
- Runtime: dedicated `braintraining-ui35` / `emulator-5554` only.
