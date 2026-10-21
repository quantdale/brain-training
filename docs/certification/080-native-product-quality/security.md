# Security posture — Campaign 080

Campaign: `080-native-product-quality`
Gate: `scripts/validate-dependency-audit.mjs` (network-dependent; re-run at final
integration). Result: **PASS** — 7 accepted advisories, **no unallowlisted
moderate-or-higher production findings**, exit 0. No security regression this
campaign.

## Accepted advisory register (7 unique GHSAs)

Carried forward from Campaign 079 with reachability, owner, review date, and exit
condition intact (full rationales in `scripts/certification/dependency-audit-allowlist.json`
and `.agent/DEPENDENCY_AUDIT.md`):

| GHSA | Package | Class | Status |
|---|---|---|---|
| ghsa-86w9-cpqp-85rv | node-forge | build/dev-toolchain | accepted (no in-range fix; dev-only code-signing path) |
| ghsa-w5hq-g745-h8pq | uuid | build/dev-toolchain | accepted (toolchain-only; not runtime-bundled) |
| ghsa-vfj7-8cjw-p6xm | braces | build/dev-toolchain | accepted (Metro file-map; no runtime import) |
| ghsa-hp3w-g68c-fv3c | sprintf-js | build/dev-toolchain | accepted (coverage-config toolchain) |
| ghsa-vcc3-ghjq-m6fr | decode-uri-component | **runtime-accepted-debt** | accepted (expo-router query-string; defense-in-depth via route-params) |
| ghsa-5p2g-fcmc-qvqq | image-size | build/dev-toolchain | accepted (Metro image parse; not shipped) |
| ghsa-w3rx-r6r6-pgpr | image-size | build/dev-toolchain | accepted (Metro ICNS parse; not shipped) |

Only `decode-uri-component` is a genuine runtime-reachable acceptance (ReDoS on a
crafted deep-link query), mitigated in impact by `routing/route-params.ts`
bounding (defense in depth, not a remediation). All others are build/dev-toolchain
reachable and never ship in the app bundle.

## Statements

- **No zero-vulnerability claim** is made while these accepted advisories remain.
- No new advisory was introduced or waived this campaign (no dependency or
  lockfile changes were made).
- No security gate was disabled or weakened for convenience; the dependency gate
  is re-run at the final integrated revision.
- The QA instrumentation added this campaign (host-side harness) introduces **no**
  runtime network dependency and **no** credential exposure.

Review/exit conditions and remediation dependencies are preserved in the reviewed
allowlist; advisories with future in-range fixes are dropped at the next Expo/Metro
upgrade per their exit conditions.
