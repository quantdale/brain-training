# Residual census — seeds for the post-067 hardening phase

**Produced by:** Change 066 (`adversarial-convergence-static-governance`),
from the 065 deferred list, the 066 recon lanes, and the program census.
**Purpose:** seed hardening Pass A (static/architecture/contracts/security),
Pass B (runtime/lifecycle/persistence/recovery/perf), and Pass C
(release/UX/a11y/hostile-sequences/production gaps). Every item names the
evidence and a verification recipe so the hardening phase does not
re-discover it.

## Pass A — static / architecture / contracts / security

| # | Item | Evidence | Recipe |
|---|---|---|---|
| A1 | Content Platform depends on two specific game modules (`content/registry.ts`) | 066 lane A F2; BACKLOG row | Generate/register bundled pack sources from game metadata, then delete the imports; re-run `src/content` suites |
| A2 | Type-only import cycle cluster `db ↔ workout ↔ personalization ↔ rating` | 066 lane A F1 (runtime graph acyclic) | Extract leaf type modules for `WorkoutInstance`/`WorkoutStatus`; verify with an AST import graph (tests excluded) |
| A3 | Date-key helpers duplicated with divergent validation (`streaks` throws on malformed; `workout/today` rolls over) | 066 lane A F9 | Consolidate into one leaf date util; add malformed-date tests for both call sites |
| A4 | Content-pack validation helpers duplicated across two games | 066 lane A F8 | Shared `content/validate.ts` primitive; keep per-game item schemas |
| A5 | `hooks/use-theme.ts` imports a component provider | 066 lane A F4 | Move settings context to a non-component module or inject explicitly |
| A6 | Test-only UI components (`Avatar`, `ScreenHeader`, `LevelCard`, `StreakCard`, `ResultRow`/`StatRow`, `LiveRegion`) | 066 lane A F10 | Adopt into product or drop; do not delete while tests depend |
| A7 | Coverage thresholds absent for critical trees | 065 deferral; BACKLOG row | Decide CI cost, add `collectCoverage` thresholds for `db`/`data-portability`/`workout`/`rating`/`quests` |
| A8 | Backup checksum is integrity-only, not a MAC (forgeable with recompute) | DEFERRED_DECISIONS; 065 data lane | Owner product decision (accepted today); if encryption lands, revisit |
| A9 | `allowBackup=true` rides the platform default; exported backups may enter cloud auto-backup | BACKLOG owner product decision | Owner decision + manifest/rules change if excluding; device verification of backup domains |
| A10 | Unauthenticated custom scheme `braintraining://` | 065 census security lane | Assess deep-link abuse surface with the route envelope; likely accepted |
| A11 | Snapshot review debt (single ~304 KB visual baselines file, wholesale `-u` history) | 065 deferral; BACKLOG row | Review or replace with targeted assertions |

## Pass B — runtime / lifecycle / persistence / recovery / performance

| # | Item | Evidence | Recipe |
|---|---|---|---|
| B1 | Cold deep link to a game then bare `router.back()` on `Done`/`Quit` (42 game screens) | 065 source lane (unverified; 058's `useSafeBack` covers pushed routes only) | Emulator deep-link probe: open `braintraining://game/memory`, complete/quit, assert a safe fallback instead of a stranded stack; fix with the shared safe-back if reproduced |
| B2 | v12 repair keeps the earliest duplicate `rating_history` row without reconciling `domain_ratings` | 065 data lane; BACKLOG row | Decide: rebuild `domain_ratings` from retained history in migration or record accepted mismatch; migration tests with crafted duplicates |
| B3 | Backup rename lacks fsync (power-loss window) | 065 data lane; BACKLOG row | If expo-file-system exposes fsync, flush before rename; else `.prev` rotation + read-back verify |
| B4 | UI-driven crafted replace-import and wipe → Home-empty probes were unit/DB-level only | 065 DEVICE_065 "not covered" | ARTEMIS/Files-picker journey on the 067 artifact: crafted backup import, then wipe → empty Home, no recovery loop |
| B5 | `memory-sequence-memory` stochastic pause race | VALIDATION disclosure | Keep the honest-retry disclosure; revisit if it recurs in the 067 soak |
| B6 | uiautomator `--compressed` partial-tree race can miss mid-transition nodes | VALIDATION tooling note; BACKLOG closure criterion | Device lanes prefer settle-waits/semantic retries; reproduce-or-clear criterion recorded |
| B7 | First-install ANR (050 observed once; 054/063 bounded non-reproduction) | KNOWN_ISSUES; ledger | 067 first-install lane on the final artifact with bounded cold launches |
| B8 | Host-stall no-frame class in canary runs | VALIDATION (055/057) | 067 six-way matrix frame proof on the final artifact; classify host/tooling if it recurs |
| B9 | Progress snapshot aggregation cost on focus (065 throttled, not re-measured) | 061 repair; perf baselines | Re-run `scripts/perf/run-probes.mjs` on the final tree and compare against the committed 064 baselines on the same host |
| B10 | `decode-uri-component` ReDoS accepted debt | dependency-audit allowlist 2027-03-31 | Re-evaluate at the next Expo SDK upgrade; drop entry when a fixed `query-string` major lands |

## Pass C — release / UX / a11y / hostile sequences / production gaps

| # | Item | Evidence | Recipe |
|---|---|---|---|
| C1 | Six-way pixel/a11y matrix on the final artifact | 055 matrix predates 056–066; 065 deferral | 067: 66 canonical surfaces + 42 interaction surfaces × default/compact/font-scale-2 × light/dark; 0 unlabelled, 0 decorative leaks, 0 unresolved undersized |
| C2 | Gameplay captures for 41/42 games at font-scale-2/compact/dark | 065 pixels lane | 067 interaction matrix expansion; guard against clipping with the new catalog guards |
| C3 | Landscape/expanded tier untested | 065 pixels lane | Add landscape captures to the 067 matrix or record accepted debt |
| C4 | RTL absent (`I18nManager` never used) | 065 pixels lane | Informational unless an RTL locale is planned; owner decision |
| C5 | Long user strings (profile name, backup name, armed confirm label) untested | 065 pixels lane | 067 capture with maximum-length strings at compact/font-scale-2 |
| C6 | `A11yDialog` has no height strategy (exported, unused) | 065 pixels lane | Fix before adoption (cap + scroll body) or keep unused |
| C7 | `DifficultySelector` announces radiogroup with button roles | 065 pixels lane | Switch children to radio semantics; a11y test |
| C8 | `attention-target-count` grid cell role=image without label (non-interactive today) | 065 pixels lane | Label or make non-accessible before wiring a press handler |
| C9 | Import/OOM when a provider omits both `asset.size` and stat | 062 fallback; 065 data lane | Hostile-file soak: provider without size metadata; cap applies after materialization (documented) |
| C10 | Human TalkBack/VoiceOver, iOS, physical/OEM, store signing, SAF consent | Program boundaries | MANUAL/EXTERNAL lanes; list explicitly NOT VALIDATED in the 067 terminal ledger |

## 067 preconditions (from lane C)

1. Create and strict-validate `067-terminal-whole-product-certification`
   before implementation (program §6.2).
2. Build one release artifact from the exact 067 source commit; record
   SHA-256, size, package/version, signing status, Metro independence,
   bundle hash + freshness markers; no source drift after certification.
3. Re-run the strongest full matrix + all validators + probes on that
   tree; record exact counts.
4. Full native journey on the exact artifact (startup, routes, recovery,
   provider lifecycle, completion persistence, SQLite audit, log scan).
5. Six-way pixel/a11y matrix + the Pass C items accepted into 067.
6. Dispose the 065/066 deferrals that require device proof (B1, B4) or
   record them as accepted debt.
7. Produce the terminal ledger with per-item classifications and zero
   unresolved repository-owned Critical/High/Medium defects.
