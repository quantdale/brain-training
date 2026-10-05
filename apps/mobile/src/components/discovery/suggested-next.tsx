/**
 * Suggested Next — the Games storefront's recommendation (Campaign 032;
 * Campaign 055 storefront pass; change 076 quiet-row compaction).
 *
 * The personalization kernel still computes the useful signals (recommended,
 * near-best, and rusty). Change 076 replaces the `GameStage` hero with a
 * quiet bordered row — board-still thumb, identity kicker, one hairline fact
 * row for the reason and a single red action key — so search and filters own
 * the top of the screen and the recommendation never competes with the
 * library grid. The source shelves are never rendered as competing sections.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { masteryTierLabel, useDomainHue } from '@/components/discovery/game-card';
import { GamePosterTile } from '@/components/discovery/game-poster-tile';
import { GameWorldArt, getGameIdentity, IdentityMark } from '@/components/discovery/game-identity';
import { playerFacingReason } from '@/components/shell/format';
import { SectionHeader } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { HAIRLINE } from '@/components/ui/radius';
import { useTheme } from '@/hooks/use-theme';
import type { GameDefinition } from '@/registry/registry';
import { Radii, Spacing } from '@/theme/tokens';
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
  const theme = useTheme();
  const top = data.recommended[0];
  const alternatives = uniqueGames(data);
  const reason = top?.components[0]?.reason;
  const reasonText = reason ? playerFacingReason(reason) : null;
  const summary = top ? data.masteryByGame.get(top.game.id) ?? null : null;
  const favorite = top ? data.favorites.has(top.game.id) : false;
  // Hooks stay unconditional; an empty category simply resolves to no hue.
  const hue = useDomainHue(top?.game.primaryCategory ?? '');
  const identity = top ? getGameIdentity(top.game) : null;

  return (
    <View testID="games-suggested-next" style={styles.root}>
      <SectionHeader eyebrow="START HERE" title="Suggested next" />
      {top && identity ? (
        <View style={styles.primary} testID="games-suggested-primary">
          {/* Quiet featured row (change 076): one bordered card — board still,
              identity kicker, hairline reason row, one red action key. */}
          <View
            testID="games-featured"
            style={[
              styles.featured,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.row}>
              <View style={styles.thumb}>
                <GameWorldArt game={top.game} size="card" testID="games-featured-world" />
              </View>
              <View style={styles.info}>
                <View style={styles.kickerRow}>
                  <IdentityMark
                    family={identity.family}
                    size={18}
                    color={hue?.base ?? theme.textSecondary}
                    testID="games-suggested-identity"
                  />
                  <ThemedText
                    type="eyebrow"
                    themeColor="textSecondary"
                    numberOfLines={1}
                    style={styles.kicker}>
                    {`${identity.verb} · ${top.game.primaryCategory}`}
                  </ThemedText>
                  {summary ? (
                    <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
                      {masteryTierLabel(summary.tier)}
                    </ThemedText>
                  ) : null}
                  {favorite ? (
                    <ThemedText type="caption" themeColor="warning" allowFontScaling={false} aria-hidden>
                      ★
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="bodyLarge" testID="games-suggested-title" numberOfLines={2} style={styles.name}>
                  {top.game.name}
                </ThemedText>
              </View>
            </View>
            {reasonText ? (
              // Borrowed detail 2 (lock §8): numbered hairline fact row for
              // secondary evidence — quiet, never competing with the action.
              <View style={[styles.factRow, { borderTopColor: theme.border }]}>
                <ThemedText type="eyebrow" themeColor="textMuted" allowFontScaling={false}>
                  01
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" testID="games-suggested-reason" style={styles.kicker}>
                  Suggested because: {reasonText}
                </ThemedText>
              </View>
            ) : null}
            <Button
              testID="games-suggested-open"
              label="Open game details"
              accessibilityHint="Opens this game's detail screen"
              onPress={() => router.push(`/game-detail/${top.game.id}`)}
            />
          </View>
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
  featured: {
    borderRadius: Radii.medium,
    borderWidth: HAIRLINE,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  thumb: {
    width: 104,
  },
  info: {
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  kicker: {
    flex: 1,
  },
  name: {
    fontWeight: '800',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: HAIRLINE,
    paddingTop: Spacing.two,
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
