# Design — 064-dependency-security-validation-gates

## Principle

This is a gate-integrity change: no product behavior moves. Every fix is
either a correction of contradictory durable state, an expansion of an
existing deterministic check, or the wiring of a check that already
exists. Nothing here weakens an existing fail-closed path; strictness
only increases where the census proved a blind spot, and each increase
is self-tested offline.

## 1. Expiry governance

- **Dependency audit (ReDoS):** the machine sources already agree
  (`dependency-audit-allowlist.json` `2027-03-31`,
  `DEPENDENCY_AUDIT.md`); only `KNOWN_ISSUES.md` is stale. Fix the doc
  and add the renewal owner line (Expo SDK upgrade that carries a fixed
  `query-string` major). The validator already fails closed on expired
  `runtime-accepted-debt` (campaign 028) — assert via its self-test.
- **Provenance:** add `--check-allowlist` to `validate-provenance.mjs`.
  Schema per entry: `reason` (non-empty), `expires` (parseable future
  date). Output: `EXPIRED_PROVENANCE_WAIVER:` lines → exit 1;
  `EXPIRING_SOON_PROVENANCE_WAIVER:` (≤45 days) → exit 0 with warning.
  The drift path already treats expired entries as absent, so the
  freshness mode adds the missing scheduled signal, not new semantics.
- **Jest skips:** schema v3 adds required `expires` (YYYY-MM-DD) to
  every entry, alongside existing `owner`/`reviewedAt`. The validator
  gains: schema checks, `EXPIRED_JEST_SKIP_WAIVER` (fail) and
  `EXPIRING_SOON_JEST_SKIP_WAIVER` (warn, ≤60 days), and a
  summary-free `--check-allowlist` mode (schema + stale + expiry). The
  normal `--summary` path additionally fails on expired entries. All
  five shipped entries get `2027-03-31`.

## 2. Affected-area completeness

New rules, mirrored exactly in `.agent/IMPACT_MAP.md`:

- analytics → `apps/mobile/src/analytics/**` (typecheck; focused
  analytics/projection tests; Progress numbers unchanged if envelope
  touched).
- quests / achievements / streaks → `apps/mobile/src/quests/**`,
  `apps/mobile/src/achievements/**`, `apps/mobile/src/streaks/**`
  (progression tests + persistence reload smoke).
- theme tokens → `apps/mobile/src/theme/**` (typecheck; contrast/token
  tests; affected screenshots).

`validate-affected.mjs` gains `--self-test` covering: exact match, tree
prefix match, `?`/`*` segment semantics, unmatched reporting, and
`--strict` exit behavior (via the pure functions, no subprocess).
`--check-sync` remains the mirror gate. `--strict` stays an
orchestrator tool (documented in IMPACT_MAP.md) — CI cannot use it on
raw diffs because not every legitimate path (tests, artifacts) belongs
to an area.

## 3. Console signal gate

`installConsoleSignalGuard()` wraps all four levels
(`error`,`warn`,`log`,`info`,`debug`). Mechanics: unexpected → recorded
violation + real output preserved; expected → counted and **still
forwarded** (expectations classify output, they do not suppress it — this
is what keeps the probe markers on stdout for `run-probes.mjs`).
`expectConsoleNoise` keeps its assert-the-message-occurred contract and
`max` option. Deliberate emitters are scoped:

- test markers (`PERF_BASELINE_JSON`, `PERF_SYNC_JSON`,
  `PERF_QUEST_AB_JSON`, `PERF_W10_JSON`, `LARGE_BACKUP_MEMORY_JSON`),
- informational sweep logs (`catalog-integrity sweep`,
  `[W09] 20k-session aggregate`),
- the dead `DUP` debug print is deleted (it only ran on an
  already-failing assertion).

The `[perf]` source emitter DOES fire under jest (`__DEV__` is true in
jest-expo), so `sdk/perf.ts` now skips the log line when
`process.env.JEST_WORKER_ID` is set; device/dev-build logging and the
in-process ring buffer are unchanged. A new contract test proves guarding,
scoping, non-occurrence failure, and per-test reset; the probe runner
proves forwarding end-to-end by capturing the marker lines.

## 4. Scanners

- **Secrets:** add `npm-token` (`npm_[A-Za-z0-9]{20,}`),
  `google-api-key` (`AIza[0-9A-Za-z_-]{35}`), `stripe-live-secret`
  (`(sk|rk)_live_[A-Za-z0-9]{16,}`). Self-test each positive + negative.
- **Offline:** add a RAW-LINE module-specifier scan (strings must not be
  stripped for this class): `from 'pkg'`, `require('pkg')`,
  `import('pkg')` for the banned list. Keep identifier patterns and
  bracket access unchanged. Add `--check` as an explicit accepted flag
  (CI already passes it). Extend self-test with
  `import { get } from 'axios'` and `require('expo/fetch')` positives
  and `from './fetch-utils'`-style negatives.
- **Runtime ban:** `NETWORK_GLOBALS` gains `EventSource`;
  `navigator.sendBeacon` is patched via a saved property descriptor on
  `globalThis.navigator` when configurable (Node 24: it is), restored
  afterwards. `axios` and any imported library cannot be banned at the
  global layer — the header documents that the static specifier scan is
  the authority for those.

## 5. Probes

`run-probes.mjs` gains per-probe `env` and three entries
(`PERF_QUEST_AB_JSON` with `PERF_PROBE=1`, `PERF_W10_JSON` with
`PERF_PROBE=1`, `LARGE_BACKUP_MEMORY_JSON` with `LARGE_BACKUP_PROBE=1`),
plus `--list`. The marker-capture path already rewrites baselines, so no
jest-side changes are required. The runner stays opt-in/heavy: it is not
a CI gate, it is the documented way to regenerate baselines for every
probe.

## 6. Runtime-QA contract

`validate-runtime-qa-contract.mjs` becomes structural:

- `JSON.parse(app.json)` and assert `expo.scheme === 'braintraining'`.
- Extract `braintraining://<path>` occurrences from the ARTEMIS doc,
  normalize the path to route candidates under `apps/mobile/src/app`
  (`foo` → `foo.tsx` | `foo/index.tsx` | `foo/[id].tsx`), and fail
  naming any documented link with no route.
- Assert `src/sdk/testid.ts` exports a testID helper (`export function
  testID`/`makeTestID`) rather than just file existence.
- `--self-test` covers the resolver with fixture paths (existing route,
  dynamic route, missing route).

## 7. Config and APK gates

- `apps/mobile/package.json`: `testMatch` adds
  `**/__tests__/**/*.spec.ts` and `*.spec.tsx`.
- New guard test reads `package.json` and fails if either naming
  convention or extension loses coverage.
- New `scripts/android/expected-apk-permissions.txt` lists the eight
  certified `uses-permission` names (seven platform permissions plus the
  app's dynamic-receiver permission). The workflow step keeps
  `aapt2 dump permissions`, prints it, and diffs the sorted
  `uses-permission:` names against the file; any extra or missing entry
  fails. Blocked-permission assertions stay.

## 8. CI wiring

`repository-integrity.yml`:

- new self-test steps: `validate-affected --self-test`,
  `validate-runtime-qa-contract --self-test`,
  `validate-jest-signal --check-allowlist`,
  `validate-provenance --check-allowlist`;
- schedule comment updated to name exactly what the weekly run catches;
- audit-ownership comment: npm audit needs the network and lives here
  (push + weekly), App CI stays hermetic and only runs the contract /
  offline checks.

No new workflow file; `app-ci.yml` gains only the audit-ownership
comment.

## Evidence layout

`docs/redesign/evidence/campaign064/`: `GATE_CHANGES.md` (claim →
fix → proof per item), `VALIDATOR_OUTPUT.md` (raw command output),
`CONSOLE_GATE.md` (level coverage + full-matrix zero-noise evidence),
`APK_PERMISSION_GATE.md` (local aapt2 diff proof),
`CAMPAIGN064_CLOSURE.md`, plus the adversarial review. Raw local run
logs stay under `D:\Temp\campaign064-*`.
