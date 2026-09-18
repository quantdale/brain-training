# Campaign 045 Dependency Alignment

**Campaign:** `045-expo-sdk57-patch-alignment`
**Mode:** day (repository default; no explicit night selection)
**Starting SHA:** `59bc801bbaa047834f78819370aa7a805acb1783`
**Date:** 2026-09-19

## Finding

The initial supported Expo Doctor run reported 20/21 checks passed. The only
failure was the Expo SDK57 patch family: the declared/resolved versions were
behind the versions expected by the installed SDK. The drift was limited to:

| Package | Before | After |
| --- | --- | --- |
| `expo` | `~57.0.23` | `~57.0.24` |
| `expo-asset` | `~57.0.15` (resolved `57.0.17`) | `~57.0.18` |
| `expo-constants` | `~57.0.16` (resolved `57.0.18`) | `~57.0.19` |
| `expo-router` | `~57.0.21` | `~57.0.22` |
| `expo-sharing` | `~57.0.20` | `~57.0.21` |

The maintenance command was:

```text
npx expo install expo@~57.0.24 expo-asset@~57.0.18 expo-constants@~57.0.19 expo-router@~57.0.22 expo-sharing@~57.0.21
```

No major upgrade, unrelated dependency modernization, native source change,
game source change, or CI workflow change was made. The package manifest diff
contains only these five direct package versions. The lockfile diff is 74
lines (37 additions and 37 deletions), covering those packages and their
coherent Expo patch-level transitive updates, including
`@expo/metro-runtime`, `@expo/ui`, and nested `@expo/cli`.

## Verification

- `npx --yes expo-doctor`: **21/21 checks passed; no issues detected**.
- `npm ls --depth=0`: the five target packages resolve to the aligned versions
  above and the remaining direct dependency versions are unchanged.
- `node scripts/validate-dependency-audit.mjs`: **PASS**; five documented
  advisory IDs remain accepted, with no unallowlisted moderate-or-higher
  production finding.
- Raw `npm audit --omit=dev --json`: **20 findings** — 15 moderate, 5 high,
  0 low, 0 critical. The report is retained outside Git at
  `D:\Temp\campaign045-audit.json`.

The raw audit's proposed fixes include semver-major changes outside this
campaign's scope. No `npm audit fix` was run.

