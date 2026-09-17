# Campaign 040 before/after integration evidence

## Capture sets

- Before: `D:\Temp\campaign040-runtime-before` — 22 PNG/XML pairs captured
  before the Campaign 040 repairs on the synchronized release candidate.
- After: `D:\Temp\campaign040-runtime-after-all-fixes` — 22 PNG/XML pairs
  captured from final release APK `1FF87618F190513BC04A84BA597BC0BE8764317EA8B5BC4720683EB4BE539DAA`.
- Both sets are 1080x2400 light/dark captures on the same dedicated AVD.

The after run includes a real persisted Memory session, so it is not a
pixel-equivalent fresh-data comparison. A read-only RGBA comparison across all
22 pairs measured 57,024,000 pixels, 32.8595% changed pixels, RMSE 33.620,
and mean absolute channel delta 9.809. The larger changes are dominated by
stateful Home, Games, Progress, Profile, Rewards, and Results content; they are
not presented as a pure visual-regression metric.

The stable Game Intro pair changed 0.04% of pixels in each theme. Game Detail
was inspected directly in both before and after states: the after populated
state exposes the Trends link with the shared 44 dp target style, and the final
a11y audit reports no undersized control.

## Interaction-trap before/after

The pre-fix standalone Memory result (`D:\Temp\campaign040-standalone-memory`
and the earlier release artifact) showed the first-play tutorial card mounted
over the visible `Next round` bounds. XML placed the tutorial at
`[42,1690][1038,2274]` over the button’s `[42,1716][1038,1842]`, and a normal
ADB tap did not advance. A regression test was made red against that source
state before the repair.

The final release’s `D:\Temp\campaign040-final-memory\round1.png` visibly shows
the feedback and the full `Next round` button, and `round1.xml` contains no
`memory.tutorial`. The button was tapped and the session advanced through the
remaining rounds to final results. This is the functional comparison that
supports the GameHost change; it is not inferred from a screenshot alone.
