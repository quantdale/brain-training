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

(one row per registered game: clean / fixed-<sha> / finding-classification)

## Phase 3 — Design & gamification evidence

(pending)

## Phase 4 — Production readiness evidence

(pending)
