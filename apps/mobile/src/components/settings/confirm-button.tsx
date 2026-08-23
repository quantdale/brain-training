/**
 * Two-tap destructive-confirmation pill button (W12 settings/data maturity).
 *
 * First tap ARMS the control: the label swaps to `confirmLabel` and the pill
 * takes its danger styling, with a polite live region so screen readers hear
 * the state change. The arm expires after CONFIRM_ARM_MS so a stray tap can
 * never fire the destructive action minutes later; it also disarms when the
 * button becomes disabled or unmounts. A second tap while armed invokes
 * `onConfirm`.
 *
 * This mirrors the purchase-confirm pattern already shipped on the rewards
 * screen so every destructive action behaves consistently app-wide.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";

/** How long an armed confirmation stays valid (matches rewards purchases). */
export const CONFIRM_ARM_MS = 4000;

type Variant = "accent" | "neutral" | "danger";

interface ConfirmButtonProps {
  /** Resting label, e.g. "Replace Import". */
  label: string;
  /** Armed (second-tap) label, e.g. "Tap again to replace". */
  confirmLabel: string;
  /** Invoked only on the confirming second tap. */
  onConfirm: () => void;
  disabled?: boolean;
  /** Resting styling; the armed state is always rendered as danger. */
  variant?: Variant;
  /** Stable across arm/disarm so automation taps the same node twice. */
  testID: string;
  accessibilityLabel: string;
  /** Layout-only styles for the caller (alignSelf, margins); visuals live here. */
  style?: StyleProp<ViewStyle>;
  /** Small pill sizing for dense rows (saved-backup list). */
  size?: "regular" | "small";
}

const VARIANT_VIEW: Record<Variant, "accentSoft" | "surface" | "danger"> = {
  accent: "accentSoft",
  neutral: "surface",
  danger: "danger",
};

const VARIANT_TEXT_COLOR: Record<Variant, "accent" | "text" | "danger"> = {
  accent: "accent",
  neutral: "text",
  danger: "danger",
};

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled = false,
  variant = "neutral",
  testID,
  accessibilityLabel,
  style,
  size = "regular",
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Disarm when the action becomes unavailable. Adjusting state during render
  // (React's documented prop-change pattern) keeps an expired context from
  // ever leaving a live confirm behind without setState-in-effect churn.
  const [prevDisabled, setPrevDisabled] = useState(disabled);
  if (disabled !== prevDisabled) {
    setPrevDisabled(disabled);
    if (disabled && armed) {
      setArmed(false);
    }
  }

  const disarm = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  useEffect(() => disarm, [disarm]);

  const onPress = useCallback(() => {
    if (disabled) {
      return;
    }
    if (!armed) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setArmed(true);
      timerRef.current = setTimeout(disarm, CONFIRM_ARM_MS);
      return;
    }
    disarm();
    onConfirm();
  }, [armed, disabled, disarm, onConfirm]);

  const textColor = armed ? "danger" : VARIANT_TEXT_COLOR[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        armed ? `${confirmLabel}. ${accessibilityLabel}` : accessibilityLabel
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      <ThemedView
        type={armed ? "danger" : VARIANT_VIEW[variant]}
        style={[size === "small" ? styles.smallPill : styles.pill, styles.border]}
        accessibilityLiveRegion="polite"
      >
        <ThemedText type="smallBold" themeColor={textColor}>
          {armed ? confirmLabel : label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  smallPill: {
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  border: {
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
});
