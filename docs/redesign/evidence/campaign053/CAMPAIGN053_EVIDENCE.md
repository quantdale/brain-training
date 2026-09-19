# Campaign 053 — Full-System Hardening Evidence Packet

**Campaign:** `053-full-system-hardening`
**Terminal artifact baseline:** implementation commits `11e917f`, `e154f5b`,
`ba2c18c`, `57d0be1` (open for the runtime checkpoint below).
**Runtime target:** `braintraining-ui35` / `emulator-5554`, Android 15 / API 35,
1080x2400, density 420 (single dedicated emulator; `emulator-5556` is a
Study Maker runtime and was not touched).
**Mode:** day.

## What shipped

| Workstream | Result | Primary evidence |
| --- | --- | --- |
| 1. Bootstrap integrity (H-01) | Classified startup pipeline; foundational failure withholds the normal shell; ancillary preference failure stays nonfatal with a stage diagnostic; retry/relaunch convergence with no duplicate durable effects | `bootstrap/__tests__/run-bootstrap.test.ts`, `app/__tests__/bootstrap-recovery.test.tsx`, `app/__tests__/storage-unavailable.test.tsx` |
| 2. Dependency + route decision (H-02) | No compatible Expo remediation exists; disposition renewed to 2027-03-31 with current reachability and re-evaluation condition. App-owned route envelope enforces canonical forms/bounds as defense in depth | `scripts/certification/dependency-audit-allowlist.json`, `routing/__tests__/route-params.test.ts` |
| 3. Test signal integrity (H-03) | All known `act`/overlap/animation/deprecation/expected-error noise repaired at the source; reviewable unexpected-console gate with an empty baseline; opt-in probe conditions pinned | `jest/setup.js`, `test-utils/console-signal.ts`, `__tests__/perf-probe-contract.test.ts` |
| 4. Catalog persistence contract (H-04) | Registry-derived matrix: every registered game exercised for success, rejected-save, and stale completion; exemptions require identity + reason + alternate evidence; no exemptions currently needed | `components/game-host/__tests__/catalog-persistence-matrix.test.tsx` |
| 5. Convergence | See runtime and repository sections below | this packet |

## Console-signal baseline (task 3.1)

Full standard-command run (`npx jest --ci`) before the repair, with owning
locations:

| Message class | Count | Owning location | Disposition |
| --- | --- | --- | --- |
| `The current testing environment is not configured to support act(...)` | 84 | `src/app/__tests__/data-management.test.tsx` (un-awaited `fireEvent` interactions) | Repaired: every `fireEvent` awaited |
| `An update to Animated(View) ... not wrapped in act(...)` | 8–10 | `components/ui/kit-metrics` (SegmentedControl), `components/workout/workout-ui` (completion card entrance), `components/shell/gamification-ui` | Repaired: mount-time no-op timing runs removed; `unmount` awaited where applicable |
| `You seem to have overlapping act() calls` | 2 | `games/math-equation-builder/__tests__/verdict-cue.test.tsx` (un-awaited `unmount`) | Repaired: awaited |
| `Use of option "timeout" in a findBy* query options (2nd parameter) is deprecated` | 16 | `src/app/__tests__/data-management.test.tsx` | Repaired: supported 3rd-argument `waitForOptions` form |
| `[Layout children]: No route named ...` | 50 | `storage-unavailable`, `settings-persist-*` suites | Repaired: full declared route set via `rootLayoutRoutes()` |
| Expected persistence/workout/bootstrap diagnostics | 10+ | deliberate failure-injection tests | Scoped with `expectConsoleNoise()`; still asserted |

After the repair the gate has an **empty baseline** (`CONSOLE_BASELINE = []`)
and the full suite passes with it active.

## Task 2 dependency decision detail

Reachability reproduced with `npm ls` / `npm audit --json --omit=dev`:

```
expo-router@57.0.22 -> query-string@7.1.3 -> decode-uri-component@0.2.2
GHSA-vcc3-ghjq-m6fr, range <=0.4.2, moderate
```

Evaluated options:

1. **Patch inside the supported line** — impossible: expo-router 57.0.22 (latest
   57.x) pins `query-string@^7.1.3`; every 7.x pins `decode-uri-component@^0.2.2`.
2. **Upgrade query-string** — `query-string@9.5.x` carries
   `decode-uri-component@^0.5.0`, but 0.5.0 is `"type": "module"` (ESM-only)
   while expo-router requires query-string from CommonJS
   (`__importStar(require("query-string"))` in `build/getPathFromState.js`).
   Forcing it would break route parsing at runtime.
3. **npm audit's offered fix** — `expo-router@5.1.11`, a semver-major downgrade
   out of the SDK 57 line. Rejected.
4. **Renewed disposition** — retained with expiry `2027-03-31`, the current
   reachable path, and a re-evaluation condition tied to the next Expo SDK
   upgrade. The app-owned route envelope is explicitly **not** remediation for
   this advisory.

## Runtime evidence on the dedicated emulator (task 5.3)
Artifact: `app-release.apk`, 109,586,373 bytes, SHA-256
`1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`,
built from `02a7ecb` (release bundling; Metro-free). Installed on
`emulator-5554` (`braintraining-ui35`, Android 15 / API 35, 1080x2400,
density 420). Raw captures live outside Git under
`D:\Temp\campaign053\runtime\`; the result lines are duplicated here.

### Startup, route boundary, and relaunch journey — 9/9 PASS

```
PASS  canonical game route renders intro
PASS  oversized game id -> not-found fallback
PASS  oversized game id does not corrupt startup
PASS  oversized results id -> recoverable empty state
PASS  malformed workout provenance -> standalone launch
PASS  malformed provenance rejected before selection
PASS  relaunch renders Home
PASS  relaunch shows no recovery screen
PASS  app logcat has no fatal/ANR/SQLite marker
```

Method: fresh install with cleared app data; `am start -W` cold launch
rendered `home-workout-cta`; deep links drove `/game/memory`, an oversized
(4000-char) game id, an oversized results id, and a malformed/oversized
workout provenance tuple; force-stop plus relaunch re-rendered Home with no
recovery screen; `logcat -d` filtered to app/ReactNativeJS/AndroidRuntime
lines contained no FATAL/ANR/SIGSEGV/OOM/SQLite marker.

### Failure-recovery journey — 4/4 PASS

```
PASS  unopenable store -> storage-unavailable recovery screen
PASS  recovery screen exposes the retry control
PASS  recovery screen withholds the normal shell
PASS  restoring the store recovers Home
```

Method: the release build is not debuggable and QA controls compile out, so
the canonical DB file was moved aside and replaced with an unreadable entry
using the dedicated emulator's root adb (emulator-local only). Cold launch
presented `storage-unavailable` with its retry control and no normal shell;
restoring the file and relaunching rendered Home again. The retry/relaunch
convergence semantics themselves are proven deterministically by
`src/bootstrap/__tests__/run-bootstrap.test.ts` and
`src/app/__tests__/storage-unavailable.test.tsx` (fault injection plus
durable-effect idempotency), not by this device check.

### Representative completion journey — 7/7 PASS (debug build + Metro)

```
PASS  debug+Metro cold start reaches Home
PASS  game session completes to results (1st)
PASS  first completion persists without failure UI
PASS  restart completes a second session
PASS  second completion persists without failure UI
PASS  quit returns Home
PASS  no app fatal/ANR/SQLite marker during journey
```

Method: the release build compiles the dev-only QA seam out, so deterministic
force-completion ran on the debug build with Metro serving the same current JS
source (all campaign workstreams are JS-only; the native shell is unchanged).
Every interaction was an emulator-local `adb shell input tap` resolved from
semantic `resource-id` bounds (Memory game: start -> tutorial QA-skip ->
start -> QA force-win -> results -> restart -> force-win -> quit). Direct
SQLite inspection of the pulled canonical database confirmed the durable
result: integrity `ok`, one profile row, two memory sessions persisted
(`memory-mu8d6ytx-1-tgcnf1`, `memory-mu8d7car-2-thzav2`), and no persistence
error UI in either completion. The release APK was reinstalled and verified
Home afterward, which is the final device state.

## Terminal validation counts

The terminal gated suite at campaign close is **564 suites / 6,726 tests**
passing (4 suites / 5 tests classified opt-in skips, 5 snapshots, 0
unexpected console output). An intermediate implementation figure of 563
suites / 6,724 tests was captured before the final `perf-probe-contract` suite
existed; the full reconciliation is in
`docs/redesign/evidence/campaign054/VALIDATION_COUNT_RECONCILIATION.md`.

## Boundaries (task 5.4)

Recorded as NOT VALIDATED / external, never inferred:

- human TalkBack/VoiceOver accessibility quality;
- physical/OEM Android device behavior;
- iOS runtime;
- production/store signing;
- human system-sheet/provider usability;
- GitHub Actions execution (pre-existing account/policy classification; no
  workflow was edited to mask it).
