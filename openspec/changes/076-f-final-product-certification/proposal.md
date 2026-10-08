## Why

Change `076-product-wide-ui-ux-reboot` is implemented and visually locked, but its release acceptance is still `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`: 25 of 82 tasks are unchecked, current-device game certification is incomplete, and controller-led journeys are externally blocked. Closing that gap now prevents another redesign cycle and stops historical screenshots from being treated as terminal proof.

## What Changes

- Certify the existing Training Studio product. Do not start Change 077, reopen the reference lock, or redesign routes, game mechanics, scoring, persistence, economy, workout ownership, offline behavior, or the registry.
- Preserve accepted evidence when its rendering dependency is unchanged, and label it honestly. A source-equivalent historical frame is not a capture from the terminal APK. Do not automatically repeat the reviewed 90-route matrix.
- Require a current-device check of all 42 registered games, with new frames only where provenance fails or the acceptance rule explicitly requires same-APK evidence.
- Require ARTEMIS Flash and Pro journeys through the authorized controller. ADB remains observation and diagnostics only. Persistent HTTP 401 is an external blocker, not a product defect and not permission to substitute another controller.
- Separate the clean-checkout composite from its self-test, and separate script results from gates the script does not actually run.
- Permit only one terminal verdict: full validation, repository-complete with named external blockers, or still blocked. Do not check parent tasks in bulk or claim completion from a plan.

## Capabilities

### New Capabilities

- `terminal-product-certification`: Evidence provenance, current-device game and accessibility acceptance, controller-led journeys, clean-checkout certification, and the allowed terminal verdicts for ending Campaign 076.

### Modified Capabilities

- None. `openspec/specs/` has no active main specs. Change 076's change-local deltas remain the parent redesign contract and are not rewritten here.

## Impact

- Parent ledger: `openspec/changes/076-product-wide-ui-ux-reboot/tasks.md` (25 unchecked tasks). This change authorizes checking those tasks only after their individual evidence exists; it does not replace that ledger.
- Evidence and control plane: parent `evidence/`, `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, `.agent/CURRENT_CAMPAIGN.md`, and `.agent/EXECUTION_PROMPT.md`.
- Runtime: one dedicated Android emulator, external ARTEMIS at `D:\Tools\artemis`, and a terminal release APK. No new product dependency, native module, or network service.
- Code impact is conditional. Production edits are allowed only for a reproduced runtime defect, with a regression guard and impact-based recertification. The measured production delta from game-capture source `4a6fc53` to `7e7374b` is Home workout-progress numeral styling, Progress-detail badge wrapping, and a Task Switch HUD test assertion.
