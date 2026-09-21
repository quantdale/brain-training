/**
 * Campaign 053 (tasks 4.1–4.5) — registry-derived catalog persistence matrix.
 *
 * The pre-053 failure contract proved the shared `<GameResults>` seam plus ONE
 * representative game (spatial-fold-match). That left a breadth gap: a newly
 * registered game could ship a persistence path that never handled rejection or
 * stale completion and nothing would notice.
 *
 * This matrix derives its cases from the GENERATED REGISTRY (never a hand-kept
 * list), so a registry addition is covered automatically or fails loudly:
 *
 * - discovery: every registered game must appear in the matrix or in the
 *   explicit exemption map below (task 4.1);
 * - success + rejected-save + stale-completion: each non-exempt game is driven
 *   end to end through its shared injection seams (`persistSession`,
 *   `tutorialStore`, `sessionSeed`, `clock`) and the shared QA force-completion
 *   panel (task 4.2);
 * - durable-effect safety: a rejected write leaves no completed session and a
 *   stale write cannot mutate the restarted session (task 4.4);
 * - exemptions: each entry must name the game, a reason, and a deterministic
 *   alternate evidence path (task 4.3).
 *
 * The shared seams are what make this possible: all 42 screens accept the same
 * four optional props and mount `QaPanelShell` (pinned by
 * `src/sdk/__tests__/catalog-contracts.test.ts`), so no per-game migration is
 * required — the observed gap was test breadth, not wrapper correctness.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { createFakeClock, testId } from '@/sdk';
import { registry } from '@/registry/registry.generated';
import {
  expectConsoleNoise,
  makeCompletedTutorialStore,
  makeSessionPersister,
} from '@/test-utils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/**
 * Explicit exemptions from the shared matrix. Every entry MUST name the game,
 * explain why the shared fixture cannot apply, and point at a deterministic
 * alternate contract. The registry-derived discovery test fails when a
 * registered game is neither in the matrix nor listed here, and the exemption
 * schema test fails when an entry is missing a required field or names a game
 * that is no longer registered.
 *
 * The current catalog has no exemptions: every game accepts the shared seams.
 * The mechanism exists so a future game that genuinely cannot use them has an
 * honest, reviewed path instead of silently dropping out of coverage.
 */
export interface PersistenceMatrixExemption {
  /** Registered game id this exemption covers. */
  readonly gameId: string;
  /** Why the shared session-persistence fixture cannot apply. */
  readonly reason: string;
  /** Deterministic alternate success/failure/stale-completion evidence. */
  readonly alternateEvidence: string;
}

export const CATALOG_PERSISTENCE_EXEMPTIONS: readonly PersistenceMatrixExemption[] = [];

const EXEMPT_IDS = new Set(CATALOG_PERSISTENCE_EXEMPTIONS.map((e) => e.gameId));
const MATRIX_GAMES = registry.filter((game) => !EXEMPT_IDS.has(game.id));

/** Resolve one registered game module (screen + stable id) by registry id. */
function loadGame(id: string): {
  default: React.ComponentType<Record<string, unknown>>;
  GAME_ID: string;
} {
  return jest.requireActual(`@/games/${id}`) as {
    default: React.ComponentType<Record<string, unknown>>;
    GAME_ID: string;
  };
}

interface RenderedGame {
  persister: ReturnType<typeof makeSessionPersister>;
  gameId: string;
}

/** Render one registered game with every shared injection seam supplied. */
async function renderGame(id: string): Promise<RenderedGame> {
  const mod = loadGame(id);
  const persister = makeSessionPersister();
  await render(
    <mod.default
      clock={createFakeClock(0)}
      tutorialStore={makeCompletedTutorialStore(mod.GAME_ID)}
      sessionSeed="catalog-matrix"
      persistSession={persister}
    />,
  );
  return { persister, gameId: mod.GAME_ID };
}

/** Start a session, force-win it through the shared QA panel, flush effects. */
async function startAndForceWinSession(gameId: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(testId(gameId, 'start')));
  await forceWinCurrentSession(gameId);
}

/**
 * Force-win the ALREADY-ACTIVE session through the shared QA panel. Used after
 * `restart`, which begins the next session directly instead of returning to the
 * intro view.
 */
async function forceWinCurrentSession(gameId: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(testId(gameId, 'qa-toggle')));
  await fireEvent.press(screen.getByTestId(testId(gameId, 'force-win')));
  await act(async () => {});
}

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Re-introduction guards (campaign 065, task 8). The matrix already drives
 * every registered game through a real session and results render; these
 * shared checks reuse that render instead of adding 42 bespoke suites:
 *
 * - at most one score statement inside `<gameId>.result-facts`;
 * - the shared HUD pause control is wired while a session is active;
 * - every interactive control in the live session meets the 44 dp floor
 *   (declared minHeight/height plus vertical hit-slop).
 *
 * All three scan the RNTL host tree as plain data, so a game cannot satisfy
 * them by declaring a testID it never renders.
 */
interface HostNode {
  readonly type?: string;
  readonly props: Record<string, unknown>;
  readonly children?: unknown;
}

/** Depth-first walk over host nodes in the RNTL JSON tree (text skipped). */
function walkHostNodes(node: unknown, visit: (node: HostNode) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walkHostNodes(child, visit);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const host = node as HostNode;
  if (host.props !== undefined) visit(host);
  walkHostNodes(host.children, visit);
}

/** Every testID in the subtree, including the root's own testID. */
function collectTestIds(root: unknown): string[] {
  const ids: string[] = [];
  walkHostNodes(root, (node) => {
    if (typeof node.props.testID === 'string') ids.push(node.props.testID);
  });
  return ids;
}

/** First host node whose testID matches `id`, or null when absent. */
function findHostByTestId(root: unknown, id: string): HostNode | null {
  const matches: HostNode[] = [];
  walkHostNodes(root, (node) => {
    if (node.props.testID === id) matches.push(node);
  });
  return matches[0] ?? null;
}

/**
 * Score statements under `result-facts` whose testID is `<gameId>.score…`
 * (`score`, `score-final`, `score.animated`, …). The results surface must
 * state the session's final score once; a second node is the duplicate-score
 * defect this guard exists to catch.
 */
function collectScoreIds(root: unknown, gameId: string): string[] {
  const escapedGameId = gameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scorePattern = new RegExp(`${escapedGameId}\\.score([.-]|$)`);
  return collectTestIds(root).filter((id) => scorePattern.test(id));
}

function resultsScoreIds(gameId: string): string[] {
  const facts = findHostByTestId(screen.toJSON(), testId(gameId, 'result-facts'));
  expect(facts).not.toBeNull();
  if (facts === null) return [];
  return collectScoreIds(facts, gameId);
}

const MIN_TOUCH_TARGET_DP = 44;

/** Accessibility roles that mark a host node as an actionable control. */
const CONTROL_ROLES = new Set([
  'button',
  'link',
  'tab',
  'radio',
  'checkbox',
  'switch',
  'menuitem',
]);

/** Effective vertical hit area: declared min/height plus hit-slop expansion. */
function effectiveVerticalTarget(props: Record<string, unknown>): number {
  const flat = StyleSheet.flatten(props.style as never) as Record<string, unknown> | null;
  const declared = [flat?.minHeight, flat?.height].filter(
    (value): value is number => typeof value === 'number',
  );
  const base = declared.length > 0 ? Math.max(...declared) : 0;
  const slop = props.hitSlop as number | { top?: number; bottom?: number } | null | undefined;
  const vertical =
    typeof slop === 'number'
      ? slop * 2
      : slop !== null && slop !== undefined
        ? (slop.top ?? 0) + (slop.bottom ?? 0)
        : 0;
  return base + vertical;
}

/**
 * Interactive host nodes: an explicit control role, or a responder-driven
 * pressable (Pressable marks its host view `accessible`, which excludes
 * gesture-only scroll containers from the scan). Decorative/testID-only
 * nodes carry neither signal and are skipped.
 */
function isInteractiveControl(props: Record<string, unknown>): boolean {
  const role = props.accessibilityRole;
  if (typeof role === 'string' && CONTROL_ROLES.has(role)) return true;
  return typeof props.onStartShouldSetResponder === 'function' && props.accessible === true;
}

/** Every control in the live session must meet the 44 dp vertical floor. */
function expectTouchTargetFloor(gameId: string): void {
  const violations: string[] = [];
  walkHostNodes(screen.toJSON(), (node) => {
    const props = node.props;
    if (!isInteractiveControl(props)) return;
    const height = effectiveVerticalTarget(props);
    if (height >= MIN_TOUCH_TARGET_DP) return;
    const label =
      typeof props.testID === 'string'
        ? props.testID
        : typeof props.accessibilityLabel === 'string'
          ? props.accessibilityLabel
          : String(node.type ?? 'unknown');
    violations.push(
      `${gameId}: ${label} has a ${height} dp effective target (< ${MIN_TOUCH_TARGET_DP})`,
    );
  });
  expect(violations).toEqual([]);
}

describe('catalog guard self-tests (task 8)', () => {
  it('duplicate-score guard flags a second score statement in a facts subtree', () => {
    const facts = {
      props: { testID: 'demo.result-facts' },
      children: [
        { type: 'Text', props: { testID: 'demo.score-final' }, children: [] },
        {
          type: 'View',
          props: {},
          children: [
            { type: 'Text', props: { testID: 'demo.score.animated' }, children: [] },
          ],
        },
      ],
    };
    // The success case keeps only slice(1), so two statements fail the guard.
    expect(collectScoreIds(facts, 'demo').slice(1)).toEqual(['demo.score.animated']);
  });

  it('duplicate-score guard ignores unrelated ids and other games', () => {
    const facts = {
      props: { testID: 'demo.result-facts' },
      children: [
        { type: 'Text', props: { testID: 'demo.scoreboard' }, children: [] },
        { type: 'Text', props: { testID: 'other.score' }, children: [] },
      ],
    };
    expect(collectScoreIds(facts, 'demo')).toEqual([]);
  });

  it('touch-target guard measures declared floors and hit-slop', () => {
    expect(effectiveVerticalTarget({ style: { minHeight: 44 } })).toBe(44);
    expect(effectiveVerticalTarget({ style: { minHeight: 36 }, hitSlop: 4 })).toBe(44);
    expect(
      effectiveVerticalTarget({ style: { height: 30 }, hitSlop: { top: 7, bottom: 7 } }),
    ).toBe(44);
    expect(effectiveVerticalTarget({ style: { minHeight: 36 } })).toBe(36);
  });

  it('touch-target guard scans controls but skips decorative nodes', () => {
    expect(isInteractiveControl({ accessibilityRole: 'button' })).toBe(true);
    expect(
      isInteractiveControl({ accessible: true, onStartShouldSetResponder: () => true }),
    ).toBe(true);
    expect(isInteractiveControl({ testID: 'demo.decorative' })).toBe(false);
    expect(isInteractiveControl({ testID: 'demo.art' })).toBe(false);
  });
});

describe('catalog persistence matrix discovery (task 4.1)', () => {
  it('covers every registered game through the matrix or an explicit exemption', () => {
    const covered = new Set([
      ...MATRIX_GAMES.map((game) => game.id),
      ...CATALOG_PERSISTENCE_EXEMPTIONS.map((entry) => entry.gameId),
    ]);
    const uncovered = registry
      .map((game) => game.id)
      .filter((id) => !covered.has(id));
    expect(uncovered).toEqual([]);
    expect(MATRIX_GAMES.length + CATALOG_PERSISTENCE_EXEMPTIONS.length).toBe(
      registry.length,
    );
  });

  it('requires every exemption to name the game, a reason, and alternate evidence (task 4.3)', () => {
    const registered = new Set(registry.map((game) => game.id));
    for (const entry of CATALOG_PERSISTENCE_EXEMPTIONS) {
      expect(registered.has(entry.gameId)).toBe(true);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect(entry.alternateEvidence.trim().length).toBeGreaterThan(0);
    }
    const ids = CATALOG_PERSISTENCE_EXEMPTIONS.map((entry) => entry.gameId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('catalog persistence matrix: success (task 4.2)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s persists exactly one session and reaches its results view',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);

      // HUD wiring: the shared pause control must be reachable before the
      // forced completion, and every interactive control must honor the
      // shared touch-target floor while the session is live.
      await fireEvent.press(screen.getByTestId(testId(gameId, 'start')));
      expect(screen.getByTestId(testId(gameId, 'pause'))).toBeOnTheScreen();
      expectTouchTargetFloor(gameId);

      await forceWinCurrentSession(gameId);

      expect(screen.getByTestId(testId(gameId, 'results'))).toBeOnTheScreen();
      // Duplicate-score guard: the results surface states the final score at
      // most once; slice(1) makes the offending extra ids the failure detail.
      expect(resultsScoreIds(gameId).slice(1)).toEqual([]);
      expect(persister.completeSession).toHaveBeenCalledTimes(1);
      const input = persister.completeSession.mock.calls[0][0];
      expect(input.session.gameId).toBe(gameId);
      expect(input.session.id.length).toBeGreaterThan(0);
      // The authoritative outcome is what the results view may reward from.
      expect(screen.queryByTestId(testId(gameId, 'persist-error'))).toBeNull();
    },
  );
});

describe('catalog persistence matrix: rejected save (task 4.4)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s surfaces the failure, never the reward, and writes once per session',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);
      persister.completeSession.mockRejectedValue(new Error('db locked'));
      // The per-game persist wrapper logs the rejection by design; scope the
      // expected diagnostic to this test instead of letting it read as noise.
      await expectConsoleNoise(/failed to persist completed session/, async () => {
        await startAndForceWinSession(gameId);
      });

      expect(screen.getByTestId(testId(gameId, 'persist-error'))).toHaveTextContent(
        /db locked/,
      );
      // Failure is not success: the reward card must not render.
      expect(screen.queryByTestId(testId(gameId, 'reward'))).toBeNull();
      expect(persister.completeSession).toHaveBeenCalledTimes(1);

      // The failed session is never silently retried by an extra render pass.
      await act(async () => {});
      expect(persister.completeSession).toHaveBeenCalledTimes(1);
    },
  );
});

describe('catalog persistence matrix: stale completion (task 4.4)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s drops a late rejection from a superseded session',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);

      // First session's write stays in flight while the player restarts.
      let rejectFirst!: (error: unknown) => void;
      const firstWrite = new Promise<never>((_resolve, reject) => {
        rejectFirst = reject;
      });
      persister.completeSession.mockImplementationOnce(() => firstWrite);

      await startAndForceWinSession(gameId);
      expect(persister.completeSession).toHaveBeenCalledTimes(1);

      // Restart and complete a second session; it persists normally.
      await fireEvent.press(screen.getByTestId(testId(gameId, 'restart')));
      await forceWinCurrentSession(gameId);
      expect(persister.completeSession).toHaveBeenCalledTimes(2);

      // The stale rejection must not surface on the restarted session. The
      // persist wrapper still logs it by design, so scope that diagnostic.
      await expectConsoleNoise(/failed to persist completed session/, async () => {
        await act(async () => {
          rejectFirst(new Error('db locked'));
          await firstWrite.catch(() => {});
        });
      });

      expect(screen.queryByTestId(testId(gameId, 'persist-error'))).toBeNull();
      expect(screen.getByTestId(testId(gameId, 'results'))).toBeOnTheScreen();
    },
  );
});
