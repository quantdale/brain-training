# Campaign 031 closure — golden-path redesign

Date: 2026-09-17
Campaign: `031-golden-path-redesign`
Mode: day
Verdict: **`CAMPAIGN_031_COMPLETE_READY_FOR_032`**

## Scope and Git lineage

The repository was first fast-forwarded safely from local `cb06df3` to remote
`44ba1533f4eb5ebcd795723f801633caee914e17`; there were no local-only commits
or pre-existing worktree changes to overwrite. Remote `main` then received the
concurrent Campaign 029 documentation checkpoint `5e9d3009ee1766f02ebfe2cdaae291204580ad69`.
The Campaign 031 implementation was reconciled on that latest `main` before
the product changes. No stash, reset, checkout, force operation, or deletion
of user work was used.

Final implementation/evidence commit: `ad15e23d386e453590aae69cb33c4c427c27e1b8`.
This commit contains the product source, evidence package, and terminal state
transition. The final handoff must verify the terminal documentation checkpoint
also has `HEAD == origin/main` and an empty `git status --porcelain`; its exact
final SHA is reported after that push.

## What changed

The exact materially changed product source/test files are:

- `apps/mobile/src/app/(tabs)/index.tsx`
- `apps/mobile/src/app/results.tsx`
- `apps/mobile/src/components/game-host/game-host.tsx`
- `apps/mobile/src/components/game-host/results.tsx`
- `apps/mobile/src/components/game-ui/game-button.tsx`
- `apps/mobile/src/components/workout/template-details.tsx`
- `apps/mobile/src/workout/templates.ts`
- `apps/mobile/src/components/game-host/__tests__/game-host.test.tsx`
- `apps/mobile/src/components/game-host/__tests__/in-game-workout-actions.test.tsx`
- `apps/mobile/src/app/__tests__/__snapshots__/visual-baselines.test.tsx.snap`

The structural behavior now is:

1. Home gives Today’s Workout one dominant Start/Continue action, visible
   plan length/estimate, progress, current next leg, and concise rationale.
   Reroll, focus selection, streak, XP, coins, and level remain available in
   secondary surfaces. A completed day says `Workout complete`, shows `4/4`
   saved, and changes the primary action to Today’s progress.
2. The existing workout route carries the same persisted instance/provenance
   into GameHost. The intro leads with identity, a one-sentence mechanic,
   difficulty/time metadata, tutorial/example, and `Start game`; the tutorial
   remains persistent and development-only QA controls remain bounded.
3. Active GameHost play keeps the existing board, HUD, timers, round progress,
   pause, background lifecycle, reducer, scoring, and game-specific mechanics.
   The redesign changes hierarchy and copy, not game rules.
4. Shared and route Results read as outcome → player facts → bounded reward →
   one context-appropriate next action. Workout-owned results expose `Next
   game` with the persisted next-leg context; the final leg exposes
   `Finish workout`, `4/4 games complete`, and an explicit saved completion.
   Standalone results retain `Play again` as their primary action.
5. Final workout navigation clears the pushed game stack with the existing
   router surface and returns to Today; it cannot land on a previous result
   after the last leg.

## Protected contracts verified

- No schema, migration, backup format, game module, scoring rule, generator
  rule, dependency, CI workflow, Games discovery, Progress, Profile, Rewards,
  or economy implementation was changed.
- Existing workout instance identity, deterministic selection metadata,
  workout provenance, GameHost lifecycle, pause/background behavior, session
  identity, SQLite writes, tutorial persistence, rating history, XP/currency
  ledger, reward idempotency, offline boundary, generated registry, and
  semantic IDs remain on their existing seams.
- The clean dark replay ended with `workout_instances = 1` and the exact
  persisted game order `memory-prospective-cue`, `language-context-fit`,
  `spatial-transform-match`, `spatial-fold-match`, status `completed`, and
  current index `4`.
- The same SQLite file hash was observed before and after force-stop/relaunch:
  `12C763AC74D1363BE006D7E1A909B969E2B804C4C320BD7F8B7B26F40DE11DB9`.
  It contained 4 sessions, 4 currency rows, 7 rating rows, one completed
  workout, no duplicate `(session_id, domain)` rating keys, no duplicate
  currency operation IDs, and versioned game session metadata on every row.

## Runtime and visual evidence

Runtime target: disposable normal phone-oriented Pixel 7 AVD
`braintraining-c030b`, serial `emulator-5562`, Android 35 Google APIs
x86_64, 1080×2400, density 420, 1536 MB RAM, Emulator 37.1.11, host GPU.
The protected `braintraining-ui35` / `emulator-5554` was not touched.

The stateful native journey captured real rendered pixels and UIAutomator
trees in light and dark mode for Home, persisted workout handoff, intro,
tutorial/example, active gameplay, pause, resume, relaunch, Result 1, later
legs, final completion, and completed Home. The raw evidence remains outside
Git under `D:\Temp\campaign031-runtime`; the before package remains unchanged
under `D:\Temp\campaign030b-*` and is indexed in Campaign 030B evidence.

The final APK was rebuilt and reinstalled successfully:

- `:app:assembleDebug --no-daemon`: **PASS**, 353 actionable tasks,
  55 executed / 298 up-to-date.
- APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`
- Final static capture: 6/6 light/dark Home, Game route, and Results captures
  nonblank and route-verified by `ui-capture`; the standalone game deep link
  honestly rendered the loading boundary, so stateful dynamic intro evidence
  is the authority for the actual workout intro claim.
- Dynamic accessibility audit: 0 violations across 70 captured state trees.
- Final static accessibility audit: 0 violations across 6 captures.
- Final logcat review: 46,002 lines; no fatal exception, AndroidRuntime fatal,
  RedBox, or invariant-error pattern.

## Validation result

- TypeScript: **PASS** (`npm run typecheck`).
- Lint: **PASS** (`npm run lint`).
- Focused changed-surface tests: **PASS**, including GameHost, shared
  GameResults, in-game continuation, `/results`, Home, and visual baselines.
- Representative family canaries: **PASS**, 8 suites / 82 tests across visual
  search, memory, reaction, math, language, logic, flexibility, and spatial.
- Full CI-mode Jest: **PASS**, 553/557 suites passed, 0 failed; 6,549/6,554
  tests passed, 0 failed; 5 snapshots passed. The four suites/five tests
  skipped are the existing explicit Campaign 016 opt-in performance/large
  backup probes; Jest-signal classified all 5 with 0 unexpected skips.
- Registry, provenance, offline, secrets, workflow hygiene, dependency audit,
  task ownership, affected-map, repository-state, OpenSpec, and runtime-QA
  contract validators: **PASS**. OpenSpec validates all changes.
- Android setup/self-test: **PASS**, 5 passes / 0 failures / 2 documented
  warning skips caused by the launcher hierarchy before the app is foreground.
- Web export: **PASS**, 47 bundles and 20 static routes.
- Expo Doctor: **20/21**, one known patch-drift check failed for 14 Expo SDK
  packages. This is pre-existing dependency maintenance explicitly excluded
  by Campaign 031; no dependency churn was introduced.

## Human and external validation status

No independent participant was genuinely available in this execution
environment. `HUMAN_VALIDATION_PENDING.md` is included with the exact seven
tasks, observation fields, and acceptance questions; no human findings are
invented. The technical operator run used emulator-local ADB and explicit
development-only force-win controls, so it is not labeled human usability
validation.

The preferred ARTEMIS MCP transport returned `Transport closed` for the target
diagnostic, and the external CLI retry stopped before UI interaction with
`MissingSessionID`. Direct ARTEMIS doctor was ready, but no ARTEMIS model trace
is claimed. Campaign 030B explicitly authorizes the bounded ADB fallback when
the provider/harness route is unavailable; all actual UI input remained
emulator-local and no credentials or traces were copied into Git.

## Remaining issues and next campaign

The following remain explicitly non-green but are not Campaign 031 critical
product blockers: independent human/TalkBack review, physical-device and iOS
runtime UX, SAF/system-sheet review, ARTEMIS provider-backed trace, Expo patch
drift, and existing external GitHub zero-step workflow classification. The
Campaign 030B localized 43dp Progress Detail rows were not touched by this
golden-path change and remain carried-forward debt.

All Campaign 031 exit criteria are satisfied with those explicit handoffs.
Campaign 032 may begin after this terminal state is reviewed; this session did
not begin Campaign 032.
