# Audit map — 061-performance-lifecycle-cleanup

**Program SHA:** `428d293` · **Predecessor:** `060-idempotency-economy-merge-safety` (VALIDATED)

## Evidence chain

1. Progress throttle → `progress.tsx` (`shouldScheduleFocusReload` +
   5s `lastLoadRef`) · pure helper tests.
2. Discovery stabilization → `stabilizeDiscoverySnapshot` (pure,
   non-mutating) · identity/changed/favorites tests.
3. Countdown settle → shared `game-ui/countdown` (tap-rush +
   quick-compare twins deduped and deleted; both screens consume the
   barrel) · tick clears at 0 · fake-clock test (no post-deadline
   polls).
4. Animation cleanups → shared `launchAnimation` helper (unit-tested) ×3
   call sites (game-host results, completion-summary, celebration) ·
   celebration unmount test.
5. ProgressRing memo → ticks memoized on filled · render suites green
   (identical pixels by construction).
6. Press drivers → supersede + unmount stop · hook spy tests + Tappable
   rapid-cycle test.
7. useDbData sequence → superseded resolutions ignored · deferred-race
   test. (Honest note: the token is redundant with React cleanup
   ordering by construction — kept as one-ref defense in depth; the
   test pins the invariant, not a behavior delta.)
8. Focus cancel → cancel fn + generation guard + effect cleanup ·
   updated deactivation test + cancel test (existing pin updated
   honestly).
9. Toast cap → `MAX_QUEUED_TOASTS = 8` + peek accessor · overflow test.
10. Focused suites green; typecheck; lint; OpenSpec strict.

## Census claims closed by design evidence (no change)

- Search debounce (filter is microseconds; fixed at the render cause).
- Hydration cache (risk-negative: stale tutorials worse than one read).
- Startup order + release instrumentation (dependency + deferred
  telemetry boundary).
- Probe infra (dev-channel + ARTEMIS/067 loop).
- First-interaction abandon (measurement nit).

## Residuals

- Progress worst-case staleness ≈ 5s + load time for fast coin writes
  (purchases/claims lag at most one focus window, self-healing; labels
  stay fresh). Sessions (minutes) can never hide inside the window.
- Discovery shelves stay fresh-computed (few nodes; cheap).
- Concurrent-dialog focus retries: latest request wins (documented).
- Ring per-frame scalar set remains (cheap); element rebuild skipped.

## Boundaries

Manual/platform/store/CI per program. No layout/copy/route change.
