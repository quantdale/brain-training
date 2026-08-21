/**
 * Screen-reader focus helpers.
 *
 * `AccessibilityInfo.setAccessibilityFocus` is the only cross-platform way to
 * move the assistive cursor (VoiceOver/TalkBack) onto a node. Android drops
 * requests that arrive before the node attaches or lays out, so callers that
 * focus a just-mounted view need a few spaced retries; repeat-focusing the
 * same node is harmless, which makes the retry loop safe without success
 * detection.
 */
import { useEffect, useRef, type Component, type RefObject } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Delay between focus attempts (ms) — covers Android's attach/layout race. */
const FOCUS_RETRY_DELAY_MS = 250;

/** Default attempt count: immediate + two delayed retries. */
const FOCUS_ATTEMPTS = 3;

/**
 * Ask the platform screen reader to focus `target`. Best-effort by design:
 * failures are swallowed (focus must never crash a screen) and pending
 * retries self-cancel once the ref clears on unmount.
 */
export function requestAccessibilityFocus(
  target: RefObject<Component | null>,
  attempts: number = FOCUS_ATTEMPTS,
): void {
  let remaining = attempts;
  const attempt = (): void => {
    if (!target.current || remaining <= 0) {
      return;
    }
    remaining -= 1;
    try {
      // RN's documented call shape passes the host instance from a ref.
      AccessibilityInfo.setAccessibilityFocus(target.current as unknown as number);
    } catch {
      // Focus is best-effort; never surface this to users.
    }
    if (remaining > 0) {
      setTimeout(attempt, FOCUS_RETRY_DELAY_MS);
    }
  };
  attempt();
}

/**
 * Ref hook pairing with `requestAccessibilityFocus`: attach the returned ref
 * to the element that should receive the screen-reader cursor whenever
 * `active` turns true (e.g. a dialog/overlay mounting).
 */
export function useInitialA11yFocus<T extends Component>(active: boolean): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (active) {
      requestAccessibilityFocus(ref as RefObject<T | null>);
    }
  }, [active]);

  return ref;
}
