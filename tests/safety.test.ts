import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine';
import { DelayEffect } from '../src/audio/nodes/DelayEffect';
import { createDriveCurve, DRIVE_MODES } from '../src/audio/utils/curves';
import { readLocal, writeLocal } from '../src/store/safeStorage';
import { playPreparedAudio } from '../src/components/audio/playPreparedAudio';

class Parameter {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
}
class FakeNode {
  gain = new Parameter(); frequency = new Parameter(); Q = new Parameter(); delayTime = new Parameter();
  type = ''; curve: Float32Array | null = null;
  outputs: FakeNode[] = [];
  connect(node: FakeNode) { this.outputs.push(node); return node; }
  disconnect() {}
  start() {}
  stop() {}
}
class FakeContext {
  currentTime = 0;
  createGain() { return new FakeNode(); }
  createDelay() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createChannelMerger() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
}

test('delay feedback stays bounded in every mode with nonresonant loop filters', () => {
  const effect = new DelayEffect(new FakeContext() as unknown as AudioContext, 'delay') as any;
  for (const mode of ['digital', 'analog', 'tape', 'slapback', 'pingpong']) {
    effect.setParam('mode', mode);
    for (const value of [0, 0.85, 0.95, 20]) {
      effect.setParam('feedback', value);
      for (const name of ['monoFeedback', 'leftFeedback', 'rightFeedback']) {
        assert.ok(effect[name].gain.value >= 0 && effect[name].gain.value <= 0.85, `${mode} ${name}`);
      }
    }
    for (const name of ['monoTone', 'leftTone', 'rightTone']) assert.ok(effect[name].Q.value <= Math.SQRT1_2);
  }
  const limiters = effect.nodes.filter((node: FakeNode) => node.curve);
  assert.equal(limiters.length, 3);
  for (const limiter of limiters) assert.ok(Math.max(...limiter.curve.map(Math.abs)) <= 0.801);
  effect.dispose();
});

test('drive bias does not emit a DC offset for silence', () => {
  for (const mode of DRIVE_MODES) for (const drive of [0, 48, 100]) for (const bias of [-1, 0, 1]) {
    // Odd sample count includes exactly x=0, the output for silent input.
    const curve = createDriveCurve(mode, drive, bias, 4097);
    assert.ok(Math.abs(curve[2048]) < 1e-6, `${mode} ${drive} ${bias}`);
    assert.ok(curve.every(Number.isFinite));
  }
});

test('blocked storage does not interrupt editing and reports a failed save', () => {
  let event = '';
  (globalThis as any).CustomEvent = class { constructor(public type: string) {} };
  (globalThis as any).window = {
    localStorage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } },
    dispatchEvent(e: { type: string }) { event = e.type; },
  };
  assert.equal(readLocal('test'), null);
  assert.equal(writeLocal('test', '{}'), false);
  assert.equal(event, 'pedalboard-storage-error');
});

test('delay bypass closes new input but leaves the tail audible and restores routing on resume', () => {
  const effect = new DelayEffect(new FakeContext() as unknown as AudioContext, 'delay') as any;
  effect.setParam('mix', 40);
  effect.setBypass(true);
  assert.equal(effect.wetInput.gain.value, 0);
  assert.equal(effect.wetGain.gain.value, 0.4);
  assert.equal(effect.dryGain.gain.value, 1);
  effect.setBypass(false);
  assert.equal(effect.wetInput.gain.value, 1);
  assert.equal(effect.wetGain.gain.value, 0.4);
  assert.equal(effect.dryGain.gain.value, 0.6);
});

test('a stopped or replaced player cannot start an unconnected audio element', async () => {
  let release!: () => void;
  let plays = 0;
  const original = { play: async () => { plays++; }, pause() {} } as unknown as HTMLAudioElement;
  const replacement = { play: async () => { plays++; }, pause() {} } as unknown as HTMLAudioElement;
  let current: HTMLAudioElement | null = original;
  const result = playPreparedAudio(original, () => current, () => new Promise<void>(resolve => { release = resolve; }));
  current = replacement;
  release();
  assert.equal(await result, false);
  assert.equal(plays, 0);
});


test('panic invalidates a pending microphone request and stops its eventual stream', async () => {
  let resolveStream!: (stream: MediaStream) => void;
  let stopped = 0;
  const fakeStream = { getTracks: () => [{ stop: () => { stopped++; } }] } as unknown as MediaStream;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { resolveStream = resolve; }) } } });
  (globalThis as any).window = { clearTimeout() {} };
  const engine = new AudioEngine() as any;
  engine.audioContext = { currentTime: 0 };
  const request = engine.replaceStream('input', engine.operationGeneration);
  engine.panicDisconnect();
  resolveStream(fakeStream);
  await assert.rejects(request, (error: any) => error.name === 'AbortError');
  assert.equal(stopped, 1);
  assert.equal(engine.stream, null);
  assert.equal(engine.currentMasterVolume, 0);
});

test('effect toggles keep an unchanged signal graph and tails intact', () => {
  const engine = new AudioEngine() as any;
  const calls: boolean[] = [];
  engine.audioContext = {};
  engine.masterGain = {};
  engine.inputMeter = {};
  engine.outputMeter = {};
  engine.source = {};
  engine.currentChainKey = JSON.stringify([['delay', 'delay']]);
  engine.currentPedalParams.set('delay', { mix: 40 });
  engine.effectMap.set('delay', { setBypass(value: boolean) { calls.push(value); }, setParam() { throw new Error('unchanged parameter was reapplied'); } });
  engine.rebuildChain([{ id: 'delay', type: 'delay', enabled: false, bypassed: false, params: { mix: 40 } }]);
  assert.deepEqual(calls, [true]);
  assert.equal(engine.pendingRebuildTimer, 0);
});
