/**
 * UI kit — the app's shared interactive vocabulary.
 *
 * Screens compose these primitives instead of writing their own pills, cards,
 * rows and meters. The kit owns: press feedback, haptics, reduced-motion
 * behaviour, the 44 dp interaction floor, token discipline and accessibility
 * defaults — so a screen cannot accidentally opt out of the contract.
 *
 * Import everything from `@/components/ui`.
 */

export { Tappable, pressStyles, type TappableProps } from './tappable';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './button';
export { Card, type CardPadding, type CardProps, type CardVariant } from './card';
export { SectionGrid, type SectionGridProps } from './section-grid';
export { HAIRLINE, ICON_BUTTON_SIZE, RADIUS_CAP } from './radius';
export {
  PRESS_SCALE,
  useAnimatedProgress,
  useEntranceTransition,
  usePressFeedback,
  type EntranceOptions,
  type PressFeedback,
  type PressFeedbackOptions,
} from './motion';
