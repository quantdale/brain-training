# Proposal — Campaign 025: Game Board Feedback Consistency

## Why

Campaign 024 (VALIDATED) rebuilt the shell, the kit and the shared game chrome
(intro hero, HUD, results), and applied the reference answer-feedback language to
eight category canaries plus the three late-tap games. The remaining **31 game
boards still style their own verdicts**: some change only a text colour, some
change fill but never add a shape cue, and score read-outs still jump instead of
counting. A user crossing categories therefore meets two visual languages inside
one product — exactly the inconsistency the owner directive asks to remove.

Two smaller gaps from the same directive remain open:

- the shared HUD can render segmented round progress (`GameHost.roundProgress`),
  but no game reports it, so every session shows only a round chip;
- the campaign 024 convergence found that verdict feedback is only reliable when
  it derives from the reducer's authoritative outcome — that pattern is proven
  in three games and should be the norm.

## What changes

1. **Board feedback consistency (31 games).** Every remaining game's answer
   surface adopts the shared language: verdict via fill **and** border/shape
   **and** a ✓/✕/⏱ glyph, never colour alone; a wrong pick shown together with
   the correct answer where the mechanic reveals it; the prompt/stem kept visible
   during feedback; feedback resolved from the reducer outcome, not the tap
   handler; scores animated with `AnimatedNumber`; every tappable board cell at
   least 44×44 dp.
2. **HUD round progress.** Games that know their round count pass
   `roundProgress` to `GameHost`, so the session HUD shows real position instead
   of a bare label.
3. **No mechanics changes.** Reducers, generators, scoring, difficulty,
   persistence and every existing testID stay byte-identical.

## Out of scope

Gameplay rules, new games, scoring/rating semantics, persistence formats, sync,
AI, monetization, iOS runtime, store signing, manual TalkBack review.

## Exit gate

All 42 games present the same verdict language; the full Jest matrix, `tsc`,
lint and validators are green; autobot canaries still pass; native evidence
(screenshots of representative boards before/after) exists for each packet's
games; `.agent/VALIDATION.md` records honest PASS / NOT VALIDATED
classifications.
