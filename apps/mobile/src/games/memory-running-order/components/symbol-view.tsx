/**
 * SymbolView — renders one Running Order symbol (glyph + color).
 *
 * Every symbol is distinguishable by color AND shape (glyph) so it never
 * relies on a single channel. The accessibility label is the symbol's own
 * identity (e.g. "red circle") — during the reveal/study phase that is the
 * intended content; during input it is merely the alphabet shown to every
 * player, and the answer row shows only the player's OWN selections, so the
 * correct sequence is never leaked through the accessibility tree.
 *
 * When `onPress` is provided the view becomes a pressable control (used for the
 * input palette and the tutorial demo); otherwise it is a static display.
 *
 * Verdicts (campaign 025, PATTERNS-PLAY 6): the optional `verdict` prop maps a
 * reducer-resolved outcome onto the shared feedback language — soft
 * success/danger fill, a thicker verdict-family border and a ✓/✕ badge
 * (decorative for assistive tech) — and the accessible name carries the
 * verdict in words ("Correct: …" / "Wrong pick: …"). A neutral symbol (no
 * verdict) renders exactly as before.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

import { symbolById, type RunningOrderSymbol } from '../symbols';

/** Post-resolution verdict applied to a symbol display. */
export type SymbolVerdict = 'correct' | 'wrong';

export interface SymbolViewProps {
  symbolId: number;
  /** Font size of the glyph. */
  size?: number;
  testID?: string;
  /** Optional highlight ring (used in the tutorial demo / answer display). */
  highlighted?: boolean;
  /** When provided, the view becomes a pressable control. */
  onPress?: () => void;
  /** Disables presses (e.g. when the answer is full). */
  disabled?: boolean;
  /** Stable accessibility label override (defaults to the symbol identity). */
  accessibilityLabel?: string;
  /**
   * Reducer-resolved verdict. Only ever set for objects rendered after the
   * round has resolved, so the verdict wording (and the answer it names) can
   * never leak while the input phase is still live.
   */
  verdict?: SymbolVerdict | null;
}

export const SymbolView = memo(function SymbolView({
  symbolId,
  size = 56,
  testID,
  highlighted = false,
  onPress,
  disabled = false,
  accessibilityLabel,
  verdict = null,
}: SymbolViewProps) {
  const theme = useTheme();
  const sym: RunningOrderSymbol = symbolById(symbolId);
  const verdictWord =
    verdict === 'correct' ? 'Correct' : verdict === 'wrong' ? 'Wrong pick' : null;
  const label =
    accessibilityLabel ?? (verdictWord !== null ? `${verdictWord}: ${sym.label}` : sym.label);
  const verdictFill =
    verdict === 'correct' ? theme.successSoft : verdict === 'wrong' ? theme.dangerSoft : null;
  const verdictBorder =
    verdict === 'correct' ? theme.success : verdict === 'wrong' ? theme.danger : null;
  const badgeFill = verdict === 'correct' ? theme.success : verdict === 'wrong' ? theme.danger : null;
  const badgeOn = verdict === 'correct' ? theme.successOn : verdict === 'wrong' ? theme.dangerOn : null;
  const badgeGlyph = verdict === 'correct' ? '✓' : verdict === 'wrong' ? '✕' : null;

  const inner = (
    <View
      testID={onPress ? undefined : testID}
      accessibilityLabel={label}
      style={[
        styles.wrap,
        highlighted && styles.highlighted,
        verdictFill !== null &&
          verdictBorder !== null && {
            backgroundColor: verdictFill,
            borderColor: verdictBorder,
            borderWidth: 3,
          },
      ]}>
      <Text style={[styles.glyph, { color: sym.color, fontSize: size }]}>{sym.glyph}</Text>
      {badgeGlyph !== null && badgeFill !== null && badgeOn !== null ? (
        <View
          testID={testID !== undefined ? `${testID}.verdict` : undefined}
          style={[styles.verdict, { backgroundColor: badgeFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
            {badgeGlyph}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 6,
  },
  highlighted: {
    borderWidth: 3,
    borderColor: '#FBBF24',
  },
  glyph: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  pressable: {
    borderRadius: 16,
    // Explicit touch-target floor (PATTERNS-PLAY 6 / campaign 025 R6): the
    // palette and tutorial demo symbols are the game's tappable board cells
    // and must present at least 44×44 dp. The grid layout sizes glyphs well
    // above this, so the floor only guards degenerate widths.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
  },
  pressed: {
    opacity: 0.6,
  },
  // Verdict badge: content-sized disc pinned to the symbol corner. The fill +
  // glyph pair is the non-colour-alone verdict channel; the label already
  // speaks the verdict, so the badge is hidden from the accessibility tree.
  verdict: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
    width: Spacing.threeHalf,
    height: Spacing.threeHalf,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
