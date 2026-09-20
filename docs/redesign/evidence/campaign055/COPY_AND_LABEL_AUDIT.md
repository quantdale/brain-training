# Campaign 055 — Copy and Label Audit

Scope: visible product-facing copy touched by the refined surfaces (Home, Games,
Game Detail, Tutorial, Gameplay chrome, Results, Progress, Profile, Rewards).
Score semantics, reward amounts, difficulty labels and stored values are
unchanged; only surrounding language, formatting and duplicated statements
changed.

## Removed / replaced

| Surface | Before | After | Why |
| --- | --- | --- | --- |
| Progress | "A clear view of consistency, recorded movement and what to consider next." | "Your consistency, recent form and what to try next." | Administrative vocabulary ("recorded movement", "next consideration"). |
| Progress | "Based on your recorded sessions in this window." (definition caption under At a glance) | removed; Report titled "Consistency" | Robotic definition copy. |
| Progress | "1 session across 1 active day. Count of completed sessions and distinct UTC days with a session inside the selected window." | "1 session across 1 active day · 1.0 per active day." | Documentation sentence in the UI. |
| Progress | "RECORDED MOVEMENT" | "Your recent training" | Internal metric name. |
| Progress | "One session is not enough to describe movement yet." | "One session isn't enough to show a trend yet." | Report-speak. |
| Progress | "Movement will appear after a session is recorded." | "Your recent form will appear after your next session." | Passive system voice. |
| Progress | "NEXT CONSIDERATION" / "No additional consideration is available from this record yet." | "Suggested next" / "Nothing to suggest yet." | Administrative phrasing. |
| Progress | "No sessions recorded in 30d yet." / "No sessions in 30d" | "No sessions in this window yet." / "No sessions in this window" | Jargon window codes in prose. |
| Progress | "One recorded result in 30d" | "One result so far" | Robotic. |
| Progress | "First and latest recorded results match" | "Your first and latest sessions match" | Robotic. |
| Progress | "+4 points from first to latest" | "+4 points since your first session" | Clearer, same fact. |
| Progress | "30d average matches lifetime" | "This window's average matches your lifetime" | Clearer, same fact. |
| Progress | "Overall recorded rating" / "Canonical average of all 8 domain ratings." | "OVERALL RATING" / "Average of all 8 domain ratings." | Internal vocabulary ("canonical"). |
| Progress | "A recorded rating will appear here after you play." | "Your rating will appear here after you play." | Passive system voice. |
| Progress | "Avg performance (30d) compared with all-time." | "This window compared with all time." | Report-speak. |
| Games | "Suggested because: weak Attention domain (rating 986)" / "weak Language domain (rating 986)" | Reason line without the internal numeric rating (keeps the domain and the evidence-backed reason) | Internal rating exposed as player-facing copy. |
| Games | "Open game details ›" repeated per card | tiles are fully tappable with the same a11y hint; disclosure row removed | Repeated metadata grammar. |
| Results (in-session) | "Score 160" beside "Final score 160" (per-game duplicate) | single performance presentation; the supporting report no longer repeats the headline score | Duplicate score statement (Campaign 052). |
| Results (in-session) | "+18 XP earned!" on a 0/5 session in a success-green panel | "Reward +18 XP · +3 coins" factual row; success tone/confetti only for strong outcomes; "Progress saved" as a neutral line | False success signal (Campaign 052). |
| Results (in-session) | raw floating-point timing e.g. "2948.3300000000745 ms" | rounded whole milliseconds at the display seam (`logic-next-sequence`, `attention-visual-search`) | Debug-looking numbers. |
| Results (route) | "Result" eyebrow + "Played Today" + reward card + rating card stacking | artifact (band + ring + game + date), quiet reward row, hairline rating/recent Reports | Report-sheet feel; duplicate completion statements. |
| Results (route) | "No rating movement recorded for this session." | "No rating movement recorded for this session / Ratings update as you play more sessions" | Same fact, less final. |
| Home | "FOCUS MODULE" + "Today's Workout" + dashboard stack | "TODAY'S FOCUS" over the world stage + one workout artifact + "Today's plan" Report | Dashboard vocabulary and competing focal points. |
| Profile | "Local player" / "Indigo accent" | player name (display_name or "Player") / equipped cosmetic chips linking to Rewards | Placeholder identity language. |
| Profile | "Your local training record, motivation and settings." | "Your training record is saved on this device." | Administrative framing. |
| Rewards | "3/12 cosmetics collected (25%)" as hero | quiet "n/12" caption + per-slot rails; claim band is the hero when rewards are ready | Collection percentage treated as product headline. |
| Rewards | emoji cosmetic previews as tiles | code-native collectible objects with Owned / Equipped / Locked states | Provisional reward art. |

## Preserved (protected)

- Workout completion copy: "You finished all N games today. Nice work!" (length-aware).
- Persistence failure copy: "Your session could not be saved. {detail}".
- Workout advance error: "Workout progress could not be saved".
- Reward/XP/coin amounts, prices, unlock conditions, difficulty labels, score semantics.
- All empty/error states keep their testIDs and truthful meaning.
- No IQ, brain-age, intelligence-improvement, medical or unsupported transfer claims were introduced; none existed to remove.

---

# Resumption addendum (2026-09-20) — Progress drill-down copy

Scope: the shared `explainMetric` captions rendered by the Progress drill-downs
(`progress-detail`, `progress-activity`, `progress-game`, `progress-domain`) and
the two shared captions still used on the refined main Progress surface. Copy
only: no figure, calculation, rating, window, record or analytical semantics
changed, and no unsupported claim was introduced.

## Rewritten (robotic / internal / bureaucratic / excessively analytical)

| Key | Before | After | Why |
| --- | --- | --- | --- |
| `trend-summary` | "First and last values of the series in this view, plus how steady it is around its own average. Derived only from the points shown." | "Your first and last values in this view, and how steady the series is around its own average." | Drops the analytical bookkeeping sentence; the chart already shows the points. |
| `accuracy-trend` | "Accuracy values across sessions over time, using whatever each game stored; games without a stored accuracy contribute nothing." | "Accuracy across your sessions over time, using the accuracy each game records. Games that do not record accuracy are left out." | "stored / contribute nothing" is database language. |
| `reaction-trend` | "Stored response times across sessions over time; lower is faster. Games without a stored reaction time contribute nothing." | "Response times across your sessions over time; lower is faster. Games that do not record a response time are left out." | Same internal phrasing. |
| `difficulty-progression` | "Challenge ratings you attempted over time, shown neutrally: a change in challenge is not a better or worse result." | "The challenge levels you played over time. A change in challenge is not a better or worse result — it is just a different one." | Keeps the honesty caveat (pinned by `analytics-v2-references.test.ts`) in player language. |
| `personal-best-history` | "Every moment a personal best was raised, derived from stored results; ties keep the earliest holder." | "Every time you set a new personal best, from your recorded results. If two sessions tie, the earlier one keeps the mark." | "raised / derived / ties keep the earliest holder" is record-keeping jargon. |
| `rolling-average` | "Mean of the last N sessions at each point, so single-session spikes do not dominate the shape." | "This keeps one unusually strong or weak session from dominating the shape." | The screen already prints "Mean of the last 5 sessions at each point." — the caption repeated it verbatim. |
| `activity-runs` | "Consecutive active days inside this view. Window-local frequency, not your engagement streak." | "Consecutive active days in this view — a count of back-to-back days, not your engagement streak." | "Window-local frequency" is statistical jargon. |
| `weekday-pattern` | "Which weekdays your sessions landed on inside this view — a record of habit, not advice." | "Which weekdays your sessions landed on in this view — a record of habit, not advice." | Minor: "inside" → "in". |
| `recorded-movement` | "For a bounded window, the selected-window average is compared with your lifetime average; all-time compares the first and latest recorded results." | "Compares this window's average with your lifetime average; all time compares your first and latest results." | Removes "bounded window / selected-window / recorded" bureaucracy. |

## Explicitly left unchanged (outside scope or not problematic)

- `composite`, `domain-rating`, `avg-normalized`, `recent-form`,
  `best-normalized`, `score`, `accuracy`, `reaction`, `difficulty`, `duration`,
  `balance`, `activity-calendar`, `recency`, `recent-vs-lifetime`, `volume`,
  `category-comparison`, `workout-completion`, `cooccurrence`, `diversity`,
  `progress-consistency`: not rendered by the drill-down screens (or, for
  `volume` / `workout-completion` / `category-comparison`, pinned by existing
  analytics reference tests whose wording is already neutral and truthful).
- `cooccurrence` keeps its explicit "does not show cause and effect" caution;
  `difficulty-progression` keeps its "not a better or worse result" caution.
- No number, window label, rating, streak, record or calculation was altered.

## Unsupported-claim check

The rewritten copy contains no IQ, brain-age, intelligence, medical or
transfer-effect claim. The Progress surfaces remain records of training
activity with the same evidence links as before.
