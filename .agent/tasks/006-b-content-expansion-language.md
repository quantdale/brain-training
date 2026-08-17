# Packet 006-b: Content Pack Expansion — Language Games

**Write surface:** `apps/mobile/src/games/language-word-scramble/content/`, `apps/mobile/src/games/language-sentence-builder/content/`, `apps/mobile/src/games/language-word-match/` (word list)
**No commits. No touches to other dirs.**

## Objective

Expand content packs for all 3 Language games to increase variety.

## Tasks

### 1. Word Scramble — Expand Word Bank

Edit `apps/mobile/src/games/language-word-scramble/content/word-bank.ts`:
- Add 50 new words across the existing 10 categories (5 new per category).
- Total: ~170 words (up from ~120).
- Follow existing format: `{ word: string, category: string }`.
- Maintain category balance (no category with >20 words).

### 2. Sentence Builder — Expand Sentence Bank

Edit `apps/mobile/src/games/language-sentence-builder/content/sentence-bank.ts`:
- Add 50 new sentences across the existing 10 grammatical categories (5 new per category).
- Total: ~150 sentences (up from ~100).
- Follow existing format: `{ text: string, category: string, wordCount: number }`.
- Ensure wordCount is accurate (count words in the sentence).

### 3. Word Match — Add More Word Pairs

Edit `apps/mobile/src/games/language-word-match/` — find the word list file:
- Add 30 new word pairs (word + definition/translation).
- Total: ~100 pairs (up from ~70).
- Follow existing format and category structure.

## Validation

From `apps/mobile`:
1. `npx jest src/games/language-word-scramble` — must pass.
2. `npx jest src/games/language-sentence-builder` — must pass.
3. `npx jest src/games/language-word-match` — must pass.
4. `npx tsc --noEmit` — must be clean.

## Notes

- Content should be age-appropriate and educational.
- Avoid offensive or controversial content.
- Maintain the existing quality bar (real English, correct grammar).
