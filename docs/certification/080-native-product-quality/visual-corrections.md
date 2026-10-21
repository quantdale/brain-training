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

---

## 2026-10-22 — Wave I: Odd One Out cover correction candidate (REVERSIBLE — PENDING OWNER ACCEPTANCE)

**Status: technically sound reversible CANDIDATE PENDING OWNER ACCEPTANCE. The
owner has NOT approved its final aesthetic quality. Nothing in this section
claims or implies owner approval.**

**Authorizing scope (narrow).** The owner authorized a reversible candidate
correction to `apps/mobile/assets/game-covers/attention-odd-one-out.png` only:
separate the circled play/up-arrow affordance from the triangle-pattern motif so
the illustration no longer suggests the motif itself is a tappable control. No
other cover, no app source, no gameplay, no manifests were changed. Provenance
note: contrary to the V1 note above, a deterministic generator does exist in
repo (`scripts/artwork/generate-covers.mjs` + `scripts/artwork/primitives.mjs` +
`scripts/artwork/memory-attention-speed.mjs#oddOneOut()`), and the candidate was
rendered through that same vocabulary and pipeline.

**Compositional change.** Old scene: the odd (sideways) triangle sat on a paper
chip inside a brown ring with an up-arrow below — together a universal
play/arrow-key control gestalt. New scene: the motif row is bare triangles (four
upright + one sideways, all identical size/fill; the oddness is orientation
only, matching the catalog concept "one sideways triangle stands apart from an
otherwise identical upright group"), and the selection cue is a detached
bracket marker below the odd triangle (the signal-watch bracket idiom, with the
standard PAPER motion under-stroke for light/dark theme legibility). The motif
row is re-seated from design-y 74 to 83 so the corrected art keeps the original
cover's composition footprint (art-bbox center ≈ design-y 93 vs the cover
family's ≈ 101). No circle, ring, chip, or arrow remains on or near the motif.

**Hashes.**
- Original (pre-change cover, pinned snapshot
  `scripts/qa/covers/originals/attention-odd-one-out.png`):
  `1f673c84c8fe31c3a9012be355a653cb637dfae054686e5e6c6ad8807358bbce`
  (11 760 bytes)
- Candidate (`attention-odd-one-out.png`, canonical generator output):
  `8f2b84ec8442f9630bc647cbc5cf38233fe8ef130512114841c79ca1f7107fea`
  (6 466 bytes)

**Rollback path.** Fully reversible, no residue:

```sh
git checkout HEAD -- apps/mobile/assets/game-covers/attention-odd-one-out.png \
                     apps/mobile/assets/game-covers/inventory.json \
                     apps/mobile/src/components/discovery/game-cover-artwork.generated.ts \
                     openspec/changes/078-game-cover-visual-identities/evidence/contact-sheet-dark.png \
                     openspec/changes/078-game-cover-visual-identities/evidence/contact-sheet-light.png \
                     scripts/artwork/memory-attention-speed.mjs
node scripts/artwork/generate-covers.mjs
```

A byte-pinned snapshot of the pre-change cover is also retained at
`scripts/qa/covers/originals/attention-odd-one-out.png`
(SHA-256 `1f673c84…`). It is deliberately kept OUT of `apps/mobile/assets/`
so no extra asset is bundled into the application.

**Reproducible regeneration (canonical pipeline — not a hand-edited asset).**
The corrected composition is authored in the canonical Campaign 078 art source,
`scripts/artwork/memory-attention-speed.mjs#oddOneOut()`, and compiled by
`scripts/artwork/generate-covers.mjs` like every other cover. It is NOT written
into the PNG by hand. `node scripts/artwork/generate-covers.mjs --check` passes,
and `node scripts/qa/covers/odd-one-out-candidate.mjs --verify` re-asserts that
the shipped asset is exactly what the canonical pipeline emits (so no hand-edit
drift can survive). `scripts/qa/covers/odd-one-out-candidate.mjs` (without
`--verify`) renders the before/after evidence. Tooling:
`scripts/artwork/primitives.mjs` rendered by `@resvg/resvg-js` from
`apps/mobile` — the canonical Campaign 078 art pipeline; no new dependency.

**Sizes verified.** Real display boxes from `GameWorldArt` in
`apps/mobile/src/components/discovery/game-identity.tsx` (1.6-aspect frame in
`game-cover-artwork.tsx`): thumbnail 102×64 dp (results), card 179×112 dp
(poster tiles, suggested-next), hero 192×120 dp (game detail), stage 288×180 dp
(game stage). Downscaled renders at 1x density (the tightest legibility case)
were inspected: the sideways triangle and the bracket marker remain clearly
distinct and legible at every size, including 102×64.

**Before/after evidence** (gitignored) — `qa-artifacts/080/odd-one-out-cover/`:
`before-attention-odd-one-out.png` / `after-attention-odd-one-out.png` (512×320),
and `before-mobile-{thumbnail-102x64,card-179x112,hero-192x120,stage-288x180}.png`
/ `after-mobile-…` (same names with `after-`).

**Integration status: CONVERGED CANONICALLY.** The scene, the compiled
`attention-odd-one-out.png`, `apps/mobile/assets/game-covers/inventory.json` and
the generated `game-cover-artwork.generated.ts` manifest all describe the SAME
corrected composition. `node scripts/artwork/generate-covers.mjs --check` is
green and all four cases in
`apps/mobile/src/components/discovery/__tests__/game-cover-artwork.test.tsx`
pass. The canonical generator reproduces the candidate byte-exactly
(`8f2b84ec…`).

**One necessary consequence, recorded honestly.** The Campaign 078 evidence
contact sheets (`openspec/changes/078-game-cover-visual-identities/evidence/contact-sheet-{dark,light}.png`)
are `emit()`-checked outputs of the same generator and visibly embed all 42
covers, so correcting one cover necessarily changes those two renders. Only
those two PNGs moved; `cover-key.json`, `MECHANIC_MATRIX.json` and every other
Campaign 078 evidence record are byte-identical to history. This is a derived
render, not a rewrite of the Campaign 078 narrative or its findings.
