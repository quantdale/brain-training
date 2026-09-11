# Proposal — Campaign 026: Visual Identity Rebuild

## Why

Campaigns 024 and 025 made the product internally consistent, accessible and
verdict-honest, but the owner's verdict on the result is explicit: **the
frontend still looks the same and it sucks**, drastic change is permitted, and
the design language itself (calm blue-indigo on near-white, equal-weight card
stacks, tint-only states) is the thing being rejected. Consistency alone is
not the goal; a distinctive, energetic, game-like identity is.

The owner's recorded directive (2026-09-12):

> "THE ENTIRE UI/UX FRONTEND STILL LOOKS THE SAME AND IT SUCKS… I permit
> extremely drastic changes to change the entire frontend. Utilize Refero MCP
> to achieve this. Take inspiration from iOS apps like Duolingo, Brilliant,
> Mindllama, Pinkllama… DO NOT STOP and you CANNOT STOP until this is
> achieved."

The deliverable of record is native before/after evidence showing a visibly
transformed product.

## What changes

1. **New visual identity — "Neon Arcade".** Warm-paper light theme and deep
   ink dark theme, vermillion primary, volt reward, violet progression, eight
   vivid domain identities, chunky rounded geometry, tactile buttons with a
   physical lip, larger display type, and a tabular numeral system. Every
   pairing is contrast-checked in both themes.
2. **Kit rebuild.** Every `components/ui/**` primitive is restyled to the new
   language (tactile press, hero cards, chips, progress, empty states,
   headers) with the existing a11y/44 dp/activation contracts preserved; new
   primitives land only where the identity needs them (celebration, spark
   mark, hero metric).
3. **Shell and routes recomposed.** Home gets one hero loop (streak + daily
   workout + level) and a learning-path rhythm; Games becomes a browsable
   catalog with identity colours; Progress reads as chart cards and insight
   pairs; Profile/Rewards/Data management use badge galleries, hero metric
   grids and designed empty states; the tab bar's active state becomes a
   filled lozenge; results become celebration-first.
4. **Game experience.** Intro hero, session HUD (exit · segmented progress ·
   pause), feedback and results are restyled to the new language; the
   Campaign 025 verdict vocabulary and reducer-authoritative feedback are
   preserved exactly; the prompt stays mounted; no mechanics, scoring,
   generator, persistence or testID changes.
5. **Celebration moments.** A confetti/spark/streak/level-up beat system
   (reduced-motion safe, code-native Views — no new native dependencies)
   staged after the results CTA, never merged into it.
6. **Native verification.** Before/after captures on emulator-5560 for the
   shell, routes and representative boards in both themes plus display
   profiles; a11y audit stays at 0 violations; autobot canaries and the
   daily-workout journey pass; full Jest/tsc/lint/validators green; a release
   artifact is rebuilt; `docs/DESIGN_SYSTEM.md` documents the new system.

## Out of scope

Gameplay, scoring, rating, difficulty, generators, session timing,
persistence formats, sync, data portability, AI, monetization, iOS runtime,
store signing, manual TalkBack review, new native modules, new games, and any
dependency replacement.

## Exit gate

The owner's acceptance test is the evidence: native before/after frames show
a visibly different product on every captured surface (new palette, type,
composition, motion and celebration — not a token tweak), while the automated
matrix, validators, canaries and a11y audit are green and no testID was lost.
