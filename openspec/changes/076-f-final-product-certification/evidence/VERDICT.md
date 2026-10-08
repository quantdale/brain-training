# Terminal verdict — 076-f final product certification

**Change:** `076-f-final-product-certification`
**Task:** 8.5 — record **exactly one** verdict.
**Parent ledger:** `openspec/changes/076-product-wide-ui-ux-reboot/tasks.md`
**Terminal application source:** `c324960c7619d305f01d60587f9e74c4ca93ca6a`
**Terminal APK:** `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
(48,888,204 bytes, `com.braintraining.app` 0.1.0/1000, x86_64)

---

# VERDICT: `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`

---

This is the single verdict. It is not a partial verdict, not a
"repository-complete" claim with conditions attached, and not a downgrade of
anything previously green.

## Why this verdict and not another

The change allows exactly three terminal verdicts:

1. **Full validation** — every mandatory acceptance gate passes.
2. **Repository-complete with named external blockers** — every independently
   executable *repository-owned* requirement passes and every remaining gap is
   an external dependency.
3. **`CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`** — any unmet repository-owned
   acceptance gate.

And it fixes the tie-breaker explicitly:

> Missing game or clean-checkout proof forbids repository-complete.

Game acceptance is **repository-owned work**. A missing or invalid controller
credential does not convert un-observed game acceptance into an external
dependency — it leaves repository-owned work undone. The design states the
consequence directly:

> If [the controller] remains blocked … **leave game rows and task 14.4
> unaccepted**. The verdict remains `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`
> because game acceptance is repository-owned work that has not been observed.

**Current-device game acceptance is incomplete.** That alone fixes the verdict.

## Gate-by-gate state at close

| Repository-owned gate | State | Where |
| --- | --- | --- |
| Evidence provenance table | **PASS** — 302 derived rows | `PROVENANCE.md` |
| Source equivalence (4a6fc53 → terminal source) | **PASS** — 0 dependency-closure changes | `SOURCE_EQUIVALENCE.md` |
| Route matrix 90/90 + 2 scroll pairs | **PRESERVED** — 0 recaptures needed | `ROUTES_AND_A11Y.md` |
| Accessibility audits (measured nodes) | **PASS** — 90 surfaces, 0 violations, 32 occluded excluded | `ROUTES_AND_A11Y.md` |
| Reduced-motion accessibility | **NOT VALIDATED** | `ROUTES_AND_A11Y.md` |
| Per-domain game-control labels + 48dp | **NOT VALIDATED** | `ROUTES_AND_A11Y.md` |
| **Current-device game acceptance (42 games)** | **INCOMPLETE — 4 PASS, 38 NOT VALIDATED** | `ASSESSMENT.md` |
| Defect repair discipline | **PASS** — no defect reproduced, no production edit | `DEFECTS.md` |
| Clean-checkout composite | **FAIL (19/20)** — one gate, upstream drift | `GATES.md` |
| Hermetic Expo alignment gate | **PASS (22/22)** | `GATES.md` |
| Strict OpenSpec `--strict` | **PASS (61/61)** | `GATES.md` |
| Jest baseline | **PASS — exact match** (621/4 suites, 7,237/5 tests, 5 snapshots) | `GATES.md` |
| Terminal release APK identity | **PASS — byte-identical rebuild** | `GATES.md` |
| Controller Flash smoke | **PASS** | `CONTROLLER.md` |
| Controller Pro smoke | **PASS** | `CONTROLLER.md` |
| Controller journeys (9 stateful) | **NOT VALIDATED** | `JOURNEYS.md` |
| iOS runtime | **NOT VALIDATED** (build PASS) | — |

The decisive unmet gate is the third row of the blocking group: **42-game
current-device acceptance is incomplete**, and it is repository-owned.

## What is genuinely established

This certification is not empty. It closes real, previously-open gaps:

- **Provenance is no longer a hypothesis.** It is derived from the committed
  manifests by `build-provenance.mjs`, and the rendering-dependency closure is
  machine-verified **unchanged** since the game-capture source. All 194 game
  frames are now explicitly classified `SOURCE_EQUIVALENT_HISTORICAL` and are
  explicitly **not** terminal-APK captures. That was the exact failure that
  reopened Campaign 076.
- **The provenance chain is closed end to end.** The rebuilt release APK is
  **byte-identical** to the reviewed route-evidence APK and to the APK pulled
  off the live device — all three `de6c5fcd…` at 48,888,204 bytes. The reviewed
  evidence and the terminal source are demonstrably the same artifact.
- **The stale durable notes are corrected** as dated corrections, with the
  historical checkpoints left historical. Evidence SHA `7e7374b` has its own
  four green runs and no longer "lacks remote verification".
- **The clean-checkout composite actually ran** (it never had before — only its
  self-test had), and its OpenSpec pin is aligned to the declared CI gate with a
  self-test that now fails closed on drift.
- **The controller blocker is reclassified correctly.** The credential is not
  invalid; the blocker is free-tier **quota**. The exact external repair is
  named and needs no repository change.

## What is not established, and why

- **38 of 42 games are NOT VALIDATED.** Not "failed" — *not observed*. The
  authorised controller is throttled to 15 LLM requests/minute on the only
  model with budget, and its circuit breaker opens under that pressure, so runs
  stall before recording states. Three distinct failure modes were caught by
  review and refused as evidence: an unfilled note skeleton, a run that died
  before writing a note, and — most importantly — one run that **mis-navigated
  and played a different game**, producing a detailed, entirely plausible note
  about the wrong board. That last one is exactly the class of error this
  change exists to prevent, and it is recorded as `NOT VALIDATED`.
- **The nine stateful journeys are NOT VALIDATED.** ADB gameplay is never
  substituted for the controller, so they wait on the same external repair.
- **Reduced motion is NOT VALIDATED.** It is OS-driven and must be observed
  with the device in "Remove animations", not asserted from the presence of a
  code hook.
- **iOS runtime is NOT VALIDATED.**

## Named external blocker and exact repair

**Blocker:** the configured Google credential is on the **free tier**.

| Model | Measured budget | Kind |
| --- | --- | --- |
| `gemini-3.8-flash` | 20/day | daily cap |
| `gemini-3.7-flash` | 20/day | daily cap |
| `gemini-3.5-flash-lite` | 500/day | daily cap |
| `gemini-3.1-flash-lite` | 15/minute | rate limit (only workable lane) |

**Exact repair (owner action, credentials/payment):** move the configured Google
credential to a paid plan, **or** supply a credential with paid-tier quota,
configured **only** in the external ARTEMIS environment file
(`D:\Tools\artemis\.env`). No repository change is required to accept it.

Then resume from `tasks.md` sections 3 and 6: re-run the current-device sweep
(`scripts/qa/cert076f-repair.sh` already carries the tightened identity-check
prompt), then the nine journeys (`scripts/qa/cert076f-journeys.sh`), then
regenerate the assessment (`node scripts/certification/build-assessment.mjs`).

**Disclosure of the one external environment change made during this
certification:** ARTEMIS's `config/artemis.jsonc` default model was rerouted to
a model the credential can actually serve, because the shipped default is
day-capped at 20 requests and ARTEMIS's SDK retries the *same* model rather
than falling back. Same provider, same credential, same controller. Original
preserved as `artemis.jsonc.bak-cert076f`. This is recorded prominently because
the previous checkpoint logged "no provider configuration changed" as a
positive property and that is no longer true of this run.

## Rollback / continuation

Nothing in the product was changed, so there is nothing to roll back. `main` is
buildable and startable. The work is recoverable from this directory alone: the
assessment regenerates from the filed rows, provenance regenerates from the
committed manifests, and every claim above is tied to a file in `evidence/`.

## What this verdict does not say

- It does not say the product is broken. Four games were reviewed and passed;
  the rest are *unobserved*, not defective.
- It does not withdraw any green gate. Everything that passed still passed.
- It does not certify release acceptance. The parent ledger remains the
  acceptance ledger, and no parent task is checked by this document.
