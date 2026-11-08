# Security posture — Campaign 080

Campaign: `080-native-product-quality`
Gate: `scripts/validate-dependency-audit.mjs` (network-dependent; re-run at final
integration).

**Maintenance result (2026-11-08): FAIL, exit 1, narrower than 2026-11-02.**
`node-forge` was updated 1.4.0→1.4.3 inside `^1.3.3`. The forge advisories are
gone from `npm audit --omit=dev`. No new waiver and no major override. Four
unwaived advisories remain: `zod / GHSA-mrhx-c7xc-m3w5` (high), `decode-uri-component /
GHSA-qr28-fpjm-wq7f` (high), `glob / GHSA-3g3m-2fjr-6pw4` (moderate), `minimatch /
GHSA-g3hv-75wg-m249` (moderate). Each fix is outside the parent semver range.
See `.agent/DEPENDENCY_AUDIT.md`. The Zod disposition below is unchanged.

**Earlier fresh result (2026-10-24): FAIL, exit1** — newly reported unwaived
High `zod / GHSA-mrhx-c7xc-m3w5` via ExpoCLI. Independent review supports only
narrow build-tool classification, contingent on explicit owner risk acceptance;
no compatible Zod3/CLI57 patch was found. No waiver, incompatible Zod4 override
or gate relaxation has been applied. Hostile local plugin metadata/output can
exhaust developer/CI Node memory. See
[`zod-advisory-disposition.md`](./zod-advisory-disposition.md).

The earlier campaign result was PASS with 7 accepted advisories and zero
unallowlisted moderate-or-higher findings; it is historical, not current green.

## Accepted advisory register after 2026-11-08

The live register is `scripts/certification/dependency-audit-allowlist.json`
(`reviewedAt` 2026-11-08): image-size `GHSA-w3rx-r6r6-pgpr`, image-size
`GHSA-5p2g-fcmc-qvqq`, uuid `GHSA-w5hq-g745-h8pq`, and decode-uri-component
`GHSA-vcc3-ghjq-m6fr` (runtime-accepted-debt, expires 2027-03-31). `node-forge
GHSA-86w9-cpqp-85rv` was removed because 1.4.3 is no longer reported. `braces`
and `sprintf-js` entries were removed because the fresh audit no longer reports
them; that is not an upgrade of those packages.

## Historical accepted advisory register (7 unique GHSAs, 2026-10-24)

Carried forward from Campaign 079 at that date. Not the current register:

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

- **No zero-vulnerability claim** is made while accepted or unwaived advisories remain.
- The 2026-10-24 Zod report was not introduced by a dependency change. The
  2026-11-08 `node-forge` lockfile update is a separate in-range remediation;
  Zod remains unwaived and the gate still fails.
- No security gate was disabled or weakened for convenience; the dependency gate
  is re-run at the final integrated revision.
- The QA instrumentation added this campaign (host-side harness) introduces **no**
  runtime network dependency and **no** credential exposure.

Review/exit conditions and remediation dependencies are preserved in the reviewed
allowlist; advisories with future in-range fixes are dropped at the next Expo/Metro
upgrade per their exit conditions.
