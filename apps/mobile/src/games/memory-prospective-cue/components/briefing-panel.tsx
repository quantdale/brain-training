/**
 * BriefingPanel — the between-rounds intention briefing.
 *
 * NEW signals are shown as glyph chips (learn these); RETIRED ones are
 * announced (drop them); surviving intentions are counted but NEVER named —
 * the player must still be holding them, which is the prospective-memory
 * demand. During the stream this panel is gone entirely: no on-screen
 * reminder exists.
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { glyphById } from "../glyphs";
import { GAME_ID } from "../types";
import type { ProspectiveRound } from "../types";

export interface BriefingPanelProps {
  /** The round about to start (new/retired lists come from it). */
  round: ProspectiveRound;
  /** Previously-active signals that carry over unnamed (count only). */
  survivorIds: readonly number[];
}

/** One signal glyph chip (briefing + post-round reveal). */
export function GlyphChip({ glyphId }: { glyphId: number }) {
  const theme = useTheme();
  const glyph = glyphById(glyphId);
  return (
    <View
      style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={testId(GAME_ID, "briefing-chip", String(glyphId))}
      accessibilityLabel={glyph.label}
    >
      <ThemedText type="default" style={{ color: glyph.color, fontSize: 30 }} allowFontScaling={false}>
        {glyph.glyph}
      </ThemedText>
    </View>
  );
}

export function BriefingPanel({ round, survivorIds }: BriefingPanelProps) {
  return (
    <View style={styles.panel} testID={testId(GAME_ID, "briefing")}>
      <View accessibilityRole="header">
        <ThemedText
          type="bodyLarge"
          testID={testId(GAME_ID, "briefing-new-title")}
        >
          New signals — tap SIGNAL when you see them:
        </ThemedText>
      </View>
      <View style={styles.chipRow}>
        {round.newSignalIds.map((id) => (
          <GlyphChip key={id} glyphId={id} />
        ))}
      </View>

      {round.retiredSignalIds.length > 0 ? (
        <>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID={testId(GAME_ID, "briefing-retired")}
          >
            Retired — no longer signals:
          </ThemedText>
          <View style={styles.chipRow}>
            {round.retiredSignalIds.map((id) => (
              <View key={id} style={styles.retiredChip}>
                <GlyphChip glyphId={id} />
                <ThemedText type="caption" themeColor="danger">
                  ✕
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {survivorIds.length > 0 ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID={testId(GAME_ID, "briefing-carrying")}
        >
          {survivorIds.length} earlier signal{survivorIds.length > 1 ? "s" : ""}{" "}
          still active — no reminders, keep them in mind.
        </ThemedText>
      ) : null}

      <ThemedText type="caption" themeColor="textSecondary">
        Everything else is a GO symbol. The watchlist will not be shown again
        this round.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    alignItems: "flex-start",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minWidth: 64,
    alignItems: "center",
  },
  retiredChip: {
    alignItems: "center",
    gap: Spacing.oneHalf,
  },
});
