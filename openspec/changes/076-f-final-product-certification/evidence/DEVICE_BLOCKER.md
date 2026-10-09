# Device blocker — 076-f (2026-10-09)

**Change:** `076-f-final-product-certification`
**Scope:** every requirement in the campaign prompt that needs an Android device:
§3 (install + device hash), §4 (42 current-device game rows), §5 (the gameplay
half of accessibility and the nine journeys), and §7.3.
**Repository state:** `main` is clean, buildable and startable. Nothing in the
product was changed by this blocker.

---

## The blocker

**The dedicated Android emulator died mid-certification and could not be
restarted. The host is out of memory, and the dead emulator is now an
unreapable zombie that blocks every new emulator launch.**

## Measured evidence

| Fact | Measurement |
| --- | --- |
| The dedicated AVD | `braintraining-ui35`, launched headless (`-no-window -no-audio -no-boot-anim -no-metrics -no-snapshot`) on `emulator-5554` |
| Failure mode | the device stopped responding: `adb shell` hung, `adb devices` reported `emulator-5554 offline`, the emulator console on TCP 5554 accepted a connection and answered nothing |
| Root cause | host memory exhaustion — free physical RAM fell to **676 MB of 32 GB** while the emulator ran |
| Aftermath | `qemu-system-x86_64-headless.exe` (PID 50120) is stuck in an uninterruptible state: 16 KB committed, 0 CPU consumed over 25 s, and `Stop-Process` / `taskkill /F` both report "There is no running instance of the task" while the process object and its TCP ports 5554/5555 remain allocated |
| Effect | every subsequent launch aborts with `ERROR \| It seems too many emulator instances are running on this machine. Aborting.` |
| Secondary effect | the zombie also holds `braintraining-ui35.avd/multiinstance.lock` and the WHPX partition, so the same AVD cannot be relaunched either |
| Current host memory | ~0.6–1.3 GB free of 32 GB; top consumers are Windows Memory Compression (≈5.8 GB), `vmmemWSL` (≈5.4 GB), and the agent toolchain (`node`, `opencode`, `aft`, `MiniMax Code`) |

## Everything that was attempted, and what it produced

| # | Attempt | Result |
| --- | --- | --- |
| 1 | `adb reconnect offline`, explicit `adb connect 127.0.0.1:5555`, restart the adb server | device never returned; the guest is not executing |
| 2 | `Stop-Process -Id 50120`, `taskkill /F /IM`, repeated after closing adb | process cannot be reaped; ports stay bound |
| 3 | kill the orphaned `crashpad_handler.exe` (PID 42188, child of the zombie) | **helped** — the "too many instances" count included it. It respawns on each failed launch and was killed again |
| 4 | clear `%TEMP%\avd\running\` of the stale `50120` instance registry (backed up) | necessary, not sufficient |
| 5 | move all 14 stale `multiinstance.lock` files and all `hardware-qemu.ini.lock` directories to `_stale-lock-backups` (the zombie's own lock left in place) | necessary, not sufficient |
| 6 | launch `braintraining-ui35b` (identical android-35 google_apis x86_64 system image, 2048 MB) with default and explicit ports | same abort |
| 7 | copy `braintraining-ui35.avd` → `braintraining-ui35-r1.avd` to escape the zombie's lock | aborted — 601 s for 88 MB of 2.6 GB; the host cannot sustain the copy |
| 8 | `-read-only` (the emulator's own suggested workaround) | same abort |
| 9 | `-accel off` / `-accel tcg` / `-memory 1024` / `-memory 1536` | same abort, or silent death at VM allocation |
| 10 | explicit free port `-port 5570` | got furthest — the VM started and the emulator tried `adb -s emulator-5570 shell settings put …`, i.e. the guest was alive, but adb never attached and the emulator then exited |

The remaining recovery options all require host-level action outside the
campaign's authority and would disrupt the user's environment:

- reboot the host (would terminate the user's running desktop session);
- `wsl --shutdown` (≈5.4 GB) — would terminate the user's WSL distributions;
- disable/re-enable the Windows Hypervisor Platform — invasive and host-wide.

None was taken. `braintraining-ui35.avd` and every other AVD's data are intact;
only transient `*.lock` files were moved to
`~/.android/avd/_stale-lock-backups/`, and the stale
`%TEMP%\avd\running\50120` entry to `%TEMP%\avd\_stale-running-backup-20261009/`.

## Exact recovery steps for a resuming session

1. **Reboot the host**, or otherwise terminate PID 50120 so ports 5554/5555 and
   the WHPX partition are released. This is the only blocker that a session
   cannot fix itself.
2. Confirm the lock/registry state is clean:
   - `~/.android/avd/*/multiinstance.lock` should not exist for the AVD being
     launched;
   - `%TEMP%\avd\running\` should be empty;
   - no `crashpad_handler.exe` should be running.
3. Launch the dedicated AVD headless:
   `emulator -avd braintraining-ui35 -no-window -no-audio -no-boot-anim -no-metrics -no-snapshot`
4. Verify with `adb wait-for-device && adb shell getprop sys.boot_completed`
   returning `1`.
5. Resume the campaign prompt at **§3** (install + device hash), then §4, §5.

## What was still established without the device

| Gate | Result |
| --- | --- |
| §2 evidence reconciliation (the prompt's first obligation) | **DONE** — ledgers corrected, provenance generator fixed, spec extended, all documents reconciled to one identity |
| §6.1 clean-checkout composite alignment | **DONE** — the composite now runs the declared hermetic Expo gate; self-test 10 → 14 checks |
| §6.2 full clean-checkout composite from a disposable checkout, no skip flags | **PASS 20/20 at `690fb22`**, checkout removed |
| §6.3 strict OpenSpec | **PASS 61/61** |
| §6.4 release APK build | **BUILD SUCCESSFUL**, `e243341f…`, 48,888,452 B — exact reproducibility match |
| §6.5 Jest totals | **622 passed / 4 skipped suites, 7,241 passed / 5 skipped tests, 5 snapshots** — the 621 / 7,237 baseline did not drop |
| §6.6 provenance regeneration | **DONE** — 302 rows, 194 `SOURCE_NOT_EQUIVALENT`, 92 `SOURCE_EQUIVALENT_HISTORICAL` with `currentApplicability: false`, 0 rows usable as terminal-APK evidence |

## Recheck — still blocked

A later session rechecked the host without rebooting it and without running
`wsl --shutdown`. `taskkill /F /PID 50120` again returned "There is no running
instance of the task" while `Get-Process -Id 50120` still returned
`qemu-system-x86_64-headless`. `adb devices` still listed `emulator-5554` as
`offline`. No new emulator was launched. The device lane is unchanged.

## Verdict

Unchanged and still correct:
**`CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`**. Game acceptance, the nine
journeys and the gameplay half of accessibility are repository-owned
requirements with no proof, and the change spec is explicit that missing game
proof forbids the repository-complete verdict regardless of what else is green.
