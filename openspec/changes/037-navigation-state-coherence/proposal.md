# Campaign 037 — Navigation, State & Cross-Surface Coherence Hardening

## Problem

The current native audit shows that pushed-route back behavior and invalid
game/result fallbacks are operational, but Home's clean-state plan copy says
the workout is balanced across `recent training` when no session history
exists. That wording conflicts with the observed first-run state and can make
the product feel as if it is reporting history that is not there.

## Outcome

Make the clean-state Home plan line describe a starting set until a recorded
session exists, while retaining the existing history-aware copy for returning
players. Add focused route/state contracts around the observed back, return,
invalid-ID, and empty-result seams so future redesign work cannot silently
regress them.

## Non-goals

No routing-library replacement, navigation-stack rewrite, session/provenance
change, schema/migration change, account/network behavior, economy change,
gameplay change, or broad copy sweep.

