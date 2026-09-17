# Campaign 040 implementation summary

**Terminal classification:** `CAMPAIGN_040_CONDITIONAL`

Campaign 040 remained certification-first. Two bounded release interaction
defects were repaired only after current native observation demonstrated them.
The repairs are in source checkpoint `0cb7727590d4d5d087a090360c0f41e6439bf681`
(`0cb7727`), pushed to `origin/main`.

## Repairs

1. `apps/mobile/src/components/game-host/game-host.tsx` now mounts the
   first-play tutorial overlay only while `GameHost` is in its `intro` view.
   On the old release candidate, the persisted open tutorial could cover the
   session feedback CTA and make the visible `Next round` control physically
   untappable. The tutorial remains available on the intro and is not silently
   marked complete when a player starts.
2. `apps/mobile/src/app/game-detail/[id].tsx` applies the shared
   `MinTouchTarget` style to the populated-state “View detailed trends” link.
   The final populated Game Detail accessibility audit measured the control at
   the shared 44 dp minimum; the pre-fix audit measured it at 18 dp.

Focused regression coverage was added to the GameHost and Game Detail tests.
No game generator, scoring rule, session identity, workout identity, SQLite
schema/migration, economy, backup/restore, router contract, CI workflow, or
unsupported claim was changed.

## Scope boundary

This is a release-candidate integration certification record, not a new
feature wave and not an automatic full-hardening campaign. Evidence and
limitations are recorded in the companion files in this directory.
