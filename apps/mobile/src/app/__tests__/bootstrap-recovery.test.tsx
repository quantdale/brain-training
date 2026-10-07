/**
 * Campaign 053 (tasks 1.2–1.5) — classified bootstrap recovery contract.
 *
 * Renders the real root layout through the real bootstrap pipeline with one
 * injected stage failure at a time:
 *
 * - a failed foundational catalog/progression stage withholds the normal
 *   shell and shows the stage-specific recovery-safe screen;
 * - retry after the transient failure converges to the normal shell exactly
 *   once ("ready exactly once" per successful pass);
 * - a failed ANCILLARY preference read still reaches the normal shell with a
 *   stage-specific diagnostic.
 *
 * `@/db` stays real (jest/setup routes the Expo backend to the in-memory
 * Node adapter), so the recovered shell is genuinely bootstrapped.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import RootLayout from '@/app/_layout';
import BootstrapRecovery from '@/app/bootstrap-recovery';
import { expectConsoleNoise, rootLayoutRoutes } from '@/test-utils';

/** Test-controlled stage switches (hoisted-safe `mock` prefix). */
const mockBootstrapState = {
  progressionFails: false,
  registryFails: false,
  preferenceReadFails: false,
};

jest.mock('@/progression', () => {
  const actual = jest.requireActual('@/progression') as Record<string, unknown>;
  return {
    ...actual,
    initializeProgression: jest.fn(async () => {
      if (mockBootstrapState.progressionFails) {
        throw new Error('progression boom');
      }
    }),
  };
});

jest.mock('@/registry/registry', () => {
  const actual = jest.requireActual('@/registry/registry') as Record<string, unknown>;
  const realRegister = actual.registerGameDefinitions as (mockDefs: unknown) => void;
  return {
    ...actual,
    registerGameDefinitions: jest.fn((mockDefs: unknown) => {
      if (mockBootstrapState.registryFails) {
        throw new Error('registry boom');
      }
      realRegister(mockDefs);
    }),
  };
});

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => {
      const db = (actual.getDb as () => Record<string, unknown>)();
      if (!mockBootstrapState.preferenceReadFails) {
        return db;
      }
      // Ancillary-failure view: everything else stays real; only the
      // preference read rejects, exactly like a corrupt settings JSON cell.
      const view = Object.create(db) as Record<string, unknown>;
      const profile = Object.create(db.profile as object) as Record<string, unknown>;
      profile.get = async () => {
        throw new Error('theme read boom');
      };
      view.profile = profile;
      return view;
    },
  };
});

function renderShell(): ReturnType<typeof renderRouter> {
  return renderRouter(
    { _layout: RootLayout, ...rootLayoutRoutes({ results: () => <View testID="normal-shell-route" /> }) },
    { initialUrl: '/results' },
  );
}

beforeEach(() => {
  mockBootstrapState.progressionFails = false;
  mockBootstrapState.registryFails = false;
  mockBootstrapState.preferenceReadFails = false;
});

describe('classified bootstrap recovery (Campaign 053)', () => {
  it('gives direct deep links a working, honestly labelled route home', async () => {
    await renderRouter(
      {
        index: () => <View testID="direct-home" />,
        'bootstrap-recovery': () => <BootstrapRecovery />,
      },
      { initialUrl: '/bootstrap-recovery' },
    );

    expect(await screen.findByTestId('bootstrap-recovery-title')).toHaveTextContent('Ready to Train');
    await fireEvent.press(screen.getByTestId('bootstrap-recovery-retry'));
    expect(await screen.findByTestId('direct-home')).toBeOnTheScreen();
  });
  it('shows the progression recovery screen when progression initialization fails', async () => {
    mockBootstrapState.progressionFails = true;
    // The injected foundational failure logs its classified diagnostic by
    // design; scope it to this test instead of letting it read as noise.
    await expectConsoleNoise(/\[bootstrap\] stage failed.*"stage":"progression"/, async () => {
      const result = renderShell();
      await result;
    });

    expect(await screen.findByTestId('bootstrap-recovery')).toBeOnTheScreen();
    expect(screen.getByTestId('bootstrap-recovery-title')).toHaveTextContent(
      'Progress Unavailable',
    );
    expect(screen.getByTestId('bootstrap-recovery-detail')).toHaveTextContent(
      'progression boom',
    );
    expect(screen.getByTestId('bootstrap-recovery-retry')).toBeOnTheScreen();
    // The normal shell must not render behind a failed foundational stage.
    expect(screen.queryByTestId('normal-shell-route')).toBeNull();
    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
  });

  it('shows the catalog recovery screen when registry registration fails', async () => {
    mockBootstrapState.registryFails = true;
    await expectConsoleNoise(/\[bootstrap\] stage failed.*"stage":"catalog-registry"/, async () => {
      const result = renderShell();
      await result;
    });

    expect(await screen.findByTestId('bootstrap-recovery')).toBeOnTheScreen();
    expect(screen.getByTestId('bootstrap-recovery-title')).toHaveTextContent(
      'Games Unavailable',
    );
    expect(screen.getByTestId('bootstrap-recovery-detail')).toHaveTextContent(
      'registry boom',
    );
    expect(screen.queryByTestId('normal-shell-route')).toBeNull();
  });

  it('converges to the normal shell after a retry that succeeds', async () => {
    mockBootstrapState.progressionFails = true;
    await expectConsoleNoise(/\[bootstrap\] stage failed.*"stage":"progression"/, async () => {
      const result = renderShell();
      await result;
    });
    await screen.findByTestId('bootstrap-recovery');

    // Transient failure clears; Retry re-runs the classified pipeline and the
    // normal shell renders exactly once.
    mockBootstrapState.progressionFails = false;
    await fireEvent.press(screen.getByTestId('bootstrap-recovery-retry'));

    expect(
      await screen.findByTestId('normal-shell-route', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('bootstrap-recovery')).toBeNull();
  });

  it('keeps an ancillary preference failure nonfatal and records a stage diagnostic', async () => {
    mockBootstrapState.preferenceReadFails = true;
    await expectConsoleNoise(
      /\[bootstrap\] stage failed.*"classification":"ancillary"/,
      async () => {
        const result = renderShell();
        await result;
      },
    );

    expect(
      await screen.findByTestId('normal-shell-route', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('bootstrap-recovery')).toBeNull();
    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
  });
});
