# Native13 feedback button height recovery

Ordinary NumberLine timeout feedback on installed2cdb/native13 reveals a real
shared-control P2. Next round is a vertical blue pill with its label below the
viewport. Root personally views original4fbfcc5c...6f10. Independent review of
distinct encoded frames at126.236,128.466,165.031 and166.031s finds the same
348px-wide, at least932px-visible-height pill clipped by the1080×2400 viewport.
The minimum observed span is39.795s; duplicated seeks in the sparse recording
are not counted as independent frames. Disabled Submit is a normal horizontal
row earlier. This is not a transient press animation.

The preceding repair correctly moved caller width/flex/margins onto a stable
parent-facing cell. It also unconditionally added inner `flexGrow:1`. That
wrapper is a column, so this grows **height**, including when an intrinsic
GameButton sits in NumberLine's centered feedback card.

A separate offline harness executes actual Button, GameButton, Tappable,
tokens and ancestor/caller styles, then lays those nodes out with the exact
installed React Native0.86.3 Yoga C++ engine. Root independently compiles all19
installed Yoga translation units using g++16.1 and verifies identical results
for all50 emitted comparison/control cases. Native-text measurements are
parameterized fixtures, not an Android text shaper or pixel proof.

The runnable red command is
`node qa-artifacts/campaign077/button14-yoga-repro/run.cjs`.
Before repair it exits1: ordinary feedback face1438.1 logical dp, labely1171.05
in an840dp fixture viewport. Different viewport and text measurements retain
the defect; the reduced intrinsic-column pattern also grows incorrectly.
Switching only the wrapper to a row fixes height but expands intrinsic width
131.81→341.333dp. Simply removing growth preserves intrinsic sizing but fails
to fill explicitly height-sized cells. Both rejected comparisons are retained.

The production repair retains column/cross-axis stretch and all parent-cell
constraints. Inner vertical growth applies only when the caller explicitly sets
`height` or `minHeight`, excluding `auto`. Ordinary feedback now has48dp face /
52.1905dp cell, original131.81dp intrinsic width and a visible fitted label in
the fixture. A48dp-tall label naturally grows the face to64dp. Explicit72dp
height/minHeight keeps the72dp cell/68.1905dp face. NumberLine's wrapped Submit
stays320×48 logical dp with identical disabled/enabled bounds. The final
13 current-source cases pass; comparison variants remain diagnostic, not
accepted production behavior.

Jest pins the offending layout inputs separately from Yoga. Before repair,
`button14-jest-before02.log` records nine valid failures and20 controls. The
initial invocation incorrectly combined `--runInBand` and `--maxWorkers` and
does not count as a red test. After repair the focused29 tests pass; a real
GameButton `height:auto` control is added, then the integrated seven suites /
65 tests / five unchanged snapshots pass31.627s. Final global TypeScript and
zero-warning affected-file lint pass. Expected classified workout-store error
logging remains in the integrated log; assertions and console gates pass.

Independent read-only source review finds no concrete P1/P2 or weakened
assertion in the inspected diff. This is source/Yoga qualification only.
New frozen-source full certification, native14 build/install and actual labeled
feedback/disabled→enabled original-center input proof remain required. No game
mechanic, deadline, answer, scoring, generator, economy or persisted format changes.

| Ignored record under `qa-artifacts/campaign077/` | SHA256 |
| --- | --- |
| button13-feedback-native-review.json | ed2938c65109478fd2a6ab7e281c76d9a26286f13827ddfb486a566ba1c45d28 |
| button14-source-review.json | 661277d03b025eb66f912909fe3c7ef2879cf2bcb6c54c510aa603805c404d72 |
| Repaired production button.tsx | 3fc25336e2192db0d42e0029223516dd37ea24db4d0c7795b2f1cbaef877c7b0 |
| Installed Yoga C++/header inventory | a0bee36fc9640e18307173baeaae2c45e2231ad613ac8e25618757c247c349fd |
| Root-compiled verification executable | 734a68e9ec2dac1a1c6d6e594b78a6e239d35b0bef5b4e4060b0c1870ca1c2e8 |

The engine proof, before/after inputs/results, failed compile attempt and
successful process-PATH-scoped compile remain under `button14-yoga-repro/`.
No native engine/dependency is added to the product or repository gates.
