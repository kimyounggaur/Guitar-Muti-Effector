// Test-only harness served by the Vite dev server (never part of the production build).
// Renders every factory preset through the real effect classes in an OfflineAudioContext,
// with the same deterministic plucked test signal as tests/audio-calibration.ts.
import { usePresetStore } from '../../../src/store/presetStore';
import { NoiseGateEffect, prepareNoiseGate } from '../../../src/audio/nodes/NoiseGateEffect';
import { CompressorEffect, prepareCompressor } from '../../../src/audio/nodes/CompressorEffect';
import { DriveEffect } from '../../../src/audio/nodes/DriveEffect';
import { AmpEQEffect } from '../../../src/audio/nodes/AmpEQEffect';
import { CabinetIREffect } from '../../../src/audio/nodes/CabinetIREffect';
import { ModulationEffect } from '../../../src/audio/nodes/ModulationEffect';
import { DelayEffect } from '../../../src/audio/nodes/DelayEffect';
import { ReverbEffect } from '../../../src/audio/nodes/ReverbEffect';
import type { EffectNodeWrapper, PedalType } from '../../../src/audio/types';

export type PresetMeasurement = { id: string; name: string; outputTrimDb: number; peakDb: number; rmsDb: number };

const constructors: Partial<Record<PedalType, new (context: AudioContext, id: string) => EffectNodeWrapper>> = {
  noiseGate: NoiseGateEffect, compressor: CompressorEffect, drive: DriveEffect, ampEQ: AmpEQEffect,
  cabinetIR: CabinetIREffect, modulation: ModulationEffect, delay: DelayEffect, reverb: ReverbEffect,
};
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const round = (value: number) => Math.round(value * 100) / 100;

export function pluckedTestSignal(context: BaseAudioContext, rate: number, duration: number) {
  const input = context.createBuffer(1, rate * duration, rate);
  const samples = input.getChannelData(0);
  const frequencies = [82.4069, 110, 146.832, 196];
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    let v = 0;
    for (let note = 0; note < frequencies.length; note++) {
      const x = t - (0.12 + note * 0.5);
      if (x < 0) continue;
      const env = Math.min(1, x / 0.008) * Math.exp(-x * 3.1);
      const f = frequencies[note];
      v += 0.15 * env * (Math.sin(2 * Math.PI * f * x) + 0.45 * Math.sin(4 * Math.PI * f * x) + 0.2 * Math.sin(6 * Math.PI * f * x));
    }
    samples[i] = v;
  }
  return input;
}

async function measure(preset: ReturnType<typeof usePresetStore.getState>['presets'][number]): Promise<PresetMeasurement> {
  const rate = 44100;
  const duration = 2.5;
  const offline = new OfflineAudioContext(2, rate * duration, rate);
  const ctx = offline as unknown as AudioContext;
  await Promise.all([prepareNoiseGate(ctx), prepareCompressor(ctx)]);
  const source = offline.createBufferSource();
  source.buffer = pluckedTestSignal(offline, rate, duration);
  let previous: AudioNode = source;
  const effects: EffectNodeWrapper[] = [];
  for (const pedal of preset.pedals) {
    if (!pedal.enabled || pedal.bypassed) continue;
    const Ctor = constructors[pedal.type];
    if (!Ctor) continue; // tuner, stopped looper and stopped rhythm are pass-through
    const effect = new Ctor(ctx, pedal.id);
    for (const [name, value] of Object.entries(pedal.params)) effect.setParam(name, value);
    effect.setBypass(false);
    previous.connect(effect.input);
    previous = effect.output;
    effects.push(effect);
  }
  // Preset trim is applied like the engine does (attenuation only); limiter and master are not part of the probe.
  const trim = offline.createGain();
  trim.gain.value = 10 ** (Math.max(-36, Math.min(0, preset.outputTrimDb)) / 20);
  previous.connect(trim).connect(offline.destination);
  await wait(450); // recorded IR fetch/decode and debounced reverb generation
  source.start();
  const buffer = await offline.startRendering();
  let sum = 0;
  let peak = 0;
  let count = 0;
  const begin = Math.floor(rate * 0.1);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const values = buffer.getChannelData(channel);
    for (let i = begin; i < values.length; i++) {
      const v = values[i];
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
      count++;
    }
  }
  effects.forEach((effect) => effect.dispose());
  return {
    id: preset.id,
    name: preset.name,
    outputTrimDb: preset.outputTrimDb,
    peakDb: round(20 * Math.log10(Math.max(1e-12, peak))),
    rmsDb: round(20 * Math.log10(Math.max(1e-12, Math.sqrt(sum / count)))),
  };
}

async function measureFactoryPresets(): Promise<PresetMeasurement[]> {
  const presets = usePresetStore.getState().presets.filter((preset) => preset.origin === 'factory');
  const rows: PresetMeasurement[] = [];
  for (const preset of presets) {
    rows.push(await measure(preset));
    document.querySelector('#status')!.textContent = `${rows.length}/${presets.length}`;
  }
  return rows;
}

(window as unknown as { measureFactoryPresets: typeof measureFactoryPresets }).measureFactoryPresets = measureFactoryPresets;
document.querySelector('#status')!.textContent = 'loaded';
