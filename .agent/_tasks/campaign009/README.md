# Campaign 009 — single-session multi-worker development (parent-controlled)

You are a specialized worker under ONE parent orchestrator. The parent owns
architecture, integration, git, generated files, and durable state. You own
exactly the write surfaces in your packet file (`W<NN>.md` next to this README).

## Hard rules (violations = your work gets reverted)

1. **Git is read-only for you.** No `commit`, `push`, `branch`, `checkout`,
   `worktree`, `stash`, `reset`, `rebase`, `merge`, `tag`. `git status/diff/log/show`
   are fine. The parent commits everything.
2. **Write ONLY inside your owned paths.** If a required change lies outside,
   DO NOT EDIT IT — record it in your final report under
   `Shared changes needed from parent` with file, line, and proposed diff.
3. **Never edit these parent-only files:**
   `package.json`, `package-lock.json`, `apps/mobile/src/registry/registry.generated.ts`,
   any `*.generated.*`, `apps/mobile/src/app/_layout.tsx`, `.agent/*.md`,
   `.agent/*.json`, `docs/PARITY_MATRIX.md`, `docs/MASTER_PLAN.md`,
   `docs/DEFERRED_DECISIONS.md`, `.github/**` (unless you are W15),
   `apps/mobile/src/db/schema.ts` + `migrate.ts` (unless you are W10).
4. **Do not run `node scripts/generate-game-registry.mjs`** (parent regenerates
   once after convergence). Just add/keep your `game.json` correct.
5. **No network access in product code.** No new runtime dependencies without
   parent approval (report instead).
6. Other workers are editing OTHER directories in this same working tree right
   now. TypeScript/jest errors located OUTSIDE your owned paths are expected
   transient noise — never fix them, just ensure YOUR files are clean.

## Environment

- Windows host, Git Bash shell. Use forward slashes; repo root is the cwd.
- Toolchain (from `apps/mobile/`): `npx tsc --noEmit`, `npx jest <paths>`,
  `npm run lint`. All installed and working.
- Targeted testing only while developing (see your packet). Full gates are the
  parent's job.

## Provenance rule

If your change alters gameplay, scoring, or generated challenges for a game,
bump its `gameVersion` / `generatorVersion` / `contentVersion` (as applicable)
in that game's `game.json` + `versions.ts`. Cosmetic/refactor-only changes must
NOT bump versions. `scripts/validate-provenance.mjs --check` enforces drift.

## New-game bar (category workers)

A new game is accepted only if: mechanically distinct from every existing game;
deterministic generation with seeded RNG; validated solvability/no-ambiguity;
all named difficulties + Adaptive profile; normalized scoring; pause/resume +
double-submit protection; tutorial; QA force-state hooks; sensory feedback via
canonical events; sane a11y (no unintended answer leakage); substantial tests.
Follow the canonical module template — copy the FILE SET and patterns from
`apps/mobile/src/games/memory-grid-recall/` (game.json, game-definition.ts,
types.ts, difficulty.ts, generator.ts, reducer.ts, scoring.ts, session.ts,
hooks.ts, screen.tsx, index.ts, versions.ts, components/, __tests__/).
Quality beats count: if your candidate is weak or near-duplicate, deepen an
existing game instead and say so in your report.

## Required final report (return in your completion message)

```
Worker: W<NN>
Files changed: <list>
Functionality added/fixed: <summary>
Tests run: <commands> -> PASS/FAIL counts
Typecheck: PASS/FAIL (your files)
PASS/FAIL/NOT VALIDATED per deliverable
Shared changes needed from parent: <list or none>
Risks: <list>
Remaining opportunities: <list>
```
