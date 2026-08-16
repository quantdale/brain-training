# Durable Project State

**State schema:** 1
**Last update:** 2026-08-16 (wave 2 + convergence)
**Canonical branch:** `main`
**Active campaign:** `001-autonomous-foundation` (Phase 1 — Autonomous Foundation)

## Current status

Campaign 001 is in its final validation wave. All six work packets are code-complete:

- WP-A app shell (four-tab shell + design tokens + registry consumer) — DONE
- WP-B SQLite persistence (migrations, profile, atomic sessions, ledger) — DONE
- WP-C Game SDK skeleton (versioned contracts + reference implementations) — DONE
- WP-D Android autonomous runtime harness (pure ADB/uiautomator) — DONE
- WP-E Memory game (sequence recall, production quality) — DONE
- WP-F Validation/CI/recovery proof (app CI green, drills recorded) — DONE

Remaining before campaign completion: Android debug APK build + one-emulator
end-to-end smoke (install/launch/navigation/memory game/pause/force-win/
session persistence), then close-out (STATE/VALIDATION update, checkpoint,
campaign archive → Phase 2 campaign file).

## Completed (committed on `main`)

- `ea7488c` wave0 — Expo SDK 57 scaffold (`apps/mobile`), test infra
  (jest-expo + better-sqlite3 test backend), provisional identity
  (`com.braintraining.app`), ADR-0004 (stack + pure-ADB automation decision),
  six campaign task packets, root README encoding repair.
- `2816ea7` wave1 — five parallel packets merged + orchestrator convergence:
  shell, persistence, SDK, harness, CI; registry generator + startup wiring;
  SDK category aligned to constitution; `@types/jest`; metro wasm fix.
  Validation: typecheck PASS, jest 104/104, web export PASS, CI green.
- `cc543fc` converge — lazy game-screen loaders in registry generator;
  `/game/[id]` renders via Suspense; GameDefinition gains `description`.
- `d886ce3` wave2 — Memory game module (deterministic generation, adaptive
  difficulty, lifecycle pause, normalization, persistence, tutorial, QA
  force-state hooks; 79 tests). Validation: typecheck PASS, jest 183/183,
  web export PASS, App CI + Repository Integrity green.

## Validation evidence

See `.agent/VALIDATION.md` for the full evidence log (waves 0–2 + recovery
drill + emulator QA rows).

## Important invariants

- Android-first autonomous QA; iOS later compatibility campaign.
- One emulator by default (dedicated AVD `braintraining35`, API 35, aosp_atd).
- No host mouse/keyboard automation.
- Up to ~7 coder agents where work is safely partitioned.
- No autonomous full hardening.
- No autonomous force-push to `main`.
- GitHub `main` is canonical (remote: quantdale/brain-training).

## Recovery note

A fresh agent should not require the chat that created this repository. Read
`AGENTS.md`, the constitution, governance JSON, current campaign, state,
validation, and recent Git history before working. Recovery is demonstrated —
see `docs/RECOVERY_DRILL.md`.
