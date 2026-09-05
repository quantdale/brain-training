/**
 * Pause obscuring contract (GAME_SDK.md pause rule; constitution §11:
 * "Pause freezes timing and obscures the challenge using an opaque
 * blur/overlay so pausing cannot be used to study the answer").
 *
 * This is a behavior spec, not a UI component: every game's pause overlay
 * MUST satisfy `PauseOverlaySpec`. Games build their overlay UI and use
 * `createPauseOverlaySpec(gameId)` for the contract values + stable testID.
 */
import { testId } from './testid';

export interface PauseOverlaySpec {
  /** Fully opaque surface — no challenge pixels may peek through. */
  readonly opaque: true;
  /** Challenge content (text, state, answer hints) hidden, including from the accessibility tree. */
  readonly hidesChallenge: true;
  /** Contract marker: strong blur where a blur surface is used (e.g. blurRadius ≥ 20).
   *  Decorative only — the enforced anti-peek property is `opaque`: the shared
   *  PauseOverlay ships a fully opaque full-screen cover, so nothing peeks through
   *  with or without a blur layer. */
  readonly strongBlur: true;
  /** Screen-reader label for the paused state. */
  readonly accessibilityLabel: string;
  /** Stable semantic testID (see `testId` helper). */
  readonly testID: string;
}

/** Reference spec values for a game's pause overlay. */
export function createPauseOverlaySpec(gameId: string): PauseOverlaySpec {
  return {
    opaque: true,
    hidesChallenge: true,
    strongBlur: true,
    accessibilityLabel: 'Paused. Challenge hidden.',
    testID: testId(gameId, 'pause-overlay'),
  };
}
