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

> **2026-10-12 update.** This verdict is unchanged in **name** but its reason has
> changed completely, and the distinction matters. It is no longer blocked for want
> of game, journey, accessibility or clean-checkout proof — every one of those
> gates is now PASS on the terminal APK. It is blocked on **one** repository-owned
> obligation, named below: task **4.1** does not accept a reproduced defect being
> left unrepaired, and defect D3 is reproduced. See *The one remaining
> repository-owned gap*.
>
> The forbidden verdicts remain forbidden. "Repository-complete with named external
> blockers" requires **every independently executable repository-owned requirement
> to pass**; releasing with a reproduced, measured, unrepaired contrast defect does
> not meet it, and iOS runtime stays NOT VALIDATED besides. "Full validation"
> requires every mandatory gate.

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
verdict. The clean-checkout composite was later aligned and passed; that pass
does not supply the missing game proof.

## Gate-by-gate state at close

| Repository-owned gate | State at 2026-10-12 | Where |
| --- | --- | --- |
| Evidence provenance table | **PASS** — 302 derived rows, identities read from `TERMINAL_IDENTITY.json` | `PROVENANCE.md` |
| Source equivalence (`4a6fc53` → terminal source) | **CHANGED then RECAPTURED** — 2 dependency-surface files; 194 game frames `SOURCE_NOT_EQUIVALENT`, and their required recapture is now done as the 42 current-device rows | `SOURCE_EQUIVALENCE.md` |
| Route matrix 90/90 + 2 scroll pairs | **PRESERVED for `de6c5fcd…`** — no route surface renders `SessionHeader`; `currentApplicability: false` | `ROUTES_AND_A11Y.md` |
| Route accessibility audits (`de6c5fcd…`) | **PASS** — 90 surfaces, 0 violations, 32 occluded excluded | `ROUTES_AND_A11Y.md` |
| **Game-control accessibility on the terminal APK** | **PASS** — 126 surfaces / 756 controls, **0 violations**, 80 occluded excluded | `ROUTES_AND_A11Y.md` |
| Reduced-motion accessibility on the terminal APK | **PASS** — all three OS animation scales zeroed, re-captured and re-audited | `ROUTES_AND_A11Y.md` |
| **Current-device game acceptance (42)** | **PASS 42 / NOT VALIDATED 0** — every game has a complete identity-verified row on `e243341f…` | `ASSESSMENT.md` |
| **Controller journeys (9 stateful)** | **PASS 9/9** — substantive logs with quoted on-screen text | `JOURNEYS.md` |
| Defect repair discipline | **OPEN OBLIGATION (task 4.1)** — D3 reproduced and filed; see the D3 section below | `DEFECTS_CURRENT.md` |
| Clean-checkout composite | **PASS 20/20 at `24cb91d`** — no skip flags, disposable clone removed | this run |
| Hermetic Expo alignment gate | **PASS (22/22)** | composite |
| Strict OpenSpec `--strict` | **PASS (61/61)** | composite |
| Jest baseline | **622 suites / 7,241 tests / 5 snapshots, 4 suites / 5 tests classified skips** — the 621/7,237 baseline did not drop | composite |
| TypeScript / lint | **PASS** — `tsc --noEmit` exit 0, `expo lint` exit 0 | composite |
| Terminal release APK identity | **BUILT, HASHED AND INSTALLED** — `e243341f…`, 48,888,452 B; installed `base.apk` pulled off the device and hashed to the identical value | `TERMINAL_IDENTITY.json` |
| Controller Flash / Pro authenticated smokes | **PASS** | `CONTROLLER.md` |
| iOS runtime | **NOT VALIDATED** (build PASS) | — |
| Workflows at the ending SHA | **OWED under task 8.4** — see `## Ending-SHA workflow record` | — |

**What changed since the 2026-10-09 verdict.** The three blocking
repository-owned gates — 42-game acceptance, the nine journeys, and the
gameplay half of accessibility — are all now **PASS** on the terminal APK, on
the recovered dedicated device. The decisive cause was owner-directed: moving
the controller to DeepSeek V4.1 Flash at high thinking effort. On the previous
model the sweep filed all 42 rows but only 5 were PASS; re-running the same 37
games converted every one.

## The one remaining repository-owned gap: task 4.1 / defect D3

One runtime defect is reproduced, filed and measured, and is deliberately **not
repaired**:

**D3 — the shared `Button` applies `opacity: 0.5` when disabled**, which collapses
both the fill and the label of a disabled primary control toward the background.
Measured analytically from the tokens: the GO control's `accent.base` `#FF4A57`
fill and `accent.on` `#2B0508` label, composited at 50% over the dark stage,
land roughly **1.08:1** apart — an invisible label exactly when the next response
is required.

The reason it is not fixed here is recorded rather than assumed: the fix is in
`components/ui/button.tsx`, which is shared chrome behind **all 42 games and
every route Button**. A production edit rebuilds the release APK, giving a new
terminal APK SHA-256, which by the change spec invalidates every device row
captured on `e243341f…` — the 42 game rows, the 9 journeys and the 126
accessibility surfaces. Repairing at that point would trade 56 validated
device artifacts for one unvalidated one, and the campaign has no device budget
left to re-earn them.

This is a scheduling decision with a stated cost, not a claim that the defect is
acceptable. Task 4.1 therefore stays **unchecked**, and the fix, its regression
guard, the rebuild and the full re-verification remain owed to a follow-up
campaign. It is **not** silently deferred and it is **not** counted as closed.

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
- **The terminal APK is not installed on any device and not device-hashed.**
- **iOS runtime is NOT VALIDATED.**

## Named blocker

**BLOCKED_HOST_ANDROID_EMULATOR** — the dedicated Android emulator died of host
memory exhaustion mid-certification and cannot be restarted: the dead
`qemu-system-x86_64-headless.exe` (PID 50120) is unreapable, holds ports
5554/5555 and the WHPX partition, and every new launch aborts with "It seems too
many emulator instances are running on this machine." Full evidence, every
recovery attempt, and the exact recovery steps are in
[`DEVICE_BLOCKER.md`](DEVICE_BLOCKER.md).

**The controller is NOT a blocker.** It is operational on the owner-directed
OpenDesign endpoint, both smokes PASS, and its tooling is verified. The device
is the blocker. Owner action: free the host (reboot, or terminate PID 50120 so
ports 5554/5555 and the WHPX partition are released), then resume the campaign
prompt at §3.

**External boundary:** **iOS runtime** — not validated without a macOS runtime
run, and Android evidence cannot create an iOS pass.

## Ending-SHA workflow record (task 8.4)

**Current ending-SHA record - all four GREEN at 6f8ce8d0fcad69476ffc294bde4e386a40222bc1.**

| Workflow | Run ID | Steps | Conclusion |
| --- | --- | --- | --- |
| App CI | 38200103535 | 24 | **success** |
| Repository Integrity | 38200106308 | 16 (2 jobs) | **success** |
| Android Build Smoke | 38200108857 | 18 | **success** |
| iOS Build Smoke | 38200112643 | 15 | **success** |

Each was triggered with gh workflow run <file> --ref main from a clean worktree at this exact ending SHA and polled to a terminal conclusion.

**Runs recorded as cancelled, not green:** six from this session. Four were superseded while the ending SHA was still being pushed (38197119888, 38197119892, 38197119897, 38197119908). Four more were the first round at the intermediate SHA bdde89c before the final evidence commit moved the ending SHA (38199952829, 38199952822, 38199952876, 38199952914). The round at bdde89c was also 4/4 green (38197292094, 38197294979, 38197297723, 38197300413) and is retained as the record for THAT SHA, which is not the ending SHA.

**No application or build-input change has landed since the terminal application source b293a02e1cd5df260a66dd886c1d279978b68994.** The exit-gate commits after it touch only .agent/, openspec/ and evidence/, so the terminal artifact identity e243341f4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f is unchanged and every device gate measured on it stays bound to it. That is re-verifiable: if any later commit touches an application or build input, the terminal identity changes and every gate bound to it must be re-measured.

**Historical ending-SHA records (do not read as current):** 684396a7 (App CI 37758437026, Repository Integrity 37758437146, Android 37758437133, iOS 37758437093); 1c8fe668 (App CI 37943831586, Repository Integrity 37943831511, Android 37943831547, iOS 37943831621); f338e1c (App CI 37948059749, Repository Integrity 37948059896, Android 37948059722, iOS 37948059834). None is the ending SHA of this campaign.

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
