# Device recovery — 2026-10-10

**Change:** `076-f-final-product-certification`
**Scope:** the Phase 1 / Phase 2 obligations of the post-reboot recovery prompt.

## The premise of the prompt was not met — and it did not matter

The recovery prompt opens by stating that "the Windows host has been restarted to
recover the unreapable Android emulator process and release its WHPX resources."
**Measured: the host was not restarted.**

| Fact | Measurement |
| --- | --- |
| Last boot | `Thursday, October 8, 2026 3:20:38 AM` (continuous uptime into Oct 10) |
| Zombie PID 50120 | `qemu-system-x86_64-headless.exe -avd braintraining-ui35 -no-window …` — **still present** |
| Ports | 5554/5555 still `LISTENING` on PID 50120 |
| `taskkill /F /PID 50120` | `ERROR: There is no running instance of the task.` — and the object survives |
| WMI `Win32_Process.Terminate` | returns `0` (success) and the process survives with 1571 handles, 1 thread |
| `Stop-Process -Id 50120 -Force` | `Cannot find a process with the process identifier 50120` |

So the prompt's stated precondition was false. The campaign still advanced,
because the assumption *behind* it — "the WHPX partition is unavailable" — turned
out to be false too.

## What actually unblocked the device lane

`DEVICE_BLOCKER.md` records ten attempted launchers, every one of which aborted.
The reason all of them aborted was not the hypervisor: **those launches used
default ports, and ports 5554/5555 were still owned by the zombie.** The emulator
aborts on port collision, not on VM allocation.

Launching the same AVD on a **fresh port** allocates a new VM, and the guest
boots:

```
emulator -avd braintraining-ui35 -port 5570 -no-window -no-audio \
  -no-boot-anim -no-metrics -no-snapshot -feature -Wifi
```

```
WHPX on Windows 10.0.26300 detected.
Windows Hypervisor Platform accelerator is operational
Boot completed in 30018 ms
```

`adb connect localhost:5570` → `emulator-5570 device`. The device resolves to the
right AVD (`emu avd name` → `braintraining-ui35`), so `scripts/android/*` work
unchanged.

| Check | Result |
| --- | --- |
| Device serial | `emulator-5570` (product `sdk_gphone64_x86_64`, device `emu64xa`) |
| Android / SDK | 15 / 35 |
| `sys.boot_completed` | `1` |
| Install capability | `Success` |
| Accessibility hierarchy | 110 nodes on Home, real text |
| Screenshots | working |
| Foreground/background | verified |
| Stability soak | app survives repeated force-stop / cold launch, no ANRs |

**Free RAM at launch was ~1.4 GB of 32 GB**, against the prompt's ≥6 GB target.
The device works but the host stays memory-constrained, which is the single most
important constraint on the remaining campaign: every `uiautomator dump` takes
2–11 s, and a round timer is 9–12 s, so a live game round can never be observed
by dumping.

## Phase 2 — terminal APK install and device hash

`apps/mobile` has **not** changed since terminal source `b293a02`: the diff to
`HEAD` touches only `.agent/`, `openspec/`, and `scripts/` files. No rebuild was
required.

| Step | Result |
| --- | --- |
| Install | `adb install -r` → `Success`; package `com.braintraining.app` |
| Version | `versionCode=1000`, `versionName=0.1.0`, `minSdk=24`, `targetSdk=36` |
| Pulled device `base.apk` SHA-256 | `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` |
| Host release APK SHA-256 | `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` |
| Size (both) | 48,888,452 B |
| Cold launch | `LaunchState: COLD`, `Status: ok`, `TotalTime: 2399`, `MainActivity` focused |

**The device hash matches the terminal APK exactly.** This closes 076-f task 7.3,
which the earlier passes had to leave open because they had never pulled the
installed APK off a live device.

## What is NOT recovered

- The zombie still owns ports 5554/5555, so the **default** serial
  `emulator-5554` is permanently unavailable for this boot. Every capture and
  controller run must target `emulator-5570`. The sweep and journeys scripts now
  carry `BT_DEVICE` for this.
- Free RAM is ~0.5 GB with the emulator up. Nothing memory-heavy (the full Jest
  matrix) can be run concurrently with the device lane.
