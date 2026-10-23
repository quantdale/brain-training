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

import crypto from 'node:crypto';
import { allowsPassiveTerminal, gameMetadata, hasPassiveRoundEvent } from './gameplay-policy.mjs';

export const CONTRACT_VERSION = 'coverage-contract/2.1';

const ISO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/** RFC-3339 timestamp profile: full date/time, seconds, and explicit zone. */
export function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_TIMESTAMP_RE.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!daysInMonth || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function observedGameIdFromHierarchy(controlIds) {
  if (!Array.isArray(controlIds)) return null;
  const ids = new Set();
  for (const controlId of controlIds) {
    if (typeof controlId !== 'string') continue;
    const dot = controlId.indexOf('.');
    const candidate = dot < 0 ? controlId : controlId.slice(0, dot);
    if (gameMetadata(candidate)) ids.add(candidate);
  }
  return ids.size === 1 ? [...ids][0] : null;
}

const TUTORIAL_STATE_SQL = 'SELECT game_id, completed, replay_requested, version, updated_at FROM tutorial_state WHERE game_id = ?';

function observedSessionToken(observation, gameId) {
  const prefix = `${gameId}.session-token.`;
  const tokens = (Array.isArray(observation?.hierarchyControlIds) ? observation.hierarchyControlIds : [])
    .filter((resourceId) => typeof resourceId === 'string' && resourceId.startsWith(prefix))
    .map((resourceId) => resourceId.slice(prefix.length));
  return tokens.length === 1 && tokens[0].length > 0 &&
    observation.controls?.includes(`session-token.${tokens[0]}`) ? tokens[0] : null;
}

function observationHasCapturedHierarchy(observation) {
  const artifact = observation?.hierarchyArtifact;
  return !!(artifact && artifact.kind === ArtifactKind.HIERARCHY &&
    artifact.executionAttemptId === observation.executionAttemptId &&
    artifact.observationSeq === observation.seq &&
    artifact.observationTimestamp === observation.timestamp &&
    artifact.captureReceipt?.file && artifact.captureReceipt?.sha256);
}

function tutorialEvidenceRow(record) {
  const evidence = record?.tutorialStateEvidence;
  if (!evidence || evidence.schemaVersion !== 1 || evidence.executionAttemptId !== record.executionAttemptId ||
      evidence.gameId !== record.gameId || evidence.observationSeq !== 0 ||
      !isIsoTimestamp(evidence.observationTimestamp) || evidence.capturedAt !== evidence.observationTimestamp ||
      (Array.isArray(record.observations) && record.observations.some((observation) => observation?.seq === evidence.observationSeq))) return null;
  const query = evidence.query;
  const row = query?.row;
  if (query?.table !== 'tutorial_state' || query?.sql !== TUTORIAL_STATE_SQL || query?.where?.game_id !== record.gameId ||
      !Array.isArray(query?.columns) || query.columns.join(',') !== 'game_id,completed,replay_requested,version,updated_at') return null;
  if (row !== null && (!row || row.game_id !== record.gameId || ![0, 1].includes(row.completed) ||
      ![0, 1].includes(row.replay_requested) || (row.version !== null && typeof row.version !== 'string') ||
      !Number.isSafeInteger(row.updated_at))) return null;
  const artifact = evidence.artifact;
  if (!artifact || artifact.kind !== ArtifactKind.TUTORIAL_STATE || artifact.executionAttemptId !== record.executionAttemptId ||
      artifact.observationSeq !== evidence.observationSeq || artifact.observationTimestamp !== evidence.observationTimestamp ||
      !artifact.file || !/^[a-f0-9]{64}$/i.test(artifact.sha256 || '') ||
      artifact.captureReceipt?.file == null || !/^[a-f0-9]{64}$/i.test(artifact.captureReceipt.sha256 || '')) return null;
  const indexedArtifact = Array.isArray(record.artifacts)
    ? record.artifacts.find((item) => item?.file === artifact.file && item?.sha256 === artifact.sha256)
    : null;
  if (!indexedArtifact || indexedArtifact.kind !== ArtifactKind.TUTORIAL_STATE ||
      indexedArtifact.executionAttemptId !== artifact.executionAttemptId ||
      indexedArtifact.observationSeq !== artifact.observationSeq || indexedArtifact.observationTimestamp !== artifact.observationTimestamp ||
      indexedArtifact.captureReceipt?.file !== artifact.captureReceipt.file ||
      indexedArtifact.captureReceipt?.sha256 !== artifact.captureReceipt.sha256) return null;
  return row;
}


/** SHA-256 over real artifact bytes (P1-C). */
export function createSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

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
  const controls = Array.isArray(obs?.controls) ? obs.controls.filter((c) => typeof c === 'string') : [];
  const markers = Array.isArray(obs?.screenMarkers) ? obs.screenMarkers : [];
  const gameId = (obs && obs.gameId) || '';
  const observedGameId = obs && obs.observedGameId;
  const hierarchyGameId = observedGameIdFromHierarchy(obs?.hierarchyControlIds);
  const identityVerified = !!gameId && observedGameId === gameId && hierarchyGameId === gameId;
  const screenKind = screenKindOf(obs);

  const has = (suffix) => controls.includes(suffix);
  const feedbackMarkers = controls.filter((c) =>
    /^(verdict|feedback|correct|incorrect|round-result|round-failed)/.test(c),
  );
  const roundControl = controls.find((c) => /^round\.\d+$/.test(c));
  const round = roundControl ? Number(roundControl.split('.')[1]) : null;
  // Timed-expiry markers are gameplay-meaningful: a round/stimulus timeout is a
  // real transition and MUST show up in the change detector, otherwise an
  // autonomous expiry inside a tap window looks like "nothing happened".
  const timeoutMarkers = controls.filter((c) => TIMEOUT_MARKER_RE.test(c));

  let state = GameStates.UNKNOWN;
  switch (screenKind) {
    // Proven non-game, non-destination surfaces. These are never an exit: a
    // failed dump, a system/permission dialog drawn over the game, or a crash
    // must not be read as successful navigation (P1-B).
    case ScreenKind.HIERARCHY_FAILURE:
    case ScreenKind.ADB_FAILURE:
    case ScreenKind.CRASH:
    case ScreenKind.SYSTEM_DIALOG:
    case ScreenKind.PERMISSION_DIALOG:
    case ScreenKind.UNKNOWN:
      state = GameStates.UNKNOWN;
      break;
    case ScreenKind.LAUNCHER:
      state = GameStates.LAUNCHER;
      break;
    case ScreenKind.APP_DESTINATION:
      state = GameStates.EXITED;
      break;
    case ScreenKind.GAME_SCREEN:
    default: {
      const gamePresent = controls.length > 0 || (observedGameId != null && observedGameId === gameId);
      if (!gamePresent) { state = GameStates.UNKNOWN; break; }
      if (has('results') || has('result-facts')) state = GameStates.RESULTS;
      else if (controls.some((c) => /(^|[.-])(tutorial|demo)([.-]|$)/i.test(c))) state = GameStates.TUTORIAL;
      else if (
        has('pause') &&
        (has('stage') || has('round-result') || has('round-failed') || has('round-result-board') || feedbackMarkers.length > 0) &&
        !has('intro') && !has('start')
      )
        // An in-round feedback / verdict board (e.g. `round-result-board` +
        // `next-round`, no `stage`) is still the active gameplay session —
        // treating it as 'unknown' stalls round advancement and mislabels
        // acceptance.
        state = GameStates.PLAYING;
      else if (has('intro') || has('start')) state = GameStates.INTRO;
      else state = GameStates.PLAYING;
      break;
    }
  }

  return { state, round, feedbackMarkers, timeoutMarkers, identityVerified, markers, screenKind };
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
    // A timeout/expiry surface is a distinct gameplay state (P1-A).
    timeout: [...(s.timeoutMarkers || [])].sort().join('|'),
    // control-text values the game exposes for the live board (e.g. word
    // assembly display). Volatile bounds are deliberately excluded.
    board: ((obs && obs.boardValues) || []).slice().sort(),
  });
}

export function fingerprintChanged(a, b) {
  return stateFingerprint(a) !== stateFingerprint(b);
}

// ---------------------------------------------------------------------------
// Screen classification (P1-B)
//
// A missing or malformed hierarchy is NOT evidence of successful navigation.
// The v1/v2 harness emitted `non-game-app-screen` whenever a `uiautomator dump`
// parsed to zero game controls — which includes a transient dump FAILURE and a
// system dialog drawn over the game — and `observeState` mapped that straight
// to EXITED, so a failed Back plus a failed dump "proved" a safe exit.
//
// Exit destinations must now be PROVEN by foreground-window identity plus a
// successfully parsed hierarchy plus a live process. Unknown/unparseable is
// never a destination.
// ---------------------------------------------------------------------------

export const ScreenKind = Object.freeze({
  GAME_SCREEN: 'game-screen',
  APP_DESTINATION: 'app-destination', // app foreground, game screen left
  LAUNCHER: 'launcher',
  SYSTEM_DIALOG: 'system-dialog',
  PERMISSION_DIALOG: 'permission-dialog',
  CRASH: 'crash',
  HIERARCHY_FAILURE: 'hierarchy-failure',
  ADB_FAILURE: 'adb-failure',
  UNKNOWN: 'unknown',
});

/** Screen kinds that may EVER be credited as a navigation destination. */
export const DESTINATION_SCREEN_KINDS = Object.freeze([ScreenKind.APP_DESTINATION]);

const LAUNCHER_PACKAGES = new Set([
  'com.android.launcher', 'com.android.launcher3',
  'com.google.android.apps.nexuslauncher', 'com.sec.android.app.launcher',
  'com.miui.home', 'com.huawei.android.launcher', 'com.oppo.launcher',
]);
const PERMISSION_PACKAGES = new Set([
  'com.android.permissioncontroller', 'com.google.android.permissioncontroller',
]);
const SYSTEM_DIALOG_PACKAGES = new Set(['com.android.systemui', 'android', 'com.android.phone']);

/**
 * Classify what the device is actually showing, from proven harness signals.
 *
 * @param {object} input
 * @param {string} [input.expectedPackage] application package under test
 * @param {string} [input.focusPackage] foreground window package (dumpsys window)
 * @param {'ok'|'empty'|'malformed'|'adb-failure'} [input.hierarchyStatus]
 * @param {number} [input.controlCount] parsed game-control count
 * @param {boolean} [input.appAlive] process liveness (pidof). Only consulted
 *        when the app is EXPECTED to be running: an app that has not been
 *        launched yet is not a crash.
 */
export function deriveScreenKind(input) {
  const {
    expectedPackage, focusPackage, hierarchyStatus, controlCount = 0, appAlive,
  } = input || {};
  if (hierarchyStatus === 'adb-failure') return ScreenKind.ADB_FAILURE;
  if (hierarchyStatus !== 'ok') return ScreenKind.HIERARCHY_FAILURE;
  // A dead process cannot be showing a live game screen: any controls parsed in
  // that situation are stale, so liveness outranks the control inventory.
  if (appAlive === false) return ScreenKind.CRASH;
  // Parsed game controls are direct proof the game screen is rendered. The
  // foreground-focus probe is only a SECONDARY signal: on an emulator the app
  // can be running and rendering while the window manager reports the launcher
  // as focused, so focus must never be allowed to override observed controls.
  if (controlCount > 0) return ScreenKind.GAME_SCREEN;
  if (!focusPackage) return ScreenKind.UNKNOWN;
  // `dumpsys window` reports a COMPONENT (`package/activity`), not a bare
  // package name. Comparing the raw token against the package silently never
  // matched, so every genuine app destination fell through to UNKNOWN and safe
  // exits could not be proven. Compare the package portion only.
  const focusPkg = String(focusPackage).split('/')[0];
  if (expectedPackage && focusPkg === expectedPackage && appAlive === true) return ScreenKind.APP_DESTINATION;
  if (LAUNCHER_PACKAGES.has(focusPkg)) return ScreenKind.LAUNCHER;
  if (PERMISSION_PACKAGES.has(focusPkg)) return ScreenKind.PERMISSION_DIALOG;
  if (SYSTEM_DIALOG_PACKAGES.has(focusPkg)) return ScreenKind.SYSTEM_DIALOG;
  return ScreenKind.UNKNOWN;
}

/**
 * Backward-compatible screen-kind derivation from a raw observation.
 *
 * NOTE the deliberate change: a bare `non-game-app-screen` marker (which the
 * harness used to emit on ANY zero-control parse, including dump failure) is
 * UNKNOWN, never a destination. Only an explicit `app-destination` marker —
 * emitted by the harness with foreground-identity proof — may be an exit.
 */
function screenKindOf(obs) {
  const m = Array.isArray(obs?.screenMarkers) ? obs.screenMarkers : [];
  // Negative raw facts outrank a cached screenKind, including dialogs drawn
  // over a still-mounted game. Positive labels alone prove nothing.
  if (m.includes('adb-failure')) return ScreenKind.ADB_FAILURE;
  if (m.includes('hierarchy-failure') || m.includes('malformed-hierarchy')) return ScreenKind.HIERARCHY_FAILURE;
  if (m.includes('crash') || m.includes('app-crashed')) return ScreenKind.CRASH;
  if (m.includes('permission-dialog')) return ScreenKind.PERMISSION_DIALOG;
  if (m.includes('system-dialog')) return ScreenKind.SYSTEM_DIALOG;
  const controlCount = Array.isArray(obs?.controls) ? obs.controls.length : 0;
  if (obs?.rawScreen) return deriveScreenKind({ ...obs.rawScreen, controlCount });
  if (m.includes('launcher')) return ScreenKind.LAUNCHER;
  if (controlCount > 0) return ScreenKind.GAME_SCREEN;
  return ScreenKind.UNKNOWN;
}

// ---------------------------------------------------------------------------
// Causal attribution (P1-A)
//
// The prior contract credited a tap as "accepted input" whenever the gameplay
// fingerprint differed between the observation before and after it. That
// attributes AUTONOMOUS transitions to the nearest preceding tap: in
// `language-word-chain` a tap on `chain-word.2` was certified as accepted input
// while the actual observed change was a ROUND TIMEOUT.
//
// A fingerprint difference alone is therefore never sufficient. Certification
// of input acceptance requires an ATTRIBUTABLE signal bound to the tapped
// control or to an explicit answer acknowledgment, and no competing autonomous
// marker in the same observation window.
// ---------------------------------------------------------------------------

export const CausalityVerdict = Object.freeze({
  INPUT_ACCEPTED: 'INPUT_ACCEPTED',
  AUTONOMOUS_TIMEOUT: 'AUTONOMOUS_TIMEOUT',
  AUTONOMOUS_PROGRESSION: 'AUTONOMOUS_PROGRESSION',
  AMBIGUOUS_CAUSALITY: 'AMBIGUOUS_CAUSALITY',
  NO_RESPONSE: 'NO_RESPONSE',
});

/** Controls that mark an autonomous timed expiry (not an answer). */
export const TIMEOUT_MARKER_RE =
  /(^|[.\-])(timeout|time-?up|times-?up|expired|expiry|countdown-zero|round-timeout|streak-expired|time-remaining-zero|missed|trial-missed|trial-timeout)([.\-]|$)/i;

/**
 * Controls that mark an explicit answer verdict. `round-answer-reveal`,
 * `round-result-board` and `trial-wrong` are deliberately EXCLUDED: a reveal or
 * a shared `trial-wrong` vocabulary can be produced by an unanswered timeout as
 * well as by an answered trial (see the speed-color-match observation-vocabulary
 * conflation), so they cannot by themselves prove that an input was received.
 *
 * NOTE (Campaign 080 P2-B5, now closed app-side): `speed-color-match` used to
 * emit `trial-wrong` for BOTH an incorrect colour and an expired stimulus. It
 * now emits three distinct ids — `trial-correct` / `trial-wrong` /
 * `trial-missed` — so `trial-missed` is a genuine timeout signal and is listed
 * in TIMEOUT_MARKER_RE, while `trial-wrong` remains ambiguous for evidence from
 * OLDER builds that still conflated them. `trial-wrong` is therefore kept in
 * AMBIGUOUS_FEEDBACK_RE: the contract must stay correct for archived evidence.
 */
export const ANSWER_FEEDBACK_RE =
  /(^|[.\-])(verdict-correct|verdict-wrong|verdict-incorrect|feedback-correct|feedback-wrong|feedback-incorrect|answer-correct|answer-incorrect|correct-answer|wrong-answer|trial-correct|trial-accepted)([.\-]|$)/i;

/** Outcome vocabulary that is ambiguous between "answered wrong" and "missed". */
export const AMBIGUOUS_FEEDBACK_RE =
  /(^|[.\-])(trial-wrong|round-answer-reveal|answer-reveal|round-result-board|round-result|round-failed)([.\-]|$)/i;

const delta = (a, b) => {
  const na = Number.parseFloat(String((a && a.score) ?? ''));
  const nb = Number.parseFloat(String((b && b.score) ?? ''));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return null;
  return nb - na;
};

/** Text identity of one named control, or null when the control is absent. */
function controlIdentity(obs, suffix) {
  const c = ((obs && obs.controlDetails) || {})[suffix];
  if (!c) return null;
  return `${c.text ?? ''}|${c.desc ?? ''}`;
}

/**
 * Classify the causal relationship between one input command and the state
 * change observed across its before/after window.
 *
 * @param {object} args
 * @param {string} [args.target] tapped/typed control suffix (e.g. 'chain-word.2')
 * @param {object} args.before observation before the command
 * @param {object} args.after observation after the command
 * @param {string} [args.action] 'tap' | 'type' | 'key' | ...
 * @param {boolean} [args.actionExecuted] whether the command was PROVEN
 *        executed. INPUT_ACCEPTED requires this to be exactly `true` — a
 *        missing/unset value is unproven and fails closed (P1-1/NF-080-001).
 * @param {boolean|null} [args.actionAcknowledged] explicit `false` rejects
 *        attribution even when `actionExecuted` is true.
 * @returns {{verdict: string, outcome: string|null, signals: string[], note: string}}
 */
export function classifyInputCausality({ target, before, after, action, actionExecuted, actionAcknowledged } = {}) {
  const signals = [];
  if (!before || !after) {
    return { verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY, outcome: null, signals, note: 'before/after observation missing — causality unprovable' };
  }

  // Target-control identity change is computed FIRST: the tapped control
  // changing (or vanishing) is itself a state change even when the coarse
  // gameplay fingerprint is unchanged.
  let targetChanged = false;
  if (target) {
    const bi = controlIdentity(before, target);
    const ai = controlIdentity(after, target);
    targetChanged = bi !== null && (ai === null || ai !== bi);
    const bval = ((before.boardValues || []).find((v) => v.startsWith(`${target}=`)) || null);
    const aval = ((after.boardValues || []).find((v) => v.startsWith(`${target}=`)) || null);
    if (bval !== aval && (bval !== null || aval !== null)) targetChanged = true;
  }

  if (!fingerprintChanged(before, after) && !targetChanged) {
    return { verdict: CausalityVerdict.NO_RESPONSE, outcome: null, signals: ['no-state-change'], note: 'application state did not change' };
  }
  signals.push('state-changed');
  if (targetChanged) signals.push('target-control-changed');
  else if (target) signals.push('target-control-unchanged');

  const sb = observeState({ ...before, gameId: before.gameId || '' });
  const sa = observeState({ ...after, gameId: after.gameId || '' });

  // Autonomous timed expiry in the window.
  const timeoutBefore = (sb.feedbackMarkers || []).some((c) => TIMEOUT_MARKER_RE.test(c)) ||
    (before.controls || []).some((c) => TIMEOUT_MARKER_RE.test(c));
  const timeoutAfter = (after.controls || []).some((c) => TIMEOUT_MARKER_RE.test(c));
  const freshTimeout = timeoutAfter && !timeoutBefore;
  if (freshTimeout) signals.push('autonomous-timeout-marker');

  const scoreDelta = delta(before, after);
  if (scoreDelta) signals.push(`score-delta:${scoreDelta}`);

  const freshControls = (after.controls || []).filter((c) => !(before.controls || []).includes(c));
  const answerFb = freshControls.filter((c) => ANSWER_FEEDBACK_RE.test(c));
  const ambiguousFb = freshControls.filter((c) => AMBIGUOUS_FEEDBACK_RE.test(c));
  if (answerFb.length) signals.push(`answer-feedback:${answerFb.join(',')}`);
  if (ambiguousFb.length) signals.push(`ambiguous-feedback:${ambiguousFb.join(',')}`);

  const roundBefore = sb.round;
  const roundAfter = sa.round;
  const roundAdvanced = roundBefore != null && roundAfter != null && roundAfter > roundBefore;
  if (roundAdvanced) signals.push(`round-advance:${roundBefore}->${roundAfter}`);

  // --- verdict -----------------------------------------------------------
  // A competing autonomous timeout inside the window makes attribution
  // impossible: the window contains BOTH a possible response and a timed
  // expiry. Never certify such a window as accepted input (P1-A).
  if (freshTimeout) {
    if (targetChanged || scoreDelta || answerFb.length) {
      return {
        verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY,
        outcome: null,
        signals,
        note: 'input response and autonomous timeout share one observation window — causality ambiguous',
      };
    }
    return {
      verdict: CausalityVerdict.AUTONOMOUS_TIMEOUT,
      outcome: null,
      signals,
      note: 'observed change is a timed expiry, not an input response',
    };
  }

  const attributable = targetChanged || scoreDelta || answerFb.length;
  if (attributable) {
    // P1-1 / NF-080-001 invariant: an action-caused milestone may only be
    // attributed to a command that was PROVEN executed. `actionExecuted` must
    // be exactly `true` (unknown/missing counts as unproven and fails closed)
    // and the command must not have been explicitly un-acknowledged. A failed
    // tap with a coincidental score/feedback change is coincidence (or an
    // autonomous transition), NEVER accepted input.
    const executionProven = actionExecuted === true && actionAcknowledged !== false;
    if (!executionProven) {
      return {
        verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY,
        outcome: null,
        signals: [...signals, 'command-execution-unproven'],
        note: `command not proven executed (actionExecuted=${actionExecuted === undefined ? 'missing' : String(actionExecuted)}, actionAcknowledged=${actionAcknowledged === undefined ? 'missing' : String(actionAcknowledged)}) — the observed change is autonomous/coincidental, never accepted input`,
      };
    }
    // Only an answer-family action may be credited through answer feedback;
    // a `back`/`wait` command that happens to sit in front of a verdict surface
    // is coincidental, not causal.
    const answerFamilyAction = action == null || ['tap', 'type', 'key'].includes(action);
    if (!answerFamilyAction && !targetChanged && !scoreDelta) {
      return {
        verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY,
        outcome: null,
        signals,
        note: `non-answer action '${action}' coincident with an answer verdict surface`,
      };
    }
    let outcome = null;
    if (answerFb.some((c) => /(correct|accepted)/i.test(c))) outcome = 'correct';
    else if (answerFb.some((c) => /(wrong|incorrect)/i.test(c))) outcome = 'incorrect';
    else if (ambiguousFb.length) outcome = 'unknown';
    return {
      verdict: CausalityVerdict.INPUT_ACCEPTED,
      outcome,
      signals,
      note: 'state change is attributable to the issued input',
    };
  }

  if (answerFb.length === 0 && ambiguousFb.length) {
    return {
      verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY,
      outcome: null,
      signals,
      note: 'verdict surface is ambiguous between answered-wrong and missed stimulus',
    };
  }
  if (roundAdvanced) {
    return {
      verdict: CausalityVerdict.AUTONOMOUS_PROGRESSION,
      outcome: null,
      signals,
      note: 'round advanced without an attributable input response',
    };
  }
  return {
    verdict: CausalityVerdict.AMBIGUOUS_CAUSALITY,
    outcome: null,
    signals,
    note: 'fingerprint changed but no signal attributes the change to this input',
  };
}

// ---------------------------------------------------------------------------
// Artifact integrity policy (P1-C)
//
// `requireArtifact` was previously never set by the real sweep and
// `expectedSha1` was never written, so the hash-mismatch check could not fire
// on real data and "every proof is bound to an artifact hash" was an
// overstatement. Certification-critical observations now REQUIRE a real
// artifact, and verification independently re-reads the artifact bytes.
// ---------------------------------------------------------------------------

export const ArtifactKind = Object.freeze({
  SCREENSHOT: 'screenshot',
  HIERARCHY: 'hierarchy',
  EVENT_TRACE: 'event-trace',
  DEVICE_STATE: 'device-state',
  FOREGROUND_IDENTITY: 'foreground-identity',
  BUILD_PROVENANCE: 'build-provenance',
  TUTORIAL_STATE: 'tutorial-state',
});

/**
 * Observation phases whose evidence MUST be bound to a real artifact. The
 * sweep sets `requireArtifact: true` on these; `validateRunRecord` enforces it.
 */
export const ARTIFACT_REQUIRED_PHASES = Object.freeze([
  'pre-launch', 'launch', 'terminal', 'exit',
]);

/**
 * Capabilities that may not be certified without at least one bound artifact of
 * the listed kinds.
 */
export const CAPABILITY_ARTIFACT_REQUIREMENTS = Object.freeze({
  launch: [ArtifactKind.SCREENSHOT, ArtifactKind.HIERARCHY],
  identity: [ArtifactKind.HIERARCHY],
  gameplayEntry: [ArtifactKind.HIERARCHY],
  sessionEnd: [ArtifactKind.SCREENSHOT, ArtifactKind.HIERARCHY],
  safeExit: [ArtifactKind.HIERARCHY],
});

/** True when an observation must carry a verifiable evidence artifact. */
export function observationRequiresArtifact(obs) {
  if (!obs) return false;
  if (obs.requireArtifact === true) return true;
  return ARTIFACT_REQUIRED_PHASES.includes(obs.phase);
}

/**
 * Independent artifact digest verification.
 *
 * `selfAsserted` is what the capturing harness recorded. `actual` is computed
 * HERE from the real bytes on disk. The two must agree — a self-asserted hash
 * is never "verified" merely by comparing two values copied out of the same
 * untrusted record (the dead `expectedSha1 !== sha1` check).
 *
 * @param {object} artifact  {file, sha256, bytes, kind, executionAttemptId}
 * @param {Buffer} actualBytes  bytes independently read from artifact.file
 * @returns {{ok: boolean, problems: string[], computedSha256: string|null}}
 */
export function verifyArtifactBytes(artifact, actualBytes) {
  const problems = [];
  const notes = [];
  if (!artifact || typeof artifact !== 'object') return { ok: false, problems: ['artifact is not an object'], notes, computedSha256: null, grade: 'none' };
  if (!Buffer.isBuffer(actualBytes)) return { ok: false, problems: ['artifact bytes unavailable'], notes, computedSha256: null, grade: 'none' };
  const computedSha256 = createSha256(actualBytes);

  if (artifact.sha256) {
    if (artifact.sha256 !== computedSha256) {
      problems.push(`artifact sha256 mismatch: recorded ${artifact.sha256} computed ${computedSha256}`);
    }
    if (artifact.bytes != null && artifact.bytes !== actualBytes.length) {
      problems.push(`artifact byte length mismatch: recorded ${artifact.bytes} actual ${actualBytes.length}`);
    }
    return { ok: problems.length === 0, problems, notes, computedSha256, grade: 'sha256' };
  }

  // Legacy records (Campaign 080 contract 2.0 historical sweeps) recorded a
  // SHA-1. It is still recomputed FROM REAL BYTES — a legacy digest verified
  // against the artifact is real evidence; it is simply graded lower than
  // SHA-256 and is explicitly labelled so it can never be presented as modern
  // content verification.
  if (artifact.sha1) {
    const computedSha1 = crypto.createHash('sha1').update(actualBytes).digest('hex');
    if (artifact.sha1 !== computedSha1) {
      problems.push(`artifact sha1 mismatch: recorded ${artifact.sha1} computed ${computedSha1}`);
    }
    notes.push('verified against a LEGACY SHA-1 digest (pre SHA-256 artifact policy); not modern content verification');
    return { ok: problems.length === 0, problems, notes, computedSha256, computedSha1, grade: 'sha1-legacy' };
  }

  problems.push('artifact has no recorded digest (neither sha256 nor sha1) — nothing to verify against');
  return { ok: false, problems, notes, computedSha256, grade: 'none' };
}

/** One complete numeric score, optionally labelled Score (not parseFloat's prefix). */
export function exactScore(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = /^(?:Score\s*:?\s*)?(-?\d+(?:\.\d+)?)$/i.exec(value.trim());
  return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
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
  if (e.actionRequested !== true && e.actionRequested !== false) errors.push('actionRequested must be boolean');
  if (!Number.isInteger(e.seq) || e.seq < 0) errors.push('seq must be a nonnegative integer');
  if (!isIsoTimestamp(e.timestamp)) errors.push('timestamp must be an ISO-8601/RFC-3339 string with seconds and an explicit timezone');
  if (e.actionExecuted !== true && e.actionExecuted !== false) errors.push('actionExecuted must be boolean');
  if (e.actionRequested === false && e.actionExecuted === true) errors.push('an unrequested action cannot be executed');
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
/**
 * Validate one execution-attempt record. A run that fails provenance or
 * structure validation can never contribute a certified level.
 *
 * @param {object} r
 * @param {object} [opts]
 * @param {Set<string>|string[]} [opts.knownGames] AUTHORITATIVE game id registry.
 *        When supplied, a game id that is not in it can never certify (B1) —
 *        `knownGameId` is a caller-supplied flag and is not trusted on its own.
 * @param {'local'|'portable'|'source'} [opts.evidenceMode]
 *        'local'   — runtime certification: artifacts must be present and hash
 *                    to their recorded digest (used against a live checkout).
 *        'portable'— artifacts may be absent (gitignored native evidence is not
 *                    in a fresh checkout); structural binding is still required
 *                    and absence is reported as NOT VERIFIABLE, never a pass.
 *        'source'  — fixture/source testing: artifact presence is advisory.
 */
export function validateRunRecord(r, opts = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const evidenceMode = opts.evidenceMode || 'portable';
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    return { valid: false, errors: ['run is not an object'], warnings, notes };
  }

  if (!r.executionAttemptId || typeof r.executionAttemptId !== 'string') errors.push('missing executionAttemptId');
  if (!r.gameId || typeof r.gameId !== 'string') errors.push('missing gameId');
  // B1: the caller's `knownGameId` flag is not evidence. When an authoritative
  // registry is supplied, membership is checked against it.
  if (opts.knownGames) {
    const registry = opts.knownGames instanceof Set ? opts.knownGames : new Set(opts.knownGames);
    if (typeof r.gameId === 'string' && !registry.has(r.gameId)) {
      errors.push(`unknown game id '${r.gameId}' — not present in the authoritative game registry`);
    }
  } else if (r.knownGameId === false) {
    errors.push('unknown game id');
    notes.push('knownGameId was checked against a caller-supplied flag only — no authoritative registry provided');
  }
  if (!Array.isArray(r.events)) errors.push('missing events[]');
  if (!Array.isArray(r.observations)) errors.push('missing observations[]');
  if (r.artifacts !== undefined && !Array.isArray(r.artifacts)) errors.push('artifacts must be an array when present');

  const canonicalGame = gameMetadata(r.gameId);
  if (!canonicalGame) errors.push(`game id '${r.gameId}' has no authoritative game.json metadata`);
  if (r.hasTutorial !== undefined && typeof r.hasTutorial !== 'boolean') errors.push('hasTutorial must be boolean when present');
  if (canonicalGame && r.hasTutorial !== undefined && r.hasTutorial !== canonicalGame.hasTutorial) {
    errors.push(`hasTutorial contradicts authoritative game.json for '${r.gameId}'`);
  }
  if (r.tutorialState !== undefined) errors.push('legacy tutorialState booleans are unverified; use receipt-indexed tutorialStateEvidence');
  if (r.tutorialStateEvidence !== undefined && r.tutorialStateEvidence !== null && !tutorialEvidenceRow(r)) {
    errors.push('tutorialStateEvidence must bind an actual game-specific SQLite row to an attempt-bound receipt-indexed artifact');
  }
  if (Array.isArray(r.observations)) {
    for (const [i, o] of r.observations.entries()) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) { errors.push(`observations[${i}]: not an object`); continue; }
      for (const field of ['controls', 'screenMarkers', 'boardValues', 'hierarchyControlIds']) {
        if ((field === 'controls' || field === 'screenMarkers' || o[field] !== undefined) &&
            (!Array.isArray(o[field]) || o[field].some((v) => typeof v !== 'string'))) {
          errors.push(`observations[${i}]: ${field} must be a string array`);
        }
      }
      if (o.observedGameId !== undefined && o.observedGameId !== null && typeof o.observedGameId !== 'string') {
        errors.push(`observations[${i}]: observedGameId must be a string or null`);
      }
      if (o.controlDetails !== undefined && (!o.controlDetails || typeof o.controlDetails !== 'object' || Array.isArray(o.controlDetails))) errors.push(`observations[${i}]: invalid controlDetails`);
      if (o.observedGameId !== undefined && observedGameIdFromHierarchy(o.hierarchyControlIds) !== o.observedGameId) {
        errors.push(`observations[${i}]: observedGameId is not backed by the acquired hierarchy resource ids`);
      }
      if (o.observedGameId && Array.isArray(o.hierarchyControlIds)) {
        const hierarchyControls = new Set(o.hierarchyControlIds.flatMap((resourceId) => {
          const prefix = `${o.observedGameId}.`;
          return typeof resourceId === 'string' && resourceId.startsWith(prefix) ? [resourceId.slice(prefix.length)] : [];
        }));
        for (const control of o.controls || []) {
          if (!hierarchyControls.has(control)) errors.push(`observations[${i}]: control '${control}' is not backed by the acquired hierarchy resource ids`);
        }
      }
      if (o.rawScreen !== undefined) {
        const raw = o.rawScreen;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) errors.push(`observations[${i}]: invalid rawScreen`);
        else {
          if (typeof raw.expectedPackage !== 'string' || !raw.expectedPackage) errors.push(`observations[${i}]: rawScreen.expectedPackage missing`);
          if (raw.focusPackage !== undefined && typeof raw.focusPackage !== 'string') errors.push(`observations[${i}]: rawScreen.focusPackage must be a string`);
          if (!['ok', 'empty', 'malformed', 'adb-failure'].includes(raw.hierarchyStatus)) errors.push(`observations[${i}]: invalid rawScreen.hierarchyStatus`);
          if (raw.appAlive !== undefined && typeof raw.appAlive !== 'boolean') errors.push(`observations[${i}]: rawScreen.appAlive must be boolean`);
        }
      }
      if (o.hierarchyArtifact !== undefined && (!o.hierarchyArtifact || typeof o.hierarchyArtifact !== 'object' || Array.isArray(o.hierarchyArtifact))) {
        errors.push(`observations[${i}]: invalid hierarchyArtifact`);
      }
    }
  }
  if (errors.length) return { valid: false, errors, warnings, notes, boundArtifactCount: 0 };

  const parseTimestamp = (value, field) => {
    if (!isIsoTimestamp(value)) {
      errors.push(`${field} must be an ISO-8601/RFC-3339 string with seconds and an explicit timezone`);
      return null;
    }
    return Date.parse(value);
  };
  const startedMs = r.startedAt === undefined ? null : parseTimestamp(r.startedAt, 'startedAt');
  const endedMs = r.endedAt === undefined ? null : parseTimestamp(r.endedAt, 'endedAt');
  if (startedMs !== null && endedMs !== null && endedMs < startedMs) errors.push('endedAt predates startedAt');

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
      if (e && typeof e === 'object' && e.executionAttemptId) attemptIds.add(e.executionAttemptId);
    });
    if (attemptIds.size > 1) errors.push('events span multiple executionAttemptIds (not one coherent attempt)');
    if (attemptIds.size === 1 && r.executionAttemptId && !attemptIds.has(r.executionAttemptId)) {
      errors.push('event executionAttemptId does not match run executionAttemptId');
    }
  }

  const observationsBySeq = new Map(r.observations.map((o) => [o.seq, o]));
  const tutorialEvidence = r.tutorialStateEvidence;
  if (tutorialEvidence && tutorialEvidenceRow(r)) {
    const nextObservation = r.observations.filter((observation) => observation.seq > tutorialEvidence.observationSeq)
      .sort((a, b) => a.seq - b.seq)[0];
    const endTime = nextObservation?.timestamp || r.endedAt;
    const captureTime = Date.parse(tutorialEvidence.capturedAt);
    if (startedMs !== null && captureTime < startedMs) errors.push('tutorialStateEvidence.capturedAt predates attempt');
    if (endTime && captureTime > Date.parse(endTime)) errors.push('tutorialStateEvidence.capturedAt follows its bound observation interval');
    if (!endTime) errors.push('tutorialStateEvidence has no next observation or run end to bound capture time');
  }
  for (const [kind, list] of [['events', r.events], ['observations', r.observations]]) {
    let previousSeq = -1;
    let previousTime = -Infinity;
    for (const [i, item] of list.entries()) {
      if (!item || typeof item !== 'object') continue;
      if (!Number.isInteger(item.seq) || item.seq < 0 || item.seq <= previousSeq) errors.push(`${kind}[${i}]: seq must be unique and strictly ordered`);
      previousSeq = item.seq;
      const time = Date.parse(item.timestamp);
      if (!Number.isFinite(time) || time < previousTime) errors.push(`${kind}[${i}]: timestamp invalid or out of order`);
      previousTime = time;
      if (r.startedAt && time < Date.parse(r.startedAt)) errors.push(`${kind}[${i}]: timestamp predates attempt`);
      if (r.endedAt && time > Date.parse(r.endedAt)) errors.push(`${kind}[${i}]: timestamp follows attempt`);
    }
  }
  for (const [i, e] of r.events.entries()) {
    if (!e || typeof e !== 'object') continue;
    const before = observationsBySeq.get(e.observationBeforeSeq);
    const after = observationsBySeq.get(e.observationAfterSeq);
    if (e.observationBeforeSeq !== undefined || e.observationAfterSeq !== undefined || e.actionAcknowledged === true) {
      if (!before || !after || !(after.seq > before.seq)) errors.push(`events[${i}]: broken or reversed observation references`);
    }
  }

  let boundArtifactCount = 0;
  if (Array.isArray(r.observations)) {
    const seqs = r.observations.map((o) => (o && typeof o === 'object' ? o.seq : undefined));
    const seen = new Set();
    seqs.forEach((s, i) => {
      if (s === undefined || s === null) { errors.push(`observations[${i}]: missing seq`); return; }
      if (seen.has(s)) errors.push(`observations[${i}]: duplicate observation seq ${s}`);
      seen.add(s);
    });
    const acquiredArtifactOwners = new Map();
    r.observations.forEach((o, i) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) { errors.push(`observations[${i}]: not an object`); return; }
      // Observation provenance: time and phase must identify the acquired frame.
      if (!isIsoTimestamp(o.timestamp)) errors.push(`observations[${i}]: timestamp must be strict ISO-8601/RFC-3339`);
      if (!o.phase) warnings.push(`observations[${i}]: missing phase`);
      if (o.state !== undefined) {
        // Anti-spoofing: a claimed state must match what the raw controls and
        // screen markers actually show (F-080-004 — claims must be observations).
        const derived = observeState({ ...o, gameId: r.gameId }).state;
        if (derived !== o.state) errors.push(`observations[${i}]: claimed state '${o.state}' contradicts observed controls (derived '${derived}')`);
      }
      // --- artifact binding (P1-C) -------------------------------------
      const required = observationRequiresArtifact(o);
      const observationArtifacts = [
        ['evidenceArtifact', o.evidenceArtifact],
        ['hierarchyArtifact', o.hierarchyArtifact],
      ].filter(([, artifact]) => artifact !== undefined && artifact !== null);
      const seenObservationArtifacts = new Set();
      const seenObservationReceipts = new Map();
      for (const [field, art] of observationArtifacts) {
        if (!art || typeof art !== 'object' || Array.isArray(art)) {
          errors.push(`observations[${i}]: ${field} must be an artifact object`);
          continue;
        }
        const key = `${art.file || ''}\0${art.sha256 || art.sha1 || ''}`;
        if (!seenObservationArtifacts.has(key)) boundArtifactCount++;
        seenObservationArtifacts.add(key);
        for (const binding of [art.file, art.captureReceipt?.file].filter(Boolean)) {
          const priorSequence = acquiredArtifactOwners.get(binding);
          if (priorSequence !== undefined && priorSequence !== o.seq) {
            errors.push(`observations[${i}]: acquired artifact or receipt '${binding}' is replayed across observations`);
          } else acquiredArtifactOwners.set(binding, o.seq);
        }
        const priorReceiptArtifact = seenObservationReceipts.get(art.captureReceipt?.file);
        if (priorReceiptArtifact !== undefined && priorReceiptArtifact !== key) {
          errors.push(`observations[${i}]: distinct artifact acquisitions must have distinct capture receipts`);
        } else seenObservationReceipts.set(art.captureReceipt?.file, key);
        if (!art.sha256 && !art.sha1) errors.push(`observations[${i}]: ${field} missing digest`);
        if (typeof art.file !== 'string' || !art.file) errors.push(`observations[${i}]: ${field} missing file binding`);
        if (art.kind && !Object.values(ArtifactKind).includes(art.kind)) {
          errors.push(`observations[${i}]: unknown artifact kind '${art.kind}'`);
        }
        if (field === 'hierarchyArtifact' && art.kind !== ArtifactKind.HIERARCHY) {
          errors.push(`observations[${i}]: hierarchyArtifact must have kind '${ArtifactKind.HIERARCHY}'`);
        }
        if (art.executionAttemptId !== r.executionAttemptId) {
          errors.push(`observations[${i}]: artifact belongs to a different execution attempt`);
        }
        if (art.observationSeq !== o.seq || art.observationTimestamp !== o.timestamp) {
          errors.push(`observations[${i}]: ${field} must bind this observation sequence and timestamp`);
        }
        if (art.captureReceipt === undefined) errors.push(`observations[${i}]: ${field} must have its own capture receipt`);
        if (art.captureReceipt !== undefined &&
            (!art.captureReceipt || typeof art.captureReceipt !== 'object' || Array.isArray(art.captureReceipt) ||
             typeof art.captureReceipt.file !== 'string' || !art.captureReceipt.file ||
             !/^[a-f0-9]{64}$/i.test(art.captureReceipt.sha256 || ''))) {
          errors.push(`observations[${i}]: ${field}.captureReceipt must bind a receipt file and sha256`);
        }
        // A self-asserted digest is never "verified" by comparing two values
        // copied from the same record. Hash equality is checked independently
        // by the artifact verifier against real file bytes.
        if (evidenceMode === 'local' && art.sha256 && art.verifiedSha256 && art.verifiedSha256 !== art.sha256) {
          errors.push(`observations[${i}]: artifact hash mismatch (recorded ${art.sha256} != independently computed ${art.verifiedSha256})`);
        }
      }
      if (!observationArtifacts.length && required) {
        if (evidenceMode === 'local') errors.push(`observations[${i}]: required evidence artifact missing`);
        else {
          warnings.push(`observations[${i}]: required evidence artifact missing`);
          notes.push(`observations[${i}]: artifact not verifiable in '${evidenceMode}' mode — this observation is not portable certified evidence`);
        }
      }
    });
  }

  if (Array.isArray(r.artifacts)) {
    r.artifacts.forEach((a, i) => {
      if (!a || typeof a !== 'object' || Array.isArray(a)) { errors.push(`artifacts[${i}]: not an object`); return; }
      if (!a.sha256 && !a.sha1) errors.push(`artifacts[${i}]: missing digest`);
      if (!a.file) errors.push(`artifacts[${i}]: missing file binding`);
      if (!a.captureReceipt || typeof a.captureReceipt !== 'object' || Array.isArray(a.captureReceipt) ||
          typeof a.captureReceipt.file !== 'string' || !a.captureReceipt.file ||
          !/^[a-f0-9]{64}$/i.test(a.captureReceipt.sha256 || '')) {
        errors.push(`artifacts[${i}]: captureReceipt must bind a receipt file and sha256`);
      }
      if (a.executionAttemptId !== r.executionAttemptId) {
        errors.push(`artifacts[${i}]: artifact belongs to a different execution attempt`);
      }
      if (!Number.isInteger(a.observationSeq) || !isIsoTimestamp(a.observationTimestamp)) {
        errors.push(`artifacts[${i}]: artifact must bind an observation sequence and strict timestamp`);
      }
    });
  }

  // Certification-critical observations must be artifact-bound at least once.
  if (boundArtifactCount === 0 && (r.observations || []).length > 0) {
    if (evidenceMode === 'local') errors.push('no observation carries a verifiable evidence artifact — no certified evidence');
    else {
      warnings.push('no observation carries a verifiable evidence artifact');
      notes.push(`no portable certified evidence in '${evidenceMode}' mode`);
    }
  }

  if (!r.startedAt) warnings.push('missing startedAt');
  return { valid: errors.length === 0, errors, warnings, notes, boundArtifactCount };
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
 * P1-1 / NF-080-001 invariant: an action-caused milestone may only be
 * attributed to a command that was PROVEN executed (`actionExecuted === true`,
 * and not explicitly un-acknowledged). A missing/unknown execution flag is
 * unproven and fails closed. Transitions observed across unexecuted commands
 * are passive/autonomous coincidences — they are represented as autonomous
 * events (`autonomousGameplayEvent`), never as accepted input or as an
 * action-attributed milestone.
 */
const eventSucceeded = (e) => !!e && e.actionExecuted === true && e.actionAcknowledged !== false;

/**
 * Derive the evidence axes strictly from one execution attempt. Every axis
 * names the observation/event sequences that prove it.
 */
export function deriveCapabilities(record) {
  const validation = validateRunRecord(record);
  if (!validation.valid) {
    return Object.fromEntries(['launch', 'identity', 'render', 'tutorialObserved', 'tutorialCompleted', 'tutorialStatus',
      'gameplayEntered', 'inputAttempted', 'inputAccepted', 'inputCausality', 'feedbackObserved',
      'roundAdvanced', 'autonomousGameplayEvent', 'sessionEnded', 'resultsCurrent', 'safeExit',
      'backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition']
      .map((name) => [name, axis(AxisStatus.NOT_EXECUTED, record?.executionAttemptId, `invalid record: ${validation.errors.join('; ')}`)]));
  }
  const seqObs = obsBySeq(record);
  const events = [...(record.events || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const observations = [...(record.observations || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const attemptId = record.executionAttemptId;

  const states = observations.map((o) => ({ o, s: observeState({ ...o, gameId: record.gameId }) }));
  const firstState = (pred) => states.find((x) => pred(x.s, x.o));

  // -- launch / identity / render ------------------------------------------
  const identityObs = firstState((s, o) => s.identityVerified && s.state !== GameStates.UNKNOWN && observationHasCapturedHierarchy(o));
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
    if (!eventSucceeded(e)) return false;
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
  const tutorialStatus = deriveTutorialStatus({
    metadata: gameMetadata(record.gameId), tutorialStateRow: tutorialEvidenceRow(record),
    tutorialObserved: !!tutorialObs, tutorialCleared: !!tutorialExit,
  });
  axes.tutorialStatus = { ...axis(AxisStatus.OBSERVED, attemptId, tutorialStatus), value: tutorialStatus };
  if (tutorialStatus === TutorialStatus.COMPLETED_THIS_ATTEMPT) {
    axes.tutorialCompleted = axis(AxisStatus.VERIFIED, attemptId, 'tutorial cleared during this attempt',
      tutorialExit ? [`evt#${tutorialExit.seq}`] : []);
  } else if (tutorialStatus === TutorialStatus.PREVIOUSLY_COMPLETED) {
    axes.tutorialCompleted = axis(AxisStatus.VERIFIED, attemptId, 'persisted tutorial_state confirms prior completion', ['tutorialState']);
  } else if (tutorialStatus === TutorialStatus.NOT_REQUIRED) {
    axes.tutorialCompleted = axis(AxisStatus.OBSERVED, attemptId, 'game metadata says no tutorial is required');
  } else if (tutorialStatus === TutorialStatus.REQUIRED_NOT_CLEARED) {
    axes.tutorialCompleted = axis(AxisStatus.FAILED, attemptId, tutorialObs ? 'tutorial observed but not cleared this attempt' : 'persisted tutorial_state says required tutorial is incomplete');
  } else {
    axes.tutorialCompleted = axis(AxisStatus.NOT_EXECUTED, attemptId, 'tutorial applicability or persisted state is unknown');
  }

  // -- gameplay entry -------------------------------------------------------
  // P1-1/NF-080-001: entry is ACTION-CAUSED, so it requires a proven executed
  // command. A failed Start tap whose window coincidentally shows intro ->
  // playing is an autonomous transition, never gameplay-entry proof.
  const gameplayEntry = events.find((e) => {
    if (!eventSucceeded(e)) return false;
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    if (!before || !after || !observationHasCapturedHierarchy(before) || !observationHasCapturedHierarchy(after)) return false;
    const sb = observeState({ ...before, gameId: record.gameId });
    const sa = observeState({ ...after, gameId: record.gameId });
    return sb.identityVerified && sa.identityVerified &&
      (sb.state === GameStates.INTRO || sb.state === GameStates.TUTORIAL) && sa.state === GameStates.PLAYING;
  });
  const playingObs = states.filter((x) => x.s.state === GameStates.PLAYING);
  axes.gameplayEntered = axis(gameplayEntry ? AxisStatus.VERIFIED : AxisStatus.ATTEMPTED, attemptId,
    gameplayEntry
      ? 'intro/tutorial -> playing transition observed'
      : (playingObs.length ? 'playing state observed but no entry transition captured' : 'never observed in playing state'),
    gameplayEntry ? [`evt#${gameplayEntry.seq}`] : playingObs.map((x) => `obs#${x.o.seq}`));

  // -- input acceptance (P1-A: CAUSALLY ATTRIBUTED, not merely observed) ----
  const playingInputEvents = events.filter((e) => {
    if (!['tap', 'type', 'key'].includes(e.action)) return false;
    const before = seqObs.get(e.observationBeforeSeq);
    return before && observeState({ ...before, gameId: record.gameId }).state === GameStates.PLAYING;
  });
  // A fingerprint difference alone never certifies acceptance: the harness can
  // observe an autonomous timeout inside the tap window and the old filter
  // credited it to the tap (real case: language-word-chain `chain-word.2`).
  const targetSuffix = (e) => {
    const t = String(e.target || '');
    return record.gameId && t.startsWith(`${record.gameId}.`) ? t.slice(record.gameId.length + 1) : t;
  };
  const causal = playingInputEvents.map((e) => {
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    // Execution proof is forwarded so a failed/unacknowledged command can
    // never be classified INPUT_ACCEPTED (P1-1/NF-080-001).
    return {
      e,
      before,
      after,
      c: classifyInputCausality({
        target: targetSuffix(e), before, after, action: e.action,
        actionExecuted: e.actionExecuted, actionAcknowledged: e.actionAcknowledged,
      }),
    };
  });
  const accepted = causal.filter((x) => x.c.verdict === CausalityVerdict.INPUT_ACCEPTED);
  const autonomousTimeouts = causal.filter((x) => x.c.verdict === CausalityVerdict.AUTONOMOUS_TIMEOUT);
  const ambiguousInputs = causal.filter((x) => x.c.verdict === CausalityVerdict.AMBIGUOUS_CAUSALITY);
  axes.inputAttempted = axis(playingInputEvents.length ? AxisStatus.ATTEMPTED : AxisStatus.NOT_EXECUTED, attemptId,
    playingInputEvents.length ? 'gameplay input requested+executed' : 'no gameplay input attempted',
    playingInputEvents.map((e) => `evt#${e.seq}`));
  let inputAcceptedStatus = AxisStatus.NOT_EXECUTED;
  let inputAcceptedNote = '';
  if (accepted.length) {
    inputAcceptedStatus = AxisStatus.VERIFIED;
    inputAcceptedNote = `input causally attributable to the observed change (${accepted.map((x) => `evt#${x.e.seq}:${x.c.signals.join('+')}`).join('; ')})`;
  } else if (playingInputEvents.length) {
    inputAcceptedStatus = AxisStatus.FAILED;
    const rejected = [...autonomousTimeouts, ...ambiguousInputs].map((x) => `evt#${x.e.seq}:${x.c.verdict}`).join('; ');
    inputAcceptedNote = `input executed but no causally attributable response (${rejected || 'no response observed'})`;
  }
  axes.inputAccepted = axis(inputAcceptedStatus, attemptId, inputAcceptedNote,
    accepted.map((x) => `evt#${x.e.seq}`));
  // Expose the full causal ledger so an auditor can see exactly what was
  // rejected and why (P1-A evidence, not just a verdict).
  axes.inputCausality = axis(AxisStatus.OBSERVED, attemptId,
    causal.map((x) => `evt#${x.e.seq}:${x.c.verdict}`).join('; ') || 'no input events',
    causal.flatMap((x) => [`evt#${x.e.seq}:${x.c.signals.join(',')}`]));

  // -- feedback (must be NEW after a CAUSALLY ACCEPTED in-playing input) -----
  let feedback = null;
  for (const x of accepted) {
    const before = x.before;
    const after = x.after;
    if (!before || !after) continue;
    const fbBefore = new Set(observeState({ ...before, gameId: record.gameId }).feedbackMarkers);
    const fbAfter = observeState({ ...after, gameId: record.gameId }).feedbackMarkers;
    const fresh = fbAfter.filter((f) => !fbBefore.has(f));
    if (fresh.length) { feedback = { e: x.e, fresh, after }; break; }
  }
  axes.feedbackObserved = axis(feedback ? AxisStatus.VERIFIED : AxisStatus.NOT_EXECUTED, attemptId,
    feedback ? `new feedback after an accepted input: ${feedback.fresh.join(', ')}` : 'no post-accepted-input feedback transition observed',
    feedback ? [`evt#${feedback.e.seq}`, `obs#${feedback.after.seq}`] : []);

  // -- round advancement ----------------------------------------------------
  // P1-1/NF-080-001: round advancement attributed to an input event requires
  // that event to be proven executed (same invariant as inputAccepted).
  let roundAdvanced = null;
  for (const e of playingInputEvents) {
    if (!eventSucceeded(e)) continue;
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
  // Deliberately NOT globally rejecting timeouts: a passive/timed game may
  // legitimately progress without input. Such a progression is credited here
  // (the autonomous-gameplay capability), never fabricated as tap acceptance.
  // P1-1/NF-080-001: only PROVEN EXECUTED input events count as an
  // explanation for a state change. A change observed across an unexecuted
  // command is autonomous/coincidental and is represented HERE — never as
  // accepted input or an action-attributed milestone.
  let autonomous = null;
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const cur = states[i];
    if (prev.s.state !== GameStates.PLAYING || cur.s.state !== GameStates.PLAYING ||
        !prev.s.identityVerified || !cur.s.identityVerified) continue;
    const acceptedInputBetween = causal.some((x) => eventSucceeded(x.e) &&
      x.e.observationBeforeSeq >= prev.o.seq && x.e.observationAfterSeq <= cur.o.seq &&
      x.c.verdict === CausalityVerdict.INPUT_ACCEPTED);
    if (acceptedInputBetween || stateFingerprint(prev.o) === stateFingerprint(cur.o)) continue;
    if (hasPassiveRoundEvent(record.gameId, prev.o, cur.o)) {
      autonomous = { prev: prev.o, cur: cur.o, kind: 'source-allowlisted-timed-round-event' };
      break;
    }
  }
  axes.autonomousGameplayEvent = axis(autonomous ? AxisStatus.VERIFIED : AxisStatus.NOT_EXECUTED, attemptId,
    autonomous
      ? `gameplay progressed without attributable input (${autonomous.kind}; timed/passive contract)`
      : 'no input-independent progression observed',
    autonomous ? [`obs#${autonomous.prev.seq}->obs#${autonomous.cur.seq}`] : []);

  // -- session end / results currency --------------------------------------
  // Terminal results may be reached by an input or passively by a timed game.
  // A passive transition is credited from the adjacent, game-identified
  // PLAYING -> RESULTS observations themselves; no synthetic tap/wait action is
  // created. If a command did span those observations, only its successful
  // event can explain the transition (P1-1/NF-080-001).
  const resultsAll = states.filter((x) => x.s.state === GameStates.RESULTS);
  let resultsObs = null;
  for (let i = resultsAll.length - 1; i >= 0; i--) {
    const cand = resultsAll[i];
    const stateIndex = states.findIndex((x) => x.o.seq === cand.o.seq);
    const previousState = stateIndex > 0 ? states[stateIndex - 1] : null;
    const lastPlayingBefore = [...playingObs].filter((p) => p.o.seq < cand.o.seq).pop();
    if (!lastPlayingBefore) continue;

    const INTERRUPTING = new Set([
      GameStates.EXITED, GameStates.LAUNCHER, GameStates.UNKNOWN,
      GameStates.INTRO, GameStates.TUTORIAL,
    ]);
    const gapClean = states.every((x) => !(x.o.seq > lastPlayingBefore.o.seq && x.o.seq < cand.o.seq && INTERRUPTING.has(x.s.state)));
    if (!gapClean) continue;
    if (cand.o.observedGameId !== record.gameId || lastPlayingBefore.o.observedGameId !== record.gameId) continue;

    const beforeToken = observedSessionToken(lastPlayingBefore.o, record.gameId);
    const resultToken = observedSessionToken(cand.o, record.gameId);
    if (!beforeToken || beforeToken !== resultToken || !lastPlayingBefore.s.identityVerified || !cand.s.identityVerified ||
        !observationHasCapturedHierarchy(lastPlayingBefore.o) || !observationHasCapturedHierarchy(cand.o)) continue;

    const transitionEvents = events.filter((e) =>
      e.observationBeforeSeq === lastPlayingBefore.o.seq && e.observationAfterSeq === cand.o.seq);
    const actionWitness = transitionEvents.find((e) => eventSucceeded(e) && e.actionAcknowledged === true);
    const passiveWitness = previousState?.o.seq === lastPlayingBefore.o.seq &&
      previousState.s.state === GameStates.PLAYING && transitionEvents.length === 0 &&
      allowsPassiveTerminal(record.gameId);
    if (!actionWitness && !passiveWitness) continue;

    resultsObs = {
      ...cand,
      boundTo: lastPlayingBefore,
      terminalWitness: actionWitness ? `evt#${actionWitness.seq}` : `obs#${lastPlayingBefore.o.seq}->obs#${cand.o.seq}`,
      scoreBinding: 'matching-observed-session-token',
      passive: !!passiveWitness,
    };
    break;
  }

  let resultsCurrentStatus = AxisStatus.NOT_EXECUTED;
  let resultsCurrentNote = '';
  if (resultsObs) {
    resultsCurrentStatus = AxisStatus.VERIFIED;
    resultsCurrentNote = `results bound to this session (${resultsObs.scoreBinding}; ${resultsObs.terminalWitness}; game identity consistent)`;
  } else if (resultsAll.length) {
    resultsCurrentStatus = AxisStatus.FAILED;
    resultsCurrentNote = 'results screen observed but current session token, game identity or allowed terminal transition was not proven';
  }
  axes.resultsCurrent = axis(resultsCurrentStatus, attemptId, resultsCurrentNote,
    resultsObs ? [`obs#${resultsObs.o.seq}`, `obs#${resultsObs.boundTo.o.seq}`, resultsObs.terminalWitness] : []);

  let sessionEndedStatus = AxisStatus.NOT_EXECUTED;
  let sessionEndedNote = 'no results surface reached in-run';
  const resultsAfterGameplay = resultsAll.some((result) =>
    playingObs.some((playing) => playing.o.seq < result.o.seq && playing.o.observedGameId === record.gameId));
  if (resultsObs) {
    sessionEndedStatus = AxisStatus.VERIFIED;
    sessionEndedNote = `terminal results observed in-run with a matching session token (${resultsObs.terminalWitness})`;
  } else if (resultsAfterGameplay) {
    sessionEndedStatus = AxisStatus.ATTEMPTED;
    sessionEndedNote = 'a results surface followed this gameplay but its terminal transition was not bound to this session';
  } else if (states.at(-1)?.s.state === GameStates.PLAYING) {
    sessionEndedStatus = AxisStatus.ATTEMPTED;
    sessionEndedNote = 'run interrupted while still in gameplay — session end attempted, never proven';
  }
  axes.sessionEnded = axis(sessionEndedStatus, attemptId, sessionEndedNote,
    resultsObs ? [resultsObs.terminalWitness] : []);
  if (resultsObs?.passive) {
    autonomous = { prev: resultsObs.boundTo.o, cur: resultsObs.o, kind: 'source-allowlisted-timed-session-terminal' };
    axes.autonomousGameplayEvent = axis(AxisStatus.VERIFIED, attemptId,
      'source-allowlisted timed session reached results with the same observed session token',
      [`obs#${autonomous.prev.seq}->obs#${autonomous.cur.seq}`]);
  }

  // -- safe exit (F-080-002 + P1-B) -----------------------------------------
  // A safe exit is PROVEN, never assumed. It requires ALL of:
  //   1. successful action execution acknowledgment (actionExecuted === true,
  //      and not explicitly un-acknowledged);
  //   2. a VALID before-state (the app screen was actually observed);
  //   3. a VALID after-state (hierarchy parsed — a failed dump is not a state);
  //   4. a CONFIRMED expected destination under the run's explicit exit
  //      contract (app destination by default; launcher only when declared);
  //   5. no evidence of a crash, task termination, system dialog or transient
  //      tooling failure.
  // A missing/malformed hierarchy is never evidence of successful navigation.
  const EXIT_TARGET_RE = /(^|[.\-])(quit|intro-back|exit|discard|end-session)([.\-]|$)/;
  const exitContract = record.exitContract || {};
  const acceptableDestinations = new Set(
    Array.isArray(exitContract.acceptableDestinations) && exitContract.acceptableDestinations.length
      ? exitContract.acceptableDestinations
      : DESTINATION_SCREEN_KINDS,
  );
  const isExitIntent = (e) => e.action === 'back' || EXIT_TARGET_RE.test(e.target || '');
  const obsIsProven = (o) => !!(o && isIsoTimestamp(o.timestamp) && o.seq !== undefined);
  const hasFreshHierarchy = (o) => !!(
    o?.rawScreen && o.rawScreen.hierarchyStatus === 'ok' &&
    o.rawScreen.expectedPackage === record.buildIdentity?.packageName &&
    o.hierarchyArtifact?.kind === ArtifactKind.HIERARCHY &&
    o.hierarchyArtifact.file && (o.hierarchyArtifact.sha256 || o.hierarchyArtifact.sha1) &&
    o.executionAttemptId === attemptId && observationHasCapturedHierarchy(o)
  );

  const exitAttempts = events.filter((e) => isExitIntent(e));
  const safeExit = exitAttempts.find((e) => {
    // (1) the command must actually have been executed, not merely requested
    if (e.actionExecuted !== true) return false;
    if (e.actionAcknowledged === false) return false;
    const before = seqObs.get(e.observationBeforeSeq);
    const after = seqObs.get(e.observationAfterSeq);
    // (2)/(3) valid before AND after observations and independently bound raw
    // hierarchy evidence. Cached `screenKind` labels are never destinations.
    if (!obsIsProven(before) || !obsIsProven(after)) return false;
    if (!hasFreshHierarchy(before) || !hasFreshHierarchy(after)) return false;
    const sb = observeState({ ...before, gameId: record.gameId });
    const sa = observeState({ ...after, gameId: record.gameId });
    if (![GameStates.INTRO, GameStates.TUTORIAL, GameStates.PLAYING, GameStates.RESULTS].includes(sb.state) || !sb.identityVerified) return false;
    if (sb.screenKind !== ScreenKind.GAME_SCREEN || sa.state === sb.state || sb.screenKind === sa.screenKind) return false;
    if (sa.state === GameStates.UNKNOWN) return false;
    // (5) crash / dialog / tooling failure is not navigation
    if ([ScreenKind.CRASH, ScreenKind.HIERARCHY_FAILURE, ScreenKind.ADB_FAILURE,
      ScreenKind.SYSTEM_DIALOG, ScreenKind.PERMISSION_DIALOG].includes(sa.screenKind)) return false;
    // (4) confirmed expected destination under the explicit exit contract
    return acceptableDestinations.has(sa.screenKind);
  });
  const backAttempted = exitAttempts.some((e) => e.actionExecuted === true);
  let safeExitStatus = AxisStatus.NOT_EXECUTED;
  let safeExitNote = '';
  if (safeExit) {
    safeExitStatus = AxisStatus.VERIFIED;
    safeExitNote = `exit destination proven: '${observeState({ ...seqObs.get(safeExit.observationAfterSeq), gameId: record.gameId }).screenKind}' observed after an executed exit command`;
  } else if (backAttempted) {
    safeExitStatus = AxisStatus.FAILED;
    const lastExit = exitAttempts[exitAttempts.length - 1];
    const after = lastExit ? seqObs.get(lastExit.observationAfterSeq) : null;
    const kind = after ? observeState({ ...after, gameId: record.gameId }).screenKind : 'no-observation';
    safeExitNote = `exit command executed but destination NOT proven (observed screen kind: '${kind}'; acceptable: ${[...acceptableDestinations].join(', ')})`;
  }
  axes.safeExit = axis(safeExitStatus, attemptId, safeExitNote,
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

// Tutorial applicability gate (B6): a tutorial that was SHOWN this attempt and
// never cleared blocks gameplay certification. Every other case does not — a
// returning player who already completed the tutorial is never forced to
// repeat it purely so QA can observe it.
const tutorialBlocksGameplay = (axes) =>
  !axes.tutorialCompleted || ![AxisStatus.VERIFIED, AxisStatus.OBSERVED].includes(axes.tutorialCompleted.status);

/**
 * Tutorial-completion semantics (B6) — the single authoritative rule.
 *
 * The human coverage matrix said "L2 requires tutorial completion where
 * applicable" while `deriveLevelFromAxes` never consulted `tutorialCompleted`.
 * The authoritative rule is now:
 *
 *   NOT_REQUIRED            — game has no tutorial; L2 unaffected.
 *   COMPLETED_THIS_ATTEMPT  — tutorial shown and cleared in-run; L2 unaffected.
 *   PREVIOUSLY_COMPLETED    — tutorial persisted complete by an earlier session
 *                             and legitimately not shown; L2 unaffected.
 *   REQUIRED_NOT_CLEARED    — tutorial shown but never cleared in-run; BLOCKS L2.
 *   UNKNOWN                 — applicability undetermined; L2 still permitted,
 *                             but the axis reports UNKNOWN, never VERIFIED.
 */
export const TutorialStatus = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  COMPLETED_THIS_ATTEMPT: 'COMPLETED_THIS_ATTEMPT',
  PREVIOUSLY_COMPLETED: 'PREVIOUSLY_COMPLETED',
  REQUIRED_NOT_CLEARED: 'REQUIRED_NOT_CLEARED',
  UNKNOWN: 'UNKNOWN',
});

export function deriveTutorialStatus({ metadata, tutorialStateRow, tutorialObserved, tutorialCleared } = {}) {
  if (tutorialObserved) {
    return tutorialCleared ? TutorialStatus.COMPLETED_THIS_ATTEMPT : TutorialStatus.REQUIRED_NOT_CLEARED;
  }
  if (!metadata || typeof metadata.hasTutorial !== 'boolean') return TutorialStatus.UNKNOWN;
  if (metadata.hasTutorial === false) return TutorialStatus.NOT_REQUIRED;
  if (!tutorialStateRow) return TutorialStatus.UNKNOWN;
  return tutorialStateRow.completed === 1 && tutorialStateRow.replay_requested === 0 && tutorialStateRow.version === '1.0.0'
    ? TutorialStatus.PREVIOUSLY_COMPLETED
    : TutorialStatus.REQUIRED_NOT_CLEARED;
}

/**
 * Pure level ladder over derived axes. Used by deriveLevel() for certification
 * and, labelled explicitly, by the historical reclassifier to report the
 * EVIDENCE DEPTH of legacy records that predate the provenance contract.
 * Depth is never certification: a run can show L2-deep evidence and still be
 * uncertifiable for provenance (F-080-005).
 */
export function deriveLevelFromAxes(axes) {
  const reasons = [];
  const tutorialBlocked = tutorialBlocksGameplay(axes);
  const resilienceVerified = ['backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition']
    .filter((k) => V(axes, k));
  const l3 = V(axes, 'identity') && V(axes, 'gameplayEntered') && V(axes, 'sessionEnded') && V(axes, 'resultsCurrent') && !tutorialBlocked;
  const l2input = V(axes, 'inputAccepted') || V(axes, 'autonomousGameplayEvent');
  const l2response = V(axes, 'feedbackObserved') || V(axes, 'roundAdvanced') || V(axes, 'sessionEnded');
  const l2 = V(axes, 'identity') && V(axes, 'gameplayEntered') && l2input && l2response && !tutorialBlocked;
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
  if (tutorialBlocked) {
    // B6: the tutorial was shown this attempt and never cleared, so gameplay
    // interaction cannot be certified even if entry transitions were observed.
    // This never INFLATES the level: it only explains why L2/L3 are withheld,
    // and the level is whatever the smoke evidence actually proves. Blocking
    // reasons ACCUMULATE so an auditor sees every gap, not just the first.
    reasons.push('tutorial shown this attempt but never cleared — L2/L3 blocked (tutorial required and not completed)');
    if (l1) {
      reasons.push('launch, identity, render and verified safe exit');
      return { level: 1, status: 'PARTIAL', reasons };
    }
    // fall through: also report the smoke-level gaps below
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
export function deriveLevel(record, opts = {}) {
  const checks = validateRunRecord(record, opts);
  const axes = deriveCapabilities(record);
  if (!checks.valid) {
    return { level: 0, status: 'FAILED', axes, reasons: [`run record invalid: ${checks.errors.join('; ')}`] };
  }
  return { ...deriveLevelFromAxes(axes), axes };
}

export function classifyRun(record, opts = {}) {
  const d = deriveLevel(record, opts);
  return { ...d, validation: validateRunRecord(record, opts) };
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

// ---------------------------------------------------------------------------
// Advance/confirm control policy (Campaign 080, Wave D)
//
// The sweep's advance-control list used to be a fixed literal set
// ('next-round', 'submit', 'check', 'confirm', 'next', 'continue', 'done',
// 'skip', 'reveal'). The real catalog uses names it did not contain —
// `next-problem` (Fast Math), `next-trial`, `submit-estimate` — and the
// consequence was a CONFIRMED false negative, not a cosmetic gap:
//
//   math-fast-math round timed out -> feedback overlay rendered `next-problem`
//   -> the literal set did not match -> chooseGameplayAction() returned null
//   -> the loop fell through to its "passive" branch and never tapped again
//   -> score stayed at 0, no post-input feedback transition was ever observed
//   -> the run could not exceed L1 despite having already proven gameplay entry
//      AND an accepted input.
//
// The policy is a PATTERN rather than more literals, and it lives here (not in
// the CLI) so it is unit-testable: an advance control that the harness cannot
// recognise stalls gameplay observation, and that failure mode must be caught by
// a test rather than rediscovered on a device.
// ---------------------------------------------------------------------------

/** Matches an advance/confirm verb, optionally prefixed and as a path segment. */
const ADVANCE_VERB_RE = /(^|[.\-])(next|continue|advance|submit|confirm|check|done|skip|reveal)([.\-]|$)/i;

/** The shared GameButton renders a cosmetic `-lip` overlay above its base. */
const DECORATIVE_SUFFIX_RE = /-lip$/;

/**
 * True when `key` names a control that advances a round or confirms an answer.
 * Decorative `-lip` overlays are excluded: they sit ABOVE their base control, so
 * a tap aimed at the overlay's coordinate is a tap on the base anyway, and
 * preferring the base keeps event targets meaningful.
 */
export function isAdvanceControl(key) {
  if (typeof key !== 'string' || key === '') return false;
  if (DECORATIVE_SUFFIX_RE.test(key)) return false;
  return ADVANCE_VERB_RE.test(key);
}

/**
 * Choose the best advance/confirm control from a control inventory.
 *
 * Preference order (a semantic round-advance beats a generic submit):
 *   0 next-round / next-problem / next-trial
 *   1 submit / submit-*
 *   2 confirm / check
 *   3 next / continue / advance
 *   4 anything else that matched the verb pattern
 * Ties break on the shorter key (the base control rather than a wrapper).
 *
 * @param {object|string[]} controls  control map (keyed by semantic suffix) or key list
 * @returns {string|null}
 */
export function pickAdvanceControl(controls) {
  const keys = Array.isArray(controls)
    ? controls.filter((k) => isAdvanceControl(k))
    : Object.keys(controls || {}).filter((k) => isAdvanceControl(k));
  if (!keys.length) return null;
  const score = (k) => {
    if (/next-round|next-problem|next-trial/.test(k)) return 0;
    if (/^submit|submit-/.test(k)) return 1;
    if (/confirm|check/.test(k)) return 2;
    if (/next|continue|advance/.test(k)) return 3;
    return 4;
  };
  return keys.slice().sort((a, b) => score(a) - score(b) || a.length - b.length)[0];
}
