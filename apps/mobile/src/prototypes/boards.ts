/**
 * Shared interactive board logic for the 076 prototypes: a watch-then-tap
 * memory board and a token-assembly equation board. The MECHANICS are
 * identical across candidates (same seeded journey, comparable playability);
 * each candidate supplies its own skin via the BoardSkin callbacks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { MEMORY_DEMO_SEQUENCE, type PrototypeStage } from './harness';

export type MemoryPhase = 'brief' | 'watch' | 'input' | 'correct' | 'incorrect';
export type EquationPhase = 'input' | 'correct' | 'incorrect';

/** Memory board controller: watch 3 lit tiles, reproduce in order. */
export function useMemoryBoard(onDone: () => void) {
  const [phase, setPhase] = useState<MemoryPhase>('brief');
  const [litIndex, setLitIndex] = useState(-1); // which demo tile is lit during watch
  const [inputIndex, setInputIndex] = useState(0);
  const [pressedTile, setPressedTile] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const startWatch = useCallback(() => {
    clearTimers();
    setPhase('watch');
    setInputIndex(0);
    MEMORY_DEMO_SEQUENCE.forEach((tile, i) => {
      timers.current.push(setTimeout(() => setLitIndex(i), 500 + i * 750));
    });
    timers.current.push(
      setTimeout(() => {
        setLitIndex(-1);
        setPhase('input');
      }, 500 + MEMORY_DEMO_SEQUENCE.length * 750),
    );
  }, [clearTimers]);

  // brief → watch on mount
  useEffect(() => {
    const t = setTimeout(startWatch, 700);
    timers.current.push(t);
    return clearTimers;
  }, [startWatch, clearTimers]);

  const tapTile = useCallback(
    (tile: number) => {
      if (phase !== 'input') return;
      setPressedTile(tile);
      setTimeout(() => setPressedTile(null), 260);
      const expected = MEMORY_DEMO_SEQUENCE[inputIndex];
      if (tile === expected) {
        const next = inputIndex + 1;
        setInputIndex(next);
        if (next >= MEMORY_DEMO_SEQUENCE.length) {
          setPhase('correct');
          setTimeout(onDone, 1400);
        }
      } else {
        setPhase('incorrect');
      }
    },
    [phase, inputIndex, onDone],
  );

  const retry = useCallback(() => {
    setPhase('input');
    setInputIndex(0);
  }, []);

  const tileState = useCallback(
    (tile: number): 'idle' | 'lit' | 'done' | 'pressed' => {
      if (phase === 'watch') {
        return litIndex >= 0 && MEMORY_DEMO_SEQUENCE[litIndex] === tile ? 'lit' : 'idle';
      }
      if (pressedTile === tile) return 'pressed';
      if (phase === 'input' && inputIndex > 0) {
        const done = MEMORY_DEMO_SEQUENCE.slice(0, inputIndex);
        if (done.includes(tile)) return 'done';
      }
      return 'idle';
    },
    [phase, litIndex, inputIndex, pressedTile],
  );

  const watchLabel =
    phase === 'watch' && litIndex >= 0
      ? `Watch (${litIndex + 1}/${MEMORY_DEMO_SEQUENCE.length})…`
      : phase === 'watch'
        ? 'Watch…'
        : phase === 'input'
          ? `Your turn — tile ${inputIndex + 1} of ${MEMORY_DEMO_SEQUENCE.length}`
          : phase === 'correct'
            ? 'Perfect recall'
            : 'Not quite';

  return { phase, tapTile, retry, startWatch, tileState, watchLabel, inputIndex };
}

/** Equation board controller: assemble `a op b = target` from tokens, then check. */
export function useEquationBoard(target: number, numbers: readonly number[], operators: readonly string[], onDone: () => void) {
  const [phase, setPhase] = useState<EquationPhase>('input');
  const [tokens, setTokens] = useState<string[]>([]);
  const [builtValue, setBuiltValue] = useState<number | null>(null);

  const push = useCallback((token: string) => {
    setPhase((p) => (p === 'input' ? p : p));
    setTokens((prev) => (prev.length >= 5 ? prev : [...prev, token]));
  }, []);

  const clear = useCallback(() => {
    setTokens([]);
    setBuiltValue(null);
  }, []);

  const evaluate = useCallback((seq: string[]): number | null => {
    if (seq.length !== 3) return null;
    const a = Number(seq[0]);
    const b = Number(seq[2]);
    const op = seq[1];
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    return null;
  }, []);

  const check = useCallback(() => {
    const v = evaluate(tokens);
    setBuiltValue(v);
    if (v !== null && v === target) {
      setPhase('correct');
      setTimeout(onDone, 1400);
    } else {
      setPhase('incorrect');
    }
  }, [tokens, target, evaluate, onDone]);

  const retry = useCallback(() => {
    setTokens([]);
    setBuiltValue(null);
    setPhase('input');
  }, []);

  return { phase, tokens, builtValue, push, clear, check, retry, numbers, operators };
}

/** Stage navigation seam shared by board screens (Continue → result). */
export function useStageNav(onStage: (s: PrototypeStage) => void) {
  return useMemo(
    () => ({
      toResult: () => onStage('result'),
      toHome: () => onStage('home'),
    }),
    [onStage],
  );
}



export { MEMORY_DEMO_SEQUENCE };
export type { PrototypeStage };

/** Explicit square tile size for the 3x3 memory grid: aspectRatio collapses to
 * zero height inside wrap containers on this Yoga version, so the boards size
 * cells from the measured window instead. */
export function useMemoryTileSize(): number {
  const { width } = useWindowDimensions();
  return useMemo(() => Math.floor((Math.min(width, 720) - 36 - 20) / 3), [width]);
}
