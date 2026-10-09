# Evidence reconciliation — 076-f (2026-10-09)

**Change:** `076-f-final-product-certification`
**Task:** the reconciliation required by
`.agent/CAMPAIGN076F_EVIDENCE_RECONCILIATION_AND_TERMINAL_CLOSURE_PROMPT.md` §2
**Reconciliation commit:** this document is committed with the unchecking edits
it explains.
**Authority of this file:** it records the state of the ledgers *at the moment
of reconciliation*. It is not acceptance, and it is superseded by any later
record. In particular, the `7.1` row below saying the Expo-gate fix "is not
yet applied" is historical: the aligned composite later passed 20/20 at
`690fb22`, and tasks `7.1` and `7.4` were rechecked against that run. The
terminal APK row is a host-hash match, not a new device pull.

---

## 1. Why this file exists

An apply review on 2026-10-09 found that the certification's control documents
had drifted out of agreement with the code, the artifact, and the controller.
The specific failure: **the supersede commit `b7cf09b` marked the previously
accepted game rows `SUPERSEDED-BY-APK-CHANGE` / `NOT VALIDATED` on
`de6c5fcd…`, and then did not touch the ledgers.** Tasks `3.1`, `3.3`, `3.4` and
`3.22` stayed checked, `VERDICT.md` still reported `5 PASS / 37 NOT VALIDATED`,
`STATE.md` still reported a byte-identical `de6c5fcd…` terminal APK, and
`provenance-table.md` still carried `SOURCE_EQUIVALENT_HISTORICAL` on every game
frame although the rendering closure had already changed.

A sweep filed on top of those claims would have repeated the exact failure this
certification exists to catch. So the ledgers were corrected **first**.

---

## 2. The measured truth this reconciliation is built on

| Fact | Value | How measured |
| --- | --- | --- |
| Last commit changing app/build inputs | `b293a02e1cd5df260a66dd886c1d279978b68994` | `git diff --name-only b293a02..HEAD -- apps/ package.json package-lock.json app.json .github/` → empty |
| Non-test production files changed since game-capture source `4a6fc53` | **4** | `git diff --name-only 4a6fc53..HEAD -- apps/ …` |
| Rendering-dependency surface changed since `4a6fc53` | **2** | `node scripts/certification/build-provenance.mjs` |
| Terminal APK after the defect repairs | `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 B) | host rebuild hash matched the `f760ee4` record; **not** a new `base.apk` pull |
| Controller | operational on the owner-directed external OpenDesign endpoint | `evidence/CONTROLLER.md` |
| Task-boxes checked before this reconciliation | 076-f **21/42**, parent **61/82** | the ledgers |

The dependency-surface diff, with the *measured effect* of each file:

| File | Effect | Measurement |
| --- | --- | --- |
| `apps/mobile/src/components/game-ui/session-header.tsx` | **render** | the single `flexWrap: wrap` strip was split into a wrapping INFO zone plus a pinned trailing zone; the pause control moved to a fixed edge. A layout change to every game session screen. |
| `apps/mobile/src/components/ui/button.tsx` | **input** | the diff only adds `hitSlop={EDGE_HIT_SLOP}`. RN `hitSlop` widens the touch target and takes no part in layout or paint — corroborated by the three regenerated visual-baseline snapshots whose entire diff is four added `hitSlop={4}` lines. |
| `apps/mobile/src/app/(tabs)/index.tsx` | route screen (outside the rendering closure) | Home numeral ink, changed before the route matrix was captured |
| `apps/mobile/src/app/progress-detail.tsx` | route screen (outside the rendering closure) | Progress-detail badge wrap, changed before the route matrix was captured |

---

## 3. Every checkbox unchecked here, and why

### 076-f `tasks.md` — 21 checked → **4 checked**

| Task | Why the existing evidence no longer satisfies it |
| --- | --- |
| **1.1** | The baseline/provenance re-verification predates the `session-header.tsx` and `button.tsx` repairs. The provenance it certified is the pre-repair tree. |
| **1.2** | The published table was generated against terminal identities `c324960` / `de6c5fcd` and then the artifact moved to `b293a02` / `e243341f`. The generator also omitted `apps/mobile/src/components/ui` from its dependency surface, so it reported a closure of "1 file" that should have been 2. Corrected and regenerated; the *content* of the table now satisfies the task, but the un-rebuilt artifact identity does not. |
| **1.3** | `SOURCE_EQUIVALENCE.md` recorded "zero files" in the rendering closure. Measured now: **2**. All 194 game frames therefore stop being source-equivalent and become `SOURCE_NOT_EQUIVALENT`. |
| **3.1** | Row graded on `de6c5fcd…`, superseded by `b7cf09b`. The game screen is an affected surface of both repairs. Not terminal-APK proof. |
| **3.3** | Same. |
| **3.4** | Same. |
| **3.22** | The published table described `de6c5fcd` rows as the assessment and reported `5 PASS / 37 NOT VALIDATED`. Measured `assessment.json`: **42 NOT VALIDATED**, all graded on `de6c5fcd…`, none on the terminal APK. The table is now honest about that, but no row is terminal-APK proof yet. |
| **4.1** | The code fixes stand and are **not** reverted. The observable consequence of the fixes — a new APK, affected surfaces, superseded rows — was filed, but the provenance record for the new artifact was not, so the task's own "update artifact provenance" condition was unmet. |
| **6.2** | Its condition is "if authentication remains externally blocked". Authentication was later **restored** by the owner-directed move to the external OpenDesign endpoint (`CONTROLLER.md`, Flash smoke `6f185691-…` and Pro smoke `251e3f10-…` both PASS). A checked `6.2` falsely asserts the blocked-auth branch is current. The historical 401/quota evidence stays labelled historical. `6.1` stays open. |
| **7.1** | The 19/20 composite was run at `a45232f`, not at the terminal SHA, and the script still hard-fails on network `expo-doctor` while CI classifies that failure as upstream drift. `07` §6.1 specifies the fix; it is not yet applied. |
| **7.3** | The recorded APK identity (`de6c5fcd…` / source `c324960`) is the *route-evidence* identity, not the post-fix candidate. |
| **7.4** | The Jest baseline it confirms is **621 / 7,237**. Measured after the additive guards: **622 suites / 7,241 tests / 5 snapshots**. The baseline did not drop, but the number written in the task and in `GATES.md` is not the tree's number. |
| **8.1** | The reconciliation it records is not a reconciliation of HEAD. |
| **8.2** | Same — the review was of the pre-reconciliation documents. |
| **8.3** | Durable state still carried the stale identity and a "closure unchanged" claim. |
| **8.4** | Ending-SHA CI was verified for `684396a7` / `b7cf09b`, not for the ending SHA of this campaign. |
| **8.5** | The verdict named the wrong artifact identity and a stale PASS count. |

`3.2` was already open and stays open. `2.1`, `2.2`, `5.1` and `7.2` stay
checked; `7.2` was re-verified — the composite's OpenSpec pin is still
`@fission-ai/openspec@1.9.0 validate --all --strict`, and the self-test's four
alignment checks still guard it.

### Parent `076-product-wide-ui-ux-reboot/tasks.md` — 61 checked → **58 checked**

| Task | Why |
| --- | --- |
| **6.1** | `attention-odd-one-out` — its `ASSESSMENT.md` row is `NOT VALIDATED` and says it is not terminal-candidate evidence. |
| **6.3** | `attention-symbol-tracker` — same. |
| **6.5** | `attention-visual-search` — same. |

No other parent task was checked or unchecked in this repair commit. `14.8` stays
checked **as a historical checkpoint only**; it is not proof that durable state
is current.

---

## 4. What changed in the tooling

| File | Change |
| --- | --- |
| `scripts/certification/build-provenance.mjs` | dependency surface gains `apps/mobile/src/components/ui`; identities move to the single `evidence/TERMINAL_IDENTITY.json`; new named class `SOURCE_NOT_EQUIVALENT`; per-row `currentApplicability` / `interactionClosureChanged`; a measured effect ledger that fails closed on an unmeasured change; **the non-zero exit is kept**. |
| `scripts/certification/build-assessment.mjs` | `assessment.json.apk` is now derived from the filed rows' `APK under test:` line instead of a hardcoded `de6c5fcd…`, and is reported beside `terminalApk`. |
| `specs/terminal-product-certification/spec.md` | names `SOURCE_NOT_EQUIVALENT` and the fail-closed conditions (new scenarios: *Historical frame is not terminal-APK evidence*, *Rendered closure changed*, *Change affects input handling only*, *Effect of a changed file is not measured*). No acceptance criterion was loosened. |
| `evidence/TERMINAL_IDENTITY.json` | new — the one place the terminal source SHA and APK SHA-256 are recorded. |

---

## 5. What this reconciliation does NOT claim

- It does not accept any game. `assessment.json` still reads **42 NOT VALIDATED**.
- It does not certify the terminal APK. The section-3 rebuild re-measures it.
- It does not close any journey, accessibility, or clean-checkout gate.
- It does not turn `de6c5fcd…` or `b2913bca…` frames into terminal-APK captures.
- It is not the terminal verdict. `VERDICT.md` keeps
  `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` until the exit gate.
