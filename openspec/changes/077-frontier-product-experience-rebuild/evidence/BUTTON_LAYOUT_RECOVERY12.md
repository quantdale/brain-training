# Shared filled-button layout recovery — native12 finding

Actual native12 Number Line original19
`fee7f7d403509b7ed8ab37f853f12ee18849ea1c3b4e98d8e9ca178afbadf455.jpg`
shows the enabled Submit estimate occupying only the left half of its control
row after choosing a position. Earlier disabled Submit spans the row. Root and
independent reviewers personally viewed the original. Actual old-center taps
miss the enabled face; early timeouts with inside-bound taps remain separate
deadline observations. There is no Reset button: the other controls are Move
left and Move right. Prior controller narration naming Reset is incorrect.

The shared Button returned a bare Tappable while disabled, then added an outer
lip View while enabled. GameButton/NumberLine flexGrow, maxWidth and minWidth
stayed on the inner face, leaving the actual parent-facing box unconstrained.
The same seam affects callers supplying width, margins, flex or placement and
secondary GameButtons promoted to primary when selected. This is a shared P2
layout/input-target defect, not a Number Line scoring or generator change.

The source correction keeps a stable cell for filled variants, hides only the
disabled shadow, and keeps the four-dp face clearance. Caller flex/dimensions/
margins/placement belong to the outer cell; padding and visual styles stay on
the face. The face stretches within its cell. Ref, test ID, accessibility and
press handling remain on the Tappable. Intrinsic fullWidth=false and stretched
fullWidth=true caller contracts are retained. No new component library or
dependency is introduced.

Actual fail-before runs at the real NumberLine→GameButton→Button seam:
two suites, eight failures and twelve passing controls,47.495s. Assertions catch
the lost parent constraints after selection, variants/loading and selected
choices. These tests inspect native style ownership; Jest does not execute Yoga.
After the repair, the same twenty tests pass,16.342s.

Integrated first run: eight suites/51 tests pass, one old disabled-lip assertion
fails because it expected removal of marginBottom rather than hidden shadow.
The corrected assertion verifies transparent disabled shadow, retained geometry
and visible enabled shadow. Integrated second run: nine suites/52 tests PASS,
20.159s, no snapshots. The five existing visual canaries/five unchanged snapshots
also PASS,9.398s. Global TypeScript and scoped zero-warning ESLint exit0. Original
failed runs remain under ignored `button-layout-recovery/`; no test is disabled.

Full-source zero-warning ESLint subsequently exited0. A fresh TypeScript run
caught TS2352 in the updated test's JsonElement cast; it was replaced with a
real null guard and typed StyleSheet.flatten, preserving all assertions.
Final global types03 exited0; the three affected suites then passed27 tests,
13.929s. The type failure is retained in typecheck02.log. Independent follow-up
review found no weakened assertion or new P1/P2; immutable review02 SHA256
`61f4f5cc271865983cf61625f813a94a02ea21fadebe1aca8974703c79085601`.

Independent read-only review found no concrete introduced P1/P2. Report SHA256
`37efed087d0efc093425a4338d1ce4d025848f6574b63f2fa52228d57500562a`.
No current styled production caller with fixed height/maxHeight/flex1 was found;
the review does not prove arbitrary future fixed-height layouts. Secondary to
primary selection still changes structure as before; constraint preservation
is covered, equal native Yoga geometry is not yet proven.

Current native12 still contains the original defect. A committed new source,
full current-source certification, new APK and actual disabled→enabled native
bounds/center-retention proof are required, followed by the required final
profile/runtime gates. Do not label source test success as native acceptance.
