# Audit lane brief — 2026 repository-wide engineering audit

**Campaign:** exhaustive read-only technical audit of `quantdale/brain-training` to produce a
canonical master plan plus implementation-ready OpenSpec change proposals.
**Planning only:** this campaign MUST NOT implement, fix, refactor, or apply anything.
**Audit tree state at start:** `main` @ `2a765cc`, clean except untracked assistant-tool config dirs.

---

## 1. Project facts (verified, do not re-derive)

- Product source: `apps/mobile/src` — ~1583 `.ts`/`.tsx` files, ~283k lines.
- Stack: React Native 0.86.3 + Expo SDK 57 + expo-router + TypeScript 6 + Reanimated 4.5.1,
  `expo-sqlite` (canonical local persistence), jest-expo, ESLint 9.
- 42 games, one directory per game: `apps/mobile/src/games/<domain>-<slug>/`
  (domains: attention, flexibility, language, logic, math, memory, spatial, speed).
- Custom validators: `scripts/validate-repo-state.mjs`, `validate-provenance.mjs`,
  `validate-offline.mjs`, `validate-secrets.mjs`, `validate-affected.mjs`,
  `validate-workflows.mjs`, `validate-dependency-audit.mjs`, `validate-task-ownership.cjs`.
- Governance + durable state: `.agent/*` (`GOVERNANCE.json`, `STATE.md`, `CURRENT_CAMPAIGN.md`,
  `KNOWN_ISSUES.md`, `BACKLOG.md`, `VALIDATION.md`).
- 67 prior OpenSpec changes in `openspec/changes/*` (51 strict-valid), plus a completed
  post-067 hardening phase in `docs/hardening/post067/`.

## 2. Orientation — read before you start

Read enough of these to avoid re-reporting closed work and to check documentation claims
against reality:

1. `AGENTS.md` (repository operating rules) and `docs/PROJECT_CONSTITUTION.md` (locked product
   decisions — locked decisions are NOT findings).
2. `.agent/CURRENT_CAMPAIGN.md` (head 200 lines), `.agent/GOVERNANCE.json`.
3. `docs/hardening/post067/HARDENING_CLOSURE.md`, `PASS_A_STATIC.md`, `PASS_B_RUNTIME.md`,
   `PASS_C_RELEASE_UX.md`, `CONVERGENCE_LOG.md`.
4. `openspec/changes/067-terminal-whole-product-certification/` and `066-*` and `065-*`
   (`proposal.md`, `tasks.md`, `audit-map.md`).
5. `docs/DEFERRED_DECISIONS.md` (deliberately deferred decisions — NOT findings).

## 3. Accepted debt — do NOT report as new findings

Coverage thresholds · v12 rating-repair semantics · backup fsync · snapshot review debt ·
`allowBackup` product decision · checksum-is-integrity-not-MAC · unauthenticated
`braintraining://` deep-link scheme · `decode-uri-component` ReDoS (expiry 2027-03-31) ·
landscape/RTL/long-string captures · 42-game six-way interaction expansion · human
TalkBack/VoiceOver runs · iOS · physical/OEM devices · store signing · external CI/account policy.

You may report on these ONLY with materially new evidence that the accepted debt is worse than
recorded (e.g. a concrete defect inside the accepted boundary), and you must say so explicitly.

## 4. Absolute rules

1. **READ-ONLY.** Do not edit, create, or delete any file except the one report file named in
   your lane instructions. Do not run formatters, `--fix`, `expo prebuild`, package installs,
   anything that mutates the working tree, `package-lock.json`, or the Git index.
2. **Allowed diagnostics (read-only, non-destructive):** `git log`/`git show`/`git grep`,
   `grep`/`find`, `node scripts/validate-*.mjs`, `npx eslint <path>` (no `--fix`),
   `npx jest <specific suite paths>` (ALWAYS targeted — never bare `npx jest`, the full matrix
   is ~4 minutes and is owned by the orchestrator), `npx jest --listTests`, `npm ls`, and
   reading files. Prefer small `node -e` scripts that only READ files.
3. **Evidence is mandatory.** Every finding cites exact paths (line numbers or symbol names), a
   short quoted snippet, and either the exact command you ran plus its result, or the precise
   scenario/test that would reproduce it. A finding without evidence does not exist.
4. **Do not fabricate.** No speculative vulnerabilities. No "improve testing". No stylistic or
   cosmetic rewrites. No fashionable-technology proposals. If you cannot confirm a suspicion,
   label it `suspected` / `requires runtime validation` and state exactly what would confirm it.
5. **Trace across boundaries.** Caller → callee, writer → reader, producer → consumer,
   init → teardown, success path → failure path, UI → state → DB → UI. Document claims are
   evidence to verify, not truth.
6. **Severity honesty.** P0 critical (security, corruption, catastrophic reliability,
   release-blocking) · P1 high · P2 medium · P3 low. Do not inflate. Do not demote a real
   defect because the fix is awkward.
7. **Absence matters.** Ask: what happens when this fails, who validates this, who authorizes
   it, what prevents duplicates, what happens on retry/concurrent execution/partial completion,
   what cleans up, what protects this invariant, what tests it, what alerts an operator, what
   happens at boundaries/empty data/degraded dependency.
8. Respect the host-interaction prohibition: no host mouse/keyboard, no focus stealing, no
   emulator launch, no APK install. Static and unit-level evidence only.

## 5. Report file contract

Write your complete lane report to the path given in your instructions, using this exact
structure:

```markdown
# Lane <ID> — <title>

## Scope covered
- Deeply inspected: <paths + file counts>
- Structurally inspected: <paths + method (grep/symbol map/call trace)>
- Diagnostics run: <exact commands + result summary>
- Intentionally excluded: <paths + justification>

## Flow map
<The end-to-end paths you actually traced, with the symbols involved.>

## Findings

### <LANE>-F01 — <specific title>
- Severity: P0 | P1 | P2 | P3
- Confidence: confirmed | strongly indicated | suspected | requires runtime validation | requires manual validation
- Category: correctness | reliability | security | data-integrity | architecture | performance | concurrency | api-contract | frontend | testing | build-ci | dependencies | config | observability | docs-dx
- Files: path:line (symbol), path:line
- Evidence: <quoted snippet and/or command + output>
- Problem: <what is wrong>
- Why it matters: <impact, and the realistic failure scenario>
- Root cause: <determinable cause, or "not determined">
- Recommended solution: <what should change, in this repository's idiom>
- Implementation considerations: <invariants, migration, compatibility, failure behavior, edge cases, existing patterns to follow>
- Dependencies: <other lanes / existing subsystems / prior changes>
- Risks: <regression/operational concerns>
- Validation required: <exact commands/scenarios that prove the fix>
- Completion criteria: <objective, checkable conditions>

## Checked and found clean
<Explicit list so no other lane repeats it.>

## Not covered / could not verify

## Contradictions with existing documentation
```

## 6. Return value (your final message)

Keep it under ~200 lines: (a) the lane flow map in 5 lines, (b) a table of every finding with
ID / one-line title / severity / confidence / single best evidence pointer, (c) "checked clean"
one-liners, (d) "could not verify" one-liners, (e) the report file path. Do not paste the whole
report back.
