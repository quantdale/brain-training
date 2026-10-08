# Campaign 076 — 2026-10-07 resumption (historical checkpoint)

**Superseded by `CLOSURE_CHECKPOINT.md` for current recovery.** The acquisition,
source and gate counts below describe this earlier checkpoint only. No final
acceptance is inherited after subsequent source corrections.

**Verdict remains `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`.** No missing
state or final-build matrix has been certified by this checkpoint.

## Security and remote CI

Starting source `142e3c0fd019a09fcc3e943426ae60df70d17ccc` is synchronized
with `origin/main`. Security repairs removed shell-quote's CRITICAL advisory
with 1.12.0 and source-map-js's HIGH advisory with 1.2.2, both compatible
lockfile updates. Latest braces/sprintf-js have no fixed upstream release;
toolchain-only dispositions are tracked in `.agent/DEPENDENCY_AUDIT.md`.
Fresh local audit: 10 accepted, zero unallowlisted; self-tests 41/41.
Fresh bundle reachability verification and full local gates remain owed.

All four required workflows executed and succeeded for that exact SHA:
App CI `37575106113`, Repository Integrity `37575106085`, Android Build
Smoke `37575106092`, iOS Build Smoke `37575106096`. iOS compilation does
not establish iOS runtime acceptance.

## Dedicated runtime recovery

The prior stopped/ANR lane was recovered by wiping the dedicated
`braintraining-ui35` userdata once and cold booting without GPU overrides.
The user’s WSL/Docker sessions were not stopped. AVD: Google APIs Android
15/API 35 x86_64, Pixel 7, 1080×2400 at 420dpi, emulator 37.1.11.0
(build 15917651), host GPU. Headless flags: `-no-window -no-audio
-no-boot-anim -no-metrics -feature -Wifi -no-snapshot -wipe-data`.
Soak log review found zero app FATAL/ANR and zero launcher/SystemUI ANRs;
this does not certify the outstanding matrix.

The installed candidate from the security SHA is release APK
`94be11ede1e81151a544fac6775736c3e741d41b2862414ca9dd2c837c6c0d6c`
(48,887,752 bytes, package `com.braintraining.app`, 0.1.0/1000).
**Superseded by the forthcoming contrast-fix build**, not final proof.
ARTEMIS helper v6 is installed; external doctor returned READY.
Observation-only atomic screenshot/hierarchy capture through the external
ARTEMIS helper avoids UIAutomator's idle-state failure on animated timers.
No provider config/token is copied into Git. Animation scales are 0/0/0
for controlled captures; stay-awake is enabled. No host-input injection.

## Source correction and validation

Five custom header fragments had six paper-neutral secondary readouts on the
charcoal stage: Stroop Score/Rule, Quick Compare Streak, Symbol Tracker
observe status, Grid Recall study status, Sequence Memory countdown.
Only those six selections now use the existing `stageMuted` token. Board
ink, stage geometry, mechanics, scoring, versions, persistence, routing,
economy and offline behavior are unchanged.

A catalog-scoped TypeScript AST tripwire checks only header JSX, paired with
light/dark native Text render assertions for all six labels and primary
header ink; Quick Compare's board-local paper label remains paper ink.
Typecheck PASS; lint PASS; focused five-game + host/header suites PASS:
42 suites, 480 tests. LSP probe had zero findings but six unconfirmed
push-only/timeout outcomes; typecheck is the confirmed compiler gate.

Read-only scouts converged with parent-owned edits. State-seams report
completed; header-contrast initially failed with empty output, then succeeded
via same-protocol resume. No child mutations/worktrees. Scout conclusions
are source analysis, not device acceptance.

## Second device-driven role correction

Source `cda440197d8e6e83acde3872fe4015bad52fb365` built successfully in
2m51s (495 tasks; 24 executed) and installed as APK
`2a8986e6a627f097127c42e11ac419526c7615bb5d6323f84ff11d8d4b32baff`
(48,887,760 bytes). Three atomic PNG/XML pairs were individually inspected:
Stroop is a live blue-ink WALL prompt with four enabled swatches and legible
Score/Rule; Prospective Cue is running the actual GO/SIGNAL stream, not a
briefing; Quick Compare is a live 9-versus-4 choice, not timeout feedback.
These prove collection recovery, not all-42 acceptance. Local paths/hashes
remain pending filing and are superseded by the source repair below.

Inspection exposed the inherited action-accent use on passive scores; a
source-backed sweep identified 38 live/final score numerals in 19 games and
six rule/task cue labels in three Flexibility games. Only those 44 passive
JSX color selections now use neutral text. Shared Countdown uses secondary
instrumentation ink, retaining warning for the last third. Intrinsic color
stimuli, CTA buttons, animations and rules are unchanged. Quick Compare's
empty capsule is an intentional noninteractive verdict slot (source-backed
N/A to active verdict), not missing timer copy or a hidden control; its
active timer is the separate accessible shrinking bar.

Full local source matrix after this repair: typecheck/lint PASS; Jest
618 passed/4 skipped suites, 7,232 passed/5 skipped tests, five snapshots;
governed signal validator PASS. First full attempt failed only the new
structural assertion rejecting legitimate stageInk scores; corrected to
permit both neutral text and stageInk (not action accent), then reran the
whole matrix. All declared repository validators, dependency audit/self-test,
clean-checkout self-test, QA Node tests 10/10, strict OpenSpec 60/60 PASS.
Fresh web export PASS. Remote `cda4401` all PASS: App CI `37582225183`,
Integrity `37582225189`, Android `37582225138`, iOS compile `37582225196`.
Rebuilt final APK and runtime/matrix gates remain owed.

## Evidence boundary / remaining work

The earlier active attempts were visually rejected: Stroop timeout,
Prospective Cue briefing, Quick Compare timeout. No counts/tasks increased.
Local collection now fails closed on missing/forbidden actual-state markers,
foreign root/foreground, blank frames and installed APK hash mismatch, and
records atomic pairs as **visual review PENDING**, never automatic PASS.

Owed: build/install current contrast-fix tree; individually inspect all 42
final-build game states, including the 22 historical gaps; complete final
90-surface matrix, large/compact/2×/reduced-motion and 48dp audits; fresh
ARTEMIS Flash/Pro attempts and trace inspection; full local gates and bundle
reachability; exact-source remote CI; committed evidence/hash verification;
ledger/task reconciliation. ARTEMIS Pro is historically provider-BLOCKED;
iOS runtime NOT VALIDATED. Historical mixed-build counts remain A39/F27/
P38/R42 until trustworthy evidence is filed, and cannot certify the new APK.
