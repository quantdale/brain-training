# OpenSpec Explore — whole-repo / whole-software findings (2026-10-19)

**Stance:** openspec explore (read-only investigation). No code, no state, no
OpenSpec change was modified by this session; this document is the only artifact
it produced.

**Baseline:** `main` @ `79aa98e0` ("Qualify UI scaling profiles and restore
normal emulator handoff"), clean worktree, in sync with `origin/main`, no stray
worktrees/branches.

**Method:** mandatory startup protocol (AGENTS.md) + full local run of every
declared hermetic gate + OpenSpec tooling inspection + cross-check of durable
state (`openspec/README.md`, `.agent/*`, `docs/PROJECT_CONSTITUTION.md`,
`docs/MASTER_PLAN.md`, `docs/audits/2026-repo-audit/`) + targeted code
verification of specific claims.

---

## 1. Verified healthy (evidence, not inference)

| Check | Command | Result |
|---|---|---|
| Full Jest matrix | `npx jest --ci --maxWorkers=4` | **PASS** — 710 suites / 8,002 tests / 5 classified skips / 5 snapshots, 291 s |
| Typecheck | `npx tsc --noEmit` | **PASS** (exit 0) |
| Lint | `npx expo lint` | **PASS** (exit 0) |
| Web export smoke | `npx expo export --platform web` | **PASS** — 22 routes exported |
| OpenSpec strict | `openspec validate --all --strict` | **PASS** — 63/63 |
| Repo state | `node scripts/validate-repo-state.mjs` | **PASS** |
| Registry / provenance / ownership / offline / runtime-QA contract / secrets / workflow hygiene / affected-map sync / expo alignment | respective `scripts/validate-*` | **PASS** |
| Dependency audit | `node scripts/validate-dependency-audit.mjs` | **PASS** — 10 accepted advisories (see F-8) |
| Certification self-tests | `certify-clean-checkout.mjs --self-test`, `validate-jest-signal.mjs --summary` | **PASS** (14 checks; floors 575/6,840 met at 710/8,002) |

Code hygiene is strong: zero `TODO`/`FIXME`/`HACK`/`@ts-ignore` markers in
production source, ~15 deliberate `eslint-disable`s and ~5 `any` casts across
1,007 source files. Registry generation is deterministic and checked. The 42
game modules match the constitution's catalog. Recent bugfix claims in
`.agent/STATE.md` match committed evidence.

**No Critical or High source defect was found.** Everything below is P2/P3
bookkeeping, tooling robustness, copy, or already-tracked product debt.

---

## 2. Findings

### F-1 [P2] The main OpenSpec spec store is empty; 132 capability specs are stranded in change folders

- **Evidence:** `openspec/specs/` contains **0 files**. Unarchived changes hold
  **132 distinct capability `spec.md` files** (140 spec files with `ADDED`
  requirements, **12 with `MODIFIED`**, **12 with `REMOVED`**). Only 8 changes
  were ever archived (`openspec/changes/archive/`, all dated 2026-09-14), and
  even those retained their deltas inside the archive — nothing was merged into
  `openspec/specs/`.
- **Why it matters:** `openspec/config.yaml` declares `schema: spec-driven`,
  where `openspec/specs/<capability>/spec.md` is the current normative store
  that deltas apply against. With an empty store, the 12 `MODIFIED`/`REMOVED`
  deltas have nothing to modify — they are unappliable by construction. The
  effective current requirements for shipped behavior can only be reconstructed
  by replaying ~63 change folders in chronological order. `openspec` tooling and
  any fresh agent asking "what does capability X currently require?" see an empty
  project.
- **Counter-consideration:** `openspec/README.md` deliberately treats change
  folders as the authority list and never mentions `openspec/specs/`, so this is
  partly a convention, not an accident. But the convention contradicts the
  declared schema and leaves requirement consolidation permanently undone.
- **Suggested disposition (not done here):** run the archive/sync flow for the
  validated terminal changes to populate `openspec/specs/`, or explicitly
  document in `openspec/README.md` that `openspec/specs/` is intentionally
  unused and change folders are replay-ordered sources of truth.

### F-2 [P3] Three changes are permanently `in-progress` in `openspec list` while the repo declares a validated terminal state

- **Evidence:** `openspec list --json` reports
  `006r-core-integrity-correction` 88/89, `016-release-certification-hardening`
  64/72, `076-product-wide-ui-ux-reboot` 81/82 as `"status": "in-progress"`,
  while `GOVERNANCE.json` says `activeCampaign: null` / `lastCampaignStatus:
  VALIDATED`.
- **Detail:** every unchecked task is honestly annotated (`006r` 12.11 =
  CI result not locally observable; `016` ×7 = external emulator/KVM blockers
  from 2026-08-30; `076` 14.3 = a review task explicitly superseded by the
  later `076-f-final-product-certification` closure). The annotations are good —
  the tool-level status is not. These three will report `in-progress` forever
  unless closed "complete with documented exceptions" or archived.
- **Why it matters:** `openspec list` is the first thing a fresh session runs;
  three zombie `in-progress` entries contradict "no active campaign" and invite
  either unwarranted reopening or wasted investigation.

### F-3 [P3] The 2026-repo-audit finding register points at change ids that do not exist, and no change references its findings

- **Evidence:** `docs/audits/2026-repo-audit/FINDINGS.md` "Change partition"
  names `070-storage-adapter-reentrancy-parity`, `071-backup-transport-atomicity-and-robustness`,
  `072-shared-ui-contract-integrity`, `073-navigation-state-and-error-surfaces`,
  `074-workout-lifecycle-durability`, `075-sdk-module-contract-and-session-safety`,
  `076-game-reducer-exhaustiveness-enforcement`. The actual folders are
  `068-storage-adapter-runtime-parity`, `070-backup-transport-atomicity`,
  `071-shared-ui-contract-integrity`, `072-navigation-and-error-surfaces`,
  `073-workout-lifecycle-durability`, `074-sdk-module-contract`,
  `075-game-reducer-exhaustiveness` — a consistent one-number drift, plus one
  renamed capability. Grep for `F-xx` ids across all change folders: **zero
  hits**; only `docs/MASTER_PLAN.md` links findings to work.
- **Why it matters:** the audit→fix traceability chain lives in one prose table
  whose pointers are wrong; a fresh agent following FINDINGS.md to "the change
  that fixed F-02" lands on the wrong folder.

### F-4 [P3] Root-residue remediation is half-done: `campaign-log.txt` is still tracked and the hygiene detector is still a demonstrated no-op

- **Evidence:** `git ls-files` shows `campaign-log.txt` (repo root, 38,622 B,
  UTF-16LE BOM + NUL-interleaved `git log --oneline` dump). Audit finding
  `L08-F05` recommended removal; the `nul` residue from that finding is gone
  (and its attribution was corrected in FINDINGS.md), but the tracked dump
  remains. The detector (`scripts/validate-repo-state.mjs` root-hygiene block)
  still only flags **zero-byte** or name-suspicious files and still ends in
  `catch {}`, exactly as L08-F05 diagnosed — a failed `statSync` silently exempts
  an entry, and a non-zero-sized UTF-16 dump passes.
- **Secondary:** because the file is UTF-16, UTF-8-scanning tools
  (`validate-secrets.mjs` counts "tracked text files") cannot actually read it —
  a scanner that cannot read a file cannot certify it.

### F-5 [P3] `validate-jest-signal.mjs` resolves its default allowlist relative to the current directory

- **Evidence:** from `apps/mobile/`, `node ../../scripts/certification/validate-jest-signal.mjs --summary jest-summary.json`
  fails with `ENOENT ... apps/mobile/scripts/certification/jest-skip-allowlist.json`;
  from the repo root it passes. CI invokes it from the root (`.github/workflows/app-ci.yml:126`)
  so the gate is green, but the script's "usage" comment implies location
  independence it does not have. A developer running it from the app package gets
  a bare ENOENT, not a usage hint.

### F-6 [P3] `validate-affected.mjs` silently consumes unknown flags as changed paths

- **Evidence:** `node scripts/validate-affected.mjs --check` prints
  `Changed paths (1): --check ... unmatched ... review manually` and exits
  benignly. The real flag is `--check-sync`. Unknown arguments should be a
  usage error; today a typo'd gate invocation reports a fake "1 changed path".

### F-7 [P3] `validate-task-ownership.cjs` crashes on an unknown flag instead of printing usage

- **Evidence:** `node scripts/validate-task-ownership.cjs --check` aborts with a
  raw stack tail ending in `Node.js v24.3.0` and a non-zero exit. Same class as
  F-6/F-5: gate scripts are robust in their happy CI invocation and brittle on
  any other invocation, which undermines their self-test story.

### F-8 [P3] `DEPENDENCY_AUDIT.md` headline count is stale relative to the live audit

- **Evidence:** the doc's top-line "**19 vulnerabilities (15 moderate, 4 high)**"
  (2026-09-19 baseline) vs today's `npm audit --omit=dev`: **66 package entries
  (49 high, 17 moderate) → 13 npm advisory ids → 10 unique GHSAs**. All 10
  GHSAs map exactly onto the 10 allowlist entries, so `validate-dependency-audit`
  PASS is *correct* and the acceptance rationale per advisory is excellent.
  But a reader comparing the doc headline with npm's own summary sees a 3–4×
  discrepancy (npm counts dependency-path entries per advisory). Refresh the
  headline with the counting model spelled out ("10 unique GHSAs; npm's summary
  counts path duplicates").

### F-9 [P3, live product] Domain detail copy renders "0 days ago" / "1 days ago"

- **Evidence:** `apps/mobile/src/app/progress-domain.tsx:332-333` renders
  `Fresh — trained ${insight.daysSinceUpdate} days ago.` with
  `daysSinceUpdate = Math.floor((nowMs - rating.updatedAt) / DAY_MS)`
  (`analytics/domain-insights.ts:159`) — so training **today shows "0 days
  ago"** and yesterday shows "1 days ago". The repo already owns a correct
  helper (`components/shell/format.ts` `formatRelativeDay`: Today / Yesterday /
  `N days ago`) with a test asserting the 1-day label must not end in
  "days ago" — this call site bypasses it and a `plural()` helper sits one line
  below. Tracked in `.agent/BACKLOG.md` as a P3 ("singular-day copy"); the
  "0 days ago" case is not mentioned there and is the more visible one.

### F-10 [P3, live product] Known open product defects (tracked, unfixed)

Recorded here so the exploration output is complete; all already live in
`.agent/BACKLOG.md` / `.agent/KNOWN_ISSUES.md`:

- OrderPath expired-round feedback: **Pause taps do not open pause**; Next
  round → Pause → Quit works. Open design question (disable pause between rounds
  vs keep available). `logic-order-path` + `game-host` pause wiring inspected —
  the control and handler exist; the failure is interaction-level on that state.
- Secondary "Bronze Ring" unlock caption clipped at expanded width (cosmetic).
- NumberLine enabled Submit shows a gray backing at rounded corners/bottom for
  ≥650 ms (cause unproven; evidence `BUTTON_NATIVE14`).

### F-11 [limits, not defects] Standing NOT-VALIDATED boundaries

Constitution targets that remain explicitly unvalidated (honestly recorded, no
fake-green): physical Android/ARM64/iOS runtime (iOS CI is compile-only),
comprehensive screen-reader coverage, human taste/recognizability study, and the
60 FPS baseline (emulator jank ~38–94% remains poor and host-confounded; memory
cost of the 42 covers documented: PSS +25.5 MiB).

---

## 3. Audit findings spot-checked as genuinely repaired (not re-reported)

To avoid re-reporting old debt, a sample of the 2026-repo-audit findings was
re-verified against current code:

| Finding | Status in code |
|---|---|
| F-04 backup overwrite not atomic | **Repaired** — `data-portability/replacement.ts` implements same-directory rename into place with `.prev` restore semantics, with the vendored-source trap documented |
| F-08 `Tappable` loses `accessibilityState` | **Repaired** — destructured merge in `components/ui/tappable.tsx` with explanatory comments |
| F-13 `useGameSession.begin()` duplicate start | **Repaired** — lifecycle ref handling + double-submission guard comments in `use-game-session.ts` |
| F-20/F-21 reducer "exhaustiveness guard" that cannot fail | **Repaired** — `assertExhaustive(action, …)` compile-time + throw, e.g. `logic-order-path/reducer.ts:415` |
| F-40 hidden `.tmp`/dot-prefixed backup names | **Repaired** — `file-transport.ts:55,87` rejects such names at save time |
| F-46 stale `MASTER_PLAN.md` | **Repaired** — plan version 2 with current phase status and finding dispositions |

`docs/MASTER_PLAN.md` §"Phase 10 COMPLETE — all 46 audit findings dispositioned,
0 open" is consistent with this sample.

---

## 4. Bottom line

The software itself is in unusually good health: every declared gate passes
locally, 8,002 tests are green, the code is clean of debt markers, and prior
audit defects show real repairs. What is "wrong" is concentrated in three
layers:

1. **OpenSpec spec consolidation (F-1)** — the declared spec-driven schema has
   no consolidated spec store; this is the one structural item worth a decision.
2. **Status/bookkeeping drift (F-2, F-3, F-4, F-8)** — zombie in-progress
   changes, a mis-pointed finding register, a half-remediated root residue, and
   one stale headline number.
3. **Small tooling/copy defects (F-5–F-7, F-9)** — gate scripts that only work
   from one CWD/argv, and one unhandled singular/zero-day string.

None blocks build/start, data integrity, or the next campaign. Suggested next
step if the owner wants closure: a small bounded "hygiene convergence" change
covering F-1 decision + F-2/F-3/F-4/F-8 bookkeeping + F-5–F-7 arg-handling +
F-9 copy — no product behavior changes.
