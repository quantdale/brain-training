# Packet 005-d: Language — Sentence Builder

**Game ID:** `language-sentence-builder`
**Primary Category:** `Language`
**Write surface:** `apps/mobile/src/games/language-sentence-builder/` (own dir only)
**No commits. No touches to other dirs.**

## Mechanic

A sentence is presented with its words scrambled (e.g. "the cat sat on →
sat on the cat"). The player must tap the words in the correct order to
rebuild the original sentence. A category hint (e.g. "Simple Past Tense")
is provided. Each round presents a new sentence. The game measures accuracy
and speed.

This is distinct from the existing Word Match (vocabulary matching) and
Word Scramble (single-word letter unscrambling). Sentence Builder is a
syntactic/grammatical construction task at the sentence level.

## Difficulty Tiers

| Level | Word Count | Sentence Type | Rounds | Time Budget |
|-------|------------|---------------|--------|-------------|
| Easy | 4–5 | Simple declarative | 4 | 30s |
| Normal | 5–7 | Compound sentences | 5 | 25s |
| Hard | 6–9 | Complex/conditional | 6 | 20s |
| Expert | 7–12 | Complex + passive voice | 7 | 15s |
| Adaptive | 4→12 | Mixed | 5 | 25s |

## Generator Invariants

- Same seed → same sentence selection and scramble (deterministic).
- Sentences are curated from a versioned sentence bank (~80 sentences
  across 10 grammatical categories).
- Scramble ≠ original (verified; retry up to MAX_SCRAMBLE_ATTEMPTS=12).
- No duplicate sentences in the same session.
- Near-duplicate avoidance: consecutive sentences from different categories.

## Scoring

- 100 points per correct sentence + 10 × wordCount bonus.
- Partial credit: 50 points if 80%+ words are correct position.
- Normalization: `accuracy × (0.5 + 0.5 × avgWordLengthFactor)`.

## Session Rules

- Per-sentence timer (time budget from difficulty).
- Tap words in order → validate → correct/incorrect → next sentence.
- Pause freezes sentence timer; resume continues.
- Auto-pause on backgrounding.

## QA Hooks

- `qa/force-win`: all sentences solved perfectly.
- `qa/force-lose`: current sentence failed, session ends.
- `qa/force-state`: inject seed + difficulty (intro only).
- All gated behind `assertDevOnly()` + `isDevBuild()`.

## Content Pack

Create `content/sentence-bank.ts` with ~80 curated sentences across 10
grammatical categories (simple past, present continuous, compound,
complex, conditional, passive, questions, imperatives, comparatives,
idiomatic). Each sentence has: text, category, wordCount.

## Test Requirements

Mirror `apps/mobile/src/games/memory/` structure:
- `__tests__/generator.test.ts` — determinism, scramble validity, no duplicates
- `__tests__/difficulty.test.ts` — tier params, adaptive escalation
- `__tests__/scoring.test.ts` — normalization formula
- `__tests__/reducer.test.ts` — all action types, phase transitions
- `__tests__/session.test.ts` — seed mapping, persistence seam
- `__tests__/hooks.test.ts` — QA dispatch
- `__tests__/screen.test.tsx` — intro, puzzle, results, QA

Expected: ~7 suites, ~85-95 tests.
