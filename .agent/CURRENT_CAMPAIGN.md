# Campaign 024 — Frontend UX Modernization

**Status:** ACTIVE
**Campaign id:** `024-frontend-ux-modernization`
**Predecessor:** `023-production-gamification-overhaul` (VALIDATED, terminal)
**Mode:** day
**Change:** `024-frontend-ux-modernization` (ACTIVE)
**Authorization:** explicit owner goal-mode directive on 2026-09-11 (new scope
after Campaign 023 terminal closure).
**Baseline SHA:** `0402279`
**Entrypoint:** `openspec/changes/024-frontend-ux-modernization/EXECUTION.md`

## Mission

Take the frontend from "functionally complete but visually flat" to
production-ready and visually refined at the level of the reference class the
owner named (Duolingo, Brilliant.org, Elevate): a contrast-verified design
language, a real UI kit replacing ~20 inline CTA copies, one hero + one primary
action per surface, universal micro-interaction feedback, genuinely consumed
breakpoints for tablet/landscape, WCAG-AA accessibility closure, and native
before/after visual evidence.

## Scope guard

No gameplay/mechanics/scoring/rating/persistence changes. No new games. No
cloud/sync/AI/monetization work. Locked constitution decisions stay locked.

## Exit criteria

Every scenario in the campaign's seven specs is satisfied, `tasks.md` is
complete, the full matrix (Jest, tsc, lint, validators, autobot canaries) is
green or honestly classified, the release build is rebuilt and verified from
campaign HEAD, `.agent/VALIDATION.md` records evidence with honest
PASS / NOT VALIDATED classifications, and `main` is buildable and pushed.
