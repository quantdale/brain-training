# Design — 057-result-reward-correctness

## Shared hook (orchestrator-owned, `rating/xp-hook.ts`)

```ts
import { computeXp } from "./pipeline";
import type { NormalizedPerformance, XpRatingContext, XpRatingHook } from "@/sdk";

/**
 * Pipeline-backed optimistic XP hook (057). `computeXp` is exactly the
 * rating pipeline's function applied to the normalized value and the
 * record's difficulty level, so the first rendered reward already equals
 * the authoritative `storedXp` the DB pipeline will persist.
 *
 * Rating deltas are intentionally empty here: screens render deltas only
 * from `completionOutcome` (authoritative, needs registry domains +
 * challenge plumbing). Optimistic deltas are deferred — no screen renders
 * pre-persist deltas, so nothing observable is lost.
 */
export const pipelineXpRatingHook: XpRatingHook = {
  computeXp: (performance, context) =>
    computeXp(performance.value, context.difficulty),
  computeRatingDeltas: () => [],
};
```

No cycle: `rating/pipeline.ts` has only a type-only `@/db` import;
`rating/xp-hook.ts` adds a type-only `@/sdk` import. Screens import from
`@/rating/xp-hook` (never through `sdk/index`, which stays untouched).

Parity proof: authoritative XP = `computeXp(clamp01(record.normalizedResult),
record.difficulty.level)` (`pipeline.ts:202-210`). Post-057-A the
normalizer contract guarantees `normalized.value` finite in `[0,1]`, so
`clamp01` is identity; packet rule forces `context.difficulty ===
record.difficulty.level`. Hence optimistic ≡ authoritative. A shared parity
test pins hook-vs-pipeline equality across levels (including unknown-level
fallback `?? 1`).

## Per-game scoring edit (packet-owned)

Replace the body of the local data `clamp01` with collapse semantics:

```ts
/** Clamp to [0, 1]; non-finite DATA collapses to 0 (057 — matches the
 * rating pipeline's safe failure mode). Programmer-error validation
 * (bad params, unknown modes) still throws RangeError at its own site. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
```

Rules per packet: do NOT touch other `RangeError`s (params/modes); do NOT
change formulas; update `scoring.test.ts` throw-pins honestly (collapse
assertion + keep programmer-error throw tests); add one corrupt-stats test
through the game's `normalize*Result` (NaN stat → value 0, no throw).

## Per-game screen edit (packet-owned)

`xpHook = noopXpRatingHook` → `xpHook = pipelineXpRatingHook` (+ import
swap `noopXpRatingHook` → `pipelineXpRatingHook` from `@/rating/xp-hook`;
drop the sdk import only if unused otherwise). Verify the finalization
`context.difficulty` equals the record's `difficulty.level` (both flow
from the same profile level in all 42 screens — prove per game; if any
diverges, pass the profile level). Run the game's screen/session/scoring
suites; update `xp: 0` render expectations to the pipeline value honestly
(compute the expected XP from the fixture's normalized value + level, do
not hardcode blindly).

## PB clamp (orchestrator-owned, `app/results.tsx`)

`toMs: session.completedAt` → `toMs: Math.min(session.completedAt,
Date.now())` with a skewed-fixture test in `app/__tests__/results-hero.test.tsx`
(or a focused new suite if the hero suite cannot inject clocks).

## Packet map (write ownership = one domain's `games/<prefix>-*/` only)

1. attention (5) · 2. flexibility (5) · 3. language (5) · 4. logic (5) ·
   5. math (5) · 6. memory (7) · 7. spatial (5) · 8. speed (5)

Shared/hotspot files (`rating/*`, `sdk/*`, `app/results.tsx`, OpenSpec,
governance, ledger, registries, manifests) are orchestrator-only. Packets
report shared-file needs instead of editing them.
