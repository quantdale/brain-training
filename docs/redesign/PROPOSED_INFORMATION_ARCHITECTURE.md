# Campaign 029 — Proposed Information Architecture

**Status:** discovery proposal; no implementation authorization.
**Current tab contract:** Home, Games, Progress, Profile.
**Principle:** simplify ownership and sequencing before changing the visual language.

## IA objective

The product should make one promise legible in the first few seconds: “I can start a useful, focused training session now.” Everything else should answer one of three later questions:

1. **What should I play?** — Games and game detail.
2. **What does my recorded training show?** — Progress and its detail views.
3. **How do I manage my identity, motivation, preferences, and data?** — Profile, Rewards, and Settings.

This is a structural proposal based on the current source inventory and Refero patterns. **[Inferred]** It is not a measured usability result and must be tested before implementation.

## Proposed top-level model

Keep the four existing labeled tabs. The constitution and current route/test contracts already establish them, so a redesign should not spend risk renaming the navigation. Clarify what each tab owns instead.

| Tab | One-sentence purpose | Primary job / CTA | Above the fold | Contextual content | Must not lead with | Deeper routes |
|---|---|---|---|---|---|---|
| **Home** | Start or resume the best next training session today. | `Start workout` or `Continue workout` | Greeting/status, one Today’s Workout hero, completion x/4, one primary CTA, compact four-leg preview | One short reason for the recommendation; at-risk streak only when actionable; post-completion next step | Full reward inventory, alternate templates, charts, long history, several competing recommendation rails | Workout configuration, focus templates, reroll detail, workout history, completion summary |
| **Games** | Explore the catalog or deliberately choose a game. | `Open game` from a suggested game or a selected card | One suggested game or “Continue training,” search utility, category/favorites browse control, compact first row | One recommendation reason; mastery/recency badges; authored game identity | Three recommendation shelves, large metadata walls, economy, global streak/XP | All games, category results, favorites, Game Detail |
| **Progress** | Understand consistency and changes in recorded game performance. | `See what to train next` or open a domain | Time window, consistency headline, 2–3 summary metrics, one interpretation, domain list/one next-focus card | A compact activity chart, PB callout, workout consistency | Coins, reward claims, every chart type, causal/medical language | Activity, performance details, domain detail, game detail, full history |
| **Profile** | Manage local identity, preferences, motivation systems, and data trust. | `Settings` or `Rewards` as explicit grouped entries | Local player/level summary, grouped rows for Motivation, Rewards, Settings, Data | Streak status, pending rewards, equipped cosmetic preview | Full quest/achievement/cosmetic grids, detailed economy, raw data counts | Rewards, Settings, Data Management, detailed Motivation |

**[Inferred]** “Today” is the content model of Home, not a tab rename. The existing visible label remains Home for navigation stability; the first heading can say Today’s Workout.

## Route and ownership hierarchy

```text
Home
├─ Today’s Workout
│  ├─ active workout → game intro → gameplay → result → next game/completion
│  └─ Choose a workout → focus/length configuration → start/resume
├─ recent training (one compact entry)
└─ optional streak/recommendation context

Games
├─ Suggested next / Continue training (one rail)
├─ Search + category/favorite browse
├─ category/all-games result
└─ Game Detail → Play

Progress
├─ overview: consistency → recorded-performance movement → next consideration
├─ consistency/activity detail
├─ performance detail
├─ domain detail
├─ game detail/history
└─ full history / advanced analysis

Profile
├─ Motivation (streak, quests, achievements, milestones)
├─ Rewards (claim inbox, cosmetics, history)
├─ Settings (theme, sound, haptics)
└─ Data Management (export, backups, restore, delete)
```

This tree is a product ownership model, not a required route-file layout. A later implementation may keep existing pushed routes where persistence and QA contracts benefit from it.

## Home / Today specification

### Above-fold contract

The first viewport should show, in order:

1. A calm welcome/status line, not a metric wall.
2. `Today’s Workout` and a plain statement of length/reason, such as “4 games · about 8 minutes · balanced across your recent training.” The exact duration must use real engine metadata when available; if not, omit it.
3. Progress `0/4`, `2/4`, or `Complete`, with the current/next leg named.
4. One primary `Start workout` / `Continue workout` action.
5. A compact leg preview with Done / Next / Later states.

The player should not need to understand ratings, rerolls, coins, Spotlight, or mastery before tapping the CTA.

### Contextual and secondary sections

- Show “Why this workout?” as a short expandable explanation based on existing personalization reasons.
- Show an at-risk streak line only when a current action can help; do not make the streak a larger competing hero.
- Put `Choose a workout`, focus templates, length, and reroll under one secondary entry. The default workout remains immediate.
- After completion, replace the start hero with a completion summary and one recommended next action. `Browse games`, `Progress`, and `Rewards` remain available as secondary links.
- Combine Recent games and Workout history into one `Recent training` entry unless a specific user need proves both must remain visible.

### Home states

| State | Primary content | Secondary content |
|---|---|---|
| New local profile | Explain the product in one sentence, show the first suggested workout, `Start first workout` | Optional “Choose a focus” and Settings; no empty dashboard |
| Returning, untouched today | Today’s Workout + Start | Compact streak/progress context if meaningful |
| Workout in progress | Current leg + Continue | Resume context and safe exit; no reroll as the primary action |
| Workout complete | Completed summary + `See today’s progress` or next recommended action | Browse games, Rewards, history |
| No stored history | Same first-session path; no fake charts | Explain that progress appears after playing |
| Database unavailable | Storage Unavailable recovery | Retry and trust-preserving error details |

## Games specification

### Modes

Games should offer two clearly distinguishable modes without requiring separate tabs:

- **Suggested next / Continue training:** one or two evidence-backed choices with a plain reason.
- **Browse all games:** search, eight domain categories, favorites, and the complete 42-game catalog.

The default view should not render three independent recommendation shelves before the player sees the browse control. A deeper “Why suggested?” or filter state can retain the existing recommendation logic.

### Card and detail ownership

Each Game Card should answer: what is this, what do I do, and why might I choose it? Keep the current name/description/category/mastery/favorite information, but add a compact interaction verb or authored motif derived from the real mechanic. Do not invent clinical benefits.

Game Detail should answer: “Should I play this now?” Its first viewport owns game identity, a one-sentence mechanic, tutorial availability, mastery/record summary, and `Play`. Records, trends, recent sessions, version metadata, and detailed explanation follow the CTA.

### Games states

- **First visit:** show one suggested game and an obvious `Browse all games` action.
- **Search/filter active:** hide or compress recommendation content; show query/category context and result count.
- **No results:** state what filter/search produced no match and offer clear reset/favorites alternatives.
- **Favorite-only empty:** explain how to favorite a game and offer Browse all.
- **Game unavailable:** retain route recovery/error boundary; never silently substitute a different game.
- **Offline:** catalog, game detail, and play remain local; if an optional future capability needs network, label it rather than blocking core play.

## Progress specification

Progress is a progressive-disclosure ladder, not a deletion of analytics.

### Level 1 — overview

One viewport should answer:

1. **Consistency:** “How often have I trained?” — sessions/days or an activity summary for the selected window.
2. **Recorded movement:** “What appears to be changing in my game performance?” — describe trends as recorded performance, not ability or health change.
3. **Next consideration:** “What could I train next?” — one domain/game suggestion based on freshness, balance, or recent evidence, with a plain reason.

Recommended composition: time-window control, a concise consistency headline, 2–3 summary metrics, one chart paired with an interpretation, and a domain list. The current composite rating may remain but should be explained as a product score derived from stored game sessions, not a cognitive-health score.

### Level 2 — domain detail

Use the existing domain route to explain rating, freshness, movement, best, trend, activity, difficulty, games, and recent sessions. Lead with the answer and next action; place formulas and detailed charts behind “See details.”

### Level 3 — game detail/history

Game Detail and Progress Game should have an explicit relationship. Either merge their evidence sections or name the latter “Game history” and reserve it for detailed time-series analysis. Do not make a player navigate two screens that appear to answer the same question.

### Level 4 — advanced analysis

Activity calendars, full history, rolling averages, comparisons, PB history, co-occurrence/breadth, reaction-time views, and difficulty charts remain available for committed users. Every advanced chart needs a one-line “This shows…” interpretation and a no-causation/no-medical boundary where relevant.

### Progress states

- **New player:** explain that insights unlock from completed sessions; show the first workout CTA rather than empty axes.
- **Sparse history:** state the evidence window and avoid declaring improvement or weakness from too few sessions.
- **Loaded:** summary first, then disclosure.
- **Error:** retain last known local evidence if safe, explain refresh/retry, never show zeros as current data.
- **Offline:** local evidence remains usable; no network dependency in the core view.

## Profile, Motivation, Rewards, and Settings ownership

### Profile shell

Profile should stop being a single long stack of every engagement system. It should be a grouped control center:

1. Local player / level summary.
2. **Motivation** — streak, active quests, achievements, milestones, and protection rules.
3. **Rewards** — one pending count/link to the Rewards route and a small equipped-cosmetic preview.
4. **Settings** — theme, sound, haptics, accessibility preferences.
5. **Data** — export, backup, restore, delete.

### Ownership decisions

| Concept | Single owner | Contextual references elsewhere |
|---|---|---|
| Daily workout | Home / Today | Results shows current leg; Progress shows completion evidence |
| Focus/length configuration | Home → Choose a workout | Games may link to a focus category, but does not own workout creation |
| Reroll | Workout configuration | Home may show a compact secondary action when a plan is active |
| Rewards claim inbox | Rewards | Profile shows pending count; results shows the immediate reward only |
| Cosmetics | Rewards/Profile customization | Profile shows equipped preview; no Home store |
| Streak status | Home compact context + Motivation detail | Progress answers activity consistency without selling protection items |
| Quests | Motivation detail, surfaced through Rewards inbox when claimable | Home may show one next quest only after Today is complete |
| Achievements/milestones | Motivation detail and reward history | Results may celebrate a newly unlocked item once |
| Mastery | Game Detail and Progress domain/game detail | Games card gets a compact tier, not a second ladder explanation |
| History | Progress / Game history | Home shows one recent-training entry; results shows a few recent sessions |
| Economy/coins | Rewards and relevant confirmation surfaces | Reroll/protection shows exact cost only at the decision point |
| Daily Spotlight/challenge | One optional suggestion slot in Home or Games | Never a competing third “must play” system |
| Data portability | Profile → Data | No daily-surface exposure except trust copy when relevant |

## Navigation and back behavior

- The bottom tabs remain available at top-level routes. A pushed game/workout route owns the session and should not expose a competing tab action during active play.
- `Start workout` creates/opens the persisted instance and enters the first game intro. Back from intro returns to Today; it does not silently abandon an in-progress workout.
- During gameplay, pause/back opens a clear pause decision. `Resume` returns to the exact session; `Quit` explains what is retained/lost and returns to the workout context or Game Detail as appropriate.
- A per-game result in a workout uses one primary `Next game` / `Finish workout` action. `Play again` is secondary. Outside a workout, `Play again` or `Done` is the primary context-dependent action.
- Completed workout returns to a completion state in the workout context. `Done` returns Home; `See progress` and `Browse games` are secondary.
- Game Detail opened from Games returns to the same Games browse state with search/filter context preserved where the router permits.
- Progress detail returns to the overview with the selected time window/domain/game context preserved.
- Destructive Data Management actions remain explicit and isolated; Opal-like confirmation is a pattern for consequences, not normal navigation.

## First-time information architecture

There is no current dedicated onboarding route. If discovery research confirms a need, add a lightweight, skippable first-run sequence later:

1. **What this is:** one sentence about focused offline brain-training games and personal training records.
2. **What fits today:** optional choice of time/focus or `Skip and start the daily workout`.
3. **First playable action:** enter the existing intro/tutorial for a representative game.

Do not request an account, health history, medical goal, or notification permission before first play. Schedule/reminder and sensory settings can be offered after the first completion.

## IA rationale and guardrails

- **[Verified in source]** The four-tab model, persistent workout state, GameHost lifecycle, 42-game registry, analytics routes, rewards route, and data portability are already real seams.
- **[Inferred]** The main simplification opportunity is ownership and first-viewport hierarchy, not deleting the engine.
- **[Observed from Refero]** The Body Coach and Alive show selected-plan clarity; Brilliant shows focused current content; Dropset shows explicit session state and persistent pause; Duolingo shows one completion continuation; Train Fitness shows chart-plus-context; Todoist/Perplexity show restrained structure.
- **[Uncertain]** The exact number of cards, whether “Motivation” should be a pushed route or grouped Profile section, and whether onboarding improves activation must be decided by current-device and human testing.
