# Autonomous Agent Instructions

These instructions apply to every coding agent operating in this repository. They are intentionally vendor-neutral; Kimi-specific behavior is layered on top where useful.

## Mission

Build the closed-source, offline-first Android+iOS brain-training product defined by `docs/PROJECT_CONSTITUTION.md` using an autonomous, campaign-based development model. Android is the primary implementation and autonomous-QA target. Do not reopen locked product decisions unless a concrete contradiction or blocker makes it necessary.

## Mandatory startup protocol

At the beginning of every fresh session or after context compaction:

1. Read this file completely.
2. Read `docs/PROJECT_CONSTITUTION.md`.
3. Read `.agent/GOVERNANCE.json`.
4. Read `.agent/GOAL.md`.
5. Read `.agent/STATE.md`.
6. Read `.agent/CURRENT_CAMPAIGN.md`.
7. Read `.agent/KNOWN_ISSUES.md` and `.agent/VALIDATION.md`.
8. Inspect `git status`, current branch, recent history, and remote state.
9. Run `node scripts/validate-repo-state.mjs`.
10. Reconcile documentation/state with actual code before making changes.

The repository, code, and Git history outrank remembered chat context.

## Meaning of "continue development"

When the user starts a goal such as:

`/goal Continue development using day mode...`

or

`/goal Continue development using night mode...`

interpret it as authorization to autonomously execute the active campaign in `.agent/CURRENT_CAMPAIGN.md` until its exit criteria are satisfied or a genuine blocker is reached.

Do not ask the user routine implementation questions. For low-risk unspecified choices: investigate, choose the most reasonable option, document consequential decisions, and continue.

Only stop for a user decision when genuinely required, such as credentials/payment, legal acceptance, destructive external actions, irreversible publication, or an unresolved product/architecture choice that cannot be safely inferred from the constitution.

## Campaign model

- Exactly one top-level campaign is active at a time.
- A campaign may contain many parallel swarm work packets and many commits.
- Normal development uses bulk implementation + light convergence validation.
- A full hardening campaign is never started automatically. Only the user explicitly starts hardening.
- Critical/High regressions found during normal work must still be repaired before continuing feature expansion.

## Parallel/swarm policy

Use parallel agents aggressively when work can be partitioned safely.

Default coding concurrency ceiling: **7 coder agents**.

Before spawning parallel coders, the orchestrator must define task packets with:

- objective
- dependencies
- allowed write surfaces
- prohibited/shared write surfaces
- completion criteria
- cheap validation
- integration requirements

Subagents may read the whole repository but should edit only their assigned ownership surfaces.

Do not let multiple agents concurrently edit shared hotspots such as package manifests, lockfiles, navigation registries, schemas, shared SDK contracts, generated indexes, or global config. Subagents should report shared-file needs; the orchestrator performs convergence edits once.

Temporary branches/worktrees are allowed only when they materially improve isolation. They must be automatically integrated and removed. Successful convergence must leave a clean `main` with no abandoned temporary branches/worktrees.

## Git policy

- `main` is the canonical branch locally and remotely.
- Commit coherent progress regularly.
- Push successful swarm waves and useful blocked checkpoints to `origin/main`.
- Pushed `main` may contain incomplete product work but should normally remain buildable/startable.
- Never autonomously force-push `main`.
- `--force-with-lease` is allowed only when the user explicitly authorizes a specific history-rewrite/recovery operation.
- Prefer corrective commits or `git revert` for ordinary repair.

On a genuine blocker: preserve safe work, restore buildable/startable state where practical, document the blocker, update durable state, commit, push, then stop.

## Host-interaction prohibition

Routine autonomous work must not hijack the user's desktop.

Forbidden for routine automation:

- moving the host/physical mouse
- global mouse injection
- global keyboard injection
- stealing foreground focus
- constraining host cursor movement
- relying on absolute desktop coordinates
- manipulating unrelated desktop windows

Preferred mechanisms:

- Android emulator-local input
- ADB
- accessibility/UI hierarchy
- semantic test IDs
- emulator screenshots/framebuffer
- app instrumentation
- deterministic fixtures

The user must remain able to work normally while development runs.

## Emulator policy

- Default to one dedicated Android emulator/AVD.
- Coder subagents should not each launch an emulator.
- The orchestrator owns expensive runtime/integration QA.
- Headless/background execution is preferred.
- A visible emulator is acceptable if automation remains emulator-local and does not steal host input.

## Day and night modes

### Day mode

Prioritize workstation coexistence:

- up to 7 coder agents when useful
- one emulator
- restrained expensive build/test concurrency
- light risk-based validation after waves
- no host-input interference

### Night mode

May use more CPU/RAM and heavier validation. Still default to one emulator until evidence proves multiple emulators are beneficial.

The user explicitly selects the mode; never infer it from the clock.

## Validation model

Normal post-wave validation is risk-based, not exhaustive.

Use `.agent/IMPACT_MAP.md` to map changed areas to required checks. Shared Game SDK changes should exercise representative canary games rather than the entire eventual catalog.

Critical/High regressions block the next feature wave, including:

- app does not build/start
- major normal workflow crash
- data loss/corruption
- progression/currency corruption
- backup/restore corruption
- major existing feature unusable
- serious sync-integrity failure
- meaningful security issue

Medium/Low findings may be documented into durable debt/backlog without derailing the active campaign.

Never fake green. If a required check cannot run, record `NOT VALIDATED` or `BLOCKED`, not `PASS`.

Do not hide flaky tests with blind retries, arbitrary sleeps, or disabling. Quarantine only understood non-blocking flakes with documented closure criteria.

## QA instrumentation requirements

Design for autonomous observability and reproducibility:

- stable semantic IDs/test IDs
- deterministic RNG seeds
- injectable/test clock where date/time matters
- fixture/state injection
- fast force-win/force-loss/timeout paths where safe
- structured logs/diagnostics
- failure screenshots
- game/scoring/generator version metadata
- recent automation action trace when practical

Dangerous QA controls must be disabled/unavailable in production builds.

## Architecture rules

- React Native + Expo + TypeScript is the preferred stack unless a documented ADR demonstrates a serious blocker.
- SQLite is canonical local persistence.
- Core app is offline-first.
- Reanimated is preferred for polished motion; Skia is allowed where a game benefits from richer rendering.
- Do not introduce Swift/Kotlin native modules without demonstrated need and an ADR for substantial native architecture.
- Each game is a self-contained module plugging into a shared mandatory Game SDK.
- Maximize independently editable modules and minimize shared-file hotspots to support swarm development.
- Generated registries/indexes/types must be deterministic and generated, not hand-maintained.
- Persistent formats and scoring/generator rules must be versioned.

## Major architecture changes

A subagent must not independently launch a major architectural rewrite outside its packet. Escalate to the orchestrator, write an ADR under `docs/adr/`, then proceed only if the change is consistent with the constitution.

## Dependencies

Agents may install/update dependencies autonomously when needed. Prefer stable/current compatible releases, not upgrade churn. Foundational dependency replacement requires an ADR.

Never commit secrets, provider keys, signing credentials, Supabase secrets, or tokens.

## Documentation/state discipline

After each meaningful swarm wave or major milestone:

- update `.agent/STATE.md`
- update `.agent/VALIDATION.md`
- update `.agent/CURRENT_CAMPAIGN.md` progress
- update `.agent/BACKLOG.md` / `.agent/KNOWN_ISSUES.md` if necessary
- add an ADR for consequential architecture changes
- commit and push coherent progress

Do not update durable state after every trivial edit; checkpoint at meaningful recovery boundaries.

## Comments

Preserve and add useful inline comments for invariants, algorithms, synchronization assumptions, QA hooks, and non-obvious intent. Do not add noise comments that merely restate obvious code.

## Success contract for a normal goal session

A successful continuation should normally leave:

- active campaign materially advanced or completed
- parallel work safely converged
- Critical/High regressions repaired
- appropriate light validation passed
- durable state synchronized
- `main` buildable/startable
- meaningful work committed and pushed
- no temporary worktrees/branches left behind
- blockers/remaining work explicitly recorded
