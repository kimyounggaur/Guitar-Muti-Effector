import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/audio/worklets/looper-processor.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
let Processor;
const reports = [];
class WorkletStub {
  constructor() { this.port = { postMessage: (message) => reports.push(message), onmessage: null }; }
}
vm.runInNewContext(javascript, {
  sampleRate: 1000,
  AudioWorkletProcessor: WorkletStub,
  registerProcessor: (_, processor) => { Processor = processor; },
  Float32Array, Math, Number,
});
const processor = new Processor();
const send = (type, props) => processor.port.onmessage({ data: { type, ...props } });
const run = (length, value = 0.4) => {
  const input = new Float32Array(length).fill(value);
  const left = new Float32Array(length);
  processor.process([[input]], [[left, new Float32Array(length)]]);
  return left;
};

send('param', { name: 'quantize', value: '4bar' });
send('command', { command: 'record' });
run(3000);
send('command', { command: 'play' });
assert.equal(reports.at(-1).length, 3000, 'a short quantized take must not collapse to one sample');
assert.ok(Math.abs(run(1)[0] - 0.4) < 0.0001, 'worklet must not apply a second level reduction');
send('command', { command: 'clear' });
send('param', { name: 'bpm', value: 60 });
send('param', { name: 'quantize', value: '1bar' });
send('command', { command: 'record' });
run(5300);
send('command', { command: 'play' });
assert.equal(reports.at(-1).length, 4000, 'quantization must follow the shared tempo');
send('command', { command: 'overdub' });
run(100, 0.2);
send('command', { command: 'undo' });
assert.equal(reports.at(-1).canUndo, false, 'undo must restore and consume the previous take');
console.log('Looper tests passed');
