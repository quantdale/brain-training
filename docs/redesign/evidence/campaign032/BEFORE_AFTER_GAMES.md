# Campaign 032 before / after Games and Game Detail

Date: 2026-09-17

## Before context

The immutable visual baseline is the Campaign 030B package:

- Light Games: `D:\Temp\campaign030b-visual-baseline-verified\default\light\games.png`
- Dark Games: `D:\Temp\campaign030b-visual-baseline-verified\default\dark\games.png`
- Light Game Detail: `D:\Temp\campaign030b-visual-baseline-verified\default\light\game-detail.png`
- Dark Game Detail: `D:\Temp\campaign030b-visual-baseline-verified\default\dark\game-detail.png`
- Baseline index: `docs/redesign/evidence/campaign030b/VISUAL_BASELINE_INDEX.md`

The prior Games surface exposed a recommendation/featured treatment alongside
the catalog and controls, but the recommendation signals read as parallel
discovery surfaces. Game Detail exposed useful description and history data,
yet the identity/mechanic-to-Play path was less explicit than the Campaign 032
target.

## After context

The Campaign 032 static matrix is:

- Light Games: `D:\Temp\campaign032-runtime-after\default\light\games.png`
  (223,905 bytes)
- Dark Games: `D:\Temp\campaign032-runtime-after\default\dark\games.png`
  (213,765 bytes)
- Light Game Detail: `D:\Temp\campaign032-runtime-after\default\light\game-detail.png`
  (226,123 bytes)
- Dark Game Detail: `D:\Temp\campaign032-runtime-after\default\dark\game-detail.png`
  (199,792 bytes)
- Light standalone intro: `D:\Temp\campaign032-runtime-after\default\light\game-intro.png`
  (185,973 bytes)
- Dark standalone intro: `D:\Temp\campaign032-runtime-after\default\dark\game-intro.png`
  (176,130 bytes)
- Machine-readable manifest: `D:\Temp\campaign032-runtime-after\manifest.json`

All six after captures are nonblank and route-verified. The visible hierarchy
is now page identity → Suggested Next → Browse All controls/catalog; an active
search/filter state hides the suggestion area and foregrounds the tool state.
The detail surface visibly presents the family motif and mechanic verb before
the Play button, with records/recent history lower in the scroll order.

## Behavioral before/after summary

| Concern | Before context | Campaign 032 result |
| --- | --- | --- |
| Recommendation hierarchy | Multiple discovery signals could read as peer shelves | One Suggested Next area with existing evidence consolidated into reason + alternatives |
| Choosing from the catalog | Catalog and recommendation treatments shared the visual field | Browse All is explicit, countable, searchable, and filterable |
| Identity | Category/name carried most recognition | Every catalog entry has shared family motif + mechanic verb + interaction sentence |
| Search/filter state | Controls existed but recovery/hierarchy was less explicit | Active state shows counts, clear/reset, and separate no-results/favorites-empty recovery |
| Game Detail | Description/history were useful but less identity-first | Mechanic and dominant Play precede deep history; existing records remain below |
| Persistence | Existing favorite/mastery/session seams | Preserved and replayed; no schema or game-mechanic change |

This is a product hierarchy comparison, not a claim that the pre-Campaign-032
implementation was broken. The before images remain immutable and the after
raw pixels/XML remain outside Git at the paths above.

