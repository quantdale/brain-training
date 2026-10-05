# Waves 6–13 — game-domain packet registry (tasks 6.1–13.5)

Prepared by the orchestrator before packet launch. Each packet owns ONLY its
domain directories under `apps/mobile/src/games/<id>/`; the shared stage panel,
instrument strip and result artifact already land from wave 3 (`theme.stage`,
`SessionHeader onStage`, staged result artifact), so every game inherits the
frame without shared-file edits.

## Inheritance (already in place — games get this for free)

- Session chrome: charcoal stage panel + stage-presented instrument strip
  (light scheme included) + staged result artifact (lock §1).
- Kit: bordered-neutral secondary buttons; red CTA reserved to one action.
- The lock's board-media rule (§4): board identity art = the genuine board.

## Packet briefs (per domain)

Common requirements for every packet (the "canary discipline" proven on
Memory + Equation Builder in wave 3):

1. Round/score chips supplied to the GameHost `header` slot read in
   `stageInk` (they ride the charcoal strip).
2. Board interactive elements are BOARD TOKENS, not red primary buttons —
   the red CTA role belongs to at most one Submit/Next control (lock §5).
3. State flashes (revealed/lit/selected) speak the game's DOMAIN hue or a
   neutral — never the CTA red (red = action only; a red flash reads as
   error).
4. Correct/incorrect/timeout feedback: text + icon/shape on successSoft/
   errorSoft grounds (never color alone), announced via the live-region seam.
5. Every existing testID preserved; no scoring/generator/persistence edits;
   `npx tsc --noEmit` + the domain's jest suites green.
6. Device verification (orchestrator): active board, feedback, pause, result
   at default + 2× + compact, light + dark, per game — captured and manifest.

| Wave | Domain | Games (ids) |
| --- | --- | --- |
| 6 | Attention | attention-odd-one-out, attention-sustained-vigilance, attention-symbol-tracker, attention-target-count, attention-visual-search |
| 7 | Flexibility | flexibility-card-sort, flexibility-color-stroop, flexibility-cue-shift, flexibility-rule-flip, flexibility-task-switch |
| 8 | Language | language-context-fit, language-sentence-builder, language-word-chain, language-word-match, language-word-scramble |
| 9 | Logic | logic-code-cracker, logic-deduction-table, logic-next-sequence, logic-order-path, logic-rule-grid |
| 10 | Math | math-equation-builder (canary done in wave 3), math-fast-math, math-missing-operator, math-number-line-estimation, math-value-ordering |
| 11 | Memory | memory (canary done in wave 3), memory-grid-recall, memory-pair-recall, memory-pattern-tap-back, memory-prospective-cue, memory-running-order, memory-sequence-memory |
| 12 | Spatial | spatial-coordinate-turn, spatial-fold-match, spatial-grid-nav, spatial-mental-rotation, spatial-transform-match |
| 13 | Speed | speed-color-match, speed-order-sweep, speed-quick-compare, speed-reaction-time, speed-tap-rush |

Concurrency: 7 coders max; waves 6–13 run as ~2–3 packet flights (5+3 or
similar). Shared-file needs (e.g. a game requires a new shared primitive) are
reported to the orchestrator and land centrally.
