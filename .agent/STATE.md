# Durable Project State

**Last update:** 2026-09-18 — Campaign 040 closed CONDITIONALLY after the
integrated release-candidate pass.
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** `040-release-candidate-integration-certification`
**Last campaign status:** VALIDATED

## Campaign 040 checkpoint — Release-Candidate Integration & Certification (VALIDATED / CONDITIONAL)

- **Activation:** opened from synchronized terminal Campaign 039 checkpoint
  `174fff6`; no local or concurrent user work was present to overwrite.
- **Implementation:** current Android observation found and repaired two
  bounded release interaction defects at `0cb7727`: an open first-play
  tutorial could cover GameHost session CTAs, and populated Game Detail's
  trends link was below the shared 44 dp target. Focused regressions cover
  both repairs. No game mechanics, schema, migration, economy, workout or
  session identity, backup/restore, router contract, or CI workflow changed.
- **Repository evidence:** full Jest 557 suites passed / 4 skipped; 6,568
  tests passed / 5 skipped; 5 snapshots; typecheck, lint, Expo Doctor 21/21,
  web export, OpenSpec 26/26, repo-state, task ownership, affected map,
  provenance, offline, secrets, workflows, dependency, registry, and runtime
  contract gates passed. The final release APK was installed successfully.
- **Native evidence:** dedicated `braintraining-ui35` / `emulator-5554`,
  Android 15/API 35, 1080x2400 density 420. Final release matrix was 22/22
  route-verified/nonblank with 0 automated accessibility violations. Daily
  workout start/first board, standalone Memory five-round result, relaunch
  persistence, catalog/search, invalid-route recovery, offline routes, and
  filtered startup logcat were observed. Full daily workout and all mechanics
  were not claimed as manually completed.
- **Terminal result:** `CAMPAIGN_040_CONDITIONAL`. Human/manual TalkBack or
  VoiceOver, iOS, physical-device, store-signing/system-sheet, full manual
  catalog/workout, and external CI success remain unavailable or conditional.
  Evidence is under `docs/redesign/evidence/campaign040/` and the overnight
  handoff.

## Campaign 039 checkpoint — Performance, Reliability & Maintenance Isolation (VALIDATED)

- **Activation:** opened from synchronized terminal Campaign 038 checkpoint
  `9672c07`; no local or concurrent user work was present to overwrite.
- **Discovery:** current dev/release startup, route arrival, list/search,
  memory, persistence/relaunch, logcat, and same-host probes were measured on
  the dedicated `braintraining-ui35` AVD. Release Game Intro loaded the real
  bundled GameHost; the dev lazy-module loading card was classified as a
  Metro warm-up observation.
- **Implementation:** no speculative source performance optimization was
  justified. The Expo SDK 57 compatible patch drift was refreshed in an
  isolated package manifest/lockfile commit `eb4d7fb`; no schema, migration,
  economy, session/workout identity, gameplay, router, offline, or CI change
  was made.
- **Validation:** full Jest (557 suites passed / 4 skipped; 6,567 tests
  passed / 5 skipped; 5 snapshots), typecheck, lint, repo-state, task
  ownership, OpenSpec, registry, provenance, offline, secrets, workflows,
  dependency audit, affected-map, runtime contract, debug/release Android
  builds, 22-surface release matrix, a11y audit, pixel inspection, repeated
  cold launches, Games search, and app-filtered logcat all passed. Exact
  evidence is under `docs/redesign/evidence/campaign039/`.
- **Limits:** startup timings were variable across emulator/system states and
  are recorded without a causal regression claim. Human, TalkBack,
  VoiceOver/iOS, physical-device, store-signing, system-sheet, and external
  CI evidence remain pending/external.
- **Terminal result:** Campaign 039 is complete for the tested
  Android/repository scope. Campaign 040 is the next safe successor.

## Campaign 038 checkpoint — Accessibility, Device, Motion & Sensory Hardening (VALIDATED)

- **Activation:** opened from synchronized terminal Campaign 037 checkpoint
  `a158748`; no local or concurrent user work was present to overwrite.
- **Discovery:** matching native light/dark captures covered 22/22 routes;
  large-text and compact-phone matrices were exercised; Profile Shield and
  Games Symbol Tracker were each followed to fully visible settled positions.
  The automated a11y audit reported zero violations in all tested matrices.
- **Finding:** the only demonstrated product defect was a real SQLite writer
  race when two sensory Switch changes fired before the prior fire-and-forget
  profile transaction settled. The captured clipped nodes were ordinary
  visible-edge clipping, not unreachable controls.
- **Implementation:** `_layout.tsx` now queues sensory profile writes per root
  instance; the new deterministic concurrency test was red before the repair
  and green after it. No layout, schema, migration, economy, session,
  workout, gameplay, router, or dependency change was made.
- **Validation:** focused/full Jest, typecheck, lint, repository validators,
  strict affected mapping, Android assemble/install, 22-surface native
  light/dark capture, font-scale-2 and compact capture/a11y audits, real
  pixel comparison, sensory off/on relaunch checks, and fresh logcat passed.
  Evidence is under `docs/redesign/evidence/campaign038/`.
- **Terminal result:** Campaign 038 is complete for the tested Android scope
  at source checkpoint `a7f1531`, pushed to `origin/main`. Human TalkBack,
  VoiceOver/iOS, physical-device, production-signing, and independent human
  evidence remain pending and are not global certification claims.

## Campaign 037 checkpoint — Navigation, State & Cross-Surface Coherence (VALIDATED)

- **Activation:** opened from synchronized `main` at
  `340d61a4fedffb46e8adf8245d57cb03a5831906`; no local or concurrent user
  work was present to overwrite.
- **Discovery:** captured 22/22 route-verified, nonblank light/dark surfaces
  under `D:\Temp\campaign037-runtime-before`. Emulator-local journeys
  verified Games → Detail → back, Detail → Play → GameHost → back, result →
  back, Progress drill-down → back, Profile → Rewards/Data → back, and
  recoverable invalid Game/Detail/Results deep links.
- **Finding:** clean Home said the plan was balanced across recent training
  while the local record had no completed sessions. Major navigation seams
  were operational; no routing rewrite was indicated.
- **Implementation:** Home now says “a balanced starting set” when the local
  recent-session list is empty and retains the history-aware wording for
  returning players. Focused contracts cover the state branch, Games → Game
  Detail → back, and a missing Results deep link. Session/workout provenance,
  persistence, empty states, and invalid-route fallbacks remain protected.
- **Validation:** full Jest 556 suites / 6,566 tests passed (4 suites and 5
  tests skipped; 5 snapshots), typecheck, lint, strict affected mapping,
  repository validators, Android build/install, 22/22 clean light/dark native
  captures, Pillow pixel comparison, automated accessibility (0 violations),
  and fresh logcat all passed. Evidence is under
  `docs/redesign/evidence/campaign037/`.
- **Terminal result:** Campaign 037 is complete at source checkpoint
  `ad4e54a`, pushed to `origin/main`. The next safe successor is Campaign
  038 Accessibility, Device, Motion & Sensory Hardening.

## Campaign 036 checkpoint — First-Run, Empty-State & Trust (VALIDATED)

- **Activation:** opened from synchronized `main` at
  `27fd1f27866401b35da875a5250648babc768431`; no local or concurrent user
  work was present to overwrite.
- **Discovery:** cleared the dedicated `emulator-5554` app data and captured
  the true clean-install Home path plus light/dark Home, Games, Progress,
  Profile, Rewards, Data Management, and Game Detail surfaces. Additional
  available empty/no-history routes were captured where the harness supported
  them. Artifacts are outside Git under
  `D:\Temp\campaign036-runtime-before` and
  `D:\Temp\campaign036-runtime-before-all`.
- **Finding:** Home has an understandable primary Start workout path but no
  explicit local/offline reassurance. Data Management shows `Empty` when its
  byte metric is unavailable even though initialization has a local profile,
  workout instance, and quest rows. Rewards shows `3/12` default-owned
  cosmetics without explaining the included starter set.
- **Implementation:** Home now states that training is ready on the device and
  works offline; Data Management reports `Ready` when exact local counts show
  initialized state but the byte metric is unavailable; and Rewards explains
  the included starter cosmetics. The authorized slice remained limited to
  factual copy and a display-only local-store fallback; no onboarding,
  persistence, schema, economy, backup, or gameplay change was made.
- **Validation:** focused contracts, full Jest (556 suites passed / 4 skipped;
  6,563 tests passed / 5 skipped; 5 snapshots passed), typecheck, lint,
  strict affected mapping, repository validators, 14-surface light/dark
  native after captures, pixel comparison, automated accessibility (0
  violations), fresh logcat, and Android build/install all passed. Exact
  evidence is under `docs/redesign/evidence/campaign036/`.
- **Runtime flow:** a clean Home CTA entered the real Cue Keeper intro,
  tutorial example, and live `Round 1/5` board through emulator-local ADB;
  final data was cleared again. ARTEMIS was not used for this campaign.
- **Terminal result:** Campaign 036 is validated and Campaign 037 is the next
  safe successor. Human/platform limits and zero-step external CI failures
  remain explicitly classified in the evidence package.

## Campaign 035 checkpoint — Cross-Surface Visual System (VALIDATED)

**Last update:** 2026-09-18 — Campaign 035 is terminally validated from the
synchronized Campaign 034 evidence checkpoint; Campaign 036 is next.
**Canonical branch:** `main`
**Active campaign:** `none`
**Last campaign:** `035-visual-system-consolidation`
**Last campaign status:** VALIDATED

## Current status

Campaign 035 (`035-visual-system-consolidation`) was opened from the
synchronized Campaign 034 evidence checkpoint at
`f1ed5331dd2f2cec69bab01e2404ca4b7831d424`. The live baseline covers the
core shell, game identity/detail, GameHost intro, Progress, Profile, Rewards,
and Results in light/dark. The bounded implementation target is the observed
domain-wash/border treatment competing with the global Play/Start accent on
single-game identity heroes. Native baseline and after captures are outside Git
under `D:\Temp\campaign035-runtime-before`,
`D:\Temp\campaign035-runtime-after`, and
`D:\Temp\campaign035-runtime-after-warm`.

The implementation is limited to a shared visual-surface treatment. Existing
game identity, tutorial, difficulty, gameplay, reward, streak, settings, data
portability, SQLite/session, offline, catalog, economy, backup, and
no-medical-claim contracts remain protected; no schema or dependency change
is authorized.

## Campaign 035 checkpoint — Cross-Surface Visual System (VALIDATED)

- **Activation:** opened from synchronized `main` at
  `f1ed5331dd2f2cec69bab01e2404ca4b7831d424`; no local or
  concurrent user work was present to overwrite.
- **Discovery:** 16 nonblank, route-verified light/dark captures were produced
  for Home, Games, Game Detail, Progress, Profile, Rewards, Results, and
  GameHost intro. A warmed GameHost intro was also inspected after lazy load.
- **Finding:** single-game identity heroes use a domain wash/border together
  with the global primary CTA; this is the bounded visual repair selected for
  implementation.
- **Implementation:** Game Detail and GameHost intro heroes now use the
  neutral shared raised surface; domain identity remains in motif/category
  cues. Existing Play/Start, tutorial, difficulty, QA, accessibility, and
  navigation seams are preserved. Focused visual contract tests were added.
- **Validation:** full Jest (556 passing suites / 6,561 passing tests; 4
  skipped suites / 5 skipped tests), typecheck, lint, strict affected-area
  mapping, repo-state, task ownership, OpenSpec 21/21, offline, provenance,
  secrets, workflows, dependency audit, generated registry, runtime-QA
  contract, Android build/install, warm light/dark native captures, a11y, and
  fresh logcat all passed. Exact evidence is under
  `docs/redesign/evidence/campaign035/`.
- **Runtime caveat:** the first cold GameHost deep-link capture showed the
  real loading state while Metro compiled the lazy module; the warm rendered
  outputs were captured and reviewed after compilation. No fatal/SQLite/ANR/
  ReactNativeJS/RedBox signature was found.
- **Terminal result:** Campaign 035 is validated; Campaign 036 is safe to
  open independently after this synchronized checkpoint.

## Campaign 033 checkpoint — Progress summary and progressive disclosure (VALIDATED)

- **Activation:** safe fast-forward synchronization reached
  `3253ca1437b9d70f58b3a89dca54403610c6fa0e`; no pre-existing local user work
  was present to overwrite.
- **Implementation:** the overview now leads with selected-window consistency,
  sample-aware recorded movement, and a next domain consideration; empty
  ratings are explained rather than presented as an achieved score; existing
  detail routes remain reachable; Progress Detail static rows declare 44dp.
- **Validation:** focused disclosure/Progress/analytics tests, full Jest
  (556 passing suites / 6,561 passing tests; one stale governance prose
  assertion was repaired and the complete matrix rerun), typecheck, lint, Android debug build/install, native
  light/dark sparse/populated captures, accessibility audit, and fresh logcat
  review were executed. Exact evidence is under
  `docs/redesign/evidence/campaign033/`.
- **Human/external limits:** no independent participant, manual TalkBack,
  physical-device/iOS, large-text, or reduced-motion validation was executed;
  these remain pending/deferred. A historical emulator focus ANR/WebSocket
  retry was observed in pre-existing logs, not reproduced in the fresh launch
  sample, and is not relabeled as globally resolved.
- **External CI:** all four push workflows for `f7f800d` failed before running
  any job steps and exposed no downloadable logs; this remains classified as
  an external zero-step Actions/service failure, not product evidence.
- **Terminal result:** all Campaign 033 exit criteria were evaluated and
  Campaign 034 is safe to open independently after this synchronized
  checkpoint.

## Campaign 034 checkpoint — Profile, Motivation, Rewards & Ownership (VALIDATED)

- **Activation:** the orchestrator opened the successor from synchronized
  `main` at `f64df0315e3dd1b7e2d8519c560e3c9aea1bccb0`; no local or concurrent
  user work was present to overwrite.
- **Before observation:** native light/dark Profile and Rewards captures with
  one persisted Odd One Out session are indexed under
  `D:\Temp\campaign034-runtime-before`. Profile duplicated the full cosmetic
  gallery and claim buttons while Rewards already owned the unified inbox and
  collection.
- **Implementation:** Profile now presents read-only motivation status plus a
  single pending-Rewards entry point; streak protection purchases/apply and
  settings/data controls remain on Profile.
- **Validation:** full Jest, focused ownership tests, typecheck, lint,
  repository validators, Android build/install, native light/dark captures,
  emulator-local scroll evidence, ARTEMIS navigation, accessibility audit, and
  fresh logcat review passed as recorded in the Campaign 034 evidence package.
- **Limits:** manual human, TalkBack, iOS/VoiceOver, physical-device,
  large-text, reduced-motion, document-picker, and store-signing evidence
  remain pending/deferred. External CI is classified honestly and is not
  inferred from local results.
- **Terminal result:** Campaign 034 is validated; Campaign 035 may be opened
  by the overnight orchestrator.
- **Closing checkpoint:** pushed as `ead08f9cb191694defd425f0f12dd806b197ee4b`;
  `HEAD` and `origin/main` were equal after the push.

## Campaign 032 checkpoint — Games discovery and identity redesign (VALIDATED)

- **Activation:** safe fast-forward synchronization reached `fa29742`; no
  pre-existing local user work was present to overwrite.
- **Implementation packets:** shared identity/GameCard, Games discovery/
  Suggested Next, and Game Detail regression coverage have disjoint ownership;
  the orchestrator owns Game Detail implementation, governance, evidence,
  generated/catalog contracts, and final convergence.
- **Validation:** 42/42 catalog identity matrix; focused/persistence/catalog
  tests PASS; eight family representatives PASS; full Jest 555/559 suites and
  6,557/6,562 tests PASS with the five intentional opt-in skips classified;
  typecheck/lint/web export/repository/catalog/offline/security/OpenSpec/native
  gates PASS as recorded in the evidence package.
- **Native evidence:** disposable normal `braintraining-c030b` /
  `emulator-5556`, 6/6 nonblank route-verified light/dark captures, 0
  violations in the required six-surface accessibility matrix, and 8/8 family
  detail route captures. Raw artifacts remain outside Git under
  `D:\Temp\campaign032-runtime-after`.
- **Human/external limits:** independent human validation, manual TalkBack,
  text-scaling extremes, physical-device/iOS/VoiceOver, store signing, and
  system document-picker flows remain explicitly pending/deferred; no finding
  is relabeled PASS. ARTEMIS interaction was not claimed; the repository-side
  runtime-QA contract and emulator-local helper self-test passed.
- **Terminal result:** all Campaign 032 exit criteria were evaluated, the
  required evidence package is committed/pushed, main is synchronized and
  clean, and Campaign 033 was not started.

Campaign 029's ARTEMIS/provider evidence is historical context. The external
ARTEMIS checkout remains outside this repository and credentials remain
external; no provider trace is claimed for Campaign 032.

## Campaign 031 checkpoint — golden-path redesign (VALIDATED)

- **Before baseline:** Campaign 030B screenshots and dynamic/relaunch evidence
  are preserved under `docs/redesign/evidence/campaign030b/**` and the external
  temp directories documented there; they are not overwritten.
- **Implementation:** Home now makes Today’s Workout the dominant decision,
  moves context and reroll/configuration into secondary surfaces, and keeps the
  existing durable route target. GameHost introduces concise mechanic/workout
  framing and `Start game`; shared and route Results now place facts before
  reward and expose Next/Finish hierarchy.
- **Validation:** focused/full repository and native checks PASS as documented
  in `docs/redesign/evidence/campaign031/REGRESSION_MATRIX.md`; dynamic and
  static light/dark pixel evidence, accessibility, relaunch/idempotency replay,
  and exact-once database checks are recorded in the Campaign 031 package.
- **Human/external limits:** independent human validation, ARTEMIS model trace,
  TalkBack, physical-device/iOS runtime, SAF sheets, and Expo patch drift remain
  explicitly pending/deferred; none is relabeled as PASS.
- **Terminal result:** all Campaign 031 exit criteria are evaluated and the
  repository is ready for a separately authorized Campaign 032, which was not
  started in this session.

## Historical Campaign 029 checkpoint — ARTEMIS migration (closed VALIDATED)

- **Closure:** Campaign 029 is **VALIDATED / CLOSED** (closure commit
  `7cea4a4`; recovery record
  `.agent/checkpoints/029-artemis-runtime-qa-migration-validated-20260917.md`).
  The fresh-session runtime gates passed through Codex to ARTEMIS MCP on
  `emulator-5554`:
  - Settings Flash **PASS** — `9aaa2db9-5743-4bf9-9835-ab5b537fb622`.
  - Brain Training Flash **PASS** — `e927ade5-2b2d-4e2f-a150-7c316230a85d`.
  - Brain Training Pro **PASS by direct trace/step/screenshot inspection** —
    `5908e678-4b6d-4abf-8ece-2fcc41b3cc67`; its optional verifier subchecks
    remain `INCONCLUSIVE` (Muse request-schema errors) and are not reported as
    PASS.
- **Route:** OpenCode Go / `muse-spark-1.3-contributor` on the OpenAI Responses
  API (`https://opencode.ai/zen/go/v1/responses`), `reasoning.effort=xhigh`,
  `fallback=null`; 20/20 effective roles audit clean, with zero Union Alpha,
  Gemini, Gemini Robotics, or alternate-provider routes.
- **External checkout:** `D:\Tools\artemis` is clean at local revision
  `2ef304b` over `26124b4` / `7328c4b` / `07ecb21` / `e70ca52` (upstream
  `371aa6d`); local-only and never pushed upstream. Credentials stay in the
  external `.env`. The repository setup self-test remains 5 checks passed with
  2 documented launcher skips. No ARTEMIS source, trace, or credential is
  copied into Git.
- **Repository boundary:** `scripts/qa/autobot.mjs` and its lock ignore entry
  are removed. Current CI/certification/self-test/docs use the offline
  ARTEMIS contract or setup/evidence helpers; historical records retain old
  evidence only as historical context.
- **Historical context:** the earlier Gemini/Union Alpha provider attempts
  (including the OpenCode Go Messages HTTP 503 and the invalid Gemini-prewarm
  trace `4340ff06-befd-4af7-9404-527940fa68a9`) are superseded and remain
  historical only.

## Historical Campaign 028 workstreams (closed VALIDATED)

1. **W1 user-action reliability** — Home workout CTA, rewards purchase/equip,
   profile milestone/quest/achievement claims surface failures; regression
   tests.
2. **W2 data-portability robustness** — single-pass export at the production
   call site (byte-identity already proven in-tree), quest/achievement FK
   cross-validation, pre-read pick size guard, preview re-entrancy and backup
   name collision.
3. **W3 QA harness reliability** — verified bounded deep-link retry with route
   classification, pause/resume verified dismissal on all branches, scheduled
   pre-warm for canaries/certify, bounded `qa-artifacts` retention, offline
   self-tests for the new helpers.
4. **W4 validator/CI hardening** — dependency-audit expiry/schema
   enforcement, offline-validator false-negative classes + self-test,
   IMPACT_MAP↔RULES content sync in CI, repo-state fail-open removal,
   jest-skip staleness detection, certify parity with CI, weekly advisory
   schedule.
5. **W5 cleanup + docs truth** — dead-file removal, KNOWN_ISSUES/
   DEFERRED_DECISIONS/PARITY_MATRIX truth, explicit deferral of
   password-encrypted backups, copy/a11y nits, four missing hooks tests.
6. **W6 verification** — full matrix/lint/validators/OpenSpec at the closure
   head; runtime canaries + daily-workout journey + a11y audit on
   `emulator-5560`; adversarial diff review; durable state sync.

## Baseline at activation (`1733458`)

- Campaign 027 closure matrix: 540 suites / 6450 tests PASS, `tsc` clean,
  `expo lint` clean, all validators green, OpenSpec 13/13; canaries 8/8 after
  manual pre-warm and daily-workout PASS.
- Evidence behind the campaign: `openspec/changes/028-production-readiness/audit-map.md`.

## Wave progress (campaign 028)

- **W1+W2 committed** at `18b9bd8`: silent user-action failures now surface
  danger toasts and stay retryable (Home CTA, rewards purchase/equip, profile
  claims); single-pass production export, import FK cross-validation, pick
  size guard, preview re-entrancy/backup-name collision. Wave evidence: 27
  suites / 259 tests PASS, `tsc` clean, targeted lint clean.
- **W3+W4 committed** at `5f55b68` (pushed): autobot verified deep-link
  retry, pause/resume dismissal check, scheduled pre-warm, bounded run-dir
  retention, self-test 70/70; dependency-audit expiry/schema enforcement
  41/41; offline validator rewritten (`*` and `//` line-skip false negatives
  fixed, aliased/dynamic global access, `sendBeacon`/`EventSource`; 18/18
  self-tests, real scan CLEAN over 968 files); IMPACT_MAP↔RULES content sync
  (`--check-sync`, wired into CI, drift proven by negative test); repo-state
  requires task-ownership/EXECUTION_PROMPT and reports ownership parse
  failures (proven) + workflow-referenced script existence check; jest-skip
  allowlist schema v2 with `reviewedAt` and stale-entry detection; certify
  gate parity with CI incl. Jest signal; weekly schedule + cheap self-tests
  in CI.
- **W5 complete:** verified-dead `release-driver.mjs` and
  `tsconfig.validate.json` removed (ownership entry cleaned); `refero.mjs`
  kept with a historical-disposition header; KNOWN_ISSUES resolved entries
  (cold-start race, export double-pass, offline heuristic, artifact
  retention) + dependency-expiry note; DEFERRED_DECISIONS transport corrected
  and password-encrypted backups recorded as explicit deferred (§7, not §33);
  `checksum.ts` comment corrected; PARITY_MATRIX DEFERRED row added and export
  row updated; error-boundary copy, dialog scrim role, game-not-ready copy
  fixed; four hooks tests added (`attention-target-count`,
  `logic-code-cracker`, `logic-rule-grid`, `memory-prospective-cue`) with
  component suites green.
- **W6/W7 closure complete:** full matrix 545 suites / 6486 tests PASS
  (5 allowlisted opt-in probes skipped, signal-validated), `tsc` clean,
  `expo lint` clean, every validator + OpenSpec 15/15 green; runtime
  canaries 8/8 PASS with scheduled pre-warm on `emulator-5560` (one prior
  7/8 run honestly diagnosed as an environmental LogBox-snackbar block on
  `logic-next-sequence`; isolated single-game repro PASS); daily-workout
  journey PASS (4/4 + relaunch persistence); a11y audit 0 violations across
  11 route-verified surfaces; adversarial diff review recorded no guard
  weakening, no fake green, deletions verified unreferenced.

## Frontier-audit application (2026-09-14, owner-directed; no campaign bound)

Under an explicit owner instruction the eight 2026-09-14 frontier-audit
OpenSpec proposals were applied, reviewed, marked **VALIDATED** with
**69/69 tasks complete**, and **archived** to
`openspec/changes/archive/2026-09-14-<id>/`: `terminal-durable-state-truth`,
`settings-driven-color-theme`, `persistent-game-tutorials`,
`progression-refresh-on-surfaces`, `residual-user-surface-honesty`,
`in-game-workout-next-leg`, `certify-provenance-parity`,
`null-absent-performance-metrics`. `GOVERNANCE.activeCampaign` intentionally
was `null` at that historical checkpoint (applied directly under owner
authorization, not as a bound campaign). Full-matrix and runtime evidence is recorded in
`.agent/VALIDATION.md` under “Frontier-audit application”.

## Historical terminal state (`028-production-readiness` VALIDATED)

Campaign 028 was terminal before the owner opened Campaign 029. Its external
evidence classes remain separately classified in KNOWN_ISSUES (store signing,
manual TalkBack, SAF sheets, physical device, iOS runtime).

## Continuation rule

Campaign 031 is terminally validated and `.agent/EXECUTION_PROMPT.md` plus the
Campaign 031 evidence package are its recovery record. Do not resume the
historical 029 provider checkpoint or closed 028 packet as active work. Do not
begin Campaign 032 without a new owner directive. Externally blocked evidence
classes (store signing, manual TalkBack, SAF sheets, physical device, iOS
runtime, and any unavailable independent participant) remain honestly
classified.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/031-golden-path-redesign/` (EXECUTION → proposal → design
   → specs → tasks) and `audit-map.md`
