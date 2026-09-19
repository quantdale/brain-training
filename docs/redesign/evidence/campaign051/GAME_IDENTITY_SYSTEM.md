# Campaign 051 — Game Identity System

## Identity formula

Each registered game is rendered as:

`domain world` + `mechanic family motif` + `stable verb` + `one interaction sentence`

The first two parts are visual; the latter two remain text/accessibility truth.
The implementation lives in `components/discovery/game-identity.tsx` and is
presentation-only.

## Eight visual worlds

| Domain | World behavior | Mechanic signature |
| --- | --- | --- |
| Memory | coral/paper recall tiles and sequence rails | stacked/repeating tiles |
| Attention | cyan scan grid and lens target | search lens / odd tile |
| Speed | yellow signal bars and target ring | reaction bars / timing mark |
| Math | violet equation blocks and keypad | structured tokens |
| Language | cyan/mint linked nodes and word rails | association path |
| Logic & Problem Solving | mint deduction tree and clue rails | branching inference |
| Flexibility | coral rule-switch blocks and reversible arrows | switching arrows |
| Spatial | yellow orbit/diamond transformations | rotation/orientation frame |

`GameWorldArt` selects the world from the registry category and the mechanic
signature from stable `GAME_IDENTITIES` metadata. A deterministic id variant
changes the arrangement/accent so sibling games do not look cloned while
remaining coherent. `IdentityMark` and accessible text remain present beside
the art.

## Catalog coverage

The generated registry remains the authority for 42 games. The presentation
map currently has explicit identities for every known catalog id, with a
category-safe fallback for fixtures. Campaign validation must re-count the
registry at closure and confirm eight domain families plus detail reachability;
no registry or game module edits are required for this visual system.
