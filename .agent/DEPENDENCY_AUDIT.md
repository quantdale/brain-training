# Dependency Audit Triage

**Date:** 2026-09-30 (Campaign 069 `brace-expansion` toolchain review; the
2026-09-19 Campaign 054 refresh below remains the count/severity baseline and
supersedes the 2026-08-31 Campaign 020 refresh, the 2026-08-24 Campaign 013
audit, and the 2026-08-18 006R audit)
**Scope:** `apps/mobile` (`npm audit`, auditReportVersion 2; the
`--omit=dev` production view produces the identical report — no dev-only
dependency adds findings)
**Context:** 42-game catalog, Expo SDK 57 / React Native 0.86.3 toolchain,
offline-first product
**Result:** **19 vulnerabilities (15 moderate, 4 high)** — reduced from 20
(15 moderate, 5 high) by the Campaign 054 in-range `js-yaml` remediation.

## Campaign 054 remediation applied

`js-yaml` GHSA-2883-xcg3-v3hh (high, "maxTotalMergeKeys does not limit CPU use
for empty merge sources") had a safe in-range patch fix available
(`3.15.2` / `4.3.2`). Applied with `npm update js-yaml` (lockfile diff: 6
lines, two entries). The `js-yaml` waiver was removed from
`scripts/certification/dependency-audit-allowlist.json`. See
`docs/redesign/evidence/campaign054/DEPENDENCY_SECURITY_CLOSURE.md`.

## Current classification

| Root cause | Findings | Direct? | Production/runtime reachable? |
| --- | --- | --- | --- |
| `image-size` (GHSA-w3rx-r6r6-pgpr ICNS loop, GHSA-5p2g-fcmc-qvqq JXL/HEIF loops) → `metro` → `metro-config`, `metro-transform-worker` | 2 high (effect chain: 4 rows) | No | **No** — Metro parses images on the build/dev machine only; fixed releases are `>=2.0.3` (major) while `metro@0.84.4` pins `^1.0.2` |
| `uuid@<11.1.1` (GHSA-w5hq-g745-h8pq v3/v5/v6 buffer bounds) → `xcode` → `@expo/config-plugins` → Expo CLI/prebuild/config toolchain | 1 moderate (effect chain: 12 rows) | No | **No** — Expo CLI/prebuild/config toolchain only; vulnerable call pattern not exercised |
| `decode-uri-component@<=0.4.2` (GHSA-vcc3-ghjq-m6fr ReDoS) → `expo-router@57 → query-string@7.1.3` | 1 moderate (effect chain: 3 rows) | No (transitive) | **Yes (runtime)** — crafted deep-link query string can hang the JS thread; no compatible fix exists in the SDK 57 envelope |
| `brace-expansion` (GHSA-q2hr-2g5m-vwhr quadratic expansion; GHSA-qhr7-859c-m2p7 + GHSA-6j4f-fj2g-mc7p uncontrolled recursion / stack exhaustion) → `jest → glob@7.2.3 → minimatch@3.1.5` and `@expo/fingerprint → minimatch@10.2.6` | 1 moderate + 2 high (added after the 2026-09-19 review; `reviewedAt` moved to 2026-09-30) | No | **No** — test-harness and Expo CLI glob expansion only; verified 2026-09-30 with `npm ls brace-expansion --omit=dev` (see below) |

### Campaign 069 — `brace-expansion` toolchain review (2026-09-30)

Three `brace-expansion` advisories appeared after the previous review
(`reviewedAt: 2026-09-13`). They were unallowlisted, so
`node scripts/validate-dependency-audit.mjs` exited 1 while the durable state
recorded the gate as clean.

**Reachability evidence (reproduced 2026-09-30).** Every production-tree path
to `brace-expansion` runs through build/test tooling:

```
expo-router@57.0.22 → @testing-library/react-native@14.0.1 → jest@29.7.0
  → @jest/core@29.7.0 → glob@7.2.3 → minimatch@3.1.5 → brace-expansion@1.1.18
  (also @jest/reporters, jest-config, jest-runtime)
expo@57.0.24 → @expo/fingerprint@0.20.13 → minimatch@10.2.6 → brace-expansion@5.0.9
react-native@0.86.3 → @react-native/jest-preset → babel-jest → babel-plugin-istanbul
  → test-exclude@6.0.0 → minimatch@3.1.5 → brace-expansion@1.1.18
```

No first-party source under `apps/mobile/src` imports `glob`, `minimatch`, or
`brace-expansion`; the vulnerable brace parser is not reachable from the app
bundle and never ships on a device.

**Classification:** `build-dev-toolchain` for all three, consistent with the
existing `image-size` and `uuid` dispositions. Per-advisory scoping was
re-verified end-to-end on 2026-09-30: removing a single advisory id from the
allowlist turns the real gate red (exit 1), and an injected non-reported
advisory id on the same package does not launder the reported ones.

**Exit condition that retires all three entries:** a toolchain upgrade that
drops `glob@7` / `minimatch@3` from the Jest 29 tree and removes
`brace-expansion@1.1.18` from the fingerprint path — concretely, a Jest major
upgrade (or dropping `@testing-library/react-native` from the production
`--omit=dev` tree) and/or an `@expo/fingerprint` release that no longer depends
on `minimatch@10`. Until then the vulnerable code is never executed by
first-party code and never shipped. Review again at the next Expo SDK upgrade.

Bucket summary per campaign rubric:

1. **Production/runtime reachable:** one accepted, time-bounded
   (`decode-uri-component`).
2. **Build/dev toolchain only:** all other findings.
3. **Unreachable/false-positive context:** the `uuid` advisory requires
   calling `uuid.v3/v5/v6` with an explicit `buf` argument; neither first-party
   code nor the affected toolchain paths exercise that pattern.
4. **Needs planned ecosystem upgrade:** yes — `image-size` and `uuid` resolve
   as a side effect of the next planned Expo SDK/React Native upgrade; the
   `decode-uri-component` entry drops when expo-router advances to a
   query-string major carrying the fix.

## Decision: no blind forced upgrade (unchanged policy)

`image-size` has no in-range fixed release for the installed Metro line;
`uuid >= 11.1.1` and `image-size >= 2.0.3` are semver-major changes that
belong to a planned Expo SDK/RN migration, not to a hardening cleanup. No
`npm audit fix --force` was run.

## Accepted debt (current)

The machine-readable dispositions are in
`scripts/certification/dependency-audit-allowlist.json` (7 entries,
`reviewedAt: 2026-09-30`):

- `decode-uri-component` GHSA-vcc3-ghjq-m6fr — `runtime-accepted-debt`,
  expires **2027-03-31**, with the re-evaluation condition tied to the next
  Expo SDK upgrade; the app-owned route envelope is defense in depth only.
  **Renewal owner:** release-engineering orchestrator; renew before
  2027-03-31 or at the next Expo SDK upgrade review, whichever comes first,
  and re-run this re-evaluation before renewing. The same expiry is stated
  in `.agent/KNOWN_ISSUES.md` (reconciled in Campaign 064).
- `image-size` GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq —
  `build-dev-toolchain` (never bundled).
- `uuid` GHSA-w5hq-g745-h8pq — `build-dev-toolchain`.
- `brace-expansion` GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, and
  GHSA-6j4f-fj2g-mc7p — `build-dev-toolchain` (Campaign 069 review above; the
  exit condition that retires them is stated there).

`node scripts/validate-dependency-audit.mjs` reports PASS with these 7
accepted advisories and no unallowlisted moderate+ production findings; its
self-test passes 41/41.

**Note on the 2026-09-19 count above:** 19 vulnerabilities (15 moderate,
4 high) was the pre-069 `npm audit` count. The three `brace-expansion`
advisories were already in the tree when Campaign 054's audit ran; they were
simply unallowlisted, so they are counted in the 19 but were not dispositioned
until 2026-09-30. Re-run `npm audit --json --omit=dev` to refresh the raw
count; the authoritative current status is the gate verdict above, not the
historical count.

## Historical note

The 2026-08-31 refresh recorded 16 vulnerabilities (12 moderate, 4 high) and
the 2026-08-18 audit recorded 23. Counts shifted with lockfile and ecosystem
changes; the current authoritative numbers are the 2026-09-19 figures above.
