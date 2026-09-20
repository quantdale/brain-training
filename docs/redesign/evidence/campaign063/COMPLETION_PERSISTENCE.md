# Campaign 063 — Completion & Persistence (real mechanic play)

Game: `speed-tap-rush`, standalone deep link, release artifact, real
emulator-local taps (no QA panel — release has none).

- Rounds 1–4 played honestly-poorly (0 hits, 9 wrong taps counted by
  the mechanic): "Round failed" ×4 → "See results".
- In-session result: **"Keep training"** (weak-result honesty),
  single `Score 0` (no duplicate raw-float row — 055 fix holding),
  Accuracy 0%, 0/40, Best streak 0, XP **10** (participation floor =
  pipeline `computeXp(0, 'normal')` — 057 optimistic parity rendering
  the authoritative value immediately), `+10 XP · +2 coins`,
  **"Progress saved"**, Play again / Done.
- Done → Home; force-stop → relaunch (`TotalTime: 1552`) → Home intact.
- Raw: `c63-game.xml`, `c63-r2/r3.xml`, `c63-result.xml`,
  `c63-sresult.xml`, `c63-relaunch.xml` (outside Git).
