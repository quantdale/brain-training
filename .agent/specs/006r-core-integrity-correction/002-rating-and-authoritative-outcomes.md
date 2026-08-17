# 002 — Rating Difficulty Semantics and Authoritative Session Outcomes

**Priority:** P1 / blocking  
**Depends on:** 001  
**Primary surfaces:** `apps/mobile/src/rating/**`, `apps/mobile/src/db/**`, Game SDK result contracts, game session builders/screens, result UI  
**Shared-file owner:** orchestrator

## Problems to correct

1. The SDK's canonical `DifficultyLevel` values are lowercase (`easy`, `normal`, `hard`, `expert`, `adaptive`) while the shared rating/XP policy currently uses capitalized lookup keys. Real sessions therefore fall through to fallback behavior.
2. Adaptive and fine-grained difficulty already produce a continuous `challengeRating`, but the central rating policy is dominated by coarse named difficulty and persisted `difficulty.challengeRating` can remain the initial profile value instead of the final session challenge.
3. Game screens calculate/display XP through the default `noopXpRatingHook` (0 XP), while `SessionRepository.completeSession()` later computes and persists authoritative XP/currency/rating. The player can see 0 XP even though the DB awards a nonzero amount.
4. Existing derived domain ratings/history may have been produced by the defective policy.

## Required architecture

### A. One canonical difficulty representation

- `DifficultyLevel` from the SDK is the single source of truth.
- All policy tables/functions must be typed against `DifficultyLevel` or `Exclude<DifficultyLevel, ...>` so casing drift becomes a compile-time error.
- Do not add case-insensitive string fallbacks as the primary fix. Boundary parsing may normalize legacy data, but internal code must remain canonical.
- Add tests that feed the exact values persisted by every named mode and prove each mode uses its intended policy.

### B. Persist the **final** challenge rating

For every completed session:

- `GameSessionRecord.difficulty.level` = canonical selected named mode.
- `GameSessionRecord.difficulty.challengeRating` = the final effective challenge for that completed session, including adaptive escalation/de-escalation.
- `difficulty.parameters` = the parameters needed to interpret the challenge.
- Raw result diagnostic metadata may duplicate the challenge value for provenance, but the structured session difficulty must be authoritative for the shared progression engine.

Audit all 20 game session builders. Do not assume they all serialize adaptive state the same way.

### C. Make rating policy challenge-aware and player-skill-aware

The repaired policy must satisfy these behavioral invariants rather than merely changing map key casing:

1. Harder effective challenge must never produce a lower expected-reward opportunity than an otherwise identical easier challenge solely because of a string-table bug.
2. Playing far below demonstrated ability must provide little or no positive domain-rating movement even with near-perfect accuracy.
3. Poor performance can still reduce rating, but movement remains gradual and bounded.
4. Secondary-domain movement remains lower weight than primary-domain movement unless an ADR changes the product contract.
5. Inactivity never directly decays stored rating.
6. The same persisted session + same prior rating state deterministically yields the same rating result.

The current policy does not have enough information to fully enforce #2 because it computes deltas without current player skill. The agent must therefore create a small ADR before implementation describing the revised formula/interface. Acceptable designs include a rating policy that receives the current domain rating/skill estimate and the session's continuous challenge rating. Do **not** invent a new user-facing scale.

The ADR must document:

- mapping between stored domain rating and internal normalized skill estimate, if any;
- challengeRating interpretation;
- expected-performance function;
- delta/K-factor/caps;
- primary vs secondary weighting;
- behavior for a never-played domain;
- behavior for Easy farming by a high-skill player;
- adaptive-session behavior;
- backwards-compatibility implications.

### D. One authoritative completion outcome

The DB/session-completion transaction is the authority for progression. The player-facing result must use the committed outcome, not a parallel no-op estimate.

Required flow:

```text
game state/result
  -> game normalizes raw performance
  -> completeSession(...)
       -> authoritative XP
       -> authoritative currency
       -> authoritative rating deltas/new ratings
       -> atomic persistence
  -> UI receives CompleteSessionResult
  -> UI renders committed XP/rating movement
```

- Remove the production dependency on `noopXpRatingHook` for displayed awards.
- A game may calculate provisional raw score/normalized metrics locally, but XP/rating/currency displayed as earned must come from successful authoritative persistence.
- While persistence is pending, show a neutral pending state rather than `XP 0` as if final.
- On persistence failure, clearly state the session was not saved/awarded and expose a safe retry path if the operation can be idempotently retried. Do not pretend the reward was granted.
- Ensure double-tap/re-render/retry cannot insert the same session or progression twice. Session id is the idempotency anchor; duplicate completion should be handled deliberately.

### E. Historical correction strategy

Before changing existing derived ratings, write an ADR/repair note describing what data is authoritative:

- historical `game_sessions` and their raw/normalized results are evidence and must be preserved;
- rating projections/history are derived state and may need correction;
- append-only history guarantees must not be silently bypassed.

At minimum, provide a deterministic tool/test function that can replay rating projection from ordered sessions under the new policy and compare it with stored projection.

If the app is confirmed pre-release/dev-only and a one-time rebuild of derived rating tables is chosen, document that explicitly and preserve session history. If not, introduce a versioned correction mechanism rather than deleting audit history. The agent must not guess which path is safe without documenting the repository/release evidence.

## Required tests

### Policy contract tests

For exact canonical levels:

- `easy`, `normal`, `hard`, `expert`, `adaptive` all hit distinct intended paths.
- No capitalized duplicate policy table is required.
- Continuous challenge values at several points are monotonic.
- High-skill + trivial/easy challenge + perfect result produces <= small/zero positive rating movement according to the ADR.
- Appropriate hard challenge + good performance can produce positive movement.
- Bad performance produces bounded negative movement.
- Secondary domain is weighted below primary.
- Rating floor behavior records actual movement correctly (final persistence detail finished in Spec 010).

### Production-shaped integration tests

Use at least three representative games plus one adaptive game path:

- build real raw result;
- normalize;
- persist through real `SessionRepository` with real rating service;
- assert stored XP equals returned XP;
- assert returned currency ledger entry exists once;
- assert rating history reflects returned deltas;
- render/drive result state and assert displayed XP is the authoritative nonzero value where expected.

One test must use lowercase `hard`; one must use `adaptive` with a final challenge different from its starting baseline.

### Catalog audit

Statically or programmatically verify all registered games persist final challenge rating correctly. Prefer a shared session-building helper/contract test over 20 copy-pasted assertions if feasible.

## MUST acceptance criteria

- Casing bug cannot recur without type/test failure.
- Central rating policy consumes final continuous challenge and current skill evidence per the ADR.
- Easy-farming invariant is explicitly tested.
- All 20 games persist a final effective challenge rating.
- Production game result surfaces no longer report the no-op XP as final earned XP.
- Authoritative completion is idempotent for the same session id.
- Historical correction/replay strategy exists and is documented; sessions are preserved.
- Full targeted tests + full suite + typecheck pass.
- Emulator evidence shows at least Easy, Hard, and Adaptive completion with visible authoritative XP/result state.

## Forbidden shortcuts

- Merely changing `Easy` to `easy` and declaring the entire rating problem solved.
- Reading `rawResult` ad hoc in UI to guess XP instead of using committed outcome.
- Mutating old session raw results.
- Resetting all user data automatically to avoid migration/replay design.
- Duplicating one rating formula in games and another in the shared pipeline.