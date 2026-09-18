# Campaign 043 — Defect and Observation Log

## No current product defect repaired

No product source repair was justified by the available release evidence.

- The first post-game Data Management view displayed stale zero counters because
  the already-mounted screen had not refreshed after returning from the game.
  A cold process/deep-link refresh showed the durable values (1 session, 2
  ratings, 2 history rows, 1 ledger entry), and direct SQLite inspection
  confirmed the rows. This was a stale observation, not a reproduced data-loss
  defect.
- Several repeated hierarchy probes briefly collided with an orphaned
  `uiautomator` shell process (`UiAutomationService already registered`). The
  orphan was an automation-probe condition; after it cleared, hierarchy dumps
  worked again. No app crash or app log error was observed.

No schema, migration, game, scoring, economy, routing, workflow, or native
source file was changed for Campaign 043.

## Separate maintenance lane

The later Campaign 045 Expo SDK57 patch-alignment lane updated only the five
packages reported by Expo Doctor and their lockfile resolution. That change is
not presented as a Campaign 043 defect repair and requires its own post-update
matrix validation.
