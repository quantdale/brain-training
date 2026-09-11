# Design — Campaign 026: Visual Identity Rebuild ("Neon Arcade")

## Visual thesis

**Playful precision.** A candy-bright arcade shell (Duolingo energy) wrapped
around a deep-ink focus board (Brilliant/LookUp clarity), with reward moments
that feel physical and earned. The shell is warm, loud and generous; the play
surface is calm, high-contrast and uncluttered so stimuli and verdicts own the
screen. Reference ingredients are adapted, never copied: Duolingo's tactile
button lip and rounded display type, Brilliant's single-path progress and dark
focus boards, Mindllama/Pinkllama's soft-cream warmth and day-dots streak.

## Tokens (direction; exact values land with the contrast harness)

### Palettes

- **Light — "paper arcade":** background `#FFF8EF`, surface `#FFFFFF`,
  surfaceSunken `#F6EEE2`, text `#1B1B2F`, secondary `#6A6A80`, border
  `#E9DFD0`.
- **Dark — "ink arcade":** background `#0E1020`, surface `#181B30`,
  surfaceSunken `#101226`, text `#F5F2EA`, secondary `#A9AEC6`, border
  `#2A2E4A`.
- **Primary action:** vermillion (`#E8442F` light / `#FF6B57` dark) with a
  filled soft family (`primarySoft`, `primarySoftText`, `primaryOn`).
- **Semantic families:** success (green), danger (red), warning (amber), info
  (blue), accent (violet) — each with `base`, `soft`, `softText` and `on`
  slots, contrast-verified in both themes at WCAG AA (4.5:1 text, 3:1 UI).
- **Metric identities:** XP `volt`, streak `flame`, level `violet`, time
  `sky`, accuracy `green`, best `pink`. Hues never change meaning.
- **Domain identities (8 vivid hues):** attention orange, flexibility violet,
  language sky, logic teal, math blue, memory pink, spatial green, speed
  yellow — each a family (edge/soft/on) used for category chips, cards and
  charts; colour is identity, never the only signal.

### Typography

System stack, heavier display weights (800/900), tighter display tracking,
tabular numerals for every score/metric. Scale: display 34, title 28,
headline 24, subtitle 20, bodyLarge 17, body 15, small 13, caption 12,
eyebrow 11 uppercase with tracking, numeralLg 34 tabular, numeral 20 tabular.

### Geometry

Radii: sm 10, medium 16, large 22, xl 28, pill. Cards carry a 1.5–2 px border
and a soft colour-tinted shadow in the light theme; dark surfaces separate by
value instead of shadow. Buttons are pill or 18 px, minimum 52 px tall for
primary actions, and sit on a 4 px darker "lip" that compresses on press.

### Motion

Quick 140 ms, standard 240 ms, celebratory 420 ms; entrance stagger 60 ms;
press spring scale 0.97 with a lip compression; score counts with tabular
figures; confetti and spark effects are deterministic and collapse to static
under reduced motion.

### Composition rules

One hero per screen; one primary action per screen; section headers are
"title left + action right"; empty states are designed (illustration mark,
headline, one line, bottom-anchored CTA); tab bar caps at five destinations
with a filled-lozenge active state; results celebrate first and list metrics
as equal columns second; streak is a day-dot strip plus count pill, never a
text row.

### Illustration strategy (code-native only)

No new native dependencies. The identity marks are built from Views,
transforms, layered translucency and glyphs: a four-point spark, a flame with
count, confetti pieces, and rounded "blob" faces for onboarding and empty
states. No image assets required; every mark is theme-aware and reduced-motion
safe.

## Invariants

- Gameplay, scoring, generators, difficulty, session timing and persistence
  are untouched; every existing testID survives.
- Audio/haptics stay behind `liveAudioHaptics`; reduced motion and font-scale-2
  remain first-class.
- Interactive targets stay >= 44x44 dp.
- The Campaign 025 verdict language (soft fill + verdict border + glyph +
  verdict in the accessible name, reducer-authoritative, prompt mounted)
  is preserved exactly; this campaign changes its skin, not its semantics.
- No new native modules, no dependency replacement without an ADR.

## Verification

| Claim | Evidence |
|---|---|
| New identity applied | before/after native frames per surface in both themes |
| Contrast safe | `theme/__tests__/contrast.test.ts` green for every pairing |
| Contracts preserved | full Jest matrix + validators + canaries + a11y audit at 0 |
| Visibly transformed | owner reviews the before/after capture sets |
