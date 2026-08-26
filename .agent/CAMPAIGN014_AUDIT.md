# Campaign 014 W1 — Product-Depth Audit (2026-08-26)

Method: five read-only family audits (memory / speed+attention / math+language /
logic+flexibility / spatial) plus one shared-surfaces audit, each reading
generator/difficulty/scoring/session/reducer/screen sources. Rubric per game,
0–3 each: depth, novelty, scaling, integrity, feedback, headroom (Σ max 18).
Evidence lives in the session reports; this file records the scores, verdicts
and the resulting priority stack. Code outranks prose — re-verify before
acting on any single item.

## Rubric scores (depth·novelty·scaling·integrity·feedback·headroom = Σ)

### Memory
| game | scores | Σ | note |
|---|---|---|---|
| memory | 1·3·2·3·3·2 | 14 | decisionless watch-recall; expert=hard+numbers |
| memory-grid-recall | 1·3·3·3·3·3 | 16 | family's best tier design |
| memory-pair-recall | 2·2·2·2·3·2 | 13 | fixed stimulus universe; untimed recall nearly free guessing |
| memory-pattern-tap-back | 1·3·2·2·3·2 | 13 | DOCUMENTED duplicate of `memory` (ADR-0005); per-tap confirm leaks success |
| memory-prospective-cue | 2·2·2·3·3·2 | 14 | unique paradigm; retired cues become anonymous fillers |
| memory-running-order | 2·1·2·3·3·2 | 12 | 6-symbol pool + exact-identity dup guard ⇒ samey rounds |
| memory-sequence-memory | 1·2·2·3·3·3 | 14 | Simon clone; expert≈hard+speed |

### Speed
| game | scores | Σ |
|---|---|---|
| speed-color-match | 2·2·2·3·3·2 | 14 | word ALWAYS names swatch (swatch.tsx:32) ⇒ semantic channel dead; numbers-only tiers |
| speed-order-sweep | 3·3·3·3·3·3 | 18 | family gold standard |
| speed-quick-compare | 2·2·3·3·3·2 | 15 | option fillers ('Unknown'/'Both'/'Tie') can NEVER be right — optionCount axis decorative |
| speed-reaction-time | 1·1·2·3·3·1 | 11 | weakest in catalog; generator doc admits delay is the only content |
| speed-tap-rush | 2·2·2·3·3·2 | 14 | position is the only entropy |

### Attention
| game | scores | Σ |
|---|---|---|
| attention-odd-one-out | 3·3·3·3·3·3 | 18 | best-designed game audited |
| attention-sustained-vigilance | 3·2·3·3·3·2 | 16 | proper SART |
| attention-symbol-tracker | 3·2·2·2·3·3 | 15 | INTEGRITY: respond phase has NO deadline |
| attention-target-count | 2·2·3·3·3·2 | 15 | no within-session escalation; grid stays visible (not flash) |
| attention-visual-search | 2·2·3·3·3·2 | 15 | feature pop-out automates; NEAR-DUPLICATE of odd-one-out (identical normalizer) |

### Math
| game | scores | Σ |
|---|---|---|
| math-equation-builder | — | — | best-in-class loop BUT expert template pool = 10 (novelty collapse) + no solution reveal on failure; dead/buggy `isValidEquationStructure` export (reducer.ts:53-79) |
| math-fast-math | strong baseline | — | surface two-step tier below expert |
| math-missing-operator | weak-ish | — | near-twin of fast-math; one-tap ceiling |
| math-number-line-estimation | 2·3·3·3·3·2 | 16 | plateaus at tolerance floor |
| math-value-ordering | 2·3·3·3·3·2 | 16 | healthy; expert two-hop expressions would deepen |

### Language
| game | Σ | note |
|---|---|---|
| language-context-fit | low | 20-item/tier packs exhaust in 2–4 sessions; pack NOT registered in content/registry.ts |
| language-sentence-builder | mid | best language mechanic; bank top-heavy; char-length quality factor wrong-headed |
| language-word-chain | mid | BEST mechanic-to-content tragedy: 30 chains TOTAL (easy=6!) |
| language-word-match | mid | static pre-baked distractors; identical roundScore twin of context-fit |
| language-word-scramble | LOWEST | distractors drawn by length NOT anagram ⇒ letter-sort elimination wins without vocabulary; skill invalidated |

### Logic
| game | Σ | note |
|---|---|---|
| logic-code-cracker | 17 | family template; untimed only gap |
| logic-deduction-table | 13 | solver-rigorous BUT post-uniqueness padding can ship GIVEAWAY clue naming the asked cell (generator.ts:249-254) |
| logic-next-sequence | 14 | only 7 recipe families; solver-first otherwise great |
| logic-order-path | 15 | single clue grammar caps depth |
| logic-rule-grid | 8 | WEAKEST GAME IN CATALOG: one-blank row/column lookup, zero chained deduction, numeric-only scaling |

### Flexibility
| game | Σ | note |
|---|---|---|
| flexibility-card-sort | 11 | cue-shift minus a dimension; no discovery mechanic |
| flexibility-color-stroop | 12 | 4 colors/~12 pairings thin; speed-bonus formula can't reach assumed ceiling at expert (scoring.ts:27,41) |
| flexibility-cue-shift | 15 | strongest flexibility impl |
| flexibility-rule-flip | 13 | LINE-FOR-LINE duplicate engine of cue-shift; premise (flip detection) nullified by always-visible banner |
| flexibility-task-switch | 14 | fairest scoring; missing wrong-task error taxonomy |

### Spatial
| game | Σ | note |
|---|---|---|
| spatial-coordinate-turn | 16 | brief phase UNTIMED (pre-solve free speed bonus); heading options never shuffled |
| spatial-fold-match | 15 | raw speed target uses sourceRevealMs (~1s) vs normalization ~11s (scoring bug); fold label announced twice kills inference |
| spatial-grid-nav | 14 | thinnest ramp after allowBack; excellent feedback |
| spatial-mental-rotation | 16 | rigorous; ≤6-block ceiling; WORST a11y (visually-only shapes) |
| spatial-transform-match | 12 | open-book source + announced transform ⇒ zero working-memory demand; flat roundScore=100; NO per-cell a11y labels |

## Cross-cutting findings

1. **Escalation usually changes magnitude, never mechanics** — the systemic
   weakness behind most mid scores. Highest-leverage cross-cutting move: give
   Hard/Expert one qualitative twist per game (reverse recall, flash+mask,
   conjunction search, uncued blocks, hidden source…).
2. **Documented/near duplicates**: pattern-tap-back↔memory (ADR-0005);
   visual-search↔odd-one-out; rule-flip↔cue-shift (verbatim engine);
   card-sort⊂cue-shift; word-match↔context-fit (identical scoring skeleton);
   fast-math↔missing-operator; reaction-time⊂vigilance.
3. **Content-pool starvation**: word-chain 30, context-fit 20/tier,
   running-order 6 symbols, stroop 4 colors, next-sequence 7 families,
   equation-builder expert 10 templates.
4. **Integrity soft spots**: symbol-tracker untimed respond; coordinate-turn
   untimed brief; transform-match open book; fold-match speed-target mismatch;
   stroop bonus-ceiling mismatch; deduction-table giveaway clues;
   pair-recall cheap elimination.
5. **A11y gaps (targeted, not blanket)**: transform-match (no cell labels),
   mental-rotation (visually-only), vs exemplars coordinate-turn/fold-match.

## Shared surfaces (audit summary)

- `src/personalization/scoring.ts` weighted multi-signal recommender
  (novelty/trend/PB-proximity/undertraining/fatigue/difficulty-fit/
  composition-fit) is **fully built + tested but ORPHANED** — production
  selection uses only weak/stale/recency primitives. Largest ready-made lever.
- **No per-game mastery system exists** (greenfield).
- **No daily-challenge concept exists** beyond the daily workout (greenfield).
- Home lacks quests strip, streak-milestone proximity, stale-domain nudge,
  post-completion hand-off (dead-end copy after daily done).
- Games library has NO sort/shelves/history badges; favorites only curation.
- Progress is retrospective-only; PB-proximity + milestones data exist unused.
- Quests/achievements never reference individual games (domain/volume only).
- Storage UX lacks any byte-size visibility (`PRAGMA page_count` trivial).
- A11y primitive set is strong (announce/dialog/focus/font-scale/reduced-
  motion/44pt) — reuse, don't reinvent.
- Perf: statement-count guards always-on; opt-in probes write baselines to
  scripts/perf/baselines/. New work must keep guards green.
- QA harness: journeys are inline flows in scripts/qa/autobot.mjs
  (`selectTargets` + flow fn + README section); `--list-flows`/`--self-test`
  verify offline.

## Priority stack (implementation order, depth-per-effort)

**P0 — shared systems**: mastery engine (schema v11) · wire orphaned
recommender into Workout V3 + reasons · daily Spotlight challenge seam.
**P1 — surgical game fixes (high ROI/line)**: deduction-table clue filter ·
symbol-tracker respond deadline · transform-match hidden-source phase ·
fold-match speed-target fix + hidden fold label · coordinate-turn shuffled
options + timed brief · stroop bonus normalization · quick-compare real decoys
· running-order palette+Hamming guard.
**P2 — mechanical differentiation**: reaction-time Go/No-Go · color-match rule
flips · visual-search conjunction search · target-count flash escalation ·
pattern-tap-back adjacency-route generator · card-sort uncued blocks ·
equation-builder template expansion + failure reveal · rule-grid redesign
(chained blanks).
**P3 — content-pool expansion**: word-chain ×3 · context-fit ×3 + registry ·
next-sequence families.
**P4 — surfaces**: Progress V3 forward-looking cards · Home quest strip /
milestone proximity / spotlight card / hand-off · library shelves + badges ·
storage-size tile · targeted a11y (transform-match cells, mental-rotation).
