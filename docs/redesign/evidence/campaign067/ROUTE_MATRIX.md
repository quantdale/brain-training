# Campaign 067 — route and recovery matrix

Deep links opened via `adb shell am start -a android.intent.action.VIEW`
and verified from the UI hierarchy (marker text per route).

| Route | Result | Observed |
|---|---|---|
| `braintraining://games` | **PASS** | Games heading, description, Suggested next / Odd One Out |
| `braintraining://game/memory` | **PASS** | Game surface (Memory) |
| `braintraining://progress` | **PASS** | Progress selector |
| `braintraining://profile` | **PASS** | Profile identity |
| `braintraining://rewards` | **PASS** | Rewards title |
| `braintraining://data-management` | **PASS** | Data Management + Local Data counts |

Recovery (all render a safe fallback, no crash, no blank strand):

| Probe | Result | Observed |
|---|---|---|
| unknown game id | **PASS** | "Game not found — This game is not in the library… Back to library" |
| oversized game id (300 chars) | **PASS** | same fallback |
| malformed game id (`@@@`) | **PASS** | same fallback |
| unknown results id | **PASS** | "No sessions yet — Play a game… Browse games" |

Boundary: the cold deep-link → in-game "Done" → back behavior
(065 Pass B item B1, 42 game screens use bare `router.back()` where the
results flow is pushed) was **not** device-probed in this pass; it is
carried to the hardening phase with the 065 recipe.
