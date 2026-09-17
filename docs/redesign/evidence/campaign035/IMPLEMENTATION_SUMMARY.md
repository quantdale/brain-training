# Campaign 035 implementation summary

## Bounded slice

Campaign 035 consolidates the single-game identity hero treatment. The live
baseline showed the domain soft fill and domain border competing with the
global Play/Start accent. The implementation uses the existing neutral
`Card` hero surface and keeps domain identity in the existing motif/category
cue.

## Source changes

- `apps/mobile/src/app/game-detail/[id].tsx` no longer overrides the hero with
  a domain soft fill or 2dp domain border. `IdentityMark`, the identity verb,
  category copy, mastery evidence, and the Play action remain in the same
  identity-first path.
- `apps/mobile/src/components/game-host/game-host.tsx` no longer dyes the
  intro hero. It adds the existing `IdentityMark` to the intro eyebrow,
  preserves category copy for non-title-equal categories, and avoids repeating
  a category label when the category equals the game title.
- `game-detail.test.tsx` and `game-host.test.tsx` now assert the neutral raised
  surface, the preserved domain cue, and the existing Play/Start action.

No game module, registry metadata, gameplay, scoring, rating, mastery,
session write, persistence, schema, migration, economy, backup/restore,
offline boundary, or dependency code changed.

## Checkpoints

- Campaign 035 source/contract checkpoint: `91994c24a9687f2bb04f52c451cb348ac26f305c`
  (`feat(campaign035): consolidate identity hero surfaces`).
- The terminal evidence/state checkpoint is the subsequent docs commit and is
  recorded in `CAMPAIGN035_CLOSURE.md` and the overnight handoff.

