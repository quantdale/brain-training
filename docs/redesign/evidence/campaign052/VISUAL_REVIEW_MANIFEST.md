# Campaign 052 visual review manifest

## Shared provenance

- Product/source SHA reviewed: `fe5757b9b7c280652b424e98fe764c9dbc2a2c28`
- Release APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Release APK SHA-256: `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C`
- Device: dedicated AVD `braintraining-ui35`, serial `emulator-5554`, Android 15 / API 35
- Physical profile: 1080×2400, density 420, font scale 1.0
- Capture method: emulator-local ADB screenshots and UIAutomator hierarchy inspection; all navigation used visible UI controls and no host mouse/keyboard injection
- ARTEMIS: used for a separate Pro walkthrough and route/state discovery; accepted packet pixels were recaptured locally with ADB from the same APK
- Computer use: not used
- Theme state: light captures use system night mode off; dark captures use system night mode on and a force-stop/relaunch before capture

## Accepted screenshots

All committed screenshot files are 540×1200 JPEGs. Hashes below are SHA-256 hashes of the committed JPEG files, not of the temporary full-resolution PNG captures.

| Filename | State | Route | Theme | Method used to reach state | Capture SHA-256 | APK SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| [home-today.jpg](screens/home-today.jpg) | Home / Today, workout ready at 0/4 | `/` / Home tab | Light | Exact release APK installed, app data cleared, launch settled, Home visible | `8C456DB703BC148820B4DC4D29FB158F2D05B0D18486C7A02C0DD9E9E2C62348` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [games-discovery.jpg](screens/games-discovery.jpg) | Games discovery, suggested next and more good fits | `/games` | Light | Tapped Games tab, scrolled to the top of the visible discovery surface | `7C0D05584092D678AF88D4D8863664E92774CDC25503B84DF1C9CDBBDE5996DB` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [game-detail.jpg](screens/game-detail.jpg) | Symbol Tracker detail | `/game-detail/[id]` | Light | Tapped the visible featured game card from Games | `39404E3F3D106B6B2EA3A93D584E559D6274C596295A43F17F51775A0D3B08D8` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [active-gameplay.jpg](screens/active-gameplay.jpg) | Symbol Tracker, Round 1/5 memorization phase | `/game/[id]` | Light | Tapped Play, selected Normal, tapped Start game; captured during the real first round | `025134CE9327159CF99F761556E81EF80B6C7C521A1B280DA29DD89160516D5C` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [result.jpg](screens/result.jpg) | Symbol Tracker session complete, 0 score after honest timeout path | `/results` / game result state | Light | Allowed the five-round game to run, accepted visible timeout submissions, tapped See results | `ACD4B45EE64972943994B3A77C971DAA97221432874EA0766D8F58A494DDD716` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [progress.jpg](screens/progress.jpg) | Progress 30d, one recorded session and overall rating | `/progress` | Light | Tapped Progress tab after the real standalone session; scrolled to top | `B313C699637A53758BDAB9DD91F0923BD32C889396564C7E67608B1F747FB22E` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [profile.jpg](screens/profile.jpg) | Local player profile and motivation | `/profile` | Light | Tapped Profile tab and scrolled to the top identity/motivation surface | `172F0450532B7E5AEBF01B6D604EE9CABCD7B13ABE72FD03F5ECE400C044C23A` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [rewards.jpg](screens/rewards.jpg) | Rewards, ready-to-claim First Steps and collection | `/rewards` | Light | Opened visible Open Rewards entry from Profile | `60E52A2CA063BFE4D65B47063B154716D49C0CEFCCFCA475432AA8413D4F88BA` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [home-completed.jpg](screens/home-completed.jpg) | Home after Today’s Workout completed, 4/4 games saved | `/` / Home tab | Light | Completed all four Today’s Workout games through normal visible play, backed out to Home | `886C1C2908845E74836DAD2BCDBBBFCE034E761860EE30AE720FC56A5063BAD5` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [workout-complete.jpg](screens/workout-complete.jpg) | Final Signal Watch result with Workout complete, 4/4 games | `/game/[id]` / workout result state | Light | Completed Next in Sequence, Symbol Tracker, Word Scramble, and Signal Watch in the Today’s Workout flow | `B16234423BD89C9870EE98C45A458A609A04E3671F3BF8C7708282E541F7A6C2` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [games-search-filtered.jpg](screens/games-search-filtered.jpg) | Games search for `memory`, filtered library showing Memory games | `/games` | Light | Opened visible Search games field, entered `memory` with emulator-local ADB input, dismissed keyboard | `A9868CABB00709BFBDFE6725D02B8E212E5751B8D016D559FA1F65B25E22DDBA` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [dark-home.jpg](screens/dark-home.jpg) | Completed Home / Today | `/` / Home tab | Dark | Enabled system night mode, force-stopped/relaunched, returned Home to top | `19039F76BCCBD0354CAC89F31AFC80FD9D1A9C8431DDCBF2D3FE20D54656083B` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [dark-games.jpg](screens/dark-games.jpg) | Games discovery | `/games` | Dark | Tapped Games tab and returned the discovery surface to its top | `8034621A12D4E0D3C84A3A0B29098F2E585D9C0C2EEB4CC8674A3DC5EC2493EE` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [dark-game-detail.jpg](screens/dark-game-detail.jpg) | Next in Sequence detail | `/game-detail/[id]` | Dark | Tapped the visible suggested game card from dark Games | `3D1AC1D170F2E64C229F4979A3CF7D03013EBF44E93BB47F88EB9879D0D42B83` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |
| [dark-result.jpg](screens/dark-result.jpg) | Next in Sequence session complete, 150 score | `/results` / game result state | Dark | Played five visible rounds from dark Game Detail, selected visible options, tapped See results | `8AA0BD14C85C5A0A76F0E8321DD5B6CAD545CC137B3EE31B7E52127B3AD7372B` | `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C` |

## Contact-sheet provenance

| File | Contents | Dimensions | Size | SHA-256 |
| --- | --- | --- | --- | --- |
| [contact-sheet-primary.jpg](contact-sheet-primary.jpg) | The exact eight primary JPEGs above, labeled in a 2×4 grid | 548×2424 | 224,590 bytes | `8FB7DBC7D075358D4476C3A4419DD57551904A5D2AF3988B1941E17C78CC7651` |
| [contact-sheet-preview.jpg](contact-sheet-preview.jpg) | Reduced version of the exact primary contact sheet | 280×1238 | 46,554 bytes | `21B1934954E6E24BC11B23F8A644CB2B1DC927502F2023256D7082C629CDA552` |

## Verification record

- All 15 accepted screenshots were inspected as full-resolution captures before JPEG conversion and are nonblank.
- All committed screenshots are 540×1200 JPEGs; product content was not selectively cropped or beautified.
- No accepted capture contains a system dialog or setup prompt.
- The contact sheet was generated from the exact eight committed primary JPEGs, not from stale Campaign 051 baseline images.
- The release APK was installed and exercised on `emulator-5554`; its SHA-256 is recorded above for every row.
- `git diff --quiet fe5757b9b7c280652b424e98fe764c9dbc2a2c28 -- apps/mobile app.json apps/mobile/android` passed before packet creation.
- Campaign 052 product source files were not changed.
