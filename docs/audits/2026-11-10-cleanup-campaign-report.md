# Repository-wide maintenance campaign — final report (2026-11-10)

Scope: one autonomous maintenance/cleanup pass over `quantdale/brain-training`
per the Campaign brief (Phases 0–14). No feature work, no product-behaviour
change, no dependency upgrade, no campaign closure.

---

## A. Repository freshness

| Item | Value |
| --- | --- |
| Authoritative remote | `origin` — `https://github.com/quantdale/brain-training.git` |
| Primary integration branch | `main` (remote `HEAD` → `origin/main`; confirmed with `git remote show origin` and `git ls-remote --heads`) |
| Remote HEAD at session start (as checked out) | `a3dbb468` |
| Remote HEAD after `git fetch --all --prune` | `7b13b7e4` — the checkout was **42 commits behind** |
| Maintenance start commit | `7b13b7e4` (after `git merge --ff-only origin/main`) |
| Branch protection | `.agent/GOVERNANCE.json` documents 4 required checks + a ruleset blocking force-push/deletion for everyone; administrators may push commits directly, which is the repository's documented autonomous integration model |
| Upstream advanced during the campaign? | No. Verified by a fresh `git fetch` before every push and again at the end. |
| Final remote HEAD | see §E |

The initial checkout was stale (`a3dbb468`, behind by 42 including the merged
macOS/iOS PR #1). It was fast-forwarded before any edit — no rebase, no reset,
no `git pull`, and no local work was discarded (there was none: clean worktree,
no stash, no other branch or worktree). Repository policy was read from
`AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/GOVERNANCE.json`,
`.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md` and `.agent/VALIDATION.md`
before modification, and `node scripts/validate-repo-state.mjs` passed.

Freshness was re-checked at five checkpoints: before the first edit, before the
first push, before each subsequent push, before the final gate sweep, and after
delivery.

## B. Cleanup summary

Four code-bearing commits plus prose. Every removal was justified by evidence,
not by "looks unused".

**Dead code (9 exported declarations).** Emptiness was measured with a
repo-wide word index over all 3 700+ tracked text files, then confirmed against
the TypeScript AST so a declaration could be told apart from a usage (a purely
textual scan wrongly reported 246 candidates — most were used inside their own
file):

- `hasDomainArtwork`, `identityFamilyLabel`, `collectiblePlateColor` — exported
  helpers with no importer.
- `useTopLevelNav` — no importer, and it was a weaker duplicate of the nav rule
  that `isTopLevelHref` plus the change-072 source guard already enforce.
- `useStageNav`, `useMemoryTileSize`, `PrototypeComponent` — 076 prototype
  helpers the three candidate screens never adopted.
- `WorkoutCasValues`, `WorkoutCasExecutor` — the CAS value shape lives inline in
  the writer signature; the types and the `SQLiteAdapter` import that only they
  used are gone.
- Two redundant re-export lines in `prototypes/boards.ts` (`MEMORY_DEMO_SEQUENCE`,
  `PrototypeStage`) — both symbols remain exported from `harness.tsx`.

**Correctness of documentation.** Three headers in `speed-quick-compare` still
named a *different game* ("Tap Rush"), because the module was created as a copy
of `speed-tap-rush`; they now use the module's own `game.json` name. A
catalog-wide scan found no other module whose opening line names another game.

**Lint integrity.** `npx eslint .` was failing with 1 error + 2 warnings while
`npm run lint` reported clean, because `expo lint` only covers
`src/app/components`:

- `jest/setup.js` used `afterEach` with only the `jest` global declared → all
  Jest lifecycle globals are now declared in the `jest/**` override.
- one plugin test put its `no-require-imports` directive on the wrong line, so
  lint reported *both* an unused directive and the real violation → now matches
  its three sibling plugin tests.

**Repository clutter.** Removed the `example` rule from
`apps/mobile/.gitignore`. It belonged to the create-expo-app
`reset-project` script that was deleted in `3a73cb06`; nothing matches it
(`git status --ignored=matching` reports 179 ignored entries, none of them an
`example`), no `apps/mobile/example` path exists or was ever tracked, and a bare
`example` pattern would silently ignore any future directory of that name.

**Broken audit document.** `docs/audits/2026-repo-audit/FINDINGS.md` had a prose
paragraph spliced *into* its severity table, leaving F-35..F-41 as seven ragged
rows with no header or delimiter (structurally not a table under GFM). The
paragraph now follows the table; all 46 rows form one table.

**Stale durable state.** `README.md` claimed iOS builds were "NOT VALIDATED";
`STATE.md` and `CURRENT_CAMPAIGN.md` described the macOS/iOS work as unmerged.
Both are false against the repository: PR #1 merged as `7b13b7e4` and iOS Build
Smoke builds **and launches** the Simulator app green. Corrected, keeping the
genuinely unvalidated items (physical iPhone, signing, TestFlight, physical
performance) marked NOT VALIDATED.

**Dependencies and configuration.** No dependency was added, removed, upgraded
or re-wired; `package.json` and `package-lock.json` are byte-unchanged. The
working `node_modules` was found 10 Expo patch versions **ahead** of the
lockfile with `expo-build-properties` missing entirely (which broke `expo
config` and `expo-doctor`), so `npm ci` restored the lockfile exactly. No
dependency was removed: the zero-import packages (`react-native-reanimated`,
`react-native-worklets`, `react-native-gesture-handler`, `react-native-screens`,
`expo-linking`) are required peers of `expo-router` and/or autolinking
participants, which `expo-doctor` and the hermetic alignment gate confirm.

**Deliberately not changed** (recorded in `.agent/BACKLOG.md` with the evidence
each would need): the tracked-but-also-ignored `apps/mobile/expo-env.d.ts`
(ADR 0004 owns that ritual); 157 exported interfaces/type aliases used only
inside their own file (a taste call, not dead code); ten one-shot 076-f evidence
scripts that are the reproducible procedure behind retained evidence; the
`native-coverage-ledger-v9.json` runtime ledger (v4/v5 prove that "no literal
reference" is the wrong test — `artifact-policy.mjs` reads them through a
generated path); the duplicate `ui-scaling` header/start screenshots (byte-
identical captures, both labels referenced, both hashes correct — a device run
would be needed to say which label is wrong); 42 identical per-game
`tutorial-lifecycle` bodies (each game is a deliberate isolation boundary); and
the historical campaign packets/checkpoints, which are the audit trail.

## C. Git hygiene

| Resource | State |
| --- | --- |
| Local branches | 1 (`main`) — nothing to remove |
| Remote branches | 1 (`main`) — nothing to remove; no branch was deleted |
| Merged/closed work | PR #1 (`claude/macos-production-readiness`) already merged; its branch was deleted on the remote before this session, and no local copy existed |
| Worktrees | 1 (the repository itself). A stale **empty** directory at `_AgentWorktrees/brain-training/maintenance-repository-cleanup`, left by the 2026-11-08 session with no `.git` and no files, was removed |
| Stashes | 0 |
| Unmerged commits across all local branches | 0 |
| In-progress git operations | none (no `MERGE_HEAD`, rebase, cherry-pick or bisect) |
| Dangling objects | 1 023 unreachable objects found by `git fsck --dangling`; **not pruned** — they are recoverable history from prior campaigns and pruning is destructive and outside this mandate |

Nothing containing unique or uncommitted work was removed, and no force-push,
reset, rebase or history rewrite was performed.

## D. Validation

Baseline and final were measured on the same tree (`7b13b7e4` → delivered HEAD).

| Gate | Before | After |
| --- | --- | --- |
| `tsc --noEmit` | PASS | PASS |
| Jest full suite (`--ci --maxWorkers=2`) | 731/735 suites · 8238 passed · 5 skipped | 731/735 · 8238 passed · 5 skipped · 5 snapshots · exit 0 |
| `npm run lint` (`expo lint`) | PASS | PASS |
| `npx eslint .` (whole package) | **FAIL** — 1 error + 2 warnings | PASS — 0 problems |
| `npx expo export --platform web` | PASS | PASS |
| `npx expo config --json` | **FAIL** (missing `expo-build-properties`) | PASS after `npm ci` |
| `npx expo-doctor` | 20/21 (10 SDK patches behind bundled map) | 20/21 — unchanged |
| repo-state / registry / spec-store | PASS | PASS |
| provenance / task-ownership | PASS | PASS |
| offline / secrets / workflow hygiene | PASS | PASS |
| affected-map sync / expo-alignment | PASS | PASS |
| CLI contracts / runtime-QA contract (+self-test) | PASS | PASS |
| clean-checkout self-test | PASS | PASS |
| dependency audit | PASS (8 accepted, 0 unallowlisted) | PASS |
| OpenSpec `validate --all --strict` @1.9.0 | 207/207 | 207/207 |
| GitHub Actions (App CI, Android Build Smoke, iOS Build Smoke, Repository Integrity) | n/a | 4/4 success at every delivered head |

**Known pre-existing conditions, not introduced here:** `expo-doctor` 20/21
(network-sourced upstream patch drift; advisory by governance, with the hermetic
`validate-expo-alignment.mjs` as the push-path equivalent); the four accepted
dependency advisories documented in `.agent/DEPENDENCY_AUDIT.md`; campaign 080's
own open native-certification work.

**Not validated by this campaign** (and not claimed): Android native runtime
journeys, ARTEMIS traces, physical-device runs, and performance. Nothing they
cover was modified, and the session changed no product behaviour — the only
source edits are dead-export deletions and comment corrections.

## E. Final git state

| Item | Value |
| --- | --- |
| Target branch / remote | `main` → `origin` |
| Delivered head | `f1e280a2` (and the commit carrying this report) |
| `main` vs `origin/main` | identical, `ahead/behind = 0 0` |
| `git ls-remote origin refs/heads/main` | matches local `HEAD` |
| Push status | direct push accepted (the documented autonomous model); no force, no rewrite |
| Pull request | not used; repository policy permits direct admin pushes after the local green-main checks |
| Working tree | clean, including untracked files (0 entries) |
| Integration blockers | none |

## F. Deferred improvements

Enumerated with evidence in `.agent/BACKLOG.md` § "Deferred cleanup
candidates". The two worth naming here:

1. **Tracked-but-ignored `expo-env.d.ts`.** The file is committed on purpose
   (ADR 0004) yet an expo-cli-generated ignore rule also matches it, so
   `git ls-files -i -c --exclude-standard` reports exactly this one file. It is
   harmless — tracking wins, verified by probe — but the rule contradicts the
   comment directly above it. The one-line fix (`!expo-env.d.ts` after the
   block) was tested and rejected as unstable: expo's
   `mergeGitIgnoreContents` deletes and re-appends the generated section at the
   END of the file, so the next regeneration would put the ignore rule after the
   negation and silently restore the contradiction. The durable fix is to stop
   the pattern being generated at all, which belongs to ADR 0004.
2. **Expo patch drift.** Ten packages sit one patch behind the bundled SDK map.
   Bumping them is an unrelated upgrade with its own validation cost; the
   compatibility gate that matters (`validate-expo-alignment.mjs`) is aligned.

Also deferred: per-game duplication of tutorial-lifecycle/scoring helpers (an
explicit architectural trade-off — 42 independently editable modules), and
204 exported types used only inside their own file.

## G. Final verdict

Verdict: COMPLETE.

The brief's definition is: validated, safely integrated into the current
authoritative primary branch, and verified remotely. Each holds:

- **Validated.** Every local gate passes at the delivered SHA — typecheck,
  `npx eslint .`, the full Jest matrix (731/735 suites, 8 238 passed, 5
  classified skips, 5 snapshots), web export, and fourteen repository
  validators plus strict OpenSpec 207/207. The one gate that was RED on arrival
  (`npx eslint .`: 1 error + 2 warnings) now passes.
- **Integrated** into `main`, the verified primary branch, using the
  repository's documented autonomous direct-push model after the local green
  checks. No force-push, no history rewrite, no bypass of the ruleset.
- **Verified remotely.** `main` = `origin/main` = the value `git ls-remote`
  reports, `ahead/behind = 0 0`, and all four workflows (App CI, Android Build
  Smoke, iOS Build Smoke, Repository Integrity) returned `conclusion: success`
  for every head pushed, including the final one.

The deferred items in §F are reported rather than executed, which the brief
anticipates ("Explain why they were preserved and what evidence would be
required for safe future work"). None is required work: the
`expo-env.d.ts` rule is a consequence of a decision owned by ADR 0004, whose
naive one-line fix was tested and shown to re-break on the next expo
regeneration; and the Expo patch bumps are dependency churn the brief explicitly
excludes.

The repository is left strictly better than it was found — one failed gate
repaired, nine dead declarations and one duplicated navigation rule removed,
three game-module headers that named a different game corrected, scaffold residue
dropped, a broken audit table repaired, and the durable state made truthful about
the merged iOS work — with no product behaviour changed and nothing overwritten.
