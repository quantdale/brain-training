# Dependency Audit Triage

**Date:** 2026-08-31 (Campaign 020 refresh; supersedes the 2026-08-24 Campaign 013 audit)
**Scope:** `apps/mobile` (`npm audit`, auditReportVersion 2; production-only view via `--omit=dev` produced the identical report — no dev-only dependency adds findings)
**Context:** 42-game catalog, Expo SDK 57 / React Native 0.86.3 toolchain, offline-first product
**Result:** **16 vulnerabilities (12 moderate, 4 high)** — down from 23 (8 moderate, 15 high) at the previous audit

## Current classification

| Root cause | Findings | Direct? | Production/runtime reachable? |
| --- | --- | --- | --- |
| `image-size` (GHSA-w3rx-r6r6-pgpr ICNS loop, GHSA-5p2g-fcmc-qvqq JXL/HEIF loops) → `metro` → `metro-config`, `metro-transform-worker` | 4 high | No | **No** — Metro parses images on the build/dev machine only; nothing ships in the app bundle |
| `uuid@<11.1.1` (GHSA-w5hq-g745-h8pq v3/v5/v6 buffer bounds) → `xcode` → `@expo/config-plugins` → `@expo/cli`, `@expo/config`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `expo-sharing`, `expo-splash-screen` | 12 moderate | No | **No** — Expo CLI/prebuild/config toolchain only |

Bucket summary per campaign rubric:

1. **Production/runtime reachable:** none.
2. **Build/dev toolchain only:** all 16.
3. **Unreachable/false-positive context:** the `uuid` advisory requires calling `uuid.v3/v5/v6` with an explicit `buf` argument; neither first-party code nor the affected toolchain paths exercise that pattern.
4. **Needs planned ecosystem upgrade:** yes — both roots resolve as a side effect of the next planned Expo SDK upgrade (the only remediation npm offers is a semver-major Expo change, e.g. downgrade-to-46 nonsense or a future SDK bump).

## Decision: no blind forced upgrade (unchanged policy)

`image-size@1.2.1` is already the newest release and the advisories currently cover
all published versions (no fixed upstream release exists yet). `npm audit fix`
(non-breaking) was run on 2026-08-24: it deduplicated the lockfile (217 lines) but
cannot clear either root without a breaking Expo change, which remains prohibited
solely to make an audit count disappear.

## Accepted debt (rationale)

- **Risk is build-time, not runtime.** Vulnerable packages execute only on developer/
  CI machines during bundling/prebuild; they are not embedded in the shipped app binary.
- **No fixed upstream exists today** for image-size; uuid remediation requires a major
  Expo/RN migration that is planned separately from hardening campaigns.
- **Re-audit trigger:** any direct dependency change, any Expo SDK bump, quarterly cadence,
  or immediately if a finding becomes direct or runtime-reachable.

## Fresh-environment verification performed this refresh

- `npm audit` and `npm audit --omit=dev`: identical 16-finding report (no prod-only additions); both remain limited to the build/dev toolchain.
- `npx expo-doctor`: **21/21 checks passed** after the lockfile dedupe.
- `npm run typecheck`: clean; `npm run lint`: **0 errors / 0 warnings**.
- Full Node 22 Jest: **490/494 suites, 6096/6101 tests, 5 snapshots**; 4 suites / 5 tests skipped by the explicit measurement allowlist.
- `npx expo export --platform web`: PASS (20 static routes).
- `node scripts/validate-secrets.mjs --self-test`: PASS; tracked-file scan CLEAN (1827 text files; no high-confidence AWS/GitHub/Slack/OpenAI/Supabase/PEM patterns).
- Offline boundary validator: CLEAN (932 source files scanned).
- Permissions boundary: RECORD_AUDIO / SYSTEM_ALERT_WINDOW blocked at config level
  (`app.json android.blockedPermissions` + expo-audio flags), now pinned against drift by
  `plugins/__tests__/release-boundary-permissions.test.ts`.

## Historical note

The 2026-08-18 audit (006R task 11.5) recorded 23 vulnerabilities against the then-current
toolchain and added the CI triage gates + green-main rule. Its "20-game catalog" reference
was historical context even then and is superseded by this document's current 42-game state.
