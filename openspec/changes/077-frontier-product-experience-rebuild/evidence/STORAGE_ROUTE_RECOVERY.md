# Healthy direct storage-recovery route

Independent source inventory at624a5a77 found a realP2: opening the shipping
`/storage-unavailable` route without an active bootstrap failure displayed
“Storage Unavailable” and Retry, but the route supplied no onRetry callback.
The genuine failed-bootstrap root caller passes both error and retry and works.

Two new real `renderRouter` regressions fail before the repair:
`storage-route-before.log`, one suite/two tests failed35.485s. They observe false
failure copy and the retained action's inability to reach Home. This is a
caller-pattern reproduction, not merely a style assertion.

The repair follows the existing BootstrapRecovery healthy-route pattern:
optional props with defaultempty object; “Ready to Train”, honest no-active-issue
copy, no failure steps, and accessible Go to Home using router.replace('/').
Actual root error/retry/diagnostics, shared RecoveryScreen, IDs and failed-init
protection are preserved. No data, settings, persistence, dependencies or shared
primitives change.

Worker-owned surfaces: `app/storage-unavailable.tsx` and new
`app/__tests__/storage-route-fallback.test.tsx` only. After first source fix:
five suites/53tests PASS20.057s, including direct route, actual storage failure/
retry/success, Bootstrap recovery and shell accessibility/source contracts.
Root global types initially failTS2345: Expo testFileStub expects a route callable
with no arguments. Production defaultparameter `StorageUnavailableProps = {}`
fixes the true route contract without a test wrapper or type suppression.
Final global typecheck exits0; direct-route/real-storage two suites/five tests
PASS13.408s; scoped lint exits0/zero warnings and whitespace checks pass.

Independent read-only review finds noP1/P2 introduced: root's database-failure
branch always supplies the real error/bootstrap callback, so the route-only
condition cannot mask it. The new actual-route tests and existing failed-init
tests are complementary. The reviewer ran no tests/build/device actions and
explicitly leaves native proof open.

Local `qa-artifacts/campaign077/storage-route-{before,after,after02,lint,
typecheck,typecheck-after01,lint-after02}.log` retains both the actual red checks
and initial typing failure. Counts overlap and are not summed. Native09 is pinned
to624a5a77 and excludes this later repair. Native healthy-route Home navigation
and corrected-build visual coverage remain OPEN until a new APK is observed.
