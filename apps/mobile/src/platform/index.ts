/**
 * Platform adapters — cross-platform seams isolated behind one module
 * (campaign009 xplat audit follow-up). Feature code imports from `@/platform`
 * instead of branching on `Platform.OS` / probing dimensions ad hoc.
 */

// Capability queries
export {
  platformKind,
  isNativePlatform,
  isWebPlatform,
  supportsHaptics,
  supportsWebVibration,
} from './capabilities';
export type { PlatformKind } from './capabilities';

// Layout dimension helpers
export {
  useWindowWidth,
  useIsCompactWidth,
  useIsWideWidth,
  useClampedContentWidth,
} from './layout';

// Keyboard avoidance
export { getKeyboardAvoidingConfig, KeyboardAvoidingArea } from './keyboard';
export type { KeyboardAvoidingConfig, KeyboardAvoidingAreaProps } from './keyboard';

// Touch ergonomics
export { MIN_TOUCH_TARGET_SIZE, hitSlopToTouchTarget } from './touch';
