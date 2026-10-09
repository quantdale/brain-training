# Terminal verdict — 076-f final product certification

**Change:** `076-f-final-product-certification`
**Task:** 8.5 — record **exactly one** verdict.
**Parent ledger:** `openspec/changes/076-product-wide-ui-ux-reboot/tasks.md`
**Terminal application source:** `b293a02e1cd5df260a66dd886c1d279978b68994`
**Terminal APK:** `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`
(48,888,452 bytes, `com.braintraining.app` 0.1.0/1000, x86_64)

> **Reconciled 2026-10-09.** An earlier version of this file named terminal
> source `c324960…` and terminal APK `de6c5fcd…`, reported `5 PASS / 37 NOT
> VALIDATED`, and described the dependency closure as unchanged. All three were
> false: the 076-f defect repairs moved the artifact and changed the closure, and
> `assessment.json` had already been regenerated to **42 NOT VALIDATED** on
> `de6c5fcd…`. That history is preserved below, under *Historical record*. Do not
> read it as the current state.

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
dependency — it leaves repository-owned work undone.

**Current-device game acceptance is 42 NOT VALIDATED, 0 PASS, all graded on
`de6c5fcd…` — an APK that is not the terminal APK.** That alone fixes the
verdict. The clean-checkout composite is also not aligned with the declared gate
set yet.

## Gate-by-gate state at close

| Repository-owned gate | State | Where |
| --- | --- | --- |
| Evidence provenance table | **PASS** — 302 derived rows, identities read from `TERMINAL_IDENTITY.json` | `PROVENANCE.md` |
| Source equivalence (`4a6fc53` → terminal source) | **CHANGED** — 2 dependency-surface files; 194 game frames reclassified `SOURCE_NOT_EQUIVALENT` | `SOURCE_EQUIVALENCE.md` |
| Route matrix 90/90 + 2 scroll pairs | **PRESERVED for `de6c5fcd…`** — no route surface renders `SessionHeader`; `currentApplicability: false` | `ROUTES_AND_A11Y.md` |
| Accessibility audits (measured nodes, `de6c5fcd…`) | **PASS** — 90 surfaces, 0 violations, 32 occluded excluded | `ROUTES_AND_A11Y.md` |
| Reduced-motion accessibility | **NOT VALIDATED** on the terminal APK | `ROUTES_AND_A11Y.md` |
| Per-domain game-control labels + 48dp | **NOT VALIDATED** on the terminal APK | `ROUTES_AND_A11Y.md` |
| **Current-device game acceptance (42)** | **INCOMPLETE — 0 PASS / 42 NOT VALIDATED, none on the terminal APK** | `ASSESSMENT.md` |
| Defect repair discipline | **PASS with an open obligation** — 2 reproduced, 2 fixed, 2 verified gone; provenance then regenerated | `DEFECTS.md` |
| Clean-checkout composite | **FAIL (19/20)** at `a45232f` — one gate, upstream drift; alignment fix not yet applied | `GATES.md` |
| Hermetic Expo alignment gate | **PASS (22/22)** | `GATES.md` |
| Strict OpenSpec `--strict` | **PASS (61/61)** | `GATES.md` |
| Jest baseline | **622 suites / 7,241 tests / 5 snapshots** — the 621 / 7,237 baseline did not drop | `GATES.md`, `DEFECTS.md` |
| Terminal release APK identity | **recorded, re-measured by the section-3 rebuild** | `TERMINAL_IDENTITY.json` |
| Controller Flash smoke | **PASS** on the OpenDesign endpoint | `CONTROLLER.md` |
| Controller Pro smoke | **PASS** on the OpenDesign endpoint | `CONTROLLER.md` |
| Controller journeys (9 stateful) | **NOT VALIDATED** | `JOURNEYS.md` |
| iOS runtime | **NOT VALIDATED** (build PASS) | — |

The decisive unmet gates are repository-owned: **42-game current-device
acceptance** and the **aligned clean-checkout composite**.

## Independent review found and repaired over-claiming

Task 8.2 ran a three-lane read-only review (provenance / assessment / gates).
It found **six blocking findings**, and every one was repaired before the
earlier verdict was written. The most important one is worth stating plainly,
because it is the exact failure this change exists to prevent:

- **A game was marked PASS on evidence that did not support it, and its filed
  device frame was a different game.** `flexibility-card-sort` had no scored
  verdict (its quoted "verdict" was a rule-switch notice), no pause and no
  result — and its `result.png`/`result.xml` carried only
  `attention-target-count.*` testIDs. The frame has been moved to the game it
  actually shows; the row is `NOT VALIDATED`.
- **A second row quoted no scored verdict** and asserted the game shows no
  per-trial feedback, which is false — `stimulus-stage.tsx` renders
  `Go!` / `Held — nice` / `That was the stop number` / `Missed one` verdicts.
  `attention-sustained-vigilance` is downgraded to `NOT VALIDATED`.
- **The assessment generator let a manual PASS override its own structural
  check.** It now fails closed: a row lacking any required state cannot be
  promoted by a reviewer verdict, and scored feedback must be a **quoted**
  verdict, not prose about how feedback works.
- **The provenance generator claimed to "fail loudly" and did not.** A
  dependency-closure change was only logged while every game row stayed
  hard-coded `SOURCE_EQUIVALENT_HISTORICAL`. It now refuses to emit that label
  for a changed closure and exits non-zero.

Consequence: the parent ledger moves **backwards** where it must. Parent `6.2`
and task `3.2` are un-checked again, because their evidence no longer satisfies
the acceptance criteria. A checkbox that cannot survive review is not a
checkbox.

## The 2026-10-09 reconciliation moved it backwards again

The 2026-10-09 apply review found the ledgers had not followed `b7cf09b`. That
cost **17 more 076-f boxes** and **3 more parent boxes**, and it is recorded
finding-by-finding in [`RECONCILIATION.md`](RECONCILIATION.md). The clearest
single symptom: `assessment.json` had been regenerated to **42 NOT VALIDATED**
while `VERDICT.md` still advertised `5 PASS / 37 NOT VALIDATED`, and
`provenance-table.md` still labelled 194 game frames source-equivalent after the
closure that renders them had changed.

## What is genuinely established

This certification is not empty. It closes real, previously-open gaps:

- **Provenance is no longer a hypothesis.** It is derived from the committed
  manifests by `build-provenance.mjs`, and it now records the terminal identity
  from one file (`TERMINAL_IDENTITY.json`) that `build-assessment.mjs` reads too,
  so the two can no longer disagree.
- **The stale durable notes are corrected** as dated corrections, with the
  historical checkpoints left historical.
- **The clean-checkout composite actually ran** (it never had before — only its
  self-test had), and its OpenSpec pin is aligned to the declared CI gate with
  a self-test that now fails closed on drift.
- **The controller blocker is resolved**, not merely classified: the owner
  supplied a different provider (external OpenDesign endpoint,
  `mimo-v2.6-pro`), object detection stayed on the required Gemini ER model, and
  the credential lives only in `D:\Tools\artemis\.env`. Both smokes PASS.
- **The provenance chain was closed end to end** for the *previous* artifact: the
  rebuilt release APK was byte-identical to the reviewed route-evidence APK and
  to the APK pulled off the live device, all three `de6c5fcd…`. That is a real
  result and it is now correctly labelled as belonging to `de6c5fcd…`.

## What is not established, and why

- **42 of 42 games are NOT VALIDATED on the terminal APK.** Not "failed" —
  *not observed on the artifact that will ship*. Eight rows carry controller
  notes graded on `de6c5fcd…`; every one of them is superseded by the APK
  change, and 34 rows have no controller note at all.
- **The nine stateful journeys are NOT VALIDATED.** ADB gameplay is never
  substituted for the controller.
- **Reduced motion is NOT VALIDATED on the terminal APK.** It is OS-driven and
  must be observed with the device in "Remove animations", not asserted from the
  presence of a code hook. The 30 reduced-motion surfaces measured on
  `de6c5fcd…` stay bound to that APK.
- **Per-domain game-control labels and the Android 48dp floor are NOT VALIDATED
  on the terminal APK.** A zero-violation route audit does not certify game
  controls.
- **iOS runtime is NOT VALIDATED.**

## Named external boundary

**iOS runtime** is the one external boundary this certification cannot close
without a macOS runtime run. Android evidence cannot create an iOS pass.

The controller is **not** currently an external blocker: authentication
succeeded and both smokes passed. See
[`CONTROLLER.md`](CONTROLLER.md). Historical Google free-tier quota and HTTP 401
evidence is preserved there as history.

## Ending-SHA workflow record (task 8.4)

The last ending-SHA record published here was for `684396a7` (`684396a`), with
App CI `37758437026`, Repository Integrity `37758437146`, Android Build Smoke
`37758437133`, iOS Build Smoke `37758437093` — all green. **That is now a
historical record for a SHA that is not the ending SHA of this campaign.** The
current ending-SHA record is maintained in [`GATES.md`](GATES.md) §8.4 and is
re-recorded at the exit gate. Green runs at the *planning* commit `05bf793` or
at `b7cf09b` are deliberately never cited as certification evidence for a later
SHA.

**Boundary of this record.** Evidence-only commits after any code-bearing SHA
change only evidence prose and durable state, not application source, build
input, lockfile, workflow, or test — so they do not require a rebuild. That is
re-verifiable: if any later commit touches an application or build input, the
terminal identity changes and every gate bound to it is re-measured.

## Rollback / continuation

Nothing in the product was changed by this document. `main` is buildable and
startable. The work is recoverable from this directory alone: the assessment
regenerates from the filed rows, provenance regenerates from the committed
manifests plus `TERMINAL_IDENTITY.json`, and every claim above is tied to a file
in `evidence/`.

## What this verdict does not say

- It does not say the product is broken. Five games were reviewed and passed on
  `de6c5fcd…`; the rest are *unobserved on the terminal APK*, not defective.
- It does not withdraw any green gate. Everything that passed still passed.
- It does not certify release acceptance. The parent ledger remains the
  acceptance ledger, and no parent task is checked by this document.

---

## Historical record (2026-10-09, superseded — do not read as current)

The previous version of this file reported terminal source `c324960…`, terminal
APK `de6c5fcd…` (48,888,204 bytes), `5 PASS / 37 NOT VALIDATED`, Jest 621 / 7,237,
reduced motion NOT VALIDATED, 0 dependency-closure changes, and ending SHA
`684396a7`. Every one of those statements was true of the tree it described and
none is true of the tree this campaign is closing. It is retained here so the
correction is auditable.
