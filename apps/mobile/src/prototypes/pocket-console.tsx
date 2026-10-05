/**
 * Prototype candidate A — "Pocket Console" (Playdate-informed).
 *
 * Borrowed interaction roles (never branding): bold yellow brand FIELDS for
 * identity/section bands, a single tactile violet PRIMARY ACTION, grounded
 * dark ink, flat collectible library previews with genuine board stills, and
 * chunky offset-shadow "console key" surfaces. Teal exists only for a
 * justified state (in-session timer), never as a generic extra accent.
 * Tested risk (design.md): energy becoming noise at 2× text; puzzles must
 * stay louder than the frame.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCallback, useMemo } from 'react';
import {
  BoardPage,
  Page,
  PrototypeChrome,
  type PrototypeProps,
  type PrototypeStage,
} from './harness';

import { useEquationBoard, useMemoryBoard } from './boards';

/** Pocket Console palette: warm paper canvas, yellow brand field, violet action. */
interface Palette {
  canvas: string;
  ink: string;
  soft: string;
  line: string;
  yellow: string;
  yellowInk: string;
  violet: string;
  violetInk: string;
  violetSoft: string;
  success: string;
  successInk: string;
  error: string;
  errorInk: string;
  teal: string;
  tealInk: string;
  muted: string;
}

const C_LIGHT: Palette = {
  canvas: '#FFF6E8',
  ink: '#20242F',
  soft: '#FBEED2',
  line: '#20242F',
  yellow: '#FFD43B',
  yellowInk: '#20242F',
  violet: '#6C4CF1',
  violetInk: '#FFFFFF',
  violetSoft: '#EDE7FE',
  success: '#1B7F4D',
  successInk: '#FFFFFF',
  error: '#C6402E',
  errorInk: '#FFFFFF',
  teal: '#12808C',
  tealInk: '#FFFFFF',
  muted: '#6B6353',
};

const C_DARK: Palette = {
  canvas: '#221D12',
  ink: '#F6EFDF',
  soft: '#33291A',
  line: '#F6EFDF',
  yellow: '#FFD43B',
  yellowInk: '#20242F',
  violet: '#9B85FF',
  violetInk: '#231A45',
  violetSoft: '#3A3358',
  success: '#4CC98A',
  successInk: '#0B2E1C',
  error: '#FF7B67',
  errorInk: '#3A0E07',
  teal: '#4FC3D0',
  tealInk: '#083238',
  muted: '#B3A88F',
};

const C: Record<'light' | 'dark', Palette> = { light: C_LIGHT, dark: C_DARK };

const R = 14;
const BORDER = 3;

export function PocketConsolePrototype({ stage, mode, onStage }: PrototypeProps) {
  const c = C[mode];
  const go = onStage;
  const s = sheet(c);

  switch (stage) {
    case 'home':
      return <Home c={c} s={s} onStage={go} />;
    case 'games':
      return <Games c={c} s={s} onStage={go} />;
    case 'detail':
      return <Detail c={c} s={s} onStage={go} />;
    case 'memory':
      return <MemoryBoardScreen c={c} s={s} onStage={go} />;
    case 'equation':
      return <EquationBoardScreen c={c} s={s} onStage={go} />;
    case 'result':
      return <Result c={c} s={s} onStage={go} />;
    case 'progress':
      return <Progress c={c} s={s} onStage={go} />;
  }
}

type Sheet = ReturnType<typeof sheet>;

const sheet = (c: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.canvas },
    pad: { paddingHorizontal: 18 },
    // chunky console key
    key: {
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: R,
      backgroundColor: c.canvas,
    },
    keyShadow: {
      shadowColor: c.line,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    band: {
      backgroundColor: c.yellow,
      borderBottomWidth: BORDER,
      borderBottomColor: c.line,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    bandTitle: { fontSize: 30, fontWeight: '900', color: c.ink, letterSpacing: -0.5 },
    bandKicker: { fontSize: 12, fontWeight: '800', color: c.ink, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
    cta: {
      backgroundColor: c.violet,
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: R,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaText: { color: c.violetInk, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
    secondary: {
      backgroundColor: c.canvas,
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: R,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryText: { color: c.ink, fontSize: 14, fontWeight: '800' },
    stamp: {
      borderWidth: 2,
      borderColor: c.line,
      borderRadius: 10,
      backgroundColor: c.soft,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    stampText: { color: c.ink, fontSize: 12, fontWeight: '800' },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: c.ink, letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },
    body: { fontSize: 14.5, lineHeight: 21, color: c.ink },
    muted: { fontSize: 12.5, color: c.muted, fontWeight: '600' },
    tile: {
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: 12,
      backgroundColor: c.soft,
      aspectRatio: 1,
      padding: 10,
      justifyContent: 'space-between',
    },
    tileName: { fontSize: 14, fontWeight: '900', color: c.ink },
    tileTag: { fontSize: 10.5, fontWeight: '800', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    art: { borderRadius: 8, alignSelf: 'stretch', flex: 1, marginVertical: 8 },
    cell: {
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: 12,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feedback: {
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: R,
      padding: 14,
      alignItems: 'center',
      gap: 6,
    },
    feedbackTitle: { fontSize: 20, fontWeight: '900' },
    token: {
      borderWidth: BORDER,
      borderColor: c.line,
      borderRadius: 10,
      backgroundColor: c.canvas,
      minWidth: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tokenText: { fontSize: 18, fontWeight: '900', color: c.ink },
  });

/** A flat "game still": deterministic mini-board art per game id. */
function GameStill({ seed, bg, ink, radius = 10, height }: { seed: number; bg: string; ink: string; radius?: number; height: number }) {
  const blocks = useMemo(() => {
    const out: { x: number; y: number; s: number; o: number }[] = [];
    let v = seed * 9301 + 49297;
    for (let i = 0; i < 5; i++) {
      v = (v * 233 + 7) % 1000;
      out.push({ x: (v % 70) + 5, y: ((v * 7) % 55) + 8, s: 10 + (v % 14), o: i === 0 ? 1 : 0.35 });
    }
    return out;
  }, [seed]);
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: bg, overflow: 'hidden' }}>
      {blocks.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: b.s * 2,
            height: b.s * 2,
            borderRadius: 4,
            backgroundColor: ink,
            opacity: b.o,
          }}
        />
      ))}
    </View>
  );
}

function Chrome(props: { c: Palette; s: Sheet; stage: PrototypeStage; onStage: (s: PrototypeStage) => void }) {
  return (
    <PrototypeChrome
      systemName="Pocket Console"
      stage={props.stage}
      onStage={props.onStage}
      ink={props.c.ink}
      accentBg={props.c.yellow}
      accentInk={props.c.yellowInk}
      softBg={props.c.soft}
    />
  );
}

function Home({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="home" onStage={onStage} />
      <View style={s.band}>
        <Text style={s.bandKicker}>Pocket Console · Today</Text>
        <Text style={s.bandTitle}>&apos;Today&apos;s board</Text>
      </View>
      <View style={[s.pad, { paddingTop: 16, gap: 14 }]}>
        <View style={[s.key, s.keyShadow, { padding: 14, gap: 10 }]}>
          <GameStill seed={7} bg={c.yellow} ink={c.ink} height={120} />
          <Text style={s.sectionTitle}>Memory · 3 rounds</Text>
          <Text style={s.body}>
            Your set blends recall, deduction and speed. About 8 minutes — plays entirely offline.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={s.stamp}><Text style={s.stampText}>4 games</Text></View>
            <View style={s.stamp}><Text style={s.stampText}>≈8 min</Text></View>
            <View style={s.stamp}><Text style={s.stampText}>Balanced set</Text></View>
          </View>
        </View>
        <Pressable
          style={[s.cta, s.keyShadow]}
          onPress={() => onStage('memory')}
          accessibilityRole="button"
          accessibilityLabel="Play today’s set"
        >
          <Text style={s.ctaText}>▶ Play today’s set</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={s.stamp}><Text style={s.stampText}>🔥 6-day streak</Text></View>
          <View style={s.stamp}><Text style={s.stampText}>Level 12</Text></View>
          <View style={s.stamp}><Text style={s.stampText}>340 XP</Text></View>
          <View style={s.stamp}><Text style={s.stampText}>126 coins</Text></View>
        </View>
        <View style={[s.key, { padding: 14, gap: 8 }]}>
          <Text style={s.sectionTitle}>Today’s plan</Text>
          {['Memory — recall', 'Equation Builder — math', 'Order Sweep — speed', 'Grid Navigator — spatial'].map((t) => (
            <View key={t} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.body}>{t}</Text>
              <Text style={s.muted}>ready</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

const LIBRARY = [
  { name: 'Memory', domain: 'Memory', seed: 7 },
  { name: 'Equation Builder', domain: 'Math', seed: 21 },
  { name: 'Odd One Out', domain: 'Attention', seed: 3 },
  { name: 'Card Sort', domain: 'Flexibility', seed: 11 },
  { name: 'Word Chain', domain: 'Language', seed: 5 },
  { name: 'Grid Navigator', domain: 'Spatial', seed: 13 },
  { name: 'Order Sweep', domain: 'Speed', seed: 17 },
  { name: 'Deduction Table', domain: 'Logic', seed: 23 },
];

function Games({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="games" onStage={onStage} />
      <View style={s.band}>
        <Text style={s.bandKicker}>Library · 42 games</Text>
        <Text style={s.bandTitle}>Pick a board</Text>
      </View>
      <View style={[s.pad, { paddingTop: 14, gap: 12 }]}>
        <View style={[s.key, { paddingHorizontal: 14, paddingVertical: 12 }]}>
          <Text style={[s.body, { opacity: 0.55 }]}>Search all 42 boards…</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['All', 'Memory', 'Math', 'Attention', 'Speed'].map((f, i) => (
            <View key={f} style={[s.stamp, i === 0 && { backgroundColor: c.yellow }]}>
              <Text style={s.stampText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
          {LIBRARY.map((g) => (
            <Pressable
              key={g.name}
              style={[s.tile, s.keyShadow, { width: '48%' }]}
              onPress={() => onStage('detail')}
              accessibilityRole="button"
              accessibilityLabel={`Open ${g.name}`}
            >
              <GameStill seed={g.seed} bg={c.yellow} ink={c.ink} radius={7} height={64} />
              <Text style={s.tileName}>{g.name}</Text>
              <Text style={s.tileTag}>{g.domain}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Page>
  );
}

function Detail({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="detail" onStage={onStage} />
      <View style={s.band}>
        <Text style={s.bandKicker}>Memory · board 01</Text>
        <Text style={s.bandTitle}>How it plays</Text>
      </View>
      <View style={[s.pad, { paddingTop: 16, gap: 14 }]}>
        <View style={[s.key, s.keyShadow, { padding: 14, gap: 10 }]}>
          <GameStill seed={7} bg={c.yellow} ink={c.ink} height={140} />
          <Text style={s.body}>
            Tiles light up in order. Watch the sequence, then repeat it from memory. Each round adds one more step.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={s.stamp}><Text style={s.stampText}>Mastery · level 3</Text></View>
            <View style={s.stamp}><Text style={s.stampText}>Best 8</Text></View>
          </View>
        </View>
        <Pressable style={[s.cta, s.keyShadow]} onPress={() => onStage('memory')} accessibilityRole="button" accessibilityLabel="Start the board">
          <Text style={s.ctaText}>▶ Start the board</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={() => onStage('games')}>
          <Text style={s.secondaryText}>← Back to library</Text>
        </Pressable>
      </View>
    </Page>
  );
}

function MemoryBoardScreen({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  const toResult = useCallback(() => onStage('result'), [onStage]);
  const board = useMemoryBoard(toResult);
  const fbColor =
    board.phase === 'correct' ? c.success : board.phase === 'incorrect' ? c.error : c.canvas;
  const fbInk = board.phase === 'correct' ? c.successInk : board.phase === 'incorrect' ? c.errorInk : c.ink;
  return (
    <BoardPage bg={c.canvas}>
      <Chrome c={c} s={s} stage="memory" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 10, gap: 14, flex: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.sectionTitle}>Memory · round 1</Text>
          <View style={[s.stamp, { backgroundColor: c.teal }]}>
            <Text style={[s.stampText, { color: c.tealInk }]}>0:42</Text>
          </View>
        </View>
        <Text style={[s.body, { fontWeight: '800' }]}>{board.watchLabel}</Text>
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 12 }}>
              {[0, 1, 2].map((col) => {
                const i = row * 3 + col;
                const st = board.tileState(i);
                const bg = st === 'lit' || st === 'done' ? c.yellow : st === 'pressed' ? c.violetSoft : c.canvas;
                return (
                  <Pressable
                    key={i}
                    onPress={() => board.tapTile(i)}
                    disabled={board.phase !== 'input'}
                    style={[s.cell, s.keyShadow, { flex: 1, aspectRatio: 1, backgroundColor: bg, opacity: board.phase === 'input' ? 1 : 0.75 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tile ${i + 1}`}
                  />
                );
              })}
            </View>
          ))}
        </View>
        {board.phase === 'correct' || board.phase === 'incorrect' ? (
          <View style={[s.feedback, s.keyShadow, { backgroundColor: fbColor }]}>
            <Text style={[s.feedbackTitle, { color: fbInk }]}>
              {board.phase === 'correct' ? 'Nice! Sequence locked in' : 'Not quite — watch again'}
            </Text>
            {board.phase === 'incorrect' ? (
              <Pressable style={[s.secondary, { alignSelf: 'stretch' }]} onPress={board.retry}>
                <Text style={s.secondaryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {board.phase !== 'correct' ? (
          <Pressable style={s.secondary} onPress={() => onStage('result')}>
            <Text style={s.secondaryText}>Skip to result (demo)</Text>
          </Pressable>
        ) : null}
      </View>
    </BoardPage>
  );
}

const EQ_NUMBERS = [3, 7, 4];
const EQ_OPERATORS = ['+', '×'] as const;

function EquationBoardScreen({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  const toResult = useCallback(() => onStage('result'), [onStage]);
  const board = useEquationBoard(21, EQ_NUMBERS, [...EQ_OPERATORS], toResult);
  const ok = board.phase === 'correct';
  return (
    <BoardPage bg={c.canvas}>
      <Chrome c={c} s={s} stage="equation" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 10, gap: 14, flex: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.sectionTitle}>Equation Builder · round 2</Text>
          <View style={[s.stamp, { backgroundColor: c.teal }]}>
            <Text style={[s.stampText, { color: c.tealInk }]}>0:31</Text>
          </View>
        </View>
        <View style={[s.key, s.keyShadow, { padding: 14, alignItems: 'center', gap: 6 }]}>
          <Text style={s.muted}>Build an equation that equals</Text>
          <Text style={{ fontSize: 44, fontWeight: '900', color: c.ink }}>21</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: c.ink, minHeight: 30 }}>
            {board.tokens.join(' ') || '— ? —'}
          </Text>
          {board.builtValue !== null && board.phase !== 'input' ? (
            <Text style={[s.muted, { fontWeight: '800' }]}>= {board.builtValue}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {board.numbers.map((n, i) => (
            <Pressable key={`n${i}`} style={[s.token, s.keyShadow]} onPress={() => board.push(String(n))} accessibilityRole="button" accessibilityLabel={`Number ${n}`}>
              <Text style={s.tokenText}>{n}</Text>
            </Pressable>
          ))}
          {board.operators.map((op) => (
            <Pressable key={op} style={[s.token, s.keyShadow, { backgroundColor: c.violetSoft }]} onPress={() => board.push(op === '+' ? '+' : '*')} accessibilityRole="button" accessibilityLabel={`Operator ${op}`}>
              <Text style={s.tokenText}>{op}</Text>
            </Pressable>
          ))}
        </View>
        {board.phase === 'input' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.secondary, { flex: 1 }]} onPress={board.clear}>
              <Text style={s.secondaryText}>Clear</Text>
            </Pressable>
            <Pressable style={[s.cta, { flex: 2 }]} onPress={board.check}>
              <Text style={s.ctaText}>Check</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[s.feedback, s.keyShadow, { backgroundColor: ok ? c.success : c.error }]}>
            <Text style={[s.feedbackTitle, { color: ok ? c.successInk : c.errorInk }]}>
              {ok ? 'Exactly 21 — solved!' : `That makes ${board.builtValue} — try again`}
            </Text>
            {!ok ? (
              <Pressable style={[s.secondary, { alignSelf: 'stretch', backgroundColor: c.canvas }]} onPress={board.retry}>
                <Text style={s.secondaryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {board.phase === 'input' ? (
          <Pressable style={s.secondary} onPress={() => onStage('result')}>
            <Text style={s.secondaryText}>Skip to result (demo)</Text>
          </Pressable>
        ) : null}
      </View>
    </BoardPage>
  );
}

function Result({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="result" onStage={onStage} />
      <View style={s.band}>
        <Text style={s.bandKicker}>Session saved</Text>
        <Text style={s.bandTitle}>Keep training</Text>
      </View>
      <View style={[s.pad, { paddingTop: 16, gap: 14 }]}>
        <View style={[s.key, s.keyShadow, { padding: 16, alignItems: 'center', gap: 4 }]}>
          <GameStill seed={7} bg={c.yellow} ink={c.ink} height={110} />
          <Text style={{ fontSize: 56, fontWeight: '900', color: c.ink }}>328</Text>
          <Text style={s.muted}>Session score · honest weak run</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={s.stamp}><Text style={s.stampText}>Accuracy 30%</Text></View>
          <View style={s.stamp}><Text style={s.stampText}>Best streak 1</Text></View>
          <View style={s.stamp}><Text style={s.stampText}>Mistakes 7</Text></View>
        </View>
        <View style={[s.key, { padding: 14 }]}>
          <Text style={s.sectionTitle}>Reward</Text>
          <Text style={[s.body, { fontWeight: '900', fontSize: 18 }]}>+18 XP · +3 coins</Text>
          <Text style={s.muted}>Progress saved on this device</Text>
        </View>
        <Pressable style={[s.cta, s.keyShadow]} onPress={() => onStage('memory')}>
          <Text style={s.ctaText}>▶ Next board</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={() => onStage('home')}>
          <Text style={s.secondaryText}>Back to today</Text>
        </Pressable>
      </View>
    </Page>
  );
}

const DOMAINS = [
  ['Memory', 'level 4', 0.8],
  ['Math', 'level 3', 0.62],
  ['Attention', 'level 2', 0.45],
  ['Speed', 'level 3', 0.58],
  ['Logic', 'level 2', 0.4],
] as const;

function Progress({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="progress" onStage={onStage} />
      <View style={s.band}>
        <Text style={s.bandKicker}>Progress · last 30 days</Text>
        <Text style={s.bandTitle}>Your training</Text>
      </View>
      <View style={[s.pad, { paddingTop: 16, gap: 14 }]}>
        <View style={[s.key, s.keyShadow, { padding: 14, gap: 8 }]}>
          <Text style={s.sectionTitle}>Consistency</Text>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 64 }}>
            {[3, 5, 2, 6, 4, 7, 5, 3, 6, 7, 4, 2, 5, 6].map((v, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: `${(v / 7) * 100}%`,
                  backgroundColor: i === 11 ? c.violet : c.yellow,
                  borderWidth: 2,
                  borderColor: c.line,
                  borderRadius: 4,
                }}
              />
            ))}
          </View>
          <Text style={s.muted}>11 of 14 active days · best run 4 days</Text>
        </View>
        <View style={[s.key, { padding: 14, gap: 10 }]}>
          <Text style={s.sectionTitle}>Domains</Text>
          {DOMAINS.map(([name, level, frac]) => (
            <View key={name} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[s.body, { fontWeight: '800' }]}>{name}</Text>
                <Text style={s.muted}>{level}</Text>
              </View>
              <View style={{ height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.line, backgroundColor: c.canvas, overflow: 'hidden' }}>
                <View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: c.yellow }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
