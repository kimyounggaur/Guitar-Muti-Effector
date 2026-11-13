import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compressor() {
  const source = readFileSync(new URL('../src/audio/worklets/compressor-processor.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let Ctor;
  class AudioWorkletProcessor { constructor() { this.port = { postMessage: (m) => { this.lastMessage = m; } }; } }
  vm.runInNewContext(js, { exports: {}, sampleRate: 48000, AudioWorkletProcessor, registerProcessor: (_name, ctor) => { Ctor = ctor; } });
  return new Ctor();
}
const set = (c, name, value) => c.port.onmessage({ data: { name, value } });
function block(c, l, r = l) {
  const input = [new Float32Array(128).fill(l), new Float32Array(128).fill(r)];
  const output = [new Float32Array(128), new Float32Array(128)];
  c.process([input], [output]);
  return output;
}
function configure(c) { set(c, 'threshold', -20); set(c, 'ratio', 4); set(c, 'knee', 0); set(c, 'attack', 0.001); set(c, 'release', 0.05); }

test('compressor is sample aligned and applies linked stereo compression', () => {
  const c = compressor(); configure(c);
  const first = block(c, 0.5, 0.05);
  assert.ok(first[0][0] > 0.4, 'first sample is not delayed');
  let out;
  for (let i = 0; i < 30; i++) out = block(c, 0.5, 0.05);
  assert.ok(out[0][127] > 0.14 && out[0][127] < 0.16, '4:1 output at -6dB input');
  assert.ok(Math.abs(out[0][127] / out[1][127] - 10) < 0.01, 'both channels receive the same gain');
});

test('ratio, knee, attack and release affect gain reduction and meter reports actual value', () => {
  const unity = compressor(); configure(unity); set(unity, 'ratio', 1);
  let out;
  for (let i = 0; i < 50; i++) out = block(unity, 0.5);
  assert.ok(Math.abs(out[0][127] - 0.5) < 1e-5);
  const c = compressor(); configure(c); set(c, 'attack', 0.1); set(c, 'release', 1); set(c, 'knee', 20);
  const early = block(c, 0.5)[0][127];
  for (let i = 0; i < 80; i++) out = block(c, 0.5);
  assert.ok(out[0][127] < early, 'attack increases compression gradually');
  assert.ok(c.lastMessage?.value < -1, 'meter measures reduction');
  const firstQuiet = block(c, 0.03)[0][127];
  for (let i = 0; i < 80; i++) out = block(c, 0.03);
  assert.ok(out[0][127] > firstQuiet, 'release recovers gradually');
  const soft = compressor(); configure(soft); set(soft, 'knee', 20);
  const hard = compressor(); configure(hard);
  let softOut, hardOut;
  for (let i = 0; i < 60; i++) { softOut = block(soft, 0.1); hardOut = block(hard, 0.1); }
  assert.ok(softOut[0][127] < hardOut[0][127] * 0.95, 'soft knee starts compressing at threshold');
});

test('non-finite input is silenced and cannot poison future gain calculation', () => {
  const c = compressor(); configure(c);
  const invalid = block(c, NaN, Infinity);
  assert.equal(invalid[0][0], 0);
  assert.equal(invalid[1][0], 0);
  const recovered = block(c, 0.2, 0.1);
  assert.ok(Number.isFinite(recovered[0][127]));
  assert.ok(recovered[0][127] > 0);
});
