# Campaign 050 Protected-Flow Reconciliation

Primary trace: ARTEMIS Pro
`b1b2be3a-6801-430b-b336-e89fda68f567`, device `emulator-5554`, release APK,
Metro intentionally stopped. No host mouse or keyboard input and no QA/gameplay
controls were used.

| Flow | Result | Observed evidence |
| --- | --- | --- |
| Cold launch and tabs | CONDITIONAL PASS | First-install ANR dialog appeared; bounded close/relaunch reached responsive Home with Home/Games/Progress/Profile |
| Four-game workout | PASS | Cue Shift 10/10, Word Chain normal timeout result, Order Path normal result, Color Stroop 15/15 normal timeout result; Home showed 4/4 saved |
| Workout persistence | PASS | Progress showed 48 sessions before force-stop and 48 after force-stop/cold relaunch |
| Standalone #1 | PASS | Pattern Tap Back Memory, valid tile interaction through 0/5 result, Done and Back returned to Games |
| Standalone #2 | PASS | Signal Watch Attention, ordinary visible stream through Final 480 / Go 0/26 / Stop 4/4 / XP22, returned to Games |
| Export | PASS for reachability/cancel | Android share sheet showed one JSON backup with Quick Share/Drive/Gmail; Back dismissed it without data mutation |
| Import | NOT VALIDATED | Android Files picker appeared; the provider showed an ANR while dismissing. No file was selected, imported, merged, replaced, or wiped |
| Invalid game deep link | PASS | `braintraining://game/not-a-real-game` showed `Game not found` and `Back to library`; Back returned to the app |
| Final usable screen | PASS | Emulator-local Home navigation showed `Workout complete`, `4/4 games saved`, and all four rows marked Done |

The retained Campaign 047 portability suite remains the authoritative
repository-level evidence for valid merge/replace preview, rollback, malformed
input, and durable backup semantics. Campaign 050 did not perform a destructive
device import or data wipe.

## Catalog reconciliation

Campaign 046's certificate covered all 42 registry IDs through the recorded
detail/start/first-interactive/result/persistence/return lifecycle, with 44
sessions across 42 IDs and real mechanic canaries across all eight domains.
Campaigns 047–050 made no game-module or registry-source changes. The current
registry check is up to date and the current runtime source lineage is
`d67aba5`; therefore the 42-ID certificate remains the applicable catalog
summary for this candidate. The current ARTEMIS journey is representative
canary evidence, not a claim that the four-game journey replaces the 42-ID
certificate.
