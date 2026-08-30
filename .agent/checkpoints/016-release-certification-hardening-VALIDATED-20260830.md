# Campaign 016 — Terminal Validation Checkpoint

**Status:** VALIDATED — terminal repository state
**Campaign:** `016-release-certification-hardening`
**Date:** 2026-08-30
**Branch:** `main`
**Convergence start SHA:** `f0d301bc1b80ed657c75af81c476ee87dbeea540`
**Final certified source SHA:** `d987ab4dc058ee64b137490495b86b573f9764fa`
**Final main SHA:** the terminal checkpoint commit containing this file; its
exact value is verified by the final `git rev-parse HEAD` and exact-SHA GitHub
Actions wave recorded at handoff. The certified source SHA above contains all
implementation and lifecycle changes; this checkpoint is documentation-only.
**Origin parity:** required and verified at final handoff with `HEAD ==
origin/main`.
**Working tree:** required clean at final handoff; generated test/export
artifacts are not retained.

## Decision

Campaign 016 closes as:

> **LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING**

Repository-owned implementation, automated certification, native build-smoke,
and exact-source CI evidence are complete. The remaining Android runtime and
manual platform evidence is genuinely external/unavailable and remains
explicitly `BLOCKED`, `NOT VALIDATED`, or `DEFERRED`. No Campaign 017 was
created, and no game #43 or unrelated product scope was added.

## Repository identity and lifecycle

- Start: clean `main` at `f0d301bc1b80ed657c75af81c476ee87dbeea540`, with
  `origin/main` at the same SHA and no open pull requests.
- Convergence commit: `d987ab4dc058ee64b137490495b86b573f9764fa`, containing
  the terminal lifecycle reconciliation, validator terminal-state support,
  fresh evidence, and stale-branch decision.
- OpenSpec `change.json` is `VALIDATED`. `GOVERNANCE.activeCampaign` is
  explicitly `null`; `lastCampaign` is
  `016-release-certification-hardening`; `lastCampaignStatus` is `VALIDATED`.
- `STATE.md`, `CURRENT_CAMPAIGN.md`, `EXECUTION_PROMPT.md`, and
  `.agent/task-ownership.json` agree on the same terminal campaign. The
  terminal ownership record has no active coder packets; historical packet
  evidence remains in the task log and prior checkpoints.
- The older Android timeout is retained as historical evidence: run
  `33239131146` on `31a6143` stalled at `:app:compressReleaseAssets` and was
  cancelled at the 60-minute limit. It is not presented as the current result.

## Automated certification matrix

| Gate | Result and evidence |
| --- | --- |
| Repository state | PASS — `node scripts/validate-repo-state.mjs`; explicit terminal state reports no active campaign and 016 `VALIDATED` |
| OpenSpec | PASS — `npx --yes @fission-ai/openspec@1.6.0 validate --all`, 3/3 changes |
| Task ownership | PASS — `node scripts/validate-task-ownership.cjs`, terminal ownership with no active packets |
| Game registry | PASS — `node scripts/generate-game-registry.mjs --check` |
| Provenance | PASS — `node scripts/validate-provenance.mjs --check` |
| Offline boundary | PASS / CLEAN — 932 source files scanned |
| QA self-test | PASS — `node scripts/qa/autobot.mjs --self-test`, 49/49 |
| TypeScript | PASS — `npm run typecheck` |
| Lint | PASS — `npm run lint`, 0 errors / 0 warnings |
| Jest | PASS — 489 suites passed, 4 allowlisted skipped; 6,056 tests passed, 5 allowlisted skipped; 0 failures; 5 snapshots passed |
| Jest skip/warning signal | PASS — `validate-jest-signal.mjs` reports 0 unclassified, 0 ambiguous, and 0 unexpected warnings |
| Expo Doctor | PASS — 21/21 |
| Web export | PASS — 20 static routes |
| DB integrity/idempotency | PASS — current focused matrix and full Jest; duplicate delivery, constraints, rollback, lock, and degradation paths covered |
| Migrations | PASS — migration matrix, robustness, and v10 hardening suites |
| Backup/restore/rollback | PASS — 14 data-portability suites / 129 tests in the focused run, including adversarial and rollback cases; large-memory probe is the one allowlisted opt-in skip |
| Workout/persistence | PASS — focused DB/portability/workout run: 37 suites / 390 tests, one allowlisted opt-in skip |
| Production/security boundary | PASS — 6 suites / 28 focused tests; forbidden permission, QA-hook, storage-unavailable, and offline checks |
| Dependency audit | CLASSIFIED — full and `--omit=dev` each report 0 critical, 0 low, 12 moderate, 4 high, 16 total; all are classified build/dev-toolchain-only in `.agent/DEPENDENCY_AUDIT.md` |
| Secret scan | PASS — no tracked private keys, tokens, or secret-pattern hits |
| Performance probes | PASS — Node 22.23.2; `loadProgressSnapshot_20000=112.691259ms`, `exportLocalData_5000` with checksum `5155.865523ms`, second canonical serialization `936.613833ms`, `syncQuestProgress_20000=37.63658ms`, `syncAchievements_20000=98.749851ms` |

The ordinary local `npm ci` path was attempted but cannot compile
`better-sqlite3` on this host because `make` is unavailable. The documented
clean-run `npm ci --ignore-scripts` path passed under Node 22.23.2 and the
GitHub clean runners completed their normal install. This is not a product
failure or a reason to relabel the passing CI evidence.

## Native/platform matrix

| Platform gate | Result and evidence |
| --- | --- |
| Android clean native generation/build | PASS — Android Build Smoke `33293614561`, exact source SHA `f0d301bc1b80ed657c75af81c476ee87dbeea540`, job `Android clean native build`; clean generation, release APK compilation, release-boundary verification, and artifact upload |
| iOS simulator compile | PASS — iOS Build Smoke `33293614540`, same exact source SHA, job `iOS simulator compile smoke`; clean prebuild, CocoaPods, unsigned simulator compile |
| App CI | PASS — `33293614545`, same exact source SHA, job `Mobile app build/typecheck/tests` |
| Repository Integrity | PASS — `33293614543`, same exact source SHA, job `durable-state` |

These four runs are independently verified current-head evidence for the
source SHA, and the final pushed terminal SHA receives a new exact-SHA wave
before handoff. iOS compile success is not manual iOS runtime UX success.

## Device and manual matrix

| Evidence | Classification | Reason |
| --- | --- | --- |
| Android dedicated install/start | BLOCKED / NOT VALIDATED | No designated `braintraining-qa36` AVD or physical ADB fallback is available; the only connected `study-maker-api35` emulator is foreign and was not used |
| Rule Grid / Transform Match / post-015 canaries | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Workout V3 daily/focus/relaunch | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Current-head 42/42 `autobot --mode certify` | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Android hierarchy | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Emulator recovery | BLOCKED / NOT VALIDATED | Bounded 37.1.11/WHPX/qemu recovery reproduced the documented external failure; no blind retry or foreign-AVD substitution |
| TalkBack/manual accessibility | NOT VALIDATED | No manual accessibility session was performed |
| SAF/share/document-picker system sheets | NOT VALIDATED / DEFERRED | System consent UI is outside the emulator-local autobot policy |
| Physical-device behavior / refresh rate | NOT VALIDATED | No physical device is connected |
| iOS runtime UX | NOT VALIDATED / DEFERRED | No interactive macOS/iOS UX session was performed |
| Signing/store publication | DEFERRED | Constitution-deferred scope |

## Defect statement

- Unresolved Critical defects: **0**.
- Unresolved High defects: **0**.
- Material data-loss/corruption defects: **0**.
- Remaining Medium/Low items are external/manual platform limitations or
  accepted build-toolchain audit findings, not hidden product defects.

## Stale addon branch disposition

The remote branches `feat/repo-local-addons-2026-08-28` and
`plan/repo-local-addons-2026-08-28` were compared at content level before
deletion. No content was salvaged:

- The feature branch's root `.mcp.json` conflicts with the current onboarding
  policy, which deliberately commits no root MCP configuration and directs
  agents to the existing ADB/QA harness.
- Its handoff/master-plan text describes optional network-resolved Context7
  and Mobile MCP integrations that duplicate or sit outside the current
  repository-local agent structure.
- Its two validation scripts only probe that obsolete config and add no
  guarantee beyond the existing repository validators/QA harness.
- The plan branch contains only the same obsolete planning document.

Both remote branches were deleted explicitly after this comparison. No local
copies existed; final `git fetch --prune` must show only `origin/main`.

## Recovery rule

Do not reopen Campaign 016 or create Campaign 017 solely for the unavailable
device/manual evidence. If the owner later authorizes new scope, open a new
OpenSpec campaign deliberately and preserve this checkpoint as the terminal
016 record.
