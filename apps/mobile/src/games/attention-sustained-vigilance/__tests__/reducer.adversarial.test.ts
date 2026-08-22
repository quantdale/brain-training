// Jest globals imported explicitly (repo has no @types/jest).
// Adversarial reducer suite (campaign 011 W01): response accounting under
// double-taps/late taps/boundaries, drift-free cadence under stalls,
// exact pause freezing, adaptive window stepping incl. the relaxed
// window > slot catch-up, QA force paths, and replay determinism.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  VIGILANCE_DIFFICULTY_PARAMS,
  nextResponseWindowMs,
  sessionChallengeRating,
} from '../difficulty';
import { generateStream } from '../generator';
import {
  COMMISSION_PENALTY,
  HOLD_SCORE,
  hitScore,
  normalizeVigilanceResult,
  perfectSessionScore,
} from '../scoring';
import { buildVigilanceRawResult } from '../session';
import { trialSlotMs, vigilanceGameReducer } from '../reducer';
import { INITIAL_STATS, createInitialVigilanceState } from '../types';
import type { VigilanceGameState, VigilanceStats } from '../types';

const NORMAL = VIGILANCE_DIFFICULTY_PARAMS.normal;
const EXPERT = VIGILANCE_DIFFICULTY_PARAMS.expert;
const SLOT_NORMAL = trialSlotMs(NORMAL.stimulusOnMs, NORMAL.isiMs); // 1250
const SLOT_ADAPTIVE = trialSlotMs(ADAPTIVE_PARAMS.stimulusOnMs, ADAPTIVE_PARAMS.isiMs); // 1150

/** Fresh intro state with `level` selected and a session started. */
function start(seed = 't', level: DifficultyLevel = 'normal'): VigilanceGameState {
  let s = createInitialVigilanceState();
  s = vigilanceGameReducer(s, { type: 'select-difficulty', level });
  return vigilanceGameReducer(s, {
    type: 'start-session',
    seed,
    sessionId: 'sess-1',
    startedAtMs: 100,
  });
}

const tick = (s: VigilanceGameState, atActiveMs: number): VigilanceGameState =>
  vigilanceGameReducer(s, { type: 'trial-tick', atActiveMs });

const respond = (s: VigilanceGameState, atActiveMs: number): VigilanceGameState =>
  vigilanceGameReducer(s, { type: 'respond', atActiveMs });

/** First index of a go (non-target) trial in the seeded stream. */
function firstGoIndex(seed: string, level: DifficultyLevel): number {
  const params = level === 'adaptive' ? ADAPTIVE_PARAMS : VIGILANCE_DIFFICULTY_PARAMS[level];
  const { trials } = generateStream(createRng(seed), params);
  const index = trials.findIndex((t) => !t.isTarget);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('response accounting', () => {
  it('records a GO hit with rt from active-ms deltas and speed-scored points', () => {
    const seed = 'hit-1';
    const goIndex = firstGoIndex(seed, 'normal');
    let s = start(seed);
    // Drive ticks up to onset+300 of the first trial (onset is 0).
    for (let at = 50; at <= 300; at += 50) {
      s = tick(s, at);
    }
    s = respond(s, 300);
    expect(s.outcome).toBe('hit');
    expect(s.responded).toBe(true);
    expect(s.responseRtMs).toBe(300);
    expect(s.stats.hits).toBe(1);
    expect(s.stats.reactions).toEqual([300]);
    expect(s.stats.bestReactionMs).toBe(300);
    expect(s.stats.streak).toBe(1);
    expect(s.stats.score).toBe(hitScore(300, NORMAL));
    // hitScore(300) with rtTarget 400 / rtFail 1000 → speedFactor clamps to 1 → 150.
    expect(s.stats.score).toBe(150);
    expect(s.trialElapsedMs).toBe(300);
  });

  it('suppresses a double-tap: the second respond is an exact no-op', () => {
    const seed = 'double-tap';
    firstGoIndex(seed, 'normal');
    let s = start(seed);
    for (let at = 50; at <= 200; at += 50) {
      s = tick(s, at);
    }
    s = respond(s, 200);
    const snapshot = s;
    s = respond(s, 210);
    s = respond(s, 400);
    expect(s).toEqual(snapshot);
    expect(Object.is(s, snapshot)).toBe(true); // identity-preserving guard
  });

  it('ignores taps during the feedback/ISI tail of a resolved trial', () => {
    const seed = 'isi-tap';
    firstGoIndex(seed, 'normal');
    let s = start(seed);
    s = respond(s, 150);
    s = tick(s, 900);
    expect(s.trialElapsedMs).toBe(900); // feedback tail keeps counting…
    const baseline = s;
    s = respond(s, 1000); // …but no further response can land
    expect(Object.is(s, baseline)).toBe(true);
  });

  it('accepts a tap one ms before the window closes and rejects one AT it', () => {
    const seed = 'boundary-tap';
    const { trials } = generateStream(createRng(seed), NORMAL);
    let s = start(seed);
    s = respond(s, NORMAL.responseWindowMs - 1); // 1199: inside by 1 ms
    expect(s.responded).toBe(true);
    expect(s.responseRtMs).toBe(NORMAL.responseWindowMs - 1);
    if (trials[0].isTarget) {
      // Tapping the stop digit: commission, floored straight to zero.
      expect(s.outcome).toBe('commission');
      expect(s.stats.score).toBe(0);
      expect(s.stats.commissions).toBe(1);
    } else {
      // Go hit at the last instant: speedFactor(1199) clamps to 0 → base score.
      expect(s.outcome).toBe('hit');
      expect(s.stats.score).toBe(100);
    }

    // Fresh run: a tap AT the boundary arrives after the window decided.
    let t = start(`${seed}-b`);
    for (let at = 100; at <= 1200; at += 100) {
      t = tick(t, at);
      if (t.outcome !== null) {
        break; // resolved as timeout at/below the boundary tick
      }
    }
    expect(t.outcome).not.toBeNull();
    const frozen = t;
    t = respond(t, NORMAL.responseWindowMs);
    expect(t).toEqual(frozen);
  });

  it('times out a go trial as omission and a target as correct-hold (+hold score)', () => {
    const seed = 'timeouts';
    const { trials } = generateStream(createRng(seed), NORMAL);
    let s = start(seed);
    for (let at = 100; at <= 1300 && s.phase === 'stream'; at += 100) {
      s = tick(s, at);
      if (s.outcome !== null) {
        break; // window decided — do not tick into the next trial
      }
    }
    expect(s.outcome).toBe(trials[0].isTarget ? 'correct-hold' : 'omission');
    expect(s.stats.trialsPlayed).toBe(1);
    if (trials[0].isTarget) {
      expect(s.stats.correctHolds).toBe(1);
      expect(s.stats.score).toBe(HOLD_SCORE);
    } else {
      expect(s.stats.omissions).toBe(1);
      expect(s.stats.score).toBe(0);
      expect(s.stats.streak).toBe(0);
    }
  });

  it('floors the running score at zero across commission chains', () => {
    const seed = 'commission-floor';
    const { trials } = generateStream(createRng(seed), NORMAL);
    let s = start(seed);
    let expectedScore = 0;
    let played = 0;
    for (const trial of trials.slice(0, 8)) {
      // Targets get tapped (+commission); go trials are withheld (timeout).
      const onset = s.trialStartActiveMs;
      if (trial.isTarget) {
        let at = onset + 100;
        s = respond(s, at);
        expectedScore = Math.max(0, expectedScore - COMMISSION_PENALTY);
      } else {
        let at = onset;
        while (s.phase === 'stream' && s.outcome === null) {
          at += 100;
          s = tick(s, at);
        }
        if (s.phase !== 'stream') {
          break;
        }
        expectedScore = Math.max(0, expectedScore + HOLD_SCORE * 0); // omission: +0
      }
      played += 1;
      // Advance through the slot tail into the next trial.
      while (s.phase === 'stream' && s.trialIndex < played) {
        s = tick(s, s.trialStartActiveMs + SLOT_NORMAL + 100);
      }
      if (s.phase !== 'stream') {
        break;
      }
      expect(s.stats.score).toBe(expectedScore);
    }
    expect(played).toBeGreaterThan(0);
  });
});

describe('monotonic lifecycle deltas only (no wall clock)', () => {
  it('clamps negative/pre-onset timestamps to a zero-length reaction', () => {
    const seed = 'rt-clamp';
    firstGoIndex(seed, 'normal');
    let s = start(seed);
    s = respond(s, -50);
    expect(s.outcome).toBe('hit'); // first trial is a go for this seed family… guarded below
    expect(s.responseRtMs).toBe(0);
    expect(s.stats.reactions).toEqual([0]);
    expect(s.stats.bestReactionMs).toBe(0);
    expect(s.stats.score).toBe(hitScore(0, NORMAL)); // fastest bucket: 150

    let z = start(`${seed}-zero`);
    z = respond(z, 0);
    expect(z.responseRtMs).toBe(0);
  });

  it('never lets a later action see elapsed beyond the slot (clamp on resolve)', () => {
    const seed = 'slot-clamp';
    let s = start(seed);
    // One huge jump past both window and slot:
    s = tick(s, 10_000);
    expect(s.outcome).not.toBeNull();
    expect(s.trialElapsedMs).toBe(SLOT_NORMAL); // min(elapsed, slot)
  });
});

describe('drift-free scheduled onsets', () => {
  it('advances to prevStart + slot exactly, and catches up after a stall', () => {
    const seed = 'cadence';
    let s = start(seed);
    expect(s.trialStartActiveMs).toBe(0);

    // Trial 0: window-end resolution at exactly 1200, then slot-end advance.
    s = tick(s, 1199);
    expect(s.outcome).toBeNull();
    s = tick(s, 1200);
    expect(s.outcome).not.toBeNull();
    s = tick(s, 1249);
    expect(s.trialIndex).toBe(0); // feedback tail still playing
    s = tick(s, 1250);
    expect(s.trialIndex).toBe(1);
    expect(s.trialStartActiveMs).toBe(Math.min(1250, 0 + SLOT_NORMAL)); // exactly scheduled

    // Trial 1: a tap lands right after the advance (new stimulus legitimately live).
    s = respond(s, 1255);
    expect(s.responseRtMs).toBe(5);

    // Stall: timers freeze for ~1.4 s mid-trial 2; the next onset must clamp
    // back onto the schedule instead of drifting forward forever.
    s = tick(s, 2600 - 1250); // 1350: unresolved yet? (window 1200 already passed → resolves)
    if (s.outcome === null) {
      s = tick(s, 1400);
    }
    expect(s.outcome).not.toBeNull();
    const advancedAt = 2500;
    s = tick(s, advancedAt);
    expect(s.trialStartActiveMs).toBe(Math.min(advancedAt, 1250 + SLOT_NORMAL)); // 2500, not 2500+
  });

  it('completes a full expert session (42 timeouts) under irregular ticks + a big stall', () => {
    const seed = 'marathon';
    let s = start(seed, 'expert');
    let at = 0;
    let guard = 0;
    while (s.phase === 'stream' && guard < 6000) {
      guard += 1;
      at += 97; // deliberately off-grid so boundaries are crossed unevenly
      s = tick(s, at);
      if (guard === 200) {
        at += 5_000; // debugger-style stall mid-session
      }
    }
    expect(s.phase).toBe('results');
    expect(s.stats.trialsPlayed).toBe(generateStream(createRng(seed), EXPERT).trials.length);
    expect(s.stats.hits).toBe(0);
    expect(s.stats.commissions).toBe(0);
  });
});

describe('pause/resume freezing semantics', () => {
  it('freezes mid-window exactly and resumes without losing or gaining time', () => {
    const seed = 'freeze-window';
    firstGoIndex(seed, 'normal');
    let s = start(seed);
    s = tick(s, 300);
    s = vigilanceGameReducer(s, { type: 'pause' });
    expect(s.paused).toBe(true);

    const frozen = s;
    // Wall time marches on; ticks carry stale/large active stamps but MUST be ignored.
    s = tick(s, 9_999);
    s = tick(s, 99_999);
    expect(s).toEqual(frozen);

    // Responds are blocked too.
    s = respond(s, 400);
    expect(s.paused).toBe(true);

    s = vigilanceGameReducer(s, { type: 'resume' });
    expect(s.paused).toBe(false);
    s = tick(s, 400);
    expect(s.trialElapsedMs).toBe(400); // active-ms only: 300 pre-pause + 100 post-resume
  });

  it('pauses during the feedback tail and still advances on schedule after resume', () => {
    const seed = 'freeze-feedback';
    firstGoIndex(seed, 'normal');
    let s = start(seed);
    s = respond(s, 200); // resolved; tail plays out
    s = vigilanceGameReducer(s, { type: 'pause' });
    s = tick(s, 8000);
    expect(s.trialIndex).toBe(0);
    s = vigilanceGameReducer(s, { type: 'resume' });
    s = tick(s, 1249);
    expect(s.trialIndex).toBe(0);
    s = tick(s, 1250);
    expect(s.trialIndex).toBe(1);
    expect(s.trialStartActiveMs).toBe(SLOT_NORMAL); // scheduled onset preserved
  });

  it('double-pauses idempotently and never re-opens finished sessions', () => {
    const seed = 'pause-idem';
    let s = start(seed);
    s = vigilanceGameReducer(s, { type: 'pause' });
    const once = s;
    s = vigilanceGameReducer(s, { type: 'pause' });
    expect(s).toEqual(once);

    const done = vigilanceGameReducer(start(`${seed}-r`), { type: 'qa/force-win' });
    expect(done.phase).toBe('results');
    expect(vigilanceGameReducer(done, { type: 'resume' })).toBe(done);
    expect(vigilanceGameReducer(done, { type: 'pause' })).toBe(done);
    expect(tick(done, 999_999)).toBe(done);
    expect(respond(done, 5)).toBe(done);
  });

  it('ignores gameplay actions in the intro phase', () => {
    const intro = createInitialVigilanceState();
    expect(vigilanceGameReducer(intro, { type: 'pause' })).toBe(intro);
    expect(tick(intro, 100)).toBe(intro);
    expect(respond(intro, 100)).toBe(intro);
  });
});

describe('adaptive response-window stepping', () => {
  /** Drive a whole adaptive session; capture the window in force per trial. */
  function driveAdaptive(
    seed: string,
    mode: 'all-clean' | 'omit-go',
  ): { windows: number[]; final: VigilanceGameState } {
    const { trials } = generateStream(createRng(seed), ADAPTIVE_PARAMS);
    let s = start(seed, 'adaptive');
    let now = 0;
    const windows: number[] = [];
    for (let i = 0; i < trials.length && s.phase === 'stream'; i += 1) {
      const onset = s.trialStartActiveMs;
      const cleanIntended = mode === 'all-clean' || trials[i].isTarget;
      if (mode === 'all-clean' && !trials[i].isTarget) {
        const mark = onset + 200;
        while (now < mark) {
          now = Math.min(mark, now + 50);
          s = tick(s, now);
        }
        s = respond(s, now);
      }
      // Play the trial out to its resolution + slot end.
      let guard = 0;
      while (s.phase === 'stream' && s.trialIndex === i && guard < 200) {
        guard += 1;
        now += 50;
        s = tick(s, now);
      }
      if (s.phase === 'stream') {
        windows.push(s.responseWindowMs);
      }
      void cleanIntended;
    }
    return { windows, final: s };
  }

  it('tightens by −100 per clean trial down to the 600 floor', () => {
    const seed = 'adapt-clean';
    const { windows, final } = driveAdaptive(seed, 'all-clean');
    expect(final.phase).toBe('results');
    expect(windows.length).toBeGreaterThan(4);
    // Independent iteration of the documented rule.
    let w = ADAPTIVE_PARAMS.responseWindowMs; // 1000
    const { trials } = generateStream(createRng(seed), ADAPTIVE_PARAMS);
    for (let i = 0; i < windows.length; i += 1) {
      w = nextResponseWindowMs(w, true, 'adaptive', ADAPTIVE_PARAMS);
      expect(windows[i]).toBe(w);
    }
    void trials;
    expect(windows[0]).toBe(900);
    expect(windows[1]).toBe(800);
    expect(windows[2]).toBe(700);
    expect(windows[3]).toBe(600);
    expect(Math.min(...windows)).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minResponseWindowMs ?? 0);
  });

  it('relaxes on errors and stays within [600, 1400] throughout', () => {
    const seed = 'adapt-relax';
    const { windows, final } = driveAdaptive(seed, 'omit-go');
    expect(final.phase).toBe('results');
    const { trials } = generateStream(createRng(seed), ADAPTIVE_PARAMS);
    let w = ADAPTIVE_PARAMS.responseWindowMs;
    for (let i = 0; i < windows.length; i += 1) {
      const clean = trials[i].isTarget; // omitted go = error; timed-out target = clean hold
      w = nextResponseWindowMs(w, clean, 'adaptive', ADAPTIVE_PARAMS);
      expect(windows[i]).toBe(w);
      expect(w).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minResponseWindowMs ?? 600);
      expect(w).toBeLessThanOrEqual(ADAPTIVE_PARAMS.maxResponseWindowMs ?? 1400);
    }
    expect(windows.some((x) => x > ADAPTIVE_PARAMS.responseWindowMs)).toBe(true);
  });

  it('resolves a relaxed window (> slot) at window end and catches the cadence up', () => {
    // State surgery: any reachable adaptive state may carry window > slot
    // (errors relax toward 1400 > slot 1150). The trial must NOT stick at the
    // slot end; it times out at the window end, then the next onset clamps.
    const seed = 'adapt-wide';
    const wide: VigilanceGameState = { ...start(seed, 'adaptive'), responseWindowMs: 1400 };
    let s = tick(wide, 1149);
    expect(s.outcome).toBeNull(); // still waiting — slot end alone decides nothing

    let resolvedAt = -1;
    for (let at = 1150; at <= 2000; at += 50) {
      s = tick(s, at);
      if (resolvedAt < 0 && s.outcome !== null) {
        resolvedAt = at;
        expect(at).toBeGreaterThanOrEqual(1400); // decided by the WINDOW, not the slot
        expect(s.trialElapsedMs).toBe(SLOT_ADAPTIVE); // clamped to the slot
      }
    }
    expect(resolvedAt).toBeGreaterThan(0);

    s = tick(s, resolvedAt + 50); // slot long past → immediate advance
    if (s.phase === 'stream') {
      expect(s.trialStartActiveMs).toBe(Math.min(resolvedAt + 50, 0 + SLOT_ADAPTIVE));
      expect(s.trialStartActiveMs).toBeLessThan(resolvedAt + 50); // caught up
    }
  });

  it('keeps fixed levels at a constant window and maps challenge ratings correctly', () => {
    expect(nextResponseWindowMs(1200, false, 'normal', NORMAL)).toBe(1200);
    expect(nextResponseWindowMs(1200, true, 'normal', NORMAL)).toBe(1200);

    const profiles = {
      easy: 0.2,
      normal: 0.5,
      hard: 0.8,
      expert: 0.95,
    } as const;
    for (const [level, rating] of Object.entries(profiles)) {
      const s = start('cr', level as DifficultyLevel);
      expect(s.profile?.challengeRating).toBe(rating);
      expect(
        sessionChallengeRating(level as DifficultyLevel, s.profile!, s.responseWindowMs),
      ).toBe(rating);
    }

    // Adaptive maps the final window linearly over [600, 1400], inverted.
    const adapt = start('cr-adapt', 'adaptive');
    expect(sessionChallengeRating('adaptive', adapt.profile!, 1000)).toBe(0.5); // neutral start
    expect(sessionChallengeRating('adaptive', adapt.profile!, 600)).toBe(1);
    expect(sessionChallengeRating('adaptive', adapt.profile!, 1400)).toBe(0);
    expect(sessionChallengeRating('adaptive', adapt.profile!, -5000)).toBe(1); // clamp low
    expect(sessionChallengeRating('adaptive', adapt.profile!, 99_999)).toBe(0); // clamp high
  });
});

describe('QA force paths (state shaping)', () => {
  it('force-win synthesizes a perfect deterministic run and normalizes to exactly 1', () => {
    const seed = 'qa-win';
    const started = start(seed);
    // Advance mid-stream first, then also verify it works while paused.
    let s = tick(started, 400);
    s = vigilanceGameReducer(s, { type: 'pause' });
    s = vigilanceGameReducer(s, { type: 'qa/force-win' });
    expect(s.phase).toBe('results');
    expect(s.forced).toBe(true);
    expect(s.paused).toBe(false); // overlay cannot linger over results

    const targets = s.stream.filter((t) => t.isTarget).length;
    const goTrials = s.stream.length - targets;
    expect(s.stats.trialsPlayed).toBe(s.stream.length);
    expect(s.stats.hits).toBe(goTrials);
    expect(s.stats.correctHolds).toBe(targets);
    expect(s.stats.commissions).toBe(0);
    expect(s.stats.omissions).toBe(0);
    expect(s.stats.hits + s.stats.omissions + s.stats.commissions + s.stats.correctHolds).toBe(
      s.stats.trialsPlayed,
    );
    expect(s.stats.score).toBe(perfectSessionScore(NORMAL, targets));
    expect(s.stats.reactions).toEqual(Array.from({ length: goTrials }, () => NORMAL.rtTargetMs));
    expect(s.stats.totalSpeed).toBe(goTrials);
    expect(s.stats.bestStreak).toBe(s.stream.length);

    // Round-trip through the real persistence pipeline:
    const raw = buildVigilanceRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      difficulty: 'normal',
      params: NORMAL,
      finalResponseWindowMs: s.responseWindowMs,
      challengeRating: sessionChallengeRating('normal', s.profile!, s.responseWindowMs),
      seed: s.seed,
      stopDigit: s.stopDigit,
      stats: s.stats,
      forced: s.forced,
      startedAtMs: s.startedAtMs ?? 0,
      activeDurationMs: 1234,
      pausedDurationMs: 0,
    });
    const normalized = normalizeVigilanceResult(raw, {
      gameId: 'attention-sustained-vigilance',
      difficulty: 'normal',
      durationMs: 1234,
    });
    expect(normalized.value).toBe(1);
  });

  it('force-lose synthesizes an all-fail run and normalizes to exactly 0', () => {
    const seed = 'qa-lose';
    const s = vigilanceGameReducer(tick(start(seed), 100), { type: 'qa/force-lose' });
    expect(s.phase).toBe('results');
    expect(s.forced).toBe(true);
    const targets = s.stream.filter((t) => t.isTarget).length;
    expect(s.stats.commissions).toBe(targets);
    expect(s.stats.omissions).toBe(s.stream.length - targets);
    expect(s.stats.hits).toBe(0);
    expect(s.stats.correctHolds).toBe(0);
    expect(s.stats.score).toBe(0);

    const raw = buildVigilanceRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      difficulty: 'normal',
      params: NORMAL,
      finalResponseWindowMs: s.responseWindowMs,
      challengeRating: 0.5,
      seed: s.seed,
      stopDigit: s.stopDigit,
      stats: s.stats,
      forced: true,
      startedAtMs: s.startedAtMs ?? 0,
      activeDurationMs: 50,
      pausedDurationMs: 0,
    });
    expect(
      normalizeVigilanceResult(raw, {
        gameId: 'attention-sustained-vigilance',
        difficulty: 'normal',
        durationMs: 50,
      }).value,
    ).toBe(0);
  });

  it('force actions are identity no-ops in intro and results', () => {
    const intro = createInitialVigilanceState();
    expect(vigilanceGameReducer(intro, { type: 'qa/force-win' })).toBe(intro);
    expect(vigilanceGameReducer(intro, { type: 'qa/force-lose' })).toBe(intro);

    const results = vigilanceGameReducer(start('q'), { type: 'qa/force-win' });
    expect(vigilanceGameReducer(results, { type: 'qa/force-win' })).toBe(results);
    expect(vigilanceGameReducer(results, { type: 'qa/force-lose' })).toBe(results);
  });

  it('force-state patches seeds/difficulty safely (intro-only, validated)', () => {
    let s = createInitialVigilanceState();
    s = vigilanceGameReducer(s, { type: 'qa/force-state', patch: { seed: 42 } });
    expect(s.seedOverride).toBe('42'); // numeric seeds stringify
    s = vigilanceGameReducer(createInitialVigilanceState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed' },
    });
    expect(s.seedOverride).toBe('qa-seed');

    s = vigilanceGameReducer(createInitialVigilanceState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'expert' },
    });
    expect(s.difficulty).toBe('expert');

    s = vigilanceGameReducer(createInitialVigilanceState(), {
      type: 'qa/force-state',
      // Negative probe: invalid level must be ignored (escape the union type).
      patch: { difficulty: 'nightmare' as unknown as DifficultyLevel },
    });
    expect(s.difficulty).toBe('normal'); // invalid level ignored

    s = vigilanceGameReducer(createInitialVigilanceState(), {
      type: 'qa/force-state',
      patch: { seed: 'x', nonsense: true },
    });
    expect(s.seedOverride).toBe('x'); // unknown keys dropped silently

    const mid = start('mid');
    const patched = vigilanceGameReducer(mid, {
      type: 'qa/force-state',
      patch: { seed: 'nope', difficulty: 'easy' },
    });
    expect(patched.seedOverride).toBeNull(); // mid-session: untouched
    expect(patched.difficulty).toBe('normal');
    expect(patched).toBe(mid); // identity no-op
  });
});

describe('replay determinism (scripted full sessions)', () => {
  /** Scripted playthrough: tap every go trial at onset+250; withhold on targets. */
  function scriptedRun(seed: string): VigilanceGameState {
    const { trials } = generateStream(createRng(seed), NORMAL);
    let s = start(`run-${seed}`);
    let now = 0;
    for (let i = 0; i < trials.length && s.phase === 'stream'; i += 1) {
      const onset = s.trialStartActiveMs;
      const mark = onset + 250;
      while (now < mark) {
        now = Math.min(mark, now + 50);
        s = tick(s, now);
      }
      if (!trials[i].isTarget && s.outcome === null) {
        s = respond(s, now);
      }
      const current = s.trialIndex;
      let guard = 0;
      while (s.phase === 'stream' && s.trialIndex === current && guard < 200) {
        guard += 1;
        now += 50;
        s = tick(s, now);
      }
    }
    return s;
  }

  it('two identical scripted runs end in deep-equal states', () => {
    const a = scriptedRun('determinism');
    const b = scriptedRun('determinism');
    expect(a.phase).toBe('results');
    expect(b.phase).toBe('results');
    expect(a).toEqual(b);
    expect(a.stats).toEqual(b.stats);
    expect(a.stats.reactions).toEqual(b.stats.reactions);
  });
});

describe('scoring monotonicity', () => {
  it('hitScore never increases with reaction time', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let rt = 0; rt <= 2000; rt += 50) {
      const value = hitScore(rt, NORMAL);
      expect(value).toBeLessThanOrEqual(prev);
      prev = value;
    }
    expect(hitScore(0, NORMAL)).toBe(150);
    expect(hitScore(2000, NORMAL)).toBe(100);
  });

  function statsWith(hits: number, omissions: number, correctHolds: number, speed: number): VigilanceStats {
    return {
      ...INITIAL_STATS,
      trialsPlayed: hits + omissions + correctHolds,
      hits,
      omissions,
      correctHolds,
      streak: hits + correctHolds,
      bestStreak: hits + correctHolds,
      reactions: Array.from({ length: hits }, () => 300),
      totalSpeed: hits * speed,
      bestReactionMs: hits > 0 ? 300 : null,
    };
  }

  function normalizedOf(stats: VigilanceStats): number {
    const raw = buildVigilanceRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      difficulty: 'normal',
      params: NORMAL,
      finalResponseWindowMs: NORMAL.responseWindowMs,
      challengeRating: 0.5,
      seed: 'mono',
      stopDigit: 3,
      stats,
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 1000,
      pausedDurationMs: 0,
    });
    return normalizeVigilanceResult(raw, {
      gameId: 'attention-sustained-vigilance',
      difficulty: 'normal',
      durationMs: 1000,
    }).value;
  }

  it('more hits at equal speed never normalize lower', () => {
    const better = normalizedOf(statsWith(26, 0, 4, 0.8));
    const worse = normalizedOf(statsWith(24, 2, 4, 0.8));
    expect(better).toBeGreaterThanOrEqual(worse);
    expect(normalizedOf(statsWith(26, 0, 4, 1))).toBe(1);
  });
});
