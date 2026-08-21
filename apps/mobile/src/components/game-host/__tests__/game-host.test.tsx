/**
 * `<GameHost>` unit tests — campaign 011 W05 adversarial matrix.
 *
 * Pins the Android hardware-back seam (xplat audit B6) and the chrome-mount
 * invariants the 18 migrated games rely on:
 * - the back subscription is mounted exactly once while `interceptBack` is
 *   true, removed on unmount/intercept-off (no orphan listeners);
 * - an active session consumes back → pause; a paused session consumes back
 *   with NO further dispatch (only the overlay's explicit Resume/Quit may
 *   proceed — no accidental abandonment);
 * - intro/results views never subscribe;
 * - the pause overlay mounts only for `paused && view === 'session'`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { BackHandler, View } from 'react-native';

import { testId } from '@/sdk';

import { GameHost } from '../game-host';
import type { GameHostProps } from '../game-host';

type BackHandlerFn = () => boolean;

/** Capture the hardware-back handler + its subscription removal. */
function captureBackHandler() {
  const captured: { handler: BackHandlerFn | null } = { handler: null };
  const spy = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event: any, handler: any) => {
      captured.handler = handler as BackHandlerFn;
      return { remove: () => (captured.handler = null) } as any;
    });
  return Object.assign(captured, { spy });
}

const GAME = 'host-test-game';

function hostProps(overrides: Partial<GameHostProps>): GameHostProps {
  return {
    gameId: GAME,
    view: 'session',
    paused: false,
    interceptBack: true,
    difficulty: 'normal',
    onSelectDifficulty: jest.fn(),
    onStart: jest.fn(),
    onHelp: jest.fn(),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onQuit: jest.fn(),
    children: <View testID={`${GAME}-body`} />,
    ...overrides,
  };
}

describe('GameHost hardware-back guard', () => {
  let back: ReturnType<typeof captureBackHandler>;

  beforeEach(() => {
    back = captureBackHandler();
  });

  afterEach(() => {
    back.spy.mockRestore();
  });

  it('subscribes once while in-session; active-session back pauses and consumes the event', async () => {
    const props = hostProps({ paused: false });
    const utils = await render(<GameHost {...props} />);

    expect(back.spy).toHaveBeenCalledTimes(1);
    expect(back.handler).not.toBeNull();

    // Active session: back pauses instead of leaving; the OS event is consumed.
    expect(back.handler?.()).toBe(true);
    expect(props.onPause).toHaveBeenCalledTimes(1);

    // Re-renders while subscribed must NOT resubscribe.
    await utils.rerender(<GameHost {...hostProps({ paused: false })} />);
    expect(back.spy).toHaveBeenCalledTimes(1);
    expect(back.handler?.()).toBe(true); // latest onPause still reachable via ref
  });

  it('paused-session back is consumed WITHOUT another pause dispatch (no accidental quit)', async () => {
    const utils = await render(<GameHost {...hostProps({ paused: false })} />);

    // Transition to paused (as if the user had pressed pause).
    const paused = hostProps({ paused: true });
    await utils.rerender(<GameHost {...paused} />);
    const dispatchesBefore = jest.mocked(paused.onPause).mock.calls.length;

    // Back while paused: consumed so navigation cannot leave behind the opaque
    // overlay, but NO additional onPause dispatch fires.
    expect(back.handler?.()).toBe(true);
    expect(jest.mocked(paused.onPause).mock.calls.length).toBe(dispatchesBefore);
  });

  it('does not subscribe when interceptBack is false (intro/results default navigation)', async () => {
    await render(<GameHost {...hostProps({ interceptBack: false })} />);
    await render(<GameHost {...hostProps({ view: 'intro', interceptBack: false })} />);
    await render(<GameHost {...hostProps({ view: 'results', interceptBack: false })} />);
    expect(back.spy).not.toHaveBeenCalled();
    expect(back.handler).toBeNull();
  });

  it('unmount removes the back subscription', async () => {
    const utils = await render(<GameHost {...hostProps({})} />);
    expect(back.handler).not.toBeNull();
    await utils.unmount(); // RNTL v14: cleanup effects flush on awaited unmount
    expect(back.handler).toBeNull();
  });

  it('toggling interceptBack off disposes; toggling back on resubscribes', async () => {
    const utils = await render(<GameHost {...hostProps({})} />);
    expect(back.handler).not.toBeNull();

    await utils.rerender(<GameHost {...hostProps({ interceptBack: false })} />);
    expect(back.handler).toBeNull(); // disposed; default navigation restored

    await utils.rerender(<GameHost {...hostProps({})} />);
    expect(back.spy).toHaveBeenCalledTimes(2);
    expect(back.handler).not.toBeNull();
  });
});

describe('GameHost chrome mounting', () => {
  beforeEach(() => {
    captureBackHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pause overlay mounts only while paused AND view is session', async () => {
    const utils = await render(<GameHost {...hostProps({ paused: false })} />);
    expect(screen.queryByTestId(testId(GAME, 'pause-title'))).toBeNull();

    await utils.rerender(<GameHost {...hostProps({ paused: true })} />);
    expect(screen.getByTestId(testId(GAME, 'pause-title'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME, 'resume'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME, 'quit'))).toBeOnTheScreen();
  });

  it('non-session views never mount the overlay even when paused=true', async () => {
    await render(
      <GameHost {...hostProps({ paused: true, view: 'results' })}>
        <View testID={`${GAME}-stats`} />
      </GameHost>,
    );
    expect(screen.queryByTestId(testId(GAME, 'pause-title'))).toBeNull();
  });

  it('results view renders children verbatim without session chrome', async () => {
    await render(
      <GameHost {...hostProps({ paused: false, view: 'results' })}>
        <View testID={`${GAME}-stats`} />
      </GameHost>,
    );
    expect(screen.queryByTestId(testId(GAME, 'pause-title'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME, 'start'))).toBeNull();
    expect(screen.getByTestId(`${GAME}-stats`)).toBeOnTheScreen();
  });
});
