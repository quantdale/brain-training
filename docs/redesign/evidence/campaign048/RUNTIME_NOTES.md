# Campaign 048 Runtime Notes

All actions used emulator-local ADB/UIAutomator on `emulator-5554`; no host
input injection and no `emulator-5556` access occurred. The release route
sample ran without Metro.

Structured debug markers from the Campaign 046 catalog run recorded successful
database bootstrap, progression loading, first-interaction latency, and
session-persist outcomes for the canary games. Persistence durations were in
the observed sub-second-to-low-second range for those canaries. The node probe
baselines are the more repeatable scale measurements for this packet.

One intentionally unsupported deep link (`braintraining://home`) rendered the
standard unmatched-route recovery surface. Its Go back action returned to the
Home route and exposed the normal Home/Games/Progress/Profile navigation tree;
this is recovery evidence, not a claim that the unsupported URI is a product
route.

The emulator occasionally makes UIAutomator dumps slow while the app is
rendering. Timing claims above keep that shell overhead separate. No current
release crash, ANR, database lock, or lazy-load failure was reproduced, and no
source repair was justified.
