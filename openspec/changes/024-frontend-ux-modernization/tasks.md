# Tasks — Campaign 024

Ordered implementation checklist. `[x]` = complete with evidence.

## Phase 0 — Activation

- [x] Recon swarm (4 scouts/agents) over screens, components, a11y, motion/perf.
- [x] Refero research: core screens + play screens → `research/*.md`.
- [x] Native visual capability: GPU-enabled capture AVD + baseline screenshot.
- [x] Campaign packet, governance binding, ownership map.

## Phase 1 — Design language v2 (`design-language-v2`)

- [ ] `theme/contrast.ts` (WCAG math) + `theme/contrast.test.ts` asserting all slots.
- [ ] Token v2: semantic families (base/text/soft/softText), 8 domain identities,
      6 metric identities, elevation ramp, numeral/eyebrow typography, motion
      springs + stagger, breakpoints, responsive gutters.
- [ ] Remove non-allowlisted literals from `src/app/**`, `src/components/**`
      (F4/F5) + guard test.
- [ ] `docs/DESIGN_SYSTEM.md` documenting tokens + rules.

## Phase 2 — UI kit (`ui-kit-primitives`)

- [ ] `Tappable` (press scale + haptics + reduced motion + 44 dp).
- [ ] `Button` (primary/secondary/ghost/danger/success; sm/md/lg; loading/disabled/icon).
- [ ] `IconButton`, `Chip`, `Badge`, `Avatar`, `TextField`.
- [ ] `Card` (plain/raised/tinted/hero), `ListRow`, `EmptyState`, `Skeleton`, `Toast`.
- [ ] `ProgressBar`, `ProgressRing`, `AnimatedNumber`, `StatBlock`.
- [ ] `ScreenHeader`, `SectionHeader` upgrade, `SegmentedControl` upgrade (animated indicator).
- [ ] Retire/replace unused legacy primitives (`StatTile`, `StatGroup`, `ResultFeedback`) — delete, not alias (F9).
- [ ] Kit tests: disabled/loading blocks press, a11y role+name, 44 dp, reduced motion.

## Phase 3 — Screen modernization (`screen-hierarchy`)

- [ ] Home: goal hero (ring/goal), streak day-strip, level/XP meter, workout
      hero card with dual-line CTA, section headers with "See all", skeletons.
- [ ] Games: featured card, search + chips on kit, adaptive grid, ListRow/empty.
- [ ] Game detail: mastery ring hero, PB row, session ListRows.
- [ ] Progress suite: composite hero, read-able charts (labels/zero states),
      identity colours, ListRows, window control on kit.
- [ ] Results: celebration → headline → metric row → single CTA; PB state.
- [ ] Rewards: claimable hero, distinct claimable/in-progress/locked treatments,
      cosmetic gallery.
- [ ] Profile: identity hero, streak strip, quest/achievement treatments, settings rows.
- [ ] Data management: storage hero, kit buttons/inputs, destructive confirm styling.
- [ ] Game host chrome: intro (reward box, single CTA), session HUD (progress +
      timer ring + pause), pause overlay, results.

## Phase 4 — Micro-interactions (`micro-interactions`)

- [ ] Press feedback + haptics everywhere (R1).
- [ ] Answer feedback choreography in shared primitives + canary games (R2).
- [ ] Late-tap mismatch fix in `attention-odd-one-out`, `attention-visual-search`,
      `math-fast-math` (F13).
- [ ] AnimatedNumber wired to score/XP/coins/streak/percentages (R3).
- [ ] Entrance stagger on screen mount (R4).
- [ ] Celebration rules + personal-best detection; streak beat (R5/R6).

## Phase 5 — Responsive + accessibility (`responsive-adaptive`, `accessibility-upgrade`)

- [ ] Breakpoint consumption: adaptive grids, expanded two-column, gutters (R1).
- [ ] Inset correctness incl. keyboard + gesture bar (R4).
- [ ] Font-scale safety; replace blanket 1.35 cap (F10).
- [ ] Contrast fix (F6) and all a11y gap closures (F7/F8) with tests.

## Phase 6 — Verification (`visual-verification`)

- [ ] `scripts/qa/ui-capture.mjs` + documented usage; profile switching harness.
- [ ] Evidence set: before/after × light/dark × default/compact/expanded/landscape/font-scale.
- [ ] Hierarchy-dump audit for roles/labels/bounds + 44 dp sweep.
- [ ] Matrix: Jest, tsc, lint, validators, autobot canaries (+ certify if feasible).
- [ ] Release rebuild + standalone verification + offline check.
- [ ] `.agent/VALIDATION.md`, `STATE.md`, `KNOWN_ISSUES.md`, `BACKLOG.md`,
      `IMPACT_MAP.md` updated; campaign closed with honest classifications.
