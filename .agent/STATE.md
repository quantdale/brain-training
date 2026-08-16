# Durable Project State

**State schema:** 1
**Last update:** 2026-08-16 (Campaign 001 COMPLETED)
**Canonical branch:** `main`
**Active campaign:** `002-eight-representative-games` (Phase 2 — staged; next continuation goal executes it)

## Current status

**Campaign 001 (Autonomous Foundation) is COMPLETED.** All exit criteria are
verified (see `.agent/checkpoints/001-autonomous-foundation-complete.md` and
`.agent/VALIDATION.md`). The platform is production-shaped and was verified
end-to-end on the dedicated AVD:

- Expo SDK 57 app (`apps/mobile`) — four-tab shell, design tokens, dynamic
  `/game/[id]` route (root Stack + `(tabs)` group).
- SQLite persistence (`src/db`) — versioned migrations, local profile,
  atomic `completeSession`, append-only currency ledger; verified on-device
  (`files/SQLite/brain-training.db`, `user_version=1`, session row present).
- Game SDK (`src/sdk`) — versioned contracts + reference implementations
  (RNG, lifecycle, timing, difficulty, pause, normalization, XP/rating hooks,
  tutorial, audio/haptics, testIDs, diagnostics, QA force-state).
- Android harness (`scripts/android/`) — dedicated AVD `braintraining35`
  (API 35, aosp_atd), install/launch/reset/input/hierarchy/screenshot/logs,
  no host mouse/keyboard; documented in `docs/ANDROID_AUTOMATION.md`.
- One representative Memory game (`src/games/memory`) — playable end-to-end
  on the emulator; persistence proven.
- CI green (App CI + Repository Integrity) on every pushed commit.

## Completed campaign 001

- `ea7488c` wave0 scaffold · `2816ea7` wave1 (5 packets + convergence) ·
  `cc543fc` registry loaders · `d886ce3` memory game · `d380699` navigation
  fix + emulator QA evidence (High regression fixed: game route trapped in
  NativeTabs → `(tabs)` group + root Stack).

## Next required action

Execute `.agent/CURRENT_CAMPAIGN.md` — Campaign 002 (Eight Representative
Games, Phase 2): seven new game modules (Attention, Speed, Math, Language,
Logic, Flexibility, Spatial) plus shared platform surfaces (scoring/ratings/
XP/currency UI, results, game detail, favorites/search, Progress analytics).
Mass catalog expansion (Phase 4) must wait for the Phase 3 gate.

## Important invariants

- Android-first autonomous QA; iOS later compatibility campaign.
- One emulator by default (dedicated AVD `braintraining35`).
- No host mouse/keyboard automation.
- Up to ~7 coder agents where work is safely partitioned.
- No autonomous full hardening.
- No autonomous force-push to `main`.
- GitHub `main` is canonical (remote: quantdale/brain-training).

## Recovery note

A fresh agent should not require the chat that created this repository. Read
`AGENTS.md`, the constitution, governance JSON, current campaign, state,
validation, and recent Git history before working. Recovery is demonstrated —
see `docs/RECOVERY_DRILL.md`. Environment watch items (emulator stability,
screencap black frames) are in `.agent/KNOWN_ISSUES.md`.
