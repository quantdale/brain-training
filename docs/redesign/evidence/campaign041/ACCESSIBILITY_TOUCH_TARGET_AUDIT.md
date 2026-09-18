# Accessibility and Touch-Target Audit

## Automated hierarchy results

`[VERIFIED_TEST]` The current debug matrix ran `scripts/qa/a11y-audit.mjs --density 420`. Dark captures passed with 0 violations. Compact and font-scale-2 captures passed with 0 violations. The initial light captures reported 22 violations—one per light surface—with the same clickable unlabeled `android.view.ViewGroup` at `[970,2183][1022,2235]` (approximately 20dp square at density 420).

## Root-cause classification of the light violations

`[OBSERVED_RUNTIME]` XML inspection showed the reported view was the React Native LogBox warning snackbar close control (`!`, `Open debugger to view warnings.`), not the app’s bottom tab bar or a hidden gameplay control. The light matrix was rerun after a reset; the final replay had no LogBox and no workout error. This is a debug-environment overlay contaminating the audit signal, not evidence that the production navigation control is unlabeled. It still means the light debug capture is not a clean zero-violation run, so the result is not promoted to unconditional certification.

`[BLOCKED]` The release hierarchy could not be dumped because the ARTEMIS/UIAutomation service was already registered. `ui-capture` consequently recorded XML fields as null/0 and `a11y-audit` reported no hierarchy dumps. ARTEMIS’s direct release state inspection supplied semantic labels but not a complete independent audit. This is explicitly a tooling limitation.

## Touch target, clipping, and reachability observations

- `[OBSERVED_RUNTIME]` The LogBox close control measured about 20dp and is below the 44dp target; it is an overlay/tooling control, not an app control.
- `[VERIFIED_TEST]` The final dark, compact, and font-scale-2 app captures had 0 automated violations.
- `[OBSERVED_RUNTIME]` Compact Home showed a Color Stroop row with approximately 27dp visible content; font scale 2 showed an Order Path row with approximately 19dp visible content. These are current large-text/compact-viewport clipping risks and remain open.
- `[OBSERVED_RUNTIME]` Real family interactions reached visible controls and response states; no important control was proven semantically present but permanently occluded in those paths.
- `[MANUAL/EXTERNAL_PENDING]` No human TalkBack traversal, VoiceOver traversal, physical-device touch testing, contrast sign-off, or user evaluation was claimed.

## Coverage conclusion

The current Android automation signal is useful but not a clean release accessibility certificate. The app-level dark/compact/font-scale surfaces are clean under the repository analyzer, while the light debug run is contaminated by a known transient overlay, the required state matrix is incomplete, and release XML is blocked. A later recheck also pushed the dedicated debug runtime into redbox/Metro and UiAutomation contention; those tool failures were not promoted to app PASS or app FAIL. The safest next action is to rerun the required state hierarchy after clearing the UiAutomation-service collision and separately decide whether the compact/font-scale row clipping warrants a bounded layout fix.
