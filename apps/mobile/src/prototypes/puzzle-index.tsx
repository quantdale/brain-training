/**
 * Prototype candidate C — "Puzzle Index" (V–A–C-informed).
 *
 * Borrowed interaction roles (never branding): a stark white/ink editorial
 * grid, typographic puzzle prompts, real content-first board stills, numbered
 * route/round markers and square rule-based tiles. Quiet confidence instead
 * of arcade. Black/white carry foreground/background; gray is a decorative
 * rule only, never low-contrast essential copy. The primary action is
 * typographic with a clear border/size — no invented accent color, no shadow,
 * no gradient. Dark mode inverts ink/canvas roles and keeps the angular
 * grammar.
 * Tested risk (design.md): ghost actions and desktop-scale gaps failing
 * mobile affordance / first-screen clarity.
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
  ink: string;
  rule: string;
  softRule: string;
  ghost: string;
  muted: string;
  inverseInk: string;
}

const C_LIGHT: Palette = {
  canvas: '#FFFFFF',
  ink: '#111111',
  rule: '#111111',
  softRule: '#E4E2DE',
  ghost: '#F5F4F1',
  muted: '#6F6D68',
  inverseInk: '#FFFFFF',
};

const C_DARK: Palette = {
  canvas: '#0E0E0E',
  ink: '#F4F3F0',
  rule: '#F4F3F0',
  softRule: '#2A2A28',
  ghost: '#171716',
  muted: '#9C9A94',
  inverseInk: '#0E0E0E',
};

const C: Record<'light' | 'dark', Palette> = { light: C_LIGHT, dark: C_DARK };

export function PuzzleIndexPrototype({ stage, mode, onStage }: PrototypeProps) {
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
    pad: { paddingHorizontal: 20 },
    index: { fontSize: 12, fontWeight: '600', letterSpacing: 2, color: c.muted, marginBottom: 6 },
    h1: { fontSize: 32, fontWeight: '300', color: c.ink, letterSpacing: -0.4, lineHeight: 38 },
    rule: { height: 1, backgroundColor: c.softRule },
    strongRule: { height: 2, backgroundColor: c.rule },
    body: { fontSize: 15, lineHeight: 23, color: c.ink },
    muted: { fontSize: 12.5, color: c.muted, letterSpacing: 0.4 },
    textAction: {
      borderWidth: 1.5,
      borderColor: c.rule,
      paddingVertical: 15,
      paddingHorizontal: 18,
      alignItems: 'center',
      borderRadius: 2,
    },
    textActionText: { color: c.ink, fontSize: 15, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
    quietAction: { paddingVertical: 10, alignItems: 'center' },
    quietActionText: { color: c.ink, fontSize: 13.5, fontWeight: '600', letterSpacing: 0.8, textDecorationLine: 'underline' },
    square: {
      borderWidth: 1,
      borderColor: c.rule,
      aspectRatio: 1,
    },
    squareFilled: {
      backgroundColor: c.ink,
    },
    artSquare: { aspectRatio: 1, backgroundColor: c.ghost, borderWidth: 1, borderColor: c.softRule },
    cell: {
      borderWidth: 1,
      borderColor: c.rule,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
    },
    feedback: { borderWidth: 1.5, borderColor: c.rule, padding: 16, gap: 8, borderRadius: 0 },
    feedbackTitle: { fontSize: 19, fontWeight: '600', color: c.ink },
    token: {
      borderWidth: 1,
      borderColor: c.rule,
      minWidth: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 0,
    },
    tokenText: { fontSize: 18, fontWeight: '500', color: c.ink },
    factRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.softRule,
    },
    factLabel: { fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: c.muted },
    factValue: { fontSize: 15, fontWeight: '600', color: c.ink },
    sectionLabel: { fontSize: 11.5, fontWeight: '600', letterSpacing: 2.2, textTransform: 'uppercase', color: c.muted, marginBottom: 10 },
  });

/** Content-first board still: a square editorial diagram. */
function BoardStill({ seed, ink, ghost, square = 120 }: { seed: number; ink: string; ghost: string; square?: number }) {
  const marks = useMemo(() => {
    const out: { x: number; y: number; s: number; o: number }[] = [];
    let v = seed * 4211 + 977;
    for (let i = 0; i < 6; i++) {
      v = (v * 197 + 29) % 991;
      out.push({ x: (v % 62) + 6, y: ((v * 3) % 62) + 6, s: 8 + (v % 12), o: i < 2 ? 1 : 0.22 });
    }
    return out;
  }, [seed]);
  return (
    <View style={[{ width: '100%', height: square, backgroundColor: ghost, borderWidth: 1, borderColor: ink }]}>
      {marks.map((m, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.s,
            height: m.s,
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
      systemName="Puzzle Index"
      stage={props.stage}
      onStage={props.onStage}
      ink={props.c.ink}
      accentBg={props.c.canvas}
      accentInk={props.c.ink}
      softBg={props.c.ghost}
    />
  );
}

function Home({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="home" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 6, gap: 16 }]}>
        <View style={s.strongRule} />
        <View>
          <Text style={s.index}>01 — TODAY</Text>
          <Text style={s.h1}>Today’s set,{"\n"}four boards</Text>
        </View>
        <View style={s.rule} />
        <BoardStill seed={7} ink={c.ink} ghost={c.ghost} square={170} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.muted}>MEMORY · RECALL</Text>
          <Text style={s.muted}>≈ 8 MIN</Text>
        </View>
        <Text style={s.body}>
          A balanced set across recall, deduction and speed. Everything runs on this device, offline.
        </Text>
        <Pressable style={s.textAction} onPress={() => onStage('memory')} accessibilityRole="button" accessibilityLabel="Begin today's set">
          <Text style={s.textActionText}>Begin →</Text>
        </Pressable>
        <View style={s.rule} />
        <View>
          <Text style={s.sectionLabel}>The set</Text>
          {['Memory', 'Equation Builder', 'Order Sweep', 'Grid Navigator'].map((t, i) => (
            <View key={t} style={s.factRow}>
              <Text style={s.factValue}>{`0${i + 1}   ${t}`}</Text>
              <Text style={s.factLabel}>ready</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

const LIBRARY = [
  { name: 'Memory', tag: 'MEMORY', seed: 7 },
  { name: 'Equation Builder', tag: 'MATH', seed: 21 },
  { name: 'Odd One Out', tag: 'ATTENTION', seed: 3 },
  { name: 'Card Sort', tag: 'FLEXIBILITY', seed: 11 },
  { name: 'Word Chain', tag: 'LANGUAGE', seed: 5 },
  { name: 'Grid Navigator', tag: 'SPATIAL', seed: 13 },
];

function Games({ c, s, onStage }: { c: Palette; s: Sheet; onStage: (st: PrototypeStage) => void }) {
  return (
    <Page bg={c.canvas}>
      <Chrome c={c} s={s} stage="games" onStage={onStage} />
      <View style={[s.pad, { paddingTop: 6, gap: 14 }]}>
        <View style={s.strongRule} />
        <View>
          <Text style={s.index}>02 — INDEX</Text>
          <Text style={s.h1}>All 42 boards</Text>
        </View>
        <View style={s.rule} />
        <Text style={[s.body, { color: c.muted }]}>Search the index…</Text>
        <View style={s.rule} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {LIBRARY.map((g, i) => (
            <Pressable
              key={g.name}
              style={{ width: '50%', padding: 10, borderRightWidth: i % 2 === 0 ? 1 : 0, borderRightColor: c.softRule, borderBottomWidth: 1, borderBottomColor: c.softRule }}
              onPress={() => onStage('detail')}
              accessibilityRole="button"
              accessibilityLabel={`Open ${g.name}`}
            >
              <BoardStill seed={g.seed} ink={c.ink} ghost={c.ghost} square={92} />
              <Text style={[s.index, { marginTop: 8 }]}>{`0${i + 1}`}</Text>
              <Text style={[s.factValue, { fontWeight: '500' }]}>{g.name}</Text>
              <Text style={s.muted}>{g.tag}</Text>
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
      <View style={[s.pad, { paddingTop: 6, gap: 16 }]}>
        <View style={s.strongRule} />
        <View>
          <Text style={s.index}>01 / RECALL</Text>
          <Text style={s.h1}>Memory</Text>
        </View>
        <BoardStill seed={7} ink={c.ink} ghost={c.ghost} square={190} />
        <View style={s.rule} />
        <Text style={s.body}>
          Tiles light up in order. Watch the sequence, then repeat it from memory. Each round adds one more step.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.muted}>MASTERY · LEVEL 3</Text>
          <Text style={s.muted}>BEST · 8</Text>
        </View>
        <View style={s.rule} />
        <Pressable style={s.textAction} onPress={() => onStage('memory')} accessibilityRole="button" accessibilityLabel="Start the board">
          <Text style={s.textActionText}>Start board →</Text>
        </Pressable>
        <Pressable style={s.quietAction} onPress={() => onStage('games')}>
          <Text style={s.quietActionText}>← Back to the index</Text>
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
      <View style={[s.pad, { paddingTop: 6, gap: 16, flex: 1 }]}>
        <View style={s.strongRule} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={s.index}>03 — ROUND 1</Text>
            <Text style={s.h1}>Recall</Text>
          </View>
          <Text style={s.muted}>0:42</Text>
        </View>
        <View style={s.rule} />
        <Text style={s.muted}>{board.watchLabel.toUpperCase()}</Text>
        <View>
          {[0, 1, 2].map((row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {[0, 1, 2].map((col) => {
                const i = row * 3 + col;
                const st = board.tileState(i);
                const filled = st === 'lit' || st === 'done';
                const pressed = st === 'pressed';
                return (
                  <Pressable
                    key={i}
                    onPress={() => board.tapTile(i)}
                    disabled={board.phase !== 'input'}
                    style={[
                      s.cell,
                      { flex: 1, aspectRatio: 1, opacity: board.phase === 'input' ? 1 : 0.6 },
                      filled || pressed ? s.squareFilled : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tile ${i + 1}`}
                  />
                );
              })}
            </View>
          ))}
        </View>
        {ok || bad ? (
          <View style={s.feedback}>
            <Text style={s.feedbackTitle}>
              {ok ? 'Perfect recall.' : 'Not quite.'}
            </Text>
            {bad ? (
              <Pressable style={[s.textAction, { alignSelf: 'stretch' }]} onPress={board.retry}>
                <Text style={s.textActionText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {board.phase !== 'correct' ? (
          <Pressable style={s.quietAction} onPress={() => onStage('result')}>
            <Text style={s.quietActionText}>Skip to result (demo)</Text>
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
      <View style={[s.pad, { paddingTop: 6, gap: 16, flex: 1 }]}>
        <View style={s.strongRule} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={s.index}>04 — ROUND 2</Text>
            <Text style={s.h1}>Assemble</Text>
          </View>
          <Text style={s.muted}>0:31</Text>
        </View>
        <View style={s.rule} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
          <Text style={{ fontSize: 64, fontWeight: '300', color: c.ink, lineHeight: 70 }}>21</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.muted}>BUILD AN EQUATION EQUAL TO</Text>
            <Text style={{ fontSize: 20, fontWeight: '500', color: c.ink, minHeight: 28 }}>
              {board.tokens.join('  ') || '— ? —'}
            </Text>
            {board.builtValue !== null && board.phase !== 'input' ? (
              <Text style={s.muted}>= {board.builtValue}</Text>
            ) : null}
          </View>
        </View>
        <View style={s.rule} />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {board.numbers.map((n, i) => (
            <Pressable key={`n${i}`} style={s.token} onPress={() => board.push(String(n))} accessibilityRole="button" accessibilityLabel={`Number ${n}`}>
              <Text style={s.tokenText}>{n}</Text>
            </Pressable>
          ))}
          {board.operators.map((op) => (
            <Pressable key={op} style={[s.token, { backgroundColor: c.ghost }]} onPress={() => board.push(op === '+' ? '+' : '*')} accessibilityRole="button" accessibilityLabel={`Operator ${op}`}>
              <Text style={s.tokenText}>{op}</Text>
            </Pressable>
          ))}
        </View>
        {board.phase === 'input' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.textAction, { flex: 1 }]} onPress={board.clear}>
              <Text style={s.textActionText}>Clear</Text>
            </Pressable>
            <Pressable style={[s.textAction, { flex: 1, backgroundColor: c.ink }]} onPress={board.check}>
              <Text style={[s.textActionText, { color: c.inverseInk }]}>Check</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.feedback}>
            <Text style={s.feedbackTitle}>
              {ok ? 'Exactly 21 — solved.' : `That makes ${board.builtValue}. Rebuild.`}
            </Text>
            {bad ? (
              <Pressable style={[s.textAction, { alignSelf: 'stretch' }]} onPress={board.retry}>
                <Text style={s.textActionText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {board.phase === 'input' ? (
          <Pressable style={s.quietAction} onPress={() => onStage('result')}>
            <Text style={s.quietActionText}>Skip to result (demo)</Text>
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
      <View style={[s.pad, { paddingTop: 6, gap: 16 }]}>
        <View style={s.strongRule} />
        <View>
          <Text style={s.index}>05 — SAVED</Text>
          <Text style={s.h1}>Keep training</Text>
        </View>
        <Text style={{ fontSize: 88, fontWeight: '300', color: c.ink, letterSpacing: -2 }}>328</Text>
        <Text style={s.muted}>SESSION SCORE · HONEST WEAK RUN</Text>
        <View style={s.rule} />
        <View>
          {[
            ['Accuracy', '30%'],
            ['Best streak', '1'],
            ['Mistakes', '7'],
            ['Time', '2:41'],
          ].map(([k, v]) => (
            <View key={k} style={s.factRow}>
              <Text style={s.factLabel}>{k}</Text>
              <Text style={s.factValue}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={s.rule} />
        <View>
          <Text style={s.sectionLabel}>Reward</Text>
          <Text style={s.body}>+18 XP · +3 coins — progress saved on this device.</Text>
        </View>
        <Pressable style={s.textAction} onPress={() => onStage('memory')}>
          <Text style={s.textActionText}>Next board →</Text>
        </Pressable>
        <Pressable style={s.quietAction} onPress={() => onStage('home')}>
          <Text style={s.quietActionText}>Back to today</Text>
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
      <View style={[s.pad, { paddingTop: 6, gap: 16 }]}>
        <View style={s.strongRule} />
        <View>
          <Text style={s.index}>06 — 30 DAYS</Text>
          <Text style={s.h1}>Consistency</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3 }}>
          {[3, 5, 2, 6, 4, 7, 5, 3, 6, 7, 4, 2, 5, 6].map((v, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${(v / 7) * 100}%`,
                backgroundColor: i === 11 ? c.ink : c.ghost,
                borderWidth: 1,
                borderColor: c.rule,
              }}
            />
          ))}
        </View>
        <Text style={s.muted}>11 OF 14 ACTIVE DAYS · BEST RUN 4 DAYS</Text>
        <View style={s.rule} />
        <View>
          {DOMAINS.map(([name, level, frac]) => (
            <View key={name} style={s.factRow}>
              <Text style={s.factValue}>{name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 90, height: 8, borderWidth: 1, borderColor: c.rule }}>
                  <View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: c.ink }} />
                </View>
                <Text style={s.factLabel}>{level}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={s.rule} />
      </View>
    </Page>
  );
}
