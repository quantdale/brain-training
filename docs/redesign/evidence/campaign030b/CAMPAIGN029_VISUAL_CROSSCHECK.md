# Campaign 029 visual and runtime cross-check

Date: 2026-09-17

Campaign 029 was source- and structure-led because its AVD could not publish
usable pixels. Campaign 030 repeated that limitation: the hierarchy was
populated, but the ATD framebuffer was uniform black. Campaign 030B replaces
that limitation with a normal Pixel 7 Google APIs AVD and current rendered
screens. The classifications below use the exact matrix in
`VISUAL_BASELINE_INDEX.md`, the dynamic evidence in
`GOLDEN_PATH_RUNTIME.md`, and the rerun accessibility audit. They do not
pretend to be human usability findings.

## Hypothesis cross-check

| Campaign 029 hypothesis/question | Campaign 030 structural evidence | Campaign 030B rendered/runtime evidence | Final classification | Plan consequence |
| --- | --- | --- | --- | --- |
| Today should be the dominant Home action | Source inventory identified Home as the direct product promise, but visual hierarchy was unobserved | Home visibly leads with a large Today card, 0/4 or 1/4 or 4/4 progress, and a strong Start/Continue CTA; the completed workout is also visually prominent | **PARTIALLY CONFIRMED** | Preserve Today as the lead. Human testing is still needed to decide whether it is dominant enough and whether the surrounding header/status content delays the first action. |
| Home's above-the-fold density is a hierarchy problem | Source audit listed Today, streak, level/XP/coins, reroll, alternate workouts, recent games/history, Spotlight, mastery, and milestones | Current Home screenshots show brand/header, Today copy/progress, four leg rows, reroll copy, sticky tabs, and large status/card treatment; the route is visually long and information-rich | **CONFIRMED** | Keep the master plan's progressive-disclosure direction; the concern is now visually evidenced, not only inferred from file size. |
| Simultaneous accents may compete with training | Campaign 030 could only verify theme tokens and semantic nodes | Rendered screens visibly combine warm paper/deep plum neutrals, coral action accents, purple surfaces, domain colors, badges, borders, and tactile shadows | **CONFIRMED as an observation; impact still unverified** | Test accent restraint in a later redesign. Do not infer that color is inherently harmful from pixels alone. |
| Games should become intentional discovery rather than a database/catalog | Static tree showed featured/recommended content, search, filters, and a 42-game catalog | Games visibly presents recommendation/featured content, search/browse chips, and a broad catalog in the same surface | **PARTIALLY CONFIRMED** | The “two jobs in one surface” diagnosis is supported. A later redesign should distinguish Suggested Next from Browse/lookup rather than delete catalog utility. |
| Progress is an analytics console before it is an answer | Campaign 030 verified the rich route structure but not visual density | Progress and Progress Detail visibly show selectors, performance summaries, domain/history material, and drill-down content; the current data fixture produces a 43dp history row | **CONFIRMED for density; comprehension STILL UNVERIFIED** | Keep summary-first/progressive-disclosure work. Add the measured row-size issue to validation acceptance. |
| Profile and Rewards create competing motivation surfaces | Source audit found Profile, Rewards, streak, quests, achievements, cosmetics, XP, coins, and settings | Profile visibly combines identity/level/streak/XP/coins and controls; Rewards separately exposes claimable items and collection. Both are populated in the current fixture | **CONFIRMED** | Preserve the plan's single Rewards owner and quieter Profile summary. Human participants must validate findability and motivation effects. |
| Game identity before play is too shallow/shared | Campaign 030 verified shared GameHost/test IDs only | Game Detail and intro visibly show game name, skill/domain, mechanic framing, play/start actions, and a shared shell; domain color and shared chrome still carry much of the identity | **PARTIALLY CONFIRMED** | Add authored identity carefully at discovery/detail/intro boundaries; do not replace instructions or shared lifecycle. |
| Results need a clearer hierarchy and next step | Campaign 030 could not reach a populated result | Genuine QA-forced results visibly show score, accuracy/round progress, saved/reward feedback, and Next Game/Play again/Done; continuation reaches the next intro | **PARTIALLY CONFIRMED** | The functional next-step hierarchy exists. Human comprehension of score/PB meaning and reward emphasis remains open. |
| Light and dark should preserve the same product structure | Campaign 030 had matching but black light/dark trees/PNGs | All 22 routes capture successfully in both themes with route-verified XML and non-uniform PNGs; colors change while route/content markers remain | **CONFIRMED structurally and visually; contrast certification STILL UNVERIFIED** | Preserve theme parity as a later acceptance gate; do not claim WCAG from this audit. |
| “Neon Arcade” accurately describes the perceived product | Campaign 029 verified the token/comment name but explicitly warned that perception was unobserved | Actual pixels show the named traits: warm paper/deep plum, vivid coral/domain accents, rounded tactile cards/buttons, high-contrast type, and energetic badges; they also read as a training utility rather than a literal arcade screen in these captures | **PARTIALLY CONFIRMED** | Treat Neon Arcade as a design-system lineage, not a fixed product-positioning verdict. Test the proposed calmer adult cognitive-gym direction with humans. |
| Data Management should communicate local trust accurately | Campaign 030 could only verify local/offline copy in XML | Current rows persist across completion, process kill, and relaunch, but the hero says `Local database — Empty` while counts report persisted sessions/workout/tutorial rows | **CONTRADICTED for storage-size presentation; persistence CONFIRMED** | Record a maintenance/follow-up requirement to distinguish “size unavailable” from “empty.” Do not redesign or alter persistence in this campaign. |
| Semantic structure and primary actions should remain observable | Campaign 030 had 22 populated route trees but no visual confirmation | Exact current APK has route-verified trees for all 22 matrix entries; all interactive nodes are labelled; two themes have one measured 43dp Progress-detail row, and existing clipped-under-tab-bar notes remain | **PARTIALLY CONFIRMED** | Keep semantic IDs and audit as gates. Fix/validate target sizing and scroll clipping in an appropriately scoped later maintenance/design packet. |
| Recoverable empty/error states must be distinct | Campaign 030 saw semantic empty states but could not see them | Game Detail visibly shows no-history content; the storage fixture visibly explains local-data safety and offers Retry; in-place Retry recovery was not observed, while close/reopen recovered to Home | **PARTIALLY CONFIRMED** | Preserve distinct no-history/error copy. Add a deterministic successful Retry check if the fixture is made reliable later. |

## Corrections to the inherited plan

The Campaign 029 direction does not need a structural rewrite: the normal AVD
supports its central Today → Play → Result → Completion diagnosis. Two concrete
runtime facts must be carried forward, however:

1. Data Management's current storage-size hero can say `Empty` while its table
   counters prove local data exists. This is a trust/observability defect in the
   current baseline, not a reason to infer data loss and not something changed
   here.
2. The current populated Progress Detail fixture exposes one 43dp row per
   theme, and Games/Profile retain the audit's clipped-under-tab-bar notes.
   These are explicit validation debt alongside the master plan's density and
   accessibility questions.

The plan's historical “visual runtime unavailable” statements remain valid for
Campaign 029/030 at their own heads. Campaign 030B closes that historical
limitation for the current Android baseline; it does not provide human
comprehension, iOS, large-font, landscape, or all-42-game evidence.
