# Tasks — 006R Core Integrity Correction

Checkboxes are durable execution state. Mark `[x]` only after implementation **and** the listed validation pass. If partially done, leave unchecked and add a short evidence note below the item or in `.agent/VALIDATION.md`.

## 0. Restore trustworthy baseline — BLOCKING

- [x] 0.1 Sync canonical `main`; record starting SHA and working-tree status without discarding user changes.
- [x] 0.2 Repair current Campaign 006 TypeScript errors in Equation Builder tutorial by correcting types/logic, not using `any`, `@ts-ignore`, disabled checks, or assertion-only casts that hide invalid state.
- [x] 0.3 Run repository-state validator, typecheck, full Jest, registry `--check`, web export, and Expo Doctor as available.
- [x] 0.4 Do not push the repair until local typecheck is green; then commit/push a coherent baseline repair and verify GitHub CI.
- [x] 0.5 Record any inherited failing test/environment condition as BLOCKED/NOT VALIDATED with exact reproduction.

## 1. Progression/rating authoritative outcome — BLOCKING

- [x] 1.1 Replace capitalized rating/XP difficulty keys with the canonical typed lowercase `DifficultyLevel` contract.
- [x] 1.2 Define and test expected-performance calculation from resolved continuous challenge; named modes provide defaults, adaptive uses final challenge evidence.
- [x] 1.3 Ensure persisted difficulty/challenge data captures the actual session challenge used by the rating algorithm.
- [x] 1.4 Define `CompletionOutcome` returned by the authoritative session-completion boundary: persisted session, XP, currency award, per-domain applied deltas/resulting ratings, balance, records if available.
- [x] 1.5 Remove production reliance on per-game no-op XP for displayed result. Local game result/workout result must render the authoritative outcome after successful persistence.
- [x] 1.6 Add cross-subsystem tests using real canonical lowercase difficulty values for Easy/Normal/Hard/Expert/Adaptive.
- [x] 1.7 Prove Easy cannot inflate rating at trivial expected performance, while higher challenge changes expected performance appropriately.
- [ ] 1.8 Inventory historical session evidence; implement an explicit idempotent derived-rating rebuild/cutover strategy, or document evidence gaps and an auditable cutover. Never alter raw completed-session evidence.

## 2. Content/generator provenance — BLOCKING prerequisite for 3/4

- [x] 2.1 Inventory all 20 games: procedural generator, curated pack, hybrid; identify files that affect challenge identity.
- [x] 2.2 Standardize full semantic version identifiers for game/scoring/generator/content provenance and define which fields are required per game type.
- [x] 2.3 Ensure persisted sessions record exact provenance needed to explain/replay challenges.
- [x] 2.4 Bump versions for Campaign 006 changes that altered candidate pools/algorithms; do not retroactively label changed content as unchanged `1.0.0`.
- [x] 2.5 Add deterministic replay/snapshot tests for representative procedural, curated, and hybrid games.
- [ ] 2.6 Add CI/validator that detects sensitive generator/content changes without the required version bump, with an explicit documented allowlist/override mechanism for non-semantic edits.

## 3. Word Match semantic correction — BLOCKING

- [ ] 3.1 Freeze Word Match from rating-bearing workout selection until corrected, unless the repair is completed atomically in the same wave.
- [ ] 3.2 Redesign content schema so exactly one option satisfies the scored relation.
- [ ] 3.3 Replace ambiguous items; no question may mark one arbitrary answer correct when multiple displayed choices are legitimate synonyms under the stated instruction.
- [ ] 3.4 Update validator and tests for uniqueness, malformed references, duplicate options, prompt leakage, tier validity, and semantic contract.
- [ ] 3.5 Advance content version and prove old/new provenance are distinguishable.
- [ ] 3.6 Emulator-smoke at least several rounds and difficulty tiers.

## 4. Equation Builder solvability — BLOCKING

- [ ] 4.1 Define one evaluator/grammar contract shared conceptually by UI, solver, tutorial, and generator validation.
- [ ] 4.2 Every returned puzzle path—curated, procedural, fallback—must run the final solvability validator using the active difficulty's allowed operators and exact UI rules.
- [ ] 4.3 Remove/repair any curated template that is invalid for a difficulty instead of trusting target/count range alone.
- [ ] 4.4 Property-sweep every named difficulty across a large deterministic seed set; assert valid number count/range, allowed operators, solvability, finite result, no illegal division, and no duplicate/near-duplicate violation required by the game.
- [ ] 4.5 Tutorial demo must use the same legal grammar/evaluator and compile without type suppression.
- [ ] 4.6 Advance generator version when challenge mapping changes.

## 5. Tutorial persistence

- [ ] 5.1 Add persistent tutorial storage keyed by game ID + tutorial version.
- [ ] 5.2 Complete/QA-skip persists; replay request is explicit and does not erase completion semantics.
- [ ] 5.3 Route/game construction injects the persistent store by default in production; in-memory store remains test utility only.
- [ ] 5.4 Add migration and tests for first play -> complete -> unmount -> remount -> app restart simulation.
- [ ] 5.5 Verify all 20 games use the shared lifecycle contract.

## 6. Real Daily Workout + personalization — BLOCKING product loop

- [ ] 6.1 Add persistent daily workout instance keyed by local date with ordered four-game selection, status, current index, reroll attempt, seed/selection version, and timestamps.
- [ ] 6.2 Starting a workout enters workout context; successful game persistence advances to compact result then `Next Game`; game four completes workout.
- [ ] 6.3 Kill/relaunch or navigation interruption resumes the durable workout without duplicating completed games/rewards.
- [ ] 6.4 Personalization selects from the full eligible catalog using weakness, neglected domains, recency, previous-day overlap, domain diversity, seeded randomness, and occasional strength variety; it may not merely reorder an already fixed four.
- [ ] 6.5 Persist reroll attempts by date. First reroll free; later rerolls are transactional currency operations; restart never restores the free reroll.
- [ ] 6.6 Define how reroll treats already-completed workout positions (prefer immutable completed prefix; reroll only future slots).
- [ ] 6.7 Add deterministic tests for same-input selection, different reroll attempt, neglected-domain surfacing, recency avoidance, diversity, and catalog sizes near/below four.
- [ ] 6.8 AVD journey: workout 1/4 -> result -> next -> interrupt/relaunch -> resume -> 4/4 -> completion.

## 7. Economy transactionality

- [ ] 7.1 Implement transactional `spendCurrency` that checks current balance and appends debit in the same transaction; balance cannot go below zero through supported commands.
- [ ] 7.2 Implement atomic streak-item purchase: balance validation + debit + inventory grant in one transaction/idempotent operation.
- [ ] 7.3 Make quest and achievement claims atomic/idempotent: claimed marker and all XP/currency rewards commit together.
- [ ] 7.4 Make paid workout reroll atomic with its persisted workout state transition.
- [ ] 7.5 Add globally stable operation IDs/idempotency keys suitable for future merge/sync; keep local sequence IDs only as optional ordering metadata.
- [ ] 7.6 Prevent gameplay session completion API from double-awarding currency through ambiguous caller + rating-service reward ownership.
- [ ] 7.7 Failure-injection tests at every transaction step prove all-or-nothing behavior and safe retry.

## 8. Database integrity

- [ ] 8.1 Add migration-backed CHECK constraints or equivalent enforced invariants for normalized result `[0,1]`, nonnegative XP, nonnegative rating, and other cheap canonical constraints.
- [ ] 8.2 Reject startup/write operation when `PRAGMA user_version` is newer than supported schema; expose explicit compatibility state.
- [ ] 8.3 Store full semantic version information needed for game/generator/scoring/content provenance; preserve legacy fields only when migration compatibility requires them.
- [ ] 8.4 On canonical DB initialization failure, show recoverable storage-unavailable UI rather than silently rendering an apparently healthy persistent app.
- [ ] 8.5 Test migration from the pre-006R schema with realistic historical sessions, ratings, ledger, quests, achievements, and profile settings.
- [ ] 8.6 Test migration rollback and repeated/idempotent initialization.

## 9. Rating/progress correctness

- [ ] 9.1 Persist actual applied rating delta after floor/cap, not requested delta if they differ.
- [ ] 9.2 Rating evidence freshness uses contributing session event time; processing/import time may be stored separately but must not make old evidence look fresh.
- [ ] 9.3 Replace Home's arbitrary 30-session streak input with distinct activity dates/canonical activity query.
- [ ] 9.4 Results loads exact rating history for selected session rather than filtering only the latest global 50 movements.
- [ ] 9.5 Implement transparent overall cognitive/performance composite from domain ratings with documented handling of unseen/stale domains.
- [ ] 9.6 Home Recent Games renders real recent session/game data rather than unconditional placeholder.
- [ ] 9.7 Cross-screen tests prove Home/Profile streak agreement under high-density play (many sessions/day), Progress/Results rating agreement, and stale behavior.

## 10. Game-platform convergence

- [ ] 10.1 Cache lazy-loaded game component identity outside route render; registry generator remains source of generated loader code.
- [ ] 10.2 Build shared generic Game UI primitives where repeated copies cause cross-catalog drift (at minimum evaluate button, pause overlay/frame, tutorial frame, QA panel shell, result row, difficulty selector/session header).
- [ ] 10.3 Migrate incrementally without centralizing game mechanics; prove representative canary games still work.
- [ ] 10.4 Wire production audio/haptics service or explicitly classify seam as deferred; settings that claim persistence must actually persist. Do not present no-op functionality as implemented.
- [ ] 10.5 Error boundary retry must reset the crashed game subtree safely and preserve diagnostic context.
- [ ] 10.6 Audit duplicate Memory mechanics; either materially differentiate Pattern Tap Back/Sequence Memory/Memory or document a deliberate variant consolidation plan. Fix documentation that claims random-walk adjacency when implementation does not do it.

## 11. Autonomous governance + CI semantic gates

- [ ] 11.1 Define machine-readable task packet ownership (exact paths/globs, shared surfaces, dependencies).
- [ ] 11.2 Validator rejects overlapping parallel write surfaces, undeclared writes when detectable, direct generated-file edits, and coder ownership of orchestrator-only surfaces.
- [ ] 11.3 App CI includes lint, repo-state/OpenSpec integrity, registry `--check`, provenance/version check, task-ownership check, typecheck, tests, web export, Expo Doctor; offline-boundary validator if stable.
- [ ] 11.4 Add cross-subsystem contract suite exercising real lowercase difficulties, real session completion, real DB, authoritative outcome, rating history, currency and presentation adapter.
- [ ] 11.5 Triage dependency audit findings into production-reachable vs dev/transitive; no blind forced upgrade. Record accepted debt with rationale.
- [ ] 11.6 Add green-main rule to continuation workflow: coherent push requires local typecheck and risk-based required checks unless explicitly BLOCKED with documented reason.

## 12. Full 20-game exit gate — FINAL

- [ ] 12.1 Registry contains exactly expected existing catalog; no unauthorized new games/content breadth slipped in.
- [ ] 12.2 Every game passes metadata/version/provenance contract.
- [ ] 12.3 Every procedural/hybrid generator passes all named difficulties over deterministic seed sweep; every curated pack passes structural/content-specific validators.
- [ ] 12.4 Every game can start, pause/background where applicable, finish/force finish in QA, persist exactly one session, and surface authoritative result.
- [ ] 12.5 Tutorial completion persists across restart for every game contract.
- [ ] 12.6 Economy failure-injection suite green; no supported operation yields negative balance or partial reward/item state.
- [ ] 12.7 Daily Workout full AVD journey and restart/resume journey green.
- [ ] 12.8 DB newer-schema and initialization-failure UX tests green.
- [ ] 12.9 One-AVD smoke across category canaries plus targeted Word Match/Equation Builder/workout/progression journeys; capture logs/hierarchy/screenshots when supported.
- [ ] 12.10 Repository validator, OpenSpec validation, ownership/provenance checks, lint, typecheck, full Jest, registry check, web export, Expo Doctor all green.
- [ ] 12.11 GitHub App CI + Repository Integrity green on final SHA.
- [ ] 12.12 No unresolved Critical/High issue; Medium/Low debt recorded with closure criteria.
- [ ] 12.13 `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, parity/docs, and completion checkpoint match actual code/CI.
