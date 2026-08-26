/**
 * Today's Spotlight card (Campaign 014 W3/W6): the deterministic daily
 * featured challenge. Self-contained data seam — one bounded session-count
 * read for completion state; selection itself is pure/offline.
 */
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SectionHeader } from "@/components/shell";
import { Radii, Spacing } from "@/constants/theme";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
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
    <ThemedView testID="home-spotlight">
      <SectionHeader title="Today's Spotlight" />
      <ThemedView type="surface" style={styles.card}>
        <ThemedText type="smallBold" testID="home-spotlight-game">
          {game?.name ?? spotlight.gameId}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID="home-spotlight-difficulty"
        >
          Featured difficulty: {spotlight.difficulty}
        </ThemedText>
        {done ? (
          <ThemedText
            type="smallBold"
            themeColor="accent"
            testID="home-spotlight-done"
          >
            Completed today ✓
          </ThemedText>
        ) : (
          <Link href={`/game-detail/${spotlight.gameId}`} asChild>
            <Pressable
              testID="home-spotlight-play"
              accessibilityRole="button"
              accessibilityLabel={`Play today's spotlight: ${game?.name ?? spotlight.gameId}`}
              onPress={() => setReloadToken((t) => t + 1)}
            >
              <ThemedView
                type="surface"
                style={StyleSheet.flatten([
                  styles.playPill,
                  { borderColor: theme.accent },
                ])}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  Play the spotlight
                </ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.oneHalf,
    padding: Spacing.three,
    borderRadius: Radii.medium,
  },
  playPill: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
});
