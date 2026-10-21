# Visual correction report — Campaign 080

Date: 2026-10-21
Scope: the four outstanding Campaign 078/079/080 visual/gameplay polish
findings (prompt §12). Method: reproduce → assess impact → smallest effective
correction → verify, preserving the Signal Arcade/Play Lab design language.
No wholesale redesign, no gameplay-mechanic changes.

---

## V1 — Odd One Out triangle affordance (CONFIRMED) — dispositioned + in-game fix

**Provenance correction.** The confirmed defect named in prior evidence
(`visual-accessibility.md` D1) is the **game-detail cover illustration**
`apps/mobile/assets/game-covers/attention-odd-one-out.png`: the triangle pattern
row with the circled play button/up-arrow can read as part of the pattern and
suggest tappable play. The PNG was inspected and the ambiguity is real.

- **Cover fix (shared asset surface):** the prescribed fix is a composition
  change — separate the circled play affordance from the ▲ pattern motif in the
  cover. The cover set is frozen Campaign 078 art (one ImageGen-derived scene +
  41 deterministic vector scenes) with no generator in-repo to re-run, so this
  is a **binary-asset change requiring visual/owner acceptance**. Disposition:
  **OPEN, precisely specified**, with the 080-prescribed composition rule
  recorded here; not silently dropped and not force-changed without visual
  review.

- **In-game affordance fix (implemented):** independently justified by code
  evidence, the in-game board had the same ambiguity class:
  `attention-odd-one-out/components/tile.tsx` rendered idle option tiles with
  the decorative hairline (`theme.border` @1.5px ≈1.2:1 on the stage surface)
  although every tile is a tappable answer option. Corrected to the catalog's
  answer-option pattern (`theme.borderStrong` @2px interactive boundary,
  ≥3:1 vs surface — identical to `speed-quick-compare` OptionButton). Verdict
  states (3px success/danger + ✓/✕ badges) unchanged. Before→after: tiles read
  as flat decorative cards → clearly outlined selectable options. No geometry,
  layout, or mechanic change. Focused jest 21 suites/241 tests green; tsc and
  lint clean.

## V2 — Rule-switch / watchlist discoverability — NOT APPLICABLE (evidence)

Reproduced against current code and native evidence: Rule Flip / Cue Shift
reached input + feedback + round advance in both v1 sweeps and fresh runs; no
comprehension blocker was observed in the default profile. The item was already
"unconfirmed as a P3→P2 promotion" in `visual-accessibility.md` D1. Disposition:
**NOT APPLICABLE as an application defect**; a directed human comprehension
check remains owner-side.

## V3 — Grid Recall echo size — NOT APPLICABLE (evidence)

Grid Recall's echo/review surface reached input + feedback + round advance in
native runs; no impairing sizing was reproduced. Consistent with the existing
"unconfirmed promotion" disposition. **No change made** (nothing cosmetic was
changed to force uniformity).

## V4 — Reaction Time depth/visual richness — IMPLEMENTED (subjective, bounded)

`speed-reaction-time/components/trigger.tsx`: the stimulus trigger is the
screen's focal surface but rendered flat; applied the arcade-panel focal
pattern (`Elevation.raised`) — presentation-only, signal timing untouched
(perf/timing capture lives in scoring/clock code paths, verified untouched).
This is subjective polish: it is offered as the implemented candidate for
**owner acceptance**, reversible in one line. Focused jest green with V1.

---

## Verification

- `npx tsc --noEmit` clean.
- Focused `npx jest src/games/attention-odd-one-out src/games/speed-reaction-time`
  — 21 suites / 241 tests PASS.
- Full local gates run at integration (see `release-matrix.md`).
- Native re-verification of the two touched games is bound to the rebuilt APK
  (see `coverage-audit.md` provenance note).

## Shared-file needs surfaced (orchestrator-owned, per swarm policy)

1. `apps/mobile/assets/game-covers/attention-odd-one-out.png` — cover
   composition fix (above), requires visual review/owner taste.
2. No shared component changes were needed; the token usage matches the
   existing catalog pattern.
