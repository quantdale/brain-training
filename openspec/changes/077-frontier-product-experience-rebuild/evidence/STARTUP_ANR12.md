# Native12 startup/focus diagnosis — unresolved performance boundary

Fresh focused Flash59de5984-69cc-4502-9aea-88ea628e0599 terminalFAILED182.7s.
It never reached More insights: two bottom-tab attempts returned to the launcher.
Root preserved Android exit-info, crash buffer, recent logcat, both compressed
ANR traces and decompressed read copies. Actual ApplicationExitInfo records
PID9264 at04:44:58 and PID9622 at04:45:57, reasonANR, input dispatch timeout
because no window had focus. Do not relabel these as tap-coordinate misses.

Both sampled main stacks contain ART condition-variable/JNI wait in native vsync
dispatch/MessageQueue.nativePollOnce; JS-side threads show React native constants/
view-property reflection. These observations do not prove app bootstrap never
ran; view constants can be lazy. Audio-player cleanup alone is not a leak.
No source cause is established. The same log shows repeated launcher no-focus
ANRs and heavy guest CPU/graphics scheduling pressure. Settings exit-info also
contains a no-focus ANR. The app's old933 process had the same ANR19:48. This
strongly motivates a system/input/startup timing comparison rather than a
speculative rewrite of Profile/Progress or bootstrap.

Ranked falsifiable hypotheses: (1) device-wide scheduling/graphics/focus stall,
which should affect native controls too; (2) app native-startup delay, which
should remain worse while Settings is healthy; (3) controller key heartbeat
during slow no-focus startup, which should differ from static no-input starts.
No controller setting or app behavior was disabled to manufacture a pass.

The first static focus assay incorrectly queried Android15 window windows, which
omits mCurrentFocus. Its null focus readings are INVALID, not proof of no focus.
Original output remains unchanged. Its separate am-W cold timings are valid:
Settings12105ms/app11870ms. Corrected window displays assay then observes real
Settings focus4760ms(am3914ms) and app MainActivity focus7254ms(am6699ms), on the
same unchanged APK, no guest reboot/input/ARTEMIS/build/Jest. Focus recovered
without a source change; this does not prove heartbeat causality or quiet60FPS.

Root opened Progress through a normal warm deep link and independently preserved
equal settled XML brackets around actual PNG. CaptureSHA256
a9627584a8b95766f46ed4f292ab8595b3b2fe40fe9c96b49c17c3b04a0c7cdb;
actual app focusedWindow807ffcb. Root personally viewed loaded rating986/9sessions
and current30d window. Fresh Flash698816ed-047a-4b9a-acf5-86aa2c259138 starts
from this focused warm route, with one disclosure activation and no relaunch,
and left its actual state for independent settled capture; its failure is
qualified below.

The Android platform documentation explains key-focus timeout behavior and
identifies system pressure/late samples as possible nativePollOnce causes:
[Android ANR diagnosis](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs).
That guidance informs the probes; it does not establish this case's cause.
Final current-build startup/performance/interaction checks remain required;
no app-specific ANR fix or blanket environment exoneration is claimed.

Independent diagnosisSHA256
9694accee5347bba94eaa63897976fea519879734b31f314e76968da560aa8fa.
Warm Flash698816ed terminalFAILED, with no new startup ANR reported in that
bounded trace. Its actual9overlay crosshair lands on Target Count21% at[501,701],
above the visible More insights button near850. Root personally viewed that
overlay and resulting Target Count Results; the intended disclosure activation
was a controller geometry error. This does not resolve the earlier Pro16/17
inside-button inconclusive observations. No new app input defect is inferred.
Root independently bracketed settled Results afterward, equal XML/focused app,
captureSHA2564f11c00057b21df91f07eaacc464c7cdd2847852e484bb23e377d64358ff77c2.
Fresh short Prod1133102-5187-4290-86fa-c0a8cee1c562 read live native XML bounds
[42,1980][1038,2106], then used exactly one raw-center controller tap540,2043.
Actual label changed to Hide detailed insights, with Summary2/226/9/57 and
Training balance subsequently visible. Root's independent post-terminal settled
PNG/equalXML/focus/APK proof confirms the same state. NATIVE_PREVIEW12.md records
hashes and independent review. No collapse proof or app-source fix is inferred.
Task terminalCANCELLED508.2s after finalizer malformed-history400, doctorready5/5.

Stored helper-derived hierarchies retained clock5:31/page-top while originals
advanced5:37–5:38 and scrolled. The external README documents UiAutomation's
possible suppression of the helper and supported uiautomator backend. Root
selected that backend through ONLY its nonsecret external.env setting, preserving
all other bytes, then used the supported no-browser idle-daemon restart. This
does not establish which client suppressed the helper or explain the ANRs.
Optional Showcase auto-build failed a Node-version requirement; daemon restarted
and doctorready5/5. No broad upgrade/tool-source patch/credential change occurred.
Current Pro79f6d0e9 uses UIAutomator2 per official status; screenshot/hierarchy
freshness must be checked before gameplay. The original ANR/performance boundary
remains open, independent of the now observed working disclosure.
