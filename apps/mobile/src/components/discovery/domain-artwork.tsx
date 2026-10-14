/** Original offline media. Essential names, values and controls stay native. */
import { Image, View, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import type { DomainName } from '@/theme/tokens';

export type ArtworkName = DomainName | 'workout';

// Literal requires are necessary for Metro to include every accepted asset.
// Unreviewed drafts deliberately have no mapping into the app.
const ARTWORK: Partial<Record<ArtworkName, ImageSourcePropType>> = {
  workout: require('../../../assets/artwork/workout-assembly.png'),
  memory: require('../../../assets/artwork/memory.png'),
  attention: require('../../../assets/artwork/attention.png'),
  logic: require('../../../assets/artwork/logic.png'),
  math: require('../../../assets/artwork/math.png'),
  language: require('../../../assets/artwork/language.png'),
  speed: require('../../../assets/artwork/speed.png'),
  flexibility: require('../../../assets/artwork/flexibility.png'),
  spatial: require('../../../assets/artwork/spatial.png'),
};

export function hasDomainArtwork(name: ArtworkName): boolean {
  return ARTWORK[name] !== undefined;
}

export function DomainArtwork({ name, size = 112, style, testID }: {
  name: ArtworkName;
  size?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}) {
  const source = ARTWORK[name];
  if (!source) return null;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" testID={testID ? `${testID}-frame` : undefined}>
    <Image
      source={source}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
    </View>
  );
}
