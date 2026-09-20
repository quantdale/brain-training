/**
 * Screen-reader focus helpers.
 *
 * Moving the assistive cursor (VoiceOver/TalkBack) onto a node uses
 * `AccessibilityInfo.sendAccessibilityEvent(handle, 'focus')`: RN 0.86's
 * modern API that takes the host instance straight from a ref and routes
 * through the React renderer, so it reaches both Fabric and legacy-Paper
 * views. The older `setAccessibilityFocus(reactTag)` requires a numeric tag
 * we never have on hand — feeding it the ref's object instance silently
 * fails on Fabric/Android (campaign 009's "TalkBack never lands on Resume"
 * pause-overlay reachability defect), so it must not be used here. Android
 * also drops requests that arrive before the node attaches or lays out, so
 * callers that focus a just-mounted view need a few spaced retries;
 * repeat-focusing the same node is harmless, which makes the retry loop safe
 * without success detection.
 */
import { useEffect, useRef, type Component, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';

/** Delay between focus attempts (ms) — covers Android's attach/layout race. */
const FOCUS_RETRY_DELAY_MS = 250;

/** Generation counter backing cross-request invalidation (061). */
let latestGeneration = 0;

/** Default attempt count: immediate + two delayed retries. */
const FOCUS_ATTEMPTS = 3;

/**
 * Ask the platform screen reader to focus `target`. Best-effort by design:
 * failures are swallowed (focus must never crash a screen) and pending
 * retries self-cancel once the ref clears on unmount.
 *
 * Returns a cancel function clearing the pending retry timer (061): owner
 * effects call it on cleanup so overlay transitions stop holding ref
 * closures. A newer request for any target additionally cancels the
 * previous one's pending timer via a generation guard.
 */
export function requestAccessibilityFocus(
  target: RefObject<Component | null>,
  attempts: number = FOCUS_ATTEMPTS,
): () => void {
  const generation = (latestGeneration += 1);
  let remaining = attempts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const attempt = (): void => {
    timer = null;
    if (cancelled || generation !== latestGeneration) {
      return;
    }
    if (!target.current || remaining <= 0) {
      return;
    }
    remaining -= 1;
    try {
      // RN 0.86's documented call shape passes the host instance from a ref.
      // The loose `Component` constraint on the ref cannot prove the
      // HostInstance shape statically; at every real call site the ref is
      // attached to a mounted host view (RN View/Pressable), so the instance
      // is one by construction.
      AccessibilityInfo.sendAccessibilityEvent(
        target.current as unknown as HostInstance,
        'focus',
      );
    } catch {
      // Focus is best-effort; never surface this to users.
    }
    if (remaining > 0) {
      timer = setTimeout(attempt, FOCUS_RETRY_DELAY_MS);
    }
  };
  attempt();
  return () => {
    cancelled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/**
 * Ref hook pairing with `requestAccessibilityFocus`: attach the returned ref
 * to the element that should receive the screen-reader cursor whenever
 * `active` turns true (e.g. a dialog/overlay mounting).
 */
export function useInitialA11yFocus<T extends Component>(active: boolean): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    // 061: cancel pending retries on cleanup (deactivation/unmount) so
    // overlay transitions stop holding this ref closure.
    return requestAccessibilityFocus(ref as RefObject<T | null>);
  }, [active]);

  return ref;
}
