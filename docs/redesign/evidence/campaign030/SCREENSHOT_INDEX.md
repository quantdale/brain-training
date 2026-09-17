# Campaign 030 Screenshot Index

Date: 2026-09-17

Product baseline: 5c484a08083963439360cb06c229249029f90531

APK SHA-256: 5D832CAEEB2A683DEDEF58FBBA059BAD2CE2B3701963F057822DA5F247248CE

Device: emulator-5558, dedicated braintraining-c030, Android API 35 AOSP ATD,
1080 x 2400, 420 dpi.

## Important interpretation

These are native screenshot attempts, not usable visual screenshots. The
capture helper successfully deep-linked and route-verified every listed
surface, and saved the corresponding XML accessibility tree. However, every
PNG is a valid uniform-black frame. The black PNGs are indexed so the graphics
failure is reproducible and auditable; they are not evidence of the product's
visual design.

Raw evidence is intentionally outside Git to avoid adding 22 redundant black
images and large XML artifacts:

- Manifest: D:\Temp\campaign030-capture\manifest.json
- Evidence root: D:\Temp\campaign030-capture
- Accessibility audit: D:\Temp\campaign030-capture\a11y.json
- Capture timestamp: 2026-09-17T06:08:35.828Z

Every listed PNG is 10,195 bytes, 1080 x 2400, one unique RGB value, and has
SHA-256
9c7383dc015b03c1a5941e6a1d41073a7a09c6502f5d295ea419a11014847f44. The
matching light/dark XML files are route-verified and contain the semantic
content described in the runtime matrix.

## Static current-baseline matrix

| Surface | Route | Light PNG and XML | Dark PNG and XML | Semantic evidence |
| --- | --- | --- | --- | --- |
| Home / Today | / | default/light/home.png, home.xml | default/dark/home.png, home.xml | home-title, Today, workout CTA, 0 of 4, Start workout |
| Games | /games | default/light/games.png, games.xml | default/dark/games.png, games.xml | games-title, 42-game catalog, search, filters, featured/recommended |
| Game Detail | /game-detail/memory | default/light/game-detail.png, game-detail.xml | default/dark/game-detail.png, game-detail.xml | Memory identity, mastery 0, Play Memory, favorite, empty records |
| Progress | /progress | default/light/progress.png, progress.xml | default/dark/progress.png, progress.xml | time windows, no-session empty state, overall performance |
| Activity | /progress-activity | default/light/progress-activity.png, progress-activity.xml | default/dark/progress-activity.png, progress-activity.xml | empty activity calendar and Browse games |
| Progress Detail | /progress-detail | default/light/progress-detail.png, progress-detail.xml | default/dark/progress-detail.png, progress-detail.xml | empty domain history, game records, recent sessions |
| Profile | /profile | default/light/profile.png, profile.xml | default/dark/profile.png, profile.xml | identity, level/XP, streak, milestones |
| Rewards | /rewards | default/light/rewards.png, rewards.xml | default/dark/rewards.png, rewards.xml | empty inbox, balance, collection, cosmetics |
| Data Management | /data-management | default/light/data-management.png, data-management.xml | default/dark/data-management.png, data-management.xml | offline trust copy, local counts, export controls |
| Results | /results | default/light/results.png, results.xml | default/dark/results.png, results.xml | empty Results state and Browse games |
| Memory Game Intro | /game/memory | default/light/game-intro.png, game-intro.xml | default/dark/game-intro.png, game-intro.xml | difficulty, Start, tutorial/demo/QA affordances |

The PNG/XML paths in the table are relative to the evidence root. The manifest
records deepLinkStarted=true and routeVerified=true for all 22 entries and
skipped=[].

## Final graphics probe

The final supported launch used the current emulator equivalent
-gpu swiftshader. The repository screenshot helper produced:

- D:\Temp\campaign030-final-launch\screen-20260917-143440.png
- valid PNG, 10,195 bytes, 1080 x 2400
- SHA-256 9c7383dc015b03c1a5941e6a1d41073a7a09c6502f5d295ea419a11014847f44
- one unique color, minimum/maximum channel 0, mean luminance 0

The final probe is also intentionally external and is classified as
[Blocked]. It proves the persistent graphics limitation, not a product visual.

## Required surfaces not visually captured

The following Campaign 030 matrix items were not falsely represented by static
screenshots:

| Requested state | Status | Reason |
| --- | --- | --- |
| Intro/tutorial interaction | [Blocked] | Intro tree was captured; tutorial activation was not claimed without a usable framebuffer and stateful driver |
| Representative gameplay | [Blocked] | Authorized ARTEMIS Flash/Pro task unavailable |
| Pause/interruption | [Blocked] | Requires a live game session |
| Per-game Result | [Blocked] | Only empty Results was reached |
| Workout continuation/completion | [Blocked] | Requires authorized stateful workout execution |
| Resume/relaunch/persistence | [Blocked] | Requires native state mutation and replay |
| Compact, expanded, landscape, font scale 2, reduced motion | [External/manual validation pending] | Not run after bounded graphics diagnosis |
| Human visual/accessibility review | [External/manual validation pending] | No human or physical-device session available |
