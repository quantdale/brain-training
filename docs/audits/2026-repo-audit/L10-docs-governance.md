# Lane L10 — documentation truth + governance coherence

> STATUS: COMPLETE. Read-only lane. Findings confirmed against tree state `2a765cc` (`main`,
> 2026-09-30). No repository file was modified except this report.

## Scope covered

- **Deeply inspected (full read):** `README.md`, `ONBOARDING.md`, `docs/MASTER_PLAN.md`,
  `docs/PARITY_MATRIX.md`, `docs/QA_ARTIFACTS.md`, `docs/ARCHITECTURE.md`, `docs/GAME_SDK.md`,
  `docs/DESIGN_SYSTEM.md`, `docs/hardening/post067/*.md` (6 files), `.agent/GOVERNANCE.json`,
  `.agent/BACKLOG.md`, `.agent/IMPACT_MAP.md`, `.agent/DEPENDENCY_AUDIT.md`,
  `.agent/OVERNIGHT_056_067_STATE.md`, `.agent/STATE.md` (head + program block),
  `.agent/CURRENT_CAMPAIGN.md` (head), `.agent/KNOWN_ISSUES.md` (headers, bullets, maintenance
  ledger, campaign-disposition sections), `openspec/changes/*/change.json` (52 statuses).
- **Structurally inspected (grep/symbol/claims):** `.agent/VALIDATION.md` (4,608 lines — grepped
  for `doctor`, `21/21`, counts), `.agent/KNOWN_ISSUES.md` (618 lines — header/bullet inventory
  rather than line-by-line), `docs/ANDROID_AUTOMATION.md`, `docs/ARTEMIS_ANDROID_QA.md`,
  `docs/RECOVERY_DRILL.md`, `docs/DEFERRED_DECISIONS.md` (section/command inventory), plus the
  code surfaces each claim points at.
- **Diagnostics run (read-only):** see `commandsRun` in the acceptance report — `npx expo-doctor`
  (apps/mobile) → exit 1; `node scripts/validate-repo-state.mjs` → PASS; `validate-offline.mjs
  --check` → CLEAN 985 files; `validate-affected.mjs --check-sync` → OK 19 areas/51 patterns;
  `validate-secrets.mjs` → CLEAN 2722 files; `validate-workflows.mjs` → PASS 4 files;
  `validate-task-ownership.cjs` → passed; `validate-provenance.mjs --check` → "No changed files
  detected"; `qa/validate-runtime-qa-contract.mjs` → PASS; `validate-dependency-audit.mjs` →
  **FAILED, exit 1**; `npx openspec validate --all --strict` → 52/52; `npx jest --listTests` → 598.
- **Intentionally excluded:** security exploitation of the advisories found (owned by the security
  lane — this lane reports only that the recorded "green gate" claim is false); runtime/device
  claims requiring an emulator or APK install (host-interaction prohibition); full Jest matrix
  (orchestrator-owned); `apps/mobile/src/**` behaviour (owned by engine lanes).

## Flow map

1. **Operator entry path:** `README.md` → fast-start `/goal` text → `.agent/STATE.md` +
   `.agent/CURRENT_CAMPAIGN.md` → `AGENTS.md` startup protocol → `scripts/validate-repo-state.mjs`.
2. **Governance read path:** `.agent/GOVERNANCE.json` (`activeCampaign: null`, `activeProgram`
   `056-067…` state `COMPLETE`) → `.agent/OVERNIGHT_056_067_STATE.md` (ledger, "Program CLOSED") →
   `openspec/changes/067-terminal-whole-product-certification/change.json` (`VALIDATED`).
3. **Certification-claim path:** `docs/hardening/post067/HARDENING_CLOSURE.md` terminal table →
   `CONVERGENCE_LOG.md` → `.agent/STATE.md` hardening bullet → `README.md`/`ONBOARDING.md` gate
   list → the actual commands (`expo-doctor`, `validate-dependency-audit.mjs`).
4. **Backlog path:** `.agent/BACKLOG.md` "Still-open durable items" → `docs/DEFERRED_DECISIONS.md`
   → code surfaces (`plugins/with-android-backup-rules.js`, `jest.config`, `data-portability/
   file-transport.ts`, `content/registry.ts`, `components/ui/*`).
5. **Known-issues path:** `.agent/KNOWN_ISSUES.md` campaign dispositions → maintenance ledger →
   `scripts/certification/{dependency-audit,jest-skip}-allowlist.json`.

## Findings

### L10-F01 — The recorded terminal verification matrix is no longer reproducible: `expo-doctor` fails and the dependency-audit gate is red

- **Severity:** P1
- **Confidence:** confirmed
- **Category:** docs-dx (with a dependencies component)
- **Files:** `docs/hardening/post067/HARDENING_CLOSURE.md:37-46` (terminal table),
  `docs/hardening/post067/CONVERGENCE_LOG.md:41-44`, `README.md:84-88`,
  `ONBOARDING.md:70-82`, `.agent/STATE.md:22-24`, `.agent/OVERNIGHT_056_067_STATE.md:56,60,68`
  ("Expo Doctor 21/21"), `.agent/VALIDATION.md:3705,3967,4072,4221,4248`,
  `.agent/DEPENDENCY_AUDIT.md:8-10,68-71`, `docs/MASTER_PLAN.md:37,60,62`
  ("doctor 21/21" in Campaigns 011/012/013 closers), `apps/mobile/package.json:15`
- **Evidence:**
  - `cd apps/mobile && npx expo-doctor` →
    `Error: npx expo config --json --full exited with non-zero code: 1` / `20/21 checks passed. 1 checks failed` /
    `✖ Check that packages match versions required by installed Expo SDK` / `expo ~57.0.26 → 57.0.24`,
    `expo-constants ~57.0.20 → 57.0.19`, `expo-document-picker ~57.0.3 → 57.0.2`,
    `expo-linking ~57.0.11 → 57.0.10`, `expo-router ~57.0.24 → 57.0.22`,
    `expo-sharing ~57.0.22 → 57.0.21` / `1 check failed` → **exit code 1**
    (the same run is archived at `docs/audits/2026-repo-audit/evidence-expo-doctor.txt`).
  - `node scripts/validate-dependency-audit.mjs` →
    `Dependency audit FAILED: 3 unallowlisted moderate+ production advisories` —
    `brace-expansion ghsa-q2hr-2g5m-vwhr (moderate)`,
    `brace-expansion ghsa-qhr7-859c-m2p7 (high)`,
    `brace-expansion ghsa-6j4f-fj2g-mc7p (high)` → **exit code 1**.
    The allowlist (`scripts/certification/dependency-audit-allowlist.json`, `"reviewedAt":
    "2026-09-13"`) has 4 entries, none for `brace-expansion`; `.agent/DEPENDENCY_AUDIT.md:8-10`
    still records "**19 vulnerabilities (15 moderate, 4 high)**" and line 68-71 records
    "`node scripts/validate-dependency-audit.mjs` reports PASS with these 4 accepted advisories";
    the self-test still reports 41/41, so the gate logic is fine — the *tree* is red.
- **Problem:** Documentation states, as a verified terminal result, that the repository gate set is
  green ("Offline / secrets / provenance / affected / runtime-QA / dependency / workflows — all
  PASS", "Expo Doctor 21/21", "doctor 21/21" in four campaign closers, `README.md:88`
  `npx expo-doctor # 21/21 expected`). Two of those recorded gates fail today: `expo-doctor`
  (20/21) and the dependency-audit production gate (3 unallowlisted moderate+/high advisories).
  `.agent/DEPENDENCY_AUDIT.md` does not mention the `brace-expansion` advisories at all, so its
  classification table and its "19 vulnerabilities" headline are both wrong for this tree.
- **Why it matters:** The repository's own rule is "never fake green; if a required check cannot
  run, record `NOT VALIDATED` or `BLOCKED`". A fresh agent that follows `ONBOARDING.md §6` gets a
  failing gate on a certified tree and cannot tell whether it is (a) a documented accepted
  boundary, (b) newly broken, or (c) its own environment mistake — the documented state says green.
  The orchestrator's decision to start a new campaign or to certify a release is made against a
  false gate baseline. `expo install --check` drift also means the certified artifact
  (`B7AA4102…`/`146F63BF…`) was built from a dependency set that no longer satisfies the SDK 57
  patch envelope, so "the hardening build is the current verified executable" is only true for a
  frozen, unreproducible lockfile state.
- **Root cause:** The recorded matrices are point-in-time snapshots with no expiry or commit pin
  in the documents, and nothing re-verifies them (no doc-claim gate). Advisories are published
  discontinuously (`brace-expansion` GHSAs post-date the 2026-09-19 audit refresh) and Expo patch
  expectations move with new SDK 57 patch releases.
- **Recommended solution:** (1) Add a date+commit qualifier to every recorded matrix claim
  (`HARDENING_CLOSURE.md` table, `STATE.md` program bullets, ledger entries, `VALIDATION.md`) —
  e.g. "as of `2a765cc`, 2026-09-21"; (2) refresh `.agent/DEPENDENCY_AUDIT.md` with the
  `brace-expansion` triage (classify build/dev-toolchain vs runtime and either allowlist with a
  rationale or fix in range) and correct the headline count; (3) run
  `cd apps/mobile && npx expo install --check` and land the six patch bumps as a bounded
  dependency-hygiene change, or record them as an explicit owner decision with the reason the
  certified artifact intentionally lags; (4) replace `README.md:88`'s "21/21 expected" with the
  command plus the currently expected result, or move it behind the "point-in-time" qualifier.
- **Implementation considerations:** Do not retrofit the historical closers (011/012/013/064/067)
  — mark them historical instead. If the `brace-expansion` advisory is genuinely build-only
  (`apps/mobile` dev toolchain / `@expo/config` path), an allowlist entry needs the same
  "never shipped in the bundle" rationale style as the `image-size`/`uuid` entries, plus a
  re-review trigger. Bumping Expo patches changes `package-lock.json` — an orchestrator-owned
  shared file. `expo-doctor` run from the repository root fails outright
  (`npx expo config --json --full exited with non-zero code: 1`), so any documentation must keep
  saying "from `apps/mobile/`".
- **Dependencies:** dependency/security lane owns the `brace-expansion` exploitability judgement;
  CI lane owns whether the gate runs in Actions; orchestrator owns the lockfile bump.
- **Risks:** Bumping six Expo packages is a lockfile-wide change on a certified artifact; treat it
  as its own change with a re-issued device matrix. Writing "21/21 expected" out of README without
  fixing the drift would leave two contradictory statements.
- **Validation required:** `cd apps/mobile && npx expo-doctor` (expect exit 0 / 21/21 after fix);
  `node scripts/validate-dependency-audit.mjs` (expect PASS with an explicit disposition set);
  `npm ls expo expo-router expo-constants expo-linking expo-document-picker expo-sharing`.
- **Completion criteria:** Both commands exit 0 on a fresh clone of `main`; every recorded matrix
  claim carries a commit pin and date; `DEPENDENCY_AUDIT.md` lists the current advisory set and its
  dispositions with owners and (where applicable) expiries.

### L10-F02 — `docs/MASTER_PLAN.md` is stale and misleading at its own headline; its campaign log stops at Campaign 016

- **Severity:** P1
- **Confidence:** confirmed
- **Category:** docs-dx
- **Files:** `docs/MASTER_PLAN.md:1-11` (header + "Current state"), `docs/MASTER_PLAN.md:180-403`
  (campaign log, terminates at "Campaign 016 — Release Certification & Hardening (VALIDATED
  2026-08-30)"); contrast `.agent/GOVERNANCE.json` and `.agent/STATE.md:1-10`
- **Evidence:**
  - `docs/MASTER_PLAN.md:6-10`: "**Current state (2026-09-13):** the catalog is complete at **42
    games**; Campaigns 001–028 are closed, most recently 028 (production-readiness closure,
    **VALIDATED**), and **no campaign is active**."
  - Actual tree: `openspec/changes/` holds **52** active changes with `change.json` all
    `VALIDATED`, including 056–067 and the untracked 068 scaffold; `GOVERNANCE.json` records
    `lastCampaign: "055-signal-arcade-desirability"` plus `activeProgram.state: "COMPLETE"`
    (056–067 + post-067 hardening). So "Campaigns 001–028 are closed … no campaign is active" is
    wrong by ~40 changes and 17 days.
  - `grep -n "^## Campaign" docs/MASTER_PLAN.md`-equivalent structure shows the campaign log runs
    010 → 014 → 016 and **stops at Campaign 016 (2026-08-30)**, i.e. it omits 017–055 and the
    whole 056–067 program + hardening phase; the file ends mid-history at line 403.
  - The document is also internally ordered non-chronologically: "Later phases (intentionally not
    scheduled yet)" (line ~172) is followed by "## Campaign 010 — Mass Product Implementation
    (2026-08-21)" (line ~184) and the rest of the campaign log.
- **Problem:** `MASTER_PLAN.md` is the canonical-sounding plan document for the whole repository
  but describes a state from 2026-09-13 and stops its history at 2026-08-30. A reader who opens it
  (it is one of the root `docs/` files, and `README.md`'s authority order effectively points at
  `docs/`) is told the project is at Campaign 028 with nothing active, and is never told that a
  42-game catalog was certified (067), hardened (post-067), or that 52 OpenSpec changes exist.
- **Verdict: STALE — but structurally useful. Recommendation: mark superseded for state, retain as
  phase-gate history.** It is *not* actively misleading about locked product decisions (nothing in
  it contradicts `docs/PROJECT_CONSTITUTION.md`), and the Phase 0–4 gating language is still the
  clearest statement of the campaign model; the defect is the "Current state" block and the
  truncated campaign log.
- **Exact corrections required:**
  1. Replace the "Current state (2026-09-13)" block (lines 6-10) with a pointer to
     `.agent/STATE.md` + `.agent/GOVERNANCE.json` as the only authority for current state, and add
     a "this file is historical" banner matching the existing `**Status:** historical implementation
     plan` line (make it prominent — currently it is line 4 and easy to miss).
  2. Delete or explicitly close the "no campaign is active" sentence; it is false in shape
     (`activeCampaign: null` but a program ran 056–067 to `COMPLETE`) and will mislead a cold agent
     about whether work is expected.
  3. Extend the campaign log to at least a one-line index from 017 through 067 plus the post-067
     hardening phase (or replace the log with a pointer to `.agent/VALIDATION.md` + the OpenSpec
     change list, which is already the durable record) — as written, the log's last entry
     (Campaign 016, 2026-08-30) predates ~85% of the change history.
  4. Re-order so the time-sequenced campaign log is contiguous and comes after the phase
     gates; "Later phases" currently precedes Campaign 010.
  5. Every "doctor 21/21", "OpenSpec 39/39/51/51", "N tests" number in the retained campaign
     entries should be marked as recorded-at-closure (see L10-F01), not current.
- **Implementation considerations:** Keep the phase gates verbatim — they are referenced by
  `AGENTS.md`'s campaign model ("no full hardening unless owner requests it") and by the
  constitution's autonomy gates. The index can be generated from `openspec/changes/*/change.json`
  (all already carry `status`) so it does not become another hand-maintained stale list.
- **Dependencies:** none (pure docs); the OpenSpec change list is the natural generator input.
- **Risks:** Replacing the doc wholesale would lose the only narrative of Campaigns 010–016; keep
  the archive under a "Historical campaign log" heading rather than deleting.
- **Validation required:** `node scripts/validate-repo-state.mjs` (doc-touch path in
  `.agent/IMPACT_MAP.md` requires it) after the edit; manual check that no other doc links to
  `MASTER_PLAN.md` for current state (`grep -rn "MASTER_PLAN" --include=*.md .`).
- **Completion criteria:** No statement in `MASTER_PLAN.md` contradicts `.agent/STATE.md` /
  `GOVERNANCE.json`; the campaign index covers 001–067 + post-067 hardening; the file's banner
  makes its historical status unmissable.

### L10-F03 — Recovery-path coherence: `GOVERNANCE.activeCampaign: null` + `activeProgram … COMPLETE` is coherent, but three documents contradict it, and the first misleading line is `CURRENT_CAMPAIGN.md:3`

- **Severity:** P2
- **Confidence:** confirmed
- **Category:** docs-dx (governance)
- **Files:** `.agent/CURRENT_CAMPAIGN.md:1-8` and `:14-16`; `.agent/STATE.md:3` vs `.agent/STATE.md:5`;
  `.agent/GOVERNANCE.json:3-13`; `.agent/OVERNIGHT_056_067_STATE.md:1-4` + "Program CLOSED" line;
  `scripts/validate-repo-state.mjs` (passes); `README.md:37-40`
- **Evidence:**
  - `GOVERNANCE.json`: `"activeCampaign": null`, `"activeProgram": { "id":
    "056-067-overnight-autonomous-program", "state": "COMPLETE", "currentChange":
    "067-terminal-whole-product-certification" }`, `"lastCampaign": "055-signal-arcade-desirability"`.
    `node scripts/validate-repo-state.mjs` → `Repository state validation PASS` + prints
    `No active campaign; last campaign: 055-signal-arcade-desirability (VALIDATED)` and
    `Active program: 056-067-overnight-autonomous-program — current change:
    067-terminal-whole-product-certification`. So the validator accepts the pair, and the
    "current change 067" line is read from the program record even though 067 is long validated
    (`openspec/changes/067-…/change.json` → `"status": "VALIDATED"`).
  - **First misleading place — `CURRENT_CAMPAIGN.md:3-5`:** the file is titled
    `# ACTIVE — Overnight Program 056→067 (owner-authorized, NIGHT mode)`, then
    `**Status:** ACTIVE` and `**Current change:** 067 … (VALIDATED; post-067 hardening PHASE_2
    active, evidence root docs/hardening/post067/)`. `docs/hardening/post067/HARDENING_CLOSURE.md:4`
    says `**Verdict:** POST_067_HARDENING_COMPLETE` and `CONVERGENCE_LOG.md` says "The phase is
    closed at wave 1"; the ledger says "Program CLOSED". A cold agent's first line of the campaign
    file therefore claims an ACTIVE program and an ACTIVE hardening phase.
  - **Second misleading place — `STATE.md:3`:** `**Last update:** 2026-09-21 — Overnight program
    056→067 active (NIGHT mode): Changes 056–065 terminally VALIDATED and pushed (…); Change 066
    open.` Two lines later, `STATE.md:5` says the program is `**COMPLETE**: 056–067 VALIDATED,
    post-067 hardening closed`. The same file states both an in-flight and a closed program.
  - **Third:** `CURRENT_CAMPAIGN.md` then contains a 980-line Campaign 055 record whose
    `**Status:** VALIDATED` / `**Campaign id:** 055-signal-arcade-desirability` fields are the only
    ones the note at lines 6-8 says are "authoritative… for the terminal Campaign 055 record".
    So the file simultaneously presents a program marked ACTIVE, a status it admits is not
    authoritative, and a 055 record.
  - **Recovery chain assessment (brief question):** `CURRENT_CAMPAIGN.md → OVERNIGHT_056_067_STATE.md
    → change 067` is *not* unambiguous at step 1 — the reader is told the program is ACTIVE and
    must resolve the contradiction against `GOVERNANCE.json`/Pass C evidence. From
    `OVERNIGHT_056_067_STATE.md` onward the chain is clean (single "Program CLOSED" line, per-change
    verdicts) and change 067's `change.json` agrees with it.
- **Problem:** The `activeCampaign: null` + `activeProgram.state: COMPLETE` combination itself is
  coherent (the 056–067 program is not a campaign; its units of work are OpenSpec changes, all
  `VALIDATED`) and the validator encodes that. What is incoherent is the *prose* state: the two
  files a cold agent is instructed to read first (`README.md:37-40` → "when `.agent/STATE.md`
  declares one"; `ONBOARDING.md:8` → read `STATE.md` and `CURRENT_CAMPAIGN.md`) both claim active
  work, while `GOVERNANCE.json`, the ledger, and the hardening closure say everything is closed.
- **Why it matters:** The realistic failure is an autonomous agent that reads
  `CURRENT_CAMPAIGN.md:3` ("Status: ACTIVE"), concludes a campaign is mid-flight, and either
  invents a successor or "completes" an already-certified change — exactly the behaviour
  `README.md` warns about ("If `GOVERNANCE.activeCampaign` is `null`, the repository is in a
  terminal validated state; do not invent a successor campaign"). Conversely, an agent may
  distrust `STATE.md` as a whole because its header contradicts its body. `GOVERNANCE.json` also
  loses information: with `lastCampaign: "055"` and no field recording the 056–067 program as the
  most recent completed work, "what shipped last" is only recoverable by reading a 71-line ledger.
- **Root cause:** `CURRENT_CAMPAIGN.md` and `STATE.md` are append-in-place documents: the new
  program header was prepended to the 055 campaign record without retiring the old header, and
  `STATE.md`'s "Last update" line was never rewritten when 066/067/hardening closed (the body was).
- **Recommended solution:** (1) Retitle `CURRENT_CAMPAIGN.md` to
  `# NO ACTIVE CAMPAIGN — last campaign: 055-signal-arcade-desirability` and set
  `**Status:** NONE ACTIVE` for the program block, keeping the 056→067 program record under a
  `## Completed program …` heading with its `COMPLETE` verdict; (2) fix `STATE.md:3` so the header
  line reports the true last update (`2026-09-21 — program 056–067 COMPLETE; post-067 hardening
  closed; no active campaign/program`); (3) add `lastProgram` (id, state, lastChange) to
  `GOVERNANCE.json` so `lastCampaign` no longer implies 055 was the most recent work; optionally
  have `validate-repo-state.mjs` additionally assert that when `activeProgram.state === "COMPLETE"`
  the `currentChange`'s `change.json` is `VALIDATED` (it is) and that `CURRENT_CAMPAIGN.md` does not
  advertise an ACTIVE status (a cheap string assertion that prevents recurrence).
- **Implementation considerations:** `validate-repo-state.mjs` currently derives PASS from
  `GOVERNANCE.json` + OpenSpec; keep the file-based contract but extend the stage to read the
  campaign header. Do not renumber or archive the 055 record — `openspec/changes/055-…` and
  `.agent/CAMPAIGN05x` prompts reference it.
- **Dependencies:** `.agent/IMPACT_MAP.md` governance row already requires
  `validate-repo-state.mjs` + `validate-task-ownership.cjs` after `.agent/**` edits.
- **Risks:** A wrong edit could make `validate-repo-state.mjs` fail for the orchestrator; stage the
  doc change with the validator extension in the same commit.
- **Validation required:** `node scripts/validate-repo-state.mjs` (PASS) and
  `node scripts/validate-task-ownership.cjs`; manual re-read of `CURRENT_CAMPAIGN.md:1-10` +
  `STATE.md:1-10` as a cold start.
- **Completion criteria:** No file reachable from the README fast-start claims an active campaign
  while `GOVERNANCE.activeCampaign` is `null` and `activeProgram.state` is `COMPLETE`; a cold
  reader reaches the correct conclusion from the first 10 lines of both files.

### L10-F04 — `docs/DESIGN_SYSTEM.md` documents the superseded v3 "Neon Arcade" palette, not the shipped v4 "Signal Arcade"

- **Severity:** P2
- **Confidence:** confirmed
- **Category:** docs-dx (frontend contract)
- **Files:** `docs/DESIGN_SYSTEM.md:1-30` (`v3, Campaign 026`, "describes the visual language
  shipped by Campaign 026", palette `#FFF8EF` cream / `#14102A` plum / `#D6402A` vermillion),
  `apps/mobile/src/theme/tokens.ts:1-20`
- **Evidence:** `apps/mobile/src/theme/tokens.ts:1-14` — "Design language **v4 (campaign 051)** —
  'Signal Arcade': ink navy + warm paper, signal coral, electric cyan, voltage yellow and mint,
  with poster/block geometry and a tactile console-key action language." A case-insensitive grep
  for the three documented v3 hex values across `apps/mobile/src/theme/` returns **no matches**,
  so the doc's colour section describes a palette that is no longer the token source of truth.
  `docs/MASTER_PLAN.md` confirms Campaign 051 = "visual-dna-reboot-massive-ui-overhaul".
  Kit-list drift: `docs/DESIGN_SYSTEM.md:85` lists `Avatar` and `ScreenHeader` in the shipped kit,
  and `.agent/BACKLOG.md` records both as having no product importers (verified: 0 non-test
  importers for `components/ui/avatar.tsx` and `components/ui/screen-header.tsx`).
- **Problem:** The design-system doc — the only document stating the visual contract for
  contributors — is 25 campaigns stale in its most load-bearing section (colour), so any agent
  restyling a surface or asserting contrast follows a retired palette. The composition/motion/kit
  sections may still be valid but cannot be trusted without re-verification against Campaign 051.
- **Why it matters:** `docs/DESIGN_SYSTEM.md` is cited as the token/contrast authority
  ("hardcoded colours or one-off controls are defects"); following it would produce off-system
  colour values that fail the real contrast test in `theme/__tests__/contrast.test.ts`.
- **Root cause:** Campaign 051 changed `theme/tokens.ts` (and later 055/065 touched tokens) without
  updating the prose design document, which is not covered by any validator.
- **Recommended solution:** Rewrite §2 (colour) from `theme/tokens.ts` (the token file is
  self-documenting and contrast-tested), retitle to v4/Signal Arcade, correct the kit list, and add
  a one-line "authority: `theme/tokens.ts` (v4)" pointer so future token work regenerates rather
  than re-narrates. Consider a light doc-claim check (the doc's own hexes must exist in
  `theme/tokens.ts`) in `scripts/validate-repo-state.mjs` or a docs-consistency validator.
- **Dependencies:** frontend/theme lane owns the visual truth; this lane only certifies the doc is
  false.
- **Risks:** A naive rewrite could drop genuinely binding rules (44 dp floors, reduced motion,
  one-hero-per-screen); diff against the current doc section by section.
- **Validation required:** `npx jest apps/mobile/src/theme --silent` (contrast suite) after the doc
  edit; manual grep that every hex in the doc exists in `theme/tokens.ts`.
- **Completion criteria:** Every colour/type/radius claim in the doc resolves to a live token; the
  doc names the current design-language version.

### L10-F05 — `docs/hardening/post067/README.md` lists an evidence file that does not exist

- **Severity:** P3 · **Confidence:** confirmed · **Category:** docs-dx
- **Files:** `docs/hardening/post067/README.md:11` (`- \`RESIDUAL_CENSUS.md\` — running census and
  dispositions`) vs the directory listing.
- **Evidence:** `ls docs/hardening/post067/` → `CONVERGENCE_LOG.md HARDENING_CLOSURE.md
  PASS_A_STATIC.md PASS_B_RUNTIME.md PASS_C_RELEASE_UX.md README.md` — no `RESIDUAL_CENSUS.md`.
  The census content lives at `docs/redesign/evidence/campaign066/RESIDUAL_CENSUS.md` (referenced
  correctly two lines below in the same file as seed material).
- **Problem / why it matters:** The hardening evidence root advertises an artifact a reviewer will
  not find while auditing the closure; it costs a reviewer a search and weakens trust in the other
  links in the same list.
- **Recommended solution / validation:** Either commit the running census to
  `docs/hardening/post067/RESIDUAL_CENSUS.md` (as was clearly intended) or remove the bullet;
  verify every relative link in `docs/hardening/post067/*.md` resolves (`node -e` link check).
- **Completion criteria:** No dangling path in the hardening evidence root.

### L10-F06 — `docs/PARITY_MATRIX.md` records a stale offline-scan count (and a stale "21/21"-adjacent snapshot)

- **Severity:** P3 · **Confidence:** confirmed · **Category:** docs-dx
- **Files:** `docs/PARITY_MATRIX.md:9` ("Offline-boundary suite + `scripts/validate-offline.mjs`
  (919 files clean)")
- **Evidence:** `node scripts/validate-offline.mjs --check` today → `files scanned: 985 (excludes
  __tests__, __mocks__, *.test.ts, *.spec.ts)` + `CLEAN — no network API usage outside the
  allowlist.` The claim is directionally TRUE (the gate is clean) but the count is 66 files behind;
  the same "919 files" figure is repeated in `docs/MASTER_PLAN.md`'s Campaign 014 snapshot.
- **Problem / why it matters:** Counts are the fastest-rotting claim class; a reader who reruns the
  gate and sees 985 has to decide whether the scanner scope changed (a real regression signal) or
  the doc is stale. It also makes every other count in the matrix ("7 games", "5 games") suspect
  even though those are correct today (verified: 42 directories = attention 5, flexibility 5,
  language 5, logic 5, math 5, memory 7, spatial 5, speed 5).
- **Recommended solution:** State the invariant ("CLEAN, no network API usage") and drop the
  absolute file count, or regenerate it in the same wave as a `--check` run.
- **Completion criteria:** No absolute file/test/suite count in the matrix contradicts the current
  run of the corresponding command.

### L10-F07 — `.agent/KNOWN_ISSUES.md` is a 618-line campaign diary with no open-items index; open items are interleaved with resolved ones

- **Severity:** P3 · **Confidence:** confirmed · **Category:** docs-dx
- **Files:** `.agent/KNOWN_ISSUES.md:1-618`
- **Evidence / classification (complete section inventory):** `## Campaign 055 disposition`
  (line 3, **RESOLVED/CLOSED** items: environment failures CLOSED, HUD pause clipping FIXED,
  duplicate score row FIXED, tutorial retry FIXED, **Remaining visual debt (LOW, accepted) — OPEN
  by design**, compact/light a11y CLOSED, results band CLOSED, drill-downs CLOSED, dead space
  CLOSED-as-non-issue), `## Campaign 054` (56, RESOLVED; zero open Crit/High/Medium),
  `## Campaign 053` (89, RESOLVED — implementation applied), `## Campaign 051` (117, VISUAL REBOOT
  COMPLETE), `## Campaign 050` (144, RELEASE CONDITIONAL → superseded by later certification),
  `## Campaign 045` (162, COMPLETE-for-local-scope; **dependency/release debt PARTIALLY SUPERSEDED
  — the residual is the accepted debt, still OPEN**), `## Campaign 042` (175, TECHNICAL CERTIFIED;
  **lines 205-232 still carry live classifications**: SQLite NPE SUPERSEDED, compact/font-scale
  clipping risk at 211, release XML/a11y capture blocked at 216, catalog lifecycle 39/42
  SUPERSEDED, external CI classification at 228, native state-matrix scope at 232),
  `## Campaign 041 findings — HISTORICAL / SUPERSEDED` (198), `## Current status — Campaign 040`
  (241, VALIDATED/CONDITIONAL — **STALE as "current"**: 027 campaigns superseded it),
  `## Campaign 039/038/037/036/035/034/033/031` (262-394, historical VALIDATED checkpoints),
  `## Campaign 029 — ARTEMIS migration status` (425, closed VALIDATED),
  `## Campaign 026/027 findings` (455, historical), `## Maintenance ledger (open items and resolved
  records)` (490 — the live list: `xp_awards` RESOLVED AS DESIGNED, backup double canonicalization
  RESOLVED 028, offline heuristic gap RESOLVED 028, **seeding fixture noise Low — OPEN**, permanent
  provenance allowlist dead entries RESOLVED 027/066, **runtime advisory decode-uri-component —
  OPEN accepted debt to 2027-03-31, renewal owner named**, QA artifact retention RESOLVED 028,
  **build/dev advisories retain classification — OPEN**, **AVS best-reaction sentinel Low — OPEN**,
  achievements/quest sync scan RESOLVED 027, constitution-deferred systems — DEFERRED not bugs),
  `## Campaign 024 findings` (564, environment/operational), `## Campaign 023 findings — all
  resolved` (598), `## Operational recommendation` (608), `## Evidence location` (616).
- **Problem:** There is no `## Open items` section. Five categories are interleaved: resolved,
  superseded, accepted-by-design, genuinely open, and external/manual-blocked. The live open items
  a reader most needs (`217` compact/font-scale clipping risk; `216` release XML/a11y capture
  blocked; `477` viewport-clipped a11y measurements tooling; `511` seeding fixture noise; `522`
  runtime advisory expiry; `543` build/dev advisories; `544` AVS sentinel; `583` full-catalog
  certify gate BLOCKED; `588` device-representative frame timing NOT VALIDATED; `610` branch
  protection not configured) are each buried under a different campaign heading, and one section is
  literally titled "Current status — Campaign 040" although 27 campaigns have closed since.
- **Why it matters:** `.agent/IMPACT_MAP.md` and `AGENTS.md` treat `KNOWN_ISSUES.md` as the failure
  record; an agent asked "is this already known?" cannot answer it without reading 618 lines, which
  is exactly how items get re-reported or silently dropped.
- **Recommended solution:** Keep the historical dispositions, but add a top `## Open items`
  section (10-15 lines) with the live list and one-line owners/triggers, and rename the
  "Current status — Campaign 040" heading to a dated historical one. Any item resolved after its
  campaign section may be marked `RESOLVED (see …)` inline rather than appended.
- **Validation / completion criteria:** Every open item is reachable from the top of the file; no
  section title implies currency ("Current status") that is false.

## Check 1 — claim verification table (material claims, prioritised numbers/commands)

| # | Document:line | Claim | Verdict | Proof pointer |
|---|---|---|---|---|
| 1 | `README.md:88` | `npx expo-doctor # 21/21 expected` | **STALE (false)** | `cd apps/mobile && npx expo-doctor` → 20/21, exit 1; 6 Expo packages behind (F01) |
| 2 | `ONBOARDING.md:70-82` | §6 baseline gates all pass on a fresh machine | **STALE** | `expo-doctor` fails; `validate-dependency-audit.mjs` fails (F01) |
| 3 | `HARDENING_CLOSURE.md:37-46` | "Offline / secrets / provenance / affected / runtime-QA / dependency / workflows — all PASS" | **STALE (dependency fails)** | `validate-dependency-audit.mjs` → FAILED exit 1; secrets CLEAN 2722; workflows PASS 4; affected sync OK 19/51; runtime-QA PASS; provenance "No changed files detected" (vacuous off-diff) |
| 4 | `HARDENING_CLOSURE.md:37` | 598 suites / 6,933 tests / 5 snapshots, exit 0 | **PARTLY TRUE / test count UNVERIFIED** | `npx jest --listTests \| wc -l` = **598** ✓; full run not re-executed in this lane (orchestrator-owned) |
| 5 | `HARDENING_CLOSURE.md:41` / `STATE.md:24` / ledger | OpenSpec `--all --strict` 51/51 | **STALE (now 52/52)** | `npx openspec validate --all --strict` → "Totals: 52 passed, 0 failed" (068 scaffold added by this audit campaign) |
| 6 | `HARDENING_CLOSURE.md:43` | Device matrix (deep-link→Games, 0 violations, launch 1,487 ms) | **UNVERIFIABLE here** | requires emulator/APK — forbidden for this lane; recorded artifact `146F63BF…` not re-buildable without a device run |
| 7 | `README.md:74` | `npm run test:ci # jest full suite (2 workers — matches CI)` | **TRUE** | `apps/mobile/package.json:15` = `jest --ci --maxWorkers=2`; `.github/workflows/app-ci.yml:121` runs `npm run test:ci` |
| 8 | `README.md:11-14` | 42-game catalog, Workout V3, Android primary, iOS NOT VALIDATED | **TRUE** | `ls apps/mobile/src/games \| wc -l` = 42; domains ×5 (memory ×7); `PARITY_MATRIX` V3 row matches `src/workout`/`src/personalization`; iOS claim matches `docs/DEFERRED_DECISIONS.md` |
| 9 | `README.md:37-40` | If `GOVERNANCE.activeCampaign` is null the repo is in a terminal validated state | **TRUE as rule / contradicted by `CURRENT_CAMPAIGN.md:3`** | `GOVERNANCE.json` null + program `COMPLETE`; but campaign file says `Status: ACTIVE` (F03) |
| 10 | `ONBOARDING.md:52` | Repository-local skills `continue-development`, `goal`, `harden` exist | **UNVERIFIED (not re-checked)** | skill dirs live under the untracked agent-config dirs; not resolvable as tracked paths in this lane |
| 11 | `ARCHITECTURE.md:44-49` | seams: `src/sync`, `src/entitlements`, `src/notifications`, `src/assistant` exist; auth not implemented | **TRUE** | all four directories exist; no `src/auth` |
| 12 | `GAME_SDK.md:8` | SDK contracts used by all 42 catalog games; `XpRatingHook` stays no-op, real math in `src/rating/**` | **TRUE at the file/symbol level** | `apps/mobile/src/sdk/{version,rng,timing,lifecycle,pause,audio-haptics,tutorial,testid,types/*}.ts` present; `src/rating/xp-hook.ts` referenced by ledger 057 |
| 13 | `GAME_SDK.md:104` | `SDK_VERSION` lives in `version.ts`; `RNG_ALGORITHM_VERSION='mulberry32-v1'` | **TRUE (spot-checked)** | token present in `src/sdk/version.ts` (symbol-level verification; not re-executed) |
| 14 | `DESIGN_SYSTEM.md:1-30,85` | "Neon Arcade" v3, Campaign 026 palette (cream/plum/vermillion), kit incl. Avatar/ScreenHeader | **STALE** | `theme/tokens.ts:1-14` = v4 (campaign 051) "Signal Arcade"; documented hexes absent from `src/theme/` (F04) |
| 15 | `PARITY_MATRIX.md:9` | offline validator "919 files clean" | **STALE count** | today 985 files, CLEAN (F06) |
| 16 | `PARITY_MATRIX.md:20-38` | per-domain catalog counts (memory 7, others 5) | **TRUE** | directory count per domain matches |
| 17 | `PARITY_MATRIX.md:52-55` | backups plaintext + checksum-is-integrity-not-MAC; AES deferred | **TRUE / accepted debt** | matches `docs/DEFERRED_DECISIONS.md` + allowlist rationale; do not re-report per brief §3 |
| 18 | `QA_ARTIFACTS.md` (whole) | `qa-artifacts/` gitignored; run layout, exit codes, `run.json` written last | **TRUE** | `repo/qa-artifacts/` exists and is gitignored; layout matches live directory |
| 19 | `ANDROID_AUTOMATION.md:72-88` | `scripts/android/{avd,install,launch,hierarchy,screenshot,logs,reset}.sh` | **TRUE (paths exist)** | directory contents match the documented command set |
| 20 | `ARTEMIS_ANDROID_QA.md:187-192` | contract check command set (`qa/validate-runtime-qa-contract.mjs`, repo-state, task-ownership, registry `--check`, provenance, offline) | **TRUE** | `validate-runtime-qa-contract.mjs` → PASS; other commands verified above |
| 21 | `ARTEMIS_ANDROID_QA.md:105-120` | Flash/Pro task results (task ids, PASS traces) | **UNVERIFIABLE** | external traces not in Git by design; requires external ARTEMIS |
| 22 | `RECOVERY_DRILL.md:8-47` | exact recovery procedure / fresh-session drill executed | **partially verifiable**: procedure matches the README/AGENTS order; **drill evidence is historical** | the drill assumes a campaign is declared; today it lands in the F03 contradiction |
| 23 | `DEFERRED_DECISIONS.md` | deferred product decisions (encryption, sync, AI, monetisation, music, theme selection) untouched | **TRUE (consistent with `PARITY_MATRIX` rows)** | no contradicting code found in the seams (`entitlements` local-unlocked default, `notifications` types-only) |
| 24 | `.agent/STATE.md:5,22-24` | program 056–067 COMPLETE, hardening COMPLETE, final matrix green, all validators green | **STALE in the "all validators green" part** | F01; the COMPLETE verdicts themselves match GOVERNANCE + ledger + change statuses |
| 25 | `.agent/CURRENT_CAMPAIGN.md:3-5` | program `Status: ACTIVE`; post-067 hardening PHASE_2 active | **STALE (false)** | `HARDENING_CLOSURE.md:4` `POST_067_HARDENING_COMPLETE`; `GOVERNANCE.activeProgram.state = COMPLETE`; ledger "Program CLOSED" (F03) |
| 26 | `.agent/BACKLOG.md:3-12` | "the owner-authorized 056–067 overnight program is the active successor" | **STALE framing** | program is COMPLETE; same paragraph still presents it as active (F04 in check 3 table below) |
| 27 | `.agent/BACKLOG.md:67-71` | `GameHost.roundProgress` wired in 41/42 games | **TRUE** | `grep -rl roundProgress apps/mobile/src/games` = 41 files |
| 28 | `.agent/DEPENDENCY_AUDIT.md:8-10,68-71` | "19 vulnerabilities (15 moderate, 4 high)"; validator reports PASS with 4 accepted advisories | **STALE (gate is red)** | `validate-dependency-audit.mjs` FAILED with 3 unallowlisted `brace-expansion` advisories (F01) |
| 29 | `.agent/IMPACT_MAP.md:1-8` | mirror of `scripts/validate-affected.mjs` rules; `--check-sync` fails on divergence | **TRUE** | `node scripts/validate-affected.mjs --check-sync` → "IMPACT_MAP sync: OK (19 areas, 51 patterns)" |
| 30 | `.agent/KNOWN_ISSUES.md:522` | decode-uri-component ReDoS accepted to 2027-03-31 with a renewal owner | **TRUE** | `scripts/certification/dependency-audit-allowlist.json` `expires: 2027-03-31` + owner named |

## Check 3 — open backlog items vs the code

| Backlog item (`BACKLOG.md:13-97`) | Verdict in code | Pointer / note |
|---|---|---|
| `allowBackup` cloud-backup product decision | **OPEN (accurate)** | `apps/mobile/plugins/with-android-backup-rules.js:7` documents "`allowBackup` stays TRUE (platform default; no explicit manifest attribute)". No explicit attribute anywhere; accepted-debt boundary per brief §3 — no new evidence to escalate. |
| iOS build validation | **OPEN (by definition)** | No macOS host; `PARITY_MATRIX` iOS = PLANNED, "real build blocked on Windows host". |
| SAF share/picker consent manual QA | **OPEN (by definition)** | External/manual lane; consistent with `PASS_C` "Not reproduced / deferred". |
| Coverage thresholds absent | **OPEN (accurate)** | `grep collectCoverage\|coverageThreshold apps/mobile/jest.config.* apps/mobile/package.json` → no matches. |
| Backup file rename durability (no fsync) | **OPEN (accurate)** | `apps/mobile/src/data-portability/file-transport.ts:139` documents the rename as atomic; no `fsync` call exists in the file. |
| Snapshot review debt | **OPEN (accurate)** | Single snapshot artifact `apps/mobile/src/app/__tests__/__snapshots__/visual-baselines.test.tsx.snap`, 302,184 bytes. |
| v12 rating-repair semantics | **OPEN — not re-verified in detail** | The item references the v12 migration inside `apps/mobile/src/db/schema.ts`; this lane did not trace the repair path (engine lane scope). Recorded as OPEN per docs; a code-level re-verification is still owed. |
| `content/registry.ts` layering (game-module import) | **OPEN and confirmed worse-scope than "layering" reads** | `apps/mobile/src/content/registry.ts:24-25` imports `loadContentPack` from `@/games/language-word-match/content-validation` and `@/games/language-context-fit/content-validation` — the Content Platform has a hard compile-time dependency on two specific games. |
| Type-only import cycle `db ↔ workout ↔ personalization ↔ rating` | **OPEN (consistent, not re-verified edge-by-edge)** | Requires an import-graph pass; the recorded claim (runtime acyclic, type-only edges) is plausible and was asserted by 066 recon. |
| Test-only UI components (Avatar, ScreenHeader, LevelCard, StreakCard, ResultRow/StatRow, LiveRegion) | **OPEN and confirmed for the two kit components** | `apps/mobile/src/components/ui/avatar.tsx` and `screen-header.tsx` exist with 0 non-test importers via their module path (barrel imports not distinguished; tests are the only consumers). Also a docs consequence: `DESIGN_SYSTEM.md:85` advertises them in the shipped kit. |
| uiautomator partial-tree race | **WRONG-SCOPE for a repository audit** | Tooling/host artifact; closure criterion ("rerun with an explicit settle wait") is a device-lane action, not code. No repository defect is implied. |
| Jest-skip waivers (5 opt-in probes, expiry 2027-03-31, renewal owner) | **OPEN as a scheduled review (accurate)** | `scripts/certification/jest-skip-allowlist.json` exists with `"expires": "2027-03-31"` entries (incl. `perf quest eval A/B (opt-in via PERF_PROBE=1)`). |
| **BACKLOG framing line** (`BACKLOG.md:3-12`): "the owner-authorized 056–067 overnight program is the active successor" | **STALE** | The program is `COMPLETE` (`GOVERNANCE.json`, `STATE.md:5`, ledger "Program CLOSED"). This is the one "recorded open but actually finished" style error in the file. |

## Check 4 — governance coherence (detail beyond F03)

- `GOVERNANCE.activeCampaign: null` + `activeProgram.state: "COMPLETE"`: **coherent** — the program
  is a container for changes 056–067, all `VALIDATED` (`openspec/changes/*/change.json`), and
  `validate-repo-state.mjs` accepts and prints it. Defensible design; the defect is prose
  (F03) plus the missing `lastProgram` record.
- `openspec/changes/*/change.json` statuses vs tree: **all 52 active changes are `VALIDATED`** and
  `npx openspec validate --all --strict` = 52 passed / 0 failed. No status lies about a missing
  change directory. `change.json` files exist for 006r/015–029/031–040/042–067 (numbered 001–014
  and 030/041 era changes are archived or recorded without one).
- **New this session:** `openspec/changes/068-storage-adapter-runtime-parity/` is an **untracked**
  directory (created 2026-09-30 20:11) containing only `.openspec.yaml` (40 bytes) — an
  audit-campaign proposal scaffold in flight. It is not a governance contradiction today, but it
  is why "51/51" claims are already stale (52/52), and it means the audit campaign is writing into
  a read-only tree: worth flagging to the orchestrator that proposal scaffolding is being created
  in the working tree and must be committed deliberately, not incidentally.
- **Recovery path (`CURRENT_CAMPAIGN.md → OVERNIGHT_056_067_STATE.md → change 067`)**: first
  misleading place is `CURRENT_CAMPAIGN.md:3` (`**Status:** ACTIVE`) followed by `:5`
  ("post-067 hardening PHASE_2 active"). After that hop the chain is unambiguous: the ledger has a
  single "Program CLOSED" line and per-change verdicts, and `067/change.json` is `VALIDATED`.

## Checked and found clean (do not re-report)

- `node scripts/validate-repo-state.mjs` → PASS (exit 0); program cursor and campaign fields parse.
- `node scripts/validate-offline.mjs --check` → CLEAN, 985 files, no network API outside allowlist.
- `node scripts/validate-secrets.mjs` → CLEAN, 2722 tracked text files.
- `node scripts/validate-workflows.mjs` → PASS, 4 workflow files.
- `node scripts/validate-task-ownership.cjs` → passed.
- `node scripts/qa/validate-runtime-qa-contract.mjs` → PASS.
- `node scripts/validate-affected.mjs --check-sync` → OK (19 areas, 51 patterns) — `IMPACT_MAP.md`
  is genuinely in sync with the executable rules.
- `npx openspec validate --all --strict` → 52/52, including 067.
- Catalog count: 42 game directories, domain split 5/5/5/5/5/7/5/5 (memory 7) — README/PARITY
  claims accurate.
- `docs/QA_ARTIFACTS.md` layout, run-id convention, exit-code table and `run.json`-written-last
  rule match the live `qa-artifacts/` tree and the harness code referenced.
- `docs/ANDROID_AUTOMATION.md` tool inventory matches the committed `scripts/android/` files.
- `docs/ARCHITECTURE.md` seam inventory matches the source tree (sync/entitlements/notifications/
  assistant exist; auth absent).
- `docs/DEFERRED_DECISIONS.md` is consistent with `PARITY_MATRIX` deferred rows and with the
  allowlist rationale; no contradicting implementation found.
- `.agent/IMPACT_MAP.md` governance row correctly requires repo-state + task-ownership after
  `.agent/**`/`docs/**` edits (this lane's own report sits in that class).
- `scripts/certification/jest-skip-allowlist.json` matches the BACKLOG description (5 opt-in
  probes, 2027-03-31 expiries, named owner).

## Not covered / could not verify

- **Full Jest matrix** (598 suites / 6,933 tests / 5 snapshots / 0 console output) — not re-run;
  orchestrator-owned per the lane brief. Suite *count* independently confirmed (598 test files).
- **Any device/emulator claim** (067 device matrix, hardening device proofs, launch timings,
  pixel/a11y capture counts, `qrc`/APK hashes) — requires an emulator/APK install, forbidden here.
- **ARTEMIS task traces** (`docs/ARTEMIS_ANDROID_QA.md:105-120`) — external, not in Git.
- **Provenance gate strictness** — `validate-provenance.mjs --check` returned "No changed files
  detected" (vacuous off-diff), so the recorded "provenance PASS" cannot be judged from this tree
  state; a diff-scoped run is required.
- **v12 rating-repair implementation** and the **type-only import cycle** — recorded as OPEN per the
  documents; this lane did not trace them (engine lanes own the code evidence).
- **`docs/RECOVERY_DRILL.md` line-by-line correctness of the 2026-08 drill transcript** — procedure
  inventory only.
- **iOS/SAF/human-a11y/store-signing/external-CI claims** — accepted-debt boundaries per brief §3.

## Contradictions with existing documentation

1. `README.md:88` + `ONBOARDING.md:70-82` + `HARDENING_CLOSURE.md:37-46` + `.agent/STATE.md:22-24`
   + `.agent/OVERNIGHT_056_067_STATE.md` say the gate set is green → `expo-doctor` exits 1 and
   `validate-dependency-audit.mjs` exits 1 today (L10-F01).
2. `.agent/CURRENT_CAMPAIGN.md:3-5` ("Status: ACTIVE", "hardening PHASE_2 active") vs
   `.agent/GOVERNANCE.json` (`activeProgram.state: COMPLETE`) and
   `docs/hardening/post067/HARDENING_CLOSURE.md:4` (`POST_067_HARDENING_COMPLETE`) (L10-F03).
3. `.agent/STATE.md:3` ("Change 066 open") vs `.agent/STATE.md:5` ("COMPLETE … post-067 hardening
   closed") — self-contradiction inside one file header (L10-F03).
4. `docs/MASTER_PLAN.md:6-10` ("Campaigns 001–028 are closed … no campaign is active") vs 52
   `VALIDATED` OpenSpec changes and a completed 056–067 program (L10-F02).
5. `docs/DESIGN_SYSTEM.md:1-30` ("Neon Arcade v3, Campaign 026", cream/plum/vermillion hexes) vs
   `apps/mobile/src/theme/tokens.ts:1-14` ("v4 campaign 051 Signal Arcade", none of those hexes
   present) (L10-F04).
6. `docs/hardening/post067/README.md:11` lists `RESIDUAL_CENSUS.md`, which is not in the directory
   (L10-F05).
7. `.agent/DEPENDENCY_AUDIT.md:8-10` ("19 vulnerabilities … validator reports PASS") vs today's
   failing gate with three unclassified `brace-expansion` advisories (L10-F01).
8. `.agent/BACKLOG.md:3-12` ("the 056–067 program is the active successor") vs
   `GOVERNANCE.activeProgram.state = COMPLETE` (check-3 table).
9. `docs/PARITY_MATRIX.md:9` ("919 files clean") vs 985 files today (L10-F06).
