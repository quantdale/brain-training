/**
 * Two-tap destructive-confirmation button (W12 settings/data maturity).
 *
 * First tap ARMS the control: the label swaps to `confirmLabel` and the
 * button takes its danger styling, with a polite live region so screen readers
 * hear the state change. The arm expires after CONFIRM_ARM_MS so a stray tap can
 * never fire the destructive action minutes later; it also disarms when the
 * button becomes disabled or unmounts. A second tap while armed invokes
 * `onConfirm`.
 *
 * This mirrors the purchase-confirm pattern already shipped on the rewards
 * screen so every destructive action behaves consistently app-wide.
 *
 * Rendered on the kit {@link Button} so press physics, haptics, the 44 dp
 * floor and token discipline are inherited rather than re-implemented.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { Button, type ButtonVariant } from "@/components/ui";

/** How long an armed confirmation stays valid (matches rewards purchases). */
const CONFIRM_ARM_MS = 4000;

/** Handle for the arm-expiry timer owned by this module. */
type ArmTimer = ReturnType<typeof setTimeout>;

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

/** Resting kit variant per legacy variant; armed is always danger. */
const VARIANT_BUTTON: Record<Variant, ButtonVariant> = {
  accent: "secondary",
  neutral: "ghost",
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
  const timerRef = useRef<ArmTimer | null>(null);

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

  return (
    <Button
      label={armed ? confirmLabel : label}
      onPress={onPress}
      variant={armed ? "danger" : VARIANT_BUTTON[variant]}
      size={size === "small" ? "sm" : "md"}
      fullWidth={false}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={
        armed ? `${confirmLabel}. ${accessibilityLabel}` : accessibilityLabel
      }
      accessibilityHint={
        armed
          ? "Confirmation armed. Tap again to confirm."
          : "Requires a confirming second tap."
      }
      accessibilityState={{ disabled }}
      style={style}
    />
  );
}
