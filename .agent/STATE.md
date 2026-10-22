# Durable Project State

## Campaign 080 activation — native product-quality & release convergence (ACTIVE)

Owner-authorized bounded successor campaign `080-native-product-quality`
activated 2026-10-21 at baseline `f8ae95dd` (= origin/main; all four hosted
workflows green: App CI 39553587740, Android Build Smoke 39553587657, iOS
Build Smoke 39553587616, Repository Integrity 39553587804). This campaign
eliminates the achievable product-quality, native-validation, performance,
accessibility, and release-certification gaps left by Campaign 079 (CONDITIONAL
GO): expand native gameplay coverage toward the full 42-game registry, exercise
critical end-to-end journeys (correct/incorrect scoring, Pause/Resume/Quit,
Workout V3, results/progression, offline airplane mode), deliver evidence-based
performance optimization, correct confirmed visual/UX and accessibility
defects, expand persistence/recovery testing, and keep platform/certification
status honest with a final-SHA reconciliation. Live infrastructure verified at
activation: dedicated AVD `braintraining-qa36` (emulator-5554, x86_64,
1080x1920/420dpi), app `com.braintraining.app` installed and runnable, ARTEMIS
external checkout present at `D:/Tools/artemis`. Full plan: the 080 OpenSpec
tasks; deliverables under `docs/certification/080-native-product-quality/`.

### Campaign 080 progress — 2026-10-22 (VERIFIER DEFECTS, TUTORIAL SOLVERS, EVIDENCE-INTEGRITY REPAIR)

Checkpoint `77972354`. Application source changed ONCE this wave (the P2-B5
testID split) and the APK was rebuilt and identity-verified afterwards.

**Both newly reported verifier defects FIXED.** They were architectural, so the
repair is architectural: verdict derivation, build-scope policy and the process
exit code now live in ONE pure module (`scripts/qa/artifact-integrity.mjs`) and
the CLI is reduced to args + I/O + `process.exit(deriveVerificationExitCode(...))`.
The historical defect existed precisely because a SECOND exit expression lived in
the CLI. Only a genuine PASS exits 0; BLOCKED / NOT_VERIFIABLE / NO_EVIDENCE /
unknown all exit 1; usage + malformed input exit 2. Mixed-build evidence can no
longer pass single-build certification (`--build-scope single|archive`, with
per-partition verification and an explicit "does not describe the current
revision" statement). 40 real process-exit CLI tests, including a pinned
regression asserting the old expression said "do not fail" for
BLOCKED-with-mandatoryProblems>0. Adjacent hardening: path-escape refusal,
cross-attempt reuse, duplicate attempt ids, byte-length checks, content sniffing
(a file NAMED .png is not a screenshot), capability-artifact sufficiency.

**Critical evidence-integrity defect FOUND BY THIS VERIFIER.** The sweep's
artifact root was a fixed path, so each new sweep overwrote the previous sweep's
screenshots/hierarchies while older ledgers still recorded the original digests:
482 of 1100 artifact paths were claimed with more than one sha256. Every pre-fix
ledger (v2/v4/v5/v6) is RETAINED but FAILS independent verification and its
coverage numbers are NOT cited as certification. No digest was regenerated and no
ledger rewritten to look green. Fixed with per-run artifact isolation
(`qa-artifacts/080/sweeps/<stamp>/`).

**Authoritative verified coverage** (`native-coverage-ledger-v8.json`):
`verify-artifacts --mode local --strict` → PASS, 1119 artifacts, 0 mismatch/
missing/unreadable/wrong-attempt/wrong-build/unbound/unsafe-path/reused/
duplicate-attempt/bad-content/capability-unbound/mixed-build, single build
(git ba15ae58, apk 15fe8db3…, versionCode 1000). Distribution **7 L3 / 13 L2 /
8 L1 / 14 L0** vs the previous certified 4/6/8/24.

**Guided-tutorial solver system delivered** (`scripts/qa/tutorial-solver.mjs`,
30 tests): 12 deterministic families, provider-free, three HONEST solve tiers —
DERIVED (an answer computed: 6 games), REVEAL_GUIDED (app revealed it: 11),
NAVIGATION (nothing solved: 5). `isDerivedTier()` is true only for DERIVED, so
reveal-guided or navigation clears can never be presented as knowledge-derived
play. Derived claims were hand-audited (e.g. the spatial rotation case verified
by independently rotating the grid 0/90/180/270°).

**Real harness defects found and fixed while validating natively** (each one had
been silently capping games): the advance-control list missed `next-problem` /
`next-trial` / `submit-estimate` (this alone took math-fast-math L0→L3); a
"satisfied demo" could never be acknowledged because the active-demo gate tested
for containers rendered for the whole demo; `tutorial-demo-done` was absent from
navigation; verdict markers appear as both `-verdict.N` and a `.verdict` suffix;
retry is spelled two ways; "Clear and retry" clears selections but does NOT
re-reveal targets, so the solver must LEARN the pattern first and carry it ACROSS
the reset (memory-grid-recall L0→L1); a timed stimulus with a remaining count is
repeatable; and launch now retries, because a deep link delivered while the
previous activity was tearing down produced a FALSE `L0 FAILED` on two games that
verified healthy on re-run.

**Residual L0 (14) — stated honestly.** Dominated by
stimulus-observation-rate limits, NOT app defects and NOT solver defects:
`memory`, `memory-pattern-tap-back`, `memory-sequence-memory`,
`memory-running-order` flash a sequence one tile at a time and require ordered
replay; a ~900 ms polling loop cannot sample every flash, so the harness never
learns what it must replay (the app correctly rejects a wrong tap). Closing these
needs a faster observation channel, not a weaker certification rule. They were
deliberately not converted into passes by tapping arbitrary controls.

**P2-B5 CLOSED (app-side).** `speed-color-match` emitted one testID
(`trial-wrong`) for two different outcomes; it now emits `trial-correct` /
`trial-wrong` / `trial-missed`. Scoring unchanged. `trial-wrong` stays ambiguous
in the contract on purpose so ARCHIVED evidence from builds that conflated them
is never retroactively over-credited.

**SECOND INDEPENDENT ADVERSARIAL REVIEW — BLOCKED_EXTERNAL.** All three reviewer
routes failed for environmental reasons: Claude Code OAuth session expired;
Codex CLI sandbox rejected all process execution and repository writes; built-in
`reviewer` agent hit an exhausted coding-plan quota (reset 2026-10-27). A static
self-review is NOT substituted and will NOT be labelled independent. The
certification engine therefore remains without second-party verification, which
is why the campaign stays ACTIVE.

Gates at `77972354`: typecheck clean, jest 713 suites / 8024 passed (5 classified
skips, 0 failed), 205 QA contract tests, repo-state / registry / spec-store /
cli-contracts (16 scripts) / workflows / offline / provenance / task-ownership /
secrets / runtime-QA-contract all PASS.

### Campaign 080 progress — 2026-10-22 (P1/P2 CERTIFICATION-REPAIR WAVE)

The independent adversarial review returned **ACCEPT WITH FINDINGS** (4 × P1,
6 × P2). All four P1s and every actionable P2 are now IMPLEMENTED and TESTED.
Findings are preserved verbatim in `independent-review.md`; dispositions live in
the separate register `review-finding-resolution.md`.

**P1-A causal attribution.** `classifyInputCausality()` separates
INPUT_ACCEPTED / AUTONOMOUS_TIMEOUT / AUTONOMOUS_PROGRESSION /
AMBIGUOUS_CAUSALITY / NO_RESPONSE. Acceptance now requires an attributable
signal (target-control identity, score transition, or explicit answer
acknowledgment) — a fingerprint difference alone never certifies input. The
confirmed `language-word-chain` false positive is a pinned regression fixture.
Timeouts are credited through the autonomous-gameplay capability instead of
being fabricated as tap acceptance.

**P1-B safe exit.** `deriveScreenKind()` proves destinations from hierarchy
status + control inventory + foreground identity + process liveness. The old
`zero parsed controls -> non-game-app-screen -> EXITED -> safeExit VERIFIED`
mechanism is demonstrably rejected. `actionExecuted` is now reported truthfully
(it was emitted as `true` unconditionally while `adb` ran tolerant).

**P1-C artifact integrity.** `requireArtifact` is genuinely set by policy;
artifacts carry file + SHA-256 + attempt binding; new
`scripts/qa/verify-artifacts.mjs` recomputes digests from real bytes instead of
comparing two self-asserted values. Three evidence modes (local / portable /
source) are distinct. The verifier independently CONFIRMED P1-C and found more:
908 artifacts verify, but **10 recorded hashes do not match the files on disk**
(all in `math-fast-math`, identical computed digests recurring) and **76
observations carry no artifact binding**, including pivotal safe-exit proofs.

**P1-D narratives.** `attention-odd-one-out` L3 reclassified from "answer-driven
rounds" to **passive timed completion** (the L3 terminal state stands); the
unevidenced `speed-color-match` demo-clearing claim retracted; the
"every proof bound to artifact hashes" claim retracted; `coverage-audit.md` run
count contradiction fixed.

**Wave B (P2).** B1 registry validation, B2 certified-vs-historical axis
separation, B3 content-bound results currency (with lower-is-better exemption
and the `firstState()` limitation fixed), B4 schema hardening + duplicate-attempt
detection + structured corrupt-entry diagnostics, B6 authoritative tutorial
status (returning players never forced to repeat a tutorial). B5 closed on the
contract side (`trial-wrong` is ambiguous and cannot alone certify); the
app-side testID vocabulary split remains open.

**Wave C.** 73 tests across `coverage-contract.test.mjs`,
`coverage-contract.adversarial.test.mjs` and `merge-coverage.test.mjs`, incl. 5
mutation controls proving the protections have teeth.

**Wave I.** Owner-authorized reversible Odd One Out cover correction integrated
through the CANONICAL art pipeline (`memory-attention-speed.mjs#oddOneOut` +
`generate-covers.mjs`), not a hand-edited asset. Aesthetic acceptance PENDING
OWNER.

Gates at `70bf33da`: full jest 8024/8029 green (0 failed), typecheck clean,
lint clean, repo-state/registry/provenance/task-ownership/secrets green, QA
contract PASS. Application source unchanged in this wave (cover art + QA
harness + docs only).

**In flight:** fresh 42-game sweep under the hardened contract
(`native-coverage-ledger-v2.json`) — first game already certifies **L3
VERIFIED**. Remaining: sweep completion + strict merge (Wave E), Workout V3
lifecycle (Wave F), backup/restore/migration (Wave G), accessibility profiles
(Wave H), performance follow-up (Wave J), and the second independent review.

### Campaign 080 progress — 2026-10-21 (MATERIALLY ADVANCED, NOT COMPLETE)

Flagship workstream A DELIVERED: fresh native runtime coverage of the whole
42-game registry via a new deterministic emulator-local sweep harness
(`scripts/qa/native-game-sweep.mjs` — deep-link + stable `gameId.control`
semantic ids + nested-control matching + out-of-band screenshots; fixes the 079
slow-dump-vs-timer bottleneck). Result: **all 42 games at ≥L1 native smoke, 38
at L2 native interaction, 1 at L3 full lifecycle** (vs 079's single journeyed
game). Merged machine-readable ledger (`native-coverage-merged.json`) + human
matrix delivered. Critical journeys: Pause/Resume/Quit VERIFIED (timer freeze
across 6s, resume, quit-discard; Odd One Out); correct/incorrect scoring
VERIFIED (live incorrect input + answer reveal + deterministic scoring.test.ts);
offline airplane journey VERIFIED (cold-start→play→restart→persist→restore);
results/progression verified. Performance: controlled source probes + device
gfxinfo with emulator/software-rendering overhead separated (GPU percentiles,
legacy/modern jank split); NO app-controlled frame bottleneck cleared the bar
for a safe correction, so no optimization is falsely claimed (performance.md C4).
Governance: final-SHA reconciliation (app source UNCHANGED 9c4dd138→f8ae95dd, so
079 runtime evidence carries forward) + administrator-bypass posture reviewed
with non-bypass as an owner decision (governance.md). Security: dependency gate
PASS, 7 accepted GHSAs, no regression. In-campaign defect fixed: a governance-
consistency format drift caught by the `frontier-audit` terminal-durable-state
gate and corrected (17/17 green). Full local gate suite GREEN at checkpoint:
typecheck, lint, jest 711/8018/5-skip, 10 hermetic repo gates, strict OpenSpec
207/207, dependency audit. **Application source unchanged this campaign** (only
QA scripts + docs + OpenSpec/governance).

REMAINING ACHIEVABLE IN-REPO WORK (why the campaign is NOT closed): Workout V3
full native lifecycle (B4) not re-driven; backup/restore on-device round-trip +
upgrade/migration not re-driven (source-covered); a11y profile matrix
(large-font/compact/dark/reduced-motion/landscape) + TalkBack runtime not
re-executed; deeper L3 session-completion + 4 timed/keypad games at L1; visual
P3 corrections deferred. External (not claimed): ARM64/physical Android, iOS
simulator/physical runtime, owner acceptance. Per AGENTS.md success contract the
campaign is "materially advanced", not completed; it remains ACTIVE for
continuation. See `docs/certification/080-native-product-quality/handoff.md`.

### Campaign 080 final integration status (post-integration record)

The Campaign 080 substantive checkpoint commit `2fa79efb` has **all four hosted
workflows green** (externally observed after integration, 2026-10-21): App CI
#602 (run 39574757778), Android Build Smoke #449 (39574757422), iOS Build Smoke
#450 (39574757606), Repository Integrity #610 (39574758253) — all SUCCESS. This
doc is committed after `2fa79efb`, so it records that commit's observed status
rather than its own (see `docs/certification/080-native-product-quality/
governance.md` H1 on the self-reference model). `2fa79efb` is the substantive
deliverable revision (QA harness + coverage matrix + certification suite +
governance); the tip that follows is a metadata-only status record. Campaign 080
remains ACTIVE for continuation of the remaining achievable work enumerated
above.

## Final stabilization, acceptance, and release certification — 2026-10-21 (Campaign 079, VALIDATED with explicit limitations)

Owner-authorized repository-wide stabilization and acceptance program
`079-stabilization-acceptance-certification` executed and closed at ending
SHA `9c4dd138` (started `64c1df4d`). The owner's starting intelligence was
re-verified first: the reported `--self-test` parser regression was already
repaired at 2f18738f and all four workflows were green at baseline, so the
program advanced instead of replaying the repair. Full evidence under
docs/certification/079-release-certification/ (release-matrix.md is the
authoritative gate record; executive-report.md the summary; handoff.md the
next-operator brief).

Delivered: validator CLI-contract gate (15 scripts in contract, 8 permissive
parsers hardened); security register 10 to 7 accepted GHSAs with three
genuine in-range brace-expansion remediations (all remaining acceptances
re-verified against the live registry with owner/review/exit fields);
branch protection plus no-bypass ruleset 25523614 API-verified (force-push
and deletion blocked for everyone); evidence audit findings (9: 2 P1, 6 P2)
corrected with dated annotations; native acceptance journeys on the
dedicated AVD (discovery, detail, tutorial, interactive demo, difficulty,
round play, timeout feedback, advancement) with local screenshot/hierarchy
evidence; perf probes and emulator measurements recorded. All four workflows
SUCCESS at 9c4dd138 (App CI 39547028408, Android 39547028543, iOS
39547028492, Repository Integrity 39547028373).

Explicitly NOT VALIDATED/PENDING (external): physical Android/ARM64/iOS
runtime, screen-reader acceptance, fresh native re-execution of 41/42 games,
correct-tap scoring feedback and pause/quit re-validation, offline airplane
journey, and owner subjective acceptance. Overall release verdict:
CONDITIONAL GO.

## Fresh-machine development environment setup + red-gate repair — 2026-10-21 (qualified)

Owner goal "set up everything needed for this repos development"; no campaign
activation. Fresh Windows host bootstrapped per ONBOARDING.md: Node 22.23.2/
npm 10.9.8, JDK 17, Android SDK (build-tools 35+36, platforms 35/36/37,
NDK 27.0.12077973, platform-tools, emulator, dedicated AVD braintraining-qa36),
`npm ci` (1,114 packages from lockfile, no upgrades). All ONBOARDING §6
gates PASS: typecheck, full Jest 711 suites/8,018 tests (+5 classified
skips), lint, hermetic expo-alignment; network `expo-doctor` 20/21 patch
drift classified advisory upstream drift per GOVERNANCE (push-path
equivalent PASS). Full Repository Integrity job mirrored locally 18/18.
Local Android build smoke green (gradle :app:assembleRelease 9m17s; APK
52,735,180B; aapt2 permissions exact vs expected-apk-permissions.txt).
App install + emulator-local smoke 5/5 PASS (install/foreground/screenshot/
hierarchy/logcat; Home renders with workout state). ARTEMIS external
checkout installed at D:\Tools\artemis (google/artemis 351ca84) + `uv sync`;
doctor: python/config/host/adb/toolchain PASS after installing FFmpeg+
scrcpy. This machine has no D: volume, so D: is provided by a persistent
per-user `subst D: C:\VirtualD` (HKCU Run `SubstDArtemis`); nothing else
deviates from the documented paths. Muse Spark route override written to
D:\Tools\artemis-local-muse-spark.jsonc (openai / muse-spark-1.3-contributor
only, no alternate fallback; upstream schema caps reasoning_effort at
"high" so documented xhigh stays endpoint-side — drift noted in file).
USER-OWNED REMAINING: OpenCode Go provider credential into
D:\Tools\artemis\.env via `scripts/qa/set-artemis-key.mjs` (BT_NEW_KEY);
ARTEMIS doctor reports gemini_api_key fail until the owner supplies it.

Red-gate repair during setup: Repository Integrity was red on main at
d26cd536 (run 39479920967, exit 2) because the F-6 unknown-flag fix never
allowlisted the documented `--self-test` flag of validate-affected.mjs.
Repaired at 2f18738f (parse loop recognizes --self-test; F-6 exit-2 and
F-5 root-independence contracts re-verified; local job mirror 18/18).
All four workflows SUCCESS at 2f18738f (Repository Integrity 39530950259,
App CI 39530950190, Android Build Smoke 39530950268, iOS Build Smoke
39530950355). Note: the 2f18738f commit body was mangled by shell
substitution of backticks (claims intact, embedded usage text); history
was not rewritten per the no-force-push policy.

## Explore-findings convergence — 2026-10-19 (qualified)

Owner-directed bounded repair of every finding in
docs/audits/openspec-explore-2026-10-19.md; no campaign activation. F-1:
generated main spec store (scripts/generate-spec-store.mjs, 140 capabilities/
601 requirements replayed) + declared `spec-store-generated-check` CI gate;
openspec strict now 203/203. F-2: all nine zombie in-progress changes closed as
terminally dispositioned with honest BLOCKED/NOT VALIDATED text preserved
(006r 12.11 closed with real public-CI evidence at `69af63a6`); `openspec list`
0/63 non-complete. F-3: audit TRACEABILITY.md with corrected finding→change
mapping. F-4: tracked UTF-16 `campaign-log.txt` dump removed; root-hygiene
detector hardened (reserved device names, stat fail-closed, tracked-dump ban,
16-case self-test) with negative proof before removal. F-5/6/7: gate scripts
root-independent + strict argv usage (exit 2). F-8: dependency-audit counting
model documented (10 unique GHSAs). F-9/F-10: grammar copy fix and the three
live product P3s repaired (dead Pause in 5 games, Bronze Ring hint clipping,
NumberLine gray lip root cause: taller-stadium lip wrapper → face-sized shifted
lip bar). F-11 limits remain NOT VALIDATED/unclaimed. Gates: full Jest matrix,
tsc, lint, web export, strict OpenSpec 203/203, all repo/security/tooling
validators PASS.

## Focused scale/responsive repair — 2026-10-19 (qualified)

Clean origin/main2c0a990e baseline. Oversized handoff primarily came from the
retained840x1400/420dpi/font2 QA profile; arrival still had size override but
font1. AVD physical1080x2400/420dpi established and normal-scale shell inspected.
Two confirmed shared defects repaired: intrinsic wrapping metadata in GameStage
restores missing Place kicker at compact2x; GameHost removes obsolete bottom-sheet
alignment from in-flow tutorial. No type/button token or scaling-cap change.
Four regressions fail before; full source710suites8002tests/five unchanged
snapshots/five classified skips/types/finaltypes/lint/strict63/declared gates/web
PASS. Android576tasks6m8s/APK10e7a10e…bab9dde,1162 inputs/942 mapped code exact,
expected8permissions,install-r/allSQLite files/all13 tables exact/18sessions PASS.
Seven actual native profiles/default1,1.5,2/compact1,2/light,dark PASS; Start56dp
throughout, difficulty48–54.48dp. Short normal tutorial y1573→199px; Start absent
while open, Gotit→Start→actualRound1/5 PASS. Grid/Transform compact2dark normal
nested-scroll completion/returnedStart PASS. Current settled normal Home/Games/
detail/Results/Progress/Profile reviewed; no further sizing defect. Post-runtime
integrityok/18sessions/all12non-tutorialtables exact; only tutorial metadata
changed. Original external ARTEMIS config restored byte-for-byte after temporary
same-provider fallback; no credentials changed. Visible/unminimized5570 on
OrderPath intro/fullStart,1080x2400/420dpi/nooverride/font1/day/Systemtheme/all
motion1. Source d11964ed all4CI SUCCESS; exact ending-SHA CI and fresh live
handoff are recorded post-commit in local FINAL_DELIVERY.json/final response.
Bounded report: docs/bugfixes/ui-scaling/REPORT.md. No new campaign.

## Focused tutorial/Start repair — 2026-10-19

Owner-authorized bounded repair, starting clean origin/main41b0777f; no new
campaign. Two shared production files replace absolute tutorial/intro overlap
with in-flow ownership and remove the intrinsic percent height cap. All42 games
inherit the fix;077 nested-scroll flags remain. Native Deduction before clipped
Retry/coveredStart at320dp/font2; after fullRetry, normal completion, enabled
Start and actual active gameplay personally inspected. OrderPath eight native
viewport/font/theme combinations and Grid nested demo/normalcompletion PASS;
normal/reducedmotion covered. Source full Jest709suites7998tests/five snapshots/
classified skips/types/lint/strict63/gates/web/audit PASS. Shared game-ui added
to synchronized56-pattern impact map/self-test16/strict two-file coverage PASS.
APK319a89f7…221a4b installed-r; exact SQLite files/all13tables preserved at
installation. Runtime retains18sessions/economy/settings/ratings/all prior
workout/quest rows; only normal tutorial metadata/newOct19 plan/zero-progress
quest rows added. Report/evidence: docs/bugfixes/tutorial-start/REPORT.md.
This is the qualified delivery candidate. Exact ending-SHA four-workflow success
and final visible Deduction Start refresh are checked after commit, recorded in
local qa-artifacts/tutorial-start-fix/FINAL_DELIVERY.json and the final response
(machine-local evidence on the prior host, not in Git and not retrievable on a
fresh machine; the durable proof is the CI run IDs recorded alongside);
do not infer their success from this pre-commit record. Historical078 stays closed.

**Active campaign:** `080-native-product-quality`
**Last campaign:** `079-stabilization-acceptance-certification`
**Last campaign status:** VALIDATED

### Campaign 078 terminal record (2026-10-20, historical)

The fields below describe Campaign 078 **at close**; they are not current
state. Current state is the active Campaign 079 declared above and in
CURRENT_CAMPAIGN.md.

**Status at 078 close:** VALIDATED
**Canonical branch:** main
**Verdict at 078 close:** CAMPAIGN_078_EMULATOR_REVIEW_READY_WITH_LIMITATIONS

Campaign078 implementation and qualified native inspection are complete. This is the terminal delivery candidate: final handoff is conditional on all four workflows succeeding at this exact ending commit. The post-commit local FINAL_DELIVERY.json records the actual ending SHA/runIDs and fresh live witness; do not infer CI success solely from this file. No successor campaign was authorized at 078 close (Campaign 079 was separately owner-authorized on 2026-10-21).

All42 game mechanics audited;42 unique, accurate, locally packaged covers integrated across library/detail/introduction using existing Play Lab layout/tokens. Independent title-hidden pilot/full review and informed revisions complete. One actual ImageGen-derived signal object plus41 deterministic vector-authored scenes. Runtime PNGs569,529B; hypothetical all-decoded26.25MiB. No game/SDK/persistence/route/scoring/economy implementation changes. Campaign076/077 historical evidence remains unchanged.

Frozen production source359a80be81f6b6730622067294a3f24f607fdbd6. Accepted APK fc2c99f7f4ffb668ed6ea9d79a5f91714e33178834b7bee6868360db045c605d /52,733,728B. NativeA intrinsic-image clipping rejected; explicit image bounds repaired, rebuilt and inspected. Bundle/source-map989 own sources and all42 packaged decoded images verified. Same signing/eight permissions; both install-r updates preserve exact SQLite files. Final runtime: integrityok,15 owner sessions/all14 tables exactly unchanged.

Whole-source Jest708 suites/7979 tests/five unchanged snapshots, five classified opt-in skips PASS before final sizing repair; final focused17tests/typecheck/lint PASS. All declared relevant source/security/repository checks, web22routes, strict63 OpenSpec items PASS. Final AppCI reruns complete current source. Ten accepted production advisories remained at 078 close (seven accepted after the 2026-10-21 brace-expansion remediation); no zero-vulnerability claim.

Root personally inspected all42 native covers in default light/dark. Representative font2/compact/compact-dark-font2/larger profiles, actual device-local full walkthrough, bounded fast scroll, ARTEMIS Memory card/detail/introduction/return and offline COLD/traversal qualify changed surfaces. Profile coverage is sampled beyond default light/dark, not full cross-product. Earlier partial ARTEMIS claims/unexecuted benchmark are rejected. Raw device/ARTEMIS artifacts retained locally/external, selected originals/proof hashes in078 evidence.

Matched16-swipe sample: jank40.92→38.12%, p95113→101ms; legacy jank92.77→94.32%. PSS endpoint182247→208391KiB (+25.53MiB/+14.35%); image texture cache grows to40.41MB. Memory cost is explicit; emulator jank remains poor. No60fps/causal improvement/continuous peak/leak-free or physical latency claim.

Visible/unminimized braintraining-ui35/emulator5570/qemu108764 remains running accepted APK on Games. Original1080×2400/420dpi/font1/light/network1,1,0 restored. Actual PNG/XML/foreground/APK proof personally inspected; final post-CI live refresh required before final message. No host input/focus; other device untouched. Owner progress/history/settings preserved.

Full report and matrix: openspec/changes/078-game-cover-visual-identities/evidence/FINAL_REPORT.md. PhysicalAndroid/ARM64/iOS runtime, comprehensive screen reader and human taste/recognition study remain unvalidated. Related visual P3 limits and memory tradeoff are in KNOWN_ISSUES/BACKLOG. Existing077 unrelated debt remains historical and is not reopened.

## Campaign 080 continuation — certification-system repair + catalog revalidation (2026-10-21)

Owner directive: repair the evidence system FIRST, then complete remaining
achievable Campaign 080 work. Delivered:

**Priority Zero — certification contract repaired (F-080-001..005 all fixed):**
new pure evidence contract `scripts/qa/coverage-contract.mjs` (2.0) separating
actions/states/capabilities; levels derived only from proven transitions;
structured evidence events with before/after observations, artifact hashes,
single-attempt binding, build/APK/device provenance; safe exit proven by
observed destination (Back→pause→quit ladder); results-currency check. Adversarial
suites: `coverage-contract.test.mjs` 28/28 (20 mandatory negative cases incl.
faithful v1 false-positive fixtures + positive controls) and
`merge-coverage.test.mjs` 12/12 (cross-run fabrication impossible, or3 union,
conflict preservation, invalid-run exclusion, v1-schema rejection). One real
contract bug (reference-compare fingerprints always "changed") found BY the
adversarial suite and fixed — recorded in native-qa-correction.md.
Provenance-aware merger (`merge-coverage.mjs` 2.0): single-run certification,
union-of-observations labelled separately, cross-run-union-not-a-journey
diagnostics, 3-valued or3, no silent discard.

**Historical evidence preserved + reclassified:** originals backed up
byte-for-byte (`scripts/qa/historical/080/`, sha256 recorded);
`reclassify-historical.mjs` replays all 52 v1 runs through contract 2.0:
52/52 downgraded (all fail provenance per F-080-005; demonstrable false
positives: language-word-chain tutorial-only L2, memory-pair-recall started-only
L2, attention-sustained-vigilance L3 with intro→results and no gameplay).

**Fresh 42-game revalidation (corrected harness, APK sha256 231559b9…48ca,
git b7a1eaf2, emulator-5554): certified 5 L3 / 9 L2 / 4 L1 / 24 L0.** L3:
odd-one-out, visual-search, number-line-estimation, transform-match,
quick-compare. Two formerly-L1-only games (speed-color-match, speed-reaction-time)
now L2 verified. Dominant remaining blocker class documented with exact
evidence: 22 games' guided TUTORIAL DEMOS require answer-driven completion
("Solve 2 more problems." etc.) not yet driven by per-family demo solvers —
prompts captured in ledger for offline resolver validation. In-repair harness
fixes: guided-demo interaction, per-game demo contracts (grid-recall [3,5]
computed from its seed; color-match label→button), cached-hierarchy driver
(dump-per-action timing vs round timers), pause→quit exit ladder.

**Visual corrections (verified):** Odd One Out in-game option affordance
(borderStrong interactive boundary) + provenance correction that the confirmed
defect is the game-detail COVER illustration (shared binary asset, composition
fix specified, owner-taste gated); ReactionTime bounded elevation polish
(owner-acceptance candidate); rule-switch/echo-size dispositioned NOT
APPLICABLE on evidence. tsc clean; focused jest 21 suites/241 tests; full jest
713 suites/8024 tests GREEN.

**Status of remaining campaign obligations:** Workout V3 native journey —
driver `scripts/qa/workout-journey.mjs` ready, journey NOT YET EXECUTED (device
time consumed by sweep); backup/restore + migration — NOT EXECUTED, isolated-
fixture protocol prepared, owner data never at risk; a11y/responsive matrix —
NOT EXECUTED, ADB profile protocol prepared; TalkBack acceptance inherently
needs human review. Build of a fresh APK with the two visual fixes is locally
BLOCKED (ninja "manifest still dirty" ×3 after cache clean — suspected
synced-folder file locking; the installed APK remains green and evidence binds
its exact hash). Campaign 080 remains ACTIVE.
