# Design — 069-dependency-gate-restoration

## Context

See `proposal.md` — Why.

Measured facts at `2a765cc`:

- `npx expo-doctor` → exit 1, 20/21. Six packages behind:
  `expo ~57.0.26` vs `57.0.24`, `expo-constants ~57.0.20` vs `~57.0.19`,
  `expo-document-picker ~57.0.3` vs `~57.0.2`, `expo-linking ~57.0.11` vs
  `~57.0.10`, `expo-router ~57.0.24` vs `~57.0.22`, `expo-sharing ~57.0.22` vs
  `~57.0.21`.
- `node_modules/expo/bundledNativeModules.json` declares exactly the versions
  the repository already pins. The repository is internally consistent.
- The failing expectations come from `https://api.expo.dev/v2/versions/latest`,
  cached at `~/.expo/versions-cache/*-info.json` (`"url": .../v2/versions/latest`).
- `node scripts/validate-dependency-audit.mjs` → exit 1, three
  `brace-expansion` advisories (`ghsa-q2hr-2g5m-vwhr` moderate quadratic
  expansion; `ghsa-qhr7-859c-m2p7` and `ghsa-6j4f-fj2g-mc7p` high, uncontrolled
  recursion → stack exhaustion).
- `npm ls brace-expansion --omit=dev` shows every path is tooling:
  `expo-router → @testing-library/react-native → jest → @jest/core → glob@7.2.3
  → minimatch@3.1.5 → brace-expansion@1.1.18`, plus
  `expo → @expo/fingerprint → minimatch@10.2.6 → brace-expansion@5.0.9`.
  No first-party source import reaches it; the app bundle cannot contain it.
- The allowlist policy already anticipates this: it has a `build-dev-toolchain`
  classification used for `image-size` and `uuid`, with exactly this reasoning
  ("the vulnerable code never ships in the app bundle"). `reviewedAt` is
  `2026-09-13`; the advisories are newer.
- `repository-integrity.yml` invokes the audit as a bare `run: node
  scripts/validate-dependency-audit.mjs`; the script documents exit `1` = fail,
  `2` = BLOCKED. GitHub collapses both to "step failed", so an outage is
  reported as a product failure and a genuine failure is indistinguishable from
  an outage.
- `repository-integrity.yml` runs `npx --yes @fission-ai/openspec@1.6.0 validate
  --all` (no `--strict`) while local evidence records
  `openspec validate --all --strict` against the installed 1.9.0.
- `.agent/CURRENT_CAMPAIGN.md:3` reads `Status: ACTIVE` with "post-067 hardening
  PHASE_2 active" while `GOVERNANCE.json.activeProgram.state` is `COMPLETE` and
  `docs/hardening/post067/HARDENING_CLOSURE.md` records
  `POST_067_HARDENING_COMPLETE`. `.agent/STATE.md:3` says "Change 066 open";
  `:5` says the program is COMPLETE.
- `docs/MASTER_PLAN.md` says "Campaigns 001–028 are closed … no campaign is
  active" and its campaign detail stops at Campaign 016 (2026-08-30).
- `git check-ignore` confirms 0 of 11 assistant-config directories are ignored.

## Goals / Non-Goals

**Goals**

- `main` returns to a genuinely green, honestly-labeled state.
- The push path is hermetic: its result is a function of the repository.
- Genuine internal misalignment and genuine new advisories still fail the push
  path.
- Advisory dispositions carry reachability evidence, and a stale disposition
  set is reviewed rather than accumulating silently.
- Every recorded gate result is attributable to a commit and a date.
- Governance records do not contradict each other.

**Non-Goals**

- Upgrading the six Expo packages as the *mechanism* for a green gate. Bumping
  fixes the symptom and re-creates the failure at the next patch; it remains
  available as an independent, optional follow-up.
- Changing any product dependency for non-advisory reasons.
- Re-deriving the accepted `decode-uri-component` runtime debt (already
  dispositioned to 2027-03-31 with a full rationale).
- Deleting or rewriting the append-only campaign log.

## Decisions

**D1 — Split the doctor check by information source.** One command answers two
different questions: "is the repository internally consistent?" (offline,
deterministic, a real gate) and "has upstream moved?" (network only, a periodic
observation). Serve them separately.

- Chosen: a new hermetic validator comparing declared Expo-family pins against
  the installed SDK's bundled manifest, run in App CI; the network `expo-doctor`
  run relocated to the weekly Repository Integrity job with a drift
  classification.
- Rejected: bump the six packages and keep the gate in place. Symptom only;
  the time bomb is unchanged, and the bump invalidates the certified artifact
  identity for no correctness gain.
- Rejected: `expo.install.exclude` for the six. Suppresses major/minor skew
  too, and makes the check meaningless for exactly the packages where drift
  matters.
- Rejected: keep it in App CI and accept periodic red. Contradicts the
  `greenMain` contract and the hermetic-CI precedent of Change 064.

**D2 — Disposition the advisories; do not "fix" them by bumping.** Every
`brace-expansion` path is `jest`/`glob`/`minimatch` reached through
`@testing-library/react-native` or `@expo/fingerprint`. A version bump would
mean upgrading Jest or the Expo toolchain for a DoS that only a local build
machine can trigger, and would put the repository in dependency-churn for no
user-facing benefit — which the repository's own dependency policy explicitly
warns against.

- Chosen: three `build-dev-toolchain` entries, each naming package +
  advisory id, carrying the reachability evidence, and pointing at the tracking
  location.
- The per-advisory scoping means a *different* `brace-expansion` advisory still
  fails. That is the property that keeps the allowlist from becoming a blanket
  suppression, and it is why the toolchain-only classification is safe here.

**D3 — Make BLOCKED a first-class, distinguishable outcome.** The audit script
already defines three outcomes (pass / fail / blocked) and CI flattens two of
them. Rather than parse a log line, the CI step should branch on the exit code
and surface "could not be determined — network/registry unavailable" as its own
outcome. This matters because the gate is the only network-dependent security
check in the repository, so its silence is the dangerous direction.

**D4 — Align the OpenSpec validator with the evidence, in both directions.**
The durable evidence claims strict validation; CI runs non-strict on an older
pinned CLI. Two options: weaken the claim, or strengthen the gate. The claim is
the useful one — strict validation is what has been catching structural
problems across 51 changes — so the gate moves to strict. The CLI pin is
separately a drift risk: 1.6.0 in CI, 1.9.0 locally, so artifacts can validate
in one and not the other. Pin the CLI to the version the repository's own
planning artifacts were authored against, and state that pin where the
evidence records the strict run.

**D5 — Amend claims, never rewrite the log.** `.agent/VALIDATION.md` is an
append-only campaign record whose value is that it says what was true at the
time. Amend entries with the observed condition, the commit, and the date; add
a current-state correction block rather than editing history. The `greenMain`
claim/execute split then gets a structural fix: declare the *enforced* gate set
so the contract can detect an undeclared red gate — today 9 enforced gates
(including both failures above) appear in no declaration, which is precisely
why these two reds were not visible to the governance model.

**D6 — Prefer deleting this change's own scope creep to a separate change.**
The governance-prose contradictions and the stale master plan are the same root
cause as the false gate claims: durable state is not reconciled against
executable reality. They are one change, and leaving them for later would mean
the repository ships this change still asserting things that are false.

**D7 — Ignore, do not commit, local agent tooling.** These trees are
per-developer state; some subpaths (`.kimi-code/local.toml`, sessions, logs) can
hold local credentials, and `.gitignore` already ignores those specific paths.
Committing the trees would put machine-specific content in a closed-source
product repository; leaving them untracked keeps `git status` permanently noisy,
which erodes the signal the governance model relies on. Ignore the trees, and
keep the credential-bearing subpaths explicitly ignored.

## Risks / Trade-offs

- **Allowlisting an advisory is a suppression with a paper trail.**
  → Mitigation: the entries are per-advisory, carry reachability evidence, and
  the classification expires into review when the toolchain changes. The
  alternative (bumping Jest/Expo toolchain) trades a real risk for churn.
- **Losing per-PR upstream visibility.**
  → Mitigation: the weekly job is retained and its summary published; the
  internal-consistency half — the half that indicates a repository defect — still
  runs on every push.
- **The hermetic validator could silently pass if the manifest moves.**
  → Mitigation: fail closed when the manifest is missing or unparseable, and
  cover that path in `--self-test`. A gate that passes because it read nothing
  is the failure mode this whole change is about.
- **Moving the doctor step out of App CI could be read as weakening CI.**
  → Mitigation: the hermetic replacement is strictly stronger for repository
  defects, and the change states that explicitly so a reviewer does not have to
  re-derive it.
- **Correcting durable state may trip the repo-state validator.**
  → Mitigation: run `node scripts/validate-repo-state.mjs` after the amendment;
  amendments add dated corrections rather than restructuring.
- **Amending `STATE.md`/`CURRENT_CAMPAIGN.md` while a future campaign may start.**
  → Mitigation: the corrections are about the *completed* 056–067 program's
  status presentation, not about the next campaign's authorization; a new
  campaign sets its own status fields, which the validator already reconciles.

## Migration Plan

1. Disposition the three advisories with evidence; confirm
   `validate-dependency-audit.mjs` exits 0 and still fails on an injected
   unrelated advisory.
2. Add the hermetic alignment validator + `--self-test`; wire it into App CI in
   place of the doctor step. App CI is green again from this point.
3. Add the scheduled doctor run with drift classification.
4. Distinguish audit BLOCKED from FAIL in CI.
5. Align the OpenSpec validation step (strict + CLI pin) and re-record the
   evidence truthfully.
6. Amend durable state; reconcile governance prose; refresh `docs/MASTER_PLAN.md`;
   fix the `post067/README.md` entry that lists a non-existent file.
7. Add `.gitignore` coverage; confirm a clean `git status`.
8. Rollback: each step is independently revertible; reverting 2 restores the
   current flapping behavior, i.e. the pre-change state.

## Open Questions

None. The policy choice is settled by D1; bumping the packages forward is
recorded as an independent follow-up rather than an open question, because it
changes neither the specs nor the task structure.
