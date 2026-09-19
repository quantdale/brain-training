/**
 * Suggested Next — the Games storefront's featured moment (Campaign 032;
 * Campaign 055 storefront pass).
 *
 * The personalization kernel still computes the useful signals (recommended,
 * near-best, and rusty). This component gives them one storefront hierarchy:
 * the top pick is a `GameStage` (game world first, then identity and one
 * action key), its factual reason sits underneath, and a compact poster row
 * carries the supporting alternatives. The source shelves are never rendered
 * as competing sections, and the primary pick is no longer a banner-style
 * card repeating the grid's metadata grammar.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { masteryTierLabel } from '@/components/discovery/game-card';
import { GamePosterTile } from '@/components/discovery/game-poster-tile';
import { GameStage } from '@/components/discovery/game-stage';
import { playerFacingReason } from '@/components/shell/format';
import { SectionHeader } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import type { GameDefinition } from '@/registry/registry';
import { Spacing } from '@/theme/tokens';
import type { DiscoverySnapshot } from './discovery-data';

const ALTERNATIVE_COUNT = 2;

/** Top pick excluded; the remaining evidence picks in kernel order. */
function uniqueGames(data: DiscoverySnapshot): GameDefinition[] {
  const seen = new Set<string>(data.recommended[0] ? [data.recommended[0].game.id] : []);
  const games: GameDefinition[] = [];
  const candidates = [
    ...data.recommended.slice(1).map((entry) => entry.game),
    ...data.nearBest,
    ...data.rusty,
  ];
  for (const game of candidates) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    games.push(game);
    if (games.length >= ALTERNATIVE_COUNT) break;
  }
  return games;
}

export function SuggestedNext({ data }: { data: DiscoverySnapshot }) {
  const top = data.recommended[0];
  const alternatives = uniqueGames(data);
  const reason = top?.components[0]?.reason;
  const reasonText = reason ? playerFacingReason(reason) : null;
  const summary = top ? data.masteryByGame.get(top.game.id) ?? null : null;
  const favorite = top ? data.favorites.has(top.game.id) : false;

  return (
    <View testID="games-suggested-next" style={styles.root}>
      <SectionHeader
        eyebrow="START HERE"
        title="Suggested next"
        caption="A focused pick based on your recent training"
      />
      {top ? (
        <View style={styles.primary} testID="games-suggested-primary">
          <GameStage
            game={top.game}
            testID="games-featured"
            artTestID="games-featured-world"
            titleTestID="games-suggested-title"
            identityTestID="games-suggested-identity"
            showInteraction
            meta={
              <View style={styles.meta}>
                {summary ? (
                  <ThemedText type="caption" themeColor="textMuted">
                    {masteryTierLabel(summary.tier)}
                  </ThemedText>
                ) : null}
                {favorite ? (
                  <ThemedText type="caption" themeColor="warning" allowFontScaling={false}>
                    ★
                  </ThemedText>
                ) : null}
              </View>
            }>
            <Button
              testID="games-suggested-open"
              label="Open game details"
              accessibilityHint="Opens this game's detail screen"
              onPress={() => router.push(`/game-detail/${top.game.id}`)}
            />
          </GameStage>
          {reasonText ? (
            <ThemedText type="caption" themeColor="textSecondary" testID="games-suggested-reason">
              Suggested because: {reasonText}
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText type="bodySmall" themeColor="textSecondary">
          Pick any game below to start a focused session.
        </ThemedText>
      )}
      {alternatives.length > 0 ? (
        <View style={styles.alternatives} testID="games-suggested-alternatives">
          <ThemedText type="caption" themeColor="textMuted">
            More good fits
          </ThemedText>
          <View style={styles.alternativeRow}>
            {alternatives.map((game) => (
              <GamePosterTile
                key={game.id}
                game={game}
                isFavorite={data.favorites.has(game.id)}
                mastery={data.masteryByGame.get(game.id) ?? null}
                testID={`games-suggested-alternative.${game.id}`}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  primary: {
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  alternatives: {
    gap: Spacing.oneHalf,
    marginTop: Spacing.one,
  },
  alternativeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
