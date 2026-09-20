# Change 061 — Performance & Lifecycle Cleanup

**Status:** IN_PROGRESS
**Predecessor:** `060-idempotency-economy-merge-safety` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 059–061 structural quality and deep invariants (last structural
item: lifecycle cleanup, resource problems, architectural duplication
causing real risk).

## Problem / evidence

Lane-5 findings verified against source at `eb88e69`. Five claims were
CLOSED by evidence during verification (recorded so they stay closed):

- **Games search debounce: wrong fix.** The per-keystroke filter over 42
  games is microseconds; the jank is the 42-tile re-render from defeated
  `memo`. Fixed at the actual cause (mastery identity stabilization).
- **Tutorial hydration cache: risk-negative.** One indexed row read per
  game entry is not a material bottleneck; caching risks stale tutorials
  after import/replace/wipe (user-visible wrongness). No change.
- **Cold-start serial init: required + deferred boundary.** DB must open
  before progression seeding (dependency, not parallelism debt); release
  perf instrumentation is deferred telemetry by constitution. No change.
- **Perf baselines Node-only: accepted process gap.** Dev-channel probes
  plus ARTEMIS journeys (067) are the evidence loop; device
  instrumentation is deferred telemetry. No change.
- **First-interaction abandon: measurement nit, no user impact.** No change.

Real waste fixed here (all read-verified):

1. **Progress reloads the full snapshot per focus** (`progress.tsx`):
   `refreshKey` bumps every focus re-run the snapshot load. A 5s
   throttle cannot hide sessions (minutes long); fast coin writes
   (purchases/claims) can lag at most one focus window (~5s, self-
   healing, labels stay fresh).
2. **Games mastery churn defeats tile memo** (`discovery-data.ts:125-188`):
   fresh `Map` of fresh objects per load → all 42 tiles re-render
   (art + identity each) per focus.
3. **Countdown never settles** (tap-rush + an identical quick-compare
   twin): 20Hz `setState` forever while mounted, including past
   deadline. Fixed once via dedupe into the shared `game-ui` primitive
   (both games consume it; twins deleted).
4. **Orphaned animations** (`game-host/results.tsx:184-190`,
   `completion-summary-card.tsx:90-96`, `celebration.tsx:108-113`):
   `.start()` with no unmount cleanup (siblings all stop).
5. **ProgressRing rebuilds 56 ticks per frame** (`progress-ring.tsx:58-85`):
   `withNumericValue` re-render rebuilds the tick tree even when `filled`
   is unchanged.
6. **usePressFeedback never stops drivers** (`motion.ts:74-96`): unmount
   mid-press leaves native animations running on detached nodes.
7. **useDbData last-writer-wins** (`use-db-data.ts:22-47`): rapid refresh
   bumps resolve out of order; stale snapshot overwrites fresh.
8. **A11y retry timers uncancelled** (`focus.ts:54-73`): overlay
   transitions leave pending fires holding ref closures.
9. **Toast queue unbounded** (`toast.tsx:33-41`): degraded-boot toasts
   accumulate with no host mounted.

## Desired invariant / outcome

- Focus bounces within 5s of a load skip the Progress snapshot reload
  (explicit retry/failure paths still reload; worst-case staleness 5s,
  below any real session duration).
- Unchanged mastery summaries keep object identity across discovery
  loads, restoring tile memo bailouts; changed games re-render normally.
- No interval/animation/timer outlives its mount or its usefulness;
  stale async snapshots never overwrite fresh state; toast queue bounded
  (drop-oldest beyond 8).
- No behavior, copy, layout, scoring, persistence, or telemetry change.

## Non-goals

- No FlatList virtualization, no search debounce, no hydration cache, no
  startup reorder, no release instrumentation, no probe changes (all
  closed above with evidence).
- No animation-behavior change (same curves/durations; only cleanup).

## Affected areas

`app/(tabs)/progress.tsx`, `components/discovery/discovery-data.ts`,
`games/speed-tap-rush/components/countdown.tsx`,
`components/game-host/results.tsx`,
`components/workout/completion-summary-card.tsx`,
`rewards/celebration.tsx`, `components/ui/progress-ring.tsx`,
`components/ui/motion.ts`, `hooks/use-db-data.ts`,
`components/a11y/focus.ts`, `components/ui/toast.tsx`, focused tests.

## Protected contracts

Focus-freshness for favorites/mastery (Games still reloads per focus —
only object identity is preserved), tutorial hydration, degraded
toast behavior, reduced-motion paths, console baseline, a11y focus
best-effort semantics.

## Implementation plan

1. Progress: `lastLoadRef` timestamp; focus bumps `nowMs` always, bumps
   `refreshKey` only when `now - lastLoad > 5000` (record load time on
   data arrival — passively via effect on `loaded`/`data`? simpler:
   record at bump time; the load follows synchronously in effect order).
   Hmm — record timestamp when scheduling the reload (focus time); a
   failed load retries via explicit retry (unaffected).
2. Discovery: `prevRef` snapshot; per-id JSON-compare mastery summaries,
   reuse identical objects; reuse favorites Set when membership equal;
   return stabilized snapshot (shelves stay fresh-computed — few nodes).
3. Countdown: clear the interval once the tick computes 0 (keep
   unmount cleanup).
4. Three animation sites: capture + `return () => animation.stop()`.
5. ProgressRing: `useMemo` the tick array on `[filled, theme, geometry]`.
6. usePressFeedback: track handles, stop-on-new-start + unmount stop
   (keep value reset).
7. useDbData: monotonic sequence token; ignore superseded resolutions
   (keep unmount cancelled flag).
8. focus.ts: `requestAccessibilityFocus` returns a cancel fn clearing
   pending timeouts; `useInitialA11yFocus` effect returns it.
9. Toast: `MAX_QUEUED_TOASTS = 8`; `showToast` shifts overflow.
10. Tests per item (timers/animation/hook/queue contracts); affected
    suites; full matrix; adversarial review; close.

## Test plan

- Countdown settles (ticks stop at 0; existing fake-clock suites green).
- Animation cleanup (unmount mid-flight stops; no post-unmount writes).
- useDbData supersession (slow-then-fast resolves fresh).
- Focus cancel (unmount drops pending fires).
- Toast cap (9th push drops the 1st).
- Discovery stability (identical reload reuses mastery objects; changed
  game yields new object).
- Progress throttle (reload skipped <5s, runs ≥5s; retry always runs).
- Full gated Jest + console gate + typecheck + lint + validators +
  OpenSpec strict.

## Runtime/native evidence plan

No layout/copy/route change: repository gates + animation/timer
contracts are the evidence. Device frame proof stays with 067.

## Rollback / risk notes

- Each item is local and independently revertible.
- Progress throttle worst case: 5s-stale snapshot after a background
  write — bounded, documented, below session granularity.
- Discovery stabilization: JSON-compare is order-stable (same
  constructor); a missed change would show stale mastery — mitigated by
  the changed-game test.

## Completion criteria

Standard terminal bar + per-item tests + full matrix exact counts +
adversarial review + pushed + `HEAD == origin/main`.
