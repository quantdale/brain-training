# Design — Campaign 006R Core Integrity Correction

## 1. Design principles

### 1.1 One authoritative completion result

A game owns raw mechanics and raw scoring. Shared progression owns XP, currency, and domain-rating consequences. The persistence boundary MUST return the authoritative completion outcome to UI so the player never sees a locally guessed/no-op XP value that differs from persisted state.

Preferred flow:

```text
game raw result
  -> game normalizer
  -> completed-session command
  -> shared progression computation
  -> one SQLite transaction
       session row
       rating changes
       currency award
       activity/progression side effects
  -> authoritative CompletionOutcome
  -> game/workout result UI
```

No game screen should need a default `noopXpRatingHook` for production progression display.

### 1.2 Difficulty evidence is canonical and typed

The SDK's canonical named values are lowercase: `easy | normal | hard | expert | adaptive`. Shared algorithms MUST use the same type, never stringly-capitalized aliases. A persisted session MUST contain enough information to recover the resolved challenge presented to the player, including final adaptive challenge where it changed during play.

The rating model SHOULD compare normalized performance against an expectation derived from continuous challenge evidence. Named difficulty may provide defaults, but adaptive/fine-grained challenge MUST not be thrown away.

### 1.3 Historical evidence is immutable; derived state is repairable

Completed sessions and their raw provenance are evidence. Corrective migrations may rebuild derived rating snapshots/history when necessary, but the strategy MUST be explicit, deterministic, idempotent, and documented. Never mutate past raw score/challenge facts merely to make current totals look cleaner.

### 1.4 Content/generator provenance is part of the scoring contract

Any change capable of altering which challenge is produced for the same `(seed, difficulty, round)` MUST advance a generator/content version. Curated packs need stable IDs/versions. Historical sessions MUST store exact version identifiers required to explain/replay their challenge.

CI SHOULD detect sensitive-file changes without corresponding version changes.

### 1.5 Validation occurs at the final generator boundary

All candidate sources—procedural, curated template, fallback—MUST pass the same invariant validator immediately before return/display. Tests against only the main random path are insufficient.

### 1.6 Durable workflow state, not React-only state

Anything with economic or progression meaning across app restart—workout reroll count, workout order/progress, claims, purchases, tutorial completion—MUST be persisted. React state may mirror durable state but may not be its authority.

### 1.7 Domain-level transactional commands

Economy actions SHOULD be expressed as durable commands (`spendCurrency`, `purchaseStreakItem`, `claimQuestReward`, `rerollWorkout`) that check prerequisites and commit all related effects in one SQLite transaction. UI code must not compose multi-step money operations itself.

### 1.8 Stable global identities for mergeable events

Transaction/reward/workout-operation records SHOULD use globally stable IDs or idempotency keys, not only device-local autoincrement IDs. A local sequence may remain for ordering, but merge identity must be future-sync-safe.

### 1.9 Shared UI primitives are allowed; game mechanics remain modular

Game modules remain self-contained for mechanics/generator/reducer/scoring. Repeated generic atoms such as GameButton, PauseOverlay frame, tutorial shell, QA shell, difficulty selector, result rows, and session header SHOULD converge into shared primitives where doing so reduces cross-catalog correctness drift. Do not centralize game-specific mechanics.

### 1.10 Machine-readable autonomy constraints

Swarm packets must state exact write surfaces. A validator SHOULD reject overlap, out-of-surface writes, direct edits of generated files, and unauthorized shared-surface ownership before parallel work begins.

## 2. Data model direction

The exact migration version is implementation-owned, but the model MUST support:

- full semantic game/generator/scoring/content version identifiers;
- tutorial completion keyed by `(game_id, tutorial_version)`;
- daily workout instance keyed by local date with ordered game IDs, reroll attempt, status, current index, timestamps, and deterministic seed/version inputs;
- idempotent economy operations with stable operation IDs;
- balance-safe transactional spending;
- exact distinct activity-date query or activity table for streak reconstruction;
- authoritative applied rating deltas and evidence timestamps;
- startup rejection when DB `user_version` is newer than supported code.

Migration design MUST preserve existing rows and include tests from pre-change schema to the new schema.

## 3. Rating correction strategy

Before choosing a historical repair implementation, inventory whether existing sessions contain sufficient difficulty/challenge/provenance to deterministically recompute intended rating movement. If yes, prefer an idempotent derived-state rebuild command/migration that leaves session rows untouched. If evidence is insufficient for a subset, do not fabricate it; mark the limitation, define a cutover policy, and preserve auditability.

The implementation MUST distinguish:

- requested delta;
- applied delta after floor/cap;
- resulting rating;
- event/evidence time;
- processing time if separately useful.

## 4. Word Match redesign

The current family model makes every option a synonym, which is incompatible with single-answer scoring. The redesigned schema MUST make correctness unambiguous. Acceptable designs include:

- one true synonym plus three semantically plausible non-synonyms; or
- a clearly defined relation stronger than broad synonym family membership.

The validator MUST mechanically reject duplicate options, prompt-as-option, multiple accepted answers where machine-detectable, malformed tiers, and invalid references. Curated semantic quality still requires review/tests beyond schema validity.

Until repaired and validated, Word Match SHOULD be excluded from rating-bearing automated workout selection or otherwise prevented from contaminating domain ratings.

## 5. Equation Builder validity

The solver/validator must model the same grammar the UI permits: allowed operators, use-all-number rule, grouping/parentheses semantics, division behavior, integer/rational constraints, and ordering/permutation rules. Every returned puzzle MUST be proven solvable under the active difficulty rules. Curated templates are candidates, not trusted bypasses.

## 6. Today's Workout state machine

Conceptual states:

```text
not-created -> active(index 0..3) -> completed
                   |                 ^
                   +-- interrupted --+
```

A daily instance stores the selected ordered games and remains stable across restart. Completing a game in workout context advances the durable index only after the session has successfully persisted. The compact result has a `Next Game` action until game 4, then a workout-complete action/summary.

Personalized selection MUST operate on the full eligible catalog before selecting four. It should combine weakness, neglected domains, recent-game penalty, consecutive-day avoidance, diversity, controlled seeded randomness, and occasional stronger-domain variety. The exact weights can be implementation constants with tests documenting behavior.

Reroll is a durable operation against the daily instance. First reroll is free; later rerolls debit currency transactionally. Restart cannot reset attempts or grant another free reroll.

## 7. Failure behavior

- DB initialization failure: render a clear recoverable storage-unavailable state; do not silently pretend persistence exists.
- Unsupported newer DB schema: refuse normal write startup with explicit compatibility error.
- Session persistence failure: do not claim progression as saved; allow deterministic retry when safe.
- Economy operation failure: either all effects commit or none do.
- Validation/tool unavailable: record `NOT VALIDATED`/`BLOCKED`; never convert to PASS.

## 8. Test strategy

Use layered evidence:

1. pure/unit tests for algorithms and validators;
2. SQLite integration tests using real transactions/migrations;
3. cross-subsystem contract tests using real registry + session completion + DB + presentation adapter;
4. all-difficulty, many-seed generator property sweeps;
5. one-AVD journeys for restart/pause/workout/economy/tutorial/result flows;
6. CI integrity checks for generated registry, OpenSpec state, packet ownership, provenance/version drift, lint/typecheck/tests/export/doctor.

Large test count is secondary to scenario coverage.