/**
 * Mastery UI primitives (Campaign 014 W6). Small, self-contained presenters
 * over {@link MasterySummary} — no data fetching here; screens pass summaries
 * from `useMasterySummaries`. First-viewport friendly: compact rows, tier
 * chip + one honest milestone line.
 */
import { StyleSheet, View } from "react-native";

import { SectionHeader } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { Badge, Card, ListRow } from "@/components/ui";
import {
  DomainColors,
  Radii,
  Spacing,
  type DomainName,
  type ThemeColor,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { registry } from "@/registry/registry.generated";
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

/** Tier → semantic badge family (progression ramp: low = info, mastered = success). */
const TIER_TONE: Record<string, ThemeColor> = {
  unplayed: "info",
  learning: "info",
  developing: "accent",
  proficient: "warning",
  advanced: "xp",
  mastered: "success",
};

/**
 * Domain identity key for a display category name (folds display casing and
 * the long logic label — same lookup the Progress screens use).
 */
function domainKeyFor(domain: string): DomainName | null {
  const normalized = domain.trim().toLowerCase();
  if (normalized.startsWith("logic")) return "logic";
  return normalized in DomainColors.light ? (normalized as DomainName) : null;
}

/** Domain identity dot for a game row; renders nothing for unknown categories. */
function DomainDot({ domain }: { domain: string }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const key = domainKeyFor(domain);
  if (!key) return null;
  return <View style={[styles.dot, { backgroundColor: DomainColors[scheme][key].base }]} />;
}

/** Compact per-game mastery row for Game Detail. */
export function MasteryCard({ summary }: { summary: MasterySummary }) {
  return (
    <Card variant="outlined" testID={`mastery-card.${summary.gameId}`}>
      <ThemedText type="subtitle">Mastery</ThemedText>
      <Badge
        label={TIER_LABEL[summary.tier] ?? summary.tier}
        tone={TIER_TONE[summary.tier] ?? "accent"}
        testID={`mastery-tier.${summary.gameId}`}
      />
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
    </Card>
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
    <View style={styles.strip} testID={`${testIDPrefix}s`}>
      <SectionHeader
        title="Closest milestones"
        actionLabel="See all"
        actionTestID={`${testIDPrefix}s-all`}
        actionAccessibilityLabel="Browse all games"
        onActionPress={() => router.push("/games")}
      />
      {sorted.map(({ gameId, name, summary }) => {
        const category = registry.find((g) => g.id === gameId)?.primaryCategory;
        return (
          <ListRow
            key={gameId}
            title={name}
            icon={category ? <DomainDot domain={category} /> : undefined}
            subtitle={`${MASTERY_TIERS[summary.rank]} · ${summary.nextMilestone ?? "mastered"}`}
            testID={`${testIDPrefix}.${gameId}`}
            accessibilityLabel={`${name}: ${summary.nextMilestone ?? "mastered"}`}
            accessibilityHint="Opens this game's detail screen"
            onPress={() => router.push(`/game-detail/${gameId}`)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
  strip: {
    gap: Spacing.two,
  },
});
