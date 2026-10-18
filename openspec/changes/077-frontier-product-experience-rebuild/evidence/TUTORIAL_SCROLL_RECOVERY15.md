# Tutorial scrolling recovery — native14 failure, native15 qualification pending

Status: OPEN. Native14 source `0c8794ddbcaa743cc9ed202da047b54da2792b8b`,
APK `c0d3c1462ebbcb0e75fc719046c7576ff1f1f696605cdd92fc95679bdb95c4ad`.
This finding reopens tutorial acceptance; earlier style assertions did not prove
native scroll reachability.

## Actual failure

ARTEMIS Pro `3ca1611c-1509-4868-b331-d6d2e070426c` uses only emulator-5570,
offline, physical1080×2400/density540 (320dp) and fontScale2. Ordinary navigation
reaches Grid Navigator's pre-game intro and normal How to play replay, then Try
a demo. No actual game Start, QA skip, answer injection or session completion.

The Demo shows its prompt, a 5×5 marker board, and only the first two command
lines, the second clipped at the bottom. Its three answer boards and normal
completion are unreachable. Four distinct in-sheet swipes (600/900/900/1200ms)
leave the content unchanged while the clock advances. Root personally inspected
the original step22 image
`D:\Tools\artemis\traces\images\8e133caef7838e513773f80ee0fd82093a56798b908472af8cbb38ffb24bfc4f.jpg`.
The branch stopped, with ordinary Back navigation to the sibling check. A
proposed tap on the underlying blue sliver was rejected by ARTEMIS's safety
check and never dispatched. Its identity and hierarchy bounds are perception
observations, not a new valid action target.

Transform Match's shorter demo in the same task shows both candidate patterns.
The visible-prompt choice is accepted, Got it returns to a visible Start, which
is never pressed. Root personally inspected step35 original
`afe29b939bd2c449f156781eeed1ed5965159002abba4d482bb17f20f3a1ac17.jpg`.
This is a useful sibling control, not proof that the long Grid content scrolls.
Task terminal notes, saved-data comparison and display restoration remain pending.

## Diagnosis and repair criteria

Ranked explanations: (1) the outer ScreenShell scroll view intercepts drags,
(2) native content measurement yields no scroll range, (3) touches reach the
covered intro. A geometry-only probe of the installed RN0.86.3 Yoga engine,
using the actual ancestor styles and explicit sensitivity leaf heights, gives
positive ranges344–732dp for long content. A deliberately absent `flex:1` on the
content container yields zero range as a negative control. These are modeled
dimensions, not captured native text or native offset measurements.

The game route wraps GameHost in ScreenShell's vertical ScrollView. TutorialFrame
adds a second vertical ScrollView with no nested-scroll negotiation. Installed
RN's ReactScrollView delegates interception to Android. The local API35 platform
source intercepts a MOVE beyond touch slop when the parent has no vertical
nested-scroll axes; a positive offset at the parent's bottom does not bypass
that interception. The nested-scroll prop connects to ViewCompat's native
setter. This supports a one-prop candidate on the inner tutorial view while
keeping height, content, clipping, game rules and hit geometry unchanged.

Existing tests only checked a nonzero viewport height and answer widths. New
caller tests place both real demos inside ScreenShell and check their native
nested-scroll configuration. Their red/green result is a wiring guard only;
RNTL does not implement Android gesture dispatch. The decisive after check must
use the newly built and hash-verified APK at the same combined320dp/font2 profile,
observe all Grid commands and choices through normal scrolling, complete the
demo normally, and reach Start without starting a game. No native15 PASS yet.

Root added only `nestedScrollEnabled` to TutorialFrame's inner ScrollView. The
two new caller guards first fail on the missing prop, with the existing card
control passing (43.184s). After the change, six affected suites/45tests pass
(18.822s), including both real game screens, Grid tutorial completion, GameHost
and ScreenShell inset controls. No snapshots changed. An earlier invocation
combined incompatible Jest worker flags and did not run tests; it is not the
red result. Preserved actual results are `tutorial-scroll15-before.json/log`
and `tutorial-scroll15-after.json/log` under ignored Campaign077 QA artifacts.

The installed Fabric constructor's `true` conversion fallback is not the value
for an omitted prop: `propsConversions.h` returns the source value when absent,
and the default source initializes false. This branch was checked before the
candidate was applied. It does not substitute for native receiver/gesture proof.

Independent diagnosis/source review artifact SHA256
`f4150a6b123836a71824e415409a30655a342e48c4d0442e161889b0432c54ed`
(`qa-artifacts/campaign077/tutorial-scroll-diagnosis15/report.json`). Root reruns
its geometry controls successfully; no broader source writes or device actions
were delegated. Source diff review identifies no additional concrete regression.
Initial typecheck catches a test-only readonly tuple signature; object cases
correct it, final global typecheck and scoped lint pass. Final shared caller
suite3/3 passes8.809s after that correction; production code is unchanged from
the six-suite45-test pass. Full frozen-source certification remains OPEN.
