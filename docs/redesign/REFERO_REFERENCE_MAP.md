# Campaign 029 — Refero and External Reference Map

**Research date:** 2026-09-16
**Product head informing the research:** `13c0e5d85a270edb8e41a676437c6bdf3c81f441`
**Purpose:** traceable product-structure and interaction references. This is a reference map, not a mood board and not permission to copy another product.

## Method

**[Verified]** Refero MCP was available and used for live research. Searches covered five style questions, six screen patterns, and adjacent learning/training flows. Full style records were retrieved for four useful references; concrete screen records were retrieved for task entry, gameplay, results, progress, onboarding, course discovery, and linear lesson patterns. Flow records were retrieved for onboarding, scheduling, interval sessions, first lessons, and course lessons.

The research sequence followed the Refero guidance: establish broad product language with styles first, then use screens for concrete hierarchy, then use flows for sequence and interruption logic. A reference was selected only when it clarified a Brain Training problem. Color values, copy, mascots, illustrations, layouts, and brand signatures are not to be transplanted.

**[Uncertain]** Refero is a reference corpus, not a usability study of Brain Training. A reference demonstrates a possible pattern; it does not prove that the pattern will work for this product or audience.

## Style references

### Headspace — warm modern playfulness

- **Refero style ID:** `c73224da-e583-4833-bf39-3f414c317474`
- **Source URL:** [headspace.com](https://headspace.com)
- **[Observed from Refero]** Light, warm presentation; “Warm Modern Playfulness” north star; sky-blue CTA/active signal (`#0061EF` in the record), pale warm canvas, deep plum contrast, rounded type, generous spacing, contained illustrations/screenshots, subtle card shadow, 16/24/32-style radii. The record cautions against harsh shadows, sharp corners, dark whole sections, and full-bleed imagery.
- **Brain Training problem addressed:** the current system has warmth and expressive domain colors but can read as many simultaneous signals. Headspace is evidence that adult-friendly playfulness can come from tone, spacing, and contained art rather than constant visual intensity.
- **Apply:** warm restraint, clear single CTA, friendly voice, contained game art, generous task framing.
- **Do not copy:** Headspace’s wellness/meditation visual codes, blue palette, illustrations, or brand language.

### Todoist — warm, minimal productivity

- **Refero style ID:** `d9a3223e-d0d5-436b-aa09-0facd1805a1e`
- **Source URL:** [todoist.com](https://todoist.com)
- **[Observed from Refero]** “Like a neatly organized desk bathed in natural light”; paper-white canvas, faded charcoal, one action red (`#E34432` in the record), light peach support, Graphik/Inter-like utility typography, compact 10–15 px geometry, subtle shadow, centered max-width, contained sections. The record explicitly advises a single accent and avoiding heavy shadows or multiple chromatic colors.
- **Brain Training problem addressed:** Home, Games, and Profile expose several colored families and many cards. Todoist supports an evidence-based hypothesis that the product can feel premium and warm by giving the action color a job and letting neutral space do more work.
- **Apply:** one action accent, clear page rhythm, contained sections, short labels, quiet secondary status.
- **Do not copy:** red branding, task-list metaphors, typography, or exact component geometry.

### Perplexity AI — digital parchment / subtle authority

- **Refero style ID:** `5c7acdfb-996b-4c6f-b361-264a3f580f7d`
- **Source URL:** [perplexity.ai](https://www.perplexity.ai)
- **[Observed from Refero]** Cream canvas, charcoal text, teal reserved for active/selected/high-priority states, 8 px base geometry, 16 px cards, pill controls, compact density, flat or faint elevation, centered content with a persistent utility rail in the web composition.
- **Brain Training problem addressed:** Progress has useful data but risks becoming an analytics console. Perplexity is relevant as a restraint reference: strong neutral structure and a single semantic highlight can make dense information feel authoritative without decoration.
- **Apply:** neutral-first Progress, one highlighted recommendation, compact but legible control groups, strong section titles.
- **Do not copy:** web utility rail, teal palette, research-answer metaphor, or compact density that would compromise mobile touch comfort.

### Duolingo — high-clarity playful progression

- **Refero style ID:** `fad6cd55-121c-4050-bfa9-f7cccbf81d78`
- **Source URL:** [duolingo.com](https://www.duolingo.com)
- **[Observed from Refero]** Bright playful treatment, a green primary, white surfaces, rounded/tactile controls, strong completion feedback, and a warning against clutter, arbitrary color, sharp corners, or indiscriminate mascot copying.
- **Brain Training problem addressed:** the current product already has levels, streaks, rewards, and celebratory motion, but their hierarchy is distributed. Duolingo is useful as a clarity reference: a player should know the next step and understand completion, not as a model for adding more game-like systems.
- **Apply:** unmistakable next action, satisfying but bounded completion, one visible progress model per task.
- **Do not copy:** mascot, league/social structure, green palette, or cartoon density.

### Style-search context

**[Observed]** The first broad style search also surfaced Peloton, Quizlet, Claude, Preply, Readwise, Playdate, and PostHog. They were treated as search context rather than primary design evidence because the four references above gave clearer, non-overlapping answers for warmth, restraint, authority, and completion clarity. This is a deliberate sample, not a claim that the other products are unimportant.

## Concrete screen references

### Today / workout entry

#### The Body Coach — selected plan and one Join action

- **Screen ID:** `0e2dc070-e8df-43a3-b93d-fc4a88f6a628`
- **URL:** [Refero screen](https://refero.design/screens/0e2dc070-e8df-43a3-b93d-fc4a88f6a628)
- **[Observed from Refero]** A week of workout cards communicates check/lock state and duration while one prominent JOIN action starts the selected plan; fixed navigation remains present.
- **Brain Training application:** Today’s Workout should make the four-leg plan legible but visually subordinate to one Start/Continue action. The player should not need to configure the plan to begin.

#### Alive — workout detail with rationale and optional controls

- **Screen ID:** `378c8938-4cf7-4fe4-9c16-97e32132aab7`
- **URL:** [Refero screen](https://refero.design/screens/378c8938-4cf7-4fe4-9c16-97e32132aab7)
- **[Observed from Refero]** Workout detail shows week/day, duration/type/basis, a prominent Start Workout, and optional favorite/settings controls.
- **Brain Training application:** Move focus/length/reroll choices into a deliberate workout-detail/configuration state. Keep “why this workout” available as reassurance, not as a wall of algorithmic explanation.

### Gameplay entry and active session

#### Opal — explicit commitment modal

- **Screen ID:** `1cdef349-9ae5-4619-93a9-ce9d83a4ee0f`
- **URL:** [Refero screen](https://refero.design/screens/1cdef349-9ae5-4619-93a9-ce9d83a4ee0f)
- **[Observed from Refero]** A centered confirmation modal uses a clear warning and explicit Yes-I’m-ready / No-thanks decisions for a consequential action.
- **Brain Training application:** Use this pattern selectively for quit/abandon or irreversible actions, not for every game start. Normal starts should be immediate after a concise intro; quitting should make consequences explicit.

#### Dropset — interval details and get-ready state

- **Details screen ID:** `44c1349d-32ba-4970-8793-6a9baf5142a4`; [screen](https://refero.design/screens/44c1349d-32ba-4970-8793-6a9baf5142a4)
- **Get-ready screen ID:** `5883e10d-ca07-4361-9eb8-b3111cc6db17`; [screen](https://refero.design/screens/5883e10d-ca07-4361-9eb8-b3111cc6db17)
- **Work screen ID:** `b0b455a1-e796-469c-af09-2e270c4fd3ce`; [screen](https://refero.design/screens/b0b455a1-e796-469c-af09-2e270c4fd3ce)
- **[Observed from Refero]** Session details expose only essential parameters; get-ready uses a large countdown and round position; active work uses a dominant timer with persistent bottom pause/cancel controls.
- **Brain Training application:** Each game should give the mechanic the visual field. Keep the shared GameHost HUD to one progress/timing signal and one pause affordance. A short, optional get-ready beat can make transitions feel intentional without adding a tutorial card inside play.

### Results and completion

#### Duolingo — completion with reward and one Continue

- **Screen ID:** `d21fc154-626f-4673-a84b-e73d90db220d`
- **URL:** [Refero screen](https://refero.design/screens/d21fc154-626f-4673-a84b-e73d90db220d)
- **[Observed from Refero]** Completion foregrounds an achievement/illustration, compact XP/time/accuracy cards, and one full-width CONTINUE action.
- **Brain Training application:** Results should sequence reward → understandable evidence → one next action. In a workout, Continue means next game or completion; outside a workout it can mean Play again or return to Games. This directly addresses the current global result route’s many simultaneous exit options.

### Progress and history

#### Train Fitness — chart with source context

- **Screen ID:** `0992d70f-88b5-487b-8206-0c53dc064e02`
- **URL:** [Refero screen](https://refero.design/screens/0992d70f-88b5-487b-8206-0c53dc064e02)
- **[Observed from Refero]** A one-column scroll pairs a workout summary chart with the source/template card and volume progression, giving context to the chart rather than showing a naked metric wall.
- **Brain Training application:** Progress overview should begin with an interpretation and a compact chart/context pair. Deeper category/game charts remain available after the player knows what question the chart answers.

### Onboarding and intent selection

#### BoldVoice — goal selection with visible progress

- **Screen ID:** `841f3ea3-8aee-487b-8d19-ee4c34682ea1`
- **URL:** [Refero screen](https://refero.design/screens/841f3ea3-8aee-487b-8d19-ee4c34682ea1)
- **[Observed from Refero]** A coach-led bottom sheet frames “Your Goals,” shows 0/3 progress, and uses numbered checkbox cards.
- **Brain Training application:** If first-run research confirms onboarding is needed, ask for one low-risk intent at a time and show progress. Do not require account creation or medical self-assessment; preserve offline-first startup.

#### Imprint — goal and schedule choices

- **Goal screen ID:** `9c195cc3-94cb-428f-9df2-07a3a4ed6255`; [screen](https://refero.design/screens/9c195cc3-94cb-428f-9df2-07a3a4ed6255)
- **Schedule screen ID:** `e6b7bb25-162b-4a44-9bc4-cbda280b1fdc`; [screen](https://refero.design/screens/e6b7bb25-162b-4a44-9bc4-cbda280b1fdc)
- **[Observed from Refero]** Goal selection offers a small set of streak choices with one CTA; schedule is a separate optional step with Schedule and Skip.
- **Brain Training application:** Keep scheduling optional and separate from first play. A skipped reminder must not block training or imply a health obligation.

### Discovery and linear lesson structure

#### Brilliant — course catalog and focused lesson

- **Catalog screen ID:** `34fdc62a-f051-49b1-8fbc-99c51c4e1e11`; [screen](https://refero.design/screens/34fdc62a-f051-49b1-8fbc-99c51c4e1e11)
- **Lesson screen ID:** `4b8fe620-c889-41af-816b-14ce8fd615c3`; [screen](https://refero.design/screens/4b8fe620-c889-41af-816b-14ce8fd615c3)
- **[Observed from Refero]** Catalog uses horizontal category chips and simple course cards; the lesson keeps close/progress/mode chrome small and makes the current text/video/problem the dominant content with Continue.
- **Brain Training application:** Games needs browse controls plus authored cards, but not a dense “everything at once” catalog. Gameplay/tutorial should keep current instruction/problem content dominant and use a single forward action when the interaction is not yet live.

## Flow references

### Brilliant — personalized onboarding and subscription

- **Flow ID:** `4316`
- **URL:** [Refero flow](https://refero.design/flows/4316)
- **[Observed from Refero]** The flow moves from learning goal to subgoal to topic, shows visible progress, offers recommendations and an optional upsell, then enters a first lesson.
- **Use:** validates the sequence principle “intent → recommendation → first action.” For Brain Training the commercial/upsell step is not adopted, and intent collection must stay optional/offline.

### Imprint — commit and schedule reminder

- **Flow ID:** `5640`
- **URL:** [Refero flow](https://refero.design/flows/5640)
- **[Observed from Refero]** Choose a streak target, set a time/toggle, Schedule or Skip, then handle the system permission.
- **Use:** separates commitment from permission and keeps Skip available. Relevant to future reminders, not a reason to add an onboarding gate now.

### Dropset — interval session

- **Flow ID:** `6521`
- **URL:** [Refero flow](https://refero.design/flows/6521)
- **[Observed from Refero]** Details → get ready → work/rest rounds → summary/up-next with persistent pause/stop behavior.
- **Use:** supports a state model for game sessions: explain/prepare, act, interrupt/resume, finish/advance. Brain Training already has the lifecycle seam; the redesign should make it more legible.

### Imprint — first lesson walkthrough

- **Flow ID:** `5636`
- **URL:** [Refero flow](https://refero.design/flows/5636)
- **[Observed from Refero]** Intro → course selection → content → answer → immediate feedback → XP/streak/badge → return/daily challenge.
- **Use:** supports immediate feedback and bounded celebration, but Brain Training should avoid layering a new badge/challenge step after every game. The result should return to the workout flow quickly.

### Brilliant — course lesson, read/answer/complete

- **Flow ID:** `4333`
- **URL:** [Refero flow](https://refero.design/flows/4333)
- **[Observed from Refero]** Category → course map → linear content/video/inline questions/Why → completion/XP → parent context.
- **Use:** supports progressive disclosure: give the player the current problem first, then let them inspect the larger map/history. This maps to Game Detail versus Gameplay and Progress overview versus detail.

## Reference-to-decision matrix

| Brain Training question | Refero evidence | Decision for the plan |
|---|---|---|
| How can Today feel premium without more cards? | Headspace, Todoist, The Body Coach | Neutral space + one selected plan + one primary action; plan status remains visible but secondary |
| How should the app express adult playfulness? | Headspace + Duolingo, with restraint warnings | Use warmth, copy, motion, and authored game motifs; do not intensify every surface with neon or mascot-like decoration |
| How should dense Progress become understandable? | Perplexity + Train Fitness | Summary-first, one semantic highlight, chart paired with interpretation/source context |
| How should a session keep attention? | Brilliant lesson + Dropset get-ready/work | Current task dominates; one forward path; persistent pause; optional short preparation beat |
| How should results get players moving? | Duolingo completion + Imprint lesson flow | Reward/evidence/next action sequence; do not make analytics and rewards equal destinations |
| How should onboarding be handled if needed? | BoldVoice + Imprint + Brilliant flow | Three small optional steps at most; visible progress; skip; first playable task within the same session |
| How should destructive quit/data actions work? | Opal confirmation pattern | Explicit consequence and separate safe secondary action; do not use confirmation friction for normal Start |

## Official external product/evidence sources

These are structure and claim-boundary references, not endorsements or feature-copy sources. All claims below are marked **[Observed from official source]** and were checked on 2026-09-16.

| Source | Current claim or structural fact used | Product implication |
|---|---|---|
| [Elevate official site](https://themindcompany.com/apps/elevate) | **[Observed]** Presents personalized brain training, 40+ games across reading/writing/speaking/memory/math, daily puzzles, and strengths language | Workout framing and a broad catalog are familiar category patterns; Brain Training needs a sharper, ownable reason for its four-game offline workout |
| [Lumosity brain training](https://www.lumosity.com/en/brain-training/) and [sign-up flow](https://www.lumosity.com/sign_up/) | **[Observed]** Presents 40+ games, categories, short daily sessions, adaptive difficulty, a fit test, three quick games/day, and personalized insights | A catalog alone is not differentiation; avoid mirroring broad cognitive-benefit promises and make the training evidence precise |
| [Lumosity game replacement help](https://help.lumosity.com/hc/en-us/articles/12162763497495-Can-I-replace-a-game-in-my-workout) and [selection help](https://help.lumosity.com/hc/en-us/articles/12162291968023-How-are-games-chosen-in-the-workouts) | **[Observed]** Current help pages describe replacing/blocking games and choosing based on preferences, length, recency, and frequency | Control and personalization can be valuable, but Brain Training should keep rerolls secondary so choice does not delay the daily action |
| [Brilliant FAQ](https://brilliant.org/faq/) and [learning paths](https://brilliant.org/help/features/what-are-learning-paths/) | **[Observed]** Interactive problems, immediate feedback, learning paths, streaks/leagues/progress; official FAQ says offline is unavailable | Reinforces focused interaction and progression context; Brain Training’s offline-first capability is a differentiator and should remain explicit |
| [Quizlet Learn](https://quizlet.com/features/learn) and [official product page](https://quizlet.com/yr) | **[Observed]** Adaptive practice, varied question formats, focused sessions, and personalized practice tests | Supports short, focused sessions and choice of format; do not copy flashcard mechanics into unrelated games |
| [Promova](https://promova.com/) | **[Observed]** Describes plans based on goals/level/time, feedback/what next, first lesson, role-play, and bite-sized daily tasks | Supports plain-language recommendation rationale and a short next action, not another analytics panel |
| [Duolingo streak experiment](https://blog.duolingo.com/improving-the-streak/) | **[Observed]** Duolingo reports an internal A/B experiment in which separating streak requirements from a daily goal improved stated Day-14 retention/DAU metrics | Treat as a historical company-reported hypothesis about streak framing, not a guaranteed causal result for Brain Training; test our own completion and retention outcomes |
| [FTC Lumosity settlement](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program) | **[Observed]** FTC reported a settlement over allegedly unfounded claims about improving work/school or reducing/delaying cognitive impairment, with a requirement for competent/reliable evidence for broad claims | Brain Training copy must describe recorded game performance, training consistency, and personal bests; it must not promise intelligence, medical, neurological, or real-world cognitive outcomes |

## Constraints on using these references

1. **[Inferred]** The strongest synthesis is not “make Brain Training look like X.” It is: keep the existing differentiated game/workout engine; use Todoist/Perplexity-like restraint for structure; use Headspace-like warmth for adult character; use Duolingo/Brilliant-like clarity for next action and feedback; and keep Brain Training’s own domain/game motifs.
2. **[Uncertain]** No reference establishes the correct number of cards, colors, or onboarding steps for this app. Those are implementation hypotheses that require current-device inspection and human usability tests.
3. **[Verified]** No external source authorizes unsupported health or cognitive-benefit claims. The master plan treats the FTC evidence boundary as a product-language constraint, not a marketing opportunity.
