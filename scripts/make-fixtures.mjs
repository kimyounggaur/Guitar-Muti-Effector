// Generates deterministic WAV fixtures for browser tests (Chrome --use-file-for-fake-audio-capture).
import { writeFileSync } from 'node:fs';

const RATE = 48000;
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// -46 dBFS RMS white noise, 5 s (uniform distribution, seeded LCG).
let seed = 1;
const amp = 10 ** (-46 / 20) * Math.sqrt(3);
const noise = Float64Array.from({ length: RATE * 5 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0xffffffff * 2 - 1) * amp; });
writeFileSync('tests/fixtures/noise-48k.wav', wav(noise));

// Open strings E2 → E4, 1 s each, with a short fade at each note boundary.
const notes = [82.41, 110, 146.83, 196, 246.94, 329.63];
const sweep = new Float64Array(RATE * notes.length);
notes.forEach((freq, n) => {
  for (let i = 0; i < RATE; i++) {
    const fade = Math.min(1, i / 480, (RATE - i) / 480);
    const t = i / RATE;
    sweep[n * RATE + i] = 0.3 * fade * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
  }
});
writeFileSync('tests/fixtures/sweep-e2-e4.wav', wav(sweep));
console.log('fixtures written');
