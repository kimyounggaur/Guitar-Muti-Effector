import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual worklet on deterministic sample blocks, without audio hardware.
function createGate() {
  const source = readFileSync(new URL('../src/audio/worklets/noise-gate-processor.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let Processor;
  class AudioWorkletProcessor { constructor() { this.port = {}; } }
  vm.runInNewContext(js, {
    exports: {}, sampleRate: 48000, AudioWorkletProcessor,
    registerProcessor: (_name, constructor) => { Processor = constructor; },
  });
  return new Processor();
}
function block(gate, leftValue, rightValue = leftValue) {
  const input = [new Float32Array(128).fill(leftValue), new Float32Array(128).fill(rightValue)];
  const output = [new Float32Array(128), new Float32Array(128)];
  gate.process([input], [output]);
  return output;
}
function set(gate, name, value) { gate.port.onmessage({ data: { name, value } }); }

test('gate attenuates quiet noise, opens for signal, then closes after hold and release', () => {
  const gate = createGate();
  set(gate, 'thresholdDb', -30);
  set(gate, 'attackMs', 1);
  set(gate, 'holdMs', 10);
  set(gate, 'releaseMs', 20);
  for (let i = 0; i < 30; i++) assert.equal(block(gate, 0.005)[0][127], 0);
  let output;
  for (let i = 0; i < 20; i++) output = block(gate, 0.2);
  assert.ok(output[0][127] > 0.19, 'signal above threshold passes');
  for (let i = 0; i < 80; i++) output = block(gate, 0.005);
  assert.ok(Math.abs(output[0][127]) < 1e-7, 'gate closes after the signal ends');
});

test('stereo channels share the same detector and gain', () => {
  const gate = createGate();
  set(gate, 'thresholdDb', -30);
  set(gate, 'attackMs', 1);
  let output;
  for (let i = 0; i < 10; i++) output = block(gate, 0.2, 0.01);
  assert.ok(output[1][127] > 0.009, 'right channel opens with left-channel signal');
  assert.ok(Math.abs(output[0][127] / output[1][127] - 20) < 0.01);
});
