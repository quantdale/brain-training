/** Mechanic-specific, offline cover. Titles and controls remain in native UI.
 * Static geometry decodes once; exact semantic glyphs stay native SVG text.
 * The viewBox keeps labels registered to the image at every caller size.
 */
import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { Fonts, type ColorTheme } from '@/theme/tokens';
import { GAME_COVERS, type GameCover } from './game-cover-artwork.generated';

export function getGameCover(gameId: string): GameCover | undefined {
  if (!Object.hasOwn(GAME_COVERS, gameId)) return undefined;
  return (GAME_COVERS as Readonly<Record<string, GameCover>>)[gameId];
}

export const GameCoverArtwork = memo(function GameCoverArtwork({ gameId, height, testID }: {
  gameId: string;
  height: number;
  testID?: string;
}) {
  const theme = useTheme();
  const cover = getGameCover(gameId);
  // Fixtures and future unregistered IDs do not impersonate an existing game.
  if (!cover) return null;
  const background = theme[`${cover.domain}Soft` as keyof ColorTheme] ?? theme.surfaceSunken;
  return (
    <View testID={testID} pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.slot, { height, backgroundColor: background }]}>
      <View testID={testID ? `${testID}-artwork-frame` : undefined}
        style={[styles.frame, { maxWidth: height * 1.6 }]}>
        <Image testID={testID ? `${testID}-artwork` : undefined} source={cover.source}
          accessible={false} resizeMode="contain" fadeDuration={0}
          style={StyleSheet.absoluteFill} />
        {cover.labels.length > 0 ? (
          <Svg width="100%" height="100%" viewBox="0 0 320 200" style={StyleSheet.absoluteFill}>
            {cover.labels.map((label, index) => (
              <SvgText key={index} x={label.x} y={label.y} textAnchor="middle"
                alignmentBaseline="central" fontFamily={Fonts.sans} fontWeight="700"
                fontSize={label.size} fill={label.color ?? '#17243B'}>
                {label.text}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: { width: '100%', aspectRatio: 1.6 },
});
