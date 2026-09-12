/**
 * Today's Spotlight card (Campaign 014 W3/W6; Campaign 024 kit rebuild;
 * Campaign 026 identity rebuild): the deterministic daily featured challenge.
 *
 * Self-contained data seam — one bounded session-count read for completion
 * state; selection itself is pure/offline. The card wears the warning/amber
 * identity (the "daily featured" beat) with a code-native spark mark, so it
 * reads as a distinct moment rather than another library row.
 */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SectionHeader } from "@/components/shell";
import { Badge, Button, Card, Spark } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/theme/tokens";
import { useDbData } from "@/hooks/use-db-data";
import { registry } from "@/registry/registry.generated";
import { dailySpotlight, localDayWindow } from "@/spotlight/spotlight";
import { localDateString } from "@/workout/today";

export function SpotlightCard() {
  const theme = useTheme();
  const date = localDateString();
  const spotlight = useMemo(
    () => dailySpotlight(registry.map((g) => g.id), date),
    [date],
  );
  const [reloadToken, setReloadToken] = useState(0);
  const { data: completedCount } = useDbData(
    async (db) => {
      if (!spotlight) {
        return 0;
      }
      const window = localDayWindow(date);
      return db.sessions.countSessions({
        gameIds: [spotlight.gameId],
        fromMs: window.fromMs,
        toMs: window.toMs,
      });
    },
    [date, spotlight?.gameId, reloadToken],
    0,
  );

  if (!spotlight) {
    return null;
  }
  const game = registry.find((g) => g.id === spotlight.gameId);
  const done = completedCount > 0;

  return (
    <View style={styles.section} testID="home-spotlight">
      <SectionHeader title="Today's Spotlight" />
      <Card tone="warningSoft">
        <View style={styles.body}>
          <View style={styles.metaRow}>
            <Spark size={20} color={theme.warning} />
            <ThemedText
              type="eyebrow"
              themeColor="warningSoftText"
              allowFontScaling={false}>
              DAILY CHALLENGE
            </ThemedText>
          </View>
          <ThemedText type="headline" testID="home-spotlight-game">
            {game?.name ?? spotlight.gameId}
          </ThemedText>
          <ThemedText
            type="bodySmall"
            themeColor="warningSoftText"
            testID="home-spotlight-difficulty">
            Featured difficulty: {spotlight.difficulty}
          </ThemedText>
          {done ? (
            <Badge
              label="Completed today ✓"
              tone="success"
              testID="home-spotlight-done"
            />
          ) : (
            <Button
              variant="secondary"
              label="Play the spotlight"
              testID="home-spotlight-play"
              accessibilityLabel={`Play today's spotlight: ${game?.name ?? spotlight.gameId}`}
              onPress={() => {
                setReloadToken((t) => t + 1);
                router.push(`/game-detail/${spotlight.gameId}`);
              }}
            />
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  body: {
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
});
