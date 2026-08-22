/**
 * OptionButton — a selectable option displaying a pattern grid.
 *
 * Used in the choice phase to present the player with transformed versions
 * of the source pattern. The selected state is highlighted via the theme's
 * accent color border.
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";
import { PatternGrid } from "./pattern-grid";

export interface OptionButtonProps {
    /** 0-based option index; used for the testID. */
    index: number;
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
    gridSize,
    pattern,
    selected,
    correct,
    disabled = false,
    onPressOption,
}: OptionButtonProps) {
    const theme = useTheme();

    // Cast to string because theme.success/danger have different literal types
    // than theme.border, but all are valid RN color strings.
    let borderColor: string = theme.border;
    if (correct) {
        borderColor = theme.success;
    } else if (selected && !correct) {
        borderColor = theme.danger;
    }

    return (
        <Pressable
            testID={testId(GAME_ID, "option", String(index))}
            accessibilityRole="button"
            accessibilityLabel={`Option ${index + 1}`}
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={onPressOption ? () => onPressOption(index) : undefined}
            style={({ pressed }) => [
                styles.container,
                {
                    borderColor,
                    opacity: pressed || disabled ? 0.8 : 1,
                },
            ]}
        >
            {/* The pattern grid is purely decorative: the outer button already
             * announces "Option N". A labeled a11y container nested inside an
             * accessibility button collapses the Android a11y tree on Fabric
             * (campaign 011 device finding: the session PauseOverlay subtree
             * vanished from uiautomator/TalkBack entirely), so hide the whole
             * inner grid from accessibility. */}
            <View importantForAccessibility="no-hide-descendants">
                <PatternGrid
                    gridSize={gridSize}
                    pattern={pattern}
                    testID={testId(GAME_ID, "option-grid", String(index))}
                />
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    container: {
        borderWidth: 2,
        borderRadius: Radii.medium,
        padding: Spacing.one,
    },
});
