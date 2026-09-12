/**
 * `Confetti` — deterministic, code-native celebration burst.
 *
 * Campaign 026 identity rule: celebration is built from Views/transforms (no
 * new dependency, no image asset) and is reproducible — the piece layout is
 * derived from a seeded RNG, so screenshots and tests are stable.
 *
 * Placement rules (reference research): pieces are confined to the margins of
 * the host, never behind body text or the primary CTA; the burst is bounded
 * (`Motion.celebration`) and non-interactive. Under reduced motion the burst
 * renders its settled end state (nothing falling) instead of animating.
 */
import { useEffect, useMemo, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { DomainColors, Families, Motion, Radii } from '@/theme/tokens';

/**
 * Fixed identity palette for confetti pieces (never invented per call).
 * Derived from the token families — not raw literals — so the colour sweep
 * (Campaign 026 R6) holds: accent/volt/violet/success/info/memory hues that
 * pop on both themes. Bright light-scheme bases read as celebration on the
 * dark canvas too, which is exactly what a confetti burst needs.
 */
export const CONFETTI_COLORS = [
  Families.light.accent.base,
  Families.light.warning.base, // volt
  Families.light.xp.base, // violet
  DomainColors.light.spatial.base, // success green
  DomainColors.light.math.base, // info blue
  DomainColors.light.memory.base, // memory pink
] as const;

export interface ConfettiProps {
  /** Number of pieces (bounded: margins only, never a full-screen storm). */
  count?: number;
  /** Deterministic seed — same seed, identical layout. */
  seed?: string;
  /** Burst height in dp; pieces fall within it from the top of the host. */
  height?: number;
  /** Whether to animate; defaults to respecting reduced motion. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Tiny deterministic string hash → 32-bit seed (mulberry32). */
function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ConfettiPieceLayout {
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
  color: string;
  round: boolean;
}

export function Confetti({ count = 18, seed = 'spark', height = 240, enabled = true, style }: ConfettiProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = enabled && !reducedMotion;
  const width = Dimensions.get('window').width;

  const pieces = useMemo<ConfettiPieceLayout[]>(() => {
    const rng = seededRng(seed);
    return Array.from({ length: count }, (_, index) => {
      // Keep pieces in the left/right margins so centre copy stays legible.
      const side = index % 2 === 0 ? rng() * 0.22 : 0.78 + rng() * 0.22;
      return {
        x: side * width,
        size: 6 + Math.round(rng() * 6),
        delay: Math.round(rng() * Motion.celebration * 0.35),
        duration: Motion.celebration,
        drift: (rng() - 0.5) * 60,
        rotation: Math.round(rng() * 360),
        color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)] ?? CONFETTI_COLORS[0],
        round: rng() > 0.55,
      };
    });
  }, [count, seed, width]);

  if (!animate) {
    // Settled end state: no falling pieces. The celebration headline carries
    // the moment on its own under reduced motion.
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { height }, style]}
      importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, index) => (
        <Piece key={index} piece={piece} height={height} />
      ))}
    </View>
  );
}

function Piece({ piece, height }: { piece: ConfettiPieceLayout; height: number }) {
  // One Animated.Value per piece, created once via lazy useState (never
  // re-created per render, never read from a ref during render).
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [piece.delay, piece.duration, progress]);

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.x,
          width: piece.size,
          height: piece.round ? piece.size : Math.round(piece.size * 0.6),
          borderRadius: piece.round ? piece.size / 2 : Radii.extraSmall / 2,
          backgroundColor: piece.color,
          opacity: progress.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, height - 40] }) },
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
            { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.rotation}deg`] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
