/**
 * GameBoardStill — genuine, game-specific miniature boards (change 076 lock
 * section 4, review fix: "the still must look like the game's actual board").
 *
 * One renderer per real board grammar; the game id picks the still so e.g.
 * Odd One Out shows its target-plus-options layout, Memory shows its lit 3×3
 * sequence grid, Equation Builder shows its token slots. Arrangement shifts
 * deterministically per game via `variantFor(game.id)` so two games sharing a
 * grammar still do not render identically.
 *
 * Pure Views + percent positioning (no Skia, no assets), colored by the
 * domain palette the caller passes — the same discipline as the world art it
 * replaces for covered ids.
 */

import { View, StyleSheet } from 'react-native';

export interface BoardStillColors {
  base: string;
  soft: string;
  on: string;
  ink: string;
  secondary: string;
  surface: string;
}

export interface GameBoardStillProps {
  gameId: string;
  colors: BoardStillColors;
  /** Deterministic arrangement shift (0..2) from the game id. */
  variant: number;
  /** Layout scale (height / 112). */
  scale: number;
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
});

/** Aspect-ratio box: width is a percent of the still frame, height derives
 *  from `ar` (h/w). Percent HEIGHTS collapse inside auto-height rows, so the
 *  stills size everything off the width instead (review fix). */
interface BoxProps {
  /** Width as percent of the still frame. */
  w: number;
  /** RN aspectRatio convention: width / height. */
  ar: number;
  color: string;
  radius?: number;
  border?: string;
  opacity?: number;
  /** Opt-in absolute placement (percent of the still frame) inside a
   *  positioned parent - scatter fields, line marks. Omit for flow layout:
   *   defaulting omitted coords to absolute origin was the review's overlap bug. */
  abs?: { x: number; y: number };
}

function Box({ w, ar, color, radius = 4, border, opacity = 1, abs }: BoxProps) {
  return (
    <View
      style={[
        {
          width: `${w}%`,
          aspectRatio: ar,
          backgroundColor: color,
          borderRadius: radius,
          borderWidth: border ? 1.5 : 0,
          borderColor: border ?? 'transparent',
          opacity,
        },
        abs ? { position: 'absolute' as const, left: `${abs.x}%`, top: `${abs.y}%` } : null,
      ]}
    />
  );
}

/** Lit 3×3 sequence grid (memory family). */
function MemoryGridStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const lit = [variant % 9, (variant + 3) % 9, (variant + 6) % 9];
  return (
    <View style={[st.fill, st.center, { paddingHorizontal: '18%' }]}>
      <View style={{ width: '100%', aspectRatio: 0.9, flexDirection: 'column', gap: 6 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map((col) => {
              const i = row * 3 + col;
              return (
                <View key={i} style={{ flex: 1 }}>
                  <Box w={100} ar={1} color={lit.includes(i) ? colors.base : 'transparent'} border={colors.ink} radius={6} opacity={lit.includes(i) ? 1 : 0.85} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Target card + option cards (odd one out / card sort family). */
function TargetOptionsStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, { paddingHorizontal: '8%', paddingTop: '6%' }]}>
      <Box w={20} ar={1} color={colors.base} radius={6} border={colors.ink} />
      <View style={[st.row, { position: 'absolute', left: '8%', right: '8%', top: '52%', justifyContent: 'space-between' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} w={21} ar={0.9} color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={5} opacity={i === 1 ? 1 : 0.75} />
        ))}
      </View>
    </View>
  );
}

/** Scattered search field with lens ring (visual search). */
function SearchFieldStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const dots = [
    { x: 12, y: 18 }, { x: 68, y: 12 }, { x: 30, y: 52 },
    { x: 78, y: 60 }, { x: 14, y: 74 }, { x: 55, y: 30 + variant * 6 },
  ];
  return (
    <View style={st.fill}>
      {dots.map((d, i) => (
        <Box key={i} w={9} ar={ 0.75 } color={i === (variant % dots.length) ? colors.base : colors.secondary} radius={3} opacity={i === (variant % dots.length) ? 1 : 0.5} abs={{ x: d.x, y: d.y }} />
      ))}
      <Box w={26} ar={1} color="transparent" radius={100} border={colors.base} opacity={0.9} abs={{ x: 38, y: 25 }} />
    </View>
  );
}

/** Signal stream + response slots (running order / prospective cue). */
function StreamStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: 10 }]}>
      <View style={[st.row, { width: '84%' }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} w={17} ar={ 0.654 } color={i < 2 ? colors.base : colors.secondary} radius={5} opacity={i < 2 ? 1 : 0.5} />
        ))}
      </View>
      <View style={[st.row, { width: '60%' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={30} ar={ 1.667 } color="transparent" radius={4} border={colors.base} />
        ))}
      </View>
    </View>
  );
}

/** Token equation slots (equation builder / missing operator / fast math). */
function EquationStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: 12 }]}>
      <View style={[st.row, { width: '70%', justifyContent: 'center' }]}>
        <Box w={26} ar={ 0.765 } color={colors.base} radius={5} />
        <Box w={18} ar={ 0.529 } color="transparent" radius={4} border={colors.base} />
        <Box w={26} ar={ 0.765 } color={colors.base} radius={5} />
      </View>
      <View style={[st.row, { width: '76%', justifyContent: 'center' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} w={22} ar={ 1.1 } color='transparent' border={colors.ink} radius={4}  opacity={0.9} />
        ))}
      </View>
    </View>
  );
}

/** Number line with draggable flag (number line estimation). */
function NumberLineStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center]}>
      <Box w={80} ar={20} color={colors.ink} radius={2} abs={{ x: 10, y: 58 }} />
      <Box w={7} ar={0.5} color={colors.base} radius={2} border={colors.ink} abs={{ x: 49, y: 42 }} />
      {[14, 38, 62, 86].map((x, i) => (
        <Box key={i} w={2} ar={0.33} color={colors.ink} opacity={0.7} abs={{ x: x - 1, y: 56 }} />
      ))}
    </View>
  );
}

/** Value ordering bars. */
function OrderingStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, { paddingHorizontal: '14%', paddingTop: '12%', gap: 10 }]}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} w={58 + ((i * 13) % 34)} ar={ 3.571 } color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={4} opacity={i === 1 ? 1 : 0.85} />
      ))}
    </View>
  );
}

/** Linked word chips (word chain / sentence builder / context fit / match). */
function WordChipsStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center, { gap: 10 }]}>
      <View style={[st.row, { width: '80%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={28} ar={ 1.272 } color={i === variant % 3 ? colors.base : colors.surface} radius={10} border={colors.ink} opacity={i === variant % 3 ? 1 : 0.85} />
        ))}
      </View>
      <View style={[st.row, { width: '62%', justifyContent: 'center' }]}>
        {[0, 1].map((i) => (
          <Box key={i} w={28} ar={ 1.272 } color='transparent' border={colors.ink} radius={10}  opacity={0.85} />
        ))}
      </View>
    </View>
  );
}

/** Letter tiles (word scramble). */
function ScrambleStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center]}>
      <View style={[st.row, { width: '84%', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }]}>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i} w={13} ar={ 0.591 } color={(i + variant) % 6 === 0 ? colors.base : 'transparent'} border={colors.ink} radius={4}  opacity={(i + variant) % 6 === 0 ? 1 : 0.85} />
        ))}
      </View>
    </View>
  );
}

/** Clue/deduction grid (deduction table / code cracker / rule grid). */
function DeductionStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center, { flexDirection: 'row', gap: 8 }]}>
      <View style={{ width: '30%', height: '70%', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={100} ar={ 4.167 } color='transparent' border={colors.ink} radius={3}  opacity={0.9} />
        ))}
      </View>
      <View style={{ width: '52%', height: '70%', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={100} ar={ 4.167 } color={(i + variant) % 3 === 0 ? colors.base : 'transparent'} border={colors.ink} radius={3}  opacity={(i + variant) % 3 === 0 ? 1 : 0.85} />
        ))}
      </View>
    </View>
  );
}

/** Sequence chips with unknown slot (next sequence). */
function SequenceStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: 12 }]}>
      <View style={[st.row, { width: '78%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={22} ar={ 0.786 } color={colors.base} radius={5} />
        ))}
        <Box w={22} ar={ 0.786 } color="transparent" radius={5} border={colors.base} />
      </View>
    </View>
  );
}

/** Path/order grid (order path / grid nav / fold / transform / rotation). */
function PathGridStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const path = [variant % 9, (variant + 4) % 9, (variant + 8) % 9];
  return (
    <View style={[st.fill, st.center, { paddingHorizontal: '20%' }]}>
      <View style={{ width: '100%', aspectRatio: 0.9, flexDirection: 'column', gap: 6 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map((col) => {
              const i = row * 3 + col;
              return (
                <View key={i} style={{ flex: 1 }}>
                  <Box w={100} ar={1} color={path.includes(i) ? colors.base : 'transparent'} border={colors.ink} radius={4} opacity={path.includes(i) ? 1 : 0.8} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Compass needle (coordinate turn). */
function CompassStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center]}>
      <Box w={48} ar={1} color="transparent" radius={100} border={colors.base} abs={{ x: 26, y: 8 }} />
      <Box w={6} ar={0.17} color={colors.base} radius={3} abs={{ x: 47, y: 20 }} />
      <Box w={20} ar={1.667} color={colors.secondary} radius={3} abs={{ x: 40, y: 59 }} />
    </View>
  );
}

/** Reaction trigger + tap field (reaction time / tap rush / color match / quick compare). */
function TriggerStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: 10 }]}>
      <Box w={32} ar={ 0.695 } color={colors.base} radius={16} border={colors.ink} />
      <View style={[st.row, { width: '70%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} w={12} ar={ 1.0 } color={i === 1 ? colors.base : colors.secondary} radius={6} opacity={i === 1 ? 1 : 0.5} />
        ))}
      </View>
    </View>
  );
}

/** Numbered token row (order sweep). */
function SweepStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: 10 }]}>
      <View style={[st.row, { width: '86%', justifyContent: 'center' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} w={20} ar={ 0.769 } color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={4}  opacity={i === 1 ? 1 : 0.85} />
        ))}
      </View>
      <Box w={56} ar={ 6.993 } color={colors.secondary} radius={4} opacity={0.7} />
    </View>
  );
}

/** Vigilance signal bars (sustained vigilance). */
function VigilanceStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: '20%', paddingVertical: '9%' }]}>
      {[0.5, 0.8, 0.35, 0.9, 0.6].map((height, i) => (
        <View key={i} style={{ flex: 1, height: `${height * 100}%`, backgroundColor: i === 3 ? colors.base : colors.secondary, borderRadius: 2, opacity: i === 3 ? 1 : 0.55 }} />
      ))}
    </View>
  );
}

/** Per-game still selection. Returns null when the family motif remains the
 *  best available still for that id. */
export function GameBoardStill({
  gameId,
  colors,
  variant,
  scale,
}: GameBoardStillProps): React.JSX.Element | null {
  void scale;
  switch (gameId) {
    case 'attention-odd-one-out':
      return <TargetOptionsStill colors={colors} />;
    case 'attention-symbol-tracker':
    case 'attention-target-count':
      return <SearchFieldStill colors={colors} variant={variant} />;
    case 'attention-visual-search':
      return <SearchFieldStill colors={colors} variant={variant} />;
    case 'attention-sustained-vigilance':
      return <VigilanceStill colors={colors} />;
    case 'memory':
    case 'memory-grid-recall':
    case 'memory-pattern-tap-back':
    case 'memory-sequence-memory':
      return <MemoryGridStill colors={colors} variant={variant} />;
    case 'memory-pair-recall':
      return <TargetOptionsStill colors={colors} />;
    case 'memory-running-order':
    case 'memory-prospective-cue':
      return <StreamStill colors={colors} />;
    case 'math-equation-builder':
    case 'math-missing-operator':
    case 'math-fast-math':
      return <EquationStill colors={colors} />;
    case 'math-number-line-estimation':
      return <NumberLineStill colors={colors} />;
    case 'math-value-ordering':
      return <OrderingStill colors={colors} />;
    case 'language-word-chain':
    case 'language-word-match':
    case 'language-context-fit':
    case 'language-sentence-builder':
      return <WordChipsStill colors={colors} variant={variant} />;
    case 'language-word-scramble':
      return <ScrambleStill colors={colors} variant={variant} />;
    case 'logic-deduction-table':
    case 'logic-code-cracker':
      return <DeductionStill colors={colors} variant={variant} />;
    case 'logic-next-sequence':
      return <SequenceStill colors={colors} />;
    case 'logic-order-path':
    case 'logic-rule-grid':
    case 'spatial-grid-nav':
    case 'spatial-fold-match':
    case 'spatial-transform-match':
    case 'spatial-mental-rotation':
      return <PathGridStill colors={colors} variant={variant} />;
    case 'spatial-coordinate-turn':
      return <CompassStill colors={colors} />;
    case 'speed-reaction-time':
    case 'speed-tap-rush':
    case 'speed-color-match':
    case 'speed-quick-compare':
      return <TriggerStill colors={colors} />;
    case 'speed-order-sweep':
      return <SweepStill colors={colors} />;
    case 'flexibility-card-sort':
      return <TargetOptionsStill colors={colors} />;
    case 'flexibility-color-stroop':
    case 'flexibility-cue-shift':
    case 'flexibility-rule-flip':
    case 'flexibility-task-switch':
      return <WordChipsStill colors={colors} variant={variant} />;
    default:
      return null;
  }
}
