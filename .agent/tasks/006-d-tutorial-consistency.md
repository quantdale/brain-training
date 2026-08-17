# Packet 006-d: Tutorial Consistency Audit and Fixes

**Write surface:** `apps/mobile/src/games/*/components/tutorial.tsx` (all 20 games)
**No commits. No touches to other dirs.**

## Objective

Audit and standardize tutorial flow across all 20 games.

## Tasks

### 1. Audit Current State

For each of the 20 games, check:
- Does `components/tutorial.tsx` exist?
- Does it have 3 steps minimum (intro → demo → done)?
- Does it use consistent styling (same button styles, same layout)?
- Does it have a QA skip button (`tutorial-skip` testID)?
- Does it respect the tutorial store (complete/skip/replay)?

### 2. Standardize Tutorial Structure

For any game that deviates, update `components/tutorial.tsx` to match:
- Step 1: Intro (game name, brief description, "Next" button).
- Step 2: Demo (interactive example or animated preview, "Next" button).
- Step 3: Done (encouragement, "Start Playing" button).
- QA Skip button (visible only in dev builds).
- All buttons use the shared `GameButton` component.
- Consistent spacing, fonts, and colors (use theme tokens).

### 3. Verify Tutorial Store Integration

For each game, ensure:
- `tutorialStore` is passed as a prop to the screen.
- `shouldShowTutorial(GAME_ID)` is checked on mount.
- `complete(GAME_ID)` is called when tutorial finishes.
- `skipForQa(GAME_ID)` is called on QA skip.
- `requestReplay(GAME_ID)` is called when help button is pressed.

## Validation

From `apps/mobile`:
1. `npx jest` — full suite must pass (tutorials are covered by screen tests).
2. `npx tsc --noEmit` — must be clean.

## Notes

- Do NOT change game logic — only tutorial UI and flow.
- Preserve existing tutorial content (text, demos) — only standardize structure.
- If a game has no tutorial, add a minimal 3-step tutorial following the template.
- The `memory` game tutorial is the canonical reference — match its structure.
