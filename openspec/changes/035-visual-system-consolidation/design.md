# Design — Campaign 035

## Evidence-led finding

The baseline at `D:\Temp\campaign035-runtime-before` contains 16
route-verified, nonblank light/dark captures. Home, Progress, Profile, and
Rewards use neutral or semantically tinted cards with a clear accent action.
The live Game Detail memory surface uses a large pink domain wash and 2dp
magenta border around a red Play button. The warmed GameHost intro shows the
same domain-wash/border treatment around an orange-red Start button. This is a
specific competing-accent problem, not a reason to churn every surface.

## Bounded treatment

| Surface | Before | After | Protected cue |
| --- | --- | --- | --- |
| Game Detail hero | domain soft fill + domain border + global Play CTA | neutral raised hero + domain identity mark/eyebrow + global Play CTA | game-detail IDs, mastery, favorite, records |
| GameHost intro | domain soft fill + domain border + global Start CTA | neutral raised hero + domain identity mark/category cue + global Start CTA | game intro/session/results IDs, tutorial, difficulty, QA gating |

The domain palette remains available to library ribbons, charts, identity
marks, and taxonomy evidence. The change does not alter token values; it uses
the existing `Card` and `IdentityMark` primitives to reduce simultaneous
decoration.

For categories whose label equals the game title (for example Memory), the
GameHost intro shows the identity motif without repeating the category text.
For other categories the existing category test ID and label remain present.

## Risk controls

- Keep all existing test IDs and button labels.
- Add no writes and change no registry/game metadata.
- Run GameHost, Game Detail, focused visual-baseline, full Jest, typecheck,
  lint, repository validators, native light/dark captures, and an
  accessibility audit.
- Compare the same Game Detail and warmed GameHost pixels before and after.
