# Campaign 055 — Refinement Lock

**Locked direction:** Signal Arcade v4.1 — "the cabinet, not the dashboard".
**Baseline:** `f59c066`. **Lock date:** 2026-09-20.
**Inherits:** `docs/redesign/evidence/campaign051/REFERENCE_LOCK_FINAL.md`.
This lock refines Signal Arcade; it does not replace it. Anything not listed
here stays exactly as Campaign 051/054 left it.

## 1. Protected from Signal Arcade (do not change)

- The palette hues and the five-slot colour-family contract
  (`base/text/soft/softText/on`) including its contrast test
  (`theme/__tests__/contrast.test.ts`). Slots may be re-pointed only where the
  semantic-role table below requires it, and every change must keep the
  contrast suite green.
- Domain colour identities (Memory rose, Attention orange, Speed gold,
  Math blue, Language teal, Logic green, Flexibility violet, Spatial green) and
  the canonical `DOMAIN_ORDER`.
- The code-native eight-domain world art system and all 42 game identities
  (`components/discovery/game-identity.tsx`), their decorative a11y hiding, and
  the motif vocabulary.
- Console-key primary actions with the physical lip and press response.
- Mechanic-first gameplay: the mechanic stage is the main event; game chrome
  recedes; no mechanic, timer, scoring, generator, difficulty or registry
  change.
- Dark mode as an authored palette (not an inversion).
- All persisted semantics: schema v12, sessions, workouts, XP, currency,
  rewards, cosmetics, economy, migrations, backup/export/import, favorites,
  tutorial persistence, sensory settings, offline behaviour.
- All existing testIDs, routes and accessibility roles/labels unless a test is
  intentionally re-baselined in this campaign.

## 2. What changes (the refinement)

### 2.1 Container roles — kill card soup

Three semantic surface roles replace "everything is a Card":

| Role | Component | Grammar | Used for |
| --- | --- | --- | --- |
| **Stage** | `GameStage` (new, wraps world art) | full-bleed art field, small radius, 2 dp poster border, no shadow, clipped corner detail inside the art | the one game-world object on a surface: Games featured, Game Detail hero, GameHost intro, Results artifact |
| **Panel** | `ArcadePanel` (new) | paper surface, 1 dp border, small radius, elevation `raised` only when it is the single focal panel | the single interactive object on a screen (Today's workout object, reward claim band, summary panel) |
| **Report** | `Report` + `ReportRow` (new) | borderless grouped region on canvas; rows separated by hairlines; label left in muted ink, value right in tabular ink | records, stats, settings, data, history, drill-downs |
| **Key** | existing `Button` | console key with lip | every action |
| **Slot** | `CollectibleTile` (new) | square plate, one centered object, label plinth | Rewards collection, equipped cosmetics |
| **Chip** | existing `Chip` / `Badge` | pill, status/filter only | filters, statuses, small meta (never a container) |

Rules:

- No screen may stack more than one Panel plus one Stage in the first
  viewport; grouping *below* the fold uses Report grammar by default.
- Cards never nest inside cards. Existing `Card` remains available (tests and
  legacy call sites) but new/refined surfaces must use the role above.
- `Card` gains a `flush` variant (borderless, no elevation) implemented so that
  Report can be a thin wrapper; the `Card` public API otherwise stays intact.

### 2.2 Typography roles — four voices, not one

| Voice | Token | Spec | Owns |
| --- | --- | --- | --- |
| Page | `title` (32/37 900) | keep | one per screen |
| Game | `gameTitle` (new — 26/30 900, tracking -0.4) | game names on Stage/Panel/tiles/detail |
| Result | `resultHeadline` (new — 34/38 900, tracking -0.8) | the single band headline on Results |
| Stat | `numeralLg`/`numeralXl` | keep tabular | values, counters |
| Read | `bodyRead` (new — 16/26 400) | long-form copy: rules, tutorial concepts, progress narrative |
| Label | `eyebrow` (11/14 800 tracked caps) | sparse kickers only — domain, state, section context |
| Meta | `caption`/`label` | keep | metadata, hints |

Rules:

- Heavy 900 weight is reserved for Page/Game/Result/Stat voices. Section
  headings use `headline` (24/30 800) or a small caps variant, never 900.
- Eyebrows are capped at one per section and never repeat the section's own
  heading text.
- No new font families; differentiation comes from weight, size, case,
  tracking and colour role (no condensed system font exists on Android).

### 2.3 Shape roles — one radius per job

| Shape | Radius | Owns |
| --- | --- | --- |
| Art field | `Radii.small` (8) | Stage/poster/world art |
| Panel | `Radii.medium` (12) | interactive objects, report groups, keys |
| Sheet/overlay | `Radii.large` (16) | dialogs, pause overlay, celebration |
| Pill | `Radii.pill` | chips, filters, statuses, meters, avatar |
| Circle | pill | meters, avatars, icon buttons only |

Rules:

- No folded-corner containers (folded corner stays inside world art only).
- 2 dp borders only on art fields; 1 dp (hairline) on panels/reports; inputs
  use `borderStrong`.
- Depth: shadow only on the single focal panel, overlays, and the primary key
  lip. Everything else is flat with hairlines.
- Radii must not exceed 16 dp outside pills (removes the "giant rounded card"
  feel).

### 2.4 Colour semantics — one meaning per accent

| Colour | Means | Never means |
| --- | --- | --- |
| Coral accent | primary action, live/current state, completion heat | decoration, domain identity, success |
| Domain hues | game/category identity, art, chart series | actions, generic backgrounds |
| Mint/success | owned, complete, saved, protection active | "good score" on Results, decorative fill |
| Warning/amber | reward/attention highlight, personal-best band | errors |
| Danger | error, destructive | streak heat |
| XP violet | XP/level progression only | cosmetics, domain identity |
| Streak family | streak heat only | rewards |
| Ink neutrals | report body, secondary controls | celebration |

Result bands (computed from the session's own performance, not from rewards):

- **Personal best** — amber highlight + star; celebration allowed.
- **Strong** (band ≥ strong threshold) — domain/mint accent allowed.
- **Building / Keep going** (low band) — neutral ink, honest sentence, no
  green, no confetti, reward stated factually (earned, not celebrated).
- Completion (workout finished / session saved) is a *separate* statement from
  performance and never borrows the performance colour.

### 2.5 Results emotional logic

1. One artifact (Stage): game world + band headline + performance ring.
2. A single supporting strip (3–4 slots): the metric(s) that matter for this
   game's outcome class + date. No duplicate score, no floating-point ms, no
   empty report spacing.
3. Completion statement (workout only): "Workout complete · 4/4 saved" as a
   quiet stamped row, never a second hero.
4. Reward: factual chip row `+22 XP · +4 coins` (only what was actually
   awarded; hidden when zero).
5. Actions in strict order: workout context → `Next game` (primary key),
   `Replay` (secondary), `Finish workout` (ghost); standalone → `Play again`
   (primary key), `Done` (secondary). No more than one filled key per result.
6. Reduced motion: artifact appears in final state; no confetti; same order.

### 2.6 Game-world rules

- Every game keeps its domain hue + motif mark; the world is now rendered as a
  Stage scene: domain-tinted field, a horizon/rail structure, the motif objects
  at composition scale, and a small wordmark plate.
- Scene composition varies by the eight domains (rail, grid, orbit, burst,
  field, stack, flow, lattice) so identity is visible before any metadata.
- Art is always decorative (`accessible={false}`; hidden from a11y tree) and
  never the only carrier of information.
- No raster/generated production art; all scenes are code-native views. No new
  per-game bespoke illustration beyond existing motif configuration.

### 2.7 Profile identity rules

- First viewport = Player card: monogram avatar plate + player name
  (`display_name` or "Player") + level emblem + XP progress + streak rail +
  equipped cosmetic chips (linking to Rewards) + on-device honesty line.
- No "Local player", no "Indigo accent", no placeholder avatar square.
- Level/XP/streak are identity attributes here, not four equal stat tiles.
- Motivation, milestones, quests, achievements follow in Report grammar;
  settings/data become quiet entry rows, not cards.
- No invented social features, names, or avatars.

### 2.8 Rewards collection rules

- Collection grid of `CollectibleTile`s per slot (frames, accents,
  celebrations); one code-native object per tile derived from the cosmetic
  definition; emoji may appear inside the object plate but never as the plate.
- States: `Equipped` (coral ring + label), `Owned` (paper plate, ink object),
  `Locked` (sunken plate, 40% object, lock glyph + unlock line). Locked tiles
  stay in the same grid as owned tiles.
- Collection progress: per-slot rail + one quiet "n/12" caption; the total is
  not the hero.
- Claim inbox: compact band ("2 ready" + Claim all key) and reward rows with
  object chip, title, requirement, Claim key.
- Economy semantics (prices, unlock conditions, claim idempotency) untouched.

### 2.9 Progress credibility rules

- Keep every formula, window and chart. Change the framing order: consistency
  rail first (day cells), one composite ring, then domain rails; detailed
  metric tables become Reports with quieter labels.
- Replace "recorded movement" / "next consideration" with player language
  ("Recent training", "Suggested next") while keeping the truthful
  "not enough sessions" states.
- No new projections, no cognitive claims, no invented comparisons.

### 2.10 Dark-mode preservation rules

- Keep the authored dark palette and its coral keys on ink.
- Targeted fixes only: raise separation between canvas/surface/sunken in
  long stacked regions; stop success-soft green from sitting directly on navy
  in Results (band colours are chosen per band, not by state fill); remove
  large dead zones through the Results/Home composition, not by recolouring.
- Dark mode must remain authored (no inversion) and pass the contrast suite.

## 3. Copy rules (visible product language)

- Remove: internal vocabulary ("recorded movement", "next consideration",
  "Local player", "Indigo accent", "rating 986", raw ms), duplicate
  completion/score statements, and robotic report phrasing.
- Speak as the product does now: short, concrete, second person where an
  action is wanted; factual about data ("Saved on this device").
- Never introduce IQ, brain-age, intelligence-improvement, medical or
  unsupported transfer claims.
- Score semantics and reward amounts are never reworded into different
  numbers; only their surrounding language changes.

## 4. Drift guard

- Shared-system changes land first; surfaces then consume them. No one-off
  screen hacks when a role from §2.1–§2.4 applies.
- Every surface change must map to one of: Home focus, Games storefront,
  Detail fantasy, Tutorial pacing, Gameplay identity, Results event, Progress
  credibility, Profile identity, Rewards collection, dark tonal fixes, or copy
  cleanup. Anything else is out of scope.
- If a change threatens a protected contract from §1, narrow or revert it.
