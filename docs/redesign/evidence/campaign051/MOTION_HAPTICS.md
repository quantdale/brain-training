# Campaign 051 — Motion, Haptics & Sensory Contract

## Motion language

- **Key press:** existing `Tappable` press scale and Button lip make a primary
  action feel physical; input is never delayed by animation.
- **World entrance:** shared `Entrance`/`useEntranceTransition` stays short and
  bounded. The static world art is immediately mounted and hit-testable.
- **Progress:** existing animated bars/rings remain the only moving analytics;
  no looping dashboard decoration was introduced.
- **Completion:** existing reward confetti and entrance remain finite and
  persistence-gated. The new result world is static so the emotional peak is
  readable even when motion is reduced.

## Reduced motion

`usePrefersReducedMotion` remains the gate for press/entrance/reward motion.
Reduced motion keeps the state change, reward facts, and next action visible;
it removes travel/scale animation and collapses decorative celebration.

## Audio/haptics

No new direct audio or haptic calls were added. All presses and reward moments
continue through `liveAudioHaptics`, which is gated by the user's sensory
settings. The shared GameHost pause/result contracts are unchanged.

## Accessibility

- World art is `accessible={false}` and hidden from descendant traversal.
- Game name, category, verb, interaction sentence, and action label remain
  semantic text.
- Existing 44 dp touch-target enforcement remains in `Tappable`/`Button`.
- Large text is allowed to wrap in block controls; fixed native tab chrome
  retains its Campaign 049 scale cap.
