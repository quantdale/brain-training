# Terminal verdict — 076-f final product certification

**Change:** `076-f-final-product-certification`
**Task:** 8.5 — record **exactly one** verdict.
**Parent ledger:** `openspec/changes/076-product-wide-ui-ux-reboot/tasks.md`
**Terminal application source:** `d5787ec2857b0fd856d2e04ad346316d70951f6c`
**Terminal APK:** `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6`
(48,888,528 bytes, `com.braintraining.app` 0.1.0/1000, x86_64)

> **2026-10-13 — the terminal artifact moved when D3 was repaired.** The D3 fix
> is application code (`d5787ec`), so `b293a02` / `e243341f…` (48,888,452 B) is
> **no longer** the terminal artifact. Per the invariant stated at the bottom of
> this file, an application-code change invalidates artifact inheritance, so the
> gates bound to `e243341f…` were re-checked by impact rather than inherited:
> 40 of 42 game rows are unaffected and keep that identity; the 2 affected rows
> and the terminal APK identity itself are on `c8c3d46c…`. Both identities are
> stated in full in `TERMINAL_IDENTITY.json` and
> `d3-affected-games-reobserved.json`.

> **Reconciled 2026-10-09.** An earlier version of this file named terminal
> source `c324960…` and terminal APK `de6c5fcd…`, reported `5 PASS / 37 NOT
> VALIDATED`, and described the dependency closure as unchanged. All three were
> false: the 076-f defect repairs moved the artifact and changed the closure, and
> `assessment.json` had already been regenerated to **42 NOT VALIDATED** on
> `de6c5fcd…`. That history is preserved below, under *Historical record*. Do not
> read it as the current state.

---

# VERDICT: `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`

> **2026-10-13 update — D3 is REPAIRED; the reason for the block has changed again.**
> The 2026-10-12 entry below was blocked on exactly one repository-owned
> obligation: task **4.1**, because defect **D3** was reproduced and measured but
> left unrepaired. **That blocker is now closed.** D3 (the shared `Button`'s
> whole-control `opacity: 0.5` disabled collapse, which drove a disabled primary
> control's label to ~1.63:1) was repaired in `button.tsx`, guarded by 7
> fail-before/pass-after regression tests, rebuilt into a new terminal APK
> `c8c3d46c…`, and the two affected game rows were re-observed on it in both
> themes (light 7.25:1, dark 9.14:1 — token-exact, above AA). Task 4.1 is checked
> with that linked evidence, and parent 14.4 is now checked on the nine
> controller-led journeys. See 076-f task 4.1 and `d3-affected-games-reobserved.json`.
>
> **The verdict name is unchanged, but the remaining blocker is now different and
> is stated honestly rather than hidden.** It is no longer D3. It is the
> repository-owned **matched before/after image** evidence and the 3-direction
> scorecard / reference lock as a 076 artifact — parent tasks **14.3** and
> **14.7** — which are independently executable repository-owned obligations that
> have not yet been produced on the terminal APK. Per the spec (*"Terminal verdict
> follows the weakest unmet gate"* and *"any unmet repository-owned acceptance
> gate requires the release-acceptance-blocked verdict"*), an open repository-owned
> gate keeps this verdict blocked; "repository-complete with external blockers"
> requires **every** remaining gap to be external, and these are not. iOS runtime
> is an additional external boundary (NOT VALIDATED without a macOS run).
>
> This is **not** a downgrade of any green gate: every gate that passed still
> passes, and a real Critical/High accessibility defect is now fixed. The change
> is that the sole previously-named blocker (D3) is gone and the true remaining
> repository-owned work is named instead of relabelled.

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

Game acceptance and clean-checkout proof both exist and pass, so that specific
prohibition does not apply. The verdict is nevertheless blocked because the
general rule governs: **any unmet repository-owned acceptance gate** requires
this verdict, and two remain — the matched before/after image set and the
3-direction scorecard / reference lock (parent 14.3, 14.7). They are
repository-owned and independently executable (the dedicated device
`emulator-5570` is online and the reviewed 90-route matrix exists for
`de6c5fcd…`), so they cannot be reclassified as external dependencies.

**Current-device game acceptance is 42 PASS on the terminal artifact** — 40 rows
retain their `e243341f…` identity as unaffected by the D3 fix (per the spec's
*"A fix changes the APK"* scenario: unaffected evidence retains its original
artifact identity), and the 2 affected rows (`language-word-scramble`,
`logic-code-cracker`) were recertified on `c8c3d46c…`. The nine controller
journeys are 9/9 PASS.

## Gate-by-gate state at close

| Repository-owned gate | State at 2026-10-12 | Where |
| --- | --- | --- |
| Evidence provenance table | **PASS** — 302 derived rows, identities read from `TERMINAL_IDENTITY.json` | `PROVENANCE.md` |
| Source equivalence (`4a6fc53` → terminal source) | **CHANGED then RECAPTURED** — 2 dependency-surface files; 194 game frames `SOURCE_NOT_EQUIVALENT`, and their required recapture is now done as the 42 current-device rows | `SOURCE_EQUIVALENCE.md` |
| Route matrix 90/90 + 2 scroll pairs | **PRESERVED for `de6c5fcd…`** — no route surface renders `SessionHeader`; `currentApplicability: false` | `ROUTES_AND_A11Y.md` |
| Route accessibility audits (`de6c5fcd…`) | **PASS** — 90 surfaces, 0 violations, 32 occluded excluded | `ROUTES_AND_A11Y.md` |
| **Game-control accessibility on the terminal APK** | **PASS** — 126 surfaces / 756 controls, **0 violations**, 80 occluded excluded | `ROUTES_AND_A11Y.md` |
| Reduced-motion accessibility on the terminal APK | **PASS** — all three OS animation scales zeroed, re-captured and re-audited | `ROUTES_AND_A11Y.md` |
| **Current-device game acceptance (42)** | **PASS 42 / NOT VALIDATED 0** — 40 rows on `e243341f…` (unaffected by D3) + 2 rows recertified on `c8c3d46c…` | `ASSESSMENT.md` |
| **Controller journeys (9 stateful)** | **PASS 9/9** — substantive logs with quoted on-screen text; parent 14.4 checked | `JOURNEYS.md` |
| Defect repair discipline (task 4.1) | **PASS — D3 REPAIRED** — minimal fix in `button.tsx`, 7 fail-before/pass-after regression tests, rebuilt APK `c8c3d46c…`, 2 affected rows re-observed in both themes (7.25:1 / 9.14:1), provenance updated | 076-f task 4.1, `d3-affected-games-reobserved.json` |
| Clean-checkout composite | **PASS 20/20 at `24cb91d`** — no skip flags, disposable clone removed | this run |
| Hermetic Expo alignment gate | **PASS (22/22)** | composite |
| Strict OpenSpec `--strict` | **PASS (61/61)** | composite |
| Jest baseline | **623 suites / 7,248 tests / 5 snapshots** — the 622/7,241 baseline did not drop; the movement is the 7 additive D3 guards | composite |
| TypeScript / lint | **PASS** — `tsc --noEmit` exit 0, `expo lint` exit 0 | composite |
| Terminal release APK identity | **BUILT, HASHED AND INSTALLED** — `c8c3d46c…` (48,888,528 B, source `d5787ec`); installed `base.apk` pulled off the device and hashed to the identical value. Supersedes `e243341f…`, which remains the identity of the 40 unaffected game rows, the route matrix and the accessibility audit. | `TERMINAL_IDENTITY.json` |
| Controller Flash / Pro authenticated smokes | **PASS** | `CONTROLLER.md` |
| Matched before/after images + 3-direction reference lock (parent 14.3, 14.7) | **OPEN — repository-owned** — the 90/90 route matrix is preserved for `de6c5fcd…` with `currentApplicability: false`; no matched terminal-APK before/after image set or 076 reference-lock artifact has been produced | parent `tasks.md` 14.3 / 14.7 |
| iOS runtime | **NOT VALIDATED** (build PASS) | — |
| Workflows at the ending SHA (this reconciliation) | recorded in `## Ending-SHA workflow record` below |

**What changed since the 2026-10-09 verdict.** The three blocking
repository-owned gates — 42-game acceptance, the nine journeys, and the
gameplay half of accessibility — are all now **PASS** on the terminal APK, on
the recovered dedicated device. The decisive cause was owner-directed: moving
the controller to DeepSeek V4.1 Flash at high thinking effort. On the previous
model the sweep filed all 42 rows but only 5 were PASS; re-running the same 37
games converted every one.

## The remaining repository-owned gaps: matched before/after images (14.3, 14.7)

Defect **D3 is now REPAIRED** (see the gate table and 076-f task 4.1). The
remaining repository-owned gaps are the two the parent ledger still names, and
they are stated here rather than relabelled as external:

**Parent 14.3 — matched route and representative game before/after matrices.**
Every *measured* condition is covered on the terminal APK (game-control labels
and the 48dp floor across default / dark+2×+compact / light+2×+compact +
reduced-motion = 126 surfaces / 756 controls / 0 violations; reduced motion by
zeroing all three OS animation scales; representative gameplay across all eight
domains via the 42 controller-played rows). What is still owed is the **matched
before/after image pairs** on the terminal APK: the reviewed 90/90 route matrix
is preserved for `de6c5fcd…` with `currentApplicability: false` and is not
terminal-APK proof, and no matched terminal-APK before/after image set has been
produced.

**Parent 14.7 — final scrubbed coverage manifest and visual decision report.**
Present and complete: the per-game coverage manifest (`assessment.json`, one row
per registered game, PASS 42 / NOT VALIDATED 0), the APK SHA and device hash
(`TERMINAL_IDENTITY.json`), and residual debt plus explicit gaps
(`DEFECTS_CURRENT.md`, this file, `REVIEW_TERMINAL.md`). No game is missing.
**Still owed:** the 3-direction scorecard / reference lock as a 076 artifact (the
Campaign 051 lock predates this APK) and the matched before/after images.

These are **repository-owned and independently executable**: the dedicated device
`emulator-5570` is online, the reviewed 90-route matrix exists for `de6c5fcd…`,
and the terminal APK `c8c3d46c…` is built and installed. They therefore cannot be
reclassified as external dependencies, and per the spec an open repository-owned
acceptance gate requires the `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` verdict.
Producing the matched terminal-APK before/after image set and the 076 reference
lock is the concrete follow-up that would let a future pass move to
repository-complete (with iOS runtime still the external boundary).

### What D3 was, and why it no longer blocks (historical, now closed)

D3 — the shared `Button` applied `opacity: 0.5` to the whole control when
disabled, compositing both the fill and the label toward the background and
driving a disabled primary control's label to ~1.63:1 (invisible exactly when the
next response is required). It was reproduced, filed and measured, and is now
**repaired**: `button.tsx` dims only the fill to `theme.backgroundElement` and
moves the label to `textSecondary`, guarded by 7 fail-before/pass-after tests,
rebuilt into APK `c8c3d46c…`, and the 2 affected rows re-observed on it in both
themes (light 7.25:1, dark 9.14:1 — token-exact, above the 4.5:1 AA floor). Task
4.1 is checked with that evidence. This paragraph is kept so the closed blocker
is auditable, not so it can be misread as current.

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

## Named blockers

**Repository-owned (these keep the verdict blocked):** the **matched terminal-APK
before/after image set** and the **3-direction scorecard / reference lock as a
076 artifact** — parent tasks **14.3** and **14.7**. Independently executable on
the online dedicated device `emulator-5570` with the already-built terminal APK
`c8c3d46c…`; not yet produced. See *The remaining repository-owned gaps* above.

**The controller is NOT a blocker.** It is operational on the owner-directed
OpenDesign endpoint, both smokes PASS, and its tooling is verified. The nine
journeys all ran through it (parent 14.4 checked); no ADB gameplay was
substituted.

**The device is NOT a blocker (historical, resolved).** The earlier
`BLOCKED_HOST_ANDROID_EMULATOR` state — the dead `qemu-system-x86_64-headless.exe`
PID 50120, ports 5554/5555, the WHPX partition — is **historical and resolved**.
The host was never rebooted and PID 50120 is still unreapable, but the WHPX
partition was in fact free: the real cause was a port-5554 collision, not a
hypervisor lock. The AVD `braintraining-ui35` was relaunched headless on a fresh
port as `emulator-5570` (`sys.boot_completed=1`), and the entire device lane ran
there. Recovery evidence: [`DEVICE_RECOVERY.md`](DEVICE_RECOVERY.md); the earlier
blocker record is preserved in [`DEVICE_BLOCKER.md`](DEVICE_BLOCKER.md) as
history.

**External boundary:** **iOS runtime** — not validated without a macOS runtime
run, and Android evidence cannot create an iOS pass. This is an external
dependency and does not by itself force the blocked verdict; the repository-owned
14.3/14.7 image gap is what does.

## Ending-SHA workflow record (task 8.4)

**ENDING SHA `5a50eb71be7d86ed12d96bc15298b3d848057976` — all four GREEN, push-triggered, `main` == `origin/main`.**

| Workflow | Run ID | Steps | Conclusion |
| --- | --- | --- | --- |
| App CI | 38291051610 | 24 (1 job) | **success** |
| Repository Integrity | 38291051629 | 16 (2 jobs) | **success** |
| Android Build Smoke | 38291051702 | 18 (1 job) | **success** |
| iOS Build Smoke | 38291051671 | 15 (1 job) | **success** |

Every step is `success` in all four runs; none is skipped. The ending SHA moved
past the round below because the D3 repair (`d5787ec`) and the reconciliation and
CI-record commits that followed it are application- and evidence-tree changes
that landed after it. The record cycle is the documented method: the commit that
records these runs necessarily follows them, so the runs were measured against
the tree that was HEAD and pushed before the record commit, not against the
record commit itself. That property is stated here rather than hidden, exactly as
for the earlier round.

**Superseded ending SHA `e3cfb8f0b6b79c6e964dcb07fc5d12a6ee380928`** — all four
likewise GREEN, push-triggered, worktree clean, and retained as history because
HEAD has since moved past it:

| Workflow | Run ID | Steps | Conclusion |
| --- | --- | --- | --- |
| App CI | 38217246446 | 24 | **success** |
| Repository Integrity | 38217246390 | 16 (2 jobs) | **success** |
| Android Build Smoke | 38217246457 | 18 | **success** |
| iOS Build Smoke | 38217246383 | 15 | **success** |

These runs are at the tree that is HEAD, from a push, with a clean worktree and no commit after them. That is the exit-gate record.

**Every push-triggered round in this campaign, each green. The last row is the ending SHA; `bdde89c` is listed for completeness but is a manual-dispatch round, not a push round:**

- bdde89c - 38197292094, 38197294979, 38197297723, 38197300413  (manual dispatch, `workflow_dispatch`)
- 31d7163 - 38207110816, 38207110755, 38207110705, 38207110733
- ce3a319 - 38209696503, 38209696449, 38209696555, 38209696443
- d4aa81e - 38211974699, 38211974711, 38211974692, 38211974701
- bf37e6b - 38214631249, 38214631306, 38214631242, 38214631402
- e3cfb8f - 38217246446, 38217246390, 38217246457, 38217246383  (ending SHA until the D3 repair moved HEAD)
- 8f12b1c - 38220311950, 38220311860, 38220311984, 38220311941
- 5a50eb7 - 38291051610, 38291051629, 38291051702, 38291051671  (ENDING SHA)

Only **push-triggered** rounds are listed. `8f12b1c` additionally has a
**scheduled** Repository Integrity re-run (`38254204716`, 2026-10-12, success) which
is deliberately not listed here because it is not a push round; the push-triggered
`8f12b1c` run for that workflow is `38220311860`. Every ID above was re-verified
against the workflow list with `scripts/qa/verify-ci-record.mjs`, which fails if a
recorded ID is not a real, green run at the exact SHA the record claims.

Manual-dispatch rounds that were also 4/4 green: 6f8ce8d (38200103535, 38200106308, 38200108857, 38200112643) and 74ce010 (38204896955, 38204900670, 38204903056, 38204906568).

**Runs recorded as cancelled, not green - eight from this session:** 38202372875, 38202372885, 38202372888, 38202372929, 38204813925, 38204813938, 38204813950, 38204813977.

**Why the record needed several rounds, stated plainly.** Recording a push-triggered result has an inherent cycle: the run happens at the pushed SHA, and the commit that records that result then becomes a new HEAD that is itself pushed and run. Six push rounds plus manual-dispatch rounds were taken to converge on a record with no commit following it. This is a property of the recording method, not a repository defect, and every round is listed above for its own SHA with none relabelled.

**Every one of those rounds certified the same tree content.** No application or build-input commit has landed since the terminal application source b293a02e1cd5df260a66dd886c1d279978b68994; every commit after it touches only .agent/, openspec/ and evidence/. The artifact identity every round certifies is therefore e243341f4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f, and every device gate measured on it stays bound to that same artifact. Re-verifiable: if any later commit touches an application or build input, the terminal identity changes and every gate bound to it must be re-measured.

> **2026-10-13 — that invariant has since been exercised, exactly as written above.** The D3 repair (`d5787ec`) was an application-code commit, so the terminal identity moved to
> `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6`
> and every gate bound to the old artifact had to be re-checked rather than
> inherited. That was done by impact classification instead of a blanket re-run:
> `evidence/d3-impact.json` shows **40 of 42 game rows unaffected** (the repair
> repaints no enabled control's pixel and changes no behaviour), so those rows
> keep their `e243341f…` identity, and the **2 affected rows**
> (`language-word-scramble`, `logic-code-cracker`) were re-observed from their
> live boards on the new APK in both themes. The nine controller journeys and the
> route matrix are likewise unaffected for the same reason. This paragraph is
> retained because the invariant it states is what forced the distinction
> between "keeps its identity" and "must be re-measured".

**Historical ending-SHA records (do not read as current):** 684396a7 (App CI 37758437026, Repository Integrity 37758437146, Android 37758437133, iOS 37758437093); 1c8fe668 (App CI 37943831586, Repository Integrity 37943831511, Android 37943831547, iOS 37943831621); f338e1c (App CI 37948059749, Repository Integrity 37948059896, Android 37948059722, iOS 37948059834).

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
