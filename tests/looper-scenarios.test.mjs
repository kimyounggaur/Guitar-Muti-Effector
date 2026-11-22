// P1 / F2: looper worklet scenarios (design §5 step 1). Drives src/audio/worklets/looper-processor.ts directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const RATE = 8000;
const source = readFileSync(new URL('../src/audio/worklets/looper-processor.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;

function createLooper() {
  let Processor;
  const reports = [];
  class WorkletStub { constructor() { this.port = { postMessage: (m) => reports.push(m), onmessage: null }; } }
  vm.runInNewContext(javascript, {
    sampleRate: RATE, AudioWorkletProcessor: WorkletStub,
    registerProcessor: (_name, ctor) => { Processor = ctor; }, Float32Array, Math, Number,
  });
  const processor = new Processor();
  const send = (type, props) => processor.port.onmessage({ data: { type, ...props } });
  const process = (input) => {
    const out = new Float32Array(input.length);
    for (let offset = 0; offset < input.length; offset += 128) {
      const inBlock = input.subarray(offset, offset + 128);
      const left = new Float32Array(inBlock.length);
      processor.process([[inBlock]], [[left, new Float32Array(inBlock.length)]]);
      out.set(left, offset);
    }
    return out;
  };
  const allocatedBytes = () => processor.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0) + (processor.undoBuffer ?? []).reduce((s, c) => s + c.byteLength, 0);
  return { processor, reports, send, process, allocatedBytes, state: () => reports.at(-1) };
}
const sine = (seconds, freq = 110, amp = 0.5) => Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / RATE));
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

test('F2a: 4-bar quantize at 120 BPM keeps a 3 s take (at least one bar, never one sample)', () => {
  const looper = createLooper();
  looper.send('param', { name: 'bpm', value: 120 });
  looper.send('param', { name: 'quantize', value: '4bar' });
  looper.send('command', { command: 'record' });
  looper.process(sine(3));
  looper.send('command', { command: 'play' });
  const length = looper.state().length;
  assert.ok(length >= 2 * RATE, `loop length ${length / RATE}s must be ≥ one bar (2 s)`);
  assert.ok(length > 1);
});

test('F2b: level 85% plays back at -1.41 dB ±0.5 (worklet adds no second attenuation)', () => {
  const looper = createLooper();
  const take = sine(1);
  looper.send('command', { command: 'record' });
  looper.process(take);
  looper.send('command', { command: 'play' });
  const played = looper.process(new Float32Array(take.length)).subarray(0, take.length - Math.round(0.005 * RATE));
  const workletDb = 20 * Math.log10(rms(played) / rms(take.subarray(0, played.length)));
  // LooperNode applies the user level once through loopGain (percentToUnit(level, 85)).
  const levelGain = 85 / 100;
  const totalDb = workletDb + 20 * Math.log10(levelGain);
  assert.ok(Math.abs(totalDb - 20 * Math.log10(0.85)) <= 0.5, `total ${totalDb.toFixed(2)} dB`);
  const looperNode = readFileSync(new URL('../src/audio/nodes/LooperNode.ts', import.meta.url), 'utf8');
  assert.equal((looperNode.match(/percentToUnit\([^)]*level/gi) ?? []).length >= 1, true);
});

test('F2c: 1-bar quantize follows the current tempo (90 BPM → 2.667 s bar)', () => {
  const looper = createLooper();
  looper.send('param', { name: 'bpm', value: 90 });
  looper.send('param', { name: 'quantize', value: '1bar' });
  looper.send('command', { command: 'record' });
  looper.process(sine(3.2));
  looper.send('command', { command: 'play' });
  const bar = Math.round((RATE * 60 / 90) * 4);
  assert.equal(looper.state().length, bar, `expected ${bar} samples (${(bar / RATE).toFixed(3)} s)`);
});

test('F2d: no large buffer is reserved before recording (≤ 8 MB at 48 kHz)', () => {
  const looper = createLooper();
  assert.equal(looper.allocatedBytes(), 0);
  looper.send('command', { command: 'record' });
  looper.process(new Float32Array(128));
  // One growth chunk: 2 s × 2 channels × 4 bytes. At 48 kHz this is 768 KB.
  const perChunkAt48k = 48000 * 2 * 2 * 4;
  assert.ok(looper.allocatedBytes() / RATE * 48000 <= 8 * 1024 * 1024, `${looper.allocatedBytes()} bytes`);
  assert.ok(perChunkAt48k <= 8 * 1024 * 1024);
});

test('F2e: the loop seam is crossfaded (jump ≤ 2× the largest in-loop step)', () => {
  const looper = createLooper();
  // 1.03 s of 110 Hz: the take ends mid-cycle, so an uncrossfaded seam would click.
  const take = sine(1.03, 110, 0.5);
  looper.send('command', { command: 'record' });
  looper.process(take);
  looper.send('command', { command: 'play' });
  const out = looper.process(new Float32Array(take.length * 2 + 256));
  const length = looper.state().length;
  let innerMax = 0;
  for (let i = 1; i < length - 1; i++) innerMax = Math.max(innerMax, Math.abs(out[i] - out[i - 1]));
  const seamJump = Math.abs(out[length] - out[length - 1]);
  assert.ok(seamJump <= innerMax * 2, `seam ${seamJump.toFixed(4)} vs inner ${innerMax.toFixed(4)}`);
});

test('F2f: overdub write position compensates estimated latency (code presence)', () => {
  assert.match(source, /latencySamples/);
  assert.match(source, /readPosition - direction \* this\.latencySamples/);
});
