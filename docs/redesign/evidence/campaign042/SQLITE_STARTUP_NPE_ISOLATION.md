# Campaign 042 — SQLite Startup NPE Isolation

**Status:** `[REPAIRED_AND_REVALIDATED]`
**Classification:** third-party Expo SDK 57 Android runtime-teardown defect,
isolated by a bounded app-side connection policy
**Date:** 2026-09-18

## Reproduction before the repair

The prior release/runtime observation was not speculative. A release launch
showed Home's `Couldn't load today's workout`; retrying reached the exact
failure below:

```text
Call to function 'NativeDatabase.prepareAsync' has been rejected.
Caused by: java.lang.NullPointerException
```

The controlled font-scale transition also reproduced the same failure while
Android tore down and recreated the React runtime. The pre-repair evidence is
preserved in:

- `D:\Temp\campaign042\release-after-fix\responsive-logcat.txt`
- `D:\Temp\campaign042\release-after-fix\font-transition\transition-logcat.txt`

The transition log records configuration changes, React host teardown/restart,
and the NPE in the workout/progression load path. A normal cold relaunch later
recovered, which initially made this look intermittent.

## Root-cause isolation

Local Expo SQLite SDK 57 Android source inspection showed that the default
open path caches a native database by path. Runtime teardown can close the
native binding while a cached JavaScript/native wrapper remains reusable;
subsequent `prepareAsync` calls then reject with the unhelpful null-pointer
failure. This matches the upstream report
[Expo issue #48999](https://github.com/expo/expo/issues/48999), which documents
the same Android runtime-teardown, cached-handle, and `useNewConnection` shape.

The defect is therefore classified as an upstream SDK/runtime lifecycle issue,
not a workout generator, scoring, schema, or progression calculation defect.
The repository does not claim to fix Expo itself; it isolates the app from the
known failure mode.

## Bounded repair

The repair is limited to `apps/mobile/src/db/adapters/expo.ts` and
`apps/mobile/src/db/index.ts`:

1. Native database operations are serialized per native handle, including
   transaction work, so concurrent wrappers cannot race the same binding.
2. The queue key uses `nativeDatabase` when Expo exposes it, so separate
   JavaScript wrappers around one native handle share the same queue.
3. The app database opens with Expo's `useNewConnection: true`, avoiding reuse
   of a poisoned cached handle after runtime teardown.
4. Concurrent `initDatabase` callers share one in-flight initialization pass;
   the promise is cleared after settlement so a later retry remains possible.

No schema, migration, session identity, scoring, economy, router, or gameplay
contract changed.

## Validation after the repair

- `[PASS]` Focused Expo adapter/database suite: 5/5 tests, including wrapper
  serialization, transaction serialization, queue recovery, shared native
  handle serialization, and fresh-connection opening.
- `[PASS]` Final release cold Home launch loaded today's workout with no target
  error markers.
- `[PASS]` Final release font-scale 1 → 2 → 1 transition completed with no
  targeted SQLite/NativeDatabase/fatal/ANR/app-error markers.
- `[PASS]` Final release offline relaunch runs 1 and 2 both returned to healthy
  Home with `NO_APP_ERROR_MARKERS`.
- `[PASS]` Existing persisted database integrity check returned `ok`, schema
  `user_version=12`, `schema_version=48`, and retained all three completed
  Campaign 042 sessions.

The post-repair logs are under
`D:\Temp\campaign042\release-after-repair\cold-home.png`,
`final-transition\final-logcat.txt`, and `final-relaunch\run-1-logcat.txt` /
`run-2-logcat.txt`.

## Residual risk

Expo SDK remains an external dependency and its upstream lifecycle behavior is
not under repository control. The app-side isolation is evidence-backed and
the original failure did not recur in the alternate-order and relaunch checks;
the upstream issue remains a dependency watch item rather than an unresolved
Campaign 042 product-correctness defect.
