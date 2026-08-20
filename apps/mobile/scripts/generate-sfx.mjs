/**
 * Generates the lightweight SFX assets used by the production audio/haptics
 * service (see apps/mobile/src/sdk/audio-haptics-real.ts).
 *
 * Each asset is a short, distinguishable PCM WAV (16-bit mono, 44.1 kHz) so the
 * binary footprint stays tiny and the files are trivially bundlable by Metro.
 *
 * Regenerate with: node apps/mobile/scripts/generate-sfx.mjs
 * Committed assets live in apps/mobile/assets/sfx/.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SAMPLE_RATE = 44100;

function renderTone(segments) {
  const attack = Math.floor(SAMPLE_RATE * 0.005);
  const release = Math.floor(SAMPLE_RATE * 0.02);
  const totalSamples = segments.reduce(
    (sum, s) => sum + Math.ceil(s.dur * SAMPLE_RATE),
    0,
  );
  const samples = new Int16Array(totalSamples);
  let offset = 0;
  for (const seg of segments) {
    const n = Math.ceil(seg.dur * SAMPLE_RATE);
    const gain = seg.gain ?? 0.6;
    const type = seg.type ?? 'sine';
    const twoPiF = (2 * Math.PI * seg.freq) / SAMPLE_RATE;
    for (let i = 0; i < n; i++) {
      let env = 1;
      if (i < attack) env = i / attack;
      else if (i > n - release) env = Math.max(0, (n - i) / release);
      const raw = type === 'square'
        ? Math.sign(Math.sin(twoPiF * i))
        : Math.sin(twoPiF * i);
      const value = Math.max(-1, Math.min(1, raw * gain * env));
      samples[offset + i] = Math.round(value * 32767);
    }
    offset += n;
  }
  return encodeWav(samples);
}

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buffer;
}

const ASSETS = {
  // A short, soft UI blip.
  tap: [{ freq: 880, dur: 0.06, gain: 0.4 }],
  // Pleasant rising two-tone for a correct answer.
  correct: [
    { freq: 660, dur: 0.07, gain: 0.5 },
    { freq: 990, dur: 0.09, gain: 0.5 },
  ],
  // Low, dull buzz for a wrong answer.
  wrong: [{ freq: 170, dur: 0.18, type: 'square', gain: 0.35 }],
  // Bright ascending arpeggio for session success.
  success: [
    { freq: 523, dur: 0.08, gain: 0.5 },
    { freq: 659, dur: 0.08, gain: 0.5 },
    { freq: 784, dur: 0.12, gain: 0.5 },
  ],
  // Descending tone for session failure.
  failure: [
    { freq: 420, dur: 0.1, gain: 0.45 },
    { freq: 260, dur: 0.18, gain: 0.45 },
  ],
  // Bright chime when a personal record is set.
  record: [{ freq: 1175, dur: 0.16, gain: 0.45 }],
  // Sparkly triple for a reward (currency/achievement).
  reward: [
    { freq: 880, dur: 0.07, gain: 0.45 },
    { freq: 1100, dur: 0.07, gain: 0.45 },
    { freq: 1320, dur: 0.12, gain: 0.45 },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'sfx');
mkdirSync(outDir, { recursive: true });

for (const [name, segments] of Object.entries(ASSETS)) {
  const wav = renderTone(segments);
  const file = join(outDir, `${name}.wav`);
  writeFileSync(file, wav);
  // eslint-disable-next-line no-console
  console.log(`wrote ${file} (${wav.length} bytes)`);
}
