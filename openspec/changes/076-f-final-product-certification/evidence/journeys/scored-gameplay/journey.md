# Controller journey — `scored-gameplay`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `4b95be7a-85ea-4444-8582-a6425547640f` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 0
- Journey log: PRESENT

# Journey Log — com.braintraining.app (Mental Rotation, full game)

## Planned steps
1. Complete the onboarding/tutorial (was at "Example 2 of 2") to reach the scored game.
2. On the Mental Rotation page (Difficulty = Normal), tap "Start game" to open the scored 5-round game.
3. Play all 5 rounds of the full game, capturing per round: the running score BEFORE, the answer given, the EXACT verdict text, and the running score AFTER.
   - Round #1 / "Example 2" tutorial answer: choose "Different".
   - Verify at least one CORRECT, one INCORRECT and one TIMEOUT scored outcome if reachable.
4. Reach the end-of-game summary and record the final score.
5. Consolidate everything into this note with the headings: ## Planned steps / ## Executed steps / ## Observed outcome / ## Defects.

## Executed steps (what I really did, in order)
1. T+00:35 — Tutorial "Example 2 of 2": inspected Target/Candidate shapes, judged the candidate to be a mirror (not a rotation), tapped "Different". Tutorial advanced.
2. T+01:30 — The "You've got it" onboarding sheet appeared over the game page; read it ("Rotations keep every block and color. Mirrored or altered shapes are different…") and tapped "Got it" (button marked "Got it").
3. T+01:44 — On the Mental Rotation page (Difficulties: Easy/Normal/Hard/Expert/Adaptive, Normal selected) tapped the pink "Start game" button ("Game 1 · ready when you are").
4. T+01:54 — Scored game opened at "Round 1/5", "Score 0". Read question "Is the candidate the target rotated?" and the 14-second timer. Attempted a normal (non-burst) tap on "Different" — the round's ~15 s timer expired during turn latency, so the tap was intercepted by the safety net.
5. T+02:39 — Screen showed the timeout verdict. Logged it (Round 1 TIMEOUT).
6. T+03:54 — Fired a Fast-Action Burst: tap "Next round" → wait 2500 ms → tap "Same". Round advanced to "Round 2/5" and the tap registered as a wrong pick. Logged it (Round 2 INCORRECT).
7. T+05:01 — Burst: "Next round" → wait 2500 ms → tap "Different". Round advanced to "Round 3/5"; the tap registered as correct. Logged it (Round 3 CORRECT).
8. T+05:33 — Burst: "Next round" → wait 2500 ms → tap "Different". Round advanced to "Round 4/5"; wrong pick. Logged it (Round 4 INCORRECT).
9. T+05:51 — Burst: "Next round" → wait 2500 ms → tap "Different". Round advanced to "Round 5/5" (5 of 5 complete); wrong pick; button changed to "See results". Logged it (Round 5 INCORRECT).
10. T+06:18 — Tapped "See results" to open the end-of-game summary.

## Observed outcome (quote exact on-screen text)
Full game played: 5/5 rounds, end-of-game summary reached. Round header text: "Round 1/5" … "Round 5/5" with "Score". Question text each round: "Is the candidate the target rotated?" Answer buttons: "Same" / "Different".

Per-round scored outcomes (exact verdict text + running score before → after):

- ROUND 1 — TIMEOUT
  - Verdict: "Time's up"
  - Explanation: "The timer ran out. The correct answer was “Different”."
  - Button highlight: "Different" green with checkmark (accessibility text "Different, correct")
  - SCORE BEFORE = 0 → SCORE AFTER = 0

- ROUND 2 — INCORRECT (answered "Same")
  - Verdict: "Not quite"
  - Explanation: "The correct answer was “Different”."
  - Button highlights: "Same" red with ✗ (accessibility text "Same, wrong pick"); "Different" green with ✓ ("Different, correct")
  - SCORE BEFORE = 0 → SCORE AFTER = 0

- ROUND 3 — CORRECT (answered "Different")
  - Verdict: "Correct!"
  - Explanation: "Correct — the candidate is not a rotation of the target."
  - Button highlight: "Different" green with ✓ (accessibility text "Different, correct")
  - SCORE BEFORE = 0 → SCORE AFTER = 142

- ROUND 4 — INCORRECT (answered "Different")
  - Verdict: "Not quite"
  - Explanation: "The correct answer was “Same”."
  - Button highlights: "Same" green with ✓ ("Same, correct"); "Different" red with ✗ ("Different, wrong pick")
  - SCORE BEFORE = 142 → SCORE AFTER = 142

- ROUND 5 — INCORRECT (answered "Different")
  - Verdict: "Not quite"
  - Explanation: "The correct answer was “Same”."
  - Button highlights: "Same" green with ✓ ("Same, correct"); "Different" red with ✗ ("Different, wrong pick")
  - SCORE BEFORE = 142 → SCORE AFTER = 142

End-of-game summary (exact on-screen text):
- "Keep training"
- Final score: "142"
- "Accuracy: 20%"
- "Speed: 64%"
- "Rounds passed: 1/5"
- "Best streak: 1"
- "Correct answers: 1/4"
- "Timeouts: 1"
- "XP: 17"
- "Reward  +17 XP  ·  +3 coins"
- "Progress saved"
- Buttons: "Play again", "Done"; "UP NEXT · Sentence Builder · Game 2 of 4 · progress saved"

Scored-outcome box: this run DID execute the journey — a full, scored game was played end-to-end (final score 142; 1 correct / 3 incorrect / 1 timeout among 5 rounds; 18 rounds→ no, 5 rounds; correct-answer delta observed +142, timeout 0, wrong 0).

## Defects (or 'none observed')
- DEFECT (usability/latency, affects any automated play): the round timer (~14–15 s, "14 seconds left") is shorter than a single observe→decide→act turn, so a normal (non-burst) answer tap always times out. Round 1 timed out exactly this way (tap intercepted by the safety net after the timer expired). Workaround used: submit "Next round" + the answer as one Fast-Action Burst (~2.5 s apart), which reliably registered answers.
- CONSEQUENCE: because the shapes of a round can never be seen before answering, Rounds 2–5 were answered as blind 50/50 picks (only the burst coordinate could be chosen), so the correct/incorrect mix reflects chance, not reasoning.
- No app crash, no unexpected navigation, no score display bug observed: score arithmetic was consistent (0 → 142 on the single correct answer, unchanged on wrong/timeout; summary "Correct answers: 1/4", "Timeouts: 1", "Rounds passed: 1/5").
- Minor: the timeout verdict for Round 1 was captured only after the incident, not at the instant it appeared (still the genuine post-round scored state).
