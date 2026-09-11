# Refero core-shell research (iOS) — Campaign 024

Method: `refero_search_screens` (platform `ios`) for the 6 assigned queries + `Duolingo home learn path`, `Brilliant learning app home course`, `Headspace home today progress`, `Elevate`; `refero_get_screen` JSON detail on 19 ids. Real Duolingo (app 5) and Brilliant (app 166) screens found. `Elevate` returns only hiking "elevation" screens — the brain-training app is absent from Refero; Planny/Clearful/Haptic/Kann/Body Coach used as proxies. `Headspace` returns onboarding only, no home dashboard — omitted.

## Reference screens

### 1. Apple Books — reading-goals dashboard — `b3833061-cace-42ca-854c-0b0fdadb376a`
What: daily-goal home dashboard with hero gauge, resume CTA, streak dots, mini-player, pill tab bar.
- Section order: peek of now-reading card → serif H1 "Reading Goals" (~34–40px) → 2-line gray subtitle (~18–20px) → semi-circular arc gauge → black pill CTA → streak-dot row → "Start a new streak ›" link → legal link → floating mini-player → pill bottom nav.
- Hero metric: elapsed "2:05" in very large serif centered INSIDE the arc; label "Today's Reading" above, "of your 10-minute goal ›" below; thin track with cyan-blue (#0799E2) segment, rounded caps.
- CTA: full-content-width black pill, TWO lines (bold "Keep Reading" + lighter book title); sits directly under gauge, no card chrome around it.
- Streak: single-letter circular day chips, active = cyan fill/white letter joined by connecting line, current day = white with partial ring; tappable "Start a new streak ›" prompt beneath.
- Nav: white pill container, 4 tabs (Home active with gray highlight lozenge) + detached circular search button at right.

### 2. Apple Books — "Daily Goal Achieved" success overlay — `90768522-bcc5-4ca3-b27d-8e2a57f13337`
What: full-screen black celebration overlay shown exactly when a daily goal completes.
- Order: top-right circular ⌞X⌟ → large cyan (#09A3DE) glowing check badge → serif headline "Daily Goal Achieved" → metric "47 minutes" in badge-blue → 1-line congrats sentence → pill SHARE button (charcoal #333) → text-only ADJUST GOAL.
- No cards, no nav, no illustration beyond the badge; all centered on one axis with large negative space.
- CTA hierarchy: one filled pill (share) + one borderless uppercase text action (adjust goal); nothing else competes.

### 3. GrowPal — "Perfect Day" glance widget — `61ef4b0b-6801-49c3-b141-023f32c833bb`
What: compact dark widget pairing one ring with a 4-row metric list.
- Layout: left circular gauge (~40% width, orange→purple gradient ring, "100%" large light-blue + "Perfect Day" small gray + avatar inside/below) | right vertical stack of 4 metrics (~60%).
- Metric rows: colored circular icon + "achieved of target unit" ("16939 of 10,000 steps", "775 of 600 kcal burn", "7h 8m of 7 h sleep", "369 pts Close move ring"); achieved in color, target in gray.
- Rounded card + subtle shadow; nothing else on screen except centered app label and Search pill.

### 4. The Outsiders — weekly-distance progress dashboard — `cf80decc-6faa-483f-8e67-24ce9dee0760`
What: dark gradient fitness progress screen with donut, week chart, overview cards, floating pill nav.
- Order: ghost circular back/overflow buttons + orange title "Weekly Distance" (~28–34pt semibold) with lighter subtitle → donut (~56–72px dia, 6–8px stroke, orange) + big "0 / 3" fraction (numerator ~34–40pt bold white, unit ~18–20pt dimmed) + "3 mi to go • 0.43 mi behind plan" (~13–15pt) → centered week pager "Feb 22–28, 2026" with chevrons → line chart (dotted 1/2/3/4 mi gridlines, right-axis labels, 7 day columns, orange selected-point marker ~12–14px, hatched target band) → "OVERVIEW" caps label (~12–13pt) → 3 dark cards (Average/Max/Min, radius ~12–16px, ~140–160px wide, horizontal scroll).
- Nav: floating centered pill (~320–360×64px, radius ~32px, dark translucent) with 3 segments Today/Progress/Workouts; selected = pink (#FF2D55) icon+label.
- Margins ~16px; block gaps 18–36px; all key numbers high-contrast white/orange.

### 5. Clearful — progress dashboard, dark + light — `7376aa34-4061-4f97-88e6-57646f1f7f89` / `c97a590a-59aa-4206-86f1-e6456f051ac7`
What: journaling-app Progress screen in two themes; identical information architecture.
- Order: large left-aligned "Progress" title → full-width weekly card (hourglass icon + "Minutes This Week" bold white, "Daily Average" gray, hero "8 min" large bold blue left + date range small blue right, 7-bar Sun–Sat chart, zero days empty) → 2-column pair ("Entries This Month" / "Entries This Year", big blue numerals "21") → "Activity Breakdown" title → 2-column pair (Most Activity Wednesday w/ alarm icon on blue card vs Least Activity Thursday w/ sleep icon on dark card).
- Type scale: title ~24–28pt bold → card label ~14–16pt → hero numeral large bold blue → axis/day labels small gray. Cards rounded, generous padding; dark = navy (#0A1A4D) + gray (#121212) on black; light = blue (#D6E3FF) + white cards on off-white (#F7F9FC).

### 6. Haptic — minimalist analytics — `793a5257-faea-40f9-ba8d-ed5f892d624b`
What: 3-white-card analytics stack on white.
- Order: category list card (Flights/Books/Games rows: colored rounded-square icon left, bold name + small count "1" stacked, right chevron) → November-2024 bar chart card (purple bars on active days 14/16–19, dashed placeholders elsewhere, gray date labels) → 2×3 stat grid (Today 4 / Week 7 / Month 9 / Year 9 / Streak 4 / Best Streak 4; labels uppercase light-gray small, values large black, dotted vertical separators).
- No hero, no CTA: the grid IS the content; one card per question (what / trend / totals).

### 7. Kann — script-segmented analytics — `3273a1e8-6598-40c0-b71a-0cc8e2d2624a`
What: Japanese-learning Analytics with tab-scoped metrics, dot calendar, timeline with designed empty state.
- Order: bold "Analytics" → horizontally scrollable capsule segmented control (Hiragana active white / others gray) → progress card ("Hiragana Progress" + subtitle; 2×2 mini-blocks: Total Items 69 black, Mastered 0, Success Rate 0% orange w/ line icon, Total Attempts 0 purple w/ ? icon, each with faint glyph) → Activity card (3-month Oct/Nov/Dec dot-matrix, gray dots, one blue highlight) → Learning Timeline card (title + subtitle + centered rising-arrow icon + "No learning data available" gray).
- Empty state is a designed card section, not a blank screen: icon + explicit sentence, same padding/radius as data cards.

### 8. Todoist — Daily/Weekly productivity — `d2dd089d-2a3f-4d8e-9785-3b904ff15feb` / `36275df9-c867-4bda-b4a7-687f21694e95`
What: stats modal with red-on-white chrome and segmented time views.
- Order: nav bar (red "Settings" left, bold black "Productivity" center, red "Done" right) → profile row (avatar left, "John" bold + "0 completed tasks" regular, chevron right) → segmented Daily/Weekly(active white)/Karma on gray track → left-aligned sections ("Daily Goal" 0/5 tasks + red "Edit Goals" link + medal icon right; "Daily Streak" 0 days + longest-streak subtext; "Completed In the Last 7 Days" day list Thu–Fri with zeros + vertical line chart right; weekly variant swaps in 4-bar chart).
- Section headings bold gray (~#757575); values bold black; exactly one red text-link per goal section; dividers/whitespace separate, no card boxes.

### 9. Duolingo — public profile (daniela) — `51b4554f-6629-4fa1-9a5a-63de6ab78885`
What: gamified profile with 2×2 stat grid + badge strip.
- Order: back arrow left / SUPER badge + avatar right → username bold dark-gray left → "Statistics" 2×2 grid (streak card yellow w/ flame "510 Day streak"; XP white "105668 Total XP"; league white w/ "WEEK 3" overlap badge; medals white "25 Top 3 finishes"; rounded, subtle shadow) → "Achievements" white rounded panel (4 yellow badges w/ LEVEL labels evenly spaced) → "View 8 more ›" left link → gray uppercase REPORT/BLOCK text buttons centered.
- One card is intentionally colored (streak = yellow) while the rest stay white: color marks the primary identity metric.

### 10. Duolingo — own profile achievements — `8f795495-c728-4bee-a343-e1ddacc7ae23`
What: claimable-achievement list with progress bars and 6-icon nav.
- Order: centered gray "Profile" + blue gear right → name left / avatar+edit-badge right → "Achievements" stacked cards (badge icon left; bold title; right side EITHER bright-blue uppercase "CLAIM REWARD" pill OR gray progress bar "0/40") → "View 9 more ›".
- Nav: 6 evenly spaced colorful icons (home, dumbbells, chest, shield, avatar active w/ blue outline, bell) on white; active = outline/background, not just tint.
- Unclaimed-reward and in-progress states are visually distinct controls (button vs metered bar), never the same row style.

### 11. Brilliant — "For you" home — `a9f7377d-19f6-4fee-8368-f3e35ac338f9` / `246e9d21-d7ed-429b-9ad0-71194f012a6a`
What: personalized home: streak strip + single recommendation carousel card + 4-tab nav.
- Order: left "For you" bold black → day-streak row (5 circular day buttons T/W/Th/F/S, done = lime #D0E200 w/ black bolt, todo = gray; lime streak-count pill "⚡1" right) → large recommendation card (peach/purple gradient, thin tinted border, "RECOMMENDED" pill top-right, centered illustration, small uppercase category "CS"/"DATA" in accent color, bold black course title, full-width white "Start course" button) → pagination dots (4–5, active black) → 4-tab nav (Home active black; Courses/Leagues/Settings gray; Leagues carries red notification dot).
- One card visible at a time; illustration large and centered; CTA is white-on-gradient, not brand-blue — contrast comes from placement (bottom of card, full width).

### 12. Brilliant — course path screen — `112c2cdc-a694-4c91-9b3b-6cd2be050d61`
What: single-path resume screen with level badge.
- Order: back left / info right → uppercase orange "DATA ANALYSIS" eyebrow → bold black "Exploring Data Visually" → centered green (#3DBE29) progress bar (~70% width) → green "LEVEL 1 ↑" pill + "Guest Reviews" caption → next-module title "Introduction to Probability" bold + 2-line gray descriptor → full-width black "Continue path" button → 4-tab nav.
- Exactly one primary action; progress + level + next-step copy do all persuasion above it.

### 13. Duolingo — lesson-complete — `aa871eca-62d2-4eb9-a887-8c306d839e57` (search record; detail fetch invalid)
What: cheerful results screen: mascots top → large yellow "Lesson complete!" → 3 horizontal metric cards (XP/time/accuracy, colorful) → wide blue CONTINUE.
- Metric cards are equal-width columns in one row, not stacked; celebration precedes numbers; single dismissive CTA closes the loop.

### 14. Body Coach — "Wins" achievements — `90a948ea-d471-4f2c-842d-f6795f8da909`
What: dark-navy badge gallery with locked states.
- Order: back + centered "Wins" → section header row ("Workout Wins" bold white left, "See all" light-blue right) → 2-column hexagonal-coin badge grid (earned = colored w/ icon + milestone label "1st workout"; locked = grayed w/ "W" + count) → repeat for "Cycle Wins".
- Locked badges stay visible but desaturated — the grid advertises the goal; "See all" per section, not one global link.

### 15. Planny — triple chart cards — `2cfa750c-c69f-438f-a70d-fbf98fb5c781`
What: progress screen as 3 full-width solid-color chart cards (orange Productivity / green Completed / yellow Added) on beige.
- Card interior order: white bold title left + "↗ Rising trend" right → bar chart w/ faint trend line (days on x, 0–20 on y) → centered light caption ("In a few days you will see your statistics here").
- Color encodes metric identity; cards equal height/width, generous gaps; back + large "Productivity" title above.

### 16. Empty states — Vocabulary + Oku — `573e2434-ee47-4876-a815-e724b07f93a4` / `063e5db4-d7dc-492a-97bb-d96d5e21b29c`
What: first-run empty patterns (add-words; no-highlights).
- Shared order: back/nav top → centered illustration (isometric paper+pen w/ pink dotted shadow on beige; sketch cat-in-box on white) → bold heading ("You haven't added any words yet" serif ~24–28pt; "You don't have any highlights") → 1-line gray instruction → single bottom CTA (near-full-width rounded: light-blue "Add word" w/ shadow; black "+ New highlight").
- CTA is bottom-anchored above home indicator, ~full width; Oku keeps its 5-tab bar + circular chat FAB visible — empty state does not remove chrome.

### 17. Duolingo — feed + tab bar — `493de693-8fd6-418c-97c4-74a7c26681d6`
What: announcement feed showing the 6-tab bar at its most colorful.
- Cards: rounded, subtle shadow, colorful illustrated banner top → gray timestamp ("6 days") → body with bright-blue inline links.
- Tab bar: 6 fixed icons (home, dumbbells, chest, shield, avatar, bell), playful colors, active = blue highlight; icons are pictographic (objects), not geometric glyphs.

## PATTERNS-CORE

1. Hero-metric-inside-progress-visual: ring/arc ~96–120pt with value ~32–40pt bold centered + unit/goal line ~13–15pt beneath (Apple Books gauge; Outsiders donut + "0 / 3"). Applies to: Home (daily-goal ring), Progress (weekly hero), Results (score ring).
2. Dual-line primary CTA pill: bold verb line + lighter context line ("Keep Reading / The Time Machine"; "Resume X · Short") full-content-width, high-contrast fill, placed directly under hero metric. Applies to: Home, Game detail.
3. Streak strip as day dots + count pill: 5–7 circular day indicators (done = filled accent, today = ring, todo = gray) plus compact "⚡N" pill at row end (Brilliant; Books). Applies to: Home, Progress, Profile.
4. Segmented time control (Daily/Weekly/Karma; Hiragana/Katakana/…; DAY/MONTH/YEAR): capsule gray track, active segment white/black, content below swaps scope (Todoist; Kann; Stardust `90be269d`). Applies to: Progress, Profile.
5. Weekly card anatomy: icon + "Minutes This Week" label → "Daily Average" gray sub → hero numeral left + date-range right → 7-bar chart with empty zero-days (Clearful). Applies to: Progress, Home.
6. Most/Least 2-column insight pair below totals (Clearful breakdown; Haptic 2×3 grid Today/Week/Month/Year/Streak/Best with dotted separators, labels uppercase ~11–12pt gray, values ~20pt+ black). Applies to: Progress, Results.
7. Category rows with identity icons: rounded-square tinted icon + bold name + small count + chevron (Haptic Flights/Books/Games). Applies to: Games (domain rows), Data management (storage rows), Profile (settings rows).
8. Achievement row anatomy: left badge icon + bold title + right EITHER blue "CLAIM REWARD" pill (claimable) OR gray "n/m" progress bar (in-progress) (Duolingo `8f795495`). Applies to: Rewards, Profile.
9. Badge gallery: section header + right "See all" link + 2-column grid; locked badges visible but desaturated (Body Coach). Applies to: Rewards, Profile.
10. Stat identity grid: 2×2 cards, ONE accent-colored hero card (streak yellow) + rest white, overlap badge for time scope ("WEEK 3") (Duolingo `51b4554f`). Applies to: Profile, Home.
11. Recommendation card anatomy: accent eyebrow pill ("RECOMMENDED") + centered illustration + uppercase category label + bold title + full-width bottom CTA + pagination dots (Brilliant). Applies to: Home (workout suggestion), Games (featured game).
12. Single-path resume block: eyebrow category → title → ~70%-width progress bar → level pill ("LEVEL 1") → next-step title + 2-line descriptor → one "Continue path" button (Brilliant `112c2cdc`). Applies to: Game detail, Home (continue-workout).
13. Results anatomy: celebration visual → large colored headline → 3 equal metric columns in one row → single wide dismissive CTA (Duolingo lesson-complete; Books success overlay). Applies to: Results.
14. Celebration overlay rules: solid black full-screen, glowing check badge, serif headline, metric in accent color, primary pill SHARE + borderless text secondary (Books `90768522`). Applies to: Results (personal best / goal hit).
15. Bottom-anchored empty-state CTA: centered illustration → bold heading ~24–28pt → 1-line gray instruction → near-full-width rounded button above home indicator; keep tab bar visible (Vocabulary; Oku). Applies to: Games (no history), Rewards (nothing claimable), Data management (empty backup list), Progress (no data + Kann timeline sentence).
16. Chart-card stack: equal full-width cards, one metric each, solid identity color, title-left + trend-label-right header, captioned trend line chart (Planny). Applies to: Progress (per-domain charts).
17. Dot-matrix activity calendar: 3-month GitHub-style dot grid under "Activity", highlight = single accent dot (Kann). Applies to: Progress, Profile.
18. Tab bar rules: 4–5 destinations max on phone (Brilliant 4; Books 4+search; Duolingo 6 is the cautionary extreme); active = filled highlight lozenge/outline, not tint alone; notification dot on the destination, never a badge count; labels always under icons (all refs). Applies to: shell nav (all screens).

## ANTI-PATTERNS (our current flat card-stack vs refs)

- Every Home slot is the same white `surface` card with the same radius/elevation, so workout CTA, level, streak, and history all shout at equal volume; refs give the ONE primary action a unique treatment (black pill, colored hero card, gradient recommendation) and demote the rest to rows or ghost surfaces.
- No hero metric anywhere: XP/streak/goal numbers sit in small rows inside cards, while refs center one ~32–40pt numeral inside or beside its progress visual and relegate everything else to ~13–15pt support lines.
- Progress visuals are thin inline bars (`ProgressTrack`) with no labeled scale, axis, or empty-zero rendering; refs always pair a chart with day labels, a date-range caption, and visible zero states — our charts cannot be read, only noticed.
- Streak is a text row (`streak-card`) instead of a dot strip + count pill, so weekly rhythm and today's state are invisible at a glance; refs make the 7-day shape the streak UI.
- Achievement/reward rows use one uniform style for claimable vs in-progress vs locked; Duolingo/Body Coach use three distinct treatments (blue CLAIM button vs gray n/m bar vs desaturated badge) — ours cannot signal "act now".
- Empty states reuse the generic card + small copy instead of the reference anatomy (illustration → ~24–28pt heading → 1-line instruction → bottom-anchored full-width CTA); first-run screens read as broken lists rather than invitations.
- Results (`results.tsx`) stacks metrics vertically in uniform cards; refs use one celebration headline + a single row of 3 equal metric columns + one wide CTA, with a black full-screen takeover reserved for goal-hit moments.
- Tab bar carries too many same-weight destinations with tint-only active state; refs cap at 4–5, mark active with lozenge/outline, and park overflow (search, overflow menu) outside the tab strip.
- Section headers lack the "Title left + See all/action right" row pattern (Body Coach, Duolingo "View N more"); our sections end dead, giving power users no path deeper and shortchanging scanability.
- Color is decorative rather than semantic: refs assign one identity color per metric/domain (Planny orange/green/yellow; Haptic purple/orange/blue; Duolingo yellow streak) and hold everything else neutral; our cards reuse the theme surface so no metric owns a color.
