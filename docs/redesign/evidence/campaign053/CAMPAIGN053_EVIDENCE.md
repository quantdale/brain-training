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

## Boundaries (task 5.4)

Recorded as NOT VALIDATED / external, never inferred:

- human TalkBack/VoiceOver accessibility quality;
- physical/OEM Android device behavior;
- iOS runtime;
- production/store signing;
- human system-sheet/provider usability;
- GitHub Actions execution (pre-existing account/policy classification; no
  workflow was edited to mask it).
