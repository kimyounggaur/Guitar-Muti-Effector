// Test-only DSP measurements (P1: F3, Q1, Q2). Served by the Vite dev server only.
import { usePresetStore } from '../../../src/store/presetStore';
import { NoiseGateEffect, prepareNoiseGate } from '../../../src/audio/nodes/NoiseGateEffect';
import { CompressorEffect, prepareCompressor } from '../../../src/audio/nodes/CompressorEffect';
import { LooperNode, subscribeLooper } from '../../../src/audio/nodes/LooperNode';
import { DriveEffect } from '../../../src/audio/nodes/DriveEffect';
import { AmpEQEffect } from '../../../src/audio/nodes/AmpEQEffect';
import { CabinetIREffect } from '../../../src/audio/nodes/CabinetIREffect';
import { ModulationEffect } from '../../../src/audio/nodes/ModulationEffect';
import { DelayEffect } from '../../../src/audio/nodes/DelayEffect';
import { ReverbEffect } from '../../../src/audio/nodes/ReverbEffect';
import type { EffectNodeWrapper, Pedal, PedalType } from '../../../src/audio/types';

const RATE = 44100;
const constructors: Partial<Record<PedalType, new (context: AudioContext, id: string) => EffectNodeWrapper>> = {
  noiseGate: NoiseGateEffect, compressor: CompressorEffect, drive: DriveEffect, ampEQ: AmpEQEffect,
  cabinetIR: CabinetIREffect, modulation: ModulationEffect, delay: DelayEffect, reverb: ReverbEffect,
};
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const db = (value: number) => Math.round(20 * Math.log10(Math.max(1e-12, value)) * 100) / 100;

/** Deterministic white noise (LCG) scaled to the requested RMS in dBFS. */
function noise(length: number, rmsDb: number) {
  let seed = 12345;
  const out = new Float32Array(length);
  const target = 10 ** (rmsDb / 20) * Math.sqrt(3); // uniform [-a, a] has RMS a/√3
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = (seed / 0xffffffff * 2 - 1) * target;
  }
  return out;
}
function sine(length: number, peakDb: number, freq = 1000) {
  const a = 10 ** (peakDb / 20);
  return Float32Array.from({ length }, (_, i) => a * Math.sin((2 * Math.PI * freq * i) / RATE));
}
function stats(buffer: AudioBuffer | Float32Array, fromSeconds: number) {
  const channels = buffer instanceof Float32Array ? [buffer] : Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  let sum = 0, peak = 0, count = 0;
  for (const values of channels) {
    for (let i = Math.floor(fromSeconds * RATE); i < values.length; i++) { sum += values[i] ** 2; peak = Math.max(peak, Math.abs(values[i])); count++; }
  }
  return { rmsDb: db(Math.sqrt(sum / count)), peakDb: db(peak) };
}

async function render(pedals: Pedal[], input: Float32Array, trimDb = 0, tempoBpm = 120) {
  const offline = new OfflineAudioContext(2, input.length, RATE);
  const ctx = offline as unknown as AudioContext;
  await Promise.all([prepareNoiseGate(ctx), prepareCompressor(ctx)]);
  const buffer = offline.createBuffer(1, input.length, RATE);
  buffer.copyToChannel(input, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  let previous: AudioNode = source;
  const effects: EffectNodeWrapper[] = [];
  for (const pedal of pedals) {
    if (!pedal.enabled || pedal.bypassed) continue;
    const Ctor = constructors[pedal.type];
    if (!Ctor) continue;
    const effect = new Ctor(ctx, pedal.id);
    effect.setTempo?.(tempoBpm); // the engine forwards the shared tempo the same way
    for (const [name, value] of Object.entries(pedal.params)) effect.setParam(name, value);
    effect.setBypass(false);
    previous.connect(effect.input);
    previous = effect.output;
    effects.push(effect);
  }
  const trim = offline.createGain();
  trim.gain.value = 10 ** (trimDb / 20);
  previous.connect(trim).connect(offline.destination);
  await wait(450);
  source.start();
  const out = await offline.startRendering();
  effects.forEach((e) => e.dispose());
  return out;
}

const factory = () => usePresetStore.getState().presets.filter((p) => p.origin === 'factory');
const withGate = (pedals: Pedal[], gate: 'max' | 'bypass') =>
  pedals.map((p) => (p.type === 'noiseGate' ? { ...p, enabled: gate === 'max', bypassed: gate !== 'max', params: { ...p.params, thresholdDb: -10 } } : p));
const pickPresets = () => {
  const all = factory();
  return [all[0], all.find((p) => p.name.includes('High Gain Lead')) ?? all.find((p) => p.category === 'High Gain')!];
};

async function measureF3() {
  const input = noise(RATE * 3, -46);
  const rows = [];
  for (const preset of pickPresets()) {
    const out = await render(withGate(preset.pedals, 'max'), input, preset.outputTrimDb, preset.tempoBpm);
    rows.push({ preset: preset.name, ...stats(out, 1) });
  }
  return rows;
}

async function measureQ1() {
  const input = noise(RATE * 2, -60);
  const inStats = stats(input, 0.5);
  const all = factory();
  const rows = [];
  for (const preset of [all[0], all.find((p) => p.category === 'High Gain')!]) {
    const out = await render(withGate(preset.pedals, 'bypass'), input, 0, preset.tempoBpm);
    const o = stats(out, 0.5);
    rows.push({ preset: preset.name, inputRmsDb: inStats.rmsDb, outputRmsDb: o.rmsDb, gainDb: Math.round((o.rmsDb - inStats.rmsDb) * 100) / 100 });
  }
  return rows;
}

async function measureQ2() {
  const drive: Pedal = { id: 'drive', type: 'drive', name: 'Drive', enabled: true, bypassed: false, params: { mode: 'overdrive', drive: 48 } };
  const rows = [];
  for (const level of [-40, -20, -6]) {
    const out = await render([drive], sine(RATE, level));
    rows.push({ inputPeakDb: level, outputPeakDb: stats(out, 0.3).peakDb });
  }
  return rows;
}

async function measureLooperLevel() {
  const offline = new OfflineAudioContext(2, RATE, RATE);
  const looper = new LooperNode(offline as unknown as AudioContext, 'level-probe');
  let unsubscribe: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      unsubscribe = subscribeLooper(looper.id, ({ state }) => {
        if (state === 'idle') resolve();
        if (state === 'error') reject(new Error('Could not start the looper worklet'));
      });
    });
    looper.setParam('level', 85);
    const source = offline.createOscillator();
    source.frequency.value = 220;
    source.connect(looper.input);
    looper.connect(offline.destination);
    looper.setParam('__looperCommand', 'record');
    source.start();
    source.stop(0.5);
    // Freeze at a render quantum between recording and playback, while the dry input becomes silent.
    const halfway = offline.suspend(0.5);
    const rendered = offline.startRendering();
    await halfway;
    looper.setParam('__looperCommand', 'play');
    await offline.resume();
    const samples = (await rendered).getChannelData(0);
    const rms = (start: number) => {
      const window = samples.subarray(Math.round(start * RATE), Math.round((start + 0.2) * RATE));
      return Math.sqrt(window.reduce((sum, value) => sum + value ** 2, 0) / window.length);
    };
    const inputRms = rms(0.15);
    const playbackRms = rms(0.65);
    return { inputRms, playbackRms, gainDb: db(playbackRms / inputRms) };
  } finally {
    unsubscribe?.();
    looper.dispose();
  }
}

Object.assign(window, { measureF3, measureQ1, measureQ2, measureLooperLevel });
document.querySelector('#status')!.textContent = 'loaded';
