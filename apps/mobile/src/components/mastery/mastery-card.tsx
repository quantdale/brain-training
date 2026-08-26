/**
 * Mastery UI primitives (Campaign 014 W6). Small, self-contained presenters
 * over {@link MasterySummary} — no data fetching here; screens pass summaries
 * from `useMasterySummaries`. First-viewport friendly: compact rows, tier
 * chip + one honest milestone line.
 */
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { MASTERY_TIERS, type MasterySummary } from "@/mastery";
import { router } from "expo-router";

const TIER_LABEL: Record<string, string> = {
  unplayed: "New",
  learning: "Learning",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

/** Compact per-game mastery row for Game Detail. */
export function MasteryCard({ summary }: { summary: MasterySummary }) {
  const theme = useTheme();
  return (
    <ThemedView
      testID={`mastery-card.${summary.gameId}`}
      style={[styles.card, { borderColor: theme.border }]}
    >
      <ThemedText type="subtitle">Mastery</ThemedText>
      <ThemedView
        style={[styles.tierChip, { backgroundColor: theme.surface }]}
        testID={`mastery-tier.${summary.gameId}`}
      >
        <ThemedText type="smallBold">
          {TIER_LABEL[summary.tier] ?? summary.tier}
        </ThemedText>
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        {summary.nextMilestone
          ? `Next: ${summary.nextMilestone}`
          : "Every milestone cleared — keep sharpening your bests."}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={`mastery-evidence.${summary.gameId}`}>
        {summary.evidence.sessions} session{summary.evidence.sessions === 1 ? "" : "s"}
        {" · "}
        {Math.round(summary.evidence.bestNormalized * 100)}% best
        {summary.evidence.expertStrong > 0
          ? ` · ${summary.evidence.expertStrong} strong Expert clear${summary.evidence.expertStrong === 1 ? "" : "s"}`
          : ""}
      </ThemedText>
    </ThemedView>
  );
}

interface MilestoneItem {
  gameId: string;
  name: string;
  summary: MasterySummary;
}

/**
 * "Closest milestones" strip: the games nearest their next mastery step,
 * ordered by remaining-work heuristic (tier rank desc, then fewest missing
 * strong clears). Tap-through to the game detail screen.
 */
export function MilestoneStrip({
  items,
  max = 4,
  testIDPrefix = "mastery-milestone",
}: {
  items: MilestoneItem[];
  max?: number;
  testIDPrefix?: string;
}) {
  const theme = useTheme();
  if (items.length === 0) {
    return null;
  }
  const sorted = [...items]
    .sort(
      (a, b) =>
        b.summary.rank - a.summary.rank ||
        a.summary.evidence.hardStrong +
          a.summary.evidence.expertStrong -
          (b.summary.evidence.hardStrong + b.summary.evidence.expertStrong),
    )
    .slice(0, max);
  return (
    <ThemedView style={styles.strip} testID={`${testIDPrefix}s`}>
      <ThemedText type="subtitle">Closest milestones</ThemedText>
      {sorted.map(({ gameId, name, summary }) => (
        <Pressable
          key={gameId}
          testID={`${testIDPrefix}.${gameId}`}
          accessibilityRole="button"
          accessibilityLabel={`${name}: ${summary.nextMilestone ?? "mastered"}`}
          onPress={() => router.push(`/game-detail/${gameId}`)}
          style={({ pressed }) => [
            styles.item,
            { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="smallBold" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {MASTERY_TIERS[summary.rank]} · {summary.nextMilestone ?? "mastered"}
          </ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tierChip: {
    alignSelf: "flex-start",
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one / 2,
  },
  strip: {
    gap: Spacing.two,
  },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
