/**
 * Test environment setup (jest-expo, Node environment).
 *
 * The production `initDatabase()` opens the canonical store through the Expo
 * SQLite backend (`@/db/adapters/expo`), whose native module (`NativeDatabase`)
 * is unavailable in the Node test environment — it throws
 * "_ExpoSQLite.default.NativeDatabase is not a constructor". The documented
 * design is that Node tests run against `adapters/node.ts`, so route the Expo
 * backend through the Node adapter here. This lets the real root layout
 * initialize a working in-memory database under jest (required to validate
 * task 8.4 storage-unavailable behavior without faking green), while production
 * keeps the real Expo backend untouched.
 *
 * The real audio/haptics engine (`@/sdk/audio-haptics-real`) imports
 * `expo-audio` / `expo-haptics`, which have no working native backend under
 * jest. Mock them so any test that renders the app (and thus the
 * `AudioHapticsProvider`) runs without touching native audio/haptics. The
 * engine's behavior is exercised directly by `audio-haptics.test.ts` against
 * these same mocks.
 */
jest.mock('@/db/adapters/expo', () => {
  const node = jest.requireActual('@/db/adapters/node');
  return {
    createExpoSqliteAdapter: () => node.createNodeSqliteAdapter(':memory:'),
    openExpoDatabase: () => ({}),
  };
});

jest.mock('expo-audio', () => {
  class MockAudioPlayer {
    played = false;
    currentTime = 0;
    duration = 0;
    playing = false;
    paused = false;
    muted = false;
    loop = false;
    volume = 1;
    playbackRate = 1;
    seekTo() {}
    play() {
      this.played = true;
      this.playing = true;
    }
    pause() {}
    replace() {}
    remove() {}
    setActiveForLockScreen() {}
    setPlaybackRate() {}
    updateLockScreenMetadata() {}
    clearLockScreenControls() {}
  }
  return {
    Audio: {
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
      setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
      preload: jest.fn(() => Promise.resolve()),
      clearPreloadedSource: jest.fn(() => Promise.resolve()),
      clearAllPreloadedSources: jest.fn(() => Promise.resolve()),
      getPreloadedSources: jest.fn(() => Promise.resolve([])),
      createAudioPlaylist: jest.fn(),
      requestRecordingPermissionsAsync: jest.fn(() =>
        Promise.resolve({ granted: true, status: 'granted' }),
      ),
      requestNotificationPermissionsAsync: jest.fn(() =>
        Promise.resolve({ granted: true, status: 'granted' }),
      ),
      getRecordingPermissionsAsync: jest.fn(() =>
        Promise.resolve({ granted: true, status: 'granted' }),
      ),
    },
    createAudioPlayer: jest.fn((source) => new MockAudioPlayer()),
    useAudioPlayer: jest.fn((source) => new MockAudioPlayer()),
    useAudioRecorder: jest.fn(),
    useAudioRecorderState: jest.fn(),
    useAudioPlaylist: jest.fn(),
    useAudioPlaylistStatus: jest.fn(),
    useAudioSampleListener: jest.fn(),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
    preload: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
    Soft: 'soft',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  AndroidHaptics: {},
}));
