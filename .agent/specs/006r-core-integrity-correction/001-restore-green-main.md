# 001 — Restore Green Main and Freeze Expansion

**Priority:** P1 / blocking  
**Depends on:** none  
**May run in parallel:** no; this is the first gate  
**Primary owner:** orchestrator  
**Purpose:** establish a trustworthy, compilable baseline before semantic corrections

## Problem statement

The audited Campaign 006 checkpoint (`2871e5a`) was pushed while App CI was red at TypeScript compilation. The immediate known errors are in the Campaign 006 Equation Builder tutorial work, but the agent must inspect current local/remote HEAD and CI rather than assuming the audit snapshot is still the only failure.

A corrective campaign cannot be built on a baseline whose compile/test status is unknown. This spec restores the minimum green baseline **without hiding semantic defects** that are intentionally handled by later specs.

## Required work

### 1. Reconcile to canonical `main`

- Fetch `origin/main` and record the exact starting SHA in `.agent/VALIDATION.md`.
- Confirm no uncommitted work will be accidentally overwritten.
- Read the latest failed App CI logs if available.
- If `main` advanced after `2871e5a`, re-evaluate each current failure against this plan.

### 2. Repair compile failures correctly

Known audited examples include:

- Equation Builder tutorial demo parameters using `timeBudgetMs: null` where the typed difficulty contract expects a numeric value.
- Tutorial token evaluation treating general `EquationToken` values as if all non-numeric tokens were `Operator` values, despite parentheses/group tokens existing.

The implementation must preserve the real tutorial mechanic. Do not fix compilation by `as any`, blanket type assertions, removing parentheses support, disabling the demo, weakening domain types, or excluding files from TypeScript.

Where tutorial/demo evaluation duplicates production evaluation logic, prefer calling the production pure evaluator or extracting a safe shared pure helper rather than maintaining a divergent miniature evaluator.

### 3. Freeze breadth work

Until Spec 013 passes:

- no new game modules;
- no new content-count expansion solely to increase item totals;
- no new campaign whose primary goal is feature/catalog breadth;
- no continuation of the old 006-b/006-c expansion packets unless the work is required to correct invalid content and satisfies Specs 003–005.

Existing correct Campaign 006 changes (e.g. error boundary work, useful memoization) may remain.

### 4. Establish local baseline commands

From the repository root / `apps/mobile` as appropriate, run and record:

- `node scripts/validate-repo-state.mjs`
- registry generator/check command used by the repository (`--check`)
- `npm run typecheck`
- full `npm run test:ci` or equivalent full Jest suite
- `npx expo export --platform web`
- `npx expo-doctor`

If lint currently has pre-existing failures, record them accurately; do not call it PASS. Lint becomes a formal CI decision in Spec 012.

### 5. Inspect generated-file correctness

Campaign 006 attempted lazy-loading changes around `registry.generated.ts`. Verify the generated registry is reproducible from its generator. If current generated output and generator disagree, the generator is authoritative; do not hand-maintain generated output.

## MUST acceptance criteria

- TypeScript reports zero errors.
- Full Jest suite passes without disabled/newly quarantined tests used to hide failures.
- Repository-state validator passes.
- Registry generated-file check passes.
- Web export build smoke passes.
- Expo Doctor passes or any external/environmental blocker is explicitly `NOT VALIDATED`; a real code/config failure is not waived.
- No new content/game breadth was added as part of this repair.
- `.agent/VALIDATION.md` records starting SHA, commands, outputs/counts, and ending SHA.
- Local main is coherent and buildable before push.

## Forbidden shortcuts

- `@ts-ignore`, `@ts-nocheck`, broad `any`, or unsafe casts introduced solely to silence these failures.
- Deleting failing tests without replacement evidence.
- Changing production domain contracts merely to make a tutorial compile unless the contract itself is demonstrably wrong and documented.
- Claiming CI green before GitHub Actions actually confirms it when Actions are available.

## Exit

Only after this spec is green may the orchestrator begin the semantic repair waves in Specs 002–012.