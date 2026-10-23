# Independent Review — Campaign 080 corrected native-QA certification

**Reviewer:** independent read-only adversarial reviewer (source-code analysis
with line cites and direct inspection of the raw evidence JSON).

**Verdict: ACCEPT WITH FINDINGS — 4 × P1, 6 × P2.**

**How to read this document.** The findings, verdicts and evidence below are
the reviewer's own, preserved verbatim and unedited. Dispositions of these
findings are tracked separately in
[`review-finding-resolution.md`](./review-finding-resolution.md) so that the
original findings are never rewritten as though they had never existed.

**Tooling limitation declared by the reviewer up front:** this reviewer session
had no execution or write tool — only read/grep/ls. All verdicts below are from
static source analysis. Fixture *experiments* and `node --test` runs are marked
**NOT PROBED (no execution tool)** rather than guessed at.

---

## Original review (verbatim)

**Reviewer role:** independent read-only adversarial reviewer. **Tooling limitation up front:** this reviewer session has no execution or write tool — only read/grep/ls. All verdicts below are from source-code analysis with line cites and direct inspection of the raw evidence JSON. Fixture *experiments* and `node --test` runs are marked **NOT PROBED (no execution tool)** rather than guessed at. The full deliverable is returned inline (runtime will persist it to `docs/certification/080-native-product-quality/independent-review.md`).
## Review
- **Correct:** the cross-run fabrication and attempted-as-succeeded protections are structurally real (evidence below); historical reclassification is honest; merged counts match the matrix exactly.
- **Fixed:** n/a (review-only).
- **Finding:** 4 × P1, 6 × P2 (ranked below). The P1s are evidence-attribution and over-claim defects, not level-ladder defeats.
- **Merge verdict:** **ACCEPT WITH FINDINGS** (details at end).
---
## Verdict per adversarial question
**Q1. Tutorial-only session → L2? — RESISTED.**
L2 (`coverage-contract.mjs`, `deriveLevelFromAxes`) requires `gameplayEntered` VERIFIED, which needs an event whose before-state is intro/tutorial and after-state is `playing`; a controls list containing `tutorial` always derives `TUTORIAL` (`observeState`), so tutorial-only evidence can never verify entry. Pinned by fixtures N2/N3 and regression R1 (which I traced statically). **Residual blind spot (P2):** the `PLAYING` special-case in `observeState` (pause + stage/round-result…, no `tutorial`-prefixed id) would treat a demo/verdict surface lacking a `tutorial` testID as gameplay — no fixture covers a demo without the `tutorial` control. NOT PROBED with a fixture.
**Q2. Button-tap request counts without state change? — RESISTED (literal) / DEFEATED in substance.**
The `accepted` filter re-derives `stateFingerprint(before) !== stateFingerprint(after)` from raw observations (string fingerprint, `coverage-contract.mjs`); a no-op tap cannot count (fixture N6). **But causal attribution is unchecked (P1):** in `language-word-chain`'s fresh run, event seq 4 (tap `chain-word.2`, before obs4 / after obs5) is credited `inputAccepted` + `feedbackObserved` although the observed change was a **round timeout** — obs5 shows `round-timeout`, `round-answer-reveal` ("Correct: estuary"), locked options; obs2–4 show an empty chain and identical boards (`native-coverage-ledger-v2.json` obs2–5, events 2–4). The tap window (≈3.5 s incl. dump latency) simply contained an autonomous transition.
**Q3. Stale results screen → L3? — RESISTED (tested shapes).**
`resultsCurrent` requires the first results observation to follow the last playing observation with no EXITED/LAUNCHER/UNKNOWN between; fixture N10 pins the stale-at-launch case. Real evidence: `attention-sustained-vigilance`'s results surface is not attributable → matrix `Results F`, capped at L1. **Residual blind spots (P2):** currency is order-based only (no score/content binding to the session); INTRO/TUTORIAL observations between last-playing and results are not excluded; `firstState()` means a stale results early in a run permanently fails the axis even if a current results appears later (conservative false-negative).
**Q4. L1 without successfully exiting? — DEFEATED (mechanism identified).**
1. `observeState` maps `controls: []` + marker `non-game-app-screen` → `EXITED`. `native-game-sweep.mjs` `screenMarkersFor()` emits `non-game-app-screen` whenever the hierarchy dump parses **no** game controls — including transient `uiautomator dump` failure or a system dialog over the game. The post-Back observation then proves "exit" and `safeExit` → VERIFIED → L1.
2. The `safeExit` search in `deriveCapabilities` does not require `actionExecuted === true`, and a crash-to-launcher counts (`playing>launcher` is in `LEGAL_TRANSITIONS`). In-evidence near-miss: `language-word-chain` obs6–15 are all `launcher` after tapping `next-round` (app left foreground, event 5 marked acknowledged) — a pending exit-intent event there would have "verified" safe exit.
Fixture experiment NOT PROBED; mechanism is direct from cited lines.
**Q5. Run A's Start + run B's Results → fictitious journey? — RESISTED.**
`merge-coverage.mjs` certifies only the deepest level from one valid run (`best = valid.reduce(...)`); M1/M2 fixtures pin it; the union is labelled and would trigger `cross-run-union-not-a-journey` (absent in real merged data, consistent — no game's union looks complete without a single-run L3). **P2:** matrix axis columns are unions over **all** runs including the 52 invalid historical ones (`perRun` built from `list`, not `valid`), so a cell can show `V`/`F` from runs the same document calls uncertifiable (e.g. `TutDone F` on L2 rows comes from historical runs).
**Q6. Unknown game ID → PASS? — DEFEATED (adversarially).**
`validateRunRecord` rejects only `knownGameId === false` — a caller-supplied flag. A fabricated `gameId` with the field omitted (or true) passes validation, is grouped by the merger, and can certify; no registry cross-check exists in contract or merger. The real-data path is protected only incidentally because `native-game-sweep.mjs` enumerates `apps/mobile/src/games/**/game.json`. Fixture N19 covers only the explicit-false case.
**Q7. Wrong APK's evidence reused? — RESISTED at level certification** (N14; single-run levels). **But (P1/P2):** artifact `sha1` values are self-asserted — the `expectedSha1 !== sha1` check (N15) **can never fire on real sweep records** because `native-game-sweep.mjs` never writes `expectedSha1`, and nothing re-hashes artifact files on disk. The sweep stamps one `buildIdentity` (captured once) onto all 42 runs over ~1 hour with no per-run re-verification; the merger does not warn when builds mix across inputs.
**Q8. Missing screenshot counted? — DEFEATED.**
`validateRunRecord` accepts `evidenceArtifact: null` unless `requireArtifact === true` — and `requireArtifact` is **never set** by the sweep (no occurrence in `native-game-sweep.mjs`). Real evidence: `attention-odd-one-out`'s pivotal obs8/obs9 (the playing→results sessionEnd proof) carry `evidenceArtifact: null` yet the run certifies L3; `language-word-chain` obs6–14 have none. The `native-qa-correction.md` claim "Every proof is bound to … artifact hashes" exceeds both code and evidence.
**Q9. Timed round expiry distinguishable from correct answer? — DEFEATED.**
(a) `language-word-chain`: the timeout verdict landed inside a tap's observation window and was credited as accepted input + fresh feedback (see Q2). (b) `attention-odd-one-out` L3: round 1 **timed out before the first gameplay observation** (obs3 already shows `round-failed`, which renders "Time's up" — `attention-odd-one-out/screen.tsx:431`), zero answer taps, score 0 — yet `full-session-validation.md` labels it "answer-driven rounds". (c) Observation-vocabulary conflation: in `speed-color-match`, both the wrong-pick and missed/timeout branches emit testID `trial-wrong` (`screen.tsx:157` and `:168`), and the reducer records a wrong tap as `timeout` with a reaction reading (`reducer.ts:124-133`) — the recorded controls **cannot** distinguish wrong answer from stimulus timeout. Fixture N11 only covers the no-input-between-observations case.
**Q10. Broken test/run silently disappears from counts? — RESISTED.**
`merge-coverage.mjs` retains invalid runs (raw ledger, `totals.invalidRuns`, `invalid-run` diagnostics — M5/M12); the sweep's catch keeps errored runs as level 0 FAILED. **P2:** default merge exits 0 even with invalid runs (only `--strict` exits 1); duplicate `executionAttemptId`s are not detected (inflation, not disappearance). The node test suites themselves are **NOT PROBED** (no execution tool) — "28/28" / "72/72" claims are unverified at runtime.
**Q11. Failed Android operation marks a milestone true? — DEFEATED.**
`native-game-sweep.mjs` `act()` emits `actionExecuted: true` unconditionally while `tap()`/`back` use `adb(…, { tolerant: true })` which swallows failures to `''`. Combined with Q4's dump-failure→EXITED mapping and the `safeExit` search not checking `actionExecuted`, a failed Back plus a failed dump can mark `safeExit` true.
**Q12. Partial/corrupt ledger merges cleanly without warning? — RESISTED (literal).**
Unreadable/malformed/schema-1 inputs exit 2; partial records produce `invalid-run` diagnostics and matrix notes. **Caveats (P2):** type-corrupt-but-parseable entries (`events`/`observations` as non-iterable object/number) crash `classifyRun` → `deriveCapabilities` spreads `record.events` / iterates `record.observations` **without Array guards** (`obsBySeq`, `const events = [...(record.events || [])]`) — uncaught TypeError instead of a structured diagnostic; default exit 0 with invalid runs (see Q10). Crash path NOT PROBED (static only).
---
## Additional verifications
**Historical reclassification honesty — VERIFIED (with one unprobed item).**
- Backups exist (`scripts/qa/historical/080/original-native-coverage-ledger.json`, `original-sweep-pass2.json`); `reclassify-historical.mjs` reads originals and writes backups first-write-wins (`if (!fs.existsSync(dest))`), never modifying sources.
- Original vs backup compared line-for-line: all 42 v1 `levelReached` records at identical line numbers, identical heads (schemaVersion 1, `generatedAt 2026-10-21T07:21:19.432Z`, free-text `buildIdentity` label).
- v1 claim totals independently recounted from the originals: pass-1 = 10×L1 + 31×L2 + 1×L3 (42 games); pass-2 = 4×L1 + 6×L2 (10 runs) → **14 L1 / 37 L2 / 1 L3 = 52 runs** — exactly matches `coverage-reclassification.md` §2. No inflation.
- All 52 runs reclassified to certified L0 with per-run downgrade explanations; consistent with `native-qa-correction.md`'s "all 52 … fail provenance validation".
- **NOT VERIFIED:** cryptographic sha256 re-hash of originals vs recorded hashes (346507 bytes / `24083d3b…`, 80483 / `69c52764…`) — no execution tool.
**Matrix vs merged JSON — VERIFIED.** `native-coverage-merged.json` `totals`: runs 94 / valid 42 / invalid 52 / games 42 / byLevel {0:24, 1:4, 2:9, 3:5, 4:0} — matches `native-coverage-matrix.md` exactly (5 L3 / 9 L2 / 4 L1 / 24 L0 ✓). 22 `"axis"` conflict entries match `coverage-audit.md`'s "22 axis conflicts" claim. Downgrade table names all 42 games ✓ (every game id appears).
**L3 end-to-end spot-check (results currency) — `attention-odd-one-out`.** obs0 exited → obs1 intro (identity ✓) → obs2 intro (Start tap 1 unacked) → obs3 playing **with `round-failed` + `round-result-board` already up ("Time's up")** → obs4–8 identical boards ("Score 0", five unacked `next-round` taps) → obs9 results score "0" (**artifact null**) → obs10 terminal results (screenshot) → obs11 exited via `.quit`. Currency holds *order-wise* (results follow last playing, nothing between); attribution is order-only (score "0" ↔ "Score 0" is the sole content link). The L3 *derivation* is correct per contract; the *narrative* ("answer-driven rounds") is not. A second L3 (`spatial-transform-match`) shows genuine acknowledged answer taps (`options`/`next-round` alternation after a traversed tutorial) and is credible.
## Docs-vs-code inconsistencies found
1. **(P1)** `full-session-validation.md` L3 table: "attention-odd-one-out — answer-driven rounds + round verdicts" — contradicted by its own ledger (zero answer taps; timed-out round; score 0).
2. **(P1)** `native-qa-correction.md` "Every proof is bound to … artifact hashes" vs `requireArtifact` never set and null artifacts accepted (Q8).
3. **(P2)** `full-session-validation.md` "speed-color-match … cleared the demo and reached L2": the certified ledger's speed-color-match run (`sweep-…175333144Z`) contains **no tutorial phase at all** (intro→playing directly; tutorial-seen persisted from earlier passes), and its L2 rests on event 2 — a tap on `current-swatch` (the stimulus display, matched by `SELECTOR_RE`) whose change was the `trial-wrong` verdict ~3.4 s later. The demo-clearing is not evidenced in the certification ledger.
4. **(P2)** L2 definition ("tutorial completion where required", matrix level defs) vs `deriveLevelFromAxes`, which never consults `tutorialCompleted`.
5. **(P2)** `coverage-audit.md` §2 row "0 / 42 runs valid" contradicts the 52-run count used by all other rows.
6. **(P2)** `merge-coverage.mjs` loader rejects the real v1 shape ("malformed ledger") before the schemaVersion check, making the mandated `reclassify-historical.mjs` guidance unreachable — a known bug pinned by `merge-coverage.test.mjs` M7, but the contract comment still advertises the guidance.
## Ranked blind spots
1. **P1** — Causal attribution: autonomous transitions inside tap windows credited as accepted input/feedback (word-chain; odd-one-out).
2. **P1** — Dump-failure/dialog → `non-game-app-screen` → `EXITED` → `safeExit` VERIFIED; `safeExit` ignores `actionExecuted` (Q4/Q11).
3. **P1** — Artifact binding weaker than claimed: `requireArtifact` never set, `expectedSha1` never written → hash-mismatch check dead on real data (Q7/Q8).
4. **P1** — Narrative claims exceed evidence (items 1 and 3 above).
5. **P2** — `knownGameId` caller-controlled; no game registry check (Q6).
6. **P2** — Matrix union columns include the 52 invalid historical runs' axes.
7. **P2** — Results currency order-based, not content-bound; INTRO/TUTORIAL gap allowed; `firstState` quirk.
8. **P2** — Duplicate attempts undetected; default merge exit 0 with invalid runs; type-corrupt arrays crash ungracefully.
9. **P2** — `trial-wrong` testID shared by wrong-pick and timeout/missed branches (app-side vocabulary conflation feeding Q9).
10. **P2** — Doc/code mismatch on tutorial-completion in the L2 definition.
## Claims I could NOT verify
- All test-green claims (28/28, 12 merger tests, 72/72) — **NOT PROBED** (no execution tool); fixture source read and found consistent with its assertions, but never run.
- sha256 hashes of the preserved originals (re-hash impossible); byte-identity verified only by line-level comparison.
- Fixture experiments behind Q4/Q6/Q7/Q12 mechanisms (static analysis only).
- `coverage-audit.md`'s "App source unchanged since 9c4dd138" (requires git history).
- Runtime behavior of the transient-dump-failure path (mechanism cited, not reproduced).
## Final verdict: **ACCEPT WITH FINDINGS**
The corrected contract defeats the v1 failure modes I actually attacked: cross-run journey fabrication, attempted-taps-as-L2, unconditional safe-exit, shallow milestone overwrite, and provenance-less certification all RESISTED with code and evidence behind them; the historical reclassification is honest and the published counts are exact. I could not defeat the level ladder itself.
However, this certification must not be cited externally until the P1s are addressed: (a) the timeout/answer causal-attribution flaw means at least one certified L2 (`language-word-chain`) rests on a coincidental timeout verdict, and one certified L3's "answer-driven" label is false (`attention-odd-one-out`); (b) artifact binding is overstated in the docs relative to code; (c) the safe-exit/L1 path has a dump-failure false-positive mechanism. Smallest fixes: exclude verdict/timeout transitions from `inputAccepted`/`feedbackObserved` attribution (require the changed fingerprint to match the tapped control family, or reject windows containing `round-timeout`/`*-failed` verdict markers), set `requireArtifact` on key observations and record `expectedSha1`, require `actionExecuted === true` plus an app-destination (non-launcher) marker for `safeExit`, and correct the three doc claims. Re-run `node --test scripts/qa/coverage-contract.test.mjs scripts/qa/merge-coverage.test.mjs` after fixes — this reviewer could not execute them.

---

# ROUND 2 — independent adversarial review EXECUTED (2026-10-23)

Reviewer identity: **OpenAI Codex CLI (`codex exec`)**, model default codex
profile, executing in a disposable detached git worktree
(`../brain-training-review` @ `d528ed1a`) with its own scratch space — a
separate context and separate harness from the implementation author, with
executable probes. The previously failed routes (Claude Code OAuth expired;
built-in reviewer quota) were NOT retried blindly; the Codex route had failed
last campaign at sandbox level and now executes, so it was used.

Scope executed: all four original P1 findings, all six original P2 findings,
the two artifact-verifier defects (F-080-NEW-001/002), and an independent
attack surface (input/timeout causality, safe-exit, hierarchy interpretation,
missing/mismatched artifacts, cross-attempt/cross-build reuse, CLI exit codes,
malformed/duplicate ledger records, stale results, tutorial-only false
positives, unknown game IDs, timed-stimulus vocabulary, coverage merging,
quarantine, current-run provenance). Negative controls were executed against
~27 crafted fixtures; the reviewer also ran the QA suites directly (41/41,
33/33, 35/35; the `node --test` worker path was sandbox-blocked (`EPERM`) and
reported as NOT_PROBED rather than guessed).

## Verdict: REJECT (with named repairs)

A genuine adversarial outcome. Per-finding verdicts (FIX_VERIFIED ×6,
FIX_INCOMPLETE ×6) and eight NEW findings with exact reproductions are recorded
in the reviewer's immutable report:
`qa-artifacts/080/review/codex-review-final.md`.

Open at verdict time (P1s): **P1-1/NF-080-001** (failed commands could certify
action-caused milestones) and **P1-3** (merge-coverage certified without
artifact verification).

## Repairs landed (same session)

Both P1s are repaired with regression tests pinned to the reviewer's own
fixtures (`scripts/qa/test-fixtures/080-review/`): execution-gated causality
(`actionExecuted === true` required for every action-caused milestone; passive
changes become autonomous events), and per-run artifact attestation in
merge-coverage (non-certifying when artifacts fail verification; strict mode
exits non-zero; explicit `artifactAttestation` block). QA suite 136/136 green
incl. the new pins; verify-artifacts CLI 40/40; tsc clean. Dispositions:
`qa-artifacts/080/contract-repair-p1-report.md`.

**Still open and honest:** P2-B3/B4/B6 and NF-080-002..008 remain for repair
packet 2, and the repaired engine has **NOT yet been independently re-reviewed**
— which the campaign closure policy requires. Campaign 080 remains ACTIVE.
