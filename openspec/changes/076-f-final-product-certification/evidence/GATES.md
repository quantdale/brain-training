# Clean-checkout and terminal artifact gates — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 7.1 (composite), 7.2 (strict OpenSpec + release APK as separate
results), 7.3 (terminal APK identity), 7.4 (Jest baseline + new OpenSpec total)

## 7.1 The full clean-checkout composite — RUN, result recorded

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

**Composite result: `FAIL` — 19 of 20 gates passed, 1 failed.** This is the
composite's own verdict and is reported as-is. It is **not** the self-test; the
self-test (`--self-test`, 10 checks) passing is a different, weaker thing and is
never reported as certification.

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
| 20 | jest signal | PASS (`tracked_mutation_after_clean_run=PASS`) |

### The one failing gate is classified, not excused

`Expo Doctor` failed on **"Patch version mismatches"** — 8 Expo packages one or
two patch versions behind what `https://api.expo.dev/v2/versions/latest`
currently publishes (`expo` 57.0.24 vs ~57.0.27, `expo-router` 57.0.22 vs
~57.0.25, and six more).

This is **upstream drift, not a repository defect**, and that classification is
the repository's own settled decision, not an interpretation invented here:

- `.github/workflows/repository-integrity.yml` runs `npx expo-doctor` only on
  the **weekly schedule**, with `continue-on-error: true`, and an explicit
  classification step labels a failure **"UPSTREAM DRIFT, not a repository
  defect"** because "expo-doctor reports repository failures for upstream patch
  releases".
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

**Recorded as an open repository finding (see `KNOWN_ISSUES` update):**
`certify-clean-checkout.mjs` still treats the network `expo-doctor` as a hard
gate while the declared CI gate set does not, and it does not run the hermetic
`validate-expo-alignment.mjs` at all. That is the same class of
script-versus-declared-gate contradiction that task 7.2 fixes for the OpenSpec
pin. It is left in place here rather than edited mid-certification, so this
composite result stays exactly what the shipped command produced. The fix is
specified in the finding and is not a threshold change.

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

### OpenSpec pin alignment — corrected

The composite's OpenSpec step ran `@fission-ai/openspec@1.6.0 validate --all`,
while `.agent/GOVERNANCE.json` (`openspec-validate-strict`) and
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

### Release APK build — PASS (recorded separately)

See §7.3. The composite does not assemble an Android artifact at all, so this
result is recorded here and never implied by the script's result.

## 7.3 Terminal release APK identity

Built from the terminal application source with the canonical x86_64 release
command:

```bash
cd apps/mobile/android
./gradlew.bat :app:assembleRelease --console=plain -PreactNativeArchitectures=x86_64
# BUILD SUCCESSFUL in 2m 37s · 495 actionable tasks
```

| Field | Value |
| --- | --- |
| Source SHA | `c324960c7619d305f01d60587f9e74c4ca93ca6a` (terminal application source; later commits are evidence/docs only) |
| APK SHA-256 | `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` |
| Size | 48,888,204 bytes |
| Version name / code | 0.1.0 / 1000 |
| Package | `com.braintraining.app` |
| ABI | x86_64 |
| Gradle | 9.3.1 |
| JVM | Eclipse Adoptium 17.0.20+8 |
| Node / npm | v24.3.0 / 11.4.2 |
| Install result | installed and independently device-hashed |
| Device | `emulator-5554`, AVD `braintraining-ui35`, `sdk_gphone64_x86_64`, 1080×2400, API 36 |

### The rebuilt hash matched — that is evidence, not assumption

The rebuilt `app-release.apk` is **byte-identical** to the APK the 90-route
matrix was captured on, and to the APK installed on the device. All three
independently hash to `de6c5fcd…` at 48,888,204 bytes:

1. `final-matrix-de6c5fcd/captures.json` build record → `de6c5fcd…`
2. freshly built `app/build/outputs/apk/release/app-release.apk` → `de6c5fcd…`
3. `base.apk` pulled from `emulator-5554` → `de6c5fcd…`

Design decision 5 said a rebuilt hash *may* match and that "a match is evidence,
not an assumption". It matched. This closes the provenance chain: the reviewed
route evidence, the device under test, and the terminal source are demonstrably
the same artifact.

## 7.4 Jest baseline

Confirmed exactly, from the composite's own full Jest step:

| Quantity | Required baseline | Measured |
| --- | --- | --- |
| Passed suites | 621 | **621** |
| Classified skipped suites | 4 | **4** |
| Passed tests | 7,237 | **7,237** |
| Classified skipped tests | 5 | **5** |
| Snapshots | 5 | **5** |

```
Test Suites: 4 skipped, 621 passed, 621 of 625 total
Tests:       5 skipped, 7237 passed, 7242 total
Snapshots:   5 passed, 5 total
```

The 4 skipped suites / 5 skipped tests are **classified**, not blind: each is an
opt-in performance/memory probe owned and dated in
`scripts/certification/jest-skip-allowlist.json` (schemaVersion 4, entries carry
`rationale`, `owner`, `reviewedAt`, and an `expires` of 2027-03-31), gated behind
`LARGE_BACKUP_PROBE=1` / `PERF_PROBE=1`. `validate-jest-signal.mjs` reports
`tracked_mutation_after_clean_run=PASS`. Nothing is hidden by retrying or
disabling.

Strict OpenSpec total recorded alongside: **61 passed, 0 failed (61 items)**,
superseding the old 60/60 figure for the reason given above.
