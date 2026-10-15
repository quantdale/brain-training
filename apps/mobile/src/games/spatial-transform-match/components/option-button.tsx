/**
 * OptionButton — a selectable option displaying a pattern grid.
 *
 * Used in the choice phase to present the player with transformed versions
 * of the source pattern. The selected state is highlighted via the theme's
 * accent color border.
 */
import { AppIcon } from '@/components/ui/app-icon';
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { Radii, Spacing } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";
import { describePattern, PatternGrid } from "./pattern-grid";

export interface OptionButtonProps {
    /** 0-based option index; used for the testID. */
    index: number;
    /** Tutorials retain their existing control IDs while sharing real candidates. */
    testID?: string;
    /** The grid size for the pattern. */
    gridSize: number;
    /** The pattern to display. */
    pattern: readonly number[];
    /** Whether this option is currently selected. */
    selected: boolean;
    /** Whether this option is the correct answer (for reveal in roundResult). */
    correct: boolean;
    /** Whether the option is disabled (e.g. after selection). */
    disabled?: boolean;
    /**
     * Stable tap handler supplied by the parent (avoid per-render closures so
     * the memoized button skips re-renders). Receives this option's index.
     */
    onPressOption?: (index: number) => void;
}

export const OptionButton = memo(function OptionButton({
    index,
    testID,
    gridSize,
    pattern,
    selected,
    correct,
    disabled = false,
    onPressOption,
}: OptionButtonProps) {
    const theme = useTheme();
    const optionTestID = testID ?? testId(GAME_ID, "option", String(index));

    // Verdicts change fill AND icon, never colour alone: the correct option
    // gets a success-soft fill plus a ✓ badge, the wrong pick a danger-soft
    // fill plus a ✕ badge (Vocabulary rule — both visible together). Badges
    // are opaque verdict-family fills with their `*On` glyph, so the icon
    // reads on any board behind it.
    const isWrongPick = selected && !correct;
    const verdictIcon = correct ? 'check' : isWrongPick ? 'close' : null;
    const backgroundColor = correct
        ? theme.successSoft
        : isWrongPick
          ? theme.dangerSoft
          : undefined;
    const borderColor = correct
        ? theme.success
        : isWrongPick
          ? theme.danger
          : theme.border;
    const verdictLabel = correct
        ? `Option ${index + 1}, correct`
        : isWrongPick
          ? `Option ${index + 1}, wrong pick`
          : `Option ${index + 1}`;
    const accessibilityLabel = `${verdictLabel}. ${describePattern(gridSize, pattern)}`;

    return (
        <Pressable
            testID={optionTestID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={onPressOption ? () => onPressOption(index) : undefined}
            style={({ pressed }) => [
                styles.container,
                {
                    backgroundColor,
                    borderColor,
                    borderWidth: verdictIcon !== null ? 3 : 2,
                    opacity: pressed || disabled ? 0.8 : 1,
                },
            ]}
        >
            {/* The outer button describes the cells and any resolved verdict.
             * A labeled a11y container nested inside an
             * accessibility button collapses the Android a11y tree on Fabric
             * (campaign 011 device finding: the session PauseOverlay subtree
             * vanished from uiautomator/TalkBack entirely), so hide the whole
             * inner grid from accessibility. */}
            <View importantForAccessibility="no-hide-descendants">
                <PatternGrid
                    gridSize={gridSize}
                    pattern={pattern}
                    compact
                    testID={testId(GAME_ID, "option-grid", String(index))}
                />
            </View>
            {verdictIcon !== null ? (
                <View
                    testID={testId(GAME_ID, "option-verdict", String(index))}
                    style={[
                        styles.verdict,
                        { backgroundColor: correct ? theme.success : theme.danger },
                    ]}
                    importantForAccessibility="no-hide-descendants"
                >
                    <AppIcon name={verdictIcon} color={correct ? theme.successOn : theme.dangerOn} size={16} />
                </View>
            ) : null}
        </Pressable>
    );
});

const styles = StyleSheet.create({
    container: {
        // Percent-width cells need a finite parent. Otherwise a supposedly
        // miniature option grows into a full board and pushes later choices away.
        width: 96,
        borderRadius: Radii.medium,
        padding: Spacing.one,
        minWidth: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET,
    },
    verdict: {
        position: "absolute",
        top: Spacing.one,
        right: Spacing.one,
        width: Spacing.four,
        height: Spacing.four,
        borderRadius: Radii.pill,
        alignItems: "center",
        justifyContent: "center",
    },
});
