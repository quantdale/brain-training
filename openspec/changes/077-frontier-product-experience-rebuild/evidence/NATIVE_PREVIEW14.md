# Native14 — bounded button source and installation recovery

Frozen source `0c8794ddbcaa743cc9ed202da047b54da2792b8b` includes the shared
feedback-height repair in [BUTTON_HEIGHT_RECOVERY13.md](BUTTON_HEIGHT_RECOVERY13.md).
Native after-proof, full current profile review and final acceptance remain open.

Installation is subsequently **recovered**. Same-AVD coldprocess reaches actual
boot1/packagefound/newkernel `5d0b4626-0079-4acb-a0b0-31fde15b124e`; afterboot
installed13APK is independently verified and all three protected files/all13
table hashes exactly match pre-reboot data, integrityok. Full52,311,495-byte
device-file transfer matches stagedSHA c0d3c146...5c4ad before `pm install -r`.
The command returns Success/exit0; installedAPK hash matches, all three SQLite
files remain byte-identical/13sessions/settings unchanged at00:35:12UTC.

First actual14 cold launch at01:13:29 returns Statusok/COLD/6102ms. Root later
personally views settled Home286XP68coins/newOct18plan0of4/0days; old completed
Oct16 record remains preserved. PNG SHA256
`95bb43276264fd20ffd5e566bc237241d18682a156e07c6480c15a34758a8fdf`, equalXML
`b8c50c087b512bf4973074bac1df27968758948e12bcd715fb1c34a700ad718c`, currentAPK/
foreground focus qualify this image. No Metro is needed. Doctor5/5ready.
The install helper's deferred-launch reason incorrectly repeats an older
live-cert explanation although cert had finished; that original text is retained
and superseded by actual `cold-launch18/launch.json`, not treated as launch proof.
Single Pro984a122b is now live for native input/feedback; no result is inferred.

The exact committed archive populates `D:/bt077`:1,107 files, no source
differences, native configuration equal to the retained preview07 baseline.
Inventory SHA256 is
`4b00d4174c6d0e59dc837ef5f48dab58e5f1ec06fe4f8d8a12253efe56d3aafd`.
One-worker release assembly passes7m03s/532tasks (24 executed/508 up-to-date).
The log retains Gradle deprecations, NODE_ENV fallback and color warnings.

Staged APK:
`c0d3c1462ebbcb0e75fc719046c7576ff1f1f696605cdd92fc95679bdb95c4ad`,
52,311,495 bytes, com.braintraining.app0.1.0/code1000, x86_64, target36/min24,
debug-signed release. All941 mapped own source files and the one changed
production file match committed bytes; generated Router context is classified
separately. Source map:
`25699530caa859b55967accca9fc9e23b906cadc5ed67c292cb2d999ffc2d70c`;
packaged/build bundle identical:
`3492147feccf2a91054e1f27585e44c10f8d878e8dad4579fbb37638a14dde24`.
Nine original illustrations remain pixel-identical, three fonts byte-identical,
eight permissions exactly equal the retained allowlist. Aggregate9,437,184-byte
decoded artwork footprint is a static calculation, not process memory.

## Original failed-install and recovery chronology

The following records describe evidence and pending decisions at each earlier
time. The successful installation/cold launch at the top supersedes their
pending installation/readiness labels; original failures remain failures.

Pre-install backup qualifies integrityok/13sessions/286XP68coins/settings hash
a50813e8...2ec9 and retained Oct16completed4played0skip/Oct15active1. The kernel
boot remains37bc0e1c...a237a6 and qemu44452/braintraining-ui35/5570 is unchanged.
The guest is initially asleep; a targeted guest WAKEUP observes Awake. ARTEMIS
reports package/lock readiness inconsistently; no gameplay task is launched.

The first `adb install -r` fails with a blank client error. It is **FAILED**,
not an installed/cold-launch PASS. Longer Android logs identify truncated input:
expected52,311,495 bytes but copied/read46,399,488,5,912,007 bytes short. Android
then destroys session434170790 because the staged base.apk cannot be loaded.
The cause of the input pipe ending remains unproven. Host APK validation passes
all1,565 ZIP-entry CRCs and APK v2 signature verification; this does not establish
that the failed remote staged file was complete or readable.

The same timeline includes system instability before installation and a later
system-server watchdog kill: main thread blocked104s on a WindowManager lock /
wakefulness path. The later kill cannot by itself establish the earlier install
failure's exact cause. Package service is absent at00:05:10UTC, no system-server
PID at00:05:12, same kernel bootID/no app PID. At00:08:28 a replacement
system-server4693 and zygote4558 are observed; package service was still absent
at00:08:23. This is partial recovery, not device readiness.

Direct protected SHA checks after the failed install prove all three canonical
SQLite db/wal/shm files remain byte-for-byte equal to the verified pre-install
snapshot. No restore, reset, data edit or gameplay occurred. Installed APK state
and runtime remain NOT VALIDATED while package service is unavailable.

Full unflagged certification passes in a fresh independent no-hardlinks/full-
history730-commit checkout `D:/bt077-cert-0c8794dd`, no inherited dependencies or
native folders/alternates. Fresh npmci and the complete composite finish exit0:
708 suites/7,979 tests/five unchanged snapshots/zero failures/four skipped suites/
five classified opt-ins, all declared gates, clean tracked and untracked Git.
Summary SHA256 `b4ee11152a7855560ed81b5f681bb0815849a745c940795a9c2732ccb9434556`;
log `ee946b60f9e55ad362522c437be81bf2b214746505b19530d3caaccea45c9ea6`.
No Jest worker forced-exit is observed. All four workflows succeed at this source:
App39080473302, Integrity39080473387, Android39080473193 attempt2, iOS39080473273.
Android39080473193 attempt1 fails resolving existing Foojay1.0.0 before app
compilation; failed log is retained. One failed-job rerun attempt2 succeeds.
The plugin remains published in the [official Gradle registry](https://plugins.gradle.org/plugin/org.gradle.toolchains.foojay-resolver-convention).

Before one guest-only reboot request, root preserves all three protected files
and verifies all13 table-row hashes exactly equal the completed-workout snapshot;
integrityok/13sessions/286XP68coins/Oct16completed4played0skipped, no app PID.
The reboot client times out30s; this does not prove the request was unsent.
At00:13:47 and00:18:49UTC ADB remains offline while the same qemu44452 console
reports braintraining-ui35 running. One target-only transport reconnect at00:19:15
briefly removes its registration; it returns offline at00:19:36. No ADB server
restart or other-device action occurs. Two supported console screenshot probes
return no file; they do not constitute a black screenshot. QEMU monitor access
is unsupported. Boot/services/installedAPK remain unqualified.

At00:21:34 ADB returns device and new kernel bootID
`4d1a6461-f1f3-45ea-af7c-f23e78d0e2cd`, proving the original single reboot ran.
System-server686 starts; package service appears by00:27:34, but the same boot
then loses it. Saved logs prove Watchdog kills686 after81s blocked in a native
file read while SettingsProvider loads aconfig defaults; replacement1068 starts.
App never launches. Full boot completion remains absent, so this is not a ready
device. Target-only adbd root restoration is observed uid0. One premature
protected-copy attempt receives98-byte `No such file or directory` text while
encrypted user storage is unavailable. It is explicitly INVALID_NOT_A_BACKUP;
the pre-reboot exact3file/all13row proof remains intact. No install/data restore.

One supported console shutdown at00:31:24 acknowledges killing the dedicated
instance. Root separately observes qemu44452 actually exit by00:31:54, before
copying any AVD image. The entire stopped AVD directory and its qcow backing
chains are being copied and independently rehashed. A same-AVD/port cold start
with `-no-snapshot` is planned after backup succeeds; no wipe/config/RAM/GPU
changes or other-emulator action. This flag disables loading/saving Quick Boot
state while retaining the per-AVD user-data image, as documented by
[Android](https://developer.android.com/studio/run/emulator-commandline).
Backup succeeds:42 files/9,226,994,882 bytes, every destination independently
rehashed equal to original, all qcow backing chains contained and included;
proof SHA256 `d30a8e5ce535ca547b2ea7eb12143ffb966c147c2e67809617648316916b4be8`.
Same-AVD launch executes at00:33:45UTC, launcher103744/qemu108764 with exactly
`-avd braintraining-ui35 -port 5570 -no-snapshot`, launched hidden without host
input. Actual boot/data/APK qualification is pending; this is not a root-cause fix.

At the earlier pre-recovery boundary, the planned next steps were: verify actual
package-service recovery and current
installed APK/data, then use one complete device-file SHA-verified transfer of
the same signed APK instead of repeating the interrupted streaming path.
The prepared retry is not an executed result. Cold launch is deferred until
heavy validation stops; native Button/input, spatial tutorials, current visual
matrix/critique, motion/performance and visible owner handoff remain open.
Physical Android/ARM64/iOS runtime/store signing/owner taste approval remain
explicit limitations. External controller traces stay outside Git.
