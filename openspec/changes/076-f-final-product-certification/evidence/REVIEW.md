# Independent read-only review — 076-f

**Change:** `076-f-final-product-certification`
**Task:** 8.2 — read-only review of provenance, accessibility and layout, build
and security gates, and parent-task mapping. **Repair repository-owned Critical
or High findings before acceptance.**

## How the review was run

Three independent read-only reviewers in parallel, each on one area, each
explicitly forbidden from editing and each required to cite the authoritative
evidence behind every finding:

| Lane | Area | Blocking (CRIT/HIGH) | Non-blocking |
| --- | --- | --- | --- |
| provenance | `PROVENANCE.md`, `SOURCE_EQUIVALENCE.md`, `provenance-table.*`, `build-provenance.mjs` | 1 | 0 |
| assessment | `ASSESSMENT.md`, `assessment.json`, `current-device/**`, `ROUTES_AND_A11Y.md`, `build-assessment.mjs` | 6 | 1 |
| gates | `GATES.md`, `DEFECTS.md`, `CONTROLLER.md`, `JOURNEYS.md`, `PARENT_RECONCILIATION.md`, `tasks.md` | 0 | 5 |

**Total: 7 blocking, 6 non-blocking. Every blocking finding was repaired before
acceptance, and the repairs are described below.**

## What the review confirmed sound

Not everything was broken, and the reviewers said so without padding:

- **Provenance is real.** 302 rows recounted exactly (90 route + 2 route-scroll
  + 194 game + 16 rejected), splitting 92 `CURRENT_APK` / 194
  `SOURCE_EQUIVALENT_HISTORICAL` / 16 `NOT_APPLICABLE`. No game row binds the
  terminal APK. The 22 closure rows bind `b2913bca…` and match the parent
  closure table exactly. The two artifact identities are kept distinct
  everywhere; **no frame is described as a capture from an APK that did not
  produce it.**
- **Accessibility claims are properly bounded.** The 48dp/label claim is
  restricted to measured nodes; the 32 occluded nodes are enumerated with
  reasons and are provably kept out of the violation/pass count
  (`a11y-audit.mjs` never folds them in); the file does **not** claim the route
  audit certifies game controls; reduced motion is honestly open.
- **The composite is reported honestly** as `FAIL — 19/20`, with the self-test
  explicitly separated and never conflated with certification. The Expo Doctor
  classification quotes the repository's own settled Change-069 wording, and
  the hermetic `validate-expo-alignment.mjs` gate is a *separate* result.
- **Jest/OpenSpec numbers are exact** and the old 60/60 is explicitly not
  forced.
- **`CONTROLLER.md` discloses the external QA-environment change** prominently
  with the full model-routing chain and the preserved backup. A repo-wide scan
  found **no credential material** — only scrubbed session UUIDs and model/quota
  names.
- **No parent task was pre-classified DONE without evidence**, and bulk-checking
  is explicitly prevented.

## Blocking findings and their repairs

### F1 — CRITICAL — a game marked PASS with no scored verdict, no pause, no result
`flexibility-card-sort` was `PASS`. Its note stops after the active board; the
quoted "verdict" was `Rule switched! Match by SHAPE`, which is a **rule-switch
notice**, not a correct/incorrect/timeout verdict. No Pause section, no Final
Result section.
→ **Repaired:** downgraded to `NOT VALIDATED`.

### F2 — CRITICAL — the filed device frame was a different game
`flexibility-card-sort/result.{png,xml}` carried only `attention-target-count.*`
testIDs (`results`, `result-headline`, `accuracy`, `rounds-correct 0/8`,
`restart`, `quit`). It is `attention-target-count`'s result screen — which is
also why `attention-target-count` reported "no row yet" while its frame sat in
the wrong folder.
→ **Repaired:** the frame pair was moved to `current-device/attention-target-count/`
where it belongs; the card-sort row now has no frame and needs a fresh run.

### F3 — CRITICAL — a PASS with no quoted scored verdict, and a false UI claim
`attention-sustained-vigilance` §2 quoted no verdict and asserted feedback is
"continuous … rather than intermittent popups". Verified against source: `components/stimulus-stage.tsx`
renders per-trial verdicts `Go!` / `Held — nice` / `That was the stop number` /
`Missed one` with ✓/✕/⏱ badges and spoken verdicts. The claim is factually
wrong, and per the spec feedback is **not inferred**.
→ **Repaired:** downgraded to `NOT VALIDATED`.

### F4 — CRITICAL — the filed frame was the Home screen
`attention-sustained-vigilance/result.{png,xml}` contain only home-route nodes
(`home-brand`, `home-title`, `home-workout-cta`, "0 of 4 complete") and zero
game testIDs — captured after the journey's exit step. It cannot serve as an
independent check of any claimed state.
→ **Repaired:** recorded as a frame caveat on the row; not cited as corroboration.

### F5 — HIGH — the "4 PASS" headline was unsupported
Only two rows survived scrutiny.
→ **Repaired:** the assessment, the verdict and the narrative now read
**2 PASS, 40 NOT VALIDATED**.

### F6 — HIGH — the assessment generator was fail-open
`classify()` returned a manual `PASS` unconditionally, discarding its own
`structure()` failure — the mechanism that let F1 through. It also never
enforced the quoted-verdict rule its own output states.
→ **Repaired:** the generator now **fails closed** — a row missing any required
state cannot be promoted by a reviewer verdict, and the Scored Feedback section
must contain a **quoted** verdict rather than prose about feedback.

### Provenance Finding 1 — HIGH — a "fails loudly" claim that did not
`build-provenance.mjs` only logged the dependency-surface diff while hard-coding
every game row `SOURCE_EQUIVALENT_HISTORICAL` and `recaptureRequired: 'no'`. A
future rendering edit would have been silently recorded as equivalence — the
exact silent rot the narrative claimed was impossible.
→ **Repaired:** a non-empty closure diff now exits non-zero and refuses to emit
equivalence labels. The narrative wording now says *enforced*, and means it.

## Non-blocking findings, dispositioned

| ID | Finding | Disposition |
| --- | --- | --- |
| Gates F1 (MEDIUM) | `14.8` cited an ending-SHA record in `GATES.md`/`VERDICT.md` that does not exist | **Fixed** — pointer corrected; `14.8` must not be checked until that record exists and is linked in the same commit |
| Gates F2 (MEDIUM) | same "cannot rot" false claim in `SOURCE_EQUIVALENCE.md` | **Fixed** — resolved by making the enforcement real |
| Gates F3 (LOW) | `GATES.md` row 20 conflated the jest-signal gate with the separate tracked-mutation check | **Fixed** — split into two rows; tally described as 20 labeled gates + 1 separate check |
| Gates F4 (LOW) | "deliberately not pre-filled" was stale once the column was filled | **Fixed** — now says the column is filled per-row as evidence lands |
| Gates F5 (LOW) | PASS basis text under-described the filed rows | **Addressed** — two of the three rows it cited were downgraded by F1/F3 anyway; remaining basis text cites the quoted evidence |
| Assessment F7 (LOW) | stale placeholder strings in reason text vs the re-filed notes | **Fixed** — regeneration now emits the current reason (`controller produced no usable review note`) |

## The correction that cost the most

Review is only worth what it is willing to overturn. This one moved the
acceptance ledger **backwards**:

- parent `6.2` and task `3.2` were checked on the strength of the
  sustained-vigilance row. After F3/F4 that evidence no longer satisfies the
  acceptance criteria, so **both were un-checked**.
- parent ledger: 60/22 → **59/23**.
- 076-f tasks: 13/29 → **12/30**.

A checkbox that cannot survive independent review is not a checkbox.

## Acceptance consequence

No repository-owned Critical or High finding remains open — all seven were
repaired. But the repairs *reduced* the certified coverage, so the terminal
verdict stands unchanged and is if anything better supported:

**`CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`** — see [`VERDICT.md`](VERDICT.md).
