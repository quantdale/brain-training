# Live press-policy recovery

Independent source reconciliation found a narrow shared-motion defect: a held
Tappable can become disabled, or the platform reduced-motion preference can
change, before press-out. The old hook skipped its release spring under that
new policy and retained scale0.97. This is a real caller/lifecycle defect, not
an inference from emulator frame statistics.

New `press-feedback-policy.test.tsx` keeps Tappable, Animated.Value and the shared
reduced-motion store real. Only native drivers are deterministic. Four cases
exercise disabled/reduced-motion transitions with an active or settled held
press, without synthesizing a press-out that might never arrive. Valid before:
4 failures(actual0.97/expected1),2 controls pass,20.747s. Normal activation/release
and initial reduced-motion controls preserve the positive behavior.

The minimal repair adds effective `animate` policy to the existing cleanup's
dependencies. A policy transition stops the tracked driver, clears its identity
and restores scale1 using the same cleanup as unmount. Ordinary renders do not
change either dependency. Timing/spring constants, native-driver choices, input
callbacks, gameplay clocks and pressed styling remain unchanged.

After:6 affected suites/42tests PASS25.009s, no snapshots; scoped lint exit0.
Initial root global typecheck failedTS2345 only in the new `it.each` readonly
tuple signature. The table now has an explicit mutable tuple type with the same
four rows/assertions; focused recheck6/6 PASS3.567s and scoped lint02 exit0.
The original failure remains in `press-policy-global-typecheck01.log`.
Root global types02 terminal exit0; strict OpenSpec62/62, ownership and repo-state
also pass before commit.

Independent read-only final review found noP1/P2. It checked policy-change versus
ordinary-render cleanup, stale animation completion identity, settled/active
drivers and unchanged activation/accessibility behavior. This is source review
and affected tests, not final native or practical-latency acceptance.

Ignored logs under `qa-artifacts/campaign077/`: `press-policy-before01.log`,
`press-policy-after01.log`, `press-policy-after02.log`, both scoped lint logs,
both global typecheck logs and strict OpenSpec result. Native10 was already
staged from1ef and does not contain this repair; the next installed build must.
