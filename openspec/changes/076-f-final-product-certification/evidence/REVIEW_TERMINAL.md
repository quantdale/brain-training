# Independent read-only review of critical evidence — 076-f task 8.2

**Reviewer:** independent read-only pass, run by a separate agent from the one that
produced the evidence. It re-read the filed artifacts from disk rather than
trusting the producer's summaries, and it is permitted to find the producer wrong.

**Scope (per task 8.2):** provenance, accessibility and layout, build and security
gates, and parent-task mapping.

**Date:** 2026-10-12
**Artifacts reviewed:** `assessment.json`, `manual-review.json`, 42
`current-device/<game>/review.md` rows, `provenance-table.json`,
`TERMINAL_IDENTITY.json`, `JOURNEYS.md` + 9 journey logs, `ROUTES_AND_A11Y.md`,
`qa-artifacts/game-a11y*`, `GATES.md`, both task ledgers.

---

## Review method

Each claim was re-derived from the artifact that supports it. Where the artifact
and the claim disagreed, the artifact won and the discrepancy is recorded below.

## Findings

### F1 — RESOLVED: three rows passed a word-match check that should have failed

The producer's verification helper flagged 3 rows as failing because their
`review.md` contains the literal string `ABSENT`. On inspection all three are
false positives: the word appears inside a **defect description** — a game
control that is genuinely absent from the accessibility tree — not as the row's
verdict field. Example, `spatial-transform-match`:

> …the 'Next round' control … is rendered below the fold of the board and is
> ABSENT from the accessibility tree until the board is scrolled to the bottom…

**Disposition: not a defect.** Recorded because a naive grep for `ABSENT` will
mis-report these rows as invalid, and a future reviewer must not "repair" them by
deleting true evidence. The authoritative acceptance signal is
`build-assessment.mjs`, which parses the verdict field rather than substring-
matching the whole file.

### F2 — RESOLVED: the assessment's PASS count did not match the rows on disk

An intermediate checkpoint message claimed `PASS 11` by reading `assessment.json`
from a cached file on disk. Regenerating through
`node scripts/certification/build-assessment.mjs` gave the correct count. The
mistake was trusting a stale read instead of regenerating — the same class of
error this campaign exists to catch.

**Disposition: not a defect.** Recorded because it is the second time in this
campaign that a stale read produced a wrong count.

### F3 — RESOLVED: 5 of 9 journey notes were the controller's template

The journeys script accepted a journey when its `journey.md` existed and did not
contain the literal `NOT VALIDATED`. Five notes were the template with every field
empty (e.g. `- Personal record:` with nothing after the colon).

**Disposition: repaired.** The acceptance bar is now substantive — all four
required headings, no labelled-but-empty stub, and 80+ real characters per section,
calibrated against accepted notes (200–1500 chars/section) and rejected skeletons
(9–13). The five skeletons were re-run and now pass. **Lesson generalised:** "the
file exists" is never evidence; a bar must be checked against content.

### F4 — RESOLVED: 37 of 42 game rows were the controller's template

Root cause of the largest gap in the campaign. The game sweep's completeness check
required six headings to be *present* and allowed 60 characters per section, which
a template stub exceeds.

**Disposition: repaired.** The per-section floor is now 200 chars (valid measured
sections run 300–1350; stubs run 90–120), plus a stub-field ratio test. The 37
rows were re-run on the owner-directed model and all 42 now pass.

### F5 — RESOLVED: the sweep discarded a complete note as stale

The session-freshness filter measured trace age from the moment `find_note` ran,
so a note whose daemon task finished *before* the client returned fell outside the
window and was silently dropped — filing a game `NOT VALIDATED` while its complete
note sat unused on disk (observed on `spatial-transform-match`).

**Disposition: repaired.** Age is now measured from when the game's attempt began,
covering the client wait plus the daemon's execution time.

### F6 — RESOLVED: wrong-game evidence was harvested three times

Session identity was matched on the test name inside `stdout.log`, where that name
never appears; a task for one game filed notes describing the previous game.

**Disposition: repaired.** Identity now requires the game's own deep link in the
task plan, a fresh session, **and** the note body naming that game's registry
title (checked via `scripts/qa/game-name.mjs`, a repository tool added for this).

### F7 — OPEN, accepted cost: defect D3 is reproduced but not repaired

The shared `Button` applies `opacity: 0.5` when disabled, collapsing a disabled
primary control's fill and label to ~1.08:1 contrast.

**Disposition: not repaired in this campaign, and the reason is recorded rather
than assumed.** The fix is shared chrome behind all 42 games and every route
Button; it rebuilds the APK, which invalidates every device row captured on
`e243341f…`. The reviewer agrees with the producer's decision **provided the debt
is carried explicitly**, which `VERDICT.md` now does. Task 4.1 stays unchecked.

### F8 — RESOLVED: the APK was installed but never device-hashed

`TERMINAL_IDENTITY.json` recorded `deviceVerification: NOT a current device pull`.

**Disposition: repaired.** The release APK was installed on `emulator-5570`, the
installed `base.apk` pulled, and hashed: `e243341f…`, 48,888,452 B — an exact match
to the host build. Cold launch verified (`LaunchState: COLD`, TotalTime 2399 ms).

## Parent-task mapping review

Every checked parent task was re-read against its own acceptance criteria and the
linked evidence, not against the producer's note.

| Parent task | Linked evidence satisfies it? | Finding |
| --- | --- | --- |
| 6.1, 6.2, 6.3, 6.5 (game states) | **Yes** — 4 complete current-device rows, each confirming the game's mechanic is retained | OK |
| 7.2, 7.5, 8.1, 8.3–8.5, 9.1, 10.1–10.5, 11.5–11.6, 12.3, 13.3, 13.5 | **Yes** — same bar per game | OK |
| 14.3 (accessibility/layout) | **Yes** — measured on the terminal APK across 3 profiles | OK |
| 6.4 | Already checked before this campaign; left as found, not re-claimed | OK |
| 14.2, 14.7, 14.8 | **Not yet reconciled** — owed under task 8.1 | OPEN |
| 14.4 (controller journeys) | **Yes** — 9/9 journeys with substantive logs | OK |

No parent task is checked without linked evidence. No task was bulk-checked.

## Verdict of this review

**No repository-owned Critical or High finding remains open.** Five producer
errors were found and repaired (F3–F6), two were non-defects (F1, F2), and one is
a carried cost with its reason recorded (F7). Task 8.2 is satisfied: the review
found and repaired over-claiming, which is its stated purpose.
