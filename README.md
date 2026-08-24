# Brain Training App

Closed-source, offline-first brain-training application for Android and iOS
(React Native + Expo + TypeScript), built autonomously by coding agents.

> **Status:** mature implementation. A 42-game catalog ships on a shared
> GameHost architecture, with Workout V2 (short/standard/extended/domain-focus),
> adaptive progression, achievements, quests, rewards/cosmetics, analytics,
> and backup/data-portability. Android is the primary validated platform;
> iOS source compatibility is maintained but builds are NOT VALIDATED on this
> Windows host (requires macOS/Xcode).

## Repository layout

```text
apps/mobile/          Expo app: src/games/<game>/ modules, shared game-host,
                      workout engine (src/workout), db layer (SQLite), QA-tested
apps/mobile/plugins/  Committed Expo config plugins (backup rules, NDK pin,
                      deterministic version/build metadata)
scripts/              Repo validators, registry generator, perf probes
scripts/qa/           Autobot device-journey harness (Android emulator-local)
docs/                 PROJECT_CONSTITUTION.md, ADRs, audits
.agent/               Durable autonomous-development state + campaign packets
```

## Fast start with Kimi Code CLI

Clone the repository, open Kimi Code CLI from the repository root, then start the active campaign with one of:

```text
/goal Continue development using day mode. Complete the active campaign in .agent/CURRENT_CAMPAIGN.md according to AGENTS.md and the committed project constitution. Stop only when the campaign exit criteria are satisfied or a genuine blocker has been durably recorded and pushed.
```

or, when the machine can be used more aggressively:

```text
/goal Continue development using night mode. Complete the active campaign in .agent/CURRENT_CAMPAIGN.md according to AGENTS.md and the committed project constitution. Stop only when the campaign exit criteria are satisfied or a genuine blocker has been durably recorded and pushed.
```

Kimi also discovers the project-local `continue-development` Skill, so `/continue-development day` or `/continue-development night` can be used for a normal single-turn continuation. Use built-in `/goal` when persistent autonomous multi-turn work is desired.

## Source of truth

Authority order:

1. Actual code and repository state
2. `docs/PROJECT_CONSTITUTION.md` and accepted ADRs
3. Committed `.agent/` durable state
4. Git history
5. Active campaign/task packets
6. Chat/session memory

A fresh agent must be able to recover without prior conversation history.

## Current phase

See `.agent/STATE.md` and `.agent/CURRENT_CAMPAIGN.md`.

## Validation

Before doing implementation work, agents should run:

```bash
node scripts/validate-repo-state.mjs
```

App-level gates (from `apps/mobile/`):

```bash
npm run typecheck    # tsc --noEmit
npm run test:ci      # jest full suite (2 workers — matches CI)
npm run lint         # expo lint
npx expo-doctor      # 21/21 expected
```

Repo-level gates from the root:

```bash
node scripts/generate-game-registry.mjs --check
node scripts/validate-provenance.mjs --check
node scripts/validate-task-ownership.cjs
node scripts/validate-offline.mjs --check
```

Device journeys (`scripts/qa/autobot.mjs`) drive an Android emulator locally
via adb only — no host mouse/keyboard automation; see `scripts/qa/README.md`.
