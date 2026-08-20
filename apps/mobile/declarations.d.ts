/**
 * Ambient module declarations for audio assets bundled via `require()`.
 * `expo-audio`'s `createAudioPlayer` accepts the numeric asset id that Metro
 * produces for these requires.
 */
declare module '*.wav' {
  const src: number;
  export default src;
}
