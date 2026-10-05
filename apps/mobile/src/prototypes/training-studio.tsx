/**
 * Prototype candidate B — "Training Studio" (Peloton-informed).
 *
 * Borrowed interaction roles (never branding): a charcoal immersive play
 * stage, white reading type, ONE red primary action, a disciplined progress
 * rail, and compact instrument-like result metrics. Imagery is the authentic
 * board/diagram cropped tight — no stock athletics. Error states use explicit
 * text/icon/shape (never red-as-generic-failure confusion; the red CTA stays
 * distinguishable because error text never sits on a red fill).
 * Tested risk (design.md): severity for broad-age learners; red CTA vs error
 * disambiguation.
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

interface Palette {
  canvas: string;
  stage: string;
  stageInk: string;
  ink: string;
  soft: string;
  line: string;
  red: string;
  redInk: string;
  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  muted: string;
}

const C_LIGHT: Palette = {
  canvas: '#F7F6F3',
  stage: '#1F2124',
  stageInk: '#FFFFFF',
  ink: '#17181A',
  soft: '#ECEAE5',
  line: '#D8D5CE',
  red: '#D6293A',
  redInk: '#FFFFFF',
  success: '#157A46',
  successSoft: '#DFF2E7',
  error: '#A32014',
  errorSoft: '#F9E2DE',
  muted: '#6E6E68',
};

const C_DARK: Palette = {
  canvas: '#101114',
  stage: '#1B1D21',
  stageInk: '#FFFFFF',
  ink: '#F2F2F0',
  soft: '#26282C',
  line: '#34363B',
  red: '#FF4A57',
  redInk: '#2B0508',
  success: '#4CC98A',
  successSoft: '#12301F',
  error: '#FF7B67',
  errorSoft: '#3A1410',
  muted: '#9A9A94',
};

const C: Record<'light' | 'dark', Palette> = { light: C_LIGHT, dark: C_DARK };

const R = 12;

export function TrainingStudioPrototype({ stage, mode, onStage }: PrototypeProps) {
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
    kicker: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase', color: c.muted, marginBottom: 4 },
    h1: { fontSize: 30, fontWeight: '800', color: c.ink, letterSpacing: -0.4 },
    stageCard: {
      backgroundColor: c.stage,
      borderRadius: R + 4,
      padding: 18,
      gap: 10,
    },
    stageTitle: { fontSize: 24, fontWeight: '800', color: c.stageInk, letterSpacing: -0.3 },
    stageBody: { fontSize: 14.5, lineHeight: 21, color: c.stageInk, opacity: 0.86 },
    cta: {
      backgroundColor: c.red,
      borderRadius: R,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaText: { color: c.redInk, fontSize: 16, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
    secondary: {
      borderWidth: 1.5,
      borderColor: c.line,
      borderRadius: R,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: c.canvas,
    },
    secondaryText: { color: c.ink, fontSize: 14, fontWeight: '700' },
    metric: {
      backgroundColor: c.soft,
      borderRadius: R,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 2,
      flex: 1,
    },
    metricValue: { fontSize: 18, fontWeight: '800', color: c.ink },
    metricLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: c.muted },
    rail: { height: 6, borderRadius: 3, backgroundColor: c.soft, overflow: 'hidden' },
    railFill: { height: '100%', borderRadius: 3, backgroundColor: c.red },
    sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted, marginBottom: 8 },
    body: { fontSize: 14.5, lineHeight: 21, color: c.ink },
    tile: {
      backgroundColor: c.canvas,
      borderRadius: R,
      borderWidth: 1.5,
      borderColor: c.line,
      overflow: 'hidden',
    },
    tileName: { fontSize: 15, fontWeight: '800', color: c.ink },
    tileMeta: { fontSize: 11.5, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
    cell: {
      borderRadius: R,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    feedback: { borderRadius: R, padding: 14, gap: 6, alignItems: 'flex-start' },
    feedbackTitle: { fontSize: 17, fontWeight: '800' },
    token: {
      borderWidth: 1.5,
      borderColor: c.line,
      borderRadius: R,
      backgroundColor: c.canvas,
      minWidth: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tokenText: { fontSize: 18, fontWeight: '800', color: c.ink },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line },
  });

/** Tight board still: a cropped diagram block (authentic-board feel). */
function BoardStill({ seed, bg, ink, height }: { seed: number; bg: string; ink: string; height: number }) {
  const marks = useMemo(() => {
    const out: { x: number; y: number; s: number; o: number }[] = [];
    let v = seed * 6151 + 1237;
    for (let i = 0; i < 4; i++) {
      v = (v * 311 + 17) % 997;
      out.push({ x: (v % 60) + 8, y: ((v * 5) % 50) + 12, s: 16 + (v % 20), o: i === 0 ? 0.95 : 0.28 });
    }
    return out;
  }, [seed]);
  return (
    <View style={{ height, borderRadius: R, backgroundColor: bg, overflow: 'hidden' }}>
      {marks.map((m, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.s,
            height: m.s,
            borderRadius: 3,
            backgroundColor: ink,
            opacity: m.o,
          }}
        />
      ))}
    </View>
  );
}

function Chrome(props: { c: Palette; s: Sheet; stage: PrototypeStage; onStage: (s: PrototypeStage) => void }) {
  return (
    <PrototypeChrome
      systemName="Training Studio"
      stage={props.stage}
      onStage={props.onStage}
      ink={props.c.ink}
      accentBg={props.c.stage}
      accentInk={props.c.stageInk}
      softBg={props.c.soft}
    />
  );
}

function Home({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="home" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 8, gap: 14 }]}>
        <View>
          <Text style={s.kicker}>Today · 4 games · 8 min</Text>
          <Text style={s.h1}>Your session is set</Text>
        </View>
        <View style={s.stageCard}>
          <BoardStill seed={7} bg="#2A2D32" ink={c.stageInk} height={130} />
          <Text style={s.stageTitle}>Memory · Recall</Text>
          <Text style={s.stageBody}>
            Balanced across your recent training. Everything runs on this device, offline.
          </Text>
          <View style={[s.rail, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <View style={[s.railFill, { width: '0%' }]} />
          </View>
          <Text style={[s.tileMeta, { color: 'rgba(255,255,255,0.6)' }]}>0 of 4 complete</Text>
        </View>
        <Pressable style={s.cta} onPress={() => onStage('memory')} accessibilityRole="button" accessibilityLabel="Start today's session">
          <Text style={s.ctaText}>Start session</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={s.metric}><Text style={s.metricValue}>6</Text><Text style={s.metricLabel}>Streak</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>12</Text><Text style={s.metricLabel}>Level</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>340</Text><Text style={s.metricLabel}>XP</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>126</Text><Text style={s.metricLabel}>Coins</Text></View>
        </View>
        <View>
          <Text style={s.sectionTitle}>Plan</Text>
          {['Memory', 'Equation Builder', 'Order Sweep', 'Grid Navigator'].map((t, i) => (
            <View key={t} style={s.row}>
              <Text style={s.body}>{`0${i + 1}  ${t}`}</Text>
              <Text style={s.tileMeta}>ready</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

const LIBRARY = [
  { name: 'Memory', meta: 'Recall · 3 levels', seed: 7 },
  { name: 'Equation Builder', meta: 'Math · 3 levels', seed: 21 },
  { name: 'Odd One Out', meta: 'Attention · 3 levels', seed: 3 },
  { name: 'Card Sort', meta: 'Flexibility · 3 levels', seed: 11 },
  { name: 'Word Chain', meta: 'Language · 3 levels', seed: 5 },
  { name: 'Grid Navigator', meta: 'Spatial · 3 levels', seed: 13 },
];

function Games({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="games" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 8, gap: 12 }]}>
        <View>
          <Text style={s.kicker}>Full library · 42</Text>
          <Text style={s.h1}>All boards</Text>
        </View>
        <View style={[s.tile, { paddingHorizontal: 14, paddingVertical: 12 }]}>
          <Text style={[s.body, { opacity: 0.5 }]}>Search all 42 boards…</Text>
        </View>
        {LIBRARY.map((g, i) => (
          <Pressable
            key={g.name}
            style={[s.tile, { padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }]}
            onPress={() => onStage('detail')}
            accessibilityRole="button"
            accessibilityLabel={`Open ${g.name}`}
          >
            <View style={{ width: 64 }}>
              <BoardStill seed={g.seed} bg={c.stage} ink={c.stageInk} height={52} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.tileName}>{`0${i + 1}  ${g.name}`}</Text>
              <Text style={s.tileMeta}>{g.meta}</Text>
            </View>
            <Text style={[s.tileMeta, { color: c.red }]}>Open</Text>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

function Detail({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="detail" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 8, gap: 14 }]}>
        <View>
          <Text style={s.kicker}>Board 01 · Recall</Text>
          <Text style={s.h1}>Memory</Text>
        </View>
        <View style={s.stageCard}>
          <BoardStill seed={7} bg="#2A2D32" ink={c.stageInk} height={150} />
          <Text style={s.stageBody}>
            Tiles light up in order. Watch the sequence, then repeat it from memory. Each round adds a step.
          </Text>
          <View style={[s.rail, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <View style={[s.railFill, { width: '40%' }]} />
          </View>
          <Text style={[s.tileMeta, { color: 'rgba(255,255,255,0.6)' }]}>Mastery · level 3 of 5</Text>
        </View>
        <Pressable style={s.cta} onPress={() => onStage('memory')} accessibilityRole="button" accessibilityLabel="Start the board">
          <Text style={s.ctaText}>Start board</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={() => onStage('games')}>
          <Text style={s.secondaryText}>← All boards</Text>
        </Pressable>
      </View>
    </Page>
  );
}

function MemoryBoardScreen({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  const toResult = useCallback(() => onStage('result'), [onStage]);
  const board = useMemoryBoard(toResult);
  const ok = board.phase === 'correct';
  const bad = board.phase === 'incorrect';
  return (
    <BoardPage bg={c.canvas}>
      <Chrome c={c} s={s} stage="memory" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 8, gap: 14, flex: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <View>
            <Text style={s.kicker}>Memory · round 1</Text>
            <Text style={s.h1}>Recall</Text>
          </View>
          <Text style={[s.tileMeta, { color: c.red }]}>0:42</Text>
        </View>
        <View style={[s.stageCard, { flex: 1, justifyContent: 'center', gap: 16 }]}>
          <Text style={[s.stageBody, { fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', fontSize: 12.5 }]}>
            {board.watchLabel}
          </Text>
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={{ flexDirection: 'row', gap: 12 }}>
                {[0, 1, 2].map((col) => {
                  const i = row * 3 + col;
                  const st = board.tileState(i);
                  const bg = st === 'lit' || st === 'done' ? c.stageInk : st === 'pressed' ? c.red : 'rgba(255,255,255,0.08)';
                  return (
                    <Pressable
                      key={i}
                      onPress={() => board.tapTile(i)}
                      disabled={board.phase !== 'input'}
                      style={[s.cell, { flex: 1, aspectRatio: 1, backgroundColor: bg, borderColor: 'rgba(255,255,255,0.25)' }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Tile ${i + 1}`}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
        {ok || bad ? (
          <View style={[s.feedback, { backgroundColor: ok ? c.successSoft : c.errorSoft }]}>
            <Text style={[s.feedbackTitle, { color: ok ? c.success : c.error }]}>
              {ok ? '✓ Sequence complete' : '✕  Out of order — watch once more'}
            </Text>
            {bad ? (
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
  const bad = board.phase === 'incorrect';
  return (
    <BoardPage bg={c.canvas}>
      <Chrome c={c} s={s} stage="equation" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 8, gap: 14, flex: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <View>
            <Text style={s.kicker}>Equation Builder · round 2</Text>
            <Text style={s.h1}>Assemble</Text>
          </View>
          <Text style={[s.tileMeta, { color: c.red }]}>0:31</Text>
        </View>
        <View style={[s.stageCard, { alignItems: 'center', gap: 8 }]}>
          <Text style={[s.stageBody, { textTransform: 'uppercase', letterSpacing: 1.6, fontSize: 11.5, fontWeight: '800' }]}>
            Build an equation that equals
          </Text>
          <Text style={{ fontSize: 54, fontWeight: '800', color: c.stageInk }}>21</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: c.stageInk, minHeight: 32 }}>
            {board.tokens.join(' ') || '— ? —'}
          </Text>
          {board.builtValue !== null && board.phase !== 'input' ? (
            <Text style={[s.stageBody, { opacity: 0.7 }]}>= {board.builtValue}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {board.numbers.map((n, i) => (
            <Pressable key={`n${i}`} style={s.token} onPress={() => board.push(String(n))} accessibilityRole="button" accessibilityLabel={`Number ${n}`}>
              <Text style={s.tokenText}>{n}</Text>
            </Pressable>
          ))}
          {board.operators.map((op) => (
            <Pressable key={op} style={[s.token, { backgroundColor: c.soft }]} onPress={() => board.push(op === '+' ? '+' : '*')} accessibilityRole="button" accessibilityLabel={`Operator ${op}`}>
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
          <View style={[s.feedback, { backgroundColor: ok ? c.successSoft : c.errorSoft }]}>
            <Text style={[s.feedbackTitle, { color: ok ? c.success : c.error }]}>
              {ok ? '✓ Exactly 21 — solved' : `✕  That makes ${board.builtValue} — reset and rebuild`}
            </Text>
            {bad ? (
              <Pressable style={[s.secondary, { alignSelf: 'stretch' }]} onPress={board.retry}>
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
      <View style={[s.pad, { paddingTop: 8, gap: 14 }]}>
        <View>
          <Text style={s.kicker}>Session saved · honest weak run</Text>
          <Text style={s.h1}>Keep training</Text>
        </View>
        <View style={s.stageCard}>
          <BoardStill seed={7} bg="#2A2D32" ink={c.stageInk} height={110} />
          <Text style={{ fontSize: 62, fontWeight: '800', color: c.stageInk, letterSpacing: -1 }}>328</Text>
          <Text style={[s.stageBody, { opacity: 0.7 }]}>Session score</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={s.metric}><Text style={s.metricValue}>30%</Text><Text style={s.metricLabel}>Accuracy</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>1</Text><Text style={s.metricLabel}>Best streak</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>7</Text><Text style={s.metricLabel}>Mistakes</Text></View>
        </View>
        <View style={[s.tile, { padding: 14, gap: 4 }]}>
          <Text style={s.sectionTitle}>Reward</Text>
          <Text style={[s.body, { fontWeight: '800', fontSize: 17 }]}>+18 XP · +3 coins</Text>
          <Text style={s.tileMeta}>Progress saved on this device</Text>
        </View>
        <Pressable style={s.cta} onPress={() => onStage('memory')}>
          <Text style={s.ctaText}>Next board</Text>
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
      <View style={[s.pad, { paddingTop: 8, gap: 14 }]}>
        <View>
          <Text style={s.kicker}>Last 30 days</Text>
          <Text style={s.h1}>Consistency</Text>
        </View>
        <View style={[s.tile, { padding: 14, gap: 8 }]}>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 70 }}>
            {[3, 5, 2, 6, 4, 7, 5, 3, 6, 7, 4, 2, 5, 6].map((v, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: `${(v / 7) * 100}%`,
                  backgroundColor: i === 11 ? c.red : c.ink,
                  opacity: i === 11 ? 1 : 0.82,
                  borderRadius: 3,
                }}
              />
            ))}
          </View>
          <Text style={s.tileMeta}>11 of 14 active days · best run 4 days</Text>
        </View>
        <View style={[s.tile, { padding: 14 }]}>
          <Text style={s.sectionTitle}>Domains</Text>
          {DOMAINS.map(([name, level, frac]) => (
            <View key={name} style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={[s.body, { fontWeight: '800' }]}>{name}</Text>
                <Text style={s.tileMeta}>{level}</Text>
              </View>
              <View style={s.rail}>
                <View style={[s.railFill, { width: `${frac * 100}%`, backgroundColor: c.ink }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
