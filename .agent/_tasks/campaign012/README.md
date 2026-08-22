# Campaign 012 — Broad Convergence and Release-Candidate Preparation

**Campaign id:** `012-broad-convergence-release-prep`
**Predecessor:** `011-full-validation-hardening` (COMPLETED at `b8ca36f`)
**Mode:** day (default; owner did not select night)
**Opened:** 2026-08-22

## Mission

Consolidate. Complete. Simplify. Prepare for release.

- FINISH the GameHost migration (18/42 → target 42/42; correctness beats numeric completion)
- COMPLETE Workout V2 product surfaces (short/standard/extended/focus, resume, history)
- REMOVE known Low/Medium debt (equation-builder dead templates, dead content branches)
- IMPROVE release readiness (UX coherence, build determinism, dependency audit, iOS source compat)
- PRESERVE the 42-game quality bar and Android device proof

No new catalog growth quotas. No new speculative systems.

## Topology

One parent orchestrator owns Git, shared files, generated registries, schema ordering,
durable state, cross-worker interfaces, integration, full validation, and all
emulator/device journeys. Workers never branch/commit/push and write ONLY their owned paths.
Workers run TARGETED validation only (their module tests + tsc). The parent runs full
convergence gates at campaign close.

Concurrency: waves of ≤7 concurrent coders (day mode / GOVERNANCE default), 16 packets total,
workers reused for a second wave where scope remains.

## Packets

| Packet | Mission | Owned write surface |
|---|---|---|
| W01 | GameHost migration batch A (6 simple timer/response games) | those 6 game modules |
| W02 | GameHost migration batch B (6 medium multi-round games) | those 6 game modules |
| W03 | GameHost migration batch C (6 complex/board/spatial games) | those 6 game modules |
| W04 | GameHost migration batch D (6 special-lifecycle games) | those 6 game modules |
| W05 | GameHost architecture consolidation | `src/components/game-host/**` |
| W06 | Workout engine/template depth | `src/workout/**`, workout repositories |
| W07 | Workout UX (picker/history/summary/home surfacing) | home workout section + new `src/components/workout/**` |
| W08 | Workout/device harness support (short/focus/resume flows) | `scripts/qa/**`, workout automation paths |
| W09 | Math content quality (dead easy templates + tier integrity) | math game generator/content/difficulty files |
| W10 | Global content integrity audit (non-math catalog) | non-math game content/generator fixes |
| W11 | Product UX polish (Games/Progress/Rewards/Results/Game Detail) | those screens/components |
| W12 | Settings/Profile/Data Management maturity | profile/settings/data-management surfaces |
| W13 | Scale/query maturation (sync scans, aggregates) | progression/query/backup serialization internals |
| W14 | Android build/config/permissions audit + determinism | app.json, plugins/, android config scripts |
| W15 | Dependency audit (patch drift, unused, deprecated) | report-first; lockfile changes by parent only |
| W16 | iOS static preparation (source-level compatibility) | platform-seam source files |

Shared hotspots (registry.generated.ts, package manifests, app.json, shared SDK contracts,
navigation registry, db migrations, durable `.agent/` state): parent-only. Workers report
NEEDS_PARENT items in their packet's Completion summary.

## Migration contract (W01–W04)

Preserve per game: mechanics, testIDs, tutorial behavior, pause semantics, scoring,
session persistence shape, QA force states, accessibility, sensory events, results behavior.
Exemplar method: see W17/W18 packets of campaign 010 and `games/math-fast-math/screen.tsx`.
The catalog contract scanner (`src/sdk/__tests__/catalog-contracts.test.ts`) already
recognizes GameHost-delegating modules — do NOT edit it.
If a game is a poor fit for GameHost, report it with reasons instead of forcing migration.

## Validation expectations (per worker)

- `npx tsc --noEmit` clean (apps/mobile)
- targeted Jest over owned modules green
- no edits outside owned surface (`git status --porcelain` self-check)

## Status board

See each `W*.md`. Parent updates statuses at wave boundaries.
