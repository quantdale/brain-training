# Dependency Audit Triage

**Date:** 2026-09-19 (Campaign 054 refresh; supersedes the 2026-08-31 Campaign
020 refresh, the 2026-08-24 Campaign 013 audit, and the 2026-08-18 006R audit)
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
`scripts/certification/dependency-audit-allowlist.json` (4 entries):

- `decode-uri-component` GHSA-vcc3-ghjq-m6fr — `runtime-accepted-debt`,
  expires **2027-03-31**, with the re-evaluation condition tied to the next
  Expo SDK upgrade; the app-owned route envelope is defense in depth only.
- `image-size` GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq —
  `build-dev-toolchain` (never bundled).
- `uuid` GHSA-w5hq-g745-h8pq — `build-dev-toolchain`.

`node scripts/validate-dependency-audit.mjs` reports PASS with these 4
accepted advisories and no unallowlisted moderate+ production findings; its
self-test passes 41/41.

## Historical note

The 2026-08-31 refresh recorded 16 vulnerabilities (12 moderate, 4 high) and
the 2026-08-18 audit recorded 23. Counts shifted with lockfile and ecosystem
changes; the current authoritative numbers are the 2026-09-19 figures above.
