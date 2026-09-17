# Design — Campaign 037

## Evidence-led finding

The 22-surface native baseline under `D:\Temp\campaign037-runtime-before`
was route-verified and nonblank. Emulator-local journeys showed:

- Games → Game Detail → Android back returns to Games;
- Game Detail → Play → GameHost intro → Android back returns to Game Detail;
- a real Odd One Out session reached its result, and Android back returned to
  Game Detail with the persisted recent session;
- Game Detail → Results drill-down → Android back returns to Game Detail;
- Profile → Rewards/Data Management → Android back returns to Profile;
- Progress → next consideration → domain detail → Android back returns to
  Progress with the 30d selection;
- invalid Game Detail, GameHost, and Results deep links show recoverable empty
  or not-found states;
- Home still says `balanced across your recent training` while the clean
  record has no sessions.

## Bounded treatment

| Surface | Observed seam | Treatment | Protected behavior |
| --- | --- | --- | --- |
| Home / plan line | clean state is described as recent-history balancing | use a starting-set phrase with zero recorded sessions; retain existing history-aware phrase otherwise | workout selection, CTA, provenance, session identity |
| Route regressions | observed paths are correct but lightly covered across surfaces | add focused contracts for stack/back and invalid/empty route states using existing router seams | Expo Router stack, result ownership, persistence |

No new route, state flag, or persisted value is needed. The copy condition
uses the already loaded recent-session state; tests inject the existing Home
data seam.

