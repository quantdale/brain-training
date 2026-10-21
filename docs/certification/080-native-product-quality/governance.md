# Governance & release-evidence reconciliation — Campaign 080

Campaign: `080-native-product-quality`
Baseline `origin/main`: `f8ae95dde236ce04eb9d7308cf2186b6e68f2905`
Prepared: 2026-10-21
Scope: Workstream H (release governance and certification-evidence correction).

This document records two governance/evidence items that are independent of the
device QA streams and are backed by verifiable repository/API state: (H1) the
final-SHA reconciliation of Campaign 079's certification, and (H2) the
branch-protection / administrator-bypass posture.

---

## H1 — Final-SHA reconciliation (bounded addendum)

### The apparent discrepancy

Campaign 079's authoritative reports (`docs/certification/079-release-certification/`)
reference the qualified implementation SHA `9c4dd138`, while the final
`origin/main` at Campaign 079 close (and the Campaign 080 baseline) is
`f8ae95dd`. Both are legitimate chronological revisions. This addendum
reconciles them without rewriting historical evidence.

### Revisions in play

| Role | SHA | What it is |
|---|---|---|
| 079 qualified implementation revision | `9c4dd138` | The commit the 079 runtime acceptance, native journeys, and performance measurements were executed against. |
| 079 closing documentation revision | `f8ae95dd` | The commit that added the 079 certification report suite and closed the campaign. |
| 079 final integrated revision | `f8ae95dd` | Same as the closing documentation revision — the tip that became `origin/main`. |
| 080 activation revision | `105ff23b` | The commit that activated Campaign 080 (governance + OpenSpec only). |

### Did application/runtime sources change between the qualified and final revisions?

**No.** The diff `9c4dd138..f8ae95dd` touches **18 files: 11 Markdown + 7 JSON**
(governance state, the 079 certification reports, OpenSpec `change.json`/`tasks.md`,
and captured perf baseline JSON). **Zero files under `apps/mobile/src/**` or any
other application/runtime source changed.** Therefore:

- Campaign 079's runtime observations (native acceptance journeys on the AVD,
  emulator frame measurements, cold-start/PSS readings) remain applicable to the
  application behavior of `f8ae95dd`, because the application bytes are identical.
- The 079 performance numbers were measured against the same app code that
  `f8ae95dd` ships; only documentation and governance metadata differ.

### Which checks were actually rerun at the final revision?

The four hosted workflows were re-run and **passed** at `f8ae95dd`:

| Workflow | Run # | Run ID | Status |
|---|---|---|---|
| App CI | 601 | 39553587740 | success |
| Android Build Smoke | 448 | 39553587657 | success |
| iOS Build Smoke | 449 | 39553587616 | success |
| Repository Integrity | 609 | 39553587804 | success |

(Verified via GitHub Actions API for `head_sha=f8ae95dd` on 2026-10-21.)

The full Jest matrix and OpenSpec strict validation recorded in the 079 reports
were executed at `0e1c8784`/`9c4dd138`. Because no application source changed
between `9c4dd138` and `f8ae95dd`, those source-level results carry forward;
they were **not** silently relabeled as having been re-executed at `f8ae95dd`.
The hosted CI above is the authoritative re-run evidence at the final revision.

### Self-reference caveat

A document committed at revision `R` cannot reliably contain `R`'s own final Git
SHA. Accordingly this addendum distinguishes the **candidate revision** (`9c4dd138`,
where runtime work ran), the **documentation revision** (`f8ae95dd`, where the
reports were written), and the **externally observed final integration status**
(the four workflow run IDs above, and the Campaign 080 terminal record). The
actual terminal SHA of each campaign is recorded in `.agent/STATE.md` and the
campaign handoff after integration, not self-referentially inside the commit.

---

## H2 — Branch protection and administrator-bypass posture

### Current configuration (GitHub API read-back, 2026-10-21)

**Classic branch protection (`GET branches/main/protection`):**
- `required_status_checks.strict = true` (branch must be up to date before merge)
- Required contexts (4): `Mobile app build/typecheck/tests`, `Android clean native
  build`, `iOS Simulator compile smoke`, `durable-state`
- `required_pull_request_before_merging` — not enabled (direct pushes allowed)
- `enforce_admins.enabled = false` — **administrators are exempt from the
  required-status-check rule for direct pushes**
- `allow_force_pushes = false`, `allow_deletions = false`

**Ruleset `25523614` ("protect main", `GET rulesets/25523614`):**
- `enforcement = active`, applies to the default branch
- Rules: `non_fast_forward` (block force-push), `deletion` (block branch deletion)
- `bypass_actors = []`, `current_user_can_bypass = "never"`

### Assessment

**Strong and verified:**
- Force-push and branch deletion are blocked **for everyone, including
  administrators** (ruleset `25523614`, `current_user_can_bypass: never`). A
  history rewrite of `main` is impossible without an explicit, owner-authorized
  temporary ruleset change.
- The four required status checks with strict up-to-date enforcement gate every
  **pull request** merge. Human/normal changes arrive as PRs and are fully gated.

**Known gap (honest):**
- Because `enforce_admins.enabled = false`, an **administrator can push commits
  directly to `main` without the required status checks being green at push
  time.** This is the documented administrator bypass. It is intentional: it
  preserves the repository's autonomous direct-push integration model
  (AGENTS.md: "Push successful swarm waves to `origin/main`"). It is compensated
  by the `greenMain` local-check rule in `.agent/GOVERNANCE.json` (typecheck +
  test + risk-based checks must pass before a coherent push) and by CI-on-push,
  but the local rule is governance discipline, **not machine-enforced against
  administrators**. This document does not claim universal required-check
  enforcement while that bypass exists.

### Why strict non-bypass enforcement was NOT autonomously applied

Setting `enforce_admins.enabled = true` (or enabling
`required_pull_request_before_merging`) would require the four status checks to
be green **before** a change lands on `main`. Direct autonomous pushes cannot
satisfy that ordering — the checks run only after the commit exists — so strict
enforcement would **effectively block the autonomous direct-push integration
model** and force every wave through a pull request. That is a deliberate change
to the repository's mandated integration procedure (AGENTS.md Git policy), not a
safe autonomous hardening step. Making it would risk stranding in-flight
autonomous work, which this campaign is explicitly forbidden from doing
("Do not break existing automation blindly").

### Recommendation (owner decision)

The strongest sustainable target is **PR-based integration for all changes
(human and autonomous) with the four required checks enforced, and
`enforce_admins` left on for the merge path while removing the direct-push
relies-on-bypass behavior**. This is feasible (the four workflows already
trigger on PRs) but requires reworking the autonomous integration loop from
"push to main" to "open PR → green checks → merge". Because that contradicts the
committed AGENTS.md Git policy and would change every future campaign's
integration procedure, it is recorded here as a **recommended successor
governance change for the owner to authorize**, not applied unilaterally.

**Compensating controls retained in the meantime:**
1. Ruleset `25523614` — force-push/deletion blocked for everyone (verified).
2. `greenMain` local checks in `GOVERNANCE.json` — required before any coherent
   autonomous push, with a documented blocked-exception path that forbids
   labeling a known-failing check as green.
3. CI runs on every push to `main`; a red required workflow is visible and must
   be corrected (never left red).
4. This document names the bypass explicitly so no reader mistakes the current
   posture for universal enforcement.

---

## H3 — Security posture (dependency gate)

The dependency advisory gate is re-run at the final integrated revision and
recorded in `security.md`. Accepted advisory classifications, review dates, and
exit conditions are preserved from Campaign 079; newly in-range-fixable
advisories are remediated rather than waived. This campaign makes no
zero-vulnerability claim while accepted advisories remain.
