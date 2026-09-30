/**
 * Screen-reader announcement helper.
 *
 * `announce()` is the imperative `AccessibilityInfo.announceForAccessibility`
 * call. It fires on iOS/web/Android, but on Android it can be dropped while the
 * screen is busy, so a message that MUST be heard is worth verifying on a real
 * device rather than assumed from a passing test.
 *
 * 071: the `LiveRegion` component that used to live here is removed. It had
 * zero importers, and keeping an unused "more reliable on Android" primitive in
 * the kit is worse than not having it: the module documentation described it as
 * the answer for transient status, so a future author could reasonably reach
 * for it and inherit an untested path. The pre-built source is recoverable from
 * git history at the removing commit, and the residual limitation is recorded
 * in `.agent/BACKLOG.md` rather than left as a silent gap in a component
 * nobody renders.
 */
import { AccessibilityInfo } from 'react-native';

/** Announce `message` to the screen reader (polite priority). */
export function announce(message: string): void {
  // Whitespace-only copy would queue an empty/silent utterance on some
  // engines; trim-guard drops it and normalizes padded input.
  const text = message.trim();
  if (!text) {
    return;
  }
  AccessibilityInfo.announceForAccessibility(text);
}
