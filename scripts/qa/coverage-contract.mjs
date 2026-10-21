#!/usr/bin/env node
/**
 * coverage-contract.mjs — the Campaign 080 corrected native-coverage evidence
 * contract (contract version 2.0). Pure, deterministic, device-free.
 *
 * Motivation (independent review findings F-080-001..005):
 *  - F-080-001: Level 2 was awarded for attempted taps / Start presses while
 *    the game was still on its tutorial. "Action attempted" was conflated with
 *    "action succeeded".
 *  - F-080-002: safe exit was recorded unconditionally after sending Back.
 *  - F-080-003: the merger shallow-overwrote milestone objects instead of a
 *    logical OR, and could fabricate a journey that never happened in one run.
 *  - F-080-004: started/inputSubmitted/feedbackObserved/safeExit were recorded
 *    from action requests, not observed application transitions.
 *  - F-080-005: provenance (commit, APK, package, device, attempt, artifacts)
 *    was not bound to each execution attempt.
 *
 * This module separates three things the old harness conflated:
 *   1. ACTIONS   — what the harness requested/executed against the device.
 *   2. STATES    — what the application was observably doing, before and after.
 *   3. CAPABILITIES — what a coherent single execution attempt actually proved.
 *
 * Levels are DERIVED from proven capabilities only. Nothing in this module
 * talks to a device; it is exhaustively unit-testable, including with
 * deliberately false-positive historical fixtures (regression requirement).
 *
 * Exports (see JSDoc per symbol):
 *   CONTRACT_VERSION, GameStates, AxisStatus
 *   observeState(observation)            — raw hierarchy observation -> state
 *   stateFingerprint(observation)        — gameplay-meaningful change detector
 *   validateEvent(event)                 — structured evidence event contract
 *   validateRunRecord(record)            — full per-run provenance contract
 *   deriveCapabilities(record)           — evidence axes with statuses
 *   deriveLevel(record)                  — highest FULLY proven level
 *   or3(a, b)                            — real 3-valued logical OR
 *   classifyRun(record)                  — {level, status, axes, reasons}
 */
'use strict';

export const CONTRACT_VERSION = 'coverage-contract/2.0';

/** Observable application states for a game screen. */
export const GameStates = Object.freeze({
  INTRO: 'intro',
  TUTORIAL: 'tutorial',
  PLAYING: 'playing',
  RESULTS: 'results',
  EXITED: 'exited', // game screen absent, app destination observed
  LAUNCHER: 'launcher', // game screen absent, device home/launcher observed
  UNKNOWN: 'unknown',
});

/**
 * Status vocabulary for the evidence matrix (prompt §5):
 * ATTEMPTED / OBSERVED / VERIFIED / FAILED / BLOCKED / NOT EXECUTED.
 */
export const AxisStatus = Object.freeze({
  ATTEMPTED: 'ATTEMPTED',
  OBSERVED: 'OBSERVED',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  NOT_EXECUTED: 'NOT EXECUTED',
});

export const LEVEL_NAME = Object.freeze({
  0: 'no proven native smoke',
  1: 'verified native smoke',
  2: 'verified actual gameplay interaction',
  3: 'verified full-session lifecycle',
  4: 'verified resilience scenario',
});

// ---------------------------------------------------------------------------
// State observation
// ---------------------------------------------------------------------------

/**
 * Derive the observable application state from one hierarchy observation.
 *
 * @param {object} obs
 * @param {string[]} obs.controls  control suffixes under `gameId.` (e.g.
 *        'intro', 'start', 'stage', 'round.2', 'tutorial', 'results')
 * @param {string[]} [obs.screenMarkers] non-game screen markers observed
 *        (e.g. 'games-title', 'home-title', 'game-detail-...'), or the literal
 *        'launcher' when the device home/launcher is in front.
 * @param {string} obs.gameId      expected game identity
 * @param {string} [obs.observedGameId] identity parsed from the screen marker
 * @returns {{state: string, round: number|null, feedbackMarkers: string[],
 *            identityVerified: boolean, markers: string[]}}
 */
export function observeState(obs) {
  const controls = (obs && obs.controls) || [];
  const markers = (obs && obs.screenMarkers) || [];
  const gameId = (obs && obs.gameId) || '';
  const observedGameId = obs && obs.observedGameId;
  const identityVerified =
    !!gameId && observedGameId != null ? observedGameId === gameId : false;

  const has = (suffix) => controls.includes(suffix);
  const feedbackMarkers = controls.filter((c) =>
    /^(verdict|feedback|correct|incorrect|round-result|round-failed)/.test(c),
  );
  const roundControl = controls.find((c) => /^round\.\d+$/.test(c));
  const round = roundControl ? Number(roundControl.split('.')[1]) : null;

  let state = GameStates.UNKNOWN;
  const gamePresent = controls.length > 0 || (observedGameId != null && observedGameId === gameId);
  if (has('results') || has('result-facts')) state = GameStates.RESULTS;
  else if (has('tutorial')) state = GameStates.TUTORIAL;
  else if (
    has('pause') &&
    (has('stage') || has('round-result') || has('round-failed') || has('round-result-board') || feedbackMarkers.length > 0) &&
    !has('intro') && !has('start')
  )
    // An in-round feedback / verdict board (e.g. `round-result-board` +
    // `next-round`, no `stage`) is still the active gameplay session — treating
    // it as 'unknown' stalls round advancement and mislabels acceptance.
    state = GameStates.PLAYING;
  else if (has('intro') || has('start')) state = GameStates.INTRO;
  else if (!gamePresent && markers.includes('launcher')) state = GameStates.LAUNCHER;
  else if (!gamePresent && markers.length > 0) state = GameStates.EXITED;

  return { state, round, feedbackMarkers, identityVerified, markers };
}

/**
 * Gameplay-meaningful fingerprint of one observation, as a canonical STRING so
 * comparisons are by value. (A returned object would compare by reference and
 * silently report every observation pair as "changed" — the exact
 * action-attempted-as-action-succeeded bug class this contract exists to
 * prevent.) A changed fingerprint after an input action is the minimum
 * evidence that the application reacted; a successful `adb input tap` process
 * alone is never acceptance.
 */
export function stateFingerprint(obs) {
  const s = observeState(obs);
  return JSON.stringify({
    state: s.state,
    round: s.round,
    score: (obs && obs.score) != null ? String(obs.score) : null,
    feedback: [...s.feedbackMarkers].sort().join('|'),
    // control-text values the game exposes for the live board (e.g. word
    // assembly display). Volatile bounds are deliberately excluded.
    board: ((obs && obs.boardValues) || []).slice().sort(),
  });
}

export function fingerprintChanged(a, b) {
  return stateFingerprint(a) !== stateFingerprint(b);
}

// ---------------------------------------------------------------------------
// Structured evidence events
// ---------------------------------------------------------------------------

const EVENT_ACTIONS = ['deeplink', 'tap', 'back', 'key', 'type', 'wait'];

/**
 * Validate one structured evidence event (prompt §3.1). Returns a list of
 * error strings; empty means valid.
 */
export function validateEvent(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['event is not an object'];
  if (!EVENT_ACTIONS.includes(e.action)) errors.push(`bad action: ${e.action}`);
  for (const f of ['actionRequested', 'actionExecuted', 'executionAttemptId', 'timestamp']) {
    if (e[f] === undefined || e[f] === null) errors.push(`missing ${f}`);
  }
  if (e.actionExecuted !== true && e.actionExecuted !== false) errors.push('actionExecuted must be boolean');
  if (e.actionAcknowledged !== true && e.actionAcknowledged !== false && e.actionAcknowledged !== null) {
    errors.push('actionAcknowledged must be true/false/null');
  }
  if (e.transitionObserved !== undefined && typeof e.transitionObserved !== 'boolean') {
    errors.push('transitionObserved must be boolean when present');
  }
  if (e.transitionValid !== undefined && typeof e.transitionValid !== 'boolean') {
    errors.push('transitionValid must be boolean when present');
  }
  // An acknowledged action MUST name the observations that prove it.
  if (e.actionAcknowledged === true) {
    if (e.observationBeforeSeq === undefined || e.observationAfterSeq === undefined) {
      errors.push('acknowledged action must reference observationBeforeSeq/observationAfterSeq');
    } else if (!(e.observationAfterSeq > e.observationBeforeSeq)) {
      errors.push('observationAfterSeq must be greater than observationBeforeSeq');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Per-run record contract (provenance: F-080-005)
// ---------------------------------------------------------------------------

const REQUIRED_BUILD_FIELDS = ['gitSha', 'packageName', 'versionName', 'versionCode', 'apkSha256'];
const REQUIRED_DEVICE_FIELDS = ['serial', 'model', 'abi', 'display', 'density'];

/**
 * Validate one execution-attempt record. A run that fails provenance or
 * structure validation can never contribute a certified level.
 */
export function validateRunRecord(r) {
  const errors = [];
  const warnings = [];
  if (!r || typeof r !== 'object') return { valid: false, errors: ['run is not an object'], warnings };

  if (!r.executionAttemptId || typeof r.executionAttemptId !== 'string') errors.push('missing executionAttemptId');
  if (!r.gameId || typeof r.gameId !== 'string') errors.push('missing gameId');
  if (r.knownGameId === false) errors.push('unknown game id');
  if (!Array.isArray(r.events)) errors.push('missing events[]');
  if (!Array.isArray(r.observations)) errors.push('missing observations[]');

  const build = r.buildIdentity || {};
  for (const f of REQUIRED_BUILD_FIELDS) {
    if (build[f] === undefined || build[f] === null || build[f] === '') errors.push(`missing buildIdentity.${f}`);
  }
  const dev = r.deviceProfile || {};
  for (const f of REQUIRED_DEVICE_FIELDS) {
    if (dev[f] === undefined || dev[f] === null || dev[f] === '') errors.push(`missing deviceProfile.${f}`);
  }

  if (Array.isArray(r.events)) {
    const attemptIds = new Set();
    r.events.forEach((e, i) => {
      const errs = validateEvent(e);
      for (const err of errs) errors.push(`events[${i}]: ${err}`);
      if (e && e.executionAttemptId) attemptIds.add(e.executionAttemptId);
    });
    if (attemptIds.size > 1) errors.push('events span multiple executionAttemptIds (not one coherent attempt)');
    if (attemptIds.size === 1 && r.executionAttemptId && !attemptIds.has(r.executionAttemptId)) {
      errors.push('event executionAttemptId does not match run executionAttemptId');
    }
  }

  if (Array.isArray(r.observations)) {
    const seqs = r.observations.map((o) => o && o.seq);
    if (new Set(seqs).size !== seqs.length) errors.push('duplicate observation seq');
    r.observations.forEach((o, i) => {
      if (!o || typeof o !== 'object') { errors.push(`observations[${i}]: not an object`); return; }
      if (o.state !== undefined) {
        // Anti-spoofing: a claimed state must match what the raw controls and
        // screen markers actually show (F-080-004 — claims must be observations).
        const derived = observeState({ ...o, gameId: r.gameId }).state;
        if (derived !== o.state) errors.push(`observations[${i}]: claimed state '${o.state}' contradicts observed controls (derived '${derived}')`);
      }
      if (o.evidenceArtifact && typeof o.evidenceArtifact === 'object') {
        if (!o.evidenceArtifact.sha1) errors.push(`observations[${i}]: evidenceArtifact missing sha1`);
        if (o.evidenceArtifact.expectedSha1 && o.evidenceArtifact.expectedSha1 !== o.evidenceArtifact.sha1) {
          errors.push(`observations[${i}]: artifact hash mismatch`);
        }
      } else if (o.requireArtifact === true) {
        errors.push(`observations[${i}]: required evidence artifact missing`);
      }
    });
  }

  if (Array.isArray(r.artifacts)) {
    r.artifacts.forEach((a, i) => {
      if (!a || !a.sha1) errors.push(`artifacts[${i}]: missing sha1`);
      if (a && a.expectedSha1 && a.expectedSha1 !== a.sha1) errors.push(`artifacts[${i}]: artifact hash mismatch`);
    });
  }

  if (!r.startedAt) warnings.push('missing startedAt');
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Capability derivation (evidence axes)
// ---------------------------------------------------------------------------

function obsBySeq(record) {
  const m = new Map();
  for (const o of record.observations || []) m.set(o.seq, o);
  return m;
}

function axis(status, runIds, note, evidence) {
  return { status, runs: runIds ? [runIds] : [], note: note || '', evidence: evidence || [] };
}

/**
 * Derive the evidence axes strictly from one execution attempt. Every axis
 * names the observation/event sequences that prove it.
 */
export function deriveCapabilities(record) {
  const seqObs = obsBySeq(record);
  const events = [...(record.events || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const observations = [...(record.observations || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const attemptId = record.executionAttemptId;

  const states = observations.map((o) => ({ o, s: observeState({ ...o, gameId: record.gameId }) }));
  const firstState = (pred) => states.find((x) => pred(x.s, x.o));

  // -- launch / identity / render ------------------------------------------
  const identityObs = firstState((s) => s.identityVerified && s.state !== GameStates.UNKNOWN);
  const launchVerified = !!identityObs;
  const renderVerified =
    launchVerified &&
    (identityObs.o.controls || []).some((c) =>
      ['intro', 'start', 'stage', 'tutorial', 'help', 'results'].includes(c),
    );
  const axes = {
    launch: axis(launchVerified ? AxisStatus.VERIFIED : AxisStatus.ATTEMPTED, attemptId,
      launchVerified ? 'game identity observed on device' : 'no observation verifies game identity',
      identityObs ? [`obs#${identityObs.o.seq}`] : []),
    identity: axis(identityObs && identityObs.s.identityVerified ? AxisStatus.VERIFIED : AxisStatus.FAILED,
      attemptId, identityObs ? `observedGameId matches ${record.gameId}` : 'identity never established',
      identityObs ? [`obs#${identityObs.o.seq}`] : []),
    render: axis(renderVerified ? AxisStatus.VERIFIED : AxisStatus.ATTEMPTED, attemptId,
      renderVerified ? 'entry controls rendered' : 'render not proven',
      renderVerified ? [`obs#${identityObs.o.seq}`] : []),
  };

  // -- tutorial -------------------------------------------------------------
  const tutorialObs = firstState((s) => s.state === GameStates.TUTORIAL);
  const tutorialExit = events.find((e) => {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after) return false;
    const sb = observeState({ ...before, gameId: record.gameId }).state;
    const sa = observeState({ ...after, gameId: record.gameId }).state;
    return sb === GameStates.TUTORIAL && (sa === GameStates.INTRO || sa === GameStates.PLAYING);
  });
  axes.tutorialObserved = axis(tutorialObs ? AxisStatus.OBSERVED : AxisStatus.NOT_EXECUTED, attemptId,
    tutorialObs ? 'tutorial surface observed' : 'no tutorial observed',
    tutorialObs ? [`obs#${tutorialObs.o.seq}`] : []);
  axes.tutorialCompleted = axis(tutorialExit ? AxisStatus.VERIFIED : (tutorialObs ? AxisStatus.FAILED : AxisStatus.NOT_EXECUTED),
    attemptId,
    tutorialExit ? 'tutorial -> gameplay/intro transition observed' : (tutorialObs ? 'tutorial seen but never cleared in-run' : ''),
    tutorialExit ? [`evt#${tutorialExit.seq}`] : []);

  // -- gameplay entry -------------------------------------------------------
  const gameplayEntry = events.find((e) => {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after) return false;
    const sb = observeState({ ...before, gameId: record.gameId }).state;
    const sa = observeState({ ...after, gameId: record.gameId }).state;
    return (sb === GameStates.INTRO || sb === GameStates.TUTORIAL) && sa === GameStates.PLAYING;
  });
  const playingObs = states.filter((x) => x.s.state === GameStates.PLAYING);
  axes.gameplayEntered = axis(gameplayEntry ? AxisStatus.VERIFIED : AxisStatus.ATTEMPTED, attemptId,
    gameplayEntry
      ? 'intro/tutorial -> playing transition observed'
      : (playingObs.length ? 'playing state observed but no entry transition captured' : 'never observed in playing state'),
    gameplayEntry ? [`evt#${gameplayEntry.seq}`] : playingObs.map((x) => `obs#${x.o.seq}`));

  // -- input acceptance -----------------------------------------------------
  const playingInputEvents = events.filter((e) => {
    if (!['tap', 'type', 'key'].includes(e.action)) return false;
    const before = seqObs.get(e.observationBeforeSeq);
    return before && observeState({ ...before, gameId: record.gameId }).state === GameStates.PLAYING;
  });
  const accepted = playingInputEvents.filter((e) => {
    if (e.actionAcknowledged !== true || e.transitionValid !== true) return false;
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    return before && after && stateFingerprint(before) !== stateFingerprint(after);
  });
  axes.inputAttempted = axis(playingInputEvents.length ? AxisStatus.ATTEMPTED : AxisStatus.NOT_EXECUTED, attemptId,
    playingInputEvents.length ? 'gameplay input requested+executed' : 'no gameplay input attempted',
    playingInputEvents.map((e) => `evt#${e.seq}`));
  axes.inputAccepted = axis(accepted.length ? AxisStatus.VERIFIED : (playingInputEvents.length ? AxisStatus.FAILED : AxisStatus.NOT_EXECUTED),
    attemptId,
    accepted.length ? 'input produced an observed gameplay state change' : (playingInputEvents.length ? 'input executed but no application response observed' : ''),
    accepted.map((e) => `evt#${e.seq}`));

  // -- feedback (must be NEW after an in-playing input) ----------------------
  let feedback = null;
  for (const e of playingInputEvents) {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after) continue;
    const fbBefore = new Set(observeState({ ...before, gameId: record.gameId }).feedbackMarkers);
    const fbAfter = observeState({ ...after, gameId: record.gameId }).feedbackMarkers;
    const fresh = fbAfter.filter((f) => !fbBefore.has(f));
    if (fresh.length) { feedback = { e, fresh, after }; break; }
  }
  axes.feedbackObserved = axis(feedback ? AxisStatus.VERIFIED : AxisStatus.NOT_EXECUTED, attemptId,
    feedback ? `new feedback after input: ${feedback.fresh.join(', ')}` : 'no post-input feedback transition observed',
    feedback ? [`evt#${feedback.e.seq}`, `obs#${feedback.after.seq}`] : []);

  // -- round advancement ----------------------------------------------------
  let roundAdvanced = null;
  for (const e of playingInputEvents) {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after) continue;
    const rb = observeState({ ...before, gameId: record.gameId }).round;
    const ra = observeState({ ...after, gameId: record.gameId }).round;
    if (rb != null && ra != null && ra > rb) { roundAdvanced = { from: rb, to: ra, e }; break; }
  }
  axes.roundAdvanced = axis(roundAdvanced ? AxisStatus.VERIFIED : AxisStatus.NOT_EXECUTED, attemptId,
    roundAdvanced ? `round ${roundAdvanced.from} -> ${roundAdvanced.to}` : 'no round counter increase observed',
    roundAdvanced ? [`evt#${roundAdvanced.e.seq}`] : []);

  // -- input-independent (passive/timed) gameplay events --------------------
  let autonomous = null;
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const cur = states[i];
    if (prev.s.state !== GameStates.PLAYING || cur.s.state !== GameStates.PLAYING) continue;
    const inputBetween = playingInputEvents.some((e) => e.observationBeforeSeq >= prev.o.seq && e.observationAfterSeq <= cur.o.seq);
    if (inputBetween) continue;
    if (stateFingerprint(prev.o) !== stateFingerprint(cur.o)) { autonomous = { prev: prev.o, cur: cur.o }; break; }
  }
  axes.autonomousGameplayEvent = axis(autonomous ? AxisStatus.VERIFIED : AxisStatus.NOT_EXECUTED, attemptId,
    autonomous ? 'gameplay progressed without input (timed/passive contract)' : 'no input-independent progression observed',
    autonomous ? [`obs#${autonomous.prev.seq}->obs#${autonomous.cur.seq}`] : []);

  // -- session end / results currency --------------------------------------
  const sessionEnd = events.find((e) => {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after) return false;
    return (
      observeState({ ...before, gameId: record.gameId }).state === GameStates.PLAYING &&
      observeState({ ...after, gameId: record.gameId }).state === GameStates.RESULTS
    );
  });
  const resultsObs = firstState((s) => s.state === GameStates.RESULTS);
  // A results surface reached by an event whose transition is unproven is
  // ATTEMPTED; nothing results-shaped in-run is NOT EXECUTED. sessionEnded is
  // never VERIFIED without the playing -> results transition itself.
  const resultsReachedEvent = events.find((e) => {
    const after = seqObs.get(e.observationAfterSeq);
    return after && observeState({ ...after, gameId: record.gameId }).state === GameStates.RESULTS;
  });
  const lastPlaying = playingObs.length ? playingObs[playingObs.length - 1] : null;
  // Results are CURRENT only when they follow a playing observation in the same
  // attempt (a results screen shown at launch is stale previous-session data).
  const resultsCurrent = !!(
    resultsObs && lastPlaying && resultsObs.o.seq > lastPlaying.o.seq &&
    states.every((x) => !(x.o.seq > lastPlaying.o.seq && x.o.seq < resultsObs.o.seq &&
      (x.s.state === GameStates.EXITED || x.s.state === GameStates.LAUNCHER || x.s.state === GameStates.UNKNOWN)))
  );
  const lastObs = states.length ? states[states.length - 1] : null;
  const interruptedWhilePlaying = !!(lastObs && lastObs.s.state === GameStates.PLAYING);
  axes.sessionEnded = axis(
    sessionEnd ? AxisStatus.VERIFIED
      : (resultsReachedEvent || interruptedWhilePlaying ? AxisStatus.ATTEMPTED : AxisStatus.NOT_EXECUTED),
    attemptId,
    sessionEnd ? 'playing -> results transition observed in-run'
      : (resultsReachedEvent ? 'a results surface was reached but the playing -> results transition was not proven'
        : (interruptedWhilePlaying ? 'run interrupted while still in gameplay — session end attempted, never proven' : 'no results surface reached in-run')),
    sessionEnd ? [`evt#${sessionEnd.seq}`] : []);
  axes.resultsCurrent = axis(resultsCurrent ? AxisStatus.VERIFIED : (resultsObs ? AxisStatus.FAILED : AxisStatus.NOT_EXECUTED),
    attemptId,
    resultsCurrent ? 'results follow this session\'s gameplay' : (resultsObs ? 'results screen observed but not attributable to this session' : ''),
    resultsCurrent && resultsObs ? [`obs#${resultsObs.o.seq}`] : []);

  // -- safe exit (F-080-002: proven by post-action observation) -------------
  // Any deliberate exit-intent action counts (Back, or the app's real exit
  // controls: pause-overlay quit, intro-back), but ONLY a post-action
  // observation of the destination proves the exit.
  const EXIT_TARGET_RE = /(^|[.\-])(quit|intro-back|exit|discard|end-session)([.\-]|$)/;
  const safeExit = events.find((e) => {
    if (e.action !== 'back' && !EXIT_TARGET_RE.test(e.target || '')) return false;
    const after = seqObs.get(e.observationAfterSeq);
    if (!after) return false;
    const sa = observeState({ ...after, gameId: record.gameId });
    return sa.state === GameStates.EXITED || sa.state === GameStates.LAUNCHER;
  });
  const backAttempted = events.some((e) =>
    (e.action === 'back' || EXIT_TARGET_RE.test(e.target || '')) && e.actionExecuted);
  axes.safeExit = axis(safeExit ? AxisStatus.VERIFIED : (backAttempted ? AxisStatus.FAILED : AxisStatus.NOT_EXECUTED),
    attemptId,
    safeExit ? 'post-Back observation shows the game screen was left (destination observed)' : (backAttempted ? 'Back executed but exit destination never observed' : ''),
    safeExit ? [`evt#${safeExit.seq}`] : []);

  // -- resilience subcapabilities (independent; may union across runs) ------
  for (const key of ['backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition']) {
    const claimed = (record.resilience && record.resilience[key]) || null;
    if (!claimed) axes[key] = axis(AxisStatus.NOT_EXECUTED, attemptId, '', []);
    else if (claimed.verified === true && claimed.evidence && claimed.evidence.length) {
      axes[key] = axis(AxisStatus.VERIFIED, attemptId, claimed.note || '', claimed.evidence);
    } else axes[key] = axis(AxisStatus.ATTEMPTED, attemptId, claimed.note || 'attempted, not verified', claimed.evidence || []);
  }

  return axes;
}

// ---------------------------------------------------------------------------
// Level derivation
// ---------------------------------------------------------------------------

const V = (axes, name) => axes[name] && axes[name].status === AxisStatus.VERIFIED;

/**
 * Pure level ladder over derived axes. Used by deriveLevel() for certification
 * and, labelled explicitly, by the historical reclassifier to report the
 * EVIDENCE DEPTH of legacy records that predate the provenance contract.
 * Depth is never certification: a run can show L2-deep evidence and still be
 * uncertifiable for provenance (F-080-005).
 */
export function deriveLevelFromAxes(axes) {
  const reasons = [];
  const resilienceVerified = ['backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition']
    .filter((k) => V(axes, k));
  const l3 = V(axes, 'gameplayEntered') && V(axes, 'sessionEnded') && V(axes, 'resultsCurrent');
  const l2input = V(axes, 'inputAccepted') || V(axes, 'autonomousGameplayEvent');
  const l2response = V(axes, 'feedbackObserved') || V(axes, 'roundAdvanced') || V(axes, 'sessionEnded');
  const l2 = V(axes, 'gameplayEntered') && l2input && l2response;
  const l1 = V(axes, 'launch') && V(axes, 'identity') && V(axes, 'render') && V(axes, 'safeExit');

  if (resilienceVerified.length && l3) {
    reasons.push(`resilience verified: ${resilienceVerified.join(', ')}`);
    return { level: 4, status: 'VERIFIED', reasons };
  }
  if (l3) {
    reasons.push('gameplay entered, session terminated, results attributable to this session');
    return { level: 3, status: 'VERIFIED', reasons };
  }
  if (l2) {
    reasons.push('gameplay entered and an accepted input or autonomous event produced observable progression');
    return { level: 2, status: 'VERIFIED', reasons };
  }
  if (l1) {
    reasons.push('launch, identity, render and verified safe exit');
    return { level: 1, status: 'VERIFIED', reasons };
  }
  // Explain precisely what blocks the next level (truthful downgrade notes).
  if (V(axes, 'launch') && V(axes, 'identity') && V(axes, 'render')) {
    reasons.push('smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination');
    return { level: 0, status: 'PARTIAL', reasons };
  }
  if (V(axes, 'launch')) {
    reasons.push('launched but render/identity not proven');
    return { level: 0, status: 'PARTIAL', reasons };
  }
  reasons.push('no trustworthy native smoke evidence');
  return { level: 0, status: 'FAILED', reasons };
}

/**
 * Highest FULLY proven level for a single execution attempt. A run that fails
 * provenance/structure validation is never certified, whatever its depth.
 * Partial progress toward the next level is reported separately, never
 * promoted.
 */
export function deriveLevel(record) {
  const checks = validateRunRecord(record);
  const axes = deriveCapabilities(record);
  if (!checks.valid) {
    return { level: 0, status: 'FAILED', axes, reasons: [`run record invalid: ${checks.errors.join('; ')}`] };
  }
  return { ...deriveLevelFromAxes(axes), axes };
}

export function classifyRun(record) {
  const d = deriveLevel(record);
  return { ...d, validation: validateRunRecord(record) };
}

// ---------------------------------------------------------------------------
// 3-valued logical OR (F-080-003): true > false > undefined/unknown
// ---------------------------------------------------------------------------

/**
 * Real boolean OR over tri-state evidence. `null`/`undefined` = not observed.
 * Preserves "unknown" rather than silently coercing it to false or true.
 */
export function or3(a, b) {
  const norm = (v) => (v === true ? true : v === false ? false : null);
  const [x, y] = [norm(a), norm(b)];
  if (x === true || y === true) return true;
  if (x === false && y === false) return false;
  return null;
}
