# Design — Campaign 024: Frontend UX Modernization

## Invariants that must not change

- `docs/PROJECT_CONSTITUTION.md` locked decisions: phone-first portrait,
  Android 12+/iOS 17+, offline-first, SQLite canonical, Game SDK boundaries,
  scoring/rating/XP/currency semantics, per-game module independence.
- No gameplay, scoring, generator, or persistence behaviour changes. The 42
  game modules' *logic* and their reducers/scoring stay byte-identical except
  for accessibility/interaction-contract fixes explicitly listed in `tasks.md`.
- Design tokens remain the single source of visual truth
  (`apps/mobile/src/theme/tokens.ts`). Screens MUST NOT hardcode colour,
  radius, spacing, elevation, or duration outside the token layer.
- All automated QA stays emulator-local (AGENTS.md host-interaction
  prohibition). No host mouse/keyboard injection at any point.

## Design language: "Playful Precision"

Clarity first (Elevate), energy second (Duolingo/Brilliant). One hero per
screen; everything else recedes.

### Hierarchy rules

1. **One hero per screen.** Home owns the daily-workout hero; Progress owns a
   composite hero; Results owns the score hero; Profile owns the identity hero.
   Hero elements use the numeral/display type tokens; nothing else on the
   screen may use them.
2. **One primary action per screen region.** Exactly one filled `Button`
   (`variant="primary"`) per viewport; secondary actions are `secondary`/
   `ghost`, destructive actions are `danger` and always confirm.
3. **Three weights only**: hero (numeral/display), section (title/headline),
   support (body/caption). No component may invent a fourth weight.
4. **Metric identity is fixed and stable across the app**: XP = violet,
   streak = orange, time = sky, accuracy = green, currency = amber, rating
   movement = success/danger by sign. A game screen may own a domain colour,
   never a different hue for the same metric.
5. **Section anatomy is uniform**: `SectionHeader` (title + optional "See all"
   action) → content → generous gap. Sections never end without a next step.
6. **Cards carry meaning, not decoration**: `plain` for grouped content,
   `raised` for the hero of a screen, `tinted` for state (success/warning/
   danger/info). Two adjacent cards must not both be `raised`.

### Colour

- Every semantic family exposes `base` (fill, ≥3:1 vs surface), `text`
  (≥4.5:1 on surface *and* background), `soft` (fill), `softText`
  (≥4.5:1 on `soft`). Contrast is asserted by a test over the token tables.
- Domain identity palette: eight hues (memory, attention, speed, math,
  language, logic, flexibility, spatial) with the same four slots, so a domain
  colour is legible as a label, as a chart fill, and as a soft chip.
- Light and dark palettes expose identical keys (existing contract).

### Typography

- Added tokens: `eyebrow` (11–12, uppercase, tracked, 700), `numeralLg`,
  `numeralXl` (tabular numerals for metrics and counters), `title`/`display`
  tightened for phone viewports. Hero numerals use tabular figures so
  count-up animation does not reflow.
- Text must remain legible at system font scale up to 2.0 where the platform
  allows; containers size to content rather than clamping text. The existing
  blanket `maxFontSizeMultiplier` cap is replaced by component-level caps only
  where a glyph is decorative (emoji/icon art), not body copy.

### Motion

- Durations keep the existing scale (`press 90`, `quick 140`, `base 200`,
  `entrance 260`, `celebration 650`) plus spring presets for press and
  progress. Stagger step 60 ms, entrance travel ≤ 12 dp.
- Motion is *feedback*, never decoration that delays input. Every animation is
  interruptible, none blocks a tap, and every decorative animation collapses
  to its end state under `prefersReducedMotion`.
- Press feedback is universal: scale 0.97 (buttons/cards) or 0.94 (grid cells)
  plus a light selection haptic, both sensory-setting-gated.

### Layout & responsiveness

- Breakpoints become real: `compact < 480`, `medium 480–767`, `expanded ≥ 768`.
  `expanded` introduces two-column section layout and multi-column grids;
  `medium` widens gutters; `compact` keeps single column.
- Screen gutters, card padding, and hero sizes are expressed as responsive
  tokens (`useAdaptiveValue`), not one-offs.
- Safe areas: no content may sit under the tab bar or gesture bar in any
  orientation; the tab bar and every pushed header respect insets.

### Accessibility

- Contrast: every text/background and UI/fill pairing used in code meets WCAG
  AA (4.5:1 body, 3:1 large/UI) in both themes; the token test encodes this.
- Every interactive node has a role; icon-only controls have a label; state
  changes announce via live regions only where the change is not otherwise
  perceivable; modals move focus and trap the a11y tree.
- Minimum target 44×44 dp for every interactive element, via layout size or
  `hitSlop` (`MinTouchTarget`).
- Dynamic type: layouts wrap instead of truncating; no fixed-height text rails.

## Architecture of the change

```
theme/tokens.ts            ← token layer (colour, type, motion, elevation, layout)
theme/contrast.ts          ← contrast math + assertions (new)
platform/layout.ts         ← breakpoint hooks (now genuinely consumed)
components/ui/*            ← new primitives (single source of interactive UI)
components/shell/*         ← shared screen furniture (upgraded)
components/game-ui/*       ← game chrome primitives (upgraded)
app/**                     ← screens rebuilt on the kit
games/*/components/*       ← only interaction/a11y contract fixes
```

Rules: `components/ui/**` is orchestrator-owned for coherence; screen packets
consume it and must not fork it. Where a packet needs a primitive change, the
orchestrator makes it once and all consumers inherit it.

## Verification strategy

| Claim | Evidence |
|---|---|
| Visual refinement | native screenshots (light+dark) per surface, before/after, on `braintraining-ui35` |
| Contrast | token-level contrast test + sampled screenshot pixel checks |
| No regressions | Jest matrix, `tsc --noEmit`, `expo lint`, registry/provenance/offline validators |
| Runtime behaviour | autobot canaries + full certify (dev build, Metro) |
| Responsive | same AVD at tablet density/size profile + landscape, screenshot evidence |
| Accessibility | hierarchy dumps (roles/labels/bounds), ≥44 dp assertions, reduce-motion test |

Anything the host cannot exercise (manual TalkBack review, physical device,
iOS runtime, store signing) is recorded as NOT VALIDATED, never PASS.
