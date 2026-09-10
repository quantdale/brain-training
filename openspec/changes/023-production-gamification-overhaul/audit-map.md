# Audit Map — Campaign 023

Working record for research findings, per-game audit dispositions, and
verification evidence. This file is the campaign's living evidence log.

## Phase 1 — Refero MCP

| Check | Evidence | Status |
|---|---|---|
| Local MCP config, no token tracked | `.kimi-code/local.toml` + `git check-ignore` | PASS |
| User opencode config MCP entry | `~/.config/opencode/opencode.jsonc` (outside repo) | PASS |
| Live `initialize` | `refero_server 0.2.0`, protocol 2025-06-18 | PASS |
| Live `tools/list` | screens/similar/screen-image/styles/get-style/flows | PASS |
| `refero-design` skill | server offers `npx skills add ...` — requires explicit owner approval; NOT installed | NOT VALIDATED (by policy) |
| Benchmark research queries | see Research Log below | PENDING |
| Reference lock | see below | PENDING |

### Research Log

Queries executed 2026-09-11 via `scripts/qa/refero.mjs` (raw output cached in
local `qa-artifacts/refero-research/`, gitignored):

- iOS screens: "duolingo streak daily goal progress", "duolingo lesson
  complete celebration reward screen", "headspace daily progress meditation
  streak", "brilliant lesson complete reward", "mobile game daily quest reward
  claim modal", "onboarding level up badge unlock celebration".
- Styles: "playful gamified learning app vibrant" + full `refero_get_style`
  for the Duolingo system reference.

Observed benchmark patterns:

- **Duolingo completion:** centered stack, celebratory characters/confetti,
  bold "Lesson complete!" headline, small reward pill with icon + amount,
  full-width prominent CONTINUE button; "High scorer!" variant shows XP earned.
- **Duolingo/Foodvisor streak:** large orange flame, centered "N day streak!"
  headline, weekly tracker row of active/inactive days, motivational copy,
  dark full-width Continue button.
- **Brilliant completion:** pastel tinted panel + circular checkmark icon +
  supportive line + bold single CTA; achievement screen adds golden celebration
  and an unlocked-reward note.
- **Quest/reward screens:** reward coin card, segmented progress bar, life/heart
  indicators, gem balance chip, dark playful theme with saturated accents.
- **Level-up screens:** confetti, central milestone card, "N lessons to earn
  your next badge" next-unlock copy, share/continue actions.
- **Duolingo style tokens:** saturated primary fill with white bold label,
  outlined secondary, soft tinted accent blocks, 12px+ radii, charcoal text,
  bold rounded display weights, clear press/locked states.

### Reference Lock

- **Primary direction:** keep the app's existing indigo brand identity and
  extend it into a vibrant-arcade language: saturated filled primary CTAs,
  soft tinted semantic blocks, generous radii, bold weight hierarchy, playful
  emoji iconography (no new asset pipeline), short bounded motion (90-260 ms).
- **Traits to preserve:** indigo brand accent; neutral surfaces; token-only
  styling (`theme/tokens.ts`); accessibility contracts (labels, touch targets,
  reduced motion).
- **Borrowed details:** (1) Duolingo's filled/outlined/tinted button hierarchy
  + 12px+ radius; (2) Brilliant/Headspace completion panel with circular
  success mark and next-unlock copy; (3) streak flame + weekly day-dot tracker
  from Duolingo/Foodvisor; (4) reward coin chip + segmented progress bar from
  quest screens; (5) confetti-style bounded celebration on milestone surfaces.
- **Explicit rejects:** cloning Duolingo green/owl/wordmark or any benchmark
  mascot; decorative headline word swaps; dark neon theme takeover; gradients
  requiring new dependencies; unbounded/blocking celebration animations.
- **Token commitments:** new `streak` (#F97316 family) + `xp`/semantic soft
  fills per scheme; `Motion` durations; `Elevation` shadow tokens; reuse
  `Radii.large` (20) / `Radii.pill`; XP progress uses accent, streak uses
  streak tone, coins use warning tone, success uses success tone.

## Phase 2 — Per-game audit dispositions

All 42 registered games were audited by seven parallel packets in commit
`e351804` (168 files, +3348/-134, +109 tests). Every game carries a
disposition; the shared defect classes below were repaired with
failing-before/passing-after regression tests.

| Defect class | Games affected | Resolution |
|---|---|---|
| Stale authoritative XP/currency/deltas/lastError across restart | all 42 (7 fixes in the audit wave + sweep) | every `start-session` clears the session-scoped authoritative outcome |
| Adaptive record persisted the 0.5 baseline challenge rating (006r) | all 42 | screens persist `{ ...state.profile, challengeRating }`; catalog source contract + behavioral screen tests |
| Per-round ref/accumulator leaks across restart (study/round/response windows) | attention-symbol-tracker, attention-target-count, memory-grid-recall, memory-pair-recall, memory-prospective-cue | session-id-keyed refs reset on start |
| Scoring correctness (divide-by-zero, double-division, force-win max, deadline races) | attention-target-count, logic-order-path, speed-color-match, speed-reaction-time, math-missing-operator | guarded/ corrected formulas + late-input rejection |
| Generator/replay defects | language-sentence-builder (duplicates, dead adaptive escalation, tap double-count), attention-target-count (round-1 reproducibility), spatial-transform-match (restart determinism), spatial-grid-nav (dead adaptive escalation), speed-color-match (frozen adaptive ratio) | generators/reducers repaired |
| Provenance (wall-clock stamps, final adaptive params, guess history, Infinity) | logic-order-path, logic-deduction-table, logic-code-cracker, speed-color-match | failure-aware fixes + tests |

Deferred non-blocking findings (recorded in `.agent/KNOWN_ISSUES.md`):
late-tap SFX mismatch in three games, vigilance digit visibility after
resolution, `spatial-coordinate-turn` adaptive escalation gap, missing
vigilance screen test, stale word-scramble tutorial copy, dead
`show-stimulus` actions in color-stroop.

## Phase 3 — Design & gamification evidence

- Commits: `94b5a88` (design system + gamified surfaces + 42-screen reward
  wiring), `81e6841` (keyboard-open reachability).
- New primitives: `FeedbackCard`, `StreakCard`, `LevelCard`, tone-aware
  `ProgressTrack`, tactile `GameButton`; new tests in
  `components/shell/__tests__/gamification-ui.test.tsx` and
  `components/game-host/__tests__/results-reward.test.tsx`.
- Progression semantics untouched: progression/rewards/streaks/quests/
  achievements suites pass unmodified; the only added catalog contracts are
  source-level tripwires + behavioral screen assertions.

## Phase 4 — Production readiness evidence

- **Production build:** `:app:assembleRelease` BUILD SUCCESSFUL
  (retry after a transient Windows packaging lock); APK 109,309,873 B,
  SHA-256 `AE1B9F09B9BDB5E81AE667256E81B7CC32DBF1D8906EBDDE0AA73738F17908F1`.
- **Standalone start (release, no Metro):** cold start 1.27 s, Home
  hierarchy contains `home-title`, `home-workout-cta`, `home-streak-card`,
  `home-stat-streak`, `home-level-card`, `home-stat-level`.
- **Offline:** `validate-offline` CLEAN (935 files); release cold start with
  wifi/data disabled renders Home; offline deep-link to a game renders the
  intro card + Start control.
- **Validators:** repo-state, task-ownership, registry `--check`, provenance,
  workflows, secrets, offline — all PASS.
- **Runtime certification:** canary run 8/8 PASS; full `--mode certify` run
  COMPLETED 42/42 games PASS (0 failed/missing/duplicate), with the aggregate
  `certified` flag false solely due to one missing pause probe on
  `attention-sustained-vigilance` (never-idle ticker vs uiautomator dump race;
  direct back-contract pause/resume probe PASS on the same build). Full
  evidence and honest classification in `.agent/VALIDATION.md`.
- **Limitations:** headless `screencap` returns a constant blank frame
  (framebuffer capture unavailable with `-no-window`); runtime `wm size`
  profile switching wedged the headless renderer (responsive evidence is
  static/unit + default-profile device evidence only). Manual TalkBack,
  physical device, iOS runtime, and store signing remain NOT VALIDATED /
  EXTERNALLY BLOCKED as in Campaign 022.
