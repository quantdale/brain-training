# Campaign 054 — Dependency / Security Closure

**Status:** one safe in-range remediation applied; remaining dispositions
re-verified
**Date:** 2026-09-19

## Current audit state (before)

`npm audit` and `npm audit --omit=dev` in `apps/mobile` (identical reports;
no dev-only additions):

```
20 vulnerabilities: 15 moderate, 5 high
```

Root families: `image-size` (2 advisories, high), `js-yaml`
(GHSA-2883-xcg3-v3hh, high, two affected ranges), `uuid`
(GHSA-w5hq-g745-h8pq, moderate), `uuid`/`expo` chain (moderate),
`decode-uri-component` (GHSA-vcc3-ghjq-m6fr, moderate), and the
`@expo/*`/`metro` effect-chain entries those roots produce.

## Remediation applied (isolated, in-range)

**`js-yaml` GHSA-2883-xcg3-v3hh** — a safe, compatible, patch-level fix now
exists (`3.15.2` and `4.3.2` are inside their installed semver ranges).
Command:

```
npm update js-yaml     # run in apps/mobile
```

Lockfile diff: exactly 6 lines — `js-yaml 3.15.1 → 3.15.2`
(`@istanbuljs/load-nyc-config`) and `js-yaml 4.3.1 → 4.3.2`
(hoisted; `@expo/xcpretty` + eslint). `package.json` unchanged. No
`npm audit fix --force`, no major-version churn.

Result: audit drops to **19 vulnerabilities (15 moderate / 4 high)**; the
js-yaml family is fully resolved. `apps/mobile/package-lock.json` is the only
changed dependency file. The `js-yaml` waiver was removed from
`scripts/certification/dependency-audit-allowlist.json` (the remediation made
it unused); the validator reports `4 accepted advisories`.

## Remaining accepted dispositions (re-verified this campaign)

| Package | Advisory | Sev | Reachability | Remediation available? | Disposition |
| --- | --- | --- | --- | --- | --- |
| `decode-uri-component` | GHSA-vcc3-ghjq-m6fr | moderate | Runtime via `expo-router@57.0.22 → query-string@7.1.3 → decode-uri-component@0.2.2` | **No compatible fix.** expo-router 57.0.22 is the latest 57.x and pins `query-string@^7.1.3`; query-string 7.1.3 (latest 7.x) pins `decode-uri-component@^0.2.2`; the fixed `0.5.0` is ESM-only while expo-router requires query-string from CommonJS; npm's only offered fix is an expo-router semver-major downgrade to 5.1.11 | `ACCEPTED_TIME_BOUNDED_DEBT` — allowlist entry with 2027-03-31 expiry, re-evaluation tied to the next Expo SDK upgrade; app-owned route input envelope remains defense in depth only |
| `image-size` | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq | high | Build/dev toolchain only (`metro@0.84.4 → image-size@^1.0.2`); never bundled | **No in-range fix.** Fixed releases are `>=2.0.3` (major); metro pins `^1.0.2` and RN 0.86.3/Metro 0.84.4 have no compatible major bump | `ACCEPTED_TIME_BOUNDED_DEBT` (build-dev-toolchain) |
| `uuid` | GHSA-w5hq-g745-h8pq | moderate | Build/dev toolchain only (`xcode → @expo/config-plugins`); vulnerable call pattern not exercised | **No in-range fix.** Fixed `>=11.1.1`; expo prebuild toolchain pins 7.x | `ACCEPTED_TIME_BOUNDED_DEBT` (build-dev-toolchain) |

The remaining moderate `@expo/*`/`expo`/`expo-sharing`/`expo-splash-screen`/
`xcode`/`metro*` report rows are the effect-chain projections of the `uuid`
and `image-size` roots above, not independent reachable advisories.

## Evidence

- `git diff apps/mobile/package-lock.json` — 6 changed lines (the two js-yaml
  entries).
- `npm audit --omit=dev --json` after: `{"moderate":15,"high":4,"total":19}`;
  `object` key list contains no `js-yaml`.
- `node scripts/validate-dependency-audit.mjs` — PASS, 4 accepted advisories,
  no unallowlisted moderate+ production findings.
- `node scripts/validate-dependency-audit.mjs --self-test` — 41/41.

## Current dispositions (final)

- `js-yaml` — **CLOSED_VERIFIED** by patch-level lockfile remediation.
- `decode-uri-component` — `ACCEPTED_TIME_BOUNDED_DEBT` (runtime; expires
  2027-03-31).
- `image-size` (x2), `uuid` — `ACCEPTED_TIME_BOUNDED_DEBT`
  (build-dev-toolchain; re-evaluate with the next planned Expo/RN upgrade).
