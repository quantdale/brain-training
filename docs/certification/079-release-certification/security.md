# Security report — Campaign 079

**Date:** 2026-10-21 · **Scope:** `apps/mobile` (`npm audit --omit=dev`,
auditReportVersion 2) · **Gate:** `scripts/validate-dependency-audit.mjs`
(policy allowlist `scripts/certification/dependency-audit-allowlist.json`)

## 1. Refreshed evidence (F1)

- Before remediation: 70 package-path entries (53 high, 17 moderate) mapping
  to **13 npm advisory ids / 10 unique GHSA advisories** (10 register
  entries).
- After remediation: 68 package-path entries mapping to **7 npm advisory ids
  / 7 unique GHSAs** (7 register entries).
- Gate at `9c4dd138`: **PASS — 7 accepted, 0 unallowlisted moderate+
  production findings**; classifier self-test 41/41.

## 2. Remediated this program (F2) — real fixes, not waivers

| Advisory | Severity | Fix | Method |
|---|---|---|---|
| GHSA-q2hr-2g5m-vwhr (brace-expansion, quadratic expansion DoS) | moderate | 1.1.18 → 1.1.21 | in-range `npm update brace-expansion` (minimatch `^1.1.7`) |
| GHSA-qhr7-859c-m2p7 (brace-expansion, nested-group stack exhaustion) | high | 1.1.18 → 1.1.21 | same |
| GHSA-6j4f-fj2g-mc7p (brace-expansion, parseCommaParts stack exhaustion) | high | 5.0.9 → 5.0.12 | same (minimatch `^5.0.8`) |

Lockfile-only diff (10 version lines). Register entries **removed**, not
re-waived. Zero first-party imports; toolchain-only reachability (jest glob
expansion, Expo fingerprint step) unchanged.

## 3. Accepted residual risk (F4) — 7 entries, each with owner/review/exit

| Package | GHSA | Class | Why still accepted (re-verified 2026-10-21) | Exit condition |
|---|---|---|---|---|
| decode-uri-component | GHSA-vcc3-ghjq-m6fr | **runtime-accepted-debt** | expo-router 57.0.28 (latest SDK 57 line) still pins `query-string ^7.1.3` → `decode-uri-component ^0.2.2`; fix 0.5.0 is ESM-only and breaks the CJS require in route parsing | expo-router moves to a query-string major with CJS interop; **expires 2027-03-31** |
| node-forge | GHSA-86w9-cpqp-85rv | build-dev-toolchain | latest published node-forge is still 1.4.0 (advisory covers every release); Expo CLI prebuild/verification only; never bundled | upstream release or Expo CLI drop |
| braces | GHSA-vfj7-8cjw-p6xm | build-dev-toolchain | latest published braces is still 3.0.3 (= advisory range end) | upstream release / micromatch line move |
| sprintf-js | GHSA-hp3w-g68c-fv3c | build-dev-toolchain | latest published sprintf-js is still 1.1.3 (= advisory range end) | upstream release |
| image-size | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq (2 entries) | build-dev-toolchain | fixes only in 2.0.3+; metro pins `^1.0.2` (out of range) | metro upgrades image-size line |
| uuid | GHSA-w5hq-g745-h8pq | build-dev-toolchain | fix at 11.1.1; `xcode → @expo/config-plugins` pins `^7` (out of range) | toolchain upgrade |

Every entry carries rationale + reachability, owner (release-security,
program 079), `reviewBy: 2027-03-31`, exit condition and remediation
dependency (allowlist fields added this program). Runtime exposure is limited
to the single decode-uri-component ReDoS via crafted deep-link query strings;
app-owned route parameters are bounded by `src/routing/route-params.ts`
(defense in depth — not a remediation).

## 4. Non-findings / controls verified

- `npm audit fix --force` NOT run; no overrides; no broad exceptions; no
  no-op gates.
- APK permission boundary exact (8 permissions; RECORD_AUDIO and
  SYSTEM_ALERT_WINDOW blocked and absent) — release-matrix.md B.
- Secret boundary gate PASS over tracked files; no credentials in the repo;
  ARTEMIS provider keys remain external-only.

## 5. Verdict

**Security: CONDITIONAL GO.** The defined policy gate passes with zero
unallowlisted findings and three genuine remediations landed. Residual risk
is7 reviewed acceptances (1 runtime-debt with dated expiry and exit
condition; 6 toolchain-only, never bundled).
