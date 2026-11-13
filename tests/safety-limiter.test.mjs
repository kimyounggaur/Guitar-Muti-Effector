import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function limiter() {
  const source = readFileSync(new URL('../src/audio/worklets/safety-limiter-processor.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let Ctor;
  class AudioWorkletProcessor { constructor() { this.port = {}; } }
  vm.runInNewContext(js, { exports: {}, sampleRate: 48000, AudioWorkletProcessor, registerProcessor: (_name, ctor) => { Ctor = ctor; } });
  return new Ctor();
}
function process(c, channels) {
  const output = channels.map((channel) => new Float32Array(channel.length));
  c.process([channels], [output]);
  return output;
}

test('transient is limited on the same sample and stereo gain is linked', () => {
  const c = limiter();
  const left = new Float32Array([0, 4, 0.2, 0.2]);
  const right = new Float32Array([0, 1, 0.1, 0.1]);
  const out = process(c, [left, right]);
  assert.ok(Math.abs(out[0][1] - 0.8) < 1e-6);
  assert.ok(Math.abs(out[1][1] - 0.2) < 1e-6);
  assert.equal(out[0][0], 0, 'no early signal');
  assert.ok(out[0][2] < 0.05, '80ms release does not instantly restore gain');
  assert.ok(out[0][3] > out[0][2], 'gain recovers smoothly');
});

test('hard ceiling, non-finite guard, and no amplification for arbitrary peaks', () => {
  const c = limiter();
  const left = Float32Array.from([0.6, -1, 100, -100, NaN, Infinity, -Infinity, 0.1, 0.8]);
  const right = Float32Array.from([0.3, 0.2, -5, 0, 0.6, 0.5, -0.1, NaN, 0.8]);
  const out = process(c, [left, right]);
  for (let ch = 0; ch < 2; ch++) {
    const src = [left, right][ch];
    for (let i = 0; i < src.length; i++) {
      assert.ok(Number.isFinite(out[ch][i]));
      assert.ok(Math.abs(out[ch][i]) <= 0.80000002);
      assert.ok(Math.abs(out[ch][i]) <= (Number.isFinite(src[i]) ? Math.abs(src[i]) : 0) + 1e-7);
    }
  }
});
