# Security posture — Campaign 080

Campaign: `080-native-product-quality`
Gate: `scripts/validate-dependency-audit.mjs` (network-dependent; re-run at final
integration). **Current fresh result (2026-10-24): FAIL, exit1** — newly
reported unwaived High `zod / GHSA-mrhx-c7xc-m3w5` via ExpoCLI. Independent
review supports only narrow build-tool classification, contingent on explicit
owner risk acceptance; no compatible Zod3/CLI57 patch was found. No waiver,
incompatible Zod4 override or gate relaxation has been applied. Hostile local
plugin metadata/output can exhaust developer/CI Node memory. See
[`zod-advisory-disposition.md`](./zod-advisory-disposition.md).

The earlier campaign result was PASS with7 accepted advisories and zero
unallowlisted moderate-or-higher findings; it is historical, not current green.

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
- No dependency or lockfile change introduced the new report; the freshly
  reported Zod High remains unwaived and keeps the gate failing.
- No security gate was disabled or weakened for convenience; the dependency gate
  is re-run at the final integrated revision.
- The QA instrumentation added this campaign (host-side harness) introduces **no**
  runtime network dependency and **no** credential exposure.

Review/exit conditions and remediation dependencies are preserved in the reviewed
allowlist; advisories with future in-range fixes are dropped at the next Expo/Metro
upgrade per their exit conditions.
