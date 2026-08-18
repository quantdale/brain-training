# Dependency Audit Triage (006R task 11.5)

**Date:** 2026-08-18
**Scope:** `apps/mobile` (`npm audit`, auditReportVersion 2)
**Result:** 23 vulnerabilities (8 moderate, 15 high)

## Classification

| Bucket | Count | Production-reachable? |
| --- | --- | --- |
| Transitive via `@expo/*` build toolchain (`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/prebuild-config`, `expo-splash-screen`) | 23 (all) | **No** — build/dev toolchain only |

Findings are **indirect** (`isDirect: false`) and reachable only through `expo` and its
CLI/metro/prebuild dependencies. They are **not** shipped in the app runtime that end users
execute; they affect the local build/prebuild toolchain.

## Decision: no blind forced upgrade

The only remediation `npm audit` offers for the bulk of findings is a **major `expo` upgrade**
(e.g. `expo@53.0.27` is the proposed fix, `isSemVerMajor: true`). Per 006R task 11.5 — *"the
agent MUST NOT use blind forced upgrades solely to make an audit count disappear"* — we do
**not** force this upgrade.

### Accepted debt (rationale)

- **Risk is build-time, not runtime.** The vulnerable packages are part of the Expo
  CLI / prebuild / Metro toolchain used to compile the app. They are not embedded in the
  installed app binary, so end-user exposure is nil for the shipped product.
- **Forced upgrade is semver-major and breaking.** An Expo SDK/RN bump is a planned,
  campaign-sized migration (prebuild config, native modules, SDK compatibility), not a
  one-line fix. Doing it solely to clear an audit count would violate the no-blind-upgrade
  rule and risk regressions across the 20-game catalog.
- **Cadence.** Revisit on the next **planned** Expo SDK upgrade (tracked separately from this
  integrity campaign). At that point the toolchain vulns are resolved as a side effect of the
  supported upgrade path.

## Actions taken

- Added the triage gates to CI (`app-ci.yml`): lint, registry `--check`, provenance drift,
  task-ownership, repo-state/OpenSpec integrity, typecheck, tests, web export, Expo Doctor.
- Recorded the green-main rule (`.agent/GOVERNANCE.json` `greenMain`) so a required check may
  be pushed only as a documented blocker, never labeled green.

## Re-audit trigger

Re-run `npm audit` after any of: direct dependency change, Expo SDK bump, or quarterly
schedule. Escalate to a planned upgrade only if a vulnerability becomes **direct** or
**production-runtime reachable** (e.g. a vulnerable runtime package ships in the bundle).
