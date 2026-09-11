# Campaign 026 — Visual Identity Rebuild ("Neon Arcade")

**Status:** ACTIVE
**Campaign id:** `026-visual-identity-rebuild`
**Predecessor:** `025-game-board-feedback-consistency` (VALIDATED)
**Mode:** day
**Baseline SHA:** `6f420cc`
**Change:** `026-visual-identity-rebuild` (ACTIVE)
**Authorization:** owner directive recorded 2026-09-12 — drastic whole-frontend
redesign, Refero-researched, Duolingo/Brilliant/Mindllama/Pinkllama-inspired,
proven by native before/after evidence.

## Mission

Replace the visual/interaction identity itself: new palette, typography,
geometry, motion, celebration and composition across the shell, kit, routes
and game chrome — without touching gameplay, scoring, generators, persistence
or the automation surface (every existing testID survives). The owner's
acceptance test is native before/after frames showing a visibly transformed
product.

## Where the detail lives

- `openspec/changes/026-visual-identity-rebuild/EXECUTION.md` — mission, read
  order, work model, validation, exit gate.
- `proposal.md`, `design.md`, `specs/**`, `tasks.md`.
- `research/refero-identity.md` + the Campaign 024 research briefs.

## Baseline evidence

- Pre-redesign native captures: `qa-artifacts/campaign026/before/**`
  (emulator-5560, light/dark, default profile).
- Campaign 025's before/after board pairs remain the 025 record; 026 captures
  replace them with the new identity.

## Do not

- Do not change mechanics, scoring, generators, difficulty, session timing,
  persistence or testIDs.
- Do not add native dependencies or image assets; celebration/illustration is
  code-native Views/transforms.
- Do not reopen Campaign 024/025 decisions; build on them.
