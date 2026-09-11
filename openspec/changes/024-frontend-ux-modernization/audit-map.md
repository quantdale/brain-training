# Audit map — Campaign 024 frontend recon

Baseline SHA `0402279`. Evidence collected 2026-09-11 on the campaign capture
device `braintraining-ui35` (emulator-5560, 1080×2400 @420 dpi, GPU-enabled,
release APK `app-release.apk` 109,309,873 B from Campaign 023).

## Recon sources

| Source | What it produced |
|---|---|
| screen inventory (scout) | 16 routes + overlays with section order, styling approach, testIDs (`agent://ScreenInventory` transcript) |
| component-kit inventory (task) | primitive/token/duplication inventory, hardcoded-value offenders, dead hooks, micro-interaction matrix |
| accessibility audit (scout, 2 passes) | contrast table, missing roles/labels, touch targets, dynamic type, motion/sensory coverage |
| motion/perf/responsive audit (scout) | animation inventory, feedback gaps, list-render risks, responsive usage |
| Refero core-screen research | 17 iOS reference screens → 18 `PATTERNS-CORE` + 10 anti-patterns |
| Refero play-screen research | 16 iOS reference screens → 18 `PATTERNS-PLAY` + feedback choreography + 8 anti-patterns |

Research briefs are committed: `research/refero-core-screens.md` (19,233 B),
`research/refero-play-screens.md` (14,026 B).

## Baseline visual evidence (native, first time in this repository)

`qa-artifacts/campaign024/base-home.png` (+ `base-home.xml`) captured from the
release APK on emulator-5560. Controller finding (new capability):
`braintraining-ui35` was created with `hw.gpu.enabled=yes`; both project ATD
AVDs ship `hw.gpu.enabled=no`, which is why Campaign 023 could only record
"screencap returns a constant blank frame". Confirmed by capture: the ATD AVD
with `-gpu swiftshader_indirect` still returned a 10,195 B uniform frame, while
the GPU-enabled AVD returned 1,302,313 B of real pixels.

Independent visual read of the baseline Home screen (vision analysis of
`base-home.png`): flat white cards with near-identical weight, no hero metric
(largest element is an incidental streak "0"), pale lavender CTAs with blue
text that read weaker than the surrounding text, unlabeled inactive tab
destinations, and the streak card clipped by the bottom bar in the first
viewport.

## Findings driving the change

| # | Finding | Evidence |
|---|---|---|
| F1 | Only `GameButton` animates press; shell CTAs use opacity-only pressed styles | `components/game-ui/game-button.tsx:65,78`; inline CTAs at `data-management.tsx:411`, `rewards.tsx:383`, `profile.tsx:543`, `(tabs)/index.tsx:672` |
| F2 | Reanimated 4.5.1 + `react-native-worklets` installed, zero imports in `src/**` | dependency inventory; `grep reanimated src` → 0 files |
| F3 | Responsive hooks have zero consumers; breakpoints never used | `platform/layout.ts:16,21,26,35`; consumers list empty |
| F4 | ~20 inline pill-CTA copies, ~10 hairline `rgba(120,120,140,0.2)` literals, 3 track+fill copies | duplication table §3/§6 of the component inventory |
| F5 | Dark-mode-broken literals: `rgba(120,120,255,0.8)` (`(tabs)/progress.tsx:1051`), `rgba(0,122,255,0.12)` (`(tabs)/index.tsx:1046`), `rgba(128,128,128,0.25)` tracks | component inventory §2 |
| F6 | Accent fails AA as text on surface: 3.8:1 light, 3.9:1 dark | accessibility audit contrast table |
| F7 | ~25 interactive elements lack roles/labels/hints (progress rows, session rows, window selectors, charts) | a11y audit §2 |
| F8 | Sub-44 dp targets: Code Cracker pegs 40×40 without hitSlop (`current-guess.tsx:77`, `secret-reveal.tsx:51`) | a11y audit §3 |
| F9 | Primitives exist but unused: `StatTile`, `FeedbackCard`, `A11yDialog`, `StatGroup`, `ResultFeedback` | component inventory §1 |
| F10 | Blanket `maxFontSizeMultiplier = 1.35` masks layout fragility instead of fixing it | `components/a11y/font-scale.ts:17` |
| F11 | No progress-ring, skeleton, toast, badge, avatar, list-row, or input primitive; every screen re-implements them | component inventory §3 |
| F12 | Games grid renders all 42 cards inside a `ScrollView` (no virtualization) | motion/perf audit |
| F13 | Late-tap feedback can contradict the scored outcome in three games (already tracked as Low in `KNOWN_ISSUES.md`) | `KNOWN_ISSUES.md` Campaign 023 findings |
| F14 | Inactive tab destinations have no visible labels; active state is tint + capsule only | baseline vision read; `components/app-tabs*.tsx` |

## Surface → hero assignment (spec `screen-hierarchy` R1)

| Surface | Hero | Primary action |
|---|---|---|
| Home | Today's Workout goal ring + streak strip | Continue/Start workout |
| Games | Featured/recommended card + searchable library | Open game |
| Game detail | Mastery ring + personal best | Play |
| Progress | Composite hero (ring + trend) with window control | Drill into domain |
| Results | Score hero with reward + personal-best state | Play again |
| Rewards | Claimable inbox hero (count) | Claim |
| Profile | Identity hero (avatar + level + XP meter) | Equip/claim |
| Data management | Storage summary hero | Export |
| Game host (intro) | Game identity + reward box | Start |
| Game host (session) | Round/timer/score HUD | Answer/tap |
| Game host (results) | Celebration + metric row | Play again |

## a11y gap list (spec `accessibility-upgrade` R2/R3)

Carried verbatim from the audit for closure tracking: progress-domain
segmented control (role/label), progress-game window selector (role), chart
primitives (textual summary), progress rows (~20, role), progress-detail game/
session rows (role+hint), results session rows (hint), rewards cosmetic buy
edge case, stacked-share bar label, activity heatmap cell/region label,
Code Cracker pegs (44 dp), deduction-table cells (verify padding).

## Recording rule

Every finding above is closed by a `tasks.md` item and evidenced in
`.agent/VALIDATION.md`; anything not exercised on this host is recorded as
NOT VALIDATED with the reason.
