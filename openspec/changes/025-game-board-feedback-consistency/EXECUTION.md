# Execution — Campaign 025: Game Board Feedback Consistency

**Status:** ACTIVE
**Change:** `025-game-board-feedback-consistency`
**Mode:** day
**Start SHA:** `2a1ba4e`
**Predecessor:** `024-frontend-ux-modernization` (VALIDATED, terminal)

## Mission

Finish what Campaign 024 started: 31 game boards still render their own verdict
styling while the shell, chrome and eight canaries use the shared language. This
campaign maps every remaining board onto that language, wires real round progress
into the shared HUD where a game knows its round count, and changes no mechanics.

## Read order for a fresh agent

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `docs/DESIGN_SYSTEM.md` (tokens + kit) and the Campaign 024 packet's
   `research/refero-play-screens.md` (`PATTERNS-PLAY` 6–9, feedback
   choreography) — the reference vocabulary this campaign propagates.

## Reference implementations (already done — copy the pattern)

- `apps/mobile/src/games/attention-symbol-tracker/components/cell.tsx`
  (cell verdict: soft fill + verdict border + ✓/✕ badge + verdict in the name)
- `apps/mobile/src/games/flexibility-card-sort/components/card.tsx`
  (two-sided reveal: wrong pick shown with the correct card)
- `apps/mobile/src/games/speed-tap-rush/screen.tsx`
  (speed-round dye model + `TapVerdictCue`)
- `apps/mobile/src/games/math-fast-math/components/feedback.tsx`
  (verdict panel with restated prompt)
- `apps/mobile/src/games/memory/screen.tsx` (`AnimatedNumber` score read-outs)
- `apps/mobile/src/games/logic-next-sequence/components/option.tsx`
  (option list verdict on a dark board)

## Work model

Seven parallel packets (wave A) covering 27 games, then one packet (wave B) for
the four speed games. Each packet owns only its own game directories and reports
shared-file needs (kit, chrome, theme) to the orchestrator.

## Required validation

```bash
cd apps/mobile
npx tsc --noEmit
npx jest <your game directories>            # packet scope
npx jest --silent --maxWorkers=4            # orchestrator, at wave end
npx expo lint
cd .. && node scripts/validate-repo-state.mjs && node scripts/validate-task-ownership.cjs
node ../scripts/qa/autobot.mjs --mode canaries --pause   # dev client + Metro
```

## Exit gate

All 42 games share one verdict language, games with known round counts report HUD
progress, the full matrix is green, autobot canaries pass, representative board
captures exist, and durable state is updated with honest classifications.
