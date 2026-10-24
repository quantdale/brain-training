# Internal native candidate convergence — 2026-10-23

**Status: INTERNAL TEST ARTIFACT — NOT RELEASE-QUALIFIED.** Campaign080 remains
ACTIVE; no publication, production signing, independent product/release
acceptance or final42-game certification is implied.

## Application identity

- Application source:`22ae2f7cfa3769fdf2ae9d426fe5e7c15610eb09`.
- Immutable installed APK SHA-256:
 `34bbf3deb38c6d704518603a579be1a6ae4da31fa5894bf8227105f406eaed81`.
- File:`qa-artifacts/080/final-convergence/releases/<sha256>.apk`;
 52,734,416 bytes;0.1.0/versionCode1000; x86_64; release mode, internal debug
 signing, NOT a store-signed release. Packaged minSdk24/targetSdk36; actual
 runtime acceptance here is API36 only, not every installable OS version.
- Build:`native-release-build-02.log`, successful incremental Gradle release
 build. This is not a clean-build claim. `native-source-inputs-02.json` records
 1865 source/assets/config/lock hashes, but omitted some configuration/plugin
 inputs. It is retained, not accepted as complete. The separate immutable
 `native-source-inputs-02-complete.json` captures all1885 tracked app inputs
 after `git diff --exit-code22ae2f7c -- apps/mobile` verified equivalence.
 This consistency manifest is not retrospective cryptographic build proof.
 Later QA-only revisions must remain distinguished from this application SHA.
- Installation:`install-data-preservation-02.json` proves exact db/WAL/SHM
 bytes before/after install-r. Subsequent legitimate QA games add sessions;
 their existence is not installation data loss or duplicate restore rewards.
- Packaged permissions exactly match the deny-by-default eight-permission
 allowlist; RECORD_AUDIO and SYSTEM_ALERT_WINDOW are absent.

## Actual native after-proof

The first source marker used alpha0 and was absent from real UIAutomator
hierarchies. That failure is retained in `session-marker-canary.json`; its
compiled APK is separately retained as b4525924…. The correction removes
unnecessary alpha0 from an otherwise empty, transparent,1×1dp, noninteractive
native View. No player-facing label, input control, scoring hook or substitute
session token is introduced.

`session-marker-canary-02.json` observes
`session-token.attention-odd-one-out-mvlkgxt8-1-2alft8` unchanged during actual
playing observations and both results observations. The42 game callers pass
their existing reducer-owned sessionId. This proves native token visibility
for the representative canary; it does not by itself certify the whole catalog
or the repaired verifier's consumer contract.

`switch-native-after/manifest.json`: Profile captured in both actual light/dark
modes, exact candidate APK-bound settings witness. Native hierarchy audit exit0,
no undersized/unlabelled visible interactive targets. This closes the confirmed
sensory Switch46×27dp target finding on the candidate (source minimum48dp).
It is not TalkBack or all-state accessibility certification.

## ARM64/reproducibility boundary

A separate local ARM64 release build failed in Reanimated CMake/Ninja:
`build.ninja still dirty after100 tries`. No dependency was removed or upgraded
and no native build boundary was weakened. A fresh short-path, no-hardlinks
checkout was attempted next; Git failed `No space left on device` while copying
its object pack. That aborted clone was not retained. C: had about151MB free.
Only completed clean task-created worktrees and their dependency junctions
were removed, leaving about0.76GB; unrelated data and global caches were not
deleted. No ARM64 artifact or physical/runtime pass is claimed from this attempt.

The Android workflow now has an explicitly allowlisted manual ABI selection
(x86_64, arm64-v8a, or both) with packaged-ABI checks. Push/PR required checks
remain x86_64 with the same required job name; dispatch uses a separate
concurrency group. This permits a fresh hosted Linux universal/internal build
without relying on the space-starved Windows host. The manual build must
actually complete, its exact source/digest be recorded, and that artifact be
installed/smoked before any stronger candidate verdict. Merely adding the
workflow input is not a build PASS.

## Retained-route correction — rebuilt native proof pending

Later navigation/PSS evidence exposed a stale Backups & data header:51 sessions
versus52 in stopped SQLite (integrity ok;845 sessionXP/164coins). A retained
Stack regression also proved preview consent survived leaving/returning.
The correction refreshes counts/inventory on return, invalidates preview
consent and typed wipe confirmation on blur, and preserves import text. It
retains the normal single first read so failures are not hidden by a duplicate
request. Red-before:`data-focus-before-02.log`; full after-source713 suites/
8034 tests, typecheck/lint PASS. This app change is NOT in the APK above;
rebuild, installed identity and native after-proof are required.

## Remaining release authority

Independent executable engine review now **ACCEPTS the seven round-3 repairs
at481bf8aa**,171/171 tests, no new scoped P1/P2 (see
`independent-round3-closeout.md`). That bounded acceptance does not certify
the artifact above, the focus correction or the catalog. Strict current native
ledger and fresh42-game dispositions remain open.
ARTEMIS doctor still reports a missing provider key (external configuration,
never a repository secret). TalkBack unavailable on this AVD; physical
Android/ARM64 and iOS runtime are not validated. iOS hosted compilation is a
separate gate, not runtime acceptance. Production signing, store publication,
owner taste/branding and required external device/accessibility acceptance
remain owner/release-authority actions. No app-store deployment was attempted.
