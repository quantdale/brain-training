# Execution — Campaign 024: Frontend UX Modernization

**Status:** ACTIVE
**Change:** `024-frontend-ux-modernization`
**Mode:** day (owner-selected via goal directive)
**Start SHA:** `0402279`
**Predecessor:** `023-production-gamification-overhaul` (VALIDATED, terminal)

## Mission

Make the frontend production-ready and visually refined at the level of the
reference class the owner named (Duolingo, Brilliant.org, Elevate): research
with Refero MCP, then rebuild the visual language, interaction feedback,
responsive behaviour and accessibility across the whole app — without changing
gameplay, scoring, persistence or locked product decisions.

## Read order for a fresh agent

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `audit-map.md` (recon findings with evidence)
5. `research/refero-core-screens.md`, `research/refero-play-screens.md`

## Work model

- Orchestrator (single session) owns: `theme/**`, `platform/**`,
  `components/ui/**`, `components/shell/**`, `components/game-host/**`,
  `components/game-ui/**`, `app/**` shared chrome, scripts, docs, governance.
- Swarm packets own disjoint screen surfaces and report shared-file needs to the
  orchestrator (see `.agent/task-ownership.json`).
- Max 7 concurrent coders; day mode; one emulator for runtime work.

## Required validation (mirrors `scripts/validate-affected.mjs`)

```bash
cd apps/mobile
npx tsc --noEmit
npm test -- --silent            # full Jest matrix
npx expo lint
node ../scripts/validate-repo-state.mjs
node ../scripts/validate-task-ownership.cjs
node ../scripts/generate-game-registry.mjs --check
node ../scripts/validate-provenance.mjs --check
node ../scripts/validate-offline.mjs
node ../scripts/validate-secrets.mjs --check
npx @fission-ai/openspec validate --all
node ../scripts/qa/autobot.mjs --mode canaries     # dev client + Metro
```

Visual evidence: `node scripts/qa/ui-capture.mjs …` against `braintraining-ui35`.

## Dev-environment facts discovered at activation (do not re-discover)

- `react-native-reanimated@4.5.1` and `react-native-worklets@0.10.1` are
  installed but unused; `babel-preset-expo` handles the plugin (no
  `babel.config.js` in the app).
- No `expo-linear-gradient`, no `react-native-svg` — gradients/rings must be
  built without new native dependencies unless an ADR justifies one.
- Project ATD AVDs (`braintraining-qa36`, `braintraining35`) have
  `hw.gpu.enabled=no`, so `screencap` returns a uniform blank frame under any
  GPU flag. `braintraining-ui35` (GPU on, android-35 google_apis, 2048 MB) boots
  headless in ~90 s and captures real frames; the screen must be woken
  (`input keyevent KEYCODE_WAKEUP`) before capture.
- The host has limited free RAM; run at most one emulator for this campaign.

## Exit gate

Every spec scenario satisfied, `tasks.md` complete, evidence recorded in
`.agent/VALIDATION.md` with honest classifications, `main` buildable and pushed,
no temporary branches/worktrees left behind.
