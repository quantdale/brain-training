/**
 * Shape conventions for the UI kit.
 *
 * Radii and border weights live here (not inline) so the whole interface keeps
 * one geometry: cards and sheets are `Radii.large`/`extraLarge`, controls are
 * pills, and every border is a hairline except deliberate emphasis.
 */

import { Platform, StyleSheet } from 'react-native';

import { Radii } from '@/theme/tokens';

/**
 * Radius applied to buttons and pills. `Radii.pill` is intentionally used
 * instead of a fixed value so a tall button and a chip share the same curve.
 */
export const RADIUS_CAP = Radii.pill;

/**
 * Hairline border width. Android renders fractional borders inconsistently, so
 * it gets a full dp while iOS/web get the hairline.
 */
export const HAIRLINE = Platform.select({ android: 1, default: StyleSheet.hairlineWidth });

/** Icon-button diameter in the shell chrome. */
export const ICON_BUTTON_SIZE = 44;
