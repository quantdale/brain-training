# Execution — Campaign 026: Visual Identity Rebuild

**Status:** ACTIVE
**Change:** `026-visual-identity-rebuild`
**Mode:** day (night may be used when the owner selects it)
**Start SHA:** `6f420cc`
**Predecessor:** `025-game-board-feedback-consistency` (VALIDATED, terminal)

## Mission

Execute the owner's recorded directive: drastically change the entire
frontend visual identity using Refero-grounded references, until native
before/after evidence shows a visibly transformed product — without touching
gameplay, scoring, generators, persistence or the automation surface.

Owner directive (verbatim, 2026-09-12):

> "THE ENTIRE UI/UX FRONTEND STILL LOOKS THE SAME AND IT SUCKS… I permit
> extremely drastic changes to change the entire frontend. Utilize Refero MCP
> to achieve this. Take inspiration from iOS apps like Duolingo, Brilliant,
> Mindllama, Pinkllama… DO NOT STOP and you CANNOT STOP until this is
> achieved."

## Read order for a fresh agent

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `research/refero-identity.md` + the Campaign 024 research briefs
5. `docs/DESIGN_SYSTEM.md` (the system being superseded)

## Work model

- The identity foundation (tokens/contrast) and the kit are
  orchestrator-owned shared hotspots: one worker at a time, then surface
  packets consume them.
- Surface packets own disjoint route/component directories and report shared
  needs instead of editing shared files.
- Ceiling: 7 coders; one emulator (emulator-5560); host input is never
  hijacked (emulator-local ADB only).

## Required validation

```bash
cd apps/mobile
npx tsc --noEmit
npx jest --silent --maxWorkers=4
npx expo lint
cd .. && node scripts/validate-repo-state.mjs && node scripts/validate-task-ownership.cjs
node scripts/qa/ui-capture.mjs --device emulator-5560 --out qa-artifacts/campaign026/after --theme light,dark
node scripts/qa/a11y-audit.mjs
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode canaries --pause
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode workout
```

## Exit gate

Every captured surface visibly differs from the baseline in both themes; the
matrix, lint, validators, canaries and a11y audit are green; no testID lost;
`docs/DESIGN_SYSTEM.md` describes the shipped system; durable state records
honest PASS/NOT VALIDATED classifications.
