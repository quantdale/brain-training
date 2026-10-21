# CI recovery report — Campaign 079

**Date:** 2026-10-21 · **Revisions:** `d26cd536` (reported failure) →
`2f18738f` (repair, pre-existing) → `9c4dd138` (program ending revision)

## 1. Starting intelligence vs. verified reality

The owner's 2026-10-21 brief reported `Repository Integrity` red at
`d26cd536` (run 39479920967): `node scripts/validate-affected.mjs --self-test`
exited 2 with `Unknown option: --self-test`. Fresh verification showed the
regression had **already been repaired** at `2f18738f` (parse loop recognizes
`--self-test`; run 39530950259 green) and all four workflows were green at
the program baseline `64c1df4d` (runs 39534386580/39534386589/39534386649/
39534386654). The program therefore did not replay the repair; it hardened
the whole validator family against the failure class (below).

**Root cause (of the original regression):** the F-6 unknown-flag hardening
added a strict argument loop that rejected every unrecognized option but never
allowlisted the documented `--self-test` flag, so the script's own documented
option became a usage error.

## 2. Class-level corrective patch (beyond the single flag)

The same defect class — documented/CI-invoked flags and parser behavior
drifting apart, and unknown flags silently succeeding — existed across the
gate family. Measured before the patch: 5 of 14 gate scripts rejected unknown
flags correctly; **8 silently accepted them with exit 0** (accidental silent
success), 1 exited 1 without usage.

Corrective work at `0e1c8784`:

1. **New gate `scripts/certification/validate-cli-contracts.mjs`** (CI step
   `Validate validator CLI contracts` in Repository Integrity, self-test
   12/12): for all 15 gate scripts it cross-checks documented flags (usage
   blocks) vs parser-recognized flags (comparison/call literals) vs
   CI-invoked flags (`.github/workflows` invocations), probes every script
   with an unknown option (must exit 2 with a usage error) and a stray
   positional argument, and pins the `validate-affected.mjs` contract
   (`--self-test` reaches its handler and is terminal in combinations;
   no-args exits 2). A documented-but-unrecognized flag — the exact
   `d26cd536` shape — fails the gate by fixture-proven detection.
2. **Parser hardening** in 9 validator scripts: unknown options and stray
   arguments now print `Unknown option:` / `Unexpected argument:` + usage and
   exit 2 deterministically.
3. **Workflow-to-script compatibility matrix** is emitted by the gate on each
   run (`--json` for machine form); documented, locally exercised, and
   CI-invoked flags agree at `9c4dd138`.

## 3. Regression coverage

- `node scripts/certification/validate-cli-contracts.mjs --self-test` — 12
  fixture cases including negative proofs (usage-only flag must NOT count as
  recognized; prose mentioning other tools' flags must NOT register).
- Positive probes: `validate-affected.mjs --self-test / --check-sync /
  --list-areas / --help` exit 0 (16/16 semantic self-test inside).
- Negative probes: `--__definitely_invalid__` → exit 2 on all 15 scripts;
  stray positional → exit 2 where positionals are not part of the contract.

## 4. GitHub Actions outcome (public evidence)

| Revision | App CI | Android Build Smoke | iOS Build Smoke | Repository Integrity |
|---|---|---|---|---|
| `64c1df4d` (baseline) | 39534386580 ✅ | 39534386589 ✅ | 39534386654 ✅ | 39534386649 ✅ |
| `0e1c8784` | 39543872523 ✅ | 39543872494 ✅ | (cancelled by concurrency) | 39543872493 ✅ |
| `b1cc8b84` | 39545990602 ✅ | (cancelled by concurrency) | (cancelled by concurrency) | 39545990650 ✅ |
| **`9c4dd138` (ending)** | **39547028408 ✅** | **39547028543 ✅** | **39547028492 ✅** | **39547028373 ✅** |

Concurrency `cancel-in-progress` supersedes in-flight runs when a newer commit
pushes to `main`; final certification is anchored on the ending revision's
four completed successes.

## 5. Known build-lane flake (documented, not CI-failing here)

`ninja: error: manifest 'build.ninja' still dirty after 100 tries` was
reproduced **locally (Windows)** on multi-ABI native builds at this source
state (3 occurrences), and a same-named hosted failure was reported to the
program with run id 39631393307 / commit `56d0e49e` that **does not exist in
this repository** (HTTP 404 from the API; `origin/main` has no such commit) —
recorded as an unverified report, not as hosted evidence. The hosted Android
Build Smoke is green at both `0e1c8784` and `9c4dd138`. Local mitigation that
worked: restrict the QA build to the target ABI
(`-PreactNativeArchitectures=x86_64`) after clearing stale `.cxx` configure
caches. If the race ever reddens the hosted lane, the bounded fix is to cap
Gradle worker parallelism for the native steps; not applied now because the
lane is green and an unverified report does not justify changing a passing
release gate.

## 6. Final workflow status

All four required workflows SUCCESS at the ending revision `9c4dd138`
(public run ids above). Branch protection now enforces these four check
names on merges (governance.md).
