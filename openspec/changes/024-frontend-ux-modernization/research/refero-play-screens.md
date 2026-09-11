# Refero research: game / play screens (iOS, 2026-09-11)

All screens iOS. IDs are Refero screen UUIDs; colors are Refero-extracted hex, sizes ~pt estimated from thumbnails.

## Reference screens

1. **Duolingo** `b14f7342` — lesson results with 3 stat cards ("High scorer! / You earned 50 XP").
   White bg; mascot illustration top-third (~180pt tall); 28pt rounded bold yellow headline; 15pt grey subline with XP.
   3 equal cards in one row (~110×90pt, 12pt radius, 2pt colored borders: yellow `#FFC107` XP+bolt, blue `#2196F3` time+stopwatch, green `#4CAF50` accuracy+target); label 11pt uppercase / value 20pt bold, icon+value same accent color. Full-width blue CONTINUE (~52pt tall, 16pt radius, shadow) pinned above home indicator. Order: art → headline → subline → cards → CTA.
2. **Duolingo** `14fbd37a` — lesson-complete variant, 2 stat cards ("Lesson complete!").
   Same skeleton but 2 wider cards (XP + time only); proves the card row scales 2↔3 without layout change — good model for games with fewer metrics.
3. **Duolingo** `2c986e7d` — pre-game intro for timed review ("Rapid Review", PLAY).
   Top bar: grey X left + `Unit 1` header; 3-star row (earned star filled `#FFD700`, rest grey outline); mascot; bold title + 1-line rules subline ("Get every exercise correct before time's up…"); 2-col info box (LEVEL `2 of 3` | EARN `20 XP`, green values, hairline divider); full-width green PLAY. Rules-before-reward in one glanceable screen, single CTA.
4. **Duolingo** `cd864dc6` — "Story complete!" on dark `#121921`.
   Same 3-card pattern re-skinned: solid color-filled cards (yellow/blue/green) with black text instead of white+border; yellow 30pt headline; mascot + sparkles. Proof the results template works in dark mode by inverting card fill, keeping hue→metric mapping identical (XP=yellow, time=blue, accuracy=green).
5. **Brilliant** `49b4fccf` — minimal level-up splash ("You leveled up!", badge `2`).
   Pure white, no CTA: orange `#FF7F00` starburst badge (~72pt) above 26pt bold black headline, ~8 small orange star confetti pieces, huge whitespace. Auto-dismisses (no button) — celebration as beat, not a screen. Keep under ~1.2s.
6. **Imprint** `0db39eb7` — incorrect-answer feedback with correct-answer reveal (Q3/8).
   Top: back chevron + centered `3/8` pill; question on white rounded card with shadow; bottom feedback sheet: pale pink `#FDE7E7` full-width panel (~40% height, 24pt top radius) overlapping content, bold `Incorrect` 20pt, hairline pink divider, `Correct Answer:` label + answer in body, full-width blue Continue (~52pt). Feedback never covers the question — sheet slides over the illustration zone only.
7. **Vocabulary** `3a6fb393` — in-place option states + bottom explainer (beige `#D3CFC6`).
   Options keep black borders always; states = fill + left icon only: wrong `#B85A53` + ✕, correct `#7DA974` + ✓, untouched grey. Bottom cream panel: coral dot icon + bold `That's incorrect`, correct word bold + 1-line definition, teal `#8FC1C1` bordered `Next word` button. Teaches: mark both the picked-wrong AND the right answer simultaneously; always pair reveal with a 1-line why/definition.
8. **LookUp** `adfca28a` — dark-mode error feedback (black `#000000`).
   Circular progress ring top-center (green arc on grey track); answered options dim to `#777777` on `#222222` (disabled look); feedback = saturated red `#FF0000` panel, white ✕ icon + `Incorrect Answer. The correct answer is X`, dark-red `#880000` Continue inside the panel. On dark bg error must go full-saturation red — pastel pink (Imprint) would be unreadable.
9. **Drops** `de69b9c5` — full-bleed teal `#1CA3A3` in-question result (`1/1 correct!`).
   Score IS the header (white 30pt bold, centered) with prompt as subline; answers as full-width rows with divider, white circular ✓ / translucent ✕ badges at row right; white `NEXT QUESTION` pill (teal text). Alternative to bottom-sheet: dye the whole background the verdict color for single-prompt speed rounds.
10. **Acorns** `0d1048db` — quiz result with score ring on maroon `#7B3B44`.
    Green `#6CC644` ring (~160pt) with trophy glyph + `100%` 34pt white inside, `Your score` caption; `Perfect!` 26pt + grey social-proof subline (`25% better than the community`); 2-col stat card (`5/5 correct` | `1 min`, hairline divider, darker panel); white Next button. Ring + 1 comparative sentence outperforms raw numbers for perceived achievement.
11. **Breathwrk** `4bfb8f6d` — dark celebration result with dial + confetti.
    Black bg + multicolor confetti; number-first hierarchy: `31.5` ~64pt → `seconds` label → `Your Lung Health Score is` caption (inverted vs Duolingo's label-first); thick white arc dial (~180pt, no ticks); grey `Want to retest? click here` link; white `Save and Continue`. Model for our timed games: giant metric first, dial as echo, retest as quiet link not a competing CTA.
12. **CapWords** `a1762c65` — perfect-score confetti screen (`100%`, `OMG! YOU KNOW ALL THE WORDS!`).
    Light grey bg, confetti top/sides only (never behind CTA); circular badge text ring around giant pink `#E91E63` `100%`; left-aligned `Got it!` label + 3 small recap thumbnails in a row; black Finish button. Confetti density ~30 pieces, kept to margins so text stays legible.
13. **Imprint** `5467b388` / **Foodvisor** `0590e3dd` — streak moments (1-day / 2-day).
    Identical skeleton: flame icon w/ count (~72pt, yellow core `#FFD966` + red-orange `#E94B3C` shell) → `You're on a N-day streak!` 24pt → 5–7-day tracker row (active = flame under letter in `#F0F3F7` rounded strip, inactive = grey circles) → 1-line nudge (`Good things always come in three…`) → dark navy/black Continue. Streak = icon+count, week strip, tease of next milestone, one CTA. Never more than 4 stacked groups.
14. **Brilliant** `33e8dd6e` — interactive puzzle board (shortest-path grid).
    HUD = X left + 4-dot segmented progress + green fill + bolt icon right; 16–18pt centered instruction (2 lines max); board = near-full-width square, grey streets, black-outline selectable nodes, blue `#007AFF` car start + pin destination, dashed path preview; right-aligned `Start over` text-button with reset icon; full-width black `Check`. Selection feedback is instant (node fill + dashed connector) — Check only submits, never reveals state.
15. **Moises** `62f5e80e` — pre-round countdown.
    Black bg; segmented/dashed cyan `#04D4E2` progress ring (~200pt) + white numeral ~72pt bold centered inside; bordered translucent `Skip` below. Ring segments drain per tick; numeral pops scale on each decrement. Countdown is escapable — always offer Skip.
16. **Promova** `7d77e4b3` — quiet completion card.
    Pastel-purple `#B3B8FF` rounded card (~24pt radius) holding headline + big purple check disc + `Well done! Keep it up!`; black `GO TO FEED` outside the card. For low-stakes completions: card-contained praise + neutral exit CTA, no XP theater.

## PATTERNS-PLAY

1. [pre-game intro] One screen, five blocks max: close · stars/progress · mascot or game mark · title + 1-line rules · reward box (LEVEL|EARN) · single PLAY CTA ≥52pt tall. (Duolingo `2c986e7d`)
2. [pre-game intro] Reward box uses 2-col hairline-divided strip, labels 11pt grey uppercase, values 18pt green; never more than two promised rewards. (`2c986e7d`)
3. [in-session HUD] Left X, center segmented progress (4–8 dots or bar, green fill), right icon cluster (bolt/streak + pause). Single 44pt-tall row, no second HUD line. (Brilliant `33e8dd6e`)
4. [in-session HUD] Timer ring: ~200pt circle, segmented arc in accent cyan, 72pt numeral inside; tick = 1 segment + numeral scale-pop 1.0→1.15→1.0 over 150ms; always a Skip/exit affordance. (Moises `62f5e80e`)
5. [in-session HUD] Selection state previews instantly on the board (node fill + dashed connector); the submit button (`Check`, black, full-width) never doubles as state display. (`33e8dd6e`)
6. [answer feedback] Wrong-pick marking: keep option borders constant, change fill + prepend ✓/✕ icon; always highlight the correct option alongside the wrong pick (green + red visible together). (Vocabulary `3a6fb393`)
7. [answer feedback] Bottom feedback sheet: full-width panel, 24pt top radius, slides to ~40% height, verdict 20pt bold + hairline divider + `Correct Answer:` + 1-line explanation + full-width Continue. Never covers the question stem. (Imprint `0db39eb7`)
8. [answer feedback] Dark-mode error = saturated red `#FF0000` panel w/ white text + darker `#880000` inner CTA; dim answered options to grey-on-charcoal to read as locked. (LookUp `adfca28a`)
9. [answer feedback] Speed-round alternative: dye full background the verdict color, score as 30pt header (`1/1 correct!`), rows with circular ✓/✕ badges, contrasting pill CTA. Use for ≤3s single-prompt rounds only. (Drops `de69b9c5`)
10. [round-transition] Level-up beat: badge (~72pt starburst w/ number) + 26pt headline + sparse confetti (~8 pieces), no CTA, auto-advance ≤1.2s. (Brilliant `49b4fccf`)
11. [pause overlay] Pause = 44pt circular button top-left over dimmed board; overlay freezes timer numeral, offers Resume (primary) + Restart + Quit (quiet links) — timer ring state must persist visibly behind the sheet.
12. [results screen] Order is fixed: art/badge → 26–30pt headline → 15pt subline w/ XP → metric cards → single CTA. Never CTA above cards. (Duolingo `b14f7342`, Acorns `0d1048db`)
13. [results screen] Metric cards: 2–3 equal cards, 12pt radius, 2pt colored borders on light / solid fills on dark; 11pt uppercase label + 20pt bold value + matching glyph; hue→metric fixed (XP yellow, time blue, accuracy green). (`b14f7342`, `cd864dc6`)
14. [results screen] Score ring variant: ~160pt ring, trophy glyph + 34pt % inside, `Perfect!` headline + 1 comparative subline (`X% better than…`), 2-col stat strip, contrasting CTA. Use when a single composite score is the story. (Acorns `0d1048db`, Breathwrk `4bfb8f6d`)
15. [results screen] Timed-game variant: 64pt metric first, unit label, caption, arc dial echo (~180pt, no ticks), retest as quiet grey link — never a second primary button. (`4bfb8f6d`)
16. [reward celebration] Perfect-score: confetti confined to margins (~30 pieces), ring badge around giant score, 3-item recap thumbnails, single Finish. Confetti never sits behind body text. (CapWords `a1762c65`)
17. [reward celebration] Quiet completion: pastel card (24pt radius) containing headline + check disc + 1-line praise; neutral exit CTA outside card; no XP numbers for low-stakes wins. (Promova `7d77e4b3`)
18. [streak moment] Stack of exactly 4: flame-with-count (~72pt) → `N-day streak!` 24pt → week strip (flames = done, grey dots = pending) → 1-line next-milestone tease → dark Continue. (Imprint `5467b388`, Foodvisor `0590e3dd`)

## FEEDBACK-CHOREOGRAPHY

Timings inferred from reference structures (instant state + sheet/beat conventions); haptic/audio values are the concrete spec to implement.

**Correct answer** — 0ms: tapped option fills green + ✓ icon pops (scale 0.6→1.0, 120ms), board/HUD input locks; light haptic `impactLight`. 80ms: score counter ticks up (+10/20 XP fly-up label, 14pt, rises 24pt fading over 500ms); short `ding` (~660Hz sine, 90ms). 200ms: progress segment fills (green wipe 250ms); streak-bolt pulses if streak alive. 400ms: bottom success sheet (24pt top radius, green-tinted) slides up 300ms ease-out with 1-line affirmation (`Nice!`, `Exactly right`); medium haptic `notificationSuccess`. 800ms: Continue CTA reaches full opacity/enabled; auto-advance only in speed rounds (Drops model), otherwise wait for tap.

**Wrong answer** — 0ms: picked option fills red + ✕ (same 120ms pop), device `notificationError` haptic (sharp double-tap), low `buzz` (~180Hz, 120ms); input locks. 80ms: correct option fills green + ✓ (both visible together — Vocabulary rule); score counter does NOT animate. 200ms: screen shakes horizontally ±6pt, 2 oscillations, 250ms total (board only, HUD stays fixed). 400ms: pink/red feedback sheet slides up (300ms) with `Incorrect` + correct answer + 1-line why; no confetti, no sound beyond the buzz. 800ms: Continue enabled; wrong option stays red-dimmed behind sheet so the mistake is reviewable on return.

**Session end** — 0ms: board freezes, final input locks, timer ring completes (last segment fills, 200ms). 80ms: transition wipe/fade 250ms to results; success `chime` arpeggio (523→659→784Hz, 300ms total) or muted single tone for low scores. 200ms: headline + art fade/slide in (staggered 100ms apart, 300ms each); heavy haptic `notificationSuccess` once. 400ms: metric cards pop in left→right stagger (80ms apart, scale 0.9→1.0); XP value counts up over 600ms. 800ms: CTA fades in enabled; confetti (perfect scores only, CapWords density, margins-only, ~1.5s) OR quiet card (Promova) for standard completions; streak moment queued as separate beat AFTER results CTA, never merged into it.

## ANTI-PATTERNS

- Verdict by text color alone (grey→red text, no fill/icon change) — unreadable at speed; references always change fill + icon + border weight together.
- Feedback modal covering the question stem — every reference keeps stem visible; sheet ≤45% height or full-bg dye with the prompt restated as subline.
- Two competing primary CTAs on results (e.g. `Retest` beside `Continue`) — references demote retest to a quiet grey link.
- Confetti behind body text or on every completion — CapWords/Brilliant reserve density for perfect/level-up; routine wins get the quiet card.
- Merging streak celebration into results — Imprint/Foodvisor always stage it as a separate 4-block beat after Continue.
- Timer as bare digits with no ring/arc or no Skip — Moises pairs numeral + draining segments + escape on every countdown.
- Metric cards with shifting color semantics — Duolingo light/dark keeps XP=yellow/time=blue/accuracy=green across all screens; never reassign hues per game.
- Blocking `Check`/`Continue` that also displays state (greyed until valid with no hint) — Brilliant keeps Check always tappable-looking with instant board preview doing the communicating.
