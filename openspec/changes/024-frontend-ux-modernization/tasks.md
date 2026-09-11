# Tasks — Campaign 024

Ordered implementation checklist. `[x]` = complete with evidence.

## Phase 0 — Activation

- [x] Recon swarm (4 scouts/agents) over screens, components, a11y, motion/perf.
- [x] Refero research: core screens + play screens → `research/*.md`.
- [x] Native visual capability: GPU-enabled capture AVD + baseline screenshot.
- [x] Campaign packet, governance binding, ownership map.

## Phase 1 — Design language v2 (`design-language-v2`)

- [x] `theme/contrast.ts` (WCAG math) + `theme/contrast.test.ts` asserting all slots.
- [x] Token v2: semantic families (base/text/soft/softText), 8 domain identities,
      6 metric identities, elevation ramp, numeral/eyebrow typography, motion
      springs + stagger, breakpoints, responsive gutters.
- [x] Remove non-allowlisted literals from `src/app/**`, `src/components/**`
      (F4/F5) + guard test.
- [x] `docs/DESIGN_SYSTEM.md` documenting tokens + rules.

## Phase 2 — UI kit (`ui-kit-primitives`)

- [x] `Tappable` (press scale + haptics + reduced motion + 44 dp).
- [x] `Button` (primary/secondary/ghost/danger/success; sm/md/lg; loading/disabled/icon).
- [x] `IconButton`, `Chip`, `Badge`, `Avatar`, `TextField`.
- [x] `Card` (plain/raised/tinted/hero), `ListRow`, `EmptyState`, `Skeleton`, `Toast`.
- [x] `ProgressBar`, `ProgressRing`, `AnimatedNumber`, `StatBlock`.
- [x] `ScreenHeader`, `SectionHeader` upgrade, `SegmentedControl` upgrade (animated indicator).
- [x] Retire/replace unused legacy primitives (`StatTile`, `StatGroup`, `ResultFeedback`) — delete, not alias (F9).
- [x] Kit tests: disabled/loading blocks press, a11y role+name, 44 dp, reduced motion.

## Phase 3 — Screen modernization (`screen-hierarchy`)

- [x] Home: goal hero (ring/goal), streak day-strip, level/XP meter, workout
      hero card with dual-line CTA, section headers with "See all", skeletons.
- [x] Games: featured card, search + chips on kit, adaptive grid, ListRow/empty.
- [x] Game detail: mastery ring hero, PB row, session ListRows.
- [x] Progress suite: composite hero, read-able charts (labels/zero states),
      identity colours, ListRows, window control on kit.
- [x] Results: celebration → headline → metric row → single CTA; PB state.
- [x] Rewards: claimable hero, distinct claimable/in-progress/locked treatments,
      cosmetic gallery.
- [x] Profile: identity hero, streak strip, quest/achievement treatments, settings rows.
- [x] Data management: storage hero, kit buttons/inputs, destructive confirm styling.
- [x] Game host chrome: intro (reward box, single CTA), session HUD (progress +
      timer ring + pause), pause overlay, results.

## Phase 4 — Micro-interactions (`micro-interactions`)

- [x] Press feedback + haptics everywhere (R1).
- [x] Answer feedback choreography in shared primitives + canary games (R2).
- [x] Late-tap mismatch fix in `attention-odd-one-out`, `attention-visual-search`,
      `math-fast-math` (F13).
- [x] AnimatedNumber wired to score/XP/coins/streak/percentages (R3).
- [x] Entrance stagger on screen mount (R4).
- [x] Celebration rules + personal-best detection; streak beat (R5/R6).

## Phase 5 — Responsive + accessibility (`responsive-adaptive`, `accessibility-upgrade`)

- [x] Breakpoint consumption: adaptive grids, expanded two-column, gutters (R1).
- [x] Inset correctness incl. keyboard + gesture bar (R4).
- [x] Font-scale safety; replace blanket 1.35 cap (F10).
- [x] Contrast fix (F6) and all a11y gap closures (F7/F8) with tests.

### Wave results (recorded 2026-09-11)

- Design foundation, UI kit, six screen packets, accessibility closure and the
  native evidence sets are complete; measurements live in `.agent/VALIDATION.md`.
- Remaining at close: the full-catalog runtime journey (batched runner), the
  durable-state checkpoint, and campaign closure.

## Phase 6 — Verification (`visual-verification`)

- [x] `scripts/qa/ui-capture.mjs` + documented usage; profile switching harness.
- [x] `scripts/qa/a11y-audit.mjs` — measures the 44 dp contract and unlabelled
      interactives from captured hierarchy dumps. Baseline (release APK, light,
      1080x2400@420): 14 violations across 5 surfaces — window-selector chips
      28 dp, back links 20 dp, workout rows 36–38 dp, library search 38 dp.
- [x] Before-evidence set captured: 22 frames (11 surfaces x light/dark) under
      `qa-artifacts/campaign024/before/` with a manifest.
- [x] Evidence set: before/after × light/dark × default/compact/expanded/landscape/font-scale.
- [x] Hierarchy-dump audit for roles/labels/bounds + 44 dp sweep.
- [x] Matrix: Jest, tsc, lint, validators, autobot canaries (+ certify if feasible).
- [x] Release rebuild + standalone verification + offline check.
- [x] `.agent/VALIDATION.md`, `STATE.md`, `KNOWN_ISSUES.md`, `BACKLOG.md`,
      `IMPACT_MAP.md` updated; campaign closed with honest classifications.

## Closure (2026-09-12, SHA `082f678`)

All phases complete. Verification: Jest 6321 pass / 5 allowlisted skips (514
suites), `tsc --noEmit` clean, `expo lint` clean, all repository validators
PASS, autobot canaries 8/8 PASS, daily-workout journey PASS, release APK rebuilt
and installed from campaign HEAD, 22-frame native evidence set at 0
accessibility violations in both themes. The 42-game `--mode certify` gate and
device-representative frame timing are recorded as environment-blocked /
NOT VALIDATED in `.agent/VALIDATION.md`.
