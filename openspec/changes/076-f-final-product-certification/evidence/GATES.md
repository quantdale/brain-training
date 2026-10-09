# Clean-checkout and terminal artifact gates — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 7.1 (composite), 7.2 (strict OpenSpec + release APK as separate
results), 7.3 (terminal APK identity), 7.4 (Jest baseline + new OpenSpec total)
**Terminal identity:** source `b293a02e1cd5df260a66dd886c1d279978b68994`,
APK `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`
(48,888,452 bytes) — see [`TERMINAL_IDENTITY.json`](TERMINAL_IDENTITY.json).

> **Reconciled 2026-10-09.** An earlier version of this file presented source
> `c324960` / APK `de6c5fcd…` and an exact 621-suite Jest match as "the current
> terminal identity". Those are the **route-evidence** identities. They are kept
> below, labelled historical.

## 7.1 The full clean-checkout composite — RAN at `a45232f`, result recorded

Run exactly as the task requires, from a disposable clean checkout, with **no**
`--self-test`, `--skip-install`, or `--allow-jest-not-validated`:

```bash
git clone --no-hardlinks <repo> /tmp/bt-cert076f-clean
cd /tmp/bt-cert076f-clean
node scripts/certification/certify-clean-checkout.mjs
```

Checkout proven clean before the run: no inherited `apps/mobile/android`,
`apps/mobile/ios`, `node_modules`, or `.expo` (all gitignored, so the clone was
genuinely clean), at commit `a45232f`. The checkout was removed afterwards.

**Composite result: `FAIL` — 19 of 20 labeled gates passed, 1 failed.** The
tally counts the 20 labeled `run()` gates. A 21st, unlabeled pass/fail result
(`tracked_mutation_after_clean_run=PASS`, from `trackedMutation()`) is recorded
separately. This is the composite's own verdict and is reported as-is. It is
**not** the self-test; the self-test (`--self-test`, 10 checks) passing is a
different, weaker thing and is never reported as certification.

| # | Gate | Result |
| --- | --- | --- |
| 1 | app npm ci | PASS |
| 2 | repository state | PASS |
| 3 | task ownership | PASS |
| 4 | OpenSpec | PASS |
| 5 | registry | PASS |
| 6 | provenance | PASS |
| 7 | provenance self-test | PASS (13 checks) |
| 8 | jest signal self-test | PASS |
| 9 | offline boundary | PASS |
| 10 | secret boundary | PASS |
| 11 | workflow hygiene | PASS (4 files) |
| 12 | dependency audit | PASS (10 accepted advisories, no unallowlisted moderate+ production findings) |
| 13 | affected-area map sync | PASS |
| 14 | runtime QA contract | PASS |
| 15 | typecheck | PASS |
| 16 | lint | PASS |
| 17 | web export | PASS |
| 18 | **Expo Doctor** | **FAIL (exit 1)** |
| 19 | full Jest | PASS |
| 20 | jest signal | PASS (skip-signal allowlist validation) |
| — | tracked mutation (separate, unlabeled check) | PASS (`tracked_mutation_after_clean_run=PASS`) |

### The one failing gate is classified, not excused

`Expo Doctor` failed on **"Patch version mismatches"** — 8 Expo packages one or
two patch versions behind what `https://api.expo.dev/v2/versions/latest`
currently publishes (`expo` 57.0.24 vs ~57.0.27, `expo-router` 57.0.22 vs
~57.0.25, and six more).

This is **upstream drift, not a repository defect**, and that classification is
the repository's own settled decision, not an interpretation invented here:

- `.github/workflows/repository-integrity.yml` runs `npx expo-doctor` only on the
  **weekly schedule**, with `continue-on-error: true`, and an explicit
  classification step labels a failure **"UPSTREAM DRIFT, not a repository
  defect"**.
- Change 069 **removed** the network doctor from the push path precisely because
  "it resolves its expected versions from `https://api.expo.dev/v2/versions/latest`,
  so the gate can go red with zero repository changes".
- `.agent/VALIDATION.md` records the durable instruction: **"Do not re-record
  `Expo Doctor 21/21` as a push-path gate. Record the alignment validator
  instead."**

The hermetic gate that *does* answer the repository-owned question — "does the
app declare the Expo-family versions its own installed SDK requires?" — was run
separately and **PASSES**:

```bash
node scripts/validate-expo-alignment.mjs   # 22/22 aligned, 0 findings
```

**Open repository finding (tracked in `.agent/KNOWN_ISSUES.md`):**
`certify-clean-checkout.mjs` still treats the network `expo-doctor` as a hard
gate while the declared CI gate set does not, and it does not run the hermetic
`validate-expo-alignment.mjs` at all. That is the same class of
script-versus-declared-gate contradiction that task 7.2 fixed for the OpenSpec
pin. The fix is specified in section 6 of the campaign prompt — align the script
with the declared gate, run the hermetic alignment gate in the composite
instead, do **not** lower Jest/audit/OpenSpec thresholds, and extend the
self-test so the script cannot drift back. It is applied and re-run at the
terminal gates stage, not mid-certification, so the historical result recorded
above stays exactly what the shipped command produced.

## 7.2 Separate results that the script does not imply

### Strict OpenSpec validation — PASS

```bash
npx --yes @fission-ai/openspec@1.9.0 validate --all --strict
Totals: 61 passed, 0 failed (61 items)
```

This is the **new** total. The old `60/60` count is not forced and not
regretted: adding change `076-f-final-product-certification` legitimately raises
the item count to **61**. Deleting the change to preserve a number would be the
wrong move and was not made.

### OpenSpec pin alignment — corrected and still holding

The composite's OpenSpec step previously ran
`@fission-ai/openspec@1.6.0 validate --all`, while
`.agent/GOVERNANCE.json` (`openspec-validate-strict`) and
`.github/workflows/repository-integrity.yml` both declare
`@fission-ai/openspec@1.9.0 validate --all --strict`. The composite was
therefore certifying a **weaker** validation than the gate the project claims to
run. Task 7.2 directs exactly this fix.

- The pin is now the declared gate, verbatim.
- The self-test grew four **alignment** checks: the script's own source contains
  the declared gate, contains no superseded pin, `.agent/GOVERNANCE.json`
  declares the same gate, and `repository-integrity.yml` runs the same gate. Any
  drift in the three now fails closed. Self-test: 6 → **10 checks, PASS**.
- **No threshold was lowered.** `--strict` is strictly stronger than what ran
  before; Jest, audit, and OpenSpec thresholds are untouched.

Re-verified at the 2026-10-09 reconciliation: the pin is still
`@fission-ai/openspec@1.9.0 validate --all --strict` and the self-test still
guards it, so **7.2 stays checked**.

### Release APK build — recorded separately

See §7.3. The composite does not assemble an Android artifact at all, so this
result is recorded here and never implied by the script's result.

## 7.3 Terminal release APK identity

Canonical x86_64 release command:

```bash
cd apps/mobile/android
./gradlew.bat :app:assembleRelease --console=plain -PreactNativeArchitectures=x86_64
```

| Field | Value |
| --- | --- |
| Source SHA | `b293a02e1cd5df260a66dd886c1d279978b68994` — the last commit that changes an app or build input; every later commit is evidence-only |
| APK SHA-256 | `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` |
| Size | 48,888,452 bytes |
| Version name / code | 0.1.0 / 1000 |
| Package | `com.braintraining.app` |
| ABI | x86_64 |
| Gradle / JVM | 9.3.1 / Eclipse Adoptium 17.0.20+8 |
| Node / npm | v24.3.0 / 11.4.2 |
| Install result | installed and independently device-hashed |
| Device | `emulator-5554`, AVD `braintraining-ui35`, `sdk_gphone64_x86_64`, 1080×2400, API 36 |

### The rebuild hash is re-measured, not assumed

Reproducibility is not assumed. The section-3 rebuild of this campaign rebuilds
from `b293a02` on the dedicated emulator, pulls `base.apk`, hashes it, and
records the result here. `de6c5fcd…` / `c324960` is the **previous** artifact and
is retained as history: it was byte-identical across the built APK, the route
manifest, and the device install, and it is the artifact the 90/90 route matrix
and eight current-device rows were measured on.

## 7.4 Jest baseline

Two baselines, and the difference is additive, not a substitution:

| Quantity | Old baseline (route-evidence tree) | Measured after the 076-f guards |
| --- | --- | --- |
| Passed suites | 621 | **622** |
| Classified skipped suites | 4 | **4** |
| Passed tests | 7,237 | **7,241** |
| Classified skipped tests | 5 | **5** |
| Snapshots | 5 | **5** |

```
Test Suites: 4 skipped, 622 passed, 622 of 626 total
Tests:       5 skipped, 7241 passed, 7246 total
Snapshots:   5 passed, 5 total
```

The 4 skipped suites / 5 skipped tests are **classified**, not blind: each is an
opt-in performance/memory probe owned and dated in
`scripts/certification/jest-skip-allowlist.json` (schemaVersion 4, entries carry
`rationale`, `owner`, `reviewedAt`, and an `expires` of 2027-03-31), gated behind
`LARGE_BACKUP_PROBE=1` / `PERF_PROBE=1`. `validate-jest-signal.mjs` reports
`tracked_mutation_after_clean_run=PASS`. Nothing is hidden by retrying or
disabling.

The old baseline did not drop. The only movement is the two additive regression
guards (`session-header.layout.test.tsx`, `button-edge-tap.test.tsx`) plus the
deliberate `game-host.test.tsx` contract correction. Because the number in the
ledger no longer matched the tree, task 7.4 was unchecked at the 2026-10-09
reconciliation and is re-verified against the terminal run.

Strict OpenSpec total recorded alongside: **61 passed, 0 failed (61 items)**.

## 8.4 Ending-SHA workflow record

Populated at the exit gate. The last record published here was for
`684396a7` — App CI `37758437026`, Repository Integrity `37758437146`, Android
Build Smoke `37758437133`, iOS Build Smoke `37758437093`, all green — and it is
**historical**: it is not the ending SHA of this campaign. Green runs at
`05bf793` or `b7cf09b` are likewise never cited as the ending-SHA result.
