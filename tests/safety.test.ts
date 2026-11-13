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

test('synthetic reverb cache reuses buffers for a context and bounds retention', async () => {
  const { createSyntheticReverbImpulse } = await import('../src/audio/utils/impulse');
  let allocations = 0;
  const context = {
    sampleRate: 8000,
    createBuffer(channels: number, length: number) {
      allocations++;
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, getChannelData: (channel: number) => data[channel] };
    },
  } as unknown as AudioContext;
  const first = createSyntheticReverbImpulse(context, 'room', 0.91);
  assert.equal(createSyntheticReverbImpulse(context, 'room', 0.89), first);
  assert.equal(allocations, 1);
  for (const mode of ['hall', 'plate', 'spring', 'ambient'] as const) createSyntheticReverbImpulse(context, mode, 0.9);
  createSyntheticReverbImpulse(context, 'room', 1.1);
  createSyntheticReverbImpulse(context, 'room', 1.2);
  assert.notEqual(createSyntheticReverbImpulse(context, 'room', 0.9), first);
});

test('input track end panics once and intentional stop does not report unplug', async () => {
  let end: (() => void) | null = null;
  let notices = 0;
  let stops = 0;
  const track = { addEventListener(_event: string, fn: () => void) { end = fn; }, removeEventListener() { end = null; }, stop() { stops++; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } });
  (globalThis as any).window = { clearTimeout() {} };
  const engine = new AudioEngine() as any;
  engine.audioContext = { currentTime: 0, createMediaStreamSource: () => new FakeNode() };
  engine.setInputEndedHandler(() => { notices++; });
  await engine.replaceStream('', engine.operationGeneration);
  assert.ok(end);
  const fire = end as () => void;
  fire();
  fire();
  assert.equal(notices, 1);
  assert.equal(stops, 1);
  assert.equal(engine.currentMasterVolume, 0);
  assert.equal(engine.stream, null);
  await engine.replaceStream('', engine.operationGeneration);
  engine.stopTracks();
  assert.equal(notices, 1);
});

test('output selection checks context and rejects stale operations', async () => {
  const engine = new AudioEngine() as any;
  await assert.rejects(engine.setOutputDevice('abc'));
  let selected = '';
  engine.audioContext = { state: 'running', async setSinkId(id: string) { selected = id; } };
  await engine.setOutputDevice('headphones');
  assert.equal(selected, 'headphones');
  let release!: () => void;
  engine.audioContext = { state: 'running', setSinkId: () => new Promise<void>(resolve => { release = resolve; }) };
  const request = engine.setOutputDevice('speaker');
  engine.operationGeneration++;
  release();
  await assert.rejects(request, (error: any) => error.name === 'AbortError');
});

test('preset trim only attenuates and survives context-independent changes', () => {
  const engine = new AudioEngine() as any;
  engine.setPresetTrimDb(12);
  assert.equal(engine.presetTrimDb, 0);
  engine.setPresetTrimDb(-100);
  assert.equal(engine.presetTrimDb, -36);
  const gain = new Parameter();
  engine.audioContext = { currentTime: 0 };
  engine.presetTrimGain = { gain };
  engine.setPresetTrimDb(-6);
  assert.ok(Math.abs(gain.value - Math.pow(10, -6 / 20)) < 1e-9);
});

test('factory presets retain 108 measured, non-boosting trims and reflect active effects', async () => {
  const { usePresetStore } = await import('../src/store/presetStore');
  const { factoryMeasurement } = await import('../src/store/factoryCalibration');
  const presets = usePresetStore.getState().presets.filter(preset => preset.origin === 'factory');
  assert.equal(presets.length, 108);
  assert.equal(new Set(presets.map(preset => preset.id)).size, 108);
  assert.ok(Object.values(factoryMeasurement).every(rows => rows.length === 12));
  assert.equal(Object.values(factoryMeasurement).reduce((total, rows) => total + rows.length, 0), 108);
  const categoryPositions = new Map<string, number>();
  let nearTarget = 0;
  for (const preset of presets) {
    const index = categoryPositions.get(preset.category) ?? 0;
    categoryPositions.set(preset.category, index + 1);
    const [rms, peak] = factoryMeasurement[preset.category][index];
    if (Math.abs(rms + preset.outputTrimDb + 45) <= 3) nearTarget++;
    assert.ok(peak + preset.outputTrimDb <= -8 + 0.001);
    assert.ok(Number.isFinite(preset.outputTrimDb) && preset.outputTrimDb >= -36 && preset.outputTrimDb <= 0);
    const drive = preset.pedals.find(pedal => pedal.type === 'drive');
    if (drive && drive.enabled && !drive.bypassed && Number(drive.params.mix) !== 0) {
      assert.ok(preset.name.toLowerCase().includes(String(drive.params.mode).toLowerCase()));
    } else assert.ok(preset.name.includes('Clean'));
    const cab = preset.pedals.find(pedal => pedal.type === 'cabinetIR');
    assert.notEqual(cab?.params.cabinetType, 'custom');
    assert.ok(Math.abs(Number(drive?.params.bias || 0)) <= (preset.category === 'Experimental' ? .251 : 1));
  }
  assert.equal(nearTarget, 86);
});

test('every final output passes trim, limiter and master before the output meter', () => {
  const engine = new AudioEngine() as any;
  const bus = new FakeNode(), trim = new FakeNode(), limiter = new FakeNode();
  const master = new FakeNode(), meter = new FakeNode(), destination = new FakeNode();
  engine.audioContext = { destination };
  engine.chainOutput = bus;
  engine.presetTrimGain = trim;
  engine.safetyLimiter = limiter;
  engine.masterGain = master;
  engine.outputMeter = { input: meter, output: meter };
  engine.connectSafeOutput();
  assert.deepEqual(bus.outputs, [trim]);
  assert.deepEqual(trim.outputs, [limiter]);
  assert.deepEqual(limiter.outputs, [master]);
  assert.deepEqual(master.outputs, [meter]);
  assert.deepEqual(meter.outputs, [destination]);
});
