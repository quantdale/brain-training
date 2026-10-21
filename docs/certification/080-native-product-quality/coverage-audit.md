# Coverage audit — original vs reclassified vs fresh (Campaign 080)

Date: 2026-10-21
Contracts: v1 (historical, permissive) → `coverage-contract/2.0` (corrected)
Purpose: show exactly how far the original Campaign 080 coverage claims
overreached, what the historical evidence actually proves, and what fresh
execution on the corrected harness certifies. **Historical figures are never
silently replaced.**

---

## 1. Original reported coverage (v1, unchanged — historical record)

Source: `scripts/qa/native-coverage-ledger.json` (pass 1) +
`qa-artifacts/080/sweep-pass2.json` (pass 2), merged by the v1 merger.

| Claim (v1) | Count |
|---|---|
| ≥ L1 native smoke | 42 / 42 |
| ≥ L2 native interaction | 38 / 42 |
| L3 full lifecycle | 1 / 42 |
| L1-only | 4 (`logic-code-cracker`, `memory-running-order`, `speed-color-match`, `speed-reaction-time`) |

**These numbers are unsubstantiated under the published definitions** (F-080-001):
v1 awarded L2 for attempted taps/Start presses, and its merger could blend
runs. Original ledgers are preserved byte-for-byte under
`scripts/qa/historical/080/` with sha256 recorded in
`coverage-reclassification.md`.

## 2. Historical reclassification (same evidence, corrected contract)

Tool: `scripts/qa/reclassify-historical.mjs` (conservative synthesis — actions
become ATTEMPTED, outcomes only where the recorded control inventories prove
them). Full per-game table: `coverage-reclassification.md`.

| Corrected verdict on historical evidence | Count |
|---|---|
| **Certified** (full contract incl. provenance) | **0 / 42 runs valid** — v1 recorded no git SHA / APK hash / versionCode / device serial and no action→observation binding (F-080-004/005) |
| Evidence depth ≥ L1-complete (incl. verified safe exit) | 0 / 52 runs — no historical run observed any post-exit destination (F-080-002) |
| Depth ≥ L2 (would prove gameplay with complete provenance) | 0 / 52 |
| Downgraded vs v1 claim | **52 / 52 runs** |

Notable demonstrable false positives from the replay (state sequences from the
historical hierarchy dumps):

- `language-word-chain` — **tutorial state in all 17 recorded phases**; v1
  claimed L2 PASS on a tutorial-side tap.
- `memory-pair-recall` — tutorial→intro→playing but **no input ever accepted**
  (no state change after any tap); v1 claimed L2 on "started".
- `attention-sustained-vigilance` — intro→intro→intro→**results with no
  playing state ever observed**; v1 claimed **L3**.

## 3. Fresh rerun coverage (corrected harness, contract 2.0)

Source: `scripts/qa/native-coverage-ledger-v2.json` (single sweep,
`native-game-sweep.mjs` contract-2.0 driver) merged by
`scripts/qa/merge-coverage.mjs` into `native-coverage-merged.json`.

| Corrected metric (fresh) | Count |
|---|---|
| Runs captured | 42 (one coherent attempt per game) |
| L1 verified smoke (incl. verified safe exit) | 4 |
| L2 verified gameplay interaction | 9 |
| L3 verified full-session lifecycle | 5 |
| Below L1 (guided-tutorial demo blocker class) | 24 (22 tutorial-demo-driven; exact transitions in `full-session-validation.md`) |
| Merger diagnostics | 52 invalid historical runs retained+diagnosed; 22 axis conflicts preserved (never overwritten) |

Build provenance of the fresh evidence: git `b7a1eaf2`, package
`com.braintraining.app` v0.1.0 (versionCode 1000), installed APK sha256
`231559b935b436b10959f0a52098473791bf434682f444c2918c07e552ba48ca`,
emulator-5554 (x86_64, SwiftShader). App source is unchanged since `9c4dd138`,
so this APK content matches the swept source tree.

## 4. Downgraded / upgraded games

- **Downgraded (historical → corrected):** every v1 L2/L3 claim — see
  `coverage-reclassification.md` §4 for per-game explanations.
- **Upgraded after harness correction (fresh evidence):** `speed-color-match`
  and `speed-reaction-time` — two of the four formerly-L1-only games — now
certify **L2 VERIFIED with accepted input**; `language-word-chain` (a v1
false-positive L2) now certifies L2 honestly; `attention-odd-one-out`,
`attention-visual-search`, `math-number-line-estimation`, `spatial-transform-match`,
`speed-quick-compare` certify **L3 full-session**. Tutorial-demo traversal
fixes (guided-demo interaction + per-game demo contracts + pause→quit exit
ladder + cached-hierarchy driver) are what made these provable.

## 5. Unresolved gaps (carried forward honestly)

- L3 depth is the scarce resource: full-session completion depends on
  per-family session drivers; games below L3 keep an exact blocking-transition
  note in `remainingGap`.
- Persistence/replay/resilience are **separate axes** and are never implied by
  L1–L3 (contract 2.0 reports them independently).
- Historical runs remain uncertifiable permanently (provenance absent); they
  are historical observation only.
- ARM64/physical Android, iOS runtime, and owner acceptance remain external.
