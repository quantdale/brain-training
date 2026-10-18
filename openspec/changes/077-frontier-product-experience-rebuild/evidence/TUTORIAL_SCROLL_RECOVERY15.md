# Tutorial scrolling recovery — native14 failure, native15 qualification pending

Status: BOUNDED NATIVE15 REPAIR QUALIFIED. Native14 failure source `0c8794ddbcaa743cc9ed202da047b54da2792b8b`,
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

## Terminal boundary and preservation

Task3ca1611c returns normal Home, whose settled original
`abcea5a0098d1fbb9263f36927297d41dce748fb6b7a4e040471e0ac43bef028.jpg`
root personally views at286XP/68coins/newOct18zeroof4. All authorized UI work and
concise notes are finished. The operator then repeats convergence/no-tool turns;
root stops it, terminalCANCELLED1312.4s. This is neither a task/checkerPASS nor a
new credential failure. Its stdout and concise notes are retained externally;
stderr file is absent. No optionalOutputter400 is observed on this task.

Post-terminal copied SQLite integrityok/13sessions, protected historical/economy/
rating/profile/settings tables and all old workouts are exact. Verification
SHA256 `6b621939fe258eee70a242966209f4d2a1990072291f9de6032f4a9895e9796a`.
In addition to the already known zero-valued Oct18 quests/active0of4 plan, only
tutorial metadata changes: Grid retains replay_requested1 after the incomplete
replay; Transform completed/replay0 gains its normal completion timestamp.
Thus the operator's generic "no writes" wording is not literal database evidence.
No new gameplay/reward is recorded. Originaldensity420/font1 is restored before
installing a different APK. Guest networking remains offline pending needed
offline checks; its saved original1/1/0 still requires restoration.

Source candidate `9e5b2a1bf3df5fac3ecd9d410846d9b379145246` is committed/pushed.
Native15 build uses its exact1107-file snapshot, inventorySHA256
`6ccef1ba94e501c95b09be5dc66072e92faad36fcc1290636e8044715215e3ce`.
At that checkpoint build/install/same-profile-after and fresh certification
were pending. The subsequent native result follows; final full certification
and broader product acceptance remain separate.

## Native15 actual after — qualified

Installed/source/hash proof is in NATIVE_PREVIEW15.md. Pro
`e36e32c1-09bd-4265-aa0c-d45d5c1e8cda` is terminalCOMPLETED356.3s, checkerOFF.
At the same320dp/font2/offline profile, two in-Demo swipes move the content and
expose all four commands and three complete answer boards. A visible-prompt
ordinary choice is accepted, Got it dismisses normally, Start is visibly
reachable and never pressed; normal Back/Games/Home returns expected totals.
The initial explanation-sheet outer-page swipe is not the repaired behavior.

Root personally views these actual stored originals in the external images
directory; each filename is its SHA256 plus `.jpg`:

- After first Demo swipe: `4d24a54d7310448359c978977f4f21f4fb1703a0432e2474e9ac342608d10c13`.
- All four commands/three choices: `8293729e861216b52162acf48f90b59d4915b62dbadd7b3a7e2a3fa735cc87a9`.
- Accepted completion: `1b80c650995c43357094ce42e75e967eaf15d651c1f106a6f4ba1c550626b07e`.
- Dismissed to unpressed Start: `95480740abba8f0835b5f2b056c3320649ef870f0ef3c6d54f311faf99458b39`.
- Returned Home: `a720375e7de38dda6180d17831fcf91c2786f1f975dea6260a78a4111e492b59`.

The independent reviewer personally views/hash-checks these and the native14
failure original. ReviewSHA256
`b97a5849f71146683b4a01d5b395d55a0b66b4d7c1bcf052c35748cb73a7b582`
(`qa-artifacts/campaign077/tutorial15-native-after-review.json`) gives bounded
PASS without inferring all tutorials, themes, latency or physical accessibility.
The one-prop experiment supports nested drag negotiation as the repair seam;
no low-level event-recipient trace was captured.

Root fresh post-task bracketedHome and protected-copy verification are in
NATIVE_PREVIEW15.md. Actual copied SQLite integrityok/13sessions/286XP68coins/
activeOct18zeroof4;12tables match the before-task boundary exactly. Only Grid's
normal completion resets replay_requested1→0 and updates its timestamp.
VerificationSHA256
`d5364b06a47edf540239f1418a821bb1a15f573e7cf2a85f5c88aa92c0c30d34`.
Originaldensity420/font1 is restored exactly. No game session/reward is created.

The task stderr file is absent; external stdout/notes are inspected. Its web
recorder reports zero images/steps, so no valid video evidence is claimed.
Stored original step images independently supply the proof. The pale Home bar
under0of4 is the normal empty workout-progress track, not a loading skeleton;
one operator wait does not imply a measured app loading delay.
