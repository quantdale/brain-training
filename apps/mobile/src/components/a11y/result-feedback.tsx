/**
 * Accessible game-result feedback pattern.
 *
 * When a session/round ends, sighted users get a headline + metrics block;
 * screen-reader users need the same event pushed to them (they cannot scan
 * for it). `ResultFeedback` is the non-visual half of that pattern: render it
 * next to the visible result UI and the headline (+ optional detail) is
 * announced — polite by default, assertive for session-grade outcomes.
 */
import { LiveRegion } from './announcements';

export interface ResultFeedbackProps {
  /** Result headline, e.g. "Session complete" or "Round passed". */
  headline: string;
  /** Optional one-line detail, e.g. "Score 750, new personal best". */
  detail?: string;
  /** Assertive interrupts current speech — reserve for session-end events. */
  assertive?: boolean;
  testID?: string;
}

/** Announces a game result to screen readers; renders no visible UI. */
export function ResultFeedback({ headline, detail, assertive = false, testID }: ResultFeedbackProps) {
  return (
    <LiveRegion
      message={formatResultSummary(headline, detail)}
      assertive={assertive}
      testID={testID}
    />
  );
}

/**
 * Canonical result announcement copy: `"Session complete"` or
 * `"Session complete. Score 750, accuracy 100%"`. Exported so tests and
 * callers can predict exactly what gets spoken.
 */
export function formatResultSummary(headline: string, detail?: string): string {
  const cleanHeadline = headline.trim();
  const cleanDetail = detail?.trim();
  if (!cleanDetail) {
    return cleanHeadline;
  }
  return `${cleanHeadline}. ${cleanDetail}`;
}
