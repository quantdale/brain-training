# GHSA-mrhx-c7xc-m3w5 — bounded dependency disposition

**Review date:** 2026-10-23

**Reviewed checkout:** `481bf8aaaeb70120a8285d0ad2eb8aa415220e0c`

**Disposition:** **Accept only the narrow `build-dev-toolchain` classification, pending an explicit per-GHSA owner waiver.** This is not a fix, proof that the dependency is harmless, or release certification. Do not force a Zod 4 override across Expo CLI’s Zod 3 dependency contract. The current dependency-audit failure remains until the owner records an explicit waiver or a compatible fix lands.

## Advisory and installed dependency

GitHub’s advisory API identifies **CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5**, High (CVSS 3.1 **7.5**, availability-only), as uncontrolled memory consumption in Zod array parsing. A large array with invalid elements can accumulate per-element validation issues until the Node process exhausts memory. The authoritative range is `<4.6.6`; first patched version is `4.6.6`. Advisory metadata was read from [GitHub Security Advisories](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), published 2026-10-01 and updated 2026-10-23.

The locked app tree has `expo@57.0.24 → @expo/cli@57.0.26 → zod@3.25.76`. `npm explain zod` also shows a dev-only path through `eslint-config-expo@57.0.2 → eslint-plugin-react-hooks@7.1.1 → zod@3.25.76`. `zod` is not a direct dependency in `apps/mobile/package.json`, and no first-party `apps/mobile/src` import was found. Local Zod 3.25.76’s `src/v3/types.ts` confirms array validation maps each element and merges all parse results; the inspected parser has no array-wide issue cap or early stop.

## Compatible fix assessment

**No publisher-provided fixed Zod 3 release or compatible fixed Expo CLI resolution was found.** Read-only npm registry metadata reports latest stable Zod 3 as `3.25.76` (published 2025-07-08), while the fixed release is Zod 4.6.6 (current `latest` tag observed as 4.6.7). The current Expo CLI 57.0.26 and the newest SDK-57 CLI release, 57.0.32, both declare `zod: ^3.25.76`. Updating within that Expo CLI line therefore does not resolve the advisory.

Zod 4 publishes a `zod/v3` compatibility subpath, but Expo CLI’s inspected code uses `require("zod")` at the package root. A package-wide override to Zod 4 would resolve that import to the Zod 4 root API, not automatically to `zod/v3`, and would violate Expo CLI’s declared `^3.25.76` range. No compatibility/build test was authorized or run. A hand-maintained Zod 3 backport is conceivable, but it is not an upstream compatible release or a verified patch; introducing one would require targeted security regression tests and maintenance ownership. It is not recommended for this bounded review.

**Recommendation:** do not apply a blanket Zod 4 override. Re-evaluate for an upstream Zod 3 security release or an Expo CLI release that intentionally adopts a patched API/resolution. Until then, use the narrow toolchain classification below rather than claiming remediation.

## Reachability and threat boundary

The vulnerable package is present in the development/build dependency tree, including Expo CLI and lint tooling. Source inspection of the installed Expo CLI 57.0.26 found relevant parsing in its development-tools plugin code:

- `DevToolsPlugin.js` validates plugin metadata with `PluginSchema.safeParse(plugin)`. The metadata is obtained through Expo native-module autolinking from project-installed packages. Its nested command, environment, and parameter arrays have no `.max()` constraint.
- `DevToolsPluginCliExtensionResults.js` runs a plugin’s local CLI extension, parses its stdout/stderr as JSON, then validates it with `DevToolsPluginOutputSchema = z.array(DevToolsPluginOutputLinesSchema)`, also without an array-size bound. A second validation occurs in the MCP extension callback after executing that local plugin. The output collector’s V8 maximum-string-length guard is not a practical small resource limit and does not establish safety against issue-object amplification.
- The MCP tool schema exposes a command enum and scalar parameters; the observed unbounded array parse is on local plugin metadata or the local extension’s output, not directly on an arbitrary app request body.

Accordingly, a plausible impact is **host-side denial of service** (developer or CI Node process crash/OOM) if an attacker can supply hostile autolinked plugin metadata or make an installed extension emit a sufficiently large invalid JSON array. An MCP-mediated route additionally requires a development server with the relevant local extension registered and an attacker able to invoke it; user-specific MCP exposure was not assessed. These conditions are materially different from an unauthenticated production-app request. No direct production API/backend path or first-party app Zod parser was found in the examined scope. This does not rule out hostile repositories, malicious dependencies, or an enabled development/MCP extension as build-host attack surfaces.

## Shipped-artifact evidence and limits

- The authorized parent Android release source map, `apps/mobile/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map` (16,335,297 bytes; SHA-256 `5cd53f6f2477e9eeea164dc1c703a444d71b541b877b077dd82159fb1fcfaf87`), contains 2,464 source entries. None names Zod; there is one Expo CLI `metro-require/require.js` shim source, but no Zod module. Its `sourcesContent` has no `ZodError`, `$ZodArray`, `handleArrayResult`, `z.array(`, or Zod import markers.
- The authorized `apps/mobile/dist` web export contained 46 JavaScript files (~4.51 MB). A broad case-insensitive `zod` substring match was inside a base64-encoded asset embedded in the entry chunk, not a code/module name; recognizable Zod parser/module markers were absent. The entry chunk SHA-256 was `778675efe98bbb8ab43f84627e81d2f8e0bfb27a8bb6ef6c8549381e12f3ae8d`.

These are source-map/export observations, not native acquisition, a new build, a guarantee for every build configuration, or proof that the installed toolchain cannot be attacked. The parent release artifacts were not independently reconciled to this review checkout’s exact source SHA. No memory-exhaustion PoC, network probe, build, emulator run, or full/new dependency audit was performed; the stated new High audit failure is not re-reported here as a fresh run.

## Narrow waiver requirements

If the owner chooses to clear the current audit gate by policy, record a **new explicit allowlist entry for exactly `zod` + `GHSA-mrhx-c7xc-m3w5`**, classification `build-dev-toolchain`; existing entries do not cover this new GHSA. Suggested governance fields:

- **Owner:** release-security; owner-of-record `quantdale`.
- **Review by:** `2027-03-31`, and again at the next Expo SDK/CLI upgrade.
- **Rationale:** the vulnerable parser is present in developer/CI Expo CLI and lint tooling, but no first-party import or Zod parser was found in the inspected shipped Android source map/web export; describe the local-plugin/MCP build-host DoS preconditions above. Do not state “not exploitable” or “fixed.”
- **Exit condition:** remove the waiver when (a) a patched Zod 3 release is available and the resolved dependency tree uses it, (b) Expo CLI adopts a patched resolution/API compatibly, or (c) the vulnerable package/parser is removed from the toolchain. At exit, verify the lock/tree, run targeted CLI/plugin tests and required build validation, and re-check shipped source maps. Reassess immediately if first-party/server runtime Zod parsing is introduced or a reachable untrusted-input path is established.

This review does not add the waiver or edit production, lockfile, configuration, or audit files. Repository `git status` remained clean at the end of review.
