# Campaign 055 (resumed) — Result Duplication Closure

Display-only closure of the duplicated score presentation left open by the first
Campaign 055 session. No scoring, payload, persistence, rating, XP, reward,
mechanic, timer, generator, difficulty or session-identity change was made.

## Method

1. A registry-derived inventory enumerated all **42/42** registered games from
   `apps/mobile/src/registry/registry.generated.ts` and parsed each game's
   `screen.tsx` `<GameResults>` children.
2. For every game the inventory recorded the game-owned score presentations
   (the large `Final score` numeral block and/or the `Score` `StatRow`), the
   other metric rows, and whether a duplicate score statement is actually
   visible.
3. The shared chrome was re-checked first: `GameResults`
   (`apps/mobile/src/components/game-host/results.tsx`) renders the game world,
   the band/title headline and the badge — it does **not** render a numeric
   score. Every numeric score on an in-session result is game-owned.
   Therefore the visible duplicate is between two game-owned presentations
   (the focal `Final score` numeral and the `Score` fact row), not between the
   shared chrome and a game row.
4. Where both presentations showed the exact same `state.stats.score`, the
   lower-value `Score` `StatRow` was removed and the focal numeral kept. This
   matches the Campaign 055 canary fix already landed for
   `attention-target-count`.
5. Where the game shows the score exactly once, nothing was removed. Unique
   metrics (accuracy, rounds, streak, time, mistakes, level, mechanic-specific
   evidence) were preserved in every game.

## 42/42 inventory and closure

| Game | Game-owned score rows (before) | Duplicate visible? | Action | Unique metrics preserved |
| --- | --- | --- | --- | --- |
| `attention-odd-one-out` | `Score` StatRow | No | None (single presentation) | Accuracy, First-try rate, Rounds passed, Best streak, Timeouts, XP |
| `attention-sustained-vigilance` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Go hits, Stop numbers held, Commissions, Mean reaction, Best streak, XP |
| `attention-symbol-tracker` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best recall, Best streak, XP |
| `attention-target-count` | `Final score` numeral | No | None (single presentation) | Accuracy, Rounds correct, Best streak, XP |
| `attention-visual-search` | `Score` StatRow | No | None (single presentation) | Accuracy, Rounds passed, Best streak, Avg response, Fastest response, XP |
| `flexibility-card-sort` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, After rule switches, Discovery rounds, Best streak, Mistakes, XP |
| `flexibility-color-stroop` | `Score` StatRow | No | None (single presentation) | Accuracy, Correct, Best streak, Post-flip correct, XP |
| `flexibility-cue-shift` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, After rule switches, Best streak, Mistakes, XP |
| `flexibility-rule-flip` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, After rule flips, Same-rule trials, Uncued first picks, Best streak, Mistakes, XP |
| `flexibility-task-switch` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, Switch accuracy, Switch cost, Best streak, Mistakes, XP |
| `language-context-fit` | `Final score` numeral | No | None (single presentation) | Accuracy, Rounds correct, Best streak, Avg answer time, XP |
| `language-sentence-builder` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, Longest sentence, XP |
| `language-word-chain` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds correct, Best streak, Avg answer time, XP |
| `language-word-match` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds correct, Best streak, Avg answer time, XP |
| `language-word-scramble` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, Longest word, XP |
| `logic-code-cracker` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds solved, Best streak, Total guesses, XP |
| `logic-deduction-table` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds correct, Best streak, Avg answer time, XP |
| `logic-next-sequence` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, Fastest answer, XP |
| `logic-order-path` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds correct, Best time, XP |
| `logic-rule-grid` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds correct, Best streak, XP |
| `math-equation-builder` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, XP |
| `math-fast-math` | `Score` StatRow | No | None (single presentation) | Accuracy, Correct, Best streak, Fastest answer, XP |
| `math-missing-operator` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Correct, Timeouts, Best streak, Avg response, XP |
| `math-number-line-estimation` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Hits, Best streak, Best closeness, XP |
| `math-value-ordering` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Perfect rounds, Best streak, Best speed, XP |
| `memory` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, Longest sequence, XP |
| `memory-grid-recall` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best recall, Best streak, XP |
| `memory-pair-recall` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best recall, Best streak, XP |
| `memory-pattern-tap-back` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best streak, Longest sequence, XP |
| `memory-prospective-cue` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Signals caught, Accuracy, False alarms, Rounds passed, Best streak, XP |
| `memory-running-order` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Rounds passed, Best recall, Best streak, XP |
| `memory-sequence-memory` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Sequences passed, Best streak, Longest sequence, XP |
| `spatial-coordinate-turn` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, Position trials, Best streak, Mistakes, XP |
| `spatial-fold-match` | `Score` StatRow | No | None (single presentation) | Accuracy, Rounds passed, Best streak, XP |
| `spatial-grid-nav` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, Long sequences, Best streak, Mistakes, XP |
| `spatial-mental-rotation` | `Score` StatRow | No | None (single presentation) | Accuracy, Speed, Rounds passed, Best streak, Correct answers, Timeouts, XP |
| `spatial-transform-match` | `Score` StatRow | No | None (single presentation) | Accuracy, Rounds passed, Best streak, XP |
| `speed-color-match` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Trials correct, Best streak, Avg reaction, XP |
| `speed-order-sweep` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Numbers swept, Best streak, Perfect sweeps, Best pace, Mean pace, XP |
| `speed-quick-compare` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Correct, Best streak, Best reaction, XP |
| `speed-reaction-time` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Median reaction, Best reaction, Mean reaction, Rounds passed, ✕ signals held, False starts, XP |
| `speed-tap-rush` | `Final score` numeral + `Score` StatRow | **Yes** | **Removed** the `Score` StatRow | Accuracy, Targets hit, Best streak, Perfect rounds, Best reaction, XP |

## Summary

- **42/42** registered games classified.
- **27** games had a real duplicate (`Final score` numeral + `Score` `StatRow`);
  the redundant `Score` row was removed in each.
- **15** games needed no edit: 13 show the score exactly once as a `Score`
  `StatRow`, and 2 (`attention-target-count`, `language-context-fit`) show it
  exactly once as the focal numeral.
- **0** unique metrics were removed; every non-score row survived.
- Test IDs: the removed row carried `testId(GAME_ID, 'score')`. The focal
  numeral keeps its existing `score-final` / `score-animated` / `score` +
  `animated` IDs. Game tests that asserted the removed row were migrated
  deliberately (see `FINAL_REPOSITORY_VALIDATION.md` for the final counts);
  in-session `score` / `score-live` assertions are untouched.

## Why the shared chrome was not the duplicate

The shared `GameResults` artifact intentionally shows no numeric score: it owns
the world art, the honest band headline and the game badge. Removing the
game-owned focal numeral would have removed the only score on the surface, so
the closure rule removed the lower-value fact row instead — the smallest
possible change per game.

---

## Campaign 065 correction (2026-09-21, adversarial convergence)

Re-verification at commit `a9111c3` found this document's inventory
method detected only labeled `Final score` blocks and therefore could
not see the unlabeled animated-numeral duplicate class. Consequences:

- The per-game "None (single presentation)" rows for the ten games later
  repaired in `53468e4` (e.g. `flexibility-card-sort`,
  `logic-code-cracker`, `attention-symbol-tracker`) were wrong at this
  document's own commit `8e29c85`.
- The summary line "27 games had a real duplicate" undercounts: the
  correct total after `53468e4` is 37 of 42 games.

The current tree is clean (one score statement per game) and Change 065
added a catalog-wide runtime guard (duplicate-score assertion in
`components/game-host/__tests__/catalog-persistence-matrix.test.tsx`)
so this class cannot return unobserved. This file is retained as the
historical record with this correction appended rather than rewritten.
